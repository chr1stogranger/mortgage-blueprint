// One-off generator for scripts/seo-data/ca-map-geo.json, the geometry behind
// the CA tax hub's map. Not part of `npm run build`: re-run it by hand when
// src/data/caTaxRates.js gains a city (model.test.js fails until you do).
//
// Inputs are public-domain U.S. Census Bureau cartographic boundary files:
//   https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_06_place_500k.zip
//   https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_county_500k.zip
//
//   node scripts/seo-data/build-ca-map.mjs <place.zip> <county.zip>
//
// Output is California Albers (EPSG:3310) at 1 unit = 100 m, y down, as
// compact SVG path strings, so the browser needs no projection code.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CA_TAX_COUNTIES } from "../../src/data/caTaxRates.js";

const [placeZip, countyZip] = process.argv.slice(2);
if (!placeZip || !countyZip) throw new Error("usage: build-ca-map.mjs <place.zip> <county.zip>");

const ALBERS = "+proj=aea +lat_1=34 +lat_2=40.5 +lat_0=0 +lon_0=-120 +x_0=0 +y_0=-4000000 +datum=NAD83 +units=m";
const UNIT_M = 100;
const OUT = "scripts/seo-data/ca-map-geo.json";

// Our name -> the Census place that covers it, where the two differ.
const CENSUS_NAME = {
  "Angels Camp": "Angels",
  "Carmel Valley": "Carmel Valley Village",
  "Emerald Hills": "Emerald Lake Hills",
  "Paso Robles": "El Paso de Robles (Paso Robles)",
  "Pebble Beach": "Del Monte Forest",
  "The Sea Ranch": "Sea Ranch",
  "Ventura": "San Buenaventura (Ventura)",
};
// Communities with no Census place of their own (Lagunitas and Forest Knolls
// share one CDP but can differ in rate): a dot only, at an approximate
// [lon, lat]. The county check below catches a bad one.
const DOT_ONLY = {
  "Forest Knolls": [-122.6897, 38.0154],
  "Greenbrae": [-122.5247, 37.9485],
  "Lagunitas": [-122.7003, 38.011],
  "Marshall": [-122.8933, 38.1616],
  "Rio Nido": [-122.9797, 38.5155],
  "San Gregorio": [-122.3864, 37.3269],
};

const tmp = mkdtempSync(join(tmpdir(), "ca-map-"));
const f = (name) => join(tmp, name);
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const ms = (...args) => execFileSync("npx", ["--yes", "mapshaper@0.7.101", ...args], { stdio: ["ignore", "ignore", "inherit"] });
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Which county each Census place sits in, by an interior point. Names repeat
// across counties (El Cerrito, Burbank, Live Oak...), so a name alone isn't enough.
ms(countyZip, "-filter", 'STATEFP=="06"', "-each", "this.properties={county:NAME}", "-o", f("counties-ll.json"), "format=geojson");
ms(placeZip, "-points", "inner", "-filter-fields", "NAME,GEOID", "-join", f("counties-ll.json"), "fields=county", "-o", f("place-county.json"), "format=json");
const candidates = new Map();
for (const p of readJson(f("place-county.json"))) {
  const k = norm(p.NAME);
  if (!candidates.has(k)) candidates.set(k, []);
  candidates.get(k).push(p);
}

const geoidCity = new Map();
const dots = [];
const review = [];
for (const { county, rates } of CA_TAX_COUNTIES) {
  for (const city of Object.keys(rates)) {
    if (DOT_ONLY[city]) {
      dots.push({ type: "Feature", properties: { city, expect: county }, geometry: { type: "Point", coordinates: DOT_ONLY[city] } });
      continue;
    }
    const list = candidates.get(norm(CENSUS_NAME[city] || city)) || [];
    const inCounty = list.filter((p) => p.county === county);
    const hit = inCounty[0] || (list.length === 1 ? list[0] : null);
    if (!hit) throw new Error(`build-ca-map: no Census place for ${city} (${county})`);
    // A city spanning two counties can have its interior point in the other one.
    if (hit.county !== county) review.push(`${city}: table says ${county}, interior point in ${hit.county}`);
    if (geoidCity.has(hit.GEOID)) throw new Error(`build-ca-map: ${city} and ${geoidCity.get(hit.GEOID)} share ${hit.GEOID}`);
    geoidCity.set(hit.GEOID, city);
  }
}

