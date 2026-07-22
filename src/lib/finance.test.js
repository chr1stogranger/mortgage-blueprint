// src/lib/finance.test.js
//
// The 10 highest-value tests from the CIO audit (M-3), pinning the money math.
// Run: npm test   (vitest)
//
// Expected values are computed INDEPENDENTLY (by hand / closed-form), not by
// running the code under test — so a regression in finance.js fails loudly.

import { describe, it, expect } from "vitest";
import {
  calcPI, calcBalance, balanceAfter, computeLTV, computeDTI,
  getPMIRate, getFHAMipRate, vaFundingFeeRate, toMonthly,
  computeTaxSavings, buildAmortization, computeProp19, calcTempBuydown,
  computeIncomeMethods, isDecliningIncome, computePassiveLossAllowance,
} from "./finance.js";

// ── 1. P&I — standard formula + 0%-rate guard ───────────────────────────────
describe("calcPI", () => {
  it("matches the closed-form payment: $640k @ 6.5% / 30yr ≈ $4,045", () => {
    // M = P·r(1+r)^n/((1+r)^n−1); r=0.065/12, n=360 → 4045.18 (hand-computed)
    expect(calcPI(640000, 6.5, 30)).toBeCloseTo(4045.18, 0);
  });
  it("0% rate falls back to straight-line principal (no division by zero)", () => {
    expect(calcPI(360000, 0, 30)).toBe(1000); // 360000 / 360
  });
  it("zero / missing loan returns 0", () => {
    expect(calcPI(0, 6.5, 30)).toBe(0);
    expect(calcPI(undefined, 6.5, 30)).toBe(0);
  });
});

// ── 2. Amortization — zeroes out, no drift, extra payments save interest ────
describe("buildAmortization", () => {
  const loan = 500000, rate = 6, term = 30;
  const mr = rate / 100 / 12, np = term * 12;
  const pi = calcPI(loan, rate, term);
  const closeDate = new Date(2026, 0, 15);

  it("final balance zeroes out exactly (≤ 1 cent) over the full term", () => {
    const a = buildAmortization({ loan, mr, np, pi, extra: 0, closeDate });
    expect(a.amortStandard).toHaveLength(360);
    expect(a.amortStandard[359].bal).toBeLessThanOrEqual(0.01);
    expect(a.amortSchedule[a.amortSchedule.length - 1].bal).toBeLessThanOrEqual(0.01);
  });
  it("total interest matches closed form: pi×360 − principal", () => {
    const a = buildAmortization({ loan, mr, np, pi, extra: 0, closeDate });
    // Σinterest = total paid − principal = 2997.75×360 − 500000 ≈ 579,191
    expect(a.totalIntStandard).toBeCloseTo(pi * 360 - loan, 0);
  });
  it("extra payments shorten the loan and save interest", () => {
    const a = buildAmortization({ loan, mr, np, pi, extra: 500, closeDate });
    expect(a.monthsSaved).toBeGreaterThan(0);
    expect(a.intSaved).toBeGreaterThan(0);
    expect(a.amortSchedule.length).toBeLessThan(360);
  });
});

// ── 3. PMI matrix — bucket boundaries + FICO default ─────────────────────────
describe("getPMIRate", () => {
  it("95% LTV / 760 FICO → 0.38% (Radian card)", () => {
    expect(getPMIRate(0.95, 760)).toBe(0.0038);
  });
  it("LTV just above 95% jumps to the 97 bucket", () => {
    expect(getPMIRate(0.96, 760)).toBe(0.0058);
  });
  it("85% LTV / 700 FICO → 0.25%; missing FICO defaults to 700 column", () => {
    expect(getPMIRate(0.85, 700)).toBe(0.0025);
    expect(getPMIRate(0.95, 0)).toBe(0.0068); // defaults to 700
  });
});

// ── 4. FHA MIP — base-limit and LTV boundaries ───────────────────────────────
describe("getFHAMipRate", () => {
  it("≤ $726,200 base: 0.55% above 95% LTV, 0.50% at/below", () => {
    expect(getFHAMipRate(500000, 0.965)).toBe(0.0055);
    expect(getFHAMipRate(500000, 0.95)).toBe(0.0050);
  });
  it("> $726,200 base: 0.75% / 0.70%; boundary itself counts as NOT over", () => {
    expect(getFHAMipRate(800000, 0.96)).toBe(0.0075);
    expect(getFHAMipRate(800000, 0.90)).toBe(0.0070);
    expect(getFHAMipRate(726200, 0.96)).toBe(0.0055); // exactly at limit
  });
});

