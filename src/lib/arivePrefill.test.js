import { describe, it, expect } from "vitest";
import { normalizeArivePrefill, summarizePrefill, toBorrowerSlot, safeName } from "./arivePrefill.js";

describe("safeName", () => {
  it("strips account-number fragments", () => {
    expect(safeName("Chase ****1234")).toBe("Chase");
    expect(safeName("Navient 449102837465")).toBe("Navient");
    expect(safeName("Bank of America")).toBe("Bank of America");
  });
});

describe("toBorrowerSlot", () => {
  const names = { 1: "Dana Reyes", 2: "Sam Reyes" };
  it("passes numbers through", () => {
    expect(toBorrowerSlot(1, names)).toBe(1);
    expect(toBorrowerSlot(2, names)).toBe(2);
    expect(toBorrowerSlot(5, names)).toBe(2);
  });
  it("understands labels", () => {
    expect(toBorrowerSlot("Co-Borrower", names)).toBe(2);
    expect(toBorrowerSlot("Borrower 2", names)).toBe(2);
    expect(toBorrowerSlot("Borrower 1", names)).toBe(1);
  });
  it("resolves the legacy name-as-borrower payload", () => {
    expect(toBorrowerSlot("Sam Reyes", names)).toBe(2);
    expect(toBorrowerSlot("Dana Reyes", names)).toBe(1);
  });
  it("defaults to slot 1", () => {
    expect(toBorrowerSlot("", names)).toBe(1);
    expect(toBorrowerSlot(undefined, {})).toBe(1);
  });
});

