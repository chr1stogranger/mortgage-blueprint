// ── MCP handoff deep link (?plan=<token>) ──
//
// The public MCP server's open_in_blueprint tool (api/mcp.js) stores a
// scenario from a ChatGPT / Claude chat and returns
// blueprint.realstack.app/?plan=<token>. The app fetches it from
// GET /api/plan?t=<token> and opens it the same way as a ?listing= flyer:
// a PARTIAL Blueprint state, layered onto blankStateRef, as its own local
// scenario. The payload carries property + loan fields only — never income or
// debts (the user adds those in Blueprint).
//
// Pure, like listingPrefill.js: every lookup table is passed in.

import { listingToPrefill, LISTING_TOKEN_RE } from "./listingPrefill.js";
import { DEFAULT_RATE_LADDER } from "./rateLadder.js";

export const PLAN_CLIENT_LABELS = { chatgpt: "ChatGPT", claude: "Claude" };

/** Read + validate the token from a query string; null when absent/invalid. */
export function readPlanToken(search) {
 try {
  const t = new URLSearchParams(search || "").get("plan");
  return t && LISTING_TOKEN_RE.test(t) ? t : null;
 } catch { return null; }
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const inRange = (v, lo, hi) => { const n = num(v); return n !== null && n >= lo && n <= hi ? n : null; };

/** "ChatGPT" | "Claude" | "your chat" */
export const planClientLabel = (client) => PLAN_CLIENT_LABELS[client] || "your chat";

/**
 * Map a /api/plan payload to Blueprint state keys. Allow-listed: anything the
 * row carries beyond these fields is ignored.
 * @param {object} d  { sourceTool, client, homePrice, downPayment, interestRate, termYears, loanType, state, city?, zip?, monthlyHoa?, monthlyRent?, rentGrowthPct?, appreciationPct?, investReturnPct?, options?, baselineRate?, holdYears? }
 * @param {object} deps  same as listingToPrefill (lookupZip, cityNames, stateMap, getAutoTaxRate)
 * @returns {object} partial Blueprint state
 */
export function planToPrefill(d, deps) {
 if (!d || typeof d !== "object") return listingToPrefill(null, deps);
 const price = num(d.homePrice);
 const down = num(d.downPayment);
 // Same 2-decimal rounding the calculator's $ input uses.
 const downPct = price > 0 && down !== null && down >= 0 && down < price ? Math.round((down / price) * 10000) / 100 : null;
 const p = listingToPrefill({
  price, downPct, noteRate: d.interestRate, term: d.termYears, loanType: d.loanType,
  state: d.state, city: d.city, zip: d.zip, hoaMonthly: d.monthlyHoa,
 }, deps);

 if (d.sourceTool === "compare_rent_vs_buy") {
  p.showRentVsBuy = true;
  const rent = inRange(d.monthlyRent, 1, 100000);
  if (rent !== null) p.rbCurrentRent = Math.round(rent);
  const rg = inRange(d.rentGrowthPct, -5, 15);
  if (rg !== null) p.rbRentGrowth = rg;
  const ir = inRange(d.investReturnPct, -10, 20);
  if (ir !== null) p.rbInvestReturn = ir;
  const ap = inRange(d.appreciationPct, -10, 15);
  if (ap !== null) p.appreciationRate = ap;
 }

 if (d.sourceTool === "compare_rate_options" && Array.isArray(d.options)) {
  const rungs = d.options
   .map((o) => ({ rate: inRange(o?.rate, 1, 15), pts: inRange(o?.points, -10, 10) }))
   .filter((r) => r.rate !== null && r.pts !== null)
   .slice(0, 8);
  if (rungs.length >= 2) {
   const holdYears = inRange(d.holdYears, 1, 30);
   const ladder = { ...DEFAULT_RATE_LADDER, rungs, holdYears: holdYears !== null ? Math.round(holdYears) : DEFAULT_RATE_LADDER.holdYears };
   // A chosen baseline pins baseIdx (computeRateLadder's sorted order:
   // rate high → low, then points low → high); otherwise the ladder's own
   // auto-baseline (closest to 0 points) applies, same as the MCP tool.
   const base = num(d.baselineRate);
   if (base !== null) {
    const sorted = [...rungs].sort((a, b) => b.rate - a.rate || a.pts - b.pts);
    const idx = sorted.findIndex((r) => Math.abs(r.rate - base) < 1e-9);
    if (idx >= 0) { ladder.baseIdx = idx; ladder.baseAuto = false; }
   }
   p.showRateLadder = true;
   p.rateLadder = ladder;
  }
 }
 return p;
}

/** "From ChatGPT · $650K" — ≤ 60 chars. */
export function planScenarioName(d) {
 const price = num(d?.homePrice);
 const amt = !price ? "" : price >= 1e6 ? ` · $${(Math.round(price / 1e4) / 100).toString()}M` : ` · $${Math.round(price / 1000)}K`;
 return `From ${planClientLabel(d?.client)}${amt}`.slice(0, 60);
}

/** Where a plan lands: Rent vs Buy tab, the Rate & Points section, or Overview. */
export function planLanding(d) {
 if (d?.sourceTool === "compare_rent_vs_buy") return { tab: "rentvbuy", section: null };
 if (d?.sourceTool === "compare_rate_options" && Array.isArray(d.options) && d.options.length >= 2) return { tab: "overview", section: "overview-rateladder" };
 return { tab: "overview", section: null };
}
