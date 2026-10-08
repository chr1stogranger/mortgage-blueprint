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

// ── Auth-aware player lookup ─────────────────────────────────────────────────
// Signed-in users resolve to their ACCOUNT player (auth_user_id) so guesses
// land on one identity across devices; guests resolve by device id as before.
// Look-up only — never creates (the POST path creates via the RPC when needed).
async function lookupPlayerId(supabase, req, deviceId) {
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (bearer) {
    try {
      const { data, error } = await supabase.auth.getUser(bearer);
      if (!error && data?.user?.id) {
        const { data: canon } = await supabase
          .from('pp_players').select('id')
          .eq('auth_user_id', data.user.id)
          .order('created_at', { ascending: true })
          .limit(1).maybeSingle();
        if (canon?.id) return canon.id;
      }
    } catch (e) {
      console.error('[pp-guess] auth lookup failed (device fallback):', e.message);
    }
  }
  if (!deviceId) return null;
  const { data: row } = await supabase
    .from('pp_players').select('id').eq('device_id', deviceId).maybeSingle();
  return row?.id || null;
}

export default async function handler(req, res) {
  if (applyCors(req, res, { methods: 'GET, POST, OPTIONS' })) return;
  if (rateLimited(req, res, { limit: 30 })) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  // ── GET — read-only boards (folded into this route: function-count discipline)
  //   ?mine=sold         this player's Sold / Daily / challenge guesses (Stats
  //                      tab history), one row per home — first guess, which is
  //                      the one The Field counts — plus how many times guessed
  //   ?mine=1            this player's live predictions + server resolution, so
  //                      the client's local copies can learn they resolved
  //   ?zpid=X            For Sale board (pp_predictions). Numbers are only
  //                      returned once the caller has locked their own call or
  //                      the home has sold; before that it's names only, so the
  //                      field can never anchor a guess (enforced HERE, not in UI)
  //   ?zpid=X&kind=sold  Sold/Daily field summary (pp_guesses) — only for a
  //                      caller who has already guessed that home
  // player_ids are never returned; the caller sends its own deviceId and gets
  // a `you` flag back instead.
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    // Header first; ?deviceId= is a fallback for clients built before the move.
    const deviceId = String(req.headers['x-device-id'] || req.query.deviceId || '').trim();
    const myPlayerId = await lookupPlayerId(supabase, req, deviceId);

    if (req.query.mine === 'sold') {
      if (!myPlayerId) return res.status(200).json({ guesses: [] });
      const { data, error } = await supabase
        .from('pp_guesses')
        .select('mode, zpid, address, neighborhood, city, zip, property_type, beds, baths, sqft, list_price, photo, guess, sold_price, pct_off, created_at')
        .eq('player_id', myPlayerId)
        .in('mode', ['daily', 'freeplay', 'challenge'])
        .order('created_at', { ascending: true })
        .limit(1000);
      if (error) {
        console.error('[pp-guess] mine=sold read failed:', error.message);
        return res.status(500).json({ error: 'Guesses unavailable' });
      }
      const byHome = new Map();
      for (const r of data || []) {
        const key = r.zpid || `${r.address || ''}|${r.zip || ''}`;
        const prev = byHome.get(key);
        if (prev) { prev.tries += 1; continue; }
        byHome.set(key, {
          mode: r.mode, zpid: r.zpid, address: r.address, neighborhood: r.neighborhood,
          city: r.city, zip: r.zip, propertyType: r.property_type, beds: r.beds, baths: r.baths,
          sqft: r.sqft, listPrice: r.list_price, photo: r.photo, guess: r.guess,
          soldPrice: r.sold_price, pctOff: r.pct_off, at: r.created_at, tries: 1,
        });
      }
      return res.status(200).json({ guesses: [...byHome.values()].reverse() });
    }

    if (req.query.mine) {
      if (!myPlayerId) return res.status(200).json({ predictions: [] });
      const { data, error } = await supabase
        .from('pp_predictions')
        .select('zpid, address, predicted_price, predicted_at, resolved, sold_price, pct_off, resolved_at')
        .eq('player_id', myPlayerId)
        .order('predicted_at', { ascending: false })
        .limit(500);
      if (error) {
        console.error('[pp-guess] mine read failed:', error.message);
        return res.status(500).json({ error: 'Predictions unavailable' });
      }
      return res.status(200).json({
        predictions: (data || []).map(r => ({
          zpid: r.zpid, address: r.address, guess: r.predicted_price,
          resolved: !!r.resolved, soldPrice: r.sold_price || null,
          pctOff: r.pct_off, resolvedAt: r.resolved_at,
        })),
      });
    }

    const zpid = String(req.query.zpid || '').trim();
    if (!zpid) return res.status(400).json({ error: 'Missing ?zpid' });

    if (req.query.kind === 'sold') {
      const { data, error } = await supabase
        .from('pp_guesses')
        .select('player_id, guess, pct_off, created_at, pp_players(display_name)')
        .eq('zpid', zpid)
        .in('mode', ['daily', 'freeplay', 'challenge'])
        .not('pct_off', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1000);
      if (error) {
        console.error('[pp-guess] sold field read failed:', error.message);
        return res.status(500).json({ error: 'Field unavailable' });
      }
      // One entry per player: their first guess on the home (replays don't count).
      const byPlayer = new Map();
      for (const r of data || []) if (!byPlayer.has(r.player_id)) byPlayer.set(r.player_id, r);
      const rows = [...byPlayer.values()].sort((a, b) => a.pct_off - b.pct_off);
      const mineIdx = myPlayerId ? rows.findIndex(r => r.player_id === myPlayerId) : -1;
      if (mineIdx < 0) return res.status(200).json({ zpid, count: rows.length, locked: true });
      const avg = rows.length ? Math.round(rows.reduce((t, r) => t + Number(r.guess || 0), 0) / rows.length) : null;
      const top = rows.slice(0, 3).map((r, i) => ({
        rank: i + 1, name: r.pp_players?.display_name || '', guess: r.guess,
        accuracy: Math.max(0, 100 - Number(r.pct_off)), you: r.player_id === myPlayerId,
      }));
      return res.status(200).json({ zpid, count: rows.length, locked: false, yourRank: mineIdx + 1, avgGuess: avg, top });
    }

    const { data, error } = await supabase
      .from('pp_predictions')
      .select('player_id, predicted_price, predicted_at, resolved, sold_price, pct_off, address, neighborhood, list_price, pp_players(display_name)')
      .eq('zpid', zpid)
      .order('predicted_at', { ascending: true })
      .limit(50);
    if (error) {
      console.error('[pp-guess] scoreboard read failed:', error.message);
      return res.status(500).json({ error: 'Scoreboard unavailable' });
    }
    const soldPrice = (data || []).find(r => r.resolved && r.sold_price)?.sold_price || null;
    // The display list is capped at 50, so the caller's own call (and the true
    // field size) can fall off it. Resolve both with their own queries.
    let iCalled = myPlayerId != null && (data || []).some(r => r.player_id === myPlayerId);
    if (!iCalled && myPlayerId != null) {
      const { data: mine, error: mineErr } = await supabase
        .from('pp_predictions')
        .select('player_id')
        .eq('player_id', myPlayerId)
        .eq('zpid', zpid)
        .limit(1)
        .maybeSingle();
      if (mineErr) console.error('[pp-guess] own call lookup failed:', mineErr.message);
      iCalled = !!mine;
    }
    let total = (data || []).length;
    if (total >= 50) {
      const { count, error: countErr } = await supabase
        .from('pp_predictions')
        .select('player_id', { count: 'exact', head: true })
        .eq('zpid', zpid);
      if (countErr) console.error('[pp-guess] board count failed:', countErr.message);
      else if (typeof count === 'number') total = count;
    }
    const revealed = iCalled || !!soldPrice;
    let calls = (data || []).map(r => ({
      name: r.pp_players?.display_name || '',
      guess: revealed ? r.predicted_price : null,
      at: r.predicted_at,
      resolved: !!r.resolved,
      pctOff: revealed ? r.pct_off : null,
      you: myPlayerId != null && r.player_id === myPlayerId,
    }));
    // Sold: rank the field by closeness to the real price.
    if (soldPrice) calls = calls.sort((a, b) => Math.abs(a.guess - soldPrice) - Math.abs(b.guess - soldPrice));
    // Property basics so a board opened from a notification/deep link (no local
    // prediction copy on this device) still has a heading and list price.
    const first = (data || [])[0];
    let property = first ? { address: first.address || '', neighborhood: first.neighborhood || '', listPrice: first.list_price || null } : null;
    // pp_predictions has no photo/specs — the live guess rows that created them do.
    if (property) {
      try {
        const { data: g } = await supabase
          .from('pp_guesses')
          .select('photo, city, zip, beds, baths, sqft, property_type')
          .eq('zpid', zpid).not('photo', 'is', null)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (g) property = { ...property, photo: g.photo, city: g.city, zip: g.zip, beds: g.beds, baths: g.baths, sqft: g.sqft, propertyType: g.property_type };
      } catch (e) { console.error('[pp-guess] board photo lookup failed:', e.message); }
    }
    return res.status(200).json({ zpid, count: total, calls, soldPrice, revealed, property });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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
    // ── 2. Resolve player: account identity first (signed-in, cross-device),
    // then the service-role RPC (creates the device player when needed) ──
    let playerId = await lookupPlayerId(supabase, req, null); // auth-only probe
    if (!playerId) {
      const { data: pid, error: playerErr } = await supabase.rpc(
        'pp_get_or_create_player',
        { p_device_id: deviceId, p_market: market }
      );
      if (playerErr || !pid) {
        console.error('[pp-guess] player resolve failed:', playerErr?.message);
        return res.status(500).json({ error: 'Could not resolve player' });
      }
      playerId = pid;
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
