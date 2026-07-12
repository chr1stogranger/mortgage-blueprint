// api/propertydetails.js
// Vercel Serverless Function — fetches property photos + description from RapidAPI
// Endpoints:
//   /api/propertydetails?zpid=12345678                     — Zillow-sourced rows
//   /api/propertydetails?rcid=rc_...&address=Street,City…  — RentCast rows:
//     resolves the address to a Zillow zpid via /search, fetches details, and
//     PERSISTS photos/description/list_price into pp_property_pool so each
//     property is enriched at most once, ever.

import { createClient } from "@supabase/supabase-js";
import { applyCors, isPrivileged } from "./_cors.js";
import { rateLimited } from "./_ratelimit.js";

export const config = { maxDuration: 30 };

// ─── In-memory cache (persists across warm invocations) ───
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours — property details don't change often

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Zillow serves maps.googleapis.com Street View as imgSrc for some homes —
// those 403 when hotlinked from our domain. Treat as no-photo.
function isUsablePhoto(u) {
  return !!u && typeof u === "string" && !u.includes("maps.googleapis.com") && !u.includes("streetview");
}

// A sold condo's CURRENT Zillow page is often a for-rent listing (sell → re-rent).
// Without these guards we ingested $5,600/mo rent as "list price" on a $1.05M
// sale, and a lease-terms description, into the game card.
function isRentalText(text) {
  return !!text && /lease type|rent due|notice period|security deposit|monthly rent|per month|application fee|pet deposit/i.test(text);
}
// A believable SALE list price: real number, ≥ $50k, and within a plausible
// band of the known sold price (rents fail the ratio instantly).
function saneListPrice(lp, soldPrice) {
  if (!lp || lp < 50000) return null;
  if (soldPrice && (lp < soldPrice * 0.2 || lp > soldPrice * 5)) return null;
  if (soldPrice && lp === soldPrice) return null; // not a real anchor — would leak the answer
  return lp;
}