// ── 5. VA funding fee tiers ───────────────────────────────────────────────────
describe("vaFundingFeeRate", () => {
  it("First Use: 2.15% / 1.5% / 1.25% by down-payment band", () => {
    expect(vaFundingFeeRate("First Use", 0)).toBe(0.0215);
    expect(vaFundingFeeRate("First Use", 5)).toBe(0.015);
    expect(vaFundingFeeRate("First Use", 10)).toBe(0.0125);
  });
  it("Subsequent use 0-down → 3.3%; Disabled → 0; unknown usage → 0", () => {
    expect(vaFundingFeeRate("Subsequent", 0)).toBe(0.033);
    expect(vaFundingFeeRate("Disabled", 0)).toBe(0);
    expect(vaFundingFeeRate("???", 0)).toBe(0);
  });
});

// ── 6. Tax savings — standard-vs-itemized crossover + $750k cap ──────────────
describe("computeTaxSavings", () => {
  it("returns $0 when the standard deduction wins (small loan, no-tax state)", () => {
    // MFJ itemized = 2000 prop tax + 3000 interest = 5000 < 32200 std → no benefit
    const t = computeTaxSavings({ yearlyInc: 80000, married: "MFJ", taxState: "Texas", yearlyTax: 2000, loan: 100000, rate: 3 });
    expect(t.totalTaxSavings).toBe(0);
  });
  it("applies the $750k interest cap pro-rata ($800k loan → 93.75% deductible)", () => {
    const t = computeTaxSavings({ yearlyInc: 300000, married: "MFJ", taxState: "California", yearlyTax: 10000, loan: 800000, rate: 6.5 });
    expect(t.deductibleLoanPct).toBeCloseTo(750000 / 800000, 10);
    expect(t.totalMortInt).toBeCloseTo(52000, 5); // 800000 × 6.5% (year-1 estimate)
    expect(t.totalTaxSavings).toBeGreaterThan(0);
  });
  it("never returns negative savings", () => {
    const t = computeTaxSavings({ yearlyInc: 0, married: "Single", taxState: "California", yearlyTax: 0, loan: 0, rate: 0 });
    expect(t.totalTaxSavings).toBeGreaterThanOrEqual(0);
  });
});

// ── 7+8. Prop 19 — basis transfer rules ──────────────────────────────────────
describe("computeProp19", () => {
  const base = {
    autoCountyRate: 0.012, rateOverridePct: 0, oldTaxableValue: 200000,
    oldSalePrice: 1000000, isPrimary: true, fixedAssessments: 0,
    transfersUsed: 0, saleDate: "", purchaseDate: "", isCalifornia: true,
  };
  it("equal-or-lesser replacement keeps the old Prop 13 base 1:1", () => {
    const p = computeProp19({ ...base, replacementPrice: 900000 });
    expect(p.sameOrLower).toBe(true);
    expect(p.newTaxableValue).toBe(200000);
    // (200000 − 7000 exemption) × 1.2% = 2,316/yr vs (900000−7000)×1.2% = 10,716
    expect(p.prop19Annual).toBeCloseTo(2316, 5);
    expect(p.annualSavings).toBeCloseTo(10716 - 2316, 5);
  });
  it("greater-value replacement adds ONLY the price difference to the old base", () => {
    const p = computeProp19({ ...base, replacementPrice: 1500000 });
    expect(p.sameOrLower).toBe(false);
    expect(p.newTaxableValue).toBe(200000 + 500000); // old base + (1.5M − 1.0M)
  });
  it("730-day window: 729 days OK, 731 days warns (local-midnight parsing, L-6)", () => {
    const ok = computeProp19({ ...base, replacementPrice: 900000, saleDate: "2025-01-01", purchaseDate: "2026-12-31" }); // 729 days
    expect(ok.warnings.join(" ")).not.toMatch(/730/);
    const bad = computeProp19({ ...base, replacementPrice: 900000, saleDate: "2024-01-01", purchaseDate: "2026-01-01" }); // 731 days (2024 leap)
    expect(bad.warnings.join(" ")).toMatch(/730/);
  });
});

// ── 9. LTV / DTI guards ───────────────────────────────────────────────────────
describe("computeLTV / computeDTI guards", () => {
  it("LTV returns 0 (not NaN/Infinity) when value is 0", () => {
    expect(computeLTV(100000, 0)).toBe(0);
    expect(computeLTV(850000, 1000000)).toBeCloseTo(0.85, 10);
  });
  it("DTI returns null (not 0) when income is unknown — UI shows '—'", () => {
    expect(computeDTI(5000, 0)).toBeNull();
    expect(computeDTI(5000, -1)).toBeNull();
  });
});

// ── 10. DTI display regression (audit C-2: '43%' not '0.4%') ─────────────────
describe("DTI fraction → percent display", () => {
  it("$6,785 payment on $25,000/mo income renders 27.1%, not 0.3%", () => {
    const dti = computeDTI(6785, 25000);
    expect(dti).toBeCloseTo(0.2714, 4);              // the fraction
    expect(((dti ?? 0) * 100).toFixed(1) + "%").toBe("27.1%"); // the display (C-2 fix)
  });
});

