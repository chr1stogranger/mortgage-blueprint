// The link-preview card (1200x630 PNG) for one California city's property-tax
// page: the same Plaid card as public/og-ca-tax.png (scripts/og/build-seo-og.mjs),
// with the map framed on that city, the city outlined, and its own numbers.
// Served by api/og-tax.js; render.js points each city page's og:image there.
//
// Layout runs through @vercel/og (satori + resvg) in the Node runtime. Its font
// reader can't parse Geist Mono's ligature tables, so the two uppercase labels
// are tracked Inter here (the static cards keep Geist Mono). The map
// is one SVG built here from the same geometry the page's map uses, so the card
// can't show a different shape or rate than the page.

import { readFileSync } from "node:fs";
import { ImageResponse } from "@vercel/og";
import { CA_CITY_TAX_INFO } from "../src/data/caTaxRates.js";
import { CA_CITY_COUNTY } from "../src/data/caCityCounty.js";
import { CA_FIXED_ASSESSMENT_DEFAULT, CA_FIXED_ASSESSMENT_CITIES } from "../src/data/caFixedAssessments.js";
import { computeTax, fixedEstimate } from "../scripts/seo-data/tax-calc.client.js";
import { rateBreaks, bucketOf } from "../scripts/seo-data/tax-map.client.js";

const read = (rel) => readFileSync(new URL(rel, import.meta.url));
let cache = null;
function assets() {
  if (cache) return cache;
  const geo = JSON.parse(read("../scripts/seo-data/ca-map-geo.json").toString("utf8"));
  for (const c of geo.cities) if (c.d) c.box = pathBox(c.d);
  cache = {
    geo,
    breaks: rateBreaks(Object.keys(CA_CITY_COUNTY).map((c) => CA_CITY_TAX_INFO[c].pct)),
    fonts: [
      { name: "Inter", data: read("../src/assets/fonts/Inter_400Regular.ttf"), weight: 400, style: "normal" },
      { name: "Inter", data: read("../src/assets/fonts/Inter_700Bold.ttf"), weight: 700, style: "normal" },
    ],
  };
  return cache;
}

