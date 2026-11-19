// Page model (model.js) -> standalone static HTML, plus the one shared
// stylesheet. No app bundle: these pages must read in full for crawlers that
// never run JS. The CA tax pages' calculator is the one script, and only an
// enhancement: its numbers are pre-rendered here (taxcalc block) and
// /seo/tax-calc.js makes them live and adds the map. Every interpolated string
// goes through esc().

import { LIGHT, DARK } from "../../src/lib/theme.js";
import { BACKGROUNDS } from "../../src/lib/backgrounds.js";
import { FONT, MONO } from "../../src/lib/fonts.js";
import { ORIGIN, FOOTER_TEXT } from "./model.js";
import { computeTax, formatTax, fixedEstimate, EXEMPTION_NAMES, VET_INCOME_LIMIT } from "./tax-calc.client.js";
import { computeLoan, formatLoan, unitLabel } from "./ll-calc.client.js";

export const CSS_PATH = "/seo/seo.css";
export const TAX_CALC_JS = "/seo/tax-calc.js";
export const TAX_DATA_JSON = "/seo/ca-tax-rates.json";
export const TAX_MAP_JS = "/seo/tax-map.js";
export const TAX_MAP_JSON = "/seo/ca-tax-map.json";
export const LL_CALC_JS = "/seo/ll-calc.js";
export const LL_DATA_JSON = "/seo/loan-limits.json";
export const LL_MAP_JS = "/seo/ll-map.js";
export const LL_MAP_JSON = "/seo/ll-map-geo.json";
const OG_IMAGE = `${ORIGIN}/og-image.png`;
// Plaid link-preview cards from scripts/og/build-seo-og.mjs (1200x630).
const OG_TAX = `${ORIGIN}/og-ca-tax.png`;
const OG_LIMITS = `${ORIGIN}/og-loan-limits.png`;
const ogImage = (page) => page.ogImage || (page.path.startsWith("/property-tax/") ? OG_TAX : page.path.startsWith("/loan-limits/") ? OG_LIMITS : OG_IMAGE);
const PLAID_WATER = BACKGROUNDS.find((b) => b.id === "plaid").css;
// The thin rainbow edge on Ops' Plaid primary buttons (loan-pipeline src/theme.js).
const PLAID_EDGE = "conic-gradient(from 210deg, #3DF59A, #18D8E8, #6B7BFF, #F08AE0, #F7A54A, #F5E14A, #3DF59A)";

export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// JSON inside <script type="application/ld+json">: only "</" could break out.
const jsonLd = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

/** Inline segments: string | { href, text } | an array of those. */
function inline(v) {
  if (Array.isArray(v)) return v.map(inline).join("");
  if (v && typeof v === "object") {
    const ext = /^https?:/.test(v.href) && !v.href.startsWith(ORIGIN);
    return `<a href="${esc(v.href)}"${ext ? ' rel="noopener"' : ""}>${esc(v.text)}</a>`;
  }
  return esc(v);
}

function table(b) {
  const head = b.head.map((h, i) => `<th scope="col"${b.num[i] ? ' class="num"' : ""}>${esc(h)}</th>`).join("");
  const rows = b.rows.map((r) => {
    const cells = r.cells.map((c, i) => {
      if (i === 0) {
        const mark = r.mark ? ` <span class="mark">${esc(r.mark)}</span>` : "";
        return `<th scope="row"${b.num[0] ? ' class="num"' : ""}>${inline(c)}${mark}</th>`;
      }
      return `<td${b.num[i] ? ' class="num"' : ""}>${inline(c)}</td>`;
    }).join("");
    return `<tr${r.id ? ` id="${esc(r.id)}"` : ""}${r.mark ? ' class="hl"' : ""}>${cells}</tr>`;
  }).join("\n");
  return `<div class="table-wrap"><table>
<caption>${esc(b.caption)}</caption>
<thead><tr>${head}</tr></thead>
<tbody>
${rows}
</tbody>
</table></div>`;
}

