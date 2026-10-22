// src/lib/mcpTools.js
//
// The Mortgage Blueprint MCP tools (ChatGPT app + Claude connector), as pure
// handlers: input → { content, structuredContent } | { isError }. api/mcp.js
// registers them on an McpServer; everything a user reads — numbers,
// formatting, assumptions, the disclosure — lives here so vitest covers it.
//
// HARD RULES (BLUEPRINT-CHATGPT-MCP-PROMPT, 2026-10-21):
//   1. We never supply an interest rate. Every rate is the user's.
//   2. No PricePoint / RentCast / Redfin / Mapbox / Ops data — engine math only.
//   3. No income or debts are stored. open_in_blueprint's schema has no such
//      fields and is .strict(), so extra keys are rejected, not stored.
//   4. Every result carries DISCLOSURE.
//   5. Honest annotations: the calculators are read-only; the link tool writes.
//   6. Licensing (Christo 2026-10-21): every tool still calculates for any
//      state, but outside data/licensing.js's list the result says Chris can't
//      originate there (licensed: false) and nothing invites contact or a
//      pre-approval for that property.

import { z } from "zod";
import { solveMaxPrice, programMaxDTI } from "./affordability.js";
import { computeRentVsBuy } from "./rentVsBuy.js";
import { computeTaxSavings, computeRateLadder, STATE_TAX } from "./finance.js";
import { resolveBaseIdx } from "./rateLadder.js";
import { getCountyLimits, CONF_BASELINE, LIMIT_YEAR } from "../data/loanLimits.js";
import { buildScenario, resolveStateName, propertyTaxBasis } from "./mcpScenario.js";
import { isLicensedState, unlicensedLine, LICENSED_STATES_TEXT } from "../data/licensing.js";

export const BLUEPRINT_ORIGIN = "https://blueprint.realstack.app";

/** Appended to every result's text and returned as structuredContent.disclosure. Compliance must approve before App Directory submission. */
export const DISCLOSURE = "Estimate for education only, not a loan offer, rate quote, or commitment to lend. Figures use the rate and inputs you provided plus stated assumptions. Chris Granger, NMLS #952015 · Xpert Home Lending, Inc., NMLS #2179191. Equal Housing Opportunity.";

export const LOAN_TYPES = ["Conventional", "FHA", "VA", "Jumbo"];
export const FILING_STATUSES = ["Single", "MFJ", "MFS", "HOH"];
export const SOURCE_TOOLS = ["estimate_max_home_price", "compare_rent_vs_buy", "compare_rate_options"];

// ── formatting ──
const money = (n) => `${n < 0 ? "−" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const rateText = (r) => `${+r}%`;
const ptsText = (p) => (p < 0 ? `a ${+Math.abs(p)}% lender credit` : p === 0 ? "0 points" : `${+p} point${+p === 1 ? "" : "s"}`);
const r2 = (n) => Math.round(n * 100) / 100;
const mo1 = (m) => `${(Math.round(m * 10) / 10).toFixed(1)} mo`;

/** @returns {{ content: {type:"text", text:string}[], isError: true }} */
export function errorResult(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}
function okResult(text, structured) {
  return {
    content: [{ type: "text", text: `${text}\n\n${DISCLOSURE}` }],
    structuredContent: { ...structured, disclosure: DISCLOSURE },
  };
}
const badState = (s) => errorResult(`"${s}" isn't a US state this calculator recognizes. Ask the user which US state the home is in (full name or 2-letter code).`);

// ── shared schema pieces ──
const RATE = z.number().min(1).max(15)
  .describe("Annual interest rate in percent that the USER provided (e.g. 6.5). Required. If the user doesn't know one, ask for a rate they were quoted or want to test. Never invent or look up a rate.");
const TERM = z.literal([15, 20, 30]).default(30).describe("Loan term in years.");
const LOAN_TYPE = z.enum(LOAN_TYPES).default("Conventional").describe("Loan program.");
const STATE = z.string().min(2).max(40).describe("US state where the home is, full name or 2-letter code.");
const ASSUMPTIONS = z.array(z.string()).describe("Every default or simplification behind the numbers, in plain sentences.");
const DISCLOSURE_OUT = z.string().describe("Required disclosure; show it with the result.");
const LICENSED_OUT = z.boolean().describe(`Whether Chris Granger can originate a loan for a property in this state (licensed in ${LICENSED_STATES_TEXT}). When false, don't suggest contacting him or getting pre-approved through him.`);
const PAYMENT_OUT = z.object({
  principal_interest: z.number(), property_tax: z.number(), insurance: z.number(),
  mortgage_insurance: z.number(), hoa: z.number(), total: z.number(),
}).describe("Estimated monthly payment, $.");
const RATE_OPTION = z.object({
  rate: z.number().min(1).max(15).describe("Interest rate, percent."),
  points: z.number().min(-10).max(10).describe("Discount points as a percent of the loan (1 = 1%). Negative = lender credit."),
});

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

