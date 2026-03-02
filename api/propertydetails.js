// api/propertydetails.js
// Vercel Serverless Function — fetches property photos + description from RapidAPI
// Endpoint: /api/propertydetails?zpid=12345678

export default async function handler(req, res) {
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

  try {
    var url = "https://real-time-real-estate-data.p.rapidapi.com/property-details?zpid=" + zpid;
    var response = await fetch(url, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "real-time-real-estate-data.p.rapidapi.com",
      },
    });

    if (!response.ok) {
      var errText = await response.text();
      console.error("RapidAPI error:", response.status, errText);
      return res.status(response.status).json({ error: "RapidAPI returned " + response.status });
    }

    var raw = await response.json();
    var d = raw.data || raw;

    // Extract photos
    var photos = extractPhotos(d);

    // Extract description
    var description = d.description || "";

    return res.status(200).json({
      photos: photos,
      description: description,
      zpid: String(d.zpid || zpid),
    });
  } catch (err) {
    console.error("Property details error:", err);
    return res.status(500).json({ error: err.message || "Failed to fetch property details" });
  }
}

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
