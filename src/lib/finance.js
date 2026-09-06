// src/lib/finance.js
//
// THE FINANCIAL ENGINE — every money formula in Blueprint lives here.
// (CIO audit M-1: formulas were inlined across the 6,800-line monolith;
// this module makes them pure, importable, and unit-testable.)
//
// RULES FOR THIS FILE:
//   - No React. No JSX. No component imports. Pure functions + data tables only.
//   - Every function is deterministic: same inputs → same outputs
//     (the two date-based helpers take dates as inputs).
//   - Tested by src/lib/finance.test.js — run `npm test` after ANY change here.
//   - JSDoc types on everything (the "minimal path to type-checking the
//     calculation layer" from the audit, M-2).

// ─────────────────────────────────────────────────────────────────────────────
// DATA TABLES
// ─────────────────────────────────────────────────────────────────────────────

/** VA funding fee rate by usage tier and down-payment band (0% / 5% / 10%+). */
export const VA_FUNDING_FEES = {
 "First Use": { 0: 0.0215, 5: 0.015, 10: 0.0125 },
 "Subsequent": { 0: 0.033, 5: 0.015, 10: 0.0125 },
 "Disabled": { 0: 0, 5: 0, 10: 0 },
};

/** 2026 federal tax brackets by filing status. */
export const FED_BRACKETS = {
 Single: [{min:0,max:12400,rate:0.10},{min:12401,max:50400,rate:0.12},{min:50401,max:105700,rate:0.22},{min:105701,max:201775,rate:0.24},{min:201776,max:256225,rate:0.32},{min:256226,max:640600,rate:0.35},{min:640601,max:Infinity,rate:0.37}],
 MFJ: [{min:0,max:24800,rate:0.10},{min:24801,max:100800,rate:0.12},{min:100801,max:211400,rate:0.22},{min:211401,max:403550,rate:0.24},{min:403551,max:512450,rate:0.32},{min:512451,max:768700,rate:0.35},{min:768701,max:Infinity,rate:0.37}],
 MFS: [{min:0,max:12400,rate:0.10},{min:12401,max:50400,rate:0.12},{min:50401,max:105700,rate:0.22},{min:105701,max:201775,rate:0.24},{min:201776,max:256225,rate:0.32},{min:256226,max:384350,rate:0.35},{min:384351,max:Infinity,rate:0.37}],
 HOH: [{min:0,max:17700,rate:0.10},{min:17701,max:67450,rate:0.12},{min:67451,max:105700,rate:0.22},{min:105701,max:201775,rate:0.24},{min:201776,max:256200,rate:0.32},{min:256201,max:640600,rate:0.35},{min:640601,max:Infinity,rate:0.37}],
};

/** 2026 federal standard deduction by filing status. */
export const FED_STD_DEDUCTION = { Single: 16100, MFJ: 32200, MFS: 16100, HOH: 24150 };

/** Build bracket array from [max, rate] pairs (mins derived from prior max). */
const B = (pairs) => pairs.map(([max, rate]) => ({ min: 0, max, rate })).reduce((acc, b, i) => { if (i > 0) acc[i].min = acc[i - 1].max + 1; return acc; }, pairs.map(([max, rate]) => ({ min: 0, max, rate })));

