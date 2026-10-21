import { describe, it, expect } from "vitest";
import { z } from "zod";
import { TOOLS, DISCLOSURE, openInBlueprintInput } from "./mcpTools.js";
import { buildScenario, resolveStateName } from "./mcpScenario.js";

const tool = (name) => TOOLS.find((t) => t.name === name);
// Same path the SDK takes: validate with the input schema (defaults applied),
// run the handler, and check structuredContent against the output schema.
async function run(name, args, ctx) {
  const t = tool(name);
  const parsed = t.config.inputSchema.parse(args);
  const r = await t.handler(parsed, ctx);
  if (!r.isError) t.config.outputSchema.parse(r.structuredContent);
  return r;
}
const text = (r) => r.content[0].text;

describe("tool registry", () => {
  it("has the four tools with titles, schemas and honest annotations", () => {
    expect(TOOLS.map((t) => t.name)).toEqual(["estimate_max_home_price", "compare_rent_vs_buy", "compare_rate_options", "open_in_blueprint"]);
    for (const t of TOOLS) {
      expect(t.config.title).toBeTruthy();
      expect(t.config.description.length).toBeGreaterThan(80);
      expect(t.config.outputSchema).toBeTruthy();
      expect(t.config.annotations.destructiveHint).toBe(false);
      expect(t.config.annotations.openWorldHint).toBe(false);
    }
    for (const n of ["estimate_max_home_price", "compare_rent_vs_buy", "compare_rate_options"]) expect(tool(n).config.annotations.readOnlyHint).toBe(true);
    expect(tool("open_in_blueprint").config.annotations.readOnlyHint).toBe(false);
    expect(tool("open_in_blueprint").config.annotations.idempotentHint).toBe(false);
  });
  it("requires interest_rate wherever a rate drives the math (never defaulted)", () => {
    for (const n of ["estimate_max_home_price", "compare_rent_vs_buy", "open_in_blueprint"]) {
      const js = z.toJSONSchema(tool(n).config.inputSchema, { io: "input" });
      expect(js.required).toContain("interest_rate");
      expect(js.properties.interest_rate.default).toBeUndefined();
    }
    const opt = z.toJSONSchema(tool("compare_rate_options").config.inputSchema, { io: "input" });
    expect(opt.required).toContain("options");
  });
  it("rejects a call with no rate", () => {
    expect(() => tool("estimate_max_home_price").config.inputSchema.parse({ annual_income: 150000, monthly_debts: 500, cash_available: 60000, state: "TX" })).toThrow();
  });
});

describe("estimate_max_home_price", () => {
  it("matches the Qualify solver: $150K, $500/mo debts, $60K, 6.5%, Texas → $730,000", async () => {
    const r = await run("estimate_max_home_price", { annual_income: 150000, monthly_debts: 500, cash_available: 60000, interest_rate: 6.5, state: "Texas" });
    expect(r.isError).toBeUndefined();
    const s = r.structuredContent;
    expect(s.max_price).toBe(730000);
    expect(s.loan_amount).toBe(670000);
    expect(s.monthly_payment.principal_interest).toBeCloseTo(4234.86, 2);
    expect(s.monthly_payment.total).toBeCloseTo(5748.94, 2);
    expect(s.limited_by).toBe("dti");
    expect(s.conforming_limit).toBe(832750);
    expect(s.disclosure).toBe(DISCLOSURE);
    expect(text(r)).toContain("$730,000");
    expect(text(r)).toContain(DISCLOSURE);
    expect(s.assumptions.join(" ")).toMatch(/national conforming limit of \$832,750/);
    expect(s.assumptions.join(" ")).toMatch(/Texas's average effective rate of 1\.68%/);
  });
  it("normalizes a 2-letter / abbreviated state and refuses a non-state instead of guessing", async () => {
    expect((await run("estimate_max_home_price", { annual_income: 150000, monthly_debts: 500, cash_available: 60000, interest_rate: 6.5, state: "tx" })).structuredContent.max_price).toBe(730000);
    expect(resolveStateName("District of Columbia")).toBe("District of Columbia");
    // normalizeState doesn't know abbreviations like "Calif." — the tool must
    // refuse rather than fall back to a default tax rate.
    for (const state of ["Calif.", "Ontario"]) {
      const bad = await run("estimate_max_home_price", { annual_income: 150000, monthly_debts: 500, cash_available: 60000, interest_rate: 6.5, state });
      expect(bad.isError).toBe(true);
      expect(text(bad)).toMatch(/US state/);
    }
  });
  it("explains a jumbo switch above the county limit", async () => {
    const r = await run("estimate_max_home_price", { annual_income: 480000, monthly_debts: 500, cash_available: 700000, interest_rate: 6.5, state: "CA", county: "Alameda", city: "Oakland" });
    expect(r.structuredContent.conforming_limit).toBe(1249125);
    expect(r.structuredContent.program).toBe("Jumbo");
    expect(text(r)).toContain("Above $1,249,125 this becomes a jumbo loan: 20% down, 43% DTI");
    expect(r.structuredContent.max_price_before_jumbo).toBeGreaterThan(0);
  });
  it("returns isError (not a throw) when debts exceed the program DTI", async () => {
    const r = await run("estimate_max_home_price", { annual_income: 48000, monthly_debts: 2500, cash_available: 60000, interest_rate: 6.5, loan_type: "FHA", state: "TX" });
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/exceed what FHA allows/);
  });
});

