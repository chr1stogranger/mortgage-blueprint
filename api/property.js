// =============================================================
// /api/property — Get full property details + photos by zpid
// =============================================================
// Vercel Serverless Function (works with Vite projects)
// Returns up to 20 photos per property
// =============================================================

const API_HOST = "real-time-real-estate-data.p.rapidapi.com";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "RAPIDAPI_KEY not configured" });
    }

    const { zpid } = req.query;
    if (!zpid) {
      return res.status(400).json({ error: "zpid required" });
    }

    const apiRes = await fetch(
      `https://${API_HOST}/property-details?zpid=${zpid}`,
      {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": API_HOST,
        },
      }
    );

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return res.status(apiRes.status).json({ error: errText });
    }

    const raw = await apiRes.json();
    const d = raw.data || raw;

    const property = {
      id: String(d.zpid || zpid),
      zpid: String(d.zpid || zpid),
      address: d.streetAddress || d.address?.streetAddress || "",
      city: d.city || d.address?.city || "San Francisco",
      state: d.state || d.address?.state || "CA",
      zip: d.zipcode || d.address?.zipcode || "",
      beds: d.bedrooms || 0,
      baths: d.bathrooms || 0,
      sqft: d.livingArea || 0,
      lotSqft: d.lotAreaValue || d.lotSize || null,
      yearBuilt: d.yearBuilt || null,
      propertyType: normalizeType(d.homeType),
      listPrice: d.price || d.listPrice || 0,
      soldPrice: d.lastSoldPrice || null,
      soldDate: d.lastSoldDate || d.dateSold || null,
      daysOnMarket: d.daysOnZillow || 0,
      status: d.homeStatus === "RECENTLY_SOLD" ? "sold" : "active",
      photo: d.imgSrc || d.hiResImageLink || null,
      photos: extractPhotos(d),
      description: d.description || "",
      zestimate: d.zestimate || null,
      latitude: d.latitude || null,
      longitude: d.longitude || null,
      pricePerSqft: d.livingArea && d.price ? Math.round(d.price / d.livingArea) : null,
      neighborhood: getNeighborhood(d),
    };

    return res.status(200).json({ property });
  } catch (err) {
    console.error("Property error:", err);
    return res.status(500).json({ error: err.message });
  }
}

function extractPhotos(d) {
  // Method 1: photos array with mixedSources (most common)
  if (d.photos && Array.isArray(d.photos)) {
    return d.photos
      .flatMap((g) => {
        const jpegs = g.mixedSources?.jpeg || [];
        // Get the largest resolution available (last in array)
        const best = jpegs.length > 0 ? jpegs[jpegs.length - 1] : null;
        return best ? [best.url] : [];
      })
      .filter(Boolean)
      .slice(0, 8);
  }
  // Method 2: carouselPhotos
  if (d.carouselPhotos) {
    return d.carouselPhotos.map((p) => p.url).filter(Boolean).slice(0, 8);
  }
  // Method 3: responsivePhotos
  if (d.responsivePhotos) {
    return d.responsivePhotos
      .map((p) => {
        const urls = p.mixedSources?.jpeg || [];
        return urls.length > 0 ? urls[urls.length - 1].url : null;
      })
      .filter(Boolean)
      .slice(0, 8);
  }
  // Fallback: main image
  if (d.imgSrc) return [d.imgSrc];
  return [];
}

function normalizeType(t) {
  if (!t) return "Other";
  if (t.includes("SINGLE")) return "Single Family";
  if (t.includes("CONDO")) return "Condo";
  if (t.includes("TOWN")) return "Townhouse";
  if (t.includes("MULTI")) return "Multi-Family";
  return t;
}

function getNeighborhood(item) {
  const addr = (item.streetAddress || "").toLowerCase();
  const m = addr.match(/(\d+)(st|nd|rd|th)\s+ave/);
  if (m) {
    const n = parseInt(m[1]);
    if (n <= 15) return "Inner Sunset";
    if (n <= 30) return "Central Sunset";
    return "Outer Sunset";
  }
  if (item.zipcode === "94116") return "Parkside";
  return "Sunset District";
}
