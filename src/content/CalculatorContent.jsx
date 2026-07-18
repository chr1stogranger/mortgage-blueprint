import { FONT } from "../lib/fonts.js";
import React, { useState, useRef } from "react";
import CashToCloseSummary from "../components/CashToCloseSummary";
import { devCheckProps } from "../lib/devPropCheck.js";
import { NV_CITY_TAX_RATES } from "../citiesData.js";
import { getPMIRate } from "../lib/finance.js";


// Inline-editable numeric value for Payment Breakdown rows (Insurance, HOA).
// Renders as a subtle dashed indigo chip at rest; becomes a focused input on tap.
// Stores comma-formatted display string while editing, commits the parsed number on blur.
function InlineEditValue({ value, onChange, T }) {
  const [focused, setFocused] = useState(false);
  const [editStr, setEditStr] = useState(null);
  const inputRef = useRef(null);
  const fmtComma = (n) => {
    if (n === 0 || n === "0") return "0";
    if (n === "" || n == null) return "";
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  const display = focused
    ? (editStr !== null ? editStr : (value === 0 ? "" : fmtComma(value)))
    : `$${fmtComma(value || 0)}`;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={display}
        onFocus={() => { setFocused(true); setEditStr(null); }}
        onBlur={() => {
          setFocused(false);
          if (editStr !== null) {
            const n = parseFloat(editStr.replace(/,/g, ""));
            onChange(isNaN(n) ? 0 : n);
            setEditStr(null);
          }
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, "");
          if (/^\d*\.?\d*$/.test(raw)) {
            setEditStr(fmtComma(raw));
            const n = parseFloat(raw);
            if (!isNaN(n)) onChange(n);
          }
        }}
        style={{
          background: focused ? T.inputBg : "transparent",
          border: focused ? `1.5px solid ${T.blue}` : `1px dashed ${T.blue}55`,
          borderRadius: 6,
          padding: "3px 8px",
          color: T.blue,
          fontSize: 14,
          fontWeight: 600,
          fontFamily: FONT,
          textAlign: "right",
          width: 88,
          outline: "none",
          cursor: "text",
          transition: "all 0.15s",
          letterSpacing: "-0.01em",
        }}
      />
      <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT }}>/mo</span>
    </div>
  );
}

// Compact inline editor for breakdown-table rows (Christo 2026-07-05: the
// customize pills under the tax table were redundant — numbers edit right in
// the table, gated by mini inline locks). Tight height per the FeeRow
// inline-editor rule: raw input, height 20, no wrapping margins.
function MiniEdit({ value, onChange, prefix = "", suffix = "", T, width = 76 }) {
  const [focused, setFocused] = useState(false);
  const [editStr, setEditStr] = useState(null);
  const fmtComma = (n) => {
    if (n === 0 || n === "0") return "0";
    if (n === "" || n == null) return "";
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  const shown = focused
    ? (editStr !== null ? editStr : (value === 0 ? "" : String(value)))
    : `${prefix}${fmtComma(value || 0)}`;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <input
        type="text"
        inputMode="decimal"
        value={shown}
        onFocus={() => { setFocused(true); setEditStr(null); }}
        onBlur={() => {
          setFocused(false);
          if (editStr !== null) {
            const n = parseFloat(editStr.replace(/,/g, ""));
            onChange(isNaN(n) ? 0 : n);
            setEditStr(null);
          }
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, "");
          if (/^\d*\.?\d*$/.test(raw)) {
            setEditStr(raw);
            const n = parseFloat(raw);
            if (!isNaN(n)) onChange(n);
          }
        }}
        style={{
          background: focused ? T.inputBg : "transparent",
          border: focused ? `1.5px solid ${T.blue}` : `1px dashed ${T.blue}55`,
          borderRadius: 6, padding: "0 6px", height: 20, boxSizing: "border-box",
          color: T.blue, fontSize: 12, fontWeight: 600, fontFamily: FONT,
          textAlign: "right", width, outline: "none", cursor: "text",
        }}
      />
      {suffix && <span style={{ fontSize: 10, color: T.textTertiary, fontFamily: FONT }}>{suffix}</span>}
    </span>
  );
}

