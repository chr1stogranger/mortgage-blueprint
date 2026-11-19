// Tri-merge credit report on a scenario: one FICO and one VantageScore per
// bureau, each with the date it was pulled.
//
// Shape (scenario state key `creditReport`, null when nothing is entered):
//   { ex: { fico, vantage, pulled }, tu: {...}, eq: {...} }
//   fico / vantage are integers 300–850 (0 = not entered); pulled is "YYYY-MM-DD".

// Mortgage lenders pull the "classic" FICO models, a different one per bureau.
export const BUREAUS = [
  { key: "ex", name: "Experian", ficoModel: "FICO 2" },
  { key: "tu", name: "TransUnion", ficoModel: "FICO 4" },
  { key: "eq", name: "Equifax", ficoModel: "FICO 5" },
];

export const SCORE_MIN = 300;
export const SCORE_MAX = 850;
// Credit documents can be no more than 120 days old at closing.
export const CREDIT_DOC_DAYS = 120;

const validScore = (n) => Number.isInteger(n) && n >= SCORE_MIN && n <= SCORE_MAX;

// The qualifying score for one borrower: the middle of three, the lower of
// two, or the only one. `kind` is "fico" or "vantage".
export function qualifyingScore(report, kind = "fico") {
  const have = BUREAUS
    .map((b) => ({ key: b.key, score: Number(report?.[b.key]?.[kind]) || 0 }))
    .filter((s) => validScore(s.score))
    .sort((a, b) => a.score - b.score);
  if (have.length === 0) return { score: 0, key: null, rule: null, count: 0 };
  if (have.length === 1) return { ...have[0], rule: "only", count: 1 };
  if (have.length === 2) return { ...have[0], rule: "lower", count: 2 };
  return { ...have[1], rule: "middle", count: 3 };
}

export function parseYmd(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}

// Oldest and newest pull dates, and how long the report stays usable. The
// oldest pull sets the deadline: that bureau's data ages out first.
export function reportDates(report, today = new Date()) {
  const dates = BUREAUS.map((b) => parseYmd(report?.[b.key]?.pulled)).filter(Boolean).sort((a, b) => a - b);
  if (dates.length === 0) return null;
  const oldest = dates[0];
  const newest = dates[dates.length - 1];
  const goodThrough = new Date(oldest.getFullYear(), oldest.getMonth(), oldest.getDate() + CREDIT_DOC_DAYS);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysLeft = Math.round((goodThrough - start) / 86400000);
  return { oldest, newest, sameDay: oldest.getTime() === newest.getTime(), goodThrough, daysLeft };
}

// Drop anything that isn't a real score or date; null when nothing is left.
export function cleanReport(report) {
  const out = {};
  let any = false;
  for (const b of BUREAUS) {
    const r = report?.[b.key] || {};
    const fico = validScore(Number(r.fico)) ? Number(r.fico) : 0;
    const vantage = validScore(Number(r.vantage)) ? Number(r.vantage) : 0;
    const pulled = parseYmd(r.pulled) ? r.pulled : "";
    out[b.key] = { fico, vantage, pulled };
    if (fico || vantage) any = true;
  }
  return any ? out : null;
}

export const hasVantage = (report) => BUREAUS.some((b) => validScore(Number(report?.[b.key]?.vantage)));
