// /api/_address.js — A3: Live "search any address" (helper, NOT a function)
//
// Invoked by /api/propertydetails.js when called with ONLY ?address= (no zpid,
// no rcid): GET /api/propertydetails?address=<full street address>[&market=<id>]
// Folded out of its own route (pp-address.js) because Vercel's Hobby plan caps
// a deployment at 12 serverless functions and this was the 13th. CORS + rate
// limiting are applied by the propertydetails handler before delegation.
//
// Resolves a free-text street address → Zillow zpid via the RapidAPI /search
// pattern already proven in propertydetails.js and _enrich.js, then fetches
// /property-details and returns ONE normalized listing in the same shape
// /api/pricepoint.js serves — so the client can drop it straight into the
// Live PropertyCard and POST a normal mode:'live' guess to /api/pp-guess.
//
// Cost control (RapidAPI quota is the real constraint):
//   L1: in-memory per-instance cache, 24h TTL — instant repeats
//   L2: pp_property_pool lookup by street address (+zip) — a previously
//       searched or previously pooled property answers with ZERO RapidAPI calls
//   L3: RapidAPI /search (resolve) + /property-details (2 calls), then the
//       result is upserted back into pp_property_pool so repeat searches from
//       any instance are free.
//
// NEVER returns soldPrice — a Live prediction resolves later via cron, and a
// prior sale price on an off-market home would anchor the player.
//
// NOTE: pp_property_pool.sold_price/sold_date are NOT NULL in the original
// schema (sql/2026-05-28-pp_property_pool.sql). Upserting an ACTIVE (unsold)
// searched listing therefore requires migrations/014_pp_pool_address_search.sql
// to be applied by hand in Supabase first. Until then the upsert fails
// non-fatally (logged) and only sold/off-market searches persist to the pool;
// the L1 cache still dedupes repeats per warm instance.

import { createClient } from "@supabase/supabase-js";
import { extractPhotos, isUsablePhoto, isRentalText, saneListPrice } from "./_enrich.js";

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── L1: in-memory cache (per warm instance) ───
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h — matches the other pp routes

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}
function setCache(key, data) {
  if (cache.size >= 200) {
    const now = Date.now();
    for (const [k, v] of cache) { if (now - v.timestamp > CACHE_TTL) cache.delete(k); }
    if (cache.size >= 200) cache.delete(cache.keys().next().value); // oldest insert
  }
  cache.set(key, { data, timestamp: Date.now() });
}

