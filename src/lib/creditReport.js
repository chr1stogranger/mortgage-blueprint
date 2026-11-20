// Tri-merge credit report on a scenario: one FICO and one VantageScore per
// bureau, each with the date it was pulled.
//
// Shape (scenario state key `creditReport`, null when nothing is entered):
//   { ex: { fico, vantage, pulled }, tu: {...}, eq: {...}, co?: { ex, tu, eq } }
//   fico / vantage are integers 300–850 (0 = not entered); pulled is "YYYY-MM-DD".
//   The top-level bureaus are the borrower's; `co` holds the co-borrower's and
//   is absent when there isn't one.

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

// The score that qualifies the loan. Each borrower has a representative score
// (qualifyingScore); with two borrowers the lower of the two is used. `who` is
// "b" or "co", whichever borrower's score it is.
export function loanQualifyingScore(report, kind = "fico") {
  const b = qualifyingScore(report, kind);
  const co = qualifyingScore(report?.co, kind);
  const pick = co.score > 0 && (b.score === 0 || co.score < b.score) ? "co" : "b";
  const q = pick === "co" ? co : b;
  return { score: q.score, who: q.score > 0 ? pick : null, joint: b.score > 0 && co.score > 0, b, co };
}

const pullDates = (r) => BUREAUS.map((b) => parseYmd(r?.[b.key]?.pulled)).filter(Boolean);

// Oldest and newest pull dates across both borrowers, and how long the report
// stays usable. The oldest pull sets the deadline: that data ages out first.
export function reportDates(report, today = new Date()) {
  const dates = [...pullDates(report), ...pullDates(report?.co)].sort((a, b) => a - b);
  if (dates.length === 0) return null;
  const oldest = dates[0];
  const newest = dates[dates.length - 1];
  const goodThrough = new Date(oldest.getFullYear(), oldest.getMonth(), oldest.getDate() + CREDIT_DOC_DAYS);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysLeft = Math.round((goodThrough - start) / 86400000);
  return { oldest, newest, sameDay: oldest.getTime() === newest.getTime(), goodThrough, daysLeft };
}

function cleanOne(report) {
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
  return { out, any };
}

// Drop anything that isn't a real score or date; null when nothing is left.
// A co-borrower with no scores is dropped.
export function cleanReport(report) {
  const b = cleanOne(report);
  const co = report?.co ? cleanOne(report.co) : { any: false };
  if (!b.any && !co.any) return null;
  return co.any ? { ...b.out, co: co.out } : b.out;
}

const anyVantage = (r) => BUREAUS.some((b) => validScore(Number(r?.[b.key]?.vantage)));
export const hasVantage = (report) => anyVantage(report) || anyVantage(report?.co);