// Collect every non-empty string value for `key` in traversal (document)
// order. Redfin's detail payload carries listingRemarks in multiple places:
// the SUBJECT home's ~700-char truncated preview comes FIRST, its full text
// may appear later — but so do OTHER homes' remarks (similar-listings
// sections). So: take the first copy as the subject anchor, and upgrade to a
// longer copy ONLY if it starts with the same text (a longer version of the
// same remarks, never another home's).
// ─── Subject-verified extraction ───
// The payload embeds OTHER homes (similar-listings sections) carrying their
// own listingRemarks/price events, and traversal order is NOT a reliable
// "subject first" signal (3241 Briggs Ave briefly showed an Oakland 4-plex's
// remarks). Candidates are collected with the nearest ancestor propertyId +
// path; we only accept ones provably owned by the subject — else nothing.
const addrNorm = (a) => String(a || "").toLowerCase().replace(/[^a-z0-9]/g, "");
function collectRedfin(obj, out, ctxPid = null, ctxAddr = null, path = "", depth = 0, ctxHomeId = null) {
  if (!obj || typeof obj !== "object" || depth > 12) return out;
  const pid = obj.propertyId != null ? String(obj.propertyId) : ctxPid;
  // Nearest-ancestor street address is the ownership signal that holds
  // across Redfin's id spaces (search-sold propertyId != detail propertyId:
  // rf_1790168's own remarks appeared under pid 2008181).
  const ownAddr = obj.addressInfo?.formattedStreetLine
    || obj.streetLine?.value || (typeof obj.streetLine === "string" ? obj.streetLine : null);
  const addr = ownAddr ? addrNorm(ownAddr) : ctxAddr;
  // Canonical url ".../home/<id>" uses the SAME id space as our rf_ rows —
  // the strongest ownership signal (payload propertyId fields do not).
  const urlId = typeof obj.url === "string" ? (obj.url.match(/\/home\/(\d+)/) || [])[1] : null;
  const homeId = urlId || ctxHomeId;
  for (const k of ["listingRemarks", "marketingRemarks"]) {
    if (typeof obj[k] === "string" && obj[k].trim().length > 0) {
      out.remarks.push({ text: obj[k], pid, addr, homeId, path });
    }
  }
  const evt = obj.eventDescription || obj.event || obj.eventDescriptionFull || null;
  if (evt && /listed/i.test(String(evt))) {
    const price = Number(obj.price?.value ?? obj.price ?? 0);
    const date = Number(obj.eventDate ?? obj.date ?? 0);
    if (price > 0) out.listed.push({ price, date, pid, addr, homeId, path });
  }
  if (typeof obj.propertyType === "number" && (obj.propertyId != null || ownAddr)) {
    out.types.push({ type: obj.propertyType, pid: obj.propertyId != null ? String(obj.propertyId) : pid, addr, homeId, path });
  }
  for (const [k, v] of Object.entries(obj)) {
    collectRedfin(v, out, pid, addr, path + "/" + k, depth + 1, homeId);
  }
  return out;
}
// Same coding as sold-comps ingest (4 = Multi-family verified live)
const RF_TYPES = { 6: "Single Family", 3: "Condo", 13: "Townhouse", 4: "Multi-Family", 20: "Multi-Family", 7: "Manufactured", 8: "Manufactured" };
const SUBJECT_PATHS = /mainhouseinfo|abovethefold|propertyhistoryinfo|amphouseinfo/i;
function subjectFilter(cands, subjectPid, subjectAddr) {
  const own = cands.filter(c =>
    (c.homeId && subjectPid && c.homeId === subjectPid) ||
    (c.addr && subjectAddr && c.addr === subjectAddr) ||
    (c.pid && subjectPid && c.pid === subjectPid));
  if (own.length) return own;
  return cands.filter(c => SUBJECT_PATHS.test(c.path));
}
export default async function handler(req, res) {
  // Shared scoped CORS (now also covers the Capacitor native origins) + rate limit.
  if (applyCors(req, res)) return;
  if (rateLimited(req, res, { limit: 30 })) return;

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "RAPIDAPI_KEY not configured" });
  }

  const apiHost = process.env.RAPIDAPI_HOST || "real-time-real-estate-data.p.rapidapi.com";
  let zpid = req.query.zpid;
  const rcid = req.query.rcid;
  const address = req.query.address;
  const skipCache = req.query.fresh === "1";
  if (!zpid && !(rcid && address)) {
    return res.status(400).json({ error: "zpid, or rcid + address, required" });
  }

  // Cache key: rc_ id for RentCast rows (stable), zillow zpid otherwise.
  const cacheKey = rcid || zpid;

  // Check cache (skip if ?fresh=1, or if cached result has no photos — re-fetch to get real data)
  if (!skipCache) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.data.photos?.length > 0) {
      res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
      return res.status(200).json({ ...cached.data, cached: true });
    }
    // Clear stale/empty cached entries
    if (cached && (!cached.data.photos?.length || Date.now() - cached.timestamp > CACHE_TTL)) {
      cache.delete(cacheKey);
    }
  } else {
    cache.delete(cacheKey);
  }

  // ─── RentCast row: check the pool for prior enrichment, else resolve address → zpid ───
  let rcSoldPrice = null; // known sale price for sanity-checking enriched list prices
  if (!zpid && rcid) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data: rows } = await supabase
        .from("pp_property_pool")
        .select("photo, photos, description, list_price, sold_price, detail_url, address, zip, listing_id")
        .eq("zpid", rcid)
        .limit(1);
      const row = rows && rows[0];
      if (row) rcSoldPrice = row.sold_price || null;

      // ─── Redfin row (rf_): description via Redfin's own detail endpoint ───
      // Photos already came from search-sold; only the MLS listing remarks
      // are missing. One detail-by-url call, persisted, so each comp is
      // enriched at most once ever.
      if (rcid.startsWith("rf_")) {
        // description.length === 700 is the Redfin preview-cut signature —
        // rows persisted before the longest-copy fix are stuck mid-word;
        // let them fall through and re-enrich once.
        if (!skipCache && row?.description && row.description.length !== 700 && row.list_price !== row.sold_price) {
          const out = {
            zpid: rcid,
            photos: (row.photos || []).filter(isUsablePhoto),
            description: row.description,
            listPrice: saneListPrice(row.list_price, row.sold_price),
            photoCount: (row.photos || []).length,
            cached: true,
            source: "pool",
          };
          res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
          return res.status(200).json(out);
        }
        let description = row?.description || "";
        let listedPrice; // undefined = no attempt made
        let fixedType = null;
        let upstreamOk = false;
        // properties/details is the SUBJECT-specific endpoint (verified: it
        // carries the home's own listingRemarks). It takes the canonical
        // url — NOT propertyId+listingId (that's main-info's signature; the
        // error body says "url is required"). detail-by-url (similar-homes
        // payload, only OTHER homes' remarks) remains abandoned.
        if (row?.detail_url) {
          const REDFIN_HOST = "redfin-com-data.p.rapidapi.com";
          try {
            // The endpoint expects the redfin PATH (example: "/WA/Camas/...
            // /home/18426094"), not a full https URL.
            const rfPath = String(row.detail_url).replace(/^https?:\/\/(www\.)?redfin\.com/, "");
            const dResp = await fetch(
              `https://${REDFIN_HOST}/properties/details?url=${encodeURIComponent(rfPath)}`,
              { headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": REDFIN_HOST } }
            );
            console.error(`[PropertyDetails] redfin detail ${rcid}: status=${dResp.status} quota-left=${dResp.headers.get("x-ratelimit-requests-remaining") || "?"}`);
            const dj = await dResp.json().catch(() => null);
            // Upstream failures ({status:false, "Service Temporarily
            // Unavailable"}) must NOT persist the attempted-sentinel — the
            // row keeps retrying on later views until a real payload lands.
            upstreamOk = !!(dj && dj.status !== false && dj.data);
            if (dj && JSON.stringify(dj).indexOf("listingRemarks") === -1) {
              console.error(`[PropertyDetails] details raw head ${rcid}: ${JSON.stringify(dj).slice(0, 400)}`);
            }
            const subjectPid = rcid.slice(3); // rf_<propertyId>
            const subjectAddr = addrNorm(row?.address);
            const collected = collectRedfin(dj, { remarks: [], listed: [], types: [] });
            let subjRemarks = subjectFilter(collected.remarks, subjectPid, subjectAddr);
            // properties/details is subject-scoped: if no candidate carries an
            // ownership signal, the payload's remarks ARE the subject's.
            if (subjRemarks.length === 0 && collected.remarks.length > 0) {
              const unowned = collected.remarks.filter(c => !c.homeId && !c.addr && !c.pid);
              if (unowned.length === collected.remarks.length) subjRemarks = collected.remarks;
            }
            // Longest subject-owned copy (short copies are truncated previews)
            description = subjRemarks.length
              ? subjRemarks.reduce((a, b) => (b.text.length > a.text.length ? b : a)).text
              : ""; // never keep an unverifiable description
            if (isRentalText(description)) description = "";
            // Most recent subject-owned "Listed" event = this sale cycle's list price
            const subjListed = subjectFilter(collected.listed, subjectPid, subjectAddr)
              .sort((a, b) => b.date - a.date);
            listedPrice = saneListPrice(subjListed[0]?.price || null, row?.sold_price);
            // Subject-verified property type — heals rows ingested under the
            // old (wrong) code mapping.
            const subjType = collected.types.find(t => (t.homeId && t.homeId === subjectPid) || (t.addr && t.addr === subjectAddr) || t.pid === subjectPid);
            if (subjType && RF_TYPES[subjType.type]) fixedType = RF_TYPES[subjType.type];
            console.error(`[PropertyDetails] redfin ${rcid}: remarks=${collected.remarks.length}/${subjRemarks.length} listed=${collected.listed.length}/${subjListed.length} price=${listedPrice || "none"} descLen=${description.length}`);
            if (subjRemarks.length === 0 && collected.remarks.length > 0) {
              // TEMP diagnostic: surface where remarks actually live
              const seen = new Set();
              for (const c of collected.remarks) {
                const key = c.path.replace(/\/\d+/g, "/N");
                if (seen.has(key)) continue;
                seen.add(key);
                console.error(`[PropertyDetails] remark-path pid=${c.pid || "-"} homeId=${c.homeId || "-"} addr=${c.addr || "-"} len=${c.text.length} path=${key.slice(-120)} :: ${c.text.slice(0, 40)}`);
                if (seen.size >= 8) break;
              }
            }
          } catch (e) {
            console.error(`[PropertyDetails] redfin detail failed for ${rcid}: ${e.message}`);
          }
          if (upstreamOk) {
            try {
              // list_price: real listed price, or NULL as the "attempted, none
              // found" sentinel (ingest placeholder was list=sold).
              const patch = { description: description || " ", list_price: listedPrice || null };
              if (fixedType) patch.property_type = fixedType;
              await supabase.from("pp_property_pool").update(patch).eq("zpid", rcid);
            } catch (e) {
              console.error(`[PropertyDetails] persist failed for ${rcid}: ${e.message}`);
            }
          }
        }
        const out = {
          zpid: rcid,
          photos: (row?.photos || []).filter(isUsablePhoto),
          description,
          listPrice: listedPrice || null,
          photoCount: (row?.photos || []).length,
          source: "redfin-detail",
        };
        if (out.photos.length > 0) cache.set(cacheKey, { timestamp: Date.now(), data: out });
        res.setHeader("Cache-Control", description ? "s-maxage=86400, stale-while-revalidate=3600" : "no-store");
        return res.status(200).json(out);
      }

      if (row && ((Array.isArray(row.photos) && row.photos.length > 0) || row.description)) {
        // Already enriched on a previous view — zero RapidAPI calls.
        const out = {
          zpid: rcid,
          photos: (row.photos || []).filter(isUsablePhoto),
          description: isRentalText(row.description) ? "" : (row.description || ""),
          listPrice: saneListPrice(row.list_price, row.sold_price),
          photoCount: (row.photos || []).length,
          cached: true,
          source: "pool",
        };
        res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
        return res.status(200).json(out);
      }
    }
    // Resolve the address to a Zillow zpid. A full street address returns the
    // exact home (usually exactly 1 result).
    try {
      const sResp = await fetch(`https://${apiHost}/search?location=${encodeURIComponent(address)}`, {
        headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": apiHost },
      });
      const sRaw = await sResp.json().catch(() => null);
      const list = (sRaw && (Array.isArray(sRaw.data) ? sRaw.data : sRaw.data?.results)) || [];
      const streetNum = String(address).trim().split(/\s+/)[0];
      let match = null;
      if (list.length === 1) match = list[0];
      else if (list.length > 1) {
        match = list.find(r => String(r?.streetAddress || r?.address || "").trim().startsWith(streetNum)) || null;
      }
      if (!match || !match.zpid) {
        // No Zillow record for this address — nothing to enrich with.
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ zpid: rcid, photos: [], description: "", resolved: false });
      }
      zpid = String(match.zpid);
    } catch (e) {
      console.error(`[PropertyDetails] address resolve failed for ${rcid}:`, e.message);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ zpid: rcid, photos: [], description: "", resolved: false });
    }
  }

  try {
    const url = `https://${apiHost}/property-details?zpid=${zpid}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": apiHost,
      },
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[PropertyDetails] API error ${response.status} for zpid=${zpid}: ${errText.slice(0, 200)}`);
      return res.status(response.status).json({ error: `API returned ${response.status}` });
    }

    const raw = await response.json();
    const d = raw.data || raw;

    // Debug mode: return ALL raw keys + sold-related fields
    if (req.query.debug === "1" && isPrivileged(req)) { // owner-only (L-2)
      const allKeys = Object.keys(d);
      const soldFields = {};
      for (const k of ["priceHistory","taxHistory","nearbyHomes","comps","recentlySold","nearbyProperties","dateSold","homeStatus","price","listPrice","zestimate","contingentListingType","homeStatusForHDP"]) {
        if (d[k] !== undefined) {
          const v = d[k];
          soldFields[k] = Array.isArray(v) ? { type: "array", length: v.length, first: v[0] } : typeof v === "object" && v ? { type: "object", keys: Object.keys(v) } : v;
        }
      }
      return res.status(200).json({ zpid, allKeys, keyCount: allKeys.length, soldFields, homeStatus: d.homeStatus, dateSold: d.dateSold });
    }

    // Diagnostic logging — what does the API actually return?
    const topKeys = Object.keys(d).slice(0, 20).join(", ");
    const photoField = d.photos ? `array(${d.photos.length})` : d.carouselPhotos ? `carousel(${d.carouselPhotos.length})` : d.responsivePhotos ? `responsive(${d.responsivePhotos.length})` : "none";
    const descField = d.description ? `${d.description.slice(0, 50)}...` : d.homeDescription ? `home:${d.homeDescription.slice(0, 50)}...` : "none";
    console.error(`[PropertyDetails] zpid=${zpid} keys=[${topKeys}] photos=${photoField} desc=${descField}`);
    if (d.photos && d.photos[0]) {
      console.error(`[PropertyDetails] First photo keys: ${Object.keys(d.photos[0]).join(", ")}`);
      if (d.photos[0].mixedSources) {
        console.error(`[PropertyDetails] mixedSources keys: ${Object.keys(d.photos[0].mixedSources).join(", ")}`);
      }
    }
    // Also log raw top-level keys if raw.data exists (to see full shape)
    if (raw.data) {
      console.error(`[PropertyDetails] raw top keys: ${Object.keys(raw).slice(0, 10).join(", ")}`);
    }

    // Extract photos (up to 12 for carousel)
    const photos = extractPhotos(d);

    // Extract description
    const description = d.description || d.homeDescription || "";

    // Extract year built
    const yearBuilt = d.yearBuilt || null;

    // Extract additional details useful for Live mode
    const lotSize = d.lotAreaValue ? (d.lotAreaUnit === "acres" ? Math.round(d.lotAreaValue * 43560) : Math.round(d.lotAreaValue)) : null;
    const homeType = d.homeType || null;
    const taxAssessedValue = d.taxAssessedValue || null;
    const datePosted = d.datePosted || d.dateSold || null;

    // Extract list price (critical for sold listings where search API doesn't include it).
    // SALE listings only: "Listed for rent" events and rental d.price (when the
    // home's current Zillow page is a rental) must never become a list price.
    const isCurrentlyRental = d.homeStatus === "FOR_RENT" || isRentalText(d.description);
    const listPrice = isCurrentlyRental ? null : (d.price || d.listPrice || null);
    const priceHistory = d.priceHistory || [];
    let originalListPrice = null;
    for (const evt of priceHistory) {
      const ev = String(evt?.event || "");
      if (/rent/i.test(ev)) continue;                       // skip rental events
      if (ev === "Listed for sale" || /list/i.test(ev)) {
        originalListPrice = evt.price || null;
        break;
      }
    }
    // Sanity: must look like a sale price relative to the known sold price.
    originalListPrice = saneListPrice(originalListPrice, rcSoldPrice);

    const usablePhotos = photos.filter(isUsablePhoto);
    // Rental-listing text (lease terms, rent due dates) misleads the sold-price
    // game — drop it. The photos still show the property itself, so keep them.
    const cleanDescription = isRentalText(description) ? "" : description;

    const result = {
      zpid: String(d.zpid || zpid),
      photos: usablePhotos,
      description: cleanDescription,
      listPrice: originalListPrice || (rcid ? saneListPrice(listPrice, rcSoldPrice) : listPrice),
      zestimate: d.zestimate || null,
      yearBuilt,
      lotSize,
      homeType,
      taxAssessedValue,
      datePosted,
      photoCount: usablePhotos.length,
      cached: false,
    };

    // RentCast row: persist the enrichment into the pool so this property is
    // never enriched again (and future sold-comps reads include it inline).
    // Only sane sale prices and non-rental descriptions are ever persisted.
    if (rcid && (usablePhotos.length > 0 || cleanDescription)) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const upd = {
            photos: usablePhotos.slice(0, 6),
            photo: usablePhotos[0] || null,
            description: cleanDescription || null,
          };
          if (originalListPrice) upd.list_price = originalListPrice;
          await supabase.from("pp_property_pool").update(upd).eq("zpid", rcid);
        }
      } catch (e) {
        console.error(`[PropertyDetails] pool persist failed for ${rcid}:`, e.message);
      }
    }

    // Only cache results that have actual content (photos or description)
    // Empty results should be re-fetched next time
    if (usablePhotos.length > 0 || cleanDescription) {
      cache.set(cacheKey, { data: result, timestamp: Date.now() });
    }
    // Evict old entries if cache grows too large
    if (cache.size > 200) {
      const now = Date.now();
      for (const [k, v] of cache) {
        if (now - v.timestamp > CACHE_TTL) cache.delete(k);
      }
    }

    // Only CDN-cache responses with real content; empty results get no-store so they're re-fetched
    if (usablePhotos.length > 0 || cleanDescription) {
      res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
    } else {
      res.setHeader("Cache-Control", "no-store");
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error("[PropertyDetails] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch property details" });
  }
}

