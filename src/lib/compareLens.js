// src/lib/compareLens.js
//
// "Hold the same" on the Compare tab (Christo 2026-10-28). Price, payment and
// cash to close are tied together, so the borrower holds any two equal across
// every option and the third is solved ("pick two of three"); holding one
// keeps the option's own down % (or price) for the other. Re-quotes each
// option so a condo, a house and a duplex read on the same terms.
//
// Pure: callers pass `quote(price, downPct)`, which returns compare metrics
// (the calcQuickMetrics shape) for that option at that price and down payment.
// Everything is solved by bisection rather than a closed form because the
// payment steps at MI/LTV tiers and the quote is the app's own estimate.

// The three numbers a borrower can hold, in display order.
export const HOLD_KEYS = ["price", "net", "cash"];

// What each mode holds equal, so the UI can mark it instead of crowning a
// "winner" in a row where every option is the same by construction.
export const LENS_HELD = { off: [], price: ["price"], payment: ["net"], cash: ["cash"], both: ["net", "cash"], pricePay: ["price", "net"], priceCash: ["price", "cash"] };

// The mode for a set of held keys (at most two of price / net / cash).
export function modeForHeld(held) {
  const h = new Set(held);
  if (h.has("price") && h.has("net")) return "pricePay";
  if (h.has("price") && h.has("cash")) return "priceCash";
  if (h.has("net") && h.has("cash")) return "both";
  if (h.has("price")) return "price";
  if (h.has("net")) return "payment";
  if (h.has("cash")) return "cash";
  return "off";
}

// Net payment = full housing payment minus the rent the borrower collects.
export const netOf = (m) => (m ? (Number(m.monthlyPayment) || 0) - (Number(m.rent) || 0) : null);

const PRICE_LO = 10000, PRICE_HI = 20000000;
const DOWN_LO = 0.01, DOWN_HI = 99.99;

// x where increasing f(x) reaches `target`, clamped to [lo, hi].
export function bisect(f, lo, hi, target, iters = 48) {
  if (f(lo) >= target) return lo;
  if (f(hi) <= target) return hi;
  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Down payment % that makes cash to close match at a given price.
const downFor = (quote, price, cash) => bisect(d => quote(price, d).cashToClose, DOWN_LO, DOWN_HI, cash);

// target: { price, net, cash } the borrower is holding.
// base:   { price, downPct } as the option was entered.
export function solveLens(mode, target, quote, base) {
  if (mode === "price") return quote(target.price, base.downPct);
  // Price + payment: solve the down payment; cash to close falls out. More
  // down means a smaller loan, so net falls as down rises — bisect on −net.
  if (mode === "pricePay") return quote(target.price, bisect(d => -netOf(quote(target.price, d)), DOWN_LO, DOWN_HI, -target.net));
  // Price + cash: solve the down payment; the payment falls out.
  if (mode === "priceCash") return quote(target.price, downFor(quote, target.price, target.cash));
  if (mode === "payment") {
    const p = bisect(x => netOf(quote(x, base.downPct)), PRICE_LO, PRICE_HI, target.net);
    return quote(p, base.downPct);
  }
  if (mode === "cash") return quote(base.price, downFor(quote, base.price, target.cash));
  if (mode === "both") {
    // More price at the same cash means a bigger loan and a higher payment,
    // so net rises with price along the same-cash curve.
    const p = bisect(x => netOf(quote(x, downFor(quote, x, target.cash))), PRICE_LO, PRICE_HI, target.net, 40);
    return quote(p, downFor(quote, p, target.cash));
  }
  return null;
}

// Lowest down payment the loan program allows, for the "below minimum" flag.
// Only programs with a fixed agency floor; Jumbo and non-QM vary by lender.
export function minDownFor({ loanType, units = 1, loanPurpose }) {
  const multi = (Number(units) || 1) > 1;
  if (loanType === "FHA") return { pct: 3.5, label: "an FHA loan" };
  if (loanType !== "Conventional") return null;
  if (loanPurpose === "Purchase Investment") return { pct: multi ? 25 : 15, label: multi ? `a ${units}-unit investment loan` : "an investment loan" };
  if (loanPurpose === "Purchase Second Home") return { pct: 10, label: "a second home" };
  return { pct: multi ? 5 : 3, label: multi ? `a ${units}-unit loan` : "a conventional loan" };
}