function payment(s) {
  return { principal_interest: r2(s.pi), property_tax: r2(s.tax), insurance: r2(s.ins), mortgage_insurance: r2(s.mi), hoa: r2(s.hoa), total: r2(s.total ?? s.housingPayment) };
}

// ─────────────────────────────────────────────────────────────────────────────
// estimate_max_home_price
// ─────────────────────────────────────────────────────────────────────────────

const maxPriceInput = z.object({
  annual_income: z.number().positive().describe("Gross (pre-tax) annual household income, $."),
  monthly_debts: z.number().min(0).describe("Monthly debt payments on the credit report (car, student loans, card minimums), $. Not rent."),
  cash_available: z.number().min(0).describe("Cash available for the down payment, $."),
  interest_rate: RATE,
  term_years: TERM,
  loan_type: LOAN_TYPE,
  state: STATE,
  county: z.string().max(60).optional().describe("County, for the local conforming loan limit."),
  city: z.string().max(60).optional().describe("City (California and Nevada use city-level property-tax rates)."),
  monthly_hoa: z.number().min(0).optional().describe("Monthly HOA dues, $."),
});

const maxPriceOutput = z.object({
  max_price: z.number(), down_payment: z.number(), down_payment_pct: z.number(),
  loan_amount: z.number(), total_loan_amount: z.number(),
  monthly_payment: PAYMENT_OUT,
  dti_pct: z.number(), program: z.string(), max_dti_pct: z.number(),
  limited_by: z.enum(["dti", "cash", "jumbo"]),
  max_price_before_jumbo: z.number().optional().describe("Highest price that keeps the loan under the conforming limit; present only when the max price needs a jumbo loan."),
  conforming_limit: z.number(),
  interest_rate: z.number(), term_years: z.number(), loan_type: z.string(), state: z.string(),
  licensed: LICENSED_OUT,
  assumptions: ASSUMPTIONS, disclosure: DISCLOSURE_OUT,
});

