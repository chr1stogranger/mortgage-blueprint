// src/lib/mcpScenario.js
//
// Loan + payment basics from the handful of inputs a chat can supply, for the
// MCP server's rent-vs-buy tool and the "open in Blueprint" handoff. Every
// default it fills in is named in `assumptions` so the tool text can say so.
//
// Same rules as finance.js: no React, no JSX, no browser APIs, deterministic.
// The interest rate is ALWAYS the caller's — this module never picks one.

import { calcPI, getPMIRate, getFHAMipRate, vaFundingFeeRate } from "./finance.js";
import { normalizeState } from "../data/loanLimits.js";
import { STATE_PROPERTY_TAX_RATES, getAutoTaxRate } from "../data/propertyTax.js";
import { CA_CITY_TAX_RATES, NV_CITY_TAX_RATES } from "../citiesData.js";

const pctText = (frac, d = 2) => `${(frac * 100).toFixed(d).replace(/\.?0+$/, "")}%`;
const usd = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * "Texas" | "TX" | "tex." → "Texas"; "" when it isn't a state in the
 * property-tax table (50 states + DC).
 * @param {string} input
 * @returns {string}
 */
export function resolveStateName(input) {
  const abbr = normalizeState(input);
  if (!abbr) return "";
  return Object.keys(STATE_PROPERTY_TAX_RATES).find((name) => normalizeState(name) === abbr) || "";
}

/**
 * Match a city to the CA / NV tax-table key (case-insensitive); other states
 * price tax at the state average, so the city is passed through untouched.
 * @param {string} stateName full state name
 * @param {string} [city]
 * @returns {{ city: string, cityRate: boolean }} cityRate = a city-level rate was found
 */
export function resolveTaxCity(stateName, city) {
  const raw = String(city || "").trim();
  const table = stateName === "California" ? CA_CITY_TAX_RATES : stateName === "Nevada" ? NV_CITY_TAX_RATES : null;
  if (!table || !raw) return { city: raw, cityRate: false };
  const key = Object.keys(table).find((c) => c.toLowerCase() === raw.toLowerCase());
  return key ? { city: key, cityRate: true } : { city: raw, cityRate: false };
}

/**
 * Property-tax rate + the sentence that explains where it came from.
 * @param {string} stateName full state name
 * @param {string} [city]
 * @returns {{ rate: number, city: string, assumption: string }}
 */
export function propertyTaxBasis(stateName, city) {
  const { city: c, cityRate } = resolveTaxCity(stateName, city);
  const rate = getAutoTaxRate(stateName, c);
  const assumption = cityRate
    ? `Property tax uses ${c}, ${stateName}'s ${pctText(rate, 4)} rate`
    : stateName === "California"
      ? `Property tax uses California's 1.2% default${c ? ` (no rate on file for ${c})` : " (no city given)"}`
      : `Property tax uses ${stateName}'s average effective rate of ${pctText(rate)}`;
  return { rate, city: c, assumption };
}

/** Minimum down payment (percent) Blueprint applies per program. */
export const MIN_DOWN_PCT = { Conventional: 3, FHA: 3.5, VA: 0, Jumbo: 20 };

/**
 * @param {object} p
 * @param {number} p.price          home price ($)
 * @param {number} p.downPayment    ($)
 * @param {number} p.rate           annual rate, percent — the USER's rate
 * @param {number} p.termYears
 * @param {"Conventional"|"FHA"|"VA"|"Jumbo"} p.loanType
 * @param {string} p.state          full state name (see resolveStateName)
 * @param {string} [p.city]
 * @param {number} [p.creditScore]  drives conventional PMI; 700 when absent
 * @param {number} [p.hoaMonthly]
 * @param {number} [p.insMonthly]   null → max($1,200, 0.35% of price)/12
 * @param {number} [p.closingCosts] null → 2.5% of price
 * @returns {{ price: number, downPayment: number, downPct: number, baseLoan: number, upfrontFee: number, totalLoan: number,
 *   ltv: number, rate: number, termYears: number, mr: number, np: number, loanType: string, state: string, city: string,
 *   taxRate: number, pi: number, tax: number, ins: number, mi: number, hoa: number, housingPayment: number,
 *   closingCosts: number, closingCostsEstimated: boolean, cashToClose: number, assumptions: string[] }}
 */
