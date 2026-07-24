/**
 * PricePoint ↔ Supabase helper module.
 *
 * All PricePoint database operations go through here.
 * Uses the ANON key client (same singleton from supabaseClient.js).
 * RLS policies on the pp_* tables enforce access control.
 *
 * Device ID is generated once and stored in localStorage.
 * This lets anonymous users have persistent identity across sessions.
 */

import { getSupabaseClient, getSession } from './supabaseClient';
import { apiUrl } from '../apiBase';

// ── Auth header (cross-device identity) ────────────────────────────────
// When the user is signed in, API calls carry the Supabase access token so
// the server resolves guesses/scoreboards to their ACCOUNT player instead of
// the per-device anonymous one. Guests get {} and keep device identity.
async function authHeader() {
  try {
    const session = await getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  } catch {
    return {};
  }
}

// ── Device ID (anonymous fingerprint) ──────────────────────────────────

const DEVICE_ID_KEY = 'pp-device-id';

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    // Fallback for environments without localStorage
    return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}


// ── Player Registration ────────────────────────────────────────────────

/**
 * Get or create an anonymous player.
 * Uses the pp_get_or_create_player() Postgres function (SECURITY DEFINER).
 * Returns the player UUID.
 */
export async function getOrCreatePlayer(marketId = 'sf') {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const deviceId = getDeviceId();

  const { data, error } = await supabase.rpc('pp_get_or_create_player', {
    p_device_id: deviceId,
    p_market: marketId,
  });

  if (error) {
    console.error('[PricePointDB] getOrCreatePlayer error:', error.message);
    return null;
  }

  return data; // UUID
}

/**
 * Fetch the full player record.
 */
export async function getPlayer(playerId) {
  const supabase = getSupabaseClient();
  if (!supabase || !playerId) return null;

  const { data, error } = await supabase
    .from('pp_players')
    .select('*')
    .eq('id', playerId)
    .single();

  if (error) {
    console.error('[PricePointDB] getPlayer error:', error.message);
    return null;
  }
  return data;
}


// ── Daily Challenge ────────────────────────────────────────────────────

/**
 * Fetch today's daily challenge for a market.
 * Calls the server-side API which seeds the daily if missing.
 * Returns challenge data WITHOUT sold_price (that comes after guess).
 */
