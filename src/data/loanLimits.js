/**
 * FHFA conforming loan limit values — Calendar Year 2027.
 *
 * SOURCE OF RECORD (downloaded and parsed 2026-11-24 by scripts/gen-loan-limits.mjs):
 *   https://www.fhfa.gov/document/d/cll/fullcountyloanlimitlist2027_hera-based_final_flat.xlsx
 *   ("Fannie Mae and Freddie Mac Conforming Loan Limits for Mortgages Acquired
 *    in Calendar Year 2027", HERA-based final, flat file — 3,235 county rows)
 * Cross-checked after generation: getCountyLimits() returns FHFA's value for all
 * 3,235 rows x 4 unit counts (12,940/12,940 exact).
 * Announcement: "FHFA Announces Conforming Loan Limit for 2027",
 *   published 2026-11-24 —
 *   https://www.fhfa.gov/news/news-release/fhfa-announces-conforming-loan-limit-for-2027
 * Effective for mortgages acquired by Fannie Mae / Freddie Mac in calendar year 2027.
 *
 * No value in this file is estimated, interpolated, or recalled — every number below
 * was read out of the FHFA file named above.
 *
 * Structure notes:
 *  - COUNTY_LIMITS holds ONLY areas whose limit differs from the applicable baseline.
 *    The ~3,075 counties that sit at the national baseline are intentionally absent;
 *    getCountyLimits() falls back to CONF_BASELINE.
 *  - Alaska, Hawaii, Guam and the U.S. Virgin Islands have a statutory baseline equal
 *    to the national ceiling (HERA), so they are expressed as STATE_BASELINE rather
 *    than ~39 identical county rows. Within those states only Maui County and
 *    Kalawao County HI exceed it, and they appear in COUNTY_LIMITS.
 *  - Connecticut: FHFA publishes CT by COUNCIL OF GOVERNMENTS PLANNING REGION, not by
 *    legacy county. Legacy CT county names (Fairfield, Hartford, New Haven, ...) are
 *    NOT keys here and will fall back to the baseline, because a legacy county maps to
 *    more than one planning region with DIFFERENT limits (e.g. legacy Fairfield County
 *    spans Greater Bridgeport $1,023,500, Western Connecticut $1,023,500 and Naugatuck
 *    Valley $855,400 in 2027). Resolving that requires the subject town, not the county.
 */

export const LIMIT_YEAR = 2027;

/** National baseline conforming loan limit values, by unit count. */
export const CONF_BASELINE = { 1: 855400, 2: 1095250, 3: 1323900, 4: 1645350 };

/** Statutory ceiling (150% of baseline) — the high-cost-area maximum. */
export const CONF_CEILING = { 1: 1283100, 2: 1642875, 3: 1985850, 4: 2468025 };

/**
 * HERA special-statutory areas: baseline equals the national ceiling.
 * Values verified identical for all 30 Alaska boroughs/census areas, Guam, and all
 * three U.S. Virgin Islands districts; in Hawaii it is the floor (Maui and Kalawao
 * are higher — see COUNTY_LIMITS).
 */
export const STATE_BASELINE = {
  AK: [1283100, 1642875, 1985850, 2468025],
  HI: [1283100, 1642875, 1985850, 2468025],
  GU: [1283100, 1642875, 1985850, 2468025],
  VI: [1283100, 1642875, 1985850, 2468025],
};

// Distinct limit tiers present in the 2027 file, keyed by their one-unit value.
// [one-unit, two-unit, three-unit, four-unit]
const T = {
  862500: [862500, 1104150, 1334700, 1658700],
  885500: [885500, 1133600, 1370250, 1702900],
  897000: [897000, 1148350, 1388050, 1725050],
  931500: [931500, 1192500, 1441450, 1791400],
  977500: [977500, 1251400, 1512650, 1879850],
  994750: [994750, 1273450, 1539350, 1913000],
  997050: [997050, 1276400, 1542900, 1917450],
  1006250: [1006250, 1288200, 1557150, 1935150],
  1017750: [1017750, 1302900, 1574900, 1957250],
  1023500: [1023500, 1310300, 1583800, 1968300],
  1035000: [1035000, 1325000, 1601600, 1990450],
  1043050: [1043050, 1335300, 1614100, 2005900],
  1063750: [1063750, 1361800, 1646100, 2045700],
  1086750: [1086750, 1391250, 1681700, 2089950],
  1143100: [1143100, 1463400, 1768900, 2198300],
  1209750: [1209750, 1548975, 1872225, 2326875],
  1224750: [1224750, 1567900, 1895250, 2355350],
  1268450: [1268450, 1623850, 1962900, 2439400],
  1283100: [1283100, 1642875, 1985850, 2468025],
  1299500: [1299500, 1663600, 2010950, 2499100],
};

