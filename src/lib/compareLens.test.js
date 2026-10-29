import { describe, it, expect } from "vitest";
import { bisect, solveLens, minDownFor, netOf } from "./compareLens.js";

// Toy quote with the same moving parts as calcQuickMetrics: P&I on the loan,
// tax and insurance on price, PMI above 80% LTV, rent, closing on the loan.
const quoteFor = ({ rate = 7, rent = 0, hoa = 0 } = {}) => (price, downPct) => {
  const down = price * downPct / 100, loan = price - down, r = rate / 1200;
  const pi = loan * r / (1 - Math.pow(1 + r, -360));
  const mi = loan / price > 0.8 ? loan * 0.005 / 12 : 0;
  const monthlyPayment = pi + price * 0.012 / 12 + price * 0.003 / 12 + mi + hoa;
  const closingCosts = 10000 + loan * 0.01;
  return { salesPrice: price, downPct, downAmt: down, loan, monthlyPayment, rent, closingCosts, cashToClose: down + closingCosts + price * 0.005 };
};

describe("bisect", () => {
  it("finds the crossing of an increasing function", () => {
    expect(bisect(x => x * x, 0, 10, 49)).toBeCloseTo(7, 6);
  });
  it("clamps when the target is out of range", () => {
    expect(bisect(x => x, 5, 10, 1)).toBe(5);
    expect(bisect(x => x, 5, 10, 99)).toBe(10);
  });
});

describe("solveLens", () => {
  const condo = quoteFor({ hoa: 450 }), house = quoteFor({ rate: 6.99 }), duplex = quoteFor({ rent: 3750 });
  const t0 = condo(650000, 10);
  const target = { price: 650000, net: netOf(t0), cash: t0.cashToClose };

  it("same payment solves the price and keeps down %", () => {
    const m = solveLens("payment", target, house, { price: 1100000, downPct: 20 });
    expect(netOf(m)).toBeCloseTo(target.net, 2);
    expect(m.downPct).toBe(20);
    expect(m.salesPrice).toBeLessThan(1100000);
  });
  it("same cash solves the down payment and keeps the price", () => {
    const m = solveLens("cash", target, duplex, { price: 1350000, downPct: 20 });
    expect(m.cashToClose).toBeCloseTo(target.cash, 2);
    expect(m.salesPrice).toBe(1350000);
  });
  it("same payment + cash matches both at once", () => {
    const m = solveLens("both", target, duplex, { price: 1350000, downPct: 20 });
    expect(netOf(m)).toBeCloseTo(target.net, 1);
    expect(m.cashToClose).toBeCloseTo(target.cash, 1);
  });
  it("same price applies the target's price", () => {
    expect(solveLens("price", target, house, { price: 1100000, downPct: 20 }).salesPrice).toBe(650000);
  });
});

describe("minDownFor", () => {
  it("knows the agency floors", () => {
    expect(minDownFor({ loanType: "Conventional", units: 1, loanPurpose: "Purchase Primary" }).pct).toBe(3);
    expect(minDownFor({ loanType: "Conventional", units: 2, loanPurpose: "Purchase Primary" }).pct).toBe(5);
    expect(minDownFor({ loanType: "Conventional", units: 1, loanPurpose: "Purchase Investment" }).pct).toBe(15);
    expect(minDownFor({ loanType: "FHA" }).pct).toBe(3.5);
    expect(minDownFor({ loanType: "VA" })).toBeNull();
  });
});
