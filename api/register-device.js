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
    res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
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

  // POST /api/register-device
  if (req.method === 'POST') {
    const { playerId, token, platform } = req.body;

    if (!playerId || !token || !platform) {
      return res.status(400).json({ error: 'playerId, token, and platform are required' });
    }

    if (!['ios', 'android', 'web'].includes(platform)) {
      return res.status(400).json({ error: 'platform must be ios, android, or web' });
    }

    try {
      // Upsert device token
      const { error: upsertError } = await supabase
        .from('pp_device_tokens')
        .upsert({
          player_id: playerId,
          token,
          platform,
          last_used_at: new Date().toISOString(),
        }, {
          onConflict: 'player_id,token',
        });

      if (upsertError) {
        console.error('Supabase upsert error:', upsertError);
        return res.status(500).json({ error: upsertError.message });
      }

      // Enable push notifications for this player
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

  // DELETE /api/register-device
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