/**
 * Areas whose 2027 limit differs from the applicable baseline.
 * Key = "<USPS state>|<normalized area name>" (see normalizeCounty below:
 * uppercase, punctuation-stripped, generic suffix such as COUNTY/PARISH/BOROUGH/
 * CENSUS AREA/MUNICIPALITY/CITY/PLANNING REGION removed).
 */
export const COUNTY_LIMITS = {
  // CA
  "CA|ALAMEDA": T[1283100],  // ALAMEDA COUNTY
  "CA|CONTRA COSTA": T[1283100],  // CONTRA COSTA COUNTY
  "CA|LOS ANGELES": T[1283100],  // LOS ANGELES COUNTY
  "CA|MARIN": T[1283100],  // MARIN COUNTY
  "CA|MONTEREY": T[1006250],  // MONTEREY COUNTY
  "CA|NAPA": T[1017750],  // NAPA COUNTY
  "CA|ORANGE": T[1283100],  // ORANGE COUNTY
  "CA|SAN BENITO": T[1283100],  // SAN BENITO COUNTY
  "CA|SAN DIEGO": T[1143100],  // SAN DIEGO COUNTY
  "CA|SAN FRANCISCO": T[1283100],  // SAN FRANCISCO COUNTY
  "CA|SAN LUIS OBISPO": T[1023500],  // SAN LUIS OBISPO COUNTY
  "CA|SAN MATEO": T[1283100],  // SAN MATEO COUNTY
  "CA|SANTA BARBARA": T[1063750],  // SANTA BARBARA COUNTY
  "CA|SANTA CLARA": T[1283100],  // SANTA CLARA COUNTY
  "CA|SANTA CRUZ": T[1283100],  // SANTA CRUZ COUNTY
  "CA|SONOMA": T[897000],  // SONOMA COUNTY
  "CA|VENTURA": T[1043050],  // VENTURA COUNTY
  // CO
  "CO|ADAMS": T[862500],  // ADAMS COUNTY
  "CO|ARAPAHOE": T[862500],  // ARAPAHOE COUNTY
  "CO|BOULDER": T[885500],  // BOULDER COUNTY
  "CO|BROOMFIELD": T[862500],  // BROOMFIELD COUNTY
  "CO|CLEAR CREEK": T[862500],  // CLEAR CREEK COUNTY
  "CO|DENVER": T[862500],  // DENVER COUNTY
  "CO|DOUGLAS": T[862500],  // DOUGLAS COUNTY
  "CO|EAGLE": T[1283100],  // EAGLE COUNTY
  "CO|ELBERT": T[862500],  // ELBERT COUNTY
  "CO|GARFIELD": T[1209750],  // GARFIELD COUNTY
  "CO|GILPIN": T[862500],  // GILPIN COUNTY
  "CO|GRAND": T[931500],  // GRAND COUNTY
  "CO|JEFFERSON": T[862500],  // JEFFERSON COUNTY
  "CO|LAKE": T[1283100],  // LAKE COUNTY
  "CO|MOFFAT": T[1268450],  // MOFFAT COUNTY
  "CO|PARK": T[862500],  // PARK COUNTY
  "CO|PITKIN": T[1209750],  // PITKIN COUNTY
  "CO|ROUTT": T[1268450],  // ROUTT COUNTY
  "CO|SAN MIGUEL": T[994750],  // SAN MIGUEL COUNTY
  "CO|SUMMIT": T[1283100],  // SUMMIT COUNTY
  // CT
  "CT|GREATER BRIDGEPORT": T[1023500],  // Greater Bridgeport Planning Region
  "CT|WESTERN CONNECTICUT": T[1023500],  // Western Connecticut Planning Region
  // DC
  "DC|DISTRICT OF COLUMBIA": T[1283100],
  // FL
  "FL|MONROE": T[1035000],  // MONROE COUNTY
  // HI
  "HI|KALAWAO": T[1299500],  // KALAWAO COUNTY
  "HI|MAUI": T[1299500],  // MAUI COUNTY
  // ID
  "ID|TETON": T[1283100],  // TETON COUNTY
  // MA
  "MA|BRISTOL": T[897000],  // BRISTOL COUNTY
  "MA|DUKES": T[1283100],  // DUKES COUNTY
  "MA|ESSEX": T[977500],  // ESSEX COUNTY
  "MA|MIDDLESEX": T[977500],  // MIDDLESEX COUNTY
  "MA|NANTUCKET": T[1283100],  // NANTUCKET COUNTY
  "MA|NORFOLK": T[977500],  // NORFOLK COUNTY
  "MA|PLYMOUTH": T[977500],  // PLYMOUTH COUNTY
  "MA|SUFFOLK": T[977500],  // SUFFOLK COUNTY
  // MD
  "MD|CALVERT": T[1209750],  // CALVERT COUNTY
  "MD|CHARLES": T[1283100],  // CHARLES COUNTY
  "MD|FREDERICK": T[1283100],  // FREDERICK COUNTY
  "MD|MONTGOMERY": T[1283100],  // MONTGOMERY COUNTY
  "MD|PRINCE GEORGES": T[1283100],  // PRINCE GEORGE'S COUNTY
  // NH
  "NH|ROCKINGHAM": T[977500],  // ROCKINGHAM COUNTY
  "NH|STRAFFORD": T[977500],  // STRAFFORD COUNTY
  // NJ
  "NJ|BERGEN": T[1224750],  // BERGEN COUNTY
  "NJ|ESSEX": T[1224750],  // ESSEX COUNTY
  "NJ|HUDSON": T[1224750],  // HUDSON COUNTY
  "NJ|HUNTERDON": T[1224750],  // HUNTERDON COUNTY
  "NJ|MIDDLESEX": T[1224750],  // MIDDLESEX COUNTY
  "NJ|MONMOUTH": T[1224750],  // MONMOUTH COUNTY
  "NJ|MORRIS": T[1224750],  // MORRIS COUNTY
  "NJ|OCEAN": T[1224750],  // OCEAN COUNTY
  "NJ|PASSAIC": T[1224750],  // PASSAIC COUNTY
  "NJ|SOMERSET": T[1224750],  // SOMERSET COUNTY
  "NJ|SUSSEX": T[1224750],  // SUSSEX COUNTY
  "NJ|UNION": T[1224750],  // UNION COUNTY
  // NY
  "NY|BRONX": T[1224750],  // BRONX COUNTY
  "NY|KINGS": T[1224750],  // KINGS COUNTY
  "NY|NASSAU": T[1224750],  // NASSAU COUNTY
  "NY|NEW YORK": T[1224750],  // NEW YORK COUNTY
  "NY|PUTNAM": T[1224750],  // PUTNAM COUNTY
  "NY|QUEENS": T[1224750],  // QUEENS COUNTY
  "NY|RICHMOND": T[1224750],  // RICHMOND COUNTY
  "NY|ROCKLAND": T[1224750],  // ROCKLAND COUNTY
  "NY|SUFFOLK": T[1224750],  // SUFFOLK COUNTY
  "NY|WESTCHESTER": T[1224750],  // WESTCHESTER COUNTY
  // PA
  "PA|PIKE": T[1209750],  // PIKE COUNTY
  // RI
  "RI|BRISTOL": T[897000],  // BRISTOL COUNTY
  "RI|KENT": T[897000],  // KENT COUNTY
  "RI|NEWPORT": T[897000],  // NEWPORT COUNTY
  "RI|PROVIDENCE": T[897000],  // PROVIDENCE COUNTY
  "RI|WASHINGTON": T[897000],  // WASHINGTON COUNTY
  // TN
  "TN|CANNON": T[1086750],  // CANNON COUNTY
  "TN|CHEATHAM": T[1086750],  // CHEATHAM COUNTY
  "TN|DAVIDSON": T[1086750],  // DAVIDSON COUNTY
  "TN|DICKSON": T[1086750],  // DICKSON COUNTY
  "TN|HICKMAN": T[1086750],  // HICKMAN COUNTY
  "TN|MACON": T[1086750],  // MACON COUNTY
  "TN|MAURY": T[1086750],  // MAURY COUNTY
  "TN|ROBERTSON": T[1086750],  // ROBERTSON COUNTY
  "TN|RUTHERFORD": T[1086750],  // RUTHERFORD COUNTY
  "TN|SMITH": T[1086750],  // SMITH COUNTY
  "TN|SUMNER": T[1086750],  // SUMNER COUNTY
  "TN|TROUSDALE": T[1086750],  // TROUSDALE COUNTY
  "TN|WILLIAMSON": T[1086750],  // WILLIAMSON COUNTY
  "TN|WILSON": T[1086750],  // WILSON COUNTY
  // UT
  "UT|SUMMIT": T[1283100],  // SUMMIT COUNTY
  "UT|WASATCH": T[1283100],  // WASATCH COUNTY
  "UT|WAYNE": T[997050],  // WAYNE COUNTY
  // VA
  "VA|ALEXANDRIA": T[1283100],  // ALEXANDRIA CITY
  "VA|ARLINGTON": T[1283100],  // ARLINGTON COUNTY
  "VA|CLARKE": T[1283100],  // CLARKE COUNTY
  "VA|CULPEPER": T[1283100],  // CULPEPER COUNTY
  "VA|FAIRFAX": T[1283100],  // FAIRFAX COUNTY + FAIRFAX CITY
  "VA|FALLS CHURCH": T[1283100],  // FALLS CHURCH CITY
  "VA|FAUQUIER": T[1283100],  // FAUQUIER COUNTY
  "VA|FREDERICKSBURG": T[1283100],  // FREDERICKSBURG CITY
  "VA|LOUDOUN": T[1283100],  // LOUDOUN COUNTY
  "VA|MADISON": T[1209750],  // MADISON COUNTY
  "VA|MANASSAS": T[1283100],  // MANASSAS CITY
  "VA|MANASSAS PARK": T[1283100],  // MANASSAS PARK CITY
  "VA|PRINCE WILLIAM": T[1283100],  // PRINCE WILLIAM COUNTY
  "VA|RAPPAHANNOCK": T[1283100],  // RAPPAHANNOCK COUNTY
  "VA|SPOTSYLVANIA": T[1283100],  // SPOTSYLVANIA COUNTY
  "VA|STAFFORD": T[1283100],  // STAFFORD COUNTY
  "VA|WARREN": T[1283100],  // WARREN COUNTY
  // WA
  "WA|KING": T[1063750],  // KING COUNTY
  "WA|PIERCE": T[1063750],  // PIERCE COUNTY
  "WA|SNOHOMISH": T[1063750],  // SNOHOMISH COUNTY
  // WV
  "WV|JEFFERSON": T[1283100],  // JEFFERSON COUNTY
  // WY
  "WY|TETON": T[1283100],  // TETON COUNTY
};

