// api/team-tap.js — POST /api/team-tap: counts one tap on a loan officer /
// agent contact control (src/lib/teamTap.js), so the placements can be
// compared. Table: migrations/027_team_taps.sql.
//
// Always answers 204: a tap count must never get in the way of the call.
// Counts only: no share token, borrower id, IP or user agent is stored.
import { applyCors } from './_cors.js';
import { rateLimited } from './_ratelimit.js';
import { getSupabaseAdmin } from './_handoffs.js';

const SURFACES = ['card', 'sidebar', 'rail', 'strip', 'sheet'];
const ACTIONS = ['call', 'text', 'email', 'open'];
const pick = (v, allowed) => (allowed.includes(v) ? v : null);

export default async function handler(req, res) {
  if (applyCors(req, res, { methods: 'POST, OPTIONS' })) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'method' }); return; }
  if (rateLimited(req, res, { limit: 30 })) return;

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  const surface = pick(b?.surface, SURFACES);
  const action = pick(b?.action, ACTIONS);
  if (!surface || !action) { res.status(400).json({ error: 'fields' }); return; }

  const sb = getSupabaseAdmin();
  if (sb) {
    const partner = typeof b.partner === 'string' && /^[a-z0-9-]{1,40}$/.test(b.partner) ? b.partner : null;
    // Missing table (migration not run yet) or any other error: drop the tap.
    await sb.from('team_taps').insert({
      surface, action,
      who: pick(b.who, ['lo', 'agent']),
      audience: pick(b.audience, ['partner', 'borrower']),
      device: pick(b.device, ['phone', 'desktop']),
      partner,
    }).then(() => {}, () => {});
  }
  res.status(204).end();
}
