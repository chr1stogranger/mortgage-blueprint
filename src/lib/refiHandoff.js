// Refi Hunter → Blueprint handoff (Phase 3, Christo 2026-10-31).
//
// Ops' Refi Hunter opens a refi here two ways: ?ariveRefi=<Arive GUID> when the
// funded file is still in Arive, else ?refiLoan=<closed_loans.id>, which reads
// the closed-loan record through Ops' LO-authenticated refi-handoff route. Both
// carry &hk=<the Hunter row's key> so sending the refi can flip that row's
// Refi Status to Offer Sent.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The Hunter row key from ?hk=, or "" if it isn't a plain id. */
export function cleanHunterKey(hk) {
  const s = String(hk || "").trim();
  return /^[\w.-]{1,64}$/.test(s) ? s : "";
}

function blueprintLoanType(t) {
  const s = String(t || "");
  if (/fha/i.test(s)) return "FHA";
  if (/\bva\b/i.test(s)) return "VA";
  if (/usda/i.test(s)) return "USDA";
  if (/jumbo/i.test(s)) return "Jumbo";
  return "Conventional";
}

function termFromProduct(p) {
  const m = String(p || "").match(/\b(10|15|20|25|30)\s*(?:yr|year|-year|y)\b/i);
  return m ? Number(m[1]) : 30;
}

/**
 * Ops refi-handoff payload → Blueprint refi state. The closed loan becomes the
 * loan being refinanced; with no statement the balance is rebuilt from the
 * funding date (refiHasStatement false → the Estimate label). The new loan
 * starts half a point under the closed rate, same as ?ariveRefi.
 */
export function refiPrefillFromHandoff(h, { rateDrop = 0.5 } = {}) {
  const rate = Number(h?.rate) || 0;
  const amount = Number(h?.loan_amount) || 0;
  const term = termFromProduct(h?.product);
  const type = blueprintLoanType(h?.loan_type);
  return {
    isRefi: true,
    loanPurpose: "Refi Rate/Term",
    refiPurpose: "Rate/Term",
    refiCurrentLoanType: type,
    refiCurrentRateType: "Fixed",
    refiOriginalAmount: amount,
    refiOriginalTerm: term,
    refiCurrentRate: rate,
    refiHasStatement: false,
    ...(DATE_RE.test(String(h?.funding_date || "")) ? { refiClosedDate: h.funding_date } : {}),
    loanType: type,
    rate: Math.max(0, Number((rate - rateDrop).toFixed(3))),
    term,
    ...(h?.name ? { borrowerName: h.name } : {}),
    ...(h?.email ? { borrowerEmail: h.email } : {}),
  };
}

/**
 * Offer Sent only moves a row forward: from no status or Prospecting. It never
 * overwrites In Process, Won, Lost, Ineligible (or an Offer Sent already there).
 */
export function canMarkOfferSent(currentStatus) {
  const s = String(currentStatus || "");
  return s === "" || s === "prospecting";
}
