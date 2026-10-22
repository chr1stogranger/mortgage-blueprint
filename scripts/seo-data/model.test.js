import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildSite, parseLimitSource, prefillLink, slugify, splitRate, money2 } from "./model.js";
import { renderPage, esc } from "./render.js";
import { LICENSED_COUNTIES } from "../../src/data/licensedCounties.js";
import { CA_CITY_COUNTY } from "../../src/data/caCityCounty.js";
import { CA_CITY_TAX_RATES } from "../../src/citiesData.js";
import { CA_TAX_BILL_LOOKUP } from "../../src/data/caTaxBillLookup.js";
import { CA_TAX_COUNTIES, CA_TAX_CURRENT_FY, CA_TAX_STALE_COUNTIES, BAY_AREA_COUNTIES } from "../../src/data/caTaxRates.js";
import { COUNTY_LIMITS, normalizeCounty, getCountyLimits } from "../../src/data/loanLimits.js";

const limitSource = parseLimitSource(readFileSync("src/data/loanLimits.js", "utf8"));
const site = buildSite({ now: "2026-10-21", limitSource });
const byPath = new Map(site.pages.map((p) => [p.path, p]));
const pageText = (p) => JSON.stringify([p.lead, p.sections]);

describe("generated data files", () => {
  it("lists every FHFA county for the 8 licensed states", () => {
    const counts = Object.fromEntries(Object.entries(LICENSED_COUNTIES).map(([st, l]) => [st, l.length]));
    expect(counts).toEqual({ AZ: 15, CA: 58, CO: 64, HI: 5, NV: 17, OR: 36, TX: 254, WA: 39 });
  });

  it("matches every COUNTY_LIMITS key for those states to exactly one county", () => {
    for (const st of Object.keys(LICENSED_COUNTIES)) {
      for (const key of Object.keys(COUNTY_LIMITS).filter((k) => k.startsWith(`${st}|`))) {
        expect(LICENSED_COUNTIES[st].filter((c) => normalizeCounty(c.name) === key.slice(3)), key).toHaveLength(1);
      }
    }
  });

  it("maps only sourced CA cities (never the 1.25% default block or Amador Valley)", () => {
    const cities = Object.keys(CA_CITY_COUNTY);
    expect(cities.length).toBe(600);
    for (const c of cities) expect(CA_CITY_TAX_RATES[c], c).not.toBe(0.0125);
    expect(CA_CITY_COUNTY["Amador Valley"]).toBeUndefined();
    const counties = new Set(Object.values(CA_CITY_COUNTY));
    for (const c of BAY_AREA_COUNTIES) expect(counties.has(c), c).toBe(true);
    expect(counties.size).toBe(CA_TAX_COUNTIES.length);
  });

  it("every county block names its year and source, with rates in range", () => {
    for (const c of CA_TAX_COUNTIES) {
      expect(c.fy, c.county).toMatch(/^20\d\d-\d\d$/);
      expect(c.url, c.county).toMatch(/^https:\/\//);
      expect(c.source, c.county).toBeTruthy();
      for (const [city, pct] of Object.entries(c.rates)) {
        expect(pct, city).toBeGreaterThanOrEqual(1);
        expect(pct, city).toBeLessThan(1.8);
      }
    }
    expect(Object.keys(CA_TAX_BILL_LOOKUP).sort()).toEqual(LICENSED_COUNTIES.CA.map((c) => normalizeCounty(c.name)).map((k) => LICENSED_COUNTIES.CA.find((c) => normalizeCounty(c.name) === k).name.replace(/ County$/, "")).sort());
    for (const [k, v] of Object.entries(CA_TAX_BILL_LOOKUP)) {
      expect(v.url, k).toMatch(/^https:\/\//);
      expect(v.office, k).toBeTruthy();
    }
    expect(CA_TAX_STALE_COUNTIES).toEqual(CA_TAX_COUNTIES.filter((c) => c.fy !== CA_TAX_CURRENT_FY).map((c) => c.county));
  });
});

describe("page set", () => {
  it("has the expected counts", () => {
    const n = (re) => site.pages.filter((p) => re.test(p.path)).length;
    expect(n(/^\/loan-limits\/$/)).toBe(1);
    expect(n(/^\/loan-limits\/[^/]+\/$/)).toBe(8);
    expect(n(/^\/loan-limits\/[^/]+\/[^/]+\/$/)).toBe(46);
    expect(n(/^\/property-tax\/california\/$/)).toBe(1);
    expect(n(/^\/property-tax\/california\/[^/]+-county\/$/)).toBe(CA_TAX_COUNTIES.length);
    expect(n(/^\/property-tax\/california\/[^/]+\/$/)).toBe(CA_TAX_COUNTIES.length + Object.keys(CA_CITY_COUNTY).length);
    expect(site.sitemap).toHaveLength(site.pages.length);
  });

  it("Alameda CA: $1,249,125 / $1,599,375, with a county page", () => {
    expect(getCountyLimits("CA", "Alameda", 1).highBalance).toBe(1249125);
    expect(getCountyLimits("CA", "Alameda", 2).highBalance).toBe(1599375);
    const p = byPath.get("/loan-limits/california/alameda-county/");
    expect(p.h1).toBe("2026 Conforming Loan Limits in Alameda County, California");
    expect(p.lead).toBe("The 2026 conforming loan limit for a one-unit home in Alameda County, California is $1,249,125, the FHFA high-cost ceiling. Loans above that amount are jumbo loans.");
    expect(pageText(p)).toContain("$1,599,375");
    expect(pageText(p)).toContain("/property-tax/california/fremont/");
  });

  it("Fresno CA: $832,750, no loan-limit page (a row on the CA state page), but a tax page", () => {
    expect(getCountyLimits("CA", "Fresno", 1).highBalance).toBe(832750);
    expect([...byPath.keys()].some((k) => k.startsWith("/loan-limits/") && k.includes("fresno"))).toBe(false);
    const tax = byPath.get("/property-tax/california/fresno-county/");
    expect(tax.h1).toMatch(/^Fresno County Property Tax Rates \(FY 20\d\d-\d\d\)$/);
    expect(pageText(tax)).toContain("/loan-limits/california/#fresno-county");
    expect(pageText(byPath.get("/property-tax/california/fresno/"))).toContain("/property-tax/california/fresno-county/");
    const row = byPath.get("/loan-limits/california/").sections[0].blocks[0].rows.find((r) => r.id === "fresno-county");
    expect(row.cells).toEqual(["Fresno County", "$832,750", "$1,066,250", "$1,288,800", "$1,601,750"]);
  });

  it("King WA, Denver CO, Maui HI have pages with the right limit", () => {
    expect(byPath.get("/loan-limits/washington/king-county/").lead).toContain("$1,063,750");
    expect(byPath.get("/loan-limits/colorado/denver-county/").lead).toContain("$862,500");
    expect(byPath.get("/loan-limits/hawaii/maui-county/").lead).toContain("$1,299,500");
  });

  it("Honolulu HI: $1,249,125 under HERA, page exists though not high-cost", () => {
    const lim = getCountyLimits("HI", "Honolulu", 1);
    expect(lim.highBalance).toBe(1249125);
    expect(lim.isHighCost).toBe(false);
    const p = byPath.get("/loan-limits/hawaii/honolulu-county/");
    expect(p.lead).toContain("$1,249,125");
    expect(p.lead).toContain("HERA");
    expect(byPath.get("/loan-limits/hawaii/kalawao-county/")).toBeTruthy();
  });

  it("Travis TX: $832,750, no county page; TX lead says all 254 are at baseline", () => {
    expect(getCountyLimits("TX", "Travis", 1).highBalance).toBe(832750);
    expect([...byPath.keys()].filter((k) => k.startsWith("/loan-limits/texas/"))).toEqual(["/loan-limits/texas/"]);
    expect(byPath.get("/loan-limits/texas/").lead).toBe("All 254 Texas counties use the national baseline of $832,750 for a one-unit home in 2026. Loans above that amount are jumbo loans.");
  });

  it("Fremont: 1.1746% (FY 2026-27); $1M -> $11,746/yr, $978.83/mo", () => {
    const p = byPath.get("/property-tax/california/fremont/");
    expect(p.h1).toBe("Fremont, CA Property Tax Rate (FY 2026-27)");
    expect(p.lead).toBe("Fremont's property tax rate is 1.1746% for fiscal year 2026-27 in its primary tax rate area: the 1% Proposition 13 base plus 0.1746% in voter-approved bonds.");
    // 1,000,000 x 0.011746 = 11,746; / 12 = 978.8333... -> 978.83
    const row = p.taxRows.find((r) => r.price === 1000000);
    expect(row).toEqual({ price: 1000000, annual: 11746, monthly: 978.83 });
    expect(money2(row.annual)).toBe("$11,746.00");
    expect(pageText(p)).toContain("/loan-limits/california/alameda-county/");
  });

  it("San Francisco: 1.1816% (FY 2026-27); $1M -> $11,816.22/yr", () => {
    const p = byPath.get("/property-tax/california/san-francisco/");
    expect(p.lead).toContain("1.1816%");
    expect(p.lead).toContain("2026-27");
    // 1,000,000 x 0.0118162182 = 11,816.22
    expect(p.taxRows.find((r) => r.price === 1000000).annual).toBe(11816.22);
    expect(pageText(p)).toContain("$11,816.22");
  });

  it("never publishes a placeholder-rate city", () => {
    for (const slug of ["alturas", "crescent-city", "yreka", "amador-valley", "bethel-island"]) {
      expect(byPath.has(`/property-tax/california/${slug}/`), slug).toBe(false);
    }
  });

  it("titles, descriptions, canonicals", () => {
    for (const p of site.pages) {
      expect(p.description.length).toBeLessThanOrEqual(155);
      expect(p.url).toBe(`https://blueprint.realstack.app${p.path}`);
      expect(p.path.endsWith("/")).toBe(true);
      expect(p.title).toMatch(/ — Mortgage Blueprint, powered by RealStack$/);
    }
    expect(new Set(site.pages.map((p) => p.title)).size).toBe(site.pages.length);
  });

  it("quotes no interest rate anywhere", () => {
    for (const p of site.pages) expect(pageText(p), p.path).not.toMatch(/interest rate|\bAPR\b|\bper annum\b/i);
  });
});

describe("helpers", () => {
  it("slugify", () => {
    expect(slugify("St. Helena")).toBe("st-helena");
    expect(slugify("Contra Costa County")).toBe("contra-costa-county");
    expect(slugify("La Cañada Flintridge")).toBe("la-canada-flintridge");
  });

  it("splitRate keeps the parts adding up and refuses sub-1% rates", () => {
    expect(splitRate(0.01182683)).toEqual({ total: "1.1827%", bonds: "0.1827%" });
    expect(() => splitRate(0.009)).toThrow();
  });

  it("prefillLink encodes place names and parses back", () => {
    const link = prefillLink({ st: "CA", county: "Contra Costa", city: "Walnut Creek", src: "seo-ptax" });
    expect(link).toBe("https://blueprint.realstack.app/?st=CA&county=Contra+Costa&city=Walnut+Creek&src=seo-ptax");
    const q = new URL(link).searchParams;
    expect([q.get("st"), q.get("county"), q.get("city"), q.get("src")]).toEqual(["CA", "Contra Costa", "Walnut Creek", "seo-ptax"]);
    expect(prefillLink({ st: "CA", county: "Alameda", src: "seo-ll" })).toBe("https://blueprint.realstack.app/?st=CA&county=Alameda&src=seo-ll");
  });

  it("renders escaped, script-free HTML with parseable JSON-LD", () => {
    expect(esc(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
    const html = renderPage(byPath.get("/loan-limits/california/alameda-county/"), { fontHref: "https://fonts.googleapis.com/css2?family=Inter&display=swap" });
    expect(html).toContain("<h1>2026 Conforming Loan Limits in Alameda County, California</h1>");
    expect(html).toContain('<link rel="canonical" href="https://blueprint.realstack.app/loan-limits/california/alameda-county/" />');
    expect(html.match(/POWERED BY REALSTACK/g)).toHaveLength(1);
    const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
    expect(scripts.length).toBe(2);
    for (const [, attrs, body] of scripts) {
      expect(attrs).toBe(' type="application/ld+json"');
      expect(() => JSON.parse(body)).not.toThrow();
    }
    expect(html).toContain("?st=CA&amp;county=Alameda&amp;src=seo-ll");
  });
});
