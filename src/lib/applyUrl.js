// Pre-approval (1003 portal) URL for the "Get Pre-Approved" CTAs (2026-07-29).
// Each LO's own portal lives in bp_lo_info.applyUrl (editable in Settings and
// reseeded on LO sign-in). Chris's portal is the factory default so the public
// consumer app is unchanged. Hoisted components read it via getApplyUrl().
export const DEFAULT_APPLY_URL = "https://2179191.my1003app.com/952015/register";

export const getApplyUrl = () => {
 try { return JSON.parse(localStorage.getItem("bp_lo_info") || "{}").applyUrl ?? DEFAULT_APPLY_URL; } catch { return DEFAULT_APPLY_URL; }
};

/** Append the realtor-partner attribution slug, respecting existing query strings. */
export const applyHref = (url, slug) => url + (slug ? (url.includes("?") ? "&" : "?") + "source=" + encodeURIComponent(slug) : "");
