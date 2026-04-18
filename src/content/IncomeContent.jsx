import React from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

export default function IncomeContent({
  T, isDesktop, calc, fmt, incomes, addIncome, updateIncome, removeIncome,
  otherIncome, setOtherIncome,
  otherIncome2, setOtherIncome2,
  Hero, Card, Sec, TextInp, Inp, Sel, Note,
  VARIABLE_PAY_TYPES, PAY_TYPES, isPulse, GuidedNextButton,
}) {
  return (<>
 {/* Hero — sits above both columns so Borrower 1 and Borrower 2 headers align horizontally */}
 <div style={{ marginTop: 20, marginBottom: 16 }}>
  <Hero value={fmt(calc.monthlyIncome)} label="Monthly Income" color={T.green} sub={`${fmt(calc.monthlyIncome * 12)}/yr`} />
 </div>
 {calc.reoPositiveIncome > 0 && <Note color={T.blue}>+{fmt(calc.reoPositiveIncome)}/mo investment property rental income added to qualifying income (75% rule). DTI uses {fmt(calc.qualifyingIncome)}/mo total.</Note>}
 <div style={isDesktop ? { display: "flex", gap: 24, alignItems: "flex-start" } : {}}>
 {/* LEFT: Borrower 1 + Borrower 1 Other Income */}
 <div style={isDesktop ? { width: "50%", flexShrink: 0, minWidth: 0 } : {}}>
 <Sec title="Borrower 1" action="+ Add" onAction={() => addIncome(1)}>
  {incomes.filter(i => i.borrower === 1).map((inc, idx) => {
   const isVar = VARIABLE_PAY_TYPES.includes(inc.payType);
   const ytd = Number(inc.ytd) || 0;
   const yr1 = Number(inc.py1) || 0;
   const yr2 = Number(inc.py2) || 0;
   const declining = yr1 > 0 && yr2 > 0 && yr1 < yr2;
   const varMonthly = (yr1 > 0 && yr2 > 0) ? (declining ? yr1 / 12 : (yr1 + yr2) / 24) : (yr1 > 0 ? yr1 / 12 : (yr2 > 0 ? yr2 / 12 : (ytd > 0 ? ytd / 12 : 0)));
   return (
   <div key={inc.id} className={idx === 0 ? isPulse("income-amount") : ""} style={{ borderRadius: 18, transition: "all 0.3s" }}>
   <Card>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
     <span style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary }}>Income Source</span>
     <button onClick={() => removeIncome(inc.id)} style={{ background: "none", border: "none", color: T.red, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Remove</button>
    </div>
    <TextInp label="Employer / Source" value={inc.source} onChange={v => updateIncome(inc.id, "source", v)} sm />
    <Sel label="Pay Type" value={inc.payType} onChange={v => updateIncome(inc.id, "payType", v)} options={PAY_TYPES} sm req tip="How you're compensated. Variable income (bonus, commission, OT) requires 2-year history and uses the lower or average of 2 years." />
    {!isVar && <>
     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <Sel label="Frequency" value={inc.frequency} onChange={v => updateIncome(inc.id, "frequency", v)} options={["Annual","Monthly","Bi-Weekly","Weekly","Hourly"]} sm req />
      <Inp label="Amount" value={inc.amount} onChange={v => updateIncome(inc.id, "amount", v)} sm req />
     </div>
    </>}
    {isVar && <>
     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Inp label="YTD (2026)" value={inc.ytd} onChange={v => updateIncome(inc.id, "ytd", v)} sm />
      <Inp label="2025" value={inc.py1} onChange={v => updateIncome(inc.id, "py1", v)} sm req />
      <Inp label="2024" value={inc.py2} onChange={v => updateIncome(inc.id, "py2", v)} sm req />
     </div>
     {yr1 > 0 && yr2 > 0 && (<div style={{ background: declining ? `${T.orange}15` : `${T.green}15`, borderRadius: 8, padding: 10, marginTop: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: declining ? T.orange : T.green, marginBottom: 4 }}>
       {declining ? "⚠ DECLINING — Using 1-Year Average (2025 only)" : "✓ Using 2-Year Average (2025 + 2024)"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
       <div><div style={{ fontSize: 10, color: T.textTertiary }}>Monthly Qualifying</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{fmt(varMonthly)}</div></div>
       <div><div style={{ fontSize: 10, color: T.textTertiary }}>Annual Qualifying</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{fmt(varMonthly * 12)}</div></div>
      </div>
      {declining && <div style={{ fontSize: 11, color: T.orange, marginTop: 6 }}>Year-over-year decline: {fmt(yr2)} (2024) → {fmt(yr1)} (2025) · {((yr2 - yr1) / yr2 * 100).toFixed(1)}% decrease</div>}
     </div>)}
     {yr1 > 0 && yr2 === 0 && <Note color={T.blue}>Enter 2024 income to calculate 2-year average. Using 2025 only: {fmt(yr1 / 12)}/mo</Note>}
     {yr1 === 0 && yr2 === 0 && ytd > 0 && <Note color={T.orange}>Need full-year figures (2025 + 2024) for qualifying. YTD alone is insufficient for most lenders.</Note>}
    </>}
   </Card>
   </div>);
  })}
  {incomes.filter(i => i.borrower === 1).length === 0 && (
   <div data-field="add-income-1" className={isPulse("add-income-1")} style={{ borderRadius: 14, transition: "all 0.3s" }}>
   <Card style={{ border: `2px dashed ${T.separator}`, background: "transparent", boxShadow: "none", textAlign: "center", padding: 24 }}>
    <button onClick={() => addIncome(1)} style={{ background: "none", border: "none", color: T.blue, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>+ Add Income Source</button>
   </Card>
   </div>
  )}
 </Sec>
 <Sec title="Other Income">
  <Card><Inp label="Other Monthly Income" value={otherIncome2} onChange={setOtherIncome2} tip="Borrower 1 additional qualifying income: alimony received, Social Security, pension, disability, or other documented recurring income." /></Card>
 </Sec>
 </div>{/* end income left column */}
 {/* RIGHT: Borrower 2 + Other Income */}
 <div style={isDesktop ? { width: "50%", flexShrink: 0, minWidth: 0 } : {}}>
 <Sec title="Borrower 2" action="+ Add" onAction={() => addIncome(2)}>
  {incomes.filter(i => i.borrower === 2).map((inc) => {
   const isVar = VARIABLE_PAY_TYPES.includes(inc.payType);
   const ytd = Number(inc.ytd) || 0;
   const yr1 = Number(inc.py1) || 0;
   const yr2 = Number(inc.py2) || 0;
   const declining = yr1 > 0 && yr2 > 0 && yr1 < yr2;
   const varMonthly = (yr1 > 0 && yr2 > 0) ? (declining ? yr1 / 12 : (yr1 + yr2) / 24) : (yr1 > 0 ? yr1 / 12 : (yr2 > 0 ? yr2 / 12 : (ytd > 0 ? ytd / 12 : 0)));
   return (
   <Card key={inc.id}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
     <span style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary }}>Income Source</span>
     <button onClick={() => removeIncome(inc.id)} style={{ background: "none", border: "none", color: T.red, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Remove</button>
    </div>
    <TextInp label="Employer / Source" value={inc.source} onChange={v => updateIncome(inc.id, "source", v)} sm />
    <Sel label="Pay Type" value={inc.payType} onChange={v => updateIncome(inc.id, "payType", v)} options={PAY_TYPES} sm req tip="How you're compensated. Variable income (bonus, commission, OT) requires 2-year history and uses the lower or average of 2 years." />
    {!isVar && <>
     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <Sel label="Frequency" value={inc.frequency} onChange={v => updateIncome(inc.id, "frequency", v)} options={["Annual","Monthly","Bi-Weekly","Weekly","Hourly"]} sm req />
      <Inp label="Amount" value={inc.amount} onChange={v => updateIncome(inc.id, "amount", v)} sm req />
     </div>
    </>}
    {isVar && <>
     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Inp label="YTD (2026)" value={inc.ytd} onChange={v => updateIncome(inc.id, "ytd", v)} sm />
      <Inp label="2025" value={inc.py1} onChange={v => updateIncome(inc.id, "py1", v)} sm req />
      <Inp label="2024" value={inc.py2} onChange={v => updateIncome(inc.id, "py2", v)} sm req />
     </div>
     {yr1 > 0 && yr2 > 0 && (<div style={{ background: declining ? `${T.orange}15` : `${T.green}15`, borderRadius: 8, padding: 10, marginTop: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: declining ? T.orange : T.green, marginBottom: 4 }}>
       {declining ? "⚠ DECLINING — Using 1-Year Average (2025 only)" : "✓ Using 2-Year Average (2025 + 2024)"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
       <div><div style={{ fontSize: 10, color: T.textTertiary }}>Monthly Qualifying</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{fmt(varMonthly)}</div></div>
       <div><div style={{ fontSize: 10, color: T.textTertiary }}>Annual Qualifying</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{fmt(varMonthly * 12)}</div></div>
      </div>
      {declining && <div style={{ fontSize: 11, color: T.orange, marginTop: 6 }}>Year-over-year decline: {fmt(yr2)} (2024) → {fmt(yr1)} (2025) · {((yr2 - yr1) / yr2 * 100).toFixed(1)}% decrease</div>}
     </div>)}
     {yr1 > 0 && yr2 === 0 && <Note color={T.blue}>Enter 2024 income to calculate 2-year average. Using 2025 only: {fmt(yr1 / 12)}/mo</Note>}
     {yr1 === 0 && yr2 === 0 && ytd > 0 && <Note color={T.orange}>Need full-year figures (2025 + 2024) for qualifying. YTD alone is insufficient for most lenders.</Note>}
    </>}
   </Card>);
  })}
  {incomes.filter(i => i.borrower === 2).length === 0 && (
   <Card style={{ border: `2px dashed ${T.separator}`, background: "transparent", boxShadow: "none", textAlign: "center", padding: 24 }}>
    <button onClick={() => addIncome(2)} style={{ background: "none", border: "none", color: T.blue, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>+ Add Income Source</button>
   </Card>
  )}
 </Sec>
 <Sec title="Other Income">
  <Card><Inp label="Other Monthly Income" value={otherIncome} onChange={setOtherIncome} tip="Borrower 2 additional qualifying income: alimony received, Social Security, pension, disability, or other documented recurring income." /></Card>
 </Sec>
 </div>{/* end income right column */}
 </div>{/* end income desktop flex wrapper */}
 <GuidedNextButton />
</>);
}
