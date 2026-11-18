// Page model (model.js) -> standalone static HTML, plus the one shared
// stylesheet. No app bundle: these pages must read in full for crawlers that
// never run JS. The CA tax pages' calculator is the one script, and only an
// enhancement: its numbers are pre-rendered here (taxcalc block) and
// /seo/tax-calc.js makes them live, adding the map on the hub and county pages. Every
// interpolated string goes through esc().

import { LIGHT, DARK } from "../../src/lib/theme.js";
import { FONT, MONO } from "../../src/lib/fonts.js";
import { ORIGIN, FOOTER_TEXT } from "./model.js";
import { computeTax, formatTax, fixedEstimate, HOMEOWNERS_EXEMPTION } from "./tax-calc.client.js";

export const CSS_PATH = "/seo/seo.css";
export const TAX_CALC_JS = "/seo/tax-calc.js";
export const TAX_DATA_JSON = "/seo/ca-tax-rates.json";
export const TAX_MAP_JS = "/seo/tax-map.js";
export const TAX_MAP_JSON = "/seo/ca-tax-map.json";
const OG_IMAGE = `${ORIGIN}/og-image.png`;

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

// Property-tax calculator, pre-filled for one city (see tax-calc.client.js).
function taxCalc(b) {
  const est = fixedEstimate(b.city, b.fixedTable);
  const out = formatTax(computeTax({ price: b.price, ratePct: b.pct, primary: true, fixed: est.est }));
  const live = (key) => `<span data-out="${key}">${esc(out[key])}</span>`;
  const row = (label, key, strong) =>
    `<tr${strong ? ' class="total"' : ""}><th scope="row">${esc(label)}</th><td class="num" data-out="${key}">${esc(out[key])}</td></tr>`;
  return `<form class="calc" data-taxcalc data-src="${TAX_DATA_JSON}" action="#" aria-label="Property tax calculator">
<div class="calc-in">
<div class="f wide">
<label for="tax-city"><span>City</span> <em data-cityhint></em></label>
<div class="combo">
<span class="box"><svg class="glass" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><circle cx="7" cy="7" r="4.75" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.6 10.6 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><input id="tax-city" name="city" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="tax-city-list" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Search California cities" value="${esc(b.city)}" /></span>
<ul id="tax-city-list" class="city-list" role="listbox" aria-label="Matching cities" data-citylist hidden></ul>
</div>
</div>
${b.map ? `<div class="taxmap" data-taxmap data-js="${TAX_MAP_JS}" data-src="${TAX_MAP_JSON}"${b.mapCounty ? ` data-county="${esc(b.mapCounty)}"` : ""} hidden></div>\n` : ""}<label class="f"><span>Home price</span><span class="box"><i>$</i><input name="price" inputmode="numeric" autocomplete="off" value="${esc(b.price.toLocaleString("en-US"))}" /></span></label>
<label class="f"><span>City tax rate <em data-fy>FY ${esc(b.fy)}</em></span><span class="box"><input name="rate" inputmode="decimal" autocomplete="off" value="${esc(b.pct.toFixed(4))}" /><i>%</i></span></label>
<label class="f"><span>Fixed assessments <em>estimate</em></span><span class="box"><i>$</i><input name="fixed" inputmode="numeric" autocomplete="off" value="${esc(est.est.toLocaleString("en-US"))}" /><i>/yr</i></span></label>
<label class="chk"><input type="checkbox" name="primary" checked /> Primary residence (${esc(`$${HOMEOWNERS_EXEMPTION.toLocaleString("en-US")}`)} homeowners' exemption)</label>
<p class="hint">Fixed assessments are the Mello-Roos, parcel taxes and special assessments on the property's tax bill. <span data-fixednote>${esc(est.note)}</span></p>
<p class="bill-cta">${b.billUrl ? `<a class="pill" data-bill href="${esc(b.billUrl)}" rel="noopener">${esc(b.billLabel)}</a>` : `<a class="pill" data-bill hidden href="#" rel="noopener"></a>`}</p>
</div>
<div class="calc-hero">
<div class="calc-stat"><span class="k">Annual property tax</span><strong data-out="annual">${esc(out.annual)}</strong><span class="s">${live("monthly")} a month</span></div>
<div class="calc-stat"><span class="k">True tax rate</span><strong data-out="effective">${esc(out.effective)}</strong><span class="s">the rate you really pay</span></div>
</div>
<p class="calc-why">Your true tax rate counts the whole bill, not just the city rate. On a newly purchased home: (${live("base")} at the city rate + ${live("fixed")} in fixed assessments) &divide; ${live("price")} purchase price.</p>
<div class="table-wrap"><table class="calc-out">
<caption>How that adds up</caption>
<tbody>
${row("Home exemption", "exemption")}
${row("Taxable value", "taxable")}
${row("Tax at the city rate", "base")}
${row("Fixed assessments", "fixed")}
${row("Annual property tax", "annual", true)}
</tbody>
</table></div>
</form>`;
}

