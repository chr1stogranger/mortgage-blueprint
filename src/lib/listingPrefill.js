// ── Buydown-flyer listing deep link (?listing=<token>) ──
//
// A flyer QR code points at blueprint.realstack.app/?listing=<token>. Ops
// serves the listing as public JSON (GET /api/listing?t=<token>); this module
// turns that payload into a PARTIAL Blueprint state. The caller layers it onto
// blankStateRef (never onto live state) so a previous scenario's numbers can't
// leak into the listing.
//
// Pure: every lookup table is passed in, so this file has no React and no
// MortgageBlueprint imports and can be unit-tested on its own.

export const LISTING_TOKEN_RE = /^[A-Za-z0-9_-]{8,40}$/;

// Read + validate the token from a query string. Anything that doesn't look
// like a token is ignored (no fetch, no banner).
export function readListingToken(search) {
 try {
  const t = new URLSearchParams(search || "").get("listing");
  return t && LISTING_TOKEN_RE.test(t) ? t : null;
 } catch { return null; }
}

const num = (v) => {
 if (v === null || v === undefined || v === "") return null;
 const n = typeof v === "number" ? v : Number(String(v).replace(/[$,%\s]/g, ""));
 return Number.isFinite(n) ? n : null;
};
const str = (v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

// Blueprint's PROP_TYPES are "Single Family" | "Single Family with ADU" |
// "Condo" | "Townhouse" | "2-Unit" | "3-Unit" | "4-Unit".
//  · "PUD" → Single Family: a PUD is a zoning/HOA structure, most often a
//    detached home in CA; Blueprint has no PUD type.
//  · "2-4 Unit" → 2-Unit: the payload doesn't say how many units, and 2 is the
//    conservative loan-limit choice. (Ops could send "3-Unit"/"4-Unit" directly.)
const PROP_TYPE_MAP = {
 "single family": "Single Family", "sfr": "Single Family", "single family residence": "Single Family",
 "single family with adu": "Single Family with ADU",
 "condo": "Condo", "condominium": "Condo",
 "townhouse": "Townhouse", "townhome": "Townhouse",
 "pud": "Single Family",
 "2-4 unit": "2-Unit", "2-unit": "2-Unit", "duplex": "2-Unit",
 "3-unit": "3-Unit", "triplex": "3-Unit",
 "4-unit": "4-Unit", "fourplex": "4-Unit", "4-plex": "4-Unit",
};
const LOAN_TYPE_MAP = { conventional: "Conventional", fha: "FHA", va: "VA", usda: "USDA", jumbo: "Jumbo" };
export const BUYDOWN_TYPES = ["none", "1-0", "1-1", "2-1", "3-2-1"];
const PAID_BY = ["seller", "lender", "borrower"];

/**
 * Map an Ops /api/listing payload to Blueprint state keys.
 * @param {object} d  listing payload (any field may be null/missing)
 * @param {object} deps
 * @param {(zip:string)=>({city,county,state}|null)} deps.lookupZip  ZIP_DATA lookup
 * @param {string[]} deps.cityNames   CA city names (tax-table keys)
 * @param {Record<string,string>} deps.stateMap  "CA" → "California"
 * @param {(state:string, city:string)=>number} deps.getAutoTaxRate  decimal rate
 * @returns {object} partial Blueprint state
 */
export function listingToPrefill(d, { lookupZip, cityNames = [], stateMap = {}, getAutoTaxRate } = {}) {
 const p = { loanPurpose: "Purchase Primary", isRefi: false };
 if (!d || typeof d !== "object") return p;

 const price = num(d.price);
 if (price && price > 0) p.salesPrice = Math.round(price);
 const down = num(d.downPct);
 if (down !== null && down >= 0 && down <= 100) p.downPct = down;
 const rate = num(d.noteRate);
 // loadState treats a present `rate` as manual, so live rates won't overwrite
 // the flyer's note rate. Absent → blank default (6.5, also manual) — see the
 // caller, which drops it so live rates can fill in.
 if (rate && rate > 0 && rate < 20) p.rate = rate;
 const term = num(d.term);
 if (term && Number.isInteger(term) && term >= 5 && term <= 30) p.term = term;

 const lt = LOAN_TYPE_MAP[str(d.loanType).toLowerCase()];
 if (lt) {
  p.loanType = lt;
  if (lt === "VA") p.vaUsage = "First Use";
 }

 const bd = str(d.buydown).toLowerCase();
 p.buydownType = BUYDOWN_TYPES.includes(bd) ? bd : "none";
 const paidBy = str(d.buydownPaidBy).toLowerCase();
 p.buydownPaidBy = PAID_BY.includes(paidBy) ? paidBy : "seller";

 const fico = num(d.creditScore);
 if (fico && fico >= 300 && fico <= 850) p.creditScore = Math.round(fico);
 const hoa = num(d.hoaMonthly);
 if (hoa !== null && hoa >= 0) p.hoa = Math.round(hoa); // Blueprint hoa is MONTHLY
 const ins = num(d.insMonthly);
 if (ins !== null && ins >= 0) p.annualIns = Math.round(ins * 12); // Blueprint stores ANNUAL insurance

 const pt = PROP_TYPE_MAP[str(d.propertyType).toLowerCase()];
 if (pt) p.propType = pt;

 // ── Location ──
 // ZIP wins: Blueprint's tax/transfer-tax/loan-limit tables are keyed to the
 // ZIP_DATA city/county, exactly like the address picker (whose ZIP effect
 // overwrites the geocoder's city). Seed county here too — if the previous
 // scenario had the same ZIP, the ZIP effect won't re-fire to fill it.
 const zip = str(d.zip).replace(/[^0-9]/g, "").slice(0, 5);
 const z = zip.length === 5 && lookupZip ? lookupZip(zip) : null;
 const rawState = str(d.state);
 const fullState = stateMap[rawState.toUpperCase()] || (Object.values(stateMap).includes(rawState) ? rawState : "");
 const state = z?.state || fullState;
 const rawCity = str(d.city);
 const cityMatch = cityNames.find((c) => c.toLowerCase() === rawCity.toLowerCase());
 const city = z?.city || cityMatch || rawCity;
 if (zip.length === 5) p.propertyZip = zip;
 if (state) p.propertyState = state;
 if (city) p.city = city;
 p.propertyCounty = z?.county || "";

 const full = str(d.address);
 const street = str(d.street) || (full ? full.split(",")[0].trim() : "");
 if (street || full) {
  p.propertyAddress = street || full;
  p.addressInput = full || [street, city, [rawState || state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  p.addressMode = "address";
  p.propertyTBD = false;
 }

 // ── Property tax ──
 // Override → unlock and pin the rate (percent, like taxBaseRateOverride).
 // Otherwise stay locked to the auto city/state rate, seeded explicitly: the
 // lock effect only re-fires on a city/state CHANGE.
 const taxOv = num(d.taxRateOverridePct);
 if (taxOv && taxOv > 0 && taxOv < 10) {
  p.taxRateLocked = false;
  p.taxBaseRateOverride = taxOv;
 } else {
  p.taxRateLocked = true;
  if (getAutoTaxRate && p.propertyState) {
   p.taxBaseRateOverride = parseFloat((getAutoTaxRate(p.propertyState, p.city || "") * 100).toFixed(4));
  }
 }

 const realtorName = str(d.realtor?.name);
 if (realtorName) p.realtorName = realtorName;
 return p;
}

// Local scenario name for the listing — the street, else a generic label.
// Reopening the same flyer reuses (overwrites) the same local scenario rather
// than piling up copies.
export function listingScenarioName(d) {
 const s = str(d?.street) || str(d?.address).split(",")[0].trim();
 return (s || "Listing").slice(0, 60);
}
