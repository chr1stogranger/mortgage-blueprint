// GET /api/og-ll?state=<USPS> or ?fips=<5 digits> (plus a version param the
// pages add): a loan-limit state's or county's link-preview card (1200x630 PNG,
// see _llCard.js). Anything without a map shape gets the shared static card.
import { renderStateCard, renderCountyCard, hasStateCard, hasCountyCard } from "./_llCard.js";
import { sendCard } from "./_ogCard.js";
import { rateLimited } from "./_ratelimit.js";

export const config = { maxDuration: 20 };
const FALLBACK = "/og-loan-limits.png";

export default async function handler(req, res) {
  // Each render runs satori + resvg in Node; a throttle keeps a loop from
  // turning the card into a CPU bill. Crawlers fetch once per link.
  if (rateLimited(req, res, { limit: 20 })) return;
  const st = String(req.query?.state || "").toUpperCase();
  const fips = String(req.query?.fips || "");
  const ok = fips ? /^\d{5}$/.test(fips) && hasCountyCard(fips) : /^[A-Z]{2}$/.test(st) && hasStateCard(st);
  if (!ok) {
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.redirect(302, FALLBACK);
  }
  return sendCard(res, () => (fips ? renderCountyCard(fips) : renderStateCard(st)), FALLBACK, fips || st);
}
