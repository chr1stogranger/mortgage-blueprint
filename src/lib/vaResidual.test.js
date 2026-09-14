// src/lib/vaResidual.test.js
//
// VA residual income engine. Expected values are hand-computed from the VA
// Lenders Handbook (Ch. 4, Topic 9) table and the 26-6393 walk — not by
// running the code under test.

import { describe, it, expect } from "vitest";
import {
  regionForState, vaGuideline, estimatePayrollTaxes, computeVaResidual,
  buildVaResidualView, vaResidualPdfData, normalizeVaResidual, DEFAULT_VA_RESIDUAL,
  VA_REGIONS,
} from "./vaResidual.js";

describe("regionForState", () => {
  it("maps every state, DC and Puerto Rico to one of the four VA regions", () => {
    expect(regionForState("California")).toBe("West");
    expect(regionForState("Texas")).toBe("South");
    expect(regionForState("Ohio")).toBe("Midwest");
    expect(regionForState("New York")).toBe("Northeast");
    expect(regionForState("District of Columbia")).toBe("South");
    expect(regionForState("Puerto Rico")).toBe("South");
    expect(regionForState("Guam")).toBeNull();
    expect(regionForState("")).toBeNull();
    const all = Object.values(VA_REGIONS).flat();
    expect(all.length).toBe(52); // 50 states + DC + PR
    expect(new Set(all).size).toBe(52);
  });
});

describe("vaGuideline", () => {
  it("reads the $80,000-and-above table by region and family size", () => {
    expect(vaGuideline({ region: "West", familySize: 4, loanAmount: 500000 }).adjusted).toBe(1117);
    expect(vaGuideline({ region: "Northeast", familySize: 1, loanAmount: 80000 }).adjusted).toBe(450);
    expect(vaGuideline({ region: "Midwest", familySize: 2, loanAmount: 250000 }).adjusted).toBe(738);
    expect(vaGuideline({ region: "South", familySize: 5, loanAmount: 300000 }).adjusted).toBe(1039);
  });
  it("uses the $79,999-and-below table under the break", () => {
    expect(vaGuideline({ region: "Northeast", familySize: 1, loanAmount: 75000 }).adjusted).toBe(390);
    expect(vaGuideline({ region: "West", familySize: 3, loanAmount: 79999 }).adjusted).toBe(859);
    expect(vaGuideline({ region: "West", familySize: 3, loanAmount: 79999 }).tier).toBe("low");
    expect(vaGuideline({ region: "West", familySize: 3, loanAmount: 80000 }).tier).toBe("high");
  });
  it("adds $80 / $75 per member over five, stopping at a family of seven", () => {
    const six = vaGuideline({ region: "South", familySize: 6, loanAmount: 400000 });
    expect(six.adjusted).toBe(1039 + 80);
    expect(six.adderMembers).toBe(1);
    expect(vaGuideline({ region: "South", familySize: 7, loanAmount: 400000 }).adjusted).toBe(1039 + 160);
    const nine = vaGuideline({ region: "South", familySize: 9, loanAmount: 400000 });
    expect(nine.adjusted).toBe(1039 + 160);
    expect(nine.familyCapped).toBe(true);
    expect(vaGuideline({ region: "West", familySize: 6, loanAmount: 60000 }).adjusted).toBe(1004 + 75);
  });
  it("reduces the guideline 5% for active-duty / commissary households", () => {
    const g = vaGuideline({ region: "West", familySize: 4, loanAmount: 500000, activeDuty: true });
    expect(g.base).toBe(1117);
    expect(g.adjusted).toBeCloseTo(1061.15, 2);
  });
  it("returns zero with a null region when the region is unknown", () => {
    const g = vaGuideline({ region: "", familySize: 2, loanAmount: 300000 });
    expect(g.adjusted).toBe(0);
    expect(g.region).toBeNull();
  });
});