/** USPS abbreviation for every state / DC / territory FHFA publishes. */
const STATE_ABBR = {
  ALABAMA: "AL", ALASKA: "AK", ARIZONA: "AZ", ARKANSAS: "AR", CALIFORNIA: "CA",
  COLORADO: "CO", CONNECTICUT: "CT", DELAWARE: "DE", FLORIDA: "FL", GEORGIA: "GA",
  HAWAII: "HI", IDAHO: "ID", ILLINOIS: "IL", INDIANA: "IN", IOWA: "IA",
  KANSAS: "KS", KENTUCKY: "KY", LOUISIANA: "LA", MAINE: "ME", MARYLAND: "MD",
  MASSACHUSETTS: "MA", MICHIGAN: "MI", MINNESOTA: "MN", MISSISSIPPI: "MS",
  MISSOURI: "MO", MONTANA: "MT", NEBRASKA: "NE", NEVADA: "NV",
  "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY",
  "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", OHIO: "OH", OKLAHOMA: "OK",
  OREGON: "OR", PENNSYLVANIA: "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC",
  "SOUTH DAKOTA": "SD", TENNESSEE: "TN", TEXAS: "TX", UTAH: "UT", VERMONT: "VT",
  VIRGINIA: "VA", WASHINGTON: "WA", "WEST VIRGINIA": "WV", WISCONSIN: "WI",
  WYOMING: "WY",
  "DISTRICT OF COLUMBIA": "DC", "WASHINGTON DC": "DC", "WASHINGTON D C": "DC",
  "PUERTO RICO": "PR", GUAM: "GU", "U S VIRGIN ISLANDS": "VI",
  "US VIRGIN ISLANDS": "VI", "VIRGIN ISLANDS": "VI",
  "AMERICAN SAMOA": "AS", "NORTHERN MARIANA ISLANDS": "MP",
};
const VALID_ABBR = new Set(Object.values(STATE_ABBR));

