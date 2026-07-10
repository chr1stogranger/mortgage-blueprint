// /api/pp-guess.js — Vercel Serverless Function
// ─────────────────────────────────────────────────────────────────────────────
// Server-side guess submission + scoring. This is THE fix for the silent-loss
// pipeline: the client used to insert into pp_guesses directly (fire-and-forget,
// gated by RLS/migration 011, XP overwritten). Now the client POSTs here, the
// server determines the sold price it controls, scores the guess, inserts with
// the service-role key (bypasses RLS — works for every client, even stale ones),
// and increments XP via pp_award_xp. Guesses reach pp_guesses every time.
//
// POST body:
//   { deviceId, marketId, mode, dailyId, zpid, address, neighborhood, city, zip,
//     propertyType, beds, baths, sqft, listPrice, photo, guess, guessTimeMs,
//     clientSoldPrice }
//
// Response:
//   { ok, guessId, playerId, soldPrice, pctOff, accuracyBand, xpEarned, totalXp,
//     level, alreadyGuessed }

import { createClient } from '@supabase/supabase-js';
import { applyCors } from './_cors.js';
import { rateLimited } from './_ratelimit.js';

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ── Scoring — MUST match the client copies in src/PricePoint.jsx ──────────────
// getAccuracyBand (~line 287) and getXpForGuess (~line 294). Duplicated here so
// the server is the source of truth for what lands in pp_guesses. If you change
// the bands/XP in one place, change both.
function getAccuracyBand(pctOff) {
  if (pctOff <= 2) return 'bullseye';
  if (pctOff <= 5) return 'sharp';
  if (pctOff <= 10) return 'solid';
  if (pctOff <= 20) return 'tricky';
  return 'surprise';
}
function getXpForGuess(pctOff) {
  let xp = 10; // base
  if (pctOff <= 1) xp += 50;
  else if (pctOff <= 2) xp += 40;
  else if (pctOff <= 5) xp += 25;
  else if (pctOff <= 10) xp += 15;
  return xp;
}

const VALID_MODES = ['daily', 'freeplay', 'live', 'challenge'];
const MIN_GUESS = 10_000;
const MAX_GUESS = 500_000_000;

const asInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

