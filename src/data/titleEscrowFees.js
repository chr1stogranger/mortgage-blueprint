// src/data/titleEscrowFees.js — residential REFINANCE title & escrow estimates.
//
// Tiered on the loan (policy) amount, from a California residential refinance
// rate sheet supplied by Christo 2026-07-22. Two separate charges:
//
//   loanPolicy — the lender's title insurance policy (a loan policy, not an
//                owner's policy; a refi does not reissue the owner's policy)
//   escrow     — basic residential loan escrow services, single-loan
//
// UI copy calls these "estimated fees" and never names the underwriter — rate
// sheets are underwriter-specific and this is a quoting aid, not a quote.
//
// SCOPE — these figures are for ONE region only:
//   Alameda · Contra Costa · Marin · Santa Clara · San Francisco · San Mateo
// Other counties price differently. `lookupTitleEscrow` returns null outside
// this list rather than applying Bay Area pricing statewide, and the caller
// leaves its existing defaults alone when it gets null. Adding a region means
// adding its own tier table here — do NOT widen COUNTIES to cover a county
// whose numbers you do not have.
//
// Effective dates on the source sheet: title 2026-03-01, escrow 2026-04-30.
// Excludes government recording fees and CA transfer/SB2 charges, which
// Blueprint already models separately in section E.

export const TITLE_ESCROW_REGION = "Bay Area";

// Normalized (lowercase, no " County" suffix) — matches how propertyCounty is
// stored after lookupZip()/the geocoder strip it.
export const COUNTIES = [
  "alameda", "contra costa", "marin", "santa clara", "san francisco", "san mateo",
];

// upTo = policy amount up to AND INCLUDING this figure.
export const TIERS = [
  { upTo: 250000, loanPolicy: 505, escrow: 605 },
  { upTo: 500000, loanPolicy: 625, escrow: 685 },
  { upTo: 750000, loanPolicy: 755, escrow: 785 },
  { upTo: 1000000, loanPolicy: 835, escrow: 925 },
  { upTo: 1500000, loanPolicy: 1120, escrow: 925 },
  { upTo: 2000000, loanPolicy: 1405, escrow: 1085 },
  { upTo: 3000000, loanPolicy: 2110, escrow: 1135 },
  { upTo: 4000000, loanPolicy: 2815, escrow: 1235 },
  { upTo: 5000000, loanPolicy: 3695, escrow: 1235 },
];

// Above the top tier the policy grows; escrow stays flat.
const OVER_CAP_BASE = 5000000;
const OVER_CAP_POLICY = 3695;
const OVER_CAP_ESCROW = 1235;
const OVER_CAP_PER_MILLION = 500;

export function isRegionCounty(county) {
  if (!county) return false;
  return COUNTIES.includes(String(county).replace(/\s+county$/i, "").trim().toLowerCase());
}

/**
 * Estimated lender's-policy + escrow fees for a refinance.
 * Returns null when we have no schedule for that county, or the amount is
 * unusable — callers must treat null as "keep whatever default you had".
 */
export function lookupTitleEscrow(loanAmount, county) {
  const amt = Number(loanAmount);
  if (!isFinite(amt) || amt <= 0) return null;
  if (!isRegionCounty(county)) return null;

  const tier = TIERS.find(t => amt <= t.upTo);
  if (tier) {
    return { loanPolicy: tier.loanPolicy, escrow: tier.escrow, tier: tier.upTo, overCap: false };
  }
  // "$3,695 plus $500 for each additional $1,000,000 or fraction thereof"
  const extraMillions = Math.ceil((amt - OVER_CAP_BASE) / 1000000);
  return {
    loanPolicy: OVER_CAP_POLICY + extraMillions * OVER_CAP_PER_MILLION,
    escrow: OVER_CAP_ESCROW,
    tier: null,
    overCap: true,
  };
}