// ─── Small local normalizers (mirroring pricepoint.js on purpose — same
// duplication policy as _enrich.js: the working routes are never touched) ───
function normalizeHomeType(type) {
  if (!type) return "Single Family";
  const map = {
    SINGLE_FAMILY: "Single Family", MULTI_FAMILY: "Multi Family",
    CONDO: "Condo", CONDOS_COOPS: "Condo",
    TOWNHOUSE: "Townhouse", TOWNHOMES: "Townhouse",
    MANUFACTURED: "Manufactured", LOTSLAND: "Lot/Land",
    APARTMENT: "Apartment", APARTMENTS: "Apartment", HOUSES: "Single Family",
  };
  return map[type] || String(type).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// Zillow homeStatus → PricePoint status. Anything that isn't clearly for-sale
// counts as off-market for the client's "resolves if/when it sells" note.
function normalizeStatus(homeStatus) {
  const s = String(homeStatus || "").toUpperCase();
  if (s === "FOR_SALE" || s === "ACTIVE" || s === "COMING_SOON") return "active";
  if (s === "PENDING" || s === "PENDING_UNDER_CONTRACT" || s === "CONTINGENT") return "pending";
  if (s === "RECENTLY_SOLD" || s === "SOLD") return "sold";
  if (s === "FOR_RENT") return "for-rent";
  return "off-market";
}

function toLotSqft(d) {
  if (!d.lotAreaValue) return 0;
  return (d.lotAreaUnit === "acres" || d.lotAreaUnits === "acres")
    ? Math.round(d.lotAreaValue * 43560)
    : Math.round(d.lotAreaValue);
}

// Escape LIKE wildcards so a street like "100% Main St" can't wildcard-match.
const escapeLike = (s) => String(s).replace(/[%_\\]/g, (m) => `\\${m}`);

// ─── Build the client listing from a pp_property_pool row (L2 hit) ───
// soldPrice is deliberately absent. list_price runs through saneListPrice so a
// sold row whose stored list price IS the sold price can't leak the answer.
function poolRowToListing(r) {
  const photos = (Array.isArray(r.photos) ? r.photos : []).filter(isUsablePhoto).slice(0, 24);
  const listPrice = r.sold_price ? saneListPrice(r.list_price, r.sold_price) : (r.list_price || null);
  return {
    id: `addr_${r.zpid}`,
    zpid: String(r.zpid),
    address: r.address || "Unknown",
    city: r.city || "",
    state: r.state || "CA",
    zip: r.zip || "",
    beds: r.beds || 0,
    baths: r.baths != null ? Number(r.baths) : 0,
    sqft: r.sqft || 0,
    lotSqft: r.lot_sqft || 0,
    yearBuilt: r.year_built || null,
    propertyType: r.property_type || "Single Family",
    listPrice,
    status: r.sold_price ? "sold" : "active",
    photo: photos[0] || (isUsablePhoto(r.photo) ? r.photo : null),
    photos,
    neighborhood: r.neighborhood || "",
    pricePerSqft: r.sqft && listPrice ? Math.round(listPrice / r.sqft) : 0,
    latitude: r.latitude || null,
    longitude: r.longitude || null,
    daysOnMarket: 0,
    description: isRentalText(r.description) ? "" : (r.description || ""),
    detailUrl: r.detail_url || null,
    // Prior sale DATE only (never the price) — powers the Live card's
    // "LAST SOLD ___ '__" pill.
    lastSoldDate: r.sold_date || null,
    _source: "address_search",
  };
}

export async function handleAddressSearch(req, res) {
  try {
    const address = String(req.query.address || "").trim();
    if (address.length < 5) {
      return res.status(400).json({ error: "missing_address", message: "Provide ?address=<full street address>" });
    }
    // market id only shapes the pool cache key — sanitize hard, default 'sf'
    const marketId = /^[a-z0-9_-]{1,32}$/.test(String(req.query.market || "")) ? String(req.query.market) : "sf";

    const cacheKey = address.toLowerCase().replace(/\s+/g, " ");
    const cached = getCached(cacheKey);
    if (cached) {
      res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
      return res.status(200).json({ ...cached, cached: true });
    }

    const street = address.split(",")[0].trim();
    const zipMatches = address.match(/\b\d{5}\b/g);
    const zip = zipMatches ? zipMatches[zipMatches.length - 1] : null;

    // ─── L2: pool lookup — repeat searches and already-pooled homes are free ───
    const supabase = getSupabaseAdmin();
    if (supabase && street) {
      try {
        let q = supabase.from("pp_property_pool").select("*").ilike("address", escapeLike(street)).limit(5);
        if (zip) q = q.eq("zip", zip);
        const { data: rows, error: poolErr } = await q;
        if (poolErr) {
          console.error(`[pp-address] pool read error (continuing): ${poolErr.message}`);
        } else if (rows && rows.length > 0) {
          // Prefer a row that can actually render a card (photo or list price)
          const best = rows.find(r => (Array.isArray(r.photos) && r.photos.length > 0) || r.photo || r.list_price) || rows[0];
          const result = { listing: poolRowToListing(best), source: "pool" };
          setCache(cacheKey, result);
          res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
          return res.status(200).json({ ...result, cached: true });
        }
      } catch (e) {
        console.error(`[pp-address] pool read failed (continuing): ${e.message}`);
      }
    }

    // ─── L3: RapidAPI — resolve address → zpid (propertydetails.js pattern) ───
    const apiKey = process.env.RAPIDAPI_KEY;
    const apiHost = process.env.RAPIDAPI_HOST || "real-time-real-estate-data.p.rapidapi.com";
    if (!apiKey) return res.status(500).json({ error: "RAPIDAPI_KEY not configured" });

    const notFound = () => {
      res.setHeader("Cache-Control", "no-store");
      return res.status(404).json({
        error: "not_found",
        message: "Couldn't find that address — try adding city & zip",
      });
    };

    let zpid = null;
    try {
      const sResp = await fetch(`https://${apiHost}/search?location=${encodeURIComponent(address)}`, {
        headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": apiHost },
      });
      const sRaw = await sResp.json().catch(() => null);
      const list = (sRaw && (Array.isArray(sRaw.data) ? sRaw.data : sRaw.data?.results)) || [];
      const streetNum = street.split(/\s+/)[0];
      let match = null;
      if (list.length === 1) match = list[0];
      else if (list.length > 1) {
        match = list.find(r => String(r?.streetAddress || r?.address || "").trim().startsWith(streetNum)) || null;
      }
      if (match?.zpid) zpid = String(match.zpid);
    } catch (e) {
      console.error(`[pp-address] resolve failed for "${address}": ${e.message}`);
    }
    if (!zpid) return notFound();

    // ─── Property details for the resolved zpid ───
    const resp = await fetch(`https://${apiHost}/property-details?zpid=${zpid}`, {
      headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": apiHost },
    });
    if (!resp.ok) {
      console.error(`[pp-address] details error ${resp.status} for zpid=${zpid}`);
      return notFound();
    }
    const raw = await resp.json();
    const d = raw.data || raw;
    const addrObj = d.address || {};

    const status = normalizeStatus(d.homeStatus);
    const photos = extractPhotos(d).filter(isUsablePhoto).slice(0, 24);
    const rawDesc = d.description || d.homeDescription || "";
    const description = isRentalText(rawDesc) ? "" : rawDesc;

    // Sold info — used ONLY for the pool upsert + list-price sanity, never returned.
    let soldPrice = null;
    let soldDate = null;
    for (const evt of (d.priceHistory || [])) {
      const ev = String(evt?.event || "");
      if (/rent/i.test(ev)) continue;
      if (/sold/i.test(ev) && evt.price) {
        soldPrice = evt.price;
        soldDate = evt.date || null;
        break;
      }
    }
    if (!soldDate && d.dateSold) {
      const ds = new Date(d.dateSold);
      if (!isNaN(ds.getTime())) soldDate = ds.toISOString().split("T")[0];
    }

    // List price. For-sale/pending: the page price IS the list price (unless
    // the page is currently a rental). Sold/off-market: dig the last "Listed
    // for sale" event out of priceHistory, sanity-checked vs the sold price so
    // the answer can't leak through a list==sold placeholder.
    const isCurrentlyRental = status === "for-rent" || isRentalText(rawDesc);
    let listPrice = null;
    if ((status === "active" || status === "pending") && !isCurrentlyRental) {
      listPrice = d.price || d.listPrice || null;
    } else {
      for (const evt of (d.priceHistory || [])) {
        const ev = String(evt?.event || "");
        if (/rent/i.test(ev)) continue;
        if (ev === "Listed for sale" || /list/i.test(ev)) { listPrice = evt.price || null; break; }
      }
      listPrice = saneListPrice(listPrice, soldPrice);
    }

    const sqft = d.livingArea || d.livingAreaValue || 0;
    const listing = {
      id: `addr_${zpid}`,
      zpid,
      address: d.streetAddress || addrObj.streetAddress || street,
      city: d.city || addrObj.city || "",
      state: d.state || addrObj.state || "CA",
      zip: d.zipcode || addrObj.zipcode || zip || "",
      beds: d.bedrooms || 0,
      baths: d.bathrooms || 0,
      sqft,
      lotSqft: toLotSqft(d),
      yearBuilt: d.yearBuilt || null,
      propertyType: normalizeHomeType(d.homeType),
      listPrice,
      status,
      photo: photos[0] || (isUsablePhoto(d.imgSrc) ? d.imgSrc : null),
      photos,
      neighborhood: d.neighborhoodRegion?.name || d.buildingName || "",
      pricePerSqft: sqft && listPrice ? Math.round(listPrice / sqft) : 0,
      latitude: d.latitude || null,
      longitude: d.longitude || null,
      daysOnMarket: (status === "active" || status === "pending") ? (d.daysOnZillow || 0) : 0,
      description,
      detailUrl: d.hdpUrl ? `https://www.zillow.com${d.hdpUrl}` : (d.detailUrl || null),
      // Prior sale DATE only — soldPrice stays absent (it's the answer).
      lastSoldDate: soldDate,
      _source: "address_search",
    };

    // ─── Persist into the pool so the NEXT search of this address is free ───
    // ignoreDuplicates keeps an existing (richer, validated) row authoritative.
    // Requires migration 014 for unsold rows — failure is logged, non-fatal.
    if (supabase) {
      try {
        const poolRow = {
          market_id: marketId,
          zpid,
          address: listing.address,
          city: listing.city || null,
          state: listing.state || "CA",
          zip: listing.zip || null,
          neighborhood: listing.neighborhood || null,
          beds: listing.beds || null,
          baths: listing.baths || null,
          sqft: listing.sqft || null,
          lot_sqft: listing.lotSqft || null,
          year_built: listing.yearBuilt,
          property_type: listing.propertyType,
          list_price: listPrice,
          sold_price: soldPrice,
          sold_date: soldDate,
          photo: listing.photo,
          photos,
          description: description || null,
          latitude: listing.latitude,
          longitude: listing.longitude,
          detail_url: listing.detailUrl,
        };
        const { error: upErr } = await supabase
          .from("pp_property_pool")
          .upsert(poolRow, { onConflict: "market_id,zpid", ignoreDuplicates: true });
        if (upErr) console.error(`[pp-address] pool upsert failed (non-fatal, needs migration 014 for unsold rows): ${upErr.message}`);
      } catch (e) {
        console.error(`[pp-address] pool upsert threw (non-fatal): ${e.message}`);
      }
    }

    const result = { listing, source: "rapidapi" };
    setCache(cacheKey, result);
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
    return res.status(200).json({ ...result, cached: false });
  } catch (err) {
    console.error("[pp-address] Error:", err);
    return res.status(500).json({ error: "server_error", message: "Something went wrong looking up that address — try again." });
  }
}
