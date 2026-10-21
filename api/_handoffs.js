// api/_handoffs.js — the mcp_handoffs table (migrations/026_mcp_handoffs.sql),
// shared by /api/mcp (open_in_blueprint writes a row) and /api/plan (the app
// reads it). Service key only: the table has RLS on and no policies.
//
// Migrations don't auto-apply (CLAUDE.md), so every call tolerates the table
// being missing and reports it as "missing-table" instead of throwing.
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';

export const TABLE = 'mcp_handoffs';
export const DAILY_CAP = 1000;   // all callers, rolling 24h
export const IP_HOURLY_CAP = 60; // one ip_hash, rolling hour

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** PGRST205 = table not in PostgREST's schema cache; 42P01 = undefined table. */
export const isMissingTable = (error) => !!error && (error.code === 'PGRST205' || error.code === '42P01');

export function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '';
}

/** sha256(ip + CRON_SECRET) — the raw IP is never stored. */
export function ipHash(req) {
  const ip = clientIp(req);
  if (!ip) return null;
  return createHash('sha256').update(ip + (process.env.CRON_SECRET || '')).digest('hex');
}

/** Attribution from the caller's User-Agent: chatgpt | claude | other. */
export function detectClient(req) {
  const ua = String(req.headers['user-agent'] || '');
  if (/openai|chatgpt/i.test(ua)) return 'chatgpt';
  if (/claude|anthropic/i.test(ua)) return 'claude';
  return 'other';
}

async function countSince(sb, sinceMs, ipHashValue) {
  let q = sb.from(TABLE).select('id', { count: 'exact' }).gte('created_at', new Date(Date.now() - sinceMs).toISOString()).limit(1);
  if (ipHashValue) q = q.eq('ip_hash', ipHashValue);
  const { count, error } = await q;
  return { count: count || 0, error };
}

/**
 * Insert a handoff row after the daily and per-IP caps.
 * @returns {Promise<{token:string, expiresAt:string} | {error:"missing-table"|"paused"|"ip-cap"|"failed"}>}
 */
export async function saveHandoff({ sourceTool, payload }, { client, ipHash: ipH }) {
  const sb = getSupabaseAdmin();
  if (!sb) return { error: 'failed' };
  try {
    const day = await countSince(sb, 24 * 3600e3);
    if (day.error) return { error: isMissingTable(day.error) ? 'missing-table' : 'failed' };
    if (day.count >= DAILY_CAP) return { error: 'paused' };
    if (ipH) {
      const hour = await countSince(sb, 3600e3, ipH);
      if (hour.error) return { error: 'failed' };
      if (hour.count >= IP_HOURLY_CAP) return { error: 'ip-cap' };
    }
    const token = randomBytes(16).toString('base64url'); // 22 chars, matches LISTING_TOKEN_RE
    const { data, error } = await sb.from(TABLE)
      .insert({ token, source_tool: sourceTool, client, payload, ip_hash: ipH })
      .select('expires_at').single();
    if (error) return { error: isMissingTable(error) ? 'missing-table' : 'failed' };
    return { token, expiresAt: new Date(data.expires_at).toISOString() };
  } catch {
    return { error: 'failed' };
  }
}
