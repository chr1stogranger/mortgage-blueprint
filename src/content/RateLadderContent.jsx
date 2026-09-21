import { FONT, MONO } from "../lib/fonts.js";
import { todayLocal } from "../lib/today.js";
import React, { useMemo, useState } from "react";
import { devCheckProps } from "../lib/devPropCheck.js";
import { compareRungs, scaffoldRateLadder } from "../lib/finance.js";
import { buildLadderView, fmtRate as fmtPct3, ptsLabel, moLabel as mo } from "../lib/rateLadder.js";

/* ═══════════════════════════════════════════════════════════════
   RATE & POINTS BREAKEVEN — Overview section (Option A, table-first;
   Christo picked it from side-by-side mockups 2026-09-11).

   Buy the rate down, take a lender credit, or stay at par: every rung of
   the LO's rate-sheet ladder priced against a baseline, with the cash
   breakeven, the marginal step, a verdict band, and the position at the
   borrower's expected hold. Math lives in finance.js (computeRateLadder /
   compareRungs) — nothing is recomputed here.

   State (persisted per scenario as `rateLadder`):
     { rungs: [{rate, pts}], baseIdx, holdYears, taxMode: "auto"|"manual"|"off",
       taxManualPct, asOf, ltvBand, estimated }
   ═══════════════════════════════════════════════════════════════ */

const BAND_COLOR = (T, key) => ({
  free: T.green, nobrainer: T.green, sense: T.blue, situational: T.orange, hold: T.textSecondary, none: T.textTertiary,
}[key] || T.textTertiary);

const money = (v) => (v < 0 ? "−" : "") + "$" + Math.round(Math.abs(v)).toLocaleString("en-US");
const money2 = (v) => (v < 0 ? "−" : "") + "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Band({ T, band, small }) {
  const c = BAND_COLOR(T, band.key);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: small ? "2px 7px" : "3px 9px", borderRadius: 9999, background: `${c}18`, color: c, fontSize: small ? 10 : 11, fontWeight: 700, whiteSpace: "nowrap", fontFamily: FONT }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />{band.label}
    </span>
  );
}

// Tiny numeric cell — commits on blur/Enter so a half-typed "6." never
// re-sorts the ladder under the cursor.
function NumCell({ T, value, onCommit, suffix, width = 78, step = 0.125, ariaLabel }) {
  const [edit, setEdit] = useState(null);
  const commit = () => { if (edit === null) return; const n = parseFloat(edit); if (isFinite(n)) onCommit(n); setEdit(null); };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <input aria-label={ariaLabel} type="text" inputMode="decimal" value={edit === null ? value : edit}
        onFocus={() => setEdit(String(value))} onChange={(e) => setEdit(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "ArrowUp") { e.preventDefault(); onCommit(+(value + step).toFixed(3)); } if (e.key === "ArrowDown") { e.preventDefault(); onCommit(+(value - step).toFixed(3)); } }}
        style={{ width, background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 8, padding: "5px 8px", color: T.text, fontSize: 13, fontWeight: 600, fontFamily: FONT, textAlign: "right", outline: "none" }} />
      {suffix && <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT }}>{suffix}</span>}
    </span>
  );
}

function Pill({ T, children, onClick, primary, disabled, title }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      border: `1px solid ${primary ? T.blue : T.inputBorder}`, background: primary ? T.blue : "transparent", color: primary ? "#fff" : T.blue,
      borderRadius: 9999, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", fontFamily: FONT, whiteSpace: "nowrap", opacity: disabled ? 0.5 : 1,
    }}>{children}</button>
  );
}

function Overline({ T, children, color }) {
  return <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, color: color || T.textTertiary }}>{children}</div>;
}

/* ── Cumulative net benefit chart: one line per rung below the baseline, the
   sweet spot emphasized, the hold marked. Text takes theme tokens; only the
   emphasized mark carries the accent. ── */