// First screen of the CA tax hub and county pages: the calculator written out as
// the math on the left, with the map pinned beside it. Same fields and data-out
// cells as taxCalc, so tax-calc.client.js drives both.
function hubCalc(page, b, crumbs) {
  const est = fixedEstimate(b.city, b.fixedTable);
  const out = formatTax(computeTax({ price: b.price, ratePct: b.pct, primary: true, fixed: est.est }));
  const live = (key, tag = "span") => `<${tag} data-out="${key}">${esc(out[key])}</${tag}>`;
  const row = (op, label, value, cls = "") =>
    `<div class="hub-row${cls}"><span class="hub-op" aria-hidden="true">${op}</span><span class="hub-lab">${label}</span>${value}</div>`;
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
<div class="hub-ledger">
${row("", "Home price", `<span class="hub-box"><i>$</i><input name="price" aria-label="Home price" inputmode="numeric" autocomplete="off" value="${esc(b.price.toLocaleString("en-US"))}" /></span>`)}
${row("&minus;", `Homeowners' exemption<small><label><input type="checkbox" name="primary" checked /> Primary residence</label></small>`, `<span class="hub-val" data-out="exemption">${esc(out.exemption)}</span>`)}
${row("&times;", `City tax rate<small data-fy>FY ${esc(b.fy)}</small>`, `<span class="hub-box"><input name="rate" aria-label="City tax rate" inputmode="decimal" autocomplete="off" value="${esc(b.pct.toFixed(4))}" /><i>%</i></span>`)}
${row("=", "Tax at the city rate", `<span class="hub-val" data-out="base">${esc(out.base)}</span>`, " sub")}
${row("+", "Fixed assessments<small>Estimate</small>", `<span class="hub-box"><i>$</i><input name="fixed" aria-label="Fixed assessments per year" inputmode="numeric" autocomplete="off" value="${esc(est.est.toLocaleString("en-US"))}" /><i>/yr</i></span>`)}
</div>
<div class="hub-answer">
<div class="hub-stats">
<div class="hub-stat"><span class="k">Annual property tax</span>${live("annual", "strong")}<span class="s">${live("monthly")} a month</span></div>
<div class="hub-stat"><span class="k">True tax rate</span>${live("effective", "strong")}<span class="s">the rate you really pay</span></div>
</div>
<p class="hub-proof">(${live("base")} city tax + ${live("fixed")} fixed) &divide; ${live("price")} price = ${live("effective", "b")}</p>
</div>
</div>
${b.billUrl ? `<a class="pill hub-bill" data-bill href="${esc(b.billUrl)}" rel="noopener">${esc(b.billLabel)}</a>` : `<a class="pill hub-bill" data-bill hidden href="#" rel="noopener"></a>`}
<p class="hub-note">Fixed assessments are the Mello-Roos, parcel taxes and special assessments on the bill. <span data-fixednote>${esc(est.note)}</span></p>
</div>
<div class="hub-map"><div class="taxmap" data-taxmap data-js="${TAX_MAP_JS}" data-src="${TAX_MAP_JSON}"${b.mapCounty ? ` data-county="${esc(b.mapCounty)}"` : ""}${b.mapRegion ? ` data-region="${esc(b.mapRegion)}"` : ""} data-compact hidden></div></div>
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
    case "taxcalc": return taxCalc(b);
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
  const hub = page.layout === "taxhub";
  const hubBlock = hub ? page.sections[0].blocks[0] : null;
  const main = hub
    ? `<main>
${hubCalc(page, hubBlock, crumbs)}
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
<meta property="og:title" content="${esc(page.title)}" />
<meta property="og:description" content="${esc(page.description)}" />
<meta property="og:url" content="${esc(page.url)}" />
<meta property="og:image" content="${OG_IMAGE}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(page.title)}" />
<meta name="twitter:description" content="${esc(page.description)}" />
<meta name="twitter:image" content="${OG_IMAGE}" />
<meta name="theme-color" content="${DARK.bg}" media="(prefers-color-scheme: dark)" />
<meta name="theme-color" content="${LIGHT.bg}" media="(prefers-color-scheme: light)" />
<link rel="icon" href="/icons/favicon.ico" sizes="16x16 32x32 64x64" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<link rel="stylesheet" href="${esc(fontHref)}" />
<link rel="stylesheet" href="${CSS_PATH}" />
${page.jsonLd.map((o) => `<script type="application/ld+json">${jsonLd(o)}</script>`).join("\n")}
${page.sections.some((x) => x.blocks.some((b) => b.type === "taxcalc")) ? `<script type="module" src="${TAX_CALC_JS}"></script>\n` : ""}</head>
<body${hub ? ' class="taxhub"' : ""}>
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
.calc { margin: 12px 0; padding: 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--card); }
.calc-in { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.calc .f { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--text2); min-width: 0; }
.calc .f.wide { grid-column: 1 / -1; }
.calc .f em { font-style: normal; font-size: 11px; color: var(--text3); margin-left: 4px; }
.calc .box { display: flex; align-items: center; gap: 4px; padding: 0 12px; height: 42px; border-radius: 10px; border: 1px solid var(--input-border); background: var(--input-bg); }
.calc .box i { font-style: normal; color: var(--text3); font-size: 14px; }
.calc input, .calc select { font: inherit; font-size: 16px; color: var(--text); background: transparent; border: 0; outline: 0; min-width: 0; width: 100%; font-variant-numeric: tabular-nums; }
.calc .box:focus-within { border-color: var(--accent); }
.combo { position: relative; }
.combo .glass { flex: none; margin-right: 4px; color: var(--text3); }
.city-list { position: absolute; z-index: 20; top: calc(100% + 4px); left: 0; right: 0; max-height: 300px; overflow-y: auto; margin: 0; padding: 4px; list-style: none; border: 1px solid var(--border); border-radius: 12px; background: var(--card); box-shadow: 0 10px 28px rgba(10, 17, 32, 0.18); }
.city-list[hidden] { display: none; }
.city-list li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0 12px; margin: 0; padding: 7px 10px; border-radius: 8px; font-size: 15px; line-height: 1.35; color: var(--text); cursor: pointer; }
.city-list li .sub { grid-row: 2; font-size: 12px; color: var(--text3); }
.city-list li .pct { grid-column: 2; grid-row: 1 / span 2; align-self: center; font-variant-numeric: tabular-nums; color: var(--text2); }
.city-list li[aria-selected="true"], .city-list li[role="option"]:hover { background: var(--pill); }
.city-list li.none { display: block; font-size: 14px; color: var(--text2); cursor: default; }
.taxmap { grid-column: 1 / -1; min-width: 0; }
.taxmap[hidden] { display: none; }
.taxmap:empty { height: 696px; border-radius: 12px; background: var(--input-bg); }
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
.calc .chk { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text); }
.calc .chk input { width: 18px; height: 18px; accent-color: var(--accent); }
.calc .hint { grid-column: 1 / -1; margin: 0; font-size: 13px; }
.bill-cta { grid-column: 1 / -1; margin: 0; }
.bill-cta .pill { display: block; padding: 14px 22px; font-size: 16px; line-height: 1.3; text-align: center; }
.bill-cta .pill[hidden] { display: none; }
.calc-hero { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; margin: 14px 0 0; }
.calc-stat { display: flex; flex-direction: column; padding: 14px 16px; border: 1px solid var(--border); border-radius: 12px; }
.calc-stat .k { font-size: 13px; font-weight: 600; color: var(--text2); }
.calc-stat strong { font-size: 32px; line-height: 1.2; font-weight: 700; letter-spacing: -0.01em; color: var(--text); font-variant-numeric: tabular-nums; }
.calc-stat .s { font-size: 13px; color: var(--text2); font-variant-numeric: tabular-nums; }
.calc-why { margin: 10px 0 0; font-size: 14px; }
.calc .table-wrap { margin: 14px 0 0; }
.calc-out { table-layout: fixed; }
.calc-out th { white-space: normal; }
.calc-out td { width: 46%; }
.calc-out tr.total th, .calc-out tr.total td { font-weight: 700; color: var(--text); }
@media (max-width: 560px) {
  .calc { padding: 12px; }
  .calc-in { grid-template-columns: minmax(0, 1fr); }
  .m-frame { height: 420px; }
  .m-chips { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .m-chip { flex: none; }
  .taxmap:empty { height: 640px; }
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
/* CA tax hub and county pages: the math on the left, the navy map pinned on the right. */
.taxhub { --hub-head: 59px; --hub-gut: 24px; --hub-navy: #0a1120; --hub-screen: max(700px, calc(100vh - var(--hub-head) - 36px)); }
.taxhub .wrap { max-width: none; padding-left: var(--hub-gut); padding-right: var(--hub-gut); }
.taxhub header.site .bar { min-height: var(--hub-head); padding-top: 8px; padding-bottom: 8px; }
.hub-brand { display: flex; flex-direction: column; line-height: 1.15; text-decoration: none; }
.hub-brand .badge { margin-top: 3px; font-size: 9px; }
.hub-stage { display: grid; grid-template-columns: minmax(470px, 37%) minmax(0, 1fr); gap: 20px; padding: 16px var(--hub-gut) 20px; }
.hub-stage.no-map { grid-template-columns: minmax(0, 640px); justify-content: center; }
.hub-stage.no-map .hub-map { display: none; }
.hub-calc { display: flex; flex-direction: column; gap: 12px; min-width: 0; min-height: var(--hub-screen); }
.hub-calc h1 { margin: 2px 0 0; font-size: 31px; line-height: 1.12; letter-spacing: -0.025em; }
.hub-calc .crumbs ol { margin: 0 0 4px; font-size: 12px; }
.hub-intro { margin: 5px 0 0; font-size: 15px; line-height: 1.4; }
.hub-sheet { flex: 1; display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 18px; background: var(--card); box-shadow: 0 14px 34px -22px rgba(10, 17, 32, 0.3); }
.hub-pick { padding: 14px 16px 12px; border-bottom: 1px solid var(--sep); }
.hub-pick label { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 5px; font-size: 13px; font-weight: 600; }
.hub-pick label em { font-style: normal; font-size: 12px; font-weight: 400; color: var(--text3); }
.hub-box { display: flex; align-items: center; gap: 4px; height: 38px; padding: 0 11px; border: 1px solid var(--input-border); border-radius: 10px; background: var(--input-bg); }
.hub-box:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(59, 107, 245, 0.18); }
.hub-box i { font-style: normal; font-size: 14px; color: var(--text3); }
.hub-box input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; font-size: 16px; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
.hub-pick .hub-box { height: 44px; }
.hub-pick .hub-box input { font-size: 18px; }
.hub-box .glass { flex: none; margin-right: 5px; color: var(--text3); }
.hub-ledger { flex: 1; display: flex; flex-direction: column; justify-content: space-evenly; padding: 4px 16px; }
.hub-row { display: grid; grid-template-columns: 18px minmax(0, 1fr) 158px; align-items: center; gap: 6px; min-height: 42px; }
.hub-row + .hub-row { border-top: 1px solid var(--sep); }
.hub-op { font-size: 16px; font-weight: 500; color: var(--link); }
.hub-lab { font-size: 14px; font-weight: 500; line-height: 1.25; color: var(--text); }
.hub-lab small { display: block; font-size: 12px; font-weight: 400; color: var(--text3); }
.hub-lab label { display: inline-flex; align-items: center; gap: 6px; color: var(--text2); cursor: pointer; }
.hub-lab input[type="checkbox"] { width: 14px; height: 14px; margin: 0; accent-color: var(--accent); }
.hub-val { font-size: 15px; font-weight: 500; text-align: right; color: var(--text2); font-variant-numeric: tabular-nums; }
.hub-row .hub-box input { text-align: right; }
.hub-row.sub .hub-lab, .hub-row.sub .hub-val { font-weight: 600; color: var(--text); }
.hub-answer { margin: 0 8px 8px; padding: 15px 18px 13px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; color: #fff; background-color: var(--hub-navy); background-image: linear-gradient(rgba(147, 173, 250, 0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(147, 173, 250, 0.09) 1px, transparent 1px); background-size: 22px 22px; }
.hub-stats { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 14px; }
.hub-stat + .hub-stat { padding-left: 16px; border-left: 1px solid rgba(255, 255, 255, 0.16); }
.hub-stat .k { display: block; font-family: ${MONO}; font-size: 10px; letter-spacing: 0.13em; text-transform: uppercase; color: #a9bbe6; }
.hub-stat strong { display: block; margin-top: 3px; font-size: 36px; line-height: 1.08; font-weight: 700; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.hub-stat .s { display: block; margin-top: 3px; font-size: 13px; color: #c7d3ee; font-variant-numeric: tabular-nums; }
.hub-proof { margin: 11px 0 0; padding-top: 9px; border-top: 1px solid rgba(255, 255, 255, 0.14); font-size: 12.5px; line-height: 1.4; color: #c7d3ee; font-variant-numeric: tabular-nums; }
.hub-proof b { font-weight: 600; color: #fff; }
.hub-bill { display: block; padding: 13px 20px; background: linear-gradient(135deg, #3b6bf5, #2b4fce); font-size: 16px; line-height: 1.3; text-align: center; box-shadow: 0 10px 22px -12px rgba(43, 79, 206, 0.8); }
.hub-bill:hover { background: linear-gradient(135deg, #3b6bf5, #2b4fce); filter: brightness(1.08); }
.hub-bill[hidden] { display: none; }
.hub-note { margin: 0 2px; font-size: 12px; line-height: 1.4; color: var(--text3); }
.hub-map { position: sticky; top: 16px; align-self: start; height: var(--hub-screen); min-width: 0; border-radius: 18px; background: var(--hub-navy); }
.taxhub .taxmap { position: relative; height: 100%; --map-water: #0a1120; --map-land: #15213a; --map-land-hover: #1d2c4b; --map-line: rgba(255, 255, 255, 0.2); --hub-glass: rgba(15, 24, 43, 0.84); --hub-grid-a: rgba(147, 173, 250, 0.13); --hub-grid-b: rgba(147, 173, 250, 0.05); --card: #0a1120; --border: rgba(255, 255, 255, 0.15); --sep: rgba(255, 255, 255, 0.12); --pill: rgba(255, 255, 255, 0.1); --text: #f2f5fc; --text2: #bccae6; --text3: #8fa1c4; --link: #93adfa; --accent-hover: #bccdfc; --q0: #2f4a8f; --q1: #3f66c9; --q2: #5f86f7; --q3: #93adfa; --q4: #dbe5ff; }
.taxhub .taxmap:empty { height: 100%; }
.taxhub .m-frame { height: 100%; border-radius: 18px; background-color: var(--map-water); background-image: linear-gradient(var(--hub-grid-a) 1px, transparent 1px), linear-gradient(90deg, var(--hub-grid-a) 1px, transparent 1px), linear-gradient(var(--hub-grid-b) 1px, transparent 1px), linear-gradient(90deg, var(--hub-grid-b) 1px, transparent 1px); background-size: 120px 120px, 120px 120px, 24px 24px, 24px 24px; }
.taxhub .m-chips { position: absolute; z-index: 6; top: 14px; left: 14px; right: 62px; gap: 5px; margin: 0; }
.taxhub .m-chip { padding: 5px 11px; border-color: var(--border); background: var(--hub-glass); color: var(--text); font-size: 12.5px; font-weight: 500; white-space: nowrap; -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.taxhub .m-chip:hover { background: #1d2c4b; }
.taxhub .m-chip[aria-pressed="true"] { border-color: #3b6bf5; background: #3b6bf5; }
.taxhub .m-zoom { top: 14px; right: 14px; background: var(--hub-glass); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.taxhub .m-legend, .taxhub .m-strip { position: absolute; z-index: 6; left: 14px; width: 164px; margin: 0; padding: 11px 13px; border: 1px solid var(--border); border-radius: 12px; background: var(--hub-glass); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.taxhub .m-legend { bottom: 14px; flex-direction: column; align-items: flex-start; gap: 5px; }
.taxhub .m-legend-title { margin-bottom: 1px; font-family: ${MONO}; font-size: 10px; font-weight: 500; letter-spacing: 0.13em; text-transform: uppercase; color: var(--text2); }
.taxhub .m-strip { bottom: 186px; flex-direction: column; flex-wrap: nowrap; align-items: flex-start; gap: 6px; min-height: 0; }
.hub-lead { max-width: 92ch; margin: 18px 0 0; font-size: 16px; line-height: 1.5; }
.hub-more h2 { margin: 26px 0 12px; font-size: 22px; letter-spacing: -0.015em; }
.hub-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; }
.hub-card { padding: 16px 18px; border: 1px solid var(--border); border-radius: 14px; background: var(--card); }
.hub-card h3 { margin: 0 0 6px; font-size: 15px; line-height: 1.3; }
.hub-card p { margin: 0; font-size: 14px; line-height: 1.5; }
.hub-tables { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 520px), 1fr)); gap: 12px 16px; align-items: start; }
.hub-tables h2 { margin-top: 10px; font-size: 17px; }
.hub-tables p { font-size: 14px; }
.hub-tables .table-wrap { max-height: 420px; overflow: auto; margin: 0; border-radius: 14px; }
.hub-tables caption { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.hub-tables table { font-size: 13.5px; }
@media (scripting: none) {
  .hub-stage { grid-template-columns: minmax(0, 640px); justify-content: center; }
  .hub-map { display: none; }
}
@media (max-width: 1080px) {
  .hub-stage { grid-template-columns: minmax(0, 1fr); }
  .hub-calc { min-height: 0; }
  .hub-map { position: relative; top: 0; height: 620px; }
}
@media (max-width: 560px) {
  .taxhub { --hub-gut: 16px; }
  .hub-calc h1 { font-size: 27px; }
  .hub-row { grid-template-columns: 16px minmax(0, 1fr) 132px; }
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
