// src/lib/nonQm.test.js
//
// Pins the DSCR / Asset Qualifier / HELOC math. Expected values are worked by
// hand from Christo's "Asset-Based Loan Programs Compared" matrix, not by
// running the code under test.

import { describe, it, expect } from "vitest";
import {
  evaluateAssetPrograms, summarizeAssetPrograms, bucketAssets, bucketsAfterClosing,
  newrezResidualFloor, tlsResidualFloor,
  computeDscr, computeHelocPayments, computePiggyback, computeStandaloneLine,
} from "./nonQm.js";

// $3M in the bank, $500K to close, $1.6M loan at 80% LTV, $11K PITIA,
// $1K other debts, age 60, household of 2, 760 FICO, 1-unit primary.
const base = {
  assets: [{ type: "Checking", value: 3000000 }],
  borrowerAge: 60, householdSize: 2, dependents: 0, otherFinancedHomes: 0,
  cashToClose: 500000, loanAmount: 1600000, termMonths: 360, ltv: 0.8, fico: 760,
  isPrimary: true, units: 1, isCashOut: false,
  housingPayment: 11000, otherMonthlyDebts: 1000, reoMonthlyDebt: 0, otherIncome: 0,
  otherMortgageBalances: 0, otherDebtBalances: 0, agencyLoanLimit: 1249125,
};
const byId = (rs) => Object.fromEntries(rs.map(r => [r.id, r]));

describe("residual floors", () => {
  it("Newrez: $2,000 for 1, $3,800 for 7, +$150 beyond, even steps between", () => {
    expect(newrezResidualFloor(1)).toBe(2000);
    expect(newrezResidualFloor(4)).toBe(2900);
    expect(newrezResidualFloor(7)).toBe(3800);
    expect(newrezResidualFloor(9)).toBe(4100);
  });
  it("TLS: $2,500 + $250 first dependent + $150 each after", () => {
    expect(tlsResidualFloor(0)).toBe(2500);
    expect(tlsResidualFloor(1)).toBe(2750);
    expect(tlsResidualFloor(3)).toBe(3050);
  });
});

describe("bucketAssets", () => {
  it("gifts sit apart, unknown types count for nothing", () => {
    const b = bucketAssets([
      { type: "Checking", value: 100 }, { type: "Stocks", value: 200 }, { type: "Retirement", value: 300 },
      { type: "Gift", value: 50 }, { type: "Other", value: 70 },
    ], 25);
    expect(b).toEqual({ deposit: 125, securities: 200, retirement: 300, gift: 50, excluded: 70 });
  });
});

describe("bucketsAfterClosing", () => {
  it("earmarked accounts pay first, then cash, stocks, retirement", () => {
    const left = bucketsAfterClosing([
      { type: "Checking", value: 100000 }, { type: "Stocks", value: 300000, forClosing: 50000 }, { type: "Retirement", value: 500000 },
    ], 0, 250000);
    // 50K from the earmarked stocks, the other 200K: 100K cash then 100K stocks
    expect(left).toEqual({ deposit: 0, securities: 150000, retirement: 500000, unfunded: 0 });
  });
  it("gifts and sale proceeds cover closing before the borrower's money", () => {
    const left = bucketsAfterClosing([{ type: "Checking", value: 100000 }, { type: "Gift", value: 60000 }], 30000, 100000);
    expect(left.deposit).toBe(90000);
  });
  it("reports what can't be funded", () => {
    expect(bucketsAfterClosing([{ type: "Checking", value: 10000 }], 0, 25000).unfunded).toBe(15000);
  });
});