describe("compare_rent_vs_buy", () => {
  const args = { monthly_rent: 2600, home_price: 400000, down_payment: 20000, interest_rate: 6.5, state: "Texas", annual_income: 150000, filing_status: "MFJ" };
  it("MFJ $150K in Texas: tax savings are $0 and the text says why", async () => {
    // Standard deduction $32,200 beats 380,000 × 6.5% = $24,700 interest + 400,000 × 1.68% = $6,720 tax = $31,420.
    const r = await run("compare_rent_vs_buy", args);
    expect(r.structuredContent.annual_tax_savings).toBe(0);
    expect(text(r)).toContain("Year-1 income-tax savings from owning: $0");
    expect(text(r)).toContain("standard deduction ($32,200)");
    expect(text(r)).toContain("$31,420");
    expect(text(r)).toContain("Texas has no state income tax");
  });
  it("builds the payment from buildScenario and reports 5/10/30-year rows", async () => {
    const r = await run("compare_rent_vs_buy", args);
    const s = buildScenario({ price: 400000, downPayment: 20000, rate: 6.5, termYears: 30, loanType: "Conventional", state: "Texas" });
    expect(r.structuredContent.monthly_cost_to_own.total).toBeCloseTo(s.housingPayment, 2);
    expect(r.structuredContent.monthly_difference).toBeCloseTo(s.housingPayment - 2600, 2);
    expect(r.structuredContent.years.map((y) => y.year)).toEqual([5, 10, 30]);
    expect(r.structuredContent.closing_costs_estimated).toBe(true);
    expect(r.structuredContent.assumptions.join(" ")).toMatch(/renter invests only that upfront cash/);
  });
  it("says tax savings weren't counted when income or filing status is missing", async () => {
    const r = await run("compare_rent_vs_buy", { ...args, filing_status: undefined });
    expect(r.structuredContent.annual_tax_savings).toBe(0);
    expect(text(r)).toMatch(/not counted/);
  });
});

describe("compare_rate_options — spec fixture (loan 400,000, 30y, base 6.625%, 5y hold, 0% tax)", () => {
  const options = [[6.875, -0.8], [6.75, -0.4], [6.625, 0], [6.5, 0.45], [6.375, 0.9], [6.25, 1.35]].map(([rate, points]) => ({ rate, points }));
  const go = () => run("compare_rate_options", { loan_amount: 400000, term_years: 30, baseline_rate: 6.625, hold_years: 5, marginal_tax_rate_pct: 0, options });
  it("prices every option's P&I", async () => {
    const s = (await go()).structuredContent;
    expect(s.options.map((o) => o.monthly_pi)).toEqual([2627.72, 2594.39, 2561.24, 2528.27, 2495.48, 2462.87]);
  });
  it("6.5% saves 32.97/mo for $1,800 → 54.6 mo; 6.25% saves 98.38 for $5,400 → 54.9 mo", async () => {
    const s = (await go()).structuredContent;
    const at = (rate) => s.options.find((o) => o.rate === rate);
    expect(at(6.5).monthly_savings_vs_baseline).toBe(32.97);
    expect(at(6.5).upfront_cost_vs_baseline).toBe(1800);
    expect(at(6.5).breakeven_months).toBe(54.6);
    expect(at(6.25).monthly_savings_vs_baseline).toBe(98.38);
    expect(at(6.25).breakeven_months).toBe(54.9);
    expect(s.best_value_rate).toBe(6.25);
  });
  it("6.875% credit of $3,200 covers $66.47/mo for 48.1 mo; no credit pick (48 < 60)", async () => {
    const r = await go();
    const c = r.structuredContent.options.find((o) => o.rate === 6.875);
    expect(c.monthly_savings_vs_baseline).toBe(-66.47);
    expect(c.upfront_cost_vs_baseline).toBe(-3200);
    expect(c.breakeven_months).toBe(48.1);
    expect(r.structuredContent.credit_pick_rate).toBeUndefined();
    expect(text(r)).toContain("the $3,200 credit covers the higher payment for 48.1 mo");
    expect(text(r)).not.toMatch(/6\.875%[^\n]*breakeven/);
    expect(text(r)).toContain("Best value within your 5-year hold: 6.25%");
  });
  it("defaults the baseline to the 0-point option", async () => {
    const r = await run("compare_rate_options", { loan_amount: 400000, options });
    expect(r.structuredContent.baseline_rate).toBe(6.625);
  });
  it("names dominated options and says when nothing pays off within the hold", async () => {
    const r = await run("compare_rate_options", { loan_amount: 400000, hold_years: 3, options: [{ rate: 6.625, points: 0 }, { rate: 6.5, points: 0.9 }, { rate: 6.375, points: 0.9 }] });
    expect(text(r)).toContain("6.5% at 0.9 points is beaten by 6.375% at 0.9 points");
    expect(text(r)).toContain("None of the lower-rate options pay off within 3 years");
    expect(r.structuredContent.best_value_rate).toBeUndefined();
  });
  it("requires at least two options and a baseline that is one of them", async () => {
    expect(() => tool("compare_rate_options").config.inputSchema.parse({ loan_amount: 400000, options: [{ rate: 6.5, points: 0 }] })).toThrow();
    const r = await run("compare_rate_options", { loan_amount: 400000, baseline_rate: 7, options });
    expect(r.isError).toBe(true);
  });
});

