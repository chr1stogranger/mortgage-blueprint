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
function NumCell({ T, value, onCommit, suffix, width = 78, step = 0.125, ariaLabel, decimals = null }) {
  const [edit, setEdit] = useState(null);
  // At rest, show sheet precision (7.000 / −0.500); editing shows the raw value.
  const shown = decimals !== null && isFinite(+value) ? (+value).toFixed(decimals) : value;
  const commit = () => { if (edit === null) return; const n = parseFloat(edit); if (isFinite(n)) onCommit(n); setEdit(null); };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <input aria-label={ariaLabel} type="text" inputMode="decimal" value={edit === null ? shown : edit}
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
  const { loan, tax, ladder, ltvNow, ltvDrift, spot, creditPick, nextLower } = view;
  const taxRate = tax.taxRate, deductPct = tax.deductPct, taxLabel = tax.label, taxNote = tax.note;

  const [cmp, setCmp] = useState({ a: 0, b: -1 });

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
    patch({ rungs: s, baseAuto: true, estimated: true, asOf: L.asOf || todayLocal() });
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
          <Pill T={T} onClick={() => { patch({ rungs: [{ rate: rate || 6.5, pts: 0 }], baseIdx: 0 }); }}>Start from par</Pill>
        </div>
      </Card>
    );
  }

  // ── Matrix helpers (Christo 2026-09-24: "like my spreadsheet") ──
  // Every row compares to the rate one step above it — the sheet's "Compare
  // to" column — via finance.js's marginal `step`. ROI at N years is the
  // sheet's (N·monthly savings − net cost) ÷ net cost.
  const termMonths = (term || 30) * 12;
  // The sheet's 5/10/20/30 plus the slider's hold, highlighted.
  const ROI_YEARS = [...new Set([5, 10, 20, 30, holdYears])].sort((a, b) => a - b);
  const roiAt = (v, years) => (v && v.netCost > 0 ? (Math.min(years * 12, termMonths) * v.netDelta - v.netCost) / v.netCost : null);
  const pctCell = (x) => (x === null || !isFinite(x) ? "—" : `${(x * 100).toFixed(1)}%`);
  const showTax = taxRate > 0;
  const BAND_BG = (key) => ({ free: `${T.green}40`, nobrainer: `${T.green}40`, sense: `${T.green}1f`, situational: `${T.orange}2e`, hold: `${T.red}24` }[key] || "transparent");
  const rows = ladder.rows;
  const [cmpA, setCmpA] = [cmp.a, (a) => setCmp({ ...cmp, a })];
  const ai = Math.min(cmpA, rows.length - 1);
  const bi = cmp.b < 0 ? (spot ? spot.idx : rows.length - 1) : Math.min(cmp.b, rows.length - 1);
  const multi = rows.length > 1 ? compareRungs(rows[ai], rows[bi], { loan, termYears: term || 30, taxRate, deductPct, pointsDeductible: !isRefi, holdMonths: holdYears * 12 }) : null;

  const cellBase = { padding: "6px 5px", borderBottom: `1px solid ${T.separator}`, whiteSpace: "nowrap", fontFamily: FONT, fontSize: 12, textAlign: "right", color: T.text };
  const grp = (label, span, color) => (
    <th colSpan={span} style={{ padding: "6px 8px", background: `${color}14`, borderBottom: `1px solid ${color}40`, textAlign: "center" }}>
      <Overline T={T} color={color}>{label}</Overline>
    </th>
  );
  const hd = (label, left) => (
    <th style={{ ...cellBase, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textTertiary, textAlign: left ? "left" : "right", verticalAlign: "bottom", whiteSpace: "normal", lineHeight: 1.25 }}>{label}</th>
  );
  const stickyBg = (bg) => ({ position: "sticky", left: 0, zIndex: 1, background: bg || T.card });
  const holdMo = holdYears * 12;
  // One answer: the buydown or the credit, whichever leaves more cash at the hold.
  const pick = spot && creditPick ? (creditPick.cumAtHold > spot.cumAtHold ? creditPick : spot) : (spot || creditPick);
  const stepCells = (v, prevRate, prevSel) => {
    const credit = v && v.cost < 0;
    const be = v ? v.breakeven : null;
    // Credit steps (buying the rate UP): longer is better, so the shading
    // flips: green when the credit outlasts the hold, red when it runs out.
    const beBg = !v ? "transparent" : credit ? (be !== null && be >= holdMo ? `${T.green}40` : `${T.red}24`) : BAND_BG(v.band.key);
    return (<>
      <td style={{ ...cellBase, color: T.textSecondary }}>{prevSel || (prevRate !== null && prevRate !== undefined ? fmtPct3(prevRate) : "—")}</td>
      <td style={cellBase}>{v ? `${(v.cost / loan * 100).toFixed(3)}%` : "—"}</td>
      <td style={{ ...cellBase, color: credit ? T.green : T.text }}>{v ? (credit ? `${money(Math.abs(v.cost))} back` : money(v.cost)) : "—"}</td>
      <td style={{ ...cellBase, color: v ? (v.delta >= 0 ? T.green : T.red) : T.textTertiary }}>{v ? `${v.delta >= 0 ? "−" : "+"}${money2(Math.abs(v.delta))}` : "—"}</td>
      {showTax && <td style={cellBase}>{v ? (credit ? `${money(Math.abs(v.netCost))} back` : money(v.netCost)) : "—"}</td>}
      {showTax && <td style={{ ...cellBase, color: T.textSecondary }}>{v ? `${v.writeOffMonthly >= 0 ? "−" : "+"}${money2(Math.abs(v.writeOffMonthly))}` : "—"}</td>}
      <td style={{ ...cellBase, fontWeight: 800, fontSize: 14, background: beBg }} title={credit ? "Months until the higher payment uses up the credit" : "Months until the lower payment pays back the cost"}>{v ? (credit ? `lasts ${mo(be)}` : mo(be)) : "—"}</td>
      <td style={cellBase}>{v ? money(v.netDelta * 12) : "—"}</td>
      <td style={cellBase}>{v && v.netCost > 0 ? pctCell(v.netDelta * 12 / v.netCost) : "—"}</td>
      {ROI_YEARS.map(y => { const r = v ? roiAt(v, y) : null; return (
        <td key={y} style={{ ...cellBase, fontWeight: y === holdYears ? 800 : 600, color: r === null ? T.textTertiary : r >= 0 ? T.green : T.red, background: y === holdYears ? `${T.blue}0d` : "transparent" }}>{pctCell(r)}</td>
      ); })}
    </>);
  };

  return (
    <div>
      {/* ═══ Controls: hold slider + tax basis + the answer ═══ */}
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: "14px 24px", alignItems: "start" }}>
          <div>
            <Overline T={T}>How long will you keep this loan?</Overline>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", fontFamily: FONT, color: T.text, minWidth: 60 }}>{holdYears} yrs</span>
              <input type="range" min="2" max="30" step="1" value={holdYears} aria-label="Expected hold in years" onChange={(e) => patch({ holdYears: +e.target.value })} style={{ flex: 1, accentColor: T.blue }} />
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5, marginTop: 4, fontFamily: FONT }}>Until they sell or refinance. The matrix highlights the best value for this hold.</div>
          </div>
          <div>
            <Overline T={T}>Tax</Overline>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              {["auto", "manual", "off"].map(m => (
                <button key={m} onClick={() => patch({ taxMode: m })} aria-pressed={taxMode === m} style={{ border: `1px solid ${taxMode === m ? T.blue : T.inputBorder}`, background: taxMode === m ? `${T.blue}18` : "transparent", color: taxMode === m ? T.blue : T.textSecondary, borderRadius: 9999, padding: "4px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                  {m === "auto" ? "After tax" : m === "manual" ? "Type a bracket" : "Simplified (no tax)"}
                </button>
              ))}
              {taxMode === "manual" && <NumCell T={T} value={+L.taxManualPct || 0} onCommit={(v) => patch({ taxManualPct: v })} suffix="%" width={60} step={1} ariaLabel="Manual tax bracket" />}
            </div>
            <div style={{ fontSize: 11.5, color: T.textTertiary, lineHeight: 1.5, marginTop: 6, fontFamily: FONT }}>{taxLabel} · {taxNote}{isRefi ? " · refi points get no upfront write-off" : ""}</div>
          </div>
        </div>
        <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 14, background: pick ? `${T.blue}12` : T.pillBg, border: `1px solid ${pick ? `${T.blue}55` : T.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontFamily: FONT }}>
          {pick && pick === creditPick ? (
            <span style={{ fontSize: 13.5, color: T.textSecondary, lineHeight: 1.5 }}>
              Best value for a {holdYears}-year hold: take the credit at <b style={{ color: T.text, fontSize: 15 }}>{fmtPct3(creditPick.rate)}</b>, {money(Math.abs(creditPick.cost))} back at closing. The higher payment takes {mo(creditPick.breakeven)} to use it up, longer than the hold.
            </span>
          ) : pick ? (
            <span style={{ fontSize: 13.5, color: T.textSecondary, lineHeight: 1.5 }}>
              Best value for a {holdYears}-year hold: <b style={{ color: T.text, fontSize: 15 }}>{fmtPct3(spot.rate)}</b> at {ptsLabel(spot.pts)}. Every ⅛ step down to it breaks even inside {holdYears} years{nextLower ? `; the next step to ${fmtPct3(nextLower.rate)} doesn't` : ""}.
            </span>
          ) : (
            <span style={{ fontSize: 13.5, color: T.textSecondary, lineHeight: 1.5 }}>
              For a <b style={{ color: T.text }}>{holdYears}-year</b> hold, stay at {ladder.base ? fmtPct3(ladder.base.rate) : "the starting rate"}: no buydown breaks even in time, and no credit outlasts the hold.
            </span>
          )}
          {pick && <Pill T={T} primary onClick={() => applyRung(pick)}>Use {fmtPct3(pick.rate)}</Pill>}
        </div>
      </Card>

      {/* ═══ The breakeven matrix ═══ */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: FONT }}>Breakeven matrix <span style={{ fontWeight: 500, color: T.textTertiary, fontSize: 12 }}>· {money(loan)} loan · par in the middle: credits above, points below</span></div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Pill T={T} onClick={addCreditRung} title="Add a higher rate with a lender credit">+ Higher rate (credit)</Pill>
            <Pill T={T} onClick={addRung} title="Add a lower rate that costs points">+ Lower rate</Pill>
            <Pill T={T} onClick={scaffold} title="Replace with an estimated ⅛-step ladder around the scenario rate">Fill ⅛ steps</Pill>
          </div>
        </div>
        {L.estimated && <div style={{ display: "inline-block", marginBottom: 8, padding: "4px 10px", borderRadius: 9999, background: `${T.orange}18`, color: T.orange, fontSize: 11, fontWeight: 700, fontFamily: FONT }}>Estimated pricing: type the rate sheet over it</div>}
        {/* Bleeds to the card edges so the matrix gets the full width; it
            scrolls sideways (rate column sticky) only when it can't fit. */}
        <div style={{ overflowX: "auto", margin: "0 -18px" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: showTax ? 1040 : 920 }}>
            <thead>
              <tr>
                <th style={{ ...stickyBg(), borderBottom: `1px solid ${T.blue}40` }} />
                {grp("Pricing", 2, T.blue)}
                {grp("Vs the next rate toward par", showTax ? 7 : 5, T.orange)}
                {grp("Return on the step", 2 + ROI_YEARS.length, T.green)}
                <th />
              </tr>
              <tr>
                <th style={{ ...cellBase, ...stickyBg(), fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textTertiary, textAlign: "left", verticalAlign: "bottom", paddingLeft: 18 }}>Rate · points <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: "none" }}>(− = credit)</span></th>
                {hd("Monthly payment")}{hd("Cost in $")}
                {hd("Compare to")}{hd("Δ points")}{hd("Δ cost")}{hd("Payment Δ /mo")}
                {showTax && hd("Net after tax")}{showTax && hd("Lost write-off /mo")}
                {hd("Months to break even")}
                {hd("Annual savings")}{hd("ROI / yr")}
                {ROI_YEARS.map(y => <React.Fragment key={y}>{hd(`${y} yrs`)}</React.Fragment>)}
                <th style={{ borderBottom: `1px solid ${T.separator}` }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isSpot = (spot && r.idx === spot.idx) || (creditPick && r.idx === creditPick.idx);
                const rowBg = isSpot ? `${T.blue}14` : r.isBase ? `${T.blue}08` : "transparent";
                const prevRate = r.stepFrom ?? null;
                const baseI = ladder.base ? ladder.base.idx : 0;
                const divider = (label, key) => (
                  <tr key={key}><td colSpan={99} style={{ padding: "8px 18px 6px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textTertiary, fontFamily: FONT, background: T.pillBg, borderBottom: `1px solid ${T.separator}` }}>{label}</td></tr>
                );
                return (
                  <React.Fragment key={r.idx}>
                  {i === 0 && baseI > 0 && divider("↑ Buy the rate up · take a lender credit · each row vs the rate below it", "up")}
                  {i === baseI + 1 && divider("↓ Buy the rate down · pay points · each row vs the rate above it", "down")}
                  <tr style={{ background: rowBg, opacity: r.dominated ? 0.55 : 1, ...(r.isBase ? { boxShadow: `inset 0 2px 0 ${T.blue}55, inset 0 -2px 0 ${T.blue}55` } : {}) }}>
                    <td style={{ ...cellBase, ...stickyBg(isSpot ? `linear-gradient(${T.blue}14, ${T.blue}14), ${T.card}` : T.card), textAlign: "left", paddingLeft: 18 }}>
                      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <NumCell T={T} value={r.rate} onCommit={(v) => updateRung(r, "rate", v)} suffix="%" width={58} ariaLabel="Rate" decimals={3} />
                        <NumCell T={T} value={r.pts} onCommit={(v) => updateRung(r, "pts", v)} width={62} step={0.125} ariaLabel="Points (negative for a lender credit)" decimals={3} />
                        <button type="button" onClick={() => removeRung(r)} aria-label="Remove rate" style={{ background: "none", border: "none", color: T.textTertiary, cursor: "pointer", fontSize: 14, padding: 0, width: 24, height: 28 }}>×</button>
                      </span>
                    </td>
                    <td style={cellBase}>{money2(r.pi)}</td>
                    <td style={{ ...cellBase, color: r.pts < 0 ? T.green : T.text }}>{money(loan * r.pts / 100)}</td>
                    {r.isBase ? (
                      <td colSpan={(showTax ? 7 : 5) + 2 + ROI_YEARS.length} style={{ ...cellBase, textAlign: "left" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 9999, background: T.blue, color: "#fff", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", fontFamily: FONT }}>{Math.abs(r.pts) < 1e-9 ? "PAR" : "START"}</span>
                        <span style={{ marginLeft: 8, color: T.textSecondary, fontSize: 12 }}>Starting rate. Every other row steps out from here, one rate at a time.</span>
                      </td>
                    ) : r.dominated ? (
                      <td colSpan={(showTax ? 7 : 5) + 2 + ROI_YEARS.length} style={{ ...cellBase, textAlign: "left", color: T.textTertiary }}>Skip: {fmtPct3(r.dominatedBy)} is a lower rate for less money</td>
                    ) : stepCells(r.step, prevRate)}
                    <td style={{ ...cellBase, paddingRight: 12 }}>{!r.dominated && (
                      <button onClick={() => applyRung(r)} title={`Use ${fmtPct3(r.rate)} in this Blueprint`} style={{ border: `1px solid ${T.blue}`, background: isSpot ? T.blue : "transparent", color: isSpot ? "#fff" : T.blue, borderRadius: 9999, padding: "3px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Use</button>
                    )}</td>
                  </tr>
                  </React.Fragment>
                );
              })}
              {/* Compare over multiple increments — the sheet's bottom row */}
              {multi && (
                <tr style={{ background: `${T.accentHover || T.blue}10` }}>
                  <td style={{ ...cellBase, ...stickyBg(T.card), textAlign: "left", paddingLeft: 18, borderTop: `2px solid ${T.separator}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textTertiary, marginBottom: 4 }}>Compare over several steps<br />from</div>
                    <select value={ai} onChange={(e) => setCmpA(+e.target.value)} aria-label="Start rate" style={{ background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 8, padding: "5px 8px", color: T.text, fontSize: 12.5, fontWeight: 700, fontFamily: FONT }}>
                      {rows.map(r => <option key={r.idx} value={r.idx}>{fmtPct3(r.rate)}</option>)}
                    </select>
                  </td>
                  <td style={{ ...cellBase, borderTop: `2px solid ${T.separator}` }}>{money2(rows[bi].pi)}</td>
                  <td style={{ ...cellBase, borderTop: `2px solid ${T.separator}` }}>{money(loan * rows[bi].pts / 100)}</td>
                  {stepCells(multi, null, (
                    <select value={bi} onChange={(e) => setCmp({ ...cmp, b: +e.target.value })} aria-label="Compare-to rate" style={{ background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 8, padding: "5px 8px", color: T.text, fontSize: 12.5, fontWeight: 700, fontFamily: FONT }}>
                      {rows.map(r => <option key={r.idx} value={r.idx}>{fmtPct3(r.rate)}</option>)}
                    </select>
                  ))}
                  <td style={{ ...cellBase, borderTop: `2px solid ${T.separator}` }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          <Overline T={T}>Breakeven key</Overline>
          {[["nobrainer", "No-brainer · under 24 mo"], ["sense", "Makes sense · 24–36"], ["situational", "Situational · 36–48"], ["hold", "Long-term hold · 48+"]].map(([k, label]) => (
            <span key={k} style={{ padding: "3px 9px", borderRadius: 9999, background: BAND_BG(k), color: T.text, fontSize: 11, fontWeight: 600, fontFamily: FONT }}>{label}</span>
          ))}
        </div>
        <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.55, marginTop: 10, fontFamily: FONT }}>
          Type rates and points straight into the first column; negative points are a lender credit. Par sits in the middle. Below it, each row is the step down from the rate above it (pay points, save monthly). Above it, each row is the step up from the rate below it (take a credit, pay more monthly); "lasts" is how long the credit covers the higher payment. {isRefi ? "Points on a refinance deduct over the life of the loan, so no upfront write-off is credited." : "Points paid on a purchase deduct in the year you close; giving up a lender credit pays no points, so it gets no tax savings."} ROI at N years = (N years of savings − net cost) ÷ net cost. Check with your CPA.
        </div>
      </Card>

      {/* ═══ LO details: starting rate, pricing context, chart ═══ */}
      <details style={{ marginTop: 4 }}>
        <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: T.blue, fontFamily: FONT, padding: "8px 2px" }}>Pricing details &amp; chart</summary>
        <Card>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: T.textSecondary, fontFamily: FONT }}>Starting rate</span>
            <select value={L.baseAuto === false ? (ladder.base ? ladder.base.idx : 0) : "auto"} onChange={(e) => e.target.value === "auto" ? patch({ baseAuto: true }) : patch({ baseIdx: +e.target.value, baseAuto: false })} aria-label="Starting rate"
              style={{ background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 10, padding: "6px 10px", color: T.text, fontSize: 12.5, fontWeight: 700, fontFamily: FONT }}>
              <option value="auto">Par (automatic)</option>
              {rows.map(r => <option key={r.idx} value={r.idx}>{fmtPct3(r.rate)} · {ptsLabel(r.pts)}</option>)}
            </select>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 9999, background: T.pillBg, fontSize: 11, fontWeight: 600, color: T.textSecondary, fontFamily: FONT }}>
              Pricing as of <input type="date" value={L.asOf || ""} onChange={(e) => patch({ asOf: e.target.value })} aria-label="Pricing as-of date" style={{ background: "transparent", border: "none", color: T.text, fontFamily: FONT, fontSize: 11, fontWeight: 700 }} />
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 9999, background: ltvDrift ? `${T.orange}18` : T.pillBg, fontSize: 11, fontWeight: 600, color: ltvDrift ? T.orange : T.textSecondary, fontFamily: FONT }}>
              Rate-sheet LTV band <input type="text" placeholder="70.01–75%" value={L.ltvBand || ""} onChange={(e) => patch({ ltvBand: e.target.value })} aria-label="Rate-sheet LTV band" style={{ width: 84, background: "transparent", border: "none", borderBottom: `1px dashed ${T.inputBorder}`, color: T.text, fontFamily: FONT, fontSize: 11, fontWeight: 700, outline: "none" }} />
              {ltvNow > 0 && <span>· today {ltvNow.toFixed(1)}%{ltvDrift ? ": outside this band, reprice" : ""}</span>}
            </span>
          </div>
          {ladder.base && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 10, fontFamily: FONT }}>Net benefit over time vs {fmtPct3(ladder.base.rate)}</div>
              <BenefitChart T={T} ladder={ladder} holdYears={Math.min(holdYears, 10)} />
            </div>
          )}
        </Card>
      </details>
    </div>
  );
}
