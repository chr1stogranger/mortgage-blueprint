/**
 * myBlueprint — "your Blueprint is the one shared with you".
 *
 * Works like a shared Google Sheet (Chris 2026-11-21): a loan officer shares a
 * Blueprint with a borrower's email, and from then on that Blueprint is what
 * the borrower gets when they sign in at blueprint.realstack.app. No copy and
 * no per-file link to keep. Ops answers which Blueprints an email is on
 * (`collab?resource=account&action=shared`); this module picks the one to open
 * and remembers it per person so the next visit opens without a round trip.
 *
 * The share token still exists underneath as the file's id for the Ops API.
 * It is never shown, and it is taken out of the address bar after opening.
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'https://ops.realstack.app';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// v2 (2026-11-21): the first key remembered ANY share link a person opened,
// so a loan officer who previewed a client's link was dropped into that one
// file on every visit and lost their pipeline. Only a Blueprint that Ops lists
// as shared with the person is remembered now (rememberIfMine); the old key is
// ignored, which un-sticks those devices.
const key = (uid) => `bp_mine_${uid}`;
export const NONE = 'none';
const PLAIN_PARAMS = new Set(['open', 'scenario', 'theme', 'fbclid', 'gclid', '_cb']);

export const isToken = (t) => typeof t === 'string' && UUID.test(t);

/** What this person opened last on this device: a token, 'none', or '' (unknown). */
export function recallMine(uid) {
  if (!uid) return '';
  try {
    const v = localStorage.getItem(key(uid)) || '';
    return v === NONE || isToken(v) ? v : '';
  } catch { return ''; }
}

export function rememberMine(uid, value) {
  if (!uid) return;
  try {
    if (value) localStorage.setItem(key(uid), value); else localStorage.removeItem(key(uid));
  } catch { /* private window: just ask Ops next time */ }
}

/** Blueprints shared with the signed-in email. null = could not ask. */
export async function fetchShared(accessToken) {
  if (!accessToken) return null;
  try {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), 6000) : null;
    const res = await fetch(`${API_BASE}/api/collab?resource=account&action=shared`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: ctl?.signal,
    });
    if (t) clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.shared) ? data.shared : [];
  } catch { return null; }
}

/** The shared Blueprints that can actually be opened. */
export function sharedChoices(list) {
  return (Array.isArray(list) ? list : []).filter((b) => isToken(b?.share_token));
}

/**
 * Which one opens: the one they had open last if it is still shared with
 * them, else the most recently updated (Ops sends newest first).
 */
export function pickShared(list, last = '') {
  const ok = sharedChoices(list);
  if (!ok.length) return '';
  return (ok.find((b) => b.share_token === last) || ok[0]).share_token;
}

/**
 * Should we ask instead of guessing? Only for someone on two or more
 * Blueprints, and only when a guess could be wrong: they followed an invite
 * (it may be for a different one than they opened last), or this device has
 * never opened one of them. A returning visit goes back to the last one;
 * "Shared with you" in the menu switches.
 */
export function needsChoice(list, last = '', invite = false) {
  const ok = sharedChoices(list);
  if (ok.length < 2) return false;
  if (invite) return true;
  return !ok.some((b) => b.share_token === last);
}

/**
 * After a Blueprint opens, remember it as "mine" only when Ops lists it as
 * shared with this person. The loan team can open every client's link, and
 * opening one must never become what their own sign-in opens.
 */
export async function rememberIfMine(uid, token, accessToken) {
  if (!uid || !isToken(token)) return;
  const list = await fetchShared(accessToken);
  if (!list) return; // could not ask: leave what we knew
  if (sharedChoices(list).some((b) => b.share_token === token)) rememberMine(uid, token);
  else if (recallMine(uid) === token) rememberMine(uid, sharedChoices(list).length ? '' : NONE);
}

/**
 * True when this page load may be switched to the person's shared Blueprint:
 * the plain Blueprint home, with nothing in the address that asks for
 * something else (a listing, a co-brand page, My Account, an embed, PricePoint).
 */
export function canOpenMine(loc = window.location) {
  try {
    const host = loc.hostname || '';
    if (host.startsWith('pricepoint.') || host.startsWith('markets.')) return false;
    if (!(loc.pathname === '/' || loc.pathname === '/blueprint')) return false;
    // Inside a frame (the Ops side panel, an LO's website) it is never a
    // borrower's own visit.
    try { if (window.self !== window.top) return false; } catch { return false; }
    // Anything else in the address asks for something specific (a listing, a
    // client, My Account, a prefilled price): leave those alone.
    for (const k of new URLSearchParams(loc.search).keys()) {
      if (!PLAIN_PARAMS.has(k) && !k.startsWith('utm_')) return false;
    }
    return true;
  } catch { return false; }
}

/** `?open=1`: an invite. Ask for sign-in, then open what is shared with them. */
export function wantsOpen(loc = window.location) {
  try { return new URLSearchParams(loc.search).has('open'); } catch { return false; }
}

/** Take the file id (and the invite flag) out of the address bar. */
export function cleanAddress() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('share') && !url.searchParams.has('open')) return;
    url.searchParams.delete('share');
    url.searchParams.delete('open');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  } catch { /* leave it */ }
}