describe("open_in_blueprint", () => {
  const args = { source_tool: "compare_rent_vs_buy", home_price: 400000, down_payment: 20000, interest_rate: 6.5, state: "TX", monthly_rent: 2600 };
  it("rejects income / debt fields (strict schema)", () => {
    expect(() => openInBlueprintInput.parse({ ...args, annual_income: 1 })).toThrow();
    expect(() => openInBlueprintInput.parse({ ...args, monthly_debts: 500 })).toThrow();
  });
  it("stores property + loan fields only and returns the ?plan= link", async () => {
    let saved;
    const r = await run("open_in_blueprint", args, { saveHandoff: async (row) => { saved = row; return { token: "AbCdEfGhIjKlMnOpQrStUv", expiresAt: "2026-11-20T00:00:00.000Z" }; } });
    expect(saved).toEqual({ sourceTool: "compare_rent_vs_buy", payload: { homePrice: 400000, downPayment: 20000, interestRate: 6.5, termYears: 30, loanType: "Conventional", state: "Texas", licensed: true, monthlyRent: 2600 } });
    expect(r.structuredContent.url).toBe("https://blueprint.realstack.app/?plan=AbCdEfGhIjKlMnOpQrStUv");
    expect(text(r)).toContain(DISCLOSURE);
  });
  it("relays the not-yet-migrated and cap errors as isError", async () => {
    for (const [error, re] of [["missing-table", /isn't available yet/], ["paused", /paused/], ["ip-cap", /last hour/]]) {
      const r = await run("open_in_blueprint", args, { saveHandoff: async () => ({ error }) });
      expect(r.isError).toBe(true);
      expect(text(r)).toMatch(re);
    }
  });
});

describe("licensed-state gating (AZ, CA, CO, HI, NV, OR, TX, WA)", () => {
  const LINE = (st) => `Chris Granger is licensed in AZ, CA, CO, HI, NV, OR, TX and WA, and can't originate a loan for a property in ${st}.`;
  const saveHandoff = async () => ({ token: "AbCdEfGhIjKlMnOpQrStUv", expiresAt: "2026-11-20T00:00:00.000Z" });
  const cases = {
    estimate_max_home_price: (state) => ({ annual_income: 150000, monthly_debts: 500, cash_available: 60000, interest_rate: 6.5, state }),
    compare_rent_vs_buy: (state) => ({ monthly_rent: 2600, home_price: 400000, down_payment: 20000, interest_rate: 6.5, state }),
    compare_rate_options: (state) => ({ loan_amount: 400000, state, options: [{ rate: 6.625, points: 0 }, { rate: 6.5, points: 0.45 }] }),
    open_in_blueprint: (state) => ({ source_tool: "compare_rent_vs_buy", home_price: 400000, down_payment: 20000, interest_rate: 6.5, state }),
  };
  for (const [name, args] of Object.entries(cases)) {
    it(`${name}: Texas is licensed, normal wording`, async () => {
      const r = await run(name, args("TX"), { saveHandoff });
      expect(r.structuredContent.licensed).toBe(true);
      expect(text(r)).not.toContain("can't originate");
    });
    it(`${name}: Florida still calculates, says Chris can't originate there`, async () => {
      const r = await run(name, args("Florida"), { saveHandoff });
      expect(r.isError).toBeUndefined();
      expect(r.structuredContent.licensed).toBe(false);
      expect(text(r)).toContain(LINE("Florida"));
    });
  }
  it("open_in_blueprint never invites contact for an unlicensed property, and stores licensed: false", async () => {
    let saved;
    const r = await run("open_in_blueprint", cases.open_in_blueprint("FL"), { saveHandoff: async (row) => { saved = row; return saveHandoff(); } });
    expect(saved.payload.licensed).toBe(false);
    expect(text(r)).not.toMatch(/loan officer|pre-approv|talk to/i);
    expect(text(r)).toContain("Blueprint is free to use for planning");
    const ok = await run("open_in_blueprint", cases.open_in_blueprint("TX"), { saveHandoff });
    expect(text(ok)).toContain("reach a loan officer");
  });
  it("compare_rate_options without a state omits licensed", async () => {
    const r = await run("compare_rate_options", { loan_amount: 400000, options: [{ rate: 6.625, points: 0 }, { rate: 6.5, points: 0.45 }] });
    expect(r.structuredContent.licensed).toBeUndefined();
  });
});
