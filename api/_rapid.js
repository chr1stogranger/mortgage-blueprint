// Paced fetch for RapidAPI. The provider caps requests PER SECOND, so a plain
// concurrency cap is not enough: four slots against ~250 ms responses is
// ~15 req/s and still trips "You have exceeded the rate limit per second for
// your plan, PRO" (the Oct 15 429 bursts on /api/pricepoint and /api/sold-comps).
// This keeps the slot cap AND spaces launches out, then retries a 429 once
// after the window rolls over. State is per lambda instance.

const MAX_CONCURRENT = 4;
const MIN_GAP_MS = 220; // ≤ ~4.5 launches per second

let inFlight = 0;
let lastStart = 0;
const waiters = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function acquire() {
  if (inFlight >= MAX_CONCURRENT) await new Promise((r) => waiters.push(r));
  inFlight++;
  const wait = lastStart + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastStart = Date.now();
}

function release() {
  inFlight--;
  const next = waiters.shift();
  if (next) next();
}

/** Run fn inside the paced slot (no retry). */
export async function withPacedSlot(fn) {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

/**
 * fetch() through the paced slot. A 429 is retried once after the current
 * one-second window plus jitter, honouring Retry-After when the provider sends
 * one. Anything else is returned to the caller as-is.
 */
export async function rapidFetch(url, options = {}, { retries = 1, timeoutMs = 0 } = {}) {
  // The timeout clock starts when the request launches, not while it waits
  // for a slot, so a queued call is not aborted before it is sent.
  const go = () => fetch(url, timeoutMs > 0 ? { ...options, signal: AbortSignal.timeout(timeoutMs) } : options);
  let res = await withPacedSlot(go);
  for (let attempt = 0; attempt < retries && res.status === 429; attempt++) {
    const retryAfter = Number(res.headers.get('retry-after')) || 0;
    const base = retryAfter > 0 ? retryAfter * 1000 : 1000;
    await sleep(base + 100 + Math.floor(Math.random() * 200));
    res = await withPacedSlot(go);
  }
  return res;
}
