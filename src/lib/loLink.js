// ── Personal loan-officer link (?lo=<code>, 2026-11-13) ──
//
// An LO shares blueprint.realstack.app/?lo=<code> (email signature, texts).
// Ops serves that LO's public card at GET /api/lo-card?c=<code>
// (loan-pipeline api/_loLinkCore.js): name, title, NMLS, phone, email, company
// and their pre-approval (1003) link. A guest who opens the link sees that LO
// as their contact instead of the factory default. Never applied on a device
// an LO has signed into (bp_lo_info_owner set): LO identity there is theirs.
//
// Pure: no React, so it can be unit-tested on its own.

export const LO_CODE_RE = /^[A-Za-z0-9_-]{6,40}$/;

/** Read + validate the code from a query string. Anything else is ignored. */
export function readLoCode(search) {
 try {
  const c = new URLSearchParams(search || "").get("lo");
  return c && LO_CODE_RE.test(c) ? c : null;
 } catch { return null; }
}

const clean = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
const httpsOnly = (v) => { const s = clean(v); return /^https:\/\/\S+$/i.test(s) ? s : ""; };

/**
 * The identity fields to set from an Ops LO card, or null when the card is
 * unusable. applyUrl is always present: "" hides "Get Pre-Approved" rather
 * than sending this LO's clients to someone else's portal.
 */
export function identityFromLoCard(lo) {
 if (!lo || !clean(lo.name)) return null;
 return {
  loanOfficer: clean(lo.name),
  loEmail: clean(lo.email),
  loPhone: clean(lo.phone),
  loNmls: clean(lo.nmls),
  companyName: clean(lo.company),
  applyUrl: httpsOnly(lo.applyUrl),
 };
}