// First screen of every CA tax page: the calculator on the left, led by the home
// price, with the map beside it at the same height. tax-calc.client.js makes it live.
function hubCalc(page, b, crumbs) {
  const est = fixedEstimate(b.city, b.fixedTable);
  const out = formatTax(computeTax({ price: b.price, ratePct: b.pct, mode: "home", fixed: est.est }));
  const live = (key, tag = "span") => `<${tag} data-out="${key}">${esc(out[key])}</${tag}>`;
  return `<form class="hub-stage" data-taxcalc data-src="${TAX_DATA_JSON}" action="#" aria-label="Property tax calculator">
<div class="hub-calc">
<div>
${page.breadcrumbs.length > 2 ? `<nav aria-label="Breadcrumb" class="crumbs"><ol>${crumbs}</ol></nav>\n` : ""}<h1>${esc(page.h1)}</h1>
<p class="hub-intro">${esc(page.intro ?? page.lead)}</p>
</div>
<div class="hub-sheet">
<div class="hub-pick">
<label for="tax-city"><span>City</span> <em data-cityhint></em></label>
<div class="combo">
<span class="hub-box"><svg class="glass" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="7" cy="7" r="4.75" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.6 10.6 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><input id="tax-city" name="city" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="tax-city-list" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Search California cities" value="${esc(b.city)}" /></span>
<ul id="tax-city-list" class="city-list" role="listbox" aria-label="Matching cities" data-citylist hidden></ul>
</div>
</div>
<div class="hub-fields">
<label class="hub-fd wide"><span>Home price</span><span class="hub-box"><i>$</i><input name="price" inputmode="numeric" autocomplete="off" value="${esc(b.price.toLocaleString("en-US"))}" /></span></label>
<label class="hub-fd"><span>City tax rate <small data-fy>FY ${esc(b.fy)}</small></span><span class="hub-box"><input name="rate" inputmode="decimal" autocomplete="off" value="${esc(b.pct.toFixed(4))}" /><i>%</i></span></label>
<label class="hub-fd"><span>Fixed assessments <small>Estimate</small></span><span class="hub-box"><i>$</i><input name="fixed" inputmode="numeric" autocomplete="off" value="${esc(est.est.toLocaleString("en-US"))}" /><i>/yr</i></span></label>
<div class="hub-ex">
<div class="hub-ex-h"><span id="hub-ex-label">Exemption</span>${live("exemption", "b")}</div>
<div class="hub-seg" role="radiogroup" aria-labelledby="hub-ex-label">
<label><input type="radio" name="exemption" value="home" checked /><span>Homeowner</span></label>
<label><input type="radio" name="exemption" value="vet" /><span>Disabled veteran</span></label>
<label><input type="radio" name="exemption" value="none" /><span>None</span></label>
</div>
<div class="hub-vet" data-vetnote hidden>
<label class="hub-sw"><input type="checkbox" name="vetlow" /><u aria-hidden="true"></u>Household income ${esc(`$${VET_INCOME_LIMIT.toLocaleString("en-US")}`)} or less</label>
<p>For 100% disabled veterans, starting with the 2027-28 tax bill. Replaces the homeowners' exemption. Your county assessor confirms eligibility.</p>
</div>
</div>
</div>
<div class="hub-answer">
<div class="hub-stats">
<div class="hub-stat"><span class="k">Annual property tax</span>${live("annual", "strong")}<span class="s">${live("monthly")} a month</span></div>
<div class="hub-stat"><span class="k">True tax rate</span>${live("effective", "strong")}<span class="s">the rate you really pay</span></div>
</div>
<div class="hub-receipt">
<div><i aria-hidden="true"></i><span>Home price</span>${live("price", "b")}</div>
<div><i aria-hidden="true">&minus;</i><span data-exname>${esc(EXEMPTION_NAMES.home)}</span>${live("exemption", "b")}</div>
<div class="st"><i aria-hidden="true">=</i><span>Taxable value</span>${live("taxable", "b")}</div>
<div><i aria-hidden="true">&times;</i><span>City tax rate <span data-ratepct>${esc(b.pct.toFixed(4))}%</span></span>${live("base", "b")}</div>
<div><i aria-hidden="true">+</i><span>Fixed assessments</span>${live("fixed", "b")}</div>
<div class="t"><i aria-hidden="true">=</i><span>Annual property tax</span>${live("annual", "b")}</div>
</div>
</div>
</div>
${b.billUrl ? `<a class="pill hub-bill" data-bill href="${esc(b.billUrl)}" rel="noopener">${esc(b.billLabel)}</a>` : `<a class="pill hub-bill" data-bill hidden href="#" rel="noopener"></a>`}
<p class="hub-note"><span data-fixednote>${esc(est.note)}</span></p>
</div>
<div class="hub-map"><div class="taxmap" data-taxmap data-js="${TAX_MAP_JS}" data-src="${TAX_MAP_JSON}"${b.mapCounty ? ` data-county="${esc(b.mapCounty)}"` : ""}${b.mapRegion ? ` data-region="${esc(b.mapRegion)}"` : ""} hidden></div></div>
</form>`;
}

// The loan-limit pages' first screen: the same stage, with a loan-limit checker
// on the left and the county map on the right. ll-calc.client.js makes it live.
function llCalc(page, b, crumbs) {
  const r = computeLoan({ price: b.price, downPct: b.down, std: b.stds[0], limit: b.limits[0] });
  const out = formatLoan(r);
  const live = (key, tag = "span") => `<${tag} data-out="${key}">${esc(out[key])}</${tag}>`;
  const band = (kind, label) => `<div data-band="${kind}"${r.kind === kind ? ' class="on"' : kind === "high" && !(b.limits[0] > b.stds[0]) ? ' class="off"' : ""}><i aria-hidden="true"></i><span>${esc(label)}</span>${live(kind === "standard" ? "std" : kind, "b")}</div>`;
  return `<form class="hub-stage" data-llcalc data-src="${LL_DATA_JSON}" data-fips="${esc(b.fips)}" data-name="${esc(b.name)}" data-st="${esc(b.st)}" data-std="${esc(JSON.stringify(b.stds))}" data-limits="${esc(JSON.stringify(b.limits))}" data-kind="${r.kind}" action="#" aria-label="Loan limit checker">
<div class="hub-calc">
<div>
${page.breadcrumbs.length > 2 ? `<nav aria-label="Breadcrumb" class="crumbs"><ol>${crumbs}</ol></nav>\n` : ""}<h1>${esc(page.h1)}</h1>
<p class="hub-intro">${esc(page.intro ?? page.lead)}</p>
</div>
<div class="hub-sheet">
<div class="hub-pick">
<label for="ll-county"><span>County</span> <em data-countyhint></em></label>
<div class="combo">
<span class="hub-box"><svg class="glass" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="7" cy="7" r="4.75" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.6 10.6 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><input id="ll-county" name="county" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ll-county-list" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Search counties" value="${esc(`${b.name}, ${b.st}`)}" /></span>
<ul id="ll-county-list" class="city-list" role="listbox" aria-label="Matching counties" data-countylist hidden></ul>
</div>
</div>
<div class="hub-fields">
<div class="hub-ex">
<div class="hub-ex-h"><span id="ll-units-label">Property type</span></div>
<div class="hub-seg ll-units" role="radiogroup" aria-labelledby="ll-units-label">
${[1, 2, 3, 4].map((u) => `<label><input type="radio" name="units" value="${u}"${u === 1 ? " checked" : ""} /><span>${unitLabel(u)}</span></label>`).join("\n")}
</div>
</div>
<label class="hub-fd"><span>Home price</span><span class="hub-box"><i>$</i><input name="price" inputmode="numeric" autocomplete="off" value="${esc(b.price.toLocaleString("en-US"))}" /></span></label>
<label class="hub-fd"><span>Down payment <small>${live("down")}</small></span><span class="hub-box"><input name="down" inputmode="decimal" autocomplete="off" value="${esc(String(b.down))}" /><i>%</i></span></label>
</div>
<div class="hub-answer">
<div class="hub-stats">
<div class="hub-stat"><span class="k">Conforming loan limit</span>${live("limit", "strong")}<span class="s" data-where>${esc(`${unitLabel(1)}, ${b.name}, ${b.st}`)}</span></div>
<div class="hub-stat"><span class="k">Your loan is</span><strong class="ll-kind" data-out="kind">${esc(out.kind)}</strong><span class="s">${live("loan")} loan</span></div>
</div>
<div class="hub-receipt ll-bands">
${band("standard", "Standard conforming")}
${band("high", "High-balance conforming")}
${band("jumbo", "Jumbo")}
<div class="t"><i aria-hidden="true"></i><span>Least down payment to stay conforming</span>${live("mindown", "b")}</div>
</div>
</div>
</div>
<a class="pill hub-bill" data-cta href="${esc(b.app)}">${esc(b.app.includes("?") ? `Run your numbers for ${b.name} in Mortgage Blueprint` : "Run your numbers in Mortgage Blueprint")}</a>
<p class="hub-note">FHFA ${esc(String(b.year))} limits for loans Fannie Mae and Freddie Mac buy. Lenders can add their own rules for high-balance loans.</p>
</div>
<div class="hub-map"><div class="taxmap llmap" data-llmap data-js="${LL_MAP_JS}" data-src="${LL_MAP_JSON}"${b.mapState ? ` data-state="${esc(b.mapState)}"` : ""} hidden></div></div>
</form>`;
}

