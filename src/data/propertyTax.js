// src/data/propertyTax.js
//
// Average effective property-tax rates and the auto-rate resolver, moved out
// of MortgageBlueprint.jsx so the app and the MCP server (api/mcp.js) price
// property tax identically. Pure data + one pure function; no browser APIs.

import { CA_CITY_TAX_RATES, NV_CITY_TAX_RATES } from "../citiesData.js";

/** Average effective property tax rates by state (2024/2025 data — actual taxes paid as % of home value). California is city-level (null here). */
export const STATE_PROPERTY_TAX_RATES = {
 "Alabama": 0.0040, "Alaska": 0.0118, "Arizona": 0.0062, "Arkansas": 0.0061,
 "California": null, "Colorado": 0.0051, "Connecticut": 0.0215, "Delaware": 0.0057,
 "District of Columbia": 0.0056, "Florida": 0.0086, "Georgia": 0.0090, "Hawaii": 0.0029,
 "Idaho": 0.0063, "Illinois": 0.0214, "Indiana": 0.0085, "Iowa": 0.0153,
 "Kansas": 0.0141, "Kentucky": 0.0086, "Louisiana": 0.0055, "Maine": 0.0136,
 "Maryland": 0.0107, "Massachusetts": 0.0123, "Michigan": 0.0154, "Minnesota": 0.0113,
 "Mississippi": 0.0065, "Missouri": 0.0097, "Montana": 0.0083, "Nebraska": 0.0173,
 "Nevada": 0.0053, "New Hampshire": 0.0218, "New Jersey": 0.0223, "New Mexico": 0.0067,
 "New York": 0.0172, "North Carolina": 0.0082, "North Dakota": 0.0098, "Ohio": 0.0157,
 "Oklahoma": 0.0087, "Oregon": 0.0097, "Pennsylvania": 0.0153, "Rhode Island": 0.0163,
 "South Carolina": 0.0057, "South Dakota": 0.0128, "Tennessee": 0.0066, "Texas": 0.0168,
 "Utah": 0.0058, "Vermont": 0.0188, "Virginia": 0.0082, "Washington": 0.0092,
 "West Virginia": 0.0058, "Wisconsin": 0.0178, "Wyoming": 0.0057,
};

/**
 * Auto property-tax rate resolver: CA → city TRA rate (FY 2025-26 rate books);
 * NV → city effective rate (FY 2025-26 Redbook × 35% assessment ratio);
 * all other states → state-average rate.
 * @param {string} st full state name ("Texas")
 * @param {string} [ct] city name
 * @returns {number} annual tax as a fraction of price (e.g. 0.0168)
 */
export const getAutoTaxRate = (st, ct) =>
 st === "California" ? (CA_CITY_TAX_RATES[ct] || 0.012)
 : st === "Nevada" ? (NV_CITY_TAX_RATES[ct] || STATE_PROPERTY_TAX_RATES["Nevada"] || 0.0102)
 : (STATE_PROPERTY_TAX_RATES[st] || 0.0102);