export async function fetchDaily(marketId) {
  try {
    const res = await fetch(apiUrl(`/api/pp-daily?market=${marketId}`));
    if (!res.ok) {
      console.error('[PricePointDB] fetchDaily HTTP error:', res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('[PricePointDB] fetchDaily error:', err.message);
    return null;
  }
}

/**
 * Check if this player already guessed today's daily.
 */
export async function getExistingDailyGuess(playerId, dailyId) {
  const supabase = getSupabaseClient();
  if (!supabase || !playerId || !dailyId) return null;

  const { data, error } = await supabase
    .from('pp_guesses')
    .select('*')
    .eq('player_id', playerId)
    .eq('daily_id', dailyId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error('[PricePointDB] getExistingDailyGuess error:', error.message);
  }
  return data || null;
}


// ── Guess Submission ───────────────────────────────────────────────────

/**
 * Submit a guess (Daily, Free Play, or Live).
 * Returns the inserted row (with id) or null on error.
 */
// Submit a guess through the server-scored endpoint (/api/pp-guess). The server
// determines the sold price it controls, scores the guess, inserts into pp_guesses
// with the service-role key (bypasses RLS — fixes the silent-loss problem for
// stale/native clients), and increments XP via pp_award_xp.
//
// Signature stays compatible with the three call sites in PricePoint.jsx. The
// server ignores any client-computed pct_off/accuracy_band/xp and recomputes them,
// so passing them is harmless. Returns the endpoint's JSON response:
//   { ok, guessId, playerId, soldPrice, pctOff, accuracyBand, xpEarned, totalXp,
//     level, alreadyGuessed }  — or { queued: true } when offline.
const PENDING_KEY = 'pp-pending-guesses';
const PENDING_CAP = 50;

function buildGuessBody(p) {
  return {
    deviceId: getDeviceId(),           // payload carries its own device id so the
    marketId: p.marketId || 'sf',      // offline queue can flush without a playerId
    mode: p.mode,
    dailyId: p.dailyId || null,
    zpid: p.zpid || null,
    address: p.address || '',
    neighborhood: p.neighborhood || '',
    city: p.city || '',
    zip: p.zip || '',
    propertyType: p.propertyType || '',
    beds: p.beds ?? null,
    baths: p.baths ?? null,
    sqft: p.sqft ?? null,
    listPrice: p.listPrice ?? null,
    photo: p.photo || '',
    guess: p.guess,
    guessTimeMs: p.guessTimeMs ?? null,
    clientSoldPrice: p.soldPrice ?? p.clientSoldPrice ?? null,
  };
}

function queuePendingGuess(body) {
  try {
    const q = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    q.push({ body, ts: Date.now() });
    while (q.length > PENDING_CAP) q.shift(); // cap 50, drop oldest
    localStorage.setItem(PENDING_KEY, JSON.stringify(q));
  } catch { /* localStorage unavailable — nothing we can do */ }
}

export async function submitGuess(payload) {
  const body = buildGuessBody(payload);
  try {
    const res = await fetch(apiUrl('/api/pp-guess'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // 4xx = unrecoverable (bad payload / rejected) — don't queue forever.
      if (res.status >= 400 && res.status < 500) {
        console.warn('[PricePointDB] submitGuess rejected:', res.status);
        return null;
      }
      throw new Error('HTTP ' + res.status); // 5xx → retry queue
    }
    return await res.json();
  } catch (err) {
    queuePendingGuess(body);
    console.warn('[PricePointDB] submitGuess queued for retry:', err.message);
    return { queued: true };
  }
}

// Drain the offline queue. Called on app mount and on the window 'online' event.
// Each payload carries its own deviceId, so this works with no playerId in scope.
export async function flushPendingGuesses() {
  let q;
  try { q = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return; }
  if (!Array.isArray(q) || q.length === 0) return;

  const remaining = [];
  const auth = await authHeader();
  for (const item of q) {
    try {
      const res = await fetch(apiUrl('/api/pp-guess'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify(item.body),
      });
      // 2xx (saved, incl. alreadyGuessed) or 4xx (unrecoverable) → drop.
      // 5xx → keep for the next flush.
      if (!res.ok && res.status >= 500) remaining.push(item);
    } catch {
      remaining.push(item); // still offline
    }
  }
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(remaining)); } catch { /* ignore */ }
}


// ── Live Predictions ───────────────────────────────────────────────────

/**
 * Fetch the group scoreboard for one property: every player's locked
 * prediction on that zpid (name, guess, timestamp, `you` flag). Sends this
 * device's own id so the server can mark our row without exposing player ids.
 */
export async function fetchPropertyCalls(zpid) {
  if (!zpid) return null;
  try {
    const res = await fetch(apiUrl(
      `/api/pp-guess?zpid=${encodeURIComponent(zpid)}&deviceId=${encodeURIComponent(getDeviceId())}`
    ), { headers: await authHeader() });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Cross-device sync: link this device to the signed-in user's canonical
 * player (merging any anonymous local history server-side) and return the
 * account identity + every zpid the account has already called, so local
 * exclusion sets can hydrate. Returns null when signed out.
 */
export async function syncPlayer() {
  const auth = await authHeader();
  if (!auth.Authorization) return null;
  try {
    const res = await fetch(apiUrl('/api/pp-player'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ deviceId: getDeviceId() }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Submit a live prediction (also creates a guess row).
 */
export async function submitPrediction({
  playerId,
  marketId,
  guessId,     // from the guess row
  zpid,
  address,
  neighborhood,
  listPrice,
  predictedPrice,
}) {
  const supabase = getSupabaseClient();
  if (!supabase || !playerId) return null;

  const { data, error } = await supabase
    .from('pp_predictions')
    .insert({
      player_id: playerId,
      market_id: marketId || 'sf',
      guess_id: guessId || null,
      zpid,
      address: address || '',
      neighborhood: neighborhood || '',
      list_price: listPrice || null,
      predicted_price: predictedPrice,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      console.warn('[PricePointDB] Duplicate prediction for this property');
      return null;
    }
    console.error('[PricePointDB] submitPrediction error:', error.message);
    return null;
  }

  return data;
}


// ── XP / Level ─────────────────────────────────────────────────────────
// XP is now incremented server-side by /api/pp-guess via the pp_award_xp RPC.
// The old client-side syncPlayerXP() OVERWROTE pp_players.total_xp with the
// device's local number, clobbering the server total across devices — it has
// been removed. The pp-guess response carries the authoritative totalXp/level.


// ── Display Name ──────────────────────────────────────────────────────

/**
 * Update player's display name via RPC.
 * Uses SECURITY DEFINER function that validates device_id ownership.
 */
export async function updateDisplayName(playerId, displayName) {
  const supabase = getSupabaseClient();
  if (!supabase || !playerId) return false;

  const deviceId = getDeviceId();
  const { data, error } = await supabase.rpc('pp_set_display_name', {
    p_player_id: playerId,
    p_device_id: deviceId,
    p_name: displayName.trim().slice(0, 20),
  });

  if (error) {
    console.error('[PricePointDB] updateDisplayName error:', error.message);
    return false;
  }
  return data === true;
}


// ── Leaderboard ────────────────────────────────────────────────────────

/**
 * Fetch leaderboard for a market/mode/period via pp_leaderboard_v2 (migration 012).
 * v2 adds a `rank` column, period-scaled minimums (today>=1, week>=2, all>=3),
 * and — when playerId is passed — always returns the caller's own row with its
 * true rank even if it falls outside the limit. Falls back to v1 if v2 is missing
 * (e.g. migration not yet run), so the board never hard-fails.
 */
export async function getLeaderboard(marketId, mode = 'daily', period = 'all', limit = 20, playerId = null) {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc('pp_leaderboard_v2', {
    p_market: marketId,
    p_mode: mode,
    p_period: period,
    p_limit: limit,
    p_player_id: playerId,
  });

  if (error) {
    // 42883 = function does not exist → migration 012 not applied yet. Fall back.
    if (error.code === '42883' || /pp_leaderboard_v2/.test(error.message || '')) {
      const v1 = await supabase.rpc('pp_leaderboard', {
        p_market: marketId, p_mode: mode, p_period: period, p_limit: limit,
      });
      return v1.data || [];
    }
    console.error('[PricePointDB] getLeaderboard error:', error.message);
    return [];
  }

  return data || [];
}


// ── Notifications ─────────────────────────────────────────────────────

/**
 * Fetch notifications for a player.
 * @param {string} playerId
 * @param {boolean} all - If true, fetch all (not just unread)
 */
// /api/notifications enforces device ownership (CIO re-audit C-1) — send the
// same device id the Supabase client uses so the server can verify the caller
// owns the player row. JSON helper merges Content-Type when a body is sent.
function notifHeaders(withJson = false) {
  const h = { 'x-device-id': getDeviceId() };
  if (withJson) h['Content-Type'] = 'application/json';
  return h;
}

export async function fetchNotifications(playerId, all = false) {
  if (!playerId) return { notifications: [], unreadCount: 0 };
  try {
    const url = apiUrl(`/api/notifications?playerId=${playerId}${all ? '&all=1' : ''}`);
    const res = await fetch(url, { headers: notifHeaders() });
    if (!res.ok) return { notifications: [], unreadCount: 0 };
    return await res.json();
  } catch (err) {
    console.error('[PricePointDB] fetchNotifications error:', err.message);
    return { notifications: [], unreadCount: 0 };
  }
}

/**
 * Mark notifications as read.
 */
export async function markNotificationsRead(playerId, notificationIds = null) {
  if (!playerId) return false;
  try {
    const body = { playerId };
    if (notificationIds) {
      body.notificationIds = notificationIds;
    } else {
      body.markAllRead = true;
    }
    const res = await fetch(apiUrl('/api/notifications'), {
      method: 'POST',
      headers: notifHeaders(true),
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (err) {
    console.error('[PricePointDB] markNotificationsRead error:', err.message);
    return false;
  }
}

// registerDeviceToken / unregisterDeviceToken removed — push tokens were never
// wired up (no call sites). Re-add from git history if native push ships.

/**
 * Get notification preferences for a player.
 */
export async function getNotificationPreferences(playerId) {
  if (!playerId) return null;
  try {
    const res = await fetch(apiUrl(`/api/notifications?action=preferences&playerId=${playerId}`));
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[PricePointDB] getNotificationPreferences error:', err.message);
    return null;
  }
}

/**
 * Update notification preferences.
 */
export async function updateNotificationPreferences(playerId, prefs) {
  if (!playerId) return null;
  try {
    const res = await fetch(apiUrl('/api/notifications'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, ...prefs }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[PricePointDB] updateNotificationPreferences error:', err.message);
    return null;
  }
}