const W = 1200, H = 630;
const MAP = { x: 600, y: 32, w: 568, h: 566 }; // the map panel, as on the shared card
const SHADES = ["#b5ece4", "#55d6c4", "#0fa9a5", "#0a78cc", "#0b3f94"]; // render.js .taxhub map steps
const INK = "#0b2545";
const RAINBOW = "linear-gradient(90deg, #3DF59A, #18D8E8, #6B7BFF, #F08AE0, #F7A54A, #F5E14A)";
const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Bounding box [x, y, w, h] of a build-ca-map.mjs path (relative integer moves; "z" returns to the subpath start). */
export function pathBox(d) {
  let x = 0, y = 0, sx = 0, sy = 0, cmd = "";
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const nums = [];
  const flush = () => {
    for (let i = 0; i + 1 < nums.length; i += 2) {
      if (cmd === "M" && i === 0) { x = nums[0]; y = nums[1]; sx = x; sy = y; }
      else if (cmd === "m" && i === 0) { x += nums[0]; y += nums[1]; sx = x; sy = y; }
      else { x += nums[i]; y += nums[i + 1]; }
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    nums.length = 0;
  };
  for (const t of d.match(/[MmLlZz]|-?\d+/g)) {
    if (/[A-Za-z]/.test(t)) {
      flush();
      if (t === "z" || t === "Z") { x = sx; y = sy; }
      cmd = t;
    } else nums.push(+t);
  }
  flush();
  return [x0, y0, x1 - x0, y1 - y0];
}

/**
 * The map panel: { svg, labels }. `box` is the area to show; `outline` the
 * path drawn heavy (a city or a county); `focus` a city named large first.
 * `prefer` names the cities labeled before any others. Names go on as text over
 * the image, since resvg draws text inside an image without fonts.
 */
function mapPanel({ box, outline, focus = null, prefer = null }) {
  const { geo, breaks } = assets();
  const [bx, by, bw, bh] = box;
  const k = Math.max(bw / MAP.w, bh / MAP.h); // map units per pixel
  const vw = MAP.w * k, vh = MAP.h * k;
  const vx = bx + bw / 2 - vw / 2, vy = by + bh / 2 - vh / 2;
  const near = (c) => c.x > vx - vw * 0.5 && c.x < vx + vw * 1.5 && c.y > vy - vh * 0.5 && c.y < vy + vh * 1.5;
  const shown = geo.cities.filter((c) => c === focus || near(c));
  const fill = (c) => SHADES[bucketOf(CA_CITY_TAX_INFO[c.city].pct, breaks)];
  const sizeOf = (c) => (c.box ? Math.max(c.box[2], c.box[3]) : 0);

  // Names: the focus city first, then preferred cities, then the biggest neighbors that fit without colliding.
  const taken = [];
  const labels = [];
  const toPx = (x, y) => [(x - vx) / k, (y - vy) / k];
  const rest = shown.filter((c) => c !== focus && c.box).sort((a, b) => (prefer ? prefer.has(b.city) - prefer.has(a.city) : 0) || sizeOf(b) - sizeOf(a));
  for (const c of [...(focus ? [focus] : []), ...rest]) {
    if (labels.length >= 10) break;
    const big = c === focus;
    const size = big ? 24 : 15;
    const [px, py0] = toPx(c.x, c.y);
    const top = c.d ? py0 - size * 0.65 : py0 + 10; // centered on the shape, or just under a dot
    const half = c.city.length * size * 0.3 + 6;
    const lb = [px - half, top, px + half, top + size * 1.3];
    // Keep clear of the panel's edges and the tag in its lower left.
    const clear = lb[0] > 8 && lb[2] < MAP.w - 8 && lb[1] > 8 && lb[3] < MAP.h - 8 && !(lb[0] < 300 && lb[3] > MAP.h - 140);
    if (!big && (!clear || taken.some((o) => lb[0] < o[2] && lb[2] > o[0] && lb[1] < o[3] && lb[3] > o[1]))) continue;
    taken.push(lb);
    labels.push({ text: c.city, left: Math.round(lb[0]), top: Math.round(lb[1]), width: Math.round(lb[2] - lb[0]), size, big });
  }
  const wave = `<path d="M0 4.5C40 0 120 0 160 4.5S280 9 320 4.5" fill="none" stroke="rgba(255,255,255,0.13)" stroke-width="0.9"/>`;
  const heavy = (d) => `<path fill="none" stroke="#fff" stroke-width="${7 * k}" stroke-linejoin="round" d="${d}"/><path fill="none" stroke="${INK}" stroke-width="${3.5 * k}" stroke-linejoin="round" d="${d}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP.w}" height="${MAP.h}" viewBox="0 0 ${MAP.w} ${MAP.h}">
<defs>
<linearGradient id="w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B4AA8"/><stop offset="0.45" stop-color="#0A78CC"/><stop offset="1" stop-color="#13C4C2"/></linearGradient>
<pattern id="l" width="320" height="9" patternUnits="userSpaceOnUse">${wave}</pattern>
</defs>
<rect width="${MAP.w}" height="${MAP.h}" fill="url(#w)"/><rect width="${MAP.w}" height="${MAP.h}" fill="url(#l)"/>
<g transform="scale(${1 / k}) translate(${-vx} ${-vy})">
<g fill="#f7fcfd">${geo.counties.map((c) => `<path d="${c.d}"/>`).join("")}</g>
<g stroke="#fff" stroke-width="${0.7 * k}">${shown.filter((c) => c.d).map((c) => `<path fill="${fill(c)}" d="${c.d}"/>`).join("")}</g>
<path fill="none" stroke="rgba(11,37,69,0.25)" stroke-width="${1.1 * k}" d="${geo.counties.map((c) => c.d).join("")}"/>
${shown.filter((c) => !c.d).map((c) => `<circle cx="${c.x}" cy="${c.y}" r="${(c === focus ? 7 : 4) * k}" fill="${fill(c)}" stroke="#fff" stroke-width="${1.5 * k}"/>`).join("")}
${outline ? heavy(outline) : focus ? `<circle cx="${focus.x}" cy="${focus.y}" r="${11 * k}" fill="none" stroke="${INK}" stroke-width="${3 * k}"/>` : ""}
</g>
</svg>`;
  return { svg, labels };
}

const div = (style, children) => ({ type: "div", props: { style: { display: "flex", ...style }, children } });
const text = (style, s) => ({ type: "div", props: { style: { display: "flex", ...style }, children: s } });
const countyLabel = (county) => (county === "San Francisco" ? "San Francisco" : `${county} County`);
const HALO = "0 0 4px #fff, 0 0 4px #fff, 0 0 3px #fff, 0 0 2px #fff, 0 0 1px #fff";

/** The shared card: brand, headline, subline, number tile and bill pill on the left; the map and its tag on the right. */
async function card({ headline, sub, tile, map, tag }) {
  const { fonts } = assets();
  const hSize = headline.length > 18 ? 44 : headline.length > 12 ? 52 : 60;
  const el = div({ width: W, height: H, background: "#fff", fontFamily: "Inter", color: INK, position: "relative" }, [
    div({ position: "absolute", left: 64, top: 56, width: 500, height: H - 112, flexDirection: "column" }, [
      text({ fontSize: 24, fontWeight: 700, letterSpacing: -0.2 }, "Mortgage Blueprint"),
      text({ marginTop: 6, fontSize: 11, letterSpacing: 1.9, color: "#6e6e6e" }, "POWERED BY REALSTACK"),
      text({ marginTop: 34, fontSize: hSize, fontWeight: 700, lineHeight: 1.05, letterSpacing: -hSize * 0.035 }, headline),
      text({ fontSize: 60, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2.1 }, "Property Tax"),
      text({ marginTop: 14, fontSize: 23, color: "#3b4f68" }, sub),
      div({ marginTop: "auto", flexDirection: "column", padding: "20px 24px", border: "1px solid rgba(8,129,129,0.16)", borderRadius: 20, background: "linear-gradient(160deg, #d9f7fa 0%, #eaf3fd 55%, #efe8fc 100%)" }, [
        text({ fontSize: 12, letterSpacing: 1.9, color: "#066a6a" }, tile.k),
        text({ marginTop: 4, fontSize: tile.v.length > 14 ? 38 : 46, fontWeight: 700, letterSpacing: -1.4 }, tile.v),
        text({ marginTop: 4, fontSize: 16, color: "#3b4f68" }, tile.s),
      ]),
      div({ marginTop: 16, padding: 2, borderRadius: 9999, backgroundImage: RAINBOW }, [
        div({ flex: 1, justifyContent: "center", padding: "15px 0", borderRadius: 9999, background: "#111", color: "#fff", fontSize: 22, fontWeight: 700 }, "Look up your tax bill"),
      ]),
    ]),
    div({ position: "absolute", left: MAP.x, top: MAP.y, width: MAP.w, height: MAP.h, borderRadius: 28, overflow: "hidden" }, [
      { type: "img", props: { src: `data:image/svg+xml;base64,${Buffer.from(map.svg).toString("base64")}`, width: MAP.w, height: MAP.h } },
      ...map.labels.map((l) => div({ position: "absolute", left: l.left, top: l.top, width: l.width, justifyContent: "center", fontSize: l.size, fontWeight: l.big ? 700 : 400, color: INK, textShadow: HALO }, l.text)),
      div({ position: "absolute", left: 22, bottom: 22, flexDirection: "column", padding: "13px 18px", border: "1px solid #dcdcdc", borderRadius: 14, background: "rgba(255,255,255,0.95)" }, [
        text({ fontSize: 20, fontWeight: 700 }, tag.a),
        text({ marginTop: 2, fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }, tag.b),
        text({ marginTop: 2, fontSize: 14, color: "#3b4f68" }, tag.c),
      ]),
    ]),
  ]);
  const res = new ImageResponse(el, { width: W, height: H, fonts });
  return Buffer.from(await res.arrayBuffer());
}

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
/** True when the card has a city to draw. */
export const isTaxCardCity = (city) => has(CA_CITY_TAX_INFO, city) && has(CA_CITY_COUNTY, city);
/** The county's listed cities, or [] for a county with no sourced rates (no page, no card). */
export const taxCardCountyCities = (county) => Object.keys(CA_CITY_COUNTY).filter((c) => CA_CITY_COUNTY[c] === county);
/** "1.0498% to 1.4146%", or one rate when the county lists a single city or all share it. */
export function countyRateRange(county) {
  const pcts = taxCardCountyCities(county).map((c) => CA_CITY_TAX_INFO[c].pct);
  const lo = Math.min(...pcts), hi = Math.max(...pcts);
  return lo === hi ? `${lo.toFixed(4)}%` : `${lo.toFixed(4)}% to ${hi.toFixed(4)}%`;
}

/** @returns {Promise<Buffer>} the 1200x630 PNG for one city */
export async function renderTaxCard(city) {
  if (!isTaxCardCity(city)) throw new Error(`tax card: unknown city ${city}`);
  const { geo } = assets();
  const info = CA_CITY_TAX_INFO[city];
  const county = CA_CITY_COUNTY[city];
  const est = fixedEstimate(city, { default: CA_FIXED_ASSESSMENT_DEFAULT, cities: CA_FIXED_ASSESSMENT_CITIES });
  const t = computeTax({ price: 1000000, ratePct: info.pct, mode: "home", fixed: est.est });
  const sel = geo.cities.find((c) => c.city === city);
  // At least 45 km across, so a small town still shows its neighbors; a big city gets room around it.
  const side = Math.max(450, ...(sel.box ? [sel.box[2] * 2.4, sel.box[3] * 2.4] : []));
  const cx = sel.box ? sel.box[0] + sel.box[2] / 2 : sel.x, cy = sel.box ? sel.box[1] + sel.box[3] / 2 : sel.y;
  return card({
    headline: city,
    sub: `${countyLabel(county)}, CA · FY ${info.fy} rate`,
    tile: { k: "ANNUAL PROPERTY TAX", v: usd2.format(t.annual), s: `${usd0.format(t.price)} home · ${usd2.format(t.monthly)} a month` },
    map: mapPanel({ box: [cx - side / 2, cy - side / 2, side, side], outline: sel.d || null, focus: sel }),
    tag: { a: city, b: `${info.pct.toFixed(4)}%`, c: `${countyLabel(county)} · FY ${info.fy}` },
  });
}

/** @returns {Promise<Buffer>} the 1200x630 PNG for one county's tax page */
export async function renderCountyCard(county) {
  const list = taxCardCountyCities(county);
  if (!list.length) throw new Error(`tax card: no cities listed for ${county}`);
  const { geo } = assets();
  const shape = geo.counties.find((c) => c.county === county);
  if (!shape) throw new Error(`tax card: no map shape for ${county}`);
  const fys = [...new Set(list.map((c) => CA_CITY_TAX_INFO[c].fy))].sort().join(" & ");
  // Frame the cities, not the county lines (LA's islands, San Bernardino's desert), like the page's map;
  // with only a few cities, the county's own outline is the better frame.
  const pts = geo.cities.filter((c) => list.includes(c.city));
  let box = shape.box;
  if (pts.length >= 4) {
    const trim = Math.floor(pts.length * 0.02);
    const xs = pts.map((c) => c.x).sort((a, b) => a - b).slice(trim, pts.length - trim);
    const ys = pts.map((c) => c.y).sort((a, b) => a - b).slice(trim, pts.length - trim);
    const pad = 120;
    box = [xs[0] - pad, ys[0] - pad, xs[xs.length - 1] - xs[0] + pad * 2, ys[ys.length - 1] - ys[0] + pad * 2];
  }
  // Leave room for the tag in the lower left, and never zoom in past 45 km across.
  const w = Math.max(box[2] * 1.15, 450), h = Math.max(box[3] * 1.25, 450);
  box = [box[0] + box[2] / 2 - w / 2 - w * 0.08, box[1] + box[3] / 2 - h / 2 + h * 0.06, w, h];
  const range = countyRateRange(county);
  const label = countyLabel(county);
  return card({
    headline: label,
    sub: `California · FY ${fys} rates`,
    tile: { k: list.length === 1 ? "CITY TAX RATE" : "CITY TAX RATES", v: range, s: list.length === 1 ? "The whole bill, in seconds" : `${list.length} cities and communities listed` },
    map: mapPanel({ box, outline: shape.d, prefer: new Set(list) }),
    tag: { a: label, b: list.length === 1 ? range : `${list.length} cities`, c: `FY ${fys}` },
  });
}
