// One-off generator for scripts/seo-data/ll-map-geo.json, the national county
// map on the loan-limit pages. Not part of `npm run build`: re-run it by hand
// only if src/data/usCounties.js gains or loses a county (model.test.js checks
// every mapped county has a shape). Limits are NOT in here; the page data
// supplies them by FIPS code, so the yearly FHFA refresh needs no rebuild.
//
// Inputs are public-domain U.S. Census Bureau cartographic boundary files:
//   https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_county_500k.zip
//
//   node scripts/seo-data/build-ll-map.mjs <county.zip>
//
// The lower 48 and DC share one Albers projection. Alaska (shrunk), Hawaii and
// Puerto Rico get their own and sit in insets, like most U.S. maps. Guam, the
// Virgin Islands, the Northern Marianas and American Samoa are in the page
// data and the county search but not on the map. Output is map units
// (1 unit = 500 m on the mainland), y down, as compact SVG paths.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { US_COUNTIES } from "../../src/data/usCounties.js";

const [countyZip] = process.argv.slice(2);
if (!countyZip) throw new Error("usage: build-ll-map.mjs <county.zip>");

const UNIT_M = 500;
const OUT = "scripts/seo-data/ll-map-geo.json";
const PAD = 30; // units of water around everything
// Each inset: its own projection, a scale against the mainland, and how hard to simplify.
const INSETS = {
  AK: { fp: "02", proj: "+proj=aea +lat_1=55 +lat_2=65 +lat_0=50 +lon_0=-154 +datum=NAD83 +units=m", scale: 0.35, interval: 3000, islands: "300km2" },
  HI: { fp: "15", proj: "+proj=aea +lat_1=8 +lat_2=18 +lat_0=13 +lon_0=-157 +datum=NAD83 +units=m", scale: 1, interval: 500, islands: "8km2" },
  PR: { fp: "72", proj: "+proj=aea +lat_1=17.5 +lat_2=18.5 +lat_0=18 +lon_0=-66.5 +datum=NAD83 +units=m", scale: 1, interval: 300, islands: "6km2" },
};
const MAIN = "+proj=aea +lat_1=29.5 +lat_2=45.5 +lat_0=37.5 +lon_0=-96 +datum=NAD83 +units=m";
const OFF_MAP = ["02", "15", "72", "60", "66", "69", "78"]; // the insets plus AS, GU, MP, VI

const tmp = mkdtempSync(join(tmpdir(), "ll-map-"));
const f = (name) => join(tmp, name);
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const ms = (...args) => execFileSync("npx", ["--yes", "mapshaper@0.7.101", ...args], { stdio: ["ignore", "ignore", "inherit"] });
const list = (fps) => `[${fps.map((x) => `"${x}"`).join(",")}]`;

// Counties, simplified once, then dissolved into state outlines so the two share edges.
const layer = (name, filter, proj, interval, islands) => {
  ms(countyZip, "-filter", filter, "-filter-fields", "GEOID,STATEFP", "-proj", proj,
    "-simplify", `interval=${interval}`, "keep-shapes", "-filter-islands", `min-area=${islands}`, "-o", f(`${name}-c.json`), "format=geojson");
  ms(f(`${name}-c.json`), "-dissolve", "STATEFP", "-o", f(`${name}-s.json`), "format=geojson");
  return { counties: readJson(f(`${name}-c.json`)).features, states: readJson(f(`${name}-s.json`)).features };
};
const main = layer("main", `!${list(OFF_MAP)}.includes(STATEFP)`, MAIN, 1200, "20km2");
const insets = Object.fromEntries(Object.entries(INSETS).map(([st, o]) => [st, layer(st, `STATEFP=="${o.fp}"`, o.proj, o.interval, o.islands)]));

const polysOf = (g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);
const bbox = (features) => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const ft of features) for (const poly of polysOf(ft.geometry)) for (const [x, y] of poly.flat()) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { x0, x1, y0, y1 };
};

// Mainland meters -> map units (y down).
const m = bbox(main.counties);
const mainW = (m.x1 - m.x0) / UNIT_M, mainH = (m.y1 - m.y0) / UNIT_M;
const mainTx = ([x, y]) => [Math.round(PAD + (x - m.x0) / UNIT_M), Math.round(PAD + (m.y1 - y) / UNIT_M)];

// Inset frames, laid out along the bottom: Alaska and Hawaii under the
// Southwest, Puerto Rico under Florida.
const IPAD = 24;
const frames = {};
for (const [st, o] of Object.entries(INSETS)) {
  const b = bbox(insets[st].counties);
  const k = o.scale / UNIT_M;
  frames[st] = { b, k, w: Math.round((b.x1 - b.x0) * k + 2 * IPAD), h: Math.round((b.y1 - b.y0) * k + 2 * IPAD) };
}
const bottom = Math.round(PAD + mainH + 40); // the insets' shared bottom edge
frames.AK.x = PAD; frames.AK.y = bottom - frames.AK.h;
frames.HI.x = frames.AK.x + frames.AK.w + 30; frames.HI.y = bottom - frames.HI.h;
frames.PR.x = Math.round(PAD + mainW * 0.84); frames.PR.y = bottom - frames.PR.h;
const insetTx = (st) => {
  const { b, k, x, y } = frames[st];
  return ([px, py]) => [Math.round(x + IPAD + (px - b.x0) * k), Math.round(y + IPAD + (b.y1 - py) * k)];
};
const width = Math.round(PAD * 2 + mainW);
const height = bottom + PAD;

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

const stOf = {};
for (const [st, list] of Object.entries(US_COUNTIES)) stOf[list[0].fips.slice(0, 2)] = st;
const counties = [], states = [];
const add = ({ counties: cs, states: ss }, tx) => {
  for (const c of cs) {
    const e = encode(c.geometry, tx);
    if (e) counties.push({ fips: c.properties.GEOID, ...e });
  }
  for (const s of ss) {
    const e = encode(s.geometry, tx);
    if (e) states.push({ st: stOf[s.properties.STATEFP], ...e });
  }
};
add(main, mainTx);
for (const st of Object.keys(INSETS)) add(insets[st], insetTx(st));
counties.sort((a, b) => a.fips.localeCompare(b.fips));
states.sort((a, b) => a.st.localeCompare(b.st));

// Every county in a mapped state needs a shape (FHFA and Census share FIPS codes).
const have = new Set(counties.map((c) => c.fips));
const offMap = new Set(["AS", "GU", "MP", "VI"]);
const missing = Object.entries(US_COUNTIES).filter(([st]) => !offMap.has(st)).flatMap(([, l]) => l).filter((c) => !have.has(c.fips));
if (missing.length) throw new Error(`build-ll-map: no shape for ${missing.map((c) => `${c.name} ${c.fips}`).join(", ")}`);

const out = {
  source: "U.S. Census Bureau cartographic boundary files, 2024 (cb_2024_us_county_500k)",
  width, height,
  insets: Object.entries(frames).map(([st, fr]) => ({ st, box: [fr.x, fr.y, fr.w, fr.h] })),
  counties, states,
};
writeFileSync(OUT, JSON.stringify(out));
console.log(`${OUT}: ${counties.length} counties, ${states.length} states, ${width}x${height} units, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
