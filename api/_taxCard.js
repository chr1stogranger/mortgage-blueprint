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

/** The map panel, framed on one city: { svg, labels }. Names go on as text over the image (resvg draws image text without fonts). */
function mapSvg(city) {
  const { geo, breaks } = assets();
  const sel = geo.cities.find((c) => c.city === city);
  // At least 45 km across, so a small town still shows its neighbors; a big city gets room around it.
  const side = Math.max(450, ...(sel.box ? [sel.box[2] * 2.4, sel.box[3] * 2.4] : []));
  const cx = sel.box ? sel.box[0] + sel.box[2] / 2 : sel.x, cy = sel.box ? sel.box[1] + sel.box[3] / 2 : sel.y;
  const vw = side * (MAP.w / Math.min(MAP.w, MAP.h)), vh = side * (MAP.h / Math.min(MAP.w, MAP.h));
  const vx = cx - vw / 2, vy = cy - vh / 2;
  const k = vw / MAP.w; // map units per pixel
  const near = (c) => Math.abs(c.x - cx) < vw * 1.5 && Math.abs(c.y - cy) < vh * 1.5;
  const shown = geo.cities.filter((c) => c === sel || near(c));
  const fill = (c) => SHADES[bucketOf(CA_CITY_TAX_INFO[c.city].pct, breaks)];

  // Names: the city first, then the biggest neighbors that fit without colliding.
  const taken = [];
  const labels = [];
  const toPx = (x, y) => [(x - vx) / k, (y - vy) / k];
  const order = [sel, ...shown.filter((c) => c !== sel && c.box).sort((a, b) => Math.max(b.box[2], b.box[3]) - Math.max(a.box[2], a.box[3]))];
  for (const c of order) {
    if (labels.length >= 9) break;
    const big = c === sel;
    const size = big ? 24 : 15;
    const [px, py0] = toPx(c.x, c.y);
    const top = c.d ? py0 - size * 0.65 : py0 + 10; // centered on the shape, or just under a dot
    const half = c.city.length * size * 0.3 + 6;
    const box = [px - half, top, px + half, top + size * 1.3];
    // Keep clear of the panel's edges and the rate tag in its lower left.
    const clear = box[0] > 8 && box[2] < MAP.w - 8 && box[1] > 8 && box[3] < MAP.h - 8 && !(box[0] < 290 && box[3] > MAP.h - 140);
    if (!big && (!clear || taken.some((o) => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1]))) continue;
    taken.push(box);
    labels.push({ text: c.city, left: Math.round(box[0]), top: Math.round(box[1]), width: Math.round(box[2] - box[0]), size, big });
  }
  const wave = (o) => `<path d="M0 ${4.5 + o}C40 ${o} 120 ${o} 160 ${4.5 + o}S280 ${9 + o} 320 ${4.5 + o}" fill="none" stroke="rgba(255,255,255,0.13)" stroke-width="0.9"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP.w}" height="${MAP.h}" viewBox="0 0 ${MAP.w} ${MAP.h}">
<defs>
<linearGradient id="w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B4AA8"/><stop offset="0.45" stop-color="#0A78CC"/><stop offset="1" stop-color="#13C4C2"/></linearGradient>
<pattern id="l" width="320" height="9" patternUnits="userSpaceOnUse">${wave(0)}</pattern>
</defs>
<rect width="${MAP.w}" height="${MAP.h}" fill="url(#w)"/><rect width="${MAP.w}" height="${MAP.h}" fill="url(#l)"/>
<g transform="scale(${1 / k}) translate(${-vx} ${-vy})">
<g fill="#f7fcfd">${geo.counties.map((c) => `<path d="${c.d}"/>`).join("")}</g>
<g stroke="#fff" stroke-width="${0.7 * k}">${shown.filter((c) => c.d).map((c) => `<path fill="${fill(c)}" d="${c.d}"/>`).join("")}</g>
<path fill="none" stroke="rgba(11,37,69,0.25)" stroke-width="${1.1 * k}" d="${geo.counties.map((c) => c.d).join("")}"/>
${shown.filter((c) => !c.d).map((c) => `<circle cx="${c.x}" cy="${c.y}" r="${(c === sel ? 7 : 4) * k}" fill="${fill(c)}" stroke="#fff" stroke-width="${1.5 * k}"/>`).join("")}
${sel.d ? `<path fill="none" stroke="#fff" stroke-width="${7 * k}" stroke-linejoin="round" d="${sel.d}"/><path fill="none" stroke="${INK}" stroke-width="${3.5 * k}" stroke-linejoin="round" d="${sel.d}"/>` : `<circle cx="${sel.x}" cy="${sel.y}" r="${11 * k}" fill="none" stroke="${INK}" stroke-width="${3 * k}"/>`}
</g>
</svg>`;
  return { svg, labels };
}