/** Generic area-type suffixes stripped so "St. Louis County" === "St Louis". */
const AREA_SUFFIXES = [
  "CITY AND BOROUGH", "CENSUS AREA", "PLANNING REGION", "MUNICIPALITY",
  "MUNICIPIO", "BOROUGH", "PARISH", "COUNTY", "CITY", "ISLAND",
];

/** "Prince George's County" -> "PRINCE GEORGES"; "St. Louis County" -> "ST LOUIS". */
export function normalizeCounty(name) {
  let x = String(name == null ? "" : name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/['\u2018\u2019]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  for (let guard = 0; guard < 4; guard += 1) {
    let hit = false;
    for (const suf of AREA_SUFFIXES) {
      if (x.length > suf.length + 1 && x.endsWith(" " + suf)) {
        x = x.slice(0, -(suf.length + 1)).trim();
        hit = true;
        break;
      }
    }
    if (!hit) break;
  }
  return x;
}

/** "California" | "CA" | "calif." -> "CA"; returns "" when unrecognized. */
export function normalizeState(state) {
  const raw = String(state == null ? "" : state)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]+/g, " ")
    .trim();
  if (!raw) return "";
  if (raw.length === 2 && VALID_ABBR.has(raw)) return raw;
  return STATE_ABBR[raw] || "";
}

