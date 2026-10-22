// Paths of the static SEO pages (scripts/seo-data-pages.mjs), shared by the
// generator and the app so an in-app link can never point at a page the build
// didn't make. Absolute URLs use the production origin: in the native app
// (Capacitor serves from https://localhost) a relative link would be dead.

import { CA_CITY_COUNTY } from "../data/caCityCounty.js";

export const SEO_ORIGIN = "https://blueprint.realstack.app";
export const CA_TAX_HUB_PATH = "/property-tax/california/";

/** "St. Helena" -> "st-helena", "Alameda County" -> "alameda-county". */
export function slugify(s) {
 return String(s)
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/['’.]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export const caCityTaxPath = (city) => `${CA_TAX_HUB_PATH}${slugify(city)}/`;
export const caCountyTaxPath = (county) => `${CA_TAX_HUB_PATH}${slugify(county)}-county/`;

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const PAGE_COUNTIES = new Set(Object.values(CA_CITY_COUNTY));

/** Absolute URL of a sourced city's page, or null (no page is generated for it). */
export const caCityTaxUrl = (city) => (city && has(CA_CITY_COUNTY, city) ? SEO_ORIGIN + caCityTaxPath(city) : null);
/** Absolute URL of a county's tax page ("Alameda"), or null when it has no sourced cities. */
export const caCountyTaxUrl = (county) => (PAGE_COUNTIES.has(county) ? SEO_ORIGIN + caCountyTaxPath(county) : null);
export const CA_TAX_HUB_URL = SEO_ORIGIN + CA_TAX_HUB_PATH;
