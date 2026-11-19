// One-off generator for scripts/seo-data/ll-map-geo.json, the county map on
// the loan-limit pages. Not part of `npm run build`: re-run it by hand only if
// the licensed states change (model.test.js checks every licensed county has a
// shape). Limits are NOT in here; the page data supplies them by FIPS code.
//
// Inputs are public-domain U.S. Census Bureau cartographic boundary files:
//   https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_county_500k.zip
//   https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_state_500k.zip
//
//   node scripts/seo-data/build-ll-map.mjs <county.zip> <state.zip>
//
// The mainland states share one Albers projection; Hawaii gets its own and sits
// in an inset at the lower left, like most U.S. maps. Neighboring states are
// drawn as faint context so the licensed states don't float. Output is map
// units (1 unit = 500 m), y down, as compact SVG paths.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LICENSED_COUNTIES } from "../../src/data/licensedCounties.js";

const [countyZip, stateZip] = process.argv.slice(2);
if (!countyZip || !stateZip) throw new Error("usage: build-ll-map.mjs <county.zip> <state.zip>");

const STATE_FP = { AZ: "04", CA: "06", CO: "08", HI: "15", NV: "32", OR: "41", TX: "48", WA: "53" };
const MAIN = "+proj=aea +lat_1=29.5 +lat_2=45.5 +lat_0=37.5 +lon_0=-109 +datum=NAD83 +units=m";
const HAWAII = "+proj=aea +lat_1=8 +lat_2=18 +lat_0=13 +lon_0=-157 +datum=NAD83 +units=m";
const UNIT_M = 500;
const OUT = "scripts/seo-data/ll-map-geo.json";
// Lower 48 only, for the context outlines (no AK, HI or territories).
const NOT_CONTEXT = new Set(["02", "15", "60", "66", "69", "72", "78"]);

const tmp = mkdtempSync(join(tmpdir(), "ll-map-"));
const f = (name) => join(tmp, name);
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const ms = (...args) => execFileSync("npx", ["--yes", "mapshaper@0.7.101", ...args], { stdio: ["ignore", "ignore", "inherit"] });

const mainFps = Object.entries(STATE_FP).filter(([st]) => st !== "HI").map(([, fp]) => fp);
const inList = (fps) => `[${fps.map((x) => `"${x}"`).join(",")}].includes(STATEFP)`;

// Counties, simplified once, then dissolved into state outlines so the two share edges.
ms(countyZip, "-filter", inList(mainFps), "-filter-fields", "GEOID,STATEFP", "-proj", MAIN,
  "-simplify", "interval=900", "keep-shapes", "-filter-islands", "min-area=30km2", "-o", f("main-counties.json"), "format=geojson");
ms(f("main-counties.json"), "-dissolve", "STATEFP", "-o", f("main-states.json"), "format=geojson");
ms(countyZip, "-filter", 'STATEFP=="15"', "-filter-fields", "GEOID,STATEFP", "-proj", HAWAII,
  "-simplify", "interval=400", "keep-shapes", "-filter-islands", "min-area=8km2", "-o", f("hi-counties.json"), "format=geojson");
ms(f("hi-counties.json"), "-dissolve", "STATEFP", "-o", f("hi-states.json"), "format=geojson");

const polysOf = (g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);
const bbox = (features) => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const ft of features) for (const poly of polysOf(ft.geometry)) for (const [x, y] of poly.flat()) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { x0, x1, y0, y1 };
};

const mainCounties = readJson(f("main-counties.json")).features;
const hiCounties = readJson(f("hi-counties.json")).features;
const m = bbox(mainCounties);
const PAD = 40 * UNIT_M; // 20 km of water around the licensed states
// Neighbors, clipped to the map's frame so the file carries nothing off-screen.
ms(stateZip, "-filter", `!${inList([...mainFps, ...NOT_CONTEXT])}`, "-filter-fields", "STATEFP", "-proj", MAIN,
  "-clip", `bbox=${m.x0 - PAD},${m.y0 - PAD},${m.x1 + PAD},${m.y1 + PAD}`,
  "-simplify", "interval=1500", "keep-shapes", "-filter-islands", "min-area=200km2", "-o", f("context.json"), "format=geojson");
// Mainland meters -> map units (y down).
const mainTx = ([x, y]) => [Math.round((x - m.x0 + PAD) / UNIT_M), Math.round((m.y1 + PAD - y) / UNIT_M)];
const width = Math.round((m.x1 - m.x0 + 2 * PAD) / UNIT_M);
const height = Math.round((m.y1 - m.y0 + 2 * PAD) / UNIT_M);

// Hawaii inset: same scale, its lower-left corner tucked into the lower-left of the map.
const hb = bbox(hiCounties);
const INSET_PAD = 30 * UNIT_M;
const hiW = Math.round((hb.x1 - hb.x0 + 2 * INSET_PAD) / UNIT_M);
const hiH = Math.round((hb.y1 - hb.y0 + 2 * INSET_PAD) / UNIT_M);
const inset = [20, height - hiH - 20, hiW, hiH];
const hiTx = ([x, y]) => [Math.round(inset[0] + (x - hb.x0 + INSET_PAD) / UNIT_M), Math.round(inset[1] + (hb.y1 + INSET_PAD - y) / UNIT_M)];

/** GeoJSON geometry -> SVG path with relative integer moves, plus its bounding box. */
function encode(geometry, tx) {
  let d = "";
  let cx = 0, cy = 0;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const poly of polysOf(geometry)) {
    for (const ring of poly) {
      const pts = [];
      for (const pt of ring) {
        const p = tx(pt);
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
      d += "z";
      cx = pts[0][0]; cy = pts[0][1];
    }
  }
  return d ? { d, box: [x0, y0, x1 - x0, y1 - y0] } : null;
}

const stOf = Object.fromEntries(Object.entries(STATE_FP).map(([st, fp]) => [fp, st]));
const counties = [
  ...mainCounties.map((c) => ({ fips: c.properties.GEOID, ...encode(c.geometry, mainTx) })),
  ...hiCounties.map((c) => ({ fips: c.properties.GEOID, ...encode(c.geometry, hiTx) })),
].filter((c) => c.d).sort((a, b) => a.fips.localeCompare(b.fips));
const states = [
  ...readJson(f("main-states.json")).features.map((s) => ({ st: stOf[s.properties.STATEFP], ...encode(s.geometry, mainTx) })),
  ...readJson(f("hi-states.json")).features.map((s) => ({ st: "HI", ...encode(s.geometry, hiTx) })),
].sort((a, b) => a.st.localeCompare(b.st));
const context = readJson(f("context.json")).features.map((s) => encode(s.geometry, mainTx)?.d || "").join("");

// Every licensed county needs a shape (FHFA and Census share FIPS codes).
const have = new Set(counties.map((c) => c.fips));
const missing = Object.values(LICENSED_COUNTIES).flat().filter((c) => !have.has(c.fips));
if (missing.length) throw new Error(`build-ll-map: no shape for ${missing.map((c) => `${c.name} ${c.fips}`).join(", ")}`);

const out = {
  source: "U.S. Census Bureau cartographic boundary files, 2024 (cb_2024_us_county_500k, cb_2024_us_state_500k)",
  width, height, inset, counties, states, context,
};
writeFileSync(OUT, JSON.stringify(out));
console.log(`${OUT}: ${counties.length} counties, ${states.length} states, ${width}x${height} units, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
