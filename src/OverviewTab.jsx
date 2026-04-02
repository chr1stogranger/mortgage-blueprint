import React, { useState, useRef, useEffect, useCallback } from "react";
// OverviewStickyBar moved to MortgageBlueprint.jsx to show on all tabs

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

/* ─── Local format helpers (mirrors MortgageBlueprint.jsx) ─── */
function fmt(v, compact) {
  if (v == null || !isFinite(v) || isNaN(v)) return "$0";
  if (compact && Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
  if (compact && Math.abs(v) >= 1e4) return "$" + (v / 1e3).toFixed(0) + "K";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}
function fmt2(v) { return v == null || !isFinite(v) || isNaN(v) ? "$0.00" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v); }
function pct(v, d = 1) { return ((v || 0) * 100).toFixed(d) + "%"; }

/* ─── Tiny sub-components (same API as MortgageBlueprint) ─── */
function OCard({ children, style: s, T, pad, onClick }) {
  return (
    <div onClick={onClick} style={{ background: T.card, borderRadius: 16, padding: pad || 18, boxShadow: T.cardShadow, marginBottom: 12, cursor: onClick ? "pointer" : "default", ...s }}>
      {children}
    </div>
  );
}

function OMRow({ label, value, sub, color, bold, T, tip }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 0", borderBottom: `1px solid ${T.separator}` }}>
      <span style={{ fontSize: bold ? 15 : 14, fontWeight: bold ? 600 : 400, color: bold ? T.text : T.textSecondary, fontFamily: FONT }}>
        {label}{sub && <span style={{ color: T.textTertiary, fontSize: 12, marginLeft: 6 }}>{sub}</span>}
      </span>
      <span style={{ fontSize: bold ? 16 : 15, fontWeight: 600, fontFamily: FONT, color: color || T.text, letterSpacing: "-0.02em" }}>{value}</span>
    </div>
  );
}

function OSec({ title, T, children, action, onAction }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 28, marginBottom: 12, paddingLeft: 4 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: FONT, color: T.text, letterSpacing: "-0.02em" }}>{title}</h2>
        {action && <button onClick={onAction} style={{ background: "none", border: "none", color: T.blue, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>{action}</button>}
      </div>
      {children}
    </>
  );
}

function SectionDivider({ T }) {
  return <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${T.blue}30, transparent)`, margin: "28px 0 8px" }} />;
}

function JumpLink({ label, T, onClick }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", cursor: "pointer", marginTop: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.blue, fontFamily: FONT }}>{label}</span>
      <span style={{ fontSize: 14, color: T.blue }}>→</span>
    </div>
  );
}

/* ─── Collapsible section wrapper ─── */
function CollapsibleSection({ title, T, defaultOpen = true, children, id, action, onAction }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, marginBottom: open ? 12 : 4, paddingLeft: 4 }}>
        <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <span style={{ fontSize: 14, color: T.textTertiary, transition: "transform 0.2s", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>▾</span>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: FONT, color: T.text, letterSpacing: "-0.02em" }}>{title}</h2>
        </div>
        {action && <button onClick={onAction} style={{ background: "none", border: "none", color: T.blue, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>{action}</button>}
      </div>
      {open && children}
    </div>
  );
}

/* ─── IFW-style fee line item ─── */
function FeeRow({ label, value, T, indent, bold, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0", paddingLeft: indent ? 12 : 0 }}>
      <span style={{ fontSize: bold ? 13 : 12, fontWeight: bold ? 600 : 400, color: bold ? (color || T.text) : T.textSecondary, fontFamily: FONT }}>{label}</span>
      <span style={{ fontSize: bold ? 13 : 12, fontWeight: bold ? 600 : 500, fontFamily: MONO, color: color || T.text, letterSpacing: "-0.02em" }}>{value}</span>
    </div>
  );
}

/* ─── IFW-style category header ─── */
function FeeCategory({ title, total, T, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 2 }}>
      <div onClick={() => setOpen(!open)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.separator}`, cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: T.textTertiary, transition: "transform 0.2s", transform: open ? "rotate(0deg)" : "rotate(-90deg)", lineHeight: 1 }}>▾</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT }}>{title}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: MONO, color: T.text }}>{total}</span>
      </div>
      {open && <div style={{ padding: "4px 0 8px", borderBottom: `1px solid ${T.separator}` }}>{children}</div>}
    </div>
  );
}

