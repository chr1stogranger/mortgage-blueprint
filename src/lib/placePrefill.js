// ── SEO data-page deep link (?st=<USPS>&county=<name>[&city=<name>]&src=<seo-…>) ──
//
// The static loan-limit and CA property-tax pages (scripts/seo-data-pages.mjs)
// link here pre-filled for their place: "Run your numbers for Alameda County",
// "See Fremont's taxes in your payment". Unlike ?listing= / ?plan= there is no
// token and no fetch: the query string IS the plan, so every value is
// validated against the same data the pages were built from. Anything invalid
// opens Blueprint as usual (no Note, no scenario). scripts/seo-data/model.js's
// prefillLink() builds these URLs; readPlaceParams is its inverse.
//
// Pure, like listingPrefill.js: lookup tables come in through deps.

import { listingToPrefill } from "./listingPrefill.js";
import { normalizeCounty } from "../data/loanLimits.js";
import { LICENSED_COUNTIES } from "../data/licensedCounties.js";
import { CA_CITY_COUNTY } from "../data/caCityCounty.js";

export const PLACE_SOURCES = ["seo-ll", "seo-ptax"];
export const PLACE_PARAMS = ["st", "county", "city", "src"];

/**
 * Read + validate the place from a query string.
 * @returns {{ state: string, county: string, countyName: string, city: string, src: string|null } | null}
 *   state = USPS code, county = the app's propertyCounty form ("Alameda"),
 *   countyName = FHFA's full name ("Alameda County"), city = "" when absent.
 */
export function readPlaceParams(search) {
 let q;
 try { q = new URLSearchParams(search || ""); } catch { return null; }
 const rawSt = q.get("st");
 if (!rawSt) return null;
 const st = rawSt.trim().toUpperCase();
 const counties = Object.prototype.hasOwnProperty.call(LICENSED_COUNTIES, st) ? LICENSED_COUNTIES[st] : null;
 if (!counties) return null;
 const key = normalizeCounty(q.get("county"));
 const hit = key ? counties.find((c) => normalizeCounty(c.name) === key) : null;
 if (!hit) return null;
 let city = "";
 const rawCity = (q.get("city") || "").trim();
 if (rawCity) {
  if (st !== "CA") return null;
  city = Object.keys(CA_CITY_COUNTY).find((c) => c.toLowerCase() === rawCity.toLowerCase()) || "";
  if (!city || normalizeCounty(CA_CITY_COUNTY[city]) !== key) return null;
 }
 const rawSrc = q.get("src");
 if (rawSrc && !PLACE_SOURCES.includes(rawSrc)) return null;
 return { state: st, county: hit.name.replace(/ County$/, ""), countyName: hit.name, city, src: rawSrc || null };
}

/**
 * Map a place to Blueprint state keys: state/city/tax rate via listingToPrefill,
 * then the county. A county-only link clears the city, so the blank state's
 * default city can't sit in the wrong county.
 * @param {object} p  readPlaceParams() result
 * @param {object} deps  same as listingToPrefill (lookupZip, cityNames, stateMap, getAutoTaxRate)
 */
export function placeToPrefill(p, deps) {
 const pf = listingToPrefill({ state: p.state, city: p.city }, deps);
 pf.city = p.city || "";
 pf.propertyCounty = p.county;
 return pf;
}

/** "Fremont, CA" | "Alameda County, CA" — also the local scenario name, reused on a repeat visit. */
export const placeScenarioName = (p) => `${p.city || p.countyName}, ${p.state}`;

/** The Note under the scenario. */
export function placeNoteText(p) {
 if (p.city) {
  const own = p.city.endsWith("s") ? `${p.city}'` : `${p.city}'s`;
  return `Set up for ${p.city}, ${p.state}. Add a price to see your payment with ${own} property tax.`;
 }
 return `Set up for ${p.countyName}, ${p.state}. Add a price to see your payment against the county's loan limit.`;
}
