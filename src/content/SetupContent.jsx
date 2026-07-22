import { FONT } from "../lib/fonts.js";
import React from "react";
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
  if (import.meta.env.DEV) devCheckProps("SetupContent", props, ["T", "isRefi", "setIsRefi", "salesPrice", "setSalesPrice", "downPct", "setDownPct", "downMode", "setDownMode", "loanType", "setLoanType", "propertyState", "setPropertyState", "propertyCounty", "setPropertyCounty", "city", "setCity", "propertyZip", "setPropertyZip", "propertyAddress", "setPropertyAddress", "setPropertyTBD", "addressInput", "setAddressInput", "AddressAutocomplete", "annualIns", "setAnnualIns", "hoa", "setHoa", "rate", "setRate", "term", "setTerm", "creditScore", "setCreditScore", "married", "setMarried", "firstTimeBuyer", "setFirstTimeBuyer", "refiPurpose", "setRefiPurpose", "taxState", "scenarioName", "ownsProperties", "setOwnsProperties", "hasSellProperty", "setHasSellProperty", "showInvestor", "setShowInvestor", "showRentVsBuy", "setShowRentVsBuy", "showProp19", "setShowProp19", "skillLevel", "onToggleSkillLevel", "Inp", "Sel", "SearchSelect", "Note", "Hero", "Card", "InfoTip", "gameMode", "TAB_PROGRESSION", "completedTabs", "isTabFieldsComplete", "markTouched", "isPulse", "calc", "fmt", "CITY_NAMES", "STATE_NAMES_PROP", "STATE_CITIES", "SKILL_PRESETS", "FILING_STATUSES", "showCompareHint", "setShowCompareHint", "setTab", "scenarioList", "isDesktop", "darkMode", "propTaxMode", "getTTCitiesForState", "getTTForCity", "COUNTY_AMI", "lookupZip", "Icon", "TextInp", "FieldLabel", "Sec", "GuidedNextButton", "ClusterContinue", "refiCurrentLoanType", "setRefiCurrentLoanType", "refiOriginalAmount", "setRefiOriginalAmount", "refiOriginalTerm", "setRefiOriginalTerm", "refiCurrentRate", "setRefiCurrentRate", "refiClosedDate", "setRefiClosedDate", "refiCurrentBalance", "setRefiCurrentBalance", "refiRemainingMonths", "setRefiRemainingMonths", "refiCurrentPayment", "setRefiCurrentPayment", "refiAnnualTax", "setRefiAnnualTax", "refiAnnualIns", "setRefiAnnualIns", "insEffectiveDate", "setInsEffectiveDate", "refiCurrentEscrow", "setRefiCurrentEscrow", "refiHasEscrow", "setRefiHasEscrow", "includeEscrow", "setIncludeEscrow", "refiEscrowBalance", "setRefiEscrowBalance", "refiSkipMonths", "setRefiSkipMonths", "refiCurrentMI", "setRefiCurrentMI", "refiCashOut", "setRefiCashOut", "refiExtraPaid", "setRefiExtraPaid", "refiHomeValue", "setRefiHomeValue"]);
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
    refiCurrentLoanType, setRefiCurrentLoanType, refiOriginalAmount, setRefiOriginalAmount,
    refiOriginalTerm, setRefiOriginalTerm, refiCurrentRate, setRefiCurrentRate,
    refiClosedDate, setRefiClosedDate, refiCurrentBalance, setRefiCurrentBalance,
    refiRemainingMonths, setRefiRemainingMonths, refiCurrentPayment, setRefiCurrentPayment,
    refiAnnualTax, setRefiAnnualTax, refiAnnualIns, setRefiAnnualIns, insEffectiveDate, setInsEffectiveDate, refiCurrentEscrow, setRefiCurrentEscrow,
    refiHasEscrow, setRefiHasEscrow, includeEscrow, setIncludeEscrow,
    refiEscrowBalance, setRefiEscrowBalance, refiSkipMonths, setRefiSkipMonths,
    refiCurrentMI, setRefiCurrentMI, refiCashOut, setRefiCashOut, refiExtraPaid, setRefiExtraPaid,
    refiHomeValue, setRefiHomeValue,
    hideHero = false,
  } = props;

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
      {propertyZip && propertyZip.length === 5 && (city || propertyCounty || propertyState) && (
       <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "10px 12px",
        background: `${T.green}10`, border: `1px solid ${T.green}30`,
        borderRadius: 12, fontSize: 12, color: T.text, fontFamily: FONT, minHeight: 38,
       }}>
        <span style={{ color: T.green, fontWeight: 700 }}>✓</span>
        <span>
         {city ? `${city}, ` : ""}{propertyCounty ? `${propertyCounty} County, ` : ""}{propertyState || "—"} {propertyZip}
        </span>
       </div>
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
     <FieldLabel label="Middle FICO Score" tip="Your middle credit score from the 3 bureaus. Lenders pull all 3 and use the middle score for qualification." req filled={creditScore > 0} />
     <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: "0 0 90px" }}>
       <input type="text" inputMode="numeric" value={creditScore === 0 ? "" : creditScore} placeholder="750"
        onChange={e => { const v = e.target.value.replace(/\D/g, ""); if (v === "") { setCreditScore(0); return; } const n = Math.min(parseInt(v, 10), 850); setCreditScore(n); }}
        onBlur={() => {
          if (creditScore > 0 && creditScore < 300) { setCreditScore(300); markTouched("fico-input-done"); }
          else if (creditScore >= 300) markTouched("fico-input-done");
        }}
        style={{ width: "100%", background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "12px 14px", color: T.text, fontSize: 17, fontWeight: 600, fontFamily: FONT, outline: "none", textAlign: "center", letterSpacing: "-0.02em" }} />
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
 {isRefi && <Sec title="Your Current Loan">
  <Card>
   <Inp label="Home Value" value={salesPrice} onChange={setSalesPrice} max={100000000} req tip="Current estimated market value of your home. This determines your LTV and equity position." />
   {/* ARM is a CURRENT-loan-only option — it describes the note being paid
       off, which is often exactly why someone is refinancing. It is not in
       LOAN_TYPES because Blueprint does not model an adjustable NEW loan. */}
   <Sel label="Current Loan Type" value={refiCurrentLoanType} onChange={setRefiCurrentLoanType} options={["Conventional", "FHA", "VA", "Jumbo", "USDA", "ARM"]} req />
   <Inp label="Original Loan Amount" value={refiOriginalAmount} onChange={setRefiOriginalAmount} req />
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    <Inp label="Original Term" value={refiOriginalTerm} onChange={setRefiOriginalTerm} prefix="" suffix="years" max={50} sm req />
    <Inp label="Current Rate" value={refiCurrentRate} onChange={setRefiCurrentRate} prefix="" suffix="%" step={0.125} max={30} sm req />
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
   {refiOriginalAmount > 0 && refiCurrentRate > 0 && (<div style={{ background: `${T.blue}10`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: T.blue, marginBottom: 6 }}>AUTO-CALCULATED</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
     <div><div style={{ fontSize: 10, color: T.textTertiary }}>P&I Payment</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.refiCalcPI)}</div></div>
     {refiClosedDate && <div><div style={{ fontSize: 10, color: T.textTertiary }}>Months Elapsed</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{calc.refiMonthsElapsed}</div></div>}
     {refiClosedDate && <div><div style={{ fontSize: 10, color: T.textTertiary }}>Est. Balance</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.refiEffBalance)}</div></div>}
     {refiClosedDate && <div><div style={{ fontSize: 10, color: T.textTertiary }}>Remaining</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{calc.refiEffRemaining} mos</div></div>}
    </div>
   </div>)}
   {!refiClosedDate && <Note color={T.orange}>Enter the close date above and we'll auto-calculate balance & remaining months. Or enter manually below.</Note>}
   {!refiClosedDate && <>
    <Inp label="Current Balance (manual)" value={refiCurrentBalance} onChange={setRefiCurrentBalance} />
    <Inp label="Remaining Months (manual)" value={refiRemainingMonths} onChange={setRefiRemainingMonths} prefix="" suffix="mos" />
   </>}
   {!refiOriginalAmount && <Inp label="Current P&I Payment (manual)" value={refiCurrentPayment} onChange={setRefiCurrentPayment} />}
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    <Inp label="Annual Prop Tax" value={refiAnnualTax} onChange={setRefiAnnualTax} sm tip="Annual property tax. Stays the same after refi." />
    <Inp label="Annual Home Ins" value={refiAnnualIns} onChange={setRefiAnnualIns} sm tip="Annual homeowner's insurance premium. Stays the same after refi." />
   </div>
   {(refiAnnualTax > 0 || refiAnnualIns > 0) && (
    <div style={{ fontSize: 11, color: T.green, fontWeight: 600, marginTop: -4, marginBottom: 10 }}>
     ✓ Monthly: {refiAnnualTax > 0 ? `Tax ${fmt(refiAnnualTax / 12)}` : ""}{refiAnnualTax > 0 && refiAnnualIns > 0 ? " + " : ""}{refiAnnualIns > 0 ? `Ins ${fmt(refiAnnualIns / 12)}` : ""} = {fmt((refiAnnualTax + refiAnnualIns) / 12)}/mo
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
     <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6, color: calc.insRenewalAtClose ? T.orange : T.green }}>
      {calc.insRenewalAtClose
       ? `Renews at closing — 12-month premium (${fmt(refiAnnualIns || 0)}) added to prepaids`
       : "Renews outside the closing window — premium not counted as a refi cost"}
     </div>
    )}
   </div>
   {refiAnnualTax <= 0 && refiAnnualIns <= 0 && (
    <Inp label="Current Monthly Escrow (Tax+Ins)" value={refiCurrentEscrow} onChange={setRefiCurrentEscrow} tip="If you don't know the annual amounts, enter your combined monthly escrow here." />
   )}
   {/* Escrow: two independent toggles (Christo 2026-07-22). These were one
       setting mirrored across both loans, so "my old loan escrowed but I want
       to waive it on the new one" — a routine request — couldn't be modeled.
       Current drives refiCurTotalPmt, New drives refiNewTotalPmt, and the
       savings figure is the difference between them. */}
   <div style={{ borderTop: `1px solid ${T.separator}`, paddingTop: 10, marginBottom: 10 }}>
    <div style={{ fontSize: 14, color: T.text, marginBottom: 2 }}>Tax/Ins included in payment?</div>
    <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 8 }}>Set each loan separately — escrow can be waived on the new loan even if the current one has it.</div>
    {[
     { key: "cur", label: "Current loan", on: refiHasEscrow, set: setRefiHasEscrow,
       hint: refiHasEscrow ? "Tax & insurance included in today's payment" : "Tax & insurance paid separately today" },
     { key: "new", label: "New loan", on: includeEscrow, set: setIncludeEscrow,
       hint: includeEscrow ? "Tax & insurance escrowed on the new loan" : "Escrow waived — tax & insurance paid separately",
       // FHA and VA require escrow; the same lock the Calculator tab enforces.
       locked: loanType === "FHA" || loanType === "VA" },
    ].map(row => (
     <div key={row.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
      <div>
       <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{row.label}</div>
       <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 1 }}>
        {row.locked ? `${loanType} loans require escrow` : row.hint}
       </div>
      </div>
      <div
       onClick={() => { if (!row.locked) row.set(!row.on); }}
       title={row.locked ? `${loanType} loans require escrow — cannot be toggled off` : undefined}
       style={{ width: 52, height: 30, borderRadius: 99, background: row.on ? T.green : T.inputBg, cursor: row.locked ? "not-allowed" : "pointer", opacity: row.locked ? 0.55 : 1, padding: 2, transition: "all 0.3s", flexShrink: 0 }}
      >
       <div style={{ width: 26, height: 26, borderRadius: 99, background: "#fff", transform: row.on ? "translateX(22px)" : "translateX(0)", transition: "transform 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
      </div>
     </div>
    ))}
   </div>
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    <Inp label="Escrow Balance" value={refiEscrowBalance} onChange={setRefiEscrowBalance} sm tip="Money sitting in your escrow account — refunded to you when the old loan closes." />
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}><Sel label="Skip Payments" value={String(refiSkipMonths)} onChange={v => setRefiSkipMonths(Number(v))} options={[{value:"0",label:"0 months"},{value:"1",label:"1 month"},{value:"2",label:"2 months"}]} sm tip="Mortgage payments you skip during the refi process. Auto-set based on closing day — close by the 15th = skip 2, after the 15th = skip 1." /></div>
   </div>
   <Inp label="Current MI/MIP" value={refiCurrentMI} onChange={setRefiCurrentMI} />
   {refiPurpose === "Cash-Out" && <Inp label="Cash Out Amount" value={refiCashOut} onChange={setRefiCashOut} />}
  </Card>
 </Sec>}
 {isRefi && refiClosedDate && <Sec title="Extra Payments">
  <Card>
   <Note color={T.blue}>If the borrower has been making extra monthly principal payments, enter the amount here. This adjusts the estimated remaining balance.</Note>
   <Inp label="Extra Monthly Principal" value={refiExtraPaid} onChange={setRefiExtraPaid} />
   {refiExtraPaid > 0 && refiOriginalAmount > 0 && (<div style={{ background: `${T.green}15`, borderRadius: 10, padding: 12, marginTop: 6 }}>
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
