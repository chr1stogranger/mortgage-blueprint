import { describe, it, expect } from "vitest";
import { computeRentVsBuy } from "./rentVsBuy.js";
import FIX from "./fixtures/rentVsBuy.parity.json";

// Parity fixtures: captured on 2026-10-21 by running the pre-extraction
// `rbCalc` useMemo body from MortgageBlueprint.jsx (verbatim) against these
// calc stubs. Deep equality — every row, every field.
describe("computeRentVsBuy — parity with the pre-extraction rbCalc", () => {
  it("$400K home, 6.5%, $2,600 rent, $1,200/yr tax savings", () => {
    const got = computeRentVsBuy({
      rent: 2600, rentGrowthPct: 3, investReturnPct: 7, salesPrice: 400000, appreciationPct: 3,
      loan: 380000, mr: 0.065 / 12, np: 360, dp: 20000, cashToClose: 32000,
      housingPayment: 3300, annualTaxSavings: 1200,
    });
    expect(got).toEqual(FIX.rentVsBuy);
    expect(got.data).toHaveLength(31);
    expect(got.breakEvenYear).toBe(5);
  });
  it("0% rate, 15-year term (straight-line paydown branch)", () => {
    const got = computeRentVsBuy({
      rent: 2000, rentGrowthPct: 2, investReturnPct: 5, salesPrice: 300000, appreciationPct: 4,
      loan: 240000, mr: 0, np: 180, dp: 60000, cashToClose: 70000,
      housingPayment: 2100, annualTaxSavings: 0,
    });
    expect(got).toEqual(FIX.rentVsBuyZeroRate);
  });
});
