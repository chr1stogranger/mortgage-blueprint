import { FONT, MONO } from "../lib/fonts.js";
import React from "react";

// ArmViewToggle — one pill that cycles the current ARM through Current period
// → Next adjustment → Following adjustment → One more adjustment
// (Christo 2026-11-24). Each step is the worst-case caps path, so the LO can
// send "here's today", then "here's after next November", and so on.
// Only the adjustments that exist are offered (a loan at its ceiling stops).
//
// Props: T, fmt, steps (calc.refiArmTodaySteps), view (0-3), onView(n),
//        todayRate, todayPayment, compact

const NAMES = ["Current period", "Next adjustment", "Following adjustment", "One more adjustment"];

export default function ArmViewToggle({ T, fmt, steps = [], view = 0, onView, todayRate, todayPayment, compact = false }) {
  if (!steps.length || !onView) return null;
  const count = steps.length + 1;
  const v = Math.min(view, count - 1);
  const st = v > 0 ? steps[v - 1] : null;
  const when = st ? st.date.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "today";
  const r = st ? st.rate : Number(todayRate) || 0;
  const p = st ? st.payment : Number(todayPayment) || 0;
  const next = (v + 1) % count;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: compact ? "flex-start" : "center", fontFamily: FONT }}>
      <button type="button" onClick={() => onView(next)}
        title={`Show the current loan at: ${NAMES[next]}`}
        aria-label={`Current loan shown at ${NAMES[v]}. Click for ${NAMES[next]}.`}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px 7px 10px", borderRadius: 9999, cursor: "pointer",
          border: `1px solid ${v ? T.orange : T.blue}55`, background: v ? `${T.orange}14` : `${T.blue}10`,
          color: v ? T.orange : T.blue, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
        }}>
        <span style={{ display: "inline-flex", gap: 3 }} aria-hidden="true">
          {Array.from({ length: count }, (_, i) => (
            <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i === v ? (v ? T.orange : T.blue) : T.separator }} />
          ))}
        </span>
        {NAMES[v]}
        <span style={{ fontFamily: MONO, fontSize: 10, opacity: 0.75 }}>▸</span>
      </button>
      <span style={{ fontSize: 12, color: T.textSecondary }}>
        Current loan {st ? `after the ${when} adjustment (worst case)` : "as it stands today"}: <strong style={{ color: T.text }}>{r.toFixed(3)}%</strong>, {fmt(p)}/mo P&amp;I
      </span>
    </div>
  );
}
