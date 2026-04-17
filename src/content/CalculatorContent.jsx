import React from "react";

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
  closingMonth, setClosingMonth, closingDay, setClosingDay,
  underwritingFee, processingFee,
  PayRing, Card, Inp, Sel, Note, SearchSelect, InfoTip, Icon,
  GuidedNextButton,
}) {
  return (<>

 <div style={isDesktop ? { display: "flex", gap: 24, marginTop: 20, alignItems: "flex-start" } : {}}>
 {/* ── Desktop: Left column (PayRing + summary) — fixed 50% so always visible ── */}
 <div style={isDesktop ? { position: "sticky", top: 90, width: "50%", flexShrink: 0, order: 1, maxHeight: "calc(100vh - 110px)", overflowY: "auto", display: "flex", flexDirection: "column" } : {}}>
 <div className={changedFields.size > 0 ? "field-updated" : ""} style={isDesktop ? { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 8 } : { marginTop: 20 }}>
  <PayRing segments={paySegs} total={calc.displayPayment} size={isDesktop ? 320 : 200} />
 </div>
 <div data-field="calc-price" className={isPulse("calc-price")} style={{ borderRadius: 18, transition: "all 0.3s" }}>
 <div data-field="down-pct-input">
 <Card>
  <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" } : {}}>
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
   {/* ── Refi: Equity & Balance display ── */}
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
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
   {/* ── Purchase: Down Payment ── */}
   <div data-field="calc-down" className={isPulse("calc-down")} onClick={() => markTouched("calc-down")} style={{ borderRadius: 12, transition: "all 0.3s" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, height: 32 }}>
     <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>
      Down Payment<span style={{ color: T.red, marginLeft: 3, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>*</span>
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
     <Inp value={Math.round(salesPrice * downPct / 100)} onChange={v => { const pct = salesPrice > 0 ? (v / salesPrice) * 100 : 0; setDownPct(Math.round(pct * 100) / 100); }} prefix="$" suffix="" step={1000} max={salesPrice} sm req />
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
 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px 12px" }}>
  <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary }}>Include Escrow (Tax & Ins)</span>
  <button onClick={() => { if (loanType !== "FHA" && loanType !== "VA") setIncludeEscrow(!includeEscrow); }} style={{ width: 48, height: 28, borderRadius: 14, border: "none", cursor: (loanType === "FHA" || loanType === "VA") ? "not-allowed" : "pointer", background: includeEscrow ? T.green : T.inputBorder, position: "relative", transition: "background 0.2s", opacity: (loanType === "FHA" || loanType === "VA") ? 0.6 : 1 }}>
   <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, left: includeEscrow ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
  </button>
 </div>
 {(loanType === "FHA" || loanType === "VA") && <Note color={T.blue}>{loanType} loans require escrow impound accounts — this cannot be toggled off.</Note>}
 {!includeEscrow && loanType !== "FHA" && loanType !== "VA" && <Note color={T.orange}>Escrow OFF — Tax + Insurance ({fmt(calc.escrowAmount)}/mo) not shown in payment. Still included in DTI qualification.</Note>}
 {/* ── Refi: Current vs New comparison ── */}
 {isRefi && calc.refiEffPI > 0 && (
  <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
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
 <div className={changedFields.size > 0 ? "field-updated" : ""} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: isDesktop ? 8 : 16, marginTop: 0 }}>
  {(isRefi ? [
   { l: "New Loan", v: fmt(calc.refiNewLoanAmt || calc.loan), c: T.blue, s: refiPurpose === "Cash-Out" ? `incl ${fmt(refiCashOut)} cash-out` : calc.loanCategory, tip: "Your new loan amount after refinancing. For rate/term refis, this equals your current balance. For cash-out, it includes the additional amount." },
   { l: "New LTV", v: pct(calc.refiNewLTV || calc.ltv, 0), c: T.orange, s: `${fmt(Math.max(0, salesPrice - (calc.refiEffBalance || 0)))} equity`, tip: "New Loan-to-Value ratio after refinancing. Based on your current home value and new loan amount. Below 80% = no PMI on conventional." },
   { l: "Refi Costs", v: fmt(calc.totalClosingCosts), c: T.green, tip: "Total closing costs for your refinance — includes lender fees, title, appraisal, and government fees. No down payment or transfer tax on a refi." }
  ] : [
   { l: "Loan Amount", v: fmt(calc.loan), c: T.blue, s: calc.fhaUp > 0 ? `incl ${fmt(calc.fhaUp)} UFMIP` : calc.vaFundingFee > 0 ? `incl ${fmt(calc.vaFundingFee)} VA FF` : calc.loanCategory, tip: "Your total loan amount = purchase price minus down payment, plus any financed fees (like FHA UFMIP or VA Funding Fee). This is what you're borrowing from the lender." },
   { l: "LTV", v: pct(calc.ltv, 0), c: T.orange, s: `${downPct}% down`, tip: "Loan-to-Value ratio — your loan amount divided by the home's value. LTV determines mortgage insurance requirements and pricing. Below 80% LTV (20%+ down) = no PMI on conventional loans." },
   { l: "Cash to Close", v: fmt(calc.cashToClose), c: T.green, tip: "Total cash you need at closing = down payment + closing costs + prepaids – any credits (seller, lender, realtor). This is the check you bring to the closing table." }
  ]).map((m, i) => (
   <Card key={i} pad={14}>
    <div style={{ fontSize: 11, fontWeight: 500, color: T.textTertiary, marginBottom: 4, display: "flex", alignItems: "center" }}>{m.l}{m.tip && <InfoTip text={m.tip} />}</div>
    <div style={{ fontSize: 18, fontWeight: 700, color: m.c, fontFamily: FONT, letterSpacing: "-0.03em" }}>{m.v}</div>
    {m.s && <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>{m.s}</div>}
   </Card>
  ))}
 </div>
 </div>{/* end desktop left column / sticky summary */}
 <div style={isDesktop ? { width: "50%", flexShrink: 0, minWidth: 0, order: 2 } : {}}>
 <Card>
  {/* Rate */}
  <div data-field="calc-rate" className={isPulse("calc-rate")} style={{ borderRadius: 12, transition: "all 0.3s", marginBottom: 14 }}>
  {isRefi ? (<>
   <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
    <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>
     New Rate<span style={{ color: T.red, marginLeft: 3, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>*</span>
     <InfoTip text="The interest rate on your new loan. Compare this to your current rate to see your savings." />
    </div>
    {refiCurrentRate > 0 && <span style={{ marginLeft: "auto", fontSize: 11, color: T.textTertiary }}>Current: {refiCurrentRate}%</span>}
   </div>
   <Inp value={rate} onChange={setRate} prefix="" suffix="%" step={0.001} max={30} sm req />
   {refiCurrentRate > 0 && rate > 0 && rate < refiCurrentRate && (
    <div style={{ fontSize: 11, color: T.green, fontWeight: 600, marginTop: -6, marginBottom: 8 }}>↓ {(refiCurrentRate - rate).toFixed(3)}% rate drop</div>
   )}
   {refiCurrentRate > 0 && rate > 0 && rate >= refiCurrentRate && (
    <div style={{ fontSize: 11, color: T.orange, fontWeight: 600, marginTop: -6, marginBottom: 8 }}>⚠ New rate is {rate > refiCurrentRate ? "higher than" : "same as"} current ({refiCurrentRate}%)</div>
   )}
  </>) : (<>
   <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
    <div style={{ flex: 1 }}>
     <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>
       Rate<span style={{ color: T.red, marginLeft: 3, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>*</span>
       <InfoTip text="Your annual interest rate. Rate depends on loan type, FICO score, down payment %, loan amount, property type, and market conditions. Even a 0.25% difference can change your payment by hundreds per month." />
      </div>
     </div>
     <Inp value={rate} onChange={setRate} prefix="" suffix="%" step={0.001} max={30} sm req />
    </div>
    {calc.apr > 0 && calc.apr !== rate && (
     <div style={{ flex: 1, marginBottom: 2 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
       <span style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>APR</span>
       <InfoTip text={`Annual Percentage Rate (${calc.apr.toFixed(3)}%) reflects the true cost of borrowing including fees. APR fees: ${fmt(calc.aprFinanceCharges)} (origination ${fmt(underwritingFee + processingFee)}, points ${fmt(calc.pointsCost)}${calc.fhaUp > 0 ? ", UFMIP " + fmt(calc.fhaUp) : ""}${calc.vaFundingFee > 0 ? ", VA FF " + fmt(calc.vaFundingFee) : ""}). APR ≥ note rate because it includes finance charges.`} />
      </div>
      <div style={{ background: T.bgAccent, borderRadius: 12, padding: "10px 14px", fontSize: 18, fontWeight: 700, color: T.blue, fontFamily: FONT, textAlign: "center", border: `1px solid ${T.border}` }}>{calc.apr.toFixed(3)}%</div>
     </div>
    )}
   </div>
  </>)}
  </div>
  {/* Live Rates */}
  <button onClick={fetchRates} disabled={ratesLoading} style={{ width: "100%", background: `${T.blue}${liveRates ? '18' : '10'}`, border: `1px solid ${T.blue}33`, borderRadius: 12, padding: "10px 14px", cursor: ratesLoading ? "wait" : "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
   <span style={{ fontSize: 13, fontWeight: 600, color: T.blue, fontFamily: FONT }}>
    {ratesLoading ? "Fetching rates..." : liveRates ? "✓ Live Rates Applied" : "◉ Get Today's Rates"}
   </span>
   {liveRates && <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT }}>{liveRates.date || "Today"}</span>}
   {!liveRates && !ratesLoading && fredApiKey && <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT }}>FRED (Freddie Mac PMMS)</span>}
  </button>
  {ratesError && <div style={{ fontSize: 11, color: T.red, marginBottom: 10, wordBreak: "break-all", lineHeight: 1.4, padding: 10, background: T.errorBg, borderRadius: 8 }}>{ratesError}</div>}
  {liveRates && (<>
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
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
   {liveRates.source && <div style={{ fontSize: 10, color: T.textTertiary, textAlign: "center", marginTop: -8, marginBottom: 8 }}>Source: {liveRates.source}</div>}
  </>)}
  <div data-field="calc-term" className={isPulse("calc-term")} onClick={() => { markTouched("calc-term"); markTouched("calc-loantype"); }} style={{ borderRadius: 12, transition: "all 0.3s" }}>
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
   <Sel label="Term" value={term} onChange={v => setTerm(parseInt(v))} options={[{value:30,label:"30 Year"},{value:25,label:"25 Year"},{value:20,label:"20 Year"},{value:15,label:"15 Year"},{value:10,label:"10 Year"}]} sm req tip="Loan length. Shorter terms have lower rates and less total interest but higher monthly payments." />
   <Sel label="Loan Type" value={loanType} onChange={v => { setLoanType(v); userLoanTypeRef.current = v; setAutoJumboSwitch(false); }} options={LOAN_TYPES} sm req tip="Conventional — Standard loan, best rates with 20%+ down & 740+ FICO. PMI drops at 80% LTV.\n\nFHA — Government-backed, 3.5% down, 580+ score. Great for first-time buyers with limited savings.\n\nVA — For veterans/active military. 0% down, no PMI, best rates available.\n\nJumbo — For loans above conforming limits ($766K+). Higher rates, 20% down, stricter requirements.\n\nUSDA — 0% down for eligible rural/suburban areas. Income limits apply." />
   {loanType === "VA" && <Sel label="VA Usage" value={vaUsage} onChange={setVaUsage} options={VA_USAGE.map(v => ({value:v,label:v === "First Use" ? "First Use (2.15%)" : v === "Subsequent" ? "Subsequent (3.3%)" : "Disabled (0%)"}))} sm />}
  </div>
  {autoJumboSwitch && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: `${T.orange}12`, borderRadius: 10, marginTop: -4, marginBottom: 8 }}>
   <span style={{ fontSize: 14 }}></span>
   <div style={{ fontSize: 11, color: T.orange, lineHeight: 1.4 }}>
    <strong>Auto-switched to Jumbo</strong> — loan amount ({fmt(Math.round(salesPrice * (1 - downPct / 100)))}) exceeds the {fmt(getHighBalLimit(propType))} high-balance limit{UNIT_COUNT[propType] > 1 ? ` for ${propType.toLowerCase()} properties` : ""}. Jumbo requires 20% down, 700+ FICO, and max 43–50% DTI.
    <span onClick={() => { setLoanType("Conventional"); userLoanTypeRef.current = "Conventional"; setAutoJumboSwitch(false); }} style={{ color: T.blue, cursor: "pointer", fontWeight: 600, marginLeft: 4 }}>Override →</span>
   </div>
  </div>}
  </div>
  <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } : {}}>
  <div data-field="calc-proptype" className={isPulse("calc-proptype")} onClick={() => markTouched("calc-proptype")} style={{ borderRadius: 12, transition: "all 0.3s" }}>
  <Sel label="Property Type" value={propType} onChange={setPropType} options={PROP_TYPES} req tip="The type of home you're buying. Condos and multi-unit properties have different qualification rules." />
  </div>
  <Sel label="Occupancy" value={loanPurpose} onChange={v => {
   // Auto-adjust rate for investment property pricing
   if (v === "Purchase Investment" && loanPurpose !== "Purchase Investment") {
    setRate(prev => Math.round((prev + 1.0) * 1000) / 1000);
   } else if (v !== "Purchase Investment" && loanPurpose === "Purchase Investment") {
    setRate(prev => Math.round(Math.max(0, prev - 1.0) * 1000) / 1000);
   }
   setLoanPurpose(v);
  }} options={[{value:"Purchase Primary",label:"Primary"},{value:"Purchase 2nd Home",label:"Second Home"},{value:"Purchase Investment",label:"Investment"}]} req tip="How you'll use the property. Investment properties typically carry a 0.750–1.000% rate premium and require 15-25% down." />
  </div>{/* end proptype+occupancy 2-col grid */}
  {loanPurpose === "Purchase Investment" && (
   <Note color={T.orange}>Investment property rate adjustment: +1.000% applied automatically (typical range: 0.750–1.250%). Adjust your rate manually if your lender quotes differently.</Note>
  )}
  {(loanPurpose === "Purchase Investment" || (loanPurpose === "Purchase Primary" && (UNIT_COUNT[propType] || 1) > 1)) && (
   <div>
    <Inp label={loanPurpose === "Purchase Investment" ? "Expected Monthly Rent" : `Non-Occupying Unit Rent (${(UNIT_COUNT[propType] || 1) - 1} unit${(UNIT_COUNT[propType] || 1) - 1 > 1 ? "s" : ""})`}
     value={subjectRentalIncome} onChange={setSubjectRentalIncome} prefix="$" suffix="/mo" max={50000}
     tip={loanPurpose === "Purchase Investment"
      ? "Expected gross monthly rent. Lenders use 75% of this to offset your PITIA (housing payment) for DTI qualification. If 75% of rent exceeds PITIA, the excess counts as income."
      : `Total rent from the ${(UNIT_COUNT[propType] || 1) - 1} unit${(UNIT_COUNT[propType] || 1) - 1 > 1 ? "s" : ""} you won't live in. Lenders add 75% of this as qualifying income on top of your regular employment income.`
     } />
    {subjectRentalIncome > 0 && (
     <div style={{ background: `${T.green}08`, borderRadius: 10, padding: "10px 14px", marginTop: -4, marginBottom: 14, border: `1px solid ${T.green}18` }}>
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
  <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } : {}}>
  <Sel label="State (property tax)" value={propertyState} onChange={v => { setPropertyState(v); if (v !== "California") setCity(""); }} options={STATE_NAMES_PROP} req />
  {propertyState === "California" ? (
   <SearchSelect label="City (tax rate)" value={city} onChange={setCity} options={CITY_NAMES} />
  ) : (
   <>
    <SearchSelect label="City" value={city} onChange={setCity} options={STATE_CITIES[propertyState] || []} />
    {propTaxMode === "auto" && (
     <div style={{ background: `${T.blue}08`, borderRadius: 12, padding: "10px 14px", marginBottom: 14, marginTop: -6 }}>
      <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5 }}>Using {propertyState} average effective rate of {((STATE_PROPERTY_TAX_RATES[propertyState] || 0.0102) * 100).toFixed(2)}%. For a precise rate, check your county assessor.</div>
     </div>
    )}
   </>
  )}
  </div>{/* end state+city 2-col grid */}
  {/* ── Property Tax — 3-layer pill (matches Overview pattern) ── */}
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
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
   <Inp label="Insurance" value={annualIns} onChange={setAnnualIns} suffix="/yr" max={50000} sm tip="Annual homeowner's insurance premium. Required by all lenders. Typically 0.3-1% of home value per year." />
   <Inp label="HOA" value={hoa} onChange={setHoa} suffix="/mo" max={10000} sm tip="Monthly Homeowners Association fee. Common in condos and planned communities. This counts toward your DTI." />
  </div>
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
   <Sel label="Closing Month" value={closingMonth} onChange={v => setClosingMonth(parseInt(v))} options={[{value:1,label:"January"},{value:2,label:"February"},{value:3,label:"March"},{value:4,label:"April"},{value:5,label:"May"},{value:6,label:"June"},{value:7,label:"July"},{value:8,label:"August"},{value:9,label:"September"},{value:10,label:"October"},{value:11,label:"November"},{value:12,label:"December"}]} sm />
   <Sel label="Closing Day" value={closingDay} onChange={v => setClosingDay(parseInt(v))} options={Array.from({length: new Date(new Date().getFullYear(), closingMonth, 0).getDate()}, (_,i) => ({value:i+1,label:String(i+1)}))} sm />
  </div>
  {(() => {
   const mos = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
   const skipMo = mos[closingMonth % 12];
   const firstMo = mos[(closingMonth + 1) % 12];
   return <div style={{ background: `${T.blue}10`, borderRadius: 10, padding: "10px 14px", marginTop: -2, marginBottom: 4 }}>
    <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6 }}>
     <span style={{ fontWeight: 600, color: T.blue }}>Close {mos[closingMonth-1]} {closingDay}</span> → {calc.autoPrepaidDays} days prepaid interest · No payment in <strong>{skipMo}</strong> · First payment <strong>{firstMo} 1st</strong>
    </div>
   </div>;
  })()}
 </Card>
 </div>{/* end desktop left column */}
 </div>{/* end desktop flex wrapper */}
 <GuidedNextButton />
</>);
}