/** State income-tax models: none / flat (rate [+surtax]) / progressive (s/m[/h] brackets + std deductions). */
export const STATE_TAX = {
 "Alabama": { type:"progressive", std:{s:2500,m:7500,h:4700},
  s:B([[500,0.02],[3000,0.04],[Infinity,0.05]]), m:B([[1000,0.02],[6000,0.04],[Infinity,0.05]]) },
 "Alaska": { type:"none" },
 "Arizona": { type:"flat", rate:0.025 },
 "Arkansas": { type:"progressive", std:{s:2340,m:4680,h:2340},
  s:B([[4300,0.02],[8500,0.04],[Infinity,0.044]]), m:B([[4300,0.02],[8500,0.04],[Infinity,0.044]]) },
 "California": { type:"progressive", std:{s:5363,m:10726,h:10726},
  s:B([[10756,0.01],[25499,0.02],[40245,0.04],[55865,0.06],[70605,0.08],[360658,0.093],[432787,0.103],[721314,0.113],[Infinity,0.123]]),
  m:B([[21513,0.01],[50998,0.02],[80490,0.04],[111732,0.06],[141212,0.08],[721318,0.093],[865574,0.103],[1442628,0.113],[Infinity,0.123]]) },
 "Colorado": { type:"flat", rate:0.044 },
 "Connecticut": { type:"progressive", std:{s:0,m:0,h:0},
  s:B([[10000,0.03],[50000,0.05],[100000,0.055],[200000,0.06],[250000,0.065],[500000,0.069],[Infinity,0.0699]]),
  m:B([[20000,0.03],[100000,0.05],[200000,0.055],[400000,0.06],[500000,0.065],[1000000,0.069],[Infinity,0.0699]]) },
 "Delaware": { type:"progressive", std:{s:3250,m:6500,h:3250},
  s:B([[2000,0],[5000,0.022],[10000,0.039],[20000,0.048],[25000,0.052],[60000,0.0555],[Infinity,0.066]]),
  m:B([[2000,0],[5000,0.022],[10000,0.039],[20000,0.048],[25000,0.052],[60000,0.0555],[Infinity,0.066]]) },
 "Florida": { type:"none" },
 "Georgia": { type:"progressive", std:{s:5400,m:7100,h:5400},
  s:B([[750,0.01],[2250,0.02],[3750,0.03],[5250,0.04],[7000,0.05],[Infinity,0.055]]),
  m:B([[1000,0.01],[3000,0.02],[5000,0.03],[7000,0.04],[10000,0.05],[Infinity,0.055]]) },
 "Hawaii": { type:"progressive", std:{s:2200,m:4400,h:3212},
  s:B([[2400,0.014],[4800,0.032],[9600,0.055],[14400,0.064],[19200,0.068],[24000,0.072],[36000,0.076],[48000,0.079],[150000,0.0825],[175000,0.09],[200000,0.10],[Infinity,0.11]]),
  m:B([[4800,0.014],[9600,0.032],[19200,0.055],[28800,0.064],[38400,0.068],[48000,0.072],[72000,0.076],[96000,0.079],[300000,0.0825],[350000,0.09],[400000,0.10],[Infinity,0.11]]) },
 "Idaho": { type:"flat", rate:0.058 },
 "Illinois": { type:"flat", rate:0.0495 },
 "Indiana": { type:"flat", rate:0.0305 },
 "Iowa": { type:"progressive", std:{s:2210,m:5450,h:5450},
  s:B([[1853,0.0044],[9265,0.0482],[Infinity,0.057]]),
  m:B([[3706,0.0044],[18530,0.0482],[Infinity,0.057]]) },
 "Kansas": { type:"progressive", std:{s:3500,m:8000,h:6000},
  s:B([[15000,0.031],[30000,0.0525],[Infinity,0.057]]),
  m:B([[30000,0.031],[60000,0.0525],[Infinity,0.057]]) },
 "Kentucky": { type:"flat", rate:0.04 },
 "Louisiana": { type:"progressive", std:{s:0,m:0,h:0},
  s:B([[12500,0.0185],[50000,0.035],[Infinity,0.0425]]),
  m:B([[25000,0.0185],[100000,0.035],[Infinity,0.0425]]) },
 "Maine": { type:"progressive", std:{s:16100,m:32200,h:24150},
  s:B([[24500,0.058],[58050,0.0675],[Infinity,0.0715]]),
  m:B([[49050,0.058],[116100,0.0675],[Infinity,0.0715]]) },
 "Maryland": { type:"progressive", std:{s:2550,m:5150,h:2550},
  s:B([[1000,0.02],[2000,0.03],[3000,0.04],[100000,0.0475],[125000,0.05],[150000,0.0525],[250000,0.055],[Infinity,0.0575]]),
  m:B([[1000,0.02],[2000,0.03],[3000,0.04],[150000,0.0475],[175000,0.05],[225000,0.0525],[300000,0.055],[Infinity,0.0575]]) },
 "Massachusetts": { type:"flat", rate:0.05, surtax:{ threshold:1000000, rate:0.04 } },
 "Michigan": { type:"flat", rate:0.0425 },
 "Minnesota": { type:"progressive", std:{s:15300,m:30600,h:23000},
  s:B([[31690,0.0535],[104090,0.068],[183340,0.0785],[Infinity,0.0985]]),
  m:B([[46330,0.0535],[184040,0.068],[321450,0.0785],[Infinity,0.0985]]) },
 "Mississippi": { type:"flat", rate:0.047 },
 "Missouri": { type:"progressive", std:{s:16100,m:32200,h:24150},
  s:B([[1207,0.02],[2414,0.025],[3621,0.03],[4828,0.035],[6035,0.04],[7242,0.045],[8449,0.05],[Infinity,0.0495]]),
  m:B([[1207,0.02],[2414,0.025],[3621,0.03],[4828,0.035],[6035,0.04],[7242,0.045],[8449,0.05],[Infinity,0.0495]]) },
 "Montana": { type:"progressive", std:{s:5540,m:11080,h:5540},
  s:B([[20500,0.047],[Infinity,0.059]]), m:B([[20500,0.047],[Infinity,0.059]]) },
 "Nebraska": { type:"progressive", std:{s:7900,m:15800,h:11600},
  s:B([[3700,0.0246],[22170,0.0351],[35730,0.0501],[Infinity,0.0584]]),
  m:B([[7390,0.0246],[44350,0.0351],[71460,0.0501],[Infinity,0.0584]]) },
 "Nevada": { type:"none" },
 "New Hampshire": { type:"none" },
 "New Jersey": { type:"progressive", std:{s:0,m:0,h:0},
  s:B([[20000,0.014],[35000,0.0175],[40000,0.035],[75000,0.05525],[500000,0.0637],[1000000,0.0897],[Infinity,0.1075]]),
  m:B([[20000,0.014],[50000,0.0175],[70000,0.035],[80000,0.05525],[150000,0.0637],[500000,0.0897],[Infinity,0.1075]]) },
 "New Mexico": { type:"progressive", std:{s:16100,m:32200,h:24150},
  s:B([[5500,0.017],[11000,0.032],[16000,0.047],[210000,0.049],[Infinity,0.059]]),
  m:B([[8000,0.017],[16000,0.032],[24000,0.047],[315000,0.049],[Infinity,0.059]]) },
 "New York": { type:"progressive", std:{s:8000,m:16050,h:11200},
  s:B([[8500,0.04],[11700,0.045],[13900,0.0525],[80650,0.055],[215400,0.06],[1077550,0.0685],[5000000,0.0965],[25000000,0.103],[Infinity,0.109]]),
  m:B([[17150,0.04],[23600,0.045],[27900,0.0525],[161550,0.055],[323200,0.06],[2155350,0.0685],[5000000,0.0965],[25000000,0.103],[Infinity,0.109]]) },
 "North Carolina": { type:"flat", rate:0.045 },
 "North Dakota": { type:"progressive", std:{s:16100,m:32200,h:24150},
  s:B([[44725,0.0195],[Infinity,0.025]]), m:B([[74750,0.0195],[Infinity,0.025]]) },
 "Ohio": { type:"progressive", std:{s:0,m:0,h:0},
  s:B([[26050,0],[46100,0.02765],[92150,0.03226],[Infinity,0.0357]]),
  m:B([[26050,0],[46100,0.02765],[92150,0.03226],[Infinity,0.0357]]) },
 "Oklahoma": { type:"progressive", std:{s:6350,m:12700,h:9350},
  s:B([[1000,0.0025],[2500,0.0075],[3750,0.0175],[4900,0.0275],[7200,0.0375],[Infinity,0.0475]]),
  m:B([[2000,0.0025],[5000,0.0075],[7500,0.0175],[9800,0.0275],[12200,0.0375],[Infinity,0.0475]]) },
 "Oregon": { type:"progressive", std:{s:2745,m:5495,h:4420},
  s:B([[4050,0.0475],[10200,0.0675],[125000,0.0875],[Infinity,0.099]]),
  m:B([[8100,0.0475],[20400,0.0675],[250000,0.0875],[Infinity,0.099]]) },
 "Pennsylvania": { type:"flat", rate:0.0307 },
 "Rhode Island": { type:"progressive", std:{s:10550,m:21150,h:15850},
  s:B([[73450,0.0375],[166950,0.0475],[Infinity,0.0599]]),
  m:B([[73450,0.0375],[166950,0.0475],[Infinity,0.0599]]) },
 "South Carolina": { type:"progressive", std:{s:16100,m:32200,h:24150},
  s:B([[3460,0],[17330,0.03],[Infinity,0.064]]),
  m:B([[3460,0],[17330,0.03],[Infinity,0.064]]) },
 "South Dakota": { type:"none" },
 "Tennessee": { type:"none" },
 "Texas": { type:"none" },
 "Utah": { type:"flat", rate:0.0465 },
 "Vermont": { type:"progressive", std:{s:16100,m:32200,h:24150},
  s:B([[45400,0.0335],[110450,0.066],[229550,0.076],[Infinity,0.0875]]),
  m:B([[76000,0.0335],[184000,0.066],[Infinity,0.0875]]) },
 "Virginia": { type:"progressive", std:{s:8000,m:16000,h:8000},
  s:B([[3000,0.02],[5000,0.03],[17000,0.05],[Infinity,0.0575]]),
  m:B([[3000,0.02],[5000,0.03],[17000,0.05],[Infinity,0.0575]]) },
 "Washington": { type:"none" },
 "West Virginia": { type:"progressive", std:{s:0,m:0,h:0},
  s:B([[10000,0.0236],[25000,0.0315],[40000,0.0354],[60000,0.0472],[Infinity,0.0512]]),
  m:B([[10000,0.0236],[25000,0.0315],[40000,0.0354],[60000,0.0472],[Infinity,0.0512]]) },
 "Wisconsin": { type:"progressive", std:{s:13230,m:24500,h:17430},
  s:B([[14320,0.0354],[28640,0.0465],[315310,0.0530],[Infinity,0.0765]]),
  m:B([[19120,0.0354],[38240,0.0465],[420420,0.0530],[Infinity,0.0765]]) },
 "Wyoming": { type:"none" },
 "District of Columbia": { type:"progressive", std:{s:16100,m:32200,h:24150},
  s:B([[10000,0.04],[40000,0.06],[60000,0.065],[250000,0.085],[500000,0.0925],[1000000,0.0975],[Infinity,0.1075]]),
  m:B([[10000,0.04],[40000,0.06],[60000,0.065],[250000,0.085],[500000,0.0925],[1000000,0.0975],[Infinity,0.1075]]) },
};

