// src/lib/affordability.js
//
// "What Can I Afford?" solver — the max purchase price that fits a loan
// program's debt-to-income limit. Lifted verbatim from the IIFE in
// content/QualifyContent.jsx so the Qualify tab and the MCP server
// (api/mcp.js → estimate_max_home_price) run the same math.
//
// Same rules as finance.js: no React, no JSX, deterministic, JSDoc on
// everything. Tested by affordability.test.js against fixtures captured from
// the pre-extraction code.
//
// KNOWN DIVERGENCES from the calculator (kept on purpose, Christo's call):
//   - Conventional MI is a flat 0.5% over 80% LTV, not getPMIRate().
//   - VA funding fee is a flat 2.3%, not vaFundingFeeRate().

/**
 * @typedef {object} AffordInputs
 * @property {number} monthlyIncome   qualifying gross income, monthly ($)
 * @property {number} monthlyDebts    monthly debt payments ($)
 * @property {number} cashAvailable   cash for down payment ($)
 * @property {number} rate            annual rate, percent
 * @property {number} termYears
 * @property {"Conventional"|"FHA"|"VA"|"Jumbo"} loanType
 * @property {number} confLimit       conforming / high-balance limit for the county ($)
 * @property {number} effTaxRate      annual property tax as a fraction of price
 * @property {number|null} [insMonthly] null → max($1,200, 0.35% of price)/12
 * @property {number} [hoaMonthly]
 */

/**
 * @typedef {object} AffordPayment
 * @property {number} dp        down payment ($)
 * @property {number} loan      base loan ($)
 * @property {number} totalLoan base loan + FHA UFMIP / VA funding fee ($)
 * @property {number} ltv       base loan ÷ price
 * @property {number} pi  @property {number} tax  @property {number} ins  @property {number} mi
 * @property {number} fhaUp  @property {number} vaFF
 * @property {number} total     monthly PITI + MI + HOA ($)
 * @property {{type: string, minDPpct: number, maxDTI: number, fhaUp: number, vaFF: number, miRate: number}} prog
 * @property {number} maxPmt    the program's max housing payment at this income ($)
 * @property {boolean} isJumbo  auto-switched to Jumbo rules (loan crossed confLimit)
 */

/** Program-default max DTI (percent) for the chosen loan type. */
export function programMaxDTI(loanType) {
  return loanType === "FHA" ? 56.99 : loanType === "VA" ? 60 : loanType === "Jumbo" ? 43 : 50;
}

/**
 * Build the price → payment model the solver searches over.
 * @param {AffordInputs} p
 * @returns {{ programDTI: number, calcPmt: (price: number) => (AffordPayment|null), baseDPmax: number, jumboDPmax: number }}
 */
export function affordabilityModel(p) {
  const affordIncome = p.monthlyIncome;
  const affordDebts = p.monthlyDebts;
  const affordDown = p.cashAvailable;
  const affordLoanType = p.loanType;
  const confLimit = p.confLimit;
  const effTaxRate = p.effTaxRate;
  const insMo = p.insMonthly ?? null;
  const hoaMo = p.hoaMonthly || 0;
  const programDTI = programMaxDTI(affordLoanType);
  const r = (p.rate / 100) / 12;
  const n = p.termYears * 12;
  // Dynamic loan program: if loan > conforming limit, switch to Jumbo rules
  const getProgram = (price, dpAmt) => {
   const loan = price - dpAmt;
   const isJumbo = loan > confLimit && affordLoanType !== "Jumbo";
   if (isJumbo || affordLoanType === "Jumbo") return { type: "Jumbo", minDPpct: 20, maxDTI: 43, fhaUp: 0, vaFF: 0, miRate: 0 };
   if (affordLoanType === "FHA") return { type: "FHA", minDPpct: 3.5, maxDTI: 56.99, fhaUp: 0.0175, vaFF: 0, miRate: 0.0055 };
   if (affordLoanType === "VA") return { type: "VA", minDPpct: 0, maxDTI: 60, fhaUp: 0, vaFF: 0.023, miRate: 0 };
   return { type: "Conventional", minDPpct: 5, maxDTI: 50, fhaUp: 0, vaFF: 0, miRate: 0 };
  };
  const calcPmt = (price) => {
   // First pass: estimate DP with base program
   const baseProg = getProgram(price, Math.min(affordDown, price));
   const reqDP = price * baseProg.minDPpct / 100;
   if (baseProg.minDPpct > 0 && affordDown < reqDP) return null;
   const dp = Math.min(affordDown, price);
   // Re-check program with actual loan amount
   const prog = getProgram(price, dp);
   const progReqDP = price * prog.minDPpct / 100;
   if (prog.minDPpct > 0 && affordDown < progReqDP) return null;
   const actualDP = Math.max(dp, progReqDP);
   const actualLoan = price - actualDP;
   const ltv = price > 0 ? actualLoan / price : 0;
   const fhaUp = prog.fhaUp * actualLoan;
   const vaFF = prog.vaFF * actualLoan;
   const totalLoan = actualLoan + fhaUp + vaFF;
   const pi = r > 0 ? totalLoan * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : totalLoan / n;
   const tax = price * effTaxRate / 12;
   const ins = insMo ?? Math.max(1200, price * 0.0035) / 12;
   let mi = 0;
   if (prog.type === "FHA") mi = totalLoan * prog.miRate / 12;
   else if (prog.type !== "VA" && prog.type !== "Jumbo" && ltv > 0.8) mi = totalLoan * 0.005 / 12;
   const maxPmt = affordIncome * (prog.maxDTI / 100) - affordDebts;
   return { dp: actualDP, loan: actualLoan, totalLoan, ltv, pi, tax, ins, mi, fhaUp, vaFF, total: pi + tax + ins + mi + hoaMo, prog, maxPmt, isJumbo: prog.type === "Jumbo" && affordLoanType !== "Jumbo" };
  };
  const jumboDPmax = Math.floor(affordDown / 0.20);
  const baseDPpct = affordLoanType === "VA" ? 0 : affordLoanType === "FHA" ? 3.5 : affordLoanType === "Conventional" ? 5 : 20;
  const baseDPmax = baseDPpct > 0 ? Math.floor(affordDown / (baseDPpct / 100)) : 20000000;
  return { programDTI, calcPmt, baseDPmax, jumboDPmax };
}

