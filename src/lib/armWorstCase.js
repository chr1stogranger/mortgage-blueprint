// Worst-case rate path for the CURRENT loan when it's an ARM still adjusting
// (Christo 2026-11-24). Every remaining adjustment moves the rate UP by the
// periodic cap (the first one by the initial cap if the loan hasn't adjusted
// yet) until it hits the lifetime ceiling, start rate + lifetime cap. The
// payment recasts over the remaining term at each change, like the note does.
// The refi's "current loan" interest, lifetime cost and year-by-year table
// run on this path instead of today's rate held flat to maturity.

export const DEFAULT_ARM_CAPS = { nextAdj: "", periodMonths: 12, firstCap: 2, periodicCap: 2, lifetimeCap: 5, worstCase: true };

const pmt = (bal, ratePct, months) => {
  if (months <= 0) return bal;
  const r = ratePct / 1200;
  return r === 0 ? bal / months : (bal * r) / (1 - Math.pow(1 + r, -months));
};

const monthsBetween = (from, to) => (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
const parse = (s) => { if (!s) return null; const d = new Date(`${String(s).slice(0, 10)}T00:00:00`); return isNaN(d) ? null : d; };

// The next change date: the one the LO typed, else last adjustment + period,
// rolled forward until it's in the future.
export function nextAdjustmentDate({ nextAdj, adjustedDate, periodMonths = 12, now = new Date() }) {
  const typed = parse(nextAdj);
  if (typed) return typed;
  const last = parse(adjustedDate);
  if (!last) return null;
  const p = Math.max(1, Number(periodMonths) || 12);
  const d = new Date(last.getFullYear(), last.getMonth(), 1);
  const today = new Date(now.getFullYear(), now.getMonth(), 1);
  do { d.setMonth(d.getMonth() + p); } while (d <= today);
  return d;
}

// Pure. Returns null when there's nothing to project.
//   balance, rate (today's %), payment (today's P&I), remainingMonths
//   startRate — the note's start rate (lifetime cap sits on top of it)
//   adjustedDate — "YYYY-MM-01" of the adjustment already made, or ""
//   caps — { nextAdj, periodMonths, firstCap, periodicCap, lifetimeCap }
export function armWorstCase({ balance, rate, payment, remainingMonths, startRate, adjustedDate, caps = DEFAULT_ARM_CAPS, now = new Date() }) {
  const bal0 = Number(balance) || 0;
  const n = Math.round(Number(remainingMonths) || 0);
  const r0 = Number(rate) || 0;
  if (bal0 <= 0 || n <= 0 || r0 <= 0) return null;
  const c = { ...DEFAULT_ARM_CAPS, ...caps };
  const period = Math.max(1, Number(c.periodMonths) || 12);
  const base = Number(startRate) > 0 ? Number(startRate) : r0;
  const maxRate = Math.max(r0, base + (Number(c.lifetimeCap) || 0));
  const next = nextAdjustmentDate({ nextAdj: c.nextAdj, adjustedDate, periodMonths: period, now });
  const today = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstIdx = next ? Math.max(0, monthsBetween(today, next)) : Infinity;
  const adjusted = parse(adjustedDate);
  const hasAdjusted = !!adjusted && adjusted <= now;

  let bal = bal0, r = r0;
  let pay = Number(payment) > 0 ? Number(payment) : pmt(bal0, r0, n);
  let totalInt = 0, totalPaid = 0, stepNo = 0;
  const steps = [];
  const rows = [];
  for (let m = 0; m < n && bal > 0.005; m++) {
    if (m >= firstIdx && (m - firstIdx) % period === 0 && r < maxRate) {
      const cap = stepNo === 0 && !hasAdjusted ? Number(c.firstCap) || 0 : Number(c.periodicCap) || 0;
      if (cap > 0) {
        r = Math.min(maxRate, r + cap);
        pay = pmt(bal, r, n - m);
        const d = new Date(today.getFullYear(), today.getMonth() + m, 1);
        steps.push({ month: m, date: d, rate: r, payment: pay, ceiling: r >= maxRate });
      }
      stepNo++;
    }
    const int = bal * r / 1200;
    const prin = Math.min(Math.max(0, pay - int), bal);
    bal -= prin;
    totalInt += int;
    totalPaid += int + prin;
    rows.push({ int, prin, bal: Math.max(0, bal), rate: r });
  }
  return { rows, steps, totalInt, totalPaid, maxRate, nextDate: next };
}
