import React from "react";
import { FONT } from "../lib/fonts.js";
import { BACKGROUNDS } from "../lib/backgrounds.js";

// Settings → Appearance → Background (2026-10-31). Two named choices
// (Blueprint default, Match Ops) above a swatch grid of the Ops backgrounds.
// value: "default" | "ops" | a BACKGROUNDS id. showOps: signed-in LOs only.
const RIBBON_SWATCH = "linear-gradient(135deg, #38C6C6 0%, #F0C460 35%, #3B6BF5 65%, #8B7BF0 100%)";

export default function BackgroundPicker({ T, value, onChange, showOps }) {
  const chip = (key, label, sub) => {
    const on = value === key;
    return (
      <button key={key} type="button" aria-pressed={on} onClick={() => onChange(key)}
        style={{ flex: "1 1 160px", textAlign: "left", padding: "10px 12px", borderRadius: 12, cursor: "pointer", fontFamily: FONT,
          background: on ? `${T.blue}12` : T.inputBg, border: on ? `2px solid ${T.blue}` : `1px solid ${T.separator}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: on ? T.blue : T.text }}>{label}</div>
        <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2, lineHeight: 1.4 }}>{sub}</div>
      </button>
    );
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {chip("default", "Blueprint default", "The blueprint-paper house canvas")}
        {showOps && chip("ops", "Match Ops", "Whatever you picked in Ops → My Account → Appearance")}
      </div>
      <div role="radiogroup" aria-label="Background color" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))", gap: 8 }}>
        {BACKGROUNDS.map((b) => {
          const on = value === b.id;
          return (
            <button key={b.id} type="button" role="radio" aria-checked={on} aria-label={b.label} title={b.label} onClick={() => onChange(b.id)}
              style={{ height: 36, borderRadius: 10, cursor: "pointer", padding: 0,
                background: b.kind === "ribbons" ? RIBBON_SWATCH : b.css,
                border: on ? `3px solid ${T.blue}` : `1px solid ${T.separator}`,
                boxShadow: on ? `0 0 0 2px ${T.card} inset` : "none" }} />
          );
        })}
      </div>
    </div>
  );
}
