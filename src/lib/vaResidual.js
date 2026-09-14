// src/lib/vaResidual.js
//
// VA Residual Income — the "balance available for family support" test from
// VA Pamphlet 26-7 (Lenders Handbook) Chapter 4, Topic 9, mirrored on
// VA Form 26-6393 (Loan Analysis) Section D/E:
//
//   gross monthly income (taxable + tax-free)
//   − federal income tax − state income tax − Social Security/Medicare
//   − other payroll deductions
//   = net take-home ("net effective income")
//   − shelter expense (P&I, taxes, hazard ins, special assessments,
//     maintenance & utilities, HOA)
//   − debts and obligations (installment/revolving, child care, alimony /
//     child support paid, job-related expenses)
//   = RESIDUAL INCOME, compared to the regional table by family size and
//     loan-amount tier ($79,999 and below / $80,000 and above).
//
// Adjustments in the handbook that this module applies:
//   • Family size over 5: add $75 (low tier) / $80 (high tier) per member
//     up to a family of seven; the table stops there.
//   • Active-duty or veteran households with commissary/exchange access:
//     the guideline may be reduced by up to 5%.
//   • Ratio over 41%: the loan needs residual income of at least 120% of
//     the guideline, or documented compensating factors.
//   • Maintenance & utilities: VA regional loan centers commonly use
//     $0.14 per square foot of living area per month (editable).
//   • Tax-free income (VA disability, BAH/BAS, child support received) is
//     counted at face value with no tax deducted; it may be grossed up for
//     the RATIO only, never for residual income.
//
// Pure: no React, no DOM. Tax estimation reuses the finance.js tables so the
// estimate matches the rest of Blueprint; the LO can override every figure
// with the paystub withholding VA actually wants.

import { FED_BRACKETS, FED_STD_DEDUCTION, STATE_TAX, progressiveTax } from "./finance.js";

/* ─── Regions (VA Lenders Handbook Ch. 4, "Table of Residual Incomes by Region") ─── */
export const VA_REGIONS = Object.freeze({
  Northeast: ["Connecticut", "Maine", "Massachusetts", "New Hampshire", "New Jersey", "New York", "Pennsylvania", "Rhode Island", "Vermont"],
  Midwest: ["Illinois", "Indiana", "Iowa", "Kansas", "Michigan", "Minnesota", "Missouri", "Nebraska", "North Dakota", "Ohio", "South Dakota", "Wisconsin"],
  South: ["Alabama", "Arkansas", "Delaware", "District of Columbia", "Florida", "Georgia", "Kentucky", "Louisiana", "Maryland", "Mississippi", "North Carolina", "Oklahoma", "Puerto Rico", "South Carolina", "Tennessee", "Texas", "Virginia", "West Virginia"],
  West: ["Alaska", "Arizona", "California", "Colorado", "Hawaii", "Idaho", "Montana", "Nevada", "New Mexico", "Oregon", "Utah", "Washington", "Wyoming"],
});
export const VA_REGION_NAMES = Object.freeze(Object.keys(VA_REGIONS));

const STATE_TO_REGION = Object.fromEntries(
  Object.entries(VA_REGIONS).flatMap(([region, states]) => states.map(s => [s, region]))
);

/** Region for a full state name ("California" → "West"); null when unknown. */
export function regionForState(stateName) {
  return STATE_TO_REGION[String(stateName || "").trim()] || null;
}

/* ─── Residual income table (monthly $, family size 1–5) ─── */
export const VA_LOAN_TIER_BREAK = 80000;
export const VA_FAMILY_TABLE_MAX = 7;
export const VA_RESIDUAL_TABLE = Object.freeze({
  // Loan amounts of $79,999 and below
  low: Object.freeze({
    Northeast: [390, 654, 788, 888, 921],
    Midwest: [382, 641, 772, 868, 902],
    South: [382, 641, 772, 868, 902],
    West: [425, 713, 859, 967, 1004],
    adder: 75,
  }),
  // Loan amounts of $80,000 and above
  high: Object.freeze({
    Northeast: [450, 755, 909, 1025, 1062],
    Midwest: [441, 738, 889, 1003, 1039],
    South: [441, 738, 889, 1003, 1039],
    West: [491, 823, 990, 1117, 1158],
    adder: 80,
  }),
});

