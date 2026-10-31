import { FONT, MONO } from "../lib/fonts.js";
import React, { useEffect, useRef, useState } from "react";
import { REFI_STEPS } from "../lib/refiSteps.js";

// RefiSteps — the refi as four steps with a live verdict (Refi Hunter Phase 3,
// Christo 2026-10-31: "steps for everyone", with a Show everything switch).
//
// The bar heads every step: the steps on the left, the verdict on the right —
// the three 3-Point Test dots, monthly savings, breakeven and net cash. It is
// NOT sticky: html/body/#root carry overflow-x:hidden (MortgageBlueprint), which
// makes sticky scroll away, so it sits at the top of each step instead (step
// changes scroll to the top) while the fixed header keeps savings and net cash
// in view. OverviewTab decides which existing sections each step shows.
//
// Props: T, isDesktop, step, onStep(i), calc, fmt, onShowAll

export default function RefiSteps({ T, isDesktop, step, onStep, calc = {}, fmt, onShowAll }) {
  const tests = [calc.refiTest1Pass, calc.refiTest2Pass, calc.refiTest3Pass];
  const passed = tests.filter((t) => t === true).length;
  const known = tests.some((t) => t === true || t === false);
  const savings = Number(calc.refiPiMiSavings) || 0;
  const be = Number(calc.refiBreakevenMonths) || 0;
  const cash = Number(calc.refiNetCashInHand) || 0;
  const signed = (v) => (v < 0 ? "−" : "") + fmt(Math.abs(Math.round(v)));
  // The bar's own width, not the window's: with the PDF preview docked the
  // page column can be narrow on a wide screen. Narrow → steps scroll in one
  // row and the verdict sits on the row below (two rows, never four).
  const barRef = useRef(null);
  const [wide, setWide] = useState(isDesktop);
  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([e]) => setWide(e.contentRect.width >= 760));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const label = { fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: T.textTertiary };
  const figure = (color) => ({ fontFamily: FONT, fontSize: isDesktop ? 15 : 13, fontWeight: 800, color, letterSpacing: "-0.01em" });

  return (
    <div ref={barRef} style={{
      position: "relative", zIndex: 2,
      margin: isDesktop ? "4px 0 12px" : "4px -4px 10px",
      padding: isDesktop ? "8px 10px" : "8px",
      background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 18, boxShadow: T.cardShadow,
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: isDesktop ? 12 : 8,
    }}>
      <nav aria-label="Refinance steps" style={{ display: "flex", gap: 4, flexWrap: "nowrap", overflowX: "auto", scrollbarWidth: "none", flex: wide ? "0 1 auto" : "1 1 100%", minWidth: 0 }}>
        {REFI_STEPS.map((s, i) => {
          const on = i === step;
          const done = i < step;
          return (
            <button key={s} type="button" onClick={() => onStep(i)} aria-current={on ? "step" : undefined}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: isDesktop ? "6px 12px" : "5px 10px", borderRadius: 9999, cursor: "pointer",
                fontFamily: FONT, fontSize: isDesktop ? 13 : 12, fontWeight: 700, whiteSpace: "nowrap",
                border: on ? "none" : `1px solid ${T.separator}`,
                background: on ? T.blue : T.inputBg,
                color: on ? "#fff" : done ? T.green : T.textSecondary,
              }}>
              <span style={{ fontFamily: MONO, fontSize: 10, opacity: 0.8 }}>{done ? "✓" : i + 1}</span>{s}
            </button>
          );
        })}
      </nav>

      <div style={{ display: "flex", alignItems: "center", columnGap: wide ? 16 : 12, rowGap: 6, marginLeft: wide ? "auto" : 0, flexWrap: wide ? "nowrap" : "wrap", minWidth: 0, flex: wide ? "0 1 auto" : "1 1 100%" }} aria-label="Refinance verdict">
        <div title={known ? `${passed} of 3 refi tests pass` : "Enter the current loan to run the 3-Point Test"} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-flex", gap: 3 }}>
            {tests.map((t, i) => (
              <span key={i} style={{ width: 9, height: 9, borderRadius: "50%", display: "inline-block", background: t === true ? T.green : t === false ? T.red : T.ringTrack, opacity: t === false ? 0.55 : 1 }} />
            ))}
          </span>
          <span style={figure(passed === 3 ? T.green : T.text)}>{known ? `${passed}/3` : "–/3"}</span>
        </div>
        <div>
          <div style={label}>Savings</div>
          <div style={figure(savings > 0 ? T.green : savings < 0 ? T.red : T.textSecondary)}>{savings ? `${signed(savings)}/mo` : "—"}</div>
        </div>
        <div>
          <div style={label}>Breakeven</div>
          <div style={figure(T.text)}>{be > 0 ? `${be} mo` : "—"}</div>
        </div>
        <div>
          <div style={label}>{!known || cash >= 0 ? "Cash back" : "Cash to close"}</div>
          <div style={figure(!known ? T.textSecondary : cash >= 0 ? T.green : T.red)}>{known ? fmt(Math.abs(Math.round(cash))) : "—"}</div>
        </div>
        {onShowAll && (
          <button type="button" onClick={onShowAll} title="Show every section on one page"
            style={{ marginLeft: "auto", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: FONT, fontSize: 11, fontWeight: 600, color: T.blue, whiteSpace: "nowrap" }}>
            Show everything
          </button>
        )}
      </div>
    </div>
  );
}