// Everything under that first screen, using the full page width.
function hubMore(sections) {
  const out = [];
  let grid = [];
  const flush = () => {
    if (grid.length) out.push(`<div class="hub-tables">\n${grid.map(section).join("\n")}\n</div>`);
    grid = [];
  };
  for (const s of sections) {
    if (s.grid) { grid.push(s); continue; }
    flush();
    out.push(s.cards
      ? `<section>\n<h2>${esc(s.heading)}</h2>\n<div class="hub-cards">\n${s.blocks.map((b, i) => `<article class="hub-card"><h3>${esc(s.cards[i])}</h3><p>${inline(b.content)}</p></article>`).join("\n")}\n</div>\n</section>`
      : section(s));
  }
  flush();
  return out.join("\n");
}

function block(b) {
  switch (b.type) {
    case "p": return `<p>${inline(b.content)}</p>`;
    case "table": return table(b);
    case "list": return `<ul>${b.items.map((it) => `<li>${inline(it)}</li>`).join("")}</ul>`;
    case "cta": return `<p class="cta"><a class="pill" href="${esc(b.href)}">${esc(b.text)}</a></p>`;
    default: throw new Error(`seo-data: unknown block type ${b.type}`);
  }
}

function section(s) {
  const h = s.heading ? `<h2>${esc(s.heading)}</h2>\n` : "";
  return `<section>\n${h}${s.blocks.map(block).join("\n")}\n</section>`;
}

/**
 * @param {object} page   one entry of buildSite().pages
 * @param {{ fontHref: string }} opts  the self-hosted font stylesheet index.html loads
 */
export function renderPage(page, { fontHref }) {
  const crumbs = page.breadcrumbs.map((b, i) => {
    const last = i === page.breadcrumbs.length - 1;
    return `<li>${last ? `<span aria-current="page">${esc(b.name)}</span>` : `<a href="${esc(b.path)}">${esc(b.name)}</a>`}</li>`;
  }).join("");
  const hub = page.layout === "taxhub" || page.layout === "llhub";
  const hubBlock = hub ? page.sections[0].blocks[0] : null;
  const main = hub
    ? `<main>
${hubBlock.type === "llcalc" ? llCalc(page, hubBlock, crumbs) : hubCalc(page, hubBlock, crumbs)}
<div class="wrap hub-more">
${page.intro ? `<p class="lead hub-lead">${esc(page.lead)}</p>\n` : ""}${hubMore(page.sections.slice(1))}
</div>
</main>`
    : `<main class="wrap">
<nav aria-label="Breadcrumb" class="crumbs"><ol>${crumbs}</ol></nav>
<h1>${esc(page.h1)}</h1>
<p class="lead">${esc(page.lead)}</p>
${page.sections.map(section).join("\n")}
</main>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="${esc(page.url)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Mortgage Blueprint" />
<meta property="og:title" content="${esc(page.shareTitle || page.title)}" />
<meta property="og:description" content="${esc(page.description)}" />
<meta property="og:url" content="${esc(page.url)}" />
<meta property="og:image" content="${esc(ogImage(page))}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${esc(page.shareTitle || page.title)}, with a map" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(page.shareTitle || page.title)}" />
<meta name="twitter:description" content="${esc(page.description)}" />
<meta name="twitter:image" content="${esc(ogImage(page))}" />
${hub ? '<meta name="theme-color" content="#e8f2f9" />' : `<meta name="theme-color" content="${DARK.bg}" media="(prefers-color-scheme: dark)" />
<meta name="theme-color" content="${LIGHT.bg}" media="(prefers-color-scheme: light)" />`}
<link rel="icon" href="/icons/favicon.ico" sizes="16x16 32x32 64x64" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<link rel="stylesheet" href="${esc(fontHref)}" />
<link rel="stylesheet" href="${CSS_PATH}" />
<script defer src="/va.js"></script>
${page.jsonLd.map((o) => `<script type="application/ld+json">${jsonLd(o)}</script>`).join("\n")}
${page.sections.some((x) => x.blocks.some((b) => b.type === "taxcalc")) ? `<script type="module" src="${TAX_CALC_JS}"></script>\n` : ""}${page.sections.some((x) => x.blocks.some((b) => b.type === "llcalc")) ? `<script type="module" src="${LL_CALC_JS}"></script>\n` : ""}</head>
<body${hub ? ` class="taxhub${page.layout === "llhub" ? " llhub" : ""}"` : ""}>
<header class="site">
<div class="wrap bar">
${hub ? '<a class="hub-brand" href="/"><span class="wordmark">Mortgage Blueprint</span><span class="badge">POWERED BY REALSTACK</span></a>' : '<a class="wordmark" href="/">Mortgage Blueprint</a>'}
<nav aria-label="Site"><a href="/loan-limits/">Loan limits</a><a href="/property-tax/california/">CA property tax</a><a href="/">Open the app</a></nav>
</div>
</header>
${main}
<footer class="site">
<div class="wrap">
<a class="wordmark" href="/">Mortgage Blueprint</a>
${hub ? "" : '<div class="badge">POWERED BY REALSTACK</div>\n'}<p>${esc(FOOTER_TEXT)}</p>
<p class="legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></p>
</div>
</footer>
</body>
</html>
`;
}

