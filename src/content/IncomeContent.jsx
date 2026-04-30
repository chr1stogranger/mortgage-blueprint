import React from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

const FREQ_OPTIONS = [
  { value: "Annual", label: "Annual" },
  { value: "Monthly", label: "Monthly" },
  { value: "Bi-Weekly", label: "Bi-Weekly" },
  { value: "Weekly", label: "Weekly" },
  { value: "Hourly", label: "Hourly" },
];

const VERIFIED_BY_OPTIONS = [
  { value: "", label: "—" },
  { value: "Verbal", label: "Verbal" },
  { value: "Paystub", label: "Paystub" },
  { value: "W-2", label: "W-2" },
  { value: "Tax Return", label: "Tax Return" },
  { value: "Award Letter", label: "Award Letter" },
  { value: "VOE", label: "VOE" },
];

const SELECTION_OPTIONS = [
  { value: "Amount", label: "Amount" },
  { value: "YTD", label: "YTD Avg" },
  { value: "1Y+", label: "1Y+ Avg" },
  { value: "2Y+", label: "2Y+ Avg" },
];

// Frequency → monthly conversion (parity with parent toMonthly).
function toMonthly(amount, frequency) {
  const a = Number(amount) || 0;
  switch (frequency) {
    case "Annual":   return a / 12;
    case "Monthly":  return a;
    case "Bi-Weekly": return (a * 26) / 12;
    case "Weekly":   return (a * 52) / 12;
    case "Hourly":   return (a * 40 * 52) / 12;
    default: return a / 12;
  }
}

// Mo. Income for one row, honoring the user-picked Selection.
function computeMoIncome(inc, isVariable, monthsElapsed) {
  const ytd = Number(inc.ytd) || 0;
  const yr1 = Number(inc.py1) || 0;
  const yr2 = Number(inc.py2) || 0;
  const sel = inc.selection || (isVariable ? "2Y+" : "Amount");
  if (sel === "Amount") return toMonthly(Number(inc.amount) || 0, inc.frequency);
  if (sel === "YTD")    return ytd > 0 ? (ytd * (12 / monthsElapsed)) / 12 : 0;
  if (sel === "1Y+")    return yr1 > 0 ? yr1 / 12 : 0;
  if (sel === "2Y+") {
    const months = (yr1 > 0 ? 12 : 0) + (yr2 > 0 ? 12 : 0);
    return months === 0 ? 0 : (yr1 + yr2) / months;
  }
  return 0;
}