/**
 * 2027 conforming limits for a county.
 *
 * @param {string} state  Full name or USPS abbreviation ("California", "CA").
 * @param {string} county County / parish / borough / planning-region name. Case,
 *   punctuation and the area-type suffix are ignored. A trailing USPS state
 *   abbreviation is also accepted for disambiguation, matching the app's own
 *   COUNTY_AMI key style ("Orange FL", "Suffolk MA"); when present it wins over
 *   the `state` argument, since it was written specifically to disambiguate.
 * @param {number|string} units 1-4 (anything else is clamped to 1).
 * @returns {{conforming:number, highBalance:number, isHighCost:boolean,
 *            source:string, state:string, county:string, baseline:number,
 *            ceiling:number}}
 *   `conforming`  — the largest STANDARD conforming loan amount in that area
 *                   (the national baseline, or the HERA statutory baseline in
 *                   AK/HI/GU/VI).
 *   `highBalance` — FHFA's published limit for that county, i.e. the largest
 *                   agency loan amount available there. Equals `conforming`
 *                   outside high-cost areas, so there is no high-balance band.
 *   `isHighCost`  — highBalance > conforming.
 */
export function getCountyLimits(state, county, units) {
  const u = [1, 2, 3, 4].includes(Number(units)) ? Number(units) : 1;
  const idx = u - 1;

  let countyKey = normalizeCounty(county);
  let st = normalizeState(state);

  // Trailing state abbreviation baked into the county string ("Orange FL").
  const tail = countyKey.match(/^(.*?)\s+([A-Z]{2})$/);
  if (tail && VALID_ABBR.has(tail[2])) {
    countyKey = normalizeCounty(tail[1]);
    st = tail[2];
  }

  const baseline = CONF_BASELINE[u];
  const ceiling = CONF_CEILING[u];
  const statutory = STATE_BASELINE[st] ? STATE_BASELINE[st][idx] : null;
  const conforming = statutory || baseline;

  if (!st) {
    return {
      conforming: baseline,
      highBalance: baseline,
      isHighCost: false,
      source: "national baseline (state not recognized)",
      state: "",
      county: countyKey,
      baseline,
      ceiling,
    };
  }

  // The District of Columbia is a single county-equivalent; accept any name.
  const hit =
    COUNTY_LIMITS[st + "|" + countyKey] ||
    (st === "DC" ? COUNTY_LIMITS["DC|DISTRICT OF COLUMBIA"] : null);

  const highBalance = Math.max(conforming, hit ? hit[idx] : 0);
  let source;
  if (hit) source = "FHFA 2027 county limit";
  else if (statutory) source = "HERA statutory baseline (AK/HI/GU/VI)";
  else source = "national baseline";

  return {
    conforming,
    highBalance,
    isHighCost: highBalance > conforming,
    source,
    state: st,
    county: countyKey,
    baseline,
    ceiling,
  };
}

export default {
  LIMIT_YEAR,
  CONF_BASELINE,
  CONF_CEILING,
  STATE_BASELINE,
  COUNTY_LIMITS,
  getCountyLimits,
  normalizeCounty,
  normalizeState,
};
