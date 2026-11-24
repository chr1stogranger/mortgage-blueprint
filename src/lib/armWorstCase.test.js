import { describe, it, expect } from "vitest";
import { armWorstCase, nextAdjustmentDate } from "./armWorstCase.js";

const now = new Date(2026, 10, 24); // Nov 24 2026
const base = { balance: 400000, rate: 4.875, payment: 2600, remainingMonths: 239, startRate: 2.875, adjustedDate: "2026-11-01", now };

describe("armWorstCase", () => {
  it("steps up by the subsequent cap each year until start + lifetime cap", () => {
    const out = armWorstCase({ ...base, caps: { periodMonths: 12, firstCap: 2, periodicCap: 2, lifetimeCap: 5 } });
    expect(out.maxRate).toBeCloseTo(7.875, 6);
    expect(out.steps.map((s) => +s.rate.toFixed(3))).toEqual([6.875, 7.875]);
    expect(out.steps[0].date.getFullYear()).toBe(2027);
    expect(out.steps[0].date.getMonth()).toBe(10); // November
    expect(out.steps[1].ceiling).toBe(true);
    expect(out.rows.at(-1).bal).toBeLessThan(1);
  });

  it("costs more interest than holding today's rate, and more with a bigger lifetime cap", () => {
    const five = armWorstCase({ ...base, caps: { lifetimeCap: 5 } });
    const six = armWorstCase({ ...base, caps: { lifetimeCap: 6 } });
    let bal = base.balance, flat = 0;
    for (let m = 0; m < base.remainingMonths && bal > 0; m++) { const i = bal * base.rate / 1200; flat += i; bal -= base.payment - i; }
    expect(five.totalInt).toBeGreaterThan(flat);
    expect(six.totalInt).toBeGreaterThan(five.totalInt);
    expect(six.steps.map((s) => +s.rate.toFixed(3))).toEqual([6.875, 8.875]);
  });

  it("uses the first cap when the loan hasn't adjusted yet", () => {
    const out = armWorstCase({ ...base, rate: 2.875, adjustedDate: "", caps: { nextAdj: "2027-03-01", firstCap: 5, periodicCap: 1, lifetimeCap: 5 } });
    expect(out.steps.map((s) => +s.rate.toFixed(3))).toEqual([7.875]);
  });

  it("6-month adjustments and a typed next date", () => {
    expect(nextAdjustmentDate({ adjustedDate: "2026-11-01", periodMonths: 6, now }).getMonth()).toBe(4); // May 2027
    expect(nextAdjustmentDate({ nextAdj: "2027-02-01", adjustedDate: "2026-11-01", now }).getMonth()).toBe(1);
  });
});
