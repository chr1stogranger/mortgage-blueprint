// /api/pricepoint.js — Vercel Serverless Function
// Fetches active + recently sold listings from RapidAPI Zillow
// Caches results for 24 hours per location key

const CACHE = new Map(); // In-memory cache (per cold-start instance)
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms

module.exports = async function(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { zip, city, state } = req.query;

  if (!zip && !city) {
    return res.status(400).json({
      error: "Missing parameter: provide 'zip' or 'city' (with optional 'state')",
    });
  }

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "RAPIDAPI_KEY not configured" });
  }

  // Cache key
  const cacheKey = zip ? `zip:${zip}` : `city:${city}:${state || ""}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json(cached.data);
  }

  try {
    // Build search params for active listings
    const activeParams = new URLSearchParams({
      status_type: "ForSale",
      home_type: "Houses,Condos,Townhomes,MultiFamily",
      sort: "Newest",
    });
    if (zip) activeParams.set("zipcode", zip);
    else {
      activeParams.set("location", state ? `${city}, ${state}` : city);
    }

    // Build search params for recently sold
    const soldParams = new URLSearchParams({
      status_type: "RecentlySold",
      home_type: "Houses,Condos,Townhomes,MultiFamily",
      sort: "Newest",
    });
    if (zip) soldParams.set("zipcode", zip);
    else {
      soldParams.set("location", state ? `${city}, ${state}` : city);
    }

    const headers = {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "zillow-com1.p.rapidapi.com",
    };

    // Fetch both in parallel
    const [activeRes, soldRes] = await Promise.all([
      fetch(
        `https://zillow-com1.p.rapidapi.com/propertyExtendedSearch?${activeParams}`,
        { headers }
      ),
      fetch(
        `https://zillow-com1.p.rapidapi.com/propertyExtendedSearch?${soldParams}`,
        { headers }
      ),
    ]);

    if (!activeRes.ok && !soldRes.ok) {
      const errText = await activeRes.text().catch(() => "Unknown error");
      return res.status(502).json({
        error: "Zillow API error",
        detail: errText,
        status: activeRes.status,
      });
    }

    const activeData = activeRes.ok ? await activeRes.json() : { props: [] };
    const soldData = soldRes.ok ? await soldRes.json() : { props: [] };

    // Normalize active listings
    const activeListings = (activeData.props || []).slice(0, 15).map((p, i) => ({
      id: `live-a-${p.zpid || i}`,
      zpid: String(p.zpid || ""),
      address: p.streetAddress || p.address || "",
      city: p.city || "",
      state: p.state || "",
      zip: p.zipcode || zip || "",
      beds: p.bedrooms ?? p.beds ?? null,
      baths: p.bathrooms ?? p.baths ?? null,
      sqft: p.livingArea ?? p.area ?? null,
      lotSqft: p.lotAreaValue ?? p.lotSize ?? null,
      yearBuilt: p.yearBuilt ?? null,
      propertyType: normalizePropertyType(p.propertyType || p.homeType),
      listPrice: p.price ?? p.listPrice ?? null,
      zestimate: p.zestimate ?? null,
      soldPrice: null,
      soldDate: null,
      daysOnMarket: p.daysOnZillow ?? null,
      status: "active",
      photo: pickPhoto(p),
      neighborhood: p.neighborhood || "",
      pricePerSqft: calcPricePerSqft(p.price ?? p.listPrice, p.livingArea ?? p.area),
    }));

    // Normalize sold listings
    const soldListings = (soldData.props || []).slice(0, 15).map((p, i) => ({
      id: `live-s-${p.zpid || i}`,
      zpid: String(p.zpid || ""),
      address: p.streetAddress || p.address || "",
      city: p.city || "",
      state: p.state || "",
      zip: p.zipcode || zip || "",
      beds: p.bedrooms ?? p.beds ?? null,
      baths: p.bathrooms ?? p.baths ?? null,
      sqft: p.livingArea ?? p.area ?? null,
      lotSqft: p.lotAreaValue ?? p.lotSize ?? null,
      yearBuilt: p.yearBuilt ?? null,
      propertyType: normalizePropertyType(p.propertyType || p.homeType),
      listPrice: p.price ?? p.listPrice ?? null,
      zestimate: p.zestimate ?? null,
      soldPrice: p.soldPrice ?? p.lastSoldPrice ?? p.price ?? null,
      soldDate: p.dateSold || p.lastSoldDate || null,
      daysOnMarket: p.daysOnZillow ?? null,
      status: "sold",
      photo: pickPhoto(p),
      neighborhood: p.neighborhood || "",
      pricePerSqft: calcPricePerSqft(
        p.soldPrice ?? p.lastSoldPrice ?? p.price,
        p.livingArea ?? p.area
      ),
    }));

    const payload = {
      activeListings,
      soldListings,
      totalActive: activeData.totalResultCount ?? activeListings.length,
      totalSold: soldData.totalResultCount ?? soldListings.length,
      location: zip || `${city}${state ? ", " + state : ""}`,
      fetchedAt: new Date().toISOString(),
    };

    // Cache it
    CACHE.set(cacheKey, { ts: Date.now(), data: payload });
    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
    return res.status(200).json(payload);
  } catch (err) {
    console.error("PricePoint API error:", err);
    return res.status(500).json({ error: "Internal server error", detail: err.message });
  }
}

// ── Helpers ──

function normalizePropertyType(raw) {
  if (!raw) return "Single Family";
  const t = raw.toUpperCase();
  if (t.includes("SINGLE") || t.includes("HOUSE")) return "Single Family";
  if (t.includes("CONDO") || t.includes("APARTMENT")) return "Condo";
  if (t.includes("TOWN")) return "Townhouse";
  if (t.includes("MULTI")) return "Multi-Family";
  return raw;
}

function pickPhoto(p) {
  // Try multiple Zillow image fields
  if (p.imgSrc) return p.imgSrc;
  if (p.image) return p.image;
  if (p.photos && p.photos.length > 0) return p.photos[0];
  if (p.miniCardPhotos && p.miniCardPhotos.length > 0) return p.miniCardPhotos[0]?.url || p.miniCardPhotos[0];
  // Fallback to a generic house photo
  return "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80";
}

function calcPricePerSqft(price, sqft) {
  if (!price || !sqft || sqft === 0) return null;
  return Math.round(price / sqft);
}
