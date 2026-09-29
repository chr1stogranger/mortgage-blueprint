// src/lib/calcSummary.js
//
// The lightweight calc_summary stored beside state_data on every scenario
// row — what Ops's pipeline and the borrower picker read without running the
// engine. ONE builder for every save path (LO save, live-sync flush, self-serve
// cloud save): before 2026-09-28 there were three, the sync one wrote no
// income at all, and the LO one read income fields that don't exist, so what
// Ops showed depended on which save ran last.

import { calcPI } from "./finance.js";
import { quickIncomeMonthly } from "./compareMetrics.js";

export const VARIABLE_PAY_TYPES = ["Hourly", "Overtime", "Bonus", "Commission", "Self-Employment", "RSU"];

const EXCLUDED_PAYOFFS = new Set(["Yes - at Escrow", "Yes - POC", "Omit"]);

export function buildCalcSummary(state = {}) {
  const salesPrice = Number(state.salesPrice) || 0;
  const downPct = Number(state.downPct) || 0;
  const rate = Number(state.rate) || 0;
  const term = Number(state.term) || 30;
  const loanType = state.loanType || "Conventional";
  const dp = salesPrice * downPct / 100;
  const baseLoan = salesPrice - dp;
  const ltv = salesPrice > 0 ? baseLoan / salesPrice : 0;
  const fhaUp = loanType === "FHA" ? baseLoan * 0.0175 : 0;
  const loan = baseLoan + fhaUp;
  const monthlyInc = quickIncomeMonthly(state.incomes, VARIABLE_PAY_TYPES)
    + (Number(state.otherIncome) || 0) + (Number(state.otherIncome2) || 0);
  const debts = Array.isArray(state.debts) ? state.debts : [];
  const monthlyDebts = debts
    .filter(d => !EXCLUDED_PAYOFFS.has(d.payoff))
    .reduce((s, d) => s + (Number(d.monthly) || 0), 0);
  return {
    salesPrice,
    downPayment: dp,
    downPct,
    loanAmount: loan,
    rate,
    term,
    loanType,
    ltv: Math.round(ltv * 10000) / 100,
    monthlyPI: Math.round(loan > 0 && term > 0 ? calcPI(loan, rate, term) : 0),
    monthlyIncome: Math.round(monthlyInc),
    monthlyDebts: Math.round(monthlyDebts),
    creditScore: Number(state.creditScore) || 0,
    loanPurpose: state.loanPurpose,
    city: state.city,
    propertyState: state.propertyState,
    borrowerName: state.borrowerName,
  };
}
