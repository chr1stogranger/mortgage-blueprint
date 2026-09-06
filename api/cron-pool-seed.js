// /api/cron-pool-seed.js
//
// Vercel CRON-triggered endpoint that pumps /api/sold-comps?city=...&fresh=1
// for each launch market. The discovery-side random shuffle ensures different
// candidate zpids get attempted on each invocation, so the pool grows
// monotonically until each market has 50+ entries.
//
// Configured in vercel.json crons with a recurring schedule.
//
// Guarded by CRON_SECRET (Vercel auto-injects this on cron-triggered calls
// via the Authorization header). Reject other callers so nobody can DOS the
// RapidAPI quota by hammering this endpoint.

// CA-only for now: sold-comps discovery builds the search location as
// `${city}, CA`. Non-CA markets (Seattle/Miami/NYC/Chicago) need `state`
// plumbed through /api/sold-comps before they can be seeded — see follow-up.
// Small concurrency pool. Keeps allSettled semantics: one market failing
// never kills the others. Width 2 keeps RapidAPI under its per-second limit.
async function runPool(items, width, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try { results[i] = await fn(items[i], i); }
      catch (err) { results[i] = { error: err?.message || String(err) }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, worker));
  return results;
}

const MARKETS_TO_SEED = [
  'San Francisco', 'Alameda', 'Oakland', 'Berkeley',
  'Los Angeles', 'San Diego',
];

// Allow longer execution — each market pages the search endpoint.
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  // FAIL CLOSED in production: if CRON_SECRET is missing there, refuse to run
  // rather than leaving a RapidAPI-burning endpoint open (CIO audit L-5).
  // Local dev (no secret, not production) is still allowed through.
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.VERCEL_ENV === 'production') {
    return res.status(500).json({ error: 'CRON_SECRET not configured' });
  }
  if (secret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  // Build absolute URL for the internal fetch. Use the canonical domain, NOT
  // VERCEL_URL: the per-deployment URL sits behind Vercel deployment
  // protection, which returns an HTML SSO page instead of JSON.
  const baseUrl = 'https://blueprint.realstack.app';

  // Market pumps run through a 2-wide pool (was a 6-wide Promise.all, which
  // tripped RapidAPI's per-second 429 during regionId auto-complete).
  const pumpMarket = async (market) => {
    const url = `${baseUrl}/api/sold-comps?city=${encodeURIComponent(market)}&fresh=1`;
    const t0 = Date.now();
    try {
      // Forward the cron secret — sold-comps now requires it to honor fresh=1
      // (the forced-discovery flag is ignored for unauthenticated callers).
      const r = await fetch(url, {
        method: 'GET',
        headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      });
      const j = await r.json();
      return {
        market,
        status: r.status,
        latencyMs: Date.now() - t0,
        poolSize: j.poolSize,
        poolFreshSize: j.poolFreshSize,
        poolOlderSize: j.poolOlderSize,
        newlyAdded: j.newlyAdded,
        source: j.source,
      };
    } catch (err) {
      return { market, error: err.message, latencyMs: Date.now() - t0 };
    }
  };

  // Also pre-warm /api/pricepoint (active + sold inventory) for each market.
  // fresh=1 forces a RapidAPI re-fetch whose result lands in the Supabase
  // pp_city_cache table — so the first user to click a city each day gets a
  // sub-second cache hit instead of paying the multi-page fetch themselves.
  const warmMarket = async (market) => {
    const url = `${baseUrl}/api/pricepoint?city=${encodeURIComponent(market)}&state=CA&fresh=1`;
    const t0 = Date.now();
    try {
      const r = await fetch(url, { method: 'GET' });
      const j = await r.json();
      return {
        market: `${market} (pricepoint warm)`,
        status: r.status,
        latencyMs: Date.now() - t0,
        activeCount: j.activeCount,
        soldCount: j.soldCount,
      };
    } catch (err) {
      return { market: `${market} (pricepoint warm)`, error: err.message, latencyMs: Date.now() - t0 };
    }
  };

  const results = await runPool(
    [...MARKETS_TO_SEED.map((m) => ['pump', m]), ...MARKETS_TO_SEED.map((m) => ['warm', m])],
    2,
    ([kind, market]) => (kind === 'pump' ? pumpMarket(market) : warmMarket(market))
  );

  return res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
    results,
  });
}