/** The shared stylesheet: theme.js tokens as custom properties, light by default, dark by media query. */
export function renderCss() {
  const vars = (t) => [
    ["bg", t.bg], ["card", t.card], ["border", t.cardBorder], ["sep", t.separator],
    ["text", t.text], ["text2", t.textSecondary], ["text3", t.textTertiary],
    ["accent", t.accent], ["accent-hover", t.accentHover], ["pill", t.pillBg], ["hl", t.warningBg],
    ["input-bg", t.inputBg], ["input-border", t.inputBorder],
    // Grange blue is ~4:1 on navy; dark-mode text links use the lighter hover tone.
    ["link", t === DARK ? t.accentHover : t.accent],
    // Map: one blue, light to dark for a rising rate; dark mode runs its own steps the other way, dim to bright.
    ...(t === DARK
      ? [["map-water", "#0d1524"], ["map-land", "#1a2740"], ["map-land-hover", "#22314e"], ["map-line", "rgba(255,255,255,0.28)"],
         ["q0", "#2f4a8f"], ["q1", "#3f66c9"], ["q2", "#5f86f7"], ["q3", "#93adfa"], ["q4", "#cfdcff"]]
      : [["map-water", "#f4f9fc"], ["map-land", "#e6ebf2"], ["map-land-hover", "#dbe2ec"], ["map-line", "rgba(16,27,46,0.32)"],
         ["q0", "#b9ccfb"], ["q1", "#88a8f9"], ["q2", "#3b6bf5"], ["q3", "#2448b8"], ["q4", "#132a73"]]),
  ].map(([k, v]) => `  --${k}: ${v};`).join("\n");
  return `/* GENERATED by scripts/seo-data-pages.mjs from src/lib/theme.js + fonts.js. */
:root {
${vars(LIGHT)}
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
${vars(DARK)}
  }
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font-family: ${FONT}; font-size: 16px; line-height: 1.6;
}
.wrap { max-width: 760px; margin: 0 auto; padding: 0 16px; }
a { color: var(--link); text-underline-offset: 2px; }
a:hover { color: var(--accent-hover); }
header.site { border-bottom: 1px solid var(--sep); background: var(--card); }
header.site .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 16px; padding-top: 12px; padding-bottom: 12px; }
.wordmark { font-weight: 700; color: var(--text); text-decoration: none; letter-spacing: -0.01em; }
header.site nav { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 14px; }
header.site nav a { color: var(--text2); text-decoration: none; }
header.site nav a:hover { color: var(--accent); }
.crumbs ol { list-style: none; margin: 20px 0 0; padding: 0; display: flex; flex-wrap: wrap; font-size: 13px; color: var(--text3); }
.crumbs li + li::before { content: "/"; margin: 0 8px; color: var(--text3); }
.crumbs a { color: var(--text2); text-decoration: none; }
h1 { font-size: 30px; line-height: 1.2; letter-spacing: -0.02em; margin: 12px 0 12px; }
h2 { font-size: 20px; line-height: 1.3; margin: 36px 0 10px; }
.lead { font-size: 18px; color: var(--text); margin: 0 0 8px; }
p, ul { color: var(--text2); }
ul { padding-left: 20px; }
li { margin: 4px 0; }
.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 12px 0; border: 1px solid var(--border); border-radius: 12px; background: var(--card); }
table { border-collapse: collapse; width: 100%; font-size: 15px; font-variant-numeric: tabular-nums; }
caption { caption-side: top; text-align: left; padding: 10px 14px 6px; font-size: 13px; color: var(--text3); }
th, td { padding: 8px 14px; text-align: left; border-top: 1px solid var(--sep); white-space: nowrap; }
thead th { border-top: 0; font-size: 13px; font-weight: 600; color: var(--text3); }
tbody th { font-weight: 500; color: var(--text); }
td { color: var(--text); }
.num { text-align: right; }
tr.hl { background: var(--hl); }
tr:target { outline: 2px solid var(--accent); outline-offset: -2px; }
.mark { display: inline-block; margin-left: 6px; padding: 1px 8px; border-radius: 9999px; background: var(--pill); font-size: 11px; font-weight: 600; color: var(--text2); vertical-align: 1px; }
.cta { margin: 32px 0; }
.pill { display: inline-block; padding: 12px 22px; border-radius: 9999px; background: var(--accent); color: #fff; font-weight: 600; text-decoration: none; }
.pill:hover { background: var(--accent-hover); color: #fff; }
.combo { position: relative; }
.combo .glass { flex: none; margin-right: 4px; color: var(--text3); }
.city-list { position: absolute; z-index: 20; top: calc(100% + 4px); left: 0; right: 0; max-height: 300px; overflow-y: auto; margin: 0; padding: 4px; list-style: none; border: 1px solid var(--border); border-radius: 12px; background: var(--card); box-shadow: 0 10px 28px rgba(10, 17, 32, 0.18); }
.city-list[hidden] { display: none; }
.city-list li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0 12px; margin: 0; padding: 7px 10px; border-radius: 8px; font-size: 15px; line-height: 1.35; color: var(--text); cursor: pointer; }
.city-list li .sub { grid-row: 2; font-size: 12px; color: var(--text3); }
.city-list li .pct { grid-column: 2; grid-row: 1 / span 2; align-self: center; font-variant-numeric: tabular-nums; color: var(--text2); }
.city-list li[aria-selected="true"], .city-list li[role="option"]:hover { background: var(--pill); }
.city-list li.none { display: block; font-size: 14px; color: var(--text2); cursor: default; }
.taxmap[hidden] { display: none; }
.m-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.m-chip { font: inherit; font-size: 13px; padding: 5px 12px; border-radius: 9999px; border: 1px solid var(--input-border); background: transparent; color: var(--text2); cursor: pointer; }
.m-chip:hover { color: var(--text); background: var(--pill); }
.m-chip[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: #fff; }
.m-frame { position: relative; height: 540px; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: var(--map-water); }
.m-frame svg { display: block; width: 100%; height: 100%; user-select: none; -webkit-user-select: none; }
.m-frame svg.can-pan { cursor: grab; }
.m-land path { fill: var(--map-land); }
.m-land path:hover { fill: var(--map-land-hover); }
.m-lines { fill: none; stroke: var(--map-line); stroke-width: 0.75px; vector-effect: non-scaling-stroke; pointer-events: none; }
.m-cities path { stroke: var(--card); stroke-width: 0.5px; vector-effect: non-scaling-stroke; cursor: pointer; }
.m-dots circle { stroke: var(--card); stroke-width: 1px; vector-effect: non-scaling-stroke; cursor: pointer; }
.m-frame .q0, .m-key .q0 { fill: var(--q0); background: var(--q0); }
.m-frame .q1, .m-key .q1 { fill: var(--q1); background: var(--q1); }
.m-frame .q2, .m-key .q2 { fill: var(--q2); background: var(--q2); }
.m-frame .q3, .m-key .q3 { fill: var(--q3); background: var(--q3); }
.m-frame .q4, .m-key .q4 { fill: var(--q4); background: var(--q4); }
.m-hover, .m-sel, .m-county-hover { fill: none; vector-effect: non-scaling-stroke; pointer-events: none; }
.m-county-hover { stroke: var(--text3); stroke-width: 1.25px; }
.m-focus { fill: none; stroke: var(--text2); stroke-width: 1.5px; vector-effect: non-scaling-stroke; pointer-events: none; }
.m-hover { stroke: var(--text); stroke-width: 1.5px; }
.m-sel { stroke: var(--text); stroke-width: 2.25px; }
.m-sel-dot { fill: none; stroke: var(--text); stroke-width: 2px; vector-effect: non-scaling-stroke; pointer-events: none; }
.m-sel-dot[hidden] { display: none; }
.m-labels { pointer-events: none; }
.m-labels text { text-anchor: middle; fill: var(--text); stroke: var(--card); paint-order: stroke; stroke-linejoin: round; font-weight: 500; }
.m-labels text.on { font-weight: 700; }
.m-tip { position: absolute; z-index: 10; display: flex; flex-direction: column; max-width: 240px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--card); box-shadow: 0 6px 20px rgba(10, 17, 32, 0.18); font-size: 12px; line-height: 1.4; color: var(--text2); pointer-events: none; }
.m-tip[hidden] { display: none; }
.m-tip strong { font-size: 14px; font-weight: 600; color: var(--text); }
.m-tip-rate { font-size: 15px; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
.m-zoom { position: absolute; top: 10px; right: 10px; display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--card); }
.m-zoom button { width: 36px; height: 36px; border: 0; background: transparent; font: inherit; font-size: 18px; line-height: 1; color: var(--text); cursor: pointer; }
.m-zoom button + button { border-top: 1px solid var(--sep); }
.m-zoom button:hover { background: var(--pill); }
.m-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; margin-top: 10px; font-size: 12px; color: var(--text2); font-variant-numeric: tabular-nums; }
.m-legend-title { font-weight: 600; color: var(--text); }
.m-key { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.m-key i { width: 12px; height: 12px; border-radius: 3px; }
.m-strip { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 24px; min-height: 58px; margin-top: 10px; padding: 10px 14px; border-radius: 10px; background: var(--input-bg); font-size: 13px; color: var(--text2); }
.m-strip strong { display: block; font-size: 15px; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
.m-who span, .m-rate span { display: block; font-size: 12px; color: var(--text2); }
.m-who, .m-rate { line-height: 1.35; }
.m-hint { font-size: 13px; }
@media (hover: none) { .m-land path:hover { fill: var(--map-land); } }
@media (max-width: 560px) {
  .m-frame { height: 420px; }
  .m-chips { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .m-chip { flex: none; }
}
footer.site { margin-top: 48px; border-top: 1px solid var(--sep); padding: 24px 0 40px; font-size: 13px; }
footer.site p { color: var(--text3); }
.badge { font-family: ${MONO}; font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--text3); margin-top: 2px; }
.legal a { margin-right: 16px; color: var(--text2); }
@media (max-width: 480px) {
  h1 { font-size: 25px; }
  .lead { font-size: 17px; }
  th, td { padding: 8px 10px; }
}
/* CA tax pages: the math on the left, the map on the right, in RealStack Ops' Plaid theme (loan-pipeline src/theme.js). Light only, on every device. */
.taxhub { color-scheme: light; --hub-head: 59px; --hub-gut: 24px; --hub-screen: clamp(640px, calc(100vh - var(--hub-head) - 36px), 820px); --hub-ink: #0b2545; --hub-tile: linear-gradient(160deg, #d9f7fa 0%, #eaf3fd 55%, #efe8fc 100%); --bg: #fff; --card: #fff; --border: #dcdcdc; --sep: #ececec; --text: #111; --text2: #555; --text3: #6e6e6e; --accent: #088181; --accent-hover: #066a6a; --link: #088181; --pill: #f2f2f2; --hl: ${LIGHT.warningBg}; --input-bg: #f5f5f5; --input-border: #dcdcdc; }
.taxhub header.site { background: rgba(232, 242, 249, 0.88); }
.taxhub .wordmark, .taxhub header.site nav a, .hub-calc h1, .hub-more h2, .hub-card h3 { color: var(--hub-ink); }
.taxhub header.site nav a:hover { color: var(--accent); }
.taxhub .wrap { max-width: none; padding-left: var(--hub-gut); padding-right: var(--hub-gut); }
.taxhub header.site .bar { min-height: var(--hub-head); padding-top: 8px; padding-bottom: 8px; }
.hub-brand { display: flex; flex-direction: column; line-height: 1.15; text-decoration: none; }
.hub-brand .badge { margin-top: 3px; font-size: 9px; }
.hub-stage { display: grid; grid-template-columns: minmax(470px, 37%) minmax(0, 1fr); gap: 20px; padding: 16px var(--hub-gut) 20px; }
.hub-stage.no-map { grid-template-columns: minmax(0, 640px); justify-content: center; }
.hub-stage.no-map .hub-map { display: none; }
.hub-calc { display: flex; flex-direction: column; gap: 10px; min-width: 0; min-height: var(--hub-screen); }
.hub-calc h1 { margin: 2px 0 0; font-size: 31px; line-height: 1.12; letter-spacing: -0.025em; }
.hub-calc .crumbs ol { margin: 0 0 4px; font-size: 12px; }
.hub-intro { margin: 5px 0 0; font-size: 15px; line-height: 1.4; }
.hub-sheet { flex: 1; display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 20px; background: var(--card); box-shadow: 0 1px 2px rgba(11, 37, 69, 0.05), 0 14px 32px -16px rgba(11, 37, 69, 0.28); }
.hub-pick { padding: 11px 16px 10px; border-bottom: 1px solid var(--sep); }
.hub-pick label { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 5px; font-size: 13px; font-weight: 600; }
.hub-pick label em { font-style: normal; font-size: 12px; font-weight: 400; color: var(--text3); }
.hub-box { display: flex; align-items: center; gap: 4px; height: 38px; padding: 0 11px; border: 1px solid var(--input-border); border-radius: 10px; background: var(--input-bg); }
.hub-box:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(16, 208, 183, 0.28); }
.hub-box i { font-style: normal; font-size: 14px; color: var(--text3); }
.hub-box input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; font-size: 16px; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
.hub-pick .hub-box { height: 44px; }
.hub-pick .hub-box input { font-size: 18px; }
.hub-box .glass { flex: none; margin-right: 5px; color: var(--text3); }
.hub-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; padding: 11px 16px 10px; }
.hub-fd { display: flex; flex-direction: column; justify-content: space-between; gap: 5px; min-width: 0; font-size: 12.5px; font-weight: 600; color: var(--text2); }
.hub-fd.wide { grid-column: 1 / -1; }
.hub-fd small { margin-left: 3px; font-size: 12px; font-weight: 400; color: var(--text3); }
.hub-fd .hub-box { height: 42px; padding: 0 12px; background: var(--card); }
.hub-fd .hub-box input { font-size: 18px; font-weight: 650; }
.hub-fd.wide .hub-box { height: 46px; }
.hub-fd.wide .hub-box input { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.hub-ex { grid-column: 1 / -1; }
.hub-ex-h { display: flex; justify-content: space-between; align-items: baseline; font-size: 12.5px; font-weight: 600; color: var(--text2); font-variant-numeric: tabular-nums; }
.hub-ex-h b { font-size: 13px; font-weight: 650; color: var(--text); }
.hub-seg { display: grid; grid-template-columns: 1.1fr 1.25fr 0.7fr; gap: 3px; margin-top: 5px; padding: 3px; border-radius: 9999px; background: var(--input-bg); }
.hub-seg label { position: relative; display: block; cursor: pointer; }
.hub-seg input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.hub-seg span { display: block; padding: 6px 4px; border-radius: 9999px; font-size: 12.5px; font-weight: 600; color: var(--text2); text-align: center; white-space: nowrap; }
.hub-seg input:checked + span { background: var(--accent); color: #fff; }
.hub-seg input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px; }
.hub-vet { margin-top: 8px; padding: 8px 10px; border-radius: 10px; background: #e2f7f3; }
.hub-vet[hidden] { display: none; }
.hub-vet .hub-sw { font-size: 12.5px; font-weight: 600; color: var(--text); }
.hub-vet p { margin: 4px 0 0; font-size: 12px; line-height: 1.35; color: var(--text2); }
.hub-sw { position: relative; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
.hub-sw input { position: absolute; opacity: 0; width: 28px; height: 16px; margin: 0; cursor: pointer; }
.hub-sw u { position: relative; flex: none; width: 28px; height: 16px; border-radius: 9999px; background: var(--input-border); transition: background 0.15s; }
.hub-sw u::after { content: ""; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: transform 0.15s; }
.hub-sw input:checked + u { background: var(--accent); }
.hub-sw input:checked + u::after { transform: translateX(12px); }
.hub-sw input:focus-visible + u { outline: 2px solid var(--accent); outline-offset: 2px; }
.hub-answer { flex: 1; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; margin: 0 8px 8px; padding: 12px 18px 10px; border: 1px solid rgba(8, 129, 129, 0.14); border-radius: 12px; color: var(--hub-ink); background: var(--hub-tile); }
.hub-stats { flex: 1; display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); align-items: center; gap: 14px; }
.hub-stat + .hub-stat { padding-left: 16px; border-left: 1px solid rgba(11, 37, 69, 0.16); }
.hub-stat .k { display: block; font-family: ${MONO}; font-size: 10px; letter-spacing: 0.13em; text-transform: uppercase; color: var(--accent-hover); }
.hub-stat strong { display: block; margin-top: 3px; font-size: 34px; line-height: 1.08; font-weight: 700; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.hub-stat .s { display: block; margin-top: 3px; font-size: 13px; color: #3b4f68; font-variant-numeric: tabular-nums; }
.hub-receipt { padding-top: 6px; border-top: 1px solid rgba(11, 37, 69, 0.16); font-size: 13px; color: #33465e; font-variant-numeric: tabular-nums; }
.hub-receipt > div { display: grid; grid-template-columns: 16px minmax(0, 1fr) auto; align-items: baseline; gap: 4px; padding: 2px 0; }
.hub-receipt i { font-style: normal; color: var(--accent); }
.hub-receipt b { font-weight: 500; color: var(--hub-ink); }
.hub-receipt .st, .hub-receipt .st b { font-weight: 600; color: var(--hub-ink); }
.hub-receipt .t { margin-top: 3px; padding-top: 6px; border-top: 1px solid rgba(11, 37, 69, 0.16); font-weight: 700; color: var(--hub-ink); }
.hub-receipt .t b { font-weight: 700; color: var(--hub-ink); }
.hub-bill { display: block; padding: 12px 20px; border: 1.5px solid transparent; background: linear-gradient(#111, #111) padding-box, ${PLAID_EDGE} border-box; font-size: 16px; line-height: 1.3; text-align: center; }
.hub-bill:hover { background: linear-gradient(#2b2b2b, #2b2b2b) padding-box, ${PLAID_EDGE} border-box; }
.hub-bill[hidden] { display: none; }
.hub-note { margin: 0 2px; font-size: 12px; line-height: 1.4; color: var(--text3); }
.hub-map { position: relative; min-width: 0; border-radius: 20px; background: ${PLAID_WATER}; }
.taxhub .taxmap { position: relative; height: 100%; --map-land: #f7fcfd; --map-land-hover: #e9f7f8; --map-line: rgba(11, 37, 69, 0.22); --hub-glass: rgba(255, 255, 255, 0.92); --text: var(--hub-ink); --text2: #3b4f68; --q0: #b5ece4; --q1: #55d6c4; --q2: #0fa9a5; --q3: #0a78cc; --q4: #0b3f94; }
.taxhub .taxmap:empty { height: 100%; }
@media (min-width: 1081px) { .taxhub .taxmap { position: absolute; inset: 0; height: auto; } }
.taxhub .m-frame { height: 100%; border-color: transparent; border-radius: 20px; background: ${PLAID_WATER}; }
.taxhub .m-chips { position: absolute; z-index: 6; top: 14px; left: 14px; right: 62px; gap: 5px; margin: 0; }
.taxhub .m-chip { padding: 5px 11px; border-color: var(--border); background: var(--hub-glass); color: var(--text); font-size: 12.5px; font-weight: 500; white-space: nowrap; -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.taxhub .m-chip:hover { background: #fff; }
.taxhub .m-chip[aria-pressed="true"] { border-color: var(--accent); background: var(--accent); color: #fff; }
.taxhub .m-zoom { top: 14px; right: 14px; background: var(--hub-glass); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.taxhub .m-legend, .taxhub .m-strip { position: absolute; z-index: 6; left: 14px; width: 164px; margin: 0; padding: 11px 13px; border: 1px solid var(--border); border-radius: 12px; background: var(--hub-glass); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.taxhub .m-legend { bottom: 14px; flex-direction: column; align-items: flex-start; gap: 5px; }
.taxhub .m-legend-title { margin-bottom: 1px; font-family: ${MONO}; font-size: 10px; font-weight: 500; letter-spacing: 0.13em; text-transform: uppercase; color: var(--text2); }
.taxhub .m-strip { bottom: 186px; flex-direction: column; flex-wrap: nowrap; align-items: flex-start; gap: 6px; min-height: 0; }
.hub-lead { max-width: 92ch; margin: 18px 0 0; font-size: 16px; line-height: 1.5; }
.hub-more h2 { margin: 26px 0 12px; font-size: 22px; letter-spacing: -0.015em; }
.hub-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; }
.hub-card { padding: 16px 18px; border: 1px solid rgba(8, 129, 129, 0.14); border-radius: 20px; background: var(--hub-tile); }
.hub-card h3 { margin: 0 0 6px; font-size: 15px; line-height: 1.3; }
.hub-card p { margin: 0; font-size: 14px; line-height: 1.5; color: #33465e; }
.hub-tables { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 520px), 1fr)); gap: 12px 16px; align-items: start; }
.hub-tables h2 { margin-top: 10px; font-size: 17px; }
.hub-tables p { font-size: 14px; }
.hub-tables .table-wrap { max-height: 420px; overflow: auto; margin: 0; border-radius: 20px; scrollbar-gutter: stable; }
/* macOS hides overlay scroll bars until you scroll, so a capped table looked complete. A styled bar opts out of overlay mode and stays visible. */
.hub-tables .table-wrap::-webkit-scrollbar { width: 12px; height: 12px; }
.hub-tables .table-wrap::-webkit-scrollbar-track { background: #eef3f5; border-radius: 0 20px 20px 0; }
.hub-tables .table-wrap::-webkit-scrollbar-thumb { background: #9fb3bf; border: 3px solid #eef3f5; border-radius: 9999px; }
.hub-tables .table-wrap::-webkit-scrollbar-thumb:hover { background: #088181; }
.hub-tables .table-wrap::-webkit-scrollbar-corner { background: transparent; }
@supports not selector(::-webkit-scrollbar) { .hub-tables .table-wrap { scrollbar-width: auto; scrollbar-color: #9fb3bf #eef3f5; } }
.hub-tables thead th { position: sticky; top: 0; z-index: 1; background: var(--card); box-shadow: inset 0 -1px 0 var(--sep); }
.hub-tables caption { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.hub-tables table { font-size: 13.5px; }
/* Loan-limit pages: the same stage, with the checker's own pieces. */
.ll-units { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.llhub .hub-fd .hub-box input { font-size: 20px; }
.ll-kind { font-size: 26px !important; line-height: 1.12 !important; }
.ll-bands > div { color: #33465e; }
.ll-bands i { align-self: center; width: 8px; height: 8px; border-radius: 50%; }
.ll-bands .on, .ll-bands .on b { font-weight: 650; color: var(--hub-ink); }
.ll-bands .on i { background: var(--accent); box-shadow: 0 0 0 3px rgba(16, 208, 183, 0.25); }
.ll-bands .off, .ll-bands .off b { color: #8a98a8; }
.ll-bands .t i { visibility: hidden; }
.llmap { --q0: #e4f6f3; }
@media (min-width: 561px) {
  .llhub .m-legend, .llhub .m-strip { width: 204px; }
  .llhub .m-strip { bottom: 172px; }
}
.taxhub .m-state { padding-right: 30px; -webkit-appearance: none; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%230b2545' stroke-width='1.5'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; cursor: pointer; }
.taxhub .m-state.on { border-color: var(--accent); background-color: var(--accent); color: #fff; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23fff' stroke-width='1.5'/%3E%3C/svg%3E"); }
.hub-tables ul:has(> li:nth-child(13)) { columns: 3 170px; column-gap: 24px; }
.hub-tables ul:has(> li:nth-child(13)) li { break-inside: avoid; }
.m-ctx { fill: #edf3f6; stroke: rgba(11, 37, 69, 0.14); stroke-width: 0.75px; vector-effect: non-scaling-stroke; pointer-events: none; }
.m-inset { fill: rgba(255, 255, 255, 0.35); stroke: rgba(11, 37, 69, 0.22); stroke-width: 1px; stroke-dasharray: 4 4; vector-effect: non-scaling-stroke; pointer-events: none; }
.m-counties path { stroke: rgba(11, 37, 69, 0.2); stroke-width: 0.5px; vector-effect: non-scaling-stroke; cursor: pointer; }
.m-states { fill: none; stroke: rgba(11, 37, 69, 0.6); stroke-width: 1.25px; vector-effect: non-scaling-stroke; pointer-events: none; stroke-linejoin: round; }
@media (min-width: 1081px) and (min-height: 980px) {
  .hub-fields { gap: 14px; padding: 16px 16px 15px; }
  .hub-fd .hub-box { height: 48px; }
  .hub-fd.wide .hub-box { height: 56px; }
  .hub-fd.wide .hub-box input { font-size: 27px; }
  .hub-stat .k { font-size: 11px; }
  .hub-stat strong { font-size: 40px; }
  .hub-stat .s { font-size: 14px; }
}
@media (scripting: none) {
  .hub-stage { grid-template-columns: minmax(0, 640px); justify-content: center; }
  .hub-map { display: none; }
}
@media (max-width: 1080px) {
  .hub-stage { grid-template-columns: minmax(0, 1fr); }
  .hub-calc { min-height: 0; }
  .hub-map { height: 620px; }
}
@media (max-width: 560px) {
  .taxhub { --hub-gut: 16px; }
  .hub-calc h1 { font-size: 27px; }
  .hub-fd small { display: block; margin-left: 0; }
  .hub-stat strong { font-size: 28px; }
  .hub-map { height: auto; min-height: 480px; overflow: hidden; }
  .taxhub .taxmap { height: auto; padding-bottom: 10px; }
  .taxhub .m-frame { height: 480px; border: 0; border-radius: 0; }
  .taxhub .m-chips { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
  .taxhub .m-legend, .taxhub .m-strip { position: static; width: auto; margin: 10px 10px 0; -webkit-backdrop-filter: none; backdrop-filter: none; }
  .taxhub .m-legend { flex-direction: row; flex-wrap: wrap; gap: 5px 12px; }
  .taxhub .m-legend-title { width: 100%; }
  .taxhub .m-strip { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 6px 18px; }
}
`;
}
