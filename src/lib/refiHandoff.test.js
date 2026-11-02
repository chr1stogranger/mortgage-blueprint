import { describe, it, expect } from "vitest";
import { cleanHunterKey, refiPrefillFromHandoff, canMarkOfferSent, estimateCurrentMi } from "./refiHandoff.js";

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

describe("estimateCurrentMi", () => {
  const daniel = { loanType: "Conventional", originalAmount: 532000, homeValue: 560000, creditScore: 686 };
  it("prices conventional PMI off the LTV at funding", () => {
    expect(estimateCurrentMi(daniel)).toBe(386);
    expect(estimateCurrentMi({ ...daniel, creditScore: 0 })).toBe(301); // a missing score prices at 700
  });
  it("is $0 at 80% or under, on a value that can't be right, or with no value", () => {
    expect(estimateCurrentMi({ ...daniel, homeValue: 665000 })).toBe(0);
    expect(estimateCurrentMi({ ...daniel, homeValue: 400000 })).toBe(0);
    expect(estimateCurrentMi({ ...daniel, homeValue: 0 })).toBe(0);
  });
  it("uses FHA's schedule and USDA's fee, and VA and jumbo carry none", () => {
    expect(estimateCurrentMi({ loanType: "FHA", originalAmount: 600000, homeValue: 620000 })).toBe(275);
    expect(estimateCurrentMi({ loanType: "FHA", originalAmount: 600000 })).toBe(250);
    expect(estimateCurrentMi({ loanType: "USDA", originalAmount: 300000 })).toBe(88);
    expect(estimateCurrentMi({ ...daniel, loanType: "VA" })).toBe(0);
    expect(estimateCurrentMi({ ...daniel, loanType: "Jumbo" })).toBe(0);
  });
  it("is on the handoff, marked as an estimate", () => {
    const h = { rate: 6, loan_amount: 600000, loan_type: "FHA" };
    expect(refiPrefillFromHandoff(h)).toMatchObject({ refiCurrentMI: 250, refiCurrentMIEstimated: true });
    expect(refiPrefillFromHandoff({ ...h, loan_type: "Conventional" })).toMatchObject({ refiCurrentMI: 0, refiCurrentMIEstimated: false });
  });
});
