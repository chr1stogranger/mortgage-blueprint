import { FONT, MONO } from "../lib/fonts.js";
import React, { useMemo } from "react";
import { buildVaResidualView, fmtMoney, fmtPct1 } from "../lib/vaResidual.js";

/* ═══════════════════════════════════════════════════════════════
   VA RESIDUAL SUMMARY — the read-only card on the Share tab.
   Verdict line + the five-line 26-6393 walk. Same view-model as the
   Overview section, no editing.
   ═══════════════════════════════════════════════════════════════ */

const VERDICT_COLOR = (T, key) => ({ pass: T.green, caution: T.orange, fail: T.red, none: T.textTertiary }[key] || T.textTertiary);

function PlainCard({ T, children }) {
  return <div style={{ background: T.card, borderRadius: 16, padding: 18, boxShadow: T.cardShadow, marginBottom: 12 }}>{children}</div>;
}

export default function VaResidualSummary({ T, calc, isRefi, propertyState, married, taxState, vaResidual, Card }) {
  const view = useMemo(() => buildVaResidualView({ calc, isRefi, propertyState, married, taxState, vaResidual }), [calc, isRefi, propertyState, married, taxState, vaResidual]);
  const { result: r, region, familySize } = view;
  if (!region) return null;
  const vc = VERDICT_COLOR(T, r.verdict.key);
  const Wrap = Card || PlainCard;
  const line = (label, value, opts = {}) => (
    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: opts.total ? "9px 0 4px" : "6px 0", borderBottom: opts.total ? "none" : `1px solid ${T.separator}`, borderTop: opts.total ? `2px solid ${T.separator}` : "none" }}>
      <span style={{ fontSize: opts.total ? 13.5 : 13, fontWeight: opts.total ? 700 : 500, color: opts.total ? T.text : T.textSecondary, fontFamily: FONT }}>{label}</span>
      <span style={{ fontSize: opts.total ? 16 : 13.5, fontWeight: opts.total ? 800 : 600, color: opts.color || T.text, fontFamily: FONT, letterSpacing: opts.total ? "-0.02em" : 0 }}>{value}</span>
    </div>
  );
  return (
    <Wrap T={T}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, background: `linear-gradient(${vc}14, ${vc}14), ${T.card}`, border: `1.5px solid ${vc}66`, marginBottom: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, color: vc }}>{r.verdict.label}</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, color: T.text, fontFamily: FONT }}>{fmtMoney(r.residual)}<span style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, marginLeft: 4 }}>/mo</span></div>
        </div>
        <div style={{ fontSize: 12.5, color: T.textSecondary, lineHeight: 1.5, fontFamily: FONT, flex: 1, minWidth: 200 }}>
          VA guideline <b style={{ color: T.text }}>{fmtMoney(r.guideline)}</b> for a family of {familySize} in the {region} · ratio <b style={{ color: r.ratioHigh ? T.orange : T.text }}>{fmtPct1(r.ratio)}</b>
          {r.pctOfGuideline !== null && <> · residual is <b style={{ color: T.text }}>{Math.round(r.pctOfGuideline * 100)}%</b> of the guideline</>}
          {r.ratioHigh && <> · needs {fmtMoney(r.requiredResidual)} (120%) with the ratio over 41%</>}
        </div>
      </div>
      {line("Gross monthly income", fmtMoney(r.grossIncome))}
      {line("Federal, state & FICA", `−${fmtMoney(r.fedTax + r.stateTax + r.fica)}`)}
      {r.otherDeductions > 0 && line("Other payroll deductions", `−${fmtMoney(r.otherDeductions)}`)}
      {line("Net take-home pay", fmtMoney(r.netEffectiveIncome))}
      {line("Shelter expense", `−${fmtMoney(r.totalShelter)}`)}
      {line("Debts & obligations", `−${fmtMoney(r.totalObligations)}`)}
      {line("Residual income", fmtMoney(r.residual), { total: true, color: r.surplus < 0 ? T.red : T.text })}
      <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.5, marginTop: 8, fontFamily: FONT }}>
        {r.surplus >= 0 ? `${fmtMoney(r.surplus)} above` : `${fmtMoney(-r.surplus)} below`} the VA table{r.guide.reduction > 0 ? " (5% commissary reduction applied)" : ""}. Shelter includes maintenance & utilities at {fmtMoney(r.shelter.maintUtil)}/mo; the ratio excludes them per VA Form 26-6393. Taxes {view.taxes.mode === "manual" ? "from paystubs" : "estimated from 2026 tables"}.
      </div>
    </Wrap>
  );
}
