// The link-preview card (1200x630 PNG) for one California city's property-tax
// page: the same Plaid card as public/og-ca-tax.png (scripts/og/build-seo-og.mjs),
// with the map framed on that city, the city outlined, and its own numbers.
// Served by api/og-tax.js; render.js points each city page's og:image there.
//
// The layout is shared with the loan-limit cards (_ogCard.js). The map is one
// SVG built here from the same geometry the page's map uses, so the card can't
// show a different shape or rate than the page.

import { CA_CITY_TAX_INFO } from "../src/data/caTaxRates.js";
import { CA_CITY_COUNTY } from "../src/data/caCityCounty.js";
import { CA_FIXED_ASSESSMENT_DEFAULT, CA_FIXED_ASSESSMENT_CITIES } from "../src/data/caFixedAssessments.js";
import { computeTax, fixedEstimate } from "../scripts/seo-data/tax-calc.client.js";
import { rateBreaks, bucketOf } from "../scripts/seo-data/tax-map.client.js";
import { MAP, INK, usd0, usd2, readAsset, pathBox, frame, placeLabels, waterSvg, heavyOutline, renderCard } from "./_ogCard.js";

export { pathBox };

let cache = null;
function assets() {
  if (cache) return cache;
  const geo = JSON.parse(readAsset("../scripts/seo-data/ca-map-geo.json").toString("utf8"));
  for (const c of geo.cities) if (c.d) c.box = pathBox(c.d);
  cache = { geo, breaks: rateBreaks(Object.keys(CA_CITY_COUNTY).map((c) => CA_CITY_TAX_INFO[c].pct)) };
  return cache;
}

const SHADES = ["#b5ece4", "#55d6c4", "#0fa9a5", "#0a78cc", "#0b3f94"]; // render.js .taxhub map steps

/**
 * The map panel: { svg, labels }. `box` is the area to show; `outline` the
 * path drawn heavy (a city or a county); `focus` a city named large first.
 * `prefer` names the cities labeled before any others. Names go on as text over
 * the image, since resvg draws text inside an image without fonts.
 */
function mapPanel({ box, outline, focus = null, prefer = null }) {
  const { geo, breaks } = assets();
  const f = frame(box);
  const { k, vx, vy, vw, vh } = f;
  const near = (c) => c.x > vx - vw * 0.5 && c.x < vx + vw * 1.5 && c.y > vy - vh * 0.5 && c.y < vy + vh * 1.5;
  const shown = geo.cities.filter((c) => c === focus || near(c));
  const fill = (c) => SHADES[bucketOf(CA_CITY_TAX_INFO[c.city].pct, breaks)];
  const sizeOf = (c) => (c.box ? Math.max(c.box[2], c.box[3]) : 0);
  const rest = shown.filter((c) => c !== focus && c.box).sort((a, b) => (prefer ? prefer.has(b.city) - prefer.has(a.city) : 0) || sizeOf(b) - sizeOf(a));
  const item = (c, isFocus = false) => ({ text: c.city, x: c.x, y: c.y, onShape: !!c.d, focus: isFocus });
  const labels = placeLabels([...(focus ? [item(focus, true)] : []), ...rest.map((c) => item(c))], f);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP.w}" height="${MAP.h}" viewBox="0 0 ${MAP.w} ${MAP.h}">
${waterSvg()}
<g transform="scale(${1 / k}) translate(${-vx} ${-vy})">
<g fill="#f7fcfd">${geo.counties.map((c) => `<path d="${c.d}"/>`).join("")}</g>
<g stroke="#fff" stroke-width="${0.7 * k}">${shown.filter((c) => c.d).map((c) => `<path fill="${fill(c)}" d="${c.d}"/>`).join("")}</g>
<path fill="none" stroke="rgba(11,37,69,0.25)" stroke-width="${1.1 * k}" d="${geo.counties.map((c) => c.d).join("")}"/>
${shown.filter((c) => !c.d).map((c) => `<circle cx="${c.x}" cy="${c.y}" r="${(c === focus ? 7 : 4) * k}" fill="${fill(c)}" stroke="#fff" stroke-width="${1.5 * k}"/>`).join("")}
${outline ? heavyOutline(outline, k) : focus ? `<circle cx="${focus.x}" cy="${focus.y}" r="${11 * k}" fill="none" stroke="${INK}" stroke-width="${3 * k}"/>` : ""}
</g>
</svg>`;
  return { svg, labels };
}

const countyLabel = (county) => (county === "San Francisco" ? "San Francisco" : `${county} County`);

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
  return renderCard({ line2: "Property Tax", pill: "Look up your tax bill",
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
  // Shifted right and down by less than the added margin, so the frame never cuts the county's own edge.
  const w = Math.max(box[2] * 1.3, 450), h = Math.max(box[3] * 1.3, 450);
  box = [box[0] + box[2] / 2 - w / 2 - w * 0.06, box[1] + box[3] / 2 - h / 2 + h * 0.05, w, h];
  const range = countyRateRange(county);
  const label = countyLabel(county);
  return renderCard({ line2: "Property Tax", pill: "Look up your tax bill",
    headline: label,
    sub: `California · FY ${fys} rates`,
    tile: { k: list.length === 1 ? "CITY TAX RATE" : "CITY TAX RATES", v: range, s: list.length === 1 ? "The whole bill, in seconds" : `${list.length} cities and communities listed` },
    map: mapPanel({ box, outline: shape.d, prefer: new Set(list) }),
    tag: { a: label, b: list.length === 1 ? range : `${list.length} cities`, c: `FY ${fys}` },
  });
}
