// /api/pricepoint.js — Vercel Serverless Function
// Proxies RapidAPI "Real-Time Real-Estate Data" to fetch active + recently sold listings
// Caches results for 24 hours per location to minimize API calls
//
// Cache layers (checked in order):
//   L1: in-memory Map — instant, but dies on cold start / not shared across instances
//   L2: Supabase pp_city_cache table — persistent, shared, survives cold starts
//   L3: RapidAPI fetch (parallel-paged) — the expensive path (~2-4s)

import { createClient } from "@supabase/supabase-js";

// ─── Supabase admin client (server-side, bypasses RLS) — same pattern as sold-comps ───
function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

import { applyCors, isPrivileged } from "./_cors.js";
import { rateLimited } from "./_ratelimit.js";

// ─── In-memory cache (persists across warm invocations) ───
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  // Evict expired entries first, then oldest if still over limit
  if (cache.size >= 100) {
    const now = Date.now();
    // Pass 1: remove expired entries
    for (const [k, v] of cache) {
      if (now - v.timestamp > CACHE_TTL) cache.delete(k);
    }
    // Pass 2: if still over limit, remove oldest until under 50
    if (cache.size >= 100) {
      const sorted = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = Math.min(sorted.length, cache.size - 50);
      for (let i = 0; i < toRemove; i++) cache.delete(sorted[i][0]);
    }
  }
  cache.set(key, { data, timestamp: Date.now() });
}

// ─── Zip → neighborhood mapping (canonical, covers all launch markets) ───
const ZIP_TO_NEIGHBORHOOD = {
  // SF
  "94102": "Hayes Valley", "94103": "SOMA", "94104": "FiDi", "94105": "Rincon Hill",
  "94107": "Potrero Hill", "94108": "Chinatown", "94109": "Nob Hill", "94110": "Mission",
  "94111": "Embarcadero", "94112": "Excelsior", "94114": "Castro", "94115": "Pacific Heights",
  "94116": "Sunset", "94117": "Haight", "94118": "Richmond", "94121": "Outer Richmond",
  "94122": "Sunset", "94123": "Marina", "94124": "Bayview", "94127": "St. Francis Wood",
  "94129": "Presidio", "94130": "Treasure Island", "94131": "Twin Peaks", "94132": "Lake Merced",
  "94133": "North Beach", "94134": "Visitacion Valley", "94158": "Mission Bay",
  // Oakland
  "94601": "Fruitvale", "94602": "Dimond", "94603": "East Oakland", "94605": "Seminary",
  "94606": "San Antonio", "94607": "Jack London", "94608": "West Oakland", "94609": "Temescal",
  "94610": "Grand Lake", "94611": "Montclair", "94612": "Lake Merritt", "94618": "Rockridge",
  "94619": "Laurel", "94621": "East Oakland",
};

// ─── Normalize listing → PricePoint shape ───
function normalizeProperty(raw, index, prefix, isSold) {
  const sqft = raw.livingArea || 0;
  const price = raw.price || 0;
  // lotAreaValue might be in acres — convert to sqft
  let lotSqft = 0;
  if (raw.lotAreaValue) {
    lotSqft = raw.lotAreaUnit === "acres"
      ? Math.round(raw.lotAreaValue * 43560)
      : Math.round(raw.lotAreaValue);
  }

  // For sold listings, raw.price is the SOLD price. The original list price
  // may be in various fields depending on the API version. Try all known fields.
  // If none available, fall back to null so the frontend can use Zestimate.
  const soldPrice = isSold ? (raw.price || null) : null;
  const listPrice = isSold
    ? (raw.listPrice || raw.originalListPrice || raw.priceForHDP?.listing || raw.attributionInfo?.listingPrice || null)
    : (raw.price || 0);
  return {
    id: `${prefix}${index + 1}`,
    zpid: String(raw.zpid || ""),
    address: raw.streetAddress || raw.address || "Unknown",
    city: raw.city || "",
    state: raw.state || "CA",
    zip: raw.zipcode || "",
    beds: raw.bedrooms || 0,
    baths: raw.bathrooms || 0,
    sqft,
    lotSqft,
    yearBuilt: raw.yearBuilt || null,
    propertyType: normalizeHomeType(raw.homeType),
    listPrice,
    zestimate: raw.zestimate || null,
    soldPrice,
    soldDate: isSold ? normalizeSoldDate(raw.dateSold) : null,
    daysOnMarket: raw.daysOnZillow || 0,
    status: isSold ? "sold" : (raw.homeStatus === "PENDING" || raw.homeStatus === "PENDING_UNDER_CONTRACT") ? "pending" : "active",
    photo: raw.imgSrc || raw.hiResImageLink || null,
    neighborhood: ZIP_TO_NEIGHBORHOOD[raw.zipcode] || raw.buildingName || "",
    pricePerSqft: sqft > 0 ? Math.round(price / sqft) : 0,
    latitude: raw.latitude || null,
    longitude: raw.longitude || null,
    rentZestimate: raw.rentZestimate || null,
    detailUrl: raw.detailUrl || null,
    listingAgent: raw.attributionInfo?.agentName || raw.listingAgent?.name || raw.agentName || raw.brokerName || raw.attributionInfo?.brokerName || null,
    description: raw.description || raw.homeDescription || raw.hdpData?.homeInfo?.description || null,
    // Immutable source tag: which API endpoint returned this listing.
    // "sold_api" = from recentlySold call, "active_api" = from forSale call.
    // Client uses this to enforce mode separation (Free Play vs Live).
    _source: isSold ? "sold_api" : "active_api",
  };
}

