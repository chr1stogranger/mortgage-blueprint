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
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
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

  // GET /api/notification-preferences?playerId=UUID
  if (req.method === 'GET') {
    const { playerId } = req.query;

    if (!playerId) {
      return res.status(400).json({ error: 'playerId is required' });
    }

    try {
      const { data, error } = await supabase
        .from('pp_players')
        .select('push_enabled, email_enabled, sms_enabled, email, phone')
        .eq('id', playerId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Player not found' });
        }
        console.error('Supabase error:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(data || {});
    } catch (err) {
      console.error('Error fetching preferences:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // PUT /api/notification-preferences
  if (req.method === 'PUT') {
    const { playerId, push_enabled, email_enabled, sms_enabled, email, phone } = req.body;

    if (!playerId) {
      return res.status(400).json({ error: 'playerId is required' });
    }

    try {
      // Build update object with only provided fields
      const updateData = {};

      if (typeof push_enabled === 'boolean') {
        updateData.push_enabled = push_enabled;
      }
      if (typeof email_enabled === 'boolean') {
        updateData.email_enabled = email_enabled;
      }
      if (typeof sms_enabled === 'boolean') {
        updateData.sms_enabled = sms_enabled;
      }
      if (typeof email === 'string') {
        updateData.email = email;
      }
      if (typeof phone === 'string') {
        updateData.phone = phone;
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
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Player not found' });
        }
        console.error('Supabase error:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({
        success: true,
        preferences: data || {},
      });
    } catch (err) {
      console.error('Error updating preferences:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
