// api/_safeEq.js: constant-time string compare for secrets.
//
// Files starting with "_" in /api are NOT exposed as endpoints by Vercel.
// Plain === short-circuits on the first mismatched byte, which leaks timing
// info about how much of a guessed secret was right. timingSafeEqual does not.
import { timingSafeEqual } from 'node:crypto';

export function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}
