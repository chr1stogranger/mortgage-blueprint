// Blueprint running inside another page (2026-10-31).
//
//   "ops"  — the RealStack Ops Blueprint side panel (ops.realstack.app frames
//            us). Blueprint drops its duplicate chrome and puts the panel's
//            width / pop-out / close controls in its own header row; Ops
//            sends its light/dark + background so "Match Ops" follows live.
//   "pane" — the second Blueprint in Blueprint's own split view (same origin,
//            opened with ?pane=1). Compact chrome; reports its scenario so the
//            left side can warn when both edit the same one.
//   null   — standalone, or framed by anything else (realtor / LO websites
//            listed in vercel.json frame-ancestors keep the full app).
//
// Evaluated once at module load: the ?client= deep link strips the whole
// query string on mount, so ?pane=1 must be read before that.
export const OPS_ORIGIN = "https://ops.realstack.app";

function detect() {
  if (typeof window === "undefined" || window.self === window.top) return null;
  let parentOrigin = "";
  try { parentOrigin = window.location.ancestorOrigins?.[0] || ""; } catch { /* ignore */ }
  if (!parentOrigin) { try { parentOrigin = document.referrer ? new URL(document.referrer).origin : ""; } catch { /* ignore */ } }
  if (parentOrigin === OPS_ORIGIN) return "ops";
  let pane = false;
  try { pane = new URLSearchParams(window.location.search).get("pane") === "1"; } catch { /* ignore */ }
  if (pane && parentOrigin === window.location.origin) return "pane";
  return null;
}

export const EMBED = detect();

// Message the embedding page. Ops: { source: "blueprint", type, ... }.
// Pane: same shape to our own origin (the left-hand Blueprint).
export function postToHost(msg) {
  if (!EMBED) return;
  const target = EMBED === "ops" ? OPS_ORIGIN : window.location.origin;
  try { window.parent.postMessage({ source: "blueprint", ...msg }, target); } catch { /* ignore */ }
}
