import React from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

export default function DebtsContent({
  T, isDesktop, calc, fmt,
  debts, debtFree, setDebtFree,
  ownsProperties, setOwnsProperties,
  reos, setReos,
  syncDebtBalance, syncDebtPayment,
  guideTouched, markTouched, isPulse,
  Hero, Card, Sec, TextInp, Inp, Sel, Note,
  DEBT_TYPES, PAYOFF_OPTIONS, GuidedNextButton,
}) {
  return (<>
 <div style={isDesktop ? { display: "flex", gap: 24, marginTop: 20, alignItems: "flex-start" } : {}}>
 {/* LEFT: Hero + Toggles (sticky) */}
 <div style={isDesktop ? { position: "sticky", top: 90, width: "50%", flexShrink: 0, maxHeight: "calc(100vh - 110px)", overflowY: "auto" } : {}}>
 <div data-field="debts-section" style={isDesktop ? { marginBottom: 16 } : { marginTop: 20, marginBottom: 16 }}>
  <Hero value={debtFree ? "$0" : fmt(calc.totalMonthlyDebts)} label="Monthly Debts" color={debtFree ? T.green : T.red} sub={debtFree ? "Debt free!" : `${calc.qualifyingDebts.length} qualifying`} />
 </div>
 {/* Own Properties — Yes / No buttons (required, unlocks REO tab) */}
 <div data-field="owns-properties-toggle" className={isPulse("owns-properties-toggle")} style={{ borderRadius: 18, transition: "all 0.3s" }}>
 <Card style={{ marginBottom: 14 }}>
  <div>
   <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Do you own any properties?</span>
   <span style={{ color: T.red, marginLeft: 3, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>*</span>
   <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>Current home, investment properties, second homes</div>
  </div>
  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
   <button onClick={() => { setOwnsProperties(true); markTouched("owns-properties-toggle"); }} style={{
    flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.3s", fontFamily: FONT,
    background: ownsProperties === true && guideTouched.has("owns-properties-toggle") ? T.green : "transparent",
    color: ownsProperties === true && guideTouched.has("owns-properties-toggle") ? "#fff" : T.textSecondary,
    border: `2px solid ${ownsProperties === true && guideTouched.has("owns-properties-toggle") ? T.green : T.separator}`,
   }}>Yes</button>
   <button onClick={() => { setOwnsProperties(false); markTouched("owns-properties-toggle"); }} style={{
    flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.3s", fontFamily: FONT,
    background: ownsProperties === false && guideTouched.has("owns-properties-toggle") ? T.pillBg : "transparent",
    color: ownsProperties === false && guideTouched.has("owns-properties-toggle") ? T.text : T.textSecondary,
    border: `2px solid ${ownsProperties === false && guideTouched.has("owns-properties-toggle") ? T.textTertiary : T.separator}`,
   }}>No</button>
  </div>
  {ownsProperties && guideTouched.has("owns-properties-toggle") && (
   <div style={{ marginTop: 12, padding: "10px 14px", background: `${T.blue}10`, borderRadius: 12 }}>
    <div style={{ fontSize: 12, fontWeight: 600, color: T.blue, marginBottom: 3 }}>REO tab unlocked</div>
    <div style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.5 }}>Add your properties in the REO tab. Mortgage & HELOC debts below can be linked to specific properties so payments aren't counted twice in DTI.</div>
   </div>
  )}
  {ownsProperties === false && guideTouched.has("owns-properties-toggle") && (
   <div style={{ marginTop: 10, fontSize: 11, color: T.textTertiary }}>No existing properties — DTI will only include credit-report liabilities.</div>
  )}
 </Card>
 </div>
 {/* Debt-free toggle — shown after own-properties question */}
 <div data-field="debt-free-toggle" className={isPulse("debt-free-toggle")} onClick={() => markTouched("debt-free-toggle")} style={{ borderRadius: 18, transition: "all 0.3s" }}>
 <Card style={{ marginBottom: 14 }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
   <div>
    <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Are you debt-free?</span>
    <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>No credit cards, auto loans, student loans, or installments</div>
   </div>
   <div onClick={() => { setDebtFree(!debtFree); markTouched("debt-free-toggle"); }} style={{ width: 52, height: 30, borderRadius: 99, background: debtFree ? T.green : T.inputBg, cursor: "pointer", padding: 2, transition: "all 0.3s", flexShrink: 0 }}>
    <div style={{ width: 26, height: 26, borderRadius: 99, background: "#fff", transform: debtFree ? "translateX(22px)" : "translateX(0)", transition: "transform 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
   </div>
  </div>
  {debtFree && (
   <div style={{ marginTop: 12, padding: "14px 16px", background: T.successBg, borderRadius: 12, textAlign: "center" }}>
    <div style={{ fontSize: 15, fontWeight: 700, color: T.green }}>No consumer debt — more buying power</div>
    <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>More of your DTI capacity goes toward your new mortgage, maximizing your purchasing power.</div>
   </div>
  )}
  {debtFree && ownsProperties && (
   <div style={{ marginTop: 10, padding: "10px 14px", background: `${T.blue}10`, borderRadius: 10 }}>
    <div style={{ fontSize: 12, color: T.blue, fontWeight: 600, marginBottom: 3 }}>Owned properties still count</div>
    <div style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.5 }}>Property taxes, insurance, and HOA on your existing properties are still factored into DTI through the REO tab — this toggle only excludes credit-report debts.</div>
   </div>
  )}
 </Card>
 </div>
 </div>{/* end debts left column */}
 {/* RIGHT: Liabilities list (scrollable) */}
 <div style={isDesktop ? { width: "50%", flexShrink: 0, minWidth: 0 } : {}}>
 {!debtFree && <>
 {calc.reoNegativeDebt > 0 && <Note color={T.orange}>{calc.reoPrimaryDebt > 0 && calc.reoInvestmentNet < 0 ? `+${fmt(calc.reoPrimaryDebt)}/mo primary/2nd home PITIA + ${fmt(Math.abs(calc.reoInvestmentNet))}/mo investment shortfall` : calc.reoPrimaryDebt > 0 ? `+${fmt(calc.reoPrimaryDebt)}/mo primary/2nd home PITIA` : `+${fmt(Math.abs(calc.reoInvestmentNet))}/mo investment property shortfall (75% rule)`} added as debt in DTI. Total DTI obligations: {fmt(calc.totalMonthlyDebts + calc.reoNegativeDebt)}/mo.</Note>}
 <Sec title="Liabilities" action="+ Add" onAction={() => calc.addDebt("Revolving")}>
  {debts.map((d) => (
   <Card key={d.id}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
     <span style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary }}>{d.type || "Debt"}</span>
     <button onClick={() => calc.removeDebt(d.id)} style={{ background: "none", border: "none", color: T.red, fontSize: 13, cursor: "pointer" }}>Remove</button>
    </div>
    <TextInp label="Creditor" value={d.name} onChange={v => calc.updateDebt(d.id, "name", v)} sm />
    <Sel label="Type" value={d.type} onChange={v => { calc.updateDebt(d.id, "type", v); if (v !== "Mortgage" && v !== "HELOC") calc.updateDebt(d.id, "linkedReoId", ""); }} options={DEBT_TYPES} sm req />
    {(d.type === "Mortgage" || d.type === "HELOC") && reos.length > 0 && (
     <Sel label="Linked REO Property" value={d.linkedReoId || ""} onChange={v => {
      const oldReoId = d.linkedReoId;
      calc.updateDebt(d.id, "linkedReoId", v);
      // Sync: update old REO payment (subtract this debt) and new REO payment (add this debt)
      const pmt = Number(d.monthly) || 0;
      const bal = Number(d.balance) || 0;
      if (oldReoId) {
       const otherLinkedOld = debts.filter(dd => dd.linkedReoId === oldReoId && dd.id !== d.id && (dd.type === "Mortgage" || dd.type === "HELOC"));
       const oldTotal = otherLinkedOld.reduce((s, dd) => s + (Number(dd.monthly) || 0), 0);
       const oldBalTotal = otherLinkedOld.reduce((s, dd) => s + (Number(dd.balance) || 0), 0);
       setReos(prev => prev.map(r => r.id === Number(oldReoId) ? { ...r, payment: oldTotal, mortgageBalance: oldBalTotal } : r));
      }
      if (v) {
       const otherLinkedNew = debts.filter(dd => dd.linkedReoId === v && dd.id !== d.id && (dd.type === "Mortgage" || dd.type === "HELOC"));
       const newTotal = otherLinkedNew.reduce((s, dd) => s + (Number(dd.monthly) || 0), 0) + pmt;
       const newBalTotal = otherLinkedNew.reduce((s, dd) => s + (Number(dd.balance) || 0), 0) + bal;
       setReos(prev => prev.map(r => r.id === Number(v) ? { ...r, payment: newTotal, mortgageBalance: newBalTotal } : r));
      }
     }} options={[{value: "", label: "— Not linked —"}, ...reos.map((r, i) => ({value: String(r.id), label: r.address || `Property ${i + 1}`}))]} sm />
    )}
    {(d.type === "Mortgage" || d.type === "HELOC") && reos.length === 0 && ownsProperties && (
     <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 8, lineHeight: 1.4 }}>Add properties on the REO tab to link this debt and avoid counting the payment twice in DTI.</div>
    )}
    {(d.type === "Mortgage" || d.type === "HELOC") && !ownsProperties && (
     <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 8, lineHeight: 1.4 }}>Toggle "Do you own any properties?" above to unlock the REO tab and link this debt to a property.</div>
    )}
    {d.linkedReoId && <div style={{ fontSize: 11, color: T.blue, marginBottom: 8, fontWeight: 500 }}>✓ Linked to REO — payment handled via 75% rental offset in DTI, not counted as standalone debt.</div>}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
     <Inp label="Balance" value={d.balance} onChange={v => (d.linkedReoId && (d.type === "Mortgage" || d.type === "HELOC")) ? syncDebtBalance(d.id, v) : calc.updateDebt(d.id, "balance", v)} sm req />
     <Inp label="Monthly Pmt" value={d.monthly} onChange={v => (d.linkedReoId && (d.type === "Mortgage" || d.type === "HELOC")) ? syncDebtPayment(d.id, v) : calc.updateDebt(d.id, "monthly", v)} sm req />
    </div>
    <Sel label="Payoff at Close?" value={d.payoff} onChange={v => calc.updateDebt(d.id, "payoff", v)} options={PAYOFF_OPTIONS} sm tip="'At Escrow' pays off this debt using closing funds — removes the payment from DTI but adds the balance to cash needed. 'Omit' excludes it entirely." />
    {(d.payoff === "Yes - at Escrow" || d.payoff === "Yes - POC") && (
     <Note color={T.green}>Payoff {fmt(d.balance)} at escrow — excluded from DTI</Note>
    )}
   </Card>
  ))}
  {debts.length === 0 && (
   <Card style={{ border: `2px dashed ${T.separator}`, background: "transparent", boxShadow: "none", textAlign: "center", padding: 24 }}>
    <button onClick={() => calc.addDebt("Revolving")} style={{ background: "none", border: "none", color: T.blue, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>+ Add Debt</button>
   </Card>
  )}
 </Sec>
 </>}
 </div>{/* end debts right column */}
 </div>{/* end debts desktop flex wrapper */}
 <GuidedNextButton />
</>);
}
