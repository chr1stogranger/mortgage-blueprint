// Refi structures — the three ways a borrower pays for a refinance, brought
// over from Ops' Refi Tool (Refi Hunter Phase 2, Christo 2026-10-31). Each one
// is just a New Loan Amount:
//
//   bring  — Bring costs: the new loan pays off the old one and nothing else;
//            the borrower brings closing costs and prepaids to the table.
//   zero   — Zero at close: costs and prepaids roll into the loan so the
//            estimated cash to close lands at about $0 (credits net against
//            them first).
//   cash   — Max cash back (Rate/Term only): roll everything in, plus the most
//            cash a Rate/Term refi allows, the greater of $2,000 or 1% of the
//            new loan.
//
// Closing costs and prepaid interest move a little with the loan amount, so
// a target computed from today's figures can land a few dollars off once the
// page recalculates. Close enough to pick a structure; the cash-to-close card
// shows the exact result.

export const RT_CASH_BACK_FLOOR = 2000;
export const RT_CASH_BACK_PCT = 0.01;

/**
 * @param {object} c
 * @param {number} c.payoff      every lien/debt paid at closing (calc.refiNetPayoff)
 * @param {number} c.closingCosts calc.totalClosingCosts
 * @param {number} c.prepaids    calc.totalPrepaidExp
 * @param {number} c.credits     calc.refiNetCredits
 * @returns {{ bring: number, zero: number, cash: number }} whole-dollar loan amounts
 */
export function refiStructureTargets({ payoff = 0, closingCosts = 0, prepaids = 0, credits = 0 }) {
  const p = Math.max(0, Number(payoff) || 0);
  const rolled = p + (Number(closingCosts) || 0) + (Number(prepaids) || 0) - (Number(credits) || 0);
  const bring = Math.round(p);
  // Round up so cash to close never shows a few dollars owed.
  const zero = Math.ceil(Math.max(rolled, 0));
  // Cash back = max(floor, 1% of L) on top of the rolled amount. Solve for L:
  // below the crossover the floor wins; above it, L = rolled / (1 - 1%).
  let cash = rolled + RT_CASH_BACK_FLOOR;
  if (cash * RT_CASH_BACK_PCT > RT_CASH_BACK_FLOOR) cash = rolled / (1 - RT_CASH_BACK_PCT);
  // Round down so the cash back never exceeds the limit.
  cash = Math.floor(Math.max(cash, 0));
  return { bring, zero, cash };
}

/**
 * Which structure the current loan amount matches. $50 of slack: once a pill
 * sets the loan, closing costs and prepaid interest re-price on the new amount
 * and the target drifts a few dollars (CMG test file: $8 on Zero at close),
 * which a tight match read as "custom". The three targets sit thousands apart.
 */
export function activeRefiStructure(loanAmount, targets, tolerance = 50) {
  const l = Number(loanAmount) || 0;
  for (const k of ["zero", "cash", "bring"]) {
    if (Math.abs(l - targets[k]) <= tolerance) return k;
  }
  return null;
}