export const VA_MAINT_RATE_PER_SQFT = 0.14;   // $/sq ft/month, common RLC figure
export const VA_ACTIVE_DUTY_REDUCTION = 0.05; // up to 5% off the guideline
export const VA_RATIO_LIMIT = 0.41;           // above this, 120% residual or compensating factors
export const VA_RATIO_RESIDUAL_MULTIPLIER = 1.20;
export const VA_DEFAULT_GROSS_UP = 0.25;      // tax-free income gross-up, ratio only

/**
 * Guideline residual income for a household.
 * @returns {{ base, adjusted, tier, tierLabel, region, familySize, familyUsed, familyCapped, adderMembers, adderAmount, reduction }}
 */
export function vaGuideline({ region, familySize, loanAmount, activeDuty = false }) {
  const tier = (loanAmount || 0) >= VA_LOAN_TIER_BREAK ? "high" : "low";
  const table = VA_RESIDUAL_TABLE[tier];
  const rows = table[region] || null;
  const fam = Math.max(1, Math.round(Number(familySize) || 1));
  const familyUsed = Math.min(fam, VA_FAMILY_TABLE_MAX);
  const adderMembers = Math.max(0, familyUsed - 5);
  const adderAmount = adderMembers * table.adder;
  const base = rows ? (rows[Math.min(familyUsed, 5) - 1] + adderAmount) : 0;
  const reduction = activeDuty ? Math.round(base * VA_ACTIVE_DUTY_REDUCTION * 100) / 100 : 0;
  return {
    base, adjusted: base - reduction, reduction, tier,
    tierLabel: tier === "high" ? "$80,000 and above" : "$79,999 and below",
    region: rows ? region : null, familySize: fam, familyUsed, familyCapped: fam > VA_FAMILY_TABLE_MAX,
    adderMembers, adderAmount, adderPerMember: table.adder,
  };
}

/* ─── Payroll tax estimate (W-2 wages, current-year tables) ─── */
export const FICA_2026 = Object.freeze({
  ssRate: 0.062, ssWageBase: 184500, medicareRate: 0.0145,
  addlMedicareRate: 0.009, addlMedicareThreshold: { Single: 200000, HOH: 200000, MFJ: 250000, MFS: 125000 },
});

/**
 * Monthly federal / state / FICA estimate for taxable wages. VA wants the
 * withholding actually shown on the paystub; this is the fallback when the
 * stubs aren't in hand yet, using the same 2026 tables as Tax Savings.
 */
export function estimatePayrollTaxes({ annualTaxable, married = "Single", taxState = "" }) {
  const inc = Math.max(0, Number(annualTaxable) || 0);
  const status = FED_BRACKETS[married] ? married : "Single";
  const fedAnnual = progressiveTax(inc - (FED_STD_DEDUCTION[status] || 0), FED_BRACKETS[status]);
  const st = STATE_TAX[taxState] || { type: "none" };
  let stateAnnual = 0;
  if (st.type === "flat") {
    stateAnnual = inc * (st.rate || 0) + (st.surtax && inc > st.surtax.threshold ? (inc - st.surtax.threshold) * st.surtax.rate : 0);
  } else if (st.type === "progressive") {
    const key = status === "MFJ" ? "m" : "s";
    const brackets = status === "HOH" && st.h ? st.h : (st[key] || []);
    const stdKey = status === "MFJ" ? "m" : status === "HOH" ? "h" : "s";
    const std = st.std ? (st.std[stdKey] || st.std.s || 0) : 0;
    stateAnnual = progressiveTax(inc - std, brackets);
  }
  const ss = Math.min(inc, FICA_2026.ssWageBase) * FICA_2026.ssRate;
  const thr = FICA_2026.addlMedicareThreshold[status] ?? 200000;
  const medicare = inc * FICA_2026.medicareRate + Math.max(0, inc - thr) * FICA_2026.addlMedicareRate;
  return {
    fed: fedAnnual / 12, state: stateAnnual / 12, fica: (ss + medicare) / 12,
    ss: ss / 12, medicare: medicare / 12, stateType: st.type || "none",
  };
}