/** Sorted state names for pickers. */
export const STATE_NAMES = Object.keys(STATE_TAX).sort();

// ─────────────────────────────────────────────────────────────────────────────
// CORE LOAN MATH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard amortizing P&I payment: M = P·r(1+r)^n / ((1+r)^n − 1).
 * 0%-rate and 0-term guarded (falls back to straight-line principal).
 * @param {number} loanAmt   total loan amount ($)
 * @param {number} annualRate annual interest rate in percent (e.g. 6.5)
 * @param {number} termYears  loan term in years (e.g. 30)
 * @returns {number} monthly principal + interest payment ($)
 */
export function calcPI(loanAmt, annualRate, termYears) {
 if (!loanAmt || loanAmt <= 0) return 0;
 const mr = (annualRate / 100) / 12;
 const np = termYears * 12;
 if (mr <= 0 || np <= 0) return loanAmt / (np || 1);
 return (loanAmt * mr * Math.pow(1 + mr, np)) / (Math.pow(1 + mr, np) - 1);
}

/**
 * Remaining balance after N payments — monthly-rate form.
 * @param {number} loanAmt    total loan amount ($)
 * @param {number} mr         monthly interest rate as a fraction (annual%/100/12)
 * @param {number} np         total number of payments
 * @param {number} paidMonths payments already made
 * @returns {number} remaining principal balance ($)
 */
export function balanceAfter(loanAmt, mr, np, paidMonths) {
 if (mr <= 0 || np <= 0) return Math.max(0, loanAmt * (1 - paidMonths / np));
 return loanAmt * (Math.pow(1 + mr, np) - Math.pow(1 + mr, paidMonths)) / (Math.pow(1 + mr, np) - 1);
}

/**
 * Remaining balance after N payments on a standard amortizing loan.
 * @param {number} loanAmt    total loan amount ($)
 * @param {number} annualRate annual interest rate in percent
 * @param {number} termYears  loan term in years
 * @param {number} paidMonths payments already made
 * @returns {number} remaining principal balance ($)
 */
export function calcBalance(loanAmt, annualRate, termYears, paidMonths) {
 const mr = (annualRate / 100) / 12;
 const np = termYears * 12;
 return balanceAfter(loanAmt, mr, np, paidMonths);
}

/**
 * Temporary rate buydown (2-1, 1-0, 3-2-1) — rate is reduced in the early
 * years, funded by an escrow subsidy (usually a seller/lender credit).
 * Borrower still qualifies at the NOTE rate; this only changes early cash
 * flow. Reduced rates clamp at 0% (e.g. a 2.5% note with a 3-2-1).
 * @param {number} loanAmt   total loan amount ($)
 * @param {number} noteRate  note rate in percent (e.g. 6.5)
 * @param {number} termYears loan term in years (e.g. 30)
 * @param {"1-0"|"2-1"|"3-2-1"} type buydown structure
 * @returns {{ notePI: number,
 *             years: { year: number, rate: number, pi: number,
 *                      monthlySavings: number, annualSavings: number }[],
 *             totalCost: number }} note-rate P&I, per-year buydown rows, and
 *             the total subsidy cost (sum of each year's payment savings)
 */
