import React from "react";
import { FONT } from "../lib/fonts.js";
import { postToHost } from "../lib/embed.js";

// The RealStack Ops Blueprint panel's own controls, drawn at the right end of
// Blueprint's header row when Ops frames us (EMBED === "ops"), so the panel
// needs no header bar of its own (2026-10-31). Every click is a message to
// Ops (BlueprintPanel.jsx listens); Ops answers with "panel-state" so the
// active width / pin reflect what Ops actually did.
const PRESETS = [[1 / 3, "⅓"], [1 / 2, "½"], [2 / 3, "⅔"], [1, "Full"]];

export default function EmbedPanelControls({ T, frac, follow, popoutUrl }) {
  const round = { display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 9999, border: `1px solid ${T.separator}`, background: "transparent", color: T.textSecondary, cursor: "pointer", flexShrink: 0, padding: 0 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, fontFamily: FONT }}>
      <div role="group" aria-label="Panel width" style={{ display: "flex", padding: 2, borderRadius: 9999, background: T.pillBg || T.inputBg }}>
        {PRESETS.map(([f, label]) => {
          const on = Math.abs(frac - f) < 0.01;
          return (
            <button key={label} type="button" aria-pressed={on} onClick={() => postToHost({ type: "panel", action: "frac", value: f })}
              style={{ border: "none", borderRadius: 9999, padding: "3px 8px", fontSize: 11, cursor: "pointer", fontFamily: FONT,
                background: on ? T.card : "transparent", color: on ? T.blue : T.textTertiary, fontWeight: on ? 700 : 500 }}>{label}</button>
          );
        })}
      </div>
      <button type="button" aria-pressed={!follow} onClick={() => postToHost({ type: "panel", action: "follow", value: !follow })}
        title={follow ? "Pin this borrower: other Blueprint links in Ops open in a new tab" : "Pinned. Click to let Blueprint links in Ops open here"}
        aria-label={follow ? "Pin this borrower" : "Unpin"}
        style={{ ...round, ...(follow ? {} : { color: T.orange, borderColor: `${T.orange}66`, background: `${T.orange}18` }) }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill={follow ? "none" : "currentColor"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17v5" /><path d="M9 10.76V6h6v4.76l2.5 3.24H6.5z" /><path d="M8 3h8" /></svg>
      </button>
      <a href={popoutUrl} target="_blank" rel="noopener noreferrer" title="Open in a new tab" aria-label="Open in a new tab" style={{ ...round, textDecoration: "none" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
      </a>
      <button type="button" onClick={() => postToHost({ type: "panel", action: "close" })} title="Close the Blueprint panel" aria-label="Close the Blueprint panel" style={round}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}
