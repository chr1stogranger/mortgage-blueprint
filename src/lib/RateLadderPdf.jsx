// src/lib/RateLadderPdf.jsx
//
// "Rate & Points Breakeven" — an optional page appended to the Fees Worksheet
// and the Refi Savings Summary when the scenario has the ladder module on.
// Takes the plain-data snapshot from lib/rateLadder.js ladderPdfData(), so it
// never recomputes: whatever the screen showed is what prints. Inter only
// (Brand Kit); fonts are registered by FeesWorksheetPdf.jsx, which imports
// this module, so registration always precedes render.

import React from "react";
import { Page, View, Text, StyleSheet, Svg, Line, Polyline, Circle } from "@react-pdf/renderer";

const INDIGO = "#3B6BF5";
const INK = "#171717";
const SUB = "#525252";
const MUTED = "#737373";
const HAIR = "#E8E8E8";
const GREEN = "#12a150";
const RED = "#e5484d";
const ORANGE = "#d98a0b";
const TINT = "#EFF3FE";

const usd = (v) => (v == null || !isFinite(v)) ? "$0" : (v < 0 ? "−" : "") + "$" + Math.round(Math.abs(v)).toLocaleString("en-US");
const usd2 = (v) => (v == null || !isFinite(v)) ? "$0.00" : (v < 0 ? "−" : "") + "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rate = (r) => `${(+r).toFixed(3)}%`;
const pts = (p) => p < 0 ? `${Math.abs(p).toFixed(3)}% credit` : p === 0 ? "par" : `${(+p).toFixed(3)} pts`;
const mo = (m) => (m == null || !isFinite(m)) ? "—" : m <= 0 ? "0 mo" : `${Math.round(m)} mo`;
const bandColor = (key) => ({ free: GREEN, nobrainer: GREEN, sense: INDIGO, situational: ORANGE, hold: SUB, none: MUTED }[key] || MUTED);

