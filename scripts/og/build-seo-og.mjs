// Link-preview cards (1200x630) for the static SEO pages, in RealStack Ops'
// Plaid look: public/og-ca-tax.png (CA property tax pages) and
// public/og-loan-limits.png (loan-limit pages). render.js points og:image at them.
//
// Not part of `npm run build` (it needs desktop Chrome). Re-run by hand when the
// look changes, or when the sample numbers drift (a new Berkeley rate, new FHFA
// limits); every figure comes from the shipped data, the maps from the same
// geometry the pages use.
//
//   node scripts/og/build-seo-og.mjs
//
// Fonts load from public/fonts (never Google Fonts). iMessage caches a card per
// URL, so links already shared keep their old card.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { BACKGROUNDS } from "../../src/lib/backgrounds.js";
import { CA_CITY_TAX_INFO, BAY_AREA_COUNTIES } from "../../src/data/caTaxRates.js";
import { CA_FIXED_ASSESSMENT_DEFAULT, CA_FIXED_ASSESSMENT_CITIES } from "../../src/data/caFixedAssessments.js";
import { CA_CITY_COUNTY } from "../../src/data/caCityCounty.js";
import { LIMIT_YEAR, CONF_BASELINE, CONF_CEILING, getCountyLimits } from "../../src/data/loanLimits.js";
import { US_COUNTIES } from "../../src/data/usCounties.js";
import { computeTax, fixedEstimate } from "../seo-data/tax-calc.client.js";
import { rateBreaks, bucketOf as rateBucket } from "../seo-data/tax-map.client.js";
import { bucketOf as limitBucket } from "../seo-data/ll-map.client.js";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = resolve(new URL("../..", import.meta.url).pathname);
const PLAID_WATER = BACKGROUNDS.find((b) => b.id === "plaid").css;
const PLAID_EDGE = "conic-gradient(from 210deg, #3DF59A, #18D8E8, #6B7BFF, #F08AE0, #F7A54A, #F5E14A, #3DF59A)";
const SHADES = ["#b5ece4", "#55d6c4", "#0fa9a5", "#0a78cc", "#0b3f94"]; // render.js .taxhub map steps
const LL_SHADES = ["#e4f6f3", ...SHADES.slice(1)];
const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const fontFace = ["inter-latin", "inter-latin-ext"].map((f) => `@font-face{font-family:Inter;font-weight:100 900;src:url("file://${ROOT}/public/fonts/${f}.woff2") format("woff2")}`).join("")
  + `@font-face{font-family:"Geist Mono";font-weight:100 900;src:url("file://${ROOT}/public/fonts/geist-mono-latin.woff2") format("woff2")}`;

