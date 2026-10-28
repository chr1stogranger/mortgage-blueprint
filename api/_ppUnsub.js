// api/_ppUnsub.js — one-click unsubscribe + compliance footer for PricePoint email.
//
// Every PricePoint email carries a List-Unsubscribe header (RFC 8058 one-click)
// and a footer link to /api/pp-unsubscribe, plus the sender's company, NMLS and
// postal address (CAN-SPAM). The link is authenticated by an HMAC of the
// player id, so it works without signing in and can't be forged for another
// player.
//
// Key: UNSUBSCRIBE_SECRET if set, else CRON_SECRET (domain-separated below, so
// a token never doubles as anything the cron secret unlocks). Rotating the key
// invalidates links in emails already sent — the endpoint then tells the
// reader to reply and be removed by hand.
//
// The postal address is NOT hard-coded: it is read from the legacy workspace's
// Ops campaign_settings (CRM → Sender & compliance), the same row that signs
// every Ops marketing email, so there is one place to change it. MAILING_ADDRESS
// env overrides it.

import { createHmac } from 'node:crypto';
import { safeEq } from './_safeEq.js';

const BASE_URL = 'https://blueprint.realstack.app';
const LEGACY_TENANT_ID = '784a8ac9-23ca-4cf5-916a-35d9eee05563'; // Chris's Ops workspace

function key() {
  return process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || '';
}

export function unsubToken(playerId) {
  const k = key();
  if (!k || !playerId) return '';
  return createHmac('sha256', k).update(`pp-unsub:${playerId}`).digest('base64url');
}

export function verifyUnsubToken(playerId, token) {
  const expected = unsubToken(playerId);
  return !!expected && safeEq(String(token || ''), expected);
}

export function unsubUrl(playerId) {
  return `${BASE_URL}/api/pp-unsubscribe?p=${encodeURIComponent(playerId)}&t=${encodeURIComponent(unsubToken(playerId))}`;
}

/** Headers for the Resend payload: Gmail/Yahoo/Apple show their own "Unsubscribe" button. */
export function unsubHeaders(playerId) {
  return {
    'List-Unsubscribe': `<${unsubUrl(playerId)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

export const FALLBACK_SENDER ={ company: 'Xpert Home Lending, Inc.', nmls: '952015', companyNmls: '2179191', address: '' };

/**
 * Sender identity for the footer. Never throws — a lookup failure falls back
 * to the company/NMLS line (logged), since a missing address must not stop
 * delivery of a notification the player asked for.
 */
export async function loadSender(supabase) {
  const sender = { ...FALLBACK_SENDER, address: process.env.MAILING_ADDRESS || '' };
  if (sender.address) return sender;
  try {
    const { data } = await supabase.from('campaign_settings')
      .select('postal_address')
      .eq('tenant_id', LEGACY_TENANT_ID)
      .neq('postal_address', '')
      .limit(1).maybeSingle();
    if (data?.postal_address) sender.address = data.postal_address;
  } catch (e) {
    console.error(`[ppUnsub] sender lookup failed: ${e.message}`);
  }
  if (!sender.address) console.error('[ppUnsub] no mailing address — set it in Ops (CRM → Sender & compliance) or MAILING_ADDRESS');
  return sender;
}