/* ─── Collapsible tax deduction details ─── */
function TaxDetailsCollapsible({ T, calc, fmt, fmt2, pct, taxState }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "6px 0" }}>
        <span style={{ fontSize: 11, color: T.textTertiary, transition: "transform 0.2s", transform: open ? "rotate(0deg)" : "rotate(-90deg)", lineHeight: 1 }}>▾</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.blue, fontFamily: FONT }}>How This Is Calculated</span>
      </div>
      {open && (
        <div style={{ paddingTop: 8, animation: "fadeIn 0.2s ease" }}>
          {/* Deduction line items */}
          <div style={{ fontSize: 10, fontWeight: 600, color: T.textTertiary, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: MONO, marginBottom: 6 }}>Federal Itemized Deductions</div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.separator}` }}>
            <span style={{ fontSize: 12, color: T.textSecondary }}>Mortgage Interest (Year 1)</span>
            <span style={{ fontSize: 12, fontFamily: MONO, color: T.text }}>{fmt(calc.fedMortInt)}</span>
          </div>
          {calc.mortIntDeductLimit && calc.totalMortInt > calc.fedMortInt && (
            <div style={{ fontSize: 10, color: T.orange, padding: "2px 0 4px 12px" }}>
              Limited to {fmt(calc.mortIntDeductLimit)} loan balance ({pct(calc.deductibleLoanPct, 0)} of total interest)
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.separator}` }}>
            <span style={{ fontSize: 12, color: T.textSecondary }}>Property Tax (SALT-capped)</span>
            <span style={{ fontSize: 12, fontFamily: MONO, color: T.text }}>{fmt(calc.fedPropTax)}</span>
          </div>
          {calc.yearlyTax > calc.fedPropTax && (
            <div style={{ fontSize: 10, color: T.orange, padding: "2px 0 4px 12px" }}>
              Actual property tax: {fmt(calc.yearlyTax)} — SALT cap: {fmt(calc.saltCap)}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 600 }}>
            <span style={{ fontSize: 12, color: T.text }}>Total Federal Itemized</span>
            <span style={{ fontSize: 12, fontFamily: MONO, color: T.text }}>{fmt(calc.fedItemized)}</span>
          </div>

          {/* Bracket waterfall */}
          {calc.fedWaterfall && calc.fedWaterfall.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.textTertiary, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: MONO, marginTop: 14, marginBottom: 6 }}>Federal Tax Bracket Savings</div>
              {calc.fedWaterfall.map((w, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", borderBottom: `1px solid ${T.separator}` }}>
                  <span style={{ fontSize: 12, color: T.textSecondary }}>{(w.rate * 100).toFixed(0)}% bracket — {fmt(w.amount)}</span>
                  <span style={{ fontSize: 12, fontFamily: MONO, color: T.green, fontWeight: 600 }}>{fmt(w.savings)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 600 }}>
                <span style={{ fontSize: 12, color: T.text }}>Federal Savings</span>
                <span style={{ fontSize: 12, fontFamily: MONO, color: T.green }}>{fmt(calc.fedSavings)}</span>
              </div>
            </>
          )}

          {/* State savings */}
          {(calc.stateSavings > 0 || calc.stTopRate > 0) && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.textTertiary, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: MONO, marginTop: 14, marginBottom: 6 }}>State Tax Savings{taxState ? ` (${taxState})` : ""}</div>
              {calc.stateItemized > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.separator}` }}>
                  <span style={{ fontSize: 12, color: T.textSecondary }}>State Itemized Deductions</span>
                  <span style={{ fontSize: 12, fontFamily: MONO, color: T.text }}>{fmt(calc.stateItemized)}</span>
                </div>
              )}
              {calc.stWaterfall && calc.stWaterfall.length > 0 && calc.stWaterfall.map((w, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", borderBottom: `1px solid ${T.separator}` }}>
                  <span style={{ fontSize: 12, color: T.textSecondary }}>{(w.rate * 100).toFixed(1)}% bracket — {fmt(w.amount)}</span>
                  <span style={{ fontSize: 12, fontFamily: MONO, color: T.green, fontWeight: 600 }}>{fmt(w.savings)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 600 }}>
                <span style={{ fontSize: 12, color: T.text }}>State Savings</span>
                <span style={{ fontSize: 12, fontFamily: MONO, color: T.green }}>{fmt(calc.stateSavings)}</span>
              </div>
            </>
          )}

          {/* Combined summary */}
          <div style={{ background: `${T.purple}10`, borderRadius: 10, padding: "10px 12px", marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.purple }}>Combined Top Marginal Rate</span>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: MONO, color: T.purple }}>{(calc.combinedTopRate * 100).toFixed(1)}%</span>
            </div>
            <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
              Every dollar of mortgage interest or property tax above the standard deduction saves {(calc.combinedTopRate * 100).toFixed(0)} cents in combined taxes.
            </div>
          </div>

          {/* Monthly breakdown */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 4px", marginTop: 8 }}>
            <span style={{ fontSize: 12, color: T.textSecondary }}>Monthly tax savings</span>
            <span style={{ fontSize: 12, fontFamily: MONO, fontWeight: 600, color: T.purple }}>{fmt(calc.monthlyTaxSavings)}/mo</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ fontSize: 12, color: T.textSecondary }}>After-tax payment</span>
            <span style={{ fontSize: 12, fontFamily: MONO, fontWeight: 600, color: T.text }}>{fmt(calc.afterTaxPayment)}/mo</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Property Tax expandable pill for Overview ─── */
function PropertyTaxPill({ T, calc, salesPrice, propTaxMode, setPropTaxMode,
  taxBaseRateOverride, setTaxBaseRateOverride, taxExemptionOverride, setTaxExemptionOverride,
  fixedAssessments, setFixedAssessments, propertyState, city, loanPurpose, Inp, fmt, fmt2, isDesktop }) {
  const [isExpanded, setIsExpanded] = useState(propTaxMode === "custom");
  const autoRate = calc.autoTaxRate || 0;
  const isCustom = propTaxMode === "custom";
  const cityLabel = propertyState === "California" ? (city || "CA") : (propertyState || "State");

  return (
    <div style={{ marginTop: 8, borderRadius: 12, border: `1px solid ${isExpanded ? `${T.blue}40` : T.cardBorder}`, overflow: "hidden", transition: "all 0.3s" }}>
      {/* Header — always visible */}
      <div
        onClick={() => {
          const opening = !isExpanded;
          setIsExpanded(opening);
          if (opening && !isCustom) {
            setPropTaxMode("custom");
            if (taxBaseRateOverride === 0) setTaxBaseRateOverride(parseFloat((autoRate * 100).toFixed(4)));
          }
        }}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", cursor: "pointer", background: isExpanded ? `${T.blue}06` : "transparent" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT }}>Property Tax</span>
          <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT }}>({cityLabel})</span>
          <span style={{ fontSize: 12, color: T.textSecondary, fontFamily: MONO }}>{fmt(calc.monthlyTax)}/mo</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, fontFamily: MONO,
            color: isCustom ? T.blue : T.textTertiary,
            background: isCustom ? `${T.blue}15` : T.pillBg || `${T.textTertiary}12`,
            borderRadius: 99, padding: "2px 8px",
          }}>{isCustom ? "ADVANCED" : "AUTO"}</span>
          <span style={{ color: T.textTertiary, fontSize: 11, transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
        </div>
      </div>

      {/* Collapsed summary */}
      {!isExpanded && (
        <div style={{ padding: "0 14px 10px", fontSize: 11, color: T.textTertiary, lineHeight: 1.5, marginTop: -4 }}>
          {isCustom ? (
            <>
              <span style={{ fontFamily: MONO, color: T.textSecondary }}>{(taxBaseRateOverride || 0).toFixed(3)}%</span>
              {fixedAssessments > 0 && <> + <span style={{ fontFamily: MONO, color: T.textSecondary }}>{fmt(fixedAssessments)}/yr fixed</span></>}
              {" → "}
              <span style={{ fontFamily: MONO, color: T.text, fontWeight: 600 }}>{fmt(calc.yearlyTax)}/yr</span>
            </>
          ) : (
            <>
              {propertyState === "California" ? `${cityLabel} base: ` : `${cityLabel} avg: `}
              <span style={{ fontFamily: MONO, color: T.textSecondary }}>{(autoRate * 100).toFixed(3)}%</span>
              {fixedAssessments > 0 && <> + <span style={{ fontFamily: MONO, color: T.textSecondary }}>{fmt(fixedAssessments)}/yr fixed</span></>}
              {" → "}
              <span style={{ fontFamily: MONO, color: T.text, fontWeight: 600 }}>{fmt(calc.yearlyTax)}/yr</span>
            </>
          )}
        </div>
      )}

      {/* Expanded: full property tax calculator */}
      {isExpanded && (
        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ height: 1, background: T.separator, marginBottom: 12 }} />

          {/* Base Rate + Exemption */}
          <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 } : { marginBottom: 8 }}>
            <Inp label={<>Base Tax Rate <span style={{ color: T.textTertiary, fontWeight: 400, fontSize: 11 }}>({cityLabel})</span></>} value={taxBaseRateOverride} onChange={setTaxBaseRateOverride} prefix="" suffix="%" max={10} step={0.001} sm />
            <Inp label={<>Exemption <span style={{ color: T.textTertiary, fontSize: 10 }}>*</span></>} value={taxExemptionOverride} onChange={setTaxExemptionOverride} prefix="$" max={500000} sm />
          </div>

          {/* Fixed Assessments */}
          <Inp label={<>Fixed Assessments <span style={{ color: T.textTertiary, fontSize: 10 }}>*</span></>} value={fixedAssessments} onChange={setFixedAssessments} prefix="$" suffix="/yr" max={50000} sm />

          {/* Explainer footnotes */}
          <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 4, lineHeight: 1.6, fontFamily: FONT }}>
            <span style={{ color: T.textTertiary }}>*</span> Exemption: primary residence reduction (CA default $7K). Fixed Assessments: Mello-Roos, bonds, parcel taxes.
          </div>

          {/* Breakdown table */}
          <div style={{ marginTop: 12, background: T.inputBg || `${T.textTertiary}08`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, color: T.textTertiary, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Property Tax Calculation</div>
            {[
              ["Home Value", fmt(salesPrice)],
              ["Exemption", calc.exemption > 0 ? `-${fmt(calc.exemption)}` : "$0"],
              ["Taxable Value", fmt(calc.taxableValue)],
              ["Base Rate", `${(taxBaseRateOverride || 0).toFixed(4)}%`],
              ["Base Tax", fmt2(calc.baseTax)],
              ...(fixedAssessments > 0 ? [["Fixed Assessments", fmt(fixedAssessments)]] : []),
            ].map(([label, value], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.separator}` }}>
                <span style={{ fontSize: 12, color: T.textSecondary }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 500, fontFamily: MONO, color: T.text }}>{value}</span>
              </div>
            ))}
            {/* Total */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 4px", borderTop: `2px solid ${T.separator}`, marginTop: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Annual Total</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: T.text }}>{fmt2(calc.yearlyTax)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: `${T.orange}12`, borderRadius: 8, marginTop: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.orange }}>Monthly</span>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO, color: T.orange }}>{fmt2(calc.monthlyTax)}</span>
            </div>
            {calc.effectiveTaxRate > 0 && (
              <div style={{ fontSize: 10, color: T.textTertiary, textAlign: "center", marginTop: 6 }}>
                Effective rate: {(calc.effectiveTaxRate * 100).toFixed(3)}%
              </div>
            )}
          </div>

          {/* Reset to auto */}
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <span onClick={() => { setPropTaxMode("auto"); setTaxBaseRateOverride(0); setFixedAssessments(1500); setTaxExemptionOverride(7000); setIsExpanded(false); }} style={{ fontSize: 11, color: T.textTertiary, cursor: "pointer", textDecoration: "underline" }}>Reset to auto-estimate</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── IFW-style Cash to Close section ─── */
function IFWCashToClose({ T, calc, isRefi, downPct, underwritingFee, processingFee,
  appraisalFee, creditReportFee, floodCertFee, mersFee, taxServiceFee,
  titleInsurance, titleSearch, settlementFee, escrowFee,
  recordingFee, lenderCredit, sellerCredit, realtorCredit, emd,
  discountPts, payoffAtClosing, setTab, closingMonth, closingDay }) {

  return (
    <div id="overview-costs">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, marginBottom: 12, paddingLeft: 4 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: FONT, color: T.text, letterSpacing: "-0.02em" }}>
          {isRefi ? "Estimated Refi Costs" : "Cash to Close"}
        </h2>
        <button onClick={() => setTab("costs")} style={{ background: "none", border: "none", color: T.blue, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Full Breakdown →</button>
      </div>

      {/* ── Always-visible summary (green card) — 3-5 buckets ── */}
      <OCard T={T} style={{ background: `${T.green}08`, border: `1px solid ${T.green}20` }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: T.green, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: MONO, marginBottom: 10 }}>
          {isRefi ? "Estimated Refi Costs" : "Estimated Funds to Close"}
        </div>
        {/* 1) Down Payment (purchase only) */}
        {!isRefi && <FeeRow T={T} label="Down Payment" value={fmt(calc.dp)} bold />}
        {/* 2) Closing Costs = Lender + Third Party + Gov */}
        <FeeRow T={T} label="Closing Costs" value={fmt(calc.totalClosingCosts)} bold />
        {/* 3) Prepaid Expenses = Prepaids + Initial Escrow */}
        <FeeRow T={T} label="Prepaid Expenses" value={fmt(calc.totalPrepaidExp)} bold />
        {/* 4) Debts / Loans to be Paid Off (if applicable) */}
        {payoffAtClosing > 0 && <FeeRow T={T} label="Loans Paid Off at Closing" value={fmt(payoffAtClosing)} bold />}
        {/* 5) Credits (if applicable) */}
        {calc.totalCredits > 0 && <FeeRow T={T} label="Credits" value={`(${fmt(calc.totalCredits)})`} bold color={T.green} />}
        <div style={{ borderTop: `2px solid ${T.green}40`, marginTop: 8, paddingTop: 8 }}>
          <FeeRow T={T} label={isRefi ? "ESTIMATED TOTAL REFI COSTS" : "ESTIMATED CASH TO CLOSE"} value={fmt(isRefi ? calc.totalClosingCosts + calc.totalPrepaidExp + payoffAtClosing - calc.totalCredits : calc.cashToClose)} bold color={T.green} />
        </div>
      </OCard>

      {/* ── Collapsible detailed breakdown ── */}
      <CollapsibleSection title="Fee Breakdown" T={T} defaultOpen={false}>
        <OCard T={T} pad={16}>
          {/* A. Lender Fees */}
          <FeeCategory title="A. Origination Charges" total={fmt(calc.origCharges)} T={T}>
            {underwritingFee > 0 && <FeeRow T={T} label="Underwriting Fee" value={fmt(underwritingFee)} indent />}
            {processingFee > 0 && <FeeRow T={T} label="Processing Fee" value={fmt(processingFee)} indent />}
            {calc.pointsCost > 0 && <FeeRow T={T} label={`Discount Points (${discountPts}%)`} value={fmt(calc.pointsCost)} indent />}
          </FeeCategory>

          {/* B. Services You Cannot Shop For */}
          <FeeCategory title="B. Services You Cannot Shop For" total={fmt(calc.cannotShop)} T={T}>
            {appraisalFee > 0 && <FeeRow T={T} label="Appraisal Fee" value={fmt(appraisalFee)} indent />}
            {creditReportFee > 0 && <FeeRow T={T} label="Credit Report" value={fmt(creditReportFee)} indent />}
            {floodCertFee > 0 && <FeeRow T={T} label="Flood Certification" value={fmt(floodCertFee)} indent />}
            {mersFee > 0 && <FeeRow T={T} label="MERS Fee" value={fmt(mersFee)} indent />}
            {taxServiceFee > 0 && <FeeRow T={T} label="Tax Service Fee" value={fmt(taxServiceFee)} indent />}
          </FeeCategory>

          {/* C. Services You Can Shop For */}
          <FeeCategory title="C. Services You Can Shop For" total={fmt(calc.canShop)} T={T}>
            {titleInsurance > 0 && <FeeRow T={T} label="Title Insurance" value={fmt(titleInsurance)} indent />}
            {titleSearch > 0 && <FeeRow T={T} label="Title Search" value={fmt(titleSearch)} indent />}
            {settlementFee > 0 && <FeeRow T={T} label="Settlement / Closing Fee" value={fmt(settlementFee)} indent />}
            {escrowFee > 0 && <FeeRow T={T} label="Escrow Fee" value={fmt(escrowFee)} indent />}
            {calc.hoaCert > 0 && <FeeRow T={T} label="HOA Certification" value={fmt(calc.hoaCert)} indent />}
          </FeeCategory>

          {/* E. Taxes & Government Fees */}
          <FeeCategory title="E. Taxes & Government Fees" total={fmt(calc.govCharges)} T={T}>
            {calc.buyerCityTT > 0 && <FeeRow T={T} label="Transfer Tax (City)" value={fmt(calc.buyerCityTT)} indent />}
            {recordingFee > 0 && <FeeRow T={T} label="Recording Fees" value={fmt(recordingFee)} indent />}
          </FeeCategory>

          {/* F. Prepaids & G. Initial Escrow */}
          <FeeCategory title="F/G. Prepaids & Initial Escrow" total={fmt(calc.totalPrepaidExp)} T={T}>
            {calc.prepaidInt > 0 && <FeeRow T={T} label={`Prepaid Interest (${calc.autoPrepaidDays} days)`} value={fmt2(calc.prepaidInt)} indent />}
            {calc.prepaidIns > 0 && <FeeRow T={T} label="Prepaid Homeowner's Insurance (12 mo)" value={fmt(calc.prepaidIns)} indent />}
            {calc.initialEscrow > 0 && <FeeRow T={T} label={`Initial Escrow (${calc.escrowTaxMonths} mo tax + ${calc.escrowInsMonths} mo ins)`} value={fmt(calc.initialEscrow)} indent />}
            {closingMonth > 0 && (() => {
              const mos = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
              const skipMo = mos[closingMonth % 12];
              const firstMo = mos[(closingMonth + 1) % 12];
              return (
                <div style={{ background: `${T.blue}08`, borderRadius: 8, padding: "8px 10px", marginTop: 6 }}>
                  <div style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.6 }}>
                    <span style={{ fontWeight: 600, color: T.blue }}>Close {mos[closingMonth-1]} {closingDay}</span> → {calc.autoPrepaidDays} days prepaid interest · No payment in <strong>{skipMo}</strong> · First payment <strong>{firstMo} 1st</strong>
                  </div>
                </div>
              );
            })()}
          </FeeCategory>

          {/* J. Credits */}
          {calc.totalCredits > 0 && (
            <FeeCategory title="J. Credits" total={`(${fmt(calc.totalCredits)})`} T={T}>
              {lenderCredit > 0 && <FeeRow T={T} label="Lender Credit" value={`(${fmt(lenderCredit)})`} indent color={T.green} />}
              {!isRefi && sellerCredit > 0 && <FeeRow T={T} label="Seller Credit" value={`(${fmt(sellerCredit)})`} indent color={T.green} />}
              {!isRefi && realtorCredit > 0 && <FeeRow T={T} label="Realtor Credit" value={`(${fmt(realtorCredit)})`} indent color={T.green} />}
              {!isRefi && emd > 0 && <FeeRow T={T} label="Earnest Money Deposit" value={`(${fmt(emd)})`} indent color={T.green} />}
            </FeeCategory>
          )}
        </OCard>
      </CollapsibleSection>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   OVERVIEW TAB — The full-page scrollable deal view
   ═══════════════════════════════════════════════════════════════ */