function BorrowerSection({
  T, isDesktop, borrowerNum, borrowerLabel,
  incomes, addIncome, updateIncome, removeIncome,
  otherMonthlyIncome, setOtherMonthlyIncome,
  TextInp, Inp, Sel,
  VARIABLE_PAY_TYPES, PAY_TYPES,
  monthsElapsed, fmt,
}) {
  const ACCENT = T.blue;
  const HEAD_BG = `${ACCENT}14`;
  const HEAD_BORDER = `${ACCENT}38`;
  const myIncomes = incomes.filter(i => i.borrower === borrowerNum);

  // 13-col grid: Source | Start | End | Pay Type | Amount | Freq | YTD | 1Y+ | 2Y+ | Selection | Verified By | Mo. Income | × remove
  const COLS = "120px 78px 78px 110px 100px 90px 90px 90px 90px 100px 110px 100px 32px";

  const totalMo = myIncomes.reduce((s, i) => s + computeMoIncome(i, VARIABLE_PAY_TYPES.includes(i.payType), monthsElapsed), 0);

  return (
    <div style={{
      border: `1px solid ${T.cardBorder}`,
      borderRadius: 14,
      overflow: "hidden",
      background: T.card,
      marginBottom: 16,
    }}>
      {/* Banner header */}
      <div style={{
        background: ACCENT, color: "#fff", padding: "10px 16px",
        fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", fontFamily: MONO,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span>{borrowerLabel}</span>
        <span style={{ fontSize: 11, opacity: 0.85, fontFamily: MONO, letterSpacing: 0.5 }}>
          {myIncomes.length === 0 ? "No employment income" : `${fmt(totalMo)}/mo`}
        </span>
      </div>

      {isDesktop ? (
        <>
          {/* Column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: COLS,
            gap: 0,
            background: HEAD_BG,
            borderBottom: `1px solid ${HEAD_BORDER}`,
            padding: "8px 12px",
            fontSize: 10, fontFamily: MONO, fontWeight: 700, letterSpacing: 1,
            textTransform: "uppercase", color: T.textTertiary,
          }}>
            <span>Source</span>
            <span>Start</span>
            <span>End</span>
            <span>Pay Type</span>
            <span style={{ textAlign: "right" }}>Amount</span>
            <span>Freq</span>
            <span style={{ textAlign: "right" }}>YTD</span>
            <span style={{ textAlign: "right" }}>1Y+ Avg</span>
            <span style={{ textAlign: "right" }}>2Y+ Avg</span>
            <span>Selection</span>
            <span>Verified By</span>
            <span style={{ textAlign: "right" }}>Mo. Income</span>
            <span></span>
          </div>

          {/* Empty state */}
          {myIncomes.length === 0 && (
            <div style={{ padding: "24px 16px", textAlign: "center" }}>
              <button onClick={() => addIncome(borrowerNum)} style={{
                padding: "10px 20px", borderRadius: 9999,
                background: "transparent", border: `1.5px solid ${ACCENT}`,
                color: ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
              }}>+ Add employment income</button>
            </div>
          )}

          {/* Rows */}
          {myIncomes.map(inc => {
            const isVar = VARIABLE_PAY_TYPES.includes(inc.payType);
            const mo = computeMoIncome(inc, isVar, monthsElapsed);
            return (
              <div key={inc.id} style={{
                display: "grid",
                gridTemplateColumns: COLS,
                gap: 0,
                padding: "8px 12px",
                borderBottom: `1px solid ${T.separator}`,
                alignItems: "center",
              }}>
                <TextInp value={inc.source} onChange={v => updateIncome(inc.id, "source", v)} placeholder="Job 1" sm />
                <TextInp value={inc.start || ""} onChange={v => updateIncome(inc.id, "start", v)} placeholder="MM/YY" sm />
                <TextInp value={inc.end || ""} onChange={v => updateIncome(inc.id, "end", v)} placeholder="—" sm />
                <Sel value={inc.payType} onChange={v => updateIncome(inc.id, "payType", v)} options={PAY_TYPES.map(p => ({ value: p, label: p }))} sm />
                <Inp value={inc.amount} onChange={v => updateIncome(inc.id, "amount", v)} sm />
                <Sel value={inc.frequency} onChange={v => updateIncome(inc.id, "frequency", v)} options={FREQ_OPTIONS} sm />
                {isVar
                  ? <Inp value={inc.ytd} onChange={v => updateIncome(inc.id, "ytd", v)} sm />
                  : <span style={{ textAlign: "right", color: T.textTertiary, fontSize: 12, fontFamily: MONO }}>—</span>}
                {isVar
                  ? <Inp value={inc.py1} onChange={v => updateIncome(inc.id, "py1", v)} sm />
                  : <span style={{ textAlign: "right", color: T.textTertiary, fontSize: 12, fontFamily: MONO }}>—</span>}
                {isVar
                  ? <Inp value={inc.py2} onChange={v => updateIncome(inc.id, "py2", v)} sm />
                  : <span style={{ textAlign: "right", color: T.textTertiary, fontSize: 12, fontFamily: MONO }}>—</span>}
                {isVar
                  ? <Sel value={inc.selection || "2Y+"} onChange={v => updateIncome(inc.id, "selection", v)} options={SELECTION_OPTIONS} sm />
                  : <span style={{ color: T.textTertiary, fontSize: 12, fontFamily: MONO }}>Amount</span>}
                <Sel value={inc.verifiedBy || ""} onChange={v => updateIncome(inc.id, "verifiedBy", v)} options={VERIFIED_BY_OPTIONS} sm />
                <span style={{ textAlign: "right", fontFamily: FONT, fontWeight: 700, color: mo > 0 ? T.green : T.text }}>
                  {fmt(mo)}
                </span>
                <button onClick={() => removeIncome(inc.id)} aria-label="Remove" style={{
                  background: "none", border: "none", color: T.textTertiary,
                  fontSize: 16, cursor: "pointer", padding: 4, lineHeight: 1,
                }}>×</button>
              </div>
            );
          })}

          {/* Totals row */}
          {myIncomes.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: COLS,
              gap: 0,
              padding: "10px 12px",
              background: T.inputBg,
              borderTop: `1px solid ${HEAD_BORDER}`,
              alignItems: "center",
              fontSize: 12, fontWeight: 700, fontFamily: MONO, letterSpacing: 0.5,
              textTransform: "uppercase", color: T.text,
            }}>
              <span style={{ gridColumn: "1 / 12" }}>Total Income</span>
              <span style={{ textAlign: "right", color: T.green, fontFamily: FONT, fontSize: 13 }}>{fmt(totalMo)}</span>
              <span></span>
            </div>
          )}

          {/* Add row + Other Income */}
          <div style={{ padding: "10px 12px", display: "grid", gridTemplateColumns: myIncomes.length > 0 ? "1fr 1fr" : "1fr", gap: 12, alignItems: "center" }}>
            {myIncomes.length > 0 && (
              <button onClick={() => addIncome(borrowerNum)} style={{
                padding: 12, background: `${ACCENT}10`,
                border: `1px dashed ${ACCENT}44`, borderRadius: 10,
                color: ACCENT, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FONT,
              }}>+ Add employment row</button>
            )}
            <Inp label="Other Monthly Income" value={otherMonthlyIncome} onChange={setOtherMonthlyIncome} sm tip="Recurring income from alimony, Social Security, pension, disability, child support — anything outside employment." />
          </div>
        </>
      ) : (
        // ─── Mobile: card-per-job ───
        <div style={{ padding: "12px 14px" }}>
          {myIncomes.map(inc => {
            const isVar = VARIABLE_PAY_TYPES.includes(inc.payType);
            const mo = computeMoIncome(inc, isVar, monthsElapsed);
            return (
              <div key={inc.id} style={{ borderBottom: `1px solid ${T.separator}`, padding: "10px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary }}>Income Source</span>
                  <button onClick={() => removeIncome(inc.id)} style={{ background: "none", border: "none", color: T.red, fontSize: 13, cursor: "pointer" }}>Remove</button>
                </div>
                <TextInp label="Source" value={inc.source} onChange={v => updateIncome(inc.id, "source", v)} sm />
                <Sel label="Pay Type" value={inc.payType} onChange={v => updateIncome(inc.id, "payType", v)} options={PAY_TYPES.map(p => ({ value: p, label: p }))} sm />
                {!isVar && (<>
                  <Inp label="Amount" value={inc.amount} onChange={v => updateIncome(inc.id, "amount", v)} sm />
                  <Sel label="Frequency" value={inc.frequency} onChange={v => updateIncome(inc.id, "frequency", v)} options={FREQ_OPTIONS} sm />
                </>)}
                {isVar && (<>
                  <Inp label="YTD" value={inc.ytd} onChange={v => updateIncome(inc.id, "ytd", v)} sm />
                  <Inp label="Last Year" value={inc.py1} onChange={v => updateIncome(inc.id, "py1", v)} sm />
                  <Inp label="Year Before" value={inc.py2} onChange={v => updateIncome(inc.id, "py2", v)} sm />
                  <Sel label="Use" value={inc.selection || "2Y+"} onChange={v => updateIncome(inc.id, "selection", v)} options={SELECTION_OPTIONS} sm />
                </>)}
                <Sel label="Verified By" value={inc.verifiedBy || ""} onChange={v => updateIncome(inc.id, "verifiedBy", v)} options={VERIFIED_BY_OPTIONS} sm />
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13 }}>
                  <span style={{ color: T.textSecondary, fontWeight: 600 }}>Mo. Income</span>
                  <span style={{ fontFamily: FONT, fontWeight: 700, color: T.green }}>{fmt(mo)}</span>
                </div>
              </div>
            );
          })}
          <button onClick={() => addIncome(borrowerNum)} style={{
            width: "100%", marginTop: 10, padding: 12, background: `${ACCENT}10`,
            border: `1px dashed ${ACCENT}44`, borderRadius: 10,
            color: ACCENT, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: FONT,
          }}>{myIncomes.length === 0 ? "+ Add employment income" : "+ Add another"}</button>
          <div style={{ marginTop: 12 }}>
            <Inp label="Other Monthly Income" value={otherMonthlyIncome} onChange={setOtherMonthlyIncome} tip="Alimony / SS / pension / disability / child support." />
          </div>
        </div>
      )}
    </div>
  );
}