describe("evaluateAssetPrograms", () => {
  const r = byId(evaluateAssetPrograms(base));

  it("Newrez: (3M − 500K) ÷ 60 − 12K = $29,667 residual vs $2,300 floor", () => {
    expect(r.newrez.residual).toBeCloseTo(29666.67, 1);
    expect(r.newrez.residualFloor).toBe(2300);
    expect(r.newrez.pass).toBe(true);
  });
  it("NexBank: easiest method is Traditional, 1.6M + 60×1K = $1.66M", () => {
    expect(r.nexbank.required).toBe(1660000);
    expect(r.nexbank.pass).toBe(true);
  });
  it("TLS Asset Utilization: 2.5M left beats 1.6M + 60×12K = $2.32M", () => {
    expect(r["tls-au"].required).toBe(2320000);
    expect(r["tls-au"].pass).toBe(true);
  });
  it("TLS Asset Depletion: reserves come off before dividing → 29.6% DTI", () => {
    // pool 2.5M − 6×11K = 2,434,000 ÷ 60 = 40,566.67; 12,000 / 40,566.67
    expect(r["tls-ad"].dti).toBeCloseTo(0.2958, 4);
    expect(r["tls-ad"].pass).toBe(true);
  });
  it("UHM: 120-month divisor and 9 months of reserves fail it at 60%", () => {
    // pool 2.5M − 9×11K = 2,401,000 ÷ 120 = 20,008.33 → 12,000 / 20,008.33
    expect(r.uhm.dti).toBeCloseTo(0.59975, 5);
    expect(r.uhm.pass).toBe(false);
  });
  it("BluePoint: 84 months, reserves checked but not subtracted", () => {
    expect(r.bluepoint.dti).toBeCloseTo(12000 / (2500000 / 84), 6);
    expect(r.bluepoint.pass).toBe(true);
  });
  it("Fannie counts no bank balances; Freddie needs 62+", () => {
    expect(r.fannie.pass).toBe(null);
    expect(r.freddie.pass).toBe(false);
    expect(r.freddie.blockers[0]).toMatch(/62\+/);
  });
  it("A&D: 55% max, minimum assets lesser of 1.1× loan or $1M", () => {
    expect(r.ad.dti).toBeCloseTo(0.2958, 4);
    expect(r.ad.pass).toBe(true);
  });
  it("LTV above a program's max blocks it even when the math passes", () => {
    const hi = byId(evaluateAssetPrograms({ ...base, ltv: 0.85 }));
    expect(hi.newrez.pass).toBe(false);
    expect(hi.bluepoint.pass).toBe(true); // 85% max
  });
  it("retirement under 59½ takes the lower percentage", () => {
    const young = byId(evaluateAssetPrograms({ ...base, assets: [{ type: "Retirement", value: 1000000 }], borrowerAge: 45 }));
    const old = byId(evaluateAssetPrograms({ ...base, assets: [{ type: "Retirement", value: 1000000 }], borrowerAge: 65 }));
    expect(young.newrez.eligible).toBe(500000);
    expect(old.newrez.eligible).toBe(850000);
  });
  it("gift money pays closing costs first, never counts as qualifying", () => {
    const g = byId(evaluateAssetPrograms({ ...base, assets: [...base.assets, { type: "Gift", value: 200000 }] }));
    expect(g.newrez.afterClose).toBe(2700000); // 3M − (500K − 200K gift)
  });
  it("Fannie isn't charged for closing money that came out of checking", () => {
    const f = byId(evaluateAssetPrograms({ ...base,
      assets: [{ type: "Checking", value: 500000 }, { type: "Retirement", value: 1000000 }],
      borrowerAge: 65, cashToClose: 400000, loanAmount: 800000, housingPayment: 5500, otherMonthlyDebts: 0,
      otherIncome: 10000 })).fannie;
    expect(f.afterClose).toBe(1000000);
    // 1M ÷ 360 = 2,777.78 + 10,000 other income; 5,500 / 12,777.78
    expect(f.dti).toBeCloseTo(0.43043, 4);
    expect(f.pass).toBe(true);
  });
  it("summary counts passes", () => {
    const s = summarizeAssetPrograms(evaluateAssetPrograms(base));
    expect(s.passCount).toBe(6);
    expect(s.evaluated).toBe(8);
  });
});

describe("computeDscr", () => {
  it("$5,000 rent / $4,000 PITIA = 1.25, strong", () => {
    const d = computeDscr({ rent: 5000, pitia: 4000 });
    expect(d.ratio).toBe(1.25);
    expect(d.pass).toBe(true);
    expect(d.tier).toBe("Strong");
  });
  it("$3,600 / $4,000 = 0.90 fails 1.00 by $400 of rent", () => {
    const d = computeDscr({ rent: 3600, pitia: 4000 });
    expect(d.ratio).toBe(0.9);
    expect(d.pass).toBe(false);
    expect(d.shortfall).toBe(400);
  });
  it("no rent → not scored", () => {
    expect(computeDscr({ rent: 0, pitia: 4000 }).pass).toBe(null);
  });
});

describe("HELOC", () => {
  it("IO on the draw, qualify on IO of the full line, repay over 20 years", () => {
    const h = computeHelocPayments({ line: 100000, drawn: 60000, rate: 9 });
    expect(h.ioPayment).toBeCloseTo(450, 6);
    expect(h.qualifyingPayment).toBeCloseTo(750, 6);
    expect(h.repayPayment).toBeCloseTo(539.83, 1);
  });
  it("80/10/10 piggyback", () => {
    expect(computePiggyback({ price: 1000000, downPct: 10 })).toEqual({ first: 800000, heloc: 100000, cltv: 0.9, firstLtv: 0.8 });
  });
  it("20% down needs no HELOC", () => {
    expect(computePiggyback({ price: 1000000, downPct: 20 }).heloc).toBe(0);
  });
  it("standalone line is capped at 90% CLTV", () => {
    const s = computeStandaloneLine({ homeValue: 1000000, firstBalance: 600000, requested: 350000 });
    expect(s.maxLine).toBe(300000);
    expect(s.overMax).toBe(true);
    expect(computeStandaloneLine({ homeValue: 1000000, firstBalance: 600000 }).line).toBe(300000);
  });
});
