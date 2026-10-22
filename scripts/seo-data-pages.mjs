// Post-build: write the static SEO / AI-search data pages into dist/.
//
// Unlike seo-pages.mjs (SPA-shell copies with new head tags), these are
// standalone HTML documents with the answer in the body and no app bundle, so
// crawlers that never run JavaScript (most AI search crawlers) can read them.
// Pages: /loan-limits/ (+ 8 states + qualifying counties) and
// /property-tax/california/ (+ one page per sourced county and per SOURCED city). The page set and
// every number come from scripts/seo-data/model.js, which throws on missing
// data, slug collisions or broken internal links, so a bad build never ships.
//
// vercel.json's SPA catch-all runs after the filesystem check, so a real
// dist/<path>/index.html wins. Also extends dist/sitemap.xml (copied from
// public/ by Vite) with every generated URL; public/sitemap.xml is untouched.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { buildSite, parseLimitSource } from "./seo-data/model.js";
import { renderPage, renderCss, CSS_PATH } from "./seo-data/render.js";

const now = new Date().toISOString().slice(0, 10);
const limitSource = parseLimitSource(readFileSync("src/data/loanLimits.js", "utf8"));
const fontHref = readFileSync("index.html", "utf8").match(/href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"/)?.[1];
if (!fontHref) throw new Error("seo-data-pages: Google Fonts stylesheet not found in index.html");

const { pages, sitemap } = buildSite({ now, limitSource });

const write = (file, body) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
};
write(`dist${CSS_PATH}`, renderCss());
for (const p of pages) write(`dist${p.path}index.html`, renderPage(p, { fontHref: fontHref.replace(/&amp;/g, "&") }));

// ── sitemap ──
const xml = readFileSync("dist/sitemap.xml", "utf8");
const existing = [...xml.matchAll(/<url>[\s\S]*?<\/url>/g)].map((m) => m[0].trim());
if (!existing.length) throw new Error("seo-data-pages: dist/sitemap.xml has no <url> entries");
const added = sitemap.map((u) => `<url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
const all = [...existing, ...added];
const locs = all.map((u) => u.match(/<loc>([^<]+)<\/loc>/)?.[1]);
if (locs.some((l) => !l)) throw new Error("seo-data-pages: sitemap entry without <loc>");
if (new Set(locs).size !== locs.length) throw new Error("seo-data-pages: duplicate <loc> in sitemap");
if (locs.length > 50000) throw new Error(`seo-data-pages: sitemap has ${locs.length} URLs (limit 50,000)`);
writeFileSync("dist/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${all.join("\n  ")}
</urlset>
`);

const count = (re) => pages.filter((p) => re.test(p.path)).length;
console.log(
  `seo-data-pages: wrote ${pages.length} pages ` +
  `(loan-limit hub ${count(/^\/loan-limits\/$/)}, states ${count(/^\/loan-limits\/[^/]+\/$/)}, ` +
  `counties ${count(/^\/loan-limits\/[^/]+\/[^/]+\/$/)}, CA tax hub ${count(/^\/property-tax\/california\/$/)}, ` +
  `tax counties ${count(/^\/property-tax\/california\/[^/]+-county\/$/)}, ` +
  `cities ${count(/^\/property-tax\/california\/[^/]+\/$/) - count(/^\/property-tax\/california\/[^/]+-county\/$/)}); sitemap ${existing.length} + ${added.length} = ${locs.length} URLs`,
);
