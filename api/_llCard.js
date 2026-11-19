// Link-preview cards (1200x630 PNG) for the loan-limit pages: a state's card is
// the county map framed on that state, a county's is framed on the county with
// it outlined, each with its own FHFA numbers. Served by api/og-ll.js; render.js
// points each state and county page's og:image there. The hub keeps the static
// public/og-loan-limits.png. Layout: _ogCard.js.
//
// Geometry is the page map's own (scripts/seo-data/ll-map-geo.json) and limits
// come from getCountyLimits(), so a card can't disagree with its page. Guam,
// the Virgin Islands, the Northern Marianas and American Samoa have no map
// shapes, so their pages keep the static card.

import { US_COUNTIES, US_STATE_NAMES } from "../src/data/usCounties.js";
import { LIMIT_YEAR, CONF_BASELINE, getCountyLimits } from "../src/data/loanLimits.js";
import { bucketOf } from "../scripts/seo-data/ll-map.client.js";
import { MAP, usd0, readAsset, frame, placeLabels, waterSvg, heavyOutline, renderCard } from "./_ogCard.js";

const SHADES = ["#e4f6f3", "#55d6c4", "#0fa9a5", "#0a78cc", "#0b3f94"]; // render.js .llmap steps
const NOUN = { AK: "boroughs and census areas", CT: "planning regions", LA: "parishes", PR: "municipios", VA: "counties and cities" };

let cache = null;
function assets() {
  if (cache) return cache;
  const geo = JSON.parse(readAsset("../scripts/seo-data/ll-map-geo.json").toString("utf8"));
  const byFips = new Map();
  for (const [st, list] of Object.entries(US_COUNTIES)) {
    for (const c of list) {
      const one = getCountyLimits(st, c.name, 1);
      byFips.set(c.fips, { ...c, st, state: US_STATE_NAMES[st], limit: one.highBalance, std: one.conforming });
    }
  }
  cache = { geo, byFips, shapes: new Map(geo.counties.map((c) => [c.fips, c])), states: new Map(geo.states.map((s) => [s.st, s])) };
  return cache;
}

const short = (name) => name.replace(/ (County|Parish|Municipio|Municipality|Borough|Census Area|City and Borough|Planning Region)$/, "");

/** True when a state (USPS code) has a shape to frame. */
export const hasStateCard = (st) => assets().states.has(st);
/** True when a county (FIPS) has a shape to frame. */
export const hasCountyCard = (fips) => assets().shapes.has(fips) && assets().byFips.has(fips);

// Alaska, Hawaii and Puerto Rico sit in insets along the bottom of the map, next
// to the Southwest and Florida, so a card shows only its own part: the mainland,
// or the one inset it is about.
const INSET = new Set(["AK", "HI", "PR"]);
const partOf = (st) => (INSET.has(st) ? st : "main");

function mapPanel({ box, outline, focus = null, preferSt }) {
  const { geo, byFips } = assets();
  const f = frame(box);
  const { k, vx, vy, vw, vh } = f;
  const part = partOf(preferSt);
  const inView = (b) => b[0] < vx + vw && b[0] + b[2] > vx && b[1] < vy + vh && b[1] + b[3] > vy;
  const shown = geo.counties.filter((c) => inView(c.box) && partOf(byFips.get(c.fips)?.st) === part);
  const sizeOf = (c) => Math.max(c.box[2], c.box[3]);
  const center = (c) => ({ x: c.box[0] + c.box[2] / 2, y: c.box[1] + c.box[3] / 2 });
  const item = (c, isFocus = false) => ({ text: short(byFips.get(c.fips).name), ...center(c), onShape: true, focus: isFocus });
  // Names: the county itself, then its own state's biggest counties, then the neighbors'.
  const rest = shown.filter((c) => c !== focus && byFips.has(c.fips))
    .sort((a, b) => (byFips.get(b.fips).st === preferSt) - (byFips.get(a.fips).st === preferSt) || sizeOf(b) - sizeOf(a));
  const labels = placeLabels([...(focus ? [item(focus, true)] : []), ...rest.map((c) => item(c))], f, 9);
  const fill = (c) => SHADES[bucketOf(byFips.get(c.fips)?.limit ?? CONF_BASELINE[1], CONF_BASELINE[1])];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MAP.w}" height="${MAP.h}" viewBox="0 0 ${MAP.w} ${MAP.h}">
