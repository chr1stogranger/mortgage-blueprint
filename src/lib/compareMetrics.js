// src/lib/compareMetrics.js
//
// Pure helpers behind the Compare tab (rebuilt 2026-09-23). Kept out of
// MortgageBlueprint.jsx so the math is testable and the tab component stays
// presentational. Everything here takes plain numbers — no React, no theme.

import { toMonthly, computeIncomeMethods } from "./finance.js";

// Qualifying monthly income from a saved scenario's `incomes` array — the
// same rules as the live engine (MortgageBlueprint totalIncomeFromEntries):
// previous employers (any component end-dated) are excluded as a group, fixed
// pay converts by frequency, variable pay uses the picked averaging method.
// The old quick-estimate read `inc.monthly`, a field income rows don't have,
// so every non-active option's DTI came out as 0.
export function quickIncomeMonthly(incomes, variablePayTypes = []) {
  const list = Array.isArray(incomes) ? incomes : [];
  const monthsElapsed = Math.max(1, new Date().getMonth() + 1);
  const prev = new Set();
  list.forEach(i => { if (i.end && i.end !== "") prev.add(`${i.borrower}::${i.source || ""}`); });
  return list.reduce((s, i) => {
    if (prev.has(`${i.borrower}::${i.source || ""}`)) return s;
    const isVariable = variablePayTypes.includes(i.payType);
    const sel = i.selection || (isVariable ? "2Y+" : "Amount");
    if (sel === "Amount") return s + toMonthly(Number(i.amount) || 0, i.frequency);
    if (sel === "YTD") { const y = Number(i.ytd) || 0; return s + (y > 0 ? (y * 12 / monthsElapsed) / 12 : 0); }
    const methods = computeIncomeMethods({ ytd: i.ytd, py1: i.py1, py2: i.py2, monthsElapsed });
    if (sel in methods) return s + methods[sel] / 12;
    return s + toMonthly(Number(i.amount) || 0, i.frequency);
  }, 0);
}

// How monthly mortgage insurance ends. Conventional PMI cancels automatically
// at 78% of the original value; FHA MIP runs 11 years with ≥10% down,
// otherwise for the life of the loan; VA / Jumbo / no-MI loans carry none.
export function miModeFor(loanType, ltv, downPct) {
  if (loanType === "FHA") return (Number(downPct) || 0) >= 10 ? "fha-11" : "fha-life";
  if ((loanType === "Conventional" || loanType === "USDA") && ltv > 0.8) return loanType === "USDA" ? "fha-life" : "conv";
  return "none";
}

// Cumulative cost to BORROW by year: closing costs up front, then interest +
// mortgage insurance. Principal is deliberately excluded — it becomes equity,
// so counting it would punish the option that builds equity fastest.
// Returns [year0, year1, … yearN] where N = termYears.
export function borrowCostSeries({ loan, rate, termYears, miMonthly = 0, miMode = "none", value = 0, closingCosts = 0 }) {
  const n = Math.round((Number(termYears) || 30) * 12);
  const r = (Number(rate) || 0) / 100 / 12;
  const L = Number(loan) || 0;
  const pmt = r > 0 ? L * r / (1 - Math.pow(1 + r, -n)) : (n > 0 ? L / n : 0);
  const out = [Number(closingCosts) || 0];
  let bal = L, cum = out[0];
  for (let m = 1; m <= n; m++) {
    const int = bal * r;
    bal = Math.max(0, bal - (pmt - int));
    let mi = 0;
    if (miMonthly > 0) {
      if (miMode === "fha-life") mi = miMonthly;
      else if (miMode === "fha-11") mi = m <= 132 ? miMonthly : 0;
      else if (miMode === "conv") mi = (value > 0 && bal / value > 0.78) ? miMonthly : 0;
    }
    cum += int + mi;
    if (m % 12 === 0) out.push(cum);
  }
  return out;
}

// Refi: cumulative NET savings by year (monthly savings × months − closing
// costs). Crosses zero at breakeven. `years` points after year 0.
export function refiNetSavingsSeries({ savings, closingCosts, years = 10 }) {
  const out = [];
  for (let y = 0; y <= years; y++) out.push((Number(savings) || 0) * 12 * y - (Number(closingCosts) || 0));
  return out;
}

// First year at which the cheapest option (lowest cumulative value) changes —
// e.g. a bigger down payment starts paying off. null when the leader never
// changes. `series` = [{ name, values[] }], lower is better.
export function firstLeaderChange(series) {
  const len = Math.min(...series.map(s => s.values.length));
  let leader = null;
  for (let y = 1; y < len; y++) {
    let best = null;
    series.forEach(s => { if (best === null || s.values[y] < best.values[y]) best = s; });
    if (leader && best.name !== leader.name) return { year: y, from: leader.name, to: best.name };
    leader = best;
  }
  return null;
}

// Winner of a metric among entries (min or max), ignoring null/NaN.
export function winnerBy(entries, get, dir = "min") {
  let w = null, wv = null;
  entries.forEach(e => {
    const v = get(e);
    if (v == null || !isFinite(v)) return;
    if (w === null || (dir === "min" ? v < wv : v > wv)) { w = e; wv = v; }
  });
  return w;
}
