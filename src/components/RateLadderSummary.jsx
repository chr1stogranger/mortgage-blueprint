import { FONT, MONO } from "../lib/fonts.js";
import React, { useMemo } from "react";
import { buildLadderView, fmtRate, ptsLabel, moLabel } from "../lib/rateLadder.js";

/* ═══════════════════════════════════════════════════════════════
   RATE LADDER SUMMARY — the read-only card on the Share tab.
   Sweet-spot line + a compact ladder (rate, price, per-month, breakeven,
   verdict). Same view-model as the Overview section, no editing.
   ═══════════════════════════════════════════════════════════════ */

const BAND_COLOR = (T, key) => ({
  free: T.green, nobrainer: T.green, sense: T.blue, situational: T.orange, hold: T.textSecondary, none: T.textTertiary,
}[key] || T.textTertiary);
const money = (v) => (v < 0 ? "−" : "") + "$" + Math.round(Math.abs(v)).toLocaleString("en-US");

export default function RateLadderSummary({ T, calc, term, isRefi, rateLadder, Card }) {
  const view = useMemo(() => buildLadderView({ calc, term, isRefi, rateLadder }), [calc, term, isRefi, rateLadder]);
  const { ladder, spot, holdYears, tax, L } = view;
  if (!ladder.rows.length) return null;
  const Wrap = Card || (({ children }) => <div style={{ background: T.card, borderRadius: 16, padding: 18, boxShadow: T.cardShadow, marginBottom: 12 }}>{children}</div>);
  const rows = ladder.rows.filter(r => !r.dominated);
  return (
    <Wrap>
      {spot ? (
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, background: `linear-gradient(${T.blue}18, ${T.blue}18), ${T.card}`, border: `1.5px solid ${T.blue}73`, marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, color: T.blue }}>Sweet spot · {holdYears}-yr hold</div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, color: T.text, fontFamily: FONT }}>{fmtRate(spot.rate)}</div>
          </div>
          <div style={{ fontSize: 12.5, color: T.textSecondary, lineHeight: 1.5, fontFamily: FONT }}>
            {ptsLabel(spot.pts)} · {money(spot.cost)} at closing · pays back in <b style={{ color: T.text }}>{Math.round(spot.breakeven)} months</b> · ahead <b style={{ color: T.text }}>{money(spot.cumAtHold)}</b> by year {holdYears}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: T.textSecondary, lineHeight: 1.5, fontFamily: FONT, marginBottom: 12 }}>
          No rung pays for itself within {holdYears} years against {fmtRate(ladder.base.rate)}. Stay at the baseline, or take a credit if cash to close matters more.
        </div>
      )}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 420, fontFamily: FONT, fontSize: 12.5 }}>
          <thead><tr>
            {["Rate", "Price", "Per month", "Breakeven", "Verdict"].map((h, i) => (
              <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "6px 6px", borderBottom: `1px solid ${T.separator}`, fontFamily: MONO, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, color: T.textTertiary, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map(r => {
              const isSpot = spot && r.idx === spot.idx;
              const c = r.isBase ? T.textSecondary : T.text;
              const credit = r.cost < 0;
              const band = r.isBase ? null : credit ? { key: "hold", label: `Credit lasts ${moLabel(r.breakeven)}` } : r.band;
              const bc = band ? BAND_COLOR(T, band.key) : T.textTertiary;
              return (
                <tr key={r.idx} style={{ background: isSpot ? `${T.blue}14` : "transparent" }}>
                  <td style={{ padding: "7px 6px", borderBottom: `1px solid ${T.separator}`, fontWeight: 700, color: c, whiteSpace: "nowrap" }}>{fmtRate(r.rate)}{r.isBase && <span style={{ fontSize: 10, fontWeight: 500, color: T.textTertiary, marginLeft: 6 }}>baseline</span>}</td>
                  <td style={{ padding: "7px 6px", borderBottom: `1px solid ${T.separator}`, textAlign: "right", color: T.textSecondary, whiteSpace: "nowrap" }}>{ptsLabel(r.pts)}</td>
                  <td style={{ padding: "7px 6px", borderBottom: `1px solid ${T.separator}`, textAlign: "right", fontWeight: 600, color: r.isBase ? T.textTertiary : r.delta > 0 ? T.green : T.red, whiteSpace: "nowrap" }}>{r.isBase ? "—" : `${r.delta > 0 ? "−" : "+"}${money(Math.abs(r.delta))}`}</td>
                  <td style={{ padding: "7px 6px", borderBottom: `1px solid ${T.separator}`, textAlign: "right", fontWeight: 800, color: c, whiteSpace: "nowrap" }}>{r.isBase ? "—" : moLabel(r.breakeven)}</td>
                  <td style={{ padding: "7px 6px", borderBottom: `1px solid ${T.separator}`, textAlign: "right", whiteSpace: "nowrap" }}>
                    {band && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 9999, background: `${bc}18`, color: bc, fontSize: 10.5, fontWeight: 700 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: bc }} />{isSpot ? "Sweet spot" : band.label}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* The ladder is 420px wide at minimum; phones scroll it sideways, same hint Debts and Tax use. */}
      <div className="bp-swipe-hint" style={{ fontSize: 9, color: T.textTertiary, fontFamily: FONT, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 6, textAlign: "right" }}>Swipe to see more →</div>
      <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.5, marginTop: 8, fontFamily: FONT }}>
        Tax basis {tax.label} · {tax.note}.{L.asOf ? ` Pricing as of ${L.asOf}${L.ltvBand ? `, ${L.ltvBand} LTV` : ""}.` : ""}{L.estimated ? " Estimated pricing." : ""} Cash breakeven only; a lower rate also pays principal down faster.
      </div>
    </Wrap>
  );
}
