import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const ALLOWED_ORIGINS = [
  "https://blueprint.realstack.app",
  "https://mortgage-blueprint.vercel.app",
  "http://localhost:5173",
];

function setCorsHeaders(res, origin) {
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  setCorsHeaders(res, origin);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Database connection failed' });
  }

  const action = req.query.action || '';

  // ─── GET ────────────────────────────────────────────────────────────
  if (req.method === 'GET') {

    // GET /api/notifications?action=preferences&playerId=UUID
    if (action === 'preferences') {
      const { playerId } = req.query;
      if (!playerId) return res.status(400).json({ error: 'playerId is required' });

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

    // GET /api/notifications?playerId=UUID&all=1  (default — fetch notifications)
    const { playerId, all } = req.query;
    if (!playerId) return res.status(400).json({ error: 'playerId is required' });

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

    // POST /api/notifications?action=register  — register device token
    if (action === 'register') {
      const { playerId, token, platform } = req.body;
      if (!playerId || !token || !platform) {
        return res.status(400).json({ error: 'playerId, token, and platform are required' });
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
    const { playerId, notificationIds, markAllRead } = req.body;
    if (!playerId) return res.status(400).json({ error: 'playerId is required' });

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
    const { playerId, push_enabled, email_enabled, sms_enabled, email, phone } = req.body;
    if (!playerId) return res.status(400).json({ error: 'playerId is required' });

    try {
      const updateData = {};
      if (typeof push_enabled === 'boolean') updateData.push_enabled = push_enabled;
      if (typeof email_enabled === 'boolean') updateData.email_enabled = email_enabled;
      if (typeof sms_enabled === 'boolean') updateData.sms_enabled = sms_enabled;
      if (typeof email === 'string') updateData.email = email;
      if (typeof phone === 'string') updateData.phone = phone;

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
    const { playerId, token } = req.body;
    if (!playerId || !token) {
      return res.status(400).json({ error: 'playerId and token are required' });
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
