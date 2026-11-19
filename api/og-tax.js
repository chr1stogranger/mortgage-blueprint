// GET /api/og-tax?city=<name>[&r=<rate>]: a California city's link-preview card
// (1200x630 PNG, see _taxCard.js). Each city page's og:image points here, with
// its rate as r= so a new rate gets a new URL and a fresh card past the CDN cache.
// An unknown city gets the shared tax card instead of an error, so a preview
// never shows a broken image.
import { renderTaxCard, isTaxCardCity } from "./_taxCard.js";

export const config = { maxDuration: 20 };

export default async function handler(req, res) {
  const city = String(req.query?.city || "");
  if (!isTaxCardCity(city)) {
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.redirect(302, "/og-ca-tax.png");
  }
  try {
    const png = await renderTaxCard(city);
    res.setHeader("Content-Type", "image/png");
    // Rendered once, then served from the edge.
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400");
    return res.status(200).send(png);
  } catch (err) {
    console.error("og-tax:", city, err);
    res.setHeader("Cache-Control", "no-store");
    return res.redirect(302, "/og-ca-tax.png");
  }
}