describe("normalizeArivePrefill", () => {
  it("is a no-op for a payload with no financials (old Ops)", () => {
    const pf = { salesPrice: 800000, downPct: 20, loanType: "Conventional" };
    expect(normalizeArivePrefill(pf)).toEqual(pf);
  });

  it("handles null/undefined", () => {
    expect(normalizeArivePrefill(undefined)).toEqual({});
    expect(normalizeArivePrefill(null)).toEqual({});
  });

  it("coerces the legacy string borrower on income rows to a number", () => {
    const out = normalizeArivePrefill({
      incomes: [{ id: 1, borrower: "Dana Reyes", source: "Arive", payType: "Salary", amount: 120000, frequency: "Annual" }],
    });
    expect(out.incomes[0].borrower).toBe(1);
    expect(typeof out.incomes[0].borrower).toBe("number");
  });

  it("keeps numBorrowers in step with the income rows", () => {
    const out = normalizeArivePrefill({
      incomes: [
        { borrower: 1, amount: 9000, frequency: "Monthly" },
        { borrower: 2, amount: 5000, frequency: "Monthly" },
      ],
      borrowerNames: { 1: "Dana Reyes", 2: "Sam Reyes" },
    });
    expect(out.numBorrowers).toBe(2);
    expect(out.borrowerNames).toEqual({ 1: "Dana Reyes", 2: "Sam Reyes" });
  });

  it("drops a stale 2-borrower roster when only borrower 1 has income", () => {
    const out = normalizeArivePrefill({
      incomes: [{ borrower: 1, amount: 9000, frequency: "Monthly" }],
      numBorrowers: 1,
      borrowerNames: { 1: "Dana Reyes" },
    });
    expect(out.numBorrowers).toBeUndefined();
    expect(out.borrowerNames).toBeUndefined();
  });

  it("mirrors refiHomeValue into salesPrice — the refi UI's Home Value field", () => {
    const out = normalizeArivePrefill({ isRefi: true, refiHomeValue: 6000000, refiCurrentBalance: 1550021 });
    expect(out.salesPrice).toBe(6000000);
    expect(out.refiHomeValue).toBe(6000000);
  });

  it("never overwrites a salesPrice the payload already carries", () => {
    const out = normalizeArivePrefill({ isRefi: true, refiHomeValue: 6000000, salesPrice: 5000000 });
    expect(out.salesPrice).toBe(5000000);
  });

  it("leaves salesPrice alone on a purchase payload", () => {
    const out = normalizeArivePrefill({ salesPrice: 800000, refiHomeValue: 6000000 });
    expect(out.salesPrice).toBe(800000);
  });

  it("mirrors propertyAddress into addressInput — the box renders addressInput first", () => {
    const out = normalizeArivePrefill({ propertyAddress: "700 Paru Street, Alameda, CA, 94501", propertyTBD: false });
    expect(out.addressInput).toBe("700 Paru Street, Alameda, CA, 94501");
  });

  it("leaves a TBD payload with no address alone", () => {
    const out = normalizeArivePrefill({ propertyZip: "94501", addressMode: "zip" });
    expect(out.addressInput).toBeUndefined();
    expect(out.propertyAddress).toBeUndefined();
  });

  it("blanks asset last4 and scrubs digits from names", () => {
    const out = normalizeArivePrefill({
      assets: [{ bank: "Chase ****1234", last4: "1234", type: "Checking", value: 42000, owner: "Borrower" }],
      debts: [{ name: "Navient 449102837465", type: "Student Loan", monthly: 320, balance: 28400, borrower: "Borrower 2" }],
    });
    expect(out.assets[0]).toEqual({
      id: out.assets[0].id, bank: "Chase", last4: "", owner: "Borrower",
      type: "Checking", value: 42000, forClosing: 0,
    });
    expect(out.debts[0].name).toBe("Navient");
    const json = JSON.stringify(out);
    expect(json).not.toContain("1234");
    expect(json).not.toContain("449102837465");
  });

  it("clamps unknown enum values to safe defaults", () => {
    const out = normalizeArivePrefill({
      incomes: [{ borrower: 1, payType: "NONSENSE", frequency: "NONSENSE", amount: 100 }],
      assets: [{ bank: "X", type: "NONSENSE", value: 1 }],
      debts: [{ name: "Y", type: "NONSENSE", borrower: "NONSENSE", payoff: "NONSENSE", monthly: 1 }],
    });
    expect(out.incomes[0].payType).toBe("Salary");
    expect(out.incomes[0].frequency).toBe("Monthly");
    expect(out.assets[0].type).toBe("Other");
    expect(out.debts[0].type).toBe("Revolving");
    expect(out.debts[0].borrower).toBe("Joint");
    expect(out.debts[0].payoff).toBe("No");
  });

  it("ignores non-object rows without throwing", () => {
    const out = normalizeArivePrefill({ incomes: [null, "junk", { borrower: 1, amount: 5 }], assets: [null], debts: [undefined] });
    expect(out.incomes).toHaveLength(1);
    expect(out.assets).toEqual([]);
    expect(out.debts).toEqual([]);
  });
});

describe("summarizePrefill", () => {
  it("totals income by frequency, assets, and non-paid-off debts", () => {
    const s = summarizePrefill(normalizeArivePrefill({
      incomes: [
        { borrower: 1, amount: 120000, frequency: "Annual" },
        { borrower: 2, amount: 5000, frequency: "Monthly" },
      ],
      assets: [{ bank: "Chase", type: "Checking", value: 42000 }, { bank: "Fidelity", type: "Retirement", value: 88000 }],
      debts: [
        { name: "Toyota", type: "Auto Loan", monthly: 480, payoff: "No" },
        { name: "Amex", type: "Revolving", monthly: 150, payoff: "Yes - at Escrow" },
      ],
      borrowerNames: { 1: "Dana", 2: "Sam" },
    }));
    expect(s).toEqual({
      monthlyIncome: 15000, incomeCount: 2,
      assetsTotal: 130000, assetsCount: 2,
      monthlyDebts: 480, debtsCount: 2,
      borrowers: 2,
    });
  });

  it("is all zeros for an empty prefill", () => {
    expect(summarizePrefill({})).toEqual({
      monthlyIncome: 0, incomeCount: 0, assetsTotal: 0,
      assetsCount: 0, monthlyDebts: 0, debtsCount: 0, borrowers: 1,
    });
  });
});
