// api/_cors.js — shared CORS helper for all /api routes.
//
// Files starting with "_" in /api are NOT exposed as endpoints by Vercel —
// this is a plain module the route handlers import.
//
// Why this exists (CIO audit H-1): rates.js and pp-daily.js shipped with
// Access-Control-Allow-Origin: * — any website could call routes that proxy
// paid APIs (RapidAPI) and Supabase. This helper scopes every route to the
// known origins, INCLUDING the Capacitor native app (which fetches from
// https://localhost inside the iOS/Android WebView — the original reason
// the wildcard was added to rates.js).

export const ALLOWED_ORIGINS = [
  "https://blueprint.realstack.app",   // production web
  "https://mortgage-blueprint.vercel.app", // Vercel preview alias
  "https://localhost",                 // Capacitor iOS/Android (iosScheme: https)
  "capacitor://localhost",             // Capacitor default scheme (safety net)
  "http://localhost:5173",             // vite dev
  "http://localhost:4173",             // vite preview
];

/**
 * Apply scoped CORS headers and answer preflight.
 * Returns true if the request was an OPTIONS preflight (already answered) —
 * the caller should `return` immediately in that case.
 *
 *   import { applyCors } from "./_cors.js";
 *   export default async function handler(req, res) {
 *     if (applyCors(req, res)) return;
 *     ...
 *   }
 */
export function applyCors(req, res, { methods = "GET, OPTIONS" } = {}) {
  const origin = req.headers.origin;
  // Exact match — startsWith would let https://blueprint.realstack.app.evil.com through.
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS[0]);
  }
  // Tell caches the response varies by Origin so one origin's ACAO header
  // is never served to another.
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

/**
 * True when the caller holds the CRON_SECRET (Vercel cron, or the owner
 * calling with ?secret= / Authorization: Bearer). Used to gate expensive
 * paths (forced RapidAPI discovery, debug probes).
 *
 * Fails CLOSED in production when CRON_SECRET is not configured.
 */
export function isPrivileged(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.VERCEL_ENV !== "production";
  const bearer = (req.headers.authorization || "").replace("Bearer ", "");
  return bearer === secret || req.query?.secret === secret;
}
