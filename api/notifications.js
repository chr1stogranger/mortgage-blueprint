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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

  // GET /api/notifications?playerId=UUID&all=1
  if (req.method === 'GET') {
    const { playerId, all } = req.query;

    if (!playerId) {
      return res.status(400).json({ error: 'playerId is required' });
    }

    try {
      let query = supabase
        .from('pp_notifications')
        .select('*')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false });

      // If all=1, fetch all notifications; otherwise fetch unread only
      if (all !== '1') {
        query = query.eq('read', false);
      }

      const limit = all === '1' ? 100 : 50;
      query = query.limit(limit);

      const { data, error } = await query;

      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: error.message });
      }

      const unreadCount = data.filter(n => !n.read).length;

      return res.status(200).json({
        notifications: data || [],
        unreadCount,
      });
    } catch (err) {
      console.error('Error fetching notifications:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // POST /api/notifications — mark as read
  if (req.method === 'POST') {
    const { playerId, notificationIds, markAllRead } = req.body;

    if (!playerId) {
      return res.status(400).json({ error: 'playerId is required' });
    }

    try {
      let updateQuery = supabase
        .from('pp_notifications')
        .update({ read: true })
        .eq('player_id', playerId);

      // Mark specific notifications or all unread
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

  return res.status(405).json({ error: 'Method not allowed' });
}
