import React from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";
const PAY_TYPES = ["Salary", "Hourly", "Overtime", "Bonus", "Commission", "Self-Employment", "RSU", "Rental", "Retirement", "Social Security", "Disability", "Child Support", "Alimony", "Other"];
const VARIABLE_PAY_TYPES = ["Hourly", "Overtime", "Bonus", "Commission", "Self-Employment", "RSU"];

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

export default function IncomeSheet({
  incomes, addIncome, updateIncome, removeIncome,
  otherIncome, setOtherIncome,
  T, Inp, Sel, TextInp, Note, calc,
}) {
  const renderIncomeCard = (inc, borrowerNum) => {
    const isVar = VARIABLE_PAY_TYPES.includes(inc.payType);
    const ytd = Number(inc.ytd) || 0;
    const yr1 = Number(inc.py1) || 0;
    const yr2 = Number(inc.py2) || 0;
    const declining = yr1 > 0 && yr2 > 0 && yr1 < yr2;
    const varMonthly = (yr1 > 0 && yr2 > 0) ? (declining ? yr1 / 12 : (yr1 + yr2) / 24) : (yr1 > 0 ? yr1 / 12 : (yr2 > 0 ? yr2 / 12 : (ytd > 0 ? ytd / 12 : 0)));

    return (
      <SheetCard key={inc.id} T={T}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary }}>Income Source</span>
          <button onClick={() => removeIncome(inc.id)} style={{ background: "none", border: "none", color: T.red, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Remove</button>
        </div>
        <TextInp label="Employer / Source" value={inc.source} onChange={v => updateIncome(inc.id, "source", v)} sm />
        <Sel label="Pay Type" value={inc.payType} onChange={v => updateIncome(inc.id, "payType", v)} options={PAY_TYPES} sm req tip="How you're compensated. Variable income (bonus, commission, OT) requires 2-year history and uses the lower or average of 2 years." />
        {!isVar && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Sel label="Frequency" value={inc.frequency} onChange={v => updateIncome(inc.id, "frequency", v)} options={["Annual","Monthly","Bi-Weekly","Weekly","Hourly"]} sm req />
            <Inp label="Amount" value={inc.amount} onChange={v => updateIncome(inc.id, "amount", v)} sm req />
          </div>
        )}
        {isVar && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <Inp label="YTD (2026)" value={inc.ytd} onChange={v => updateIncome(inc.id, "ytd", v)} sm />
              <Inp label="2025" value={inc.py1} onChange={v => updateIncome(inc.id, "py1", v)} sm req />
              <Inp label="2024" value={inc.py2} onChange={v => updateIncome(inc.id, "py2", v)} sm req />
            </div>
            {yr1 > 0 && yr2 > 0 && (
              <div style={{ background: declining ? `${T.orange}15` : `${T.green}15`, borderRadius: 8, padding: 10, marginTop: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: declining ? T.orange : T.green, marginBottom: 4 }}>
                  {declining ? "Warning: DECLINING \u2014 Using 1-Year Average (2025 only)" : "\u2713 Using 2-Year Average (2025 + 2024)"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <div><div style={{ fontSize: 10, color: T.textTertiary }}>Monthly Qualifying</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{fmt(varMonthly)}</div></div>
                  <div><div style={{ fontSize: 10, color: T.textTertiary }}>Annual Qualifying</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT }}>{fmt(varMonthly * 12)}</div></div>
                </div>
                {declining && <div style={{ fontSize: 11, color: T.orange, marginTop: 6 }}>Year-over-year decline: {fmt(yr2)} (2024) \u2192 {fmt(yr1)} (2025) \u00b7 {((yr2 - yr1) / yr2 * 100).toFixed(1)}% decrease</div>}
              </div>
            )}
            {yr1 > 0 && yr2 === 0 && <Note color={T.blue}>Enter 2024 income to calculate 2-year average. Using 2025 only: {fmt(yr1 / 12)}/mo</Note>}
            {yr1 === 0 && yr2 === 0 && ytd > 0 && <Note color={T.orange}>Need full-year figures (2025 + 2024) for qualifying. YTD alone is insufficient for most lenders.</Note>}
          </>
        )}
      </SheetCard>
    );
  };

  return (
    <div>
      {/* Hero summary */}
      <div style={{ textAlign: "center", marginBottom: 20, padding: "16px 0 20px", borderBottom: `1px solid ${T.separator}` }}>
        <div style={{ fontSize: 11, fontWeight: 600, fontFamily: MONO, color: T.textTertiary, textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>Monthly Income</div>
        <div style={{ fontSize: 32, fontWeight: 800, fontFamily: FONT, color: T.green, letterSpacing: "-0.03em" }}>{fmt(calc.monthlyIncome)}</div>
        <div style={{ fontSize: 13, color: T.textTertiary }}>{fmt(calc.monthlyIncome * 12)}/yr</div>
      </div>

      {/* Borrower 1 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: FONT }}>Borrower 1</span>
        <button onClick={() => addIncome(1)} style={{ background: `${T.blue}15`, border: `1px solid ${T.blue}33`, borderRadius: 9999, padding: "6px 14px", color: T.blue, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>+ Add</button>
      </div>
      {incomes.filter(i => i.borrower === 1).map(inc => renderIncomeCard(inc, 1))}
      {incomes.filter(i => i.borrower === 1).length === 0 && (
        <SheetCard T={T} style={{ border: `2px dashed ${T.separator}`, background: "transparent", boxShadow: "none", textAlign: "center", padding: 24 }}>
          <button onClick={() => addIncome(1)} style={{ background: "none", border: "none", color: T.blue, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>+ Add Income Source</button>
        </SheetCard>
      )}

      {/* Borrower 2 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: FONT }}>Borrower 2</span>
        <button onClick={() => addIncome(2)} style={{ background: `${T.blue}15`, border: `1px solid ${T.blue}33`, borderRadius: 9999, padding: "6px 14px", color: T.blue, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>+ Add</button>
      </div>
      {incomes.filter(i => i.borrower === 2).map(inc => renderIncomeCard(inc, 2))}
      {incomes.filter(i => i.borrower === 2).length === 0 && (
        <SheetCard T={T} style={{ border: `2px dashed ${T.separator}`, background: "transparent", boxShadow: "none", textAlign: "center", padding: 24 }}>
          <button onClick={() => addIncome(2)} style={{ background: "none", border: "none", color: T.blue, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>+ Add Income Source</button>
        </SheetCard>
      )}

      {/* Other Income */}
      <div style={{ marginTop: 24, marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: FONT }}>Other Income</span>
      </div>
      <SheetCard T={T}>
        <Inp label="Other Monthly Income" value={otherIncome} onChange={setOtherIncome} tip="Additional qualifying income: alimony received, Social Security, pension, disability, or other documented recurring income." />
      </SheetCard>

      {/* Auto-saved indicator */}
      <div style={{ textAlign: "center", marginTop: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: T.green, fontWeight: 500 }}>{"\u2713"} All changes auto-saved</span>
      </div>
    </div>
  );
}