export default function OverviewTab({
  /* All state from MortgageBlueprint */
  salesPrice, setSalesPrice,
  downPct, setDownPct, downMode, setDownMode,
  rate, setRate,
  term, setTerm,
  loanType, setLoanType,
  propType, setPropType,
  loanPurpose, setLoanPurpose,
  propertyState, setPropertyState,
  city, setCity,
  propertyZip,
  annualIns, setAnnualIns,
  hoa, setHoa,
  includeEscrow, setIncludeEscrow,
  closingMonth, closingDay,
  isRefi,
  firstTimeBuyer,
  creditScore,
  married,
  taxState,
  darkMode,
  isDesktop,
  T,
  calc,
  paySegs,
  /* Qualification */
  allGood, someGood,
  purchPillarCount, refiPillarCount,
  dpOk, refiLtvCheck,
  refiPurpose,
  /* Debts */
  debts, debtFree,
  ownsProperties,
  /* Income */
  incomes,
  /* Assets */
  assets,
  /* Amortization */
  payExtra, setPayExtra,
  extraPayment, setExtraPayment,
  appreciationRate, setAppreciationRate,
  /* Sell */
  hasSellProperty,
  sellPrice, sellMortgagePayoff,
  /* Navigation */
  setTab,
  /* Render helpers from parent */
  PayRing, StopLight, AmortChart, Progress,
  Inp, Sel, SearchSelect, Note, InfoTip,
  /* Live Rates */
  liveRates, fetchRates, ratesLoading, ratesError, fredApiKey,
  /* Misc */
  loanTypes, propTypes, closingMonths,
  scenarioName,
  scenarioList, switchScenario, onCompare,
  isCloud, auth,
  isBorrower,
  /* REO */
  reos,
  /* Individual fees for IFW-style breakdown */
  underwritingFee, processingFee, appraisalFee, creditReportFee,
  floodCertFee, mersFee, taxServiceFee,
  titleInsurance, titleSearch, settlementFee, escrowFee,
  recordingFee, lenderCredit, sellerCredit, realtorCredit, emd,
  discountPts, payoffAtClosing,
  /* Property tax calculator */
  propTaxMode, setPropTaxMode,
  taxBaseRateOverride, setTaxBaseRateOverride,
  taxExemptionOverride, setTaxExemptionOverride,
  fixedAssessments, setFixedAssessments,
}) {
  const qualRef = useRef(null);

  const scrollToQualification = useCallback(() => {
    const el = document.getElementById("overview-qualification");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div style={{ marginTop: 0, paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: 80 }}>
      {/* ═══════════════════════════════════════
          SECTION 1: LOAN STRUCTURE (EDITABLE)
          ═══════════════════════════════════════ */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 34, fontWeight: 700, fontFamily: FONT, color: T.blue, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          {isRefi ? "Refinance" : "Purchase"} Overview
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          {(city || propertyZip) && (
            <span style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, fontFamily: MONO, letterSpacing: "0.01em" }}>
              {city}{city && propertyState ? ", " : ""}{propertyState ? (propertyState.length > 2 ? propertyState.substring(0, 2).toUpperCase() : propertyState) : ""}{propertyZip ? ` ${propertyZip}` : ""}
            </span>
          )}
          {(city || propertyZip) && <span style={{ color: T.textTertiary, fontSize: 10 }}>·</span>}
          {/* Scenario selector pill */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: T.pillBg, borderRadius: 8, padding: "2px 8px",
          }}>
            {(scenarioList || []).length > 1 ? (scenarioList || []).map(name => (
              <span key={name}
                onClick={() => name !== scenarioName ? switchScenario(name) : null}
                style={{
                  fontSize: 11, fontWeight: name === scenarioName ? 700 : 400,
                  color: name === scenarioName ? T.blue : T.textTertiary,
                  cursor: name === scenarioName ? "default" : "pointer",
                  textDecoration: name === scenarioName ? "none" : "underline",
                  whiteSpace: "nowrap", transition: "all 0.2s",
                }}>
                {name}
              </span>
            )) : (
              <span style={{ fontSize: 11, fontWeight: 600, color: T.blue, whiteSpace: "nowrap" }}>
                {scenarioName || "Scenario 1"}
              </span>
            )}
            {(scenarioList || []).length > 1 && onCompare && (
              <span onClick={onCompare} style={{
                fontSize: 9, fontWeight: 700, color: T.blue,
                background: `${T.blue}15`, borderRadius: 5,
                padding: "1px 5px", cursor: "pointer", whiteSpace: "nowrap",
              }}>Compare</span>
            )}
          </div>
          {/* Sign-in prompt */}
          {!isCloud && !auth?.localMode && auth?.requestLogin && (
            <button onClick={auth.requestLogin} style={{
              fontSize: 10, color: T.blue, background: "none",
              border: `1px solid ${T.blue}30`, borderRadius: 8,
              padding: "2px 8px", cursor: "pointer", fontFamily: FONT,
            }}>
              Sign in to sync
            </button>
          )}
        </div>
      </div>

      {/* Loan Inputs */}
      <OCard T={T} style={{ marginTop: 4 }}>
        {/* Location — styled like Inp fields */}
        {(propertyZip || city) && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT, marginBottom: 6 }}>Property</div>
            <div
              onClick={() => { if (typeof setTab === "function") setTab("setup"); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: T.inputBg, borderRadius: 12, padding: "10px 12px",
                border: `1px solid ${T.inputBorder}`, cursor: "pointer", transition: "border 0.2s",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: FONT, letterSpacing: "-0.02em" }}>
                {city || ""}{city && propertyZip ? " · " : ""}{propertyZip}{(city || propertyZip) && propertyState ? `, ${propertyState.length > 2 ? propertyState.substring(0, 2).toUpperCase() : propertyState}` : ""}
              </span>
              <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT }}>Edit</span>
            </div>
          </div>
        )}
        {/* Price + Down Payment */}
        <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } : {}}>
          <Inp label={isRefi ? "Home Value" : "Purchase Price"} value={salesPrice} onChange={setSalesPrice} max={100000000} req />
          {!isRefi && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>
                  Down Payment<span style={{ color: T.red, marginLeft: 3, fontSize: 13, fontWeight: 700 }}>*</span>
                </div>
                <div style={{ display: "flex", background: T.inputBg, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.inputBorder}` }}>
                  <button onClick={() => setDownMode("pct")} style={{ padding: "3px 8px", fontSize: 10, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: FONT, background: downMode === "pct" ? T.blue : "transparent", color: downMode === "pct" ? "#fff" : T.textTertiary }}>%</button>
                  <button onClick={() => setDownMode("dollar")} style={{ padding: "3px 8px", fontSize: 10, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: FONT, background: downMode === "dollar" ? T.blue : "transparent", color: downMode === "dollar" ? "#fff" : T.textTertiary }}>$</button>
                </div>
              </div>
              {downMode === "pct" ? (
                <Inp value={downPct} onChange={setDownPct} prefix="" suffix="%" step={0.01} max={100} req />
              ) : (
                <Inp value={Math.round(salesPrice * downPct / 100)} onChange={v => { const p = salesPrice > 0 ? (v / salesPrice) * 100 : 0; setDownPct(Math.round(p * 100) / 100); }} prefix="$" suffix="" step={1000} max={salesPrice} req />
              )}
              <div style={{ fontSize: 11, color: T.textTertiary, marginTop: -8, marginBottom: 4 }}>
                {downMode === "pct" ? `${fmt(Math.round(salesPrice * downPct / 100))} down` : `${downPct.toFixed(1)}% of ${fmt(salesPrice)}`}
              </div>
            </div>
          )}
        </div>
        {!isRefi && calc.dpWarning === "fail" && <Note color={T.red}>{loanType} requires minimum {calc.minDPpct}% down. Current: {downPct}%</Note>}

        {/* Loan Amount — derived, editable (back-calculates down %) */}
        <div style={{ marginTop: 4 }}>
          <Inp
            label="Loan Amount"
            value={Math.round(salesPrice - (salesPrice * downPct / 100))}
            onChange={v => {
              if (salesPrice > 0) {
                const newDp = ((salesPrice - v) / salesPrice) * 100;
                setDownPct(Math.round(Math.max(0, Math.min(100, newDp)) * 100) / 100);
              }
            }}
            max={salesPrice}
            sm
          />
        </div>

        {/* Rate + Term + Type */}
        <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 8 } : { marginTop: 8 }}>
          <Inp label="Rate" value={rate} onChange={setRate} prefix="" suffix="%" step={0.001} max={30} sm req />
          <Sel label="Term" value={term} onChange={v => setTerm(parseInt(v))} options={[{value:30,label:"30 Year"},{value:25,label:"25 Year"},{value:20,label:"20 Year"},{value:15,label:"15 Year"},{value:10,label:"10 Year"}]} sm req />
          <Sel label="Loan Type" value={loanType} onChange={setLoanType} options={["Conventional","FHA","VA","Jumbo","USDA"]} sm req />
        </div>

        {/* ── Property Tax — expandable pill ── */}
        <PropertyTaxPill
          T={T} calc={calc} salesPrice={salesPrice}
          propTaxMode={propTaxMode} setPropTaxMode={setPropTaxMode}
          taxBaseRateOverride={taxBaseRateOverride} setTaxBaseRateOverride={setTaxBaseRateOverride}
          taxExemptionOverride={taxExemptionOverride} setTaxExemptionOverride={setTaxExemptionOverride}
          fixedAssessments={fixedAssessments} setFixedAssessments={setFixedAssessments}
          propertyState={propertyState} city={city} loanPurpose={loanPurpose}
          Inp={Inp} fmt={fmt} fmt2={fmt2} isDesktop={isDesktop}
        />

        {/* Property details */}
        <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 } : { marginTop: 4 }}>
          <Inp label="Insurance" value={annualIns} onChange={setAnnualIns} suffix="/yr" max={50000} sm />
          <Inp label="HOA" value={hoa} onChange={setHoa} suffix="/mo" max={10000} sm />
        </div>
      </OCard>

      {/* ═══════════════════════════════════════
          SECTION 2: MONTHLY PAYMENT BREAKDOWN
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Monthly Payment" T={T} id="overview-payment">
        <OCard T={T}>
          {/* PayRing + escrow toggle beside it */}
          <div style={{ position: "relative", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <PayRing segments={paySegs} total={calc.displayPayment} size={isDesktop ? 200 : 170} hideLegend />
            </div>
            {/* Escrow toggle — bottom-right corner, just above line items */}
            <div style={{
              position: "absolute", right: 0, bottom: 4,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 10, color: T.textTertiary, fontFamily: FONT, whiteSpace: "nowrap" }}>Escrow</span>
              <button
                onClick={() => { if (loanType !== "FHA" && loanType !== "VA") setIncludeEscrow(!includeEscrow); }}
                style={{
                  width: 40, height: 22, borderRadius: 11, border: "none", padding: 0,
                  cursor: (loanType === "FHA" || loanType === "VA") ? "not-allowed" : "pointer",
                  background: includeEscrow ? T.green : T.inputBorder,
                  position: "relative", transition: "background 0.2s",
                  opacity: (loanType === "FHA" || loanType === "VA") ? 0.6 : 1,
                  flexShrink: 0,
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 9, background: "#fff",
                  position: "absolute", top: 2, left: includeEscrow ? 20 : 2,
                  transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                }} />
              </button>
            </div>
          </div>
          {/* Line items — full width below */}
          <div>
            {paySegs.filter(s => s.v > 0).map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${T.separator}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.c }} />
                  <span style={{ fontSize: 14, color: T.textSecondary, fontFamily: FONT }}>{s.l}</span>
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, fontFamily: MONO, color: T.text }}>{fmt(s.v)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 2px", marginTop: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: FONT }}>Total Payment</span>
              <span style={{ fontSize: 17, fontWeight: 700, color: T.blue, fontFamily: MONO, letterSpacing: "-0.02em" }}>{fmt(calc.displayPayment)}/mo</span>
            </div>
          </div>
        </OCard>

      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 3: CASH TO CLOSE — IFW STYLE
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <IFWCashToClose
        T={T} calc={calc} isRefi={isRefi} downPct={downPct}
        underwritingFee={underwritingFee} processingFee={processingFee}
        appraisalFee={appraisalFee} creditReportFee={creditReportFee}
        floodCertFee={floodCertFee} mersFee={mersFee} taxServiceFee={taxServiceFee}
        titleInsurance={titleInsurance} titleSearch={titleSearch}
        settlementFee={settlementFee} escrowFee={escrowFee}
        recordingFee={recordingFee} lenderCredit={lenderCredit}
        sellerCredit={sellerCredit} realtorCredit={realtorCredit}
        emd={emd} discountPts={discountPts} payoffAtClosing={payoffAtClosing}
        setTab={setTab} closingMonth={closingMonth} closingDay={closingDay}
      />

      {/* ═══════════════════════════════════════
          SECTION 4: QUALIFICATION (5 PILLARS)
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <div id="overview-qualification">
        <CollapsibleSection title="Qualification" T={T} action="Full Details →" onAction={() => setTab("qualify")}>
          <StopLight
            onPillarClick={(pillarLabel) => {
              if (pillarLabel === "FICO" || pillarLabel === "Credit") setTab("setup");
              else if (pillarLabel === "DTI") setTab("income");
              else if (pillarLabel === "Cash" || pillarLabel === "Reserves") setTab("assets");
              else if (pillarLabel === "Down") setTab("calc");
            }}
            checks={isRefi ? [
              { label: "FICO", ok: calc.ficoCheck === "Good!" ? true : calc.ficoCheck === "—" ? null : false, sub: creditScore > 0 ? `${creditScore} / ${calc.ficoMin}+` : "Enter score", icon: "bar-chart" },
              { label: "DTI", ok: calc.dtiCheck === "Good!" ? true : calc.dtiCheck === "—" ? null : false, sub: calc.qualifyingIncome > 0 ? `${pct(calc.yourDTI, 1)} / ${pct(calc.maxDTI, 0)}` : "Add income", icon: "scale" },
              { label: "LTV", ok: refiLtvCheck === "Good!" ? true : refiLtvCheck === "—" ? null : false, sub: calc.refiNewLTV > 0 ? `${pct(calc.refiNewLTV, 0)} / ${refiPurpose === "Cash-Out" ? "80%" : "95%"}` : "Enter loan", icon: "home" },
            ] : [
              { label: "FICO", ok: calc.ficoCheck === "Good!" ? true : calc.ficoCheck === "—" ? null : false, sub: creditScore > 0 ? `${creditScore} / ${calc.ficoMin}+` : "Enter score", icon: "bar-chart" },
              { label: "Down", ok: calc.dpWarning === null ? true : false, sub: `${downPct}% / ${calc.minDPpct}%+`, icon: "home" },
              { label: "DTI", ok: calc.dtiCheck === "Good!" ? true : calc.dtiCheck === "—" ? null : false, sub: calc.qualifyingIncome > 0 ? `${pct(calc.yourDTI, 1)} / ${pct(calc.maxDTI, 0)}` : "Add income", icon: "scale" },
              { label: "Cash", ok: calc.cashCheck === "Good!" ? true : calc.cashCheck === "—" ? null : false, sub: calc.totalForClosing > 0 ? `${fmt(calc.totalForClosing)}` : "Add assets", icon: "dollar" },
              { label: "Reserves", ok: calc.resCheck === "Good!" ? true : calc.resCheck === "—" ? null : false, sub: calc.totalReserves > 0 ? `${fmt(calc.totalReserves)}` : "Add assets", icon: "landmark" },
            ]}
          />

          {/* DTI Summary (if income entered) */}
          {calc.qualifyingIncome > 0 && (
            <OCard T={T} pad={14}>
              <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 6 }}>DTI: {pct(calc.yourDTI, 1)} / {pct(calc.maxDTI, 0)}</div>
              <div style={{ height: 10, background: T.ringTrack, borderRadius: 99, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${Math.min(100, (calc.yourDTI / calc.maxDTI) * 100)}%`, background: calc.yourDTI <= calc.maxDTI ? T.green : T.red, borderRadius: 99 }} />
              </div>
              <div style={{ fontSize: 11, color: T.textTertiary }}>
                Housing: {fmt(calc.totalPayment)}/mo · Income: {fmt(calc.qualifyingIncome)}/mo · Min needed: {fmt(calc.totalPayment / calc.maxDTI)}/mo
              </div>
            </OCard>
          )}
        </CollapsibleSection>
      </div>

      {/* ═══════════════════════════════════════
          SECTION 5: INCOME SUMMARY
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Income" T={T} action="Edit Income →" onAction={() => setTab("income")}>
        <OCard T={T}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: T.textTertiary }}>Monthly Qualifying Income</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: FONT, color: T.green, letterSpacing: "-0.03em" }}>
                {fmt(calc.qualifyingIncome || calc.monthlyIncome)}
              </div>
            </div>
            <div style={{ fontSize: 13, color: T.textTertiary, fontFamily: FONT }}>
              {fmt((calc.qualifyingIncome || calc.monthlyIncome) * 12)}/yr
            </div>
          </div>
          {incomes.length > 0 ? (
            incomes.map((inc, i) => (
              <div key={inc.id || i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${T.separator}` }}>
                <div>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{inc.source || inc.payType || "Income"}</div>
                  <div style={{ fontSize: 11, color: T.textTertiary }}>{inc.payType} · Borrower {inc.borrower || 1}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: FONT, color: T.text }}>
                  {fmt(inc.monthlyQualifying || inc.amount || 0)}/mo
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: "center", padding: 16, color: T.textTertiary, fontSize: 13 }}>
              No income entered — <span onClick={() => setTab("income")} style={{ color: T.blue, cursor: "pointer", fontWeight: 600 }}>add income</span>
            </div>
          )}
        </OCard>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 6: DEBTS (PARTIALLY EDITABLE)
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Debts & Liabilities" T={T} action="Edit Debts →" onAction={() => setTab("debts")}>
        <OCard T={T}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: T.textTertiary }}>Monthly Debts</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: FONT, color: debtFree ? T.green : T.red, letterSpacing: "-0.03em" }}>
                {debtFree ? "$0" : fmt(calc.totalMonthlyDebts)}
              </div>
            </div>
            {debtFree && <div style={{ fontSize: 12, fontWeight: 600, color: T.green }}>Debt free!</div>}
          </div>

          {!debtFree && debts.length > 0 && debts.map((d, i) => (
            <div key={d.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: `1px solid ${T.separator}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{d.name || d.type || "Debt"}</div>
                <div style={{ fontSize: 11, color: T.textTertiary }}>{d.type}{d.balance > 0 ? ` · Bal: ${fmt(d.balance)}` : ""}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, fontFamily: FONT, color: (d.payoff === "Yes - at Escrow" || d.payoff === "Yes - POC") ? T.green : T.text, textDecoration: (d.payoff === "Yes - at Escrow" || d.payoff === "Yes - POC") ? "line-through" : "none" }}>
                  {fmt(d.monthly)}/mo
                </span>
                {(d.payoff === "Yes - at Escrow" || d.payoff === "Yes - POC") && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: T.green, background: `${T.green}15`, padding: "2px 6px", borderRadius: 4 }}>PAYOFF</span>
                )}
              </div>
            </div>
          ))}
          {!debtFree && debts.length === 0 && (
            <div style={{ textAlign: "center", padding: 16, color: T.textTertiary, fontSize: 13 }}>
              No debts entered — <span onClick={() => setTab("debts")} style={{ color: T.blue, cursor: "pointer", fontWeight: 600 }}>add debts</span>
            </div>
          )}
        </OCard>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 7: TAX SAVINGS
          ═══════════════════════════════════════ */}
      {loanPurpose !== "Purchase Investment" && loanPurpose !== "Purchase 2nd Home" && (
        <>
          <SectionDivider T={T} />
          <CollapsibleSection title="Tax Savings" T={T} action="Full Analysis →" onAction={() => setTab("tax")}>
            <OCard T={T}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <div style={{ fontSize: 11, color: T.textTertiary }}>Annual Tax Savings</div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: FONT, color: T.purple, letterSpacing: "-0.03em" }}>{fmt(calc.totalTaxSavings)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: T.textTertiary }}>After-Tax Payment</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.afterTaxPayment)}/mo</div>
                </div>
              </div>
            </OCard>
            {calc.yearlyInc > 0 && (
              <OCard T={T} pad={16}>
                {/* Itemized vs Standard */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 12, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 4 }}>Itemized Deductions</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: MONO, letterSpacing: "-0.02em" }}>{fmt(calc.fedItemized)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 4 }}>Standard Deduction</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: MONO, letterSpacing: "-0.02em" }}>{fmt(calc.fedStdDeduction)}</div>
                  </div>
                </div>
                {calc.fedItemizes && (
                  <div style={{ background: `${T.green}08`, borderRadius: 10, padding: "8px 12px", marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.green }}>Federal Benefit: {fmt(calc.fedDelta)} above standard deduction</div>
                    <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>Saves {fmt(calc.fedSavings)} in federal taxes + {fmt(calc.stateSavings || 0)} state</div>
                  </div>
                )}
                {!calc.fedItemizes && (
                  <div style={{ background: `${T.orange}08`, borderRadius: 10, padding: "8px 12px", marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.orange }}>Standard deduction is higher — no additional federal tax benefit from homeownership yet</div>
                  </div>
                )}

                {/* ── Collapsible: How This Is Calculated ── */}
                <TaxDetailsCollapsible T={T} calc={calc} fmt={fmt} fmt2={fmt2} pct={pct} taxState={taxState} />
              </OCard>
            )}
            {calc.yearlyInc <= 0 && (
              <div onClick={() => setTab("income")} style={{ cursor: "pointer" }}>
                <OCard T={T} style={{ background: `${T.orange}10`, border: `1px solid ${T.orange}30` }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.orange }}>Add income to see tax savings</div>
                  <div style={{ fontSize: 12, color: T.textSecondary }}>Tap to go to the Income tab</div>
                </OCard>
              </div>
            )}
          </CollapsibleSection>
        </>
      )}

      {/* ═══════════════════════════════════════
          SECTION 8: AMORTIZATION (EDITABLE)
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Amortization" T={T} action="Full Schedule →" onAction={() => setTab("amort")}>
        {/* Hero stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <OCard T={T} pad={14}>
            <div style={{ fontSize: 11, color: T.textTertiary }}>Total Interest</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: FONT, color: T.blue, letterSpacing: "-0.03em" }}>{fmt(calc.totalIntWithExtra)}</div>
            {calc.intSaved > 100 && <div style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>Save {fmt(calc.intSaved)}</div>}
          </OCard>
          <OCard T={T} pad={14}>
            <div style={{ fontSize: 11, color: T.textTertiary }}>Payoff</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: FONT, letterSpacing: "-0.03em" }}>{calc.amortSchedule?.length || (term * 12)} <span style={{ fontSize: 13, color: T.textTertiary }}>mo</span></div>
            {calc.monthsSaved > 0 && <div style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>{calc.monthsSaved} months saved</div>}
          </OCard>
        </div>

        {/* Extra Payment toggle + input */}
        <OCard T={T} pad={14}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: payExtra ? 12 : 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Extra Monthly Payment</span>
            <button onClick={() => setPayExtra(!payExtra)} style={{ width: 48, height: 28, borderRadius: 14, background: payExtra ? T.green : T.ringTrack, border: "none", cursor: "pointer", position: "relative", transition: "background 0.3s" }}>
              <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, left: payExtra ? 23 : 3, transition: "left 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </button>
          </div>
          {payExtra && (
            <>
              <Inp label="Monthly Extra Payment" value={extraPayment} onChange={setExtraPayment} />
              {calc.intSaved > 100 && (
                <div style={{ background: `${T.green}10`, borderRadius: 10, padding: "10px 14px", marginTop: -4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.green }}>Interest Saved: {fmt(calc.intSaved)} · Time Saved: {calc.monthsSaved} months</div>
                </div>
              )}
            </>
          )}
        </OCard>

        {/* AmortChart */}
        <OCard T={T}>
          <AmortChart />
        </OCard>

        {/* Equity Growth */}
        {salesPrice > 0 && calc.yearlyData && calc.yearlyData.length > 0 && (() => {
          const appRate = (appreciationRate || 3) / 100;
          const yr5 = calc.yearlyData.find(d => d.year === 5);
          const yr10 = calc.yearlyData.find(d => d.year === 10);
          const last = calc.yearlyData[calc.yearlyData.length - 1];
          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[yr5 && { label: "Year 5", eq: salesPrice * Math.pow(1 + appRate, 5) - yr5.bal },
                yr10 && { label: "Year 10", eq: salesPrice * Math.pow(1 + appRate, 10) - yr10.bal },
                last && { label: `Year ${last.year}`, eq: salesPrice * Math.pow(1 + appRate, last.year) - last.bal }
              ].filter(Boolean).map((d, i) => (
                <OCard key={i} T={T} pad={12}>
                  <div style={{ fontSize: 10, color: T.textTertiary }}>{d.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.green, fontFamily: FONT }}>{fmt(d.eq, true)}</div>
                  <div style={{ fontSize: 9, color: T.textTertiary }}>equity</div>
                </OCard>
              ))}
            </div>
          );
        })()}

        {/* Yearly summary table (compact) */}
        {calc.yearlyData && calc.yearlyData.length > 0 && (
          <OCard T={T} pad={12}>
            <div style={{ display: "grid", gridTemplateColumns: "0.7fr 1fr 1fr 1.2fr", gap: 0, fontSize: 11, color: T.textTertiary, fontWeight: 600, paddingBottom: 8, borderBottom: `1px solid ${T.separator}` }}>
              <span>Year</span><span style={{textAlign:"right"}}>Interest</span><span style={{textAlign:"right"}}>Principal</span><span style={{textAlign:"right"}}>Balance</span>
            </div>
            {calc.yearlyData.slice(0, 10).map((d, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "0.7fr 1fr 1fr 1.2fr", gap: 0, fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${T.separator}`, fontFamily: FONT }}>
                <span style={{ color: T.textSecondary }}>{d.year}</span>
                <span style={{ textAlign: "right", color: T.blue }}>{fmt(d.int)}</span>
                <span style={{ textAlign: "right", color: T.green }}>{fmt(d.prin)}</span>
                <span style={{ textAlign: "right", color: T.textSecondary }}>{fmt(d.bal)}</span>
              </div>
            ))}
            {calc.yearlyData.length > 10 && (
              <div onClick={() => setTab("amort")} style={{ textAlign: "center", padding: "10px 0", cursor: "pointer" }}>
                <span style={{ fontSize: 12, color: T.blue, fontWeight: 600 }}>View all {calc.yearlyData.length} years →</span>
              </div>
            )}
          </OCard>
        )}
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 9: NET PROCEEDS (CONDITIONAL)
          ═══════════════════════════════════════ */}
      {hasSellProperty && sellPrice > 0 && (
        <>
          <SectionDivider T={T} />
          <CollapsibleSection title="Net Proceeds of Sale" T={T} action="Edit Sale →" onAction={() => setTab("sell")}>
            <OCard T={T} style={{ background: calc.sellNetAfterTax >= 0 ? `${T.green}08` : `${T.red}08` }}>
              <OMRow T={T} label="Sale Price" value={fmt(sellPrice)} bold />
              <OMRow T={T} label="Mortgage Payoff" value={`-${fmt(sellMortgagePayoff)}`} color={T.red} />
              <OMRow T={T} label="Total Costs" value={`-${fmt(calc.sellTotalCosts)}`} color={T.red} />
              <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
                <OMRow T={T} label="Net After Tax" value={fmt(calc.sellNetAfterTax)} color={calc.sellNetAfterTax >= 0 ? T.green : T.red} bold />
              </div>
            </OCard>
          </CollapsibleSection>
        </>
      )}

      {/* ═══════════════════════════════════════
          BOTTOM CTA
          ═══════════════════════════════════════ */}
      <div style={{ marginTop: 32, textAlign: "center" }}>
        <button onClick={() => setTab("summary")} style={{
          padding: "14px 28px",
          background: T.blue,
          border: "none",
          borderRadius: 99,
          color: "#fff",
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: FONT,
          boxShadow: `0 4px 16px ${T.blue}30`,
        }}>
          Share This Blueprint →
        </button>
        <div style={{ fontSize: 12, color: T.textTertiary, marginTop: 8 }}>
          Email a branded summary to your client or realtor
        </div>
      </div>
    </div>
  );
}