function extractPhotos(d) {
  const urls = [];
  // Primary: photos array with mixedSources
  if (d.photos && Array.isArray(d.photos)) {
    for (let i = 0; i < d.photos.length && urls.length < 12; i++) {
      const jpegs = d.photos[i]?.mixedSources?.jpeg || [];
      // Pick the largest resolution available
      if (jpegs.length > 0) {
        urls.push(jpegs[jpegs.length - 1].url);
      }
    }
    if (urls.length > 0) return urls;
  }
  // Fallback: carouselPhotos
  if (d.carouselPhotos && Array.isArray(d.carouselPhotos)) {
    for (let j = 0; j < d.carouselPhotos.length && urls.length < 12; j++) {
      if (d.carouselPhotos[j].url) urls.push(d.carouselPhotos[j].url);
    }
    if (urls.length > 0) return urls;
  }
  // Fallback: responsivePhotos
  if (d.responsivePhotos && Array.isArray(d.responsivePhotos)) {
    for (let k = 0; k < d.responsivePhotos.length && urls.length < 12; k++) {
      const srcs = d.responsivePhotos[k]?.mixedSources?.jpeg || [];
      if (srcs.length > 0) urls.push(srcs[srcs.length - 1].url);
    }
    if (urls.length > 0) return urls;
  }
  // Last resort: single image
  if (d.imgSrc) return [d.imgSrc];
  return [];
}
