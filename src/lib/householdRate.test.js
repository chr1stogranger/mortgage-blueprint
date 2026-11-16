import { describe, it, expect } from "vitest";
import { householdRate } from "./householdRate.js";

const debts = [
  { id: 1, name: "Toyota", type: "Auto Loan", balance: 20000, rate: 5, payoff: "No" },
  { id: 2, name: "Chase", type: "Revolving", balance: 15000, rate: 22, payoff: "Yes - at Escrow" },
];

describe("householdRate", () => {
  it("weights rates by balance (purchase: debts only)", () => {
    const h = householdRate({ isRefi: false, debts });
    expect(h.mode).toBe("purchase");
    expect(h.today.balance).toBe(35000);
    expect(h.today.rate).toBeCloseTo((20000 * 5 + 15000 * 22) / 35000, 6);
    expect(h.today.monthlyInterest).toBeCloseTo(20000 * 0.05 / 12 + 15000 * 0.22 / 12, 6);
    expect(h.after).toBeNull();
  });

  it("leaves debts with no rate out of the blend and reports them", () => {
    const h = householdRate({ isRefi: false, debts: [...debts, { id: 3, name: "Student", type: "Student Loan", balance: 30000, rate: 0, payoff: "No" }] });
    expect(h.today.balance).toBe(35000);
    expect(h.today.totalOwed).toBe(65000);
    expect(h.today.missing.map(m => m.label)).toEqual(["Student"]);
  });

  it("skips Omit and zero-balance rows, and debt-free means nothing", () => {
    const h = householdRate({ isRefi: false, debts: [...debts, { id: 4, type: "Collection", balance: 900, rate: 0, payoff: "Omit" }, { id: 5, type: "Revolving", balance: 0, rate: 24 }] });
    expect(h.today.items).toHaveLength(2);
    expect(householdRate({ isRefi: false, debts, debtFree: true }).today.rate).toBeNull();
  });

  it("cash-out consolidation: 3% first + 5% auto + 22% card, card rolled into a 6.5% loan", () => {
    const h = householdRate({
      isRefi: true, debts,
      refi: { firstBalance: 400000, firstRate: 3, liens: [], newLoanAmt: 425000, newRate: 6.5, consolidatedIds: new Set([2]), cashOut: true },
    });
    expect(h.today.balance).toBe(435000);
    expect(h.today.rate).toBeCloseTo((400000 * 3 + 20000 * 5 + 15000 * 22) / 435000, 6);
    // After: new loan + the kept auto loan; the card is gone.
    expect(h.after.balance).toBe(445000);
    expect(h.after.rate).toBeCloseTo((425000 * 6.5 + 20000 * 5) / 445000, 6);
    expect(h.after.rate).toBeGreaterThan(h.today.rate);
    const fates = Object.fromEntries(h.rows.map(r => [r.key, r.fate]));
    expect(fates).toEqual({ "subject-1st": "replaced", "debt-1": "stays", "debt-2": "consolidated", "new-loan": "new" });
  });

  it("does not double-count the subject mortgage when it is also on the Debts tab", () => {
    const withSubject = [...debts, { id: 9, name: "Rocket", type: "Mortgage", balance: 401500, rate: 3, payoff: "No" }];
    const h = householdRate({ isRefi: true, debts: withSubject, refi: { firstBalance: 400000, firstRate: 3, liens: [], newLoanAmt: 425000, newRate: 6.5, consolidatedIds: new Set(), cashOut: true } });
    expect(h.today.items.some(i => i.debtId === 9)).toBe(false);
    const linked = [...debts, { id: 9, type: "Mortgage", balance: 350000, rate: 3, payoff: "No", linkedReoId: "7" }];
    const h2 = householdRate({ isRefi: true, debts: linked, reos: [{ id: 7, occupancy: "Primary (Subj)" }], refi: { firstBalance: 400000, firstRate: 3, liens: [], newLoanAmt: 425000, newRate: 6.5 } });
    expect(h2.today.items.some(i => i.debtId === 9)).toBe(false);
  });

  it("keeps a subordinated second, drops a paid-off one; a deferred 0% lien is priced, not missing", () => {
    const refi = { firstBalance: 300000, firstRate: 4, newLoanAmt: 360000, newRate: 6, cashOut: false };
    const sub = householdRate({ isRefi: true, debts: [], refi: { ...refi, liens: [{ pos: "2nd", bal: 50000, rate: 9, kind: "heloc", plan: "sub" }] } });
    expect(sub.after.items.map(i => i.key)).toEqual(["new-loan", "subject-2nd"]);
    const paid = householdRate({ isRefi: true, debts: [], refi: { ...refi, liens: [{ pos: "2nd", bal: 50000, rate: 9, kind: "heloc", plan: "payoff" }] } });
    expect(paid.after.items.map(i => i.key)).toEqual(["new-loan"]);
    const deferred = householdRate({ isRefi: true, debts: [], refi: { ...refi, liens: [{ pos: "2nd", bal: 20000, rate: 0, kind: "deferred", plan: "sub" }] } });
    expect(deferred.today.missing).toHaveLength(0);
    expect(deferred.today.rate).toBeCloseTo(300000 * 4 / 320000, 6);
  });
});
