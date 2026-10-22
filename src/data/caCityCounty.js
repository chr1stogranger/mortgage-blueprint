// Sourced CA city -> county, derived from the county blocks in caTaxRates.js
// (the published rate-book entries). Cities in citiesData.js's 1.25%
// placeholder block are deliberately absent: those rates are not sourced.

import { CA_CITY_TAX_INFO } from "./caTaxRates.js";

/** Sourced CA city -> county (FHFA county name without "County"). */
export const CA_CITY_COUNTY = Object.fromEntries(
  Object.entries(CA_CITY_TAX_INFO).map(([city, x]) => [city, x.county]),
);
