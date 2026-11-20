import { describe, it, expect } from "vitest";
import { qualifyingScore, loanQualifyingScore, reportDates, cleanReport, hasVantage } from "./creditReport.js";

const rep = (ex, tu, eq) => ({ ex: { fico: ex }, tu: { fico: tu }, eq: { fico: eq } });

describe("qualifyingScore", () => {
  it("takes the middle of three", () => {
    expect(qualifyingScore(rep(742, 728, 735))).toMatchObject({ score: 735, key: "eq", rule: "middle" });
  });
  it("takes the repeated score when two match", () => {
    expect(qualifyingScore(rep(700, 700, 760)).score).toBe(700);
    expect(qualifyingScore(rep(700, 760, 760)).score).toBe(760);
  });
  it("takes the lower of two", () => {
    expect(qualifyingScore(rep(742, 0, 735))).toMatchObject({ score: 735, rule: "lower" });
  });
  it("takes the only score", () => {
    expect(qualifyingScore(rep(0, 701, 0))).toMatchObject({ score: 701, key: "tu", rule: "only" });
  });
  it("ignores out-of-range scores and empty reports", () => {
    expect(qualifyingScore(rep(120, 900, 0)).score).toBe(0);
    expect(qualifyingScore(null).score).toBe(0);
  });
  it("reads VantageScore separately", () => {
    const r = { ex: { fico: 742, vantage: 751 }, tu: { fico: 728, vantage: 739 }, eq: { fico: 735, vantage: 744 } };
    expect(qualifyingScore(r, "vantage").score).toBe(744);
  });
});

describe("reportDates", () => {
  it("counts 120 days from the oldest pull", () => {
    const r = { ex: { pulled: "2026-11-12" }, tu: { pulled: "2026-11-12" }, eq: { pulled: "2026-11-14" } };
    const d = reportDates(r, new Date(2026, 10, 19));
    expect(d.sameDay).toBe(false);
    expect([d.goodThrough.getFullYear(), d.goodThrough.getMonth(), d.goodThrough.getDate()]).toEqual([2027, 2, 12]);
    expect(d.daysLeft).toBe(113);
  });
  it("goes negative once expired, null with no dates", () => {
    expect(reportDates({ ex: { pulled: "2026-01-01" } }, new Date(2026, 10, 19)).daysLeft).toBeLessThan(0);
    expect(reportDates({ ex: { fico: 700 } })).toBeNull();
  });
});

describe("cleanReport", () => {
  it("drops junk and returns null when no scores remain", () => {
    expect(cleanReport({ ex: { fico: 12, pulled: "2026-11-12" } })).toBeNull();
    expect(cleanReport({ ex: { fico: 742, vantage: 9999, pulled: "nope" } }).ex).toEqual({ fico: 742, vantage: 0, pulled: "" });
  });
  it("knows whether any VantageScore is present", () => {
    expect(hasVantage(rep(742, 728, 735))).toBe(false);
    expect(hasVantage({ tu: { vantage: 739 } })).toBe(true);
  });
});

describe("co-borrower", () => {
  const joint = { ...rep(742, 728, 735), co: rep(701, 688, 694) };
  it("qualifies on the lower of the two representative scores", () => {
    expect(loanQualifyingScore(joint)).toMatchObject({ score: 694, who: "co", joint: true });
    expect(loanQualifyingScore({ ...rep(650, 640, 660), co: rep(742, 728, 735) })).toMatchObject({ score: 650, who: "b" });
  });
  it("falls back to whichever borrower has scores", () => {
    expect(loanQualifyingScore(rep(742, 728, 735))).toMatchObject({ score: 735, who: "b", joint: false });
    expect(loanQualifyingScore({ ...rep(0, 0, 0), co: rep(701, 688, 694) })).toMatchObject({ score: 694, who: "co", joint: false });
    expect(loanQualifyingScore(null)).toMatchObject({ score: 0, who: null });
  });
  it("keeps a co-borrower with scores and drops an empty one", () => {
    expect(cleanReport(joint).co.tu.fico).toBe(688);
    expect(cleanReport({ ...rep(742, 728, 735), co: rep(0, 0, 0) }).co).toBeUndefined();
    expect(cleanReport({ co: rep(701, 0, 0) }).ex.fico).toBe(0);
  });
  it("dates and VantageScore look at both borrowers", () => {
    const r = { ex: { fico: 742, pulled: "2026-11-12" }, co: { ex: { fico: 701, vantage: 710, pulled: "2026-10-30" } } };
    const d = reportDates(r, new Date(2026, 10, 19));
    expect([d.oldest.getMonth(), d.oldest.getDate()]).toEqual([9, 30]);
    expect(hasVantage(r)).toBe(true);
  });
});
