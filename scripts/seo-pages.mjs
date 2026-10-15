// Post-build: emit per-section HTML shells so Google can index PricePoint and
// Markets as their own pages INSIDE Blueprint (Christo 2026-10-15).
//
// Every route used to get dist/index.html, whose canonical points at the
// Blueprint home, so Search Console filed /pricepoint, /markets and the
// pricepoint.realstack.app host as "Alternate page with proper canonical tag"
// and never indexed them. These copies are the same app bundle with
// section-specific <title>, description, OG tags and a self-referencing
// canonical. vercel.json rewrites /pricepoint, /markets and the section
// subdomains to them; the SPA picks its mode from the path/host as before.
import { readFileSync, writeFileSync } from 'node:fs';

const ORIGIN = 'https://blueprint.realstack.app';
const src = readFileSync('dist/index.html', 'utf8');

const PAGES = [
  {
    file: 'pricepoint.html',
    url: `${ORIGIN}/pricepoint`,
    title: 'PricePoint: The Home Price Guessing Game, powered by RealStack',
    ogTitle: 'PricePoint: The Home Price Guessing Game',
    description: 'Guess what real homes sold for. Daily challenges, streaks, and leaderboards on real sold listings. Powered by RealStack.',
    image: `${ORIGIN}/og-pricepoint.png`,
  },
  {
    file: 'markets.html',
    url: `${ORIGIN}/markets`,
    title: 'Markets: Real Estate Prediction Markets, powered by RealStack',
    ogTitle: 'Markets: Real Estate Prediction Markets',
    description: 'Forecast home prices, rate movements, and housing policy. Crowd intelligence meets real estate data. Powered by RealStack.',
    image: `${ORIGIN}/og-image.png`,
  },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Replace exactly one occurrence or fail the build: a silent miss would ship a
// page that still canonicalizes to the Blueprint home.
function swap(html, re, value, label) {
  const hits = html.match(new RegExp(re.source, 'g')) || [];
  if (hits.length !== 1) throw new Error(`seo-pages: expected 1 ${label}, found ${hits.length}`);
  return html.replace(re, value);
}

for (const p of PAGES) {
  let h = src;
  h = swap(h, /<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>`, '<title>');
  h = swap(h, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(p.description)}" />`, 'description');
  h = swap(h, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(p.ogTitle)}" />`, 'og:title');
  h = swap(h, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(p.description)}" />`, 'og:description');
  h = swap(h, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${p.url}" />`, 'og:url');
  h = swap(h, /<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${p.image}" />`, 'og:image');
  h = swap(h, /<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${esc(p.ogTitle)}" />`, 'twitter:title');
  h = swap(h, /<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${esc(p.description)}" />`, 'twitter:description');
  h = swap(h, /<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${p.image}" />`, 'twitter:image');
  h = swap(h, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${p.url}" />`, 'canonical');
  writeFileSync(`dist/${p.file}`, h);
  console.log(`seo-pages: wrote dist/${p.file} -> ${p.url}`);
}
