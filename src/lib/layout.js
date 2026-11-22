// Expanded width of the desktop sidebar. 270 left a wide empty strip beside
// the nav labels (Chris 2026-11-20); the header, content offset, split view
// and workspace overlay all read this one number.
export const SIDEBAR_W = 224;

// The person can drag the sidebar's right edge between these (saved per
// browser under bp_sidebar_w); double-click the edge to go back to SIDEBAR_W.
export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 420;
export const clampSidebarW = (n) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(Number(n) || SIDEBAR_W)));