function normalizeHomeType(type) {
  if (!type) return "Single Family";
  const map = {
    SINGLE_FAMILY: "Single Family",
    MULTI_FAMILY: "Multi Family",
    CONDO: "Condo",
    CONDOS_COOPS: "Condo",
    TOWNHOUSE: "Townhouse",
    TOWNHOMES: "Townhouse",
    MANUFACTURED: "Manufactured",
    LOTSLAND: "Lot/Land",
    APARTMENT: "Apartment",
    APARTMENTS: "Apartment",
    HOUSES: "Single Family",
  };
  return map[type] || type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function normalizeSoldDate(raw) {
  if (!raw) return null;
  if (typeof raw === "number") return new Date(raw).toISOString().split("T")[0];
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return raw;
}

// ─── Concurrency limiter ───
// RapidAPI's PRO plan enforces a per-SECOND rate limit. The old code fanned out
// all 16 page requests (10 active + 6 sold) simultaneously, which reliably
// tripped "You have exceeded the rate limit per second for your plan, PRO".
// Those 429s landed on page 1 as readily as on later pages, and a failed page 1
// zeroed out the entire city (see fetchAllPages) — that's why Alameda reported
// "no active listings" while genuinely having ~49.
const MAX_CONCURRENT = 4;
let inFlight = 0;
const slotWaiters = [];
async function withSlot(fn) {
  if (inFlight >= MAX_CONCURRENT) await new Promise(r => slotWaiters.push(r));
  inFlight++;
  try {
    return await fn();
  } finally {
    inFlight--;
    const next = slotWaiters.shift();
    if (next) next();
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const RETRY_DELAYS = [400, 1200, 2500]; // a per-second cap needs real spacing

// True when the response carries a recognizable listings array (any shape
// variant extractListings knows about).
function hasListingsArray(response) {
  if (!response) return false;
  return Array.isArray(response)
    || Array.isArray(response.data)
    || Array.isArray(response.results)
    || Array.isArray(response.props)
    || Array.isArray(response.searchResults)
    || Array.isArray(response.data?.results);
}

// ─── Fetch from RapidAPI ───
async function fetchListings(location, homeStatus, apiKey, apiHost, page = 1) {
  // The RapidAPI "Real-Time Real-Estate Data" endpoint uses "status" not "home_status"
  // for the search endpoint. It also supports "forSale", "recentlySold" style values.
  // We'll try the documented parameter names.
  const params = new URLSearchParams({ location });

  // Map our status names to what the API actually expects
  if (homeStatus === "FOR_SALE") {
    params.set("status", "forSale");
  } else if (homeStatus === "PENDING") {
    params.set("status", "forSale");       // pending listings come back within forSale
  } else if (homeStatus === "RECENTLY_SOLD") {
    params.set("status", "recentlySold");
  } else {
    params.set("status", homeStatus);
  }
  // Pagination: the search endpoint returns ~40 results per page. Requesting
  // successive pages is how we collect the full city inventory.
  if (page > 1) params.set("page", String(page));

  const url = `https://${apiHost}/search?${params}`;
  console.error(`[PricePoint] Fetching: ${url.replace(apiKey, "***")}`);

  // Retry 429s, 5xx, and malformed 200s. This provider intermittently answers
  // 200 with {status, request_id, parameters} and NO data array — which used to
  // be indistinguishable from "this city has zero listings".
  let data = null;
  let lastErr = null;
  let fatal = false;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length && !fatal; attempt++) {
    if (attempt > 0) {
      const wait = RETRY_DELAYS[attempt - 1] + Math.floor(Math.random() * 250);
      console.error(`[PricePoint] Retry ${attempt} for ${homeStatus} p${page} in ${wait}ms (last: ${lastErr})`);
      await sleep(wait);
    }
    try {
      const res = await withSlot(() => fetch(url, {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": apiHost,
        },
      }));

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        lastErr = `API ${res.status}: ${body.slice(0, 200)}`;
        console.error(`[PricePoint] API error ${res.status} for ${homeStatus} p${page}: ${body.slice(0, 300)}`);
        if (res.status === 429 || res.status >= 500) continue; // transient
        fatal = true;                                          // 4xx — our bug, don't hammer
        break;
      }

      const body = await res.json();
      // Soft failure: 200 with an ERROR envelope, or no listings array at all.
      // Only page 1 retries on a missing array — on later pages that legitimately
      // means "past the end of the inventory".
      if (body?.status === "ERROR" || (!hasListingsArray(body) && page === 1)) {
        lastErr = `malformed 200 (keys=${Object.keys(body || {}).join(",")})`;
        console.error(`[PricePoint] Soft failure for ${homeStatus} p${page}: ${lastErr}`);
        continue;
      }

      data = body;
      break;
    } catch (e) {
      lastErr = e.message;
      console.error(`[PricePoint] Fetch threw for ${homeStatus} p${page}: ${e.message}`);
    }
  }

  if (!data) throw new Error(lastErr || "unknown fetch failure");

  // Diagnostic: log response shape and counts
  const topKeys = Object.keys(data).join(", ");
  const dataCount = Array.isArray(data.data) ? data.data.length : "not-array";
  const resultsCount = Array.isArray(data.results) ? data.results.length : "not-array";
  const propsCount = Array.isArray(data.props) ? data.props.length : "not-array";
  console.error(`[PricePoint] Response for ${homeStatus}: keys=[${topKeys}], data=${dataCount}, results=${resultsCount}, props=${propsCount}`);

  // Log first listing's keys for shape discovery
  const firstItem = Array.isArray(data.data) ? data.data[0]
    : Array.isArray(data.results) ? data.results[0]
    : Array.isArray(data.props) ? data.props[0]
    : null;
  if (firstItem) {
    console.error(`[PricePoint] First ${homeStatus} item keys: ${Object.keys(firstItem).slice(0, 15).join(", ")}`);
    console.error(`[PricePoint] First ${homeStatus} item: zpid=${firstItem.zpid}, price=${firstItem.price}, status=${firstItem.homeStatus}, homeType=${firstItem.homeType}`);
  }

  return data;
}

