// src/lib/rentVsBuy.js
//
// Rent vs Buy projection — lifted verbatim from the `rbCalc` useMemo in
// MortgageBlueprint.jsx so the Rent vs Buy section and the MCP server
// (api/mcp.js → compare_rent_vs_buy) run the same model.
//
// Same rules as finance.js: no React, no JSX, deterministic, JSDoc on
// everything. Tested by rentVsBuy.test.js against fixtures captured from the
// pre-extraction code.
//
// KNOWN MODEL LIMITATIONS (flagged for Christo, not fixed in the lift):
//   - The renter invests only the up-front cash, not the monthly difference.
//   - Tax savings are flat for all 30 years.
//   - No selling cost on the buyer side.
//   - The old `buyerNetWealth` (equity + ½ × cumulative tax savings) was never
//     read by the breakeven or the rows; the dead line was dropped in the lift.
//   - monthlyCostDiff multiplies rent by pow(…, 0), i.e. always today's rent.

import { balanceAfter } from "./finance.js";

/**
 * @typedef {object} RentVsBuyRow
 * @property {number} yr  @property {number} rentMo  @property {number} annualRentCost
 * @property {number} annualBuyCost  @property {number} homeVal  @property {number} equity
 * @property {number} renterWealth  @property {number} buyerWealth
 * @property {number} buyerNet  @property {number} renterNet  @property {number} monthlyCostDiff
 */

/**
 * @param {object} p
 * @param {number} p.rent             current monthly rent ($)
 * @param {number} p.rentGrowthPct    annual rent growth, percent
 * @param {number} p.investReturnPct  renter's annual investment return, percent
 * @param {number} p.salesPrice       home price ($)
 * @param {number} p.appreciationPct  annual appreciation, percent
 * @param {number} p.loan             loan amount ($)
 * @param {number} p.mr               monthly rate (decimal)
 * @param {number} p.np               number of payments (months)
 * @param {number} p.dp               down payment ($)
 * @param {number} p.cashToClose      down payment + closing costs ($)
 * @param {number} p.housingPayment   monthly PITI + HOA + MI ($)
 * @param {number} p.annualTaxSavings buyer's annual tax savings ($, calc.totalTaxSavings)
 * @param {number} [p.years=30]
 * @returns {{ data: RentVsBuyRow[], breakEvenYear: number|null, yr5: RentVsBuyRow|{}, yr10: RentVsBuyRow|{}, yr30: RentVsBuyRow|{} }}
 */
export function computeRentVsBuy(p) {
  const rbCurrentRent = p.rent;
  const rbRentGrowth = p.rentGrowthPct;
  const rbInvestReturn = p.investReturnPct;
  const salesPrice = p.salesPrice;
  const appreciationRate = p.appreciationPct;
  const years = p.years ?? 30;
  const data = [];
  let rentWealth = p.cashToClose; // renter invests the cash that would have gone to closing
  let buyEquity = p.dp;
  let cumRentCost = 0, cumBuyCost = 0;
  let bal = p.loan;
  const mr = p.mr;
  const np = p.np;
  let breakEvenYear = null;
  for (let yr = 0; yr <= years; yr++) {
   const rentMo = rbCurrentRent * Math.pow(1 + rbRentGrowth / 100, yr);
   const annualRentCost = rentMo * 12;
   // Renter: pays rent, invests savings
   if (yr > 0) {
    rentWealth = rentWealth * (1 + rbInvestReturn / 100);
    cumRentCost += annualRentCost;
   }
   // Buyer: pays PITI + HOA, builds equity
   const homeVal = salesPrice * Math.pow(1 + appreciationRate / 100, yr);
   if (yr > 0) {
    const annualHousing = p.housingPayment * 12;
    cumBuyCost += annualHousing;
    // Principal paydown
    if (mr > 0 && yr * 12 <= np) {
     bal = balanceAfter(p.loan, mr, np, yr * 12);
    } else if (mr === 0) {
     bal = p.loan * Math.max(0, 1 - yr * 12 / np);
    }
   }
   buyEquity = homeVal - (bal > 0 ? bal : 0);
   // Tax savings for buyer
   const annualTaxSavings = p.annualTaxSavings || 0;
   const renterNetWealth = rentWealth;
   // More accurate: buyer net worth = equity - cumulative extra costs vs renting
   const buyerTotalCost = yr === 0 ? p.cashToClose : cumBuyCost + p.cashToClose;
   const renterTotalCost = cumRentCost;
   const buyerNetPosition = buyEquity - buyerTotalCost + annualTaxSavings * yr;
   const renterNetPosition = rentWealth - renterTotalCost;
   if (breakEvenYear === null && yr > 0 && buyerNetPosition >= renterNetPosition) breakEvenYear = yr;
   data.push({
    yr, rentMo: Math.round(rentMo), annualRentCost: Math.round(annualRentCost),
    annualBuyCost: Math.round(p.housingPayment * 12),
    homeVal: Math.round(homeVal), equity: Math.round(buyEquity),
    renterWealth: Math.round(renterNetWealth), buyerWealth: Math.round(buyEquity),
    buyerNet: Math.round(buyerNetPosition), renterNet: Math.round(renterNetPosition),
    monthlyCostDiff: Math.round(p.housingPayment - rentMo * Math.pow(1 + rbRentGrowth / 100, 0)),
   });
  }
  const yr5 = data[5] || {};
  const yr10 = data[10] || {};
  const yr30 = data[30] || {};
  return { data, breakEvenYear, yr5, yr10, yr30 };
}
