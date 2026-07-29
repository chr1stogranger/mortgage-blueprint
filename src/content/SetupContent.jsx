import { FONT, MONO } from "../lib/fonts.js";
import React, { useState } from "react";
import { devCheckProps } from "../lib/devPropCheck.js";


/**
 * YesNoSeg — light-blue segmented Yes/No selector matching the
 * Quick Start "Experience Level" / "Transaction Type" pills.
 * value = true | false | null. Both sides use the indigo tint when
 * selected (NOT green / NOT a toggle slider).
 */
function YesNoSeg({ T, value, onYes, onNo }) {
  const baseBtn = (active) => ({
    padding: "5px 18px",
    background: active ? `${T.blue}22` : T.inputBg,
    border: active ? `2px solid ${T.blue}` : `1px solid ${T.separator}`,
    borderRadius: 8,
    color: active ? T.blue : T.textSecondary,
    fontWeight: 600,
    fontSize: 11,
    cursor: "pointer",
    fontFamily: FONT,
    minWidth: 48,
    transition: "all 0.2s",
  });
  return (
    <div
      style={{ display: "flex", gap: 4, flexShrink: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" onClick={onYes} style={baseBtn(value === true)}>Yes</button>
      <button type="button" onClick={onNo} style={baseBtn(value === false)}>No</button>
    </div>
  );
}

export default function SetupContent(props) {
  // Dev-only guard for curated-props drift (see src/lib/devPropCheck.js).
  if (import.meta.env.DEV) devCheckProps("SetupContent", props, ["T", "isRefi", "setIsRefi", "salesPrice", "setSalesPrice", "downPct", "setDownPct", "downMode", "setDownMode", "loanType", "setLoanType", "propertyState", "setPropertyState", "propertyCounty", "setPropertyCounty", "city", "setCity", "propertyZip", "setPropertyZip", "propertyAddress", "setPropertyAddress", "setPropertyTBD", "addressInput", "setAddressInput", "AddressAutocomplete", "annualIns", "setAnnualIns", "hoa", "setHoa", "rate", "setRate", "term", "setTerm", "creditScore", "setCreditScore", "married", "setMarried", "firstTimeBuyer", "setFirstTimeBuyer", "refiPurpose", "setRefiPurpose", "taxState", "scenarioName", "ownsProperties", "setOwnsProperties", "hasSellProperty", "setHasSellProperty", "showInvestor", "setShowInvestor", "showRentVsBuy", "setShowRentVsBuy", "showProp19", "setShowProp19", "skillLevel", "onToggleSkillLevel", "Inp", "Sel", "SearchSelect", "Note", "Hero", "Card", "InfoTip", "gameMode", "TAB_PROGRESSION", "completedTabs", "isTabFieldsComplete", "markTouched", "isPulse", "calc", "fmt", "CITY_NAMES", "STATE_NAMES_PROP", "STATE_CITIES", "SKILL_PRESETS", "FILING_STATUSES", "showCompareHint", "setShowCompareHint", "setTab", "scenarioList", "isDesktop", "darkMode", "propTaxMode", "getTTCitiesForState", "getTTForCity", "COUNTY_AMI", "lookupZip", "Icon", "TextInp", "FieldLabel", "Sec", "GuidedNextButton", "ClusterContinue", "refiCurrentLoanType", "setRefiCurrentLoanType", "refiCurrentRateType", "setRefiCurrentRateType", "refiArmStartRate", "setRefiArmStartRate", "refiArmAdjustedDate", "setRefiArmAdjustedDate", "refiLastPaymentDate", "setRefiLastPaymentDate", "refiClosingPmtOverride", "setRefiClosingPmtOverride", "closingMonth", "setClosingMonth", "closingDay", "setClosingDay", "closingYear", "setClosingYear", "refiOriginalAmount", "setRefiOriginalAmount", "refiOriginalTerm", "setRefiOriginalTerm", "refiCurrentRate", "setRefiCurrentRate", "refiClosedDate", "setRefiClosedDate", "refiCurrentBalance", "setRefiCurrentBalance", "refiRemainingMonths", "setRefiRemainingMonths", "refiCurrentPayment", "setRefiCurrentPayment", "refiCurPrinOverride", "setRefiCurPrinOverride", "refiCurIntOverride", "setRefiCurIntOverride", "refiHasStatement", "setRefiHasStatement", "refiEscrowMode", "setRefiEscrowMode", "refiEscrowCombined", "setRefiEscrowCombined", "refiEscrowCombinedPeriod", "setRefiEscrowCombinedPeriod", "refiSecondLien", "setRefiSecondLien", "refiSecondKind", "setRefiSecondKind", "refiSecondBalance", "setRefiSecondBalance", "refiSecondRate", "setRefiSecondRate", "refiSecondPlan", "setRefiSecondPlan", "refiModified", "setRefiModified", "refiPrepayPenalty", "setRefiPrepayPenalty", "refiExtraCadence", "setRefiExtraCadence", "refiExtraOnceDate", "setRefiExtraOnceDate", "refiEscrowUnsure", "setRefiEscrowUnsure", "refiHasMaturity", "setRefiHasMaturity", "refiMaturityDate", "setRefiMaturityDate", "refiAnnualTax", "setRefiAnnualTax", "refiAnnualIns", "setRefiAnnualIns", "insEffectiveDate", "setInsEffectiveDate", "refiCurrentEscrow", "setRefiCurrentEscrow", "refiCurEscrowTax", "setRefiCurEscrowTax", "refiCurEscrowIns", "setRefiCurEscrowIns", "refiEscrowBalance", "setRefiEscrowBalance", "refiSkipMonths", "setRefiSkipMonths", "refiCurrentMI", "setRefiCurrentMI", "refiCashOut", "setRefiCashOut", "refiExtraPaid", "setRefiExtraPaid", "refiHomeValue", "setRefiHomeValue", "refiPayoffFees", "setRefiPayoffFees", "showRefi3", "setShowRefi3"]);
  const {
    T, isRefi, setIsRefi, salesPrice, setSalesPrice, downPct, setDownPct, downMode, setDownMode,
    loanType, setLoanType, propertyState, setPropertyState, propertyCounty, setPropertyCounty, city, setCity,
    propertyZip, setPropertyZip, propertyAddress, setPropertyAddress, setPropertyTBD,
    addressInput, setAddressInput, AddressAutocomplete,
    annualIns, setAnnualIns, hoa, setHoa, rate, setRate, term, setTerm,
    creditScore, setCreditScore, married, setMarried, firstTimeBuyer, setFirstTimeBuyer,
    refiPurpose, setRefiPurpose, taxState, scenarioName,
    ownsProperties, setOwnsProperties, hasSellProperty, setHasSellProperty, showInvestor, setShowInvestor,
    showRentVsBuy, setShowRentVsBuy, showProp19, setShowProp19, skillLevel, onToggleSkillLevel, Inp, Sel, SearchSelect, Note,
    Hero, Card, InfoTip, gameMode, TAB_PROGRESSION, completedTabs,
    isTabFieldsComplete, markTouched, isPulse, calc, fmt, CITY_NAMES, STATE_NAMES_PROP, STATE_CITIES,
    SKILL_PRESETS, FILING_STATUSES, showCompareHint, setShowCompareHint, setTab,
    scenarioList, isDesktop, darkMode, propTaxMode, getTTCitiesForState, getTTForCity, COUNTY_AMI,
    lookupZip, Icon, TextInp, FieldLabel, Sec, GuidedNextButton, ClusterContinue,
    // Refi-specific states
    refiCurrentLoanType, setRefiCurrentLoanType, refiCurrentRateType, setRefiCurrentRateType,
    refiArmStartRate, setRefiArmStartRate, refiArmAdjustedDate, setRefiArmAdjustedDate,
    refiLastPaymentDate, setRefiLastPaymentDate, refiClosingPmtOverride, setRefiClosingPmtOverride,
    closingMonth, setClosingMonth, closingDay, setClosingDay, closingYear, setClosingYear,
    refiOriginalAmount, setRefiOriginalAmount,
    refiOriginalTerm, setRefiOriginalTerm, refiCurrentRate, setRefiCurrentRate,
    refiClosedDate, setRefiClosedDate, refiCurrentBalance, setRefiCurrentBalance,
    refiRemainingMonths, setRefiRemainingMonths, refiCurrentPayment, setRefiCurrentPayment,
    refiCurPrinOverride, setRefiCurPrinOverride, refiCurIntOverride, setRefiCurIntOverride,
    refiHasStatement, setRefiHasStatement, refiEscrowMode, setRefiEscrowMode, refiEscrowCombined, setRefiEscrowCombined, refiEscrowCombinedPeriod, setRefiEscrowCombinedPeriod, refiSecondLien, setRefiSecondLien, refiSecondKind, setRefiSecondKind, refiSecondBalance, setRefiSecondBalance, refiSecondRate, setRefiSecondRate, refiSecondPlan, setRefiSecondPlan, refiModified, setRefiModified, refiPrepayPenalty, setRefiPrepayPenalty, refiExtraCadence, setRefiExtraCadence, refiExtraOnceDate, setRefiExtraOnceDate, refiEscrowUnsure, setRefiEscrowUnsure,
    refiHasMaturity, setRefiHasMaturity, refiMaturityDate, setRefiMaturityDate,
    refiAnnualTax, setRefiAnnualTax, refiAnnualIns, setRefiAnnualIns, insEffectiveDate, setInsEffectiveDate, refiCurrentEscrow, setRefiCurrentEscrow,
    refiCurEscrowTax, setRefiCurEscrowTax, refiCurEscrowIns, setRefiCurEscrowIns,
    refiEscrowBalance, setRefiEscrowBalance, refiSkipMonths, setRefiSkipMonths,
    refiCurrentMI, setRefiCurrentMI, refiCashOut, setRefiCashOut, refiExtraPaid, setRefiExtraPaid,
    refiHomeValue, setRefiHomeValue,
    refiPayoffFees, setRefiPayoffFees, showRefi3, setShowRefi3,
    hideHero = false,
  } = props;

  // Current-loan amortization drawer — collapsed by default (it's a
  // verification tool, not part of the entry flow) and non-persistent, same
  // convention as the Monthly schedule in AmortContent.
  // Statements print cents, and the receipt is reconciled against one, so it
  // needs more precision than the app-wide dollar-rounded fmt().
  const money2 = (n) => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Extra-payments switch. Derived from the amount rather than stored, so a
  // scenario saved with extra principal reopens switched on; the latch only
  // covers the moment between flipping it and typing a figure.
  // Escrow period is a display choice only — refiAnnualTax/refiAnnualIns stay
  // ANNUAL for every downstream consumer, and these convert on entry. Storing
  // a period alongside would make the figure ambiguous everywhere it's read.
  const [refiTaxPeriod, setRefiTaxPeriod] = useState("yr");
  const [refiInsPeriod, setRefiInsPeriod] = useState("yr");
  const [extraTouched, setExtraTouched] = useState(false);
  const extraOn = refiExtraPaid > 0 || extraTouched;
  const [showCurSchedule, setShowCurSchedule] = useState(false);
  const [curSchedAll, setCurSchedAll] = useState(false);

  /* Property Location card.
     PURCHASE — a single ZIP input. City / County / State auto-populate from
     the useEffect in MortgageBlueprint that watches propertyZip and calls
     lookupZip(). A purchase often has no property yet, so ZIP is all we ask.
     REFINANCE — a refi ALWAYS has a subject property, so the address
     typeahead replaces ZIP as the first thing asked (Christo 2026-07-22).
     Picking a suggestion fills address + ZIP, and the ZIP effect then fills
     city/county/state exactly as the purchase path does. The ZIP input only
     reappears as a fallback when the picked address carried no postcode.

     Extracted to a const because the two flows park it in different columns:
     purchase keeps it under Quick Start on the left, refi moves it to the
     right, where the Modules card would otherwise sit almost empty. */
  const propertyLocationCard = (
   <div data-field="zip-code" className={isPulse("zip-code")} onBlur={() => { if (propertyZip && propertyZip.length === 5) markTouched("zip-code-done"); }} style={{ borderRadius: 14, transition: "all 0.3s" }}>
   <Card style={{ marginTop: 12 }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: T.textTertiary, fontFamily: FONT, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>Property Location</div>
    {isRefi ? (
     <>
      <AddressAutocomplete
       /* Legacy scenarios saved a propertyAddress with no addressInput — fall
          back so a reopened scenario shows the address it already has. */
       value={addressInput || propertyAddress || ""}
       onChange={v => {
        setAddressInput(v);
        // Free-typed text is still the property address — a scenario saved
        // mid-type keeps what the user wrote instead of silently dropping it.
        setPropertyAddress(v);
        if (v) setPropertyTBD(false);
       }}
       onSelect={sel => {
        const street = sel.address || "";
        setPropertyAddress(street);
        setPropertyTBD(false);
        // Set city/county/state from the geocoder FIRST; when the ZIP is in
        // ZIP_DATA the propertyZip effect overwrites them a render later with
        // the lookup values the tax tables are keyed to. When it isn't, these
        // survive as the only location we have.
        if (sel.city) setCity(sel.city);
        if (sel.state) setPropertyState(sel.state);
        if (sel.county) setPropertyCounty(sel.county);
        const z = String(sel.zip || "").replace(/[^0-9]/g, "").slice(0, 5);
        if (z.length === 5) { setPropertyZip(z); markTouched("zip-code-done"); }
       }}
       placeholder="Start typing the property address..."
      />
      {/* Fallback: address picked (or typed) but no ZIP came with it — county,
          tax rate and loan limits all key off ZIP, so ask for it directly. */}
      {(addressInput || propertyAddress) && !(propertyZip && propertyZip.length === 5) && (
       <div style={{ flex: "0 0 140px", maxWidth: 140 }}>
        <Inp
         label="Zip Code"
         value={propertyZip || ""}
         onChange={v => { const z = String(v).replace(/[^0-9]/g, "").slice(0, 5); setPropertyZip(z); if (z.length === 5) markTouched("zip-code-done"); }}
         type="text"
         placeholder="94501"
         sm
         req
        />
       </div>
      )}
      {/* The green confirmation banner is retired (Christo 2026-07-28) — it
          restated the address back at you. What it uniquely carried is the
          COUNTY, which drives the conforming limit, the tax rate and transfer
          tax, so that survives as a one-line gray caption. It goes loud only
          when the county can't be resolved, which is the case that actually
          costs money: a wrong county silently produces a wrong loan limit. */}
      {propertyZip && propertyZip.length === 5 && (
       propertyCounty
        ? <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.5, marginTop: -4, marginBottom: 10 }}>
           Resolved to <strong style={{ color: T.textSecondary }}>{propertyCounty} County</strong> — sets the loan limit and tax rate.
          </div>
        : <div style={{ fontSize: 11, color: T.orange, fontWeight: 600, lineHeight: 1.5, marginTop: -4, marginBottom: 10 }}>
           County couldn't be resolved from {propertyZip} — loan limit and tax rate fall back to state defaults. Confirm it before quoting.
          </div>
      )}
      {/* Home value moves up under the address it belongs to, taking the
          banner's slot: on a refi it's the first number the LO needs and it
          drives LTV, so asking for it beside the property beats burying it
          in the current-loan section. */}
      {isRefi && (
       <Inp label="Home Value" value={salesPrice} onChange={setSalesPrice} max={100000000} sm req
        tip="Current estimated market value. Sets your LTV and equity position." />
      )}
     </>
    ) : (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
     <div style={{ flex: "0 0 140px" }}>
      <Inp
       label="Zip Code"
       value={propertyZip || ""}
       onChange={v => { const z = String(v).replace(/[^0-9]/g, "").slice(0, 5); setPropertyZip(z); if (z.length === 5) markTouched("zip-code-done"); }}
       type="text"
       placeholder="94501"
       sm
       req
      />
     </div>
     {/* Auto-filled summary on the right — read-only chip showing what the ZIP resolved to */}
     {propertyZip && propertyZip.length === 5 && (city || propertyCounty || propertyState) && (
      <div style={{
       flex: 1, display: "flex", alignItems: "center", gap: 6,
       padding: "10px 12px", marginBottom: 2,
       background: `${T.green}10`, border: `1px solid ${T.green}30`,
       borderRadius: 12, fontSize: 12, color: T.text, fontFamily: FONT,
       minHeight: 38,
      }}>
       <span style={{ color: T.green, fontWeight: 700 }}>✓</span>
       <span>
        {city ? `${city}, ` : ""}{propertyCounty ? `${propertyCounty} County, ` : ""}{propertyState || "—"}
       </span>
      </div>
     )}
     {propertyZip && propertyZip.length === 5 && !city && !propertyCounty && (
      <div style={{
       flex: 1, padding: "10px 12px", marginBottom: 2,
       background: `${T.orange}10`, border: `1px solid ${T.orange}30`,
       borderRadius: 12, fontSize: 12, color: T.orange, fontFamily: FONT,
      }}>
       ZIP not in lookup — fill manually below.
      </div>
     )}
    </div>
    )}
   </Card>
   </div>
  );

  /* Middle FICO input + slider. Extracted for the same reason as the location
     card: purchase renders it inside Quick Start, refi renders it on the right
     where the Modules card used to be (Christo 2026-07-22). */
  const ficoBlock = (
    <div data-field="fico-input" className={isPulse("fico-input")} style={{ borderRadius: 14, transition: "all 0.3s" }}>
     <FieldLabel label="Middle FICO Score" tip="Lenders pull all three bureaus and use the lowest middle score of all borrowers for qualification." req filled={creditScore > 0} />
     <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: "0 0 90px" }}>
       <input type="text" inputMode="numeric" value={creditScore === 0 ? "" : creditScore} placeholder="750"
        onChange={e => { const v = e.target.value.replace(/\D/g, ""); if (v === "") { setCreditScore(0); return; } const n = Math.min(parseInt(v, 10), 850); setCreditScore(n); }}
        onBlur={() => {
          if (creditScore > 0 && creditScore < 300) { setCreditScore(300); markTouched("fico-input-done"); }
          else if (creditScore >= 300) markTouched("fico-input-done");
        }}
        style={{ width: "100%", background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "12px 14px", color: T.text, fontSize: 17, fontWeight: 600, fontFamily: FONT, outline: "none", textAlign: "center", letterSpacing: "normal", fontVariantNumeric: "tabular-nums" }} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
       <input type="range" min={300} max={850} step={5} value={creditScore || 650}
        onChange={e => setCreditScore(parseInt(e.target.value, 10))}
        onMouseUp={() => markTouched("fico-input-done")} onTouchEnd={() => markTouched("fico-input-done")}
        style={{ width: "100%", height: 6, appearance: "none", WebkitAppearance: "none", background: `linear-gradient(to right, ${T.red} 0%, ${T.orange} 30%, ${T.green} 70%, ${T.green} 100%)`, borderRadius: 3, outline: "none", cursor: "pointer", accentColor: T.blue }} />
       <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: T.textTertiary, fontFamily: FONT, letterSpacing: 0.5 }}>
        <span>300</span>
        <span>580</span>
        <span>670</span>
        <span>740</span>
        <span>850</span>
       </div>
      </div>
     </div>
     {creditScore > 0 && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, marginBottom: 10 }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: creditScore >= calc.ficoMin ? T.green : T.red }} />
      <span style={{ fontSize: 12, color: creditScore >= calc.ficoMin ? T.green : T.red, fontWeight: 600 }}>
       {creditScore >= calc.ficoMin ? `✓ Meets ${loanType} min (${calc.ficoMin}+)` : `Below ${loanType} min (${calc.ficoMin}+) — need ${calc.ficoMin - creditScore} more pts`}
      </span>
     </div>}
    </div>
  );

  return (<>
 {!hideHero && (
  <div style={{ marginTop: 12 }}>
   <Hero value={isRefi === null ? "New Loan" : isRefi ? "Refinance" : "Purchase"} label="Loan Setup" color={T.blue} sub={scenarioName} />
  </div>
 )}

 {/* Build Mode progress house removed here — the page-level Construction
    House at the top of the tab (MortgageBlueprint.jsx) is the single
    source of truth. This embedded copy double-rendered on Overview. */}

 {/* Compare Hint */}
 {showCompareHint && scenarioList.length > 1 && (
  <div style={{ background: `${T.green}15`, border: `1px solid ${T.green}33`, borderRadius: 14, padding: "12px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
   <div>
    <div style={{ fontSize: 13, fontWeight: 700, color: T.green }}>Compare tab available!</div>
    <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>You have {scenarioList.length} loan options. View them side-by-side.</div>
   </div>
   <div style={{ display: "flex", gap: 6 }}>
    <button onClick={() => { setTab("compare"); setShowCompareHint(false); }} style={{ background: T.green, color: "#FFF", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Compare</button>
    <button onClick={() => setShowCompareHint(false)} style={{ background: "none", border: "none", color: T.textTertiary, fontSize: 18, cursor: "pointer", padding: "0 4px" }}>×</button>
   </div>
  </div>
 )}

 {/* ── Quick Start — 2-column on desktop, columns stretch to equal height ── */}
 <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "stretch" } : {}}>

  {/* ── LEFT COLUMN: Profile & Location — stretches to match right column ── */}
  <div style={isDesktop ? { display: "flex", flexDirection: "column" } : {}}>
   <Card style={isDesktop ? { flex: 1, marginBottom: 0 } : {}}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
     <div style={{ fontSize: 14 }}></div>
     <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Quick Start</div>
     <div style={{ fontSize: 9, fontWeight: 600, color: T.green, background: `${T.green}15`, padding: "2px 6px", borderRadius: 5, marginLeft: "auto" }}>REQUIRED</div>
    </div>

    {/* 1) Experience Level */}
    <div data-field="experience-level" className={isPulse("experience-level")} style={{ marginBottom: 10, borderRadius: 14, transition: "all 0.3s" }}>
     <div style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
      Experience Level
     </div>
     {/* Standard sits on the LEFT (Christo 2026-07-21) — Standard + Purchase is
         the everyday combination, so both defaults line up on the left edge and
         the common path is a straight read down. Explicit order rather than
         reordering SKILL_PRESETS, so the welcome modal keeps leading with
         Guided for first-time visitors. */}
     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
      {["standard", "guided"].filter(k => SKILL_PRESETS[k]).map(key => [key, SKILL_PRESETS[key]]).map(([key, preset]) => (
       <button key={key} onClick={() => { if (skillLevel !== key && onToggleSkillLevel) onToggleSkillLevel(); }}
        style={{ padding: "8px 6px", background: skillLevel === key ? `${T.blue}18` : T.inputBg, border: skillLevel === key ? `2px solid ${T.blue}` : `1px solid ${T.separator}`, borderRadius: 10, cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}>
        <div style={{ display: "flex", justifyContent: "center", color: skillLevel === key ? T.blue : T.textSecondary }}><Icon name={preset.icon} size={16} /></div>
        <div style={{ fontSize: 11, fontWeight: 700, color: skillLevel === key ? T.blue : T.text, marginTop: 2 }}>{preset.label}</div>
       </button>
      ))}
     </div>
     {!skillLevel && (
      <div style={{ marginTop: 6, padding: "6px 10px", background: `${T.blue}08`, border: `1px dashed ${T.blue}30`, borderRadius: 8, fontSize: 11, color: T.blue, textAlign: "center" }}>
       ☝ Select your experience level
      </div>
     )}
    </div>

    {/* 2) Transaction Type */}
    <div data-field="transaction-type" className={isPulse("transaction-type")} style={{ paddingTop: 10, borderTop: `1px solid ${T.separator}`, marginBottom: 10, borderRadius: 14, transition: "all 0.3s" }}>
     <div style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 6 }}>Transaction Type</div>
     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
      {[["Purchase", false], ["Refinance", true]].map(([label, val]) => (
       <button key={label} onClick={() => { setIsRefi(val); markTouched("transaction-type-done"); }} style={{ padding: "9px 0", background: isRefi === val ? `${T.blue}22` : T.inputBg, border: isRefi === val ? `2px solid ${T.blue}` : `1px solid ${T.separator}`, borderRadius: 10, color: isRefi === val ? T.blue : T.textSecondary, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>{label}</button>
      ))}
     </div>
    </div>

    {/* 2b) Refi Purpose — appears the moment Refinance is picked, directly under
        it (Christo 2026-07-22). It used to live in its own full-width section
        far below the fold, which meant the choice that drives the whole refi
        model was nowhere near the button that turns the refi on. Styled to the
        Quick Start card's density, not the old section's. */}
    {isRefi && (
    <div data-field="refi-purpose" className={isPulse("refi-purpose")} style={{ paddingTop: 10, borderTop: `1px solid ${T.separator}`, marginBottom: 10, borderRadius: 14, transition: "all 0.3s" }}>
     <div style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 6 }}>Refi Purpose</div>
     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
      {["Rate/Term", "Cash-Out"].map(p => (
       <button key={p} onClick={() => { setRefiPurpose(p); markTouched("refi-purpose"); }}
        style={{ padding: "9px 0", background: refiPurpose === p ? `${T.blue}22` : T.inputBg, border: refiPurpose === p ? `2px solid ${T.blue}` : `1px solid ${T.separator}`, borderRadius: 10, color: refiPurpose === p ? T.blue : T.textSecondary, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>{p}</button>
      ))}
     </div>
     <div style={{ marginTop: 8, padding: "8px 10px", background: T.pillBg, borderRadius: 10, fontSize: 11, color: T.textSecondary, lineHeight: 1.5 }}>
      {refiPurpose === "Rate/Term" ? (
       <><strong style={{ color: T.blue }}>Rate/Term</strong> — Lower your rate, shorten your term, or both. Up to 1% of the new loan amount back in cash; above that it reclassifies as cash-out.</>
      ) : (
       <><strong style={{ color: T.blue }}>Cash-Out</strong> — Pull equity as cash, or pay off non-mortgage debt through the refi. Typically requires ≤80% LTV and may carry a slightly higher rate.</>
      )}
     </div>
    </div>
    )}

    {/* 3) FICO — purchase keeps it in the Quick Start card. Refi renders it in
        the right column, in the slot the Modules card used to occupy. */}
    {!isRefi && ficoBlock}
    {/* Filing Status removed — set under Tax Savings / Settings instead */}
   </Card>

   {/* Purchase keeps the location card here under Quick Start. Refi renders
       it in the right column instead — see below. */}
   {!isRefi && propertyLocationCard}
  </div>{/* end left column */}

  {/* ── RIGHT COLUMN ──
      PURCHASE — the Modules card (FTHB, REO, seller net sheet, investor…).
      REFINANCE — property address, then FICO in the slot Modules used to hold.
      Every module is purchase-only, so the card is gone entirely on refi
      (Christo 2026-07-22). REO for a refinancing investor is reachable from
      Settings; it no longer needs a near-empty card in Quick Start.
      The guided flow skips its "modules" step on refi to match — see
      MortgageBlueprint's guideField. */}
  <div style={isDesktop ? { display: "flex", flexDirection: "column" } : {}}>

   {isRefi && propertyLocationCard}
   {isRefi && <Card style={{ marginTop: 12 }}>{ficoBlock}</Card>}

   {/* 3-Point Refi Test — the one refi-mode module toggle (doc 7.23). Lives
       here because the Modules card below is purchase-only. */}
   {isRefi && (
    <div style={{ marginTop: 12, background: T.card, borderRadius: 14, border: `1px solid ${T.separator}`, overflow: "hidden" }}>
     <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
      <div>
       <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>3-Point Refi Test?</div>
       <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 1 }}>Show the rate-drop, breakeven & payoff-acceleration test tab</div>
      </div>
      <YesNoSeg
       T={T}
       value={showRefi3}
       onYes={() => { setShowRefi3(true); }}
       onNo={() => { setShowRefi3(false); }}
      />
     </div>
    </div>
   )}

   {/* ── Modules — full-width toggles with descriptions. Purchase only. ── */}
   {!isRefi && (
   <div data-field="modules" className={isPulse("modules")} style={{ marginTop: 10, background: T.card, borderRadius: 14, border: `1px solid ${T.separator}`, overflow: "hidden", transition: "all 0.3s", ...(isDesktop ? { flex: 1, display: "flex", flexDirection: "column" } : {}) }}>
    <div style={{ padding: "8px 14px 4px", fontSize: 12, fontWeight: 700, color: T.text }}>Modules</div>
    {/* First-Time Homebuyer — Yes/No (purchase only) */}
    {!isRefi && (
    <div data-field="fthb" className={isPulse("fthb")} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderTop: `1px solid ${T.separator}`, transition: "background 0.2s" }}>
     <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>First-Time Homebuyer?</div>
      <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 1 }}>{firstTimeBuyer === true ? "FTHB unlocked — 3% down conventional available" : "Unlocks first-time buyer loan programs"}</div>
     </div>
     <YesNoSeg
      T={T}
      value={firstTimeBuyer}
      onYes={() => { setFirstTimeBuyer(true); markTouched("fthb"); }}
      onNo={() => { setFirstTimeBuyer(false); markTouched("fthb"); }}
     />
    </div>
    )}
    {/* Own Properties */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderTop: `1px solid ${T.separator}`, transition: "background 0.2s" }}>
     <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Own Properties?</div>
      <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 1 }}>Show REO (Real Estate Owned) tab</div>
     </div>
     <YesNoSeg
      T={T}
      value={ownsProperties}
      onYes={() => { setOwnsProperties(true); }}
      onNo={() => { setOwnsProperties(false); }}
     />
    </div>
    {/* Selling a Property */}
    {!isRefi && (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderTop: `1px solid ${T.separator}`, transition: "background 0.2s" }}>
     <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Selling a Property?</div>
      <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 1 }}>Show the Seller Net Sheet tab</div>
     </div>
     <YesNoSeg
      T={T}
      value={hasSellProperty}
      onYes={() => { setHasSellProperty(true); }}
      onNo={() => { setHasSellProperty(false); }}
     />
    </div>
    )}
    {/* Investment Analysis */}
    {!isRefi && (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderTop: `1px solid ${T.separator}`, transition: "background 0.2s" }}>
     <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Investment Analysis?</div>
      <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 1 }}>Show the Investor tab with ROI metrics</div>
     </div>
     <YesNoSeg
      T={T}
      value={showInvestor}
      onYes={() => { setShowInvestor(true); }}
      onNo={() => { setShowInvestor(false); }}
     />
    </div>
    )}
    {/* Buy vs Rent — NEW MODULE */}
    {!isRefi && (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderTop: `1px solid ${T.separator}`, transition: "background 0.2s" }}>
     <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>Buy vs Rent?</div>
      <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 1 }}>Show the Rent vs Buy wealth comparison tab</div>
     </div>
     <YesNoSeg
      T={T}
      value={showRentVsBuy}
      onYes={() => { setShowRentVsBuy(true); }}
      onNo={() => { setShowRentVsBuy(false); }}
     />
    </div>
    )}
    {/* California Prop 19 Transfer — CA purchases only */}
    {propertyState === "California" && !isRefi && (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderTop: `1px solid ${T.separator}`, transition: "background 0.2s" }}>
     <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>California Prop 19?</div>
      <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 1 }}>Transfer your property tax base (55+, disabled, or disaster)</div>
     </div>
     <YesNoSeg
      T={T}
      value={showProp19}
      onYes={() => { setShowProp19(true); }}
      onNo={() => { setShowProp19(false); }}
     />
    </div>
    )}
    <div style={{ padding: "4px 14px 12px" }}>
     <ClusterContinue stepId="modules" />
    </div>
   </div>
   )}
  </div>{/* end right column */}

 </div>{/* end 2-column grid */}

 {/* Setup Complete celebration */}
 {gameMode && completedTabs["setup"] && isTabFieldsComplete("setup") && (
  <div style={{ textAlign: "center", padding: "20px 16px", margin: "12px 0", background: `${T.green}10`, border: `1px solid ${T.green}30`, borderRadius: 18 }}>
   <div style={{ fontSize: 28, marginBottom: 6 }}></div>
   <div style={{ fontSize: 16, fontWeight: 700, color: T.green, marginBottom: 4 }}>Setup Complete!</div>
   <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5 }}>{isRefi ? "Your refi details are locked in. Head to the Refi Summary tab to see your savings." : "Your mortgage blueprint is ready. Explore the tabs below to dive deeper."}</div>
  </div>
 )}
 {/* Refi: nudge to fill in loan details if base setup is done but refi fields are empty */}
 {isRefi && !isTabFieldsComplete("setup") && propertyZip.length >= 5 && creditScore > 0 && (
  <div style={{ textAlign: "center", padding: "14px 16px", margin: "12px 0", background: `${T.orange}10`, border: `1px solid ${T.orange}30`, borderRadius: 18 }}>
   <div style={{ fontSize: 13, color: T.orange, fontWeight: 600 }}>↓ Fill in your current loan details below to complete setup</div>
  </div>
 )}

 {/* ── Refi Sections (when applicable) ──
    Refi Purpose moved up into the Quick Start card (2026-07-22). */}
 {isRefi && <Sec title="Your Current Loan" hero>
  <Card style={{ marginTop: 12 }}>
   <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
    <div style={{ flex: 1, minWidth: 180 }}>
     <div style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: "-0.01em" }}>
      Do you have a mortgage statement?
     </div>
     <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>
      {refiHasStatement === false
       ? "Reconstructing from the closing date — every figure below is an estimate."
       : "Reading the loan off the statement beats any estimate."}
     </div>
    </div>
    <YesNoSeg
     T={T}
     value={refiHasStatement}
     onYes={() => setRefiHasStatement(true)}
     onNo={() => setRefiHasStatement(false)}
    />
   </div>
  </Card>
  <Card>
   {/* Field order pairs the value with the note against it, then describes the
       note itself (Christo 2026-07-22):
         Home Value        | Original Loan Amount
         Current Loan Type | Fixed / Adjustable
         Original Term     | Current Rate
         Loan Closed In (month | year)
       Fixed/Adjustable is its own field, NOT an entry in the type dropdown —
       "an adjustable conventional note" is two facts, and an ARM is often the
       whole reason for the refi. */}
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    <Inp label="Current Rate" value={refiCurrentRate} onChange={setRefiCurrentRate} prefix="" suffix="%" step={0.125} max={30} sm req tip="The note rate today. On an adjusted ARM this is the rate it adjusted TO." />
    <Inp label="Original Loan Amount" value={refiOriginalAmount} onChange={setRefiOriginalAmount} sm req />
   </div>
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    <Sel label="Current Loan Type" value={refiCurrentLoanType} onChange={setRefiCurrentLoanType} options={["Conventional", "FHA", "VA", "Jumbo", "USDA"]} req />
    <Sel label="Fixed / Adjustable" value={refiCurrentRateType} onChange={setRefiCurrentRateType} options={["Fixed", "Adjustable"]} tip="Whether the current note's rate is fixed or adjustable (ARM). An ARM about to reset is often the reason to refinance." />
   </div>
   {/* ARM history — the note starts at one rate and RECASTS at the adjustment
       (balance re-amortized over the remaining term at the new rate). Without
       these two facts the balance estimate amortizes at a single rate and is
       simply wrong for an adjusted ARM (Christo 2026-07-22). Current Rate
       above is the rate it adjusted TO. */}
   {refiCurrentRateType === "Adjustable" && (
    <>
     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <Inp label="Start Rate" value={refiArmStartRate} onChange={setRefiArmStartRate} prefix="" suffix="%" step={0.125} max={30} sm tip="The initial (teaser) rate the ARM closed at. The balance amortizes at this rate until the adjustment." />
      <div style={{ marginBottom: 6 }}>
       <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, fontFamily: FONT }}>Adjusted In</label>
       <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select value={refiArmAdjustedDate ? refiArmAdjustedDate.slice(5, 7) : ""} onChange={e => { const m = e.target.value; if (!m) { setRefiArmAdjustedDate(""); return; } const y = refiArmAdjustedDate ? refiArmAdjustedDate.slice(0, 4) : String(new Date().getFullYear()); setRefiArmAdjustedDate(`${y}-${m}-01`); }} style={{ background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "10px 12px", color: refiArmAdjustedDate ? T.text : T.textTertiary, fontSize: 13, fontWeight: 500, outline: "none", fontFamily: FONT, width: "100%" }}>
         <option value="">Month</option>
         {["January","February","March","April","May","June","July","August","September","October","November","December"].map((mo, i) => <option key={i} value={String(i+1).padStart(2,"0")}>{mo}</option>)}
        </select>
        <select value={refiArmAdjustedDate ? refiArmAdjustedDate.slice(0, 4) : ""} onChange={e => { const y = e.target.value; const m = refiArmAdjustedDate ? refiArmAdjustedDate.slice(5, 7) : "01"; if (y) setRefiArmAdjustedDate(`${y}-${m}-01`); }} style={{ background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "10px 12px", color: refiArmAdjustedDate ? T.text : T.textTertiary, fontSize: 13, fontWeight: 500, outline: "none", fontFamily: FONT, width: "100%" }}>
         <option value="">Year</option>
         {Array.from({ length: 16 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
       </div>
      </div>
     </div>
     <div style={{ fontSize: 11, color: T.textTertiary, marginTop: -2, marginBottom: 10 }}>
      Amortizes at the start rate until "{refiArmAdjustedDate ? "the adjustment" : "adjusted"}", then recasts at the Current Rate above (the rate it adjusted to).
     </div>
    </>
   )}
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    <Inp label="Original Term" value={refiOriginalTerm} onChange={setRefiOriginalTerm} prefix="" suffix="years" max={50} sm req tip="Without the original term there is nothing to amortize against — a 30 and a 15 diverge from the first payment." />
   </div>
   <div style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, fontFamily: FONT }}>Loan Closed In</label>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
     <select value={refiClosedDate ? refiClosedDate.slice(5, 7) : ""} onChange={e => { const m = e.target.value; const y = refiClosedDate ? refiClosedDate.slice(0, 4) : new Date().getFullYear(); if (m && y) setRefiClosedDate(`${y}-${m}-01`); }} style={{ background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "12px 14px", color: refiClosedDate ? T.text : T.textTertiary, fontSize: 15, fontWeight: 500, outline: "none", fontFamily: FONT, width: "100%" }}>
      <option value="">Month</option>
      {["January","February","March","April","May","June","July","August","September","October","November","December"].map((mo, i) => <option key={i} value={String(i+1).padStart(2,"0")}>{mo}</option>)}
     </select>
     <select value={refiClosedDate ? refiClosedDate.slice(0, 4) : ""} onChange={e => { const y = e.target.value; const m = refiClosedDate ? refiClosedDate.slice(5, 7) : "01"; if (y && m) setRefiClosedDate(`${y}-${m}-01`); }} style={{ background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "12px 14px", color: refiClosedDate ? T.text : T.textTertiary, fontSize: 15, fontWeight: 500, outline: "none", fontFamily: FONT, width: "100%" }}>
      <option value="">Year</option>
      {Array.from({ length: 16 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
     </select>
    </div>
   </div>
   {/* ── Extra payments (Christo 2026-07-28) ──
       Two columns matching the Amortization tab's control: the switch on the
       left says whether there ARE extra payments, the amount sits beside it.
       Cadence and the lump-sum date only appear once the switch is on, so the
       off state is two tiles instead of a stack of questions. */}
   {refiClosedDate && (<>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: extraOn ? 10 : 14 }}>
     <Card pad={14} style={{ marginBottom: 0 }}>
      <div style={{ fontSize: 11, color: T.textTertiary, fontWeight: 500 }}>Extra Payments</div>
      <div style={{ marginTop: 6 }}>
       <button
        type="button"
        onClick={() => { if (extraOn) { setExtraTouched(false); setRefiExtraPaid(0); setRefiExtraOnceDate(""); } else { setExtraTouched(true); } }}
        aria-pressed={extraOn}
        title={extraOn ? "No extra principal payments" : "Borrower pays extra principal"}
        style={{ width: 44, height: 26, borderRadius: 13, background: extraOn ? T.green : T.ringTrack, border: "none", cursor: "pointer", position: "relative", transition: "background 0.3s", padding: 0 }}
       >
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#FFF", position: "absolute", top: 3, left: extraOn ? 21 : 3, transition: "left 0.3s" }} />
       </button>
      </div>
     </Card>
     {extraOn
      ? <Inp label={refiExtraCadence === "once" ? "Lump Sum Amount" : "Extra Monthly Principal"} value={refiExtraPaid} onChange={setRefiExtraPaid} sm />
      : <Card pad={14} style={{ marginBottom: 0, display: "flex", alignItems: "center" }}>
         <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.5 }}>
          Minimum payments only. Switch on if the borrower has been paying extra principal — it moves the estimated balance.
         </div>
        </Card>}
    </div>
    {extraOn && (<>
     <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary }}>One time, or every month?</span>
      <div style={{ display: "flex", gap: 5 }}>
       {[["monthly", "Monthly"], ["once", "One time"]].map(([v, label]) => (
        <button key={v} type="button" onClick={() => setRefiExtraCadence(v)}
         style={{ padding: "5px 14px", borderRadius: 9999, fontSize: 11, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
          background: refiExtraCadence === v ? `${T.blue}22` : T.inputBg,
          border: refiExtraCadence === v ? `2px solid ${T.blue}` : `1px solid ${T.separator}`,
          color: refiExtraCadence === v ? T.blue : T.textSecondary }}>
         {label}
        </button>
       ))}
      </div>
     </div>
     {refiExtraCadence === "once" && (
      <div style={{ marginBottom: 12 }}>
       <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, fontFamily: FONT }}>
        When was it paid?
        <InfoTip tip="A lump sum in year two leaves a very different balance than the same amount in year six, so the month it landed matters as much as the amount." />
       </label>
       <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select value={refiExtraOnceDate ? refiExtraOnceDate.slice(5, 7) : ""} onChange={e => { const m = e.target.value; if (!m) { setRefiExtraOnceDate(""); return; } const y = refiExtraOnceDate ? refiExtraOnceDate.slice(0, 4) : String(new Date().getFullYear()); setRefiExtraOnceDate(`${y}-${m}-01`); }} style={{ background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "10px 12px", color: refiExtraOnceDate ? T.text : T.textTertiary, fontSize: 13, fontWeight: 500, outline: "none", fontFamily: FONT, width: "100%" }}>
         <option value="">Month</option>
         {["January","February","March","April","May","June","July","August","September","October","November","December"].map((mo, i) => <option key={i} value={String(i+1).padStart(2,"0")}>{mo}</option>)}
        </select>
        <select value={refiExtraOnceDate ? refiExtraOnceDate.slice(0, 4) : ""} onChange={e => { const y = e.target.value; const m = refiExtraOnceDate ? refiExtraOnceDate.slice(5, 7) : "01"; if (y) setRefiExtraOnceDate(`${y}-${m}-01`); }} style={{ background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "10px 12px", color: refiExtraOnceDate ? T.text : T.textTertiary, fontSize: 13, fontWeight: 500, outline: "none", fontFamily: FONT, width: "100%" }}>
         <option value="">Year</option>
         {Array.from({ length: 16 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
       </div>
       {refiExtraPaid > 0 && !refiExtraOnceDate && (
        <div style={{ fontSize: 11, color: T.orange, fontWeight: 600, marginTop: 6 }}>
         Pick the month it was paid — without it the lump sum isn't applied at all.
        </div>
       )}
      </div>
     )}
     {refiExtraPaid > 0 && refiOriginalAmount > 0 && (<div style={{ background: `${T.green}15`, borderRadius: 10, padding: 12, marginTop: 6, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.green, marginBottom: 4 }}>WITH EXTRA PAYMENTS</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
       <div><div style={{ fontSize: 10, color: T.textTertiary }}>Est. Balance</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.refiEffBalance)}</div></div>
       <div><div style={{ fontSize: 10, color: T.textTertiary }}>Min Payment Balance</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.refiMinBalance)}</div></div>
      </div>
      <div style={{ borderTop: `1px solid ${T.green}33`, marginTop: 8, paddingTop: 8 }}>
       <div style={{ fontSize: 10, color: T.textTertiary }}>Principal Paid Ahead</div>
       <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: T.green }}>+{fmt(calc.refiMinBalance - calc.refiEffBalance)}</div>
      </div>
     </div>)}
    </>)}
   </>)}
   {refiOriginalAmount > 0 && refiCurrentRate > 0 && (<div style={{ background: `${T.blue}10`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: T.blue, marginBottom: 6 }}>AUTO-CALCULATED</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
     {/* refiEffPI = today's payment — for an adjusted ARM that's the RECAST
         payment, not the start-rate one (refiCalcPI). */}
     <div><div style={{ fontSize: 10, color: T.textTertiary }}>P&I Payment</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.refiEffPI)}</div></div>
     {refiClosedDate && <div><div style={{ fontSize: 10, color: T.textTertiary }}>Months Elapsed</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{calc.refiMonthsElapsed}</div></div>}
     {refiClosedDate && <div><div style={{ fontSize: 10, color: T.textTertiary }}>{calc.refiFromStatement ? "Est. Balance" : "Estimated Loan Amount"}</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.refiEffBalance)}</div></div>}
     {refiClosedDate && <div><div style={{ fontSize: 10, color: T.textTertiary }}>{calc.refiFromStatement ? "Remaining" : "Estimated Maturity Date"}</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{calc.refiFromStatement ? `${calc.refiEffRemaining} mos` : (calc.refiEffMaturity ? calc.refiEffMaturity.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—")}</div></div>}
    </div>
   </div>)}
   {/* Flow 2 reads its principal and interest OUT rather than in — there is no
       statement to copy them from, so they're the month-1 split of the
       reconstructed balance. Shown read-only so they can't be mistaken for
       something the borrower told you (Christo 2026-07-28). */}
   {!calc.refiFromStatement && calc.refiEffBalance > 0 && (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
     {[
      { label: "Principal", note: "calculated", value: calc.refiCurPrinThisMonth },
      { label: "Interest", note: "calculated", value: calc.refiCurIntThisMonth },
     ].map(f => (
      <div key={f.label}>
       <div style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, fontFamily: FONT }}>
        {f.label} <span style={{ fontSize: 11, color: T.textTertiary }}>· {f.note}</span>
       </div>
       <div style={{ display: "flex", alignItems: "center", background: "transparent", border: `1px dashed ${T.inputBorder}`, borderRadius: 12, padding: "10px 12px" }}>
        <span style={{ color: T.textTertiary, fontSize: 14, fontWeight: 600, marginRight: 4, fontFamily: FONT }}>$</span>
        <span style={{ fontSize: 15, fontWeight: 700, fontFamily: FONT }}>
         {(f.value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
       </div>
      </div>
     ))}
    </div>
   )}
   {/* The term solves itself (Christo 2026-07-28). Given the balance, the P&I
       split and the rate: n = -ln(1 - r*B/P) / ln(1+r) — no original amount,
       no funded date, no property lookup. When it disagrees with the closing
       date by more than a couple of payments, that gap is the signature of a
       past modification or a recast. */}
   {calc.refiSolvedTerm > 0 && calc.refiSolvedMaturity && (
    <div style={{ fontSize: 11, marginTop: -8, marginBottom: 12, lineHeight: 1.6, color: T.textSecondary }}>
     Balance, payment and rate solve to <strong style={{ color: T.text }}>{calc.refiSolvedTerm}</strong> payments
     remaining — maturing {calc.refiSolvedMaturity.toLocaleDateString("en-US", { month: "short", year: "numeric" })}.
     No property lookup needed.
     {refiClosedDate && calc.refiEffRemaining > 0 && Math.abs(calc.refiSolvedTerm - calc.refiEffRemaining) > 2 && (
      <span style={{ color: T.orange, fontWeight: 600 }}>
       {" "}The closing date implies {calc.refiEffRemaining} instead — a gap that size usually means a past
       modification or a recast.
      </span>
     )}
    </div>
   )}
   {/* The auto-estimate's blind spots, stated plainly: it assumes minimum
       payments at a constant rate. Statement figures below beat it. */}
   {refiOriginalAmount > 0 && refiCurrentRate > 0 && refiClosedDate && (
    <div style={{ fontSize: 11, color: T.textTertiary, marginTop: -8, marginBottom: 12, lineHeight: 1.5 }}>
     Estimate assumes minimum payments at {refiCurrentRateType === "Adjustable" ? "the rates entered above" : "the same rate"} since closing — it will be off for extra principal payments{refiCurrentRateType === "Adjustable" ? "" : " or an ARM that has adjusted"}. A statement balance below overrides it.
    </div>
   )}
   {/* Statement anchors — the servicer's number beats any estimate, and the
       last-payment month is what per-diem payoff interest accrues from
       (payments pay interest in ARREARS: a July 1 payment covers June).
       Hidden entirely in the reconstruct branch: there is no statement to read
       them off, and the calc ignores them there too (Christo 2026-07-28). */}
   {calc.refiFromStatement && (
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    <Inp label="Current Balance — from statement" value={refiCurrentBalance} onChange={setRefiCurrentBalance} sm tip="Outstanding principal from the most recent mortgage statement. When set, this overrides the auto-estimate and anchors the payoff calculation." />
    {/* The statement's own principal/interest split (Christo 7.28). Deriving
        it (interest = balance × rate) is only ever an approximation — the
        servicer's split reflects the real accrual. Entering BOTH pins this
        month's P&I to their sum, so the payoff walk and every savings figure
        run off the statement instead of our estimate. Same state the lockable
        cells on the Refi tab's Monthly Payment table write to. */}
    <Inp label="Principal — from statement" value={refiCurPrinOverride} onChange={setRefiCurPrinOverride} sm tip="This month's principal portion, straight off the statement. Leave at 0 to derive it (payment minus interest)." />
    <Inp label="Interest — from statement" value={refiCurIntOverride} onChange={setRefiCurIntOverride} sm tip="This month's interest portion, straight off the statement. Leave at 0 to derive it (balance × rate ÷ 12)." />
   </div>
   )}
   {!calc.refiFromStatement && (
    <Note color={T.orange}>
     No statement, so the balance below is reconstructed from the closing date and rate. Everything it
     depends on — extra principal, an ARM that adjusted, a past modification — moves it. A statement
     replaces the estimate outright.
    </Note>
   )}
   {/* ── Payment receipt (Christo 2026-07-28) ──
       Mirrors the statement's "Explanation of Amount Due" so the LO reads down
       one column and down the other. The bolded Regular Monthly Payment is
       Principal + Interest + Escrow (+ MI) — P&I alone stops matching the
       moment there's mortgage insurance or an impound. */}
   {calc.refiPaymentTotal > 0 && (
    <div style={{ background: T.inputBg, border: `1px solid ${T.separator}`, borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
     <div style={{ fontSize: 10, fontWeight: 600, color: T.textTertiary, fontFamily: MONO, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>
      Regular Monthly Payment
     </div>
     {calc.refiPaymentRows.map((r, i) => (
      <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, padding: "3px 0", color: T.textSecondary }}>
       <span>{r.label}</span>
       <span style={{ color: T.text, fontWeight: 600, fontFamily: FONT }}>{money2(r.amt)}</span>
      </div>
     ))}
     <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.separator}`, fontSize: 15, fontWeight: 700 }}>
      <span>Total</span>
      <span style={{ fontFamily: FONT }}>{money2(calc.refiPaymentTotal)}</span>
     </div>
     <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 8, lineHeight: 1.5 }}>
      Compare against the bolded Regular Monthly Payment on the statement.
      {(refiCurrentMI > 0 || calc.refiCurEscrowMo > 0)
       ? ` Principal and interest alone come to ${fmt(calc.refiEffPI)} — the rest rides along with the payment but doesn't pay the loan down.`
       : " Nothing is impounded and there's no mortgage insurance, so this is principal and interest alone."}
     </div>
    </div>
   )}
   {/* Closing-month payment question — when closing is after the grace day the
       borrower MUST make that month's payment before we can close, which drops
       the payoff. Auto-answered by the calendar; the LO can override. Only
       relevant once the closing month is after the last-payment month. */}
   {refiCurrentBalance > 0 && calc.refiMonthsToClose >= 1 && (
    <div style={{ background: `${T.blue}08`, border: `1px solid ${T.blue}22`, borderRadius: 10, padding: "10px 12px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
     <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.text, display: "flex", alignItems: "center", gap: 6 }}>
       {["January","February","March","April","May","June","July","August","September","October","November","December"][(closingMonth - 1 + 12) % 12]} payment made before closing?
       {refiClosingPmtOverride == null && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: T.blue, background: `${T.blue}14`, border: `1px solid ${T.blue}30`, borderRadius: 9999, padding: "1px 6px" }}>AUTO</span>}
      </div>
      <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2, lineHeight: 1.5 }}>
       {calc.refiAssumeClosingPmt
        ? `Closing after the ${calc.refiGraceDay}th — this payment is due first, so we assume it's made. Payoff accrues ${calc.refiPayoffDays} days from ${calc.refiPayoffEffLabel}.`
        : `Closing on/before the ${calc.refiGraceDay}th grace day — still within the window, so we don't assume it yet.`}
      </div>
     </div>
     <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <div
       onClick={() => setRefiClosingPmtOverride(calc.refiAssumeClosingPmt ? false : true)}
       style={{ width: 52, height: 30, borderRadius: 99, background: calc.refiAssumeClosingPmt ? T.green : T.inputBg, cursor: "pointer", padding: 2, transition: "all 0.3s" }}
      >
       <div style={{ width: 26, height: 26, borderRadius: 99, background: "#fff", transform: calc.refiAssumeClosingPmt ? "translateX(22px)" : "translateX(0)", transition: "transform 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
      </div>
      {refiClosingPmtOverride != null && (
       <button onClick={() => setRefiClosingPmtOverride(null)} title="Back to auto" style={{ background: "none", border: "none", color: T.blue, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: FONT }}>↺</button>
      )}
     </div>
    </div>
   )}
   {/* ── Current loan amortization drawer (Christo 7.28) ──
       The estimate box hands you one number; this is the month-by-month walk
       that produced it, so the statement can be reconciled against the row
       for today instead of taken on faith. Collapsed by default — it's a
       verification tool, not part of the entry flow. */}
   {calc.refiCurSchedule.length > 0 && (() => {
    const sched = calc.refiCurSchedule;
    const elapsed = calc.refiMonthsElapsed;
    const hasExtra = sched.some(r => r.extra > 0);
    // Default window: the year leading up to today plus a few months ahead —
    // the rows an LO actually compares against a statement. "Show all" and
    // the CSV cover full inspection.
    const from = curSchedAll ? 0 : Math.max(0, elapsed - 12);
    const to = curSchedAll ? sched.length : Math.min(sched.length, Math.max(18, elapsed + 6));
    const visible = sched.slice(from, to);
    const cols = hasExtra ? "0.5fr 0.8fr 1fr 1fr 1fr 0.8fr 1.2fr" : "0.5fr 0.8fr 1fr 1fr 1fr 1.2fr";
    const delta = calc.refiStatementDelta;
    return (
     <div style={{ marginBottom: 14 }}>
      <button
       onClick={() => setShowCurSchedule(v => !v)}
       style={{ width: "100%", padding: "10px 12px", background: showCurSchedule ? `${T.blue}12` : T.inputBg, border: `1px solid ${showCurSchedule ? `${T.blue}40` : T.inputBorder}`, borderRadius: 12, color: showCurSchedule ? T.blue : T.textSecondary, fontFamily: FONT, fontWeight: 600, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, textAlign: "left" }}
      >
       <span>Current Loan Amortization <span style={{ fontWeight: 500, color: T.textTertiary }}>· check our math against the statement</span></span>
       <span style={{ fontSize: 14, lineHeight: 1 }}>{showCurSchedule ? "▴" : "▾"}</span>
      </button>
      {showCurSchedule && (
       <div style={{ border: `1px solid ${T.separator}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: 12, marginTop: -2 }}>
        {/* Reconciliation line — the whole point of the drawer. */}
        <div style={{ fontSize: 11, lineHeight: 1.6, color: T.textSecondary, marginBottom: 10 }}>
         After <strong>{elapsed}</strong> payment{elapsed === 1 ? "" : "s"} the schedule lands at <strong style={{ color: T.text }}>{fmt(calc.refiScheduleNowBal)}</strong>.
         {delta == null ? " Enter the statement balance above to compare." : Math.abs(delta) < 1 ? " The statement matches it." : (
          <span style={{ color: delta < 0 ? T.green : T.orange, fontWeight: 600 }}>
           {" "}The statement says {fmt(refiCurrentBalance)} — {fmt(Math.abs(delta))} {delta < 0 ? "lower, so principal has been paid ahead" : "higher, so the assumptions are off (missed payments, a rate change, or a recast we don't know about)"}.
          </span>
         )}
        </div>
        <div style={{ overflowX: "auto" }}>
         <div style={{ minWidth: hasExtra ? 400 : 350 }}>
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 0, fontSize: 10, color: T.textTertiary, fontWeight: 600, paddingBottom: 6, borderBottom: `1px solid ${T.separator}`, fontFamily: MONO, letterSpacing: 0.4, textTransform: "uppercase" }}>
           <span>#</span><span>Date</span><span style={{ textAlign: "right" }}>P&I</span><span style={{ textAlign: "right" }}>Interest</span><span style={{ textAlign: "right" }}>Principal</span>{hasExtra && <span style={{ textAlign: "right" }}>Extra</span>}<span style={{ textAlign: "right" }}>Balance</span>
          </div>
          {visible.map(r => (
           <div key={r.m} style={{ display: "grid", gridTemplateColumns: cols, gap: 0, fontSize: 11, padding: "5px 0", borderBottom: `1px solid ${T.separator}`, fontFamily: FONT, background: r.isNow ? `${T.blue}12` : "transparent", opacity: r.isPast ? 1 : 0.55 }}>
            <span style={{ color: T.textTertiary }}>{r.m}</span>
            <span style={{ color: T.textSecondary }}>{r.label}{r.recast && <span style={{ color: T.orange, fontSize: 9, fontWeight: 700 }}> ▲</span>}</span>
            <span style={{ textAlign: "right", fontWeight: 600 }}>{fmt(r.pi)}</span>
            <span style={{ textAlign: "right", color: T.blue }}>{fmt(r.int)}</span>
            <span style={{ textAlign: "right", color: T.green }}>{fmt(r.prin)}</span>
            {hasExtra && <span style={{ textAlign: "right", color: T.orange }}>{r.extra > 0 ? fmt(r.extra) : "—"}</span>}
            <span style={{ textAlign: "right", color: r.isNow ? T.text : T.textSecondary, fontWeight: r.isNow ? 700 : 500 }}>{fmt(r.bal)}</span>
           </div>
          ))}
         </div>
        </div>
        <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 8, lineHeight: 1.5 }}>
         Highlighted row = today ({elapsed} payment{elapsed === 1 ? "" : "s"} in). Rows past it are projections at the current rate.
         {sched.some(r => r.recast) && " ▲ marks the ARM recast."}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
         <button
          onClick={() => setCurSchedAll(v => !v)}
          style={{ flex: 1, padding: "8px 10px", background: `${T.blue}10`, border: `1px solid ${T.blue}30`, borderRadius: 10, color: T.blue, fontFamily: FONT, fontWeight: 600, fontSize: 11, cursor: "pointer" }}
         >
          {curSchedAll ? `Collapse — show around today` : `Show all ${sched.length} payments`}
         </button>
         <button
          onClick={() => {
           const head = ["#", "Date", "P&I", "Interest", "Principal", "Extra", "Balance"];
           const rows = [head, ...sched.map(r => [r.m, r.label, r.pi.toFixed(2), r.int.toFixed(2), r.prin.toFixed(2), r.extra.toFixed(2), r.bal.toFixed(2)])];
           const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
           const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `current-loan-amortization-${refiCurrentRate}pct.csv`; a.click();
           URL.revokeObjectURL(a.href);
          }}
          style={{ padding: "8px 12px", background: "none", border: `1px solid ${T.separator}`, borderRadius: 10, color: T.textSecondary, fontFamily: FONT, fontWeight: 600, fontSize: 11, cursor: "pointer" }}
         >
          ⬇ CSV
         </button>
        </div>
       </div>
      )}
     </div>
    );
   })()}
   {!refiClosedDate && !refiCurrentBalance && <Note color={T.orange}>Enter the close date above and we'll estimate the balance — or enter the statement balance directly.</Note>}
   {!refiClosedDate && (
    <Inp label="Remaining Months (manual)" value={refiRemainingMonths} onChange={setRefiRemainingMonths} prefix="" suffix="mos" />
   )}
   {/* ── Escrow (Christo 2026-07-28) ──
       Combined is what you type, because that's the single line every
       statement prints ("Escrow (Taxes and Insurance)"). The split lives
       behind a Split caret, matching the Principal & Interest disclosure on
       the payment breakdown. Splitting is opt-in because the combined figure
       is what the servicer COLLECTS — cushion and any shortage spread
       included — so it isn't annual tax ÷ 12 + annual insurance ÷ 12, and
       dividing it would import someone else's shortage into the new loan. */}
   <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
    <label style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>
     Escrow (taxes and insurance)
    </label>
    <span
     onClick={() => setRefiEscrowMode(refiEscrowMode === "split" ? "combined" : "split")}
     title={refiEscrowMode === "split" ? "Hide the breakdown" : "Split into taxes and insurance"}
     style={{ display: "inline-flex", alignItems: "center", gap: 3, cursor: "pointer", userSelect: "none" }}
    >
     <span style={{ fontSize: 11, fontWeight: 600, color: T.blue, fontFamily: FONT }}>Split</span>
     <span style={{ fontSize: 10, color: T.blue, lineHeight: 1, transform: `translateY(-1px) rotate(${refiEscrowMode === "split" ? 180 : 0}deg)`, transition: "transform 0.2s" }}>▾</span>
    </span>
   </div>
   <Inp label="" value={refiEscrowCombined} onChange={setRefiEscrowCombined}
    tip="Copy the servicer's escrow line exactly as printed."
    rightSlot={
     <span style={{ display: "flex", gap: 3, flexShrink: 0 }}>
      {[["mo", "Monthly"], ["yr", "Annual"]].map(([v, label]) => (
       <button key={v} type="button" onClick={() => setRefiEscrowCombinedPeriod(v)}
        style={{ padding: "3px 9px", borderRadius: 9999, fontSize: 10, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
         background: refiEscrowCombinedPeriod === v ? `${T.blue}22` : "transparent",
         border: refiEscrowCombinedPeriod === v ? `1px solid ${T.blue}` : `1px solid ${T.separator}`,
         color: refiEscrowCombinedPeriod === v ? T.blue : T.textTertiary }}>
        {label}
       </button>
      ))}
     </span>
    } />

   {refiEscrowMode === "split" && (
    <div style={{ marginLeft: 12, paddingLeft: 12, borderLeft: `2px solid ${T.blue}33`, marginBottom: 12 }}>
     {[
      { key: "tax", label: "Taxes", on: refiCurEscrowTax, setOn: setRefiCurEscrowTax,
        amt: refiAnnualTax, setAmt: setRefiAnnualTax,
        hint: "Prefilled from the county assessor once the address is known." },
      { key: "ins", label: "Insurance", on: refiCurEscrowIns, setOn: setRefiCurEscrowIns,
        amt: refiAnnualIns, setAmt: setRefiAnnualIns,
        hint: "The policy premium — carries over on a refi." },
     ].map(c => (
      <div key={c.key} style={{ paddingTop: 8 }}>
       <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Is {c.label.toLowerCase()} included?</span>
        <YesNoSeg T={T} value={c.on} onYes={() => c.setOn(true)} onNo={() => c.setOn(false)} />
       </div>
       {c.on && (() => {
        const per = c.key === "tax" ? refiTaxPeriod : refiInsPeriod;
        const shown = per === "mo" ? Math.round((c.amt / 12) * 100) / 100 : c.amt;
        const store = (v) => c.setAmt(per === "mo" ? (Number(v) || 0) * 12 : (Number(v) || 0));
        return (
        <Inp label={`${c.label} amount`} value={shown} onChange={store} sm tip={c.hint}
         rightSlot={
          <span style={{ display: "flex", gap: 3, flexShrink: 0 }}>
           {[["mo", "Monthly"], ["yr", "Annual"]].map(([v, label]) => {
            const per = c.key === "tax" ? refiTaxPeriod : refiInsPeriod;
            const setPer = c.key === "tax" ? setRefiTaxPeriod : setRefiInsPeriod;
            return (
             <button key={v} type="button" onClick={() => setPer(v)}
              style={{ padding: "3px 9px", borderRadius: 9999, fontSize: 10, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
               background: per === v ? `${T.blue}22` : "transparent",
               border: per === v ? `1px solid ${T.blue}` : `1px solid ${T.separator}`,
               color: per === v ? T.blue : T.textTertiary }}>
              {label}
             </button>
            );
           })}
          </span>
         } />
        );
       })()}
      </div>
     ))}
     <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.5, paddingTop: 8 }}>
      These feed the NEW loan's impound. They aren't a division of the combined figure above — that one
      carries cushion and any shortage spread, so splitting it would import the old servicer's shortage
      into your quote. Also check they aren't bundling mortgage insurance into the escrow line; if they
      are, it's already counted under MI/MIP.
     </div>
    </div>
   )}
   {/* PMI sits directly after escrow because that's the order the statement
       lists them — Principal, Interest, Escrow, then MI — so the LO fills
       straight down the page instead of bouncing around (Christo 7.28). */}
   <Inp label="PMI / MIP" value={refiCurrentMI} onChange={setRefiCurrentMI} sm
    tip="Monthly mortgage insurance on the current loan, if any." />
   {/* No impounds means no escrow account, so the balance question is removed
       rather than asked and answered zero. */}
   <div style={{ maxWidth: 320 }}>
    <div style={{ marginBottom: 6 }}>
     {/* Month only — the year is implied (a borrower 12+ months behind isn't
         getting a loan today). Auto-defaults from the calendar: last month, or
         this month once past the 15th (doc 7.23). Picking a month later than
         the current one means the most recent PAST occurrence — last year. */}
     <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, fontFamily: FONT }}>
      Last Payment Made
      {!refiLastPaymentDate && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: T.blue, background: `${T.blue}14`, border: `1px solid ${T.blue}30`, borderRadius: 9999, padding: "1px 6px", marginLeft: 6, verticalAlign: "middle" }}>AUTO</span>}
      <InfoTip tip="The month of the most recent payment made. We assume last month — or this month once you're past the 15th. Override if the statement says otherwise." />
     </label>
     <select value={(refiLastPaymentDate || calc.refiLastPaymentEff || "").slice(5, 7)} onChange={e => { const m = e.target.value; if (!m) { setRefiLastPaymentDate(""); return; } const now = new Date(); const y = Number(m) > now.getMonth() + 1 ? now.getFullYear() - 1 : now.getFullYear(); setRefiLastPaymentDate(`${y}-${m}-01`); }} style={{ background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "10px 12px", color: T.text, fontSize: 13, fontWeight: 500, outline: "none", fontFamily: FONT, width: "100%" }}>
      <option value="">Auto</option>
      {["January","February","March","April","May","June","July","August","September","October","November","December"].map((mo, i) => <option key={i} value={String(i+1).padStart(2,"0")}>{mo}</option>)}
     </select>
    </div>
   </div>
   {calc.refiEscrowOn
    ? <Inp label="Escrow Balance" value={refiEscrowBalance} onChange={setRefiEscrowBalance} sm
       tip="Money sitting in the escrow account — refunded after the old loan pays off. Printed on the statement, so read it rather than ask." />
    : <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.5, marginBottom: 12 }}>
       Nothing is impounded, so there's no escrow account and no balance to refund.
      </div>}
   {(refiAnnualTax > 0 || refiAnnualIns > 0) && (
    <div style={{ fontSize: 11, color: T.green, fontWeight: 600, marginTop: -4, marginBottom: 10 }}>
     ✓ Monthly: {refiAnnualTax > 0 ? `Tax ${fmt(refiAnnualTax / 12)}` : ""}{refiAnnualTax > 0 && refiAnnualIns > 0 ? " + " : ""}{refiAnnualIns > 0 ? `Ins ${fmt(refiAnnualIns / 12)}` : ""} = {fmt((refiAnnualTax + refiAnnualIns) / 12)}/mo
    </div>
   )}
   {/* ── Maturity, per the statement (Christo 2026-07-28) ──
       A printed maturity date beats anything we derive: it already accounts
       for modifications and recasts the closing-date estimate can't see. When
       the statement doesn't carry one, we work backwards from the original
       note instead — the same two fields Flow 2 asks for, surfaced here only
       when they're actually needed. */}
   {calc.refiFromStatement && (<>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "10px 0" }}>
     <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Does the statement include a maturity date?</span>
     <YesNoSeg T={T}
      value={refiHasMaturity === "" ? null : refiHasMaturity === "yes"}
      onYes={() => setRefiHasMaturity("yes")}
      onNo={() => setRefiHasMaturity("no")} />
    </div>

    {refiHasMaturity === "yes" && (
     <div style={{ marginLeft: 12, paddingLeft: 12, borderLeft: `2px solid ${T.blue}33`, marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, fontFamily: FONT }}>Maturity date</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxWidth: 340 }}>
       <select value={refiMaturityDate ? refiMaturityDate.slice(5, 7) : ""} onChange={e => { const m = e.target.value; if (!m) { setRefiMaturityDate(""); return; } const y = refiMaturityDate ? refiMaturityDate.slice(0, 4) : String(new Date().getFullYear() + 25); setRefiMaturityDate(`${y}-${m}-01`); }} style={{ background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "10px 12px", color: refiMaturityDate ? T.text : T.textTertiary, fontSize: 13, fontWeight: 500, outline: "none", fontFamily: FONT, width: "100%" }}>
        <option value="">Month</option>
        {["January","February","March","April","May","June","July","August","September","October","November","December"].map((mo, i) => <option key={i} value={String(i+1).padStart(2,"0")}>{mo}</option>)}
       </select>
       <select value={refiMaturityDate ? refiMaturityDate.slice(0, 4) : ""} onChange={e => { const y = e.target.value; const m = refiMaturityDate ? refiMaturityDate.slice(5, 7) : "01"; if (y) setRefiMaturityDate(`${y}-${m}-01`); }} style={{ background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "10px 12px", color: refiMaturityDate ? T.text : T.textTertiary, fontSize: 13, fontWeight: 500, outline: "none", fontFamily: FONT, width: "100%" }}>
        <option value="">Year</option>
        {Array.from({ length: 41 }, (_, i) => new Date().getFullYear() + i).map(y => <option key={y} value={y}>{y}</option>)}
       </select>
      </div>
     </div>
    )}

    {refiHasMaturity === "no" && (
     <div style={{ marginLeft: 12, paddingLeft: 12, borderLeft: `2px solid ${T.blue}33`, marginBottom: 12 }}>
      <Note color={T.blue}>We can look up the original loan amount and funded date and work backwards.</Note>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
       <Inp label="Loan Amount" value={refiOriginalAmount} onChange={setRefiOriginalAmount} sm
        tip="The original note amount, from the property profile or the recorded deed of trust." />
       <div style={{ marginBottom: 6 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, fontFamily: FONT }}>Loan Funded</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
         <select value={refiClosedDate ? refiClosedDate.slice(5, 7) : ""} onChange={e => { const m = e.target.value; const y = refiClosedDate ? refiClosedDate.slice(0, 4) : new Date().getFullYear(); if (m && y) setRefiClosedDate(`${y}-${m}-01`); }} style={{ background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "10px 12px", color: refiClosedDate ? T.text : T.textTertiary, fontSize: 13, fontWeight: 500, outline: "none", fontFamily: FONT, width: "100%" }}>
          <option value="">Month</option>
          {["January","February","March","April","May","June","July","August","September","October","November","December"].map((mo, i) => <option key={i} value={String(i+1).padStart(2,"0")}>{mo}</option>)}
         </select>
         <select value={refiClosedDate ? refiClosedDate.slice(0, 4) : ""} onChange={e => { const y = e.target.value; const m = refiClosedDate ? refiClosedDate.slice(5, 7) : "01"; if (y && m) setRefiClosedDate(`${y}-${m}-01`); }} style={{ background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "10px 12px", color: refiClosedDate ? T.text : T.textTertiary, fontSize: 13, fontWeight: 500, outline: "none", fontFamily: FONT, width: "100%" }}>
          <option value="">Year</option>
          {Array.from({ length: 41 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
         </select>
        </div>
       </div>
      </div>
     </div>
    )}

    {/* What the answer buys us. */}
    {(calc.refiEffMaturity || calc.refiSolvedTerm > 0) && (
     <div style={{ background: `${T.blue}10`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.blue, fontFamily: MONO, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>That gives us</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
       <div>
        <div style={{ fontSize: 10, color: T.textTertiary }}>Maturity date</div>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>
         {calc.refiEffMaturity ? calc.refiEffMaturity.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}
        </div>
       </div>
       <div>
        <div style={{ fontSize: 10, color: T.textTertiary }}>Total interest remaining</div>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.refiCurRemainingInt)}</div>
       </div>
      </div>
     </div>
    )}
   </>)}
   {/* ── Other liens & history (Christo 2026-07-28) ──
       A second has to be subordinated or paid off, and that choice moves the
       new loan amount and the CLTV. Its RATE is what earns the question: the
       new first has to beat the blended cost of both liens, not the first's
       rate alone. Modification and prepayment penalty are one question each,
       and both are printed on most statements. */}
   <div style={{ fontSize: 11, fontWeight: 600, color: T.textTertiary, fontFamily: MONO, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 16, marginBottom: 10 }}>
    Other Liens &amp; History
   </div>
   <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "8px 0" }}>
    <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Any second mortgage or HELOC?</span>
    <YesNoSeg T={T} value={refiSecondLien} onYes={() => setRefiSecondLien(true)} onNo={() => setRefiSecondLien(false)} />
   </div>
   {refiSecondLien && (
    <div style={{ marginLeft: 12, paddingLeft: 12, borderLeft: `2px solid ${T.blue}33`, marginBottom: 10 }}>
     <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "6px 0" }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary }}>Which kind?</span>
      <div style={{ display: "flex", gap: 5 }}>
       {[["heloc", "HELOC"], ["closed", "Fixed second"]].map(([v, label]) => (
        <button key={v} type="button" onClick={() => setRefiSecondKind(v)}
         style={{ padding: "5px 14px", borderRadius: 9999, fontSize: 11, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
          background: refiSecondKind === v ? `${T.blue}22` : T.inputBg,
          border: refiSecondKind === v ? `2px solid ${T.blue}` : `1px solid ${T.separator}`,
          color: refiSecondKind === v ? T.blue : T.textSecondary }}>
         {label}
        </button>
       ))}
      </div>
     </div>
     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <Inp label="Second Balance" value={refiSecondBalance} onChange={setRefiSecondBalance} sm
       tip={refiSecondKind === "heloc" ? "The drawn balance — not the credit limit." : "Remaining principal on the closed-end second."} />
      <Inp label="Second Rate" value={refiSecondRate} onChange={setRefiSecondRate} prefix="" suffix="%" step={0.125} max={30} sm
       tip={refiSecondKind === "heloc" ? "Usually prime plus a margin, so it moves — that variability is often the reason to consolidate." : "Fixed for the life of the second."} />
     </div>
     <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "6px 0" }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary }}>Pay it off, or subordinate it?</span>
      <div style={{ display: "flex", gap: 5 }}>
       {[["sub", "Subordinate"], ["payoff", "Pay off"]].map(([v, label]) => (
        <button key={v} type="button" onClick={() => setRefiSecondPlan(v)}
         style={{ padding: "5px 14px", borderRadius: 9999, fontSize: 11, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
          background: refiSecondPlan === v ? `${T.blue}22` : T.inputBg,
          border: refiSecondPlan === v ? `2px solid ${T.blue}` : `1px solid ${T.separator}`,
          color: refiSecondPlan === v ? T.blue : T.textSecondary }}>
         {label}
        </button>
       ))}
      </div>
     </div>
     {refiSecondBalance > 0 && calc.refiEffBalance > 0 && (
      <Note color={T.blue}>
       Together that's {fmt(calc.refiEffBalance + calc.refiSecondBal)} at a blended{" "}
       <strong>{calc.refiBlendedRate.toFixed(3)}%</strong>
       {refiSecondPlan === "payoff"
        ? ` — paying the second off means the new first has to beat that blend, not the ${refiCurrentRate.toFixed(3)}% first alone.`
        : ` — subordinating leaves the ${(refiSecondRate || 0).toFixed(3)}% balance in place${refiSecondKind === "heloc" ? " and still floating." : "."}`}
       {refiHomeValue > 0 && ` CLTV ${(calc.refiCLTV * 100).toFixed(1)}%.`}
       {calc.refiSecondPmt > 0 && ` Carry is about ${fmt(calc.refiSecondPmt)}/mo${refiSecondKind === "heloc" ? " interest-only." : " minimum."}`}
      </Note>
     )}
    </div>
   )}
   {[
    { label: "Ever modified, or in forbearance since origination?", value: refiModified, set: setRefiModified },
    { label: "Prepayment penalty on the current note?", value: refiPrepayPenalty, set: setRefiPrepayPenalty },
   ].map((q) => (
    <div key={q.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "8px 0", borderTop: `1px dashed ${T.separator}` }}>
     <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{q.label}</span>
     <div style={{ display: "flex", gap: 5 }}>
      {[["yes", "Yes"], ["no", "No"], ["unsure", "Unsure"]].map(([v, label]) => (
       <button key={v} type="button" onClick={() => q.set(v)}
        style={{ padding: "5px 14px", borderRadius: 9999, fontSize: 11, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
         background: q.value === v ? `${T.blue}22` : T.inputBg,
         border: q.value === v ? `2px solid ${T.blue}` : `1px solid ${T.separator}`,
         color: q.value === v ? T.blue : T.textSecondary }}>
        {label}
       </button>
      ))}
     </div>
    </div>
   ))}
   {/* Confidence. Only things that undermine the NUMBER downgrade it — a
       modification breaks a reconstruction but a statement balance is still
       ground truth, and a prepayment penalty changes the deal's economics,
       never the balance. */}
   {(calc.refiUnsure.length > 0 || calc.refiHardFlags.length > 0) && (
    <div style={{ background: `${T.orange}10`, border: `1px solid ${T.orange}30`, borderRadius: 10, padding: "10px 12px", marginTop: 10, marginBottom: 12 }}>
     <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: T.orange, fontFamily: MONO, textTransform: "uppercase", marginBottom: 4 }}>
      {calc.refiConfidence === "verify" ? "Needs verification" : "Worth flagging"}
     </div>
     <div style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.6 }}>
      {calc.refiUnsure.length > 0 && <>Still unknown: {calc.refiUnsure.join(", ")}. </>}
      {calc.refiHardFlags.join(" ")}
     </div>
    </div>
   )}
   {/* The honest exit — they may not need a refinance at all. PMI cancels off
       the FIRST lien's LTV, so a second doesn't block it. */}
   {calc.refiPmiDropEligible && (
    <div style={{ background: `${T.green}12`, border: `1px solid ${T.green}33`, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
     <div style={{ fontSize: 12, fontWeight: 700, color: T.green, marginBottom: 3 }}>They may not need a refinance</div>
     <div style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.6 }}>
      The balance is {((calc.refiEffBalance / refiHomeValue) * 100).toFixed(1)}% of value and they're still paying{" "}
      {fmt(refiCurrentMI)}/mo in mortgage insurance. They can likely request cancellation from the servicer —
      worth {fmt(refiCurrentMI * 12)} a year with no closing costs and no new loan.
     </div>
    </div>
   )}
   {/* Insurance effective (anniversary) month — decides whether the 12-month
       premium lands in the refi's closing costs. The policy carries over on a
       refi, so it is only a cost of the refi when it renews at closing
       (Christo 2026-07-22). calc.insRenewalAtClose does the window check. */}
   <div style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, fontFamily: FONT }}>
     Insurance Effective Date
     <InfoTip tip="The month your homeowner's policy renews each year. If it renews around your closing, the 12-month premium is due at closing and shows up in prepaids — otherwise you pay it on your normal schedule and it is NOT counted as a refi cost." />
    </label>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
     <select value={insEffectiveDate ? insEffectiveDate.slice(5, 7) : ""} onChange={e => { const m = e.target.value; if (!m) { setInsEffectiveDate(""); return; } const y = insEffectiveDate ? insEffectiveDate.slice(0, 4) : String(new Date().getFullYear()); setInsEffectiveDate(`${y}-${m}-01`); }} style={{ background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "12px 14px", color: insEffectiveDate ? T.text : T.textTertiary, fontSize: 15, fontWeight: 500, outline: "none", fontFamily: FONT, width: "100%" }}>
      <option value="">Month</option>
      {["January","February","March","April","May","June","July","August","September","October","November","December"].map((mo, i) => <option key={i} value={String(i+1).padStart(2,"0")}>{mo}</option>)}
     </select>
     <select value={insEffectiveDate ? insEffectiveDate.slice(0, 4) : ""} onChange={e => { const y = e.target.value; const m = insEffectiveDate ? insEffectiveDate.slice(5, 7) : "01"; if (y) setInsEffectiveDate(`${y}-${m}-01`); }} style={{ background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "12px 14px", color: insEffectiveDate ? T.text : T.textTertiary, fontSize: 15, fontWeight: 500, outline: "none", fontFamily: FONT, width: "100%" }}>
      <option value="">Year</option>
      {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() + 1 - i).map(y => <option key={y} value={y}>{y}</option>)}
     </select>
    </div>
    {insEffectiveDate && (
     /* Escrowed = the timing question is a cash-to-close line item.
        Non-escrowed = it's a docs condition, never a collection. */
     <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6, color: calc.insRenewalAtClose ? T.orange : T.green }}>
      {calc.insRenewalAtClose
       ? (calc.refiNewEscrowIns
          ? `Renews ${calc.insRenewalDays != null ? `${calc.insRenewalDays} days after closing` : "near closing"} (≤60-day window) — 12-month premium (${fmt(refiAnnualIns || 0)}) collected at closing; escrow starts a fresh cycle`
          : `Renews ${calc.insRenewalDays != null ? `${calc.insRenewalDays} days after closing` : "near closing"} — escrow waived, so nothing is collected. Docs condition: paid receipt for the renewal before docs.`)
       : `Renews outside the 60-day window${calc.insRenewalDays != null ? ` (${calc.insRenewalDays} days after closing)` : ""} — premium not collected; ${calc.refiNewEscrowIns ? "funded through escrow reserves" : "borrower pays the carrier directly"}`}
     </div>
    )}
   </div>
   {refiAnnualTax <= 0 && refiAnnualIns <= 0 && (
    <Inp label="Current Monthly Escrow (Tax+Ins)" value={refiCurrentEscrow} onChange={setRefiCurrentEscrow} tip="If you don't know the annual amounts, enter your combined monthly escrow here." />
   )}
   {/* Escrow on the CURRENT loan, per component (Christo 2026-07-22): tax and
       insurance can be impounded independently. The NEW loan's pair of
       toggles lives on the payment donut (Monthly Payment section) and
       defaults to whatever these are set to. */}
   <div style={{ borderTop: `1px solid ${T.separator}`, paddingTop: 10, marginBottom: 10 }}>
    <div style={{ fontSize: 14, color: T.text, marginBottom: 2 }}>Included in the current payment?</div>
    <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 8 }}>What the current loan escrows. The new loan's escrow is set on the payment donut and starts out matching this.</div>
    {[
     { key: "tax", label: "Property taxes", on: refiCurEscrowTax, set: setRefiCurEscrowTax,
       hint: refiCurEscrowTax ? "Taxes included in today's payment" : "Taxes paid separately today" },
     { key: "ins", label: "Homeowner's insurance", on: refiCurEscrowIns, set: setRefiCurEscrowIns,
       hint: refiCurEscrowIns ? "Insurance included in today's payment" : "Insurance paid separately today" },
    ].map(row => (
     <div key={row.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
      <div>
       <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{row.label}</div>
       <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 1 }}>{row.hint}</div>
      </div>
      <div
       onClick={() => row.set(!row.on)}
       style={{ width: 52, height: 30, borderRadius: 99, background: row.on ? T.green : T.inputBg, cursor: "pointer", padding: 2, transition: "all 0.3s", flexShrink: 0 }}
      >
       <div style={{ width: 26, height: 26, borderRadius: 99, background: "#fff", transform: row.on ? "translateX(22px)" : "translateX(0)", transition: "transform 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
      </div>
     </div>
    ))}
   </div>
   {/* Estimated closing date drives the skipped-payment count — it is a
       function of the calendar, not a choice, so the old dropdown is gone
       (Christo 2026-07-22): fund by the 15th → skip 2, after → skip 1. */}
   {/* Both cells share a fixed-height label row and identical control heights
       so the date input and the pill sit on the same baseline (doc 7.23) —
       the explainer caption moved below the grid so it can't push the pill up. */}
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "start" }}>
    <div>
     <div style={{ display: "flex", alignItems: "center", height: 22, marginBottom: 6, fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>
      Estimated Closing Date
      <InfoTip tip="When the refi is expected to fund. Drives prepaid interest, the insurance-renewal window, payoff per-diem days, and how many payments get skipped." />
     </div>
     <input
      type="date"
      value={`${closingYear || new Date().getFullYear()}-${String(closingMonth).padStart(2, "0")}-${String(closingDay).padStart(2, "0")}`}
      onChange={e => {
       const [y, m, d] = e.target.value.split("-").map(Number);
       if (y && m && d) { setClosingYear(y); setClosingMonth(m); setClosingDay(d); }
      }}
      style={{ width: "100%", boxSizing: "border-box", height: 44, background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "11px 14px", color: T.text, fontSize: 14, outline: "none", fontFamily: FONT }}
     />
    </div>
    <div>
     <div style={{ display: "flex", alignItems: "center", height: 22, marginBottom: 6, fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>Skipped Payments</div>
     <div style={{ display: "flex", alignItems: "center", gap: 8, boxSizing: "border-box", height: 44, background: T.pillBg, borderRadius: 12, border: "1px solid transparent", padding: "0 14px" }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: FONT }}>{refiSkipMonths} {refiSkipMonths === 1 ? "month" : "months"}</span>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: T.blue, background: `${T.blue}14`, border: `1px solid ${T.blue}30`, borderRadius: 9999, padding: "2px 7px" }}>AUTO</span>
     </div>
    </div>
   </div>
   <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 4, marginBottom: 14, textAlign: "right" }}>Close by the 15th → skip 2 · after → skip 1</div>
   {/* Payoff readout — the LAST box in the section (doc 7.23): balance after
       any assumed payments + per-diem interest through the est. closing date
       + editable lender payoff fees. */}
   {refiCurrentBalance > 0 && calc.refiPayoffDays > 0 && (
    <div style={{ background: `${T.blue}10`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
     <div style={{ fontSize: 11, fontWeight: 600, color: T.blue, marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
      <span>ESTIMATED PAYOFF</span>
      {calc.refiPaymentsBeforeClose > 0 && <span style={{ color: T.textTertiary, fontWeight: 500 }}>after {calc.refiPaymentsBeforeClose} payment{calc.refiPaymentsBeforeClose === 1 ? "" : "s"}</span>}
     </div>
     <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.5, marginBottom: 8 }}>
      Your current balance is not your payoff. Interest is paid in arrears and a refi skips your next payment, so the payoff runs about a month of interest ahead of the balance — plus the payoff fees.
     </div>
     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, alignItems: "end" }}>
      <div><div style={{ fontSize: 10, color: T.textTertiary }}>Payoff Balance</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.refiPayoffBalance)}</div></div>
      <div><div style={{ fontSize: 10, color: T.textTertiary }}>Per Diem</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.refiPayoffPerDiem)}/day</div></div>
      <div><div style={{ fontSize: 10, color: T.textTertiary }}>Payoff Interest ({calc.refiPayoffDays}d)</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.refiPayoffInterest)}</div></div>
      <div style={{ marginBottom: -6 }}><Inp label="Payoff Fees" value={refiPayoffFees} onChange={setRefiPayoffFees} sm tip="Lender payoff fees — reconveyance, recording, doc prep, wire. Typically ~$300. Included in the payoff amount." /></div>
     </div>
     <div style={{ borderTop: `1px solid ${T.blue}33`, marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <div style={{ fontSize: 10, color: T.textTertiary }}>Payoff Amount</div>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: T.blue }}>{fmt(calc.refiPayoffAmount)}</div>
     </div>
    </div>
   )}
   {refiPurpose === "Cash-Out" && <Inp label="Cash Out Amount" value={refiCashOut} onChange={setRefiCashOut} />}
  </Card>
 </Sec>}
 {isRefi && (refiHomeValue > 0 || calc.refiEffBalance > 0) && <div style={{ background: `${T.green}10`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
   {refiHomeValue > 0 && <div><div style={{ fontSize: 10, color: T.textTertiary }}>Current LTV</div><div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT }}>{(calc.refiEffBalance / refiHomeValue * 100).toFixed(1)}%</div></div>}
   {refiHomeValue > 0 && <div><div style={{ fontSize: 10, color: T.textTertiary }}>Current Equity</div><div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: T.green }}>{fmt(refiHomeValue - calc.refiEffBalance)}</div></div>}
  </div>
 </div>}

 {/* ── Manual zip fallback (when auto-lookup fails) ── */}
 {(!lookupZip(propertyZip) && propertyZip.length >= 5) && (
 <Card>
  <div style={{ fontSize: 11, fontWeight: 600, color: T.orange, marginBottom: 6 }}>Zip not found — set manually:</div>
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
   <div>
    {propertyState === "California" ? (
     <SearchSelect label="City" value={city} onChange={setCity} options={CITY_NAMES} />
    ) : (
     <SearchSelect label="City" value={city} onChange={setCity} options={STATE_CITIES[propertyState] || []} />
    )}
   </div>
   <Sel label="State" value={propertyState} onChange={setPropertyState} options={["California", ...STATE_NAMES_PROP.filter(s => s !== "California")].map(s => ({value:s,label:s}))} req />
  </div>
 </Card>
 )}

 {/* ── Scenarios ── */}
 {/* ── Current Loan Option indicator ── */}
 {scenarioList.length > 1 && (
  <Card pad={14} style={{ marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
   <div>
    <div style={{ fontSize: 11, fontWeight: 500, color: T.textTertiary }}>Active Loan Option</div>
    <div style={{ fontSize: 15, fontWeight: 700, color: T.blue }}>{scenarioName}</div>
   </div>
   <button onClick={() => setTab("compare")} style={{ background: `${T.blue}12`, border: `1px solid ${T.blue}25`, borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}>
    <span style={{ fontSize: 12, fontWeight: 600, color: T.blue, fontFamily: FONT }}>Compare {scenarioList.length}</span>
   </button>
  </Card>
 )}

 <GuidedNextButton />
</>);
}
