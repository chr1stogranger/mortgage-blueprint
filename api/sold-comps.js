// /api/sold-comps.js — Vercel Serverless Function
// Fetches REAL recently sold properties by calling property-details for known sold zpids.
// The search API's "recentlySold" returns fake data (active listings relabeled).
// This endpoint uses curated zpids from actual Zillow sold listings.

// ─── In-memory cache ───
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ─── Curated recently sold zpids per market ───
// These are REAL zpids from actual Zillow sold listings, verified March 2026.
// We fetch property-details for each to get photos, descriptions, and price history.
const SOLD_ZPIDS = {
  "san francisco": {
    // Sunset / Outer Sunset (94122, 94116, 94121)
    sunset: ["15095869", "15115454", "15092973", "15105418", "15106327", "15120027", "15126338"],
    // Richmond (94118, 94121)
    richmond: ["15094834", "15098085", "15091588", "184816884", "15089898", "15094989"],
    // Mission / Bernal Heights (94110)
    mission: ["15150065", "15161966", "15162139", "15161587", "15164646", "15163900"],
    // Noe Valley (94114)
    noe: ["15182650", "15132286", "460322503", "460896185"],
    // Pacific Heights (94115)
    pachts: ["15080888", "15082566", "15074528", "121339149"],
    // SOMA (94107)
    soma: ["79842917", "80747470", "79846879", "80743387"],
    // Excelsior (94112)
    excelsior: ["15177062", "15167859", "15167742", "15169891", "15176420", "15174980"],
  },
};

// Flatten zpids for a city
function getZpidsForCity(city) {
  const key = city.toLowerCase().trim();
  const market = SOLD_ZPIDS[key];
  if (!market) return [];
  return Object.values(market).flat();
}