describe("estimatePayrollTaxes", () => {
  it("walks the 2026 single brackets after the standard deduction", () => {
    // $120,000 − $16,100 std = $103,900 taxable → 1,240 + 4,559.88 + 11,769.78 = $17,569.66/yr
    const t = estimatePayrollTaxes({ annualTaxable: 120000, married: "Single", taxState: "Alaska" });
    expect(t.fed).toBeCloseTo(17569.66 / 12, 0);
    expect(t.state).toBe(0);
    // FICA: 6.2% × 120k + 1.45% × 120k = 9,180/yr
    expect(t.fica).toBeCloseTo(765, 2);
  });
  it("handles flat-rate states and caps Social Security at the wage base", () => {
    const t = estimatePayrollTaxes({ annualTaxable: 240000, married: "MFJ", taxState: "Arizona" });
    expect(t.state).toBeCloseTo(240000 * 0.025 / 12, 2);
    // SS capped at $184,500 × 6.2% = 11,439; Medicare 1.45% × 240k = 3,480 (MFJ threshold 250k → no surtax)
    expect(t.ss).toBeCloseTo(11439 / 12, 2);
    expect(t.medicare).toBeCloseTo(3480 / 12, 2);
  });
  it("falls back to Single for an unknown filing status and never goes negative", () => {
    const t = estimatePayrollTaxes({ annualTaxable: 10000, married: "Bogus", taxState: "Nowhere" });
    expect(t.fed).toBe(0);
    expect(t.state).toBe(0);
  });
});

describe("computeVaResidual", () => {
  const base = {
    grossTaxable: 10000, taxFree: 500, fedTax: 1200, stateTax: 400, fica: 765, otherDeductions: 100,
    pi: 3000, propertyTax: 500, hazardIns: 100, specialAssessments: 0, maintUtil: 280, hoa: 0,
    debts: 600, childcare: 400, supportPaid: 0, jobExpenses: 0, otherObligations: 0,
    region: "West", familySize: 3, loanAmount: 600000, activeDuty: false, grossUpPct: 0.25,
  };
  it("walks Form 26-6393: net take-home − shelter − obligations = residual", () => {
    const r = computeVaResidual(base);
    expect(r.grossIncome).toBe(10500);
    expect(r.totalDeductions).toBe(2465);
    expect(r.netEffectiveIncome).toBe(8035);
    expect(r.totalShelter).toBe(3880);
    expect(r.totalObligations).toBe(1000);
    expect(r.residual).toBe(3155);
    expect(r.guideline).toBe(990);
    expect(r.surplus).toBe(2165);
  });
  it("ratio excludes maintenance & utilities and grosses up tax-free income 25%", () => {
    const r = computeVaResidual(base);
    // (3600 shelter w/o M&U + 1000 debts) ÷ (10000 + 500 × 1.25) = 4600 / 10625
    expect(r.ratio).toBeCloseTo(4600 / 10625, 6);
    const noGross = computeVaResidual({ ...base, grossUpPct: 0 });
    expect(noGross.ratio).toBeCloseTo(4600 / 10500, 6);
  });
  it("passes on the 120% rule when the ratio is over 41%", () => {
    const r = computeVaResidual(base);
    expect(r.ratioHigh).toBe(true);
    expect(r.requiredResidual).toBeCloseTo(1188, 6);
    expect(r.headroom).toBeCloseTo(3155 - 1188, 6);
    expect(r.verdict.key).toBe("pass");
    expect(r.verdict.label).toMatch(/120%/);
  });
  it("flags caution when residual clears the table but not 120% with a high ratio", () => {
    const r = computeVaResidual({
      grossTaxable: 6000, taxFree: 0, fedTax: 600, stateTax: 200, fica: 459, otherDeductions: 0,
      pi: 2400, propertyTax: 300, hazardIns: 100, maintUtil: 0, hoa: 0, debts: 600,
      region: "West", familySize: 5, loanAmount: 400000,
    });
    expect(r.residual).toBe(1341);
    expect(r.guideline).toBe(1158);
    expect(r.ratio).toBeCloseTo(3400 / 6000, 6);
    expect(r.verdict.key).toBe("caution");
  });
  it("fails below the guideline", () => {
    const r = computeVaResidual({
      grossTaxable: 5000, fedTax: 500, fica: 382.5, pi: 2500, propertyTax: 400, hazardIns: 100, debts: 500,
      region: "West", familySize: 5, loanAmount: 400000,
    });
    expect(r.residual).toBeCloseTo(617.5, 6);
    expect(r.verdict.key).toBe("fail");
    expect(r.surplus).toBeLessThan(0);
  });
  it("passes plainly when the ratio is at or under 41%", () => {
    const r = computeVaResidual({ grossTaxable: 10000, pi: 2000, propertyTax: 400, hazardIns: 100, debts: 500, region: "West", familySize: 1, loanAmount: 400000 });
    expect(r.ratio).toBeCloseTo(0.30, 6);
    expect(r.ratioHigh).toBe(false);
    expect(r.requiredResidual).toBe(491);
    expect(r.verdict.key).toBe("pass");
    expect(r.verdict.label).toBe("Passes");
  });
  it("asks for a region / income before judging", () => {
    expect(computeVaResidual({ ...base, region: "" }).verdict.key).toBe("none");
    expect(computeVaResidual({ ...base, grossTaxable: 0, taxFree: 0 }).verdict.key).toBe("none");
  });
  it("treats garbage inputs as zero", () => {
    const r = computeVaResidual({ grossTaxable: "abc", pi: -50, region: "West", familySize: 1, loanAmount: 100000 });
    expect(r.grossIncome).toBe(0);
    expect(r.shelter.pi).toBe(0);
  });
});

