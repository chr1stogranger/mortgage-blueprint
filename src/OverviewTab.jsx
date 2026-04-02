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

/* ─── Property Tax — 3-layer pill for Overview ─── */
function PropertyTaxPill({ T, calc, salesPrice, propTaxMode, setPropTaxMode,
  taxBaseRateOverride, setTaxBaseRateOverride, taxExemptionOverride, setTaxExemptionOverride,
  fixedAssessments, setFixedAssessments, propertyState, city, loanPurpose, Inp, fmt, fmt2, isDesktop,
  taxRateLocked, setTaxRateLocked, taxExemptionLocked, setTaxExemptionLocked }) {
  const [showCalc, setShowCalc] = useState(false);
  const [showCustomize, setShowCustomize] = useState(!taxRateLocked || !taxExemptionLocked);
  const autoRate = calc.autoTaxRate || 0;
  const anyUnlocked = !taxRateLocked || !taxExemptionLocked;
  const cityLabel = propertyState === "California" ? (city || "CA") : (propertyState || "State");
  const displayRate = taxBaseRateOverride > 0 ? taxBaseRateOverride : autoRate * 100;

  /* Tiny lock toggle button */
  const LockBtn = ({ locked, onToggle }) => (
    <button onClick={e => { e.stopPropagation(); onToggle(); }}
      title={locked ? "Unlock to customize" : "Lock to auto-sync"}
      style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center", lineHeight: 1 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={locked ? T.textTertiary : T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        {locked ? <path d="M7 11V7a5 5 0 0 1 10 0v4" /> : <path d="M7 11V7a5 5 0 0 1 9.9-1" />}
      </svg>
    </button>
  );

  return (
    <div style={{ marginTop: 8, marginBottom: 6 }}>
      {/* ── Layer 1: Pill (matches Inp style) ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>Property Tax</span>
          {anyUnlocked && (
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: MONO, color: T.blue, background: `${T.blue}15`, borderRadius: 99, padding: "1px 6px" }}>CUSTOM</span>
          )}
        </div>
      </div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: T.inputBg, borderRadius: 12, padding: "12px 14px",
        border: `1px solid ${T.inputBorder}`,
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: FONT, letterSpacing: "-0.02em" }}>
          {fmt(calc.monthlyTax)}<span style={{ fontSize: 12, fontWeight: 400, color: T.textTertiary, marginLeft: 2 }}>/mo</span>
        </span>
        <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: MONO }}>
          {fmt(calc.yearlyTax)}/yr
        </span>
      </div>

      {/* ── Layer 2: "How this is calculated" disclosure ── */}
      <div
        onClick={() => setShowCalc(!showCalc)}
        style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 0 2px", cursor: "pointer" }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: T.blue, fontFamily: FONT }}>How this is calculated</span>
        <span style={{ fontSize: 10, color: T.blue, transition: "transform 0.2s", transform: showCalc ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </div>

      {showCalc && (
        <div style={{ marginTop: 4 }}>
          {/* Breakdown table */}
          <div style={{ background: T.inputBg || `${T.textTertiary}08`, borderRadius: 10, padding: "10px 12px" }}>
            {[
              ["Home Value", fmt(salesPrice)],
              ["Exemption", calc.exemption > 0 ? `-${fmt(calc.exemption)}` : "$0"],
              ["Taxable Value", fmt(calc.taxableValue)],
              [`Base Rate (${cityLabel})`, `${displayRate.toFixed(4)}%`],
              ["Base Tax", fmt2(calc.baseTax)],
              ...(fixedAssessments > 0 ? [["Fixed Assessments", `${fmt(fixedAssessments)}/yr`]] : []),
            ].map(([label, value], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.separator}` }}>
                <span style={{ fontSize: 12, color: T.textSecondary }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 500, fontFamily: MONO, color: T.text }}>{value}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 2px", borderTop: `2px solid ${T.separator}`, marginTop: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Annual Total</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: T.text }}>{fmt2(calc.yearlyTax)}</span>
            </div>
            {calc.effectiveTaxRate > 0 && (
              <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 4 }}>
                Effective rate: {(calc.effectiveTaxRate * 100).toFixed(3)}%
              </div>
            )}
          </div>

          {/* ── Layer 3: Customize (hidden by default) ── */}
          {!showCustomize ? (
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <span
                onClick={() => { setShowCustomize(true); if (taxRateLocked && taxBaseRateOverride === 0) setTaxBaseRateOverride(parseFloat((autoRate * 100).toFixed(4))); }}
                style={{ fontSize: 12, fontWeight: 600, color: T.blue, cursor: "pointer", fontFamily: FONT }}
              >Customize rate, exemption, or assessments</span>
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              {/* Base Rate + lock */}
              <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 } : { marginBottom: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>Base Tax Rate <span style={{ color: T.textTertiary, fontWeight: 400, fontSize: 11, marginLeft: 3 }}>({cityLabel})</span></span>
                    <LockBtn locked={taxRateLocked} onToggle={() => {
                      if (taxRateLocked) { setTaxRateLocked(false); }
                      else { setTaxRateLocked(true); setTaxBaseRateOverride(parseFloat((autoRate * 100).toFixed(4))); }
                    }} />
                  </div>
                  <div style={{ opacity: taxRateLocked ? 0.6 : 1 }}>
                    <Inp value={taxBaseRateOverride} onChange={setTaxBaseRateOverride} prefix="" suffix="%" max={10} step={0.001} sm readOnly={taxRateLocked} />
                  </div>
                </div>
                {/* Exemption + lock */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>Exemption</span>
                    <LockBtn locked={taxExemptionLocked} onToggle={() => {
                      if (taxExemptionLocked) { setTaxExemptionLocked(false); }
                      else { setTaxExemptionLocked(true); const ip = loanPurpose === "Purchase Primary" || loanPurpose === "Refi Rate/Term" || loanPurpose === "Refi Cash-Out"; setTaxExemptionOverride(ip ? 7000 : 0); }
                    }} />
                  </div>
                  <div style={{ opacity: taxExemptionLocked ? 0.6 : 1 }}>
                    <Inp value={taxExemptionOverride} onChange={setTaxExemptionOverride} prefix="$" max={500000} sm readOnly={taxExemptionLocked} />
                  </div>
                </div>
              </div>

              {/* Fixed Assessments */}
              <Inp label="Fixed Assessments" value={fixedAssessments} onChange={setFixedAssessments} prefix="$" suffix="/yr" max={50000} sm />

              {/* Footnote */}
              <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 2, lineHeight: 1.5, fontFamily: FONT }}>
                Exemption: primary residence reduction (CA $7K). Fixed Assessments: Mello-Roos, bonds, parcel taxes.
              </div>

              {/* Reset */}
              {anyUnlocked && (
                <div style={{ textAlign: "center", marginTop: 6 }}>
                  <span onClick={() => { setTaxRateLocked(true); setTaxExemptionLocked(true); setFixedAssessments(1500); const ar = autoRate; setTaxBaseRateOverride(parseFloat((ar * 100).toFixed(4))); const ip = loanPurpose === "Purchase Primary" || loanPurpose === "Refi Rate/Term" || loanPurpose === "Refi Cash-Out"; setTaxExemptionOverride(ip ? 7000 : 0); setShowCustomize(false); }}
                    style={{ fontSize: 11, color: T.textTertiary, cursor: "pointer", textDecoration: "underline" }}>Reset to auto</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Mortgage Insurance Pill (3-layer) ─── */
function MortgageInsurancePill({ T, calc, salesPrice, loanType, creditScore, Inp, fmt, fmt2, isDesktop,
  pmiRateLocked, setPmiRateLocked, pmiRateOverride, setPmiRateOverride }) {
  const [showCalc, setShowCalc] = useState(false);
  const [showCustomize, setShowCustomize] = useState(!pmiRateLocked);
  const anyUnlocked = !pmiRateLocked;

  const LockBtn = ({ locked, onToggle }) => (
    <button onClick={e => { e.stopPropagation(); onToggle(); }}
      title={locked ? "Unlock to customize" : "Lock to auto-sync"}
      style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center", lineHeight: 1 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={locked ? T.textTertiary : T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        {locked ? <path d="M7 11V7a5 5 0 0 1 10 0v4" /> : <path d="M7 11V7a5 5 0 0 1 9.9-1" />}
      </svg>
    </button>
  );

  // Determine label and breakdown based on loan type
  const isConv = loanType === "Conventional";
  const isFHA = loanType === "FHA";
  const isUSDA = loanType === "USDA";
  const label = isConv ? "Private Mortgage Insurance (PMI)" : isFHA ? "Mortgage Insurance Premium (MIP)" : "USDA Mortgage Insurance";

  // Build breakdown rows based on loan type
  let breakdownRows = [];
  let footnote = "";
  if (isConv) {
    breakdownRows = [
      ["Loan Amount", fmt(calc.baseLoan)],
      ["Home Value", fmt(salesPrice)],
      ["LTV", `${(calc.ltv * 100).toFixed(1)}%`],
      ["Credit Score", creditScore > 0 ? String(creditScore) : "—"],
      ["PMI Rate (Radian matrix)", `${(calc.pmiRate * 100).toFixed(3)}%`],
    ];
    footnote = "PMI required when LTV > 80%. Auto-cancels at 78% LTV (lender-initiated) or request removal at 80%. Rate from Radian matrix by LTV bucket and FICO score.";
  } else if (isFHA) {
    breakdownRows = [
      ["Base Loan Amount", fmt(calc.baseLoan)],
      ["Upfront MIP (1.75%)", `${fmt(calc.fhaUp)} financed`],
      ["Total Loan Amount", fmt(calc.loan)],
      ["Annual MIP Rate", "0.55%"],
    ];
    footnote = "FHA MIP is required for the life of the loan regardless of LTV. The only way to remove it is to refinance into a conventional loan. Upfront MIP (1.75%) is financed into the loan amount.";
  } else if (isUSDA) {
    breakdownRows = [
      ["Base Loan Amount", fmt(calc.baseLoan)],
      ["Upfront Guarantee Fee (1.0%)", `${fmt(calc.usdaFee)} financed`],
      ["Total Loan Amount", fmt(calc.loan)],
      ["Annual Fee Rate", "0.35%"],
    ];
    footnote = "USDA annual fee is 0.35% of the original loan amount. Upfront guarantee fee (1.0%) is financed into the loan.";
  }

  const annualPremium = isConv ? calc.baseLoan * calc.pmiRate : isFHA ? calc.loan * 0.0055 : calc.baseLoan * 0.0035;
  const monthlyPremium = isConv ? calc.monthlyPMI : isFHA ? calc.monthlyMIP : calc.usdaMI;

  return (
    <div style={{ marginTop: 8, marginBottom: 6 }}>
      {/* Layer 1: Pill */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>{label}</span>
          {anyUnlocked && (
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: MONO, color: T.blue, background: `${T.blue}15`, borderRadius: 99, padding: "1px 6px" }}>CUSTOM</span>
          )}
        </div>
      </div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: T.inputBg, borderRadius: 12, padding: "12px 14px",
        border: `1px solid ${T.inputBorder}`,
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: FONT, letterSpacing: "-0.02em" }}>
          {fmt(monthlyPremium)}<span style={{ fontSize: 12, fontWeight: 400, color: T.textTertiary, marginLeft: 2 }}>/mo</span>
        </span>
        <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: MONO }}>
          {fmt(monthlyPremium * 12)}/yr
        </span>
      </div>

      {/* Layer 2: How this is calculated */}
      <div
        onClick={() => setShowCalc(!showCalc)}
        style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 0 2px", cursor: "pointer" }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: T.blue, fontFamily: FONT }}>How this is calculated</span>
        <span style={{ fontSize: 10, color: T.blue, transition: "transform 0.2s", transform: showCalc ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </div>

      {showCalc && (
        <div style={{ marginTop: 4 }}>
          <div style={{ background: T.inputBg || `${T.textTertiary}08`, borderRadius: 10, padding: "10px 12px" }}>
            {breakdownRows.map(([label, value], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.separator}` }}>
                <span style={{ fontSize: 12, color: T.textSecondary }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 500, fontFamily: MONO, color: T.text }}>{value}</span>
              </div>
            ))}
            {/* Separator + totals */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.separator}`, marginTop: 2 }}>
              <span style={{ fontSize: 12, color: T.textSecondary }}>Annual Premium</span>
              <span style={{ fontSize: 12, fontWeight: 500, fontFamily: MONO, color: T.text }}>{fmt2(annualPremium)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 2px", borderTop: `2px solid ${T.separator}`, marginTop: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Monthly Premium</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: T.text }}>{fmt2(monthlyPremium)}</span>
            </div>
            <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 6, lineHeight: 1.5 }}>{footnote}</div>
          </div>

          {/* Layer 3: Customize (only for Conventional PMI) */}
          {isConv && (
            <>
              {!showCustomize ? (
                <div style={{ textAlign: "center", marginTop: 8 }}>
                  <span
                    onClick={() => { setShowCustomize(true); if (pmiRateLocked && pmiRateOverride === 0) setPmiRateOverride(parseFloat((calc.autoPmiRate * 100).toFixed(3))); }}
                    style={{ fontSize: 12, fontWeight: 600, color: T.blue, cursor: "pointer", fontFamily: FONT }}
                  >Customize PMI rate</span>
                </div>
              ) : (
                <div style={{ marginTop: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>Annual PMI Rate</span>
                      <LockBtn locked={pmiRateLocked} onToggle={() => {
                        if (pmiRateLocked) { setPmiRateLocked(false); }
                        else { setPmiRateLocked(true); setPmiRateOverride(0); }
                      }} />
                    </div>
                    <div style={{ opacity: pmiRateLocked ? 0.6 : 1 }}>
                      <Inp value={pmiRateOverride || parseFloat((calc.autoPmiRate * 100).toFixed(3))} onChange={setPmiRateOverride} prefix="" suffix="%" max={5} step={0.001} sm readOnly={pmiRateLocked} />
                    </div>
                    <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 4, lineHeight: 1.5 }}>
                      Override if your lender quoted a different PMI rate. Lock to auto-calculate from LTV and credit score.
                    </div>
                  </div>
                  {!pmiRateLocked && (
                    <div style={{ textAlign: "center", marginTop: 8 }}>
                      <span
                        onClick={() => { setPmiRateLocked(true); setPmiRateOverride(0); }}
                        style={{ fontSize: 11, fontWeight: 600, color: T.blue, cursor: "pointer", fontFamily: FONT }}
                      >Reset to auto</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── VA Funding Fee Pill (3-layer) ─── */
function VAFundingFeePill({ T, calc, Inp, fmt, fmt2, isDesktop, downPct, vaUsage,
  vaFundingFeeLocked, setVaFundingFeeLocked, vaFundingFeeOverride, setVaFundingFeeOverride }) {
  const [showCalc, setShowCalc] = useState(false);
  const [showCustomize, setShowCustomize] = useState(!vaFundingFeeLocked);
  const anyUnlocked = !vaFundingFeeLocked;

  const LockBtn = ({ locked, onToggle }) => (
    <button onClick={e => { e.stopPropagation(); onToggle(); }}
      title={locked ? "Unlock to customize" : "Lock to auto-sync"}
      style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center", lineHeight: 1 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={locked ? T.textTertiary : T.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        {locked ? <path d="M7 11V7a5 5 0 0 1 10 0v4" /> : <path d="M7 11V7a5 5 0 0 1 9.9-1" />}
      </svg>
    </button>
  );

  // VA Funding Fee tier matrix
  const tiers = [
    { label: "First Use", rates: [2.15, 1.50, 1.25] },
    { label: "Subsequent", rates: [3.30, 1.50, 1.25] },
    { label: "Disabled", rates: [0, 0, 0] },
  ];
  const dpHeaders = ["0% DP", "5% DP", "10% DP"];
  const activeTierIdx = vaUsage === "Subsequent" ? 1 : vaUsage === "Disabled" ? 2 : 0;
  const activeDpIdx = downPct >= 10 ? 2 : downPct >= 5 ? 1 : 0;

  return (
    <div style={{ marginTop: 8, marginBottom: 6 }}>
      {/* Layer 1: Pill */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>VA Funding Fee</span>
          {anyUnlocked && (
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: MONO, color: T.blue, background: `${T.blue}15`, borderRadius: 99, padding: "1px 6px" }}>CUSTOM</span>
          )}
        </div>
      </div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: T.inputBg, borderRadius: 12, padding: "12px 14px",
        border: `1px solid ${T.inputBorder}`,
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: FONT, letterSpacing: "-0.02em" }}>
          {fmt(calc.vaFundingFee)}
        </span>
        <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: MONO }}>
          {calc.baseLoan > 0 ? `${(calc.vaFundingFee / calc.baseLoan * 100).toFixed(2)}% of loan` : "—"}
        </span>
      </div>

      {/* Layer 2: How this is calculated */}
      <div
        onClick={() => setShowCalc(!showCalc)}
        style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 0 2px", cursor: "pointer" }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: T.blue, fontFamily: FONT }}>How this is calculated</span>
        <span style={{ fontSize: 10, color: T.blue, transition: "transform 0.2s", transform: showCalc ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </div>

      {showCalc && (
        <div style={{ marginTop: 4 }}>
          <div style={{ background: T.inputBg || `${T.textTertiary}08`, borderRadius: 10, padding: "10px 12px" }}>
            {[
              ["Base Loan Amount", fmt(calc.baseLoan)],
              ["VA Usage", vaUsage || "First Use"],
              ["Down Payment", `${downPct}%`],
            ].map(([label, value], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.separator}` }}>
                <span style={{ fontSize: 12, color: T.textSecondary }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 500, fontFamily: MONO, color: T.text }}>{value}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.separator}`, marginTop: 2 }}>
              <span style={{ fontSize: 12, color: T.textSecondary }}>Funding Fee Rate</span>
              <span style={{ fontSize: 12, fontWeight: 500, fontFamily: MONO, color: T.text }}>{(calc.vaFFRate * 100).toFixed(2)}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.separator}` }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Funding Fee</span>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO, color: T.text }}>{fmt(calc.vaFundingFee)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 2px", borderTop: `2px solid ${T.separator}`, marginTop: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Total Loan (incl. fee)</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: T.text }}>{fmt(calc.loan)}</span>
            </div>

            {/* VA Funding Fee Tier Matrix */}
            <div style={{ marginTop: 10, fontSize: 11, fontWeight: 600, color: T.textSecondary, fontFamily: MONO, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              VA Funding Fee Rates
            </div>
            <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${T.separator}` }}>
              {/* Header row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", background: `${T.blue}10` }}>
                <div style={{ padding: "6px 8px", fontSize: 10, fontWeight: 600, color: T.textTertiary, fontFamily: MONO }}></div>
                {dpHeaders.map((h, i) => (
                  <div key={i} style={{ padding: "6px 4px", fontSize: 10, fontWeight: 600, color: T.textTertiary, fontFamily: MONO, textAlign: "center" }}>{h}</div>
                ))}
              </div>
              {/* Data rows */}
              {tiers.map((tier, ti) => (
                <div key={ti} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", borderTop: `1px solid ${T.separator}` }}>
                  <div style={{ padding: "6px 8px", fontSize: 11, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>{tier.label}</div>
                  {tier.rates.map((r, di) => {
                    const isActive = ti === activeTierIdx && di === activeDpIdx;
                    return (
                      <div key={di} style={{
                        padding: "6px 4px", fontSize: 11, fontWeight: isActive ? 700 : 400, fontFamily: MONO, textAlign: "center",
                        color: isActive ? T.blue : T.text,
                        background: isActive ? `${T.blue}15` : "transparent",
                      }}>
                        {r}%
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 6, lineHeight: 1.5 }}>
              The VA Funding Fee is a one-time fee paid to the VA. It can be financed into the loan or paid at closing. Veterans with 10%+ service-connected disability are exempt.
            </div>
          </div>

          {/* Layer 3: Customize */}
          {!showCustomize ? (
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <span
                onClick={() => setShowCustomize(true)}
                style={{ fontSize: 12, fontWeight: 600, color: T.blue, cursor: "pointer", fontFamily: FONT }}
              >Customize funding fee</span>
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>VA Funding Fee</span>
                  <LockBtn locked={vaFundingFeeLocked} onToggle={() => {
                    if (vaFundingFeeLocked) { setVaFundingFeeLocked(false); }
                    else { setVaFundingFeeLocked(true); setVaFundingFeeOverride(0); }
                  }} />
                </div>
                <div style={{ opacity: vaFundingFeeLocked ? 0.6 : 1 }}>
                  <Inp value={vaFundingFeeOverride || Math.round(calc.autoVAFF)} onChange={setVaFundingFeeOverride} prefix="$" max={100000} sm readOnly={vaFundingFeeLocked} />
                </div>
                <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 4, lineHeight: 1.5 }}>
                  Override if paying out of pocket, negotiated rate, or partial exemption. Lock to auto-calculate from VA usage tier and down payment.
                </div>
              </div>
              {!vaFundingFeeLocked && (
                <div style={{ textAlign: "center", marginTop: 8 }}>
                  <span
                    onClick={() => { setVaFundingFeeLocked(true); setVaFundingFeeOverride(0); }}
                    style={{ fontSize: 11, fontWeight: 600, color: T.blue, cursor: "pointer", fontFamily: FONT }}
                  >Reset to auto</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Cash to Close Pill (3-layer) ─── */
function CashToClosePill({ T, calc, isRefi, salesPrice, downPct, payoffAtClosing, setTab, fmt, fmt2 }) {
  const [showCalc, setShowCalc] = useState(false);
  const label = isRefi ? "Estimated Refi Costs" : "Cash to Close";
  const total = isRefi ? (calc.totalClosingCosts + calc.totalPrepaidExp + payoffAtClosing - calc.totalCredits) : calc.cashToClose;
  const pctOfPrice = salesPrice > 0 ? (total / salesPrice * 100).toFixed(1) : "0.0";

  // Build breakdown rows
  const rows = [];
  if (!isRefi) rows.push(["Down Payment (" + downPct + "%)", fmt(calc.dp)]);
  rows.push(["Closing Costs", fmt(calc.totalClosingCosts)]);
  rows.push(["Prepaids & Escrow", fmt(calc.totalPrepaidExp)]);
  if (payoffAtClosing > 0) rows.push(["Loans Paid Off at Close", fmt(payoffAtClosing)]);

  return (
    <div style={{ marginTop: 8, marginBottom: 6 }}>
      {/* Layer 1: Pill */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>{label}</span>
      </div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: T.inputBg, borderRadius: 12, padding: "12px 14px",
        border: `1px solid ${T.inputBorder}`,
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: FONT, letterSpacing: "-0.02em" }}>
          {fmt(total)}
        </span>
        <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: MONO }}>
          {pctOfPrice}% of {isRefi ? "value" : "price"}
        </span>
      </div>

      {/* Layer 2: How this is calculated */}
      <div
        onClick={() => setShowCalc(!showCalc)}
        style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 0 2px", cursor: "pointer" }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: T.blue, fontFamily: FONT }}>How this is calculated</span>
        <span style={{ fontSize: 10, color: T.blue, transition: "transform 0.2s", transform: showCalc ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </div>

      {showCalc && (
        <div style={{ marginTop: 4 }}>
          <div style={{ background: T.inputBg || `${T.textTertiary}08`, borderRadius: 10, padding: "10px 12px" }}>
            {rows.map(([label, value], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.separator}` }}>
                <span style={{ fontSize: 12, color: T.textSecondary }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 500, fontFamily: MONO, color: T.text }}>{value}</span>
              </div>
            ))}
            {/* Subtotal */}
            {!isRefi && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.separator}`, marginTop: 2 }}>
                <span style={{ fontSize: 12, color: T.textSecondary }}>Subtotal</span>
                <span style={{ fontSize: 12, fontWeight: 500, fontFamily: MONO, color: T.text }}>{fmt(calc.dp + calc.totalClosingCosts + calc.totalPrepaidExp + payoffAtClosing)}</span>
              </div>
            )}
            {/* Credits */}
            {calc.totalCredits > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.separator}` }}>
                <span style={{ fontSize: 12, color: T.green }}>Credits</span>
                <span style={{ fontSize: 12, fontWeight: 500, fontFamily: MONO, color: T.green }}>-{fmt(calc.totalCredits)}</span>
              </div>
            )}
            {/* Bold total */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 2px", borderTop: `2px solid ${T.separator}`, marginTop: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.green }}>{isRefi ? "ESTIMATED REFI COSTS" : "ESTIMATED CASH TO CLOSE"}</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: T.green }}>{fmt(total)}</span>
            </div>
            <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 6, lineHeight: 1.5 }}>
              {isRefi
                ? "Closing costs + prepaids \u2212 credits. No down payment on refi."
                : "Down payment + closing costs + prepaids \u2212 credits. See Fee Breakdown below for full detail."}
            </div>
          </div>
          {/* Link to Costs tab instead of Layer 3 */}
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <span
              onClick={() => setTab("costs")}
              style={{ fontSize: 12, fontWeight: 600, color: T.blue, cursor: "pointer", fontFamily: FONT }}
            >Edit closing costs →</span>
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
  discountPts, payoffAtClosing, setTab, closingMonth, closingDay,
  ownersTitleIns, homeWarranty, hoaTransferFee, buyerPaysComm, buyerCommPct, salesPrice }) {

  return (
    <div>
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

          {/* H. Other Costs (purchase only) */}
          {!isRefi && calc.sectionH > 0 && (
            <FeeCategory title="H. Other Costs" total={fmt(calc.sectionH)} T={T}>
              {ownersTitleIns > 0 && <FeeRow T={T} label="Owner's Title Insurance" value={fmt(ownersTitleIns)} indent />}
              {homeWarranty > 0 && <FeeRow T={T} label="Home Warranty" value={fmt(homeWarranty)} indent />}
              {calc.hoaTransferActual > 0 && <FeeRow T={T} label="HOA Transfer Fee" value={fmt(calc.hoaTransferActual)} indent />}
              {calc.buyerCommAmt > 0 && <FeeRow T={T} label={`Buyer Agent Commission (${buyerCommPct}%)`} value={fmt(calc.buyerCommAmt)} indent />}
            </FeeCategory>
          )}

          {/* Closing Costs Subtotal */}
          <div style={{ borderTop: `2px solid ${T.blue}40`, marginTop: 8, paddingTop: 8, marginBottom: 8 }}>
            <FeeRow T={T} label={isRefi ? "Total Closing Costs (A\u2013D)" : "Total Closing Costs (A\u2013D,H)"} value={fmt(calc.totalClosingCosts)} bold color={T.blue} />
          </div>

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

          {/* Prepaids Subtotal */}
          <div style={{ borderTop: `2px solid ${T.blue}40`, marginTop: 8, paddingTop: 8, marginBottom: 8 }}>
            <FeeRow T={T} label="Total Prepaids & Escrow (F/G)" value={fmt(calc.totalPrepaidExp)} bold color={T.blue} />
          </div>

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
  propertyZip, setPropertyZip,
  annualIns, setAnnualIns,
  hoa, setHoa,
  includeEscrow, setIncludeEscrow,
  closingMonth, closingDay,
  isRefi,
  firstTimeBuyer, setFirstTimeBuyer,
  creditScore, setCreditScore,
  married, setMarried,
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
  ownsProperties, setOwnsProperties,
  /* Income */
  incomes,
  /* Assets */
  assets,
  /* Amortization */
  payExtra, setPayExtra,
  extraPayment, setExtraPayment,
  appreciationRate, setAppreciationRate,
  /* Sell */
  hasSellProperty, setHasSellProperty,
  showInvestor, setShowInvestor,
  showRentVsBuy, setShowRentVsBuy,
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
  /* Section H: Other Costs */
  ownersTitleIns, homeWarranty, hoaTransferFee, buyerPaysComm, buyerCommPct,
  /* Property tax calculator */
  propTaxMode, setPropTaxMode,
  taxBaseRateOverride, setTaxBaseRateOverride,
  taxExemptionOverride, setTaxExemptionOverride,
  fixedAssessments, setFixedAssessments,
  taxRateLocked, setTaxRateLocked,
  taxExemptionLocked, setTaxExemptionLocked,
  /* PMI pill */
  pmiRateLocked, setPmiRateLocked,
  pmiRateOverride, setPmiRateOverride,
  /* VA Funding Fee pill */
  vaUsage,
  vaFundingFeeLocked, setVaFundingFeeLocked,
  vaFundingFeeOverride, setVaFundingFeeOverride,
}) {
  const qualRef = useRef(null);
  const [showModules, setShowModules] = useState(false);

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
        {/* ── Row 1: Zip | Property Type | Occupancy ── */}
        <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 6 } : { marginBottom: 6 }}>
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, fontFamily: FONT }}>
              Zip Code<span style={{ color: T.red, marginLeft: 3, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>*</span>
            </div>
            <input
              value={propertyZip}
              onChange={e => { if (typeof setPropertyZip === "function") { const clean = e.target.value.replace(/\D/g, "").slice(0, 5); setPropertyZip(clean); } }}
              placeholder="Enter zip"
              inputMode="numeric"
              pattern="[0-9]*"
              style={{
                width: "100%", boxSizing: "border-box",
                background: T.inputBg, borderRadius: 12,
                border: `1px solid ${T.inputBorder}`, padding: "10px 12px",
                color: T.text, fontSize: 13, fontWeight: 500, fontFamily: FONT,
                outline: "none",
              }}
              onFocus={e => { e.target.style.border = `2px solid ${T.blue}`; }}
              onBlur={e => { e.target.style.border = `1px solid ${T.inputBorder}`; }}
            />
          </div>
          {!isRefi ? (
            <>
              <Sel label="Property Type" value={propType} onChange={setPropType} options={propTypes} sm req />
              <Sel label="Occupancy" value={loanPurpose} onChange={v => {
                setLoanPurpose(v);
                if (v === "Purchase Investment" && loanPurpose !== "Purchase Investment") {
                  setShowInvestor(true);
                }
              }} options={[
                { value: "Purchase Primary", label: "Primary" },
                { value: "Purchase 2nd Home", label: "Second Home" },
                { value: "Purchase Investment", label: "Investment" }
              ]} sm req />
            </>
          ) : (
            <>
              <Sel label="Property Type" value={propType} onChange={setPropType} options={propTypes} sm req />
              <div />
            </>
          )}
        </div>

        {/* ── Row 2: Price | Down Payment | Loan Amount ── */}
        <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "start" } : {}}>
          <Inp label={isRefi ? "Home Value" : "Purchase Price"} value={salesPrice} onChange={setSalesPrice} max={100000000} sm req />
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
        {!isRefi && calc.dpWarning === "fail" && <Note color={T.red}>{loanType} requires minimum {calc.minDPpct}% down. Current: {downPct}%</Note>}

        {/* ── Row 3: Rate | Term | Loan Type ── */}
        <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 8 } : { marginTop: 8 }}>
          <Inp label="Rate" value={rate} onChange={setRate} prefix="" suffix="%" step={0.001} max={30} sm req />
          <Sel label="Term" value={term} onChange={v => setTerm(parseInt(v))} options={[{value:30,label:"30 Year"},{value:25,label:"25 Year"},{value:20,label:"20 Year"},{value:15,label:"15 Year"},{value:10,label:"10 Year"}]} sm req />
          <Sel label="Loan Type" value={loanType} onChange={setLoanType} options={["Conventional","FHA","VA","Jumbo","USDA"]} sm req />
        </div>

        {/* Live Rates — below Rate/Term/Type */}
        <div style={{ marginTop: 8 }}>
          <button
            onClick={fetchRates}
            disabled={ratesLoading}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 10,
              border: `1px solid ${liveRates ? T.green + '40' : T.blue + '40'}`,
              background: liveRates ? T.green + '10' : T.blue + '10',
              color: liveRates ? T.green : T.blue,
              fontFamily: MONO,
              fontSize: 12,
              fontWeight: 600,
              cursor: ratesLoading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.2s'
            }}
          >
            {ratesLoading ? 'Fetching...' : liveRates ? `\u2713 Live Rates Applied \u2014 ${liveRates.date || 'Today'}` : '\u25C9 Get Today\'s Rates'}
          </button>
          {ratesError && (
            <div style={{ fontSize: 11, color: T.red, marginTop: 4, textAlign: 'center' }}>{ratesError}</div>
          )}
          {liveRates && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 6,
              marginTop: 8
            }}>
              {[
                { label: '30yr Fixed', key: '30yr_fixed' },
                { label: '15yr Fixed', key: '15yr_fixed' },
                { label: 'FHA 30yr', key: '30yr_fha' },
                { label: 'VA 30yr', key: '30yr_va' },
                { label: 'Jumbo', key: '30yr_jumbo' },
                { label: '5/1 ARM', key: '5yr_arm' },
              ].filter(r => liveRates[r.key] != null).map(r => {
                const isActive = (() => {
                  if (loanType === 'FHA' && r.key === '30yr_fha') return true;
                  if (loanType === 'VA' && r.key === '30yr_va') return true;
                  if (loanType === 'Jumbo' && r.key === '30yr_jumbo') return true;
                  if (loanType === 'Conventional' && term === 15 && r.key === '15yr_fixed') return true;
                  if (loanType === 'Conventional' && term !== 15 && r.key === '30yr_fixed') return true;
                  if (loanType === 'USDA' && r.key === '30yr_fixed') return true;
                  return false;
                })();
                return (
                  <button
                    key={r.key}
                    onClick={() => setRate(liveRates[r.key])}
                    style={{
                      padding: '8px 6px',
                      borderRadius: 8,
                      border: `1px solid ${isActive ? T.blue : T.cardBorder}`,
                      background: isActive ? T.blue + '15' : T.card,
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: 10, color: T.textTertiary, fontFamily: MONO, fontWeight: 500 }}>{r.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: isActive ? T.blue : T.text, fontFamily: MONO }}>{liveRates[r.key]}%</div>
                  </button>
                );
              })}
            </div>
          )}
          {liveRates && (
            <div style={{ fontSize: 10, color: T.textTertiary, textAlign: 'center', marginTop: 4, fontFamily: MONO }}>
              Source: {liveRates.source || 'Freddie Mac PMMS'}
            </div>
          )}
        </div>

        {/* ── Cost Pills: Property Tax + MI side-by-side on desktop ── */}
        {isDesktop ? (
          <div style={{ display: "grid", gridTemplateColumns: calc.monthlyMI > 0 ? "1fr 1fr" : "1fr", gap: 12, alignItems: "start", marginTop: 4 }}>
            <PropertyTaxPill
              T={T} calc={calc} salesPrice={salesPrice}
              propTaxMode={propTaxMode} setPropTaxMode={setPropTaxMode}
              taxBaseRateOverride={taxBaseRateOverride} setTaxBaseRateOverride={setTaxBaseRateOverride}
              taxExemptionOverride={taxExemptionOverride} setTaxExemptionOverride={setTaxExemptionOverride}
              fixedAssessments={fixedAssessments} setFixedAssessments={setFixedAssessments}
              propertyState={propertyState} city={city} loanPurpose={loanPurpose}
              Inp={Inp} fmt={fmt} fmt2={fmt2} isDesktop={isDesktop}
              taxRateLocked={taxRateLocked} setTaxRateLocked={setTaxRateLocked}
              taxExemptionLocked={taxExemptionLocked} setTaxExemptionLocked={setTaxExemptionLocked}
            />
            {calc.monthlyMI > 0 && (
              <MortgageInsurancePill
                T={T} calc={calc} salesPrice={salesPrice} loanType={loanType}
                creditScore={creditScore} Inp={Inp} fmt={fmt} fmt2={fmt2} isDesktop={isDesktop}
                pmiRateLocked={pmiRateLocked} setPmiRateLocked={setPmiRateLocked}
                pmiRateOverride={pmiRateOverride} setPmiRateOverride={setPmiRateOverride}
              />
            )}
          </div>
        ) : (
          <>
            <PropertyTaxPill
              T={T} calc={calc} salesPrice={salesPrice}
              propTaxMode={propTaxMode} setPropTaxMode={setPropTaxMode}
              taxBaseRateOverride={taxBaseRateOverride} setTaxBaseRateOverride={setTaxBaseRateOverride}
              taxExemptionOverride={taxExemptionOverride} setTaxExemptionOverride={setTaxExemptionOverride}
              fixedAssessments={fixedAssessments} setFixedAssessments={setFixedAssessments}
              propertyState={propertyState} city={city} loanPurpose={loanPurpose}
              Inp={Inp} fmt={fmt} fmt2={fmt2} isDesktop={isDesktop}
              taxRateLocked={taxRateLocked} setTaxRateLocked={setTaxRateLocked}
              taxExemptionLocked={taxExemptionLocked} setTaxExemptionLocked={setTaxExemptionLocked}
            />
            {calc.monthlyMI > 0 && (
              <MortgageInsurancePill
                T={T} calc={calc} salesPrice={salesPrice} loanType={loanType}
                creditScore={creditScore} Inp={Inp} fmt={fmt} fmt2={fmt2} isDesktop={isDesktop}
                pmiRateLocked={pmiRateLocked} setPmiRateLocked={setPmiRateLocked}
                pmiRateOverride={pmiRateOverride} setPmiRateOverride={setPmiRateOverride}
              />
            )}
          </>
        )}

        {/* ── VA Funding Fee — conditional, own row ── */}
        {loanType === "VA" && calc.vaFundingFee > 0 && (
          <VAFundingFeePill
            T={T} calc={calc} Inp={Inp} fmt={fmt} fmt2={fmt2} isDesktop={isDesktop}
            downPct={downPct} vaUsage={vaUsage}
            vaFundingFeeLocked={vaFundingFeeLocked} setVaFundingFeeLocked={setVaFundingFeeLocked}
            vaFundingFeeOverride={vaFundingFeeOverride} setVaFundingFeeOverride={setVaFundingFeeOverride}
          />
        )}

        {/* ── Insurance + HOA — always 2-col on desktop ── */}
        <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 } : { marginTop: 4 }}>
          <Inp label="Insurance" value={annualIns} onChange={setAnnualIns} suffix="/yr" max={50000} sm />
          <Inp label="HOA" value={hoa} onChange={setHoa} suffix="/mo" max={10000} sm />
        </div>
      </OCard>

      {/* Module Toggles — collapsible "More Options" */}
      <div style={{ marginTop: 14 }}>
        <button
          onClick={() => setShowModules(!showModules)}
          style={{
            background: 'none',
            border: 'none',
            color: T.textSecondary,
            fontFamily: MONO,
            fontSize: '0.6rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '2px',
            cursor: 'pointer',
            padding: '6px 0',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span style={{
            display: 'inline-block',
            transform: showModules ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}>{'\u25B8'}</span>
          Additional Modules
        </button>
        {showModules && (
          <div style={{
            marginTop: 8,
            padding: 14,
            background: T.inputBg,
            borderRadius: 12,
            border: `1px solid ${T.cardBorder}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            {[
              { label: 'Own Properties?', desc: 'Show Real Estate Owned analysis', val: ownsProperties, set: setOwnsProperties },
              { label: 'Selling a Property?', desc: 'Show Seller Net Proceeds calculator', val: hasSellProperty, set: setHasSellProperty },
              { label: 'Investment Analysis?', desc: 'Show NOI, Cap Rate, DSCR metrics', val: showInvestor, set: setShowInvestor },
              ...(!isRefi ? [{ label: 'Buy vs Rent?', desc: 'Compare buying vs renting over time', val: showRentVsBuy, set: setShowRentVsBuy }] : []),
            ].map(m => (
              <div key={m.label} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 1 }}>{m.desc}</div>
                </div>
                <button
                  onClick={() => m.set(!m.val)}
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 9999,
                    border: 'none',
                    background: m.val ? T.blue : T.separator,
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    flexShrink: 0
                  }}
                >
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 2,
                    left: m.val ? 20 : 2,
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
      {/* ── Cash to Close 3-Layer Pill ── */}
      <div id="overview-costs" style={{ marginTop: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: FONT, color: T.text, letterSpacing: "-0.02em", paddingLeft: 4, marginBottom: 4 }}>
          {isRefi ? "Estimated Refi Costs" : "Cash to Close"}
        </h2>
        <CashToClosePill
          T={T} calc={calc} isRefi={isRefi} salesPrice={salesPrice} downPct={downPct}
          payoffAtClosing={payoffAtClosing} setTab={setTab} fmt={fmt} fmt2={fmt2}
        />
      </div>
      {/* ── Detailed Fee Breakdown (kept from IFWCashToClose) ── */}
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
        ownersTitleIns={ownersTitleIns} homeWarranty={homeWarranty}
        hoaTransferFee={hoaTransferFee} buyerPaysComm={buyerPaysComm}
        buyerCommPct={buyerCommPct} salesPrice={salesPrice}
      />

      {/* ═══════════════════════════════════════
          SECTION 4: INCOME SUMMARY
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
          SECTION 6B: ASSETS
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Assets" T={T} action="Edit Assets →" onAction={() => setTab("assets")}>
        <OCard T={T}>
          {assets.length > 0 ? (
            <>
              {/* Total + Cash to Close + Reserves row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, color: T.textTertiary, letterSpacing: 1, textTransform: "uppercase" }}>Total</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: T.cyan, letterSpacing: "-0.02em" }}>{fmt(calc.totalAssetValue)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, color: T.textTertiary, letterSpacing: 1, textTransform: "uppercase" }}>For Closing</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: calc.totalForClosing >= calc.cashToClose ? T.green : T.text, letterSpacing: "-0.02em" }}>{fmt(calc.totalForClosing)}</div>
                  <div style={{ fontSize: 10, color: calc.totalForClosing >= calc.cashToClose ? T.green : T.orange, fontWeight: 500 }}>
                    {calc.totalForClosing >= calc.cashToClose ? `✓ Covers ${fmt(calc.cashToClose)}` : `${fmt(calc.cashToClose - calc.totalForClosing)} short`}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, color: T.textTertiary, letterSpacing: 1, textTransform: "uppercase" }}>Reserves</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: calc.totalReserves >= calc.reservesReq ? T.green : T.text, letterSpacing: "-0.02em" }}>{fmt(calc.totalReserves)}</div>
                  <div style={{ fontSize: 10, color: calc.totalReserves >= calc.reservesReq ? T.green : T.orange, fontWeight: 500 }}>
                    {calc.reservesReq > 0 ? (calc.totalReserves >= calc.reservesReq ? `✓ Covers ${calc.reserveMonths} mo` : `${fmt(calc.reservesReq - calc.totalReserves)} short`) : "N/A"}
                  </div>
                </div>
              </div>
              {/* Account list */}
              {assets.map((a, i) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderTop: i === 0 ? `1px solid ${T.separator}` : `1px solid ${T.separator}` }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: T.text, fontFamily: FONT }}>{a.bank || a.type || "Account"}</span>
                    {a.bank && a.type && <span style={{ fontSize: 11, color: T.textTertiary, marginLeft: 6 }}>{a.type}</span>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, fontFamily: MONO, color: T.text }}>{fmt(a.value)}</span>
                    {a.forClosing > 0 && <div style={{ fontSize: 10, color: T.green, fontWeight: 500 }}>{fmt(a.forClosing)} closing</div>}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "12px 0", fontSize: 13, color: T.textTertiary }}>
              No assets entered — <span onClick={() => setTab("assets")} style={{ color: T.blue, cursor: "pointer", fontWeight: 600 }}>add assets</span>
            </div>
          )}
        </OCard>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 7: QUALIFICATION (5 PILLARS)
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <div id="overview-qualification">
        <CollapsibleSection title="Qualification" T={T} action="Full Details →" onAction={() => setTab("qualify")}>
          {/* FICO Score Input */}
          <div style={{
            display: 'flex',
            alignItems: isDesktop ? 'center' : 'flex-start',
            flexDirection: isDesktop ? 'row' : 'column',
            gap: 12,
            marginBottom: 16,
            padding: 16,
            background: T.inputBg,
            borderRadius: 12,
            border: `1px solid ${T.cardBorder}`
          }}>
            <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
              <div style={{
                fontFamily: MONO,
                fontSize: '0.6rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '2px',
                color: T.textTertiary,
                marginBottom: 6
              }}>FICO Score</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={creditScore || ''}
                  placeholder="750"
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 3);
                    setCreditScore(+v || 0);
                  }}
                  style={{
                    width: 72,
                    textAlign: 'center',
                    background: T.card,
                    border: `1px solid ${T.inputBorder}`,
                    borderRadius: 10,
                    padding: '10px 8px',
                    color: T.text,
                    fontFamily: MONO,
                    fontSize: 17,
                    fontWeight: 700,
                    outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = T.blue}
                  onBlur={e => { e.target.style.borderColor = T.inputBorder; if (creditScore > 0 && creditScore < 300) setCreditScore(300); }}
                />
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="range"
                    min={300}
                    max={850}
                    value={creditScore || 300}
                    onChange={e => setCreditScore(+e.target.value)}
                    style={{ width: '100%', accentColor: creditScore >= 740 ? T.green : creditScore >= 670 ? T.orange : T.red }}
                  />
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 10,
                    fontFamily: MONO,
                    color: T.textTertiary,
                    marginTop: 2
                  }}>
                    <span>300</span>
                    <span>850</span>
                  </div>
                </div>
              </div>
            </div>
            {creditScore > 0 && (
              <div style={{
                padding: '6px 12px',
                borderRadius: 9999,
                fontSize: 11,
                fontFamily: MONO,
                fontWeight: 600,
                background: calc.ficoCheck === 'Good!' ? T.green + '18' : T.red + '18',
                color: calc.ficoCheck === 'Good!' ? T.green : T.red,
                whiteSpace: 'nowrap'
              }}>
                {creditScore} / {calc.ficoMin}+ {calc.ficoCheck === 'Good!' ? '\u2713' : `need ${calc.ficoMin - creditScore} pts`}
              </div>
            )}
          </div>
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
          SECTION 8: TAX SAVINGS
          ═══════════════════════════════════════ */}
      {loanPurpose !== "Purchase Investment" && loanPurpose !== "Purchase 2nd Home" && (
        <>
          <SectionDivider T={T} />
          <CollapsibleSection title="Tax Savings" T={T} action="Full Analysis →" onAction={() => setTab("tax")}>
            {/* Filing Status */}
            <Sel label="Filing Status" value={married} onChange={v => setMarried(v)} options={[
              { value: "Single", label: "Single" },
              { value: "MFJ", label: "Married Filing Jointly" },
              { value: "MFS", label: "Married Filing Separately" },
              { value: "HOH", label: "Head of Household" }
            ]} sm />
            <div style={{ fontSize: 11, color: T.textTertiary, marginTop: -8, marginBottom: 12, paddingLeft: 2, fontFamily: FONT }}>
              Affects tax bracket, standard deduction ({married === 'MFJ' ? '$32,200' : married === 'HOH' ? '$24,150' : '$16,100'}), and SALT cap
            </div>
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
