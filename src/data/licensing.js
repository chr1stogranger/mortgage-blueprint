// src/data/licensing.js
//
// Where Chris Granger (NMLS #952015) can originate a loan (stated 2026-10-21).
// National-reach surfaces — the MCP server's tools and the ?plan= handoff —
// still calculate for any state, but only invite loan-officer contact /
// pre-approval for a property in one of these. Full state names, the same
// keys as STATE_TAX and STATE_PROPERTY_TAX_RATES.
//
// Unconfirmed: whether the company license (NMLS #2179191) covers the same
// list. Update both together if it changes.

import { normalizeState } from "./loanLimits.js";

export const LICENSED_STATES = ["Arizona", "California", "Colorado", "Hawaii", "Nevada", "Oregon", "Texas", "Washington"];

const LICENSED_ABBR = new Set(LICENSED_STATES.map((s) => normalizeState(s)));

/** "AZ, CA, CO, HI, NV, OR, TX and WA" */
export const LICENSED_STATES_TEXT = (() => {
  const a = [...LICENSED_ABBR].sort();
  return `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
})();

/**
 * True when the property state is one Chris is licensed in. Accepts a full
 * name or USPS code ("Texas", "TX"); anything unrecognized is NOT licensed.
 * @param {string} state
 * @returns {boolean}
 */
export function isLicensedState(state) {
  const abbr = normalizeState(state);
  return !!abbr && LICENSED_ABBR.has(abbr);
}

/** The sentence every MCP result carries for a property outside the footprint. */
export const unlicensedLine = (stateName) =>
  `Chris Granger is licensed in ${LICENSED_STATES_TEXT}, and can't originate a loan for a property in ${stateName}.`;