// ─── Pagination config ───
const PAGE_SIZE_HINT = 40;        // RapidAPI search returns ~40 results per page
const MAX_ACTIVE_PAGES = 10;      // up to ~400 active listings → Live = full inventory
const MAX_SOLD_PAGES = 6;         // up to ~240 sold (fallback; sold-comps is primary)

// Extract the listings array from a search response (handles every shape variant)
function extractListings(response) {
  if (!response) return [];
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.results)) return response.results;
  if (Array.isArray(response.props)) return response.props;
  if (Array.isArray(response.searchResults)) return response.searchResults;
  if (Array.isArray(response)) return response;
  // Some endpoints nest under data.results
  if (response.data && Array.isArray(response.data.results)) return response.data.results;
  return [];
}

// Fetch all pages, de-duped by zpid. Page 1 goes first (its size tells us
// whether more pages exist); pages 2..maxPages then fire IN PARALLEL.
// The old version fetched pages sequentially — at ~2s per RapidAPI call,
// 10 pages = ~20s per cache miss. Parallel fan-out cuts that to ~2-4s.
// De-dup via the `seen` set also guards against an endpoint that ignores
// &page and returns page 1 repeatedly: duplicates simply add nothing.
async function fetchAllPages(location, homeStatus, apiKey, apiHost, maxPages) {
  const all = [];
  const seen = new Set();
  const addItems = (items) => {
    let added = 0;
    for (const it of items) {
      const z = String(it?.zpid || "");
      if (z && seen.has(z)) continue;
      if (z) seen.add(z);
      all.push(it);
      added++;
    }
    return added;
  };

  // Page 1 — a failure here is a real error
  const first = await fetchListings(location, homeStatus, apiKey, apiHost, 1);
  const firstItems = extractListings(first);
  addItems(firstItems);

  // Partial first page → that's the whole inventory, no more pages to fetch
  if (firstItems.length < PAGE_SIZE_HINT / 2 || maxPages <= 1) return all;

  // Pages 2..maxPages in parallel; individual page failures just mean we
  // keep what we have (same behavior as the old "break on later-page error")
  const settled = await Promise.allSettled(
    Array.from({ length: maxPages - 1 }, (_, i) =>
      fetchListings(location, homeStatus, apiKey, apiHost, i + 2)
    )
  );
  for (const s of settled) {
    if (s.status === "fulfilled") addItems(extractListings(s.value));
  }
  return all;
}

