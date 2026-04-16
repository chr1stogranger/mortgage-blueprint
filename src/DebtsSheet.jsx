import React from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";
const DEBT_TYPES = ["Mortgage", "HELOC", "Auto Loan", "Auto Lease", "Student Loan", "Revolving", "Installment", "Collection", "Other"];
const PAYOFF_OPTIONS = ["No", "Yes - at Escrow", "Yes - POC", "Omit"];

function fmt(v) {
  if (v == null || !isFinite(v) || isNaN(v)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

function SheetCard({ children, T, style }) {
  return (
    <div style={{ background: T.card, borderRadius: 16, padding: 18, boxShadow: T.cardShadow, marginBottom: 12, ...style }}>
      {children}
    </div>
  );
}

export default function DebtsSheet({
  debts, addDebt, updateDebt, removeDebt,
  debtFree, setDebtFree,
  ownsProperties, setOwnsProperties,
  reos, setReos, syncDebtPayment, syncDebtBalance,
  T, Inp, Sel, TextInp, Note, calc,
}) {
  return (
    <div>
      {/* Hero summary */}
      <div style={{ textAlign: "center", marginBottom: 20, padding: "16px 0 20px", borderBottom: `1px solid ${T.separator}` }}>
        <div style={{ fontSize: 11, fontWeight: 600, fontFamily: MONO, color: T.textTertiary, textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>Monthly Debts</div>
        <div style={{ fontSize: 32, fontWeight: 800, fontFamily: FONT, color: debtFree ? T.green : T.red, letterSpacing: "-0.03em" }}>{debtFree ? "$0" : fmt(calc.totalMonthlyDebts)}</div>
        {debtFree && <div style={{ fontSize: 13, color: T.green, fontWeight: 600 }}>Debt free!</div>}
      </div>

      {/* Own Properties toggle */}
      <SheetCard T={T} style={{ marginBottom: 14 }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Do you own any properties?</span>
          <span style={{ color: T.red, marginLeft: 3, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>*</span>
          <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>Current home, investment properties, second homes</div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => setOwnsProperties(true)} style={{
            flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.3s", fontFamily: FONT,
            background: ownsProperties === true ? T.green : "transparent",
            color: ownsProperties === true ? "#fff" : T.textSecondary,
            border: `2px solid ${ownsProperties === true ? T.green : T.separator}`,
          }}>Yes</button>
          <button onClick={() => setOwnsProperties(false)} style={{
            flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.3s", fontFamily: FONT,
            background: ownsProperties === false ? T.pillBg : "transparent",
            color: ownsProperties === false ? T.text : T.textSecondary,
            border: `2px solid ${ownsProperties === false ? T.textTertiary : T.separator}`,
          }}>No</button>
        </div>
        {ownsProperties && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: `${T.blue}10`, borderRadius: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.blue, marginBottom: 3 }}>REO tab unlocked</div>
            <div style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.5 }}>Add your properties in the REO tab. Mortgage & HELOC debts below can be linked to specific properties so payments aren't counted twice in DTI.</div>
          </div>
        )}
        {ownsProperties === false && (
          <div style={{ marginTop: 10, fontSize: 11, color: T.textTertiary }}>No existing properties \u2014 DTI will only include credit-report liabilities.</div>
        )}
      </SheetCard>

      {/* Debt-free toggle */}
      <SheetCard T={T} style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Are you debt-free?</span>
            <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>No credit cards, auto loans, student loans, or installments</div>
          </div>
          <div onClick={() => setDebtFree(!debtFree)} style={{ width: 52, height: 30, borderRadius: 99, background: debtFree ? T.green : T.inputBg, cursor: "pointer", padding: 2, transition: "all 0.3s", flexShrink: 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: 99, background: "#fff", transform: debtFree ? "translateX(22px)" : "translateX(0)", transition: "transform 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
          </div>
        </div>
        {debtFree && (
          <div style={{ marginTop: 12, padding: "14px 16px", background: T.successBg, borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.green }}>No consumer debt \u2014 more buying power</div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>More of your DTI capacity goes toward your new mortgage, maximizing your purchasing power.</div>
          </div>
        )}
        {debtFree && ownsProperties && (
          <div style={{ marginTop: 10, padding: "10px 14px", background: `${T.blue}10`, borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: T.blue, fontWeight: 600, marginBottom: 3 }}>Owned properties still count</div>
            <div style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.5 }}>Property taxes, insurance, and HOA on your existing properties are still factored into DTI through the REO tab \u2014 this toggle only excludes credit-report debts.</div>
          </div>
        )}
      </SheetCard>

      {/* Liabilities list */}
      {!debtFree && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: FONT }}>Liabilities</span>
            <button onClick={() => addDebt("Revolving")} style={{ background: `${T.blue}15`, border: `1px solid ${T.blue}33`, borderRadius: 9999, padding: "6px 14px", color: T.blue, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>+ Add</button>
          </div>

          {debts.map((d) => (
            <SheetCard key={d.id} T={T}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary }}>{d.type || "Debt"}</span>
                <button onClick={() => removeDebt(d.id)} style={{ background: "none", border: "none", color: T.red, fontSize: 13, cursor: "pointer" }}>Remove</button>
              </div>
              <TextInp label="Creditor" value={d.name} onChange={v => updateDebt(d.id, "name", v)} sm />
              <Sel label="Type" value={d.type} onChange={v => { updateDebt(d.id, "type", v); if (v !== "Mortgage" && v !== "HELOC") updateDebt(d.id, "linkedReoId", ""); }} options={DEBT_TYPES} sm req />
              {(d.type === "Mortgage" || d.type === "HELOC") && reos.length > 0 && (
                <Sel label="Linked REO Property" value={d.linkedReoId || ""} onChange={v => {
                  const oldReoId = d.linkedReoId;
                  updateDebt(d.id, "linkedReoId", v);
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
                }} options={[{value: "", label: "\u2014 Not linked \u2014"}, ...reos.map((r, i) => ({value: String(r.id), label: r.address || `Property ${i + 1}`}))]} sm />
              )}
              {(d.type === "Mortgage" || d.type === "HELOC") && reos.length === 0 && ownsProperties && (
                <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 8, lineHeight: 1.4 }}>Add properties on the REO tab to link this debt and avoid counting the payment twice in DTI.</div>
              )}
              {d.linkedReoId && <div style={{ fontSize: 11, color: T.blue, marginBottom: 8, fontWeight: 500 }}>{"\u2713"} Linked to REO \u2014 payment handled via 75% rental offset in DTI, not counted as standalone debt.</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Inp label="Balance" value={d.balance} onChange={v => (d.linkedReoId && (d.type === "Mortgage" || d.type === "HELOC")) ? syncDebtBalance(d.id, v) : updateDebt(d.id, "balance", v)} sm req />
                <Inp label="Monthly Pmt" value={d.monthly} onChange={v => (d.linkedReoId && (d.type === "Mortgage" || d.type === "HELOC")) ? syncDebtPayment(d.id, v) : updateDebt(d.id, "monthly", v)} sm req />
              </div>
              <Sel label="Payoff at Close?" value={d.payoff} onChange={v => updateDebt(d.id, "payoff", v)} options={PAYOFF_OPTIONS} sm tip="'At Escrow' pays off this debt using closing funds \u2014 removes the payment from DTI but adds the balance to cash needed. 'Omit' excludes it entirely." />
              {(d.payoff === "Yes - at Escrow" || d.payoff === "Yes - POC") && (
                <Note color={T.green}>Payoff {fmt(d.balance)} at escrow \u2014 excluded from DTI</Note>
              )}
            </SheetCard>
          ))}
          {debts.length === 0 && (
            <SheetCard T={T} style={{ border: `2px dashed ${T.separator}`, background: "transparent", boxShadow: "none", textAlign: "center", padding: 24 }}>
              <button onClick={() => addDebt("Revolving")} style={{ background: "none", border: "none", color: T.blue, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>+ Add Debt</button>
            </SheetCard>
          )}
          {debts.length > 0 && (
            <button onClick={() => addDebt("Revolving")} style={{ width: "100%", padding: 14, background: `${T.blue}15`, border: `1px dashed ${T.blue}44`, borderRadius: 12, color: T.blue, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: FONT, marginTop: 10 }}>+ Add Another Debt</button>
          )}
        </>
      )}

      {/* Auto-saved indicator */}
      <div style={{ textAlign: "center", marginTop: 12, marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: T.green, fontWeight: 500 }}>{"\u2713"} All changes auto-saved</span>
      </div>
    </div>
  );
}