const div = (style, children) => ({ type: "div", props: { style: { display: "flex", ...style }, children } });
const text = (style, s) => ({ type: "div", props: { style: { display: "flex", ...style }, children: s } });

/** True when the card has a city to draw. */
export const isTaxCardCity = (city) => Object.prototype.hasOwnProperty.call(CA_CITY_TAX_INFO, city) && Object.prototype.hasOwnProperty.call(CA_CITY_COUNTY, city);

/** @returns {Promise<Buffer>} the 1200x630 PNG for one city */
export async function renderTaxCard(city) {
  if (!isTaxCardCity(city)) throw new Error(`tax card: unknown city ${city}`);
  const { fonts } = assets();
  const info = CA_CITY_TAX_INFO[city];
  const county = CA_CITY_COUNTY[city];
  const countyLabel = county === "San Francisco" ? "San Francisco" : `${county} County`;
  const est = fixedEstimate(city, { default: CA_FIXED_ASSESSMENT_DEFAULT, cities: CA_FIXED_ASSESSMENT_CITIES });
  const t = computeTax({ price: 1000000, ratePct: info.pct, mode: "home", fixed: est.est });
  const { svg, labels } = mapSvg(city);
  const citySize = city.length > 18 ? 44 : city.length > 12 ? 52 : 60;
  const halo = "0 0 4px #fff, 0 0 4px #fff, 0 0 3px #fff, 0 0 2px #fff, 0 0 1px #fff";
  const el = div({ width: W, height: H, background: "#fff", fontFamily: "Inter", color: INK, position: "relative" }, [
    div({ position: "absolute", left: 64, top: 56, width: 500, height: H - 112, flexDirection: "column" }, [
      text({ fontSize: 24, fontWeight: 700, letterSpacing: -0.2 }, "Mortgage Blueprint"),
      text({ marginTop: 6, fontSize: 11, letterSpacing: 1.9, color: "#6e6e6e" }, "POWERED BY REALSTACK"),
      text({ marginTop: 34, fontSize: citySize, fontWeight: 700, lineHeight: 1.05, letterSpacing: -citySize * 0.035 }, city),
      text({ fontSize: 60, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2.1 }, "Property Tax"),
      text({ marginTop: 14, fontSize: 23, color: "#3b4f68" }, `${countyLabel}, CA · FY ${info.fy} rate`),
      div({ marginTop: "auto", flexDirection: "column", padding: "20px 24px", border: "1px solid rgba(8,129,129,0.16)", borderRadius: 20, background: "linear-gradient(160deg, #d9f7fa 0%, #eaf3fd 55%, #efe8fc 100%)" }, [
        text({ fontSize: 12, letterSpacing: 1.9, color: "#066a6a" }, "ANNUAL PROPERTY TAX"),
        text({ marginTop: 4, fontSize: 46, fontWeight: 700, letterSpacing: -1.4 }, usd2.format(t.annual)),
        text({ marginTop: 4, fontSize: 16, color: "#3b4f68" }, `${usd0.format(t.price)} home · ${usd2.format(t.monthly)} a month`),
      ]),
      div({ marginTop: 16, padding: 2, borderRadius: 9999, backgroundImage: RAINBOW }, [
        div({ flex: 1, justifyContent: "center", padding: "15px 0", borderRadius: 9999, background: "#111", color: "#fff", fontSize: 22, fontWeight: 700 }, "Look up your tax bill"),
      ]),
    ]),
    div({ position: "absolute", left: MAP.x, top: MAP.y, width: MAP.w, height: MAP.h, borderRadius: 28, overflow: "hidden" }, [
      { type: "img", props: { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, width: MAP.w, height: MAP.h } },
      ...labels.map((l) => div({ position: "absolute", left: l.left, top: l.top, width: l.width, justifyContent: "center", fontSize: l.size, fontWeight: l.big ? 700 : 400, color: INK, textShadow: halo }, l.text)),
      div({ position: "absolute", left: 22, bottom: 22, flexDirection: "column", padding: "13px 18px", border: "1px solid #dcdcdc", borderRadius: 14, background: "rgba(255,255,255,0.95)" }, [
        text({ fontSize: 20, fontWeight: 700 }, city),
        text({ marginTop: 2, fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }, `${info.pct.toFixed(4)}%`),
        text({ marginTop: 2, fontSize: 14, color: "#3b4f68" }, `${countyLabel} · FY ${info.fy}`),
      ]),
    ]),
  ]);
  const res = new ImageResponse(el, { width: W, height: H, fonts });
  return Buffer.from(await res.arrayBuffer());
}