// Allow longer execution so multi-page fetches finish inside the timeout.
export const config = { maxDuration: 60 };

// ─── Main handler ───
export default async function handler(req, res) {
  // Shared scoped CORS (now also covers the Capacitor native origins) + rate limit.
  if (applyCors(req, res)) return;
  if (rateLimited(req, res, { limit: 30 })) return;

  try {
    const { zip, city, state, location: locParam, fresh, debug } = req.query;
    // Cache bypass forces fresh RapidAPI calls (quota burn) and the debug
    // payload exposes internals — both owner-only now (CIO audit L-2/H-2).
    const privileged = isPrivileged(req);
    const skipCache = (fresh === "1" || debug === "1") && privileged;

    // Build location string
    let location;
    if (zip && /^\d{5}$/.test(zip)) {
      location = zip;
    } else if (city && state) {
      location = `${city}, ${state}`;
    } else if (city) {
      location = `${city}, CA`;
    } else if (locParam) {
      location = locParam;
    } else {
      return res.status(400).json({
        error: "Missing location. Provide ?zip=94122 or ?city=San Francisco&state=CA",
      });
    }

    // Check cache (skip if ?fresh=1 or ?debug=1)
    const cacheKey = location.toLowerCase().trim();
    const supabase = getSupabaseAdmin();
    if (!skipCache) {
      // L1: in-memory (this lambda instance only)
      const cached = getCached(cacheKey);
      if (cached) {
        return res.status(200).json({ ...cached, cached: true });
      }
      // L2: Supabase — survives cold starts and is shared across instances.
      // NOTE: supabase-js does NOT throw on errors — it returns { error }.
      // Always inspect the error field or failures are silent.
      if (supabase) {
        try {
          const { data: row, error: readErr } = await supabase
            .from("pp_city_cache")
            .select("data, updated_at")
            .eq("cache_key", cacheKey)
            .maybeSingle();
          if (readErr) {
            console.error(`[PricePoint] Supabase cache read error (continuing): ${readErr.message}`);
          } else if (row?.data && Date.now() - new Date(row.updated_at).getTime() < CACHE_TTL) {
            setCache(cacheKey, row.data); // re-warm L1 for this instance
            res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
            return res.status(200).json({ ...row.data, cached: true, cacheLayer: "supabase" });
          }
        } catch (e) {
          console.error(`[PricePoint] Supabase cache read failed (continuing): ${e.message}`);
        }
      }
    } else {
      cache.delete(cacheKey); // clear stale entry
      console.error(`[PricePoint] Cache bypassed for ${location}`);
    }

    // API credentials
    const apiKey = process.env.RAPIDAPI_KEY;
    const apiHost = process.env.RAPIDAPI_HOST || "real-time-real-estate-data.p.rapidapi.com";

    if (!apiKey) {
      return res.status(500).json({ error: "RAPIDAPI_KEY not configured" });
    }

    // Fetch ALL pages of active and sold in parallel (pending comes within
    // forSale). Pagination is what lets Live mode show the full city inventory
    // instead of just the first ~40 results a single search call returns.
    const [activeData, soldData] = await Promise.allSettled([
      fetchAllPages(location, "FOR_SALE", apiKey, apiHost, MAX_ACTIVE_PAGES),
      fetchAllPages(location, "RECENTLY_SOLD", apiKey, apiHost, MAX_SOLD_PAGES),
    ]);

    // Parse active listings (fetchAllPages returns a flat, de-duped array)
    let active = [];
    if (activeData.status === "fulfilled") {
      active = activeData.value
        .filter(r => r.zpid && r.price)
        .map((r, i) => normalizeProperty(r, i, "pp", false));
      console.error(`[PricePoint] Active across pages: ${activeData.value.length} raw, ${active.length} usable`);
    } else {
      console.error(`[PricePoint] Active failed: ${activeData.reason?.message}`);
    }

    // Parse sold listings
    let sold = [];
    if (soldData.status === "fulfilled") {
      sold = soldData.value
        .filter(r => r.zpid && r.price)
        .map((r, i) => normalizeProperty(r, i, "pps", true));
      console.error(`[PricePoint] Sold across pages: ${soldData.value.length} raw, ${sold.length} usable`);
    } else {
      console.error(`[PricePoint] Sold failed: ${soldData.reason?.message}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // SERVER-SIDE DEDUP: Strip fake "sold" listings
    // ─────────────────────────────────────────────────────────────
    // RapidAPI's "recentlySold" endpoint frequently returns the same
    // listings as "forSale" — just relabeled with status="sold" and
    // soldPrice set to the list price. These are NOT real sales.
    //
    // Fix: any "sold" listing whose zpid also appears in the active
    // results is fake and gets removed. What survives is genuinely
    // sold. This is the ONLY reliable dedup — it runs server-side
    // where both responses are available simultaneously.
    // ═══════════════════════════════════════════════════════════════
    const activeZpidSet = new Set(active.map(a => a.zpid));
    const soldBeforeDedup = sold.length;
    sold = sold.filter(s => !activeZpidSet.has(s.zpid));
    const dedupRemoved = soldBeforeDedup - sold.length;

    console.error(`[PricePoint] ${location}: ${active.length} active, ${soldBeforeDedup} sold raw, ${dedupRemoved} fake (zpid overlap), ${sold.length} genuine sold`);

    const result = {
      location,
      activeListings: active,
      soldListings: sold,
      activeCount: active.length,
      soldCount: sold.length,
      timestamp: new Date().toISOString(),
      cached: false,
    };

    // Debug mode: include raw API response shapes for troubleshooting (owner-only, L-2)
    if (debug === "1" && privileged) {
      result._debug = {
        activeStatus: activeData.status,
        activeRawCount: activeData.status === "fulfilled" ? activeData.value.length : 0,
        activeError: activeData.status === "rejected" ? activeData.reason?.message : null,
        soldStatus: soldData.status,
        soldRawCount: soldData.status === "fulfilled" ? soldData.value.length : 0,
        soldError: soldData.status === "rejected" ? soldData.reason?.message : null,
        soldBeforeDedup,
        dedupRemoved,
        soldAfterDedup: sold.length,
        apiHost,
      };
    }

    // Only cache a result we actually trust — write both layers.
    // The active fetch must have SUCCEEDED, not merely returned rows: if it
    // failed we'd otherwise pin "0 active listings" for this city for a full
    // 24h. Its failure also silently breaks the dedup above (fake sold listings
    // are stripped by zpid overlap with active), so the sold half is suspect too.
    const activeOk = activeData.status === "fulfilled";
    if (activeOk && (active.length > 0 || sold.length > 0)) {
      setCache(cacheKey, result);
      if (supabase) {
        try {
          const { error: upsertErr } = await supabase
            .from("pp_city_cache")
            .upsert(
              { cache_key: cacheKey, data: result, updated_at: new Date().toISOString() },
              { onConflict: "cache_key" }
            );
          if (upsertErr) {
            console.error(`[PricePoint] Supabase cache write error (non-fatal): ${upsertErr.message}`);
          } else {
            console.error(`[PricePoint] Supabase cache updated: ${cacheKey} (${active.length} active, ${sold.length} sold)`);
          }
        } catch (e) {
          console.error(`[PricePoint] Supabase cache write failed (non-fatal): ${e.message}`);
        }
      }
    }

    // Don't CDN-cache debug/fresh requests
    if (skipCache) {
      res.setHeader("Cache-Control", "no-store");
    } else {
      res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error("[PricePoint] Error:", err);
    return res.status(500).json({
      error: "Failed to fetch listings",
      detail: err.message,
    });
  }
}
