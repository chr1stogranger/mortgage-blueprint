import React from "react";
import Icon from "../Icon";
// AMI lookup retained in src/data/caAmi.js for future re-enabling, but no
// longer rendered in the Debt to Income Summary card.

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

// ─────────────────────────────────────────────────────────────────────────
// Debt to Income Summary — mirrors Christo's client-walkthrough spreadsheet.
// 3-column body (Income / Area Median Income / Debts) + Qualifying Ratios footer.
//
// MATH:
//   Income Min  = totalDebts ÷ maxDTI      → minimum monthly income to qualify
//   Income Δ    = currentIncome − Income Min   (negative = shortfall, red)
//   Debts Max   = currentIncome × maxDTI    → max debts allowed at current income
//   Debts Δ     = currentDebts − Debts Max  (positive = overshoot, red)
//   HTI         = housingPayment ÷ income   (front-end ratio)
//   DTI         = totalDebts ÷ income       (back-end ratio)
//
// HTI Max:  47% for FHA only — other programs (Conv/VA/Jumbo) have no front-end cap.
// DTI Max:  pulled from calc.maxDTI (program-specific).
// ─────────────────────────────────────────────────────────────────────────
function DebtToIncomeSummary({
  T, fmt, pct, isDesktop = true,
  calc, loanType,
  incomes = [], subjectRentalIncome = 0, otherIncome = 0, otherIncome2 = 0,
  reos = [], debts = [], debtFree = false,
  propertyCounty = "", propertyState = "California",
}) {
  // ── Income breakdown ──
  // Read from calc.employmentMonthlyIncome — the parent layer aggregates
  // every income row through the variable-pay averaging logic and excludes
  // Previous employers. Reading the stale `monthlyAmount` field (legacy,
  // never populated in the current data model) would always return $0.
  // Christo (2026-05-12): DTI Summary was showing $0 income.
  const employmentIncome = Number(calc?.employmentMonthlyIncome) || 0;
  // Subject Property Income — rental income from the property being purchased (if 1-4 unit)
  const subjectPropIncome = Number(subjectRentalIncome) || 0;
  // Investment Property Income — net positive contributions from rental REOs (from calc)
  const investmentIncome = Number(calc?.reoPositiveIncome) || 0;
  // Other Monthly Income — child support, alimony, social security, etc.
  const otherTotal = (Number(otherIncome) || 0) + (Number(otherIncome2) || 0);
  const totalMonthlyIncome = employmentIncome + subjectPropIncome + investmentIncome + otherTotal;
  const totalAnnualIncome = totalMonthlyIncome * 12;

  // ── Debts breakdown ──
  const newHousingPiti = Number(calc?.totalPayment) || 0;
  const monthlyLiabilities = debtFree
    ? 0
    : (debts || []).reduce((sum, d) => {
        // Debts paid off (at or before closing) or omitted don't count
        // toward post-closing DTI. NOTE: the monthly payment field on a
        // debt is `monthly` (set in DebtsContent), not `payment` — reading
        // the wrong key was zeroing out Monthly Liabilities entirely.
        if (d?.payoff === "Yes - at Escrow" || d?.payoff === "Yes - POC" || d?.payoff === "Omit") return sum;
        return sum + (Number(d?.monthly) || 0);
      }, 0);
  // Primary & Secondary Home Expenses — REO PITIA on owner-occupied (non-investment) properties
  const primarySecondaryHomeExpenses = (reos || []).reduce((sum, r) => {
    const occ = String(r?.occupancy || "").toLowerCase();
    const isInvestment = occ.includes("invest") || occ.includes("rental");
    if (isInvestment) return sum;
    return sum + ((Number(r?.payment) || 0) + (Number(r?.taxes) || 0) + (Number(r?.insurance) || 0) + (Number(r?.hoa) || 0));
  }, 0);
  // Investment RE Net — pulled from calc (already nets rental income against PITIA)
  const investmentReNet = Number(calc?.reoNegativeDebt) || 0;
  const totalDebts = newHousingPiti + monthlyLiabilities + primarySecondaryHomeExpenses + investmentReNet;
  const totalAnnualDebts = totalDebts * 12;

  // ── Qualifying caps & deltas ──
  // calc.maxDTI is ALREADY a 0–1 fraction (e.g. 0.50 for Conventional) —
  // don't divide by 100 again. The old `/ 100` turned 0.50 into 0.005,
  // which displayed as "0.50%" and blew up Income Min (debts ÷ 0.005).
  const maxDTI = Number(calc?.maxDTI) || 0.5;
  const isFHA = loanType === "FHA";
  const maxHTI = isFHA ? 0.47 : null;                  // FHA front-end cap

  const incomeMin = totalDebts > 0 ? totalDebts / maxDTI : 0;
  const incomeDelta = totalMonthlyIncome - incomeMin;
  const debtsMax = totalMonthlyIncome * maxDTI;
  const debtsDelta = totalDebts - debtsMax;

  // Personal ratios
  const personalHTI = totalMonthlyIncome > 0 ? newHousingPiti / totalMonthlyIncome : 0;
  const personalDTI = totalMonthlyIncome > 0 ? totalDebts / totalMonthlyIncome : 0;

  // ─── Render helpers ───
  // Headers (Debt to Income Summary / Qualifying Ratios) use the same soft
  // light-indigo tint + indigo text treatment as the Payment Breakdown header
  // in CalculatorContent so all sub-section banners read consistently.
  const headerStyle = {
    background: `linear-gradient(135deg, ${T.blue}18, ${T.blue}0c)`,
    color: T.blue,
    borderBottom: `1px solid ${T.blue}38`,
    padding: "10px 16px",
    fontSize: 11,
    fontWeight: 700,
    fontFamily: FONT,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    textAlign: "center",
  };
  const subHeaderStyle = {
    background: `${T.blue}12`,
    padding: "8px 12px",
    fontSize: 10,
    fontWeight: 700,
    fontFamily: FONT,
    color: T.blue,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    borderBottom: `1px solid ${T.separator}`,
    textAlign: "center",
  };
  const rowStyle = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 12px", borderBottom: `1px solid ${T.separator}`,
    fontSize: 12, fontFamily: FONT,
  };
  const totalRowStyle = {
    ...rowStyle,
    background: `${T.green}15`,
    fontWeight: 700,
    color: T.text,
  };
  const cellLabel = { color: T.textSecondary };
  const cellValue = { color: T.text, fontWeight: 600, fontFamily: FONT };

  // Render a single section column (Income or Debts) with title-row + line items + total
  const Column = ({ title, rows, totalLabel, totalValue, totalAnnual }) => (
    <div style={{ minWidth: 0 }}>
      <div style={subHeaderStyle}>{title}</div>
      {rows.map((r, i) => (
        // minHeight keeps every line-item row a uniform height so the two
        // columns stay aligned even when one side's label wraps to two lines
        // (e.g. "Other Monthly Income") and the other doesn't ("Invest. Real
        // Estate Net"). Without this, Total Debts floats above Total Monthly
        // Income and the rest of the rows drift out of sync. (Christo 2026-05-27.)
        <div key={i} style={{ ...rowStyle, minHeight: 52, boxSizing: "border-box" }}>
          <span style={cellLabel}>{r.label}</span>
          <span style={cellValue}>{fmt(r.value)}</span>
        </div>
      ))}
      <div style={totalRowStyle}>
        <span>{totalLabel}</span>
        <span>{fmt(totalValue)}</span>
      </div>
      {totalAnnual !== undefined && (
        <div style={{ ...rowStyle, background: `${T.blue}06`, fontWeight: 600, color: T.textSecondary }}>
          <span style={{ fontSize: 11 }}>Total Annual</span>
          <span style={{ fontSize: 11, fontFamily: FONT }}>{fmt(totalAnnual)}</span>
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.cardBorder}`,
      borderRadius: 14,
      overflow: "hidden",
      marginBottom: 16,
      boxShadow: `0 0 0 1px ${T.blue}10`,
    }}>
      {/* Top header band */}
      <div style={headerStyle}>Debt to Income Summary</div>

      {/* 2-column body — Income | Debts. AMI removed per Christo. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
        {/* INCOME column */}
        <div style={{ borderRight: `1px solid ${T.separator}` }}>
          <Column
            title="Income"
            rows={[
              { label: "Monthly Employment Income",  value: employmentIncome },
              { label: "Subject Property Income",    value: subjectPropIncome },
              { label: "Investment Property Income", value: investmentIncome },
              { label: "Other Monthly Income",       value: otherTotal },
            ]}
            totalLabel="Total Monthly Income"
            totalValue={totalMonthlyIncome}
            totalAnnual={totalAnnualIncome}
          />
          {/* Income Min/Delta footer */}
          <div style={{ ...rowStyle, background: `${T.bg || "#fafafa"}`, padding: "10px 12px" }}>
            <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, letterSpacing: 0.6, textTransform: "uppercase" }}>Min</span>
            <span style={cellValue}>{fmt(incomeMin)}</span>
          </div>
          <div style={{
            ...rowStyle,
            background: incomeDelta < 0 ? `${T.red}10` : `${T.green}10`,
            color: incomeDelta < 0 ? T.red : T.green,
            fontWeight: 700,
          }}>
            <span style={{ fontSize: 11, fontFamily: FONT, letterSpacing: 0.6, textTransform: "uppercase" }}>Delta</span>
            <span style={{ fontFamily: FONT, fontWeight: 700 }}>
              {incomeDelta < 0 ? "−" : ""}{fmt(Math.abs(incomeDelta))}
            </span>
          </div>
        </div>

        {/* DEBTS column */}
        <div>
          <Column
            title="Debts"
            rows={[
              { label: "New Housing PITI Payment",         value: newHousingPiti },
              { label: "Monthly Liabilities (Credit)",     value: monthlyLiabilities },
              { label: "Primary & Secondary Home",         value: primarySecondaryHomeExpenses },
              // On mobile, abbreviate "Investment" → "Invest." so the row fits
              // on one line and lines up cleanly with the others. (Christo 2026-05-12.)
              { label: isDesktop ? "Investment Real Estate Net" : "Invest. Real Estate Net", value: investmentReNet },
            ]}
            totalLabel="Total Debts"
            totalValue={totalDebts}
            totalAnnual={totalAnnualDebts}
          />
          {/* Debts Max/Delta footer */}
          <div style={{ ...rowStyle, background: `${T.bg || "#fafafa"}`, padding: "10px 12px" }}>
            <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, letterSpacing: 0.6, textTransform: "uppercase" }}>Max</span>
            <span style={cellValue}>{fmt(debtsMax)}</span>
          </div>
          <div style={{
            ...rowStyle,
            background: debtsDelta > 0 ? `${T.red}10` : `${T.green}10`,
            color: debtsDelta > 0 ? T.red : T.green,
            fontWeight: 700,
          }}>
            <span style={{ fontSize: 11, fontFamily: FONT, letterSpacing: 0.6, textTransform: "uppercase" }}>Delta</span>
            <span style={{ fontFamily: FONT, fontWeight: 700 }}>
              {debtsDelta > 0 ? "+" : ""}{fmt(debtsDelta)}
            </span>
          </div>
        </div>
      </div>

      {/* Qualifying Ratios footer — same soft tint as the top header */}
      <div style={{
        background: `linear-gradient(135deg, ${T.blue}18, ${T.blue}0c)`,
        color: T.blue,
        borderTop: `1px solid ${T.blue}38`,
        padding: "8px 16px",
        fontSize: 11,
        fontWeight: 700,
        fontFamily: FONT,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        textAlign: "center",
      }}>Qualifying Ratios</div>
      <div style={{ padding: "10px 16px", display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.8fr", gap: 6 }}>
        {/* Header row */}
        <div></div>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.textTertiary, fontFamily: FONT, letterSpacing: 1, textTransform: "uppercase", textAlign: "right" }}>Personal</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.textTertiary, fontFamily: FONT, letterSpacing: 1, textTransform: "uppercase", textAlign: "right" }}>Max</div>
        {/* HTI row */}
        <div style={{ fontSize: 12, color: T.textSecondary }}>Housing-to-Income (HTI)</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.text, textAlign: "right", fontFamily: FONT }}>{(personalHTI * 100).toFixed(2)}%</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, textAlign: "right", fontFamily: FONT }}>{maxHTI ? `${(maxHTI * 100).toFixed(2)}%` : "—"}</div>
        {/* DTI row */}
        <div style={{ fontSize: 12, color: T.textSecondary }}>Total Debt-to-Income (DTI)</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: personalDTI > maxDTI ? T.red : T.text, textAlign: "right", fontFamily: FONT }}>{(personalDTI * 100).toFixed(2)}%</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, textAlign: "right", fontFamily: FONT }}>{(maxDTI * 100).toFixed(2)}%</div>
      </div>
    </div>
  );
}

export default function QualifyContent({
  T, isDesktop, calc, fmt, pct,
  isRefi, loanType, firstTimeBuyer, downPct, setDownPct,
  creditScore, setCreditScore,
  refiPurpose, refiLtvCheck,
  allGood, someGood, refiPillarCount, purchPillarCount,
  setTab, handlePillarClick,
  isPulse, isTabUnlocked, markTouched,
  affordIncome: _propAffordIncome, affordDebts: _propAffordDebts, affordDown: _propAffordDown,
  affordTerm: _propAffordTerm, affordRate: _propAffordRate, affordLoanType: _propAffordLoanType,
  affordTargetDTI, setAffordTargetDTI,
  debts, debtFree,
  salesPrice, setSalesPrice, rate, setRate, term, setTerm,
  setLoanType, userLoanTypeRef, setAutoJumboSwitch,
  confirmAffordApply, setConfirmAffordApply,
  getHighBalLimit, propType,
  // New props for the Debt to Income Summary block (replaces old DTI bar).
  incomes = [], subjectRentalIncome = 0, otherIncome = 0, otherIncome2 = 0,
  reos = [], propertyCounty = "", propertyState = "California",
  StopLight, Card, Sec, Inp, Note, Progress, Hero, MRow,
  GuidedNextButton,
}) {
  // Affordability inputs: prefer the synced state (when user lands on Qualify/Overview the parent's
  // useEffect copies calc.X into these), but fall back to live calc values so the calc never
  // reports "debts exceed DTI" just because the sync hasn't run yet (data loads async on first render).
  const affordIncome = _propAffordIncome > 0 ? _propAffordIncome : Math.round(calc.qualifyingIncome || 0);
  const affordDebts = _propAffordDebts > 0 ? _propAffordDebts : Math.round((calc.totalMonthlyDebts || 0) + (calc.reoNegativeDebt || 0));
  const affordDown = _propAffordDown > 0 ? _propAffordDown : (calc.totalForClosing || 0);
  const affordRate = _propAffordRate > 0 ? _propAffordRate : rate;
  const affordTerm = _propAffordTerm > 0 ? _propAffordTerm : term;
  const affordLoanType = _propAffordLoanType || loanType;
  return (<>

 {/* Header: Qualification + Full Details link */}
 <div data-field="qualify-section" className={isPulse && isPulse("qualify-section")} onClick={() => markTouched && markTouched("qualify-section")} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginBottom: 12 }}>
  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: "-0.02em", fontFamily: FONT }}>Qualification</h2>
  <a onClick={(e) => { e.preventDefault(); document.getElementById("qualify-details")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
   style={{ fontSize: 13, fontWeight: 600, color: T.blue, cursor: "pointer", fontFamily: FONT, textDecoration: "none" }}>Full Details →</a>
 </div>

 {/* 5 Pillars (StopLight) — moved ABOVE FICO Score per Christo's spec.
     hideBanner because we render our own PRE-QUALIFIED celebration card below. */}
 <div>
  <StopLight hideBanner onPillarClick={handlePillarClick} checks={isRefi ? [
   { label: "FICO", ok: calc.ficoCheck === "Good!" ? true : calc.ficoCheck === "—" ? null : false, sub: creditScore > 0 ? `${creditScore} / ${calc.ficoMin}+` : "Enter score", icon: "bar-chart", fullLabel: "Credit Score (FICO)", detail: `Min ${calc.ficoMin} for ${loanType}. ${creditScore >= 740 ? "Excellent — best pricing tier." : creditScore >= calc.ficoMin ? `Meets minimum. 740+ unlocks better pricing.` : creditScore > 0 ? `Need ${calc.ficoMin - creditScore} more points.` : "Enter your middle FICO score."}`, action: "Edit credit score" },
   { label: "DTI", ok: calc.dtiCheck === "Good!" ? true : calc.dtiCheck === "—" ? null : false, sub: calc.qualifyingIncome > 0 ? `${pct(calc.yourDTI, 1)} / ${pct(calc.maxDTI, 0)}` : "Add income", icon: "scale", fullLabel: "DTI Ratio", detail: calc.qualifyingIncome > 0 ? `Max ${pct(calc.maxDTI, 0)} for ${loanType}. Total payment ${fmt(calc.totalPayment)}/mo ÷ income ${fmt(calc.qualifyingIncome)}/mo = ${pct(calc.yourDTI, 1)}.` : "Add income on the Income tab to calculate DTI.", action: calc.qualifyingIncome > 0 ? "Edit income & debts" : "Go to Income tab" },
   { label: "LTV", ok: refiLtvCheck === "Good!" ? true : refiLtvCheck === "—" ? null : false, sub: calc.refiNewLTV > 0 ? `${pct(calc.refiNewLTV, 0)} / ${refiPurpose === "Cash-Out" ? "80%" : "95%"}` : "Enter loan details", icon: "home", fullLabel: "Loan-to-Value", detail: calc.refiNewLTV > 0 ? `New LTV: ${pct(calc.refiNewLTV, 1)}. Max ${refiPurpose === "Cash-Out" ? "80%" : "95%"} for ${refiPurpose} refi. ${calc.refiNewLTV <= 0.80 ? "Below 80% — no PMI required." : ""}` : "Enter your current loan details in Setup to calculate LTV.", action: "Edit loan details" },
  ] : [
   { label: "FICO", ok: calc.ficoCheck === "Good!" ? true : calc.ficoCheck === "—" ? null : false, sub: creditScore > 0 ? `${creditScore} / ${calc.ficoMin}+` : "Enter score", icon: "bar-chart", fullLabel: "Credit Score (FICO)", detail: `Min ${calc.ficoMin} for ${loanType}. ${creditScore >= 740 ? "Excellent — best pricing tier." : creditScore >= calc.ficoMin ? `Meets minimum. 740+ unlocks better pricing.` : creditScore > 0 ? `Need ${calc.ficoMin - creditScore} more points.` : "Enter your middle FICO score."}`, action: "Edit credit score" },
   { label: "Down", ok: calc.dpWarning === null ? true : false, sub: `${downPct}% / ${calc.minDPpct}%+`, icon: "home", fullLabel: "Down Payment", detail: `Min ${calc.minDPpct}%${loanType === "Conventional" && firstTimeBuyer ? " (FTHB)" : ""} for ${loanType}. Yours: ${downPct}% = ${fmt(calc.dp)}. ${downPct >= 20 ? "No mortgage insurance required!" : `PMI required until 80% LTV.`}`, action: "Adjust down payment" },
   { label: "DTI", ok: calc.dtiCheck === "Good!" ? true : calc.dtiCheck === "—" ? null : false, sub: calc.qualifyingIncome > 0 ? `${pct(calc.yourDTI, 1)} / ${pct(calc.maxDTI, 0)}` : "Add income", icon: "scale", fullLabel: "DTI Ratio", detail: calc.qualifyingIncome > 0 ? `Max ${pct(calc.maxDTI, 0)} for ${loanType}. Total payment ${fmt(calc.totalPayment)}/mo ÷ income ${fmt(calc.qualifyingIncome)}/mo = ${pct(calc.yourDTI, 1)}.` : "Add income on the Income tab to calculate DTI.", action: calc.qualifyingIncome > 0 ? "Edit income & debts" : "Go to Income tab" },
   { label: "Cash", ok: calc.cashCheck === "Good!" ? true : calc.cashCheck === "—" ? null : false, sub: calc.totalForClosing > 0 ? `${fmt(calc.totalForClosing)}` : "Add assets", icon: "dollar", fullLabel: "Cash to Close", detail: `Need ${fmt(calc.cashToClose)} (down payment + closing costs – credits). ${calc.totalForClosing > 0 ? `Have ${fmt(calc.totalForClosing)} verified. ${calc.totalForClosing >= calc.cashToClose ? "Fully funded!" : `Short ${fmt(calc.cashToClose - calc.totalForClosing)}.`}` : "Add assets to verify funds."}`, action: "Edit assets" },
   { label: "Reserves", ok: calc.resCheck === "Good!" ? true : calc.resCheck === "—" ? null : false, sub: calc.totalReserves > 0 ? `${fmt(calc.totalReserves)}` : "Add assets", icon: "landmark", fullLabel: "Reserves", detail: `${calc.reserveMonths} months required (${loanType === "Jumbo" ? "Jumbo" : "standard"}) = ${fmt(calc.reservesReq)}. ${calc.totalReserves > 0 ? `Have ${fmt(calc.totalReserves)}. ${calc.totalReserves >= calc.reservesReq ? "Fully funded!" : `Short ${fmt(calc.reservesReq - calc.totalReserves)}.`}` : "Add assets to verify reserves."}`, action: "Edit assets" },
  ]} />
 </div>

 {/* FICO Score — slider + numeric input. Moved BELOW pillars per Christo's spec. */}
 <div style={{ marginTop: 16 }}>
  <Card>
   <div style={{ fontSize: 11, fontWeight: 600, color: T.textTertiary, fontFamily: FONT, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>FICO Score</div>
   <div data-field="qualify-fico" className={isPulse("qualify-fico")} style={{ display: "flex", alignItems: "center", gap: isDesktop ? 14 : 8 }}>
    <input type="text" inputMode="numeric" value={creditScore === 0 ? "" : creditScore} placeholder="720"
     onChange={e => { const v = e.target.value.replace(/\D/g, ""); if (v === "") { setCreditScore(0); return; } const n = Math.min(parseInt(v, 10), 850); setCreditScore(n); }}
     onBlur={() => { if (creditScore > 0 && creditScore < 300) setCreditScore(300); }}
     style={{ flex: isDesktop ? "0 0 90px" : "0 0 62px", background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: isDesktop ? "10px 14px" : "10px 6px", color: T.text, fontSize: isDesktop ? 17 : 16, fontWeight: 600, fontFamily: FONT, outline: "none", textAlign: "center", letterSpacing: "-0.02em" }} />
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
     <input type="range" min={300} max={850} step={1} value={creditScore || 650}
      onChange={e => setCreditScore(parseInt(e.target.value, 10))}
      style={{ width: "100%", height: 6, appearance: "none", WebkitAppearance: "none", background: `linear-gradient(to right, ${T.red} 0%, ${T.orange} 30%, ${T.green} 70%, ${T.green} 100%)`, borderRadius: 3, outline: "none", cursor: "pointer", accentColor: T.blue }} />
     <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: T.textTertiary, fontFamily: FONT, letterSpacing: 0.5 }}>
      <span>300</span>
      <span>850</span>
     </div>
    </div>
    {creditScore > 0 && (
     <div style={{ flexShrink: 0, background: creditScore >= calc.ficoMin ? `${T.green}18` : `${T.red}18`, color: creditScore >= calc.ficoMin ? T.green : T.red, borderRadius: 9999, padding: isDesktop ? "5px 12px" : "4px 9px", fontSize: isDesktop ? 12 : 11, fontWeight: 700, fontFamily: FONT, whiteSpace: "nowrap" }}>
      {creditScore} / {calc.ficoMin}+ {creditScore >= calc.ficoMin ? "✓" : "✗"}
     </div>
    )}
   </div>
   {creditScore > 0 && creditScore < calc.ficoMin && <Note color={T.red}>Min score for {loanType}: <strong>{calc.ficoMin}</strong>. Need {calc.ficoMin - creditScore} more points.</Note>}
   {creditScore >= 740 && <Note color={T.green}>Excellent credit — qualifies for best pricing!</Note>}
   {creditScore >= calc.ficoMin && creditScore < 740 && <Note color={T.orange}>Meets minimum. 740+ unlocks better pricing tiers.</Note>}
  </Card>
 </div>

 {/* PRE-QUALIFIED celebration hero — only when allGood. Sits between FICO and the
     2-col body so the 'all green' state visually celebrates the pillars + FICO. */}
 {allGood && (
  <Card style={{ marginTop: 16, background: `${T.green}15`, textAlign: "center", padding: "22px 20px" }}>
   <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 4 }}>
    <Icon name="trophy" size={28} style={{ color: T.green }} />
    <div style={{ fontSize: 22, fontWeight: 800, color: T.green, fontFamily: FONT, letterSpacing: "0.02em" }}>{isRefi ? "REFI QUALIFIED" : "PRE-QUALIFIED"}</div>
   </div>
   <div style={{ fontSize: 14, color: T.textSecondary, marginTop: 6 }}>{isRefi ? "All 3 pillars cleared!" : "All 5 pillars cleared!"}</div>
   <div style={{ fontSize: 12, color: T.textTertiary, fontStyle: "italic", marginTop: 2 }}>Based on the information you provided.</div>
   <button onClick={() => isRefi ? setTab("refi") : window.open("https://2179191.my1003app.com/952015/register", "_blank")}
    style={{ marginTop: 16, padding: "12px 28px", background: "linear-gradient(135deg, #4a90d9, #3a7dc4)", border: "none", borderRadius: 14, cursor: "pointer", boxShadow: "0 4px 16px rgba(74,144,217,0.35)" }}>
    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: FONT }}>{isRefi ? "View Refi Summary →" : "Get Pre-Approved →"}</div>
    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{isRefi ? "See your savings breakdown" : "Complete my application to lock in your approval"}</div>
   </button>
  </Card>
 )}

 <div style={isDesktop ? { display: "flex", gap: 24, alignItems: "flex-start", marginTop: 16 } : {}}>
 {/* ── LEFT column: DTI bar + Pre-Qualified vs Pre-Approved education ── */}
 <div style={isDesktop ? { width: "50%", flexShrink: 0, minWidth: 0 } : {}}>
 {/* Debt to Income Summary — full breakdown matching Christo's spreadsheet.
     Replaces the old compact DTI bar + 'Min income needed' caption. */}
 {calc.qualifyingIncome > 0 && (
  <DebtToIncomeSummary
    T={T} fmt={fmt} pct={pct} isDesktop={isDesktop}
    calc={calc} loanType={loanType}
    incomes={incomes}
    subjectRentalIncome={subjectRentalIncome}
    otherIncome={otherIncome}
    otherIncome2={otherIncome2}
    reos={reos}
    debts={debts}
    debtFree={debtFree}
    propertyCounty={propertyCounty}
    propertyState={propertyState}
  />
 )}
 {/* Pre-Qualified vs Pre-Approved education box — always visible on purchase loans
     (was previously gated on allGood). Title/subtitle adapt to qualification state. */}
 {!isRefi && (
  <Card style={{ marginTop: 12, background: `${T.green}15`, padding: 20, textAlign: "center" }}>
   <div style={{ fontSize: 16, fontWeight: 800, color: T.green, fontFamily: FONT, letterSpacing: "0.02em" }}>{allGood ? "PRE-QUALIFIED" : "PRE-QUALIFIED vs PRE-APPROVED"}</div>
   <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 4 }}>{allGood ? "All 5 pillars cleared — based on the information you provided." : "Understanding the difference between the two."}</div>
   <div style={{ marginTop: 14, padding: "14px 16px", background: T.card, borderRadius: 12, textAlign: "left" }}>
    <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
     <span style={{ fontSize: 22, flexShrink: 0 }}></span>
     <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.orange, marginBottom: 2 }}>Pre-Qualified</div>
      <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5 }}>Based on what you <strong style={{ color: T.text }}>tell</strong> the lender — income, assets, and debts as self-reported. A good starting point, but not verified.</div>
     </div>
    </div>
    <div style={{ display: "flex", gap: 10 }}>
     <span style={{ fontSize: 22, flexShrink: 0 }}></span>
     <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.green, marginBottom: 2 }}>Pre-Approved</div>
      <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5 }}>Based on what you <strong style={{ color: T.text }}>show</strong> the lender — verified paystubs, bank statements, tax returns, and credit pull. Sellers take this seriously.</div>
     </div>
    </div>
   </div>
   <button onClick={() => window.open("https://2179191.my1003app.com/952015/register", "_blank")} style={{ marginTop: 14, width: "100%", padding: "14px 20px", background: "linear-gradient(135deg, #4a90d9, #3a7dc4)", border: "none", borderRadius: 14, cursor: "pointer", boxShadow: "0 4px 16px rgba(74,144,217,0.35)" }}>
    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: FONT }}>Get Pre-Approved →</div>
    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Complete my application to lock in your approval</div>
   </button>
  </Card>
 )}
 {calc.qualifyingIncome <= 0 && (
  <div data-field="qualify-needs-income" className={isPulse("qualify-needs-income")} onClick={() => setTab("income")} style={{ borderRadius: 14, transition: "all 0.3s", cursor: "pointer" }}>
   <Card style={{ background: `${T.orange}10`, border: `1px solid ${T.orange}30` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
     <span style={{ fontSize: 20 }}></span>
     <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.orange }}>Add income to see DTI</div>
      <div style={{ fontSize: 12, color: T.textSecondary }}>Tap to go to the Income tab</div>
     </div>
    </div>
   </Card>
  </div>
 )}
 {!isRefi && calc.qualifyingIncome > 0 && calc.totalForClosing <= 0 && (
  <div data-field="qualify-needs-assets" className={isPulse("qualify-needs-assets")} onClick={() => setTab("assets")} style={{ borderRadius: 14, transition: "all 0.3s", cursor: "pointer" }}>
   <Card style={{ background: `${T.orange}10`, border: `1px solid ${T.orange}30` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
     <span style={{ fontSize: 20 }}></span>
     <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.orange }}>Add assets to verify cash to close</div>
      <div style={{ fontSize: 12, color: T.textSecondary }}>Tap to go to the Assets tab</div>
     </div>
    </div>
   </Card>
  </div>
 )}
 </div>{/* end qualify left column */}
 {/* ── RIGHT: Afford section — scrollable 50% ── */}
 <div style={isDesktop ? { width: "50%", flexShrink: 0, minWidth: 0 } : {}}>
 {/* ── AFFORD SECTION (merged) — purchase only ── */}
 {!isRefi && <>
 <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${T.blue}40, transparent)`, margin: "20px 0 8px" }} />
 <div style={{ marginTop: 12 }}>
  <Hero value="target" label="What Can I Afford?" color={T.green} sub="Reverse-engineer your max purchase price" />
 </div>
 {calc.qualifyingIncome > 0 && (
  <div style={{ background: `${T.green}10`, border: `1px solid ${T.green}22`, borderRadius: 12, padding: "10px 14px", marginBottom: 12 }}>
   <div style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>✓ Auto-populated from your calculator data</div>
   <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>Income, debts, rate, term & loan type pulled in. You can override any field below.</div>
  </div>
 )}
 {(() => {
  const confLimit = getHighBalLimit(propType);
  // Program-default max DTI (Target DTI input was removed — use the loan program's max).
  const programDTI = affordLoanType === "FHA" ? 56.99 : affordLoanType === "VA" ? 60 : affordLoanType === "Jumbo" ? 43 : 50;
  const maxHousingPayment = affordIncome * (programDTI / 100) - affordDebts;
  if (maxHousingPayment <= 0) return <Card><div style={{ textAlign: "center", padding: 20, color: T.red, fontWeight: 600 }}>Your debts exceed your target DTI at this income level. Reduce debts or increase income.</div></Card>;
  const r = (affordRate / 100) / 12;
  const n = affordTerm * 12;
  // Dynamic loan program: if loan > conforming limit, switch to Jumbo rules
  const getProgram = (price, dpAmt) => {
   const loan = price - dpAmt;
   const isJumbo = loan > confLimit && affordLoanType !== "Jumbo";
   if (isJumbo || affordLoanType === "Jumbo") return { type: "Jumbo", minDPpct: 20, maxDTI: 43, fhaUp: 0, vaFF: 0, miRate: 0 };
   if (affordLoanType === "FHA") return { type: "FHA", minDPpct: 3.5, maxDTI: 56.99, fhaUp: 0.0175, vaFF: 0, miRate: 0.0055 };
   if (affordLoanType === "VA") return { type: "VA", minDPpct: 0, maxDTI: 60, fhaUp: 0, vaFF: 0.023, miRate: 0 };
   return { type: "Conventional", minDPpct: 5, maxDTI: 50, fhaUp: 0, vaFF: 0, miRate: 0 };
  };
  const calcPmt = (price) => {
   // First pass: estimate DP with base program
   const baseProg = getProgram(price, Math.min(affordDown, price));
   const reqDP = price * baseProg.minDPpct / 100;
   if (baseProg.minDPpct > 0 && affordDown < reqDP) return null;
   const dp = Math.min(affordDown, price);
   const loan = price - dp;
   // Re-check program with actual loan amount
   const prog = getProgram(price, dp);
   const progReqDP = price * prog.minDPpct / 100;
   if (prog.minDPpct > 0 && affordDown < progReqDP) return null;
   const actualDP = Math.max(dp, progReqDP);
   const actualLoan = price - actualDP;
   const ltv = price > 0 ? actualLoan / price : 0;
   const fhaUp = prog.fhaUp * actualLoan;
   const vaFF = prog.vaFF * actualLoan;
   const totalLoan = actualLoan + fhaUp + vaFF;
   const pi = r > 0 ? totalLoan * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : totalLoan / n;
   const tax = price * 0.0125 / 12;
   const ins = Math.max(1200, price * 0.0035) / 12;
   let mi = 0;
   if (prog.type === "FHA") mi = totalLoan * prog.miRate / 12;
   else if (prog.type !== "VA" && prog.type !== "Jumbo" && ltv > 0.8) mi = totalLoan * 0.005 / 12;
   const maxPmt = affordIncome * (prog.maxDTI / 100) - affordDebts;
   return { dp: actualDP, loan: actualLoan, totalLoan, ltv, pi, tax, ins, mi, fhaUp, vaFF, total: pi + tax + ins + mi, prog, maxPmt, isJumbo: prog.type === "Jumbo" && affordLoanType !== "Jumbo" };
  };
  // Binary search: max price where total payment fits within the program's DTI limit
  const jumboDPmax = Math.floor(affordDown / 0.20);
  const baseDPpct = affordLoanType === "VA" ? 0 : affordLoanType === "FHA" ? 3.5 : affordLoanType === "Conventional" ? 5 : 20;
  const baseDPmax = baseDPpct > 0 ? Math.floor(affordDown / (baseDPpct / 100)) : 20000000;
  let lo = 0, hi = Math.min(Math.max(baseDPmax, jumboDPmax), 20000000);
  for (let i = 0; i < 80; i++) {
   const mid = Math.round((lo + hi) / 2);
   const pmt = calcPmt(mid);
   if (!pmt || pmt.total > pmt.maxPmt) hi = mid;
   else lo = mid;
   if (hi - lo < 500) break;
  }
  let maxPrice = Math.floor(lo / 1000) * 1000;
  if (maxPrice < 10000) maxPrice = 0;
  const result = calcPmt(maxPrice);
  if (!result) return <Card><div style={{ textAlign: "center", padding: 20, color: T.red, fontWeight: 600 }}>Not enough cash for minimum down payment at any viable price.</div></Card>;
  const { dp: actualDP, pi, tax, ins, mi, ltv, loan: loanAmt, totalLoan, fhaUp, vaFF, prog: finalProg, isJumbo: hitsJumbo } = result;
  const totalPmt = result.total;
  const dpPct = maxPrice > 0 ? (actualDP / maxPrice * 100) : 0;
  const actualDTI = affordIncome > 0 ? (totalPmt + affordDebts) / affordIncome : 0;
  // Also find max conforming price (before Jumbo kicks in)
  let maxConfPrice = 0;
  if (hitsJumbo) {
   let cLo = 0, cHi = Math.min(baseDPmax, 20000000);
   for (let i = 0; i < 80; i++) {
    const mid = Math.round((cLo + cHi) / 2);
    const dp2 = Math.min(affordDown, mid);
    const loan2 = mid - dp2;
    if (loan2 > confLimit) { cHi = mid; continue; }
    const pmt = calcPmt(mid);
    if (!pmt || pmt.total > (affordIncome * (programDTI / 100) - affordDebts)) cHi = mid;
    else cLo = mid;
    if (cHi - cLo < 500) break;
   }
   maxConfPrice = Math.floor(cLo / 1000) * 1000;
  }
  return (<>
   <Sec title="Your Maximum Purchase Price">
    <Card style={{ background: `linear-gradient(135deg, ${T.green}15, ${T.blue}10)`, border: `1px solid ${T.green}30` }}>
     <div style={{ textAlign: "center", padding: "10px 0" }}>
      <div style={{ fontSize: 11, color: T.textTertiary, textTransform: "uppercase", letterSpacing: 1 }}>You Can Afford Up To</div>
      <div style={{ fontSize: 36, fontWeight: 800, color: T.green, fontFamily: FONT, margin: "6px 0" }}>{fmt(maxPrice)}</div>
      <div style={{ fontSize: 13, color: T.textSecondary }}>with {fmt(actualDP)} down ({dpPct.toFixed(1)}%) · {fmt(loanAmt)} loan</div>
      {hitsJumbo && (
       <div style={{ marginTop: 8, padding: "8px 14px", background: `${T.orange}12`, borderRadius: 10, display: "inline-block" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.orange }}>⚠ Jumbo Loan Territory</div>
        <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>Loan exceeds {fmt(confLimit)} high-balance limit — requires 20% down + 43% max DTI</div>
       </div>
      )}
     </div>
    </Card>
    {hitsJumbo && maxConfPrice > 0 && (
     <Card style={{ marginTop: 8, background: `${T.blue}08` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
       <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.blue }}>Max Before Jumbo</div>
        <div style={{ fontSize: 11, color: T.textTertiary }}>Stay under {fmt(confLimit)} high-balance limit · {affordLoanType} guidelines</div>
       </div>
       <div style={{ fontSize: 18, fontWeight: 700, color: T.blue, fontFamily: FONT }}>{fmt(maxConfPrice)}</div>
      </div>
     </Card>
    )}
   </Sec>
   <div id="qualify-details" />
   {/* "Estimated Monthly Payment" block removed per Christo — the new Debt to Income
       Summary at the top of Qualify covers the same data with the spreadsheet layout. */}
   <Sec title="Quick Scenarios">
    <Card>
     {[
      { label: "Conservative (36% DTI)", dti: 36 },
      { label: "Standard (43% DTI)", dti: 43 },
      { label: "Stretch (50% DTI)", dti: 50 },
     ].map((sc, si) => {
      const mhp = affordIncome * (sc.dti / 100) - affordDebts;
      if (mhp <= 0) return null;
      let qLo = 0, qHi = Math.min(Math.max(baseDPmax, jumboDPmax), 20000000);
      for (let i = 0; i < 80; i++) {
       const mid = Math.round((qLo + qHi) / 2);
       const pmt = calcPmt(mid);
       // Use the lower of scenario DTI and program max DTI
       const effMaxPmt = affordIncome * (Math.min(sc.dti, pmt ? (pmt.prog.type === "Jumbo" ? 43 : sc.dti) : sc.dti) / 100) - affordDebts;
       if (!pmt || pmt.total > effMaxPmt) qHi = mid;
       else qLo = mid;
       if (qHi - qLo < 500) break;
      }
      const qPrice = Math.floor(qLo / 1000) * 1000;
      const qResult = calcPmt(qPrice);
      if (!qResult || qPrice < 10000) return null;
      const isQJumbo = qResult.isJumbo;
      return (
       <div key={si} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: si < 2 ? `1px solid ${T.separator}` : "none" }}>
        <div>
         <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{sc.label}</div>
         <div style={{ fontSize: 11, color: T.textTertiary }}>Max housing: {fmt(mhp)}/mo · Pmt: {fmt(qResult.total)}/mo{isQJumbo ? " · Jumbo" : ""}</div>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: sc.dti <= 43 ? T.green : sc.dti <= 50 ? T.orange : T.red, fontFamily: FONT }}>{fmt(qPrice)}</div>
       </div>
      );
     })}
    </Card>
   </Sec>
   <Card style={{ marginTop: 8 }}>
    <div style={{ textAlign: "center", padding: 8 }}>
     {!confirmAffordApply ? (
      <button onClick={() => setConfirmAffordApply(true)}
       style={{ background: T.blue, color: "#FFF", border: "none", borderRadius: 12, padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
       Apply to Calculator →
      </button>
     ) : (
      <div>
       <div style={{ fontSize: 13, fontWeight: 600, color: T.orange, marginBottom: 10 }}>This will overwrite your current calculator inputs:</div>
       <div style={{ textAlign: "left", background: T.pillBg, borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12, lineHeight: 1.8, color: T.textSecondary }}>
        <div>Purchase Price: {fmt(salesPrice)} → <strong style={{ color: T.text }}>{fmt(maxPrice)}</strong></div>
        <div>Down Payment: {downPct}% → <strong style={{ color: T.text }}>{Math.round(dpPct)}%</strong></div>
        <div>Rate: {rate}% → <strong style={{ color: T.text }}>{affordRate}%</strong></div>
        <div>Term: {term}yr → <strong style={{ color: T.text }}>{affordTerm}yr</strong></div>
        <div>Loan Type: {loanType} → <strong style={{ color: hitsJumbo ? T.orange : T.text }}>{hitsJumbo ? "Jumbo" : affordLoanType}</strong>{hitsJumbo ? <span style={{ fontSize: 10, color: T.orange }}> (auto-switched)</span> : null}</div>
       </div>
       <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button onClick={() => setConfirmAffordApply(false)}
         style={{ background: T.pillBg, color: T.textSecondary, border: `1px solid ${T.separator}`, borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Cancel</button>
        <button onClick={() => { setSalesPrice(maxPrice); setDownPct(Math.round(dpPct)); setRate(affordRate); setTerm(affordTerm); const effType = hitsJumbo ? "Jumbo" : affordLoanType; setLoanType(effType); userLoanTypeRef.current = effType; setAutoJumboSwitch(false); setConfirmAffordApply(false); setTab("calc"); }}
         style={{ background: T.green, color: "#FFF", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Confirm & Apply</button>
       </div>
      </div>
     )}
     <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 8 }}>Sets purchase price, down payment, rate & term on the Calculator tab</div>
    </div>
   </Card>
  </>);
 })()}
 </>}
 </div>{/* end qualify right column */}
 </div>{/* end qualify desktop flex wrapper */}
 <GuidedNextButton />
</>);
}
