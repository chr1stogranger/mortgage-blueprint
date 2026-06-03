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
  if (!zpid && rcid) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data: rows } = await supabase
        .from("pp_property_pool")
        .select("photo, photos, description, list_price, sold_price")
        .eq("zpid", rcid)
        .limit(1);
      const row = rows && rows[0];
      if (row && ((Array.isArray(row.photos) && row.photos.length > 0) || row.description)) {
        // Already enriched on a previous view — zero RapidAPI calls.
        const out = {
          zpid: rcid,
          photos: (row.photos || []).filter(isUsablePhoto),
          description: row.description || "",
          listPrice: row.list_price && row.list_price !== row.sold_price ? row.list_price : null,
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

    // Extract list price (critical for sold listings where search API doesn't include it)
    const listPrice = d.price || d.listPrice || null;
    // For sold properties, price is the sold price — look for original list price in history
    const priceHistory = d.priceHistory || [];
    let originalListPrice = null;
    if (priceHistory.length > 0) {
      for (const evt of priceHistory) {
        if (evt.event && (evt.event === "Listed for sale" || evt.event === "Listed" || evt.event.includes("list"))) {
          originalListPrice = evt.price || null;
          break;
        }
      }
      if (!originalListPrice && priceHistory[priceHistory.length - 1]?.price) {
        originalListPrice = priceHistory[priceHistory.length - 1].price;
      }
    }

    const usablePhotos = photos.filter(isUsablePhoto);

    const result = {
      zpid: String(d.zpid || zpid),
      photos: usablePhotos,
      description,
      listPrice: originalListPrice || listPrice,
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
    if (rcid && (usablePhotos.length > 0 || description)) {
      try {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          const upd = {
            photos: usablePhotos.slice(0, 6),
            photo: usablePhotos[0] || null,
            description: description || null,
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
    if (usablePhotos.length > 0 || description) {
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
    if (usablePhotos.length > 0 || description) {
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
