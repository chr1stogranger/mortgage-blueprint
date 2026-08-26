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
    background: active ? `${T.blue}22` : T.card,
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
  if (import.meta.env.DEV) devCheckProps("SetupContent", props, ["T", "isRefi", "setIsRefi", "salesPrice", "setSalesPrice", "downPct", "setDownPct", "downMode", "setDownMode", "loanType", "setLoanType", "propertyState", "setPropertyState", "propertyCounty", "setPropertyCounty", "city", "setCity", "propertyZip", "setPropertyZip", "propertyAddress", "setPropertyAddress", "setPropertyTBD", "addressInput", "setAddressInput", "AddressAutocomplete", "annualIns", "setAnnualIns", "hoa", "setHoa", "rate", "setRate", "term", "setTerm", "creditScore", "setCreditScore", "married", "setMarried", "firstTimeBuyer", "setFirstTimeBuyer", "refiPurpose", "setRefiPurpose", "taxState", "scenarioName", "ownsProperties", "setOwnsProperties", "hasSellProperty", "setHasSellProperty", "showInvestor", "setShowInvestor", "showRentVsBuy", "setShowRentVsBuy", "showProp19", "setShowProp19", "skillLevel", "onToggleSkillLevel", "Inp", "Sel", "SearchSelect", "Note", "Hero", "Card", "InfoTip", "gameMode", "TAB_PROGRESSION", "completedTabs", "isTabFieldsComplete", "markTouched", "isPulse", "calc", "fmt", "CITY_NAMES", "STATE_NAMES_PROP", "STATE_CITIES", "SKILL_PRESETS", "FILING_STATUSES", "showCompareHint", "setShowCompareHint", "setTab", "scenarioList", "isDesktop", "darkMode", "propTaxMode", "getTTCitiesForState", "getTTForCity", "COUNTY_AMI", "lookupZip", "Icon", "TextInp", "FieldLabel", "Sec", "GuidedNextButton", "ClusterContinue", "refiCurrentLoanType", "setRefiCurrentLoanType", "refiCurrentRateType", "setRefiCurrentRateType", "refiArmStartRate", "setRefiArmStartRate", "refiArmAdjustedDate", "setRefiArmAdjustedDate", "refiLastPaymentDate", "setRefiLastPaymentDate", "refiClosingPmtOverride", "setRefiClosingPmtOverride", "closingMonth", "setClosingMonth", "closingDay", "setClosingDay", "closingYear", "setClosingYear", "refiOriginalAmount", "setRefiOriginalAmount", "refiOriginalTerm", "setRefiOriginalTerm", "refiCurrentRate", "setRefiCurrentRate", "refiClosedDate", "setRefiClosedDate", "refiCurrentBalance", "setRefiCurrentBalance", "refiRemainingMonths", "setRefiRemainingMonths", "refiCurrentPayment", "setRefiCurrentPayment", "refiCurPrinOverride", "setRefiCurPrinOverride", "refiCurIntOverride", "setRefiCurIntOverride", "refiHasStatement", "setRefiHasStatement", "refiEscrowMode", "setRefiEscrowMode", "refiEscrowCombined", "setRefiEscrowCombined", "refiEscrowCombinedPeriod", "setRefiEscrowCombinedPeriod", "refiSecondLien", "setRefiSecondLien", "refiSecondKind", "setRefiSecondKind", "refiSecondBalance", "setRefiSecondBalance", "refiSecondRate", "setRefiSecondRate", "refiSecondPlan", "setRefiSecondPlan", "refiSecondPmtOverride", "setRefiSecondPmtOverride", "refiThirdLien", "setRefiThirdLien", "refiThirdKind", "setRefiThirdKind", "refiThirdBalance", "setRefiThirdBalance", "refiThirdRate", "setRefiThirdRate", "refiThirdPlan", "setRefiThirdPlan", "refiThirdPmtOverride", "setRefiThirdPmtOverride", "refiModified", "setRefiModified", "refiPrepayPenalty", "setRefiPrepayPenalty", "refiExtraCadence", "setRefiExtraCadence", "refiExtraOnceDate", "setRefiExtraOnceDate", "refiEscrowUnsure", "setRefiEscrowUnsure", "refiHasMaturity", "setRefiHasMaturity", "refiMaturityDate", "setRefiMaturityDate", "refiAnnualTax", "setRefiAnnualTax", "refiAnnualIns", "setRefiAnnualIns", "insEffectiveDate", "setInsEffectiveDate", "refiCurrentEscrow", "setRefiCurrentEscrow", "refiCurEscrowTax", "setRefiCurEscrowTax", "refiCurEscrowIns", "setRefiCurEscrowIns", "refiEscrowBalance", "setRefiEscrowBalance", "refiSkipMonths", "setRefiSkipMonths", "refiCurrentMI", "setRefiCurrentMI", "refiCashOut", "setRefiCashOut", "refiExtraPaid", "setRefiExtraPaid", "refiHomeValue", "setRefiHomeValue", "refiPayoffFees", "setRefiPayoffFees", "showRefi3", "setShowRefi3", "refiPreviewOpen", "setRefiPreviewOpen", "refiPayoffDebts", "setRefiPayoffDebts", "debts", "debtFree"]);
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
    refiHasStatement, setRefiHasStatement, refiEscrowMode, setRefiEscrowMode, refiEscrowCombined, setRefiEscrowCombined, refiEscrowCombinedPeriod, setRefiEscrowCombinedPeriod, refiSecondLien, setRefiSecondLien, refiSecondKind, setRefiSecondKind, refiSecondBalance, setRefiSecondBalance, refiSecondRate, setRefiSecondRate, refiSecondPlan, setRefiSecondPlan, refiSecondPmtOverride, setRefiSecondPmtOverride, refiThirdLien, setRefiThirdLien, refiThirdKind, setRefiThirdKind, refiThirdBalance, setRefiThirdBalance, refiThirdRate, setRefiThirdRate, refiThirdPlan, setRefiThirdPlan, refiThirdPmtOverride, setRefiThirdPmtOverride, refiModified, setRefiModified, refiPrepayPenalty, setRefiPrepayPenalty, refiExtraCadence, setRefiExtraCadence, refiExtraOnceDate, setRefiExtraOnceDate, refiEscrowUnsure, setRefiEscrowUnsure, refiPreviewOpen, setRefiPreviewOpen,
    refiHasMaturity, setRefiHasMaturity, refiMaturityDate, setRefiMaturityDate,
    refiAnnualTax, setRefiAnnualTax, refiAnnualIns, setRefiAnnualIns, insEffectiveDate, setInsEffectiveDate, refiCurrentEscrow, setRefiCurrentEscrow,
    refiCurEscrowTax, setRefiCurEscrowTax, refiCurEscrowIns, setRefiCurEscrowIns,
    refiEscrowBalance, setRefiEscrowBalance, refiSkipMonths, setRefiSkipMonths,
    refiCurrentMI, setRefiCurrentMI, refiCashOut, setRefiCashOut, refiExtraPaid, setRefiExtraPaid,
    refiHomeValue, setRefiHomeValue,
    refiPayoffFees, setRefiPayoffFees, showRefi3, setShowRefi3,
    refiPayoffDebts, setRefiPayoffDebts, debts, debtFree,
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

  // ── Flow-1 question nodes (Christo 2026-08-04): every yes/no question in
  // the current-loan walk rides together in Account Information, directly
  // below Escrow Balance — prepay, taxes/ins, maturity, second lien,
  // modified — while the amount sections sit in the statement's own order
  // further down. Defined once so flow 1 and flow 2 place them differently.
  // Top-level taxes/insurance question (+ unsure note).
  const taxInsQuestionNode = (<>
   {/* ── Taxes & insurance, asked the way the sheet asks it (Christo 2026-08-04) ──
       One top-level question, then a per-component walk: are taxes included,
       how much, is insurance included, how much — amounts entered monthly or
       annual. Stored per component (refiCurEscrowTax/Ins + annual amounts);
       answering here moves the calc to split mode. Flow 2 adds Unsure, which
       the confidence readout picks up. A legacy combined servicer line stays
       visible until the per-component answers replace it. */}
   {(() => {
    const escrowTop = refiEscrowUnsure === "unsure" ? "unsure"
     : (refiCurEscrowTax || refiCurEscrowIns || refiEscrowCombined > 0) ? "yes" : "no";
    const answerEscrow = (v) => {
     setRefiEscrowUnsure(v === "unsure" ? "unsure" : "");
     // The combined line drives the CURRENT payment when present; the split
     // amounts always feed the new loan's impound.
     if (v === "yes") { setRefiEscrowMode(refiEscrowCombined > 0 ? "combined" : "split"); if (!refiCurEscrowTax && !refiCurEscrowIns) { setRefiCurEscrowTax(true); setRefiCurEscrowIns(true); } }
     if (v === "no") { setRefiEscrowMode("split"); setRefiEscrowCombined(0); setRefiCurEscrowTax(false); setRefiCurEscrowIns(false); }
    };
    // Yes/No only — Unsure cells retired across the walk (Christo 2026-08-04);
    // legacy "unsure" values just render as unanswered.
    const escrowOpts = [["yes", "Yes"], ["no", "No"]];
    return (
     <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "8px 0" }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Taxes and/or insurance included in the payment?</span>
      <div style={{ display: "flex", gap: 5 }}>
       {escrowOpts.map(([v, label]) => (
        <button key={v} type="button" onClick={() => answerEscrow(v)}
         style={{ padding: "5px 14px", borderRadius: 9999, fontSize: 11, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
          background: escrowTop === v ? `${T.blue}22` : T.inputBg,
          border: escrowTop === v ? `2px solid ${T.blue}` : `1px solid ${T.separator}`,
          color: escrowTop === v ? T.blue : T.textSecondary }}>
         {label}
        </button>
       ))}
      </div>
     </div>
    );
   })()}
   {refiEscrowUnsure === "unsure" && (
    <div style={{ fontSize: 11, color: T.orange, fontWeight: 600, marginBottom: 10 }}>
     Marked unsure — it's flagged for verification below, and the current payment runs P&I-only until it's known.
    </div>
   )}
  </>);
  // Per-component breakdown — renders only while the answer is Yes.
  const taxInsBreakdownNode = (<>
   {refiEscrowUnsure !== "unsure" && (refiCurEscrowTax || refiCurEscrowIns || refiEscrowCombined > 0) && (
    <div style={{ marginBottom: 12 }}>
     {/* The statement's own escrow bucket comes FIRST — every statement prints
         one "Escrow (Taxes and Insurance)" line (Christo 2026-08-04). It
         drives the CURRENT payment; the breakdown below feeds the new loan. */}
     {!calc.refiFromStatement && (
     <div style={{ paddingTop: 8 }}>
      <Inp label={calc.refiFromStatement ? "Escrow (Taxes and Insurance) — as printed on the statement" : "Escrow (Taxes and Insurance) — combined"}
       value={refiEscrowCombined}
       onChange={(v) => { setRefiEscrowCombined(v); setRefiEscrowMode((Number(v) || 0) > 0 ? "combined" : "split"); }}
       tip="The single escrow line the statement prints — what the servicer collects, cushion and shortage spread included. It drives the CURRENT payment; the per-component breakdown below feeds the new loan's impound."
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
     </div>
     )}
     {[
      { key: "tax", label: "Taxes", q: "Are taxes included?", on: refiCurEscrowTax, setOn: setRefiCurEscrowTax,
        amt: refiAnnualTax, setAmt: setRefiAnnualTax,
        hint: "Prefilled from the county assessor once the address is known." },
      { key: "ins", label: "Insurance", q: "Is insurance included?", on: refiCurEscrowIns, setOn: setRefiCurEscrowIns,
        amt: refiAnnualIns, setAmt: setRefiAnnualIns,
        hint: "The policy premium — carries over on a refi." },
     ].map(c => (
      <div key={c.key} style={{ paddingTop: 8 }}>
       <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{c.q}</span>
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
      These feed the NEW loan's impound. Enter the real annual tax bill and premium — not a division of
      the servicer's escrow line, which carries cushion and any shortage spread; splitting that would
      import the old servicer's shortage into your quote. Also check they aren't bundling mortgage
      insurance into the escrow line; if they are, it's already counted under MI/MIP.
     </div>
    </div>
   )}
  </>);
  // Standalone annual amounts — renders only while the answer is No/Unsure.
  const taxInsAmountsNoNode = (<>
   {/* The amounts are needed EITHER WAY (Christo 2026-08-04): taxes and
       insurance feed the NEW loan's payment breakdown and the true monthly
       cost whether or not the current payment impounds them — so when the
       answer above is No or Unsure, ask for the annual amounts on their own. */}
   {!(refiEscrowUnsure !== "unsure" && (refiCurEscrowTax || refiCurEscrowIns || refiEscrowCombined > 0)) && (
    <div style={{ marginBottom: 12 }}>
     {[
      { key: "tax", label: "Property taxes — annual", amt: refiAnnualTax, setAmt: setRefiAnnualTax,
        hint: "Paid separately today, but the new loan still needs it — prefilled from the county assessor once the address is known." },
      { key: "ins", label: "Homeowner's insurance — annual", amt: refiAnnualIns, setAmt: setRefiAnnualIns,
        hint: "Paid separately today, but the policy carries over on a refi and rides in the true monthly cost." },
     ].map(c => {
      const per = c.key === "tax" ? refiTaxPeriod : refiInsPeriod;
      const setPer = c.key === "tax" ? setRefiTaxPeriod : setRefiInsPeriod;
      const shown = per === "mo" ? Math.round((c.amt / 12) * 100) / 100 : c.amt;
      const store = (v) => c.setAmt(per === "mo" ? (Number(v) || 0) * 12 : (Number(v) || 0));
      return (
       <div key={c.key} style={{ paddingTop: 8 }}>
        <Inp label={c.label} value={shown} onChange={store} sm tip={c.hint}
         rightSlot={
          <span style={{ display: "flex", gap: 3, flexShrink: 0 }}>
           {[["mo", "Monthly"], ["yr", "Annual"]].map(([v, label]) => (
            <button key={v} type="button" onClick={() => setPer(v)}
             style={{ padding: "3px 9px", borderRadius: 9999, fontSize: 10, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
              background: per === v ? `${T.blue}22` : "transparent",
              border: per === v ? `1px solid ${T.blue}` : `1px solid ${T.separator}`,
              color: per === v ? T.blue : T.textTertiary }}>
             {label}
            </button>
           ))}
          </span>
         } />
       </div>
      );
     })}
     <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.5, paddingTop: 8 }}>
      Not in the mortgage payment, but never optional — these drive the new loan's payment breakdown
      and the true monthly cost either way.
     </div>
    </div>
   )}
  </>);
  // Maturity question + branches (internally flow-1 gated).
  const maturityQuestionNode = (<>
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

   </>)}
  </>);
  // Maturity branches + THAT GIVES US — unlock in the original spot in the
  // walk, not under the question (Christo 2026-08-04).
  const maturityDetailNode = (<>
   {calc.refiFromStatement && (<>
    {refiHasMaturity === "yes" && (
     <div style={{ marginBottom: 12 }}>
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
     <div style={{ marginBottom: 12 }}>
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
      <Inp label="Original Term" value={refiOriginalTerm} onChange={setRefiOriginalTerm} prefix="" suffix="years" max={50} sm
       tip="The note's original term — with the amount and funded date, the maturity falls out." />
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
  </>);
  // Second mortgage / HELOC question + branch.
  const secondLienQuestionRow = (<>
   <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "8px 0" }}>
    <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Any second mortgage or HELOC?</span>
    <YesNoSeg T={T} value={refiSecondLien} onYes={() => setRefiSecondLien(true)} onNo={() => setRefiSecondLien(false)} />
   </div>
  </>);
  // Second-lien cells — unlock where the section originally lived.
  // One reusable cluster per junior lien (2026-08-07): CalHFA stacks are
  // routinely 1st + MyHome 2nd (1% simple, deferred — no payment) + ZIP 3rd
  // (0%, deferred). "Deferred (DPA)" kind autos the payment to $0; the payment
  // field itself is editable on every kind (0 sticks — null means auto).
  const lienCluster = ({ ord, kind, setKind, balance, setBalance, rate, setRate, plan, setPlan, pmtOverride, setPmtOverride, pmtAuto, pmt }) => (
    <>
     <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "6px 0" }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary }}>Which kind?</span>
      <div style={{ display: "flex", gap: 5 }}>
       {[["heloc", "HELOC"], ["closed", `Fixed ${ord}`], ["deferred", "Deferred (DPA)"]].map(([v, label]) => (
        <button key={v} type="button" onClick={() => setKind(v)}
         style={{ padding: "5px 14px", borderRadius: 9999, fontSize: 11, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
          background: kind === v ? `${T.blue}22` : T.inputBg,
          border: kind === v ? `2px solid ${T.blue}` : `1px solid ${T.separator}`,
          color: kind === v ? T.blue : T.textSecondary }}>
         {label}
        </button>
       ))}
      </div>
     </div>
     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <Inp label={`${ord[0].toUpperCase() + ord.slice(1)} Balance`} value={balance} onChange={setBalance} sm
       tip={kind === "heloc" ? "The drawn balance — not the credit limit."
          : kind === "deferred" ? "The payoff balance from the servicer — for CalHFA MyHome include the accrued simple interest."
          : `Remaining principal on the closed-end ${ord}.`} />
      <Inp label={`${ord[0].toUpperCase() + ord.slice(1)} Rate`} value={rate} onChange={setRate} prefix="" suffix="%" step={0.125} max={30} sm
       tip={kind === "heloc" ? "Usually prime plus a margin, so it moves — that variability is often the reason to consolidate."
          : kind === "deferred" ? "The note rate — CalHFA MyHome is 1% simple; ZIP is 0%. No payments either way."
          : `Fixed for the life of the ${ord}.`} />
     </div>
     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "end" }}>
      <Inp label={`${ord[0].toUpperCase() + ord.slice(1)} Payment`} value={pmtOverride ?? Math.round(pmt * 100) / 100} onChange={setPmtOverride} suffix="/mo" sm
       tip="What the borrower actually pays monthly. Deferred DPA liens (CalHFA MyHome, ZIP) bill nothing — that's $0, and $0 sticks." />
      <div style={{ fontSize: 10, color: T.textTertiary, paddingBottom: 10, lineHeight: 1.4 }}>
       {pmtOverride == null
        ? (kind === "deferred" ? "Auto: no payment — deferred lien." : `Auto: interest-only floor${pmtAuto > 0 ? ` (${fmt(pmtAuto)}/mo)` : ""}.`)
        : (<span onClick={() => setPmtOverride(null)} style={{ cursor: "pointer", textDecoration: "underline" }}>
           Pinned — reset to auto{kind === "deferred" ? " ($0, deferred)" : pmtAuto > 0 ? ` (${fmt(pmtAuto)}/mo)` : ""}
          </span>)}
      </div>
     </div>
     <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "6px 0" }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary }}>Pay it off, or subordinate it?</span>
      <div style={{ display: "flex", gap: 5 }}>
       {[["sub", "Subordinate"], ["payoff", "Pay off"]].map(([v, label]) => (
        <button key={v} type="button" onClick={() => setPlan(v)}
         style={{ padding: "5px 14px", borderRadius: 9999, fontSize: 11, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
          background: plan === v ? `${T.blue}22` : T.inputBg,
          border: plan === v ? `2px solid ${T.blue}` : `1px solid ${T.separator}`,
          color: plan === v ? T.blue : T.textSecondary }}>
         {label}
        </button>
       ))}
      </div>
     </div>
    </>
  );
  const secondLienDetailNode = (<>
   {refiSecondLien && (
    <div style={{ marginLeft: 12, paddingLeft: 12, borderLeft: `2px solid ${T.blue}33`, marginBottom: 10 }}>
     {lienCluster({ ord: "second", kind: refiSecondKind, setKind: setRefiSecondKind, balance: refiSecondBalance, setBalance: setRefiSecondBalance, rate: refiSecondRate, setRate: setRefiSecondRate, plan: refiSecondPlan, setPlan: setRefiSecondPlan, pmtOverride: refiSecondPmtOverride, setPmtOverride: setRefiSecondPmtOverride, pmtAuto: calc.refiSecondPmtAuto || 0, pmt: calc.refiSecondPmt || 0 })}
     <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "8px 0" }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>A third lien behind that?</span>
      <YesNoSeg T={T} value={refiThirdLien} onYes={() => setRefiThirdLien(true)} onNo={() => setRefiThirdLien(false)} />
     </div>
     {refiThirdLien && (
      <div style={{ marginLeft: 12, paddingLeft: 12, borderLeft: `2px solid ${T.blue}33`, marginBottom: 6 }}>
       {lienCluster({ ord: "third", kind: refiThirdKind, setKind: setRefiThirdKind, balance: refiThirdBalance, setBalance: setRefiThirdBalance, rate: refiThirdRate, setRate: setRefiThirdRate, plan: refiThirdPlan, setPlan: setRefiThirdPlan, pmtOverride: refiThirdPmtOverride, setPmtOverride: setRefiThirdPmtOverride, pmtAuto: calc.refiThirdPmtAuto || 0, pmt: calc.refiThirdPmt || 0 })}
      </div>
     )}
     {refiSecondBalance > 0 && calc.refiEffBalance > 0 && (
      <Note color={T.blue}>
       Together that's {fmt(calc.refiEffBalance + calc.refiSecondBal + (calc.refiThirdBal || 0))} at a blended{" "}
       <strong>{calc.refiBlendedRate.toFixed(3)}%</strong>
       {refiSecondPlan === "payoff"
        ? ` — paying the ${calc.refiThirdBal > 0 ? "juniors" : "second"} off means the new first has to beat that blend, not the ${refiCurrentRate.toFixed(3)}% first alone. ${fmt(calc.refiSecondPayoffAmt + (calc.refiThirdPayoffAmt || 0))} of payoffs roll into the new loan and any payments count toward the savings.`
        : ` — subordinating leaves the ${(refiSecondRate || 0).toFixed(3)}% balance in place${refiSecondKind === "heloc" ? " and still floating." : "."}`}
       {refiHomeValue > 0 && ` CLTV ${(calc.refiCLTV * 100).toFixed(1)}%.`}
       {calc.refiLienPmtCur > 0
        ? ` Carry is about ${fmt(calc.refiLienPmtCur)}/mo${refiSecondKind === "heloc" ? " interest-only." : " minimum."}`
        : ` No monthly payments on the junior lien${calc.refiThirdBal > 0 ? "s" : ""} — the balance${calc.refiThirdBal > 0 ? "s" : ""} come${calc.refiThirdBal > 0 ? "" : "s"} due at payoff, sale, or refinance.`}
      </Note>
     )}
    </div>
   )}
  </>);
  const secondLienNode = (<>{secondLienQuestionRow}{secondLienDetailNode}</>);
  const modifiedQuestionNode = (
   <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "8px 0" }}>
    <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Ever modified, or in forbearance since origination?</span>
    <div style={{ display: "flex", gap: 5 }}>
     {[["yes", "Yes"], ["no", "No"]].map(([v, label]) => (
      <button key={v} type="button" onClick={() => setRefiModified(v)}
       style={{ padding: "5px 14px", borderRadius: 9999, fontSize: 11, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
        background: refiModified === v ? `${T.blue}22` : T.inputBg,
        border: refiModified === v ? `2px solid ${T.blue}` : `1px solid ${T.separator}`,
        color: refiModified === v ? T.blue : T.textSecondary }}>
       {label}
      </button>
     ))}
    </div>
   </div>
  );
  // Insurance effective (anniversary) date + renewal-window note.
  const insEffectiveDateNode = (<>
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
  </>);
  // Closing-month payment — a Yes/No like the rest of the cluster, AUTO from
  // the calendar (grace-day rule) until the LO overrides; ↺ returns to auto
  // (Christo 2026-08-04 — was a switch stranded below the receipt).
  const closingPmtQuestionNode = (refiCurrentBalance > 0 && calc.refiMonthsToClose >= 1) ? (
   <div style={{ padding: "8px 0" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
     <span style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: "-0.01em", display: "inline-flex", alignItems: "center", gap: 6 }}>
      {["January","February","March","April","May","June","July","August","September","October","November","December"][(closingMonth - 1 + 12) % 12]} payment made before closing?
      {refiClosingPmtOverride == null && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: T.blue, background: `${T.blue}14`, border: `1px solid ${T.blue}30`, borderRadius: 9999, padding: "1px 6px" }}>AUTO</span>}
     </span>
     <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {/* Same YesNoSeg as every other cluster row (Christo 2026-08-04). */}
      <YesNoSeg T={T} value={calc.refiAssumeClosingPmt} onYes={() => setRefiClosingPmtOverride(true)} onNo={() => setRefiClosingPmtOverride(false)} />
      {refiClosingPmtOverride != null && (
       <button type="button" onClick={() => setRefiClosingPmtOverride(null)} title="Back to auto" style={{ background: "none", border: "none", color: T.blue, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: FONT }}>↺</button>
      )}
     </div>
    </div>
    <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2, lineHeight: 1.5 }}>
     {calc.refiAssumeClosingPmt
      ? `Closing after the ${calc.refiGraceDay}th — this payment is due first, so we assume it's made. Payoff accrues ${calc.refiPayoffDays} days from ${calc.refiPayoffEffLabel}.`
      : `Closing on/before the ${calc.refiGraceDay}th grace day — still within the window, so we don't assume it yet.`}
    </div>
   </div>
  ) : null;
  // Prepayment penalty — one of the cluster questions.
  const prepayQuestionNode = (<>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "8px 0" }}>
     <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Prepayment penalty?</span>
     <div style={{ display: "flex", gap: 5 }}>
      {[["yes", "Yes"], ["no", "No"]].map(([v, label]) => (
       <button key={v} type="button" onClick={() => setRefiPrepayPenalty(v)}
        style={{ padding: "5px 14px", borderRadius: 9999, fontSize: 11, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
         background: refiPrepayPenalty === v ? `${T.blue}22` : T.inputBg,
         border: refiPrepayPenalty === v ? `2px solid ${T.blue}` : `1px solid ${T.separator}`,
         color: refiPrepayPenalty === v ? T.blue : T.textSecondary }}>
        {label}
       </button>
      ))}
     </div>
    </div>
  </>);
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
  {/* Live PDF preview toggle — floats the actual Refi Summary alongside the
      intake so the LO watches the deliverable build (Ops flyer pattern). */}
  {isDesktop && !!setRefiPreviewOpen && (
   <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, marginBottom: -4 }}>
    <button type="button" onClick={() => setRefiPreviewOpen(v => !v)}
     style={{ padding: "6px 16px", borderRadius: 9999, fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
      background: refiPreviewOpen ? `${T.blue}22` : T.inputBg,
      border: refiPreviewOpen ? `2px solid ${T.blue}` : `1px solid ${T.separator}`,
      color: refiPreviewOpen ? T.blue : T.textSecondary }}>
     {refiPreviewOpen ? "✕ Close live PDF preview" : "Live PDF preview"}
    </button>
   </div>
  )}
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
   {/* Every Yes/No in the walk rides here with the statement question,
       above Account Information — Modules-card style: bold question, gray
       subtitle, pills on the right (Christo 2026-08-04). Questions ONLY;
       whatever a Yes unlocks appears in its original place in the walk. */}
   {calc.refiFromStatement && (<>
    {[
     { t: "Taxes and/or insurance included in the payment?", sub: "The statement's combined Escrow (Taxes and Insurance) line — entered below, where the statement prints it.",
       v: refiEscrowUnsure === "unsure" ? null : (refiCurEscrowTax || refiCurEscrowIns || refiEscrowCombined > 0),
       yes: () => { setRefiEscrowUnsure(""); setRefiEscrowMode(refiEscrowCombined > 0 ? "combined" : "split"); if (!refiCurEscrowTax && !refiCurEscrowIns) { setRefiCurEscrowTax(true); setRefiCurEscrowIns(true); } },
       no: () => { setRefiEscrowUnsure(""); setRefiEscrowMode("split"); setRefiEscrowCombined(0); setRefiCurEscrowTax(false); setRefiCurEscrowIns(false); } },
     { t: "Any second mortgage or HELOC?", sub: "A second lien changes the payoff, the blended rate, and the CLTV.",
       v: refiSecondLien, yes: () => setRefiSecondLien(true), no: () => setRefiSecondLien(false) },
     // Cash-out only — consolidation is half the reason cash-outs happen
     // (Christo 2026-08-25). A Yes unlocks the debt list further down the
     // walk, next to the Cash Out Amount.
     ...(refiPurpose === "Cash-Out" ? [
      { t: "Paying off any other non-mortgage debt?", sub: "Credit cards, student loans, autos — their balances roll into the new loan and the retired payments join the savings.",
        v: refiPayoffDebts, yes: () => setRefiPayoffDebts(true), no: () => setRefiPayoffDebts(false) },
     ] : []),
     { t: "Does the statement include a maturity date?", sub: "If printed we use it as-is; if not, we work backwards from the original note below.",
       v: refiHasMaturity === "" ? null : refiHasMaturity === "yes",
       yes: () => setRefiHasMaturity("yes"), no: () => setRefiHasMaturity("no") },
     { t: "Prepayment penalty?", sub: "Printed in the statement's Account Information box.",
       v: refiPrepayPenalty === "yes" ? true : refiPrepayPenalty === "no" ? false : null,
       yes: () => setRefiPrepayPenalty("yes"), no: () => setRefiPrepayPenalty("no") },
     { t: "Ever modified, or in forbearance since origination?", sub: "A modification rewrites the terms, and seasoning rules may apply.",
       v: refiModified === "yes" ? true : refiModified === "no" ? false : null,
       yes: () => setRefiModified("yes"), no: () => setRefiModified("no") },
    ].map((row) => (
     <div key={row.t} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", padding: "12px 0 10px", borderTop: `1px solid ${T.separator}`, marginTop: 2 }}>
      <div style={{ flex: 1, minWidth: 200 }}>
       <div style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: "-0.01em" }}>{row.t}</div>
       <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2, lineHeight: 1.4 }}>{row.sub}</div>
      </div>
      <YesNoSeg T={T} value={row.v} onYes={row.yes} onNo={row.no} />
     </div>
    ))}
    {/* Timing questions ride in the cluster too (Christo 2026-08-04):
        last payment + closing date + the closing-month payment. */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", padding: "12px 0 10px", borderTop: `1px solid ${T.separator}`, marginTop: 2 }}>
     <div style={{ flex: 1, minWidth: 200 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: "-0.01em", display: "inline-flex", alignItems: "center", gap: 6 }}>
       Last payment made
       {!refiLastPaymentDate && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: T.blue, background: `${T.blue}14`, border: `1px solid ${T.blue}30`, borderRadius: 9999, padding: "1px 6px" }}>AUTO</span>}
      </div>
      <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2, lineHeight: 1.4 }}>We assume last month — or this month once past the 15th. Override if the statement says otherwise.</div>
     </div>
     <select value={(refiLastPaymentDate || calc.refiLastPaymentEff || "").slice(5, 7)} onChange={e => { const m = e.target.value; if (!m) { setRefiLastPaymentDate(""); return; } const now = new Date(); const y = Number(m) > now.getMonth() + 1 ? now.getFullYear() - 1 : now.getFullYear(); setRefiLastPaymentDate(`${y}-${m}-01`); }} style={{ background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, boxSizing: "border-box", height: 40, padding: "8px 12px", color: T.text, fontSize: 13, fontWeight: 500, outline: "none", fontFamily: FONT, width: 170 }}>
      <option value="">Auto</option>
      {["January","February","March","April","May","June","July","August","September","October","November","December"].map((mo, i) => <option key={i} value={String(i+1).padStart(2,"0")}>{mo}</option>)}
     </select>
    </div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", padding: "12px 0 10px", borderTop: `1px solid ${T.separator}`, marginTop: 2 }}>
     <div style={{ flex: 1, minWidth: 200 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: "-0.01em" }}>Estimated closing date</div>
      <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2, lineHeight: 1.4 }}>Drives prepaid interest, payoff per-diem days, and how many payments get skipped.</div>
     </div>
     <input
      type="date"
      value={`${closingYear || new Date().getFullYear()}-${String(closingMonth).padStart(2, "0")}-${String(closingDay).padStart(2, "0")}`}
      onChange={e => {
       const [y, m, d] = e.target.value.split("-").map(Number);
       if (y && m && d) { setClosingYear(y); setClosingMonth(m); setClosingDay(d); }
      }}
      style={{ width: 170, boxSizing: "border-box", height: 40, background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "11px 14px", color: T.text, fontSize: 14, outline: "none", fontFamily: FONT }}
     />
    </div>
    {closingPmtQuestionNode && (
     <div style={{ borderTop: `1px solid ${T.separator}`, marginTop: 2 }}>{closingPmtQuestionNode}</div>
    )}
   </>)}
  </Card>
  <Card>
   {/* ── One column, line by line, in the STATEMENT's own format (Christo
       2026-08-04): every servicer prints the same two boxes — Account
       Information (outstanding principal, rate, prepayment penalty, escrow
       balance) then Explanation of Amount Due (principal, interest, escrow,
       mortgage insurance → Regular Monthly Payment) — so Flow 1 mirrors them
       section for section. Flow 2 (no statement) works backwards from the
       original note. Loan type and fixed/adjustable aren't printed in the box
       but the math needs them, so they ride under the rate in both flows. */}
   {calc.refiFromStatement && (<>
    <div style={{ fontSize: 11, fontWeight: 600, color: T.textTertiary, fontFamily: MONO, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>
     Account Information
    </div>
    <Inp label="Outstanding Principal Balance" value={refiCurrentBalance} onChange={setRefiCurrentBalance} req tip="Straight off the statement's Account Information box. Not the payoff amount — the payoff runs about a month of interest ahead; we calculate that below. When set, this anchors everything." />
   </>)}
   <Inp label="Current Interest Rate" value={refiCurrentRate} onChange={setRefiCurrentRate} prefix="" suffix="%" step={0.125} max={30} req tip="The note rate today. On an adjusted ARM this is the rate it adjusted TO." />
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
   {calc.refiFromStatement && (<>
    {/* Escrow balance + prepayment penalty print in the SAME Account
        Information box, so they're asked here — not three sections later.
        Balance first, penalty second (Christo 2026-08-04). */}
    <Inp label="Escrow Balance" value={refiEscrowBalance} onChange={setRefiEscrowBalance}
     tip="As printed in Account Information. Money sitting in the escrow account — refunded after the old loan pays off. $0 when nothing is impounded." />
    <div style={{ fontSize: 11, fontWeight: 600, color: T.textTertiary, fontFamily: MONO, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 16, marginBottom: 10 }}>
     Explanation of Amount Due
    </div>
   </>)}
   {!calc.refiFromStatement && (<>
    <Inp label="Original Balance" value={refiOriginalAmount} onChange={setRefiOriginalAmount} req
     tip="The original note amount — look it up on the property profile (the recorded deed of trust amount)." />
   </>)}
   {!calc.refiFromStatement && (
   <div style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6, fontFamily: FONT }}>Loan Closed In <span style={{ fontSize: 11, color: T.textTertiary, fontWeight: 400 }}>· from the property profile</span></label>
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
   )}
   {!calc.refiFromStatement && (
    <Inp label="Original Term" value={refiOriginalTerm} onChange={setRefiOriginalTerm} prefix="" suffix="years" max={50} req tip="Without the original term there is nothing to amortize against — a 30 and a 15 diverge from the first payment." />
   )}
   {/* ── Extra payments (Christo 2026-07-28) ──
       Two columns matching the Amortization tab's control: the switch on the
       left says whether there ARE extra payments, the amount sits beside it.
       Cadence and the lump-sum date only appear once the switch is on, so the
       off state is two tiles instead of a stack of questions. */}
   {!calc.refiFromStatement && refiClosedDate && (<>
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
   {!calc.refiFromStatement && refiOriginalAmount > 0 && refiCurrentRate > 0 && (<div style={{ background: `${T.blue}10`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
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
   {calc.refiFromStatement && calc.refiSolvedTerm > 0 && calc.refiSolvedMaturity && (
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
   {!calc.refiFromStatement && refiOriginalAmount > 0 && refiCurrentRate > 0 && refiClosedDate && (
    <div style={{ fontSize: 11, color: T.textTertiary, marginTop: -8, marginBottom: 12, lineHeight: 1.5 }}>
     Estimate assumes minimum payments at {refiCurrentRateType === "Adjustable" ? "the rates entered above" : "the same rate"} since closing — it will be off for extra principal payments{refiCurrentRateType === "Adjustable" ? "" : " or an ARM that has adjusted"}. A statement balance below overrides it.
    </div>
   )}
   {/* Statement anchors — the servicer's number beats any estimate, and the
       last-payment month is what per-diem payoff interest accrues from
       (payments pay interest in ARREARS: a July 1 payment covers June).
       Hidden entirely in the reconstruct branch: there is no statement to read
       them off, and the calc ignores them there too (Christo 2026-07-28). */}
   {calc.refiFromStatement && (<>
    {/* The statement's own principal/interest split (Christo 7.28). Deriving
        it (interest = balance × rate) is only ever an approximation — the
        servicer's split reflects the real accrual. Entering BOTH pins this
        month's P&I to their sum, so the payoff walk and every savings figure
        run off the statement instead of our estimate. Same state the lockable
        cells on the Refi tab's Monthly Payment table write to. */}
    <Inp label="Principal — from statement" value={refiCurPrinOverride} onChange={setRefiCurPrinOverride} tip="This month's principal portion, straight off the statement. Leave at 0 to derive it (payment minus interest)." />
    <Inp label="Interest — from statement" value={refiCurIntOverride} onChange={setRefiCurIntOverride} tip="This month's interest portion, straight off the statement. Leave at 0 to derive it (balance × rate ÷ 12)." />
    {/* Every statement combines the escrow line items into ONE line —
        "Escrow (Taxes and Insurance)" — so it's entered exactly there
        (Christo 2026-08-04). Drives the CURRENT payment; the tax &
        insurance section below the receipt feeds the new loan. */}
    <Inp label="Escrow (Taxes and Insurance) — from statement" value={refiEscrowCombined}
     onChange={(v) => { setRefiEscrowCombined(v); setRefiEscrowMode((Number(v) || 0) > 0 ? "combined" : "split"); }}
     tip="The statement's single escrow line — what the servicer collects each month, cushion and shortage spread included. $0 when nothing is impounded."
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
   </>)}
   {!calc.refiFromStatement && (<>
    {taxInsQuestionNode}
    {taxInsBreakdownNode}
    {taxInsAmountsNoNode}
   </>)}
   {/* No impounds means no escrow account, so the balance question is removed
       rather than asked and answered zero. Flow 1 reads the balance in the
       Account Information section instead — the statement prints it there. */}
   {!calc.refiFromStatement && (calc.refiEscrowOn
    ? <Inp label="Escrow Balance" value={refiEscrowBalance} onChange={setRefiEscrowBalance} sm
       tip="Money sitting in the escrow account — refunded after the old loan pays off. Printed on the statement, so read it rather than ask." />
    : <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.5, marginBottom: 12 }}>
       Nothing is impounded, so there's no escrow account and no balance to refund.
      </div>)}
   {/* Mortgage insurance follows escrow — the statement's own line order in
       Explanation of Amount Due (Christo 2026-08-04). */}
   <Inp label="PMI / MIP" value={refiCurrentMI} onChange={setRefiCurrentMI}
    tip={calc.refiFromStatement ? "The Mortgage Insurance line in Explanation of Amount Due. Zero if there is none." : "Monthly mortgage insurance on the current loan, if any — estimate it if unknown (FHA loans from the original amount, conventional from the LTV at closing)."} />
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
   {calc.refiFromStatement && (<>
    <div style={{ fontSize: 11, fontWeight: 600, color: T.textTertiary, fontFamily: MONO, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 16, marginBottom: 10 }}>
     Current Property Taxes &amp; Insurance
    </div>
    {taxInsBreakdownNode}
    {taxInsAmountsNoNode}
    {insEffectiveDateNode}
   </>)}
   {!calc.refiFromStatement && closingPmtQuestionNode}
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
   {(refiAnnualTax > 0 || refiAnnualIns > 0) && (
    <div style={{ fontSize: 11, color: T.green, fontWeight: 600, marginTop: -4, marginBottom: 10 }}>
     ✓ Monthly: {refiAnnualTax > 0 ? `Tax ${fmt(refiAnnualTax / 12)}` : ""}{refiAnnualTax > 0 && refiAnnualIns > 0 ? " + " : ""}{refiAnnualIns > 0 ? `Ins ${fmt(refiAnnualIns / 12)}` : ""} = {fmt((refiAnnualTax + refiAnnualIns) / 12)}/mo
    </div>
   )}
   {maturityDetailNode}
   {calc.refiFromStatement && secondLienDetailNode}
   {!calc.refiFromStatement && (<>
   {/* ── Other liens & history (Christo 2026-07-28) ──
       A second has to be subordinated or paid off, and that choice moves the
       new loan amount and the CLTV. Its RATE is what earns the question: the
       new first has to beat the blended cost of both liens, not the first's
       rate alone. Modification and prepayment penalty are one question each,
       and both are printed on most statements. */}
   <div style={{ fontSize: 11, fontWeight: 600, color: T.textTertiary, fontFamily: MONO, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 16, marginBottom: 10 }}>
    Other Liens &amp; History
   </div>
   {secondLienNode}
   {[
    { label: "Ever modified, or in forbearance since origination?", value: refiModified, set: setRefiModified },
    // Flow 1 asks prepayment penalty up in Account Information — the
    // statement prints it there. Only the reconstruct flow asks it here.
    ...(!calc.refiFromStatement ? [{ label: "Prepayment penalty on the current note?", value: refiPrepayPenalty, set: setRefiPrepayPenalty }] : []),
   ].map((q) => (
    <div key={q.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "8px 0", borderTop: `1px dashed ${T.separator}` }}>
     <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{q.label}</span>
     <div style={{ display: "flex", gap: 5 }}>
      {[["yes", "Yes"], ["no", "No"]].map(([v, label]) => (
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
   </>)}
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
   {!calc.refiFromStatement && insEffectiveDateNode}
   {/* The old standalone "Included in the current payment?" toggle section is
       gone (2026-08-04) — it drove the SAME refiCurEscrowTax/Ins flags as the
       taxes-and-insurance questions above, so it was the same question asked
       twice. The combined-monthly fallback stays for when the amounts are
       unknown but something is impounded. */}
   {calc.refiEscrowOn && refiAnnualTax <= 0 && refiAnnualIns <= 0 && (
    <Inp label="Current Monthly Escrow (Tax+Ins)" value={refiCurrentEscrow} onChange={setRefiCurrentEscrow} tip="If you don't know the annual amounts, enter your combined monthly escrow here." />
   )}
   {/* Estimated closing date drives the skipped-payment count — it is a
       function of the calendar, not a choice, so the old dropdown is gone
       (Christo 2026-07-22): fund by the 15th → skip 2, after → skip 1. */}
   {/* Both cells share a fixed-height label row and identical control heights
       so the date input and the pill sit on the same baseline (doc 7.23) —
       the explainer caption moved below the grid so it can't push the pill up. */}
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "start" }}>
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
      <div style={{ fontSize: 10, color: T.textTertiary }}>{(calc.refiSecondPayoffAmt > 0 || calc.refiThirdPayoffAmt > 0 || calc.refiDebtPayoffTotal > 0) ? "First Lien Payoff" : "Payoff Amount"}</div>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: T.blue }}>{fmt(calc.refiPayoffAmount)}</div>
     </div>
     {/* Paid-off juniors + consolidated debts ride along: balance + per-diem. */}
     {(calc.refiSecondPayoffAmt > 0 || calc.refiThirdPayoffAmt > 0 || calc.refiDebtPayoffTotal > 0) && (<>
      {calc.refiSecondPayoffAmt > 0 && (
       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
        <div style={{ fontSize: 10, color: T.textTertiary }}>+ {refiSecondKind === "heloc" ? "HELOC" : "Second"} Payoff{calc.refiSecondPayoffInterest > 0 ? ` (incl. ${fmt(calc.refiSecondPayoffInterest)} interest, ${calc.refiSecondPayoffDays}d)` : ""}</div>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.refiSecondPayoffAmt)}</div>
       </div>
      )}
      {calc.refiThirdPayoffAmt > 0 && (
       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
        <div style={{ fontSize: 10, color: T.textTertiary }}>+ Third Payoff{calc.refiThirdPayoffInterest > 0 ? ` (incl. ${fmt(calc.refiThirdPayoffInterest)} interest, ${calc.refiThirdPayoffDays}d)` : ""}</div>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.refiThirdPayoffAmt)}</div>
       </div>
      )}
      {calc.refiDebtPayoffTotal > 0 && (
       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
        <div style={{ fontSize: 10, color: T.textTertiary }}>+ Other Debt Payoffs ({(calc.refiPaidDebts || []).length} debt{(calc.refiPaidDebts || []).length === 1 ? "" : "s"})</div>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.refiDebtPayoffTotal)}</div>
       </div>
      )}
      <div style={{ borderTop: `1px solid ${T.blue}33`, marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
       <div style={{ fontSize: 10, color: T.textTertiary }}>Total Payoffs</div>
       <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: T.blue }}>{fmt(calc.refiPayoffAmount + calc.refiSecondPayoffAmt + (calc.refiThirdPayoffAmt || 0) + (calc.refiDebtPayoffTotal || 0))}</div>
      </div>
     </>)}
    </div>
   )}
   {/* Debt consolidation — the other half of a cash-out (Christo 2026-08-25).
       The debts LIVE on the Debts tab (single source of truth); this lens
       lists the non-mortgage ones and flips each one's "Payoff at Close?"
       flag. Marked debts roll their payoff into the new loan and their
       retired payment onto the current side of every savings comparison. */}
   {refiPurpose === "Cash-Out" && (<>
    {/* Statement flow asks this up in the question cluster; the walk keeps
        the row only when there's no cluster to carry it. */}
    {!calc.refiFromStatement && (
     <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "8px 0" }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Paying off any other non-mortgage debt?</span>
      <YesNoSeg T={T} value={refiPayoffDebts} onYes={() => setRefiPayoffDebts(true)} onNo={() => setRefiPayoffDebts(false)} />
     </div>
    )}
    {refiPayoffDebts === true && (() => {
     const consumerDebts = (debts || []).filter(d => d.type !== "Mortgage" && d.type !== "HELOC");
     const CONSUMER_TYPES = ["Revolving", "Student Loan", "Auto Loan", "Auto Lease", "Installment", "Collection", "Other"];
     return (
      <div style={{ background: `${T.blue}08`, border: `1px solid ${T.blue}22`, borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
       {debtFree ? (
        <Note color={T.orange}>The Debts tab says debt-free — turn that off there to consolidate debts here.</Note>
       ) : (<>
        <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.5, marginBottom: consumerDebts.length ? 8 : 4 }}>
         Balance, rate and payment drive the consolidation math — the balance rolls into the new loan, the payment joins the savings. These are the same debts as the Debts tab.
        </div>
        {consumerDebts.map((d) => {
         const on = d.payoff === "Yes - at Escrow";
         return (
          <div key={d.id} style={{ padding: "8px 0", borderBottom: `1px solid ${T.separator}` }}>
           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <button onClick={() => calc.updateDebt(d.id, "payoff", on ? "No" : "Yes - at Escrow")} style={{
             padding: "5px 14px", borderRadius: 9999, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT, transition: "all 0.2s",
             background: on ? `${T.green}18` : T.inputBg, color: on ? T.green : T.textSecondary,
             border: on ? `1.5px solid ${T.green}` : `1px solid ${T.separator}`,
            }}>{on ? "✓ Paying off" : "Pay off with refi"}</button>
            <button onClick={() => calc.removeDebt(d.id)} style={{ background: "none", border: "none", color: T.red, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>Remove</button>
           </div>
           <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 8 }}>
            <TextInp label="Creditor" value={d.name} onChange={(v) => calc.updateDebt(d.id, "name", v)} sm />
            <Sel label="Type" value={d.type} onChange={(v) => calc.updateDebt(d.id, "type", v)} options={CONSUMER_TYPES} sm />
           </div>
           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <Inp label="Balance" value={d.balance} onChange={(v) => calc.updateDebt(d.id, "balance", v)} sm />
            <Inp label="Rate" value={d.rate} onChange={(v) => calc.updateDebt(d.id, "rate", v)} prefix="" suffix="%" step={0.01} sm />
            <Inp label="Monthly Pmt" value={d.monthly} onChange={(v) => calc.updateDebt(d.id, "monthly", v)} sm />
           </div>
          </div>
         );
        })}
        <button onClick={() => calc.addDebt("Revolving", { payoff: "Yes - at Escrow" })} style={{ width: "100%", padding: 10, marginTop: 8, background: `${T.blue}12`, border: `1px dashed ${T.blue}44`, borderRadius: 10, color: T.blue, fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>+ Add a debt to pay off</button>
        {calc.refiDebtPayoffTotal > 0 && (
         <div style={{ marginTop: 8, padding: "8px 10px", background: `${T.green}10`, borderRadius: 10, fontSize: 11, color: T.green, fontWeight: 600, lineHeight: 1.5 }}>
          Rolling {fmt(calc.refiDebtPayoffTotal)} of debt into the new loan{calc.refiDebtPmtSaved > 0 ? ` — retiring ${fmt(calc.refiDebtPmtSaved)}/mo in payments` : ""}.
         </div>
        )}
       </>)}
      </div>
     );
    })()}
   </>)}
   {/* Cash Out drives the AUTO new-loan amount (payoff + debts + cash out).
       With a manual New Loan Amount set it does nothing, so it yields to a
       note instead of sitting there dead (Christo 2026-08-04). */}
   {refiPurpose === "Cash-Out" && (
    Math.abs((calc.refiNewLoanAmt || 0) - (calc.refiAutoLoanAmt || 0)) > 1
     ? <Note color={T.blue}>New Loan Amount is set manually on the payment section, so the cash out falls out of the difference — see Estimated Cash Out under Net Cash Out.</Note>
     : <Inp label="Cash Out Amount" value={refiCashOut} onChange={setRefiCashOut}
        tip="Cash in hand on top of the payoffs (including any debts being consolidated). Setting New Loan Amount manually replaces this." />
   )}
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