export default function IncomeContent({
  T, isDesktop, calc, fmt,
  incomes, addIncome, updateIncome, removeIncome,
  otherIncome, setOtherIncome, otherIncome2, setOtherIncome2,
  Hero, Card, Sec, TextInp, Inp, Sel, Note, Progress,
  VARIABLE_PAY_TYPES, PAY_TYPES, loanType,
  isPulse, GuidedNextButton,
}) {
  const monthsElapsed = Math.max(1, new Date().getMonth() + 1);

  // Bottom DTI summary
  const monthlyIncome = calc.monthlyIncome || 0;
  const housing = calc.housingPayment || 0;
  const totalDebts = calc.totalMonthlyDebts || 0;
  const reoExtra = calc.reoNegativeDebt || 0;
  const backDTI = monthlyIncome > 0 ? (housing + totalDebts + reoExtra) / monthlyIncome : null;
  const frontDTI = monthlyIncome > 0 ? housing / monthlyIncome : null;

  // FHA shows BOTH; everyone else just back-end. FHA caps: 47% front / 56.99% back.
  const isFHA = loanType === "FHA";
  const backMax = isFHA ? 0.5699 : (calc.maxDTI || 0.50);
  const frontMax = 0.47;
  const backOk = backDTI !== null && backDTI <= backMax;
  const frontOk = frontDTI !== null && frontDTI <= frontMax;

  return (<>
    <div style={{ marginTop: 20 }}>
      <BorrowerSection
        T={T} isDesktop={isDesktop}
        borrowerNum={1}
        borrowerLabel="Borrower 1 — Employment Income"
        incomes={incomes}
        addIncome={addIncome} updateIncome={updateIncome} removeIncome={removeIncome}
        otherMonthlyIncome={otherIncome} setOtherMonthlyIncome={setOtherIncome}
        TextInp={TextInp} Inp={Inp} Sel={Sel}
        VARIABLE_PAY_TYPES={VARIABLE_PAY_TYPES} PAY_TYPES={PAY_TYPES}
        monthsElapsed={monthsElapsed}
        fmt={fmt}
      />

      <BorrowerSection
        T={T} isDesktop={isDesktop}
        borrowerNum={2}
        borrowerLabel="Borrower 2 — Employment Income"
        incomes={incomes}
        addIncome={addIncome} updateIncome={updateIncome} removeIncome={removeIncome}
        otherMonthlyIncome={otherIncome2} setOtherMonthlyIncome={setOtherIncome2}
        TextInp={TextInp} Inp={Inp} Sel={Sel}
        VARIABLE_PAY_TYPES={VARIABLE_PAY_TYPES} PAY_TYPES={PAY_TYPES}
        monthsElapsed={monthsElapsed}
        fmt={fmt}
      />
    </div>

    {/* ─── BOTTOM SUMMARY: Total Monthly Income + DTI progress ─── */}
    <Card pad={16}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", color: T.textTertiary, fontWeight: 700 }}>Total Monthly Income</div>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT, color: T.text, letterSpacing: "-0.02em", marginTop: 2 }}>
            {fmt(monthlyIncome)}<span style={{ fontSize: 13, color: T.textTertiary, fontWeight: 600 }}>/mo</span>
          </div>
          <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2, fontFamily: MONO, letterSpacing: 0.3 }}>
            {fmt(monthlyIncome * 12)}/yr
          </div>
        </div>
        {isFHA && (
          <div style={{ background: `${T.orange}10`, border: `1px solid ${T.orange}33`, borderRadius: 8, padding: "4px 10px", fontSize: 10, fontWeight: 700, color: T.orange, fontFamily: MONO, letterSpacing: 0.5, textTransform: "uppercase" }}>
            FHA caps: front 47% / back 56.99%
          </div>
        )}
      </div>

      {monthlyIncome > 0 && backDTI !== null ? (<>
        {isFHA && (<>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 4px", fontSize: 13, borderTop: `1px solid ${T.separator}`, marginTop: 8 }}>
            <span style={{ color: T.textSecondary, fontWeight: 500 }}>Front-end DTI (housing only)</span>
            <span style={{ fontFamily: FONT, fontWeight: 700, color: frontOk ? T.green : T.red }}>
              {(frontDTI * 100).toFixed(1)}% / {(frontMax * 100).toFixed(0)}% max
            </span>
          </div>
          <Progress value={frontDTI} max={frontMax} color={frontOk ? T.green : T.red} height={8} />
          <div style={{ height: 8 }} />
        </>)}

        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 4px", fontSize: 13, borderTop: isFHA ? "none" : `1px solid ${T.separator}`, marginTop: isFHA ? 0 : 8 }}>
          <span style={{ color: T.textSecondary, fontWeight: 500 }}>Back-end DTI (housing + debts)</span>
          <span style={{ fontFamily: FONT, fontWeight: 700, color: backOk ? T.green : T.red }}>
            {(backDTI * 100).toFixed(1)}% / {(backMax * 100).toFixed(isFHA ? 2 : 0)}% max
          </span>
        </div>
        <Progress value={backDTI} max={backMax} color={backOk ? T.green : T.red} height={10} />
        <div style={{ fontSize: 11, color: backOk ? T.green : T.red, fontWeight: 500, marginTop: 6 }}>
          {backOk
            ? `✓ Within limits — ${fmt(monthlyIncome * backMax - housing - totalDebts - reoExtra)}/mo headroom`
            : `Above ${loanType} max — reduce debts or increase income`}
        </div>
      </>) : (
        <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.separator}` }}>
          Enter employment income above to see your DTI.
        </div>
      )}
    </Card>

    <GuidedNextButton />
  </>);
}