export function estimateMaxHomePrice(a) {
  const state = resolveStateName(a.state);
  if (!state) return badState(a.state);
  let confLimit = CONF_BASELINE[1];
  let limitNote = `No county given, so the ${LIMIT_YEAR} national conforming limit of ${money(confLimit)} applies (high-cost counties allow more)`;
  if (a.county) {
    const L = getCountyLimits(state, a.county, 1);
    confLimit = L.highBalance;
    limitNote = `Loan limit ${money(confLimit)} for ${a.county} County, 1 unit (${L.source})`;
  }
  const tb = propertyTaxBasis(state, a.city);
  const monthlyIncome = a.annual_income / 12;
  const r = solveMaxPrice({
    monthlyIncome, monthlyDebts: a.monthly_debts, cashAvailable: a.cash_available,
    rate: a.interest_rate, termYears: a.term_years, loanType: a.loan_type,
    confLimit, effTaxRate: tb.rate, insMonthly: null, hoaMonthly: a.monthly_hoa || 0,
  });
  const maxDTI = programMaxDTI(a.loan_type);
  if (!r.ok && r.reason === "debts-exceed") {
    return errorResult(`Debts of ${money(a.monthly_debts)}/mo exceed what ${a.loan_type} allows at this income: ${maxDTI}% of ${money(monthlyIncome)}/mo gross is ${money(monthlyIncome * maxDTI / 100)}, leaving nothing for a house payment.`);
  }
  if (!r.ok) return errorResult(`There isn't enough cash for the minimum ${a.loan_type} down payment at any workable price. Ask how much cash the user has for a down payment.`);
  if (r.maxPrice <= 0) return errorResult("At these inputs the estimate comes out under $10,000, which isn't meaningful. Check the income, debts and cash figures with the user.");

  const prog = r.program;
  const assumptions = [
    limitNote,
    tb.assumption,
    "Homeowners insurance estimated at 0.35% of price a year ($1,200 minimum)",
    "All of the cash goes to the down payment; closing costs (often 2–5% of price) are not set aside",
    `Qualifies at the ${prog.type} maximum debt-to-income ratio of ${prog.maxDTI}%`,
  ];
  if (prog.type === "Conventional") assumptions.push("Conventional mortgage insurance estimated at a flat 0.5% of the loan a year when the loan is over 80% of price");
  if (prog.type === "FHA") assumptions.push("FHA: 1.75% upfront mortgage insurance financed, plus 0.55% a year");
  if (prog.type === "VA") assumptions.push("VA: 2.3% funding fee financed (veterans with a disability rating are exempt)");
  if (a.monthly_hoa > 0) assumptions.push(`HOA of ${money(a.monthly_hoa)}/mo included`);

  const jumboLine = `Above ${money(confLimit)} this becomes a jumbo loan: 20% down, 43% DTI.`;
  const cap = r.limitedBy === "jumbo" ? `Capped by the ${money(confLimit)} loan limit, not income. ${jumboLine}`
    : r.limitedBy === "cash" ? `Capped by the down payment: a higher price needs more than ${money(a.cash_available)} down for ${prog.type}.`
    : `Capped by the ${prog.maxDTI}% max DTI for ${prog.type}.`;
  const lines = [
    `Estimated max home price: ${money(r.maxPrice)} (${a.loan_type}, ${a.term_years}-year at ${rateText(a.interest_rate)}, ${state}).`,
    `Down ${money(r.dp)} (${r.dpPct.toFixed(1)}%) · loan ${money(r.loan)} · about ${money(r.total)}/mo: principal & interest ${money(r.pi)}, tax ${money(r.tax)}, insurance ${money(r.ins)}${r.mi > 0 ? `, mortgage insurance ${money(r.mi)}` : ""}${a.monthly_hoa > 0 ? `, HOA ${money(a.monthly_hoa)}` : ""} · DTI ${(r.dti * 100).toFixed(1)}%.`,
    cap,
  ];
  if (r.isJumbo) lines.push(`${jumboLine}${r.maxConfPrice > 0 ? ` Max price that keeps the loan under the limit on ${a.loan_type} rules: ${money(r.maxConfPrice)}.` : ""}`);
  lines.push(`Assumes: ${assumptions.slice(1, 4).join("; ")}.`);
  const licensed = isLicensedState(state);
  if (!licensed) lines.push(unlicensedLine(state));

  return okResult(lines.join("\n"), {
    max_price: r.maxPrice, down_payment: r2(r.dp), down_payment_pct: r2(r.dpPct),
    loan_amount: r2(r.loan), total_loan_amount: r2(r.totalLoan),
    monthly_payment: payment({ pi: r.pi, tax: r.tax, ins: r.ins, mi: r.mi, hoa: a.monthly_hoa || 0, total: r.total }),
    dti_pct: r2(r.dti * 100), program: prog.type, max_dti_pct: prog.maxDTI,
    limited_by: r.limitedBy, ...(r.isJumbo && r.maxConfPrice > 0 ? { max_price_before_jumbo: r.maxConfPrice } : {}),
    conforming_limit: confLimit,
    interest_rate: a.interest_rate, term_years: a.term_years, loan_type: a.loan_type, state,
    licensed,
    assumptions,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// compare_rent_vs_buy
// ─────────────────────────────────────────────────────────────────────────────

const rentVsBuyInput = z.object({
  monthly_rent: z.number().positive().describe("Current monthly rent, $."),
  home_price: z.number().positive().describe("Price of the home being considered, $."),
  down_payment: z.number().min(0).describe("Down payment, $."),
  interest_rate: RATE,
  term_years: TERM,
  loan_type: LOAN_TYPE,
  state: STATE,
  city: z.string().max(60).optional().describe("City (California and Nevada use city-level property-tax rates)."),
  monthly_hoa: z.number().min(0).optional().describe("Monthly HOA dues, $."),
  rent_growth_pct: z.number().min(-5).max(15).default(3).describe("Annual rent increase, percent."),
  appreciation_pct: z.number().min(-10).max(15).default(3).describe("Annual home-value growth, percent."),
  invest_return_pct: z.number().min(-10).max(20).default(7).describe("Annual return the renter earns investing the cash not spent on buying, percent."),
  annual_income: z.number().positive().optional().describe("Gross annual household income, $. Only used to estimate the buyer's income-tax savings; not stored."),
  filing_status: z.enum(FILING_STATUSES).optional().describe("Tax filing status: Single, MFJ (married filing jointly), MFS (married filing separately), HOH (head of household)."),
});

const RVB_YEAR = z.object({
  year: z.number(), rent_monthly: z.number(), home_value: z.number(), equity: z.number(),
  buyer_net: z.number().describe("Equity minus every dollar the buyer paid (cash to close + payments) plus tax savings."),
  renter_net: z.number().describe("The invested cash-to-close balance minus every dollar of rent paid."),
});
const rentVsBuyOutput = z.object({
  home_price: z.number(), down_payment: z.number(), loan_amount: z.number(),
  interest_rate: z.number(), term_years: z.number(), loan_type: z.string(), state: z.string(),
  monthly_rent: z.number(),
  monthly_cost_to_own: PAYMENT_OUT,
  monthly_difference: z.number().describe("Cost to own minus rent today, $/mo (positive = owning costs more)."),
  cash_to_close: z.number(), closing_costs_estimated: z.boolean(),
  annual_tax_savings: z.number(),
  break_even_year: z.number().optional().describe("First year buying's net position beats renting's; absent if not within 30 years."),
  years: z.array(RVB_YEAR),
  licensed: LICENSED_OUT,
  assumptions: ASSUMPTIONS, disclosure: DISCLOSURE_OUT,
});

export function compareRentVsBuy(a) {
  const state = resolveStateName(a.state);
  if (!state) return badState(a.state);
  if (a.down_payment >= a.home_price) return errorResult("The down payment is at or above the home price, so there's no loan to compare. Ask the user to check both numbers.");
  const s = buildScenario({
    price: a.home_price, downPayment: a.down_payment, rate: a.interest_rate, termYears: a.term_years,
    loanType: a.loan_type, state, city: a.city, hoaMonthly: a.monthly_hoa,
  });
  const assumptions = [...s.assumptions];
  if (a.monthly_hoa > 0) assumptions.push(`HOA of ${money(a.monthly_hoa)}/mo included`);

  let annualTaxSavings = 0;
  let taxLine;
  if (a.annual_income && a.filing_status) {
    const t = computeTaxSavings({ yearlyInc: a.annual_income, married: a.filing_status, taxState: state, yearlyTax: s.tax * 12, loan: s.totalLoan, rate: a.interest_rate });
    annualTaxSavings = t.totalTaxSavings;
    const noStateTax = (STATE_TAX[state]?.type || "none") === "none";
    if (annualTaxSavings > 0) {
      taxLine = `Year-1 income-tax savings from owning: about ${money(annualTaxSavings)} (${money(annualTaxSavings / 12)}/mo), held flat in the projection.`;
    } else {
      taxLine = `Year-1 income-tax savings from owning: $0. The ${a.filing_status} standard deduction (${money(t.fedStdDeduction)}) beats itemizing ${money(t.fedItemized)} of mortgage interest and property tax${noStateTax ? `, and ${state} has no state income tax` : ""}.`;
    }
    assumptions.push(`Tax savings use ${LIMIT_YEAR} federal and ${state} rules for a ${a.filing_status} filer at ${money(a.annual_income)}/yr, year-1 interest, held flat for 30 years`);
  } else {
    taxLine = "Income-tax savings not counted (they need both annual income and filing status).";
    assumptions.push("Buyer's income-tax savings not counted: annual income and filing status were not both given");
  }

  const rb = computeRentVsBuy({
    rent: a.monthly_rent, rentGrowthPct: a.rent_growth_pct, investReturnPct: a.invest_return_pct,
    salesPrice: a.home_price, appreciationPct: a.appreciation_pct,
    loan: s.totalLoan, mr: s.mr, np: s.np, dp: s.downPayment, cashToClose: s.cashToClose,
    housingPayment: s.housingPayment, annualTaxSavings,
  });
  assumptions.push(
    `Rent grows ${a.rent_growth_pct}%/yr, the home appreciates ${a.appreciation_pct}%/yr, and the renter earns ${a.invest_return_pct}%/yr on the cash a purchase would have used`,
    "Model limits: the renter invests only that upfront cash, not any monthly savings; the buyer's selling costs are not deducted; tax savings stay flat",
  );

  const diff = s.housingPayment - a.monthly_rent;
  const yrs = [rb.yr5, rb.yr10, rb.yr30].filter((y) => y && y.yr !== undefined);
  const lines = [
    `Owning ${money(a.home_price)} with ${money(a.down_payment)} down at ${rateText(a.interest_rate)} (${a.term_years}-year ${a.loan_type}, ${state}) costs about ${money(s.housingPayment)}/mo vs ${money(a.monthly_rent)} rent: ${diff >= 0 ? `${money(diff)}/mo more to own` : `${money(-diff)}/mo less to own`}. Cash to close about ${money(s.cashToClose)}.`,
    "Net position (buy = equity minus all cash paid; rent = invested cash minus rent paid):",
    ...yrs.map((y) => `· Year ${y.yr}: buy ${money(y.buyerNet)} vs rent ${money(y.renterNet)} (home ${money(y.homeVal)}, equity ${money(y.equity)})`),
    rb.breakEvenYear ? `Buying pulls ahead in year ${rb.breakEvenYear}.` : "Buying doesn't pull ahead within 30 years on these assumptions.",
    taxLine,
    "Limits: the renter only invests the upfront cash; no selling costs.",
  ];
  const licensed = isLicensedState(state);
  if (!licensed) lines.push(unlicensedLine(state));

  return okResult(lines.join("\n"), {
    home_price: a.home_price, down_payment: a.down_payment, loan_amount: r2(s.totalLoan),
    interest_rate: a.interest_rate, term_years: a.term_years, loan_type: a.loan_type, state,
    monthly_rent: a.monthly_rent,
    monthly_cost_to_own: payment(s),
    monthly_difference: r2(diff),
    cash_to_close: r2(s.cashToClose), closing_costs_estimated: s.closingCostsEstimated,
    annual_tax_savings: r2(annualTaxSavings),
    ...(rb.breakEvenYear ? { break_even_year: rb.breakEvenYear } : {}),
    years: yrs.map((y) => ({ year: y.yr, rent_monthly: y.rentMo, home_value: y.homeVal, equity: y.equity, buyer_net: y.buyerNet, renter_net: y.renterNet })),
    licensed,
    assumptions,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// compare_rate_options
// ─────────────────────────────────────────────────────────────────────────────

const rateOptionsInput = z.object({
  loan_amount: z.number().positive().describe("Loan amount, $."),
  term_years: TERM,
  options: z.array(RATE_OPTION).min(2).max(8).describe("2–8 rate/point pairs from the user's quote or Loan Estimate."),
  baseline_rate: z.number().min(1).max(15).optional().describe("The option to compare against; must be one of the options' rates. Default: the option closest to 0 points."),
  hold_years: z.number().int().min(1).max(30).default(5).describe("How long the user expects to keep the loan, years."),
  marginal_tax_rate_pct: z.number().min(0).max(60).default(0).describe("Combined marginal income-tax rate if the user itemizes, percent. 0 = compare pre-tax."),
  state: z.string().min(2).max(40).optional().describe("US state where the home is, if known (full name or 2-letter code)."),
});

const RATE_ROW = z.object({
  rate: z.number(), points: z.number(), monthly_pi: z.number(),
  monthly_savings_vs_baseline: z.number().describe("Baseline P&I minus this option's P&I, $/mo (negative = higher payment)."),
  upfront_cost_vs_baseline: z.number().describe("Extra paid at closing vs the baseline, $ (negative = more lender credit)."),
  breakeven_months: z.number().optional().describe("Lower rate: months to recoup the points. Credit option: months the credit covers the higher payment. Absent for the baseline and options that never pay back."),
  breakeven_label: z.string(),
  is_baseline: z.boolean(), dominated: z.boolean(),
  dominated_by_rate: z.number().optional().describe("A lower rate that costs the same or fewer points; present only for dominated options."),
});
const rateOptionsOutput = z.object({
  loan_amount: z.number(), term_years: z.number(), hold_years: z.number(),
  baseline_rate: z.number(), marginal_tax_rate_pct: z.number(),
  options: z.array(RATE_ROW),
  best_value_rate: z.number().optional().describe("Lowest rate whose points pay back within the hold period; absent when none do."),
  credit_pick_rate: z.number().optional().describe("Highest-rate credit option whose credit outlasts the hold period; absent when none does."),
  state: z.string().optional(),
  licensed: LICENSED_OUT.optional(),
  assumptions: ASSUMPTIONS, disclosure: DISCLOSURE_OUT,
});

const sortRungs = (rungs) => rungs
  .filter((r) => r && isFinite(+r.rate) && isFinite(+r.pts) && +r.rate > 0)
  .map((r) => ({ rate: +r.rate, pts: +r.pts }))
  .sort((a, b) => b.rate - a.rate || a.pts - b.pts);

export function compareRateOptions(a) {
  let state = null;
  if (a.state) {
    state = resolveStateName(a.state);
    if (!state) return badState(a.state);
  }
  const rungs = a.options.map((o) => ({ rate: o.rate, pts: o.points }));
  const sorted = sortRungs(rungs);
  let baseIdx;
  if (a.baseline_rate !== undefined && a.baseline_rate !== null) {
    baseIdx = sorted.findIndex((r) => Math.abs(r.rate - a.baseline_rate) < 1e-9);
    if (baseIdx < 0) return errorResult(`The baseline rate ${rateText(a.baseline_rate)} isn't one of the options. Use one of: ${sorted.map((r) => rateText(r.rate)).join(", ")}.`);
  } else {
    baseIdx = resolveBaseIdx({ rungs });
  }
  const loan = a.loan_amount;
  const holdMonths = a.hold_years * 12;
  const taxRate = a.marginal_tax_rate_pct / 100;
  const deductPct = loan > 750000 ? 750000 / loan : 1;
  const L = computeRateLadder({ loan, termYears: a.term_years, rungs, baseIdx, holdMonths, taxRate, deductPct, pointsDeductible: true });
  const base = L.base;

  const lines = [`${money(loan)}, ${a.term_years}-year, compared with ${rateText(base.rate)} at ${ptsText(base.pts)} (${money(base.pi)}/mo P&I), ${a.hold_years}-year hold:`];
  for (const r of L.rows) {
    if (r.isBase) continue;
    const label = `${rateText(r.rate)} at ${ptsText(r.pts)}`;
    if (r.dominated) {
      const by = L.rows.find((o) => o.rate === r.dominatedBy && !o.dominated) || L.rows.find((o) => o.rate === r.dominatedBy);
      lines.push(`· ${label} is beaten by ${rateText(by.rate)} at ${ptsText(by.pts)}: a lower rate for the same or less.`);
    } else if (r.rate < base.rate) {
      const be = r.breakeven === 0 ? "no extra cost, so it wins from day one" : r.breakeven === null ? "no payback" : `breakeven ${mo1(r.breakeven)} (${r.band.label})`;
      lines.push(`· ${label}: ${money(r.pi)}/mo, saves ${money(r.delta)}/mo, costs ${money(r.cost)} more → ${be}.`);
    } else if (r.cost < 0) {
      lines.push(`· ${label}: ${money(r.pi)}/mo, ${money(-r.delta)}/mo more; the ${money(-r.cost)} credit covers the higher payment for ${r.breakeven === null ? "—" : mo1(r.breakeven)}.`);
    } else {
      lines.push(`· ${label}: ${money(r.pi)}/mo, ${money(-r.delta)}/mo more and costs ${money(r.cost)} more.`);
    }
  }
  const lower = L.rows.filter((r) => !r.isBase && !r.dominated && r.rate < base.rate);
  if (L.spot) lines.push(`Best value within your ${a.hold_years}-year hold: ${rateText(L.spot.rate)} at ${ptsText(L.spot.pts)}${L.spot.breakeven > 0 ? ` (pays back in ${mo1(L.spot.breakeven)})` : ""}.`);
  else if (lower.length) lines.push(`None of the lower-rate options pay off within ${a.hold_years} years.`);
  if (L.creditPick) lines.push(`Best credit option: ${rateText(L.creditPick.rate)}; its credit outlasts the ${a.hold_years}-year hold.`);
  const licensed = state ? isLicensedState(state) : null;
  if (licensed === false) lines.push(unlicensedLine(state));

  const assumptions = [
    "Compares principal & interest only; taxes, insurance and mortgage insurance are the same for every option",
    taxRate > 0
      ? `Breakevens are after tax at a ${a.marginal_tax_rate_pct}% marginal rate (points deducted, lost interest deduction counted${deductPct < 1 ? ", only the first $750,000 of loan deductible" : ""})`
      : "Breakevens are pre-tax",
    "A breakeven past your hold period means the points cost more than they save before you sell or refinance",
  ];

  return okResult(lines.join("\n"), {
    loan_amount: loan, term_years: a.term_years, hold_years: a.hold_years,
    baseline_rate: base.rate, marginal_tax_rate_pct: a.marginal_tax_rate_pct,
    options: L.rows.map((r) => ({
      rate: r.rate, points: r.pts, monthly_pi: r2(r.pi),
      monthly_savings_vs_baseline: r2(r.delta), upfront_cost_vs_baseline: r2(r.cost),
      ...(r.breakeven === null ? {} : { breakeven_months: Math.round(r.breakeven * 10) / 10 }),
      breakeven_label: r.isBase ? "Baseline"
        : r.dominated ? "Beaten by a lower rate"
        : (r.rate > base.rate && r.cost < 0) ? (r.breakeven !== null && r.breakeven >= holdMonths ? "Credit outlasts the hold" : "Credit runs out before the hold ends")
        : r.band.label,
      is_baseline: r.isBase, dominated: r.dominated, ...(r.dominatedBy !== null ? { dominated_by_rate: r.dominatedBy } : {}),
    })),
    ...(L.spot ? { best_value_rate: L.spot.rate } : {}),
    ...(L.creditPick ? { credit_pick_rate: L.creditPick.rate } : {}),
    ...(state ? { state, licensed } : {}),
    assumptions,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// open_in_blueprint
// ─────────────────────────────────────────────────────────────────────────────

// .strict(): unknown keys (annual_income, monthly_debts, …) are REJECTED, so
// nothing beyond these property + loan fields can reach the handoff row.
export const openInBlueprintInput = z.object({
  source_tool: z.enum(SOURCE_TOOLS).describe("Which calculation this link continues."),
  home_price: z.number().positive().describe("Home price, $."),
  down_payment: z.number().min(0).describe("Down payment, $."),
  interest_rate: RATE,
  term_years: TERM,
  loan_type: LOAN_TYPE,
  state: STATE,
  city: z.string().max(60).optional(),
  zip: z.string().regex(/^\d{5}$/).optional().describe("5-digit ZIP code."),
  monthly_hoa: z.number().min(0).max(10000).optional(),
  monthly_rent: z.number().positive().max(100000).optional().describe("Rent vs buy only."),
  rent_growth_pct: z.number().min(-5).max(15).optional().describe("Rent vs buy only."),
  appreciation_pct: z.number().min(-10).max(15).optional().describe("Rent vs buy only."),
  invest_return_pct: z.number().min(-10).max(20).optional().describe("Rent vs buy only."),
  options: z.array(RATE_OPTION.strict()).min(2).max(8).optional().describe("Rate options only: the same rate/point pairs."),
  baseline_rate: z.number().min(1).max(15).optional().describe("Rate options only."),
  hold_years: z.number().int().min(1).max(30).optional().describe("Rate options only."),
}).strict();

const openInBlueprintOutput = z.object({
  url: z.string(), expires_at: z.string(), source_tool: z.string(),
  licensed: LICENSED_OUT,
  disclosure: DISCLOSURE_OUT,
});

/**
 * Map validated tool args to the stored payload: property + loan fields only.
 * @returns {{ payload: object } | { error: string }}
 */
export function handoffPayload(a) {
  const state = resolveStateName(a.state);
  if (!state) return { error: "state" };
  if (a.down_payment >= a.home_price) return { error: "down" };
  const p = {
    homePrice: a.home_price, downPayment: a.down_payment, interestRate: a.interest_rate,
    termYears: a.term_years, loanType: a.loan_type, state,
    // The app drops its "talk to Chris / Get Pre-Approved" line when false.
    licensed: isLicensedState(state),
  };
  if (a.city) p.city = a.city.trim();
  if (a.zip) p.zip = a.zip;
  if (a.monthly_hoa !== undefined) p.monthlyHoa = a.monthly_hoa;
  if (a.source_tool === "compare_rent_vs_buy") {
    if (a.monthly_rent !== undefined) p.monthlyRent = a.monthly_rent;
    if (a.rent_growth_pct !== undefined) p.rentGrowthPct = a.rent_growth_pct;
    if (a.appreciation_pct !== undefined) p.appreciationPct = a.appreciation_pct;
    if (a.invest_return_pct !== undefined) p.investReturnPct = a.invest_return_pct;
  }
  if (a.source_tool === "compare_rate_options") {
    if (a.options) p.options = a.options.map((o) => ({ rate: o.rate, points: o.points }));
    if (a.baseline_rate !== undefined) p.baselineRate = a.baseline_rate;
    if (a.hold_years !== undefined) p.holdYears = a.hold_years;
  }
  return { payload: p };
}

const HANDOFF_ERRORS = {
  "missing-table": "Saving links isn't available yet. The numbers above still stand; the user can open blueprint.realstack.app and enter them directly.",
  paused: "Link creation is paused — try again tomorrow.",
  "ip-cap": "Too many links were created from this connection in the last hour — try again later.",
  failed: "Couldn't create the link just now — try again in a moment.",
};

/**
 * @param {object} a validated args
 * @param {{ saveHandoff?: (row: {sourceTool:string, payload:object}) => Promise<{token:string, expiresAt:string}|{error:string}> }} ctx
 */
export async function openInBlueprint(a, ctx = {}) {
  const h = handoffPayload(a);
  if (h.error === "state") return badState(a.state);
  if (h.error) return errorResult("The down payment is at or above the home price. Ask the user to check both numbers.");
  if (!ctx.saveHandoff) return errorResult(HANDOFF_ERRORS["missing-table"]);
  const saved = await ctx.saveHandoff({ sourceTool: a.source_tool, payload: h.payload });
  if (saved.error) return errorResult(HANDOFF_ERRORS[saved.error] || HANDOFF_ERRORS.failed);
  const url = `${BLUEPRINT_ORIGIN}/?plan=${saved.token}`;
  const licensed = h.payload.licensed;
  const text = [
    `Open this scenario in Mortgage Blueprint: ${url}`,
    licensed
      ? "It opens with the home price, down payment, rate and term filled in. From there the user can adjust every number, see closing costs and taxes, add income to check what they qualify for, save it, and reach a loan officer. The link works for 30 days."
      : "It opens with the home price, down payment, rate and term filled in. Blueprint is free to use for planning: the user can adjust every number, see closing costs and taxes, and save it. The link works for 30 days.",
    ...(licensed ? [] : [unlicensedLine(h.payload.state)]),
  ].join("\n");
  return okResult(text, { url, expires_at: saved.expiresAt, source_tool: a.source_tool, licensed });
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry — api/mcp.js registers each entry with server.registerTool.
// ─────────────────────────────────────────────────────────────────────────────

const safe = (fn) => async (args, ctx) => {
  try { return await fn(args, ctx); }
  catch { return errorResult("Something went wrong running this calculation. Try again, or check the inputs with the user."); }
};

export const TOOLS = [
  {
    name: "estimate_max_home_price",
    config: {
      title: "Estimate max home price",
      description: "Estimate the highest home price a buyer may qualify for, from their income, monthly debts, cash for a down payment, and an interest rate they provide. Uses loan-program debt-to-income limits (Conventional, FHA, VA, Jumbo) and county conforming limits. Ask the user for any missing input; if they don't know a rate, ask for one they were quoted or want to test. Never invent a rate.",
      inputSchema: maxPriceInput,
      outputSchema: maxPriceOutput,
      annotations: { title: "Estimate max home price", ...READ_ONLY },
    },
    handler: safe(estimateMaxHomePrice),
  },
  {
    name: "compare_rent_vs_buy",
    config: {
      title: "Compare renting vs buying",
      description: "Compare continuing to rent against buying a specific home over 5, 10 and 30 years: monthly cost, equity, and the year buying pulls ahead. Needs current rent, home price, down payment, and an interest rate the user provides. Ask for anything missing. Never invent a rate. Income and filing status are optional and only used for the buyer's tax savings.",
      inputSchema: rentVsBuyInput,
      outputSchema: rentVsBuyOutput,
      annotations: { title: "Compare renting vs buying", ...READ_ONLY },
    },
    handler: safe(compareRentVsBuy),
  },
  {
    name: "compare_rate_options",
    config: {
      title: "Compare rate and points options",
      description: "Compare interest-rate options from a lender quote or Loan Estimate, where lower rates cost discount points and higher rates may come with a lender credit. Shows the monthly payment difference, the upfront cost, and how many months until paying points breaks even. Use only rate/point pairs the user provides; never make up pricing. Pass the property's state if known.",
      inputSchema: rateOptionsInput,
      outputSchema: rateOptionsOutput,
      annotations: { title: "Compare rate and points options", ...READ_ONLY },
    },
    handler: safe(compareRateOptions),
  },
  {
    name: "open_in_blueprint",
    config: {
      title: "Open in Mortgage Blueprint",
      description: `Create a link that opens this scenario in Mortgage Blueprint, a free mortgage planning app, where the user can adjust every number, see closing costs and taxes, and save it. Call this when the user wants to save, share, dig deeper, or 'see the full breakdown'. Pass the same property and loan inputs used in the previous calculation. Do not pass income or debts. Only mention talking to a loan officer if the result says licensed: true (Chris Granger is licensed in ${LICENSED_STATES_TEXT}).`,
      inputSchema: openInBlueprintInput,
      outputSchema: openInBlueprintOutput,
      annotations: { title: "Open in Mortgage Blueprint", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    handler: safe(openInBlueprint),
  },
];
