import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { caCityTaxUrl, caCountyTaxUrl, CA_TAX_HUB_URL, SEO_ORIGIN } from "./seoPaths.js";
import { CA_TAX_COUNTIES } from "../data/caTaxRates.js";
import { buildSite, parseLimitSource } from "../../scripts/seo-data/model.js";

const site = buildSite({ now: "2026-10-22", limitSource: parseLimitSource(readFileSync("src/data/loanLimits.js", "utf8")) });
const urls = new Set(site.pages.map((p) => p.url));

describe("in-app links to the SEO pages", () => {
  it("every city and county in the rates sheet links to a page the build makes", () => {
    let n = 0;
    for (const c of CA_TAX_COUNTIES) {
      expect(urls.has(caCountyTaxUrl(c.county)), c.county).toBe(true);
      for (const city of Object.keys(c.rates)) {
        expect(urls.has(caCityTaxUrl(city)), city).toBe(true);
        n++;
      }
    }
    expect(n).toBeGreaterThan(500);
    expect(urls.has(CA_TAX_HUB_URL)).toBe(true);
  });

  it("returns null instead of a dead link", () => {
    expect(caCityTaxUrl("Irvine-Not-A-City")).toBeNull();
    expect(caCityTaxUrl("")).toBeNull();
    expect(caCityTaxUrl("constructor")).toBeNull();
    expect(caCountyTaxUrl("Atlantis")).toBeNull();
  });

  it("uses the production origin (works inside the native app)", () => {
    expect(caCityTaxUrl("Fremont")).toBe(`${SEO_ORIGIN}/property-tax/california/fremont/`);
    expect(caCountyTaxUrl("Contra Costa")).toBe(`${SEO_ORIGIN}/property-tax/california/contra-costa-county/`);
  });
});
