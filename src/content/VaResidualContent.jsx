import { FONT, MONO } from "../lib/fonts.js";
import React, { useMemo, useState } from "react";
import { devCheckProps } from "../lib/devPropCheck.js";
import {
  buildVaResidualView, VA_REGION_NAMES, VA_MAINT_RATE_PER_SQFT, VA_RATIO_LIMIT,
  fmtMoney, fmtMoney2, fmtPct1,
} from "../lib/vaResidual.js";

/* ═══════════════════════════════════════════════════════════════
   VA RESIDUAL INCOME — Overview section (2026-09-13).

   The Form 26-6393 walk: gross income → payroll deductions → net
   take-home → shelter → debts → residual, judged against the VA regional
   table for the household's size and the loan-amount tier. Every figure
   comes pre-filled from the scenario (payment, taxes, insurance, HOA,
   qualifying income, Debts tab) and every one can be overridden with the
   paystub / underwriting figures. Math lives in lib/vaResidual.js and is
   shared with the Share card and the PDF page — nothing is recomputed here.

   State (persisted per scenario as `vaResidual`): see DEFAULT_VA_RESIDUAL.
   ═══════════════════════════════════════════════════════════════ */

const VERDICT_COLOR = (T, key) => ({ pass: T.green, caution: T.orange, fail: T.red, none: T.textTertiary }[key] || T.textTertiary);

function Overline({ T, children, color }) {
  return <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, color: color || T.textTertiary }}>{children}</div>;
}

