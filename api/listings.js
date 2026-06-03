// /api/listings — Search listings via Real-Time Real-Estate Data (RapidAPI)
// NOTE: this file is CommonJS (the rest of /api is ESM), so it can't import
// the shared api/_cors.js / _ratelimit.js helpers — the same allow-list and a
// mini rate limiter are inlined here. Keep the origin list in sync with _cors.js.
var https = require("https");

var ALLOWED_ORIGINS = [
  "https://blueprint.realstack.app",
  "https://mortgage-blueprint.vercel.app",
  "https://localhost",        // Capacitor iOS/Android native app
  "capacitor://localhost",
  "http://localhost:5173",
  "http://localhost:4173",
];

// In-memory per-IP rate limit (per warm instance) — mirrors api/_ratelimit.js
var rlBuckets = new Map();
function rateLimitedCjs(req, res, limit) {
  var xff = req.headers["x-forwarded-for"];
  var ip = (typeof xff === "string" && xff.length > 0) ? xff.split(",")[0].trim() : (req.headers["x-real-ip"] || "unknown");
  var now = Date.now();
  var hits = (rlBuckets.get(ip) || []).filter(function (t) { return now - t < 60000; });
  hits.push(now);
  rlBuckets.set(ip, hits);
  if (hits.length > limit) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "Too many requests — try again in a minute." });
    return true;
  }
  return false;
}

module.exports = function handler(req, res) {
  var origin = req.headers.origin;
  // Exact match — indexOf===0 would let https://blueprint.realstack.app.evil.com through.
  if (origin && ALLOWED_ORIGINS.indexOf(origin) >= 0) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://blueprint.realstack.app");
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (rateLimitedCjs(req, res, 30)) return;

  var apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "RAPIDAPI_KEY not configured" });
  }

  var location = req.query.location || "Sunset District, San Francisco, CA";
  var status = req.query.status || "forSale";
  var page = req.query.page || "1";
  var homeStatus = status === "sold" ? "RECENTLY_SOLD" : "FOR_SALE";

  var path = "/search?location=" + encodeURIComponent(location) + "&page=" + page + "&home_status=" + homeStatus;

  var options = {
    hostname: "real-time-real-estate-data.p.rapidapi.com",
    path: path,
    method: "GET",
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": "real-time-real-estate-data.p.rapidapi.com",
    },
  };

  var apiReq = https.request(options, function (apiRes) {
    var body = "";
    apiRes.on("data", function (chunk) { body += chunk; });
    apiRes.on("end", function () {
      try {
        var raw = JSON.parse(body);

        if (apiRes.statusCode !== 200) {
          return res.status(apiRes.statusCode).json({ error: body });
        }

        var listings = (raw.data || []).map(function (item) {
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
      } catch (e) {
        return res.status(500).json({ error: "Parse error: " + e.message });
      }
    });
  });

  apiReq.on("error", function (err) {
    return res.status(500).json({ error: err.message });
  });

  apiReq.end();
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
