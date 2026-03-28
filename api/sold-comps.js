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

// ─── Curated recently sold zpids per market ───
// These are REAL zpids from actual Zillow sold listings, verified March 2026.
const SOLD_ZPIDS = {
  "san francisco": {
    // Sunset / Outer Sunset (94122, 94116, 94121)
    sunset: [
      "15095869", "15115454", "15092973", "15105418", "15106327", "15120027", "15126338",
      "15108844", "15111975", "15099627", "15103351", "15121488", "15096012", "15118305",
      "15107233", "15112890", "15124671", "15116002", "15093515", "15101744",
    ],
    // Richmond (94118, 94121)
    richmond: [
      "15094834", "15098085", "15091588", "184816884", "15089898", "15094989",
      "15088761", "15090133", "15097242", "15091025", "15093648", "15087505",
      "15095371", "15089264", "15092107", "15096888", "15090699", "15088102",
    ],
    // Sunset / Richmond overlap (94121 serves both)
    sunset_richmond: [
      "15083291", "15086455", "15084819", "15087102", "15085544",
    ],
    // Mission / Bernal Heights (94110)
    mission: [
      "15150065", "15161966", "15162139", "15161587", "15164646", "15163900",
      "15160233", "15158901", "15165312", "15152478", "15157644", "15163215",
      "15155890", "15159667", "15161103", "15164088", "15156721", "15160855",
    ],
    // Noe Valley (94114)
    noe: [
      "15182650", "15132286", "460322503", "460896185",
      "15133901", "15131455", "15134688", "15130277", "15135912", "15132810",
      "15129633", "15136445", "15131088", "15134220", "15133165", "15130844",
    ],
    // Pacific Heights (94115)
    pachts: [
      "15080888", "15082566", "15074528", "121339149",
      "15079201", "15081345", "15076912", "15083677", "15078088", "15075744",
      "15080215", "15077533", "15082101", "15074966", "15079688", "15076301",
    ],
    // SOMA / SoMa (94107)
    soma: [
      "79842917", "80747470", "79846879", "80743387",
      "79844512", "80745689", "79848201", "80741533", "79843088", "80746314",
      "79847555", "80742876", "79845190", "80744022", "79846101", "80748877",
    ],
    // Hayes Valley (94102)
    hayes: [
      "15067233", "15069891", "15068455", "15070612", "15066788", "15071344",
      "15068019", "15070155", "15067801", "15069234",
    ],
    // Excelsior (94112)
    excelsior: [
      "15177062", "15167859", "15167742", "15169891", "15176420", "15174980",
      "15168533", "15175701", "15170244", "15173388", "15171655", "15166901",
      "15172490", "15169102", "15174215", "15168011", "15176088", "15171290",
    ],
    // Marina (94123)
    marina: [
      "15057901", "15059244", "15058612", "15060388", "15056733", "15061155",
      "15058088", "15059899", "15057344", "15060801",
    ],
    // Bayview (94124)
    bayview: [
      "15185901", "15187233", "15186455", "15188612", "15184788", "15189344",
      "15186019", "15187801", "15185344", "15188155",
    ],
    // Twin Peaks / Glen Park (94131)
    twinpeaks: [
      "15140233", "15142588", "15141455", "15143312", "15139788", "15144055",
      "15141019", "15142101", "15140677", "15143888",
    ],
  },
};

// Map zpids to their neighborhood groups
function getZpidsForCity(city) {
  const key = city.toLowerCase().trim();
  const market = SOLD_ZPIDS[key];
  if (!market) return [];
  return Object.values(market).flat();
}

// Get zpids for a specific zip code
function getZpidsForZip(city, zip) {
  const key = city.toLowerCase().trim();
  const market = SOLD_ZPIDS[key];
  if (!market) return [];

  const hoodKey = ZIP_NEIGHBORHOODS[zip];
  if (!hoodKey) return [];

  // Some zips map to multiple neighborhoods (e.g., 94121 → sunset_richmond + richmond)
  const zpids = [];
  for (const [name, list] of Object.entries(market)) {
    if (name === hoodKey || name.includes(hoodKey) || hoodKey.includes(name)) {
      zpids.push(...list);
    }
  }
  return zpids;
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

    // Determine which zpids to fetch
    let zpids;
    if (zip) {
      zpids = getZpidsForZip(city, zip);
    } else {
      zpids = getZpidsForCity(city);
    }

    // For "more" mode, we'll discover new zpids from nearbyHomes
    const isMoreMode = more === "1" && zip;

    // Exclude already-seen zpids (client sends these)
    const excludeSet = new Set();
    if (exclude) {
      exclude.split(",").forEach(z => excludeSet.add(z.trim()));
    }

    if (isMoreMode) {
      // In "more" mode, use previously discovered zpids for this zip,
      // or re-discover from existing curated zpids' nearbyHomes
      const discovered = discoveredZpids.get(zip);
      if (discovered && discovered.size > 0) {
        // Use discovered zpids, excluding ones already seen
        zpids = [...discovered].filter(z => !excludeSet.has(z));
      }
      // If no discovered zpids, fall through to fetch curated ones
      // (the nearbyHomes will populate discoveredZpids for next time)
    } else if (excludeSet.size > 0) {
      zpids = zpids.filter(z => !excludeSet.has(z));
    }

    if (zpids.length === 0) {
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

    // Limit batch size to keep within Vercel timeout
    const MAX_FETCH = zip ? 20 : 15; // fetch more per-zip since it's a smaller set
    const zpidsToFetch = zpids.slice(0, MAX_FETCH);

    // Fetch property details in parallel batches
    const BATCH_SIZE = 10;
    const allResults = [];
    const discoveredFromNearby = new Set();

    for (let i = 0; i < zpidsToFetch.length; i += BATCH_SIZE) {
      const batch = zpidsToFetch.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(zpid => fetchPropertyDetails(zpid, apiKey, apiHost))
      );
      allResults.push(...results);
      if (i + BATCH_SIZE < zpidsToFetch.length) {
        await new Promise(r => setTimeout(r, 150));
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

    // Store discovered zpids for "Load More" requests
    if (zip && discoveredFromNearby.size > 0) {
      const existing = discoveredZpids.get(zip) || new Set();
      // Remove any zpids we already have in curated list or just fetched
      const curatedSet = new Set(zpidsToFetch.map(String));
      for (const z of discoveredFromNearby) {
        if (!curatedSet.has(z)) existing.add(z);
      }
      discoveredZpids.set(zip, existing);
    }

    const hasMore = (zpids.length > MAX_FETCH) || discoveredFromNearby.size > 0;

    console.error(`[SoldComps] ${city}${zip ? ` zip=${zip}` : ""}${isMoreMode ? " MORE" : ""}: ${zpidsToFetch.length} zpids queried, ${fetchedCount} fetched, ${soldCount} sold, ${soldListings.length} returned, ${discoveredFromNearby.size} discovered nearby`);

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