function Chip({ T, active, onClick, children, title, color }) {
  const c = color || T.blue;
  return (
    <button type="button" onClick={onClick} aria-pressed={!!active} title={title} style={{
      border: `1px solid ${active ? c : T.inputBorder}`, background: active ? `${c}18` : "transparent", color: active ? c : T.textSecondary,
      borderRadius: 9999, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

// Compact money / number cell — commits on blur or Enter so a half-typed
// "3,2" never re-runs the worksheet under the cursor.
function NumCell({ T, value, onCommit, prefix, suffix, width = 96, decimals = 0, ariaLabel, disabled, placeholder, align = "right" }) {
  const [edit, setEdit] = useState(null);
  const fmt = (v) => (v === null || v === undefined || v === "" || !isFinite(+v)) ? "" : (+v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
  const commit = () => { if (edit === null) return; const n = parseFloat(String(edit).replace(/[^0-9.-]/g, "")); onCommit(isFinite(n) ? n : 0); setEdit(null); };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: disabled ? "transparent" : T.inputBg, border: `1px solid ${disabled ? "transparent" : T.inputBorder}`, borderRadius: 8, padding: disabled ? "4px 0" : "4px 8px", opacity: disabled ? 0.85 : 1 }}>
      {prefix && <span style={{ fontSize: 12, color: T.textTertiary, fontFamily: FONT }}>{prefix}</span>}
      <input aria-label={ariaLabel} type="text" inputMode="decimal" disabled={disabled} placeholder={placeholder}
        value={edit === null ? fmt(value) : edit}
        onFocus={() => setEdit(value ? String(value) : "")} onChange={(e) => setEdit(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        style={{ width, background: "transparent", border: "none", outline: "none", color: T.text, fontSize: 13, fontWeight: 600, fontFamily: FONT, textAlign: align, fontVariantNumeric: "tabular-nums" }} />
      {suffix && <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, whiteSpace: "nowrap" }}>{suffix}</span>}
    </span>
  );
}

function Row({ T, label, sub, right, bold, color, total, indent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: total ? "10px 0 8px" : "7px 0", paddingLeft: indent ? 12 : 0, borderBottom: total ? "none" : `1px solid ${T.separator}`, borderTop: total ? `2px solid ${T.separator}` : "none", marginTop: total ? 2 : 0 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: bold ? 13.5 : 13, fontWeight: bold ? 700 : 500, color: bold ? T.text : T.textSecondary, fontFamily: FONT, lineHeight: 1.3 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, marginTop: 1, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      <div style={{ flexShrink: 0, textAlign: "right", fontSize: bold ? 15 : 13.5, fontWeight: bold ? 800 : 600, color: color || T.text, fontFamily: FONT, letterSpacing: bold ? "-0.02em" : 0, display: "flex", alignItems: "center", gap: 6 }}>{right}</div>
    </div>
  );
}

function Meter({ T, residual, guideline, required, color }) {
  const top = Math.max(guideline * 1.5, residual, 1);
  const pct = (v) => `${Math.max(0, Math.min(100, (v / top) * 100))}%`;
  return (
    <div style={{ marginTop: 12 }} aria-hidden="true">
      <div style={{ position: "relative", height: 10, borderRadius: 9999, background: T.pillBg, overflow: "visible" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: pct(Math.max(0, residual)), borderRadius: 9999, background: color, transition: "width 0.3s" }} />
        {guideline > 0 && <div style={{ position: "absolute", left: pct(guideline), top: -4, bottom: -4, width: 2, background: T.text, opacity: 0.7 }} />}
        {required > guideline && <div style={{ position: "absolute", left: pct(required), top: -4, bottom: -4, width: 2, background: T.orange }} />}
      </div>
      <div style={{ position: "relative", height: 16, marginTop: 4, fontSize: 10.5, color: T.textTertiary, fontFamily: FONT }}>
        {guideline > 0 && <span style={{ position: "absolute", left: pct(guideline), transform: "translateX(-50%)", whiteSpace: "nowrap" }}>guideline {fmtMoney(guideline)}</span>}
        {required > guideline && <span style={{ position: "absolute", left: pct(required), transform: "translateX(-50%)", whiteSpace: "nowrap", color: T.orange }}>120% · {fmtMoney(required)}</span>}
      </div>
    </div>
  );
}

export default function VaResidualContent(props) {
  if (import.meta.env.DEV) devCheckProps("VaResidualContent", props, ["T", "isDesktop", "calc", "isRefi", "propertyState", "married", "taxState", "vaResidual", "setVaResidual", "Card"]);
  const { T, isDesktop, calc, isRefi, propertyState, married, taxState, vaResidual, setVaResidual, Card } = props;

  const view = useMemo(() => buildVaResidualView({ calc, isRefi, propertyState, married, taxState, vaResidual }), [calc, isRefi, propertyState, married, taxState, vaResidual]);
  const { V, result: r, region, autoRegion, regionIsOverride, familySize, familyAuto, loanAmount, taxes, maintAuto, maintIsOverride, appIncome, appDebts } = view;
  const patch = (p) => setVaResidual({ ...V, ...p });
  const vc = VERDICT_COLOR(T, r.verdict.key);
  const money = fmtMoney;

  const two = isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 28px" } : {};

  return (
    <div>
      {/* ═══ Verdict ═══ */}
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "auto 1fr" : "1fr", gap: isDesktop ? "10px 28px" : 12, alignItems: "start" }}>
          <div>
            <Overline T={T}>Residual income · monthly</Overline>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, color: r.residual < 0 ? T.red : T.text, fontFamily: FONT, marginTop: 4 }}>{money(r.residual)}</div>
            <div style={{ fontSize: 12.5, color: T.textSecondary, fontFamily: FONT, marginTop: 4, lineHeight: 1.5 }}>
              Guideline <b style={{ color: T.text }}>{money(r.guideline)}</b>{r.guide.reduction > 0 && <span> (table {money(r.guidelineBase)} less 5%)</span>} · {region || "no region"} · family of {familySize} · loans {r.guide.tierLabel}
            </div>
          </div>
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 9999, background: `${vc}18`, color: vc, fontSize: 12.5, fontWeight: 800, fontFamily: FONT }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: vc }} />{r.verdict.label}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 9999, background: r.ratioHigh ? `${T.orange}18` : T.pillBg, color: r.ratioHigh ? T.orange : T.textSecondary, fontSize: 12, fontWeight: 700, fontFamily: FONT }}>
                Ratio {fmtPct1(r.ratio)}{r.ratioHigh ? ` · over ${Math.round(VA_RATIO_LIMIT * 100)}%` : ""}
              </span>
              {r.pctOfGuideline !== null && r.verdict.key !== "none" && (
                <span style={{ padding: "5px 12px", borderRadius: 9999, background: T.pillBg, color: T.textSecondary, fontSize: 12, fontWeight: 700, fontFamily: FONT }}>{Math.round(r.pctOfGuideline * 100)}% of guideline</span>
              )}
            </div>
            <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.55, marginTop: 10, fontFamily: FONT }}>{r.verdict.detail}</div>
            {r.verdict.key !== "none" && (
              <div style={{ fontSize: 12.5, color: T.textSecondary, lineHeight: 1.5, marginTop: 6, fontFamily: FONT }}>
                {r.headroom >= 0
                  ? <>Cushion <b style={{ color: T.text }}>{money(r.headroom)}/mo</b> — new debt or payment could rise by that much before the test {r.ratioHigh ? "drops under 120%" : "fails"}.</>
                  : <>Needs <b style={{ color: T.red }}>{money(-r.headroom)}/mo</b> more residual income to {r.ratioHigh ? "reach 120% of the guideline" : "meet the guideline"}.</>}
              </div>
            )}
          </div>
        </div>
        <Meter T={T} residual={r.residual} guideline={r.guideline} required={r.requiredResidual} color={vc} />
      </Card>

      {/* ═══ Household & guideline ═══ */}
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr 1fr 1.2fr" : "1fr 1fr", gap: "16px 20px" }}>
          <div>
            <Overline T={T}>Region</Overline>
            <select value={region || ""} aria-label="VA region" onChange={(e) => patch({ regionOverride: e.target.value === autoRegion ? "" : e.target.value })}
              style={{ marginTop: 6, width: "100%", background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 10, padding: "7px 10px", color: T.text, fontSize: 13, fontWeight: 700, fontFamily: FONT }}>
              {!region && <option value="">Choose…</option>}
              {VA_REGION_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <div style={{ fontSize: 11, color: regionIsOverride ? T.orange : T.textTertiary, fontFamily: FONT, marginTop: 5, lineHeight: 1.4 }}>
              {regionIsOverride ? <>Overridden — {propertyState || "the property state"} is {autoRegion}. <button type="button" onClick={() => patch({ regionOverride: "" })} style={{ border: "none", background: "none", color: T.blue, fontWeight: 700, cursor: "pointer", fontFamily: FONT, fontSize: 11, padding: 0 }}>Use it</button></> : autoRegion ? `From ${propertyState}` : "Property state not in a VA region"}
            </div>
          </div>
          <div>
            <Overline T={T}>Family size</Overline>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 2, marginTop: 6, background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 9999, padding: 2 }}>
              <button type="button" aria-label="Fewer household members" onClick={() => patch({ familySize: Math.max(1, familySize - 1) })} style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "transparent", color: T.blue, fontSize: 18, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>−</button>
              <span style={{ minWidth: 28, textAlign: "center", fontSize: 15, fontWeight: 800, color: T.text, fontFamily: FONT }}>{familySize}</span>
              <button type="button" aria-label="More household members" onClick={() => patch({ familySize: familySize + 1 })} style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "transparent", color: T.blue, fontSize: 18, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>+</button>
            </div>
            <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, marginTop: 5, lineHeight: 1.4 }}>
              {familyAuto ? `From filing status (${married === "MFJ" ? "joint → 2" : "1"})` : <>Everyone in the household, on the loan or not. <button type="button" onClick={() => patch({ familySize: 0 })} style={{ border: "none", background: "none", color: T.blue, fontWeight: 700, cursor: "pointer", fontFamily: FONT, fontSize: 11, padding: 0 }}>Auto</button></>}
              {r.guide.familyCapped && <span style={{ color: T.orange }}> · Table stops at 7</span>}
            </div>
          </div>
          <div>
            <Overline T={T}>Commissary / exchange</Overline>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <Chip T={T} active={!V.activeDuty} onClick={() => patch({ activeDuty: false })}>No</Chip>
              <Chip T={T} active={!!V.activeDuty} onClick={() => patch({ activeDuty: true })}>Yes · −5%</Chip>
            </div>
            <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, marginTop: 5, lineHeight: 1.4 }}>Active duty or veterans who shop on base may have the guideline cut 5%.</div>
          </div>
          <div>
            <Overline T={T}>Maintenance & utilities</Overline>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
              <NumCell T={T} value={+V.sqft || 0} onCommit={(v) => patch({ sqft: v })} suffix="sq ft" width={58} ariaLabel="Living area in square feet" placeholder="0" />
              <span style={{ fontSize: 12, color: T.textTertiary }}>×</span>
              <NumCell T={T} value={+V.maintRate || 0} onCommit={(v) => patch({ maintRate: v })} prefix="$" decimals={3} width={44} ariaLabel="Maintenance and utilities rate per square foot" />
            </div>
            <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, marginTop: 5, lineHeight: 1.4 }}>
              {maintIsOverride ? <>Typed {money(view.maintUtil)}/mo · <button type="button" onClick={() => patch({ maintUtilOverride: null })} style={{ border: "none", background: "none", color: T.blue, fontWeight: 700, cursor: "pointer", fontFamily: FONT, fontSize: 11, padding: 0 }}>use sq ft</button></>
                : <>= {money(maintAuto)}/mo · VA centers commonly use ${VA_MAINT_RATE_PER_SQFT.toFixed(2)}/sq ft</>}
            </div>
          </div>
        </div>
      </Card>

      {/* ═══ The 26-6393 walk ═══ */}
      <Card>
        <div style={two}>
          {/* ── Income & deductions ── */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Overline T={T}>Income & payroll deductions</Overline>
              <div style={{ display: "flex", gap: 4 }}>
                <Chip T={T} active={V.incomeMode !== "manual"} onClick={() => patch({ incomeMode: "app" })} title="Qualifying income from the Income tab">Blueprint {money(appIncome)}</Chip>
                <Chip T={T} active={V.incomeMode === "manual"} onClick={() => patch({ incomeMode: "manual", grossIncomeManual: V.grossIncomeManual || Math.round(appIncome) })}>Type it</Chip>
              </div>
            </div>
            <Row T={T} label="Gross taxable income" sub={V.incomeMode === "manual" ? "wages, self-employment, taxable retirement" : "qualifying income from the Income tab"}
              right={V.incomeMode === "manual" ? <NumCell T={T} value={+V.grossIncomeManual || 0} onCommit={(v) => patch({ grossIncomeManual: v })} prefix="$" ariaLabel="Gross taxable monthly income" /> : money(r.grossTaxable)} />
            <Row T={T} label="Tax-free income" sub="VA disability, BAH/BAS, child support received — counted in full, never taxed"
              right={<NumCell T={T} value={+V.taxFreeIncome || 0} onCommit={(v) => patch({ taxFreeIncome: v })} prefix="$" ariaLabel="Tax-free monthly income" />} />
            <Row T={T} label="Gross monthly income" bold right={money(r.grossIncome)} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 14, marginBottom: 4 }}>
              <Overline T={T}>Less deductions</Overline>
              <div style={{ display: "flex", gap: 4 }}>
                <Chip T={T} active={taxes.mode !== "manual"} onClick={() => patch({ taxMode: "auto" })} title="2026 brackets, standard deduction, FICA">Estimate</Chip>
                <Chip T={T} active={taxes.mode === "manual"} onClick={() => patch({ taxMode: "manual", fedTax: V.fedTax || Math.round(taxes.est.fed), stateTax: V.stateTax || Math.round(taxes.est.state), fica: V.fica || Math.round(taxes.est.fica) })}>From paystubs</Chip>
              </div>
            </div>
            {[
              ["fedTax", "Federal income tax", taxes.mode === "manual" ? "monthly withholding" : `2026 ${married} brackets after the standard deduction`, r.fedTax],
              ["stateTax", "State income tax", taxes.mode === "manual" ? "monthly withholding" : taxes.stateType === "none" ? `${view.taxState || "state"} has no income tax` : `${view.taxState} tables`, r.stateTax],
              ["fica", "Social Security & Medicare", taxes.mode === "manual" ? "FICA on the stub" : "6.2% to the wage base + 1.45%", r.fica],
            ].map(([key, label, sub, val]) => (
              <Row key={key} T={T} label={label} sub={sub} indent
                right={taxes.mode === "manual" ? <NumCell T={T} value={+V[key] || 0} onCommit={(v) => patch({ [key]: v })} prefix="$" ariaLabel={label} /> : <span style={{ color: T.textSecondary }}>−{money(val)}</span>} />
            ))}
            <Row T={T} label="Other payroll deductions" sub="retirement, union dues, garnishments" indent
              right={<NumCell T={T} value={+V.otherDeductions || 0} onCommit={(v) => patch({ otherDeductions: v })} prefix="$" ariaLabel="Other monthly payroll deductions" />} />
            <Row T={T} label="Net take-home pay" bold right={money(r.netEffectiveIncome)} color={r.netEffectiveIncome < 0 ? T.red : undefined} />
          </div>

          {/* ── Shelter & obligations ── */}
          <div style={isDesktop ? {} : { marginTop: 18 }}>
            <div style={{ marginBottom: 4 }}><Overline T={T}>Shelter expense</Overline></div>
            <Row T={T} label="Principal & interest" sub={`${money(loanAmount)} loan`} right={money(r.shelter.pi)} />
            <Row T={T} label="Property taxes" right={money(r.shelter.propertyTax)} />
            <Row T={T} label="Hazard insurance" right={money(r.shelter.hazardIns)} />
            <Row T={T} label="Special assessments" sub="Mello-Roos, PACE, bonds"
              right={<NumCell T={T} value={+V.specialAssessments || 0} onCommit={(v) => patch({ specialAssessments: v })} prefix="$" ariaLabel="Monthly special assessments" />} />
            <Row T={T} label="Maintenance & utilities" sub={maintIsOverride ? "typed" : `${(+V.sqft || 0).toLocaleString()} sq ft × $${(+V.maintRate || 0).toFixed(2)}`}
              right={<NumCell T={T} value={Math.round(view.maintUtil)} onCommit={(v) => patch({ maintUtilOverride: v === Math.round(maintAuto) ? null : v })} prefix="$" ariaLabel="Monthly maintenance and utilities" />} />
            <Row T={T} label="HOA / condo dues" right={money(r.shelter.hoa)} />
            <Row T={T} label="Total shelter" bold right={money(r.totalShelter)} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 14, marginBottom: 4 }}>
              <Overline T={T}>Debts & obligations</Overline>
              <div style={{ display: "flex", gap: 4 }}>
                <Chip T={T} active={V.debtMode !== "manual"} onClick={() => patch({ debtMode: "app" })} title="Qualifying debts from the Debts tab, plus REO shortfalls">Debts tab {money(appDebts)}</Chip>
                <Chip T={T} active={V.debtMode === "manual"} onClick={() => patch({ debtMode: "manual", debtsManual: V.debtsManual || Math.round(appDebts) })}>Type it</Chip>
              </div>
            </div>
            <Row T={T} label="Installment & revolving debts" sub={V.debtMode === "manual" ? "monthly payments on the credit report" : "from the Debts tab, payoffs excluded"}
              right={V.debtMode === "manual" ? <NumCell T={T} value={+V.debtsManual || 0} onCommit={(v) => patch({ debtsManual: v })} prefix="$" ariaLabel="Monthly debt payments" /> : money(r.obligations.debts)} />
            <Row T={T} label="Child care" right={<NumCell T={T} value={+V.childcare || 0} onCommit={(v) => patch({ childcare: v })} prefix="$" ariaLabel="Monthly child care" />} />
            <Row T={T} label="Alimony / child support paid" right={<NumCell T={T} value={+V.supportPaid || 0} onCommit={(v) => patch({ supportPaid: v })} prefix="$" ariaLabel="Monthly alimony or child support paid" />} />
            <Row T={T} label="Job-related expenses" sub="commuting, union dues not on the stub, uniforms" right={<NumCell T={T} value={+V.jobExpenses || 0} onCommit={(v) => patch({ jobExpenses: v })} prefix="$" ariaLabel="Monthly job-related expenses" />} />
            <Row T={T} label="Other obligations" right={<NumCell T={T} value={+V.otherObligations || 0} onCommit={(v) => patch({ otherObligations: v })} prefix="$" ariaLabel="Other monthly obligations" />} />
            <Row T={T} label="Total obligations" bold right={money(r.totalObligations)} />
          </div>
        </div>

        {/* ── Result strip ── */}
        <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: `${vc}10`, border: `1px solid ${vc}55` }}>
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "1fr 1fr", gap: 12 }}>
            {[
              ["Net take-home", money(r.netEffectiveIncome)],
              ["− Shelter − debts", money(r.totalShelter + r.totalObligations)],
              ["= Residual income", money(r.residual), r.residual < r.guideline ? T.red : T.text],
              [r.ratioHigh ? "Needs 120% · " + money(r.requiredResidual) : "Guideline", money(r.guideline), undefined],
            ].map(([l, v, c]) => (
              <div key={l}>
                <Overline T={T}>{l}</Overline>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: c || T.text, fontFamily: FONT, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Chip T={T} active={!!V.grossUp} onClick={() => patch({ grossUp: !V.grossUp })} title="Tax-free income may be grossed up 25% for the debt ratio only, never for residual income">Gross up tax-free 25% for the ratio</Chip>
            <span style={{ fontSize: 11.5, color: T.textTertiary, fontFamily: FONT }}>Ratio = shelter (without maintenance & utilities) + obligations ÷ gross income = <b style={{ color: r.ratioHigh ? T.orange : T.textSecondary }}>{fmtPct1(r.ratio)}</b></span>
          </div>
        </div>

        {/* ── Notes / compensating factors ── */}
        <div style={{ marginTop: 14 }}>
          <Overline T={T}>Compensating factors & notes</Overline>
          <textarea value={V.notes || ""} onChange={(e) => patch({ notes: e.target.value })} rows={2} aria-label="Compensating factors and notes" placeholder={r.verdict.key === "caution" || r.verdict.key === "fail" ? "Long-term employment, reserves after closing, minimal payment shock, tax-free income not grossed up…" : "Optional — prints on the PDF"}
            style={{ marginTop: 6, width: "100%", boxSizing: "border-box", background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 10, padding: "8px 10px", color: T.text, fontSize: 13, fontFamily: FONT, resize: "vertical", outline: "none" }} />
        </div>
      </Card>

      <div style={{ fontSize: 11.5, color: T.textTertiary, lineHeight: 1.6, fontFamily: FONT, padding: "0 4px" }}>
        VA Lenders Handbook (Pamphlet 26-7) Ch. 4, Topic 9 and Form 26-6393. Count everyone the veteran supports as family, on the note or not; a spouse or dependent fully supported by verified income that is <em>not</em> in effective income may be left out. Families over five add {fmtMoney2(r.guide.adderPerMember).replace(".00", "")} per member through seven. When the ratio tops 41%, residual income must reach 120% of the guideline or the underwriter documents compensating factors. Tax estimates use 2026 tables; VA underwrites to the withholding on the paystubs — switch to “From paystubs” once you have them. The guideline is firm: a shortfall is not offset by a low ratio alone.
      </div>
    </div>
  );
}
