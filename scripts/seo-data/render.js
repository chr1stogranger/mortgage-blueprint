// Page model (model.js) -> standalone static HTML, plus the one shared
// stylesheet. No app bundle: these pages must read in full for crawlers that
// never run JS. The CA tax pages' calculator is the one script, and only an
// enhancement: its numbers are pre-rendered here (taxcalc block) and
// /seo/tax-calc.js makes them live. Every interpolated string goes through esc().

import { LIGHT, DARK } from "../../src/lib/theme.js";
import { FONT, MONO } from "../../src/lib/fonts.js";
import { ORIGIN, FOOTER_TEXT } from "./model.js";
import { computeTax, formatTax, HOMEOWNERS_EXEMPTION } from "./tax-calc.client.js";

export const CSS_PATH = "/seo/seo.css";
export const TAX_CALC_JS = "/seo/tax-calc.js";
export const TAX_DATA_JSON = "/seo/ca-tax-rates.json";
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
  const out = formatTax(computeTax({ price: b.price, ratePct: b.pct, primary: true, fixed: 0 }));
  const row = (label, key, strong) =>
    `<tr${strong ? ' class="total"' : ""}><th scope="row">${esc(label)}</th><td class="num" data-out="${key}">${esc(out[key])}</td></tr>`;
  return `<form class="calc" data-taxcalc data-src="${TAX_DATA_JSON}" action="#" aria-label="Property tax calculator">
<div class="calc-in">
<label class="f wide"><span>City</span><select name="city"><option value="${esc(b.city)}" selected>${esc(b.city)}</option></select></label>
<label class="f"><span>Home price</span><span class="box"><i>$</i><input name="price" inputmode="numeric" autocomplete="off" value="${esc(b.price.toLocaleString("en-US"))}" /></span></label>
<label class="f"><span>Tax rate <em data-fy>FY ${esc(b.fy)}</em></span><span class="box"><input name="rate" inputmode="decimal" autocomplete="off" value="${esc(b.pct.toFixed(4))}" /><i>%</i></span></label>
<label class="f"><span>Fixed assessments</span><span class="box"><i>$</i><input name="fixed" inputmode="numeric" autocomplete="off" value="0" /><i>/yr</i></span></label>
<label class="chk"><input type="checkbox" name="primary" checked /> Primary residence (${esc(`$${HOMEOWNERS_EXEMPTION.toLocaleString("en-US")}`)} homeowners' exemption)</label>
<p class="hint">Fixed assessments are the Mello-Roos, parcel taxes and special assessments on the property's tax bill. ${b.billUrl ? `<a data-bill href="${esc(b.billUrl)}" rel="noopener">${esc(b.billLabel)}</a>` : `<a data-bill hidden href="#" rel="noopener"></a>`}</p>
</div>
<div class="table-wrap"><table class="calc-out">
<caption>Estimated first-year property tax</caption>
<tbody>
${row("Home exemption", "exemption")}
${row("Taxable value", "taxable")}
${row("Base tax", "base")}
${row("Fixed assessments", "fixed")}
${row("Annual total", "annual", true)}
${row("Monthly", "monthly", true)}
${row("Effective rate", "effective")}
</tbody>
</table></div>
</form>`;
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
 * @param {{ fontHref: string }} opts  the Google Fonts stylesheet index.html loads
 */
export function renderPage(page, { fontHref }) {
  const crumbs = page.breadcrumbs.map((b, i) => {
    const last = i === page.breadcrumbs.length - 1;
    return `<li>${last ? `<span aria-current="page">${esc(b.name)}</span>` : `<a href="${esc(b.path)}">${esc(b.name)}</a>`}</li>`;
  }).join("");
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
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${esc(fontHref)}" />
<link rel="stylesheet" href="${CSS_PATH}" />
${page.jsonLd.map((o) => `<script type="application/ld+json">${jsonLd(o)}</script>`).join("\n")}
${page.sections.some((x) => x.blocks.some((b) => b.type === "taxcalc")) ? `<script type="module" src="${TAX_CALC_JS}"></script>\n` : ""}</head>
<body>
<header class="site">
<div class="wrap bar">
<a class="wordmark" href="/">Mortgage Blueprint</a>
<nav aria-label="Site"><a href="/loan-limits/">Loan limits</a><a href="/property-tax/california/">CA property tax</a><a href="/">Open the app</a></nav>
</div>
</header>
<main class="wrap">
<nav aria-label="Breadcrumb" class="crumbs"><ol>${crumbs}</ol></nav>
<h1>${esc(page.h1)}</h1>
<p class="lead">${esc(page.lead)}</p>
${page.sections.map(section).join("\n")}
</main>
<footer class="site">
<div class="wrap">
<a class="wordmark" href="/">Mortgage Blueprint</a>
<div class="badge">POWERED BY REALSTACK</div>
<p>${esc(FOOTER_TEXT)}</p>
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
.calc select { height: 42px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--input-border); background: var(--input-bg); }
.calc .box:focus-within, .calc select:focus { border-color: var(--accent); }
.calc .chk { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text); }
.calc .chk input { width: 18px; height: 18px; accent-color: var(--accent); }
.calc .hint { grid-column: 1 / -1; margin: 0; font-size: 13px; }
.calc .table-wrap { margin: 14px 0 0; }
.calc-out { table-layout: fixed; }
.calc-out th { white-space: normal; }
.calc-out td { width: 46%; }
.calc-out tr.total th, .calc-out tr.total td { font-weight: 700; color: var(--text); }
@media (max-width: 560px) {
  .calc { padding: 12px; }
  .calc-in { grid-template-columns: minmax(0, 1fr); }
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
`;
}
