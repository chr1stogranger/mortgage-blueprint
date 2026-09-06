import { createClient } from '@supabase/supabase-js';
import { applyCors } from './_cors.js';
import { rateLimited } from './_ratelimit.js';

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── Ownership gate (CIO re-audit C-1) ───────────────────────────────────────
// This route uses the SERVICE key, which bypasses RLS — so without an explicit
// check, anyone with a player's UUID could read/overwrite their email & phone.
// Require the caller to prove they own the player row via the x-device-id
// header (same identity migration 011's RLS policies use). The web client
// sends this header on every notifications call (src/lib/pricePointDB.js).
// Returns true if ownership is verified (or there's nothing to verify yet).
async function ownsPlayer(supabase, playerId, deviceId, authUserId) {
  if (!deviceId && !authUserId) return false;
  const { data, error } = await supabase
    .from('pp_players')
    .select('device_id, auth_user_id')
    .eq('id', playerId)
    .single();
  if (error || !data) return false;
  // Signed-in callers prove ownership through their account link; anonymous
  // device players fall back to the x-device-id header.
  if (authUserId) return data.auth_user_id === authUserId;
  return data.device_id === deviceId;
}

// Resolve the Supabase user from Authorization: Bearer <jwt> (same
// auth.getUser pattern as pp-player.js). Returns null for guests.
async function authUserIdFromBearer(supabase, req) {
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!bearer) return null;
  try {
    const { data, error } = await supabase.auth.getUser(bearer);
    if (!error && data?.user?.id) return data.user.id;
  } catch (e) {
    console.error('[notifications] auth lookup failed (device fallback):', e.message);
  }
  return null;
}

// Contact validation for the preferences PUT.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s()]*$/;
const isValidEmail = (v) => v === '' || (v.length <= 254 && EMAIL_RE.test(v));
const isValidPhone = (v) => v === '' || (v.length <= 20 && PHONE_RE.test(v));