// ─── CORS ───
const ALLOWED_ORIGINS = [
  "https://blueprint.realstack.app",
  "https://mortgage-blueprint.vercel.app",
  "http://localhost:5173",
];

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
    const { city, fresh } = req.query;
    if (!city) {
      return res.status(400).json({ error: "Missing ?city=San Francisco" });
    }

    const cacheKey = `sold-${city.toLowerCase().trim()}`;
    const skipCache = fresh === "1";

    if (!skipCache) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return res.status(200).json({ ...cached.data, cached: true });
      }
    } else {
      cache.delete(cacheKey);
    }

    const zpids = getZpidsForCity(city);
    if (zpids.length === 0) {
      return res.status(200).json({
        soldListings: [],
        count: 0,
        city,
        message: `No curated sold data for "${city}" yet`,
      });
    }

    const apiKey = process.env.RAPIDAPI_KEY;
    const apiHost = process.env.RAPIDAPI_HOST || "real-time-real-estate-data.p.rapidapi.com";
    if (!apiKey) {
      return res.status(500).json({ error: "RAPIDAPI_KEY not configured" });
    }

    // Fetch property details for all zpids in parallel (batched to avoid rate limits)
    const BATCH_SIZE = 10;
    const allResults = [];

    for (let i = 0; i < zpids.length; i += BATCH_SIZE) {
      const batch = zpids.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(zpid => fetchPropertyDetails(zpid, apiKey, apiHost))
      );
      allResults.push(...results);
      // Small delay between batches to respect rate limits
      if (i + BATCH_SIZE < zpids.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Process results into sold listings
    const soldListings = [];
    let fetchedCount = 0;
    let soldCount = 0;

    allResults.forEach((result, idx) => {
      if (result.status !== "fulfilled" || !result.value) return;
      fetchedCount++;

      const d = result.value;
      const zpid = zpids[idx];

      // Extract sold info from priceHistory
      const soldEvent = extractSoldEvent(d.priceHistory || []);

      // Also check lastSoldPrice as fallback
      const soldPrice = soldEvent?.price || d.lastSoldPrice || null;
      const soldDate = soldEvent?.date || null;

      // Skip if we can't confirm it was actually sold
      if (!soldPrice) return;
      soldCount++;

      // Extract photos
      const photos = extractPhotos(d);
      const mainPhoto = photos[0] || d.imgSrc || d.hiResImageLink || null;

      soldListings.push({
        id: `sc${soldListings.length + 1}`,
        zpid: String(zpid),
        address: d.streetAddress || d.address?.streetAddress || "Unknown",
        city: d.city || d.address?.city || "San Francisco",
        state: d.state || d.address?.state || "CA",
        zip: d.zipcode || d.address?.zipcode || "",
        beds: d.bedrooms || 0,
        baths: d.bathrooms || 0,
        sqft: d.livingArea || d.livingAreaValue || 0,
        lotSqft: d.lotAreaValue ? (d.lotAreaUnits === "acres" ? Math.round(d.lotAreaValue * 43560) : Math.round(d.lotAreaValue)) : 0,
        yearBuilt: d.yearBuilt || null,
        propertyType: normalizeHomeType(d.homeType),
        listPrice: extractListPrice(d.priceHistory || []) || soldPrice,
        zestimate: d.zestimate || null,
        soldPrice,
        soldDate,
        daysOnMarket: d.daysOnZillow || 0,
        status: "sold",
        photo: mainPhoto,
        photos: photos.slice(0, 6),
        neighborhood: d.neighborhoodRegion?.name || "",
        pricePerSqft: (d.livingArea && soldPrice) ? Math.round(soldPrice / d.livingArea) : 0,
        latitude: d.latitude || null,
        longitude: d.longitude || null,
        description: d.description || "",
        detailUrl: d.hdpUrl ? `https://www.zillow.com${d.hdpUrl}` : null,
        _source: "sold_comps",
      });
    });

    console.error(`[SoldComps] ${city}: ${zpids.length} zpids queried, ${fetchedCount} fetched, ${soldCount} confirmed sold, ${soldListings.length} returned`);

    const result = {
      soldListings,
      count: soldListings.length,
      city,
      zpidsQueried: zpids.length,
      fetchedCount,
      timestamp: new Date().toISOString(),
      cached: false,
    };

    // Cache if we got results
    if (soldListings.length > 0) {
      cache.set(cacheKey, { data: result, timestamp: Date.now() });
    }

    if (skipCache) {
      res.setHeader("Cache-Control", "no-store");
    } else {
      res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("[SoldComps] Error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Fetch property details from RapidAPI ───
async function fetchPropertyDetails(zpid, apiKey, apiHost) {
  const url = `https://${apiHost}/property-details?zpid=${zpid}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": apiHost,
    },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status} for zpid ${zpid}`);
  }
  const raw = await res.json();
  return raw.data || raw;
}

// ─── Extract the most recent "Sold" event from priceHistory ───
function extractSoldEvent(history) {
  if (!Array.isArray(history)) return null;
  // Find the most recent "Sold" event
  for (const evt of history) {
    if (evt.event && (
      evt.event === "Sold" ||
      evt.event.toLowerCase().includes("sold") ||
      evt.event === "Closed"
    )) {
      return {
        price: evt.price || null,
        date: evt.date || null,
        event: evt.event,
      };
    }
  }
  return null;
}

// ─── Extract original list price from priceHistory ───
function extractListPrice(history) {
  if (!Array.isArray(history)) return null;
  for (const evt of history) {
    if (evt.event && (evt.event === "Listed for sale" || evt.event === "Listed" || evt.event.includes("list"))) {
      return evt.price || null;
    }
  }
  return null;
}

// ─── Extract photos ───
function extractPhotos(d) {
  const urls = [];
  if (d.photos && Array.isArray(d.photos)) {
    for (let i = 0; i < d.photos.length && urls.length < 12; i++) {
      const jpegs = d.photos[i]?.mixedSources?.jpeg || [];
      if (jpegs.length > 0) urls.push(jpegs[jpegs.length - 1].url);
    }
    if (urls.length > 0) return urls;
  }
  if (d.responsivePhotos && Array.isArray(d.responsivePhotos)) {
    for (let i = 0; i < d.responsivePhotos.length && urls.length < 12; i++) {
      const srcs = d.responsivePhotos[i]?.mixedSources?.jpeg || [];
      if (srcs.length > 0) urls.push(srcs[srcs.length - 1].url);
    }
    if (urls.length > 0) return urls;
  }
  if (d.imgSrc) return [d.imgSrc];
  return [];
}

function normalizeHomeType(type) {
  if (!type) return "Single Family";
  const map = {
    SINGLE_FAMILY: "Single Family",
    MULTI_FAMILY: "Multi Family",
    CONDO: "Condo",
    CONDOS_COOPS: "Condo",
    TOWNHOUSE: "Townhouse",
    APARTMENT: "Apartment",
  };
  return map[type] || type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