export function calcTempBuydown(loanAmt, noteRate, termYears, type) {
 // type: "1-0" | "2-1" | "3-2-1"
 const REDUCTIONS = { "1-0": [1], "2-1": [2, 1], "3-2-1": [3, 2, 1] };
 const notePI = calcPI(loanAmt, noteRate, termYears);
 const years = REDUCTIONS[type].map((cut, i) => {
  const rate = Math.max(noteRate - cut, 0);
  const pi = calcPI(loanAmt, rate, termYears);
  return { year: i + 1, rate, pi, monthlySavings: notePI - pi, annualSavings: (notePI - pi) * 12 };
 });
 return { notePI, years, totalCost: years.reduce((s, y) => s + y.annualSavings, 0) };
}

/**
 * APR — effective annual rate including financed fees, via Newton's method.
 * @param {number} loanAmt total loan ($), {number} annualRate %, {number} termYears,
 * @param {number} totalFees finance charges included in APR ($)
 * @returns {number} APR in percent
 */
export function calcAPR(loanAmt, annualRate, termYears, totalFees) {
 if (!loanAmt || loanAmt <= 0 || !annualRate || annualRate <= 0) return 0;
 const monthlyPmt = calcPI(loanAmt, annualRate, termYears);
 const np = termYears * 12;
 const netProceeds = loanAmt - totalFees; // what borrower actually receives
 if (netProceeds <= 0) return annualRate;
 // Newton's method to find monthly rate where PV of payments = netProceeds
 let r = annualRate / 100 / 12; // initial guess
 for (let i = 0; i < 100; i++) {
  const pvFactor = (1 - Math.pow(1 + r, -np)) / r;
  const pv = monthlyPmt * pvFactor;
  const pvPrime = monthlyPmt * ((-np * Math.pow(1 + r, -np - 1) * r - (1 - Math.pow(1 + r, -np))) / (r * r));
  const diff = pv - netProceeds;
  if (Math.abs(diff) < 0.01) break;
  r = r - diff / pvPrime;
  if (r <= 0) { r = annualRate / 100 / 12; break; }
 }
 return r * 12 * 100; // convert monthly rate back to annual percentage
}

/**
 * Loan-to-value ratio. Returns 0 (not NaN) when value is 0/unknown.
 * @param {number} loanAmt base loan ($)
 * @param {number} propertyValue sales price or appraised value ($)
 * @returns {number} LTV as a fraction (0.85 = 85%)
 */
export function computeLTV(loanAmt, propertyValue) {
 return propertyValue > 0 ? loanAmt / propertyValue : 0;
}

/**
 * Back-end DTI. Returns null (not 0 / NaN) when income is unknown, so the UI
 * can show "—" instead of a misleading 0%.
 * NOTE: result is a FRACTION (0.43 = 43%) — multiply by 100 for display.
 * @param {number} totalMonthlyPayment housing + all debts ($/mo)
 * @param {number} monthlyIncome qualifying gross income ($/mo)
 * @returns {number|null} DTI fraction, or null when income ≤ 0
 */
