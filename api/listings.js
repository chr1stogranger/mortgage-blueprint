// /api/listings — Search listings via Real-Time Real-Estate Data (RapidAPI)
const API_HOST = "real-time-real-estate-data.p.rapidapi.com";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "RAPIDAPI_KEY not configured" });
    }

    const location = req.query.location || "Sunset District, San Francisco, CA";
    const status = req.query.status || "forSale";
    const page = req.query.page || "1";

    const params = new URLSearchParams({ location, page });
    params.set("home_status", status === "sold" ? "RECENTLY_SOLD" : "FOR_SALE");

    const apiRes = await fetch(
      "https://" + API_HOST + "/search?" + params.toString(),
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

    const listings = (raw.data || []).map(function (item) {
      return {
        id: String(item.zpid),
        zpid: String(item.zpid),
        address: item.streetAddress || "",
        fullAddress: item.address || "",
        city: item.city || "San Francisco",
        state: item.state || "CA",
        zip: item.zipcode || "",
        beds: item.bedrooms || 0,
        baths: item.bathrooms || 0,
        sqft: item.livingArea || 0,
        lotSqft: item.lotAreaValue || null,
        yearBuilt: item.yearBuilt || null,
        propertyType: normalizeType(item.homeType),
        listPrice: item.price || 0,
        zestimate: item.zestimate || null,
        soldPrice: item.lastSoldPrice || null,
        status: item.homeStatus === "RECENTLY_SOLD" ? "sold" : "active",
        daysOnMarket: item.daysOnZillow || 0,
        photo: item.imgSrc || null,
        description: item.description || "",
        neighborhood: getNeighborhood(item),
        latitude: item.latitude || null,
        longitude: item.longitude || null,
        pricePerSqft: item.livingArea && item.price ? Math.round(item.price / item.livingArea) : null,
      };
    });

    return res.status(200).json({ listings: listings, totalResults: listings.length, page: parseInt(page) });
  } catch (err) {
    console.error("Listings error:", err);
    return res.status(500).json({ error: err.message });
  }
};

function normalizeType(t) {
  if (!t) return "Other";
  if (t.indexOf("SINGLE") >= 0) return "Single Family";
  if (t.indexOf("CONDO") >= 0) return "Condo";
  if (t.indexOf("TOWN") >= 0) return "Townhouse";
  if (t.indexOf("MULTI") >= 0) return "Multi-Family";
  return t;
}

function getNeighborhood(item) {
  var addr = (item.streetAddress || "").toLowerCase();
  var m = addr.match(/(\d+)(st|nd|rd|th)\s+ave/);
  if (m) {
    var n = parseInt(m[1]);
    if (n <= 15) return "Inner Sunset";
    if (n <= 30) return "Central Sunset";
    return "Outer Sunset";
  }
  if (item.zipcode === "94116") return "Parkside";
  return "Sunset District";
}