/* ─── Core computation (Form 26-6393 walk) ─── */
/**
 * @param {object} i  every figure MONTHLY unless noted
 *   grossTaxable, taxFree, fedTax, stateTax, fica, otherDeductions,
 *   pi, propertyTax, hazardIns, specialAssessments, maintUtil, hoa,
 *   debts, childcare, supportPaid, jobExpenses, otherObligations,
 *   region, familySize, loanAmount, activeDuty, grossUpPct (0–1, ratio only)
 */
export function computeVaResidual(i) {
  const n = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);
  const grossTaxable = n(i.grossTaxable), taxFree = n(i.taxFree);
  const grossIncome = grossTaxable + taxFree;
  const fedTax = n(i.fedTax), stateTax = n(i.stateTax), fica = n(i.fica), otherDeductions = n(i.otherDeductions);
  const totalDeductions = fedTax + stateTax + fica + otherDeductions;
  const netEffectiveIncome = grossIncome - totalDeductions;

  const shelter = {
    pi: n(i.pi), propertyTax: n(i.propertyTax), hazardIns: n(i.hazardIns),
    specialAssessments: n(i.specialAssessments), maintUtil: n(i.maintUtil), hoa: n(i.hoa),
  };
  const totalShelter = Object.values(shelter).reduce((s, v) => s + v, 0);
  // VA's ratio counts shelter WITHOUT maintenance & utilities (26-6393 line 44).
  const shelterForRatio = totalShelter - shelter.maintUtil;

  const obligations = {
    debts: n(i.debts), childcare: n(i.childcare), supportPaid: n(i.supportPaid),
    jobExpenses: n(i.jobExpenses), otherObligations: n(i.otherObligations),
  };
  const totalObligations = Object.values(obligations).reduce((s, v) => s + v, 0);

  const residual = netEffectiveIncome - totalShelter - totalObligations;

  const guide = vaGuideline({ region: i.region, familySize: i.familySize, loanAmount: i.loanAmount, activeDuty: !!i.activeDuty });
  const guideline = guide.adjusted;
  const surplus = residual - guideline;
  const pctOfGuideline = guideline > 0 ? residual / guideline : null;

  // Ratio: total obligations ÷ gross income, tax-free income grossed up if asked.
  const grossUp = Math.max(0, Math.min(1, Number(i.grossUpPct) || 0));
  const ratioIncome = grossTaxable + taxFree * (1 + grossUp);
  const ratio = ratioIncome > 0 ? (shelterForRatio + totalObligations) / ratioIncome : null;
  const ratioHigh = ratio !== null && ratio > VA_RATIO_LIMIT + 1e-9;
  const requiredResidual = ratioHigh ? guideline * VA_RATIO_RESIDUAL_MULTIPLIER : guideline;
  const headroom = residual - requiredResidual; // monthly cushion before the test fails

  let verdict;
  if (!guide.region) {
    verdict = { key: "none", label: "Pick a region", detail: "The property state is not in a VA region table; choose one to run the test." };
  } else if (grossIncome <= 0) {
    verdict = { key: "none", label: "Add income", detail: "Enter the household's gross monthly income to run the test." };
  } else if (ratioHigh) {
    if (pctOfGuideline >= VA_RATIO_RESIDUAL_MULTIPLIER - 1e-9) {
      verdict = { key: "pass", label: "Passes · 120% rule", detail: `Ratio is over 41%, but residual income is ${Math.round(pctOfGuideline * 100)}% of the guideline, so no further justification is required.` };
    } else if (surplus >= 0) {
      verdict = { key: "caution", label: "Meets guideline · ratio over 41%", detail: `Residual income clears the table but sits under 120% of it, and the ratio is ${(ratio * 100).toFixed(1)}%. VA needs documented compensating factors or residual of at least ${fmtUSD(requiredResidual)}.` };
    } else {
      verdict = { key: "fail", label: "Below guideline", detail: `Short ${fmtUSD(-surplus)} a month against the table, with the ratio over 41%. Reduce debts, lower the payment, or add income.` };
    }
  } else if (surplus >= 0) {
    verdict = { key: "pass", label: "Passes", detail: `Residual income is ${fmtUSD(surplus)} a month above the guideline with the ratio at ${ratio === null ? "—" : (ratio * 100).toFixed(1) + "%"}.` };
  } else {
    verdict = { key: "fail", label: "Below guideline", detail: `Short ${fmtUSD(-surplus)} a month. VA treats the table as a firm guideline; a shortfall has to be offset by strong, documented compensating factors.` };
  }

  return {
    grossTaxable, taxFree, grossIncome, fedTax, stateTax, fica, otherDeductions, totalDeductions, netEffectiveIncome,
    shelter, totalShelter, shelterForRatio, obligations, totalObligations,
    residual, guideline, guidelineBase: guide.base, guide, surplus, pctOfGuideline,
    ratio, ratioIncome, ratioHigh, requiredResidual, headroom, grossUp, verdict,
  };
}

