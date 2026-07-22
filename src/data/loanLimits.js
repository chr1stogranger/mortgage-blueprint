/**
 * FHFA conforming loan limit values — Calendar Year 2026.
 *
 * SOURCE OF RECORD (downloaded and parsed 2026-07-21):
 *   https://www.fhfa.gov/document/data/fullcountyloanlimitlist2026_hera-based_final_flat.xlsx
 *   ("Fannie Mae and Freddie Mac Conforming Loan Limits for Mortgages Acquired
 *    in Calendar Year 2026", HERA-based final, flat file — 3,235 county rows)
 * Cross-verified row-for-row (3,235/3,235 exact match, all four unit columns) against
 * FHFA's PDF rendering of the same list:
 *   https://www.fhfa.gov/document/d/cll/fullcountyloanlimitlist2026_hera-based_final_flat.pdf
 * Announcement: "FHFA Announces Conforming Loan Limit Values for 2026",
 *   published 2025-11-25 —
 *   https://www.fhfa.gov/news/news-release/fhfa-announces-conforming-loan-limit-values-for-2026
 * Effective for mortgages acquired by Fannie Mae / Freddie Mac in calendar year 2026.
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
 *    spans Greater Bridgeport $977,500, Western Connecticut $977,500 and Naugatuck
 *    Valley $851,000). Resolving that requires the subject town, not the county.
 */

export const LIMIT_YEAR = 2026;

/** National baseline conforming loan limit values, by unit count. */
export const CONF_BASELINE = { 1: 832750, 2: 1066250, 3: 1288800, 4: 1601750 };

/** Statutory ceiling (150% of baseline) — the high-cost-area maximum. */
export const CONF_CEILING = { 1: 1249125, 2: 1599375, 3: 1933200, 4: 2402625 };

/**
 * HERA special-statutory areas: baseline equals the national ceiling.
 * Values verified identical for all 30 Alaska boroughs/census areas, Guam, and all
 * three U.S. Virgin Islands districts; in Hawaii it is the floor (Maui and Kalawao
 * are higher — see COUNTY_LIMITS).
 */
export const STATE_BASELINE = {
  AK: [1249125, 1599375, 1933200, 2402625],
  HI: [1249125, 1599375, 1933200, 2402625],
  GU: [1249125, 1599375, 1933200, 2402625],
  VI: [1249125, 1599375, 1933200, 2402625],
};

// Distinct limit tiers present in the 2026 file, keyed by their one-unit value.
// [one-unit, two-unit, three-unit, four-unit]
const T = {
  839500: [839500, 1074700, 1299100, 1614450],
  851000: [851000, 1089450, 1316900, 1636550],
  862500: [862500, 1104150, 1334700, 1658700],
  879750: [879750, 1126250, 1361350, 1691850],
  883200: [883200, 1130650, 1366700, 1698500],
  897000: [897000, 1148350, 1388050, 1725050],
  941850: [941850, 1205750, 1457450, 1811300],
  962550: [962550, 1232250, 1489500, 1851100],
  977500: [977500, 1251400, 1512650, 1879850],
  990150: [990150, 1267600, 1532200, 1904150],
  994750: [994750, 1273450, 1539350, 1913000],
  997050: [997050, 1276400, 1542900, 1917450],
  1000500: [1000500, 1280850, 1548250, 1924100],
  1017750: [1017750, 1302900, 1574900, 1957250],
  1029250: [1029250, 1317650, 1592700, 1979350],
  1035000: [1035000, 1325000, 1601600, 1990450],
  1063750: [1063750, 1361800, 1646100, 2045700],
  1089050: [1089050, 1394200, 1685250, 2094350],
  1092500: [1092500, 1398600, 1690600, 2101000],
  1104000: [1104000, 1413350, 1708400, 2123100],
  1150000: [1150000, 1472250, 1779600, 2211600],
  1209750: [1209750, 1548975, 1872225, 2326875],
  1249125: [1249125, 1599375, 1933200, 2402625],
  1299500: [1299500, 1663600, 2010950, 2499100],
};

/**
 * Areas whose 2026 limit differs from the applicable baseline.
 * Key = "<USPS state>|<normalized area name>" (see normalizeCounty below:
 * uppercase, punctuation-stripped, generic suffix such as COUNTY/PARISH/BOROUGH/
 * CENSUS AREA/MUNICIPALITY/CITY/PLANNING REGION removed).
 */