/**
 * Max purchase price whose total payment fits the program's DTI limit.
 * 80-step binary search to $500, floored to $1,000; under $10,000 → 0.
 * `limitedBy` probes +$5,000: the loan crossing into Jumbo, running out of
 * down payment, or the DTI cap itself.
 * @param {AffordInputs} p
 * @returns {({ ok: true, maxPrice: number, dpPct: number, dti: number, program: AffordPayment["prog"], limitedBy: "dti"|"cash"|"jumbo", maxConfPrice: number } & AffordPayment)
 *         | { ok: false, reason: "no-income"|"debts-exceed"|"cash" }}
 */
export function solveMaxPrice(p) {
  const affordIncome = p.monthlyIncome;
  const affordDebts = p.monthlyDebts;
  const affordDown = p.cashAvailable;
  const affordLoanType = p.loanType;
  const confLimit = p.confLimit;
  const { programDTI, calcPmt, baseDPmax, jumboDPmax } = affordabilityModel(p);
  const maxHousingPayment = affordIncome * (programDTI / 100) - affordDebts;
  if (!(affordIncome > 0)) return { ok: false, reason: "no-income" };
  if (maxHousingPayment <= 0) return { ok: false, reason: "debts-exceed" };
  // Binary search: max price where total payment fits within the program's DTI limit
  let lo = 0, hi = Math.min(Math.max(baseDPmax, jumboDPmax), 20000000);
  for (let i = 0; i < 80; i++) {
   const mid = Math.round((lo + hi) / 2);
   const pmt = calcPmt(mid);
   if (!pmt || pmt.total > pmt.maxPmt) hi = mid;
   else lo = mid;
   if (hi - lo < 500) break;
  }
  let maxPrice = Math.floor(lo / 1000) * 1000;
  if (maxPrice < 10000) maxPrice = 0;
  const result = calcPmt(maxPrice);
  if (!result) return { ok: false, reason: "cash" };
  const hitsJumbo = result.isJumbo;
  const dpPct = maxPrice > 0 ? (result.dp / maxPrice * 100) : 0;
  const dti = affordIncome > 0 ? (result.total + affordDebts) / affordIncome : 0;
  const nextUp = calcPmt(maxPrice + 5000);
  const limitedBy = !nextUp ? "cash"
   : (!hitsJumbo && nextUp.prog.type === "Jumbo" && affordLoanType !== "Jumbo") ? "jumbo"
   : "dti";
  // Also find max conforming price (before Jumbo kicks in)
  let maxConfPrice = 0;
  if (hitsJumbo) {
   let cLo = 0, cHi = Math.min(baseDPmax, 20000000);
   for (let i = 0; i < 80; i++) {
    const mid = Math.round((cLo + cHi) / 2);
    const dp2 = Math.min(affordDown, mid);
    const loan2 = mid - dp2;
    if (loan2 > confLimit) { cHi = mid; continue; }
    const pmt = calcPmt(mid);
    if (!pmt || pmt.total > (affordIncome * (programDTI / 100) - affordDebts)) cHi = mid;
    else cLo = mid;
    if (cHi - cLo < 500) break;
   }
   maxConfPrice = Math.floor(cLo / 1000) * 1000;
  }
  return { ok: true, ...result, maxPrice, dpPct, dti, program: result.prog, limitedBy, maxConfPrice };
}

/**
 * Max price at a fixed scenario DTI (Qualify → Quick Scenarios). The lower of
 * the scenario DTI and Jumbo's 43% applies once the loan goes Jumbo.
 * @param {AffordInputs} p
 * @param {number} scenarioDTI percent (36 / 43 / 50)
 * @returns {{ price: number, payment: AffordPayment, maxHousing: number } | null} null when debts exceed the scenario DTI or no viable price
 */
export function solveScenarioPrice(p, scenarioDTI) {
  const affordIncome = p.monthlyIncome;
  const affordDebts = p.monthlyDebts;
  const { calcPmt, baseDPmax, jumboDPmax } = affordabilityModel(p);
  const sc = { dti: scenarioDTI };
  const mhp = affordIncome * (sc.dti / 100) - affordDebts;
  if (mhp <= 0) return null;
  let qLo = 0, qHi = Math.min(Math.max(baseDPmax, jumboDPmax), 20000000);
  for (let i = 0; i < 80; i++) {
   const mid = Math.round((qLo + qHi) / 2);
   const pmt = calcPmt(mid);
   // Use the lower of scenario DTI and program max DTI
   const effMaxPmt = affordIncome * (Math.min(sc.dti, pmt ? (pmt.prog.type === "Jumbo" ? 43 : sc.dti) : sc.dti) / 100) - affordDebts;
   if (!pmt || pmt.total > effMaxPmt) qHi = mid;
   else qLo = mid;
   if (qHi - qLo < 500) break;
  }
  const qPrice = Math.floor(qLo / 1000) * 1000;
  const qResult = calcPmt(qPrice);
  if (!qResult || qPrice < 10000) return null;
  return { price: qPrice, payment: qResult, maxHousing: mhp };
}
