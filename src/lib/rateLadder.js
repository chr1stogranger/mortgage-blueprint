// src/lib/rateLadder.js
//
// One view-model for the Rate & Points Breakeven ladder, shared by the
// Overview section (content/RateLadderContent.jsx), the Share tab card
// (components/RateLadderSummary.jsx) and the PDF page (lib/RateLadderPdf.jsx)
// — so every surface prints the same numbers from the same tax basis.
// Pure: no React, no DOM. Math lives in finance.js.

import { computeRateLadder } from "./finance.js";

export const DEFAULT_RATE_LADDER = Object.freeze({
  rungs: [], baseIdx: 0, holdYears: 5, taxMode: "auto", taxManualPct: 0, asOf: "", ltvBand: "", estimated: false,
});

export const fmtRate = (r) => `${(+r).toFixed(3)}%`;
export const ptsLabel = (p) => p < 0 ? `${Math.abs(p).toFixed(3)}% credit` : p === 0 ? "par" : `${(+p).toFixed(3)} pts`;
export const moLabel = (m) => (m === null || m === undefined || !isFinite(m)) ? "—" : m <= 0 ? "0 mo" : `${Math.round(m)} mo`;

// Parse "70.01–75%" / "70-75" into [lo, hi]; null when unparseable.
export function parseLtvBand(s) {
  if (!s) return null;
  const nums = String(s).match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return null;
  const lo = parseFloat(nums[0]), hi = parseFloat(nums[1]);
  return isFinite(lo) && isFinite(hi) && hi > lo ? [lo, hi] : null;
}

/**
 * Resolve the tax basis for the ladder from the scenario's tax engine output.
 *   auto   → fed + state top marginal when the borrower itemizes on each
 *            return, deductible share of the loan from the $750k / $1M caps
 *   manual → typed bracket, whole loan deductible
 *   off    → pre-tax
 */
export function resolveLadderTax(calc, L) {
  const mode = L?.taxMode || "auto";
  const fed = calc?.fedItemizes ? (calc.fedTopRate || 0) : 0;
  const st = calc?.stateItemizes ? (calc.stTopRate || 0) : 0;
  const autoRate = fed + st;
  const taxRate = mode === "off" ? 0 : mode === "manual" ? Math.max(0, +L.taxManualPct || 0) / 100 : autoRate;
  const deductPct = mode === "auto" ? (calc?.deductibleLoanPct ?? 1) : 1;
  const label = mode === "off" ? "Pre-tax" : `${(taxRate * 100).toFixed(1)}%`;
  const note = mode === "off" ? "standard deduction, no write-off"
    : mode === "manual" ? "manual bracket"
    : autoRate === 0 ? "engine says this borrower takes the standard deduction, so no write-off"
    : `${(fed * 100).toFixed(0)}% federal${st ? ` + ${(st * 100).toFixed(1)}% state` : ""}, itemizing · from Tax Savings${deductPct < 1 ? ` · ${Math.round(deductPct * 100)}% of the loan deductible` : ""}`;
  return { mode, taxRate, deductPct, label, note };
}

/**
 * Everything a surface needs to render the ladder: computed rows, sweet spot,
 * tax basis, pricing context, and the LTV-drift flag.
 */
export function buildLadderView({ calc, term, isRefi, rateLadder }) {
  const L = { ...DEFAULT_RATE_LADDER, ...(rateLadder || {}) };
  const loan = calc?.loan || 0;
  const tax = resolveLadderTax(calc, L);
  const holdYears = L.holdYears || 5;
  const ladder = computeRateLadder({
    loan, termYears: term || 30, rungs: L.rungs, baseIdx: L.baseIdx || 0, holdMonths: holdYears * 12,
    taxRate: tax.taxRate, deductPct: tax.deductPct, pointsDeductible: !isRefi,
  });
  const band = parseLtvBand(L.ltvBand);
  const ltvNow = calc?.ltv || 0;
  const ltvDrift = !!(band && ltvNow > 0 && (ltvNow < band[0] || ltvNow > band[1]));
  const spot = ladder.spot;
  const nextLower = spot ? ladder.rows.find(r => !r.dominated && r.rate < spot.rate) : null;
  return { L, loan, tax, holdYears, ladder, ltvNow, ltvDrift, spot, nextLower, isRefi: !!isRefi };
}

/**
 * Plain-data snapshot for the PDF (react-pdf props must survive
 * React.createElement + structured cloning; no functions, no Dates).
 */
export function ladderPdfData(view) {
  if (!view || !view.ladder.rows.length) return null;
  const { L, tax, holdYears, ladder, ltvNow, ltvDrift, spot, nextLower, isRefi } = view;
  const strip = (r) => r ? {
    rate: r.rate, pts: r.pts, pi: r.pi, isBase: !!r.isBase, dominated: !!r.dominated, dominatedBy: r.dominatedBy ?? null,
    delta: r.delta, cost: r.cost, postTaxCost: r.postTaxCost, writeOffLost: r.writeOffLost, netCost: r.netCost,
    breakeven: r.breakeven, cumAtHold: r.cumAtHold, equityAtHold: r.equityAtHold,
    band: r.band ? { key: r.band.key, label: r.band.label } : null,
    stepBreakeven: r.step ? r.step.breakeven : null,
  } : null;
  return {
    holdYears, taxLabel: tax.label, taxNote: tax.note, taxRate: tax.taxRate,
    asOf: L.asOf || "", ltvBand: L.ltvBand || "", ltvNow, ltvDrift, estimated: !!L.estimated, isRefi,
    base: strip(ladder.base), spot: strip(spot), nextLower: strip(nextLower),
    rows: ladder.rows.map(strip),
  };
}
