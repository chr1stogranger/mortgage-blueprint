// api/propertydetails.js
// Vercel Serverless Function — fetches property photos + description from RapidAPI
// Endpoint: /api/propertydetails?zpid=12345678

// ─── In-memory cache (persists across warm invocations) ───
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours — property details don't change often

const ALLOWED_ORIGINS = [
  "https://blueprint.realstack.app",
  "https://mortgage-blueprint.vercel.app",
  "http://localhost:5173", // local dev
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

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "RAPIDAPI_KEY not configured" });
  }

  const zpid = req.query.zpid;
  if (!zpid) {
    return res.status(400).json({ error: "zpid required" });
  }

  // Check cache
  const cached = cache.get(zpid);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
    return res.status(200).json({ ...cached.data, cached: true });
  }

  try {
    const apiHost = process.env.RAPIDAPI_HOST || "real-time-real-estate-data.p.rapidapi.com";
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

    const result = {
      zpid: String(d.zpid || zpid),
      photos,
      description,
      listPrice: originalListPrice || listPrice,
      zestimate: d.zestimate || null,
      yearBuilt,
      lotSize,
      homeType,
      taxAssessedValue,
      datePosted,
      photoCount: photos.length,
      cached: false,
    };

    // Cache the result
    cache.set(zpid, { data: result, timestamp: Date.now() });
    // Evict old entries if cache grows too large
    if (cache.size > 200) {
      const now = Date.now();
      for (const [k, v] of cache) {
        if (now - v.timestamp > CACHE_TTL) cache.delete(k);
      }
    }

    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
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
