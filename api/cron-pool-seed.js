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

import { createClient } from '@supabase/supabase-js';
import { acquireRunLock } from './_budget.js';

// Allow longer execution — each market pages the search endpoint.
export const config = { maxDuration: 300 };

// Persistent throttle: this job is a WEEKLY seeder, but anything holding the
// CRON_SECRET can hit it (an orphaned cron-job.org job did, every 15 minutes,
// 2026-09-05/06 — see api/_budget.js). Whatever the caller, at most one real
// run per MIN_RUN_INTERVAL; extra calls get a 200 { skipped: 'throttled' }.
const MIN_RUN_INTERVAL_MS = 20 * 60 * 60 * 1000; // 20h — never more than daily

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

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

  // Identify the caller in the logs (Vercel cron = "vercel-cron/1.0"). This is
  // how the cron-job.org hammer was finally spotted — keep it.
  const ua = req.headers['user-agent'] || '';
  console.error(`[CronPoolSeed] invoked ua="${ua.slice(0, 80)}"`);

  const lock = await acquireRunLock(getSupabaseAdmin(), 'cron:pool-seed', MIN_RUN_INTERVAL_MS, { failOpen: true });
  if (!lock.ok) {
    console.error(`[CronPoolSeed] throttled — last run ${lock.lastRunAt}, next allowed ${lock.nextAllowedAt} (via ${lock.via})`);
    return res.status(200).json({ ok: false, skipped: 'throttled', lastRunAt: lock.lastRunAt, nextAllowedAt: lock.nextAllowedAt });
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
      // Forward the cron secret: pricepoint ignores fresh=1 for unprivileged callers.
      const r = await fetch(url, {
        method: 'GET',
        headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      });
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
