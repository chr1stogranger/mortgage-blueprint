// api/plan.js — GET /api/plan?t=<token>: the "open in Blueprint" handoff
// created by the MCP server's open_in_blueprint tool (api/mcp.js). Returns
// the stored property + loan fields and records the open (the lead signal).
//
// 404 unknown token · 410 expired · 503 table not migrated yet
// (migrations/026_mcp_handoffs.sql). no-store: the edge caches /api/* GETs
// otherwise, which would also skip the open_count update.
import { applyCors } from './_cors.js';
import { rateLimited } from './_ratelimit.js';
import { getSupabaseAdmin, isMissingTable, TABLE } from './_handoffs.js';
import { LISTING_TOKEN_RE } from '../src/lib/listingPrefill.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.status(405).json({ error: 'method' }); return; }
  if (rateLimited(req, res, { limit: 30 })) return;

  const t = typeof req.query?.t === 'string' ? req.query.t : '';
  if (!LISTING_TOKEN_RE.test(t)) { res.status(400).json({ error: 'token' }); return; }
  const sb = getSupabaseAdmin();
  if (!sb) { res.status(503).json({ error: 'unavailable' }); return; }

  const { data: row, error } = await sb.from(TABLE)
    .select('id, source_tool, client, payload, expires_at, opened_at, open_count')
    .eq('token', t).maybeSingle();
  if (error) { res.status(isMissingTable(error) ? 503 : 500).json({ error: 'unavailable' }); return; }
  if (!row) { res.status(404).json({ error: 'not_found' }); return; }
  if (new Date(row.expires_at).getTime() < Date.now()) { res.status(410).json({ error: 'expired' }); return; }

  // Not atomic, but opens are rare and this is a lead signal, not a ledger.
  await sb.from(TABLE)
    .update({ opened_at: row.opened_at || new Date().toISOString(), open_count: (row.open_count || 0) + 1 })
    .eq('id', row.id);

  res.status(200).json({ ...(row.payload || {}), kind: 'plan', sourceTool: row.source_tool, client: row.client });
}