export default async function handler(req, res) {
  if (applyCors(req, res, { methods: 'POST, OPTIONS' })) return;
  if (rateLimited(req, res, { limit: 30 })) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  // Body may arrive parsed (Vercel) or as a string.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const {
    deviceId, marketId, mode, dailyId, zpid,
    address, neighborhood, city, zip, propertyType,
    beds, baths, sqft, listPrice, photo,
    guess, guessTimeMs, clientSoldPrice,
  } = body;

  // ── 1. Validate ─────────────────────────────────────────────────────────
  const guessInt = asInt(guess);
  if (!deviceId) return res.status(400).json({ error: 'Missing deviceId' });
  if (!VALID_MODES.includes(mode)) return res.status(400).json({ error: 'Invalid mode' });
  if (guessInt == null || guessInt < MIN_GUESS || guessInt > MAX_GUESS) {
    return res.status(400).json({ error: 'Guess out of range' });
  }
  const market = (marketId || 'sf').toLowerCase();

  try {
    // ── 2. Resolve player (service-role RPC — works even for never-registered clients) ──
    const { data: playerId, error: playerErr } = await supabase.rpc(
      'pp_get_or_create_player',
      { p_device_id: deviceId, p_market: market }
    );
    if (playerErr || !playerId) {
      console.error('[pp-guess] player resolve failed:', playerErr?.message);
      return res.status(500).json({ error: 'Could not resolve player' });
    }

    // ── 3. Determine sold_price server-side, by mode ──────────────────────
    let soldPrice = null;       // null = unscored (live, or unknown freeplay)
    let resolvedDailyId = dailyId || null;

    if (mode === 'daily') {
      let daily = null;
      if (dailyId) {
        const { data } = await supabase
          .from('pp_daily_challenges')
          .select('id, sold_price')
          .eq('id', dailyId)
          .single();
        daily = data || null;
      }
      // Fallback: today's / most-recent challenge for this market (dailyId stale or
      // client fell back to the hash daily). challenge_date DESC gets the current one.
      if (!daily) {
        const { data } = await supabase
          .from('pp_daily_challenges')
          .select('id, sold_price')
          .eq('market_id', market)
          .order('challenge_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        daily = data || null;
      }
      if (daily) {
        soldPrice = daily.sold_price;
        resolvedDailyId = daily.id;
      } else if (clientSoldPrice) {
        // No server canonical daily for this market (e.g. hash-fallback markets):
        // score as freeplay-style using the client's sold price. daily_id stays null.
        soldPrice = asInt(clientSoldPrice);
        resolvedDailyId = null;
      }
    } else if (mode === 'freeplay' || mode === 'challenge') {
      resolvedDailyId = null;
      if (zpid) {
        const { data: poolRow } = await supabase
          .from('pp_property_pool')
          .select('sold_price, list_price')
          .eq('market_id', market)
          .eq('zpid', String(zpid))
          .maybeSingle();
        if (poolRow?.sold_price) soldPrice = poolRow.sold_price;
      }
      // Client-pool fallback rows (rc_ ids, post-reshuffle) aren't in the pool —
      // accept clientSoldPrice, sanity-checked against listPrice when present.
      if (soldPrice == null && clientSoldPrice) {
        const cs = asInt(clientSoldPrice);
        const lp = asInt(listPrice);
        if (cs && (!lp || (cs >= lp * 0.3 && cs <= lp * 3))) soldPrice = cs;
      }
    } else if (mode === 'live') {
      // Live predictions resolve later via cron; no sold price now.
      soldPrice = null;
      resolvedDailyId = null;
    }

    // ── 4. Score ──────────────────────────────────────────────────────────
    let pctOff = null;
    let accuracyBand = null;
    let xpEarned;
    if (mode === 'live') {
      xpEarned = 10; // flat for making a prediction
    } else if (soldPrice && soldPrice > 0) {
      pctOff = Math.round((Math.abs(guessInt - soldPrice) / soldPrice) * 1000) / 10; // 1 dp
      accuracyBand = getAccuracyBand(pctOff);
      xpEarned = getXpForGuess(pctOff);
    } else {
      // Unknown sold price (edge case): keep the row, skip scoring rather than 500.
      xpEarned = 0;
    }

    // ── 5. Insert pp_guesses (service role bypasses RLS) ──────────────────
    const row = {
      player_id: playerId,
      market_id: market,
      mode,
      daily_id: resolvedDailyId,
      zpid: zpid ? String(zpid) : null,
      address: address || '',
      neighborhood: neighborhood || '',
      city: city || '',
      zip: zip || '',
      property_type: propertyType || '',
      beds: asInt(beds),
      baths: baths != null ? Number(baths) : null,
      sqft: asInt(sqft),
      list_price: asInt(listPrice),
      photo: photo || '',
      guess: guessInt,
      sold_price: soldPrice,
      pct_off: pctOff,
      accuracy_band: accuracyBand,
      xp_earned: xpEarned,
      guess_time_ms: asInt(guessTimeMs),
    };

    const { data: inserted, error: insErr } = await supabase
      .from('pp_guesses')
      .insert(row)
      .select('id')
      .single();

    if (insErr) {
      // Daily duplicate (unique player_id, daily_id) — return the ORIGINAL row so
      // a retry from the offline queue doesn't double-count XP.
      if (insErr.code === '23505') {
        const { data: existing } = await supabase
          .from('pp_guesses')
          .select('id, sold_price, pct_off, accuracy_band, xp_earned')
          .eq('player_id', playerId)
          .eq('daily_id', resolvedDailyId)
          .maybeSingle();
        const { data: pl } = await supabase
          .from('pp_players').select('total_xp, current_level').eq('id', playerId).maybeSingle();
        return res.status(200).json({
          ok: true,
          alreadyGuessed: true,
          guessId: existing?.id || null,
          playerId,
          soldPrice: existing?.sold_price ?? soldPrice,
          pctOff: existing?.pct_off ?? pctOff,
          accuracyBand: existing?.accuracy_band ?? accuracyBand,
          xpEarned: 0, // not re-awarded
          totalXp: pl?.total_xp ?? null,
          level: pl?.current_level ?? null,
        });
      }
      console.error('[pp-guess] insert failed:', insErr.message);
      return res.status(500).json({ error: 'Insert failed' });
    }

    // ── 5b. Live: also record the prediction (moved server-side) ──────────
    if (mode === 'live' && zpid) {
      const { error: predErr } = await supabase
        .from('pp_predictions')
        .insert({
          player_id: playerId,
          market_id: market,
          guess_id: inserted.id,
          zpid: String(zpid),
          address: address || '',
          neighborhood: neighborhood || '',
          list_price: asInt(listPrice),
          predicted_price: guessInt,
        });
      // 23505 (already predicted this zpid) is fine — the guess row still stands.
      if (predErr && predErr.code !== '23505') {
        console.error('[pp-guess] prediction insert warning:', predErr.message);
      }
    }

    // ── 6. Award XP (increment server-side) ───────────────────────────────
    let totalXp = null;
    let level = null;
    if (xpEarned > 0) {
      const { data: newTotal } = await supabase.rpc('pp_award_xp', {
        p_player_id: playerId, p_xp: xpEarned,
      });
      totalXp = newTotal ?? null;
    }
    if (totalXp == null) {
      const { data: pl } = await supabase
        .from('pp_players').select('total_xp, current_level').eq('id', playerId).maybeSingle();
      totalXp = pl?.total_xp ?? null;
      level = pl?.current_level ?? null;
    } else {
      const { data: pl } = await supabase
        .from('pp_players').select('current_level').eq('id', playerId).maybeSingle();
      level = pl?.current_level ?? null;
    }

    // ── 7. Respond ────────────────────────────────────────────────────────
    return res.status(200).json({
      ok: true,
      alreadyGuessed: false,
      guessId: inserted.id,
      playerId,
      soldPrice,
      pctOff,
      accuracyBand,
      xpEarned,
      totalXp,
      level,
    });
  } catch (err) {
    console.error('[pp-guess] unhandled:', err?.message);
    return res.status(500).json({ error: 'Server error' });
  }
}
