// /api/pp-player.js — Vercel Serverless Function
// ─────────────────────────────────────────────────────────────────────────────
// Cross-device account sync. PricePoint players were purely device-scoped
// (pp_players.device_id from localStorage), so the same signed-in human on a
// phone and a laptop was two unrelated players: separate XP/levels, and homes
// guessed on one device re-served on the other.
//
// POST { deviceId }  +  Authorization: Bearer <supabase access token>
//   1. Verifies the token → auth user.
//   2. Resolves ONE canonical player for that user (oldest pp_players row with
//      this auth_user_id; else adopts/creates this device's player).
//   3. If this device had a DIFFERENT anonymous player, merges it into the
//      canonical one: guesses + predictions repointed (unique-key collisions
//      dropped), XP summed, the orphan row deleted.
//   4. Returns the canonical identity + everything the client needs to hydrate
//      its local exclusion sets so guessed homes never re-serve cross-device.
//
// Response: { playerId, totalXp, level, displayName,
//             liveZpids: [...], guessedZpids: [...] }
//
// (New standalone route — the Vercel 12-function Hobby cap was lifted by the
// Pro upgrade on 2026-07-24.)

import { createClient } from '@supabase/supabase-js';
import { applyCors } from './_cors.js';
import { rateLimited } from './_ratelimit.js';

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function handler(req, res) {
  if (applyCors(req, res, { methods: 'POST, OPTIONS' })) return;
  if (rateLimited(req, res, { limit: 15 })) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Server not configured' });

  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!bearer) return res.status(401).json({ error: 'Sign-in required' });

  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser(bearer);
    if (!error) user = data?.user || null;
  } catch { /* fall through to 401 */ }
  if (!user?.id) return res.status(401).json({ error: 'Invalid session' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const deviceId = String(body?.deviceId || '').trim();

  try {
    // ── Canonical player: oldest row already linked to this auth user ──
    const { data: canonRow } = await supabase
      .from('pp_players')
      .select('id, total_xp, current_level, display_name')
      .eq('auth_user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    let canonical = canonRow || null;

    // ── This device's (possibly anonymous) player ──
    let devicePlayer = null;
    if (deviceId) {
      const { data } = await supabase
        .from('pp_players')
        .select('id, total_xp, current_level, display_name, auth_user_id')
        .eq('device_id', deviceId)
        .maybeSingle();
      devicePlayer = data || null;
    }

    if (!canonical && devicePlayer) {
      // First sign-in anywhere: this device's history becomes the account.
      await supabase.from('pp_players').update({ auth_user_id: user.id }).eq('id', devicePlayer.id);
      canonical = devicePlayer;
    } else if (!canonical) {
      // Signed in on a device that never played: create the player now.
      const { data: pid, error: rpcErr } = await supabase.rpc('pp_get_or_create_player',
        { p_device_id: deviceId || `auth-${user.id}`, p_market: 'sf' });
      if (rpcErr || !pid) {
        console.error('[pp-player] create failed:', rpcErr?.message);
        return res.status(500).json({ error: 'Could not create player' });
      }
      await supabase.from('pp_players').update({ auth_user_id: user.id }).eq('id', pid);
      const { data: fresh } = await supabase
        .from('pp_players').select('id, total_xp, current_level, display_name').eq('id', pid).maybeSingle();
      canonical = fresh;
    } else if (devicePlayer && devicePlayer.id !== canonical.id) {
      // ── MERGE: this device's anonymous history folds into the account ──
      // (unique keys: pp_predictions (player_id, zpid), pp_guesses (player_id,
      // daily_id) — colliding rows are dropped, the account's copy wins)
      const dupErrs = [];
      try {
        const { data: canonPreds } = await supabase
          .from('pp_predictions').select('zpid').eq('player_id', canonical.id);
        const canonZpids = new Set((canonPreds || []).map(r => String(r.zpid)));
        const { data: devPreds } = await supabase
          .from('pp_predictions').select('id, zpid').eq('player_id', devicePlayer.id);
        for (const p of devPreds || []) {
          if (canonZpids.has(String(p.zpid))) {
            await supabase.from('pp_predictions').delete().eq('id', p.id);
          } else {
            await supabase.from('pp_predictions').update({ player_id: canonical.id }).eq('id', p.id);
          }
        }
      } catch (e) { dupErrs.push(`predictions: ${e.message}`); }
      try {
        const { data: canonDailies } = await supabase
          .from('pp_guesses').select('daily_id').eq('player_id', canonical.id).not('daily_id', 'is', null);
        const canonDailyIds = new Set((canonDailies || []).map(r => r.daily_id));
        const { data: devGuesses } = await supabase
          .from('pp_guesses').select('id, daily_id').eq('player_id', devicePlayer.id);
        for (const g of devGuesses || []) {
          if (g.daily_id && canonDailyIds.has(g.daily_id)) {
            await supabase.from('pp_guesses').delete().eq('id', g.id);
          } else {
            await supabase.from('pp_guesses').update({ player_id: canonical.id }).eq('id', g.id);
          }
        }
      } catch (e) { dupErrs.push(`guesses: ${e.message}`); }
      try {
        await supabase.from('pp_notifications').update({ player_id: canonical.id }).eq('player_id', devicePlayer.id);
      } catch { /* table may not exist yet — non-fatal */ }
      if (dupErrs.length) console.error('[pp-player] merge warnings:', dupErrs.join(' | '));

      const mergedXp = (canonical.total_xp || 0) + (devicePlayer.total_xp || 0);
      const mergedLevel = Math.max(canonical.current_level || 1, devicePlayer.current_level || 1);
      const mergedName = canonical.display_name || devicePlayer.display_name || '';
      // Free the device_id (unique) before pointing the canonical row at it.
      await supabase.from('pp_players').delete().eq('id', devicePlayer.id);
      await supabase.from('pp_players').update({
        total_xp: mergedXp, current_level: mergedLevel, display_name: mergedName,
        device_id: deviceId, last_active_at: new Date().toISOString(),
      }).eq('id', canonical.id);
      canonical = { ...canonical, total_xp: mergedXp, current_level: mergedLevel, display_name: mergedName };
      console.error(`[pp-player] merged device player into account (${user.email || user.id}): +${devicePlayer.total_xp || 0}xp`);
    }

    // ── Hydration payload: everything this player has already called ──
    const { data: preds } = await supabase
      .from('pp_predictions').select('zpid').eq('player_id', canonical.id).limit(2000);
    const { data: solds } = await supabase
      .from('pp_guesses').select('zpid').eq('player_id', canonical.id)
      .in('mode', ['freeplay', 'challenge']).not('zpid', 'is', null).limit(2000);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      playerId: canonical.id,
      totalXp: canonical.total_xp || 0,
      level: canonical.current_level || 1,
      displayName: canonical.display_name || '',
      liveZpids: [...new Set((preds || []).map(r => String(r.zpid)))],
      guessedZpids: [...new Set((solds || []).map(r => String(r.zpid)))],
    });
  } catch (err) {
    console.error('[pp-player] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
