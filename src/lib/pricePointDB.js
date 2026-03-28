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

import { getSupabaseClient } from './supabaseClient';

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
    const res = await fetch(`/api/pp-daily?market=${marketId}`);
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
export async function submitGuess({
  playerId,
  marketId,
  mode,        // 'daily' | 'freeplay' | 'live'
  dailyId,     // UUID or null
  zpid,
  address,
  neighborhood,
  city,
  zip,
  propertyType,
  beds,
  baths,
  sqft,
  listPrice,
  photo,
  guess,       // the player's price guess (integer)
  soldPrice,   // actual sold price (null for live)
  pctOff,      // abs % difference (null for live)
  accuracyBand, // 'bullseye','sharp','solid','tricky','surprise' (null for live)
  xpEarned,
  guessTimeMs,
}) {
  const supabase = getSupabaseClient();
  if (!supabase || !playerId) return null;

  const row = {
    player_id: playerId,
    market_id: marketId || 'sf',
    mode,
    daily_id: dailyId || null,
    zpid: zpid || null,
    address: address || '',
    neighborhood: neighborhood || '',
    city: city || '',
    zip: zip || '',
    property_type: propertyType || '',
    beds: beds || null,
    baths: baths || null,
    sqft: sqft || null,
    list_price: listPrice || null,
    photo: photo || '',
    guess,
    sold_price: soldPrice || null,
    pct_off: pctOff != null ? parseFloat(pctOff) : null,
    accuracy_band: accuracyBand || null,
    xp_earned: xpEarned || 0,
    guess_time_ms: guessTimeMs || null,
  };

  const { data, error } = await supabase
    .from('pp_guesses')
    .insert(row)
    .select()
    .single();

  if (error) {
    // Duplicate daily guess (unique constraint) — not an error, just return null
    if (error.code === '23505') {
      console.warn('[PricePointDB] Duplicate guess (already submitted)');
      return null;
    }
    console.error('[PricePointDB] submitGuess error:', error.message);
    return null;
  }

  return data;
}


// ── Live Predictions ───────────────────────────────────────────────────

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


// ── XP / Level Sync ────────────────────────────────────────────────────

/**
 * Update player's total XP and level in Supabase.
 * Called after each guess is scored.
 */
export async function syncPlayerXP(playerId, totalXp, currentLevel) {
  const supabase = getSupabaseClient();
  if (!supabase || !playerId) return;

  const { error } = await supabase
    .from('pp_players')
    .update({
      total_xp: totalXp,
      current_level: currentLevel,
      last_active_at: new Date().toISOString(),
    })
    .eq('id', playerId);

  if (error) {
    console.error('[PricePointDB] syncPlayerXP error:', error.message);
  }
}


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
 * Fetch leaderboard for a market/mode/period.
 * Uses the pp_leaderboard() Postgres function.
 */
export async function getLeaderboard(marketId, mode = 'daily', period = 'all', limit = 20) {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc('pp_leaderboard', {
    p_market: marketId,
    p_mode: mode,
    p_period: period,
    p_limit: limit,
  });

  if (error) {
    console.error('[PricePointDB] getLeaderboard error:', error.message);
    return [];
  }

  return data || [];
}


// ── Player Stats ───────────────────────────────────────────────────────

/**
 * Fetch a player's guess history for stats display.
 */
export async function getPlayerGuesses(playerId, marketId, mode, limit = 50) {
  const supabase = getSupabaseClient();
  if (!supabase || !playerId) return [];

  let query = supabase
    .from('pp_guesses')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (marketId) query = query.eq('market_id', marketId);
  if (mode) query = query.eq('mode', mode);

  const { data, error } = await query;

  if (error) {
    console.error('[PricePointDB] getPlayerGuesses error:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Fetch a player's unresolved live predictions.
 */
export async function getPlayerPredictions(playerId, resolved = false) {
  const supabase = getSupabaseClient();
  if (!supabase || !playerId) return [];

  const { data, error } = await supabase
    .from('pp_predictions')
    .select('*')
    .eq('player_id', playerId)
    .eq('resolved', resolved)
    .order('predicted_at', { ascending: false });

  if (error) {
    console.error('[PricePointDB] getPlayerPredictions error:', error.message);
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
export async function fetchNotifications(playerId, all = false) {
  if (!playerId) return { notifications: [], unreadCount: 0 };
  try {
    const url = `/api/notifications?playerId=${playerId}${all ? '&all=1' : ''}`;
    const res = await fetch(url);
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
    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (err) {
    console.error('[PricePointDB] markNotificationsRead error:', err.message);
    return false;
  }
}

/**
 * Register a device token for push notifications.
 */
export async function registerDeviceToken(playerId, token, platform) {
  if (!playerId || !token) return false;
  try {
    const res = await fetch('/api/register-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, token, platform }),
    });
    return res.ok;
  } catch (err) {
    console.error('[PricePointDB] registerDeviceToken error:', err.message);
    return false;
  }
}

/**
 * Unregister a device token.
 */
export async function unregisterDeviceToken(playerId, token) {
  if (!playerId || !token) return false;
  try {
    const res = await fetch('/api/register-device', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, token }),
    });
    return res.ok;
  } catch (err) {
    console.error('[PricePointDB] unregisterDeviceToken error:', err.message);
    return false;
  }
}

/**
 * Get notification preferences for a player.
 */
export async function getNotificationPreferences(playerId) {
  if (!playerId) return null;
  try {
    const res = await fetch(`/api/notification-preferences?playerId=${playerId}`);
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
    const res = await fetch('/api/notification-preferences', {
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