describe("buildVaResidualView", () => {
  const calc = { loan: 600000, pi: 3500, monthlyTax: 600, ins: 120, monthlyHOA: 250, qualifyingIncome: 12000, totalMonthlyDebts: 700, reoNegativeDebt: 0 };
  it("resolves region, family size, shelter and debts from the scenario", () => {
    const v = buildVaResidualView({ calc, isRefi: false, propertyState: "California", married: "MFJ", taxState: "California", vaResidual: { sqft: 1800 } });
    expect(v.region).toBe("West");
    expect(v.familySize).toBe(2);
    expect(v.familyAuto).toBe(true);
    expect(v.maintUtil).toBeCloseTo(252, 6);
    expect(v.result.guideline).toBe(823);
    expect(v.result.shelter).toEqual({ pi: 3500, propertyTax: 600, hazardIns: 120, specialAssessments: 0, maintUtil: 252, hoa: 250 });
    expect(v.result.obligations.debts).toBe(700);
    expect(v.result.grossTaxable).toBe(12000);
    expect(v.taxes.mode).toBe("auto");
    expect(v.taxes.fed).toBeGreaterThan(0);
    expect(v.taxes.state).toBeGreaterThan(0);
  });
  it("honors manual taxes, manual income/debts, a region override and the M&U override", () => {
    const v = buildVaResidualView({
      calc, isRefi: false, propertyState: "California", married: "Single", taxState: "California",
      vaResidual: { taxMode: "manual", fedTax: 1500, stateTax: 500, fica: 800, incomeMode: "manual", grossIncomeManual: 9000, debtMode: "manual", debtsManual: 300, regionOverride: "South", familySize: 4, maintUtilOverride: 175 },
    });
    expect(v.region).toBe("South");
    expect(v.regionIsOverride).toBe(true);
    expect(v.result.guideline).toBe(1003);
    expect(v.result.fedTax).toBe(1500);
    expect(v.result.grossTaxable).toBe(9000);
    expect(v.result.obligations.debts).toBe(300);
    expect(v.maintUtil).toBe(175);
    expect(v.maintIsOverride).toBe(true);
    // 9000 − 2800 = 6200 net; shelter 3500+600+120+175+250 = 4645; debts 300 → 1255 residual
    expect(v.result.residual).toBe(1255);
  });
  it("uses the refi-side payment figures on a refinance", () => {
    const v = buildVaResidualView({ calc: { ...calc, refiNewLoanAmt: 450000, refiNewPi: 2800, refiNewMonthlyTax: 550, refiNewMonthlyIns: 110 }, isRefi: true, propertyState: "Texas", married: "Single", taxState: "Texas", vaResidual: {} });
    expect(v.loanAmount).toBe(450000);
    expect(v.result.shelter.pi).toBe(2800);
    expect(v.result.shelter.propertyTax).toBe(550);
    expect(v.taxes.state).toBe(0); // Texas has no income tax
  });
  it("produces a JSON-safe PDF snapshot", () => {
    const v = buildVaResidualView({ calc, isRefi: false, propertyState: "California", married: "MFJ", taxState: "California", vaResidual: { sqft: 1800 } });
    const snap = vaResidualPdfData(v);
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
    expect(snap.guideline).toBe(823);
    expect(snap.verdict.key).toBe(v.result.verdict.key);
  });
});

describe("normalizeVaResidual", () => {
  it("fills defaults and keeps stored keys", () => {
    expect(normalizeVaResidual(undefined)).toEqual(DEFAULT_VA_RESIDUAL);
    expect(normalizeVaResidual({ sqft: 1200 }).sqft).toBe(1200);
    expect(normalizeVaResidual({ sqft: 1200 }).maintRate).toBe(0.14);
  });
});