function BenefitChart({ T, ladder, holdYears }) {
  const [hover, setHover] = useState(null);
  const W = 640, H = 260, L = 50, R = 74, TOP = 18, B = 32, MONTHS = 120;
  const series = ladder.rows.filter(r => !r.isBase && !r.dominated && r.rate < ladder.base.rate);
  if (!series.length) return <div style={{ fontSize: 12, color: T.textTertiary, fontFamily: FONT }}>Add a rung below the baseline to chart it.</div>;
  let ymin = 0, ymax = 0;
  series.forEach(s => { ymin = Math.min(ymin, -s.netCost); ymax = Math.max(ymax, MONTHS * (s.netDelta ?? s.delta) - s.netCost); });
  const pad = (ymax - ymin) * 0.06 || 100; ymin -= pad; ymax += pad;
  const x = m => L + (m / MONTHS) * (W - L - R);
  const y = v => TOP + (1 - (v - ymin) / (ymax - ymin)) * (H - TOP - B);
  const span = ymax - ymin, raw = span / 5, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const stepV = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => span / s <= 6) || mag * 10;
  const yticks = []; for (let v = Math.ceil(ymin / stepV) * stepV; v <= ymax; v += stepV) yticks.push(Math.round(v));
  const hold = holdYears * 12;
  const hotIdx = ladder.spot ? ladder.spot.idx : -1;
  const ordered = series.slice().sort((a, b) => (a.idx === hotIdx) - (b.idx === hotIdx));
  const labelYs = [];
  const muted = T.textTertiary;
  return (
    <div style={{ position: "relative" }}
      onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Cumulative net benefit of each rate versus the baseline, by months into the loan"
        onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const px = (e.clientX - rect.left) / rect.width * W; const m = Math.max(0, Math.min(MONTHS, Math.round((px - L) / (W - L - R) * MONTHS))); setHover({ m, px: e.clientX - rect.left, py: e.clientY - rect.top, w: rect.width }); }}>
        {yticks.map(v => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={T.separator} strokeWidth="1" />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill={T.textTertiary} fontFamily={FONT}>{v === 0 ? "$0" : `${(v / 1000).toFixed(0)}k`}</text>
          </g>
        ))}
        {[0, 24, 48, 72, 96, 120].map(m => (
          <text key={m} x={x(m)} y={H - B + 18} textAnchor="middle" fontSize="11" fill={T.textTertiary} fontFamily={FONT}>{m === 0 ? "close" : `${m / 12} yr`}</text>
        ))}
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke={muted} strokeWidth="1" />
        {hold <= MONTHS && (
          <g>
            <line x1={x(hold)} x2={x(hold)} y1={TOP} y2={H - B} stroke={T.textSecondary} strokeWidth="1" strokeDasharray="3 4" />
            <text x={x(hold)} y={TOP - 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={T.textSecondary} fontFamily={FONT}>hold · {holdYears} yr</text>
          </g>
        )}
        {ordered.map(s => {
          const hot = s.idx === hotIdx;
          const pts = []; for (let m = 0; m <= MONTHS; m += 2) pts.push(`${x(m).toFixed(1)},${y(m * (s.netDelta ?? s.delta) - s.netCost).toFixed(1)}`);
          const ye = y(MONTHS * (s.netDelta ?? s.delta) - s.netCost);
          let ly = ye; labelYs.sort((a, b) => a - b).forEach(o => { if (Math.abs(ly - o) < 13) ly = o + 13; }); labelYs.push(ly);
          return (
            <g key={s.idx}>
              <polyline points={pts.join(" ")} fill="none" stroke={hot ? T.blue : muted} strokeWidth={hot ? 3 : 2} strokeLinejoin="round" strokeLinecap="round" opacity={hot ? 1 : 0.7} />
              <circle cx={x(MONTHS)} cy={ye} r={hot ? 5 : 3.5} fill={hot ? T.blue : muted} stroke={hot ? T.card : "none"} strokeWidth="2" />
              <text x={x(MONTHS) + 9} y={ly + 4} fontSize="11" fontWeight={hot ? 700 : 600} fill={hot ? T.text : T.textSecondary} fontFamily={FONT}>{fmtPct3(s.rate)}</text>
              {s.breakeven !== null && s.breakeven > 0 && s.breakeven <= MONTHS && (
                <circle cx={x(s.breakeven)} cy={y(0)} r={hot ? 4 : 3} fill={T.card} stroke={hot ? T.blue : muted} strokeWidth="2" />
              )}
            </g>
          );
        })}
        {hover && <line x1={x(hover.m)} x2={x(hover.m)} y1={TOP} y2={H - B} stroke={T.textTertiary} strokeWidth="1" opacity="0.6" />}
      </svg>
      {hover && (
        <div style={{ position: "absolute", left: Math.min(hover.px + 12, hover.w - 170), top: hover.py + 12, pointerEvents: "none", background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.cardShadow, borderRadius: 10, padding: "8px 10px", fontSize: 12, lineHeight: 1.5, minWidth: 150, fontFamily: FONT, color: T.text, zIndex: 2 }}>
          <b>Month {hover.m}</b> · year {(hover.m / 12).toFixed(1)}
          {series.slice().sort((a, b) => (MONTHS * (b.netDelta ?? b.delta) - b.netCost) - (MONTHS * (a.netDelta ?? a.delta) - a.netCost)).map(s => {
            const v = hover.m * (s.netDelta ?? s.delta) - s.netCost;
            return <div key={s.idx}>{fmtPct3(s.rate)}: <b style={{ color: v >= 0 ? T.green : T.red }}>{money(v)}</b></div>;
          })}
        </div>
      )}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: T.textSecondary, marginTop: 6, fontFamily: FONT }}>
        <span><span style={{ display: "inline-block", width: 16, borderTop: `3px solid ${T.blue}`, verticalAlign: "middle", marginRight: 6 }} />Sweet spot</span>
        <span><span style={{ display: "inline-block", width: 16, borderTop: `2px solid ${muted}`, verticalAlign: "middle", marginRight: 6 }} />Other rungs</span>
        <span><span style={{ display: "inline-block", width: 16, borderTop: `1px dashed ${T.textSecondary}`, verticalAlign: "middle", marginRight: 6 }} />Your hold</span>
        <span>○ crosses $0 at breakeven</span>
      </div>
    </div>
  );
}

