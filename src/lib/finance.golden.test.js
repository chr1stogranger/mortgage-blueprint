// src/lib/finance.golden.test.js
//
// Golden set (added 2026-11-15): 45 real closed loans from Chris's book,
// de-identified (no names, ids or addresses), run through Blueprint's money
// math. Right answers come from an independent Python Decimal reference
// (closed-form payment and balance, APR by bisection), never from this code.
// Re-run after any change to finance.js: npm test -- finance.golden

import { describe, it, expect } from "vitest";
import G from "./__golden__/real-loans.json";
import { calcPI, calcBalance, calcAPR } from "./finance.js";

describe("finance golden set: real loans", () => {
  it("has 45 cases", () => expect(G.cases.length).toBe(45));
  for (const c of G.cases) {
    const label = `${c.id} ${c.product} $${c.loan.toLocaleString()} @ ${c.ratePct}% / ${c.termYears}yr`;
    it(`${label}: P&I to the cent`, () => {
      expect(calcPI(c.loan, c.ratePct, c.termYears)).toBeCloseTo(c.expectPI, 2);
    });
    it(`${label}: balance after ${c.paidMonths} payments`, () => {
      expect(calcBalance(c.loan, c.ratePct, c.termYears, c.paidMonths)).toBeCloseTo(c.expectBalance, 1);
    });
    it(`${label}: APR with $${c.fees.toLocaleString()} in fees within 0.001%`, () => {
      expect(Math.abs(calcAPR(c.loan, c.ratePct, c.termYears, c.fees) - c.expectAPR)).toBeLessThan(0.001);
    });
  }
});
