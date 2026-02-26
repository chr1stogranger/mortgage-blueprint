// /api/property — Get property details + photos by zpid (RapidAPI)
var https = require("https");

module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  if (req.method === "OPTIONS") return res.status(200).end();

  var apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "RAPIDAPI_KEY not configured" });
  }

  var zpid = req.query.zpid;
  if (!zpid) {
    return res.status(400).json({ error: "zpid required" });
  }

  var options = {
    hostname: "real-time-real-estate-data.p.rapidapi.com",
    path: "/property-details?zpid=" + zpid,
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
        if (apiRes.statusCode !== 200) {
          return res.status(apiRes.statusCode).json({ error: body });
        }

        var raw = JSON.parse(body);
        var d = raw.data || raw;

        var property = {
          id: String(d.zpid || zpid),
          zpid: String(d.zpid || zpid),
          address: d.streetAddress || (d.address && d.address.streetAddress) || "",
          city: d.city || (d.address && d.address.city) || "San Francisco",
          state: d.state || (d.address && d.address.state) || "CA",
          zip: d.zipcode || (d.address && d.address.zipcode) || "",
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

        return res.status(200).json({ property: property });
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

function extractPhotos(d) {
  var urls = [];
  if (d.photos && Array.isArray(d.photos)) {
    for (var i = 0; i < d.photos.length && urls.length < 8; i++) {
      var jpegs = (d.photos[i].mixedSources && d.photos[i].mixedSources.jpeg) || [];
      if (jpegs.length > 0) {
        urls.push(jpegs[jpegs.length - 1].url);
      }
    }
    if (urls.length > 0) return urls;
  }
  if (d.carouselPhotos) {
    for (var j = 0; j < d.carouselPhotos.length && urls.length < 8; j++) {
      if (d.carouselPhotos[j].url) urls.push(d.carouselPhotos[j].url);
    }
    if (urls.length > 0) return urls;
  }
  if (d.responsivePhotos) {
    for (var k = 0; k < d.responsivePhotos.length && urls.length < 8; k++) {
      var srcs = (d.responsivePhotos[k].mixedSources && d.responsivePhotos[k].mixedSources.jpeg) || [];
      if (srcs.length > 0) urls.push(srcs[srcs.length - 1].url);
    }
    if (urls.length > 0) return urls;
  }
  if (d.imgSrc) return [d.imgSrc];
  return [];
}

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
