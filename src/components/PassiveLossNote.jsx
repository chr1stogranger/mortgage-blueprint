import { FONT } from "../lib/fonts.js";
import React from "react";

/* ═══════════════════════════════════════════════════════════════
   PASSIVE ACTIVITY LOSS (§469)
   What actually happens to a Schedule E paper loss.

   The old copy said "may be deductible if your AGI is under $150K
   (up to $25K)". That reads as a clean threshold and it isn't: the
   allowance phases out from $100K, 50¢ per dollar, hitting zero at
   $150K. For a borrower buying a $1.5M duplex the honest answer is
   usually that the allowance is ZERO and the loss suspends — so the
   old note overstated the benefit for exactly the clientele most
   likely to be looking at it.

   Every figure comes from the calc memo (paAllowance /
   paDeductibleNow / paSuspended). Don't recompute here.
   ═══════════════════════════════════════════════════════════════ */
export default function PassiveLossNote({ T, fmt, calc, compact = false }) {
  const loss = calc.schedELoss || 0;
  if (loss <= 0) return null;

  const allowance = calc.paAllowance || 0;
  const now = calc.paDeductibleNow || 0;
  const suspended = calc.paSuspended || 0;
  const magi = calc.paMagi || 0;
  const start = calc.paPhaseOutStart ?? 100000;
  const end = calc.paPhaseOutEnd ?? 150000;
  // MFS gets half the allowance and half the band, so never hardcode $25,000.
  const maxAllow = calc.paMaxAllowance ?? 25000;

  const phase = magi >= end ? "out" : magi > start ? "partial" : "full";
  const headline = now > 0
    ? `${fmt(now)} deductible this year`
    : "None deductible this year";

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textTertiary, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: FONT, marginBottom: 8 }}>
        What happens to the {fmt(loss)} loss
      </div>

      {/* The split — a suspended loss is deferred, not destroyed, and reads
          very differently from "you can't use it". */}
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: now > 0 ? `${T.green}12` : T.pillBg, border: `1px solid ${now > 0 ? T.green : T.separator}33` }}>
          <div style={{ fontSize: 11, color: T.textSecondary, fontFamily: FONT }}>Deductible now</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: now > 0 ? T.green : T.textTertiary, fontFamily: FONT, letterSpacing: "-0.02em" }}>{fmt(now)}</div>
        </div>
        <div style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: suspended > 0 ? `${T.blue}12` : T.pillBg, border: `1px solid ${suspended > 0 ? T.blue : T.separator}33` }}>
          <div style={{ fontSize: 11, color: T.textSecondary, fontFamily: FONT }}>Suspended</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: suspended > 0 ? T.blue : T.textTertiary, fontFamily: FONT, letterSpacing: "-0.02em" }}>{fmt(suspended)}</div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.65, marginTop: 10, fontFamily: FONT }}>
        <strong style={{ color: T.text }}>{headline}.</strong>{" "}
        {phase === "out" && (
          <>The {fmt(maxAllow)} special allowance phases out between {fmt(start)} and {fmt(end)} of income and is <strong>zero</strong> at your estimated {fmt(magi)}. </>
        )}
        {phase === "partial" && (
          <>The {fmt(maxAllow)} allowance phases out 50¢ per dollar above {fmt(start)}, leaving <strong>{fmt(allowance)}</strong> at your estimated {fmt(magi)}. </>
        )}
        {phase === "full" && (
          <>Your estimated income of {fmt(magi)} is below the {fmt(start)} phase-out, so the full {fmt(maxAllow)} allowance is available (active participation required). </>
        )}
        {suspended > 0 && (
          <>The suspended {fmt(suspended)} isn&rsquo;t lost: it carries forward indefinitely and releases against future rental income, or in full when you sell in a taxable disposition.</>
        )}
      </div>

      {!compact && (
        <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.6, marginTop: 8, fontFamily: FONT }}>
          Income here is an estimate from qualifying income. True MAGI for this test has add-backs and is figured before the passive loss itself. The allowance also requires active participation (approving tenants, setting rents) and at least 10% ownership. Real-estate-professional status can take rentals out of the passive rules entirely, but it&rsquo;s a facts-and-circumstances test. Ask your CPA rather than assuming it.
        </div>
      )}
    </div>
  );
}