// ── bonus: balance + toMonthly sanity ────────────────────────────────────────
describe("balances and income frequency", () => {
  it("balance after 0 payments = full loan; after all payments ≈ 0", () => {
    expect(calcBalance(300000, 6, 30, 0)).toBeCloseTo(300000, 6);
    expect(calcBalance(300000, 6, 30, 360)).toBeCloseTo(0, 6);
    expect(balanceAfter(300000, 0.005, 360, 360)).toBeCloseTo(0, 6);
  });
  it("toMonthly converts every supported frequency", () => {
    expect(toMonthly(120000, "Annual")).toBe(10000);
    expect(toMonthly(60000, "Bi-Annual")).toBe(10000);
    expect(toMonthly(30000, "Quarterly")).toBe(10000);
    expect(toMonthly(5000, "Semi-Monthly")).toBe(10000);
    expect(toMonthly(4615.38, "Bi-Weekly")).toBeCloseTo(10000, 0);
    expect(toMonthly(50, "Hourly")).toBeCloseTo(8666.67, 1); // 50×2080/12
    expect(toMonthly(10000, "Monthly")).toBe(10000);
  });
});

// ── 11. Temporary buydown (B2) — 2-1 / 1-0 / 3-2-1 escrow subsidy math ───────
describe("calcTempBuydown", () => {
  // $500k @ 6.5% / 30yr — hand-checked reference values (±$2 on the totals);
  // internal consistency asserted against calcPI's own outputs so a rounding
  // tweak in calcPI can't silently drift these tests.
  const loan = 500000, note = 6.5, term = 30;
  const notePI = calcPI(loan, note, term); // ≈ 3160.34

  it("2-1: yr1 @ 4.5% ≈ $2,533.43, yr2 @ 5.5% ≈ $2,838.95, total ≈ $11,379.6", () => {
    const b = calcTempBuydown(loan, note, term, "2-1");
    expect(b.notePI).toBeCloseTo(notePI, 6);
    expect(b.notePI).toBeCloseTo(3160.34, 1);
    expect(b.years).toHaveLength(2);
    expect(b.years[0].rate).toBe(4.5);
    expect(b.years[0].pi).toBeCloseTo(2533.43, 1);
    expect(b.years[0].monthlySavings).toBeCloseTo(626.91, 1);
    expect(b.years[1].rate).toBe(5.5);
    expect(b.years[1].pi).toBeCloseTo(2838.95, 1);
    expect(b.years[1].monthlySavings).toBeCloseTo(321.39, 1);
    expect(Math.abs(b.totalCost - 11379.6)).toBeLessThan(2);
    // consistency: totalCost is exactly the sum of annual savings from calcPI
    const expected = b.years.reduce((s, y) => s + (notePI - calcPI(loan, y.rate, term)) * 12, 0);
    expect(b.totalCost).toBeCloseTo(expected, 6);
  });

  it("1-0: single year @ 5.5%, total ≈ $3,856.7", () => {
    const b = calcTempBuydown(loan, note, term, "1-0");
    expect(b.years).toHaveLength(1);
    expect(b.years[0].rate).toBe(5.5);
    expect(b.years[0].annualSavings).toBeCloseTo((notePI - calcPI(loan, 5.5, term)) * 12, 6);
    expect(Math.abs(b.totalCost - 3856.7)).toBeLessThan(2);
  });

  it("3-2-1: three descending cuts, years numbered 1..3", () => {
    const b = calcTempBuydown(loan, note, term, "3-2-1");
    expect(b.years.map(y => y.rate)).toEqual([3.5, 4.5, 5.5]);
    expect(b.years.map(y => y.year)).toEqual([1, 2, 3]);
    // deeper cut in yr1 must save more than yr2, yr2 more than yr3
    expect(b.years[0].monthlySavings).toBeGreaterThan(b.years[1].monthlySavings);
    expect(b.years[1].monthlySavings).toBeGreaterThan(b.years[2].monthlySavings);
  });

  it("clamps at 0% when the cut exceeds the note rate (2.5% note, 3-2-1)", () => {
    const b = calcTempBuydown(400000, 2.5, 30, "3-2-1");
    expect(b.years[0].rate).toBe(0);
    expect(b.years[0].pi).toBeCloseTo(400000 / 360, 6); // calcPI 0%-rate straight-line
    expect(b.years[1].rate).toBeCloseTo(0.5, 10);
  });

  it("zero loan yields all-zero payments and zero cost", () => {
    const b = calcTempBuydown(0, 6.5, 30, "2-1");
    expect(b.notePI).toBe(0);
    expect(b.totalCost).toBe(0);
  });
});

