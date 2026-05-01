// California County Area Median Income (AMI) lookup
//
// Source: HUD FY 2024 Income Limits — 4-person median family income for the
// MSA/county area. Values match the HUD HOME Income Limits table.
// https://www.huduser.gov/portal/datasets/il/il2024/select_Geography.odn
//
// Christo's spreadsheet uses $168,100 as the 100% AMI baseline for the SF
// Bay Area MSA (Alameda / Contra Costa / Marin / San Francisco / San Mateo),
// which matches HUD FY2024. Keep these in sync with the next HUD release;
// the table below is grouped by region for easier maintenance.
//
// Note: HUD uses MSAs, not strict counties — multiple counties in the same
// MSA share an AMI. We key on lowercased county name for ease of lookup.

// 100% AMI for 4-person household, by lowercased CA county name.
export const CA_COUNTY_AMI_100 = {
  // ── San Francisco–Oakland–Hayward MSA ──
  "alameda":           168100,
  "contra costa":      168100,
  "marin":             168100,
  "san francisco":     168100,
  "san mateo":         168100,

  // ── San Jose–Sunnyvale–Santa Clara MSA ──
  "santa clara":       181300,
  "san benito":        181300,

  // ── Other Bay Area / North Bay ──
  "napa":              138500,
  "sonoma":            146400,
  "solano":            123300,

  // ── Sacramento Region ──
  "sacramento":        111700,
  "placer":            111700,
  "el dorado":         111700,
  "yolo":              111700,

  // ── Los Angeles / Orange / Inland Empire ──
  "los angeles":       106600,
  "orange":            136600,
  "ventura":           122300,
  "riverside":          96800,
  "san bernardino":     96800,
  "san diego":         116800,
  "imperial":           76800,

  // ── Central Coast ──
  "santa barbara":     114700,
  "san luis obispo":   115400,
  "monterey":          107500,
  "santa cruz":        148900,

  // ── Central Valley ──
  "fresno":             85200,
  "kern":               79600,
  "kings":              74800,
  "tulare":             76000,
  "madera":             86400,
  "merced":             79600,
  "stanislaus":         89900,
  "san joaquin":        97700,

  // ── North State / Sierra ──
  "butte":              79600,
  "shasta":             87300,
  "humboldt":           86300,
  "mendocino":          87300,
  "lake":               84500,
  "del norte":          76000,
  "trinity":            86300,
  "siskiyou":           76000,
  "modoc":              76000,
  "lassen":             87300,
  "plumas":             87300,
  "sierra":             87300,
  "nevada":            105200,
  "tehama":             80400,
  "glenn":              80400,
  "colusa":             80400,
  "yuba":               79600,
  "sutter":             79600,

  // ── Sierra Foothills / High Sierra ──
  "tuolumne":           94600,
  "calaveras":          94600,
  "amador":             94600,
  "mariposa":           76000,
  "mono":              111300,
  "inyo":               84500,
  "alpine":            111300,
};

// State-level fallback when county is missing or non-CA. Approximates statewide
// HUD median (somewhere between LA and SF Bay).
const CA_FALLBACK_AMI_100 = 114700;

/**
 * Look up the 100% / 120% / 80% AMI thresholds for a given California county.
 * Returns the standard fallback if the county isn't in our table.
 *
 * @param {string} county — county name, case-insensitive (with or without "County" suffix)
 * @returns {{ ami120: number, ami100: number, ami80: number, source: "lookup"|"fallback" }}
 */
export function getCaAmi(county) {
  const key = String(county || "")
    .toLowerCase()
    .replace(/\s+county$/i, "")
    .trim();
  const ami100 = CA_COUNTY_AMI_100[key] ?? CA_FALLBACK_AMI_100;
  return {
    ami120: Math.round(ami100 * 1.2),
    ami100,
    ami80:  Math.round(ami100 * 0.8),
    source: CA_COUNTY_AMI_100[key] ? "lookup" : "fallback",
  };
}
