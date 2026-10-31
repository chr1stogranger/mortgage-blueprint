import { describe, it, expect } from "vitest";
import { cleanHunterKey, refiPrefillFromHandoff, canMarkOfferSent } from "./refiHandoff.js";

describe("cleanHunterKey", () => {
  it("keeps plain ids and drops anything else", () => {
    expect(cleanHunterKey("812")).toBe("812");
    expect(cleanHunterKey("a1b2-c3")).toBe("a1b2-c3");
    expect(cleanHunterKey("x&y=1")).toBe("");
    expect(cleanHunterKey(null)).toBe("");
  });
});

describe("refiPrefillFromHandoff", () => {
  const h = { name: "Charlene Murphy", email: "c@example.com", rate: 8, loan_amount: 640000, funding_date: "2025-03-07", loan_type: "Conventional", product: "30yr Fixed" };

  it("restates the closed loan as the loan being refinanced", () => {
    expect(refiPrefillFromHandoff(h)).toMatchObject({
      isRefi: true, refiPurpose: "Rate/Term", refiCurrentLoanType: "Conventional",
      refiOriginalAmount: 640000, refiOriginalTerm: 30, refiCurrentRate: 8,
      refiClosedDate: "2025-03-07", refiHasStatement: false, rate: 7.5, term: 30,
      borrowerName: "Charlene Murphy", borrowerEmail: "c@example.com",
    });
  });

  it("maps loan type and term", () => {
    expect(refiPrefillFromHandoff({ ...h, loan_type: "FHA", product: "FHA 15 Year" })).toMatchObject({ refiCurrentLoanType: "FHA", loanType: "FHA", term: 15 });
    expect(refiPrefillFromHandoff({ ...h, loan_type: "Jumbo" }).loanType).toBe("Jumbo");
    expect(refiPrefillFromHandoff({ ...h, loan_type: "VA" }).loanType).toBe("VA");
  });

  it("leaves the close date unset when Ops has none", () => {
    expect(refiPrefillFromHandoff({ ...h, funding_date: null })).not.toHaveProperty("refiClosedDate");
  });
});

describe("canMarkOfferSent", () => {
  it("only moves a row forward", () => {
    expect(canMarkOfferSent("")).toBe(true);
    expect(canMarkOfferSent(undefined)).toBe(true);
    expect(canMarkOfferSent("prospecting")).toBe(true);
    for (const s of ["offer_sent", "in_process", "won", "lost", "ineligible"]) expect(canMarkOfferSent(s)).toBe(false);
  });
});