const s = StyleSheet.create({
  page: { paddingTop: 22, paddingBottom: 16, paddingHorizontal: 34, fontFamily: "Inter", fontSize: 9, color: INK, backgroundColor: "#FFFFFF" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hTitle: { fontFamily: "Inter-Bold", fontSize: 17, color: INDIGO },
  hSub: { fontSize: 8.5, color: SUB, marginTop: 2 },
  hRight: { fontSize: 8, color: MUTED, textAlign: "right", lineHeight: 1.4 },
  rule: { height: 2, backgroundColor: INDIGO, marginTop: 7, marginBottom: 8 },
  spot: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: TINT, borderWidth: 1, borderColor: "#C9D6FC", borderRadius: 5, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 9 },
  spotLabel: { fontSize: 7, color: INDIGO, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "Inter-Bold" },
  spotRate: { fontFamily: "Inter-Bold", fontSize: 22, color: INK, marginTop: 1 },
  spotSub: { fontSize: 7.5, color: MUTED, marginTop: 1 },
  spotWhy: { fontSize: 8.5, color: SUB, lineHeight: 1.45, flex: 1 },
  table: { borderWidth: 1, borderColor: HAIR, borderRadius: 4, overflow: "hidden", marginBottom: 8 },
  thead: { flexDirection: "row", backgroundColor: TINT, paddingVertical: 4, paddingHorizontal: 6 },
  th: { fontFamily: "Inter-Bold", fontSize: 6.8, color: INDIGO, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right" },
  thSub: { fontSize: 6.2, color: MUTED, textAlign: "right", textTransform: "none", letterSpacing: 0, fontFamily: "Inter" },
  tr: { flexDirection: "row", paddingVertical: 3.5, paddingHorizontal: 6, borderTopWidth: 0.5, borderTopColor: HAIR, alignItems: "center" },
  td: { fontSize: 8.2, textAlign: "right", color: INK },
  tdSub: { fontSize: 6.6, color: MUTED, textAlign: "right", marginTop: 0.5 },
  band: { fontFamily: "Inter-Bold", fontSize: 6.8, textAlign: "right" },
  keyRow: { flexDirection: "row", gap: 10, marginBottom: 6 },
  keyItem: { fontSize: 7, color: SUB },
  note: { fontSize: 7, color: MUTED, lineHeight: 1.4, marginBottom: 8 },
  chartTitle: { fontFamily: "Inter-Bold", fontSize: 8.5, color: INK, marginBottom: 3 },
  legend: { flexDirection: "row", gap: 12, fontSize: 7, color: SUB, marginTop: 2 },
  foot: { position: "absolute", left: 34, right: 34, bottom: 12, fontSize: 6.6, color: MUTED, lineHeight: 1.35 },
});

// Column widths (fractions of the row). Rate column is left-aligned.
const COLS = [
  { key: "rate", w: 0.15, label: "Rate", sub: "price", left: true },
  { key: "pmt", w: 0.14, label: "Payment", sub: "P&I · vs baseline" },
  { key: "cost", w: 0.14, label: "Cost", sub: "at closing" },
  { key: "net", w: 0.11, label: "Net cost", sub: "after tax" },
  { key: "be", w: 0.13, label: "Breakeven", sub: "vs baseline · step" },
  { key: "verdict", w: 0.19, label: "Verdict", sub: " " },
  { key: "hold", w: 0.14, label: "At hold", sub: "cash ahead" },
];

function Chart({ d }) {
  const W = 526, H = 170, L = 40, R = 56, T = 14, B = 22, MONTHS = 120;
  const series = d.rows.filter(r => !r.isBase && !r.dominated && d.base && r.rate < d.base.rate);
  if (!series.length) return null;
  let ymin = 0, ymax = 0;
  series.forEach(r => { ymin = Math.min(ymin, -r.netCost); ymax = Math.max(ymax, MONTHS * (r.netDelta ?? r.delta) - r.netCost); });
  const pad = (ymax - ymin) * 0.06 || 100; ymin -= pad; ymax += pad;
  const x = (m) => L + (m / MONTHS) * (W - L - R);
  const y = (v) => T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - B);
  const span = ymax - ymin, raw = span / 4, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(k => span / k <= 5) || mag * 10;
  const ticks = []; for (let v = Math.ceil(ymin / step) * step; v <= ymax; v += step) ticks.push(Math.round(v));
  const hold = d.holdYears * 12;
  const hotRate = d.spot ? d.spot.rate : null;
  const ordered = series.slice().sort((a, b) => (a.rate === hotRate) - (b.rate === hotRate));
  const labelYs = [];
  return (
    <View>
      <Text style={s.chartTitle}>Net benefit over time (vs {rate(d.base.rate)})</Text>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {ticks.map(v => <Line key={`g${v}`} x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={HAIR} strokeWidth={0.6} />)}
        {ticks.map(v => <Text key={`t${v}`} x={L - 5} y={y(v) + 2.5} style={{ fontSize: 6.5, fill: MUTED }} textAnchor="end">{v === 0 ? "$0" : `${(v / 1000).toFixed(0)}k`}</Text>)}
        {[0, 24, 48, 72, 96, 120].map(m => <Text key={`x${m}`} x={x(m)} y={H - B + 12} style={{ fontSize: 6.5, fill: MUTED }} textAnchor="middle">{m === 0 ? "close" : `${m / 12} yr`}</Text>)}
        <Line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke={MUTED} strokeWidth={0.8} />
        {hold <= MONTHS && <Line x1={x(hold)} x2={x(hold)} y1={T} y2={H - B} stroke={SUB} strokeWidth={0.7} strokeDasharray="2 3" />}
        {hold <= MONTHS && <Text x={x(hold)} y={T - 4} style={{ fontSize: 6.5, fill: SUB }} textAnchor="middle">hold · {d.holdYears} yr</Text>}
        {ordered.map(r => {
          const hot = r.rate === hotRate;
          const points = []; for (let m = 0; m <= MONTHS; m += 4) points.push(`${x(m).toFixed(1)},${y(m * (r.netDelta ?? r.delta) - r.netCost).toFixed(1)}`);
          const ye = y(MONTHS * (r.netDelta ?? r.delta) - r.netCost);
          let ly = ye; labelYs.sort((a, b) => a - b).forEach(o => { if (Math.abs(ly - o) < 9) ly = o + 9; }); labelYs.push(ly);
          return (
            <React.Fragment key={r.rate}>
              <Polyline points={points.join(" ")} fill="none" stroke={hot ? INDIGO : "#A3A3A3"} strokeWidth={hot ? 2 : 1.1} strokeLineJoin="round" />
              <Circle cx={x(MONTHS)} cy={ye} r={hot ? 3 : 2} fill={hot ? INDIGO : "#A3A3A3"} />
              <Text x={x(MONTHS) + 6} y={ly + 2.5} style={{ fontSize: 6.8, fill: hot ? INK : SUB, fontFamily: hot ? "Inter-Bold" : "Inter" }}>{rate(r.rate)}</Text>
              {r.breakeven != null && r.breakeven > 0 && r.breakeven <= MONTHS && <Circle cx={x(r.breakeven)} cy={y(0)} r={hot ? 2.6 : 2} fill="#FFFFFF" stroke={hot ? INDIGO : "#A3A3A3"} strokeWidth={1.2} />}
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={s.legend}>
        <Text>— Sweet spot (blue)</Text><Text>— Other rungs (gray)</Text><Text>- - Your hold (dashed)</Text><Text>○ crosses $0 at breakeven</Text>
      </View>
    </View>
  );
}

export function RateLadderPage(p) {
  const d = p.rateLadder;
  if (!d || !d.rows || !d.rows.length) return null;
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const spot = d.spot;
  return (
    <Page size="LETTER" style={s.page}>
      <View style={s.headerRow}>
        <View style={{ flex: 1, paddingRight: 14 }}>
          <Text style={s.hTitle}>Rate &amp; Points Breakeven</Text>
          <Text style={s.hSub}>Buy the rate down, take a credit, or stay at par · {p.scenarioName || ""}{p.borrowerName ? ` · ${p.borrowerName}` : ""}</Text>
        </View>
        <View style={{ width: 290 }}>
          <Text style={s.hRight}>Expected hold: {d.holdYears} years</Text>
          <Text style={s.hRight}>Comparing against {rate(d.base.rate)} ({pts(d.base.pts)})</Text>
          <Text style={s.hRight}>Tax basis {d.taxLabel}{d.taxRate > 0 ? ` · ${d.taxNote}` : ` · ${d.taxNote}`}</Text>
          {(d.asOf || d.ltvBand) ? <Text style={s.hRight}>Pricing{d.asOf ? ` as of ${d.asOf}` : ""}{d.ltvBand ? ` · ${d.ltvBand} LTV` : ""}{d.ltvDrift ? ` (LTV today ${d.ltvNow.toFixed(1)}%, outside band)` : ""}{d.estimated ? " · ESTIMATED" : ""}</Text> : null}
        </View>
      </View>
      <View style={s.rule} />

      {spot ? (
        <View style={s.spot}>
          <View>
            <Text style={s.spotLabel}>Sweet spot · {d.holdYears}-yr hold</Text>
            <Text style={s.spotRate}>{rate(spot.rate)}</Text>
            <Text style={s.spotSub}>{pts(spot.pts)} · {usd(spot.cost)} {spot.cost >= 0 ? "more" : "back"} at closing</Text>
          </View>
          <Text style={s.spotWhy}>
            Pays back in {Math.round(spot.breakeven)} months and each step down to it also earns its keep. Ahead {usd(spot.cumAtHold)} in cash by year {d.holdYears}, plus {usd(spot.equityAtHold)} more principal paid down.
            {d.nextLower ? ` The next step to ${rate(d.nextLower.rate)} needs ${d.nextLower.stepBreakeven != null ? `${Math.round(d.nextLower.stepBreakeven)} months` : "longer"} to pay back on its own.` : ""}
          </Text>
        </View>
      ) : (
        <View style={s.spot}><Text style={s.spotWhy}>No rung pays for itself within {d.holdYears} years against {rate(d.base.rate)}. Stay at the baseline, or take a credit if cash to close matters more.</Text></View>
      )}

      <View style={s.table}>
        <View style={s.thead}>
          {COLS.map(c => (
            <View key={c.key} style={{ width: `${c.w * 100}%` }}>
              <Text style={[s.th, c.left ? { textAlign: "left" } : null]}>{c.key === "hold" ? `At ${d.holdYears} yrs` : c.label}</Text>
              <Text style={[s.thSub, c.left ? { textAlign: "left" } : null]}>{c.sub}</Text>
            </View>
          ))}
        </View>
        {d.rows.map((r, i) => {
          const isSpot = spot && r.rate === spot.rate && r.pts === spot.pts;
          const credit = r.cost < 0;
          const ink = r.dominated ? MUTED : r.isBase ? SUB : INK;
          const verdict = r.isBase ? null : r.dominated ? { color: MUTED, label: `Skip · ${rate(r.dominatedBy)} is cheaper` } : credit ? { color: SUB, label: `Credit lasts ${mo(r.breakeven)}` } : { color: bandColor(r.band?.key), label: isSpot ? "Sweet spot" : (r.band?.label || "") };
          const cell = (c, main, sub, color) => (
            <View key={c.key} style={{ width: `${c.w * 100}%` }}>
              <Text style={[s.td, { color: color || ink }, c.left ? { textAlign: "left", fontFamily: "Inter-Bold" } : null, r.dominated && c.left ? { textDecoration: "line-through" } : null]}>{main}</Text>
              {sub ? <Text style={[s.tdSub, c.left ? { textAlign: "left" } : null]}>{sub}</Text> : null}
            </View>
          );
          return (
            <View key={i} style={[s.tr, isSpot ? { backgroundColor: "#F3F6FE" } : null]}>
              {cell(COLS[0], rate(r.rate), `${pts(r.pts)}${r.isBase ? " · baseline" : ""}`)}
              {r.isBase
                ? [cell(COLS[1], usd2(r.pi)), cell(COLS[2], "—"), cell(COLS[3], "—"), cell(COLS[4], "—"), cell(COLS[5], "—"), cell(COLS[6], "—")]
                : [
                  cell(COLS[1], usd2(r.pi), `${r.delta > 0 ? "−" : "+"}${usd2(Math.abs(r.delta))}/mo`),
                  cell(COLS[2], usd(r.cost), credit ? "credit, no tax effect" : d.taxRate > 0 ? `after tax ${usd(r.postTaxCost)} · net ${usd2(r.netDelta)}/mo after lost write-off` : null),
                  cell(COLS[3], usd(r.netCost)),
                  cell(COLS[4], mo(r.breakeven), r.stepBreakeven != null ? `step ${mo(r.stepBreakeven)}` : null),
                  <View key="verdict" style={{ width: `${COLS[5].w * 100}%` }}>{verdict ? <Text style={[s.band, { color: verdict.color }]}>{verdict.label}</Text> : null}</View>,
                  cell(COLS[6], usd(r.cumAtHold), `${r.equityAtHold >= 0 ? "+" : ""}${usd(r.equityAtHold)} equity`, r.cumAtHold >= 0 ? GREEN : RED),
                ]}
            </View>
          );
        })}
      </View>

      <View style={s.keyRow}>
        <Text style={[s.keyItem, { color: GREEN }]}>● No-brainer · under 24 mo</Text>
        <Text style={[s.keyItem, { color: INDIGO }]}>● Makes sense · 24–36</Text>
        <Text style={[s.keyItem, { color: ORANGE }]}>● Situational · 36–48</Text>
        <Text style={[s.keyItem, { color: SUB }]}>● Long-term hold · 48+</Text>
      </View>
      <Text style={s.note}>
        {d.isRefi ? "Points on a refinance deduct over the life of the loan, so no upfront tax offset is credited." : "Points paid on a purchase deduct in the year you close; a lender credit has no tax effect."} Write-off lost is year-one interest you no longer deduct. Breakeven is cash-only: it ignores the extra principal a lower rate pays down, shown separately. "Step" is the payback of moving from the rung above, skipping rungs a cheaper lower rate makes pointless. Check with your CPA.
      </Text>

      <Chart d={d} />

      <View style={s.foot}>
        <Text>Estimates only, not a commitment to lend. Rate-sheet pricing changes daily and is valid only for the LTV band shown. {p.loanOfficer || ""}{p.loNmls ? ` · NMLS #${p.loNmls}` : ""}{p.companyName ? ` · ${p.companyName}` : ""}{p.companyNmls ? ` · Company NMLS #${p.companyNmls}` : ""} · Generated by Mortgage Blueprint, powered by RealStack · {dateStr}</Text>
      </View>
    </Page>
  );
}