${waterSvg()}
<g transform="scale(${1 / k}) translate(${-vx} ${-vy})">
<g stroke="rgba(11,37,69,0.18)" stroke-width="${0.6 * k}">${shown.map((c) => `<path fill="${fill(c)}" d="${c.d}"/>`).join("")}</g>
<path fill="none" stroke="rgba(11,37,69,0.6)" stroke-width="${1.3 * k}" stroke-linejoin="round" d="${geo.states.filter((s) => inView(s.box) && partOf(s.st) === part).map((s) => s.d).join("")}"/>
${heavyOutline(outline, k)}
</g>
</svg>`;
  return { svg, labels };
}

// Room for the tag in the lower left, and a floor on how far in to zoom (in map units, 500 m each).
const padBox = ([x, y, w0, h0], min) => {
  // Shifted right and down by less than the added margin, so a wide shape (Hawaii) keeps both edges.
  const w = Math.max(w0 * 1.3, min), h = Math.max(h0 * 1.3, min);
  return [x + w0 / 2 - w / 2 - w * 0.06, y + h0 / 2 - h / 2 + h * 0.05, w, h];
};

/** @returns {Promise<Buffer>} the card for one state, DC or Puerto Rico */
export async function renderStateCard(st) {
  if (!hasStateCard(st)) throw new Error(`loan-limit card: no map shape for ${st}`);
  const { states, byFips } = assets();
  const list = US_COUNTIES[st].map((c) => byFips.get(c.fips));
  const state = US_STATE_NAMES[st];
  const lims = list.map((c) => c.limit);
  const lo = Math.min(...lims), hi = Math.max(...lims);
  const above = list.filter((c) => c.limit > c.std).length;
  const noun = NOUN[st] || "counties";
  const single = list.length === 1;
  return renderCard({
    headline: state,
    line2: single ? "Loan Limit" : "Loan Limits",
    sub: `${LIMIT_YEAR} FHFA conforming limits`,
    tile: single
      ? { k: "ONE-UNIT LIMIT", v: usd0.format(hi), s: "One limit for the whole area" }
      : { k: "ONE-UNIT LIMITS", v: lo === hi ? usd0.format(hi) : `Up to ${usd0.format(hi)}`, s: lo === hi ? `Every one of its ${list.length} ${noun}` : `From ${usd0.format(lo)} across ${list.length} ${noun}` },
    pill: "Check your county's limit",
    map: mapPanel({ box: padBox(states.get(st).box, 260), outline: states.get(st).d, preferSt: st }),
    tag: single
      ? { a: state, b: usd0.format(hi), c: `1 unit · ${LIMIT_YEAR}` }
      : above ? { a: state, b: `${above} high-cost`, c: `of ${list.length} ${noun}` } : { a: state, b: list[0].std > CONF_BASELINE[1] ? "HERA baseline" : "Baseline statewide", c: `all ${list.length} ${noun}` },
  });
}

/** @returns {Promise<Buffer>} the card for one county (FIPS) */
export async function renderCountyCard(fips) {
  if (!hasCountyCard(fips)) throw new Error(`loan-limit card: no map shape for ${fips}`);
  const { shapes, byFips } = assets();
  const c = byFips.get(fips);
  const shape = shapes.get(fips);
  const band = c.limit > c.std ? `High-cost area · baseline ${usd0.format(c.std)}` : c.std > CONF_BASELINE[1] ? "Statutory baseline (HERA)" : "The national baseline";
  return renderCard({
    headline: `${c.name}, ${c.st}`,
    line2: "Loan Limit",
    sub: `${c.state} · ${LIMIT_YEAR} FHFA limit`,
    tile: { k: "ONE-UNIT LIMIT", v: usd0.format(c.limit), s: band },
    pill: "Check your county's limit",
    map: mapPanel({ box: padBox(shape.box.map((v, i) => (i < 2 ? v - shape.box[i + 2] : v * 3)), 300), outline: shape.d, focus: shape, preferSt: c.st }),
    tag: { a: short(c.name), b: usd0.format(c.limit), c: `1 unit · ${LIMIT_YEAR}` },
  });
}