export const COUNTY_LIMITS = {
  // CA
  "CA|ALAMEDA": T[1249125],  // ALAMEDA COUNTY
  "CA|CONTRA COSTA": T[1249125],  // CONTRA COSTA COUNTY
  "CA|LOS ANGELES": T[1249125],  // LOS ANGELES COUNTY
  "CA|MARIN": T[1249125],  // MARIN COUNTY
  "CA|MONTEREY": T[994750],  // MONTEREY COUNTY
  "CA|NAPA": T[1017750],  // NAPA COUNTY
  "CA|ORANGE": T[1249125],  // ORANGE COUNTY
  "CA|SAN BENITO": T[1249125],  // SAN BENITO COUNTY
  "CA|SAN DIEGO": T[1104000],  // SAN DIEGO COUNTY
  "CA|SAN FRANCISCO": T[1249125],  // SAN FRANCISCO COUNTY
  "CA|SAN LUIS OBISPO": T[1000500],  // SAN LUIS OBISPO COUNTY
  "CA|SAN MATEO": T[1249125],  // SAN MATEO COUNTY
  "CA|SANTA BARBARA": T[941850],  // SANTA BARBARA COUNTY
  "CA|SANTA CLARA": T[1249125],  // SANTA CLARA COUNTY
  "CA|SANTA CRUZ": T[1249125],  // SANTA CRUZ COUNTY
  "CA|SONOMA": T[897000],  // SONOMA COUNTY
  "CA|VENTURA": T[1035000],  // VENTURA COUNTY
  // CO
  "CO|ADAMS": T[862500],  // ADAMS COUNTY
  "CO|ARAPAHOE": T[862500],  // ARAPAHOE COUNTY
  "CO|BOULDER": T[879750],  // BOULDER COUNTY
  "CO|BROOMFIELD": T[862500],  // BROOMFIELD COUNTY
  "CO|CLEAR CREEK": T[862500],  // CLEAR CREEK COUNTY
  "CO|DENVER": T[862500],  // DENVER COUNTY
  "CO|DOUGLAS": T[862500],  // DOUGLAS COUNTY
  "CO|EAGLE": T[1249125],  // EAGLE COUNTY
  "CO|ELBERT": T[862500],  // ELBERT COUNTY
  "CO|GARFIELD": T[1209750],  // GARFIELD COUNTY
  "CO|GILPIN": T[862500],  // GILPIN COUNTY
  "CO|GRAND": T[883200],  // GRAND COUNTY
  "CO|JEFFERSON": T[862500],  // JEFFERSON COUNTY
  "CO|LAKE": T[1092500],  // LAKE COUNTY
  "CO|MOFFAT": T[1089050],  // MOFFAT COUNTY
  "CO|PARK": T[862500],  // PARK COUNTY
  "CO|PITKIN": T[1209750],  // PITKIN COUNTY
  "CO|ROUTT": T[1089050],  // ROUTT COUNTY
  "CO|SAN MIGUEL": T[994750],  // SAN MIGUEL COUNTY
  "CO|SUMMIT": T[1092500],  // SUMMIT COUNTY
  // CT
  "CT|GREATER BRIDGEPORT": T[977500],  // Greater Bridgeport Planning Region
  "CT|NAUGATUCK VALLEY": T[851000],  // Naugatuck Valley Planning Region
  "CT|WESTERN CONNECTICUT": T[977500],  // Western Connecticut Planning Region
  // DC
  "DC|DISTRICT OF COLUMBIA": T[1249125],
  // FL
  "FL|MONROE": T[990150],  // MONROE COUNTY
  // HI
  "HI|KALAWAO": T[1299500],  // KALAWAO COUNTY
  "HI|MAUI": T[1299500],  // MAUI COUNTY
  // ID
  "ID|TETON": T[1249125],  // TETON COUNTY
  // MA
  "MA|DUKES": T[1249125],  // DUKES COUNTY
  "MA|ESSEX": T[962550],  // ESSEX COUNTY
  "MA|MIDDLESEX": T[962550],  // MIDDLESEX COUNTY
  "MA|NANTUCKET": T[1249125],  // NANTUCKET COUNTY
  "MA|NORFOLK": T[962550],  // NORFOLK COUNTY
  "MA|PLYMOUTH": T[962550],  // PLYMOUTH COUNTY
  "MA|SUFFOLK": T[962550],  // SUFFOLK COUNTY
  // MD
  "MD|CALVERT": T[1209750],  // CALVERT COUNTY
  "MD|CHARLES": T[1249125],  // CHARLES COUNTY
  "MD|FREDERICK": T[1249125],  // FREDERICK COUNTY
  "MD|MONTGOMERY": T[1249125],  // MONTGOMERY COUNTY
  "MD|PRINCE GEORGES": T[1249125],  // PRINCE GEORGE'S COUNTY
  // NH
  "NH|ROCKINGHAM": T[962550],  // ROCKINGHAM COUNTY
  "NH|STRAFFORD": T[962550],  // STRAFFORD COUNTY
  // NJ
  "NJ|BERGEN": T[1209750],  // BERGEN COUNTY
  "NJ|ESSEX": T[1209750],  // ESSEX COUNTY
  "NJ|HUDSON": T[1209750],  // HUDSON COUNTY
  "NJ|HUNTERDON": T[1209750],  // HUNTERDON COUNTY
  "NJ|MIDDLESEX": T[1209750],  // MIDDLESEX COUNTY
  "NJ|MONMOUTH": T[1209750],  // MONMOUTH COUNTY
  "NJ|MORRIS": T[1209750],  // MORRIS COUNTY
  "NJ|OCEAN": T[1209750],  // OCEAN COUNTY
  "NJ|PASSAIC": T[1209750],  // PASSAIC COUNTY
  "NJ|SOMERSET": T[1209750],  // SOMERSET COUNTY
  "NJ|SUSSEX": T[1209750],  // SUSSEX COUNTY
  "NJ|UNION": T[1209750],  // UNION COUNTY
  // NY
  "NY|BRONX": T[1209750],  // BRONX COUNTY
  "NY|KINGS": T[1209750],  // KINGS COUNTY
  "NY|NASSAU": T[1209750],  // NASSAU COUNTY
  "NY|NEW YORK": T[1209750],  // NEW YORK COUNTY
  "NY|PUTNAM": T[1209750],  // PUTNAM COUNTY
  "NY|QUEENS": T[1209750],  // QUEENS COUNTY
  "NY|RICHMOND": T[1209750],  // RICHMOND COUNTY
  "NY|ROCKLAND": T[1209750],  // ROCKLAND COUNTY
  "NY|SUFFOLK": T[1209750],  // SUFFOLK COUNTY
  "NY|WESTCHESTER": T[1209750],  // WESTCHESTER COUNTY
  // PA
  "PA|PIKE": T[1209750],  // PIKE COUNTY
  // TN
  "TN|CANNON": T[1029250],  // CANNON COUNTY
  "TN|CHEATHAM": T[1029250],  // CHEATHAM COUNTY
  "TN|DAVIDSON": T[1029250],  // DAVIDSON COUNTY
  "TN|DICKSON": T[1029250],  // DICKSON COUNTY
  "TN|HICKMAN": T[1029250],  // HICKMAN COUNTY
  "TN|MACON": T[1029250],  // MACON COUNTY
  "TN|MAURY": T[1029250],  // MAURY COUNTY
  "TN|ROBERTSON": T[1029250],  // ROBERTSON COUNTY
  "TN|RUTHERFORD": T[1029250],  // RUTHERFORD COUNTY
  "TN|SMITH": T[1029250],  // SMITH COUNTY
  "TN|SUMNER": T[1029250],  // SUMNER COUNTY
  "TN|TROUSDALE": T[1029250],  // TROUSDALE COUNTY
  "TN|WILLIAMSON": T[1029250],  // WILLIAMSON COUNTY
  "TN|WILSON": T[1029250],  // WILSON COUNTY
  // UT
  "UT|GRAND": T[839500],  // GRAND COUNTY
  "UT|SUMMIT": T[1150000],  // SUMMIT COUNTY
  "UT|WASATCH": T[1150000],  // WASATCH COUNTY
  "UT|WAYNE": T[997050],  // WAYNE COUNTY
  // VA
  "VA|ALEXANDRIA": T[1249125],  // ALEXANDRIA CITY
  "VA|ARLINGTON": T[1249125],  // ARLINGTON COUNTY
  "VA|CLARKE": T[1249125],  // CLARKE COUNTY
  "VA|CULPEPER": T[1249125],  // CULPEPER COUNTY
  "VA|FAIRFAX": T[1249125],  // FAIRFAX COUNTY + FAIRFAX CITY
  "VA|FALLS CHURCH": T[1249125],  // FALLS CHURCH CITY
  "VA|FAUQUIER": T[1249125],  // FAUQUIER COUNTY
  "VA|FREDERICKSBURG": T[1249125],  // FREDERICKSBURG CITY
  "VA|LOUDOUN": T[1249125],  // LOUDOUN COUNTY
  "VA|MADISON": T[1209750],  // MADISON COUNTY
  "VA|MANASSAS": T[1249125],  // MANASSAS CITY
  "VA|MANASSAS PARK": T[1249125],  // MANASSAS PARK CITY
  "VA|PRINCE WILLIAM": T[1249125],  // PRINCE WILLIAM COUNTY
  "VA|RAPPAHANNOCK": T[1249125],  // RAPPAHANNOCK COUNTY
  "VA|SPOTSYLVANIA": T[1249125],  // SPOTSYLVANIA COUNTY
  "VA|STAFFORD": T[1249125],  // STAFFORD COUNTY
  "VA|WARREN": T[1249125],  // WARREN COUNTY
  // WA
  "WA|KING": T[1063750],  // KING COUNTY
  "WA|PIERCE": T[1063750],  // PIERCE COUNTY
  "WA|SNOHOMISH": T[1063750],  // SNOHOMISH COUNTY
  // WV
  "WV|JEFFERSON": T[1249125],  // JEFFERSON COUNTY
  // WY
  "WY|TETON": T[1249125],  // TETON COUNTY
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
 * 2026 conforming limits for a county.
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
  if (hit) source = "FHFA 2026 county limit";
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