export default function CalculatorContent(props) {
  // Dev-only guard for curated-props drift (see src/lib/devPropCheck.js).
  if (import.meta.env.DEV) devCheckProps("CalculatorContent", props, ["T", "isDesktop", "calc", "fmt", "fmt2", "pct", "changedFields", "paySegs", "salesPrice", "setSalesPrice", "city", "taxState", "isRefi", "downPct", "setDownPct", "downMode", "setDownMode", "loanType", "setLoanType", "firstTimeBuyer", "includeEscrow", "setIncludeEscrow", "loanPurpose", "setLoanPurpose", "refiCurrentRate", "rate", "setRate", "term", "setTerm", "refiPurpose", "refiCashOut", "refiNewLoanAmtOverride", "setRefiNewLoanAmtOverride", "isPulse", "markTouched", "fetchRates", "ratesLoading", "ratesError", "liveRates", "fredApiKey", "userLoanTypeRef", "setAutoJumboSwitch", "autoJumboSwitch", "LOAN_TYPES", "vaUsage", "setVaUsage", "VA_USAGE", "getHighBalLimit", "UNIT_COUNT", "propType", "setPropType", "PROP_TYPES", "subjectRentalIncome", "setSubjectRentalIncome", "propertyState", "setPropertyState", "setCity", "propertyCounty", "setPropertyCounty", "STATE_NAMES_PROP", "CITY_NAMES", "STATE_CITIES", "propTaxMode", "STATE_PROPERTY_TAX_RATES", "taxRateLocked", "setTaxRateLocked", "taxExemptionLocked", "setTaxExemptionLocked", "taxBaseRateOverride", "setTaxBaseRateOverride", "propTaxExpanded", "setPropTaxExpanded", "fixedAssessments", "setFixedAssessments", "CITY_TAX_RATES", "taxExemptionOverride", "setTaxExemptionOverride", "propTaxCustomize", "setPropTaxCustomize", "pmiRateLocked", "setPmiRateLocked", "pmiRateOverride", "setPmiRateOverride", "pmiChartOverrides", "setPmiChartOverrides", "annualIns", "setAnnualIns", "hoa", "setHoa", "buydownType", "setBuydownType", "buydownPaidBy", "setBuydownPaidBy", "underwritingFee", "processingFee", "propertyZip", "setPropertyZip", "creditScore", "StopLight", "handlePillarClick", "allGood", "someGood", "refiPillarCount", "purchPillarCount", "refiLtvCheck", "PayRing", "Card", "Inp", "Sel", "Note", "SearchSelect", "InfoTip", "Icon", "GuidedNextButton", "ClusterContinue"]);
  const {
  T, isDesktop, calc, fmt, fmt2, pct,
  changedFields, paySegs,
  salesPrice, setSalesPrice, city, taxState,
  isRefi, downPct, setDownPct, downMode, setDownMode,
  loanType, setLoanType, firstTimeBuyer,
  includeEscrow, setIncludeEscrow,
  loanPurpose, setLoanPurpose,
  refiCurrentRate, rate, setRate, term, setTerm,
  refiPurpose, refiCashOut,
  refiNewLoanAmtOverride, setRefiNewLoanAmtOverride,
  isPulse, markTouched,
  fetchRates, ratesLoading, ratesError, liveRates, fredApiKey,
  userLoanTypeRef, setAutoJumboSwitch, autoJumboSwitch,
  LOAN_TYPES, vaUsage, setVaUsage, VA_USAGE,
  getHighBalLimit, UNIT_COUNT,
  propType, setPropType, PROP_TYPES,
  subjectRentalIncome, setSubjectRentalIncome,
  propertyState, setPropertyState, setCity,
  propertyCounty, setPropertyCounty,
  STATE_NAMES_PROP, CITY_NAMES, STATE_CITIES,
  propTaxMode, STATE_PROPERTY_TAX_RATES,
  taxRateLocked, setTaxRateLocked,
  taxExemptionLocked, setTaxExemptionLocked,
  taxBaseRateOverride, setTaxBaseRateOverride,
  propTaxExpanded, setPropTaxExpanded,
  fixedAssessments, setFixedAssessments,
  CITY_TAX_RATES,
  taxExemptionOverride, setTaxExemptionOverride,
  propTaxCustomize, setPropTaxCustomize,
  pmiRateLocked, setPmiRateLocked,
  pmiRateOverride, setPmiRateOverride,
  pmiChartOverrides, setPmiChartOverrides,
  annualIns, setAnnualIns, hoa, setHoa,
  buydownType, setBuydownType, buydownPaidBy, setBuydownPaidBy,
  underwritingFee, processingFee,
  propertyZip, setPropertyZip, creditScore,
  StopLight, handlePillarClick,
  allGood, someGood, refiPillarCount, purchPillarCount, refiLtvCheck,
  PayRing, Card, Inp, Sel, Note, SearchSelect, InfoTip, Icon,
  GuidedNextButton, ClusterContinue,
} = props;

  // pmiExpanded is kept for API compatibility, but the calculation toggle is driven by propTaxExpanded
  // so that Property Tax and PMI breakdowns expand/collapse together.
  const [pmiExpanded, setPmiExpanded] = useState(false);
  const [piExpanded, setPiExpanded] = useState(false); // Principal & Interest split disclosure
  const [buydownExpanded, setBuydownExpanded] = useState(false); // Temporary buydown disclosure (B2)
  // Advanced PMI rate chart (LO-editable Radian matrix for the current FICO band).
  const [pmiChartOpen, setPmiChartOpen] = useState(false);
  // Live-rates popup — opens when user clicks the inline '✓ Live' pill in the Rate
  // card. Holds the 6 rate-type options without taking permanent UI space.
  const [ratesPopupOpen, setRatesPopupOpen] = useState(false);

  // Inline expansion in Payment Breakdown — chevron next to Tax/PMI toggles the
  // breakdown table directly inside the Payment Breakdown card (no jump-and-scroll).
  // Reuses the existing propTaxExpanded / pmiExpanded state from the parent.
  const toggleTaxInline = () => setPropTaxExpanded(!propTaxExpanded);
  const togglePmiInline = () => setPmiExpanded(!pmiExpanded);
  const togglePiInline = () => setPiExpanded(!piExpanded);
  // Guided step 9: expanding the carets IS the advance gesture. Declarative
  // effect (not click handlers) so stale closures / pre-expanded carets can
  // never soft-lock the step — whenever the required carets are open, mark it.
  React.useEffect(() => {
    const explored = (!includeEscrow || propTaxExpanded) && ((calc.monthlyMI || 0) === 0 || pmiExpanded);
    if (explored && markTouched) markTouched("payment-breakdown-done");
  }, [propTaxExpanded, pmiExpanded, includeEscrow, calc.monthlyMI]);

  // Helper values used by the inline Tax breakdown
  const taxAutoRate = calc.autoTaxRate;
  const taxCityLabel = propertyState === "California" ? (city || "CA") : (propertyState || "State");
  const taxAnyUnlocked = !taxRateLocked || !taxExemptionLocked;
  const taxDisplayRate = taxBaseRateOverride > 0 ? taxBaseRateOverride : taxAutoRate * 100;

  // Helper values used by the inline PMI breakdown
  const miLabel = loanType === "FHA" ? "Mortgage Insurance Premium (MIP)"
                : loanType === "VA"  ? "VA Funding Fee"
                : "Private Mortgage Insurance (PMI)";
  const monthlyMI = calc.monthlyMI || 0;

  // Temporary buydown (B2): hide the row entirely when there's no loan/term
  // to model (matches how sibling rows guard on their inputs).
  const showBuydownRow = (calc.loan || 0) > 0 && (Number(term) || 0) > 0;
  const miZeroReason = monthlyMI === 0 ? (
    loanType === "VA" ? "No monthly MI on VA loans (one-time funding fee applies at close)."
    : loanType === "Jumbo" ? "Jumbo loans typically do not carry PMI."
    : calc.ltv <= 0.80 ? `Your LTV of ${pct(calc.ltv, 1)} is at or below 80% — no PMI required.`
    : "Not required for this scenario."
  ) : null;

  // Legend rows for the donut — principal / interest / tax / insurance (+ MI when present)
  const legendRows = [
    { label: "Principal", value: calc.monthlyPrinReduction || 0, color: T.cyan || T.blue },
    { label: "Interest",  value: (calc.pi || 0) - (calc.monthlyPrinReduction || 0), color: T.blue },
    ...(includeEscrow ? [
      { label: "Tax",       value: calc.monthlyTax || 0, color: T.orange },
      { label: "Insurance", value: calc.ins || 0,        color: T.green },
    ] : []),
    ...((calc.monthlyMI || 0) > 0 ? [
      { label: loanType === "FHA" ? "MIP" : "PMI", value: calc.monthlyMI || 0, color: T.red },
    ] : []),
    ...(hoa > 0 ? [
      { label: "HOA", value: hoa, color: T.purple || T.blue },
    ] : []),
  ];

  return (<>

 {/* ─────────────────────────────────────────────────────────────── */}
 {/* The 4-pill top row (Occupancy / Property Type / Loan Type / Term)
     was relocated INTO the right column as a 2x2 grid below the Rate /
     Live Rates card per Christo's final layout (2026-05-02). The pills
     no longer anchor the top of Calculator — Rate/Price/Donut now own
     the top fold, and loan-structure controls live alongside Rate where
     a broker tunes the scenario. */}
 {/* ─────────────────────────────────────────────────────────────── */}

 {loanPurpose === "Purchase Investment" && (
  <Note color={T.orange}>Investment property rate adjustment: +1.000% applied automatically (typical range: 0.750–1.250%). Adjust your rate manually if your lender quotes differently.</Note>
 )}
 {loanType === "VA" && (
  <div style={{ marginBottom: 12 }}>
   <Sel label="VA Usage" value={vaUsage} onChange={setVaUsage} options={VA_USAGE.map(v => ({value:v,label:v === "First Use" ? "First Use (2.15%)" : v === "Subsequent" ? "Subsequent (3.3%)" : "Disabled (0%)"}))} sm />
  </div>
 )}
 {autoJumboSwitch && (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: `${T.orange}12`, borderRadius: 10, marginBottom: 12 }}>
   <div style={{ fontSize: 11, color: T.orange, lineHeight: 1.4 }}>
    <strong>Auto-switched to Jumbo</strong> — loan amount ({fmt(Math.round(salesPrice * (1 - downPct / 100)))}) exceeds the {fmt(getHighBalLimit(propType))} high-balance limit{UNIT_COUNT[propType] > 1 ? ` for ${propType.toLowerCase()} properties` : ""}. Jumbo requires 20% down, 700+ FICO, and max 43–50% DTI.
    <span onClick={() => { setLoanType("Conventional"); userLoanTypeRef.current = "Conventional"; setAutoJumboSwitch(false); }} style={{ color: T.blue, cursor: "pointer", fontWeight: 600, marginLeft: 4 }}>Override →</span>
   </div>
  </div>
 )}

 {/* The big 5-pillar StopLight that used to live here was removed per Christo —
     the compact pillar row at the top of the right column (in Row 3 below)
     covers the same data without taking the full-width strip. */}

 {/* ─────────────────────────────────────────────────────────────── */}
 {/* ROW 3 — 2-col: rate + donut + price inputs LEFT | compact pillars + payment breakdown + cash-to-close RIGHT */}
 {/* ─────────────────────────────────────────────────────────────── */}
 {/* alignItems: stretch so both columns expand to the same height; each column
     is itself a flex column with the LAST card (Payment Breakdown on left,
     CashToCloseSummary on right) pushed to the bottom via marginTop: auto so
     their bottom edges align horizontally per Christo's spec. */}
 <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "stretch", marginBottom: 16 } : {}}>

  {/* ========== LEFT COLUMN ========== */}
  <div style={isDesktop ? { display: "flex", flexDirection: "column" } : {}}>
   {/* Rate/APR card moved to RIGHT column per Christo. Popup modal also removed —
       the rate-type tiles are now always visible inside the Rate card on the right. */}

   {/* 1. Purchase Price / Down Payment card — TOP of left column */}
   <div data-field="calc-price" className={isPulse && isPulse("calc-price")} onBlur={() => { if (!isRefi && salesPrice >= 100000) markTouched && markTouched("calc-price-done"); }} style={{ borderRadius: 18, transition: "all 0.3s" }}>
    <div data-field="down-pct-input">
     <Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
       <div>
        {/* Custom label row mirrors the Down field's label row exactly
            (height: 22, label on left) so the two input fields below
            sit on the same baseline. Fixes the visual offset Christo
            flagged on mobile (2026-05-04). */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, height: 22, gap: 8 }}>
         <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>
          {isRefi ? "Home Value" : "Purchase Price"}
          <span style={{ color: T.red, marginLeft: 3, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>*</span>
         </div>
        </div>
        <Inp value={salesPrice} onChange={setSalesPrice} max={100000000} req placeholder="Enter price" prefix="$" />
        {/* Subtitle slot — empty for now, kept so vertical rhythm matches the Down field's subtitle below its input. */}
        <div style={{ fontSize: 11, color: "transparent", fontFamily: FONT, marginTop: 4, paddingLeft: 4, userSelect: "none" }}>·</div>
       </div>
       {isRefi ? (<>
        {/* Refi: Equity & Balance */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginBottom: 14 }}>
         <div style={{ background: T.pillBg, borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: T.textTertiary, fontWeight: 600, marginBottom: 2 }}>CURRENT BALANCE</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: FONT }}>{fmt(calc.refiEffBalance || 0)}</div>
          <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 2 }}>LTV: {pct(calc.refiCurLTV || 0, 0)}</div>
         </div>
         <div style={{ background: `${T.green}10`, borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: T.green, fontWeight: 600, marginBottom: 2 }}>EQUITY</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.green, fontFamily: FONT }}>{fmt(Math.max(0, salesPrice - (calc.refiEffBalance || 0)))}</div>
          <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 2 }}>{salesPrice > 0 ? pct(Math.max(0, 1 - (calc.refiEffBalance || 0) / salesPrice), 0) : "0%"} of value</div>
         </div>
        </div>
        {calc.refiEffBalance <= 0 && <Note color={T.orange}>Enter your current loan details in Setup to see balance & equity here.</Note>}
       </>) : (<>
        {/* Purchase: Down Payment — toggle back in label row so input keeps full mobile width */}
        {(() => {
         // Compact summary so the label row fits on mobile even at $1M+ down payments
         const fmtCompactUSD = (n) => {
          if (n >= 1000000) return `$${(n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace(/\.0$/, "")}M`;
          if (n >= 1000) return `$${Math.round(n / 1000)}K`;
          return `$${Math.round(n)}`;
         };
         const fmtCompactPct = (p) => `${p % 1 === 0 ? p.toFixed(0) : p.toFixed(1).replace(/\.0$/, "")}%`;
         const downSummary = downMode === "pct"
          ? fmtCompactUSD(salesPrice * downPct / 100)
          : fmtCompactPct(downPct);
         // Subtitle below input shows the inverse of the active mode:
         //   pct mode → "$300,000 down"
         //   $   mode → "20% down"
         const downSubtitle = downMode === "pct"
          ? `${fmtCompactUSD(salesPrice * downPct / 100)} down`
          : `${fmtCompactPct(downPct)} down`;
         return (
          <div data-field="calc-down" className={isPulse && isPulse("calc-down")} onBlur={() => { markTouched && markTouched("calc-down-done"); }} style={{ borderRadius: 12, transition: "all 0.3s" }}>
           {/* Label row: 'Down *' on left, %/$ toggle on far right (downSummary moved BELOW input) */}
           <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, height: 22, gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>
             Down<span style={{ color: T.red, marginLeft: 3, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>*</span>
            </div>
            <div style={{ display: "flex", background: T.bg, borderRadius: 99, overflow: "hidden", border: `1px solid ${T.inputBorder}`, flexShrink: 0 }}>
             <button onClick={(e) => { e.stopPropagation(); setDownMode("dollar"); }} style={{ padding: "4px 11px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: FONT, background: downMode === "dollar" ? T.blue : "transparent", color: downMode === "dollar" ? "#fff" : T.textTertiary, transition: "all 0.2s", lineHeight: 1 }}>$</button>
             <button onClick={(e) => { e.stopPropagation(); setDownMode("pct"); }} style={{ padding: "4px 11px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: FONT, background: downMode === "pct" ? T.blue : "transparent", color: downMode === "pct" ? "#fff" : T.textTertiary, transition: "all 0.2s", lineHeight: 1 }}>%</button>
            </div>
           </div>
           {/* Input pill — full width, suffix shows the active unit */}
           {downMode === "pct" ? (
            <Inp value={downPct} onChange={setDownPct} prefix="" suffix="%" step={0.01} max={100} req />
           ) : (
            <Inp value={Math.round(salesPrice * downPct / 100)} onChange={v => { const p = salesPrice > 0 ? (v / salesPrice) * 100 : 0; setDownPct(Math.round(p * 100) / 100); }} prefix="$" step={1000} max={salesPrice} req />
           )}
           {/* Subtitle: shows the inverse format directly under the input */}
           <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, marginTop: 4, paddingLeft: 4 }}>
            {downSubtitle}
           </div>
          </div>
         );
        })()}
       </>)}
      </div>
      {!isRefi && calc.dpWarning === "fail" && <Note color={T.red}>{loanType} requires minimum {calc.minDPpct}% down{loanType === "Conventional" && firstTimeBuyer ? " (FTHB conforming)" : ""}. Current: {downPct}% — need {(calc.minDPpct - downPct).toFixed(1)}% more.</Note>}
      {!isRefi && loanType === "Conventional" && !firstTimeBuyer && downPct >= 3 && downPct < 5 && <Note color={T.orange}>3% down requires First-Time Homebuyer + conforming loan + income ≤ 100% AMI. Toggle FTHB in Setup or increase to 5%.</Note>}
     </Card>
    </div>
   </div>

   {/* 2. Donut block: Escrow toggle row spans the top, donut centered below */}
   <div className={changedFields && changedFields.size > 0 ? "field-updated" : ""} style={{ display: "flex", flexDirection: "column", marginTop: 12, marginBottom: 12 }}>
    {/* Escrow toggle header row — label upper-left, toggle upper-right */}
    {(() => {
     const escrowLocked = loanType === "FHA" || loanType === "VA";
     return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 6px 10px", width: "100%" }}>
       <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT, opacity: escrowLocked ? 0.6 : 1 }}>
        Include Escrow (Tax &amp; Ins)
       </span>
       <button
        onClick={() => { if (!escrowLocked) setIncludeEscrow(!includeEscrow); }}
        title={escrowLocked ? `${loanType} loans require escrow — cannot be toggled off` : (includeEscrow ? "Escrow ON — Tax + Insurance included" : "Escrow OFF — Tax + Insurance shown separately")}
        style={{
         width: 44,
         height: 26,
         borderRadius: 13,
         border: "none",
         padding: 0,
         cursor: escrowLocked ? "not-allowed" : "pointer",
         background: includeEscrow ? T.blue : T.inputBorder,
         position: "relative",
         transition: "background 0.2s",
         opacity: escrowLocked ? 0.6 : 1,
        }}
       >
        <div style={{
         width: 20,
         height: 20,
         borderRadius: 10,
         background: "#fff",
         position: "absolute",
         top: 3,
         left: includeEscrow ? 21 : 3,
         transition: "left 0.2s",
         boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
       </button>
      </div>
     );
    })()}
    {/* Body: legend bottom-left + donut centered in the remaining space.
        Per Christo's screenshot — legend stacks vertically (one row per
        component) and sits in the lower-left corner of the donut card.
        The donut centers itself in the area to the right of the legend.
        On mobile we collapse to: donut centered, legend below (centered). */}
    <div style={isDesktop
     ? { display: "flex", alignItems: "stretch", gap: 8, marginTop: 4 }
     : { display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 4 }
    }>
     {/* Legend — vertical stack, bottom-aligned (desktop) / centered (mobile) */}
     <div style={isDesktop
      ? { flex: "0 0 auto", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 6, paddingBottom: 8 }
      : { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, order: 2 }
     }>
      {legendRows.map((row, i) => (
       <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.textSecondary, fontFamily: FONT }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: row.color, flexShrink: 0 }} />
        <span>{row.label}</span>
        <span style={{ fontFamily: FONT, fontWeight: 600, color: T.text }}>{fmt(row.value)}</span>
       </div>
      ))}
     </div>
     {/* Donut — centered in the remaining horizontal space */}
     <div style={isDesktop
      ? { flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }
      : { display: "flex", justifyContent: "center", order: 1 }
     }>
      <PayRing segments={paySegs} total={calc.displayPayment} size={isDesktop ? 280 : 200} hideLegend />
     </div>
    </div>
   </div>

   {/* Escrow warning notes (live below the donut). */}
   {(loanType === "FHA" || loanType === "VA") && <Note color={T.blue}>{loanType} loans require escrow impound accounts — this cannot be toggled off.</Note>}
   {!includeEscrow && loanType !== "FHA" && loanType !== "VA" && <div style={{ marginBottom: 14 }}><Note color={T.orange}>Escrow OFF — Tax + Insurance ({fmt(calc.escrowAmount)}/mo) not shown in payment. Still included in DTI qualification.</Note></div>}

   {/* Refi Current → New comparison */}
   {isRefi && calc.refiEffPI > 0 && (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
     <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginBottom: 10 }}>CURRENT → NEW</div>
     <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
       <div style={{ fontSize: 10, color: T.textTertiary, marginBottom: 2 }}>Current</div>
       <div style={{ fontSize: 20, fontWeight: 700, fontFamily: FONT, color: T.red }}>{fmt(calc.refiCurTotalPmt)}</div>
       <div style={{ fontSize: 10, color: T.textTertiary }}>{refiCurrentRate}% · {calc.refiEffRemaining} mos left</div>
      </div>
      <div style={{ fontSize: 20, color: T.green }}>→</div>
      <div style={{ textAlign: "center" }}>
       <div style={{ fontSize: 10, color: T.textTertiary, marginBottom: 2 }}>New</div>
       <div style={{ fontSize: 20, fontWeight: 700, fontFamily: FONT, color: T.green }}>{fmt(calc.refiNewTotalPmt)}</div>
       <div style={{ fontSize: 10, color: T.textTertiary }}>{rate}% · {term * 12} mos</div>
      </div>
     </div>
     {calc.refiMonthlyTotalSavings > 0 ? (
      <div style={{ marginTop: 10, textAlign: "center", padding: "8px 12px", background: `${T.green}10`, borderRadius: 10 }}>
       <span style={{ fontSize: 14, fontWeight: 700, color: T.green }}>{fmt(calc.refiMonthlyTotalSavings)}/mo savings</span>
       {calc.refiBreakevenMonths > 0 && <span style={{ fontSize: 11, color: T.textTertiary, marginLeft: 8 }}>· breakeven {calc.refiBreakevenMonths} mos</span>}
      </div>
     ) : calc.refiMonthlyTotalSavings < 0 ? (
      <div style={{ marginTop: 10, textAlign: "center", padding: "8px 12px", background: `${T.orange}10`, borderRadius: 10 }}>
       <span style={{ fontSize: 12, fontWeight: 600, color: T.orange }}>New payment is {fmt(Math.abs(calc.refiMonthlyTotalSavings))}/mo higher</span>
      </div>
     ) : null}
    </div>
   )}
   {isRefi && calc.refiEffPI > 0 && (
    <div style={{ marginBottom: 12 }}>
     <Inp label="New Loan Amount" value={refiNewLoanAmtOverride || Math.round(calc.refiAutoLoanAmt || 0)} onChange={v => setRefiNewLoanAmtOverride(v)} tip="Defaults to your payoff balance. Override if your new loan amount differs (e.g., rolling in closing costs)." />
     {refiNewLoanAmtOverride > 0 && refiNewLoanAmtOverride !== Math.round(calc.refiAutoLoanAmt || 0) && (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: -8, marginBottom: 4 }}>
       <div style={{ fontSize: 11, color: T.textTertiary }}>Payoff balance: {fmt(calc.refiAutoLoanAmt)}</div>
       <button onClick={() => setRefiNewLoanAmtOverride(0)} style={{ background: "none", border: "none", color: T.blue, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: FONT }}>↺ Reset</button>
      </div>
     )}
    </div>
   )}

   {/* Bottom block — 3-stat row + Payment Breakdown stacked together with
       marginTop:auto so they bottom-align with the matching block in the
       RIGHT column (4-pill grid + 5-pillar + Cash-to-Close Summary). The
       3-stat row sits directly above Payment Breakdown so its baseline
       lines up with the 5-pillar row in the RIGHT column. */}
   <div style={isDesktop ? { marginTop: "auto", display: "flex", flexDirection: "column" } : {}}>
   {/* Loan Amount / LTV / Cash to Close — 3-stat row (was previously rendered
       higher up; relocated here so its Y position aligns with the 5-pillar
       row in the RIGHT column per Christo's 2026-05-02 layout note). */}
   <div className={changedFields && changedFields.size > 0 ? "field-updated" : ""} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
    {(isRefi ? [
     { l: "New Loan", v: fmt(calc.refiNewLoanAmt || calc.loan), c: T.blue, s: refiPurpose === "Cash-Out" ? `incl ${fmt(refiCashOut)} cash-out` : calc.loanCategory, tip: "Your new loan amount after refinancing. For rate/term refis, this equals your current balance. For cash-out, it includes the additional amount." },
     { l: "New LTV", v: pct(calc.refiNewLTV || calc.ltv, 0), c: T.orange, s: `${fmt(Math.max(0, salesPrice - (calc.refiEffBalance || 0)))} equity`, tip: "New Loan-to-Value ratio after refinancing. Based on your current home value and new loan amount. Below 80% = no PMI on conventional." },
     { l: "Refi Costs", v: fmt(calc.totalClosingCosts), c: T.green, tip: "Total closing costs for your refinance — includes lender fees, title, appraisal, and government fees. No down payment or transfer tax on a refi." }
    ] : [
     { l: "Loan Amount", v: fmt(calc.loan), c: T.blue, s: calc.fhaUp > 0 ? `incl ${fmt(calc.fhaUp)} UFMIP` : calc.vaFundingFee > 0 ? `incl ${fmt(calc.vaFundingFee)} VA FF` : calc.loanCategory, tip: "Your total loan amount = purchase price minus down payment, plus any financed fees (like FHA UFMIP or VA Funding Fee)." },
     { l: "LTV", v: pct(calc.ltv, 0), c: T.orange, s: `${downPct}% down`, tip: "Loan-to-Value ratio — your loan amount divided by the home's value. Below 80% LTV (20%+ down) = no PMI on conventional loans." },
     { l: "Cash to Close", v: fmt(calc.cashToClose), c: T.green, tip: "Total cash you need at closing = down payment + closing costs + prepaids – any credits (seller, lender, realtor)." }
    ]).map((m, i) => (
     <Card key={i} pad={14} style={{ minHeight: 92, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: T.textTertiary, marginBottom: 4, display: "flex", alignItems: "center" }}>{m.l}{m.tip && <InfoTip text={m.tip} />}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: m.c, fontFamily: FONT, letterSpacing: "-0.03em" }}>{m.v}</div>
      {m.s && <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>{m.s}</div>}
     </Card>
    ))}
   </div>
   {/* Payment Breakdown — banded header/footer matching CashToCloseSummary so
       the two cards read as a matched pair (per Christo). Body keeps the
       larger Inter font weights for the row values. Wrapped in the
       payment-breakdown guided anchor: step 9 pulses this card and asks the
       user to expand the Tax/PMI carets before the Continue chip appears. */}
   <div data-field="payment-breakdown" className={isPulse && isPulse("payment-breakdown")} style={{ borderRadius: 14, transition: "all 0.3s", marginBottom: 16 }}>
   <div style={{
     background: T.card,
     border: `1px solid ${T.cardBorder}`,
     borderRadius: 14,
     overflow: "hidden",
     marginBottom: 0,
     boxShadow: `0 0 0 1px ${T.blue}10`,
   }}>
    {/* Header band — same style as CashToCloseSummary */}
    <div style={{
      background: `linear-gradient(135deg, ${T.blue}18, ${T.blue}0c)`,
      borderBottom: `1px solid ${T.blue}38`,
      padding: "12px 18px",
    }}>
     <div style={{
       fontSize: 11,
       fontWeight: 700,
       color: T.blue,
       letterSpacing: "0.12em",
       textTransform: "uppercase",
       fontFamily: FONT,
     }}>
      Payment Breakdown
     </div>
    </div>
    {/* Body — keeps existing row styling per Christo */}
    <div style={{ padding: "12px 18px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
     {[
      // Principal & Interest merged into one PITI-style line; the volatile
      // month-1 P-vs-I split lives behind the "Split" chevron below. Donut
      // keeps its two separate segments (Christo, 2026-07-07).
      { label: "Principal & Interest", value: calc.pi || 0, color: T.blue, pi: true },
      ...(includeEscrow ? [
       { label: "Tax",       value: calc.monthlyTax || 0, color: T.orange, jumpTo: "tax" },
       { label: "Insurance", value: calc.ins || 0,        color: T.green,  editable: true, onChange: (v) => setAnnualIns(Math.max(0, v) * 12) },
      ] : []),
      ...((calc.monthlyMI || 0) > 0 ? [
       { label: loanType === "FHA" ? "MIP" : "PMI", value: calc.monthlyMI || 0, color: T.red, jumpTo: "pmi" },
      ] : []),
      // HOA: always render so it's discoverable as editable (was previously hidden when 0)
      { label: "HOA", value: hoa || 0, color: T.purple || T.blue, editable: true, onChange: setHoa },
     ].map((row, i) => {
      const isExpanded = (row.jumpTo === "tax" && propTaxExpanded) || (row.jumpTo === "pmi" && pmiExpanded) || (row.pi && piExpanded);
      const onToggle = row.jumpTo === "tax" ? toggleTaxInline : row.jumpTo === "pmi" ? togglePmiInline : row.pi ? togglePiInline : null;
      return (
      <React.Fragment key={i}>
       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
         <span style={{ width: 8, height: 8, borderRadius: 4, background: row.pi ? `linear-gradient(90deg, ${T.cyan || T.blue} 50%, ${T.blue} 50%)` : row.color, flexShrink: 0 }} />
         <span style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT }}>{row.label}</span>
         {onToggle && (
          <span
           onClick={onToggle}
           title={isExpanded ? "Hide breakdown" : `Show ${row.label} breakdown`}
           style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            cursor: "pointer",
            userSelect: "none",
            marginLeft: 2,
           }}
          >
           <span style={{ fontSize: 11, fontWeight: 600, color: T.blue, fontFamily: FONT }}>{row.pi ? "Split" : "How it's calculated"}</span>
           <span style={{
            fontSize: 10,
            color: T.blue,
            lineHeight: 1,
            transform: `translateY(-1px) rotate(${isExpanded ? 180 : 0}deg)`,
            transition: "transform 0.2s",
           }}>▾</span>
          </span>
         )}
        </div>
        {row.editable
         ? <InlineEditValue value={row.value} onChange={row.onChange} T={T} />
         : (
          <div style={{ display: "inline-flex", alignItems: "baseline", gap: 3 }}>
           <span style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: FONT }}>{fmt(row.value)}</span>
           <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT }}>/mo</span>
          </div>
         )
        }
       </div>

       {/* Inline Principal & Interest split — month-1 snapshot. The split
           shifts toward principal every payment, so it's labeled as the
           first payment and points at the full amortization schedule. */}
       {row.pi && piExpanded && (() => {
        const prin = calc.monthlyPrinReduction || 0;
        const intr = (calc.pi || 0) - prin;
        const subRow = (dot, label, val) => (
         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", minHeight: 22 }}>
          <span style={{ fontSize: 12, color: T.textSecondary, display: "inline-flex", alignItems: "center", gap: 6 }}>
           <span style={{ width: 8, height: 8, borderRadius: 4, background: dot, flexShrink: 0 }} />{label}
          </span>
          <div style={{ display: "inline-flex", alignItems: "baseline", gap: 3 }}>
           <span style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, color: T.text }}>{fmt(val)}</span>
           <span style={{ fontSize: 10, color: T.textTertiary, fontFamily: FONT }}>/mo</span>
          </div>
         </div>
        );
        return (
         <div style={{ marginLeft: 14, marginRight: 0, padding: "4px 0 8px" }}>
          <div style={{ background: T.bg, borderRadius: 12, padding: "8px 12px 10px" }}>
           {subRow(T.cyan || T.blue, "Principal", prin)}
           {subRow(T.blue, "Interest", intr)}
           <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 6, lineHeight: 1.4 }}>First payment. Each month a little more goes to principal and less to interest — see the full amortization schedule for the trend.</div>
          </div>
         </div>
        );
       })()}

       {/* Inline Tax breakdown — numbers edit right in the table behind mini
           locks (customize pills removed 2026-07-05, Christo). Base Rate and
           Exemption default LOCKED (auto-synced); Fixed Assessments is always
           editable. Click a lock to unlock and edit; click again to re-lock
           and snap back to the auto value. */}
       {row.jumpTo === "tax" && propTaxExpanded && (() => {
        const trStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${T.separator}`, minHeight: 22 };
        const labStyle = { fontSize: 12, color: T.textSecondary, display: "inline-flex", alignItems: "center", gap: 5 };
        const valStyle = { fontSize: 12, fontWeight: 500, fontFamily: FONT, color: T.text };
        const LockBtn = ({ locked, onClick }) => (
         <button onClick={onClick} title={locked ? "Unlock to edit" : "Lock to auto-sync"}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center" }}>
          <Icon name={locked ? "lock" : "unlock"} size={12} style={{ color: locked ? T.textTertiary : T.blue }} />
         </button>
        );
        const toggleRateLock = () => {
         if (taxRateLocked) {
          setTaxRateLocked(false);
          if (taxBaseRateOverride === 0) setTaxBaseRateOverride(parseFloat((taxAutoRate * 100).toFixed(4)));
         } else {
          setTaxRateLocked(true);
          const ar = propertyState === "California" ? (CITY_TAX_RATES[city] || 0.012) : propertyState === "Nevada" ? (NV_CITY_TAX_RATES[city] || STATE_PROPERTY_TAX_RATES["Nevada"] || 0.0102) : (STATE_PROPERTY_TAX_RATES[propertyState] || 0.0102);
          setTaxBaseRateOverride(parseFloat((ar * 100).toFixed(4)));
         }
        };
        const toggleExemptionLock = () => {
         if (taxExemptionLocked) {
          setTaxExemptionLocked(false);
          setTaxExemptionOverride(calc.exemption);
         } else {
          setTaxExemptionLocked(true);
          const ip = loanPurpose === "Purchase Primary" || loanPurpose === "Refi Rate/Term" || loanPurpose === "Refi Cash-Out";
          setTaxExemptionOverride(ip ? 7000 : 0);
         }
        };
        return (
        <div style={{ marginLeft: 14, marginRight: 0, padding: "4px 0 8px" }}>
         <div style={{ background: T.bg, borderRadius: 12, padding: "10px 12px" }}>
          <div style={trStyle}>
           <span style={labStyle}>Home Value</span>
           <span style={valStyle}>{fmt(salesPrice)}</span>
          </div>
          <div style={trStyle}>
           <span style={labStyle}>Exemption <LockBtn locked={taxExemptionLocked} onClick={toggleExemptionLock} /></span>
           {taxExemptionLocked
            ? <span style={valStyle}>{calc.exemption > 0 ? `-${fmt(calc.exemption)}` : "$0"}</span>
            : <MiniEdit value={taxExemptionOverride} onChange={setTaxExemptionOverride} prefix="$" T={T} />}
          </div>
          <div style={trStyle}>
           <span style={labStyle}>Taxable Value</span>
           <span style={valStyle}>{fmt(calc.taxableValue)}</span>
          </div>
          <div style={trStyle}>
           <span style={labStyle}>Base Rate ({taxCityLabel}) <LockBtn locked={taxRateLocked} onClick={toggleRateLock} /></span>
           {taxRateLocked
            ? <span style={valStyle}>{taxDisplayRate.toFixed(4)}%</span>
            : <MiniEdit value={taxBaseRateOverride} onChange={setTaxBaseRateOverride} suffix="%" T={T} />}
          </div>
          <div style={trStyle}>
           <span style={labStyle}>Base Tax</span>
           <span style={valStyle}>{fmt2(calc.baseTax)}</span>
          </div>
          <div style={trStyle}>
           <span style={labStyle}>Fixed Assessments <InfoTip text="Mello-Roos, bonds, parcel taxes. Check your county tax bill." /></span>
           <MiniEdit value={fixedAssessments} onChange={setFixedAssessments} prefix="$" suffix="/yr" T={T} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 2px", borderTop: `2px solid ${T.separator}`, marginTop: 2 }}>
           <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Annual Total</span>
           <span style={{ fontSize: 13, fontWeight: 700, fontFamily: FONT, color: T.text }}>{fmt2(calc.yearlyTax)}</span>
          </div>
          {calc.effectiveTaxRate > 0 && (
           <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 4 }}>Effective rate: {(calc.effectiveTaxRate * 100).toFixed(3)}%</div>
          )}
         </div>
         {taxAnyUnlocked && (
          <div style={{ textAlign: "center", marginTop: 6 }}>
           <span onClick={() => { setTaxRateLocked(true); setTaxExemptionLocked(true); setFixedAssessments(1500); const ar = propertyState === "California" ? (CITY_TAX_RATES[city] || 0.012) : propertyState === "Nevada" ? (NV_CITY_TAX_RATES[city] || STATE_PROPERTY_TAX_RATES["Nevada"] || 0.0102) : (STATE_PROPERTY_TAX_RATES[propertyState] || 0.0102); setTaxBaseRateOverride(parseFloat((ar * 100).toFixed(4))); const ip = loanPurpose === "Purchase Primary" || loanPurpose === "Refi Rate/Term" || loanPurpose === "Refi Cash-Out"; setTaxExemptionOverride(ip ? 7000 : 0); setPropTaxCustomize(false); }}
            style={{ fontSize: 11, color: T.textTertiary, cursor: "pointer", textDecoration: "underline" }}>Reset to auto</span>
          </div>
         )}
        </div>
        );
       })()}

       {/* Inline PMI breakdown */}
       {row.jumpTo === "pmi" && pmiExpanded && (
        <div style={{ marginLeft: 14, marginRight: 0, padding: "4px 0 8px" }}>
         {/* Inner duplicate "How this is calculated" toggle removed 2026-07-05 */}
         <div style={{ background: T.bg, borderRadius: 12, padding: "10px 12px" }}>
          {miZeroReason && (
           <div style={{ fontSize: 11, color: T.green, background: `${T.green}10`, borderRadius: 8, padding: "8px 10px", marginBottom: 10, lineHeight: 1.4 }}>
            {miZeroReason}
           </div>
          )}
          {loanType === "FHA" ? [
           ["Home Value",       fmt(salesPrice)],
           ["Base Loan Amount", fmt(calc.baseLoan)],
           ["LTV",              pct(calc.ltv, 1)],
           ["FHA MIP Rate",     `${((calc.fhaMipRate || 0) * 100).toFixed(3)}%`],
           ["Annual MIP",       fmt(monthlyMI * 12)],
          ].map(([label, value], k) => (
           <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.separator}` }}>
            <span style={{ fontSize: 12, color: T.textSecondary }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 500, fontFamily: FONT, color: T.text }}>{value}</span>
           </div>
          )) : (() => {
           // ── Conventional PMI: rate row edits inline behind a mini lock (same
           //    pattern as the tax breakdown), plus an LO-editable rate chart. ──
           const trStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${T.separator}`, minHeight: 22 };
           const labStyle = { fontSize: 12, color: T.textSecondary, display: "inline-flex", alignItems: "center", gap: 5 };
           const valStyle = { fontSize: 12, fontWeight: 500, fontFamily: FONT, color: T.text };
           const togglePmiLock = () => {
            if (pmiRateLocked) {
             setPmiRateLocked(false);
             if (pmiRateOverride === 0) setPmiRateOverride(parseFloat(((calc.pmiRate || calc.autoPmiRate || 0) * 100).toFixed(3)));
            } else {
             setPmiRateLocked(true);
             setPmiRateOverride(0); // snap back to the matrix/chart rate
            }
           };
           return (
            <>
             {[["Home Value", fmt(salesPrice)],
               ["Loan Amount", fmt(calc.baseLoan || calc.loan)],
               ["LTV", pct(calc.ltv, 1)],
               ["Credit Score", creditScore > 0 ? String(creditScore) : "—"],
             ].map(([label, value], k) => (
              <div key={k} style={trStyle}>
               <span style={labStyle}>{label}</span>
               <span style={valStyle}>{value}</span>
              </div>
             ))}
             <div style={trStyle}>
              <span style={labStyle}>
               PMI Rate ({pmiRateLocked ? "Radian matrix" : "custom"})
               <button onClick={togglePmiLock} title={pmiRateLocked ? "Unlock to edit" : "Lock to auto-sync"}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center" }}>
                <Icon name={pmiRateLocked ? "lock" : "unlock"} size={12} style={{ color: pmiRateLocked ? T.textTertiary : T.blue }} />
               </button>
              </span>
              {pmiRateLocked
               ? <span style={valStyle}>{((calc.pmiRate || 0) * 100).toFixed(3)}%</span>
               : <MiniEdit value={pmiRateOverride} onChange={setPmiRateOverride} suffix="%" T={T} />}
             </div>
             <div style={trStyle}>
              <span style={labStyle}>Annual Premium</span>
              <span style={valStyle}>{fmt(monthlyMI * 12)}</span>
             </div>
            </>
           );
          })()}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 2px", borderTop: `2px solid ${T.separator}`, marginTop: 2 }}>
           <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Monthly Premium</span>
           <span style={{ fontSize: 13, fontWeight: 700, fontFamily: FONT, color: T.text }}>{fmt(monthlyMI)}</span>
          </div>
          {/* ── Advanced: PMI rate chart for the current FICO band. Rows mirror
              Christo's client spreadsheet (down-payment scenarios at this price).
              Rates are LO-editable inline; an edited rate overrides the Radian
              matrix for that LTV bucket scenario-wide. ── */}
          {loanType !== "FHA" && (() => {
           const score = creditScore || 700;
           const ficoBand = score >= 760 ? "760+" : score >= 740 ? "740–759" : score >= 720 ? "720–739" : score >= 700 ? "700–719" : score >= 680 ? "680–699" : score >= 660 ? "660–679" : score >= 640 ? "640–659" : "620–639";
           const buckets = [
            { down: 3,  ltv: 0.97, key: 97 },
            { down: 5,  ltv: 0.95, key: 95 },
            { down: 10, ltv: 0.90, key: 90 },
            { down: 15, ltv: 0.85, key: 85 },
           ];
           const curLtvPct = (calc.ltv || 0) * 100;
           const curKey = curLtvPct > 95 ? 97 : curLtvPct > 90 ? 95 : curLtvPct > 85 ? 90 : 85;
           const anyOverride = buckets.some(b => (pmiChartOverrides || {})[b.key] > 0);
           const cellL = { fontSize: 11, color: T.textSecondary, fontFamily: FONT };
           const cellV = { fontSize: 11, fontWeight: 600, fontFamily: FONT, color: T.text, textAlign: "right" };
           return (
            <div style={{ marginTop: 8 }}>
             <div onClick={() => setPmiChartOpen(!pmiChartOpen)} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", userSelect: "none" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.blue, fontFamily: FONT }}>Advanced: PMI rate chart (FICO {ficoBand})</span>
              <span style={{ fontSize: 10, color: T.blue, transition: "transform 0.2s", transform: `rotate(${pmiChartOpen ? 180 : 0}deg)` }}>▾</span>
             </div>
             {pmiChartOpen && (
              <div style={{ marginTop: 6, border: `1px solid ${T.separator}`, borderRadius: 10, padding: "6px 10px" }}>
               <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1.4fr 1.2fr", gap: 6, padding: "3px 0", borderBottom: `1px solid ${T.separator}` }}>
                {["Down", "PMI (%)", "Loan Amt", "PMI ($/mo)"].map((h, i) => (
                 <span key={h} style={{ fontSize: 9.5, fontWeight: 700, color: T.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: FONT, textAlign: i === 0 ? "left" : "right" }}>{h}</span>
                ))}
               </div>
               {buckets.map((b) => {
                const override = (pmiChartOverrides || {})[b.key] || 0;
                const basePct = parseFloat((getPMIRate(b.ltv, score) * 100).toFixed(3));
                const pctVal = override > 0 ? override : basePct;
                const loanAmt = salesPrice * (1 - b.down / 100);
                const monthly = (loanAmt * (pctVal / 100)) / 12;
                const isCur = b.key === curKey;
                return (
                 <div key={b.key} style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1.4fr 1.2fr", gap: 6, alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${T.separator}`, background: isCur ? `${T.blue}0A` : "transparent", borderRadius: 6 }}>
                  <span style={{ ...cellL, fontWeight: isCur ? 700 : 500, color: isCur ? T.blue : T.textSecondary }}>{b.down}%{isCur ? " ◂" : ""}</span>
                  <span style={{ display: "inline-flex", justifyContent: "flex-end" }}>
                   <MiniEdit value={pctVal} onChange={(v) => setPmiChartOverrides({ ...(pmiChartOverrides || {}), [b.key]: v })} suffix="%" T={T} width={56} />
                  </span>
                  <span style={cellV}>{fmt(loanAmt)}</span>
                  <span style={cellV}>{fmt(monthly)}</span>
                 </div>
                );
               })}
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 5 }}>
                <span style={{ fontSize: 9.5, color: T.textTertiary, fontFamily: FONT }}>Edited rates override the Radian matrix for that LTV bucket.</span>
                {anyOverride && (
                 <span onClick={() => setPmiChartOverrides({})} style={{ fontSize: 10, color: T.textTertiary, cursor: "pointer", textDecoration: "underline", fontFamily: FONT }}>Reset chart</span>
                )}
               </div>
              </div>
             )}
            </div>
           );
          })()}
          <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 8, lineHeight: 1.5 }}>
           {loanType === "FHA"
            ? "FHA charges MIP on every loan regardless of down payment. The annual rate is set by base loan amount and LTV (HUD schedule, eff. 3/1/2023): base loan over $726,200 → 0.70–0.75%, at or below → 0.50–0.55%. MIP runs the life of the loan unless LTV is 90% or below at origination (then 11 years). A 1.75% upfront MIP also applies, financed into the loan."
            : "PMI required when LTV > 80%. Auto-cancels at 78% LTV (lender-initiated) or request removal at 80%. Rate from Radian matrix by LTV bucket and FICO score."}
          </div>
         </div>
        </div>
       )}
      </React.Fragment>
      );
     })}
     {/* ── Temporary buydown (B2) — expandable row, same chevron pattern as
         the P&I/Tax/PMI rows above. Cash-flow subsidy only: qualification
         (DTI) stays at the NOTE rate, and the cost is a seller/lender-credit
         data point — NOT deducted from cash-to-close here (noted in the
         caption below so nothing moves silently). Hidden when loan/term are
         empty, matching the sibling-row guards. */}
     {showBuydownRow && (() => {
      const bd = calc.buydown;
      const noteYear = bd ? bd.years.length + 1 : 0;
      const clamped = bd && bd.years.some(y => y.rate === 0);
      const cellHead = { fontSize: 9.5, fontWeight: 700, color: T.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: FONT, textAlign: "right" };
      const cellVal = { fontSize: 12, fontWeight: 600, fontFamily: FONT, color: T.text, textAlign: "right" };
      return (
      <React.Fragment>
       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
         <span style={{ width: 8, height: 8, borderRadius: 4, background: buydownType !== "none" ? T.accent : T.textTertiary, flexShrink: 0 }} />
         <span style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT }}>Temporary buydown</span>
         <span
          onClick={() => setBuydownExpanded(!buydownExpanded)}
          title={buydownExpanded ? "Hide buydown" : "Set up a temporary buydown"}
          style={{ display: "inline-flex", alignItems: "center", gap: 3, cursor: "pointer", userSelect: "none", marginLeft: 2 }}
         >
          <span style={{ fontSize: 11, fontWeight: 600, color: T.blue, fontFamily: FONT }}>{buydownType === "none" ? "Set up" : "Details"}</span>
          <span style={{
           fontSize: 10,
           color: T.blue,
           lineHeight: 1,
           transform: `translateY(-1px) rotate(${buydownExpanded ? 180 : 0}deg)`,
           transition: "transform 0.2s",
          }}>▾</span>
         </span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: buydownType === "none" ? T.textTertiary : T.text, fontFamily: FONT }}>
         {buydownType === "none" ? "None" : buydownType}
        </span>
       </div>
       {buydownExpanded && (
        <div style={{ marginLeft: 14, marginRight: 0, padding: "4px 0 8px" }}>
         <div style={{ background: T.bg, borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
           <Sel sm label="Buydown" value={buydownType} onChange={setBuydownType}
            options={[{ value: "none", label: "None" }, { value: "1-0", label: "1-0" }, { value: "2-1", label: "2-1" }, { value: "3-2-1", label: "3-2-1" }]} />
           <Sel sm label="Paid By" value={buydownPaidBy} onChange={setBuydownPaidBy}
            options={[{ value: "seller", label: "Seller" }, { value: "lender", label: "Lender" }, { value: "borrower", label: "Borrower" }]} />
          </div>
          {bd && (
           <>
            {clamped && (
             <div style={{ fontSize: 11, color: T.orange, background: `${T.orange}12`, borderRadius: 8, padding: "8px 10px", marginBottom: 8, lineHeight: 1.4, fontFamily: FONT }}>
              The note rate is lower than the buydown reduction — early-year rates are clamped at 0%. Double-check this structure with the lender.
             </div>
            )}
            {/* Year table — dense data, solid card (not glass) */}
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: "8px 12px" }}>
             <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 1fr 1.2fr", gap: 6, padding: "3px 0", borderBottom: `1px solid ${T.separator}` }}>
              <span style={{ ...cellHead, textAlign: "left" }}>Year</span>
              <span style={cellHead}>Rate</span>
              <span style={cellHead}>P&amp;I</span>
              <span style={cellHead}>Savings/mo</span>
             </div>
             {bd.years.map((y) => (
              <div key={y.year} style={{ display: "grid", gridTemplateColumns: "56px 1fr 1fr 1.2fr", gap: 6, alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${T.separator}` }}>
               <span style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, fontFamily: FONT }}>{y.year}</span>
               <span style={cellVal}>{y.rate.toFixed(3)}%</span>
               <span style={cellVal}>{fmt(y.pi)}</span>
               <span style={{ ...cellVal, color: T.green }}>{fmt(y.monthlySavings)}</span>
              </div>
             ))}
             {/* Note-rate row — the payment for the rest of the term */}
             <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 1fr 1.2fr", gap: 6, alignItems: "center", padding: "5px 0" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, fontFamily: FONT }}>{noteYear}+</span>
              <span style={cellVal}>{Number(rate).toFixed(3)}%</span>
              <span style={cellVal}>{fmt(bd.notePI)}</span>
              <span style={{ ...cellVal, color: T.textTertiary, fontWeight: 500 }}>—</span>
             </div>
            </div>
            {/* Total cost callout */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 2px 2px" }}>
             <span style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: FONT }}>Total buydown cost</span>
             <span style={{ fontSize: 16, fontWeight: 800, color: T.accent, fontFamily: FONT, letterSpacing: "-0.01em" }}>{fmt2(bd.totalCost)}</span>
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, lineHeight: 1.5, fontFamily: FONT }}>
             {buydownPaidBy === "borrower"
              ? "Paid by the borrower at closing. Qualification uses the note rate."
              : `Typically funded by a ${buydownPaidBy} credit at closing. Qualification uses the note rate.`}
             {" "}Shown for planning — not deducted from cash to close here.
            </div>
           </>
          )}
         </div>
        </div>
       )}
      </React.Fragment>
      );
     })()}
     {/* Pad to a fixed 5 rows so the Payment Breakdown card is always the same
         height as the Cash-to-Close Summary (empty slots where Tax/Ins/PMI
         would be), keeping the two cards + their footers on the same line. */}
     {(() => { const n = 1 + (includeEscrow ? 2 : 0) + ((calc.monthlyMI || 0) > 0 ? 1 : 0) + 1 + (showBuydownRow ? 1 : 0); return Array.from({ length: Math.max(0, 5 - n) }).map((_, i) => <div key={"pbpad" + i} aria-hidden="true" style={{ minHeight: 28 }} />); })()}
     {!includeEscrow && (
      <div style={{ fontSize: 10, color: T.textTertiary, textAlign: "center" }}>
       Escrow excluded — full PITI would be {fmt(calc.housingPayment)}/mo
      </div>
     )}
    </div>
    {/* Total Payment band — mirrors CashToCloseSummary's bottom band */}
    <div style={{
      background: `${T.blue}0E`,
      borderTop: `1.5px solid ${T.blue}40`,
      padding: "16px 18px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}>
     <div style={{
       fontSize: 12,
       fontWeight: 700,
       color: T.blue,
       letterSpacing: "0.08em",
       textTransform: "uppercase",
       fontFamily: FONT,
     }}>
      Total Payment
     </div>
     <div style={{
       fontFamily: FONT,
       fontSize: 22,
       fontWeight: 800,
       color: T.blue,
       letterSpacing: "-0.02em",
     }}>{fmt(calc.displayPayment)}/mo</div>
    </div>
   </div>
   {(() => {
     // Guided step 9 gate: Tax caret must be expanded (when escrow shown) and
     // the PMI caret too when PMI applies. Carets share toggles above.
     const breakdownExplored = (!includeEscrow || propTaxExpanded) && ((calc.monthlyMI || 0) === 0 || pmiExpanded);
     return (<>
       {isPulse && isPulse("payment-breakdown") && !breakdownExplored && (
         <div style={{ marginTop: 10, fontSize: 12, color: T.textSecondary, fontFamily: FONT, textAlign: "center" }}>
           Tap the ▾ next to Tax{(calc.monthlyMI || 0) > 0 ? " and PMI" : ""} above to see how they're calculated
         </div>
       )}
     </>);
   })()}
   </div>
   </div>
  </div>
  {/* ========== END LEFT COLUMN ========== */}

  {/* ========== RIGHT COLUMN ========== */}
  <div style={isDesktop ? { display: "flex", flexDirection: "column" } : {}}>
   {/* The 3-stat row (Loan Amount / LTV / Cash to Close) was moved to the
       LEFT column under the donut legend per the 2026-05-02 final layout.
       The right column now leads with Rate / Live Rates → 4 loan-structure
       pills (2x2) → 5-pillar qualification → CashToCloseSummary. */}

   {/* Rate / APR + always-visible Live Rates grid — TOP of the right column
       per the 2026-05-02 final layout. Brokers tune the rate first; the 4
       loan-structure pills (occupancy/property type/loan type/term) sit
       directly below so changes flow naturally into the rate context. */}
   <Card style={{ marginBottom: 12 }}>
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 10 }}>
     <div style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
       <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>
        {isRefi ? "New Rate" : "Rate"}<span style={{ color: T.red, marginLeft: 3, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>*</span>
        <InfoTip text="Your annual interest rate. Depends on loan type, FICO, down payment %, loan amount, property type, and market conditions." />
       </div>
       {isRefi && refiCurrentRate > 0 && <span style={{ marginLeft: "auto", fontSize: 11, color: T.textTertiary }}>Current: {refiCurrentRate}%</span>}
      </div>
      <Inp value={rate} onChange={setRate} prefix="" suffix="%" step={0.001} max={30} sm req />
     </div>
     {!isRefi && calc.apr > 0 && calc.apr !== rate && (
      <div style={{ flex: 1, marginBottom: 2 }}>
       <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>APR</span>
        <InfoTip text={`APR (${calc.apr.toFixed(3)}%) reflects the true cost of borrowing including fees. Finance charges: ${fmt(calc.aprFinanceCharges)} (origination ${fmt(underwritingFee + processingFee)}, points ${fmt(calc.pointsCost)}${calc.fhaUp > 0 ? ", UFMIP " + fmt(calc.fhaUp) : ""}${calc.vaFundingFee > 0 ? ", VA FF " + fmt(calc.vaFundingFee) : ""}).`} />
       </div>
       <div style={{ background: T.bgAccent, borderRadius: 12, padding: "10px 14px", fontSize: 18, fontWeight: 700, color: T.blue, fontFamily: FONT, textAlign: "center", border: `1px solid ${T.border}` }}>{calc.apr.toFixed(3)}%</div>
      </div>
     )}
    </div>
    {isRefi && refiCurrentRate > 0 && rate > 0 && rate < refiCurrentRate && (
     <div style={{ fontSize: 11, color: T.green, fontWeight: 600, marginTop: -6, marginBottom: 8 }}>↓ {(refiCurrentRate - rate).toFixed(3)}% rate drop</div>
    )}
    {isRefi && refiCurrentRate > 0 && rate > 0 && rate >= refiCurrentRate && (
     <div style={{ fontSize: 11, color: T.orange, fontWeight: 600, marginTop: -6, marginBottom: 8 }}>⚠ New rate is {rate > refiCurrentRate ? "higher than" : "same as"} current ({refiCurrentRate}%)</div>
    )}

    {/* Live Rates fetch button — full-width pill */}
    <div data-field="get-rates" className={isPulse && isPulse("get-rates")} style={{ borderRadius: 12, transition: "all 0.3s" }}>
    <button onClick={() => { markTouched && markTouched("get-rates"); fetchRates(); }} disabled={ratesLoading} style={{ width: "100%", background: `${T.blue}${liveRates ? '18' : '10'}`, border: `1px solid ${T.blue}33`, borderRadius: 12, padding: "10px 14px", cursor: ratesLoading ? "wait" : "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
     <span style={{ fontSize: 13, fontWeight: 600, color: T.blue, fontFamily: FONT }}>
      {ratesLoading ? "Fetching rates..." : liveRates ? "✓ Live Rates Applied" : "◉ Get Today's Rates"}
     </span>
     {liveRates && <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT }}>{liveRates.date || "Today"}</span>}
     {!liveRates && !ratesLoading && fredApiKey && <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT }}>FRED</span>}
    </button>
    </div>{/* end get-rates anchor */}
    {ratesError && <div style={{ fontSize: 11, color: T.red, marginBottom: 10, wordBreak: "break-all", lineHeight: 1.4, padding: 10, background: T.errorBg, borderRadius: 8 }}>{ratesError}</div>}

    {/* Always-visible 6-tile rate grid (only when liveRates loaded) */}
    {liveRates && (<>
     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 4 }}>
      {[["30yr", liveRates["30yr_fixed"]], ["15yr", liveRates["15yr_fixed"]], ["FHA", liveRates["30yr_fha"]],
       ["VA", liveRates["30yr_va"]], ["Jumbo", liveRates["30yr_jumbo"]], ["5/1 ARM", liveRates["5yr_arm"]]
      ].filter(([, v]) => v).map(([label, r], i) => {
       const isActive = (label === "30yr" && (loanType === "Conventional" || loanType === "USDA") && term === 30) ||
        (label === "15yr" && loanType === "Conventional" && term === 15) ||
        (label === "FHA" && loanType === "FHA") ||
        (label === "VA" && loanType === "VA") ||
        (label === "Jumbo" && loanType === "Jumbo");
       return (
        <div key={i} onClick={() => setRate(r)} style={{ background: isActive ? `${T.blue}20` : T.inputBg, border: isActive ? `1px solid ${T.blue}55` : `1px solid transparent`, borderRadius: 10, padding: "8px 10px", cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}>
         <div style={{ fontSize: 10, color: T.textTertiary, fontWeight: 600, marginBottom: 2 }}>{label}</div>
         <div style={{ fontSize: 15, fontWeight: 700, color: isActive ? T.blue : T.text, fontFamily: FONT }}>{r}%</div>
        </div>
       );
      })}
     </div>
     {liveRates.source && <div style={{ fontSize: 10, color: T.textTertiary, textAlign: "center", marginTop: 4 }}>Source: {liveRates.source}</div>}
    </>)}
   </Card>

   {/* Bottom block — 4-pill 2x2 grid + 5-pillar row + Cash-to-Close Summary
       stacked together with marginTop:auto so the whole group sticks to the
       bottom of the RIGHT column. Whitespace fills the gap between the Rate
       card and the 4-pill grid. The 5-pillar row aligns with the 3-stat row
       in the LEFT column (both sit directly above their respective bottom
       summary cards: Payment Breakdown on the left, CTC on the right). */}
   <div style={isDesktop ? { marginTop: "auto", display: "flex", flexDirection: "column" } : {}}>
   {/* 4 loan-structure pills — Occupancy / Property Type / Loan Type / Term */}
   <div data-field="calc-pills" className={isPulse && isPulse("calc-pills")} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12, borderRadius: 12, transition: "all 0.3s", background: T.card, border: `1px solid ${T.cardBorder}`, padding: 12, boxShadow: T.cardShadow }}>
    <Sel label="Occupancy" value={loanPurpose} onChange={v => {
     // Preserve investment rate auto-adjustment (+1%) from the original Occupancy dropdown
     if (v === "Purchase Investment" && loanPurpose !== "Purchase Investment") {
      setRate(prev => Math.round((prev + 1.0) * 1000) / 1000);
     } else if (v !== "Purchase Investment" && loanPurpose === "Purchase Investment") {
      setRate(prev => Math.round(Math.max(0, prev - 1.0) * 1000) / 1000);
     }
     setLoanPurpose(v);
    }} options={isRefi
     ? [{value:"Refi Rate/Term",label:"Primary (R/T)"},{value:"Refi Cash-Out",label:"Primary (Cash-Out)"}]
     : [{value:"Purchase Primary",label:"Primary"},{value:"Purchase 2nd Home",label:"Second Home"},{value:"Purchase Investment",label:"Investment"}]
    } req />
    <div data-field="calc-proptype" className={isPulse && isPulse("calc-proptype")} onClick={() => markTouched && markTouched("calc-proptype")}>
     <Sel label="Property Type" value={propType} onChange={setPropType} options={PROP_TYPES} req />
    </div>
    <Sel label="Loan Type" value={loanType} onChange={v => { setLoanType(v); userLoanTypeRef.current = v; setAutoJumboSwitch(false); }} options={LOAN_TYPES} req />
    <div data-field="calc-term" className={isPulse && isPulse("calc-term")} onClick={() => { markTouched && markTouched("calc-term"); markTouched && markTouched("calc-loantype"); }}>
     <Sel label="Term" value={term} onChange={v => setTerm(parseInt(v))} options={Array.from({length: 26}, (_, i) => ({value: 30 - i, label: `${30 - i} Year${30 - i === 1 ? "" : "s"}`}))} req />
    </div>
   </div>
   <ClusterContinue stepId="calc-pills" />

   {/* Compact 5-pillar row — sits BELOW the loan-structure pills and ABOVE
       the Cash to Close Summary. 28px circles, click to jump to the matching
       Qualify section. Unchanged from prior version; only its position in
       the right-column flow moved. */}
   {(() => {
    const compactChecks = isRefi ? [
     { label: "FICO",     ok: calc.ficoCheck === "Good!" ? true : calc.ficoCheck === "—" ? null : false, sub: creditScore > 0 ? `${creditScore}/${calc.ficoMin}+` : "—" },
     { label: "DTI",      ok: calc.dtiCheck === "Good!" ? true : calc.dtiCheck === "—" ? null : false,   sub: calc.qualifyingIncome > 0 ? `${pct(calc.yourDTI, 1)}/${pct(calc.maxDTI, 0)}` : "—" },
     { label: "LTV",      ok: refiLtvCheck === "Good!" ? true : refiLtvCheck === "—" ? null : false,     sub: calc.refiNewLTV > 0 ? `${pct(calc.refiNewLTV, 0)}/${refiPurpose === "Cash-Out" ? "80%" : "95%"}` : "—" },
    ] : [
     { label: "FICO",     ok: calc.ficoCheck === "Good!" ? true : calc.ficoCheck === "—" ? null : false, sub: creditScore > 0 ? `${creditScore}/${calc.ficoMin}+` : "—" },
     { label: "Down",     ok: calc.dpWarning === null ? true : false,                                    sub: `${downPct}%/${calc.minDPpct}%+` },
     { label: "DTI",      ok: calc.dtiCheck === "Good!" ? true : calc.dtiCheck === "—" ? null : false,   sub: calc.qualifyingIncome > 0 ? `${pct(calc.yourDTI, 1)}/${pct(calc.maxDTI, 0)}` : "—" },
     { label: "Cash",     ok: calc.cashCheck === "Good!" ? true : calc.cashCheck === "—" ? null : false, sub: calc.totalForClosing > 0 ? fmt(calc.totalForClosing) : "—" },
     { label: "Reserves", ok: calc.resCheck  === "Good!" ? true : calc.resCheck  === "—" ? null : false, sub: calc.totalReserves > 0 ? fmt(calc.totalReserves) : "—" },
    ];
    return (
     <div style={{ display: "grid", gridTemplateColumns: `repeat(${compactChecks.length}, 1fr)`, gap: 6, marginBottom: 12 }}>
      {compactChecks.map((c, i) => {
       const color = c.ok === true ? T.green : c.ok === null ? T.textTertiary : T.red;
       const bg = c.ok === true ? `${T.green}15` : c.ok === null ? T.pillBg : `${T.red}12`;
       return (
        <div
         key={i}
         onClick={() => handlePillarClick && handlePillarClick(c.label)}
         title={`${c.label}: ${c.sub} — click for details`}
         style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "12px 4px", minHeight: 92, background: bg, borderRadius: 12,
          cursor: "pointer", transition: "all 0.2s",
         }}
        >
         <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: c.ok === true ? T.green : c.ok === null ? T.ringTrack : T.red,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 14, fontWeight: 800, marginBottom: 6,
         }}>
          {c.ok === true ? "✓" : c.ok === null ? "?" : "✗"}
         </div>
         <div style={{ fontSize: 10, fontWeight: 700, color, fontFamily: FONT, lineHeight: 1 }}>{c.label}</div>
         <div style={{ fontSize: 9, color: T.textTertiary, marginTop: 3, fontFamily: FONT, lineHeight: 1.2, textAlign: "center" }}>{c.sub}</div>
        </div>
       );
      })}
     </div>
    );
   })()}

   {/* Cash To Close Summary — shared component, last card in the right
       bottom block. The whole bottom block (4-pill grid + 5-pillar row +
       this CTC) carries marginTop:auto on its wrapper above. */}
   <CashToCloseSummary
    T={T}
    ACCENT={T.blue}
    fmt={fmt}
    downPayment={calc.dp || 0}
    closingCosts={calc.totalClosingCosts || 0}
    prepaids={calc.totalPrepaidExp || 0}
    payoffs={0}
    credits={calc.totalCredits || 0}
    isRefi={isRefi}
   />
   </div>
   {/* ========== END right-column bottom block (4-pill + 5-pillar + CTC) ========== */}
  </div>
  {/* ========== END RIGHT COLUMN ========== */}

 </div>
 {/* End Row 3 */}

 {/* Investment / multi-unit rental income block (preserved from original) */}
 {(loanPurpose === "Purchase Investment" || (loanPurpose === "Purchase Primary" && (UNIT_COUNT[propType] || 1) > 1)) && (
  <div style={{ marginBottom: 16 }}>
   <Inp label={loanPurpose === "Purchase Investment" ? "Expected Monthly Rent" : `Non-Occupying Unit Rent (${(UNIT_COUNT[propType] || 1) - 1} unit${(UNIT_COUNT[propType] || 1) - 1 > 1 ? "s" : ""})`}
    value={subjectRentalIncome} onChange={setSubjectRentalIncome} prefix="$" suffix="/mo" max={50000}
    tip={loanPurpose === "Purchase Investment"
     ? "Expected gross monthly rent. Lenders use 75% of this to offset your PITIA (housing payment) for DTI qualification. If 75% of rent exceeds PITIA, the excess counts as income."
     : `Total rent from the ${(UNIT_COUNT[propType] || 1) - 1} unit${(UNIT_COUNT[propType] || 1) - 1 > 1 ? "s" : ""} you won't live in. Lenders add 75% of this as qualifying income on top of your regular employment income.`
    } />
   {subjectRentalIncome > 0 && (
    <div style={{ background: `${T.green}08`, borderRadius: 10, padding: "10px 14px", marginTop: -4, border: `1px solid ${T.green}18` }}>
     {loanPurpose === "Purchase Investment" ? (
      <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6 }}>
       <strong style={{ color: T.green }}>75% of rent: {fmt(subjectRentalIncome * 0.75)}/mo</strong>
       {calc.subjectRent75 >= calc.housingPayment
        ? <span> — exceeds PITIA ({fmt(calc.housingPayment)}). Net <strong style={{ color: T.green }}>{fmt(calc.subjectRent75 - calc.housingPayment)}</strong> added as qualifying income.</span>
        : <span> — offsets PITIA ({fmt(calc.housingPayment)}) by {fmt(calc.subjectRent75)}. Net housing cost for DTI: <strong>{fmt(calc.effectiveHousingForDTI)}/mo</strong></span>
       }
      </div>
     ) : (
      <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6 }}>
       <strong style={{ color: T.green }}>75% of rent: {fmt(subjectRentalIncome * 0.75)}/mo added as qualifying income</strong>
       <span> — your total qualifying income becomes <strong>{fmt(calc.qualifyingIncome)}/mo</strong></span>
      </div>
     )}
    </div>
   )}
  </div>
 )}

 {/* State / City for property tax are set on the Setup tab — removed from Monthly Payment (redundant). */}

 {/* Row 4 (Tax + PMI standalone pill cards) deleted — content renders inline in Payment Breakdown above. */}

 {/* Row 5 (Insurance + HOA pills) removed — now inline-editable in the Payment Breakdown card above. */}

 <GuidedNextButton />
</>);
}
