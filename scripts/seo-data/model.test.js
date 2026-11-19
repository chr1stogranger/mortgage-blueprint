import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildSite, parseLimitSource, prefillLink, slugify, splitRate, money2 } from "./model.js";
import { renderPage, renderCss, esc } from "./render.js";
import { LICENSED_COUNTIES } from "../../src/data/licensedCounties.js";
import { CA_CITY_COUNTY } from "../../src/data/caCityCounty.js";
import { CA_CITY_TAX_RATES } from "../../src/citiesData.js";
import { CA_TAX_BILL_LOOKUP } from "../../src/data/caTaxBillLookup.js";
import { caCountyTaxPath } from "../../src/lib/seoPaths.js";
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
    expect(cities.length).toBe(607);
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
    expect(CA_TAX_STALE_COUNTIES).toEqual(CA_TAX_COUNTIES.filter((c) => c.fy !== CA_TAX_CURRENT_FY || c.computed).map((c) => c.county));
  });
});

describe("computed rates", () => {
  it("says so wherever a county's rates are summed from its bills", () => {
    const computed = CA_TAX_COUNTIES.filter((c) => c.computed);
    expect(computed.map((c) => c.county)).toEqual(["San Bernardino"]);
    for (const c of computed) {
      expect(CA_TAX_STALE_COUNTIES).toContain(c.county);
      expect(c.source).toMatch(/added up/);
      expect(byPath.get(caCountyTaxPath(c.county))?.lead).toMatch(/added up from the district rates/);
    }
    expect(pageText(byPath.get("/property-tax/california/"))).toMatch(/San Bernardino County hasn't published/);
  });
});

describe("page set", () => {
  it("has the expected counts", () => {
    const n = (re) => site.pages.filter((p) => re.test(p.path)).length;
    expect(n(/^\/loan-limits\/$/)).toBe(1);
    expect(n(/^\/loan-limits\/[^/]+\/$/)).toBe(56); // 50 states, DC and 5 territories
    expect(n(/^\/loan-limits\/[^/]+\/[^/]+\/$/)).toBe(159);
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
    const table = byPath.get("/loan-limits/california/").sections.find((x) => x.heading === "California county limits").blocks[0];
    const row = table.rows.find((r) => r.id === "fresno-county");
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
    const html = renderPage(byPath.get("/loan-limits/california/alameda-county/"), { fontHref: "/fonts/fonts.css" });
    expect(html).toContain("<h1>2026 Conforming Loan Limits in Alameda County, California</h1>");
    expect(html).toContain('<link rel="canonical" href="https://blueprint.realstack.app/loan-limits/california/alameda-county/" />');
    expect(html.match(/POWERED BY REALSTACK/g)).toHaveLength(1);
    const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
    // Two JSON-LD blocks, plus the loan-limit checker's module (an external file, no inline code).
    expect(scripts.filter(([, attrs]) => attrs === ' type="module" src="/seo/ll-calc.js"').length).toBe(1);
    const ld = scripts.filter(([, attrs]) => !attrs.includes("module"));
    expect(ld.length).toBe(2);
    for (const [, attrs, body] of ld) {
      expect(attrs).toBe(' type="application/ld+json"');
      expect(() => JSON.parse(body)).not.toThrow();
    }
    expect(html).toContain("?st=CA&amp;county=Alameda&amp;src=seo-ll");
  });
});

describe("property tax calculator", () => {
  it("matches Blueprint's Tax breakdown (Alameda, $1M, primary, $1,500 fixed)", async () => {
    const { computeTax, formatTax } = await import("./tax-calc.client.js");
    // (1,000,000 - 7,000) x 1.2127% = 12,042.11; + 1,500 = 13,542.11; / 1,000,000 = 1.354%
    const t = computeTax({ price: 1000000, ratePct: 1.2127, mode: "home", fixed: 1500 });
    expect(formatTax(t)).toEqual({
      price: "$1,000,000", exemption: "-$7,000", taxable: "$993,000", base: "$12,042.11", fixed: "$1,500.00",
      annual: "$13,542.11", monthly: "$1,128.51", effective: "1.354%",
    });
    expect(computeTax({ price: 1000000, ratePct: 1.2127, mode: "none", fixed: 0 }).annual).toBeCloseTo(12127, 6);
    expect(computeTax({ price: 0, ratePct: 1.2, mode: "home", fixed: 0 })).toMatchObject({ annual: 0, effectivePct: 0 });
  });

  it("is on every CA tax page, pre-filled and readable without JS; never on loan-limit pages", () => {
    const font = { fontHref: "/fonts/fonts.css" };
    for (const p of site.pages) {
      const html = renderPage(p, font);
      const hasCalc = html.includes("data-taxcalc");
      expect(hasCalc, p.path).toBe(p.path.startsWith("/property-tax/"));
      expect(html.includes('<script type="module" src="/seo/tax-calc.js"></script>'), p.path).toBe(hasCalc);
    }
    const fremont = renderPage(byPath.get("/property-tax/california/fremont/"), font);
    expect(fremont).toContain('name="city" role="combobox"');
    expect(fremont).toContain('value="Fremont"');
    // (1,000,000 - 7,000) x rate, rendered at build time
    const pct = CA_CITY_TAX_RATES.Fremont * 100;
    const base = ((1000000 - 7000) * pct) / 100;
    expect(fremont).toContain(`data-out="base">$${base.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<`);
    expect(fremont).toMatch(/<a class="pill hub-bill" data-bill href="[^"]*propertytax\.alamedacountyca\.gov[^"]*"[^>]*>Look up your Alameda County tax bill<\/a>/);
  });

  it("applies one exemption at a time, with SB 296's veteran rules", async () => {
    const { computeTax, exemptionAmount: ex } = await import("./tax-calc.client.js");
    expect(ex("home", 1000000)).toBe(7000);
    expect(ex("home", 5000)).toBe(5000);
    expect(ex("none", 1000000)).toBe(0);
    // Half of the first $1M, capped there
    expect(ex("vet", 1000000)).toBe(500000);
    expect(ex("vet", 2000000)).toBe(500000);
    expect(ex("vet", 400000)).toBe(200000);
    // At or under $371,778 the basic exemption is worth more than half, and can't exceed the value
    expect(ex("vet", 371778)).toBe(185889);
    expect(ex("vet", 300000)).toBe(185889);
    expect(ex("vet", 150000)).toBe(150000);
    // At or under the income limit: all of the first $1M
    expect(ex("vet-low", 300000)).toBe(300000);
    expect(ex("vet-low", 1000000)).toBe(1000000);
    expect(ex("vet-low", 2000000)).toBe(1000000);
    // (1,000,000 - 500,000) x 1.215% = 6,075; + 3,000 fixed, which no exemption reduces
    const vet = computeTax({ price: 1000000, ratePct: 1.215, mode: "vet", fixed: 3000 });
    expect(vet.taxable).toBe(500000);
    expect(vet.base).toBeCloseTo(6075, 6);
    expect(vet.annual).toBeCloseTo(9075, 6);
    expect(computeTax({ price: 1000000, ratePct: 1.215, mode: "vet-low", fixed: 3000 })).toMatchObject({ taxable: 0, base: 0, annual: 3000 });
    expect(computeTax({ price: 1000000, ratePct: 1.215, mode: "home", fixed: 3000 }).exemption).toBe(7000);
  });

  it("never defaults fixed assessments to $0, and leads with annual tax and the true rate", async () => {
    const { computeTax, formatTax, fixedEstimate } = await import("./tax-calc.client.js");
    const font = { fontHref: "/fonts/fonts.css" };
    const table = site.taxData.fixed;
    expect(table.default).toBeGreaterThan(0);
    for (const c of Object.keys(table.cities)) expect(CA_CITY_COUNTY[c], c).toBeTruthy();
    for (const p of site.pages.filter((x) => x.path.startsWith("/property-tax/"))) {
      expect(renderPage(p, font), p.path).not.toContain('name="fixed" inputmode="numeric" autocomplete="off" value="0"');
    }
    expect(fixedEstimate("Fremont", table).est).toBe(table.default);
    expect(fixedEstimate("Berkeley", table)).toMatchObject({ est: 5000 });
    expect(fixedEstimate("Berkeley", table).note).toContain("$3,000 to $7,000");
    expect(fixedEstimate("San Francisco", table).note).toContain("$750 to $1,200");
    // Pre-rendered with the estimate included: (1,000,000 - 7,000) x rate + 5,000
    const berkeley = renderPage(byPath.get("/property-tax/california/berkeley/"), font);
    expect(berkeley).toContain('value="5,000"');
    const out = formatTax(computeTax({ price: 1000000, ratePct: CA_CITY_TAX_RATES.Berkeley * 100, mode: "home", fixed: 5000 }));
    expect(berkeley).toContain(`<strong data-out="annual">${out.annual}</strong>`);
    expect(berkeley).toContain(`<strong data-out="effective">${out.effective}</strong>`);
  });

  it("puts the map on every CA tax page, opened on the county; never on loan-limit pages", () => {
    const font = { fontHref: "/fonts/fonts.css" };
    for (const p of site.pages) {
      expect(renderPage(p, font).includes("data-taxmap"), p.path).toBe(p.path.startsWith("/property-tax/"));
    }
    expect(renderPage(byPath.get("/property-tax/california/"), font)).not.toContain("data-county");
    expect(renderPage(byPath.get("/property-tax/california/marin-county/"), font)).toContain('data-county="Marin"');
    expect(renderPage(byPath.get("/property-tax/california/san-francisco-county/"), font)).toContain('data-county="San Francisco"');
    expect(renderPage(byPath.get("/property-tax/california/fremont/"), font)).toContain('data-county="Alameda"');
  });

  it("opens the hub on the math, with the navy map beside it and the explainer below", () => {
    const hub = byPath.get("/property-tax/california/");
    const html = renderPage(hub, { fontHref: "/fonts/fonts.css" });
    expect(hub.title).toContain("California Property Tax Rates by City and County");
    expect(hub.h1).toBe("California Property Tax Calculator");
    expect(html.indexOf('name="price"')).toBeLessThan(html.indexOf("How California property tax works"));
    expect(html).toContain('data-region="Bay Area"');
    expect(html).not.toContain('class="crumbs"');
    expect(html.indexOf('name="price"')).toBeLessThan(html.indexOf('name="rate"'));
    expect(html).toContain('<input type="radio" name="exemption" value="home" checked />');
    expect(html).toContain('<div class="hub-vet" data-vetnote hidden>');
    for (const line of ["Home price", "Taxable value", "City tax rate", "Fixed assessments", "Annual property tax"]) expect(html.slice(html.indexOf('class="hub-receipt"'))).toContain(line);
    expect(html).toContain('<b data-out="exemption">-$7,000</b>');
    expect(html.match(/POWERED BY REALSTACK/g)).toHaveLength(1);
    // The year of each county's rates still has to be stated somewhere on the page.
    expect(pageText(hub)).toMatch(/\d+ of these \d+ counties have fiscal year 2026-27 rates/);
    for (const heading of ["Rates by county", "Lowest rates", "Highest rates", "Look up a property tax bill", "Source"]) expect(html).toContain(`<h2>${heading}</h2>`);
  });

  it("uses the Plaid theme on tax and loan-limit pages, light on every device", () => {
    const font = { fontHref: "/fonts/fonts.css" };
    const css = renderCss();
    expect(css).toMatch(/\.taxhub \{ color-scheme: light;/);
    expect(css).toContain("--accent: #088181");
    expect(css).toMatch(/\.hub-bill \{[^}]*linear-gradient\(#111, #111\) padding-box, conic-gradient\(from 210deg, #3DF59A/);
    expect(css).toContain("linear-gradient(150deg, #0B4AA8 0%, #0A78CC 45%, #13C4C2 100%)");
    expect(renderPage(byPath.get("/property-tax/california/"), font)).toContain('<meta name="theme-color" content="#e8f2f9" />');
    expect(renderPage(byPath.get("/loan-limits/"), font)).toContain('<body class="taxhub llhub">');
  });

  it("gives every city page the full math, and says when its rate isn't current", () => {
    const font = { fontHref: "/fonts/fonts.css" };
    for (const c of CA_TAX_COUNTIES) {
      for (const city of Object.keys(c.rates)) {
        const p = site.pages.find((x) => x.h1.startsWith(`${city}, CA Property Tax Rate`));
        const html = renderPage(p, font);
        expect(html, city).toContain('class="hub-receipt"');
        expect(html, city).toContain('name="exemption" value="vet"');
        expect(html, city).toContain(`value="${city}"`);
        expect(html.match(/POWERED BY REALSTACK/g), city).toHaveLength(1);
        if (c.computed) expect(p.intro, city).toMatch(/added up from the county's/);
        if (c.fy !== CA_TAX_CURRENT_FY) expect(p.intro, city).toContain(`FY ${c.fy} rates are the county's latest published.`);
      }
    }
  });

  it("gives every county page the same first screen, keeping its rate-year notes", () => {
    const font = { fontHref: "/fonts/fonts.css" };
    for (const c of CA_TAX_COUNTIES) {
      const p = byPath.get(caCountyTaxPath(c.county));
      const html = renderPage(p, font);
      expect(html, c.county).toContain('class="taxhub"');
      expect(html.indexOf('name="price"'), c.county).toBeLessThan(html.indexOf("<h2>Rates by city</h2>"));
      expect(html.match(/POWERED BY REALSTACK/g), c.county).toHaveLength(1);
      // The full lead still reads on the page, and the first screen says when rates aren't current.
      expect(html, c.county).toContain('class="lead hub-lead"');
      expect(html, c.county).toContain('class="crumbs"');
      if (c.computed) expect(p.intro, c.county).toMatch(/added up from the county's/);
      if (c.fy !== CA_TAX_CURRENT_FY) expect(p.intro, c.county).toContain(`FY ${c.fy} rates are the county's latest published.`);
      if (c.fy === CA_TAX_CURRENT_FY && !c.computed) expect(p.intro, c.county).toBe("Pick a city, enter the price, and see the whole bill.");
    }
  });

  it("has a map position for every sourced city, and none it doesn't list", () => {
    const geo = JSON.parse(readFileSync(new URL("./ca-map-geo.json", import.meta.url), "utf8"));
    expect(geo.cities.map((c) => c.city).sort()).toEqual(Object.keys(CA_CITY_COUNTY).sort());
    for (const c of geo.cities) {
      expect(c.x, c.city).toBeGreaterThanOrEqual(0);
      expect(c.x, c.city).toBeLessThanOrEqual(geo.width);
      expect(c.y, c.city).toBeGreaterThanOrEqual(0);
      expect(c.y, c.city).toBeLessThanOrEqual(geo.height);
    }
    expect(geo.counties).toHaveLength(58);
  });

  it("finds cities by name, then by county, ignoring accents and case", async () => {
    const { searchCities } = await import("./tax-calc.client.js");
    const list = site.taxData.cities;
    const names = (q) => searchCities(list, q).map((c) => c.city);
    expect(names("fremont")[0]).toBe("Fremont");
    expect(names("san jo")[0]).toBe("San Jose");
    expect(names("WALNUT CR")[0]).toBe("Walnut Creek");
    expect(names("creek")).toContain("Walnut Creek");
    expect(names("marin county")).toContain("San Rafael");
    expect(names("marin county").every((n) => list.find((c) => c.city === n).county === "Marin" || /marin/i.test(n))).toBe(true);
    expect(names("zzzz")).toEqual([]);
    expect(names("  ")).toEqual([]);
  });

  it("buckets rates into legend steps", async () => {
    const { rateBreaks, bucketOf } = await import("./tax-map.client.js");
    const breaks = rateBreaks(site.taxData.cities.map((c) => c.pct));
    expect(breaks).toHaveLength(4);
    expect([...breaks].sort((a, b) => a - b)).toEqual(breaks);
    expect(bucketOf(0.5, breaks)).toBe(0);
    expect(bucketOf(breaks[1], breaks)).toBe(2);
    expect(bucketOf(99, breaks)).toBe(4);
  });

  it("ships every sourced city and county bill link to the live calculator", () => {
    expect(site.taxData.cities).toHaveLength(Object.keys(CA_CITY_COUNTY).length);
    expect(site.taxData.cities[0].county).toBe("Alameda");
    for (const c of site.taxData.cities) expect(c.pct, c.city).toBeGreaterThanOrEqual(1);
    expect(Object.keys(site.taxData.bills)).toHaveLength(58);
  });
});

describe("loan-limit checker and map", () => {
  const font = { fontHref: "/fonts/fonts.css" };

  it("puts the checker and county map first on every loan-limit page", () => {
    const ll = site.pages.filter((p) => p.path.startsWith("/loan-limits/"));
    expect(ll).toHaveLength(1 + 56 + 159);
    for (const p of ll) {
      const html = renderPage(p, font);
      expect(p.layout, p.path).toBe("llhub");
      expect(html, p.path).toContain("data-llcalc");
      expect(html, p.path).toContain('data-llmap data-js="/seo/ll-map.js" data-src="/seo/ll-map-geo.json"');
      expect(html.indexOf('name="price"'), p.path).toBeLessThan(html.indexOf("<h2>"));
      expect(html.match(/POWERED BY REALSTACK/g), p.path).toHaveLength(1);
      expect(html, p.path).toContain('class="lead hub-lead"');
    }
    const hub = renderPage(byPath.get("/loan-limits/"), font);
    expect(hub).toContain('value="Alameda County, CA"');
    expect(hub).not.toContain("data-state=");
    expect(renderPage(byPath.get("/loan-limits/texas/"), font)).toContain('value="Harris County, TX"');
    expect(renderPage(byPath.get("/loan-limits/texas/"), font)).toContain('data-state="TX"');
    const king = renderPage(byPath.get("/loan-limits/washington/king-county/"), font);
    expect(king).toContain('value="King County, WA"');
    expect(king).toContain('<strong data-out="limit">$1,063,750</strong>');
    expect(king).toContain('href="https://blueprint.realstack.app/?st=WA&amp;county=King&amp;src=seo-ll"');
  });

  it("pre-renders the default example: $1.25M with 20% down", () => {
    const html = renderPage(byPath.get("/loan-limits/california/alameda-county/"), font);
    expect(html).toContain('<strong class="ll-kind" data-out="kind">High-balance</strong>');
    expect(html).toContain('<span data-out="loan">$1,000,000</span>');
    expect(html).toContain('<b data-out="high">$832,751 to $1,249,125</b>');
    expect(html).toContain('<b data-out="mindown">$875 (0.1%)</b>');
    const tx = renderPage(byPath.get("/loan-limits/texas/"), font);
    expect(tx).toContain('<strong class="ll-kind" data-out="kind">Jumbo</strong>');
    expect(tx).toContain('<div data-band="high" class="off">');
    expect(tx).toContain('<b data-out="mindown">$417,250 (33.4%)</b>');
  });

  it("classifies a loan against the standard limit and the county limit", async () => {
    const { computeLoan, formatLoan } = await import("./ll-calc.client.js");
    const alameda = { std: 832750, limit: 1249125 };
    expect(computeLoan({ price: 1000000, downPct: 20, ...alameda }).kind).toBe("standard");
    expect(computeLoan({ price: 1040937.5, downPct: 20, ...alameda }).kind).toBe("standard"); // loan rounds to $832,750
    expect(computeLoan({ price: 1100000, downPct: 20, ...alameda }).kind).toBe("high");
    expect(computeLoan({ price: 2000000, downPct: 20, ...alameda })).toMatchObject({ loan: 1600000, kind: "jumbo", minDown: 750875 });
    expect(formatLoan(computeLoan({ price: 800000, downPct: 3, ...alameda })).mindown).toBe("any amount");
    // Hawaii: the standard limit is the HERA baseline, so Honolulu has no high-balance band.
    const hon = computeLoan({ price: 1500000, downPct: 10, std: 1249125, limit: 1249125 });
    expect(hon.kind).toBe("jumbo");
    expect(formatLoan(hon).high).toBe("none here");
    expect(computeLoan({ price: Number.NaN, downPct: 20, ...alameda })).toMatchObject({ loan: 0, kind: "standard" });
  });

  it("ships every FHFA county to the checker, each with a map shape outside the small territories", async () => {
    const { expandLimitData } = await import("./ll-calc.client.js");
    const geo = JSON.parse(readFileSync(new URL("./ll-map-geo.json", import.meta.url), "utf8"));
    const shapes = new Set(geo.counties.map((c) => c.fips));
    const data = expandLimitData(JSON.parse(JSON.stringify(site.llData)));
    expect(data.counties).toHaveLength(3235);
    for (const c of data.counties) {
      expect(shapes.has(c.fips), c.name).toBe(!["AS", "GU", "MP", "VI"].includes(c.st));
      // The app pre-fills a county only where Christo is licensed.
      const licensed = Object.keys(LICENSED_COUNTIES).includes(c.st);
      expect(c.app, c.name).toBe(licensed ? prefillLink({ st: c.st, county: c.name.replace(/ County$/, ""), src: "seo-ll" }) : "https://blueprint.realstack.app/");
      expect(c.limits, c.name).toEqual([1, 2, 3, 4].map((u) => getCountyLimits(c.st, c.name, u).highBalance));
      expect(c.std, c.name).toEqual([1, 2, 3, 4].map((u) => getCountyLimits(c.st, c.name, u).conforming));
      expect(c.path === "/loan-limits/" || byPath.has(c.path.replace(/#.*$/, "")), c.path).toBe(true);
    }
    expect(geo.states).toHaveLength(52); // 50 states, DC and Puerto Rico
    expect(geo.insets.map((i) => i.st)).toEqual(["AK", "HI", "PR"]);
  });

  it("finds counties by name, narrowed by a trailing state", async () => {
    const { searchCounties, expandLimitData } = await import("./ll-calc.client.js");
    const all = expandLimitData(JSON.parse(JSON.stringify(site.llData))).counties;
    const find = (q) => searchCounties(all, q).map((c) => `${c.name}, ${c.st}`);
    expect(find("king wa")).toEqual(["King County, WA"]);
    expect(find("king")).toEqual(expect.arrayContaining(["King County, TX", "King County, WA", "Kings County, CA"]));
    expect(find("harris texas")[0]).toBe("Harris County, TX");
    expect(find("orange county ca")).toEqual(["Orange County, CA"]);
    expect(find("hawaii").slice(0, 1)).toEqual(["Hawaii County, HI"]);
    expect(find("zzzz")).toEqual([]);
  });

  it("shades by the limit's multiple of the baseline", async () => {
    const { bucketOf } = await import("./ll-map.client.js");
    expect(bucketOf(832750, 832750)).toBe(0);
    expect(bucketOf(862500, 832750)).toBe(1);
    expect(bucketOf(1104000, 832750)).toBe(2);
    expect(bucketOf(1209750, 832750)).toBe(3);
    expect(bucketOf(1249125, 832750)).toBe(4);
    expect(bucketOf(1299500, 832750)).toBe(4);
    expect(bucketOf(1933200, 1288800)).toBe(4); // 3 units at the ceiling
  });
});

describe("live commas", () => {
  it("groups digits as you type and keeps the caret after the same digit", async () => {
    const { groupDigits } = await import("./num-input.js");
    expect(groupDigits("1234", 4)).toEqual({ text: "1,234", caret: 5 });
    expect(groupDigits("12345", 5)).toEqual({ text: "12,345", caret: 6 });
    expect(groupDigits("123,4567", 8)).toEqual({ text: "1,234,567", caret: 9 });
    expect(groupDigits("1,2345,678", 6)).toEqual({ text: "12,345,678", caret: 6 }); // typed mid-number
    expect(groupDigits("$9a9", 4)).toEqual({ text: "99", caret: 2 });
    expect(groupDigits("", 0)).toEqual({ text: "", caret: 0 });
    expect(groupDigits("0012", 4)).toEqual({ text: "12", caret: 2 });
  });
});

describe("national loan-limit pages", () => {
  const font = { fontHref: "/fonts/fonts.css" };
  it("covers every state, with honest wording for single areas and HERA states", () => {
    const dc = byPath.get("/loan-limits/district-of-columbia/");
    expect(dc.title).toMatch(/^District of Columbia 2026 Conforming Loan Limit — /);
    expect(dc.lead).toBe("District of Columbia is a single loan limit area. Its 2026 one-unit conforming loan limit is $1,249,125, the FHFA high-cost ceiling. Loans above that amount are jumbo loans.");
    expect([...byPath.keys()].some((k) => k.startsWith("/loan-limits/district-of-columbia/") && k !== "/loan-limits/district-of-columbia/")).toBe(false);
    expect(byPath.get("/loan-limits/alaska/").lead).toMatch(/^Every one of Alaska's 30 boroughs and census areas has a 2026 one-unit conforming loan limit of at least \$1,249,125/);
    expect(byPath.get("/loan-limits/louisiana/").lead).toContain("parishes");
    expect(byPath.get("/loan-limits/new-york/kings-county/").lead).toContain("$1,209,750");
    expect(byPath.get("/loan-limits/").title).toBe("2026 Conforming Loan Limits by State and County — Mortgage Blueprint, powered by RealStack");
  });

  it("only pre-fills the app where Christo is licensed", () => {
    const ny = renderPage(byPath.get("/loan-limits/new-york/"), font);
    expect(ny).toContain('<a class="pill hub-bill" data-cta href="https://blueprint.realstack.app/">Run your numbers in Mortgage Blueprint</a>');
    expect(ny).toContain('value="Kings County, NY"');
    const tx = renderPage(byPath.get("/loan-limits/texas/"), font);
    expect(tx).toContain("?st=TX&amp;county=Harris&amp;src=seo-ll");
  });
});

describe("link previews", () => {
  it("shares a short title and the Plaid card for its page family", () => {
    const font = { fontHref: "/fonts/fonts.css" };
    const hub = renderPage(byPath.get("/property-tax/california/"), font);
    expect(hub).toContain('<meta property="og:title" content="California Property Tax Calculator" />');
    expect(hub).toContain('<meta property="og:image" content="https://blueprint.realstack.app/og-ca-tax.png" />');
    expect(hub).toContain("<title>California Property Tax Rates by City and County — Mortgage Blueprint, powered by RealStack</title>");
    expect(renderPage(byPath.get("/property-tax/california/fremont/"), font)).toContain('<meta property="og:title" content="Fremont, CA Property Tax Calculator" />');
    const ll = renderPage(byPath.get("/loan-limits/texas/"), font);
    expect(ll).toContain('<meta property="og:title" content="Texas 2026 Loan Limits by County" />');
    expect(ll).toContain('<meta name="twitter:image" content="https://blueprint.realstack.app/og-loan-limits.png" />');
    for (const f of ["og-ca-tax.png", "og-loan-limits.png"]) expect(readFileSync(new URL(`../../public/${f}`, import.meta.url)).length).toBeGreaterThan(50000);
  });
});