export function computeDTI(totalMonthlyPayment, monthlyIncome) {
 return monthlyIncome > 0 ? totalMonthlyPayment / monthlyIncome : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MORTGAGE INSURANCE & GOVERNMENT FEES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PMI rate lookup — Radian-based matrix by LTV and FICO (>20yr, Purchase/
 * Rate-Term, Non-Refundable). Annual rate as a fraction of loan amount
 * (monthly premium = rate × loanAmt / 12). Source: Radian PMI Rate Card
 * (Nov 2021 effective), Primary Res, Fixed, >20yr term.
 * @param {number} ltv LTV as a fraction (0.95 = 95%)
 * @param {number} fico middle credit score (defaults 700 when falsy)
 * @returns {number} annual PMI rate as a fraction (0.0038 = 0.38%)
 */
export function getPMIRate(ltv, fico) {
 const matrix = {
  97: { 760: 0.0058, 740: 0.0070, 720: 0.0087, 700: 0.0099, 680: 0.0121, 660: 0.0154, 640: 0.0165, 620: 0.0186 },
  95: { 760: 0.0038, 740: 0.0048, 720: 0.0059, 700: 0.0068, 680: 0.0087, 660: 0.0111, 640: 0.0119, 620: 0.0138 },
  90: { 760: 0.0030, 740: 0.0039, 720: 0.0046, 700: 0.0056, 680: 0.0067, 660: 0.0087, 640: 0.0096, 620: 0.0111 },
  85: { 760: 0.0019, 740: 0.0020, 720: 0.0023, 700: 0.0025, 680: 0.0028, 660: 0.0038, 640: 0.0042, 620: 0.0044 },
 };
 const ltvPct = ltv * 100;
 const bucket = ltvPct > 95 ? 97 : ltvPct > 90 ? 95 : ltvPct > 85 ? 90 : 85;
 const rates = matrix[bucket];
 const score = fico || 700; // default to 700 if not provided
 const ficoBucket = score >= 760 ? 760 : score >= 740 ? 740 : score >= 720 ? 720 : score >= 700 ? 700 : score >= 680 ? 680 : score >= 660 ? 660 : score >= 640 ? 640 : 620;
 return rates[ficoBucket] || rates[700];
}

/**
 * FHA annual MIP rate — FHA's own schedule, NOT the Radian PMI matrix.
 * Source: FHA Mortgage Insurance table (eff. 3/1/2023). Keyed off the BASE
 * loan amount ($726,200 FHA base loan limit) and LTV bucket.
 *   Base > $726,200: LTV > 95% → 0.75% ; ≤ 95% → 0.70%
 *   Base ≤ $726,200: LTV > 95% → 0.55% ; ≤ 95% → 0.50%
 * @param {number} baseLoan base loan amount ($)
 * @param {number} ltv LTV as a fraction
 * @returns {number} annual MIP rate as a fraction (0.0055 = 0.55%)
 */
export function getFHAMipRate(baseLoan, ltv) {
 const ltvPct = ltv * 100;
 const overLimit = baseLoan > 726200;
 if (overLimit) return ltvPct > 95 ? 0.0075 : 0.0070;
 return ltvPct > 95 ? 0.0055 : 0.0050;
}

/**
 * VA funding fee rate by usage tier and down-payment percent.
 * @param {"First Use"|"Subsequent"|"Disabled"} usage
 * @param {number} downPct down payment in PERCENT (10 = 10%)
 * @returns {number} fee rate as a fraction of base loan (0.0215 = 2.15%)
 */
export function vaFundingFeeRate(usage, downPct) {
 const tier = VA_FUNDING_FEES[usage] || { 0: 0 };
 return downPct >= 10 ? (tier[10] || 0) : downPct >= 5 ? (tier[5] || 0) : (tier[0] || 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// INCOME & TAX
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert an income amount to monthly based on pay frequency.
 * @param {number} amount
 * @param {string} frequency Annual|Bi-Annual|Quarterly|Semi-Monthly|Bi-Weekly|Weekly|Hourly|Monthly
 * @returns {number} monthly amount
 */
export function toMonthly(amount, frequency) {
 const a = Number(amount) || 0;
 if (frequency === "Annual") return a / 12;
 if (frequency === "Bi-Annual") return (a * 2) / 12;          // 2 payments/yr
 if (frequency === "Quarterly") return (a * 4) / 12;          // 4 payments/yr
 if (frequency === "Semi-Monthly") return a * 2;              // 2 payments/mo (24/yr)
 if (frequency === "Bi-Weekly") return a * 26 / 12;           // 26 payments/yr
 if (frequency === "Weekly") return a * 52 / 12;
 if (frequency === "Hourly") return a * 2080 / 12;
 return a; // Monthly or unrecognized
}

/**
 * Declining income detection. Christo (2026-05-05): when income drops from
 * year-2 to year-1, Fannie/Freddie says you must use only the most recent
 * year's amount — averaging would inflate the qualifying figure on a
 * borrower whose income is shrinking.
 * @param {number|string} py1 prior year 1 annual amount (most recent full year)
 * @param {number|string} py2 prior year 2 annual amount
 * @returns {boolean} true when both years are entered and py2 > py1
 */
export function isDecliningIncome(py1, py2) {
 const p1 = Number(py1) || 0;
 const p2 = Number(py2) || 0;
 return p1 > 0 && p2 > 0 && p2 > p1;
}

/**
 * Compute all 4 variable-income averaging methods at once so the UI can
 * preview them side-by-side, and so the qualifying-income aggregation uses
 * the SAME math the Income tab displays (they were hand-mirrored copies and
 * drifted — same failure mode as the toMonthly dedup, audit M-1).
 *
 * ytd / py1 / py2 are annual amounts; monthsElapsed is the number of months
 * represented by the YTD figure. Returns annual qualifying $/yr per method.
 *
 * Declining-income protection: when py2 > py1 the 2-year methods collapse to
 * the corresponding 1-year method (most recent year only) per Fannie/Freddie
 * underwriting. The 1-year methods are unaffected.
 * @param {object} p
 * @param {number|string} p.ytd  year-to-date amount ($)
 * @param {number|string} p.py1  prior year 1 annual amount ($)
 * @param {number|string} p.py2  prior year 2 annual amount ($)
 * @param {number} p.monthsElapsed months represented by the YTD figure
 * @returns {{"1Y+":number,"2Y+":number,"1Y_YTD":number,"2Y_YTD":number}} annual $/yr per method
 */
export function computeIncomeMethods({ ytd, py1, py2, monthsElapsed }) {
 const y  = Number(ytd) || 0;
 const p1 = Number(py1) || 0;
 const p2 = Number(py2) || 0;
 const m  = Math.max(1, Number(monthsElapsed) || 1);
 const ytdAnn = y > 0 ? (y * 12) / m : 0;
 const declining = isDecliningIncome(p1, p2);
 return {
  "1Y+":    p1,
  "2Y+":    declining ? p1 : (p1 + p2) / 2,
  "1Y_YTD": (p1 + ytdAnn) / 2,
  "2Y_YTD": declining ? (p1 + ytdAnn) / 2 : (p1 + p2 + ytdAnn) / 3,
 };
}

/**
 * Progressive tax on taxable income given a bracket table.
 * @param {number} taxableIncome
 * @param {{min:number,max:number,rate:number}[]} brackets
 * @returns {number} tax owed ($)
 */
export function progressiveTax(taxableIncome, brackets) {
 if (taxableIncome <= 0) return 0;
 let tax = 0;
 for (const b of brackets) { if (taxableIncome <= b.min) break; tax += (Math.min(taxableIncome, b.max) - b.min) * b.rate; }
 return tax;
}

/**
 * Homeownership tax-savings analysis: itemized-vs-standard differential across
 * full federal + state brackets, with the $750k mortgage-interest cap and the
 * 2026 SALT cap/phase-out. IMPORTANT: interest is YEAR-1 interest on the full
 * balance (loan × rate) — a first-year estimate, not a lifetime average.
 *
 * @param {object} p
 * @param {number} p.yearlyInc  gross annual income ($)
 * @param {"Single"|"MFJ"|"MFS"|"HOH"} p.married filing status
 * @param {string} p.taxState   state name (key of STATE_TAX)
 * @param {number} p.yearlyTax  annual property tax ($)
 * @param {number} p.loan       total loan amount ($)
 * @param {number} p.rate       annual interest rate in percent
 * @param {number} [p.schedAShare=1] Fraction of property tax and mortgage
 *   interest that belongs on SCHEDULE A (personal use). On an owner-occupied
 *   duplex the borrower lives in half the building, so only half the tax and
 *   interest are itemized deductions — the rented half is a Schedule E expense
 *   instead, and double-counting it here would overstate the tax savings.
 *   1 = fully personal (a plain primary residence). 0 = pure investment.
 * @returns {object} every intermediate + totalTaxSavings (≥ 0)
 */
export function computeTaxSavings({ yearlyInc, married, taxState, yearlyTax, loan, rate, schedAShare = 1 }) {
  // Number(x) never yields null/undefined, so `?? 1` was a no-op; NaN must be
  // caught explicitly or it poisons every downstream figure.
  const shareNum = Number(schedAShare);
  const share = Number.isFinite(shareNum) ? Math.max(0, Math.min(1, shareNum)) : 1;
  const fedBrackets = FED_BRACKETS[married] || FED_BRACKETS.Single;
  const fedStdDeduction = FED_STD_DEDUCTION[married] || FED_STD_DEDUCTION.Single;
  const stInfo = STATE_TAX[taxState] || { type: "none" };
  const stKey = married === "MFJ" ? "m" : "s";
  const stHasHOH = stInfo.h;
  const stBrackets = married === "HOH" && stHasHOH ? stInfo.h : (stInfo[stKey] || []);
  const stStdKey = married === "MFJ" ? "m" : married === "HOH" ? "h" : "s";
  const stStdDeduction = stInfo.std ? (stInfo.std[stStdKey] || stInfo.std.s || 0) : 0;
  const stFlatRate = stInfo.rate || 0;
  // 2026 SALT cap: $40,400 base ($20,200 MFS)
  // Phase-out: above $505K MAGI, cap reduces by 30% of excess, floor $10,000 ($5,000 MFS)
  const saltBase = married === "MFS" ? 20200 : 40400;
  const saltFloor = married === "MFS" ? 5000 : 10000;
  const saltPhaseoutStart = married === "MFS" ? 252500 : 505000;
  const saltCap = yearlyInc > saltPhaseoutStart
    ? Math.max(saltFloor, Math.round(saltBase - 0.30 * (yearlyInc - saltPhaseoutStart)))
    : saltBase;
  // Only the personal-use portion is itemized, and the SALT cap applies to that
  // portion alone — the rental share leaves via Schedule E, which SALT doesn't cap.
  const schedATax = yearlyTax * share;
  const fedPropTax = Math.min(schedATax, saltCap);
  const mortIntDeductLimit = married === "MFS" ? 375000 : 750000;
  const deductibleLoanPct = loan > 0 ? Math.min(1, mortIntDeductLimit / loan) : 1;
  const totalMortInt = loan * (rate / 100);
  const schedAMortInt = totalMortInt * share;
  const fedMortInt = schedAMortInt * deductibleLoanPct;
  const fedItemized = fedPropTax + fedMortInt;
  const stateMortInt = schedAMortInt;
  const stateItemized = schedATax + stateMortInt;
  const fedTaxableIncome = yearlyInc - Math.max(fedStdDeduction, fedItemized);
  const fedTaxBefore = progressiveTax(yearlyInc - fedStdDeduction, fedBrackets);
  const fedTaxAfter = progressiveTax(fedTaxableIncome, fedBrackets);
  const fedSavings = fedTaxBefore - fedTaxAfter;
  let stateTaxBefore = 0, stateTaxAfter = 0;
  if (stInfo.type === "flat") {
   const surtax = stInfo.surtax || null;
   stateTaxBefore = yearlyInc * stFlatRate + (surtax && yearlyInc > surtax.threshold ? (yearlyInc - surtax.threshold) * surtax.rate : 0);
   const stTaxableAfter = yearlyInc - Math.max(stStdDeduction, stateItemized);
   stateTaxAfter = Math.max(0, stTaxableAfter) * stFlatRate + (surtax && stTaxableAfter > surtax.threshold ? (stTaxableAfter - surtax.threshold) * surtax.rate : 0);
  } else if (stInfo.type === "progressive") {
   const stTaxableIncome = yearlyInc - Math.max(stStdDeduction, stateItemized);
   stateTaxBefore = progressiveTax(yearlyInc - stStdDeduction, stBrackets);
   stateTaxAfter = progressiveTax(stTaxableIncome, stBrackets);
  }
  const stateSavings = stateTaxBefore - stateTaxAfter;
  const totalTaxSavings = Math.max(0, fedSavings) + Math.max(0, stateSavings);
  // ── Delta Analysis (Chris's CPA explanation) ──
  const fedDelta = Math.max(0, fedItemized - fedStdDeduction);
  const fedItemizes = fedItemized > fedStdDeduction;
  const stateDelta = Math.max(0, stateItemized - stStdDeduction);
  const stateItemizes = stateItemized > stStdDeduction;
  // Bracket waterfall — show which brackets the delta comes off of, top-down
  const bracketWaterfall = (income, delta, brackets) => {
   if (delta <= 0 || income <= 0) return [];
   const taxableBeforeDelta = income; // income after std deduction already applied
   const result = [];
   let remaining = delta;
   // Walk brackets from top down
   for (let i = brackets.length - 1; i >= 0 && remaining > 0; i--) {
    const b = brackets[i];
    const bMax = b.max === Infinity || b.max === null ? taxableBeforeDelta : Math.min(b.max, taxableBeforeDelta);
    if (taxableBeforeDelta <= b.min) continue;
    const incomeInBracket = bMax - b.min;
    const taxableInThisBracket = Math.min(remaining, Math.max(0, taxableBeforeDelta - b.min), incomeInBracket);
    if (taxableInThisBracket <= 0) continue;
    result.push({ rate: b.rate, amount: taxableInThisBracket, savings: taxableInThisBracket * b.rate });
    remaining -= taxableInThisBracket;
   }
   return result;
  };
  const fedTaxableBeforeDelta = Math.max(0, yearlyInc - fedStdDeduction);
  const fedWaterfall = bracketWaterfall(fedTaxableBeforeDelta, fedDelta, fedBrackets);
  const stTaxableBeforeDelta = Math.max(0, yearlyInc - stStdDeduction);
  const stWaterfall = stInfo.type === "progressive" ? bracketWaterfall(stTaxableBeforeDelta, stateDelta, stBrackets) : [];
  // Top marginal rate (for the plain-English explanation)
  const fedTopRate = fedWaterfall.length > 0 ? fedWaterfall[0].rate : 0;
  const stTopRate = stWaterfall.length > 0 ? stWaterfall[0].rate : (stInfo.type === "flat" ? stFlatRate : 0);
  const combinedTopRate = fedTopRate + stTopRate;
  return {
   fedStdDeduction, stStdDeduction, fedPropTax, saltCap, mortIntDeductLimit,
   totalMortInt, deductibleLoanPct, fedMortInt, fedItemized, stateMortInt, stateItemized,
   schedATax, schedAMortInt, schedAShare: share,
   fedTaxBefore, fedTaxAfter, fedSavings, stateTaxBefore, stateTaxAfter, stateSavings,
   totalTaxSavings, fedDelta, fedItemizes, stateDelta, stateItemizes,
   fedWaterfall, stWaterfall, fedTopRate, stTopRate, combinedTopRate,
   fedTaxableBeforeDelta, stTaxableBeforeDelta,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AMORTIZATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full amortization schedule, with and without extra payments. Carries full
 * floating-point precision through the running balance (rounding is
 * display-only), caps the final principal at the remaining balance, and
 * floors at 0 — the schedule zeroes out exactly.
 *
 * @param {object} p
 * @param {number} p.loan      total loan amount ($)
 * @param {number} p.mr        monthly rate as a fraction
 * @param {number} p.np        number of payments
 * @param {number} p.pi        monthly P&I payment ($)
 * @param {number} p.extra     extra principal per month ($, 0 if none)
 * @param {Date}   p.closeDate closing date (first payment = 2 months after)
 * @param {Date}   [p.now]     unused, kept for call-site compatibility (lastPayDate now anchors on firstPayDate)
 * @returns {{amortSchedule:object[], amortStandard:object[], totalIntWithExtra:number,
 *  totalIntStandard:number, yearlyData:object[], intSaved:number, monthsSaved:number,
 *  lastPayDate:Date|null, firstPayDate:Date}}
 */
export function buildAmortization({ loan, mr, np, pi, extra, closeDate, now: _now }) {
  const amortSchedule = [], amortStandard = [];
  let bal = loan, stdBal = loan;
  let totalIntWithExtra = 0, totalIntStandard = 0;
  const yearlyData = [];
  let yrInt = 0, yrPrin = 0, yrStdInt = 0, yrStdPrin = 0;
  for (let m = 1; m <= np; m++) {
   if (bal > 0.01) { const intPmt = bal * mr; const prinPmt = Math.min(bal, pi - intPmt); const extraPmt = Math.min(bal - prinPmt, extra); const newBal = Math.max(0, bal - prinPmt - extraPmt); totalIntWithExtra += intPmt; yrInt += intPmt; yrPrin += prinPmt + extraPmt; amortSchedule.push({ m, int: intPmt, prin: prinPmt, extra: extraPmt, bal: newBal, pmt: pi }); bal = newBal; }
   if (stdBal > 0.01) { const si = stdBal * mr; const sp = Math.min(stdBal, pi - si); totalIntStandard += si; yrStdInt += si; yrStdPrin += sp; amortStandard.push({ m, int: si, prin: sp, bal: Math.max(0, stdBal - sp) }); stdBal = Math.max(0, stdBal - sp); }
   if (m % 12 === 0 || m === np || (bal <= 0.01 && amortSchedule.length === m)) { yearlyData.push({ year: Math.ceil(m / 12), int: yrInt, prin: yrPrin, stdInt: yrStdInt, stdPrin: yrStdPrin, bal, stdBal }); yrInt = 0; yrPrin = 0; yrStdInt = 0; yrStdPrin = 0; }
  }
  const intSaved = totalIntStandard - totalIntWithExtra;
  const monthsSaved = amortStandard.length - amortSchedule.length;
  // Last payment = first payment month + (payments - 1). Anchoring on "today"
  // drifted the payoff date by however far closing sits from the current month.
  const firstPayDate = new Date(closeDate.getFullYear(), closeDate.getMonth() + 2, 1);
  const lastPayDate = amortSchedule.length > 0 ? new Date(firstPayDate.getFullYear(), firstPayDate.getMonth() + amortSchedule.length - 1, 1) : null;
  return { amortSchedule, amortStandard, totalIntWithExtra, totalIntStandard, yearlyData, intSaved, monthsSaved, lastPayDate, firstPayDate };
}

// ─────────────────────────────────────────────────────────────────────────────
// CALIFORNIA PROP 19
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prop 19 base-value transfer: equal-or-lesser replacement keeps the old
 * Prop 13 taxable base; greater value adds only the price DIFFERENCE to the
 * old base. Compares against full reassessment and emits eligibility warnings.
 *
 * @param {object} p
 * @param {number} p.replacementPrice subject property price ($)
 * @param {number} p.autoCountyRate   auto-derived county tax rate (fraction)
 * @param {number} p.rateOverridePct  manual county rate override in PERCENT (0 = none)
 * @param {number} p.oldTaxableValue  original home's current taxable value ($)
 * @param {number} p.oldSalePrice     original home's sale price ($)
 * @param {boolean} p.isPrimary       replacement is primary residence ($7k exemption)
 * @param {number} p.fixedAssessments annual fixed assessments ($)
 * @param {number} p.transfersUsed    Prop 19 transfers already used (max 3)
 * @param {string} p.saleDate         original home sale date (YYYY-MM-DD)
 * @param {string} p.purchaseDate     replacement purchase date (YYYY-MM-DD)
 * @param {boolean} p.isCalifornia    replacement home is in California
 * @returns {object} taxable values, annual/monthly taxes, savings, warnings[]
 */
export function computeProp19({ replacementPrice, autoCountyRate, rateOverridePct, oldTaxableValue, oldSalePrice, isPrimary, fixedAssessments, transfersUsed, saleDate, purchaseDate, isCalifornia }) {
  const countyRate = rateOverridePct > 0 ? rateOverridePct / 100 : autoCountyRate;
  const oldTV = Math.max(0, oldTaxableValue);
  const oldSP = Math.max(0, oldSalePrice);
  const sameOrLower = replacementPrice <= oldSP;
  const newTaxableValue = sameOrLower
   ? oldTV
   : oldTV + (replacementPrice - oldSP);
  // CA homeowner's exemption ($7,000) applies on primary residence.
  const exemption = isPrimary ? 7000 : 0;
  const netTaxable = Math.max(0, newTaxableValue - exemption);
  const fixedAssess = fixedAssessments || 0;
  const prop19BaseTax = netTaxable * countyRate;
  const prop19Annual = prop19BaseTax + fixedAssess;
  const prop19Monthly = prop19Annual / 12;
  // Compare vs. full reassessment (what they'd pay without Prop 19)
  const fullReassessNet = Math.max(0, replacementPrice - exemption);
  const fullReassessBaseTax = fullReassessNet * countyRate;
  const fullReassessAnnual = fullReassessBaseTax + fixedAssess;
  const fullReassessMonthly = fullReassessAnnual / 12;
  const annualSavings = fullReassessAnnual - prop19Annual;
  const monthlySavings = annualSavings / 12;
  const tenYearSavings = annualSavings * 10;
  const thirtyYearSavings = annualSavings * 30;
  // Eligibility sanity checks (informational — not gating)
  const warnings = [];
  if (replacementPrice <= 0) warnings.push("Enter a replacement home price in Setup.");
  if (oldTV <= 0) warnings.push("Enter your original home's current taxable value.");
  if (oldSP <= 0) warnings.push("Enter your original home's sale price.");
  if (transfersUsed >= 3) warnings.push("Prop 19 allows a maximum of 3 transfers. You've used 3 already.");
  if (!isCalifornia) warnings.push("Prop 19 transfers only apply to California replacement homes.");
  if (saleDate && purchaseDate) {
   // CIO audit L-6 fix: append T00:00:00 so bare YYYY-MM-DD parses as LOCAL
   // midnight (consistent with the rest of the app) instead of UTC — without
   // this, PST users see dates shifted a day at the 730-day boundary.
   const sd = new Date(saleDate.includes("T") ? saleDate : saleDate + "T00:00:00");
   const pd = new Date(purchaseDate.includes("T") ? purchaseDate : purchaseDate + "T00:00:00");
   const diffDays = Math.abs(pd - sd) / (1000 * 60 * 60 * 24);
   if (diffDays > 730) warnings.push("Sale and purchase must be within 2 years (730 days) of each other. You're at " + Math.round(diffDays) + " days.");
  }
  return {
   replacementPrice, oldTV, oldSP, sameOrLower,
   newTaxableValue, netTaxable, countyRate, exemption,
   prop19BaseTax, prop19Annual, prop19Monthly,
   fullReassessBaseTax, fullReassessAnnual, fullReassessMonthly,
   fixedAssessments: fixedAssess,
   annualSavings, monthlySavings, tenYearSavings, thirtyYearSavings,
   warnings,
  };
}

/**
 * §469(i) passive activity loss allowance for rental real estate.
 *
 * Rental activity is passive by default (§469(c)(2)). The special allowance
 * lets an ACTIVELY participating owner deduct up to $25,000 of rental loss
 * against ordinary income — but it phases out at 50¢ per dollar of MAGI above
 * a threshold, reaching zero $50,000 later. Disallowed losses are NOT lost:
 * they suspend and carry forward indefinitely, releasing against future
 * passive income or on a fully taxable disposition of the activity.
 *
 * Married-filing-separately is halved and starts phasing out at half the
 * income — and is zero outright for a couple who lived together at any point
 * in the year, which we cannot detect, so callers get the living-apart figure
 * and the UI says to confirm it.
 *
 * DELIBERATELY NOT MODELLED — real-estate-professional status (§469(c)(7)).
 * It would take rentals out of the passive rules entirely, but it turns on
 * 750+ hours and more than half of personal services in real property trades
 * or businesses, plus material participation. That is a facts-and-circumstances
 * test that gets audited, and a toggle in a calculator invites people to flip
 * it optimistically. Christo confirmed 2026-07-21: do not add it. Note also
 * that being a loan officer does not qualify — mortgage lending is not a real
 * property trade or business for this purpose.
 *
 * @param {object} p
 * @param {number} p.magi  modified AGI (approximate is fine — see caller)
 * @param {number} p.loss  the Schedule E loss as a POSITIVE number
 * @param {"Single"|"MFJ"|"MFS"|"HOH"} [p.married] filing status
 * @returns {{allowance:number, deductibleNow:number, suspended:number, phaseOutStart:number, phaseOutEnd:number, maxAllowance:number}}
 */
export function computePassiveLossAllowance({ magi, loss, married = "Single" }) {
  const isMFS = married === "MFS";
  const maxAllowance = isMFS ? 12500 : 25000;
  const phaseOutStart = isMFS ? 50000 : 100000;
  // The allowance burns off at 50 cents per dollar, so the band is always
  // twice the allowance wide.
  const phaseOutEnd = phaseOutStart + maxAllowance * 2;
  const m = Math.max(0, Number(magi) || 0);
  const l = Math.max(0, Number(loss) || 0);
  const allowance = Math.max(0, Math.min(maxAllowance, maxAllowance - 0.5 * Math.max(0, m - phaseOutStart)));
  const deductibleNow = Math.min(l, allowance);
  return {
    allowance,
    deductibleNow,
    suspended: Math.max(0, l - deductibleNow),
    phaseOutStart,
    phaseOutEnd,
    maxAllowance,
  };
}
