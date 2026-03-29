// /api/sold-comps.js — Vercel Serverless Function
// Fetches REAL recently sold properties by calling property-details for known sold zpids.
// Supports zip-based filtering and auto-discovery via nearbyHomes.
//
// Usage:
//   /api/sold-comps?city=San Francisco                — all curated zpids (initial load)
//   /api/sold-comps?city=San Francisco&zip=94112      — only zpids for that zip (fast)
//   /api/sold-comps?city=San Francisco&zip=94112&more=1 — discover MORE via nearbyHomes

// ─── In-memory cache ───
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ─── Zip-to-neighborhood mapping for curated zpids ───
const ZIP_NEIGHBORHOODS = {
  "94122": "sunset", "94116": "sunset", "94121": "sunset_richmond",
  "94118": "richmond",
  "94110": "mission",
  "94114": "noe",
  "94115": "pachts",
  "94107": "soma",
  "94112": "excelsior",
  "94103": "soma",        // SOMA extends into 94103
  "94102": "hayes",       // Hayes Valley
  "94123": "marina",      // Marina
  "94124": "bayview",     // Bayview
  "94131": "twinpeaks",   // Twin Peaks / Glen Park
};

// ─── VERIFIED zpids — confirmed working with RapidAPI property-details March 2026 ───
// These are the ONLY zpids we KNOW return valid data. Always fetch these first.
const VERIFIED_ZPIDS = {
  "san francisco": {
    // Richmond (confirmed: 659 12th Ave $4.95M, etc.)
    richmond: ["15098085", "15094834", "15091588"],
    // Sunset (confirmed: 1495 21st Ave $2.93M, etc.)
    sunset: ["15105418", "15095869", "15115454"],
    // Mission / Bernal Heights (confirmed: 115 Ellsworth $2.63M, etc.)
    mission: ["15161966", "15150065", "15162139"],
    // Noe Valley
    noe: ["15182650", "15132286", "460322503"],
    // Pacific Heights
    pachts: ["15080888", "15082566", "15074528"],
    // Excelsior (confirmed: 907 Athens St)
    excelsior: ["15177062", "15167859", "15167742"],
  },
};

// ─── Additional UNVERIFIED zpids — may or may not work, used as fallback ───
// These extend neighborhood coverage but haven't been individually confirmed.
const EXTRA_ZPIDS = {
  "san francisco": {
    sunset: ["15092973", "15106327", "15120027", "15126338", "15108844", "15111975"],
    richmond: ["184816884", "15089898", "15094989", "15088761", "15090133"],
    sunset_richmond: ["15083291", "15086455", "15084819"],
    mission: ["15161587", "15164646", "15163900", "15160233", "15158901"],
    noe: ["460896185", "15133901", "15131455", "15134688"],
    pachts: ["121339149", "15079201", "15081345", "15076912"],
    soma: ["79842917", "80747470", "79846879", "80743387", "79844512"],
    hayes: ["15067233", "15069891", "15068455", "15070612"],
    excelsior: ["15169891", "15176420", "15174980", "15168533"],
    marina: ["15057901", "15059244", "15058612", "15060388"],
    bayview: ["15185901", "15187233", "15186455", "15188612"],
    twinpeaks: ["15140233", "15142588", "15141455", "15143312"],
  },
};

// Get zpids for a city — verified first, then extras
function getZpidsForCity(city) {
  const key = city.toLowerCase().trim();
  const verified = VERIFIED_ZPIDS[key] || {};
  const extras = EXTRA_ZPIDS[key] || {};
  // Verified zpids come first so they're always in the fetch batch
  const verifiedList = Object.values(verified).flat();
  const extraList = Object.values(extras).flat();
  return { verified: verifiedList, extras: extraList, all: [...verifiedList, ...extraList] };
}

// Get zpids for a specific zip code — verified first
function getZpidsForZip(city, zip) {
  const key = city.toLowerCase().trim();
  const verified = VERIFIED_ZPIDS[key] || {};
  const extras = EXTRA_ZPIDS[key] || {};

  const hoodKey = ZIP_NEIGHBORHOODS[zip];
  if (!hoodKey) return { verified: [], extras: [], all: [] };

  const matchHood = (name) => name === hoodKey || name.includes(hoodKey) || hoodKey.includes(name);

  const vList = [];
  for (const [name, list] of Object.entries(verified)) {
    if (matchHood(name)) vList.push(...list);
  }
  const eList = [];
  for (const [name, list] of Object.entries(extras)) {
    if (matchHood(name)) eList.push(...list);
  }
  return { verified: vList, extras: eList, all: [...vList, ...eList] };
}

