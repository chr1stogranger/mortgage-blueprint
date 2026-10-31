import { describe, it, expect } from "vitest";
import { refiStructureTargets, activeRefiStructure } from "./refiStructures.js";

describe("refiStructureTargets", () => {
  // CMG test file: payoffs $1,764,374, costs $4,593, prepaids $321, credits $12,477
  const cmg = { payoff: 1764374, closingCosts: 4593, prepaids: 321, credits: 12477 };

  it("bring costs is the payoff", () => {
    expect(refiStructureTargets(cmg).bring).toBe(1764374);
  });

  it("zero at close nets credits against costs and rounds up", () => {
    expect(refiStructureTargets(cmg).zero).toBe(1764374 + 4593 + 321 - 12477);
    expect(refiStructureTargets({ payoff: 400000, closingCosts: 4000.4, prepaids: 0 }).zero).toBe(404001);
  });

  it("cash back uses the $2,000 floor on small loans", () => {
    // rolled 154,000 → 1% of 156,000 is 1,560, under the floor
    expect(refiStructureTargets({ payoff: 150000, closingCosts: 4000 }).cash).toBe(156000);
  });

  it("cash back uses 1% of the new loan once that beats the floor", () => {
    const { cash } = refiStructureTargets({ payoff: 500000, closingCosts: 5000 });
    expect(cash).toBe(Math.floor(505000 / 0.99));
    // the cash left over after rolling costs in stays within 1% of the loan
    expect(cash - 505000).toBeLessThanOrEqual(cash * 0.01);
  });

  it("handles missing inputs", () => {
    expect(refiStructureTargets({})).toEqual({ bring: 0, zero: 0, cash: 2000 });
  });
});

describe("activeRefiStructure", () => {
  const t = { bring: 400000, zero: 404000, cash: 406000 };
  it("matches within a few dollars", () => {
    expect(activeRefiStructure(404002, t)).toBe("zero");
    expect(activeRefiStructure(400000, t)).toBe("bring");
    expect(activeRefiStructure(406000, t)).toBe("cash");
  });
  it("returns null for a custom amount", () => {
    expect(activeRefiStructure(410000, t)).toBe(null);
  });
});
