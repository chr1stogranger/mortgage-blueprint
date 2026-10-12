import { describe, it, expect } from "vitest";
import { listingToPrefill, listingScenarioName, readListingToken } from "./listingPrefill.js";

// Fixture = the Ops /api/listing contract (2026-10-12).
const FIXTURE = {
  token: "abc123XYZ789",
  address: "4855 Mission St #6, San Francisco, CA 94112",
  street: "4855 Mission St #6", city: "San Francisco", state: "CA", zip: "94112",
  price: 800000, beds: 2, baths: 2, sqft: 1196, propertyType: "Condo",
  downPct: 5, noteRate: 6.98, term: 30, loanType: "Conventional",
  buydown: "2-1", buydownPaidBy: "seller", creditScore: 740,
  hoaMonthly: 450, insMonthly: 150, taxRateOverridePct: null,
  lo: { name: "Chris Granger", nmls: "952015" },
  realtor: { name: "Frank Castaldini", company: "Compass" },
};
const deps = {
  lookupZip: (z) => (z === "94112" ? { city: "San Francisco", county: "San Francisco", state: "California" } : null),
  cityNames: ["Alameda", "San Francisco", "Oakland"],
  stateMap: { CA: "California", NV: "Nevada" },
  getAutoTaxRate: (st, c) => (st === "California" && c === "San Francisco" ? 0.01182683 : 0.012),
};

describe("listingToPrefill", () => {
  it("maps the fixture onto Blueprint keys", () => {
    const p = listingToPrefill(FIXTURE, deps);
    expect(p).toMatchObject({
      salesPrice: 800000, downPct: 5, rate: 6.98, term: 30, loanType: "Conventional",
      buydownType: "2-1", buydownPaidBy: "seller", creditScore: 740,
      hoa: 450, annualIns: 1800, propType: "Condo", loanPurpose: "Purchase Primary", isRefi: false,
      propertyZip: "94112", city: "San Francisco", propertyState: "California", propertyCounty: "San Francisco",
      propertyAddress: "4855 Mission St #6", addressInput: "4855 Mission St #6, San Francisco, CA 94112",
      addressMode: "address", propertyTBD: false, taxRateLocked: true, taxBaseRateOverride: 1.1827,
      realtorName: "Frank Castaldini",
    });
    expect(p.vaUsage).toBeUndefined();
  });

  it("tax override unlocks and pins the rate", () => {
    const p = listingToPrefill({ ...FIXTURE, taxRateOverridePct: 1.25 }, deps);
    expect(p.taxRateLocked).toBe(false);
    expect(p.taxBaseRateOverride).toBe(1.25);
  });

  it("is defensive about nulls, junk and unknown enums", () => {
    const p = listingToPrefill({ price: null, noteRate: "abc", buydown: "4-4", loanType: "Bridge", propertyType: "Castle", state: "CA", city: "san francisco" }, deps);
    expect(p.salesPrice).toBeUndefined();
    expect(p.rate).toBeUndefined();
    expect(p.buydownType).toBe("none");
    expect(p.loanType).toBeUndefined();
    expect(p.propType).toBeUndefined();
    expect(p.city).toBe("San Francisco"); // case-folded onto the tax-table key
    expect(p.propertyState).toBe("California");
    expect(listingToPrefill(null, deps)).toEqual({ loanPurpose: "Purchase Primary", isRefi: false });
  });

  it("VA sets First Use; 1-1 buydown and 2-4 Unit map through", () => {
    const p = listingToPrefill({ loanType: "VA", buydown: "1-1", propertyType: "2-4 Unit" }, deps);
    expect(p.loanType).toBe("VA");
    expect(p.vaUsage).toBe("First Use");
    expect(p.buydownType).toBe("1-1");
    expect(p.propType).toBe("2-Unit");
  });
});

describe("fixed assessments + unit count (2026-10-12)", () => {
  it("passes the flyer's Mello-Roos through, including an explicit $0", () => {
    expect(listingToPrefill({ ...FIXTURE, fixedAssessments: 2350 }, deps).fixedAssessments).toBe(2350);
    expect(listingToPrefill({ ...FIXTURE, fixedAssessments: 0 }, deps).fixedAssessments).toBe(0);
    expect(listingToPrefill(FIXTURE, deps).fixedAssessments).toBeUndefined(); // absent → Blueprint default
    expect(listingToPrefill({ ...FIXTURE, fixedAssessments: -5 }, deps).fixedAssessments).toBeUndefined();
  });

  it("units picks the exact multi-unit type; single-unit types ignore it", () => {
    expect(listingToPrefill({ ...FIXTURE, propertyType: "2-4 Unit", units: 3 }, deps).propType).toBe("3-Unit");
    expect(listingToPrefill({ ...FIXTURE, propertyType: "2-4 Unit", units: 4 }, deps).propType).toBe("4-Unit");
    expect(listingToPrefill({ ...FIXTURE, propertyType: "2-4 Unit" }, deps).propType).toBe("2-Unit");
    expect(listingToPrefill({ ...FIXTURE, propertyType: "Condo", units: 1 }, deps).propType).toBe("Condo");
    expect(listingToPrefill({ ...FIXTURE, propertyType: "Condo", units: 3 }, deps).propType).toBe("Condo");
  });
});

describe("listing token + scenario name", () => {
  it("accepts 8-40 [A-Za-z0-9_-] only", () => {
    expect(readListingToken("?listing=abc123XYZ789")).toBe("abc123XYZ789");
    expect(readListingToken("?listing=short")).toBeNull();
    expect(readListingToken("?listing=bad%20token!!")).toBeNull();
    expect(readListingToken("?client=12")).toBeNull();
  });
  it("names the scenario after the street", () => {
    expect(listingScenarioName(FIXTURE)).toBe("4855 Mission St #6");
    expect(listingScenarioName({ address: "1 Main St, Reno, NV" })).toBe("1 Main St");
    expect(listingScenarioName({})).toBe("Listing");
  });
});
