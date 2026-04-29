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
) : (() => {
 /* ── PRIMARY RESIDENCE: rebuilt to mimic Christo's spreadsheet client-walkthrough flow ── */
 // Helper: tax owed per bracket for a given taxable income
 const taxByBracket = (taxableIncome, brackets) => {
  const rows = [];
  let total = 0;
  for (const b of (brackets || [])) {
   const max = (b.max === Infinity || b.max == null) ? Infinity : b.max;
   const inBracket = Math.max(0, Math.min(Math.max(0, taxableIncome), max) - b.min);
   const tax = inBracket * b.rate;
   rows.push({ from: b.min, to: max, rate: b.rate, amount: inBracket, tax });
   total += tax;
  }
  return { rows, total };
 };

 // Federal Before/After
 const fedBrackets = FED_BRACKETS[married] || FED_BRACKETS.Single;
 const fedDeductionAfter = Math.max(calc.fedItemized, calc.fedStdDeduction);
 const fedTaxableBefore = Math.max(0, calc.yearlyInc - calc.fedStdDeduction);
 const fedTaxableAfter = Math.max(0, calc.yearlyInc - fedDeductionAfter);
 const fedBefore = taxByBracket(fedTaxableBefore, fedBrackets);
 const fedAfter = taxByBracket(fedTaxableAfter, fedBrackets);
 const fedSav = fedBefore.total - fedAfter.total;

 // State Before/After
 const stateInfo = STATE_TAX[taxState] || { type: "none" };
 const stateDeductionAfter = Math.max(calc.stateItemized, calc.stStdDeduction);
 const stateTaxableBefore = Math.max(0, calc.yearlyInc - calc.stStdDeduction);
 const stateTaxableAfter = Math.max(0, calc.yearlyInc - stateDeductionAfter);
 let stateBefore = { rows: [], total: 0 };
 let stateAfter = { rows: [], total: 0 };
 if (stateInfo.type === "progressive") {
  const sb = stateInfo[married === "MFJ" ? "m" : "s"] || [];
  stateBefore = taxByBracket(stateTaxableBefore, sb);
  stateAfter = taxByBracket(stateTaxableAfter, sb);
 } else if (stateInfo.type === "flat") {
  const r = stateInfo.rate;
  stateBefore = { rows: [{ from: 0, to: Infinity, rate: r, amount: stateTaxableBefore, tax: stateTaxableBefore * r }], total: stateTaxableBefore * r };
  stateAfter = { rows: [{ from: 0, to: Infinity, rate: r, amount: stateTaxableAfter, tax: stateTaxableAfter * r }], total: stateTaxableAfter * r };
 }
 const stateSav = stateBefore.total - stateAfter.total;

 // Effective rates
 const fedEffBefore = calc.yearlyInc > 0 ? fedBefore.total / calc.yearlyInc : 0;
 const fedEffAfter = calc.yearlyInc > 0 ? fedAfter.total / calc.yearlyInc : 0;
 const stEffBefore = calc.yearlyInc > 0 ? stateBefore.total / calc.yearlyInc : 0;
 const stEffAfter = calc.yearlyInc > 0 ? stateAfter.total / calc.yearlyInc : 0;
 const combBefore = fedEffBefore + stEffBefore;
 const combAfter = fedEffAfter + stEffAfter;

 // Adjusted Housing walkdown
 const monthlyHousing = calc.housingPayment;
 const mFedSav = fedSav / 12;
 const mStateSav = stateSav / 12;
 const afterTaxCashFlow = monthlyHousing - mFedSav - mStateSav;
 const adjustedHousing = afterTaxCashFlow - calc.monthlyPrinReduction;
 const netPostSale = adjustedHousing - calc.monthlyAppreciation;

 const FILING_LABELS = { Single: "Single", MFJ: "Married, Joint", MFS: "Married, Separate", HOH: "Head of Household" };

 return (<div style={{ marginTop: 20 }}>

  {/* 1. Hero — kept */}
  <Hero value={fmt(calc.totalTaxSavings)} label="Annual Tax Savings" color={T.purple} sub={`${fmt(calc.monthlyTaxSavings)}/mo`} />

  {/* 2. Educational example: how write-offs work (hardcoded teaching numbers) */}
  <Sec title="Example: How Tax Write-offs Work">
   <Card>
    <div style={{ overflowX: "auto" }}>
     <div style={{ display: "grid", gridTemplateColumns: "90px repeat(6, 1fr)", gap: 0, fontSize: 12, minWidth: 620 }}>
      <div style={{ fontWeight: 700, color: T.textTertiary, padding: "8px 6px", borderBottom: `1px solid ${T.separator}`, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", fontSize: 10 }}>Tax Year</div>
      <div style={{ fontWeight: 700, color: T.textTertiary, padding: "8px 6px", borderBottom: `1px solid ${T.separator}`, textAlign: "right", fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", fontSize: 10 }}>Income</div>
      <div style={{ fontWeight: 700, color: T.textTertiary, padding: "8px 6px", borderBottom: `1px solid ${T.separator}`, textAlign: "right", fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", fontSize: 10 }}>Write-offs</div>
      <div style={{ fontWeight: 700, color: T.textTertiary, padding: "8px 6px", borderBottom: `1px solid ${T.separator}`, textAlign: "right", fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", fontSize: 10 }}>Taxable Inc.</div>
      <div style={{ fontWeight: 700, color: T.textTertiary, padding: "8px 6px", borderBottom: `1px solid ${T.separator}`, textAlign: "right", fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", fontSize: 10 }}>Eff. Rate</div>
      <div style={{ fontWeight: 700, color: T.textTertiary, padding: "8px 6px", borderBottom: `1px solid ${T.separator}`, textAlign: "right", fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", fontSize: 10 }}>Taxes Owed</div>
      <div style={{ fontWeight: 700, color: T.textTertiary, padding: "8px 6px", borderBottom: `1px solid ${T.separator}`, textAlign: "right", fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", fontSize: 10 }}>Delta</div>

      <div style={{ padding: "10px 6px", color: T.text, fontWeight: 600 }}>Year 1</div>
      <div style={{ padding: "10px 6px", textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>$100,000</div>
      <div style={{ padding: "10px 6px", textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>$0</div>
      <div style={{ padding: "10px 6px", textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>$100,000</div>
      <div style={{ padding: "10px 6px", textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>25%</div>
      <div style={{ padding: "10px 6px", textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>$25,000</div>
      <div style={{ padding: "10px 6px", textAlign: "right", fontFamily: FONT, fontWeight: 800, color: T.green, gridRow: "span 2", display: "flex", alignItems: "center", justifyContent: "flex-end", fontSize: 14 }}>$7,500</div>

      <div style={{ padding: "10px 6px", color: T.text, fontWeight: 600 }}>Year 2</div>
      <div style={{ padding: "10px 6px", textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>$100,000</div>
      <div style={{ padding: "10px 6px", textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>$30,000</div>
      <div style={{ padding: "10px 6px", textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>$70,000</div>
      <div style={{ padding: "10px 6px", textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>25%</div>
      <div style={{ padding: "10px 6px", textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>$17,500</div>
     </div>
    </div>
    <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 12, lineHeight: 1.6, fontStyle: "italic" }}>
     Same income, but Year 2 has $30K in write-offs. That extra deduction lowers taxable income — and saves $7,500 in taxes at the 25% bracket.
    </div>
   </Card>
  </Sec>

  {/* 3. Write-Offs Due to Home Ownership */}
  <Sec title="Write-Offs Due to Home Ownership">
   <Card>
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 0, fontSize: 10, color: T.textTertiary, fontWeight: 700, paddingBottom: 4, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase" }}>
     <span></span>
     <span style={{ textAlign: "right" }}></span>
     <span style={{ gridColumn: "3 / 5", textAlign: "center", fontStyle: "italic", color: T.blue }}>2018 Tax Law Caps applied →</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 0, fontSize: 11, color: T.textTertiary, fontWeight: 700, paddingBottom: 8, borderBottom: `1px solid ${T.separator}`, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase" }}>
     <span>Item</span>
     <span style={{ textAlign: "right" }}>Amount</span>
     <span style={{ textAlign: "right" }}>Federal</span>
     <span style={{ textAlign: "right" }}>{taxState}</span>
    </div>
    {[
     { label: "Property Taxes Paid (1 year)", amount: calc.yearlyTax, fed: calc.fedPropTax, state: calc.yearlyTax },
     { label: "Mortgage Interest Paid (1 year)", amount: calc.yearlyMortInt || 0, fed: calc.fedMortInt, state: calc.stateMortInt },
    ].map((row, i) => (
     <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 0, padding: "10px 0", borderBottom: `1px solid ${T.separator}`, fontSize: 13 }}>
      <span style={{ color: T.textSecondary }}>{row.label}</span>
      <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>{fmt(row.amount)}</span>
      <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>{fmt(row.fed)}</span>
      <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>{fmt(row.state)}</span>
     </div>
    ))}
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 0, padding: "12px 0 4px", fontSize: 14 }}>
     <span style={{ color: T.text, fontWeight: 700 }}>Total</span>
     <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 700 }}>{fmt(calc.yearlyTax + (calc.yearlyMortInt || 0))}</span>
     <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 700, color: T.green }}>{fmt(calc.fedItemized)}</span>
     <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 700, color: T.green }}>{fmt(calc.stateItemized)}</span>
    </div>
    {calc.deductibleLoanPct < 1 && <Note color={T.orange}>Federal mortgage interest limited to first {married === "MFS" ? "$375K" : "$750K"} of loan balance. Your loan ({fmt(calc.loan)}) exceeds this — only {(calc.deductibleLoanPct * 100).toFixed(1)}% of interest is federally deductible.</Note>}
    <Note color={T.blue}>SALT cap (Federal): {fmt(calc.saltCap)} · Mortgage interest cap: {married === "MFS" ? "$375K" : "$750K"} loan balance (TCJA).</Note>
   </Card>
  </Sec>

  {/* 4. Filing Status pill */}
  <Sec title="Filing Status">
   <Card>
    <div data-field="tax-filing" className={isPulse("tax-filing")} onClick={() => markTouched("tax-filing")} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
     {["Single", "MFJ", "MFS", "HOH"].map(opt => (
      <button key={opt} onClick={() => setMarried(opt)}
       style={{ padding: "10px 18px", borderRadius: 9999, border: married === opt ? `2px solid ${T.blue}` : `1px solid ${T.separator}`, background: married === opt ? `${T.blue}15` : T.inputBg, color: married === opt ? T.blue : T.textSecondary, fontWeight: 600, fontSize: 13, fontFamily: FONT, cursor: "pointer", transition: "all 0.15s" }}>
       {FILING_LABELS[opt] || opt}
      </button>
     ))}
    </div>
    <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 10 }}>
     Affects standard deduction, tax brackets, and SALT cap. Married Filing Jointly typically gets the largest deductions.
    </div>
   </Card>
  </Sec>

  {/* 5. Tax Savings — Before vs After (Federal | State side-by-side) */}
  {calc.yearlyInc > 0 ? (
   <Sec title="Tax Savings — Before vs After">
    <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 } : { display: "flex", flexDirection: "column", gap: 12 }}>
     {/* Federal card */}
     <Card>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textTertiary, fontFamily: MONO, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 }}>Federal Tax Savings — Before & After</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
       <div style={{ background: `${T.orange}08`, borderRadius: 10, padding: "10px 12px", border: `1px solid ${T.orange}22` }}>
        <div style={{ fontSize: 10, color: T.orange, fontWeight: 700, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Year 1 — Before Owning</div>
        <div style={{ fontSize: 11, color: T.textSecondary }}>Income</div>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.yearlyInc)}</div>
        <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4 }}>Standard Deduction</div>
        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, color: T.textSecondary }}>−{fmt(calc.fedStdDeduction)}</div>
        <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${T.orange}22` }}>Est. Taxable</div>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT, color: T.text }}>{fmt(fedTaxableBefore)}</div>
       </div>
       <div style={{ background: `${T.green}08`, borderRadius: 10, padding: "10px 12px", border: `1px solid ${T.green}22` }}>
        <div style={{ fontSize: 10, color: T.green, fontWeight: 700, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Year 2 — After Owning</div>
        <div style={{ fontSize: 11, color: T.textSecondary }}>Income</div>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.yearlyInc)}</div>
        <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4 }}>{calc.fedItemizes ? "Itemized Deduction" : "Standard Deduction"}</div>
        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, color: T.textSecondary }}>−{fmt(fedDeductionAfter)}</div>
        <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${T.green}22` }}>Adj. Taxable</div>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT, color: T.text }}>{fmt(fedTaxableAfter)}</div>
        <div style={{ fontSize: 11, color: T.green, fontWeight: 700, marginTop: 4 }}>Difference: {fmt(fedTaxableBefore - fedTaxableAfter)}</div>
       </div>
      </div>
      <div style={{ overflowX: "auto" }}>
       <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.6fr 1fr 1fr 0.9fr", gap: 0, fontSize: 10, color: T.textTertiary, fontWeight: 700, paddingBottom: 6, borderBottom: `1px solid ${T.separator}`, fontFamily: MONO, letterSpacing: 0.5, textTransform: "uppercase" }}>
        <span>Bracket</span>
        <span style={{ textAlign: "right" }}>Rate</span>
        <span style={{ textAlign: "right" }}>Before</span>
        <span style={{ textAlign: "right" }}>After</span>
        <span style={{ textAlign: "right" }}>Savings</span>
       </div>
       {fedBefore.rows.map((row, i) => {
        const after = fedAfter.rows[i] || row;
        const sav = row.tax - after.tax;
        return (
         <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.6fr 1fr 1fr 0.9fr", gap: 0, padding: "5px 0", borderBottom: `1px solid ${T.separator}`, fontSize: 11 }}>
          <span style={{ color: T.textSecondary, fontFamily: FONT }}>{fmt(row.from)}–{row.to === Infinity ? "∞" : fmt(row.to)}</span>
          <span style={{ textAlign: "right", color: T.textSecondary, fontFamily: FONT }}>{(row.rate * 100).toFixed(0)}%</span>
          <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 500 }}>{fmt(row.tax)}</span>
          <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 500 }}>{fmt(after.tax)}</span>
          <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 700, color: sav > 0 ? T.green : T.textTertiary }}>{sav > 0 ? fmt(sav) : "—"}</span>
         </div>
        );
       })}
       <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.6fr 1fr 1fr 0.9fr", gap: 0, padding: "8px 0 4px", fontSize: 12, fontWeight: 700 }}>
        <span style={{ color: T.text }}>Total Taxes</span>
        <span></span>
        <span style={{ textAlign: "right", fontFamily: FONT }}>{fmt(fedBefore.total)}</span>
        <span style={{ textAlign: "right", fontFamily: FONT }}>{fmt(fedAfter.total)}</span>
        <span style={{ textAlign: "right", fontFamily: FONT, color: T.green }}>{fmt(fedSav)}</span>
       </div>
       <div style={{ marginTop: 8, padding: "10px 12px", background: `${T.green}10`, borderRadius: 10, border: `1px solid ${T.green}22`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
         <div style={{ fontSize: 11, color: T.textSecondary }}>Total Annual Savings</div>
         <div style={{ fontSize: 18, fontWeight: 800, color: T.green, fontFamily: FONT, letterSpacing: "-0.02em" }}>{fmt(fedSav)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
         <div style={{ fontSize: 11, color: T.textSecondary }}>Monthly</div>
         <div style={{ fontSize: 16, fontWeight: 700, color: T.green, fontFamily: FONT }}>{fmt(mFedSav)}/mo</div>
        </div>
       </div>
      </div>
     </Card>

     {/* State card */}
     <Card>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textTertiary, fontFamily: MONO, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 }}>{taxState} Tax Savings — Before & After</div>
      {stateInfo.type === "none" ? (
       <div style={{ padding: "20px 12px", textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.blue, marginBottom: 4 }}>{taxState} has no state income tax</div>
        <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6 }}>You still get the federal benefit shown on the left.</div>
       </div>
      ) : (<>
       <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div style={{ background: `${T.orange}08`, borderRadius: 10, padding: "10px 12px", border: `1px solid ${T.orange}22` }}>
         <div style={{ fontSize: 10, color: T.orange, fontWeight: 700, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Year 1 — Before Owning</div>
         <div style={{ fontSize: 11, color: T.textSecondary }}>Income</div>
         <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.yearlyInc)}</div>
         <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4 }}>Standard Deduction</div>
         <div style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, color: T.textSecondary }}>−{fmt(calc.stStdDeduction)}</div>
         <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${T.orange}22` }}>Est. Taxable</div>
         <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT, color: T.text }}>{fmt(stateTaxableBefore)}</div>
        </div>
        <div style={{ background: `${T.green}08`, borderRadius: 10, padding: "10px 12px", border: `1px solid ${T.green}22` }}>
         <div style={{ fontSize: 10, color: T.green, fontWeight: 700, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Year 2 — After Owning</div>
         <div style={{ fontSize: 11, color: T.textSecondary }}>Income</div>
         <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.yearlyInc)}</div>
         <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4 }}>{calc.stateItemizes ? "Itemized Deduction" : "Standard Deduction"}</div>
         <div style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, color: T.textSecondary }}>−{fmt(stateDeductionAfter)}</div>
         <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${T.green}22` }}>Adj. Taxable</div>
         <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT, color: T.text }}>{fmt(stateTaxableAfter)}</div>
         <div style={{ fontSize: 11, color: T.green, fontWeight: 700, marginTop: 4 }}>Difference: {fmt(stateTaxableBefore - stateTaxableAfter)}</div>
        </div>
       </div>
       <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.6fr 1fr 1fr 0.9fr", gap: 0, fontSize: 10, color: T.textTertiary, fontWeight: 700, paddingBottom: 6, borderBottom: `1px solid ${T.separator}`, fontFamily: MONO, letterSpacing: 0.5, textTransform: "uppercase" }}>
         <span>Bracket</span>
         <span style={{ textAlign: "right" }}>Rate</span>
         <span style={{ textAlign: "right" }}>Before</span>
         <span style={{ textAlign: "right" }}>After</span>
         <span style={{ textAlign: "right" }}>Savings</span>
        </div>
        {stateBefore.rows.map((row, i) => {
         const after = stateAfter.rows[i] || row;
         const sav = row.tax - after.tax;
         return (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.6fr 1fr 1fr 0.9fr", gap: 0, padding: "5px 0", borderBottom: `1px solid ${T.separator}`, fontSize: 11 }}>
           <span style={{ color: T.textSecondary, fontFamily: FONT }}>{fmt(row.from)}{row.to === Infinity ? "+" : `–${fmt(row.to)}`}</span>
           <span style={{ textAlign: "right", color: T.textSecondary, fontFamily: FONT }}>{(row.rate * 100).toFixed(2)}%</span>
           <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 500 }}>{fmt(row.tax)}</span>
           <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 500 }}>{fmt(after.tax)}</span>
           <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 700, color: sav > 0 ? T.green : T.textTertiary }}>{sav > 0 ? fmt(sav) : "—"}</span>
          </div>
         );
        })}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.6fr 1fr 1fr 0.9fr", gap: 0, padding: "8px 0 4px", fontSize: 12, fontWeight: 700 }}>
         <span style={{ color: T.text }}>Total Taxes</span>
         <span></span>
         <span style={{ textAlign: "right", fontFamily: FONT }}>{fmt(stateBefore.total)}</span>
         <span style={{ textAlign: "right", fontFamily: FONT }}>{fmt(stateAfter.total)}</span>
         <span style={{ textAlign: "right", fontFamily: FONT, color: T.green }}>{fmt(stateSav)}</span>
        </div>
        <div style={{ marginTop: 8, padding: "10px 12px", background: `${T.green}10`, borderRadius: 10, border: `1px solid ${T.green}22`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
         <div>
          <div style={{ fontSize: 11, color: T.textSecondary }}>Total Annual Savings</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.green, fontFamily: FONT, letterSpacing: "-0.02em" }}>{fmt(stateSav)}</div>
         </div>
         <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: T.textSecondary }}>Monthly</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.green, fontFamily: FONT }}>{fmt(mStateSav)}/mo</div>
         </div>
        </div>
       </div>
      </>)}
     </Card>
    </div>
   </Sec>
  ) : (
   <div data-field="tax-needs-income" className={isPulse("tax-needs-income")} onClick={() => setTab("income")} style={{ borderRadius: 14, transition: "all 0.3s", cursor: "pointer", marginTop: 16 }}>
    <Card style={{ background: `${T.orange}10`, border: `1px solid ${T.orange}30` }}>
     <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div>
       <div style={{ fontSize: 14, fontWeight: 600, color: T.orange }}>Add income to see tax savings</div>
       <div style={{ fontSize: 12, color: T.textSecondary }}>Tap to go to the Income tab</div>
      </div>
     </div>
    </Card>
   </div>
  )}

  {/* 6. Effective Tax Rates */}
  {calc.yearlyInc > 0 && (
   <Sec title="Effective Tax Rates">
    <Card>
     <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 0, fontSize: 11, color: T.textTertiary, fontWeight: 700, paddingBottom: 8, borderBottom: `1px solid ${T.separator}`, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase" }}>
      <span></span>
      <span style={{ textAlign: "right" }}>Federal</span>
      <span style={{ textAlign: "right" }}>{taxState}</span>
      <span style={{ textAlign: "right" }}>Combined</span>
     </div>
     <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 0, padding: "10px 0", borderBottom: `1px solid ${T.separator}`, fontSize: 14 }}>
      <span style={{ color: T.text, fontWeight: 600 }}>Before (renting)</span>
      <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>{(fedEffBefore * 100).toFixed(1)}%</span>
      <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 600 }}>{(stEffBefore * 100).toFixed(2)}%</span>
      <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 700 }}>{(combBefore * 100).toFixed(1)}%</span>
     </div>
     <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 0, padding: "10px 0", fontSize: 14 }}>
      <span style={{ color: T.text, fontWeight: 600 }}>After (owning)</span>
      <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 600, color: T.green }}>{(fedEffAfter * 100).toFixed(1)}%</span>
      <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 600, color: T.green }}>{(stEffAfter * 100).toFixed(2)}%</span>
      <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 700, color: T.green }}>{(combAfter * 100).toFixed(1)}%</span>
     </div>
    </Card>
   </Sec>
  )}

  {/* 7. Adjusted Housing Expense walkdown */}
  <Sec title="Adjusted Housing Expense">
   <Card>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.separator}`, fontSize: 14 }}>
     <span style={{ color: T.text, fontWeight: 600 }}>Monthly Housing Expense</span>
     <span style={{ fontFamily: FONT, fontWeight: 700, color: T.text }}>{fmt(monthlyHousing)}</span>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0 8px 16px", borderBottom: `1px solid ${T.separator}`, fontSize: 13 }}>
     <span style={{ color: T.textSecondary }}>− Additional Federal Tax Savings</span>
     <span style={{ fontFamily: FONT, fontWeight: 600, color: T.green }}>−{fmt(mFedSav)}</span>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0 8px 16px", borderBottom: `1px solid ${T.separator}`, fontSize: 13 }}>
     <span style={{ color: T.textSecondary }}>− Additional State Tax Savings</span>
     <span style={{ fontFamily: FONT, fontWeight: 600, color: T.green }}>−{fmt(mStateSav)}</span>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 12px", borderRadius: 10, marginTop: 4, background: `${T.green}08`, fontSize: 14 }}>
     <span style={{ color: T.text, fontWeight: 700 }}>After-Tax Monthly Payment (Cash Flow)</span>
     <span style={{ fontFamily: FONT, fontWeight: 700, color: T.text }}>{fmt(afterTaxCashFlow)}</span>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0 8px 16px", borderBottom: `1px solid ${T.separator}`, fontSize: 13, marginTop: 4 }}>
     <span style={{ color: T.textSecondary }}>− Monthly Principal Reduction</span>
     <span style={{ fontFamily: FONT, fontWeight: 600, color: T.green }}>−{fmt(calc.monthlyPrinReduction)}</span>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 12px", borderRadius: 10, marginTop: 4, background: `${T.blue}08`, fontSize: 14 }}>
     <span style={{ color: T.text, fontWeight: 700 }}>Adjusted Housing Expense</span>
     <span style={{ fontFamily: FONT, fontWeight: 700, color: T.text }}>{fmt(adjustedHousing)}</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "auto 100px auto", alignItems: "center", padding: "10px 0 10px 16px", borderBottom: `1px solid ${T.separator}`, fontSize: 13, marginTop: 4, gap: 8 }}>
     <span style={{ color: T.textSecondary }}>Annual Appreciation Factor</span>
     <input type="text" inputMode="decimal" value={appreciationRate}
      onChange={e => { const v = parseFloat(e.target.value.replace(/[^0-9.]/g, "")); setAppreciationRate(isNaN(v) ? 0 : Math.min(v, 50)); }}
      style={{ background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 8, padding: "6px 10px", color: T.text, fontSize: 13, fontWeight: 600, fontFamily: FONT, outline: "none", textAlign: "right", width: "100%" }} />
     <span style={{ fontSize: 12, color: T.textTertiary }}>%/yr</span>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0 8px 16px", borderBottom: `1px solid ${T.separator}`, fontSize: 13 }}>
     <span style={{ color: T.textSecondary }}>− Monthly Appreciation</span>
     <span style={{ fontFamily: FONT, fontWeight: 600, color: T.green }}>−{fmt(calc.monthlyAppreciation)}</span>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 14px", borderRadius: 12, marginTop: 8, background: netPostSale < 0 ? `${T.green}18` : `${T.green}08`, border: netPostSale < 0 ? `2px solid ${T.green}` : `1px solid ${T.green}22`, fontSize: 15 }}>
     <span style={{ color: T.text, fontWeight: 700 }}>Net Post-Sale Housing Expense</span>
     <span style={{ fontFamily: FONT, fontWeight: 800, color: netPostSale < 0 ? T.green : T.text, fontSize: 18, letterSpacing: "-0.02em" }}>{fmt(netPostSale)}</span>
    </div>
    {netPostSale < 0 && <Note color={T.green}>Negative means appreciation alone exceeds the net cost of housing — your home is generating wealth faster than it costs you.</Note>}
   </Card>
  </Sec>

  {/* 8. Disclaimer */}
  <div style={{ marginTop: 12, padding: "10px 14px", background: `${T.orange}08`, borderRadius: 10, border: `1px solid ${T.orange}18` }}>
   <div style={{ fontSize: 11, color: T.orange, fontWeight: 600, lineHeight: 1.6 }}>This is an estimate for illustration purposes only — not tax advice. Tax situations vary based on individual circumstances. Please confirm with your CPA or tax professional before making financial decisions based on these projections.</div>
  </div>

 </div>);
})()}
 <GuidedNextButton />
</>);
}
