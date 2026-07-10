// /api/cron-enrich.js
//
// Nightly photo/list-price backfill for pp_property_pool. County (RentCast) rows
// ship with photo=null and list_price=sold_price, so Free Play cards look empty
// until a user happens to open one and triggers lazy enrichment. This proactively
// enriches the freshest photo-less rows per market so cards have real photos on
// first view.
//
// Guarded by CRON_SECRET. Scheduled in vercel.json (07:00 UTC daily), after the
// Monday pool-seed (06:00). RentCast usage is unaffected — this only calls the
// RapidAPI property-details endpoint, hard-capped at 240 calls/run.

import { createClient } from '@supabase/supabase-js';
import { enrichPoolRow } from './_enrich.js';

// Canonical short market ids the pool is keyed by (matches cityToMarketId + pp_markets).
const MARKETS = ['sf', 'oakland', 'berkeley', 'alameda', 'la', 'sd'];
const ROWS_PER_MARKET = 40;
const MAX_CALLS = 240;         // 6 markets x 40 — protects the RapidAPI quota
const MAX_ATTEMPTS = 3;        // stop re-burning quota on unmatchable rows
const SPACING_MS = 500;

export const config = { maxDuration: 300 };

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  // Fail closed in production; allow local dev without a secret.
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.VERCEL_ENV === 'production') {
    return res.status(500).json({ error: 'CRON_SECRET not configured' });
  }
  if (secret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return res.status(500).json({ error: 'RAPIDAPI_KEY not configured' });
  const apiHost = process.env.RAPIDAPI_HOST || 'real-time-real-estate-data.p.rapidapi.com';

  let totalCalls = 0;
  const summary = [];

  for (const market of MARKETS) {
    if (totalCalls >= MAX_CALLS) break;

    // Freshest photo-less rows that haven't exhausted their attempts.
    const { data: rows, error } = await supabase
      .from('pp_property_pool')
      .select('id, zpid, address, city, state, zip, sold_price, year_built, enrich_attempts, photo')
      .eq('market_id', market)
      .or('photo.is.null,photo.eq.')
      .lt('enrich_attempts', MAX_ATTEMPTS)
      .order('sold_date', { ascending: false })
      .limit(ROWS_PER_MARKET);

    if (error) { summary.push({ market, error: error.message }); continue; }

    let enriched = 0, attempted = 0, failed = 0;
    for (const row of (rows || [])) {
      if (totalCalls >= MAX_CALLS) break;
      attempted++;
      totalCalls++; // count against the quota even if resolve fails (worst case 1-2 calls)
      const r = await enrichPoolRow(supabase, row, { apiKey, apiHost });
      if (r.enriched) enriched++; else failed++;
      await sleep(SPACING_MS);
    }
    const line = { market, attempted, enriched, failed };
    summary.push(line);
    console.error(`[cron-enrich] ${market}: attempted=${attempted} enriched=${enriched} failed=${failed}`);
  }

  console.error(`[cron-enrich] done — ${totalCalls} property-details calls across ${summary.length} markets`);
  return res.status(200).json({ ok: true, totalCalls, summary });
}
