import { describe, it, expect } from "vitest";
import { readPlanToken, planToPrefill, planScenarioName, planLanding, planLicensed } from "./planPrefill.js";

const deps = {
  lookupZip: (z) => (z === "94112" ? { city: "San Francisco", county: "San Francisco", state: "California" } : null),
  cityNames: ["Alameda", "San Francisco", "Oakland"],
  stateMap: { CA: "California", TX: "Texas" },
  getAutoTaxRate: (st) => (st === "Texas" ? 0.0168 : 0.012),
};
// Fixture = the /api/plan contract (api/plan.js, 2026-10-21).
const BASE = { kind: "plan", client: "chatgpt", homePrice: 400000, downPayment: 20000, interestRate: 6.5, termYears: 30, loanType: "Conventional", state: "Texas" };

describe("readPlanToken", () => {
  it("reads a valid token and ignores junk", () => {
    expect(readPlanToken("?plan=AbCdEfGhIjKlMnOpQrStUv")).toBe("AbCdEfGhIjKlMnOpQrStUv");
    expect(readPlanToken("?plan=x")).toBeNull();
    expect(readPlanToken("?plan=<script>")).toBeNull();
    expect(readPlanToken("?listing=AbCdEfGhIjKl")).toBeNull();
    expect(readPlanToken("")).toBeNull();
  });
});

describe("planToPrefill", () => {
  it("maps the loan basics through listingToPrefill", () => {
    const p = planToPrefill({ ...BASE, sourceTool: "estimate_max_home_price", monthlyHoa: 125 }, deps);
    expect(p).toMatchObject({ salesPrice: 400000, downPct: 5, rate: 6.5, term: 30, loanType: "Conventional", propertyState: "Texas", hoa: 125, loanPurpose: "Purchase Primary", isRefi: false, taxRateLocked: true, taxBaseRateOverride: 1.68 });
    expect(p.showRentVsBuy).toBeUndefined();
    expect(p.rateLadder).toBeUndefined();
  });
  it("rounds the down payment percent like the calculator's $ input", () => {
    expect(planToPrefill({ ...BASE, homePrice: 730000, downPayment: 60000 }, deps).downPct).toBe(8.22);
  });
  it("uses the ZIP for city/county when given", () => {
    const p = planToPrefill({ ...BASE, state: "California", zip: "94112" }, deps);
    expect(p).toMatchObject({ propertyZip: "94112", city: "San Francisco", propertyCounty: "San Francisco", propertyState: "California" });
  });
  it("rent vs buy → opens the module with the chat's assumptions", () => {
    const p = planToPrefill({ ...BASE, sourceTool: "compare_rent_vs_buy", monthlyRent: 2600, rentGrowthPct: 3, investReturnPct: 7, appreciationPct: 4 }, deps);
    expect(p).toMatchObject({ showRentVsBuy: true, rbCurrentRent: 2600, rbRentGrowth: 3, rbInvestReturn: 7, appreciationRate: 4 });
  });
  it("rate options → a rate ladder, baseline pinned in the engine's sorted order", () => {
    const options = [{ rate: 6.5, points: 0.45 }, { rate: 6.875, points: -0.8 }, { rate: 6.625, points: 0 }];
    const p = planToPrefill({ ...BASE, sourceTool: "compare_rate_options", options, baselineRate: 6.625, holdYears: 7 }, deps);
    expect(p.showRateLadder).toBe(true);
    expect(p.rateLadder).toMatchObject({ rungs: [{ rate: 6.5, pts: 0.45 }, { rate: 6.875, pts: -0.8 }, { rate: 6.625, pts: 0 }], baseIdx: 1, baseAuto: false, holdYears: 7, taxMode: "auto" });
    const auto = planToPrefill({ ...BASE, sourceTool: "compare_rate_options", options }, deps);
    expect(auto.rateLadder.baseAuto).toBeUndefined();
    expect(auto.rateLadder.holdYears).toBe(5);
  });
  it("never carries anything outside the allow-list (no income, no debts)", () => {
    const p = planToPrefill({ ...BASE, sourceTool: "compare_rent_vs_buy", annualIncome: 150000, monthlyDebts: 500, incomes: [{ amount: 1 }] }, deps);
    expect(JSON.stringify(p)).not.toMatch(/income|debt/i);
  });
});

describe("planScenarioName / planLanding", () => {
  it("names the scenario after the chat client and price", () => {
    expect(planScenarioName({ ...BASE })).toBe("From ChatGPT · $400K");
    expect(planScenarioName({ ...BASE, client: "claude", homePrice: 1250000 })).toBe("From Claude · $1.25M");
    expect(planScenarioName({ client: "other" })).toBe("From your chat");
  });
  it("lands on the section that matches the tool", () => {
    expect(planLanding({ sourceTool: "compare_rent_vs_buy" })).toEqual({ tab: "rentvbuy", section: null });
    expect(planLanding({ sourceTool: "compare_rate_options", options: [{}, {}] })).toEqual({ tab: "overview", section: "overview-rateladder" });
    expect(planLanding({ sourceTool: "estimate_max_home_price" })).toEqual({ tab: "overview", section: null });
  });
});

describe("planLicensed", () => {
  it("reads the stored flag, falling back to the property state", () => {
    expect(planLicensed({ ...BASE, licensed: true })).toBe(true);
    expect(planLicensed({ ...BASE, state: "Florida", licensed: false })).toBe(false);
    expect(planLicensed({ ...BASE })).toBe(true);                 // Texas, no flag
    expect(planLicensed({ ...BASE, state: "Florida" })).toBe(false);
  });
  it("never leaks into the Blueprint state", () => {
    expect(planToPrefill({ ...BASE, sourceTool: "estimate_max_home_price", licensed: false }, deps).licensed).toBeUndefined();
  });
});