export default function RateLadderContent(props) {
  if (import.meta.env.DEV) devCheckProps("RateLadderContent", props, ["T", "isDesktop", "calc", "isRefi", "rate", "setRate", "term", "setDiscountPts", "setLenderCredit", "rateLadder", "setRateLadder", "Card"]);
  const { T, isDesktop, calc, isRefi, rate, setRate, term, setDiscountPts, setLenderCredit, rateLadder, setRateLadder, Card } = props;

  const L = rateLadder || {};
  const rungs = L.rungs || [];
  const holdYears = L.holdYears || 5;
  const taxMode = L.taxMode || "auto";
  const patch = (p) => setRateLadder({ ...L, ...p });

  // Shared view-model (also feeds the Share card and the PDF page) — same
  // tax basis, same rows, same sweet spot on every surface.
  const view = useMemo(() => buildLadderView({ calc, term, isRefi, rateLadder }), [calc, term, isRefi, rateLadder]);
  const { loan, tax, ladder, ltvNow, ltvDrift, spot, nextLower } = view;
  const taxRate = tax.taxRate, deductPct = tax.deductPct, taxLabel = tax.label, taxNote = tax.note;

  const [cmp, setCmp] = useState({ a: 0, b: -1 });
  const [editing, setEditing] = useState(rungs.length === 0);

  // ── Ladder editing (sorted rows index the SAME order finance.js sorts, so
  //    idx maps back to a rung by value, not position) ──
  const setRungs = (next) => patch({ rungs: next, estimated: false, baseIdx: Math.min(L.baseIdx || 0, Math.max(0, next.length - 1)) });
  const findRung = (row) => rungs.findIndex(r => +r.rate === row.rate && +r.pts === row.pts);
  const updateRung = (row, field, val) => { const i = findRung(row); if (i < 0) return; setRungs(rungs.map((r, j) => j === i ? { ...r, [field]: val } : r)); };
  const removeRung = (row) => { const i = findRung(row); if (i < 0) return; setRungs(rungs.filter((_, j) => j !== i)); };
  // Ladders run long in practice (10+ rungs, several credit options, off-rates
  // like 6.49 or 6.999) — both adders just extend the ends; every cell stays
  // free-typed and the ladder re-sorts by rate.
  const addRung = () => {
    const lowest = rungs.length ? Math.min(...rungs.map(r => +r.rate)) : (rate || 6.5);
    const lowestPts = rungs.length ? Math.max(...rungs.map(r => +r.pts)) : 0;
    setRungs([...rungs, { rate: +(lowest - 0.125).toFixed(3), pts: +(lowestPts + 0.45).toFixed(3) }]);
  };
  const addCreditRung = () => {
    const highest = rungs.length ? Math.max(...rungs.map(r => +r.rate)) : (rate || 6.5);
    const highestPts = rungs.length ? Math.min(...rungs.map(r => +r.pts)) : 0;
    setRungs([...rungs, { rate: +(highest + 0.125).toFixed(3), pts: +(highestPts - 0.40).toFixed(3) }]);
  };
  const scaffold = () => {
    const s = scaffoldRateLadder(rate || 6.5);
    patch({ rungs: s, baseIdx: 2, estimated: true, asOf: L.asOf || todayLocal() });
  };
  const applyRung = (row) => {
    setRate(row.rate);
    if (row.pts > 0) { setDiscountPts(+row.pts.toFixed(3)); setLenderCredit(0); }
    else if (row.pts < 0) { setDiscountPts(0); setLenderCredit(Math.round(loan * Math.abs(row.pts) / 100)); }
    else { setDiscountPts(0); setLenderCredit(0); }
  };

  const th = (label, sub) => (
    <th style={{ textAlign: "right", padding: "8px 7px", borderBottom: `1px solid ${T.separator}`, whiteSpace: "nowrap", verticalAlign: "bottom" }}>
      <Overline T={T}>{label}</Overline>
      <div style={{ fontSize: 10, fontWeight: 500, color: T.textTertiary, fontFamily: FONT }}>{sub || " "}</div>
    </th>
  );
  const td = (children, extra) => <td style={{ textAlign: "right", padding: "8px 7px", borderBottom: `1px solid ${T.separator}`, whiteSpace: "nowrap", fontFamily: FONT, fontSize: 12.5, ...extra }}>{children}</td>;
  const sub = (text, color) => <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: color || T.textTertiary }}>{text}</span>;

  /* ─────────────── Empty state ─────────────── */
  if (!rungs.length) {
    return (
      <Card>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: FONT }}>Price the ladder</div>
        <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.55, marginTop: 6, maxWidth: 560, fontFamily: FONT }}>
          Enter the rate-sheet rungs around {fmtPct3(rate || 6.5)}: each rate and what it costs in points, negative for a lender credit. Or scaffold an estimated ladder now and paste real pricing over it.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <Pill T={T} primary onClick={scaffold}>Scaffold around {fmtPct3(rate || 6.5)}</Pill>
          <Pill T={T} onClick={() => { patch({ rungs: [{ rate: rate || 6.5, pts: 0 }], baseIdx: 0 }); setEditing(true); }}>Start from par</Pill>
        </div>
      </Card>
    );
  }

  return (
    <div>
      {/* ═══ Setup: hold horizon, baseline, tax basis, pricing context ═══ */}
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1.3fr 1fr" : "1fr", gap: "14px 20px" }}>
          <div>
            <Overline T={T}>How long will you keep this loan?</Overline>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", fontFamily: FONT, color: T.text, minWidth: 60 }}>{holdYears} yrs</span>
              <input type="range" min="2" max="15" step="1" value={holdYears} aria-label="Expected hold in years" onChange={(e) => patch({ holdYears: +e.target.value })} style={{ flex: 1, accentColor: T.blue }} />
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5, marginTop: 4, fontFamily: FONT }}>Sell, refinance, or pay off before then and points you paid stop paying you back. This one number decides the sweet spot.</div>
          </div>
          <div>
            <Overline T={T}>Comparing against</Overline>
            <select value={ladder.base ? ladder.base.idx : 0} onChange={(e) => patch({ baseIdx: +e.target.value })} aria-label="Baseline rung"
              style={{ marginTop: 6, background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 10, padding: "7px 10px", color: T.text, fontSize: 13, fontWeight: 700, fontFamily: FONT, width: "100%" }}>
              {ladder.rows.map(r => <option key={r.idx} value={r.idx}>{fmtPct3(r.rate)} · {ptsLabel(r.pts)}</option>)}
            </select>
            <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5, marginTop: 8, fontFamily: FONT }}>
              Tax basis <b style={{ color: T.text }}>{taxLabel}</b> · {taxNote}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              {["auto", "manual", "off"].map(m => (
                <button key={m} onClick={() => patch({ taxMode: m })} aria-pressed={taxMode === m} style={{ border: `1px solid ${taxMode === m ? T.blue : T.inputBorder}`, background: taxMode === m ? `${T.blue}18` : "transparent", color: taxMode === m ? T.blue : T.textSecondary, borderRadius: 9999, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                  {m === "auto" ? "From Tax Savings" : m === "manual" ? "Type a bracket" : "Pre-tax"}
                </button>
              ))}
              {taxMode === "manual" && <NumCell T={T} value={+L.taxManualPct || 0} onCommit={(v) => patch({ taxManualPct: v })} suffix="%" width={60} step={1} ariaLabel="Manual tax bracket" />}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 9999, background: T.pillBg, fontSize: 11, fontWeight: 600, color: T.textSecondary, fontFamily: FONT }}>
                Pricing as of <input type="date" value={L.asOf || ""} onChange={(e) => patch({ asOf: e.target.value })} aria-label="Pricing as-of date" style={{ background: "transparent", border: "none", color: T.text, fontFamily: FONT, fontSize: 11, fontWeight: 700 }} />
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 9999, background: ltvDrift ? `${T.orange}18` : T.pillBg, fontSize: 11, fontWeight: 600, color: ltvDrift ? T.orange : T.textSecondary, fontFamily: FONT }}>
                LTV band <input type="text" placeholder="70.01–75%" value={L.ltvBand || ""} onChange={(e) => patch({ ltvBand: e.target.value })} aria-label="Rate-sheet LTV band" style={{ width: 84, background: "transparent", border: "none", borderBottom: `1px dashed ${T.inputBorder}`, color: T.text, fontFamily: FONT, fontSize: 11, fontWeight: 700, outline: "none" }} />
                {ltvNow > 0 && <span>· today {ltvNow.toFixed(1)}%{ltvDrift ? " — outside this band, reprice" : ""}</span>}
              </span>
              {L.estimated && <span style={{ padding: "4px 10px", borderRadius: 9999, background: `${T.orange}18`, color: T.orange, fontSize: 11, fontWeight: 700, fontFamily: FONT }}>Estimated pricing — paste the rate sheet</span>}
            </div>
          </div>
        </div>
      </Card>

      {/* ═══ Sweet spot + ladder table ═══ */}
      <Card>
        {spot ? (
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "auto 1fr auto" : "1fr", gap: 14, alignItems: "center", padding: "14px 16px", borderRadius: 14, background: `linear-gradient(${T.blue}18, ${T.blue}18), ${T.card}`, border: `1.5px solid ${T.blue}73` }}>
            <div>
              <Overline T={T} color={T.blue}>Sweet spot · {holdYears}-yr hold</Overline>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: T.text, fontFamily: FONT, marginTop: 4 }}>{fmtPct3(spot.rate)}</div>
              <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 4, fontFamily: FONT }}>{ptsLabel(spot.pts)} · {money(spot.cost)} {spot.cost >= 0 ? "more" : "back"} at closing</div>
            </div>
            <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5, fontFamily: FONT }}>
              Pays back in <b style={{ color: T.text }}>{Math.round(spot.breakeven)} months</b> and each step down to it also earns its keep. Ahead <b style={{ color: T.text }}>{money(spot.cumAtHold)}</b> in cash by year {holdYears}, plus <b style={{ color: T.text }}>{money(spot.equityAtHold)}</b> more principal paid down.
              {nextLower && <> The next step to {fmtPct3(nextLower.rate)} needs <b style={{ color: T.text }}>{nextLower.step && nextLower.step.breakeven !== null ? `${Math.round(nextLower.step.breakeven)} months` : "longer"}</b> to pay back on its own.</>}
            </div>
            <div><Pill T={T} primary onClick={() => applyRung(spot)}>Use {fmtPct3(spot.rate)}</Pill></div>
          </div>
        ) : (
          <div style={{ padding: "14px 16px", borderRadius: 14, background: `linear-gradient(${T.blue}10, ${T.blue}10), ${T.card}`, border: `1px solid ${T.cardBorder}`, fontSize: 13, color: T.textSecondary, lineHeight: 1.5, fontFamily: FONT }}>
            No rung pays for itself within <b style={{ color: T.text }}>{holdYears} years</b> against {ladder.base ? fmtPct3(ladder.base.rate) : "the baseline"}. Stay at the baseline, or take a credit if cash to close matters more.
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 0 4px", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: FONT }}>The ladder</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {editing && <Pill T={T} onClick={addCreditRung} title="Add a higher rate with a lender credit">+ Credit rung</Pill>}
            {editing && <Pill T={T} onClick={addRung} title="Add a lower rate that costs points">+ Lower rate</Pill>}
            {editing && <Pill T={T} onClick={scaffold} title="Replace with an estimated ladder around the scenario rate">Re-scaffold</Pill>}
            <Pill T={T} onClick={() => setEditing(!editing)}>{editing ? "Done" : "Edit pricing"}</Pill>
          </div>
        </div>

        {isDesktop ? (
          <div style={{ overflowX: "auto", margin: "0 -18px", padding: "0 18px" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 640 }}>
              <thead><tr>
                <th style={{ textAlign: "left", padding: "8px 7px", borderBottom: `1px solid ${T.separator}`, position: "sticky", left: 0, background: T.card, zIndex: 1, verticalAlign: "bottom" }}><Overline T={T}>Rate</Overline><div style={{ fontSize: 10, fontWeight: 500, color: T.textTertiary, fontFamily: FONT }}>price</div></th>
                {th("Payment", "P&I · vs baseline")}
                {th("Cost", "at closing")}
                {th("Net cost", taxRate > 0 ? "after tax" : "pre-tax")}
                {th("Breakeven", "vs baseline · this step")}
                {th("Verdict")}
                {th(`At ${holdYears} yrs`, "cash ahead")}
                <th style={{ borderBottom: `1px solid ${T.separator}` }} />
              </tr></thead>
              <tbody>
                {ladder.rows.map(r => {
                  const isSpot = spot && r.idx === spot.idx;
                  const rowBg = isSpot ? `${T.blue}14` : "transparent";
                  const dim = r.dominated ? T.textTertiary : r.isBase ? T.textSecondary : T.text;
                  const first = (
                    <td style={{ textAlign: "left", padding: "8px 7px", borderBottom: `1px solid ${T.separator}`, position: "sticky", left: 0, background: isSpot ? `linear-gradient(${T.blue}14, ${T.blue}14), ${T.card}` : T.card, zIndex: 1, whiteSpace: "nowrap", fontFamily: FONT }}>
                      {editing ? (
                        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <NumCell T={T} value={r.rate} onCommit={(v) => updateRung(r, "rate", v)} suffix="%" width={70} ariaLabel="Rate" />
                          <NumCell T={T} value={r.pts} onCommit={(v) => updateRung(r, "pts", v)} suffix="pts" width={70} step={0.125} ariaLabel="Points (negative for credit)" />
                          <button type="button" onClick={() => removeRung(r)} aria-label="Remove rung" style={{ background: "none", border: "none", color: T.textTertiary, cursor: "pointer", fontSize: 14, padding: 0, minWidth: 32, minHeight: 32, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>×</button>
                        </span>
                      ) : (
                        <>
                          <span style={{ fontWeight: 700, fontSize: 14, color: dim, textDecoration: r.dominated ? "line-through" : "none" }}>{fmtPct3(r.rate)}</span>
                          {sub(`${ptsLabel(r.pts)}${r.isBase ? " · baseline" : ""}`)}
                        </>
                      )}
                    </td>
                  );
                  if (r.isBase) return (
                    <tr key={r.idx}>{first}{td(money2(r.pi), { color: dim })}{td("—", { color: dim })}{td("—", { color: dim })}{td("—", { color: dim })}{td("—", { color: dim })}{td("—", { color: dim })}{td("")}</tr>
                  );
                  const credit = r.cost < 0;
                  return (
                    <tr key={r.idx} style={{ background: rowBg }}>
                      {first}
                      {td(<>{money2(r.pi)}{sub(`${r.delta > 0 ? "−" : "+"}${money2(Math.abs(r.delta))}/mo`, r.delta > 0 ? T.green : T.red)}</>, { color: dim })}
                      {td(<>{money(r.cost)}{sub(credit ? "credit, no tax effect" : taxRate > 0 ? `after tax ${money(r.postTaxCost)} · lost write-off −${money2(r.writeOffMonthly)}/mo → net −${money2(r.netDelta)}/mo` : " ")}</>, { color: dim })}
                      {td(<b>{money(r.netCost)}</b>, { color: dim })}
                      {td(<><span style={{ fontWeight: 800, fontSize: 15 }}>{mo(r.breakeven)}</span>{sub(r.step ? `step ${mo(r.step.breakeven)}` : " ")}</>, { color: dim })}
                      {td(r.dominated ? <Band T={T} band={{ key: "none", label: `Skip · ${fmtPct3(r.dominatedBy)} is cheaper` }} /> : credit ? <Band T={T} band={{ key: "hold", label: `Credit lasts ${mo(r.breakeven)}` }} /> : <Band T={T} band={r.band} />)}
                      {td(<><span style={{ fontWeight: 700, color: r.cumAtHold >= 0 ? T.green : T.red }}>{money(r.cumAtHold)}</span>{sub(`${r.equityAtHold >= 0 ? "+" : ""}${money(r.equityAtHold)} equity`)}</>)}
                      {td(r.dominated ? "" : <Pill T={T} onClick={() => applyRung(r)}>Use</Pill>, { paddingRight: 0 })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── Mobile: one card per rung, the verdict leads ── */
          <div>
            {ladder.rows.map(r => {
              const isSpot = spot && r.idx === spot.idx;
              const cardStyle = { background: isSpot ? `linear-gradient(${T.blue}14, ${T.blue}14), ${T.card}` : T.card, border: `1px solid ${isSpot ? `${T.blue}8C` : T.cardBorder}`, borderRadius: 14, padding: "12px 14px", marginTop: 8, opacity: r.dominated ? 0.6 : 1, fontFamily: FONT };
              if (editing) return (
                <div key={r.idx} style={cardStyle}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                    <NumCell T={T} value={r.rate} onCommit={(v) => updateRung(r, "rate", v)} suffix="%" width={74} ariaLabel="Rate" />
                    <NumCell T={T} value={r.pts} onCommit={(v) => updateRung(r, "pts", v)} suffix="pts" width={74} step={0.125} ariaLabel="Points (negative for credit)" />
                    <button type="button" onClick={() => removeRung(r)} aria-label="Remove rung" style={{ background: "none", border: "none", color: T.textTertiary, cursor: "pointer", fontSize: 16, padding: 0, minWidth: 36, minHeight: 36, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>
                </div>
              );
              if (r.isBase) return (
                <div key={r.idx} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: T.text }}>{fmtPct3(r.rate)}</span>
                    <span style={{ padding: "3px 9px", borderRadius: 9999, background: T.pillBg, fontSize: 11, fontWeight: 600, color: T.textSecondary }}>Baseline · {ptsLabel(r.pts)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 4 }}>{money2(r.pi)}/mo P&I</div>
                </div>
              );
              if (r.dominated) return (
                <div key={r.idx} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: T.textTertiary, textDecoration: "line-through" }}>{fmtPct3(r.rate)}</span>
                    <Band T={T} band={{ key: "none", label: "Skip" }} />
                  </div>
                  <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 4 }}>{ptsLabel(r.pts)} · {fmtPct3(r.dominatedBy)} costs less</div>
                </div>
              );
              const credit = r.cost < 0;
              return (
                <div key={r.idx} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: T.text }}>{fmtPct3(r.rate)}</span>
                    {isSpot ? <Band T={T} band={{ key: "sense", label: "Sweet spot" }} /> : credit ? <Band T={T} band={{ key: "hold", label: `Credit lasts ${mo(r.breakeven)}` }} /> : <Band T={T} band={r.band} />}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 8 }}>
                    <div><div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{mo(r.breakeven)}</div><Overline T={T}>breakeven</Overline></div>
                    <div><div style={{ fontSize: 14, fontWeight: 700, color: r.delta > 0 ? T.green : T.red }}>{r.delta > 0 ? "−" : "+"}{money(Math.abs(r.delta))}</div><Overline T={T}>per month</Overline></div>
                    <div><div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{money(r.cost)}</div><Overline T={T}>{credit ? "credit" : "at closing"}</Overline></div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, fontSize: 11, color: T.textSecondary }}>
                    <span>{r.cumAtHold >= 0 ? "Ahead" : "Behind"} <b style={{ color: r.cumAtHold >= 0 ? T.green : T.red }}>{money(Math.abs(r.cumAtHold))}</b> at {holdYears} yrs · +{money(r.equityAtHold)} equity</span>
                    <Pill T={T} onClick={() => applyRung(r)}>Use</Pill>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <Band T={T} band={{ key: "nobrainer", label: "No-brainer · under 24 mo" }} small />
          <Band T={T} band={{ key: "sense", label: "Makes sense · 24–36" }} small />
          <Band T={T} band={{ key: "situational", label: "Situational · 36–48" }} small />
          <Band T={T} band={{ key: "hold", label: "Long-term hold · 48+" }} small />
        </div>
        <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.55, marginTop: 10, fontFamily: FONT }}>
          {isRefi ? "Points on a refinance deduct over the life of the loan, so no upfront tax offset is credited." : "Points paid on a purchase deduct in the year you close; a lender credit has no tax effect."} Write-off lost is year-one interest you no longer deduct. Breakeven is cash-only: it ignores the extra principal a lower rate pays down, shown separately. "This step" is the payback of moving from the rung above, skipping rungs a cheaper lower rate makes pointless. Check with your CPA.
        </div>
      </Card>

      {/* ═══ Net benefit over time ═══ */}
      {ladder.base && (
        <Card>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 10, fontFamily: FONT }}>Net benefit over time</div>
          <BenefitChart T={T} ladder={ladder} holdYears={holdYears} />
        </Card>
      )}

      {/* ═══ Compare any two ═══ */}
      {ladder.rows.length > 1 && (() => {
        const rows = ladder.rows;
        const ai = Math.min(cmp.a, rows.length - 1);
        const bi = cmp.b < 0 ? rows.length - 1 : Math.min(cmp.b, rows.length - 1);
        const a = rows[ai], b = rows[bi];
        const v = compareRungs(a, b, { loan, termYears: term || 30, taxRate, deductPct, pointsDeductible: !isRefi, holdMonths: holdYears * 12 });
        const selStyle = { width: "100%", background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 10, padding: "8px 10px", color: T.text, fontSize: 13, fontWeight: 600, fontFamily: FONT };
        const stat = (val, label, color) => (
          <div style={{ padding: "10px 12px", borderRadius: 12, background: T.pillBg }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", color: color || T.text, fontFamily: FONT }}>{val}</div>
            <Overline T={T}>{label}</Overline>
          </div>
        );
        return (
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 10, fontFamily: FONT }}>Compare any two</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
              <select value={ai} onChange={(e) => setCmp({ ...cmp, a: +e.target.value })} aria-label="From rung" style={selStyle}>{rows.map(r => <option key={r.idx} value={r.idx}>{fmtPct3(r.rate)} · {ptsLabel(r.pts)}</option>)}</select>
              <span style={{ fontSize: 11, color: T.textTertiary, fontWeight: 700, fontFamily: MONO }}>VS</span>
              <select value={bi} onChange={(e) => setCmp({ ...cmp, b: +e.target.value })} aria-label="To rung" style={selStyle}>{rows.map(r => <option key={r.idx} value={r.idx}>{fmtPct3(r.rate)} · {ptsLabel(r.pts)}</option>)}</select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: 8, marginTop: 10 }}>
              {stat(money(v.cost), v.cost >= 0 ? "more at closing" : "credit back")}
              {stat(`${v.delta >= 0 ? "−" : "+"}${money2(Math.abs(v.delta))}`, "per month", v.delta >= 0 ? T.green : T.red)}
              {stat(mo(v.breakeven), v.cost < 0 ? "credit lasts" : "breakeven")}
              {stat(money(v.cumAtHold), `ahead at ${holdYears} yrs`, v.cumAtHold >= 0 ? T.green : T.red)}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
              {v.cost < 0 ? <Band T={T} band={{ key: "hold", label: "Lender credit" }} /> : <Band T={T} band={v.band} />}
              <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT }}>Net cost {taxRate > 0 ? "after tax " : ""}{money(v.netCost)} · plus {money(v.equityAtHold)} extra principal paid down by year {holdYears}</span>
            </div>
          </Card>
        );
      })()}
    </div>
  );
}
