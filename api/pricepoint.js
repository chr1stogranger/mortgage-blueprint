// /api/pricepoint.js — Vercel Serverless Function
// Proxies RapidAPI Zillow56 to fetch active + recently sold listings
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
  // Evict old entries if cache gets large (prevent memory bloat)
  if (cache.size > 100) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 50; i++) cache.delete(oldest[i][0]);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

// ─── Normalize Zillow result → PricePoint shape ───
function normalizeProperty(raw, index, prefix, isSold) {
  const sqft = raw.livingArea || raw.lotAreaValue || 0;
  const price = raw.price || raw.soldPrice || 0;

  return {
    id: `${prefix}${index + 1}`,
    zpid: String(raw.zpid || ""),
    address: raw.streetAddress || raw.address || "Unknown",
    city: raw.city || "",
    state: raw.state || "CA",
    zip: raw.zipcode || raw.zip || "",
    beds: raw.bedrooms || 0,
    baths: raw.bathrooms || 0,
    sqft: raw.livingArea || 0,
    lotSqft: raw.lotAreaValue ? Math.round(raw.lotAreaValue) : 0,
    yearBuilt: raw.yearBuilt || null,
    propertyType: normalizeHomeType(raw.homeType),
    listPrice: raw.price || raw.listPrice || 0,
    zestimate: raw.zestimate || null,
    soldPrice: isSold ? (raw.soldPrice || raw.price || null) : null,
    soldDate: isSold ? normalizeSoldDate(raw.dateSold || raw.datePostedString) : null,
    daysOnMarket: normalizeDaysOnMarket(raw.daysOnZillow, raw.timeOnZillow),
    status: isSold ? "sold" : "active",
    photo: raw.imgSrc || raw.hiResImageLink || null,
    neighborhood: raw.buildingName || "",
    pricePerSqft: sqft > 0 ? Math.round(price / sqft) : 0,
    // Extra data useful for PricePoint
    latitude: raw.latitude || null,
    longitude: raw.longitude || null,
    rentZestimate: raw.rentZestimate || null,
  };
}

function normalizeHomeType(type) {
  if (!type) return "Single Family";
  const map = {
    SINGLE_FAMILY: "Single Family",
    MULTI_FAMILY: "Multi Family",
    CONDO: "Condo",
    TOWNHOUSE: "Townhouse",
    MANUFACTURED: "Manufactured",
    LOT: "Lot/Land",
    APARTMENT: "Apartment",
  };
  return map[type] || type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function normalizeDaysOnMarket(daysOnZillow, timeOnZillow) {
  if (daysOnZillow && daysOnZillow > 0) return daysOnZillow;
  if (timeOnZillow && timeOnZillow > 0) return Math.round(timeOnZillow / (1000 * 60 * 60 * 24));
  return 0;
}

function normalizeSoldDate(raw) {
  if (!raw) return null;
  // Could be epoch ms or date string
  if (typeof raw === "number") {
    return new Date(raw).toISOString().split("T")[0];
  }
  // Try to parse date string
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return raw;
}

// ─── Fetch from RapidAPI ───
async function fetchZillow(location, status, apiKey, apiHost) {
  const params = new URLSearchParams({
    location,
    output: "json",
    status, // "forSale" or "recentlySold"
    sortSelection: "priorityscore",
    listing_type: "by_agent",
  });

  const url = `https://${apiHost}/search?${params}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": apiHost,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Zillow API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  console.log(`[PricePoint] Zillow response keys for ${status}: ${Object.keys(data || {}).join(', ')}`);
  return data;
}

// ─── Main handler ───
export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { zip, city, state, location: locParam } = req.query;

    // Build location string — prefer zip, then city+state, then raw location
    let location;
    if (zip && /^\d{5}$/.test(zip)) {
      location = zip;
    } else if (city && state) {
      location = `${city}, ${state}`;
    } else if (city) {
      location = city;
    } else if (locParam) {
      location = locParam;
    } else {
      return res.status(400).json({
        error: "Missing location. Provide ?zip=94122 or ?city=San Francisco&state=CA",
      });
    }

    // Check cache
    const cacheKey = location.toLowerCase().trim();
    const cached = getCached(cacheKey);
    if (cached) {
      return res.status(200).json({ ...cached, cached: true });
    }

    // API credentials from environment
    const apiKey = process.env.RAPIDAPI_KEY;
    const apiHost = process.env.RAPIDAPI_HOST || "zillow56.p.rapidapi.com";

    if (!apiKey) {
      return res.status(500).json({ error: "RAPIDAPI_KEY not configured" });
    }

    // Fetch both active and sold listings in parallel
    const [activeData, soldData] = await Promise.allSettled([
      fetchZillow(location, "forSale", apiKey, apiHost),
      fetchZillow(location, "recentlySold", apiKey, apiHost),
    ]);

    // Parse active listings
    let active = [];
    if (activeData.status === "fulfilled") {
      const val = activeData.value;
      // Try multiple possible response shapes
      const results = val?.results || val?.searchResults || val?.props || (Array.isArray(val) ? val : []);
      console.log(`[PricePoint] Active response keys: ${Object.keys(val || {}).join(', ')}`);
      console.log(`[PricePoint] Active raw count: ${results.length}`);
      if (results[0]) {
        console.log(`[PricePoint] Sample active keys: ${Object.keys(results[0]).join(', ')}`);
        console.log(`[PricePoint] Sample: zpid=${results[0].zpid}, price=${results[0].price}, imgSrc=${results[0].imgSrc ? 'yes' : 'no'}`);
      }
      active = results
        .filter(r => r.zpid && r.price) // Only require zpid + price (photo optional)
        .slice(0, 20)
        .map((r, i) => normalizeProperty(r, i, "pp", false));
    } else {
      console.log(`[PricePoint] Active fetch failed:`, activeData.reason?.message);
    }

    // Parse sold listings
    let sold = [];
    if (soldData.status === "fulfilled") {
      const val = soldData.value;
      const results = val?.results || val?.searchResults || val?.props || (Array.isArray(val) ? val : []);
      console.log(`[PricePoint] Sold response keys: ${Object.keys(val || {}).join(', ')}`);
      console.log(`[PricePoint] Sold raw count: ${results.length}`);
      sold = results
        .filter(r => r.zpid && r.price)
        .slice(0, 20)
        .map((r, i) => normalizeProperty(r, i, "pps", true));
    } else {
      console.log(`[PricePoint] Sold fetch failed:`, soldData.reason?.message);
    }

    const result = {
      location,
      activeListings: active,
      soldListings: sold,
      activeCount: active.length,
      soldCount: sold.length,
      timestamp: new Date().toISOString(),
      cached: false,
    };

    // Only cache if we got actual results (don't cache empty)
    if (active.length > 0 || sold.length > 0) {
      setCache(cacheKey, result);
    }

    // Also set CDN cache headers (Vercel edge cache)
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");

    return res.status(200).json(result);
  } catch (err) {
    console.error("PricePoint API error:", err);
    return res.status(500).json({
      error: "Failed to fetch listings",
      detail: err.message,
    });
  }
}
