// src/lib/liveRates.js
//
// Which market-rate series a loan type tracks. Only PUBLISHED series may
// become the scenario rate: products the source doesn't publish get filled
// off the 30yr with fixed spreads for the reference grid, flagged in
// `estimated`, and must never be auto-applied as a "live" rate (house rule:
// never fabricate a rate).

export const RATE_KEY_FOR = (loanType, term) => ({
  Conventional: term === 15 ? "15yr_fixed" : "30yr_fixed",
  FHA: "30yr_fha",
  VA: "30yr_va",
  Jumbo: "30yr_jumbo",
  USDA: "30yr_fixed",
}[loanType]);

export const isEstimatedRate = (rates, key) =>
  !!(rates && Array.isArray(rates.estimated) && rates.estimated.includes(key));

// The published rate to apply for this loan type, or null (estimated/missing).
export function liveRateFor(rates, loanType, term) {
  const key = RATE_KEY_FOR(loanType, term);
  if (!rates || !key || isEstimatedRate(rates, key)) return null;
  const v = Number(rates[key]);
  return v > 0 && !isNaN(v) ? v : null;
}
