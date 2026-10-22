import { describe, it, expect } from "vitest";
import { readPlaceParams, placeToPrefill, placeScenarioName, placeNoteText } from "./placePrefill.js";
import { prefillLink } from "../../scripts/seo-data/model.js";

const deps = {
  lookupZip: () => null,
  cityNames: ["Alameda", "Fremont", "Walnut Creek", "San Francisco"],
  stateMap: { CA: "California", TX: "Texas", HI: "Hawaii", NV: "Nevada" },
  getAutoTaxRate: (st, ct) => (st === "Texas" ? 0.0168 : ct === "Fremont" ? 0.011741 : 0.012),
};

describe("readPlaceParams", () => {
  it("is the exact inverse of the SEO pages' prefillLink", () => {
    for (const input of [
      { st: "CA", county: "Alameda", src: "seo-ll" },
      { st: "CA", county: "Alameda", city: "Fremont", src: "seo-ptax" },
      { st: "CA", county: "Contra Costa", city: "Walnut Creek", src: "seo-ptax" },
      { st: "HI", county: "Honolulu", src: "seo-ll" },
    ]) {
      const p = readPlaceParams(new URL(prefillLink(input)).search);
      expect(p).toMatchObject({ state: input.st, county: input.county, city: input.city || "", src: input.src });
    }
  });

  it("accepts case and suffix variants of the county", () => {
    expect(readPlaceParams("?st=ca&county=alameda%20county")).toMatchObject({ state: "CA", county: "Alameda", countyName: "Alameda County", city: "", src: null });
    expect(readPlaceParams("?st=NV&county=Carson+City")).toMatchObject({ county: "Carson City", countyName: "Carson City" });
  });

  it("rejects anything outside the data", () => {
    expect(readPlaceParams("")).toBeNull();
    expect(readPlaceParams("?listing=abc")).toBeNull();
    expect(readPlaceParams("?st=FL&county=Dade")).toBeNull();             // not a licensed state
    expect(readPlaceParams("?st=CA&county=Dade")).toBeNull();             // not a CA county
    expect(readPlaceParams("?st=CA")).toBeNull();                         // county required
    expect(readPlaceParams("?st=CA&county=Alameda&city=Irvine")).toBeNull();   // placeholder-rate city
    expect(readPlaceParams("?st=CA&county=Napa&city=Fremont")).toBeNull();     // city in another county
    expect(readPlaceParams("?st=TX&county=Travis&city=Austin")).toBeNull();    // city only for CA
    expect(readPlaceParams("?st=CA&county=Alameda&src=evil")).toBeNull();      // unknown source
    expect(readPlaceParams("?st=constructor&county=Alameda")).toBeNull();
  });
});

describe("placeToPrefill", () => {
  it("city link: state, county, city and the city's rate, locked", () => {
    const p = placeToPrefill(readPlaceParams("?st=CA&county=Alameda&city=Fremont&src=seo-ptax"), deps);
    expect(p).toMatchObject({ propertyState: "California", propertyCounty: "Alameda", city: "Fremont", taxRateLocked: true, taxBaseRateOverride: 1.1741, loanPurpose: "Purchase Primary" });
    expect(p.salesPrice).toBeUndefined();
  });

  it("county link clears the city so the default can't land in the wrong county", () => {
    const p = placeToPrefill(readPlaceParams("?st=TX&county=Travis&src=seo-ll"), deps);
    expect(p).toMatchObject({ propertyState: "Texas", propertyCounty: "Travis", city: "", taxBaseRateOverride: 1.68 });
  });
});

describe("names and copy", () => {
  it("scenario name and Note", () => {
    const city = readPlaceParams("?st=CA&county=Alameda&city=Fremont");
    const county = readPlaceParams("?st=CA&county=Alameda");
    expect(placeScenarioName(city)).toBe("Fremont, CA");
    expect(placeScenarioName(county)).toBe("Alameda County, CA");
    expect(placeNoteText(city)).toBe("Set up for Fremont, CA. Add a price to see your payment with Fremont's property tax.");
    expect(placeNoteText(readPlaceParams("?st=CA&county=Santa+Clara&city=Los+Gatos"))).toContain("Los Gatos' property tax");
  });
});
