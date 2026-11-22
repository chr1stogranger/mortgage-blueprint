import { apiUrl } from "../apiBase";

/**
 * Tap counting for the loan officer / agent contact controls (top card,
 * desktop sidebar + rail, phone strip + sheet), so the placements can be
 * compared. POST /api/team-tap → public.team_taps (migration 027).
 *
 * Counts only: surface, action, who, audience, device and the partner slug.
 * Fire-and-forget with keepalive, because a tel:/sms:/mailto: tap can take
 * the page to the background before a normal request finishes.
 */
let ctx = { audience: null, device: null, partner: null };

/** Set once by MortgageBlueprint; the buttons themselves know only their surface. */
export function setTeamTapContext(next) {
  ctx = { ...ctx, ...next };
}

/** surface: card | sidebar | rail | strip | sheet · action: call | text | email | open · who: lo | agent */
export function logTeamTap(surface, action, who) {
  if (!import.meta.env.PROD) return; // the dev server has no /api
  try {
    fetch(apiUrl("/api/team-tap"), {
      method: "POST",
      keepalive: true,
      // text/plain is a "simple" request: no CORS preflight from the app's
      // own origin (Capacitor), so the beacon survives the tel:/sms: hand-off.
      // The handler parses string bodies.
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ surface, action, who: who || null, ...ctx }),
    }).catch(() => {});
  } catch { /* counting must never block the tap */ }
}