export function buildScenario(p) {
  const assumptions = [];
  const price = p.price;
  const downPayment = p.downPayment;
  const downPct = price > 0 ? (downPayment / price) * 100 : 0;
  const baseLoan = Math.max(0, price - downPayment);
  const ltv = price > 0 ? baseLoan / price : 0;
  let upfrontFee = 0;
  if (p.loanType === "FHA") {
    upfrontFee = baseLoan * 0.0175;
    assumptions.push(`FHA adds a 1.75% upfront mortgage insurance premium (${usd(upfrontFee)}) to the loan`);
  } else if (p.loanType === "VA") {
    const ff = vaFundingFeeRate("First Use", downPct);
    upfrontFee = baseLoan * ff;
    assumptions.push(`VA funding fee of ${pctText(ff)} (first use, ${downPct >= 10 ? "10%+" : downPct >= 5 ? "5%+" : "under 5%"} down) is financed into the loan; veterans with a disability rating are exempt`);
  }
  const totalLoan = baseLoan + upfrontFee;
  const pi = calcPI(totalLoan, p.rate, p.termYears);
  const mr = p.rate / 100 / 12;
  const np = p.termYears * 12;

  const tb = propertyTaxBasis(p.state, p.city);
  const tax = (price * tb.rate) / 12;
  assumptions.push(tb.assumption);

  const insGiven = p.insMonthly !== null && p.insMonthly !== undefined;
  const ins = insGiven ? p.insMonthly : Math.max(1200, price * 0.0035) / 12;
  if (!insGiven) assumptions.push(`Homeowners insurance estimated at ${usd(ins)}/mo (0.35% of price a year, $1,200 minimum)`);

  let mi = 0;
  if (p.loanType === "Conventional" && ltv > 0.8) {
    const fico = p.creditScore || 700;
    mi = (getPMIRate(ltv, fico) * totalLoan) / 12;
    assumptions.push(`Private mortgage insurance priced for a ${fico} credit score${p.creditScore ? "" : " (none given)"}; it can be removed at 80% loan-to-value`);
  } else if (p.loanType === "FHA") {
    const rate = getFHAMipRate(baseLoan, ltv);
    mi = (rate * totalLoan) / 12;
    assumptions.push(`FHA annual mortgage insurance at ${pctText(rate)} of the loan`);
  }

  const hoa = p.hoaMonthly > 0 ? p.hoaMonthly : 0;
  const housingPayment = pi + tax + ins + mi + hoa;

  const ccGiven = p.closingCosts !== null && p.closingCosts !== undefined;
  const closingCosts = ccGiven ? p.closingCosts : price * 0.025;
  if (!ccGiven) assumptions.push(`Closing costs estimated at 2.5% of price (${usd(closingCosts)})`);
  const cashToClose = downPayment + closingCosts;

  const minDown = MIN_DOWN_PCT[p.loanType];
  if (minDown !== undefined && downPct + 1e-9 < minDown) {
    assumptions.push(`${p.loanType} loans usually need at least ${minDown}% down; ${downPct.toFixed(1)}% is below that`);
  }

  return {
    price, downPayment, downPct, baseLoan, upfrontFee, totalLoan, ltv,
    rate: p.rate, termYears: p.termYears, mr, np, loanType: p.loanType, state: p.state, city: tb.city,
    taxRate: tb.rate, pi, tax, ins, mi, hoa, housingPayment,
    closingCosts, closingCostsEstimated: !ccGiven, cashToClose, assumptions,
  };
}