const fmtUSD = (v) => "$" + Math.round(Math.abs(v || 0)).toLocaleString("en-US");

/* ─── Scenario state + view-model shared by Overview / Share / PDF ─── */
export const DEFAULT_VA_RESIDUAL = Object.freeze({
  familySize: 0,          // 0 = auto (2 when filing MFJ, else 1)
  activeDuty: false,      // commissary/exchange access → 5% guideline reduction
  regionOverride: "",     // "" = from property state
  sqft: 0,                // living area for maintenance & utilities
  maintRate: VA_MAINT_RATE_PER_SQFT,
  maintUtilOverride: null,// monthly $, wins over sqft × rate when set
  taxMode: "auto",        // "auto" = estimate from tables · "manual" = paystub figures
  fedTax: 0, stateTax: 0, fica: 0, // manual monthly withholding
  otherDeductions: 0,     // retirement, union dues, garnishments (monthly)
  taxFreeIncome: 0,       // VA disability, BAH/BAS, child support received (monthly)
  incomeMode: "app",      // "app" = Blueprint qualifying income · "manual"
  grossIncomeManual: 0,
  debtMode: "app",        // "app" = Debts tab · "manual"
  debtsManual: 0,
  childcare: 0, supportPaid: 0, jobExpenses: 0, otherObligations: 0, specialAssessments: 0,
  grossUp: true,          // gross up tax-free income for the RATIO only
  notes: "",
});

/** Merge a persisted object onto the defaults (older scenarios may lack keys). */
export function normalizeVaResidual(v) {
  return { ...DEFAULT_VA_RESIDUAL, ...(v && typeof v === "object" ? v : {}) };
}

/**
 * Resolve every input from the scenario, then run the test.
 * `calc` is the MortgageBlueprint calc memo; `hoa` is monthly.
 */
