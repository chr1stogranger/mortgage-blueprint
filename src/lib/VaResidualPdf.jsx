// src/lib/VaResidualPdf.jsx
//
// "VA Residual Income" — an optional page appended to the Fees Worksheet and
// the Refi Savings Summary when the scenario is a VA loan with the module on.
// Takes the plain-data snapshot from lib/vaResidual.js vaResidualPdfData(),
// so it never recomputes: whatever the screen showed is what prints. Inter
// only (Brand Kit); fonts are registered by FeesWorksheetPdf.jsx, which
// imports this module, so registration always precedes render.

import React from "react";
import { Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { VA_RESIDUAL_TABLE, VA_REGION_NAMES } from "./vaResidual.js";

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
const pct = (r) => (r == null || !isFinite(r)) ? "—" : `${(r * 100).toFixed(1)}%`;
const verdictColor = (key) => ({ pass: GREEN, caution: ORANGE, fail: RED, none: MUTED }[key] || MUTED);

const s = StyleSheet.create({
  page: { paddingTop: 22, paddingBottom: 16, paddingHorizontal: 34, fontFamily: "Inter", fontSize: 9, color: INK, backgroundColor: "#FFFFFF" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hTitle: { fontFamily: "Inter-Bold", fontSize: 17, color: INDIGO },
  hSub: { fontSize: 8.5, color: SUB, marginTop: 2 },
  hRight: { fontSize: 8, color: MUTED, textAlign: "right", lineHeight: 1.4 },
  rule: { height: 2, backgroundColor: INDIGO, marginTop: 7, marginBottom: 8 },
  verdict: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderRadius: 5, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 10 },
  vLabel: { fontSize: 7, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "Inter-Bold" },
  vBig: { fontFamily: "Inter-Bold", fontSize: 22, color: INK, marginTop: 1 },
  vSub: { fontSize: 7.5, color: MUTED, marginTop: 1 },
  vWhy: { fontSize: 8.5, color: SUB, lineHeight: 1.45, flex: 1 },
  cols: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
  secTitle: { fontFamily: "Inter-Bold", fontSize: 7, color: INDIGO, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 3, marginTop: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: HAIR },
  rowLabel: { fontSize: 8.2, color: SUB, flex: 1, paddingRight: 8 },
  rowSub: { fontSize: 6.6, color: MUTED, marginTop: 0.5 },
  rowVal: { fontSize: 8.4, color: INK, textAlign: "right", minWidth: 60 },
  total: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: 1, borderTopColor: "#BDBDBD" },
  totalLabel: { fontFamily: "Inter-Bold", fontSize: 8.6, color: INK },
  totalVal: { fontFamily: "Inter-Bold", fontSize: 9, color: INK, textAlign: "right" },
  strip: { flexDirection: "row", gap: 10, marginTop: 10, marginBottom: 8 },
  stat: { flex: 1, backgroundColor: TINT, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 8 },
  statLabel: { fontSize: 6.6, color: INDIGO, textTransform: "uppercase", letterSpacing: 0.6, fontFamily: "Inter-Bold" },
  statVal: { fontFamily: "Inter-Bold", fontSize: 13, color: INK, marginTop: 2 },
  statSub: { fontSize: 6.6, color: MUTED, marginTop: 1 },
  table: { borderWidth: 1, borderColor: HAIR, borderRadius: 4, overflow: "hidden", marginTop: 6, marginBottom: 8 },
  thead: { flexDirection: "row", backgroundColor: TINT, paddingVertical: 3.5, paddingHorizontal: 6 },
  th: { fontFamily: "Inter-Bold", fontSize: 6.6, color: INDIGO, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right", flex: 1 },
  tr: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 6, borderTopWidth: 0.5, borderTopColor: HAIR },
  td: { fontSize: 7.8, textAlign: "right", color: INK, flex: 1 },
  note: { fontSize: 7, color: MUTED, lineHeight: 1.45, marginTop: 4 },
  notes: { marginTop: 8, padding: 8, borderWidth: 0.5, borderColor: HAIR, borderRadius: 4 },
  notesTitle: { fontFamily: "Inter-Bold", fontSize: 7, color: SUB, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  notesBody: { fontSize: 8, color: INK, lineHeight: 1.45 },
  foot: { position: "absolute", left: 34, right: 34, bottom: 12, fontSize: 6.6, color: MUTED, lineHeight: 1.35 },
});

const R = ({ label, sub, value, neg, color }) => (
  <View style={s.row}>
    <View style={{ flex: 1, paddingRight: 8 }}>
      <Text style={s.rowLabel}>{label}</Text>
      {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
    </View>
    <Text style={[s.rowVal, color ? { color } : null]}>{neg && value ? `−${usd(value)}` : usd(value)}</Text>
  </View>
);
const Tot = ({ label, value, color }) => (
  <View style={s.total}>
    <Text style={s.totalLabel}>{label}</Text>
    <Text style={[s.totalVal, color ? { color } : null]}>{usd(value)}</Text>
  </View>
);

export function VaResidualPage(p) {
  const d = p.vaResidual;
  if (!d || !d.region) return null;
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const vc = verdictColor(d.verdict.key);
  const tier = VA_RESIDUAL_TABLE[d.guide.tier];
  return (
    <Page size="LETTER" style={s.page}>
      <View style={s.headerRow}>
        <View style={{ flex: 1, paddingRight: 14 }}>
          <Text style={s.hTitle}>VA Residual Income</Text>
          <Text style={s.hSub}>Balance available for family support (VA Form 26-6393) · {p.scenarioName || ""}{p.borrowerName ? ` · ${p.borrowerName}` : ""}</Text>
        </View>
        <View style={{ width: 290 }}>
          <Text style={s.hRight}>Region: {d.region}{d.propertyState ? ` (${d.propertyState})` : ""} · Family of {d.familySize}</Text>
          <Text style={s.hRight}>Loan {usd(d.loanAmount)} · table for loans {d.guide.tierLabel}</Text>
          <Text style={s.hRight}>Taxes {d.taxMode === "manual" ? "from paystubs" : "estimated (2026 tables)"}{d.activeDuty ? " · 5% commissary reduction" : ""}</Text>
        </View>
      </View>
      <View style={s.rule} />

      <View style={[s.verdict, { backgroundColor: `${vc}14`, borderColor: `${vc}80` }]}>
        <View>
          <Text style={[s.vLabel, { color: vc }]}>{d.verdict.label}</Text>
          <Text style={s.vBig}>{usd(d.residual)}<Text style={{ fontSize: 9, color: SUB }}> /mo residual</Text></Text>
          <Text style={s.vSub}>Guideline {usd(d.guideline)}{d.guide.reduction > 0 ? ` (table ${usd(d.guidelineBase)} less 5%)` : ""} · ratio {pct(d.ratio)}{d.ratioHigh ? " · over 41%" : ""}</Text>
        </View>
        <Text style={s.vWhy}>
          {d.verdict.detail}{d.pctOfGuideline != null ? ` Residual income is ${Math.round(d.pctOfGuideline * 100)}% of the guideline.` : ""}
          {d.headroom >= 0 ? ` Cushion of ${usd(d.headroom)} a month before the test ${d.ratioHigh ? "drops under 120%" : "fails"}.` : ` Needs ${usd(-d.headroom)} a month more to ${d.ratioHigh ? "reach 120% of the guideline" : "meet the guideline"}.`}
        </Text>
      </View>

      <View style={s.cols}>
        <View style={s.col}>
          <Text style={s.secTitle}>Income</Text>
          <R label="Gross taxable income" sub="wages, self-employment, taxable retirement" value={d.grossTaxable} />
          <R label="Tax-free income" sub="VA disability, BAH/BAS, child support received" value={d.taxFree} />
          <Tot label="Gross monthly income" value={d.grossIncome} />
          <Text style={s.secTitle}>Less deductions</Text>
          <R label="Federal income tax" value={d.fedTax} neg />
          <R label="State income tax" value={d.stateTax} neg />
          <R label="Social Security & Medicare" value={d.fica} neg />
          <R label="Other payroll deductions" sub="retirement, union dues, garnishments" value={d.otherDeductions} neg />
          <Tot label="Net take-home pay" value={d.netEffectiveIncome} />
        </View>
        <View style={s.col}>
          <Text style={s.secTitle}>Shelter expense</Text>
          <R label="Principal & interest" value={d.shelter.pi} />
          <R label="Property taxes" value={d.shelter.propertyTax} />
          <R label="Hazard insurance" value={d.shelter.hazardIns} />
          <R label="Special assessments" value={d.shelter.specialAssessments} />
          <R label="Maintenance & utilities" sub={d.sqft > 0 ? `${d.sqft.toLocaleString("en-US")} sq ft × $${d.maintRate.toFixed(2)}` : null} value={d.shelter.maintUtil} />
          <R label="HOA / condo dues" value={d.shelter.hoa} />
          <Tot label="Total shelter" value={d.totalShelter} />
          <Text style={s.secTitle}>Debts & obligations</Text>
          <R label="Installment & revolving debts" value={d.obligations.debts} />
          <R label="Child care" value={d.obligations.childcare} />
          <R label="Alimony / child support paid" value={d.obligations.supportPaid} />
          <R label="Job-related expenses" value={d.obligations.jobExpenses} />
          <R label="Other obligations" value={d.obligations.otherObligations} />
          <Tot label="Total obligations" value={d.totalObligations} />
        </View>
      </View>

      <View style={s.strip}>
        <View style={s.stat}><Text style={s.statLabel}>Net take-home</Text><Text style={s.statVal}>{usd(d.netEffectiveIncome)}</Text></View>
        <View style={s.stat}><Text style={s.statLabel}>Shelter + debts</Text><Text style={s.statVal}>−{usd(d.totalShelter + d.totalObligations)}</Text></View>
        <View style={s.stat}><Text style={s.statLabel}>Residual income</Text><Text style={[s.statVal, { color: d.surplus < 0 ? RED : INK }]}>{usd(d.residual)}</Text><Text style={s.statSub}>{d.surplus >= 0 ? `${usd(d.surplus)} above guideline` : `${usd(-d.surplus)} below guideline`}</Text></View>
        <View style={s.stat}><Text style={s.statLabel}>{d.ratioHigh ? "Required (120%)" : "Guideline"}</Text><Text style={s.statVal}>{usd(d.requiredResidual)}</Text><Text style={s.statSub}>ratio {pct(d.ratio)}{d.grossUp && d.taxFree > 0 ? " · tax-free grossed up 25%" : ""}</Text></View>
      </View>

      <Text style={s.secTitle}>VA table · loans {d.guide.tierLabel} · monthly residual income by family size</Text>
      <View style={s.table}>
        <View style={s.thead}>
          <Text style={[s.th, { textAlign: "left", flex: 1.4 }]}>Region</Text>
          {[1, 2, 3, 4, 5].map(n => <Text key={n} style={s.th}>{n}</Text>)}
          <Text style={[s.th, { flex: 1.4 }]}>Each over 5</Text>
        </View>
        {VA_REGION_NAMES.map(name => {
          const hot = name === d.region;
          return (
            <View key={name} style={[s.tr, hot ? { backgroundColor: "#F3F6FE" } : null]}>
              <Text style={[s.td, { textAlign: "left", flex: 1.4, fontFamily: hot ? "Inter-Bold" : "Inter" }]}>{name}</Text>
              {tier[name].map((v, i) => <Text key={i} style={[s.td, hot && (i + 1 === Math.min(d.guide.familyUsed, 5)) ? { fontFamily: "Inter-Bold", color: INDIGO } : null]}>{usd(v)}</Text>)}
              <Text style={[s.td, { flex: 1.4 }]}>+{usd(tier.adder)}{hot && d.guide.adderMembers > 0 ? ` × ${d.guide.adderMembers}` : ""}</Text>
            </View>
          );
        })}
      </View>

      <Text style={s.note}>
        VA Lenders Handbook (Pamphlet 26-7) Ch. 4, Topic 9. Family size counts everyone the veteran supports, on the note or not; a member fully supported by verified income excluded from effective income may be omitted. Families over five add the per-member amount through a family of seven. Active-duty or veteran households with commissary and exchange access may have the guideline reduced 5%. When the ratio exceeds 41%, residual income must reach 120% of the guideline or the underwriter must document compensating factors. The ratio excludes maintenance & utilities and may gross up tax-free income; residual income never does. Payroll taxes are {d.taxMode === "manual" ? "the paystub withholding entered" : "estimates from 2026 tables — VA underwrites to actual paystub withholding"}.
      </Text>

      {d.notes ? (
        <View style={s.notes}>
          <Text style={s.notesTitle}>Compensating factors & notes</Text>
          <Text style={s.notesBody}>{d.notes}</Text>
        </View>
      ) : null}

      <View style={s.foot}>
        <Text>Estimates only, not a commitment to lend or an underwriting decision. {p.loanOfficer || ""}{p.loNmls ? ` · NMLS #${p.loNmls}` : ""}{p.companyName ? ` · ${p.companyName}` : ""}{p.companyNmls ? ` · Company NMLS #${p.companyNmls}` : ""} · Generated by Mortgage Blueprint, powered by RealStack · {dateStr}</Text>
      </View>
    </Page>
  );
}