// Check the hand-placed dots land in the county the rate table says.
writeFileSync(f("dots-ll.json"), JSON.stringify({ type: "FeatureCollection", features: dots }));
ms(f("dots-ll.json"), "-join", f("counties-ll.json"), "fields=county", "-o", f("dots-county.json"), "format=json");
for (const d of readJson(f("dots-county.json"))) {
  if (d.county !== d.expect) throw new Error(`build-ca-map: ${d.city} dot is in ${d.county}, expected ${d.expect}`);
}

// Project, then simplify places and county lines together so shared edges stay shared.
const keep = `/^(${[...geoidCity.keys()].join("|")})$/.test(GEOID)`;
ms(placeZip, "-filter", keep, "-filter-fields", "GEOID", "-proj", ALBERS, "-simplify", "interval=90", "keep-shapes", "-o", f("places.json"), "format=geojson");
ms(placeZip, "-filter", keep, "-points", "inner", "-filter-fields", "GEOID", "-proj", ALBERS, "-o", f("place-points.json"), "format=geojson");
ms(f("dots-ll.json"), "-proj", ALBERS, "-o", f("dots.json"), "format=geojson");
ms(f("counties-ll.json"), "-proj", ALBERS, "-simplify", "interval=250", "keep-shapes", "-filter-islands", "min-area=4km2", "-o", f("counties.json"), "format=geojson");

const countyFeatures = readJson(f("counties.json")).features;
const polysOf = (g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const c of countyFeatures) {
  for (const poly of polysOf(c.geometry)) {
    for (const [x, y] of poly.flat()) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
}
const px = (x) => Math.round((x - minX) / UNIT_M);
const py = (y) => Math.round((maxY - y) / UNIT_M);

/** GeoJSON geometry -> SVG path with relative integer moves, plus its bounding box. */
function encode(geometry) {
  let d = "";
  let cx = 0, cy = 0;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const poly of polysOf(geometry)) {
    for (const ring of poly) {
      const pts = [];
      for (const [x, y] of ring) {
        const p = [px(x), py(y)];
        const last = pts[pts.length - 1];
        if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
      }
      if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
      if (pts.length < 3) continue;
      for (const [a, b] of pts) {
        x0 = Math.min(x0, a); x1 = Math.max(x1, a);
        y0 = Math.min(y0, b); y1 = Math.max(y1, b);
      }
      d += `M${pts[0][0] - cx} ${pts[0][1] - cy}`.replace(/^M/, d ? "m" : "M");
      cx = pts[0][0]; cy = pts[0][1];
      d += "l";
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i][0] - cx, dy = pts[i][1] - cy;
        d += `${i > 1 && dx >= 0 ? " " : ""}${dx}${dy >= 0 ? " " : ""}${dy}`;
        cx = pts[i][0]; cy = pts[i][1];
      }
      // SVG returns the pen to the subpath start on "z"; relative moves continue from there.
      d += "z";
      cx = pts[0][0]; cy = pts[0][1];
    }
  }
  return d ? { d, box: [x0, y0, x1 - x0, y1 - y0] } : null;
}

const shapeBy = new Map(readJson(f("places.json")).features.map((p) => [p.properties.GEOID, p.geometry]));
const cities = [];
for (const p of readJson(f("place-points.json")).features) {
  const city = geoidCity.get(p.properties.GEOID);
  const [x, y] = p.geometry.coordinates;
  const shape = encode(shapeBy.get(p.properties.GEOID));
  cities.push({ city, x: px(x), y: py(y), ...(shape ? { d: shape.d } : {}) });
}
for (const p of readJson(f("dots.json")).features) {
  const [x, y] = p.geometry.coordinates;
  cities.push({ city: p.properties.city, x: px(x), y: py(y) });
}
cities.sort((a, b) => a.city.localeCompare(b.city));

const counties = countyFeatures
  .map((c) => ({ county: c.properties.county, ...encode(c.geometry) }))
  .sort((a, b) => a.county.localeCompare(b.county));

const out = {
  source: "U.S. Census Bureau cartographic boundary files, 2024 (cb_2024_06_place_500k, cb_2024_us_county_500k)",
  width: px(maxX),
  height: py(minY),
  counties,
  cities,
};
writeFileSync(OUT, JSON.stringify(out));
console.log(`${OUT}: ${counties.length} counties, ${cities.length} cities (${cities.filter((c) => !c.d).length} dot only), ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
if (review.length) console.log(`Interior point in another county (expected for a city spanning two):\n  ${review.join("\n  ")}`);