export function buildVaResidualView({ calc, isRefi, propertyState, married, taxState, vaResidual }) {
  const V = normalizeVaResidual(vaResidual);
  const c = calc || {};
  const loanAmount = isRefi ? (c.refiNewLoanAmt || c.loan || 0) : (c.loan || 0);
  const pi = isRefi ? (c.refiNewPi ?? c.pi ?? 0) : (c.pi || 0);
  const propertyTax = isRefi ? (c.refiNewMonthlyTax ?? c.monthlyTax ?? 0) : (c.monthlyTax || 0);
  const hazardIns = isRefi ? (c.refiNewMonthlyIns ?? c.ins ?? 0) : (c.ins || 0);
  const hoa = c.monthlyHOA || 0;

  const autoRegion = regionForState(propertyState);
  const region = V.regionOverride || autoRegion || "";
  const familySize = V.familySize > 0 ? V.familySize : (married === "MFJ" ? 2 : 1);

  // Income: Blueprint's qualifying income is the taxable base; tax-free income
  // is entered separately so it is never taxed here (VA counts it at face value).
  const appIncome = Math.max(0, (c.qualifyingIncome || 0));
  const grossTaxable = V.incomeMode === "manual" ? Math.max(0, +V.grossIncomeManual || 0) : appIncome;
  const taxFree = Math.max(0, +V.taxFreeIncome || 0);

  const est = estimatePayrollTaxes({ annualTaxable: grossTaxable * 12, married, taxState: taxState || propertyState });
  const taxes = V.taxMode === "manual"
    ? { fed: +V.fedTax || 0, state: +V.stateTax || 0, fica: +V.fica || 0 }
    : { fed: est.fed, state: est.state, fica: est.fica };

  const maintAuto = Math.round(Math.max(0, +V.sqft || 0) * Math.max(0, +V.maintRate || 0) * 100) / 100;
  const maintUtil = (V.maintUtilOverride !== null && V.maintUtilOverride !== undefined && V.maintUtilOverride !== "") ? Math.max(0, +V.maintUtilOverride || 0) : maintAuto;

  const appDebts = Math.max(0, (c.totalMonthlyDebts || 0) + (c.reoNegativeDebt || 0));
  const debts = V.debtMode === "manual" ? Math.max(0, +V.debtsManual || 0) : appDebts;

  const result = computeVaResidual({
    grossTaxable, taxFree, fedTax: taxes.fed, stateTax: taxes.state, fica: taxes.fica, otherDeductions: V.otherDeductions,
    pi, propertyTax, hazardIns, specialAssessments: V.specialAssessments, maintUtil, hoa,
    debts, childcare: V.childcare, supportPaid: V.supportPaid, jobExpenses: V.jobExpenses, otherObligations: V.otherObligations,
    region, familySize, loanAmount, activeDuty: V.activeDuty, grossUpPct: V.grossUp ? VA_DEFAULT_GROSS_UP : 0,
  });

  return {
    V, result, region, autoRegion, regionIsOverride: !!V.regionOverride && V.regionOverride !== autoRegion,
    familySize, familyAuto: !(V.familySize > 0), loanAmount, isRefi: !!isRefi,
    taxes: { ...taxes, mode: V.taxMode, est, stateType: est.stateType },
    maintUtil, maintAuto, maintIsOverride: V.maintUtilOverride !== null && V.maintUtilOverride !== undefined && V.maintUtilOverride !== "",
    appIncome, appDebts, sources: { income: V.incomeMode, debts: V.debtMode },
    propertyState: propertyState || "", taxState: taxState || propertyState || "", married: married || "Single",
  };
}

/** Plain-data snapshot for the PDF (no functions, no Dates). */
export function vaResidualPdfData(view) {
  if (!view) return null;
  const { V, result: r, region, familySize, loanAmount, taxes, maintUtil, isRefi, propertyState } = view;
  return {
    region, familySize, loanAmount, isRefi: !!isRefi, propertyState,
    activeDuty: !!V.activeDuty, sqft: +V.sqft || 0, maintRate: +V.maintRate || 0, maintUtil,
    taxMode: taxes.mode, grossUp: !!V.grossUp, notes: V.notes || "",
    grossTaxable: r.grossTaxable, taxFree: r.taxFree, grossIncome: r.grossIncome,
    fedTax: r.fedTax, stateTax: r.stateTax, fica: r.fica, otherDeductions: r.otherDeductions,
    totalDeductions: r.totalDeductions, netEffectiveIncome: r.netEffectiveIncome,
    shelter: { ...r.shelter }, totalShelter: r.totalShelter,
    obligations: { ...r.obligations }, totalObligations: r.totalObligations,
    residual: r.residual, guideline: r.guideline, guidelineBase: r.guidelineBase,
    guide: { tier: r.guide.tier, tierLabel: r.guide.tierLabel, familyUsed: r.guide.familyUsed, familyCapped: r.guide.familyCapped, adderMembers: r.guide.adderMembers, adderAmount: r.guide.adderAmount, reduction: r.guide.reduction },
    surplus: r.surplus, pctOfGuideline: r.pctOfGuideline, ratio: r.ratio, ratioHigh: r.ratioHigh,
    requiredResidual: r.requiredResidual, headroom: r.headroom,
    verdict: { key: r.verdict.key, label: r.verdict.label, detail: r.verdict.detail },
  };
}

export const fmtMoney = (v) => (v < 0 ? "−" : "") + "$" + Math.round(Math.abs(v || 0)).toLocaleString("en-US");
export const fmtMoney2 = (v) => (v < 0 ? "−" : "") + "$" + Math.abs(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtPct1 = (r) => (r === null || r === undefined || !isFinite(r)) ? "—" : `${(r * 100).toFixed(1)}%`;
