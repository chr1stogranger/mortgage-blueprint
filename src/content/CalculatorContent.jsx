import React, { useState } from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

export default function CalculatorContent({
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
  annualIns, setAnnualIns, hoa, setHoa,
  underwritingFee, processingFee,
  propertyZip, setPropertyZip, creditScore,
  StopLight, handlePillarClick,
  allGood, someGood, refiPillarCount, purchPillarCount, refiLtvCheck,
  PayRing, Card, Inp, Sel, Note, SearchSelect, InfoTip, Icon,
  GuidedNextButton,
}) {
  const [pmiExpanded, setPmiExpanded] = useState(false);

  // PMI is required only for Conventional loans with LTV > 80%. FHA has its own MIP, VA has none.
  const pmiApplies = loanType === "Conventional" && calc.ltv > 0.80 && (calc.monthlyMI || 0) > 0;

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
 {/* ROW 1 — 6-pill quick-edit grid (Zip / PropType / Occupancy / Rate / Term / LoanType) */}
 {/* ─────────────────────────────────────────────────────────────── */}
 <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr 1fr" : "1fr 1fr", gap: 12, marginTop: 20, marginBottom: 16 }}>
  <Inp label="Zip Code" value={propertyZip} onChange={v => setPropertyZip(String(v).replace(/[^0-9]/g, "").slice(0, 5))} prefix="" suffix="" max={99999} step={1} sm req />
  <div data-field="calc-proptype" className={isPulse && isPulse("calc-proptype")} onClick={() => markTouched && markTouched("calc-proptype")}>
   <Sel label="Property Type" value={propType} onChange={setPropType} options={PROP_TYPES} sm req />
  </div>
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
  } sm req />
  <div data-field="calc-rate" className={isPulse && isPulse("calc-rate")}>
   <Inp label="Rate" value={rate} onChange={setRate} prefix="" suffix="%" step={0.001} max={30} sm req />
  </div>
  <div data-field="calc-term" className={isPulse && isPulse("calc-term")} onClick={() => { markTouched && markTouched("calc-term"); markTouched && markTouched("calc-loantype"); }}>
   <Sel label="Term" value={term} onChange={v => setTerm(parseInt(v))} options={[{value:30,label:"30 Year"},{value:25,label:"25 Year"},{value:20,label:"20 Year"},{value:15,label:"15 Year"},{value:10,label:"10 Year"}]} sm req />
  </div>
  <Sel label="Loan Type" value={loanType} onChange={v => { setLoanType(v); userLoanTypeRef.current = v; setAutoJumboSwitch(false); }} options={LOAN_TYPES} sm req />
 </div>

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

 {/* ─────────────────────────────────────────────────────────────── */}
 {/* ROW 2 — 5-pillar strip (same checks as Pre-Qualified / QualifyContent) */}
 {/* ─────────────────────────────────────────────────────────────── */}
 <div style={{ marginBottom: 16 }}>
  <StopLight onPillarClick={handlePillarClick} checks={isRefi ? [
   { label: "FICO", ok: calc.ficoCheck === "Good!" ? true : calc.ficoCheck === "—" ? null : false, sub: creditScore > 0 ? `${creditScore} / ${calc.ficoMin}+` : "Enter score", icon: "bar-chart", fullLabel: "Credit Score (FICO)", detail: `Min ${calc.ficoMin} for ${loanType}. ${creditScore >= 740 ? "Excellent — best pricing tier." : creditScore >= calc.ficoMin ? `Meets minimum. 740+ unlocks better pricing.` : creditScore > 0 ? `Need ${calc.ficoMin - creditScore} more points.` : "Enter your middle FICO score."}`, action: "Edit credit score" },
   { label: "DTI", ok: calc.dtiCheck === "Good!" ? true : calc.dtiCheck === "—" ? null : false, sub: calc.qualifyingIncome > 0 ? `${pct(calc.yourDTI, 1)} / ${pct(calc.maxDTI, 0)}` : "Add income", icon: "scale", fullLabel: "DTI Ratio", detail: calc.qualifyingIncome > 0 ? `Max ${pct(calc.maxDTI, 0)} for ${loanType}. Total payment ${fmt(calc.totalPayment || calc.housingPayment)}/mo ÷ income ${fmt(calc.qualifyingIncome)}/mo = ${pct(calc.yourDTI, 1)}.` : "Add income on the Income tab to calculate DTI.", action: calc.qualifyingIncome > 0 ? "Edit income & debts" : "Go to Income tab" },
   { label: "LTV", ok: refiLtvCheck === "Good!" ? true : refiLtvCheck === "—" ? null : false, sub: calc.refiNewLTV > 0 ? `${pct(calc.refiNewLTV, 0)} / ${refiPurpose === "Cash-Out" ? "80%" : "95%"}` : "Enter loan details", icon: "home", fullLabel: "Loan-to-Value", detail: calc.refiNewLTV > 0 ? `New LTV: ${pct(calc.refiNewLTV, 1)}. Max ${refiPurpose === "Cash-Out" ? "80%" : "95%"} for ${refiPurpose} refi. ${calc.refiNewLTV <= 0.80 ? "Below 80% — no PMI required." : ""}` : "Enter your current loan details in Setup to calculate LTV.", action: "Edit loan details" },
  ] : [
   { label: "FICO", ok: calc.ficoCheck === "Good!" ? true : calc.ficoCheck === "—" ? null : false, sub: creditScore > 0 ? `${creditScore} / ${calc.ficoMin}+` : "Enter score", icon: "bar-chart", fullLabel: "Credit Score (FICO)", detail: `Min ${calc.ficoMin} for ${loanType}. ${creditScore >= 740 ? "Excellent — best pricing tier." : creditScore >= calc.ficoMin ? `Meets minimum. 740+ unlocks better pricing.` : creditScore > 0 ? `Need ${calc.ficoMin - creditScore} more points.` : "Enter your middle FICO score."}`, action: "Edit credit score" },
   { label: "Down", ok: calc.dpWarning === null ? true : false, sub: `${downPct}% / ${calc.minDPpct}%+`, icon: "home", fullLabel: "Down Payment", detail: `Min ${calc.minDPpct}%${loanType === "Conventional" && firstTimeBuyer ? " (FTHB)" : ""} for ${loanType}. Yours: ${downPct}% = ${fmt(calc.dp)}. ${downPct >= 20 ? "No mortgage insurance required!" : `PMI required until 80% LTV.`}`, action: "Adjust down payment" },
   { label: "DTI", ok: calc.dtiCheck === "Good!" ? true : calc.dtiCheck === "—" ? null : false, sub: calc.qualifyingIncome > 0 ? `${pct(calc.yourDTI, 1)} / ${pct(calc.maxDTI, 0)}` : "Add income", icon: "scale", fullLabel: "DTI Ratio", detail: calc.qualifyingIncome > 0 ? `Max ${pct(calc.maxDTI, 0)} for ${loanType}. Total payment ${fmt(calc.totalPayment || calc.housingPayment)}/mo ÷ income ${fmt(calc.qualifyingIncome)}/mo = ${pct(calc.yourDTI, 1)}.` : "Add income on the Income tab to calculate DTI.", action: calc.qualifyingIncome > 0 ? "Edit income & debts" : "Go to Income tab" },
   { label: "Cash", ok: calc.cashCheck === "Good!" ? true : calc.cashCheck === "—" ? null : false, sub: calc.totalForClosing > 0 ? `${fmt(calc.totalForClosing)}` : "Add assets", icon: "dollar", fullLabel: "Cash to Close", detail: `Need ${fmt(calc.cashToClose)} (down payment + closing costs – credits). ${calc.totalForClosing > 0 ? `Have ${fmt(calc.totalForClosing)} verified. ${calc.totalForClosing >= calc.cashToClose ? "Fully funded!" : `Short ${fmt(calc.cashToClose - calc.totalForClosing)}.`}` : "Add assets to verify funds."}`, action: "Edit assets" },
   { label: "Reserves", ok: calc.resCheck === "Good!" ? true : calc.resCheck === "—" ? null : false, sub: calc.totalReserves > 0 ? `${fmt(calc.totalReserves)}` : "Add assets", icon: "landmark", fullLabel: "Reserves", detail: `${calc.reserveMonths} months required (${loanType === "Jumbo" ? "Jumbo" : "standard"}) = ${fmt(calc.reservesReq)}. ${calc.totalReserves > 0 ? `Have ${fmt(calc.totalReserves)}. ${calc.totalReserves >= calc.reservesReq ? "Fully funded!" : `Short ${fmt(calc.reservesReq - calc.totalReserves)}.`}` : "Add assets to verify reserves."}`, action: "Edit assets" },
  ]} />
 </div>

 {/* ─────────────────────────────────────────────────────────────── */}
 {/* ROW 3 — 2-col: donut + price inputs LEFT | rates + payment breakdown RIGHT */}
 {/* ─────────────────────────────────────────────────────────────── */}
 <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start", marginBottom: 16 } : {}}>

  {/* ========== LEFT COLUMN ========== */}
  <div>
   {/* Donut */}
   <div className={changedFields && changedFields.size > 0 ? "field-updated" : ""} style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 12 }}>
    <PayRing segments={paySegs} total={calc.displayPayment} size={isDesktop ? 280 : 200} />
   </div>

   {/* Legend — small pills under the donut */}
   <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginBottom: 14 }}>
    {legendRows.map((row, i) => (
     <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.textSecondary, fontFamily: FONT }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: row.color, flexShrink: 0 }} />
      <span>{row.label}</span>
      <span style={{ fontFamily: MONO, fontWeight: 600, color: T.text }}>{fmt(row.value)}</span>
     </div>
    ))}
   </div>

   {/* Purchase Price / Down Payment card — 2-col even on mobile (explicit ask) */}
   <div data-field="calc-price" className={isPulse && isPulse("calc-price")} style={{ borderRadius: 18, transition: "all 0.3s" }}>
    <div data-field="down-pct-input">
     <Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
       <div>
        <Inp label={isRefi ? "Home Value" : "Purchase Price"} value={salesPrice} onChange={setSalesPrice} max={100000000} req placeholder="Enter price" />
        {!isRefi && (
         <button onClick={() => window.open(`https://www.zillow.com/homes/${encodeURIComponent(city + ", " + taxState)}_rb/`, "_blank")} style={{ width: "100%", background: `${T.blue}08`, border: `1px solid ${T.blue}18`, borderRadius: 8, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 10, marginTop: -4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: T.blue, fontFamily: FONT }}>Zillow</span>
          <span style={{ fontSize: 10, color: T.textTertiary }}>{city}, {taxState}</span>
         </button>
        )}
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
        {/* Purchase: Down Payment with %/$ toggle */}
        <div data-field="calc-down" className={isPulse && isPulse("calc-down")} onClick={() => markTouched && markTouched("calc-down")} style={{ borderRadius: 12, transition: "all 0.3s" }}>
         <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, height: 32 }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>
           Down<span style={{ color: T.red, marginLeft: 3, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>*</span>
           <InfoTip text="The cash you put toward the purchase price. More down = lower loan, lower payment, and possibly no mortgage insurance. You can toggle between entering a percentage or dollar amount." />
          </div>
          <div style={{ display: "flex", background: T.inputBg, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.inputBorder}` }}>
           <button onClick={() => setDownMode("pct")} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: FONT, background: downMode === "pct" ? T.blue : "transparent", color: downMode === "pct" ? "#fff" : T.textTertiary, transition: "all 0.2s" }}>%</button>
           <button onClick={() => setDownMode("dollar")} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: FONT, background: downMode === "dollar" ? T.blue : "transparent", color: downMode === "dollar" ? "#fff" : T.textTertiary, transition: "all 0.2s" }}>$</button>
          </div>
         </div>
         {downMode === "pct" ? (
          <Inp value={downPct} onChange={setDownPct} prefix="" suffix="%" step={0.01} max={100} sm req />
         ) : (
          <Inp value={Math.round(salesPrice * downPct / 100)} onChange={v => { const p = salesPrice > 0 ? (v / salesPrice) * 100 : 0; setDownPct(Math.round(p * 100) / 100); }} prefix="$" suffix="" step={1000} max={salesPrice} sm req />
         )}
         <div style={{ fontSize: 11, color: T.textTertiary, marginTop: -8, marginBottom: 10 }}>
          {downMode === "pct" ? `${fmt(Math.round(salesPrice * downPct / 100))} down` : `${downPct.toFixed(1)}% of ${fmt(salesPrice)}`}
         </div>
        </div>
       </>)}
      </div>
      {!isRefi && calc.dpWarning === "fail" && <Note color={T.red}>{loanType} requires minimum {calc.minDPpct}% down{loanType === "Conventional" && firstTimeBuyer ? " (FTHB conforming)" : ""}. Current: {downPct}% — need {(calc.minDPpct - downPct).toFixed(1)}% more.</Note>}
      {!isRefi && loanType === "Conventional" && !firstTimeBuyer && downPct >= 3 && downPct < 5 && <Note color={T.orange}>3% down requires First-Time Homebuyer + conforming loan + income ≤ 100% AMI. Toggle FTHB in Setup or increase to 5%.</Note>}
     </Card>
    </div>
   </div>

   {/* Include Escrow toggle */}
   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 4px" }}>
    <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary }}>Include Escrow (Tax & Ins)</span>
    <button onClick={() => { if (loanType !== "FHA" && loanType !== "VA") setIncludeEscrow(!includeEscrow); }} style={{ width: 48, height: 28, borderRadius: 14, border: "none", cursor: (loanType === "FHA" || loanType === "VA") ? "not-allowed" : "pointer", background: includeEscrow ? T.green : T.inputBorder, position: "relative", transition: "background 0.2s", opacity: (loanType === "FHA" || loanType === "VA") ? 0.6 : 1 }}>
     <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, left: includeEscrow ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
   </div>
   {(loanType === "FHA" || loanType === "VA") && <Note color={T.blue}>{loanType} loans require escrow impound accounts — this cannot be toggled off.</Note>}
   {!includeEscrow && loanType !== "FHA" && loanType !== "VA" && <Note color={T.orange}>Escrow OFF — Tax + Insurance ({fmt(calc.escrowAmount)}/mo) not shown in payment. Still included in DTI qualification.</Note>}

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

   {/* Loan Amount / LTV / Cash to Close 3-col */}
   <div className={changedFields && changedFields.size > 0 ? "field-updated" : ""} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: isDesktop ? 8 : 16 }}>
    {(isRefi ? [
     { l: "New Loan", v: fmt(calc.refiNewLoanAmt || calc.loan), c: T.blue, s: refiPurpose === "Cash-Out" ? `incl ${fmt(refiCashOut)} cash-out` : calc.loanCategory, tip: "Your new loan amount after refinancing. For rate/term refis, this equals your current balance. For cash-out, it includes the additional amount." },
     { l: "New LTV", v: pct(calc.refiNewLTV || calc.ltv, 0), c: T.orange, s: `${fmt(Math.max(0, salesPrice - (calc.refiEffBalance || 0)))} equity`, tip: "New Loan-to-Value ratio after refinancing. Based on your current home value and new loan amount. Below 80% = no PMI on conventional." },
     { l: "Refi Costs", v: fmt(calc.totalClosingCosts), c: T.green, tip: "Total closing costs for your refinance — includes lender fees, title, appraisal, and government fees. No down payment or transfer tax on a refi." }
    ] : [
     { l: "Loan Amount", v: fmt(calc.loan), c: T.blue, s: calc.fhaUp > 0 ? `incl ${fmt(calc.fhaUp)} UFMIP` : calc.vaFundingFee > 0 ? `incl ${fmt(calc.vaFundingFee)} VA FF` : calc.loanCategory, tip: "Your total loan amount = purchase price minus down payment, plus any financed fees (like FHA UFMIP or VA Funding Fee)." },
     { l: "LTV", v: pct(calc.ltv, 0), c: T.orange, s: `${downPct}% down`, tip: "Loan-to-Value ratio — your loan amount divided by the home's value. Below 80% LTV (20%+ down) = no PMI on conventional loans." },
     { l: "Cash to Close", v: fmt(calc.cashToClose), c: T.green, tip: "Total cash you need at closing = down payment + closing costs + prepaids – any credits (seller, lender, realtor)." }
    ]).map((m, i) => (
     <Card key={i} pad={14}>
      <div style={{ fontSize: 11, fontWeight: 500, color: T.textTertiary, marginBottom: 4, display: "flex", alignItems: "center" }}>{m.l}{m.tip && <InfoTip text={m.tip} />}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: m.c, fontFamily: FONT, letterSpacing: "-0.03em" }}>{m.v}</div>
      {m.s && <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>{m.s}</div>}
     </Card>
    ))}
   </div>
  </div>
  {/* ========== END LEFT COLUMN ========== */}

  {/* ========== RIGHT COLUMN ========== */}
  <div>
   {/* Rate / APR + Live Rates */}
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

    <button onClick={fetchRates} disabled={ratesLoading} style={{ width: "100%", background: `${T.blue}${liveRates ? '18' : '10'}`, border: `1px solid ${T.blue}33`, borderRadius: 12, padding: "10px 14px", cursor: ratesLoading ? "wait" : "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
     <span style={{ fontSize: 13, fontWeight: 600, color: T.blue, fontFamily: FONT }}>
      {ratesLoading ? "Fetching rates..." : liveRates ? "✓ Live Rates Applied" : "◉ Get Today's Rates"}
     </span>
     {liveRates && <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT }}>{liveRates.date || "Today"}</span>}
     {!liveRates && !ratesLoading && fredApiKey && <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT }}>FRED</span>}
    </button>
    {ratesError && <div style={{ fontSize: 11, color: T.red, marginBottom: 10, wordBreak: "break-all", lineHeight: 1.4, padding: 10, background: T.errorBg, borderRadius: 8 }}>{ratesError}</div>}
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

   {/* Payment Breakdown card */}
   <Card>
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginBottom: 10 }}>Payment Breakdown</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
     {[
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
     ].map((row, i) => (
      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
       <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: row.color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT }}>{row.label}</span>
       </div>
       <span style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: MONO }}>{fmt(row.value)}</span>
      </div>
     ))}
     <div style={{ borderTop: `1px solid ${T.separator}`, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: FONT }}>Total Payment</span>
      <span style={{ fontSize: 18, fontWeight: 800, color: T.blue, fontFamily: MONO, letterSpacing: "-0.02em" }}>{fmt(calc.displayPayment)}/mo</span>
     </div>
     {!includeEscrow && (
      <div style={{ fontSize: 10, color: T.textTertiary, textAlign: "center" }}>
       Escrow excluded — full PITI would be {fmt(calc.housingPayment)}/mo
      </div>
     )}
    </div>
   </Card>
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

 {/* State / City for property tax */}
 <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
  <Sel label="State (property tax)" value={propertyState} onChange={v => { setPropertyState(v); if (v !== "California") setCity(""); }} options={STATE_NAMES_PROP} req />
  {propertyState === "California" ? (
   <SearchSelect label="City (tax rate)" value={city} onChange={setCity} options={CITY_NAMES} />
  ) : (
   <SearchSelect label="City" value={city} onChange={setCity} options={STATE_CITIES[propertyState] || []} />
  )}
 </div>
 {propertyState !== "California" && propTaxMode === "auto" && (
  <div style={{ background: `${T.blue}08`, borderRadius: 12, padding: "10px 14px", marginBottom: 14, marginTop: -6 }}>
   <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5 }}>Using {propertyState} average effective rate of {((STATE_PROPERTY_TAX_RATES[propertyState] || 0.0102) * 100).toFixed(2)}%. For a precise rate, check your county assessor.</div>
  </div>
 )}

 {/* ─────────────────────────────────────────────────────────────── */}
 {/* ROW 4 — 2-col: Property Tax expandable | PMI expandable */}
 {/* ─────────────────────────────────────────────────────────────── */}
 <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start", marginBottom: 16 } : {}}>

  {/* Property Tax — 3-layer pill (preserved from original lines 317-426) */}
  {(() => {
   const autoRate = calc.autoTaxRate;
   const cityLabel = propertyState === "California" ? (city || "CA") : (propertyState || "State");
   const anyUnlocked = !taxRateLocked || !taxExemptionLocked;
   const displayRate = taxBaseRateOverride > 0 ? taxBaseRateOverride : autoRate * 100;
   return (
    <div style={{ marginBottom: 12 }}>
     {/* Layer 1: Pill */}
     <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
       <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>Property Tax</span>
       {anyUnlocked && <span style={{ fontSize: 9, fontWeight: 700, fontFamily: MONO, color: T.blue, background: `${T.blue}15`, borderRadius: 99, padding: "1px 6px" }}>CUSTOM</span>}
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
      <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: MONO }}>{fmt(calc.yearlyTax)}/yr</span>
     </div>

     {/* Layer 2: "How this is calculated" */}
     <div onClick={() => setPropTaxExpanded(!propTaxExpanded)}
      style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 0 2px", cursor: "pointer" }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.blue, fontFamily: FONT }}>How this is calculated</span>
      <span style={{ fontSize: 10, color: T.blue, transition: "transform 0.2s", transform: propTaxExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
     </div>

     {propTaxExpanded && (
      <div style={{ marginTop: 4 }}>
       {/* Breakdown table */}
       <div style={{ background: T.bg, borderRadius: 12, padding: "12px 14px" }}>
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
         <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 4 }}>Effective rate: {(calc.effectiveTaxRate * 100).toFixed(3)}%</div>
        )}
       </div>

       {/* Layer 3: Customize */}
       {!anyUnlocked && !propTaxCustomize ? (
        <div style={{ textAlign: "center", marginTop: 8 }}>
         <span onClick={() => { setPropTaxCustomize(true); if (taxRateLocked && taxBaseRateOverride === 0) setTaxBaseRateOverride(parseFloat((autoRate * 100).toFixed(4))); }}
          style={{ fontSize: 12, fontWeight: 600, color: T.blue, cursor: "pointer", fontFamily: FONT }}>Customize rate, exemption, or assessments</span>
        </div>
       ) : (
        <div style={{ marginTop: 10 }}>
         <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
           <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>Base Tax Rate <span style={{ color: T.textTertiary, fontWeight: 400, fontSize: 11, marginLeft: 3 }}>({cityLabel})</span></span>
            <button onClick={() => {
             if (taxRateLocked) { setTaxRateLocked(false); }
             else { setTaxRateLocked(true); const ar = propertyState === "California" ? (CITY_TAX_RATES[city] || 0.012) : (STATE_PROPERTY_TAX_RATES[propertyState] || 0.0102); setTaxBaseRateOverride(parseFloat((ar * 100).toFixed(4))); }
            }} title={taxRateLocked ? "Unlock to customize" : "Lock to auto-sync"} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}>
             <Icon name={taxRateLocked ? "lock" : "unlock"} size={14} style={{ color: taxRateLocked ? T.textTertiary : T.blue }} />
            </button>
           </div>
           <div style={{ opacity: taxRateLocked ? 0.6 : 1 }}><Inp value={taxBaseRateOverride} onChange={setTaxBaseRateOverride} prefix="" suffix="%" max={10} step={0.001} sm readOnly={taxRateLocked} /></div>
          </div>
          <div>
           <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>Exemption</span>
            <button onClick={() => {
             if (taxExemptionLocked) { setTaxExemptionLocked(false); }
             else { setTaxExemptionLocked(true); const ip = loanPurpose === "Purchase Primary" || loanPurpose === "Refi Rate/Term" || loanPurpose === "Refi Cash-Out"; setTaxExemptionOverride(ip ? 7000 : 0); }
            }} title={taxExemptionLocked ? "Unlock to customize" : "Lock to auto-sync"} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}>
             <Icon name={taxExemptionLocked ? "lock" : "unlock"} size={14} style={{ color: taxExemptionLocked ? T.textTertiary : T.blue }} />
            </button>
           </div>
           <div style={{ opacity: taxExemptionLocked ? 0.6 : 1 }}><Inp value={taxExemptionOverride} onChange={setTaxExemptionOverride} prefix="$" max={500000} sm readOnly={taxExemptionLocked} /></div>
          </div>
         </div>
         <Inp label="Fixed Assessments" value={fixedAssessments} onChange={setFixedAssessments} prefix="$" suffix="/yr" max={50000} sm tip="Mello-Roos, bonds, parcel taxes. Check your county tax bill." />
         <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 2, lineHeight: 1.5, fontFamily: FONT }}>
          Exemption: primary residence reduction (CA $7K). Fixed Assessments: Mello-Roos, bonds, parcel taxes.
         </div>
         {anyUnlocked && (
          <div style={{ textAlign: "center", marginTop: 6 }}>
           <span onClick={() => { setTaxRateLocked(true); setTaxExemptionLocked(true); setFixedAssessments(1500); const ar = propertyState === "California" ? (CITY_TAX_RATES[city] || 0.012) : (STATE_PROPERTY_TAX_RATES[propertyState] || 0.0102); setTaxBaseRateOverride(parseFloat((ar * 100).toFixed(4))); const ip = loanPurpose === "Purchase Primary" || loanPurpose === "Refi Rate/Term" || loanPurpose === "Refi Cash-Out"; setTaxExemptionOverride(ip ? 7000 : 0); setPropTaxCustomize(false); }}
            style={{ fontSize: 11, color: T.textTertiary, cursor: "pointer", textDecoration: "underline" }}>Reset to auto</span>
          </div>
         )}
        </div>
       )}
      </div>
     )}
    </div>
   );
  })()}

  {/* PMI — 3-layer pill (parallel to Property Tax). Only render when applicable. */}
  {pmiApplies ? (
   <div style={{ marginBottom: 12 }}>
    {/* Layer 1: Pill */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
     <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>Private Mortgage Insurance (PMI)</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: T.inputBg, borderRadius: 12, padding: "12px 14px", border: `1px solid ${T.inputBorder}` }}>
     <span style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: FONT, letterSpacing: "-0.02em" }}>
      {fmt(calc.monthlyMI || 0)}<span style={{ fontSize: 12, fontWeight: 400, color: T.textTertiary, marginLeft: 2 }}>/mo</span>
     </span>
     <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: MONO }}>{fmt((calc.monthlyMI || 0) * 12)}/yr</span>
    </div>

    {/* Layer 2: "How this is calculated" */}
    <div onClick={() => setPmiExpanded(!pmiExpanded)}
     style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 0 2px", cursor: "pointer" }}>
     <span style={{ fontSize: 12, fontWeight: 600, color: T.blue, fontFamily: FONT }}>How this is calculated</span>
     <span style={{ fontSize: 10, color: T.blue, transition: "transform 0.2s", transform: pmiExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
    </div>

    {/* Layer 3: Breakdown */}
    {pmiExpanded && (
     <div style={{ marginTop: 4, background: T.bg, borderRadius: 12, padding: "12px 14px" }}>
      {[
       ["Home Value",    fmt(salesPrice)],
       ["Loan Amount",   fmt(calc.baseLoan || calc.loan)],
       ["LTV",           pct(calc.ltv, 1)],
       ["Credit Score",  creditScore > 0 ? String(creditScore) : "—"],
       ["PMI Rate (Radian matrix)", `${((calc.pmiRate || 0) * 100).toFixed(3)}%`],
       ["Annual Premium", fmt((calc.monthlyMI || 0) * 12)],
      ].map(([label, value], i) => (
       <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.separator}` }}>
        <span style={{ fontSize: 12, color: T.textSecondary }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 500, fontFamily: MONO, color: T.text }}>{value}</span>
       </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 2px", borderTop: `2px solid ${T.separator}`, marginTop: 2 }}>
       <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Monthly Premium</span>
       <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: T.text }}>{fmt(calc.monthlyMI || 0)}</span>
      </div>
      <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 8, lineHeight: 1.5 }}>
       PMI required when LTV &gt; 80%. Auto-cancels at 78% LTV (lender-initiated) or request removal at 80%. Rate from Radian matrix by LTV bucket and FICO score.
      </div>
     </div>
    )}
   </div>
  ) : (
   /* Keep the 2-col grid balanced even when PMI is hidden — render a spacer */
   isDesktop ? <div /> : null
  )}

 </div>
 {/* End Row 4 */}

 {/* ─────────────────────────────────────────────────────────────── */}
 {/* ROW 5 — Insurance + HOA 2-col */}
 {/* ─────────────────────────────────────────────────────────────── */}
 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
  <Inp label="Insurance" value={annualIns} onChange={setAnnualIns} suffix="/yr" max={50000} sm tip="Annual homeowner's insurance premium. Required by all lenders. Typically 0.3-1% of home value per year." />
  <Inp label="HOA" value={hoa} onChange={setHoa} suffix="/mo" max={10000} sm tip="Monthly Homeowners Association fee. Common in condos and planned communities. This counts toward your DTI." />
 </div>

 <GuidedNextButton />
</>);
}
