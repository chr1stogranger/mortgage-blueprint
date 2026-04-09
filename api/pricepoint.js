// /api/pricepoint.js — Vercel Serverless Function
// Proxies RapidAPI "Real-Time Real-Estate Data" to fetch active + recently sold listings
// Caches results for 24 hours per location to minimize API calls

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

// ─── Fetch from RapidAPI ───
async function fetchListings(location, homeStatus, apiKey, apiHost) {
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

  const url = `https://${apiHost}/search?${params}`;
  console.error(`[PricePoint] Fetching: ${url.replace(apiKey, "***")}`);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": apiHost,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[PricePoint] API error ${res.status} for ${homeStatus}: ${body.slice(0, 300)}`);
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();

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

// ─── CORS ───
const ALLOWED_ORIGINS = [
  "https://blueprint.realstack.app",
  "https://mortgage-blueprint.vercel.app",
  "http://localhost:5173",
];

// ─── Main handler ───
export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://blueprint.realstack.app");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { zip, city, state, location: locParam, fresh, debug } = req.query;
    const skipCache = fresh === "1" || debug === "1";

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
    if (!skipCache) {
      const cached = getCached(cacheKey);
      if (cached) {
        return res.status(200).json({ ...cached, cached: true });
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

    // Fetch active and sold in parallel (pending comes within forSale results)
    const [activeData, soldData] = await Promise.allSettled([
      fetchListings(location, "FOR_SALE", apiKey, apiHost),
      fetchListings(location, "RECENTLY_SOLD", apiKey, apiHost),
    ]);

    // Helper: extract listings array from response (handles multiple shapes)
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

    // Parse active listings
    let active = [];
    if (activeData.status === "fulfilled") {
      const results = extractListings(activeData.value);
      console.error(`[PricePoint] Active raw count: ${results.length}, with zpid+price: ${results.filter(r => r.zpid && r.price).length}`);

      // All active/pending from forSale results (no cap — Markets + PricePoint get full dataset)
      active = results
        .filter(r => r.zpid && r.price)
        .map((r, i) => normalizeProperty(r, i, "pp", false));
    } else {
      console.error(`[PricePoint] Active failed: ${activeData.reason?.message}`);
    }

    // Parse sold listings
    let sold = [];
    if (soldData.status === "fulfilled") {
      const results = extractListings(soldData.value);
      console.error(`[PricePoint] Sold raw count: ${results.length}, with zpid+price: ${results.filter(r => r.zpid && r.price).length}`);

      sold = results
        .filter(r => r.zpid && r.price)
        .map((r, i) => normalizeProperty(r, i, "pps", true));
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

    // Debug mode: include raw API response shapes for troubleshooting
    if (debug === "1") {
      result._debug = {
        activeStatus: activeData.status,
        activeTopKeys: activeData.status === "fulfilled" ? Object.keys(activeData.value || {}) : null,
        activeRawCount: activeData.status === "fulfilled" ? extractListings(activeData.value).length : 0,
        activeError: activeData.status === "rejected" ? activeData.reason?.message : null,
        soldStatus: soldData.status,
        soldTopKeys: soldData.status === "fulfilled" ? Object.keys(soldData.value || {}) : null,
        soldRawCount: soldData.status === "fulfilled" ? extractListings(soldData.value).length : 0,
        soldError: soldData.status === "rejected" ? soldData.reason?.message : null,
        soldBeforeDedup,
        dedupRemoved,
        soldAfterDedup: sold.length,
        apiHost,
      };
    }

    // Only cache if we got results
    if (active.length > 0 || sold.length > 0) {
      setCache(cacheKey, result);
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
