// api/_budget.js — persistent throttle + provider-budget helpers.
//
// Background (2026-09-06): an orphaned cron-job.org job hit /api/cron-pool-seed
// every 15 minutes with the CRON_SECRET. It was harmless while the cron's
// internal fetch pointed at VERCEL_URL (deployment protection ate it), then a
// Sep-5 fix pointed it at the canonical domain and 96 forced discoveries a day
// burned the entire monthly RentCast quota in ~7 hours. These helpers make the
// pipeline safe regardless of who calls the entry points or how often.
//
// State lives in pp_city_cache (cache_key text pk, data jsonb, updated_at) —
// the same generic KV the junk-memory already uses — so no new migration.
// Every helper is fail-SAFE for the budget (a storage error → deny the spend)
// and fail-OPEN for the run-lock only when the caller explicitly opts in.

export const RENTCAST_MONTHLY_BUDGET = parseInt(process.env.RENTCAST_MONTHLY_BUDGET, 10) || 40;
// RentCast bills on a Sep 3 → Oct 3 style period. The Sep 2026 period is
// already at 100% (every further call is overage), so RentCast is paused until
// the period rolls. Override with RENTCAST_PAUSE_UNTIL (ISO date) or clear it.
export const RENTCAST_PAUSE_UNTIL = process.env.RENTCAST_PAUSE_UNTIL ?? '2026-10-03T00:00:00Z';
// Minimum gap between RentCast pulls for the same market. County data lags
// months; weekly is plenty. Applies even to forced (fresh=1) discovery.
export const RENTCAST_MARKET_REFRESH_MS = 6 * 24 * 60 * 60 * 1000;

function billingPeriodKey(now = new Date()) {
  // Period boundary is the 3rd of the month (matches the RentCast email).
  const d = new Date(now);
  if (d.getUTCDate() < 3) d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function readKv(supabase, key) {
  const { data, error } = await supabase
    .from('pp_city_cache').select('data, updated_at').eq('cache_key', key).maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

async function writeKv(supabase, key, data) {
  const { error } = await supabase.from('pp_city_cache').upsert(
    { cache_key: key, data, updated_at: new Date().toISOString() },
    { onConflict: 'cache_key' }
  );
  if (error) throw new Error(error.message);
}

// ─── Run lock: "has this job run in the last N ms?" ───
// Returns { ok, lastRunAt, nextAllowedAt }. On ok=true the lock is refreshed.
// failOpen=true lets the job run when storage is unreachable (the weekly
// Vercel cron should still do its job during a Supabase blip).
const memLastRun = new Map();
export async function acquireRunLock(supabase, key, minIntervalMs, { failOpen = false } = {}) {
  const now = Date.now();
  const memAt = memLastRun.get(key) || 0;
  if (now - memAt < minIntervalMs) {
    return { ok: false, lastRunAt: new Date(memAt).toISOString(), nextAllowedAt: new Date(memAt + minIntervalMs).toISOString(), via: 'memory' };
  }
  if (!supabase) {
    if (!failOpen) return { ok: false, reason: 'no_storage' };
    memLastRun.set(key, now);
    return { ok: true, via: 'memory' };
  }
  try {
    const row = await readKv(supabase, key);
    const lastAt = row?.updated_at ? new Date(row.updated_at).getTime() : 0;
    if (now - lastAt < minIntervalMs) {
      memLastRun.set(key, lastAt);
      return { ok: false, lastRunAt: new Date(lastAt).toISOString(), nextAllowedAt: new Date(lastAt + minIntervalMs).toISOString(), via: 'supabase' };
    }
    await writeKv(supabase, key, { lastRunAt: new Date(now).toISOString() });
    memLastRun.set(key, now);
    return { ok: true, lastRunAt: lastAt ? new Date(lastAt).toISOString() : null, via: 'supabase' };
  } catch (e) {
    console.error(`[Budget] run-lock ${key} storage error: ${e.message}`);
    if (!failOpen) return { ok: false, reason: 'storage_error' };
    memLastRun.set(key, now);
    return { ok: true, via: 'memory-fallback' };
  }
}

// ─── RentCast gate ───
// Decides whether ONE RentCast request may be made for `marketId` right now.
// Order of checks: pause window → per-market refresh gap → monthly budget.
// Spends one unit of budget and stamps the market when it returns allowed.
export async function rentcastAllow(supabase, marketId, { force = false } = {}) {
  const now = Date.now();
  if (RENTCAST_PAUSE_UNTIL && now < new Date(RENTCAST_PAUSE_UNTIL).getTime()) {
    return { ok: false, reason: `paused_until_${RENTCAST_PAUSE_UNTIL}` };
  }
  if (!supabase) return { ok: false, reason: 'no_storage' };
  const periodKey = `rentcast:budget:${billingPeriodKey()}`;
  const marketKey = `rentcast:last:${marketId}`;
  try {
    const [budgetRow, marketRow] = await Promise.all([readKv(supabase, periodKey), readKv(supabase, marketKey)]);
    const lastMarketAt = marketRow?.updated_at ? new Date(marketRow.updated_at).getTime() : 0;
    if (lastMarketAt && now - lastMarketAt < RENTCAST_MARKET_REFRESH_MS) {
      return { ok: false, reason: 'market_refreshed_recently', lastAt: new Date(lastMarketAt).toISOString() };
    }
    const used = Number(budgetRow?.data?.count) || 0;
    if (used >= RENTCAST_MONTHLY_BUDGET) {
      return { ok: false, reason: 'monthly_budget_exhausted', used, budget: RENTCAST_MONTHLY_BUDGET };
    }
    await Promise.all([
      writeKv(supabase, periodKey, { count: used + 1, budget: RENTCAST_MONTHLY_BUDGET }),
      writeKv(supabase, marketKey, { marketId, force }),
    ]);
    return { ok: true, used: used + 1, budget: RENTCAST_MONTHLY_BUDGET };
  } catch (e) {
    console.error(`[Budget] rentcast gate ${marketId} storage error → deny: ${e.message}`);
    return { ok: false, reason: 'storage_error' };
  }
}

// Market-level "has RentCast ever seeded this market?" — independent of the
// zip/exclude/playability filters the request-scoped pool read applies.
export async function marketHasRentcastRows(supabase, marketId) {
  if (!supabase) return false;
  try {
    const { count, error } = await supabase
      .from('pp_property_pool')
      .select('zpid', { count: 'exact', head: true })
      .eq('market_id', marketId)
      .like('zpid', 'rc_%');
    if (error) throw new Error(error.message);
    return (count || 0) > 0;
  } catch (e) {
    console.error(`[Budget] rc-row count ${marketId} error (assume seeded): ${e.message}`);
    return true; // assume seeded → conservative (no RentCast call)
  }
}
