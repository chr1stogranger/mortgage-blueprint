#!/usr/bin/env node
/**
 * Regenerate the data blocks of src/data/loanLimits.js from FHFA's county
 * conforming-loan-limit flat file (published each late November).
 *
 *   node scripts/gen-loan-limits.mjs <flat.xlsx> --year 2027 \
 *     --published 2026-11-24 \
 *     --announcement https://www.fhfa.gov/news/news-release/fhfa-announces-conforming-loan-limit-for-2027 \
 *     --xlsx-url https://www.fhfa.gov/document/d/cll/fullcountyloanlimitlist2027_hera-based_final_flat.xlsx
 *
 * Reads the xlsx through python3 + openpyxl (user site-packages, hence -E).
 * Rewrites only: the header source lines, LIMIT_YEAR, CONF_BASELINE,
 * CONF_CEILING, STATE_BASELINE, the tier table T, COUNTY_LIMITS and the
 * year in the getCountyLimits doc/source string. Keys come from the file's own
 * normalizeCounty(), so they match what lookups normalize.
 *
 * Fails (exit 1) when the file's shape is not what this code assumes:
 * baseline not uniform, AK/GU/VI not uniform at the ceiling, HI below the
 * ceiling, a one-unit value mapping to two different tiers, or a key collision.
 * Run it against the previous year's file first: it must reproduce the
 * current data exactly (git diff shows only nothing).
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "..", "src", "data", "loanLimits.js");

const args = process.argv.slice(2);
const xlsx = args[0];
const opt = (k) => {
  const i = args.indexOf("--" + k);
  return i > 0 ? args[i + 1] : null;
};
const year = Number(opt("year"));
const published = opt("published");
const announcement = opt("announcement");
const xlsxUrl = opt("xlsx-url");
const pdfUrl = opt("pdf-url");
const keepHeader = args.includes("--keep-header");
if (!xlsx || !year) {
  console.error("usage: gen-loan-limits.mjs <flat.xlsx> --year YYYY [--published YYYY-MM-DD --announcement URL --xlsx-url URL] [--keep-header]");
  process.exit(1);
}
const die = (m) => {
  console.error("FAIL: " + m);
  process.exit(1);
};

const py = `
import json, sys, openpyxl
ws = openpyxl.load_workbook(sys.argv[1], read_only=True).worksheets[0]
rows = list(ws.iter_rows(values_only=True))
print(json.dumps({"title": rows[0][0], "header": rows[1], "rows": [r for r in rows[2:] if r and r[0]]}))
`;
const { title, header, rows } = JSON.parse(
  execFileSync("python3", ["-E", "-c", py, xlsx], { maxBuffer: 64 << 20 }).toString(),
);
if (header[2] !== "County Name" || header[3] !== "State") die("unexpected header " + JSON.stringify(header));
if (!String(title).includes("Calendar Year " + year)) die(`title does not say Calendar Year ${year}: ${title}`);

const { normalizeCounty } = await import(pathToFileURL(OUT).href + "?gen=" + Date.now());

const lim = (r) => [r[5], r[6], r[7], r[8]].map(Number);
const eq = (a, b) => a.every((v, i) => v === b[i]);

// National baseline = the most common row.
const counts = new Map();
for (const r of rows) {
  const k = lim(r).join(",");
  counts.set(k, (counts.get(k) || 0) + 1);
}
const baseline = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split(",").map(Number);
const ceiling1 = Math.round(baseline[0] * 1.5);
const STATUTORY = ["AK", "HI", "GU", "VI"];
const statRows = rows.filter((r) => ["AK", "GU", "VI"].includes(r[3]));
const ceiling = lim(statRows[0]);
if (ceiling[0] !== ceiling1) die(`ceiling ${ceiling[0]} is not 150% of baseline ${baseline[0]}`);
for (const r of statRows) if (!eq(lim(r), ceiling)) die(`${r[2]} ${r[3]} differs from statutory ceiling`);
for (const r of rows.filter((x) => x[3] === "HI"))
  if (lim(r).some((v, i) => v < ceiling[i])) die(`${r[2]} HI below ceiling`);

const tiers = new Map();
const entries = [];
for (const r of rows) {
  const st = r[3];
  const l = lim(r);
  const applicable = STATUTORY.includes(st) ? ceiling : baseline;
  if (eq(l, applicable)) continue;
  if (tiers.has(l[0]) && !eq(tiers.get(l[0]), l)) die(`one-unit ${l[0]} maps to two tiers`);
  tiers.set(l[0], l);
  const key = st + "|" + normalizeCounty(r[2]);
  const dup = entries.find((e) => e.key === key);
  if (dup) {
    // Fairfax County + Fairfax city VA normalize to one key; fine while they share a limit.
    if (dup.one !== l[0]) die(`key collision with different limits: ${key}`);
    dup.raw += " + " + r[2];
    continue;
  }
  entries.push({ st, key, one: l[0], raw: r[2] });
}
entries.sort((a, b) => (a.st === b.st ? a.key.localeCompare(b.key) : a.st.localeCompare(b.st)));

const arr = (a) => `[${a.join(", ")}]`;
const obj = (a) => `{ 1: ${a[0]}, 2: ${a[1]}, 3: ${a[2]}, 4: ${a[3]} }`;
let countyBlock = "export const COUNTY_LIMITS = {\n";
let lastSt = "";
for (const e of entries) {
  if (e.st !== lastSt) countyBlock += `  // ${e.st}\n`;
  lastSt = e.st;
  const comment = e.key === "DC|DISTRICT OF COLUMBIA" ? "" : `  // ${e.raw}`;
  countyBlock += `  "${e.key}": T[${e.one}],${comment}\n`;
}
countyBlock += "};";
const tierBlock =
  "const T = {\n" +
  [...tiers.keys()].sort((a, b) => a - b).map((k) => `  ${k}: ${arr(tiers.get(k))},`).join("\n") +
  "\n};";
const statBlock =
  "export const STATE_BASELINE = {\n" + ["AK", "HI", "GU", "VI"].map((s) => `  ${s}: ${arr(ceiling)},`).join("\n") + "\n};";

let src = readFileSync(OUT, "utf8");
const swap = (re, to) => {
  if (!re.test(src)) die("pattern not found: " + re);
  src = src.replace(re, to);
};
swap(/export const LIMIT_YEAR = \d+;/, `export const LIMIT_YEAR = ${year};`);
swap(/export const CONF_BASELINE = \{[^}]*\};/, `export const CONF_BASELINE = ${obj(baseline)};`);
swap(/export const CONF_CEILING = \{[^}]*\};/, `export const CONF_CEILING = ${obj(ceiling)};`);
swap(/export const STATE_BASELINE = \{[\s\S]*?\n\};/, statBlock);
swap(/const T = \{[\s\S]*?\n\};/, tierBlock);
swap(/export const COUNTY_LIMITS = \{[\s\S]*?\n\};/, countyBlock);
swap(/Distinct limit tiers present in the \d+ file/, `Distinct limit tiers present in the ${year} file`);
swap(/Areas whose \d+ limit differs/, `Areas whose ${year} limit differs`);
swap(/\* \d+ conforming limits for a county\./, `* ${year} conforming limits for a county.`);
swap(/"FHFA \d+ county limit"/, `"FHFA ${year} county limit"`);

if (!keepHeader) {
  if (!published || !announcement || !xlsxUrl) die("--published, --announcement and --xlsx-url are required (or --keep-header)");
  const today = new Date().toISOString().slice(0, 10);
  const header = `/**
 * FHFA conforming loan limit values — Calendar Year ${year}.
 *
 * SOURCE OF RECORD (downloaded and parsed ${today} by scripts/gen-loan-limits.mjs):
 *   ${xlsxUrl}
 *   ("${String(title).split("\n")[0]}", HERA-based final, flat file — ${rows.length.toLocaleString("en-US")} county rows)
${pdfUrl ? ` * Cross-verified against FHFA's PDF rendering of the same list:\n *   ${pdfUrl}\n` : ""} * Announcement: "FHFA Announces Conforming Loan Limit for ${year}",
 *   published ${published} —
 *   ${announcement}
 * Effective for mortgages acquired by Fannie Mae / Freddie Mac in calendar year ${year}.
 *`;
  swap(/^\/\*\*\n \* FHFA conforming loan limit values[\s\S]*?calendar year \d+\.\n \*/, header);
}

writeFileSync(OUT, src);
console.log(
  `wrote ${path.relative(process.cwd(), OUT)}: ${rows.length} rows, baseline ${baseline[0]}, ceiling ${ceiling[0]}, ` +
    `${tiers.size} tiers, ${entries.length} county keys`,
);
