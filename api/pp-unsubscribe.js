// /api/pp-unsubscribe.js — Vercel Serverless Function
// ─────────────────────────────────────────────────────────────────────────────
// One-click unsubscribe for PricePoint email (CAN-SPAM; Gmail/Yahoo bulk-sender
// rules). Links are built by api/_ppUnsub.js:
//   GET  /api/pp-unsubscribe?p=<player id>&t=<hmac>  — footer click, returns a page
//   POST /api/pp-unsubscribe?p=<player id>&t=<hmac>  — RFC 8058 one-click (mail apps)
//
// Public by design; the HMAC token is the auth. Turns off pp_players.email_enabled
// — the same switch as Settings → Notifications, so the player can turn it back
// on in the app. Push and SMS preferences are left alone.

import { createClient } from '@supabase/supabase-js';
import { rateLimited } from './_ratelimit.js';
import { verifyUnsubToken } from './_ppUnsub.js';

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;background:#0a1120;color:#E6EAF2;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<div style="max-width:420px;padding:40px 24px;text-align:center;">
<div style="font-size:12px;font-weight:700;letter-spacing:2px;color:#3B6BF5;text-transform:uppercase;margin-bottom:16px;">PricePoint</div>
<div style="font-size:20px;font-weight:700;margin-bottom:12px;">${esc(title)}</div>
<div style="font-size:14px;color:#9AA4B8;line-height:1.6;">${body}</div>
</div></body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).send('Method not allowed');
  }
  if (rateLimited(req, res, { limit: 20 })) return;

  const html = (status, title, body) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(status).send(page(title, body));
  };

  const playerId = String(req.query?.p || '').trim();
  const valid = playerId.length > 0 && playerId.length <= 64 && verifyUnsubToken(playerId, req.query?.t);
  if (!valid) {
    if (req.method === 'POST') return res.status(400).json({ error: 'invalid link' });
    return html(400, 'Link not valid', 'This unsubscribe link is invalid or incomplete. Turn off Email in PricePoint\'s notification settings, or reply to the email and we will remove you.');
  }

  const supabase = getSupabaseAdmin();
  try {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.from('pp_players').update({ email_enabled: false }).eq('id', playerId);
    if (error) throw error;
  } catch (e) {
    console.error('[pp-unsubscribe]', e.message);
    if (req.method === 'POST') return res.status(500).json({ error: 'try again' });
    return html(500, 'Something went wrong', 'We could not process the unsubscribe. Reply to the email you received and we will remove you.');
  }

  if (req.method === 'POST') return res.status(200).json({ ok: true });
  return html(200, "You're unsubscribed", 'You will no longer receive PricePoint emails. You can turn them back on any time in PricePoint\'s notification settings.');
}
