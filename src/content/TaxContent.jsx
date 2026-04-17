import React from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

export default function TaxContent({
  T, isDesktop, calc, fmt,
  loanPurpose, subjectRentalIncome, appreciationRate, setAppreciationRate,
  married, setMarried, FILING_STATUSES,
  taxState, setTaxState, STATE_NAMES,
  STATE_TAX, FED_BRACKETS, FED_STD_DEDUCTION,
  showFedBrackets, setShowFedBrackets,
  showStateBrackets, setShowStateBrackets,
  isPulse, markTouched, setTab,
  Hero, Card, Sec, Inp, Sel, Note, MRow,
  GuidedNextButton,
}) {
  return (<>

{/* ── SECOND HOME: No tax savings applicable ── */}
{loanPurpose === "Purchase 2nd Home" ? (
 <div style={{ marginTop: 20 }}>
  <Card pad={20}>
   <div style={{ textAlign: "center", padding: "30px 20px" }}>
    <div style={{ fontSize: 40, marginBottom: 12 }}></div>
    <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>Second Home — No Additional Tax Benefit</div>
    <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>
     Second homes do not qualify for the same tax deductions as a primary residence. Mortgage interest may still be deductible if your total mortgage debt (primary + second home) is under the {married === "MFS" ? "$375K" : "$750K"} TCJA cap, but property taxes are subject to the {married === "MFS" ? "$20,200" : "$40,400"} SALT cap across all properties combined.
    </div>
    <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.7, maxWidth: 480, margin: "12px auto 0" }}>
     If you rent the property out for more than 14 days/year, it becomes a rental property and IRS rules change significantly. Consult your CPA for your specific situation.
    </div>
    <div style={{ marginTop: 20, padding: "10px 14px", background: `${T.orange}08`, borderRadius: 10, border: `1px solid ${T.orange}18` }}>
     <div style={{ fontSize: 11, color: T.orange, fontWeight: 600, lineHeight: 1.6 }}>This is general information only — not tax advice. Tax situations vary. Please confirm with your CPA or tax professional.</div>
    </div>
   </div>
  </Card>
 </div>
) : loanPurpose === "Purchase Investment" ? (
 /* ── INVESTMENT: Schedule E Pro Forma ── */
 <div style={{ marginTop: 20 }}>
  <div style={isDesktop ? { display: "flex", gap: 24, alignItems: "flex-start" } : {}}>
  <div style={isDesktop ? { position: "sticky", top: 90, width: "50%", flexShrink: 0, maxHeight: "calc(100vh - 110px)", overflowY: "auto" } : {}}>
   <Hero value={fmt(calc.schedENetIncome)} label="Schedule E — Net Rental Income" color={calc.schedENetIncome >= 0 ? T.green : T.red} sub={`${fmt(calc.schedENetIncome / 12)}/mo`} />
   <Card pad={14} style={{ marginTop: 16 }}>
    <div style={{ fontSize: 11, color: T.textTertiary }}>Annual Cash Flow</div>
    <div style={{ fontSize: 24, fontWeight: 700, fontFamily: FONT, letterSpacing: "-0.03em", color: calc.schedECashFlow >= 0 ? T.green : T.red }}>{fmt(calc.schedECashFlow)}<span style={{ fontSize: 13, color: T.textTertiary }}>/yr</span></div>
    <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 4 }}>{fmt(calc.schedECashFlow / 12)}/mo before taxes</div>
   </Card>
  </div>
  <div style={isDesktop ? { width: "50%", flexShrink: 0, minWidth: 0 } : {}}>
   <Sec title="Schedule E Pro Forma">
    <Card>
     <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.7, marginBottom: 14 }}>
      Investment property income and expenses reported on IRS Schedule E. This projects your annual rental income against deductible expenses.
     </div>
     {/* Income */}
     <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Gross Rental Income</div>
     <MRow label="Monthly Rent" value={fmt(subjectRentalIncome)} />
     <MRow label="Annual Gross Rent" value={fmt(subjectRentalIncome * 12)} bold />
     <MRow label="Vacancy (5%)" value={`-${fmt(Math.round(subjectRentalIncome * 12 * 0.05))}`} color={T.red} />
     <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8, marginBottom: 16 }}>
      <MRow label="Effective Gross Income" value={fmt(calc.schedEGrossIncome)} bold />
     </div>
     {/* Expenses */}
     <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Deductible Expenses</div>
     <MRow label="Mortgage Interest (Yr 1)" value={fmt(calc.yearlyMortInt)} />
     <MRow label="Property Tax" value={fmt(calc.yearlyTax)} />
     <MRow label="Insurance" value={fmt(calc.yearlyIns)} />
     {calc.monthlyHOA > 0 && <MRow label="HOA" value={fmt(calc.monthlyHOA * 12)} />}
     {calc.monthlyMI > 0 && <MRow label="Mortgage Insurance" value={fmt(calc.monthlyMI * 12)} />}
     <MRow label="Depreciation (27.5 yr)" value={fmt(calc.schedEDepreciation)} tip="Only the building value is depreciated — land is excluded. Estimated at 80% of purchase price ÷ 27.5 years." />
     <MRow label="Mgmt & Maintenance (10%)" value={fmt(calc.schedEMgmt)} />
     <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8, marginBottom: 16 }}>
      <MRow label="Total Expenses" value={fmt(calc.schedETotalExpenses)} bold />
     </div>
     {/* Net */}
     <div style={{ background: calc.schedENetIncome < 0 ? `${T.green}08` : `${T.orange}08`, borderRadius: 12, padding: 14 }}>
      <MRow label="Net Rental Income (Loss)" value={fmt(calc.schedENetIncome)} color={calc.schedENetIncome < 0 ? T.green : T.text} bold />
      {calc.schedENetIncome < 0 && (
       <div style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.6, marginTop: 8 }}>
        A paper loss of <strong style={{ color: T.green }}>{fmt(Math.abs(calc.schedENetIncome))}</strong> may be deductible against other income if your AGI is under $150K (up to $25K passive loss allowance). This can reduce your tax bill even though the property generates positive cash flow after adding back depreciation.
       </div>
      )}
     </div>
    </Card>
   </Sec>
   <Sec title="Cash Flow vs Tax Loss">
    <Card>
     <MRow label="Effective Gross Income" value={fmt(calc.schedEGrossIncome)} />
     <MRow label="Operating Expenses (excl. depreciation)" value={`-${fmt(calc.schedECashExpenses)}`} color={T.red} />
     <MRow label="Debt Service (P&I)" value={`-${fmt(calc.pi * 12)}`} color={T.red} />
     <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
      <MRow label="Annual Cash Flow" value={fmt(calc.schedECashFlow)} color={calc.schedECashFlow >= 0 ? T.green : T.red} bold />
     </div>
     <div style={{ marginTop: 12, fontSize: 11, color: T.textTertiary, lineHeight: 1.6 }}>
      Cash flow is what you actually receive. Schedule E net income includes non-cash deductions (depreciation) that create a "paper loss" for tax purposes — so you can have positive cash flow and a tax loss simultaneously.
     </div>
    </Card>
   </Sec>
   <div style={{ marginTop: 12, padding: "10px 14px", background: `${T.orange}08`, borderRadius: 10, border: `1px solid ${T.orange}18` }}>
    <div style={{ fontSize: 11, color: T.orange, fontWeight: 600, lineHeight: 1.6 }}>This is an estimate for illustration purposes only — not tax advice. Depreciation recapture, passive activity limits, and other rules apply. Please confirm with your CPA.</div>
   </div>
  </div>
  </div>
 </div>
) : (
 /* ── PRIMARY RESIDENCE: Schedule A Tax Savings (original) ── */
 <div style={isDesktop ? { display: "flex", gap: 24, marginTop: 20, alignItems: "flex-start" } : {}}>
 <div style={isDesktop ? { position: "sticky", top: 90, width: "50%", flexShrink: 0, maxHeight: "calc(100vh - 110px)", overflowY: "auto" } : {}}>
 <div style={isDesktop ? {} : { marginTop: 20 }}>
  <Hero value={fmt(calc.totalTaxSavings)} label="Annual Tax Savings" color={T.purple} sub={`${fmt(calc.monthlyTaxSavings)}/mo`} />
 </div>
 <Card pad={14} style={{ marginTop: 16 }}>
  <div style={{ fontSize: 11, color: T.textTertiary }}>After-Tax Payment</div>
  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: FONT, letterSpacing: "-0.03em" }}>{fmt(calc.afterTaxPayment)}<span style={{ fontSize: 13, color: T.textTertiary }}>/mo</span></div>
 </Card>
 <Sec title="Your Info">
  <div data-field="tax-filing" className={isPulse("tax-filing")} onClick={() => markTouched("tax-filing")} style={{ borderRadius: 18, transition: "all 0.3s" }}>
  <Card>
   <Sel label="Filing Status" value={married} onChange={setMarried} options={FILING_STATUSES} req tip="Your tax filing status. Affects standard deduction, tax brackets, and SALT cap. Married Filing Jointly gets the largest deductions." />
   <Sel label="Tax State" value={taxState} onChange={setTaxState} options={STATE_NAMES.map(s => ({value:s,label:s}))} req tip="The state where you file taxes. Affects state income tax calculations and deductions." />
   <Inp label="Appreciation Rate" value={appreciationRate} onChange={setAppreciationRate} prefix="" suffix="% / yr" step={0.5} max={50} tip="Estimated annual home value increase. National historical average is ~3-4%. Used for wealth-building and equity projections." />
   {calc.yearlyInc <= 0 && <div data-field="tax-needs-income" className={isPulse("tax-needs-income")} onClick={() => setTab("income")} style={{ borderRadius: 12, transition: "all 0.3s", cursor: "pointer" }}><Note color={T.orange}>Tap here to add income on the Income tab to see tax savings.</Note></div>}
   {STATE_TAX[taxState]?.type === "none" && <Note color={T.blue}>{taxState} has no state income tax.</Note>}
  </Card>
  </div>
 </Sec>
 </div>{/* end desktop tax left column */}
 <div style={isDesktop ? { width: "50%", flexShrink: 0, minWidth: 0 } : {}}>
 {calc.yearlyInc > 0 && (<>
  <Sec title="Write-Offs Due to Homeownership">
   <Card>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, fontSize: 11, color: T.textTertiary, fontWeight: 600, paddingBottom: 8, borderBottom: `1px solid ${T.separator}` }}>
     <span>Item</span><span style={{textAlign:"right"}}>Federal</span><span style={{textAlign:"right"}}>{taxState}</span>
    </div>
    {[["Property Tax (SALT capped)", fmt(calc.fedPropTax), fmt(calc.yearlyTax)],
     ["Mortgage Interest (Yr 1)", fmt(calc.fedMortInt), fmt(calc.stateMortInt)],
    ].map(([l, f, c], i) => (
     <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, padding: "8px 0", borderBottom: `1px solid ${T.separator}`, fontSize: 13 }}>
      <span style={{ color: T.textSecondary, fontWeight: 400 }}>{l}</span>
      <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>{f}</span>
      <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>{c}</span>
     </div>
    ))}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, padding: "10px 0", borderBottom: `2px solid ${T.separator}`, fontSize: 13 }}>
     <span style={{ color: T.text, fontWeight: 700 }}>Itemized Total</span>
     <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 700 }}>{fmt(calc.fedItemized)}</span>
     <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 700 }}>{fmt(calc.stateItemized)}</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, borderBottom: `1px solid ${T.separator}`, fontSize: 13, background: `${T.blue}06`, margin: "0 -14px", padding: "8px 14px" }}>
     <span style={{ color: T.textSecondary }}>Std Deduction</span>
     <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>{fmt(calc.fedStdDeduction)}</span>
     <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>{fmt(calc.stStdDeduction)}</span>
    </div>
    {/* ── THE DELTA ── */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, fontSize: 13, background: calc.fedItemizes || calc.stateItemizes ? `${T.green}08` : `${T.orange}08`, margin: "0 -14px", padding: "10px 14px", borderRadius: "0 0 12px 12px" }}>
     <span style={{ color: T.text, fontWeight: 700 }}>Delta (Benefit)</span>
     <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 700, color: calc.fedItemizes ? T.green : T.orange }}>{calc.fedItemizes ? fmt(calc.fedDelta) : "$0"}</span>
     <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 700, color: calc.stateItemizes ? T.green : T.orange }}>{calc.stateItemizes ? fmt(calc.stateDelta) : "$0"}</span>
    </div>
    {calc.deductibleLoanPct < 1 && <Note color={T.orange}>Federal mortgage interest limited to first {married === "MFS" ? "$375K" : "$750K"} of loan balance. Your loan ({fmt(calc.loan)}) exceeds this — only {(calc.deductibleLoanPct * 100).toFixed(1)}% of interest is deductible federally.</Note>}
    <Note color={T.blue}>SALT cap: {fmt(calc.saltCap)} (OBBBA 2026){calc.saltCap < (married === "MFS" ? 20200 : 40400) ? ` — phased down from ${married === "MFS" ? "$20,200" : "$40,400"}. For every $10K earned above ${married === "MFS" ? "$252,500" : "$505,000"}, your cap drops $${married === "MFS" ? "1,500" : "3,000"}. Floor: ${married === "MFS" ? "$5,000" : "$10,000"}.` : `. Base cap: ${married === "MFS" ? "$20,200" : "$40,400"} — phases down for income above ${married === "MFS" ? "$252,500" : "$505,000"}.`} Mortgage interest cap: {married === "MFS" ? "$375K" : "$750K"} loan balance (TCJA).</Note>
   </Card>
  </Sec>
  {/* ── THE DELTA EXPLANATION ── */}
  <Sec title="How the Tax Benefit Works">
   <Card>
    {!calc.fedItemizes && !calc.stateItemizes ? (
     <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.orange, marginBottom: 8 }}>Your itemized deductions don't exceed the standard deduction</div>
      <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.7 }}>
       Right now, your property tax + mortgage interest ({fmt(calc.fedItemized)}) is less than the standard deduction ({fmt(calc.fedStdDeduction)}). This means there's no additional federal tax benefit from homeownership yet.
      </div>
      <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.7, marginTop: 8 }}>
       This can change if your income, mortgage amount, or property taxes increase. The standard deduction is the "floor" — you only benefit from the amount ABOVE it.
      </div>
     </div>
    ) : (
     <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.green, marginBottom: 10 }}>Here's the real benefit</div>
      <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.8, marginBottom: 12 }}>
       Everyone gets a standard deduction ({fmt(calc.fedStdDeduction)} federal). You'd get that whether you own a home or not. The benefit of homeownership is the <strong style={{ color: T.text }}>delta</strong> — the amount your itemized deductions EXCEED the standard deduction.
      </div>
      {calc.fedItemizes && (
       <div style={{ background: `${T.green}08`, borderRadius: 12, padding: 14, marginBottom: 12, border: `1px solid ${T.green}22` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.green, marginBottom: 6 }}>Federal Delta: {fmt(calc.fedDelta)}</div>
        <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.7 }}>
         Your itemized deductions ({fmt(calc.fedItemized)}) exceed the standard deduction ({fmt(calc.fedStdDeduction)}) by <strong style={{ color: T.green }}>{fmt(calc.fedDelta)}</strong>. This delta comes off your <strong style={{ color: T.text }}>highest tax brackets first</strong>:
        </div>
        {calc.fedWaterfall.length > 0 && (
         <div style={{ marginTop: 10 }}>
          {calc.fedWaterfall.map((w, i) => (
           <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < calc.fedWaterfall.length - 1 ? `1px solid ${T.green}15` : "none" }}>
            <span style={{ fontSize: 13, color: T.text }}>
             <strong>{(w.rate * 100).toFixed(0)}%</strong> bracket × {fmt(w.amount)}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.green, fontFamily: FONT }}>{fmt(w.savings)}</span>
           </div>
          ))}
          <div style={{ borderTop: `2px solid ${T.green}33`, marginTop: 6, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
           <span style={{ fontSize: 13, fontWeight: 700 }}>Federal Tax Savings</span>
           <span style={{ fontSize: 15, fontWeight: 700, color: T.green, fontFamily: FONT }}>{fmt(calc.fedSavings)}</span>
          </div>
         </div>
        )}
       </div>
      )}
      {calc.stateItemizes && STATE_TAX[taxState]?.type !== "none" && (
       <div style={{ background: `${T.green}08`, borderRadius: 12, padding: 14, marginBottom: 12, border: `1px solid ${T.green}22` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.green, marginBottom: 6 }}>{taxState} Delta: {fmt(calc.stateDelta)}</div>
        {calc.stWaterfall.length > 0 ? (
         <div>
          <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.7 }}>
           State itemized ({fmt(calc.stateItemized)}) exceeds state standard deduction ({fmt(calc.stStdDeduction)}) by <strong style={{ color: T.green }}>{fmt(calc.stateDelta)}</strong>:
          </div>
          <div style={{ marginTop: 10 }}>
           {calc.stWaterfall.map((w, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < calc.stWaterfall.length - 1 ? `1px solid ${T.green}15` : "none" }}>
             <span style={{ fontSize: 13, color: T.text }}>
              <strong>{(w.rate * 100).toFixed(2)}%</strong> bracket × {fmt(w.amount)}
             </span>
             <span style={{ fontSize: 13, fontWeight: 700, color: T.green, fontFamily: FONT }}>{fmt(w.savings)}</span>
            </div>
           ))}
           <div style={{ borderTop: `2px solid ${T.green}33`, marginTop: 6, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{taxState} Tax Savings</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: T.green, fontFamily: FONT }}>{fmt(calc.stateSavings)}</span>
           </div>
          </div>
         </div>
        ) : (
         <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.7 }}>
          {taxState} flat rate of {(STATE_TAX[taxState]?.rate * 100).toFixed(2)}% × {fmt(calc.stateDelta)} delta = <strong style={{ color: T.green }}>{fmt(calc.stateSavings)}</strong> savings
         </div>
        )}
       </div>
      )}
      {/* Plain English Summary */}
      <div style={{ background: T.pillBg, borderRadius: 12, padding: 14, marginTop: 4 }}>
       <div style={{ fontSize: 13, color: T.text, lineHeight: 1.8 }}>
        <strong>In plain English:</strong> As a renter, you'd take the standard deduction. As a homeowner, you can itemize — and your deductions are <strong style={{ color: T.green }}>{fmt(calc.fedDelta)}</strong> higher on your federal return{calc.stateDelta > 0 ? <> and <strong style={{ color: T.green }}>{fmt(calc.stateDelta)}</strong> higher on your state return</> : null}. That extra deduction lowers your tax bill by <strong style={{ color: T.green }}>{fmt(calc.totalTaxSavings)}/year</strong> ({fmt(calc.monthlyTaxSavings)}/mo).
       </div>
       <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 8, lineHeight: 1.6, borderTop: `1px solid ${T.separator}`, paddingTop: 8 }}>
        <strong style={{ color: T.textSecondary }}>Important:</strong> This assumes you're currently renting or taking the standard deduction. If you already own a home and your existing deductions exceed the standard deduction, your actual tax benefit from this purchase would be smaller — only the <em>additional</em> mortgage interest and property taxes above what you already deduct.
       </div>
      </div>
     </div>
    )}
    <div style={{ marginTop: 12, padding: "10px 14px", background: `${T.orange}08`, borderRadius: 10, border: `1px solid ${T.orange}18` }}>
     <div style={{ fontSize: 11, color: T.orange, fontWeight: 600, lineHeight: 1.6 }}>This is an estimate for illustration purposes only — not tax advice. Tax situations vary based on individual circumstances. Please confirm with your CPA or tax professional before making financial decisions based on these projections.</div>
    </div>
   </Card>
  </Sec>
  <Sec title="Savings Summary">
   <Card>
    {[["Federal Savings", calc.fedSavings], [`${taxState} Savings`, calc.stateSavings], ["Total Annual", calc.totalTaxSavings]].map(([l, sv], i) => (
     <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: i < 2 ? `1px solid ${T.separator}` : "none" }}>
      <span style={{ fontSize: 14, color: i === 2 ? T.text : T.textSecondary, fontWeight: i === 2 ? 700 : 400 }}>{l}</span>
      <span style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT, color: T.purple }}>{fmt(sv)}</span>
     </div>
    ))}
   </Card>
  </Sec>
  <Sec title="Federal Brackets">
   <Card>
    <div onClick={() => setShowFedBrackets(!showFedBrackets)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "2px 0" }}>
     <span style={{ fontSize: 13, color: T.textSecondary, fontWeight: 600 }}>Federal Tax Brackets ({married === "MFJ" ? "MFJ" : married === "MFS" ? "MFS" : married === "HOH" ? "HOH" : "Single"})</span>
     <span style={{ fontSize: 12, color: T.textTertiary }}>{showFedBrackets ? "▼" : "▶"}</span>
    </div>
    {showFedBrackets && <div style={{ marginTop: 8 }}>
     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, fontSize: 11, color: T.textTertiary, fontWeight: 600, paddingBottom: 6, borderBottom: `1px solid ${T.separator}` }}>
      <span>From</span><span style={{textAlign:"right"}}>To</span><span style={{textAlign:"right"}}>Rate</span>
     </div>
     {(FED_BRACKETS[married] || FED_BRACKETS.Single).map((b, i) => (
      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, padding: "6px 0", borderBottom: `1px solid ${T.separator}`, fontSize: 12 }}>
       <span style={{ color: T.textSecondary }}>{fmt(b.min)}</span>
       <span style={{ textAlign: "right", color: T.textSecondary }}>{b.max === Infinity || b.max === null ? "∞" : fmt(b.max)}</span>
       <span style={{ textAlign: "right", fontWeight: 600, color: T.text }}>{(b.rate * 100).toFixed(1)}%</span>
      </div>
     ))}
     <div style={{ padding: "8px 0 0", fontSize: 12, color: T.textTertiary }}>Standard Deduction: <strong style={{ color: T.text }}>{fmt(FED_STD_DEDUCTION[married] || FED_STD_DEDUCTION.Single)}</strong> · SALT Cap: <strong style={{ color: T.text }}>{fmt(calc.saltCap)}</strong>{calc.saltCap < (married === "MFS" ? 20200 : 40400) ? <span style={{ color: T.orange }}> (phased down)</span> : ""}</div>
    </div>}
   </Card>
  </Sec>
  {STATE_TAX[taxState]?.type !== "none" && <Sec title={`${taxState} Brackets`}>
   <Card>
    <div onClick={() => setShowStateBrackets(!showStateBrackets)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "2px 0" }}>
     <span style={{ fontSize: 13, color: T.textSecondary, fontWeight: 600 }}>{taxState} Tax {STATE_TAX[taxState]?.type === "flat" ? `(Flat ${(STATE_TAX[taxState].rate * 100).toFixed(2)}%)` : "Brackets"}</span>
     <span style={{ fontSize: 12, color: T.textTertiary }}>{showStateBrackets ? "▼" : "▶"}</span>
    </div>
    {showStateBrackets && STATE_TAX[taxState]?.type === "progressive" && <div style={{ marginTop: 8 }}>
     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, fontSize: 11, color: T.textTertiary, fontWeight: 600, paddingBottom: 6, borderBottom: `1px solid ${T.separator}` }}>
      <span>From</span><span style={{textAlign:"right"}}>To</span><span style={{textAlign:"right"}}>Rate</span>
     </div>
     {(STATE_TAX[taxState][married === "MFJ" ? "m" : "s"] || []).map((b, i) => (
      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, padding: "6px 0", borderBottom: `1px solid ${T.separator}`, fontSize: 12 }}>
       <span style={{ color: T.textSecondary }}>{fmt(b.min)}</span>
       <span style={{ textAlign: "right", color: T.textSecondary }}>{b.max === Infinity || b.max === null ? "∞" : fmt(b.max)}</span>
       <span style={{ textAlign: "right", fontWeight: 600, color: T.text }}>{(b.rate * 100).toFixed(2)}%</span>
      </div>
     ))}
     {STATE_TAX[taxState]?.std && <div style={{ padding: "8px 0 0", fontSize: 12, color: T.textTertiary }}>Std Deduction: <strong style={{ color: T.text }}>{fmt(STATE_TAX[taxState].std[married === "MFJ" ? "m" : "s"] || 0)}</strong></div>}
    </div>}
    {showStateBrackets && STATE_TAX[taxState]?.type === "flat" && <div style={{ marginTop: 8, fontSize: 12, color: T.textSecondary }}>
     Flat rate of <strong style={{ color: T.text }}>{(STATE_TAX[taxState].rate * 100).toFixed(2)}%</strong> on all taxable income.
     {STATE_TAX[taxState]?.surtax && <span> Plus {(STATE_TAX[taxState].surtax.rate * 100)}% surtax on income over {fmt(STATE_TAX[taxState].surtax.threshold)}.</span>}
     {STATE_TAX[taxState]?.std && <div style={{ marginTop: 4 }}>Std Deduction: <strong style={{ color: T.text }}>{fmt(STATE_TAX[taxState].std[married === "MFJ" ? "m" : "s"] || 0)}</strong></div>}
    </div>}
   </Card>
  </Sec>}
  <Sec title="True Cost of Ownership">
   <Card>
    <MRow label="Housing Payment" value={fmt(calc.housingPayment)} bold />
    <MRow label="Tax Savings" value={`-${fmt(calc.monthlyTaxSavings)}`} color={T.green} indent />
    <MRow label="Principal Reduction" value={`-${fmt(calc.monthlyPrinReduction)}`} color={T.green} indent />
    <MRow label={`Appreciation (${appreciationRate}%)`} value={`-${fmt(calc.monthlyAppreciation)}`} color={T.green} indent />
    <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
     <MRow label="Net Monthly Expense" value={fmt(calc.netPostSaleExpense)} color={calc.netPostSaleExpense < calc.housingPayment ? T.green : T.text} bold />
    </div>
   </Card>
  </Sec>
 </>)}
 </div>
 </div>
)}
 <GuidedNextButton />
</>);
}