export default async function handler(req, res) {
  // Scoped CORS (now incl. Capacitor native origins) + rate limit.
  if (applyCors(req, res, { methods: 'GET, POST, PUT, DELETE, OPTIONS' })) return;
  if (rateLimited(req, res, { limit: 30 })) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Database connection failed' });
  }

  const action = req.query.action || '';
  const deviceId = req.headers['x-device-id'] || '';
  // Signed-in callers are identified by their bearer token; when present the
  // device header is not consulted for ownership.
  const authUserId = await authUserIdFromBearer(supabase, req);

  // Every operation is scoped to a playerId — resolve it (query for GET, body
  // otherwise) and verify the caller owns it before doing anything.
  const playerId = req.query.playerId || (req.body && req.body.playerId) || '';
  if (!playerId) return res.status(400).json({ error: 'playerId is required' });
  if (!(await ownsPlayer(supabase, playerId, deviceId, authUserId))) {
    return res.status(403).json({ error: 'Not authorized for this player' });
  }

  // ─── GET ────────────────────────────────────────────────────────────
  if (req.method === 'GET') {

    // GET /api/notifications?action=preferences&playerId=UUID
    if (action === 'preferences') {
      try {
        const { data, error } = await supabase
          .from('pp_players')
          .select('push_enabled, email_enabled, sms_enabled, email, phone')
          .eq('id', playerId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') return res.status(404).json({ error: 'Player not found' });
          console.error('Supabase error:', error);
          return res.status(500).json({ error: error.message });
        }
        return res.status(200).json(data || {});
      } catch (err) {
        console.error('Error fetching preferences:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    // GET /api/notifications?action=h2h&playerId=UUID — head-to-head W/L record
    if (action === 'h2h') {
      try {
        const { data, error } = await supabase
          .from('pp_players')
          .select('h2h')
          .eq('id', playerId)
          .maybeSingle();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ h2h: data?.h2h || { wins: 0, losses: 0, ties: 0 } });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // GET /api/notifications?playerId=UUID&all=1  (default — fetch notifications)
    const { all } = req.query;

    try {
      let query = supabase
        .from('pp_notifications')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false });

      if (all !== '1') query = query.eq('read', false);
      query = query.limit(all === '1' ? 100 : 50);

      const { data, error } = await query;
      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: error.message });
      }

      const unreadCount = data.filter(n => !n.read).length;
      return res.status(200).json({ notifications: data || [], unreadCount });
    } catch (err) {
      console.error('Error fetching notifications:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ─── POST ───────────────────────────────────────────────────────────
  if (req.method === 'POST') {

    // POST /api/notifications?action=h2h  { h2h:{wins,losses,ties} }
    // Last-write-wins sync of the head-to-head record (client reconciles by
    // adopting whichever side has more decided games, so this only grows).
    if (action === 'h2h') {
      const rec = (req.body && req.body.h2h) || {};
      const clean = {
        wins: Math.max(0, parseInt(rec.wins, 10) || 0),
        losses: Math.max(0, parseInt(rec.losses, 10) || 0),
        ties: Math.max(0, parseInt(rec.ties, 10) || 0),
      };
      try {
        const { error } = await supabase.from('pp_players').update({ h2h: clean }).eq('id', playerId);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true, h2h: clean });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // POST /api/notifications?action=register  — register device token
    if (action === 'register') {
      const { token, platform } = req.body;
      if (!token || !platform) {
        return res.status(400).json({ error: 'token and platform are required' });
      }
      if (!['ios', 'android', 'web'].includes(platform)) {
        return res.status(400).json({ error: 'platform must be ios, android, or web' });
      }

      try {
        const { error: upsertError } = await supabase
          .from('pp_device_tokens')
          .upsert({
            player_id: playerId,
            token,
            platform,
            last_used_at: new Date().toISOString(),
          }, { onConflict: 'player_id,token' });

        if (upsertError) {
          console.error('Supabase upsert error:', upsertError);
          return res.status(500).json({ error: upsertError.message });
        }

        // Auto-enable push for this player
        const { error: playerError } = await supabase
          .from('pp_players')
          .update({ push_enabled: true })
          .eq('id', playerId);

        if (playerError) {
          console.error('Supabase player update error:', playerError);
          return res.status(500).json({ error: playerError.message });
        }

        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('Error registering device:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    // POST /api/notifications  (default — mark as read)
    const { notificationIds, markAllRead } = req.body;

    try {
      let updateQuery = supabase
        .from('pp_notifications')
        .update({ read: true })
        .eq('player_id', playerId);

      if (markAllRead) {
        updateQuery = updateQuery.eq('read', false);
      } else if (Array.isArray(notificationIds) && notificationIds.length > 0) {
        updateQuery = updateQuery.in('id', notificationIds);
      } else {
        return res.status(400).json({ error: 'notificationIds or markAllRead is required' });
      }

      const { error, count } = await updateQuery;
      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ updated: count || 0 });
    } catch (err) {
      console.error('Error marking notifications as read:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ─── PUT ────────────────────────────────────────────────────────────
  // PUT /api/notifications  — update notification preferences
  if (req.method === 'PUT') {
    const { push_enabled, email_enabled, sms_enabled, email, phone } = req.body;

    try {
      const updateData = {};
      if (typeof push_enabled === 'boolean') updateData.push_enabled = push_enabled;
      if (typeof email_enabled === 'boolean') updateData.email_enabled = email_enabled;
      if (typeof sms_enabled === 'boolean') updateData.sms_enabled = sms_enabled;
      if (typeof email === 'string') {
        const v = email.trim();
        if (!isValidEmail(v)) return res.status(400).json({ error: 'That email does not look right.' });
        updateData.email = v;
      }
      if (typeof phone === 'string') {
        const v = phone.trim();
        if (!isValidPhone(v)) return res.status(400).json({ error: 'That phone number does not look right.' });
        updateData.phone = v;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'At least one preference field is required' });
      }

      const { data, error } = await supabase
        .from('pp_players')
        .update(updateData)
        .eq('id', playerId)
        .select('push_enabled, email_enabled, sms_enabled, email, phone')
        .single();

      if (error) {
        if (error.code === 'PGRST116') return res.status(404).json({ error: 'Player not found' });
        console.error('Supabase error:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true, preferences: data || {} });
    } catch (err) {
      console.error('Error updating preferences:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ─── DELETE ─────────────────────────────────────────────────────────
  // DELETE /api/notifications  — unregister device token
  if (req.method === 'DELETE') {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    try {
      const { error } = await supabase
        .from('pp_device_tokens')
        .delete()
        .eq('player_id', playerId)
        .eq('token', token);

      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Error unregistering device:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
