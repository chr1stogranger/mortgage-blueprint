import { describe, it, expect } from "vitest";
import { STATE_PROPERTY_TAX_RATES, getAutoTaxRate } from "./propertyTax.js";
import { CA_CITY_TAX_RATES, NV_CITY_TAX_RATES } from "../citiesData.js";

describe("getAutoTaxRate", () => {
  it("uses the state average outside CA/NV", () => {
    expect(getAutoTaxRate("Texas")).toBe(0.0168);
    expect(getAutoTaxRate("District of Columbia")).toBe(0.0056);
  });
  it("uses the CA city rate, 1.2% when the city is unknown", () => {
    expect(getAutoTaxRate("California", "Oakland")).toBe(CA_CITY_TAX_RATES.Oakland);
    expect(getAutoTaxRate("California", "Nowhere")).toBe(0.012);
  });
  it("uses the NV city rate, then the NV average", () => {
    const [city, rate] = Object.entries(NV_CITY_TAX_RATES)[0];
    expect(getAutoTaxRate("Nevada", city)).toBe(rate);
    expect(getAutoTaxRate("Nevada", "Nowhere")).toBe(STATE_PROPERTY_TAX_RATES.Nevada);
  });
  it("falls back to 1.02% for an unknown state", () => {
    expect(getAutoTaxRate("Atlantis")).toBe(0.0102);
  });
});
