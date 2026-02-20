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
  if (cache.size > 100) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 50; i++) cache.delete(oldest[i][0]);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

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
    listPrice: raw.price || 0,
    zestimate: raw.zestimate || null,
    soldPrice: isSold ? (raw.price || null) : null,
    soldDate: isSold ? normalizeSoldDate(raw.dateSold) : null,
    daysOnMarket: raw.daysOnZillow || 0,
    status: isSold ? "sold" : "active",
    photo: raw.imgSrc || raw.hiResImageLink || null,
    neighborhood: raw.buildingName || "",
    pricePerSqft: sqft > 0 ? Math.round(price / sqft) : 0,
    latitude: raw.latitude || null,
    longitude: raw.longitude || null,
    rentZestimate: raw.rentZestimate || null,
    detailUrl: raw.detailUrl || null,
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
  const params = new URLSearchParams({
    location,
    home_status: homeStatus,
  });

  const url = `https://${apiHost}/search?${params}`;
  console.log(`[PricePoint] Fetching: ${url}`);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": apiHost,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  console.log(`[PricePoint] Response keys: ${Object.keys(data || {}).join(', ')}`);
  console.log(`[PricePoint] Status: ${data.status}, Data count: ${data.data?.length || 0}`);
  return data;
}

// ─── Main handler ───
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { zip, city, state, location: locParam } = req.query;

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

    // Check cache
    const cacheKey = location.toLowerCase().trim();
    const cached = getCached(cacheKey);
    if (cached) {
      console.log(`[PricePoint] Cache hit for: ${cacheKey}`);
      return res.status(200).json({ ...cached, cached: true });
    }

    // API credentials
    const apiKey = process.env.RAPIDAPI_KEY;
    const apiHost = process.env.RAPIDAPI_HOST || "real-time-real-estate-data.p.rapidapi.com";

    if (!apiKey) {
      return res.status(500).json({ error: "RAPIDAPI_KEY not configured" });
    }

    // Fetch both active and sold in parallel
    const [activeData, soldData] = await Promise.allSettled([
      fetchListings(location, "FOR_SALE", apiKey, apiHost),
      fetchListings(location, "RECENTLY_SOLD", apiKey, apiHost),
    ]);

    // Parse active listings — response shape: { status, data: [...] }
    let active = [];
    if (activeData.status === "fulfilled" && activeData.value?.data) {
      const results = activeData.value.data;
      console.log(`[PricePoint] Active listings: ${results.length}`);
      if (results[0]) {
        console.log(`[PricePoint] Sample: zpid=${results[0].zpid}, price=${results[0].price}, img=${results[0].imgSrc ? 'yes' : 'no'}`);
      }
      active = results
        .filter(r => r.zpid && r.price)
        .slice(0, 20)
        .map((r, i) => normalizeProperty(r, i, "pp", false));
    } else {
      const reason = activeData.status === "rejected" ? activeData.reason?.message : "no data";
      console.log(`[PricePoint] Active failed: ${reason}`);
    }

    // Parse sold listings
    let sold = [];
    if (soldData.status === "fulfilled" && soldData.value?.data) {
      const results = soldData.value.data;
      console.log(`[PricePoint] Sold listings: ${results.length}`);
      sold = results
        .filter(r => r.zpid && r.price)
        .slice(0, 20)
        .map((r, i) => normalizeProperty(r, i, "pps", true));
    } else {
      const reason = soldData.status === "rejected" ? soldData.reason?.message : "no data";
      console.log(`[PricePoint] Sold failed: ${reason}`);
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

    // Only cache if we got results
    if (active.length > 0 || sold.length > 0) {
      setCache(cacheKey, result);
    }

    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
    return res.status(200).json(result);
  } catch (err) {
    console.error("[PricePoint] Error:", err);
    return res.status(500).json({
      error: "Failed to fetch listings",
      detail: err.message,
    });
  }
}
