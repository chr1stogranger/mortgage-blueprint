// api/_ratelimit.js — lightweight per-IP rate limiter for /api routes.
//
// Why (CIO audit H-2): the data routes had no throttle at all, so anonymous
// traffic could hammer routes that proxy RapidAPI (paid) and Supabase — a
// cost-and-availability attack.
//
// HONEST LIMITATION: this is an in-memory sliding window, scoped to one warm
// Vercel function instance. Cold starts reset it, and parallel instances
// don't share counts. It stops casual abuse and runaway loops cheaply, with
// zero new infrastructure. For a hard guarantee, upgrade to @upstash/ratelimit
// + Vercel KV later — the call site won't change shape. Also set a monthly
// spend cap in the RapidAPI dashboard as the final backstop.

const WINDOW_MS = 60_000; // 1 minute
const buckets = new Map(); // ip -> array of request timestamps

function clientIp(req) {
  // Vercel sets x-forwarded-for; first entry is the client.
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0].trim();
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

/**
 * Returns true if the request was rate-limited (a 429 has been sent and the
 * caller should `return` immediately).
 *
 *   import { rateLimited } from "./_ratelimit.js";
 *   export default async function handler(req, res) {
 *     if (applyCors(req, res)) return;
 *     if (rateLimited(req, res, { limit: 30 })) return;
 *     ...
 *   }
 *
 * @param {number} limit max requests per IP per minute
 */
export function rateLimited(req, res, { limit = 30 } = {}) {
  const ip = clientIp(req);
  const now = Date.now();

  let hits = buckets.get(ip) || [];
  hits = hits.filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  buckets.set(ip, hits);

  // Opportunistic cleanup so the Map can't grow unbounded on a long-lived
  // instance: every ~500 unique IPs, drop entries with no recent hits.
  if (buckets.size > 500) {
    for (const [k, v] of buckets) {
      if (v.length === 0 || now - v[v.length - 1] > WINDOW_MS) buckets.delete(k);
    }
  }

  if (hits.length > limit) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "Too many requests — try again in a minute." });
    return true;
  }
  return false;
}