// ── Variable-income averaging — declining-income protection ─────────────────
// Guards the drift that shipped: the Income tab applied the Fannie/Freddie
// declining collapse but the qualifying-income aggregation didn't, so DTI ran
// optimistic for declining-income borrowers (py1=40k, py2=50k showed
// $3,333/mo on Income but fed $3,750/mo into DTI). Both now import this.
describe("isDecliningIncome", () => {
  it("true only when both years entered and year-2 exceeds year-1", () => {
    expect(isDecliningIncome(40000, 50000)).toBe(true);
    expect(isDecliningIncome(50000, 40000)).toBe(false);
    expect(isDecliningIncome(50000, 50000)).toBe(false);
  });
  it("a missing year never counts as declining", () => {
    expect(isDecliningIncome(0, 50000)).toBe(false);
    expect(isDecliningIncome(40000, 0)).toBe(false);
    expect(isDecliningIncome("", 50000)).toBe(false);
  });
});

describe("computeIncomeMethods", () => {
  // 6 months elapsed → ytdAnn = 24000 × 12 / 6 = 48000
  const base = { ytd: 24000, py1: 40000, py2: 50000, monthsElapsed: 6 };

  it("declining (py2 > py1): 2-year methods collapse to most recent year", () => {
    const m = computeIncomeMethods(base);
    expect(m["2Y+"]).toBe(40000);              // NOT (40k+50k)/2 = 45k
    expect(m["2Y_YTD"]).toBe((40000 + 48000) / 2); // NOT (40k+50k+48k)/3
    // the live repro: $40k declining "2Y+" must be $3,333/mo, not $3,750
    expect(m["2Y+"] / 12).toBeCloseTo(3333.33, 1);
  });

  it("declining leaves the 1-year methods untouched", () => {
    const m = computeIncomeMethods(base);
    expect(m["1Y+"]).toBe(40000);
    expect(m["1Y_YTD"]).toBe((40000 + 48000) / 2);
  });

  it("rising (py1 ≥ py2): true 2-year averages", () => {
    const m = computeIncomeMethods({ ytd: 24000, py1: 50000, py2: 40000, monthsElapsed: 6 });
    expect(m["2Y+"]).toBe(45000);
    expect(m["2Y_YTD"]).toBe((50000 + 40000 + 48000) / 3);
  });

  it("string inputs and missing fields coerce safely", () => {
    const m = computeIncomeMethods({ ytd: "", py1: "40000", py2: "50000", monthsElapsed: 6 });
    expect(m["2Y+"]).toBe(40000);      // declining still detected from strings
    expect(m["1Y_YTD"]).toBe(20000);   // no YTD → ytdAnn 0 → 40000/2
  });

  it("monthsElapsed floors at 1 (no divide-by-zero on January YTD)", () => {
    const m = computeIncomeMethods({ ytd: 5000, py1: 60000, py2: 0, monthsElapsed: 0 });
    expect(m["1Y_YTD"]).toBe((60000 + 60000) / 2); // ytdAnn = 5000×12/1
  });
});

describe("computePassiveLossAllowance (§469i)", () => {
 const run = (magi, loss = 50000, married = "MFJ") => computePassiveLossAllowance({ magi, loss, married });

 it("gives the full $25K below the phase-out", () => {
  expect(run(80000).allowance).toBe(25000);
  expect(run(100000).allowance).toBe(25000);
 });

 it("burns off at 50 cents per dollar through the band", () => {
  expect(run(110000).allowance).toBe(20000);
  expect(run(130000).allowance).toBe(10000);
  expect(run(140000).allowance).toBe(5000);
 });

 it("is zero at and above $150K — the case the old copy got wrong", () => {
  expect(run(150000).allowance).toBe(0);
  expect(run(162000).allowance).toBe(0);
  expect(run(500000).allowance).toBe(0);
 });

 it("suspends whatever it cannot deduct, losing nothing", () => {
  const r = run(162000, 76904);
  expect(r.deductibleNow).toBe(0);
  expect(r.suspended).toBe(76904);
  const mid = run(130000, 76904);
  expect(mid.deductibleNow + mid.suspended).toBe(76904);
 });

 it("never deducts more than the loss itself", () => {
  const r = run(80000, 4000);
  expect(r.deductibleNow).toBe(4000);
  expect(r.suspended).toBe(0);
 });

 it("halves the allowance and the band for MFS", () => {
  expect(run(40000, 50000, "MFS").allowance).toBe(12500);
  expect(run(60000, 50000, "MFS").allowance).toBe(7500);
  expect(run(75000, 50000, "MFS").allowance).toBe(0);
 });

 it("handles a zero loss and junk input without throwing", () => {
  expect(run(120000, 0).deductibleNow).toBe(0);
  expect(computePassiveLossAllowance({ magi: NaN, loss: NaN }).suspended).toBe(0);
 });
});
