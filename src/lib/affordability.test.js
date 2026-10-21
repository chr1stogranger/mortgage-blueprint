import { describe, it, expect } from "vitest";
import { solveMaxPrice, solveScenarioPrice } from "./affordability.js";
import FIX from "./fixtures/affordability.parity.json";

// Parity fixtures: outputs captured on 2026-10-21 by running the
// pre-extraction IIFE from content/QualifyContent.jsx (verbatim) with these
// inputs. Texas 1.68% effective tax, no insurance/HOA entered (insurance
// falls back to max($1,200, 0.35% of price)/12), confLimit = CONF_BASELINE[1].
const base = { monthlyDebts: 500, rate: 6.5, termYears: 30, confLimit: 832750, effTaxRate: 0.0168, insMonthly: null, hoaMonthly: 0 };
const CASES = {
  convDti: { ...base, monthlyIncome: 12500, cashAvailable: 60000, loanType: "Conventional" },
  fhaCash: { ...base, monthlyIncome: 12500, cashAvailable: 20000, loanType: "FHA" },
  convTiny: { ...base, monthlyIncome: 12500, cashAvailable: 5000, loanType: "Conventional" },
  noIncome: { ...base, monthlyIncome: 0, cashAvailable: 60000, loanType: "Conventional" },
  debtsExceed: { ...base, monthlyIncome: 4000, monthlyDebts: 2500, cashAvailable: 60000, loanType: "Conventional" },
  vaJumbo: { ...base, monthlyIncome: 30000, monthlyDebts: 1000, cashAvailable: 50000, loanType: "VA" },
  jumboCap: { ...base, monthlyIncome: 25000, cashAvailable: 200000, loanType: "Conventional" },
  jumboHit: { ...base, monthlyIncome: 40000, cashAvailable: 700000, loanType: "Conventional" },
  jumboProgram: { ...base, monthlyIncome: 40000, cashAvailable: 700000, loanType: "Jumbo" },
  // Insurance carried over from the calculator ($150/mo); HOA = max(0, 3,500 − 2,800 − 700 − 150) = 0
  withInsHoa: { ...base, monthlyIncome: 12500, cashAvailable: 60000, loanType: "Conventional", insMonthly: 150, hoaMonthly: 0 },
};

describe("solveMaxPrice — parity with the pre-extraction Qualify solver", () => {
  for (const [name, input] of Object.entries(CASES)) {
    it(name, () => {
      const want = FIX[name];
      const got = solveMaxPrice(input);
      if (!want.ok) { expect(got).toEqual(want); return; }
      const { scenarios, programType, programMaxDTI, ...fields } = want;
      expect(got).toMatchObject(fields);
      expect(got.program.type).toBe(programType);
      expect(got.program.maxDTI).toBe(programMaxDTI);
      const sc = [36, 43, 50].map((d) => solveScenarioPrice(input, d));
      expect(sc.map((s) => ({ qPrice: s.price, total: s.payment.total, isQJumbo: s.payment.isJumbo, mhp: s.maxHousing }))).toEqual(scenarios);
    });
  }
});

describe("solveMaxPrice — spec numbers (BLUEPRINT-CHATGPT-MCP-PROMPT A3)", () => {
  it("Conventional, DTI-bound: $730,000", () => {
    const r = solveMaxPrice(CASES.convDti);
    expect(r.maxPrice).toBe(730000);
    expect(r.loan).toBe(670000);
    expect(r.pi).toBeCloseTo(4234.86, 2);
    expect(r.tax).toBeCloseTo(1022.0, 2);       // 730,000 × 1.68% / 12
    expect(r.ins).toBeCloseTo(212.92, 2);       // max(1,200, 2,555) / 12
    expect(r.mi).toBeCloseTo(279.17, 2);        // 670,000 × 0.5% / 12
    expect(r.total).toBeCloseTo(5748.94, 2);    // cap 12,500 × 50% − 500 = 5,750
    expect(r.dti).toBeCloseTo(0.5, 3);
    expect(r.limitedBy).toBe("dti");
  });
  it("FHA, cash-bound: $571,000", () => {
    const r = solveMaxPrice(CASES.fhaCash);
    expect(r.maxPrice).toBe(571000);
    expect(r.loan).toBe(551000);
    expect(r.totalLoan).toBeCloseTo(560642.5, 2); // + 1.75% UFMIP
    expect(r.pi).toBeCloseTo(3543.64, 2);
    expect(r.mi).toBeCloseTo(256.96, 2);
    expect(r.total).toBeCloseTo(4766.54, 2);
    expect(r.dti).toBeCloseTo(0.421, 3);
    expect(r.limitedBy).toBe("cash");
  });
  it("Conventional, tiny cash: $99,000", () => {
    const r = solveMaxPrice(CASES.convTiny);
    expect(r.maxPrice).toBe(99000);
    expect(r.limitedBy).toBe("cash");
  });
  it("no income / debts exceed", () => {
    expect(solveMaxPrice(CASES.noIncome)).toEqual({ ok: false, reason: "no-income" });
    expect(solveMaxPrice(CASES.debtsExceed)).toEqual({ ok: false, reason: "debts-exceed" }); // 4,000 × 50% − 2,500 < 0
  });
  it("auto-switches to Jumbo above the conforming limit and reports the max before Jumbo", () => {
    const r = solveMaxPrice(CASES.jumboHit);
    expect(r.isJumbo).toBe(true);
    expect(r.program.type).toBe("Jumbo");
    expect(r.maxConfPrice).toBe(1532000);
  });
});