const page = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>${fontFace}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{background:#fff;color:#0b2545;font-family:Inter,sans-serif;font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased;position:relative}
.mono{font-family:"Geist Mono",monospace;text-transform:uppercase}
.left{position:absolute;left:64px;top:56px;bottom:56px;width:500px;display:flex;flex-direction:column}
.brand b{display:block;font-size:24px;font-weight:700;letter-spacing:-0.01em}
.brand span{display:block;margin-top:5px;font-size:11px;letter-spacing:0.15em;color:#6e6e6e}
h1{margin-top:40px;font-size:58px;line-height:1.02;font-weight:750;letter-spacing:-0.035em}
.sub{margin-top:16px;font-size:23px;line-height:1.35;color:#3b4f68}
.tile{margin-top:auto;padding:20px 24px;border:1px solid rgba(8,129,129,0.16);border-radius:20px;background:linear-gradient(160deg,#d9f7fa 0%,#eaf3fd 55%,#efe8fc 100%)}
.tile .k{font-size:12px;letter-spacing:0.13em;color:#066a6a}
.tile strong{display:block;margin-top:4px;font-size:46px;line-height:1.05;font-weight:750;letter-spacing:-0.03em}
.tile .s{margin-top:4px;font-size:16px;color:#3b4f68}
.stats{display:flex;gap:22px}.stats strong{font-size:40px}.stats>div+div{padding-left:22px;border-left:1px solid rgba(11,37,69,0.16)}
.pill{margin-top:16px;padding:17px 0;border:2px solid transparent;border-radius:9999px;background:linear-gradient(#111,#111) padding-box,${PLAID_EDGE} border-box;color:#fff;font-size:22px;font-weight:650;text-align:center}
.map{position:absolute;right:32px;top:32px;bottom:32px;border-radius:28px;overflow:hidden;background:${PLAID_WATER}}
.map svg{position:absolute;inset:0;width:100%;height:100%}
.tip{position:absolute;white-space:nowrap;padding:13px 18px;border:1px solid #dcdcdc;border-radius:14px;background:rgba(255,255,255,0.95);box-shadow:0 10px 30px -10px rgba(11,37,69,0.45)}
.tip b{display:block;font-size:20px;font-weight:650}.tip strong{display:block;margin-top:2px;font-size:26px;font-weight:750;letter-spacing:-0.02em}.tip span{display:block;margin-top:2px;font-size:14px;color:#3b4f68}
</style></head><body>${body}</body></html>`;

/** Fit a [x, y, w, h] map box into a panel, padded, as a viewBox string. */
function fitView([x, y, w, h], panelW, panelH, pad = 1.06) {
  const s = Math.min(panelW / (w * pad), panelH / (h * pad));
  const vw = panelW / s, vh = panelH / s;
  return { viewBox: `${x + w / 2 - vw / 2} ${y + h / 2 - vh / 2} ${vw} ${vh}`, s, x0: x + w / 2 - vw / 2, y0: y + h / 2 - vh / 2 };
}

// ── CA property tax card ──
function taxCard() {
  const geo = readJson("scripts/seo-data/ca-map-geo.json");
  const pct = (city) => CA_CITY_TAX_INFO[city].pct;
  const breaks = rateBreaks(Object.keys(CA_CITY_COUNTY).map(pct));
  const city = "Berkeley";
  const est = fixedEstimate(city, { default: CA_FIXED_ASSESSMENT_DEFAULT, cities: CA_FIXED_ASSESSMENT_CITIES });
  const t = computeTax({ price: 1000000, ratePct: pct(city), mode: "home", fixed: est.est });
  // Frame the inner Bay Area: the cities' middle 90%, like the page's Bay Area chip.
  const bay = geo.cities.filter((c) => BAY_AREA_COUNTIES.includes(CA_CITY_COUNTY[c.city]));
  const q = (vals, f) => [...vals].sort((a, b) => a - b)[Math.floor(f * (vals.length - 1))];
  const xs = bay.map((c) => c.x), ys = bay.map((c) => c.y);
  const box = [q(xs, 0.1), q(ys, 0.08), q(xs, 0.9) - q(xs, 0.1), q(ys, 0.85) - q(ys, 0.08)];
  const W = 1200 - 600 - 32, H = 630 - 64;
  const v = fitView(box, W, H, 1.0);
  const k = 1 / v.s;
  const sel = geo.cities.find((c) => c.city === city);
  const LABELS = ["San Francisco", "Oakland", "Berkeley", "Richmond", "Hayward", "San Mateo", "San Rafael", "Vallejo", "Fremont", "Walnut Creek"];
  const labels = LABELS.map((n) => geo.cities.find((c) => c.city === n)).filter(Boolean)
    .map((c) => `<text x="${c.x}" y="${c.y + (c.d ? 4 : 16) * k}" font-size="${15 * k}" stroke-width="${3.5 * k}">${esc(c.city)}</text>`).join("");
  const svg = `<svg viewBox="${v.viewBox}" preserveAspectRatio="xMidYMid slice">
<g fill="#f7fcfd">${geo.counties.map((c) => `<path d="${c.d}"/>`).join("")}</g>
<g stroke="#fff" stroke-width="${0.6 * k}">${geo.cities.filter((c) => c.d).map((c) => `<path fill="${SHADES[rateBucket(pct(c.city), breaks)]}" d="${c.d}"/>`).join("")}</g>
<path fill="none" stroke="rgba(11,37,69,0.22)" stroke-width="${1 * k}" d="${geo.counties.map((c) => c.d).join("")}"/>
<path fill="none" stroke="#0b2545" stroke-width="${3 * k}" d="${sel.d}"/>
<g fill="#0b2545" stroke="#fff" paint-order="stroke" stroke-linejoin="round" font-family="Inter" font-weight="600" text-anchor="middle">${labels}</g>
</svg>`;
  return page(`<div class="left">
<div class="brand"><b>Mortgage Blueprint</b><span class="mono">Powered by RealStack</span></div>
<h1>California Property Tax Calculator</h1>
<p class="sub">Every city's rate. The whole bill, in seconds.</p>
<div class="tile"><span class="k mono">Annual property tax</span><strong>${usd2.format(t.annual)}</strong><p class="s">${city} · ${usd0.format(t.price)} home · ${usd2.format(t.monthly)} a month</p></div>
<div class="pill">Look up your tax bill</div>
</div>
<div class="map" style="width:${W}px">${svg}<div class="tip" style="left:22px;bottom:22px"><b>${city}</b><strong>${pct(city).toFixed(4)}%</strong><span>Alameda County · FY ${CA_CITY_TAX_INFO[city].fy}</span></div></div>`);
}

// ── Loan-limit card ──
function limitCard() {
  const geo = readJson("scripts/seo-data/ll-map-geo.json");
  const shade = new Map();
  for (const [st, list] of Object.entries(US_COUNTIES)) {
    for (const c of list) shade.set(c.fips, LL_SHADES[limitBucket(getCountyLimits(st, c.name, 1).highBalance, CONF_BASELINE[1])]);
  }
  const W = 1200 - 600 - 32, H = 630 - 64;
  const v = fitView([0, 0, geo.width, geo.height], W, H, 1.04);
  const k = 1 / v.s;
  const svg = `<svg viewBox="${v.viewBox}">
${geo.insets.map(({ box: [x, y, w, h] }) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${12 * k}" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.5)" stroke-width="${1 * k}" stroke-dasharray="${4 * k} ${4 * k}"/>`).join("")}
<g stroke="rgba(11,37,69,0.12)" stroke-width="${0.35 * k}">${geo.counties.map((c) => `<path fill="${shade.get(c.fips)}" d="${c.d}"/>`).join("")}</g>
<path fill="none" stroke="rgba(11,37,69,0.55)" stroke-width="${0.9 * k}" stroke-linejoin="round" d="${geo.states.map((s) => s.d).join("")}"/>
</svg>`;
  return page(`<div class="left">
<div class="brand"><b>Mortgage Blueprint</b><span class="mono">Powered by RealStack</span></div>
<h1>${LIMIT_YEAR} Conforming Loan Limits</h1>
<p class="sub">Every U.S. county on one map. Conforming, high-balance or jumbo?</p>
<div class="tile stats"><div><span class="k mono">Baseline</span><strong>${usd0.format(CONF_BASELINE[1])}</strong></div><div><span class="k mono">High-cost ceiling</span><strong>${usd0.format(CONF_CEILING[1])}</strong></div></div>
<div class="pill">Check your county's limit</div>
</div>
<div class="map" style="width:${W}px">${svg}</div>`);
}

const tmp = mkdtempSync(join(tmpdir(), "seo-og-"));
for (const [name, html] of [["og-ca-tax", taxCard()], ["og-loan-limits", limitCard()]]) {
  const file = join(tmp, `${name}.html`);
  writeFileSync(file, html);
  const out = join(ROOT, "public", `${name}.png`);
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--allow-file-access-from-files",
    "--window-size=1200,630", "--virtual-time-budget=5000", `--screenshot=${out}`, `file://${file}`], { stdio: "ignore" });
  console.log(`wrote public/${name}.png`);
}
