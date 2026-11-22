// GET /api/og-tax?city=<name>[&r=<rate>] or ?county=<name>[&r=<range>]: a
// California city's or county's link-preview card (1200x630 PNG, see
// _taxCard.js). Each city and county tax page's og:image points here, with its
// rate (or range) as r= so new rates get a new URL and a fresh card past the CDN cache.
// An unknown city gets the shared tax card instead of an error, so a preview
// never shows a broken image.
import { renderTaxCard, renderCountyCard, isTaxCardCity, taxCardCountyCities } from "./_taxCard.js";
import { sendCard } from "./_ogCard.js";
import { rateLimited } from "./_ratelimit.js";

export const config = { maxDuration: 20 };

export default async function handler(req, res) {
  // Each render runs satori + resvg in Node; a throttle keeps a loop from
  // turning the card into a CPU bill. Crawlers fetch once per link.
  if (rateLimited(req, res, { limit: 20 })) return;
  const city = String(req.query?.city || "");
  const county = String(req.query?.county || "");
  const ok = city ? isTaxCardCity(city) : county ? taxCardCountyCities(county).length > 0 : false;
  if (!ok) {
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.redirect(302, "/og-ca-tax.png");
  }
  return sendCard(res, () => (city ? renderTaxCard(city) : renderCountyCard(county)), "/og-ca-tax.png", city || county);
}