// ─── Discovered zpids cache — persists across warm invocations ───
const discoveredZpids = new Map(); // zip → Set of discovered zpids

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
    const { city, zip, fresh, more, exclude } = req.query;
    if (!city) {
      return res.status(400).json({ error: "Missing ?city=San Francisco" });
    }

    // Build cache key based on params
    const cacheKey = zip
      ? `sold-${city.toLowerCase().trim()}-${zip}${more === "1" ? "-more" : ""}`
      : `sold-${city.toLowerCase().trim()}`;
    const skipCache = fresh === "1";

    if (!skipCache) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return res.status(200).json({ ...cached.data, cached: true });
      }
    } else {
      cache.delete(cacheKey);
    }

    // Determine which zpids to fetch (verified first, then extras)
    const zpidData = zip ? getZpidsForZip(city, zip) : getZpidsForCity(city);

    // For "more" mode, we'll discover new zpids from nearbyHomes
    const isMoreMode = more === "1" && zip;

    // Exclude already-seen zpids (client sends these)
    const excludeSet = new Set();
    if (exclude) {
      exclude.split(",").forEach(z => excludeSet.add(z.trim()));
    }

    let verifiedZpids = zpidData.verified.filter(z => !excludeSet.has(z));
    let extraZpids = zpidData.extras.filter(z => !excludeSet.has(z));

    if (isMoreMode) {
      // In "more" mode, use previously discovered zpids for this zip
      const discovered = discoveredZpids.get(zip);
      if (discovered && discovered.size > 0) {
        extraZpids = [...discovered].filter(z => !excludeSet.has(z));
      }
    }

    if (verifiedZpids.length === 0 && extraZpids.length === 0) {
      return res.status(200).json({
        soldListings: [],
        count: 0,
        city,
        zip: zip || null,
        hasMore: false,
        message: zip ? `No more sold data for zip ${zip}` : `No curated sold data for "${city}" yet`,
      });
    }

    const apiKey = process.env.RAPIDAPI_KEY;
    const apiHost = process.env.RAPIDAPI_HOST || "real-time-real-estate-data.p.rapidapi.com";
    if (!apiKey) {
      return res.status(500).json({ error: "RAPIDAPI_KEY not configured" });
    }

    // ── Build fetch batch: ALL verified zpids first, then fill with extras ──
    // Verified zpids are confirmed working, so always include them.
    // City-wide: up to 8 total (all 18 verified if available, then extras)
    // Zip-specific: up to 6 total
    const MAX_FETCH = zip ? 6 : 8;
    const dayHash = new Date().getDate();
    // Shuffle extras deterministically for variety
    const shuffledExtras = [...extraZpids].sort((a, b) => ((parseInt(a) * 31 + dayHash) % 997) - ((parseInt(b) * 31 + dayHash) % 997));
    // Rotate verified zpids too for daily variety
    const rotatedVerified = [...verifiedZpids];
    const rotateBy = dayHash % Math.max(rotatedVerified.length, 1);
    for (let i = 0; i < rotateBy; i++) rotatedVerified.push(rotatedVerified.shift());

    // Verified first, then fill remaining slots with extras
    const zpidsToFetch = [
      ...rotatedVerified.slice(0, MAX_FETCH),
      ...shuffledExtras.slice(0, Math.max(0, MAX_FETCH - rotatedVerified.length)),
    ].slice(0, MAX_FETCH);

    console.error(`[SoldComps] Batch: ${rotatedVerified.length} verified + ${shuffledExtras.length} extras → fetching ${zpidsToFetch.length}`);

    // Fetch property details in parallel — single batch, all at once
    const TIMEOUT_MS = 6000; // 6s per-request timeout
    const allResults = [];
    const discoveredFromNearby = new Set();

    const results = await Promise.allSettled(
      zpidsToFetch.map(zpid => fetchPropertyDetails(zpid, apiKey, apiHost, TIMEOUT_MS))
    );
    allResults.push(...results);

    // Process results into sold listings
    const soldListings = [];
    let fetchedCount = 0;
    let soldCount = 0;

    allResults.forEach((result, idx) => {
      if (result.status !== "fulfilled" || !result.value) return;
      fetchedCount++;

      const d = result.value;
      const zpid = zpidsToFetch[idx];

      // ── Auto-discover nearby sold homes ──
      if (d.nearbyHomes && Array.isArray(d.nearbyHomes)) {
        for (const nh of d.nearbyHomes) {
          if (nh.zpid && nh.homeStatus === "RECENTLY_SOLD" && !excludeSet.has(String(nh.zpid))) {
            discoveredFromNearby.add(String(nh.zpid));
          }
        }
      }

      // Extract sold info from priceHistory
      const soldEvent = extractSoldEvent(d.priceHistory || []);
      const soldPrice = soldEvent?.price || d.lastSoldPrice || null;
      const soldDate = soldEvent?.date || null;

      if (!soldPrice) return;

      // Filter out ancient sales (older than 5 years)
      if (soldDate) {
        const saleDate = new Date(soldDate);
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - 5);
        if (saleDate < cutoff) return;
      }

      soldCount++;

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

    // ── Self-healing: if 0 sold from curated zpids, immediately fetch discovered nearby ──
    if (soldListings.length === 0 && discoveredFromNearby.size > 0) {
      const discoveryZpids = [...discoveredFromNearby].slice(0, 4); // max 4 more
      console.error(`[SoldComps] 0 sold from curated — fetching ${discoveryZpids.length} discovered nearby zpids`);
      const discoveryResults = await Promise.allSettled(
        discoveryZpids.map(z => fetchPropertyDetails(z, apiKey, apiHost, TIMEOUT_MS))
      );
      discoveryResults.forEach((result, idx) => {
        if (result.status !== "fulfilled" || !result.value) return;
        fetchedCount++;
        const d = result.value;
        const zpid = discoveryZpids[idx];

        const soldEvent = extractSoldEvent(d.priceHistory || []);
        const soldPrice = soldEvent?.price || d.lastSoldPrice || null;
        const soldDate = soldEvent?.date || null;
        if (!soldPrice) return;

        // 5-year filter
        if (soldDate) {
          const saleDate = new Date(soldDate);
          const cutoff = new Date();
          cutoff.setFullYear(cutoff.getFullYear() - 5);
          if (saleDate < cutoff) return;
        }

        soldCount++;
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
    }

    // Store discovered zpids for "Load More" requests
    if (zip && discoveredFromNearby.size > 0) {
      const existing = discoveredZpids.get(zip) || new Set();
      const curatedSet = new Set(zpidsToFetch.map(String));
      for (const z of discoveredFromNearby) {
        if (!curatedSet.has(z)) existing.add(z);
      }
      discoveredZpids.set(zip, existing);
    }

    const totalAvailable = verifiedZpids.length + extraZpids.length;
    const hasMore = (totalAvailable > MAX_FETCH) || discoveredFromNearby.size > 0;

    console.error(`[SoldComps] ${city}${zip ? ` zip=${zip}` : ""}${isMoreMode ? " MORE" : ""}: ${zpidsToFetch.length}+${discoveredFromNearby.size > 0 && soldListings.length > 0 ? 'discovery' : '0'} zpids, ${fetchedCount} fetched, ${soldCount} sold, ${soldListings.length} returned`);

    const result = {
      soldListings,
      count: soldListings.length,
      city,
      zip: zip || null,
      hasMore,
      discoveredCount: discoveredFromNearby.size,
      zpidsQueried: zpidsToFetch.length,
      fetchedCount,
      timestamp: new Date().toISOString(),
      cached: false,
    };

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

// ─── Fetch property details from RapidAPI with timeout ───
async function fetchPropertyDetails(zpid, apiKey, apiHost, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://${apiHost}/property-details?zpid=${zpid}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": apiHost,
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`API ${res.status} for zpid ${zpid}`);
    }
    const raw = await res.json();
    return raw.data || raw;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Extract the most recent "Sold" event from priceHistory ───
function extractSoldEvent(history) {
  if (!Array.isArray(history)) return null;
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
