import React from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

export default function QualifyContent({
  T, isDesktop, calc, fmt, pct,
  isRefi, loanType, firstTimeBuyer, downPct, setDownPct,
  creditScore, setCreditScore,
  refiPurpose, refiLtvCheck,
  allGood, someGood, refiPillarCount, purchPillarCount,
  setTab, handlePillarClick,
  isPulse, isTabUnlocked,
  affordIncome, affordDebts, affordDown,
  affordTerm, affordRate, affordLoanType,
  affordTargetDTI, setAffordTargetDTI,
  debts, debtFree,
  salesPrice, setSalesPrice, rate, setRate, term, setTerm,
  setLoanType, userLoanTypeRef, setAutoJumboSwitch,
  confirmAffordApply, setConfirmAffordApply,
  getHighBalLimit, propType,
  StopLight, Card, Sec, Inp, Note, Progress, Hero, MRow,
  GuidedNextButton,
}) {
  return (<>

 <div style={{ marginTop: 20 }}>
  <StopLight onPillarClick={handlePillarClick} checks={isRefi ? [
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
 {/* Progress bar - how many pillars cleared */}
 <Card pad={14}>
  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
   <span style={{ fontSize: 12, fontWeight: 600, color: T.textTertiary }}>Approval Progress</span>
   <span style={{ fontSize: 12, fontWeight: 700, color: allGood ? T.green : someGood ? T.orange : T.textTertiary, fontFamily: FONT }}>{isRefi ? refiPillarCount : purchPillarCount} / {isRefi ? 3 : 5}</span>
  </div>
  <div style={{ height: 12, background: T.ringTrack, borderRadius: 99, overflow: "hidden" }}>
   <div style={{ height: "100%", width: `${(isRefi ? refiPillarCount / 3 : purchPillarCount / 5) * 100}%`, background: allGood ? T.green : someGood ? T.orange : T.ringTrack, borderRadius: 99, transition: "all 0.6s ease" }} />
  </div>
 </Card>
 <div style={isDesktop ? { display: "flex", gap: 24, alignItems: "flex-start" } : {}}>
 {/* ── LEFT: StopLight pillars stay above, FICO section ── */}
 <div style={isDesktop ? { position: "sticky", top: 90, width: "50%", flexShrink: 0, maxHeight: "calc(100vh - 110px)", overflowY: "auto" } : {}}>
 <Sec title="Credit Score">
  <div data-field="qualify-fico" className={isPulse("qualify-fico")} style={{ borderRadius: 18, transition: "all 0.3s" }}>
  <Card>
   <Inp label="Middle FICO Score" value={creditScore} onChange={setCreditScore} prefix="" suffix="pts" min={300} max={850} step={1} req tip="Your middle credit score from the 3 bureaus (Equifax, Experian, TransUnion). Lenders use the middle score, not the highest or lowest." />
   {creditScore > 0 && creditScore < calc.ficoMin && <Note color={T.red}>Min score for {loanType}: <strong>{calc.ficoMin}</strong>. Need {calc.ficoMin - creditScore} more points.</Note>}
   {creditScore >= 740 && <Note color={T.green}>Excellent credit — qualifies for best pricing!</Note>}
   {creditScore >= calc.ficoMin && creditScore < 740 && <Note color={T.orange}>Meets minimum. 740+ unlocks better pricing tiers.</Note>}
  </Card>
  </div>
 </Sec>
 {calc.qualifyingIncome > 0 && (
  <Card>
   <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 4 }}>DTI: {pct(calc.yourDTI, 1)} / {pct(calc.maxDTI, 0)}</div>
   <Progress value={calc.yourDTI} max={calc.maxDTI} color={calc.yourDTI <= calc.maxDTI ? T.green : T.red} height={10} />
   <Note>Min income needed: <strong style={{ color: T.text }}>{fmt(calc.totalPayment / calc.maxDTI)}/mo</strong></Note>
   {(calc.reoPositiveIncome > 0 || calc.reoNegativeDebt > 0) && <Note color={T.blue}>REO adjusted: {calc.reoPositiveIncome > 0 ? `+${fmt(calc.reoPositiveIncome)}/mo investment income` : ""}{calc.reoPositiveIncome > 0 && calc.reoNegativeDebt > 0 ? " · " : ""}{calc.reoNegativeDebt > 0 ? `+${fmt(calc.reoNegativeDebt)}/mo debt (${calc.reoPrimaryDebt > 0 ? "PITIA" : ""}${calc.reoPrimaryDebt > 0 && calc.reoInvestmentNet < 0 ? " + " : ""}${calc.reoInvestmentNet < 0 ? "inv. shortfall" : ""})` : ""}</Note>}
  </Card>
 )}
 {allGood && <Card style={{ marginTop: 12, background: `${T.green}15`, textAlign: "center", padding: 20 }}>
  <div style={{ fontSize: 40, marginBottom: 8 }}></div>
  <div style={{ fontSize: 20, fontWeight: 800, color: T.green, fontFamily: FONT }}>{isRefi ? "REFI QUALIFIED" : "PRE-QUALIFIED"}</div>
  <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 4 }}>{isRefi ? "All 3 pillars cleared — your refi looks good to go." : "All 5 pillars cleared — based on the information you provided."}</div>
  {isRefi ? (
   <button onClick={() => setTab("refi")} style={{ marginTop: 14, width: "100%", padding: "14px 20px", background: "linear-gradient(135deg, #4a90d9, #3a7dc4)", border: "none", borderRadius: 14, cursor: "pointer", boxShadow: "0 4px 16px rgba(74,144,217,0.35)" }}>
    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: FONT }}>View Refi Summary →</div>
    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>See your savings breakdown</div>
   </button>
  ) : (<>
  <div style={{ marginTop: 16, padding: "14px 16px", background: T.card, borderRadius: 12, textAlign: "left" }}>
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
  </>)}
 </Card>}
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
 <Sec title="Your Financial Picture">
  <Card>
   <div style={{ fontSize: 12, color: T.textTertiary, marginBottom: 10 }}>Auto-synced from your entries. Tap a row to edit in the source tab.</div>
   {[
    { label: "Monthly Gross Income", value: affordIncome, source: "Income", tab: "income", hasData: calc.qualifyingIncome > 0 },
    { label: "Total Monthly Debts", value: affordDebts, source: "Debts", tab: "debts", hasData: debtFree || (calc.totalMonthlyDebts + calc.reoNegativeDebt) > 0 || debts.length > 0, debtFreeNote: debtFree ? "✓ Debt free" : null },
    { label: "Cash for Down Payment", value: affordDown, source: "Assets", tab: "assets", hasData: calc.totalForClosing > 0 },
   ].map((row, i) => {
    const unlocked = isTabUnlocked(row.tab);
    return (
    <div key={i} onClick={() => unlocked && setTab(row.tab)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.separator}`, cursor: unlocked ? "pointer" : "default", opacity: unlocked ? 1 : 0.6 }}>
     <div>
      <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{row.label}</div>
      <div style={{ fontSize: 11, color: row.hasData ? T.green : unlocked ? T.orange : T.textTertiary, fontWeight: 500 }}>
       {row.hasData ? (row.debtFreeNote || `✓ From ${row.source} tab`) : unlocked ? `⚠ Enter in ${row.source} tab →` : `Unlock ${row.source} tab first`}
      </div>
     </div>
     <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT, color: row.hasData ? T.text : T.textTertiary }}>{row.value > 0 ? fmt(row.value) : row.hasData ? "$0" : "—"}</span>
      {unlocked && <span style={{ fontSize: 14, color: T.blue }}>›</span>}
     </div>
    </div>
    );
   })}
   <div style={{ marginTop: 12 }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
     <div>
      <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 4 }}>Rate · Term</div>
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: FONT }}>{affordRate}% · {affordTerm}yr</div>
      <div style={{ fontSize: 11, color: T.blue, cursor: "pointer", marginTop: 2 }} onClick={() => setTab("calc")}>From Calculator ›</div>
     </div>
     <div>
      <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 4 }}>Loan Type</div>
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: FONT }}>{affordLoanType}</div>
      <div style={{ fontSize: 11, color: T.blue, cursor: "pointer", marginTop: 2 }} onClick={() => setTab("setup")}>From Setup ›</div>
     </div>
    </div>
   </div>
   <div style={{ marginTop: 12 }}>
    <Inp label="Target DTI" value={affordTargetDTI} onChange={setAffordTargetDTI} prefix="" suffix="%" max={65} req tip="Max debt-to-income ratio for this loan type. This is all monthly debts (including new mortgage) divided by gross monthly income." />
    <div style={{ fontSize: 11, color: T.textTertiary, marginTop: -6, marginBottom: 4 }}>
     Max DTI: Conv 50% · FHA 56.99% · VA 60% · Jumbo 43%
     {(() => { const pgm = affordLoanType === "FHA" ? 56.99 : affordLoanType === "VA" ? 60 : affordLoanType === "Jumbo" ? 43 : 50; return pgm !== affordTargetDTI ? <span onClick={() => setAffordTargetDTI(pgm)} style={{ color: T.blue, cursor: "pointer", fontWeight: 600 }}> · Set to {pgm}%</span> : null; })()}
    </div>
   </div>
  </Card>
 </Sec>
 {(() => {
  const confLimit = getHighBalLimit(propType);
  const maxHousingPayment = affordIncome * (affordTargetDTI / 100) - affordDebts;
  if (maxHousingPayment <= 0) return <Card><div style={{ textAlign: "center", padding: 20, color: T.red, fontWeight: 600 }}>Your debts exceed your target DTI at this income level. Reduce debts or increase income.</div></Card>;
  const r = (affordRate / 100) / 12;
  const n = affordTerm * 12;
  // Dynamic loan program: if loan > conforming limit, switch to Jumbo rules
  const getProgram = (price, dpAmt) => {
   const loan = price - dpAmt;
   const isJumbo = loan > confLimit && affordLoanType !== "Jumbo";
   if (isJumbo || affordLoanType === "Jumbo") return { type: "Jumbo", minDPpct: 20, maxDTI: 43, fhaUp: 0, vaFF: 0, miRate: 0 };
   if (affordLoanType === "FHA") return { type: "FHA", minDPpct: 3.5, maxDTI: affordTargetDTI, fhaUp: 0.0175, vaFF: 0, miRate: 0.0055 };
   if (affordLoanType === "VA") return { type: "VA", minDPpct: 0, maxDTI: affordTargetDTI, fhaUp: 0, vaFF: 0.023, miRate: 0 };
   return { type: "Conventional", minDPpct: 5, maxDTI: affordTargetDTI, fhaUp: 0, vaFF: 0, miRate: 0 };
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
    if (!pmt || pmt.total > (affordIncome * (affordTargetDTI / 100) - affordDebts)) cHi = mid;
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
   <Sec title="Estimated Monthly Payment">
    <Card>
     {hitsJumbo && <div style={{ fontSize: 11, color: T.orange, fontWeight: 600, marginBottom: 8 }}>Calculated using Jumbo guidelines (auto-switched from {affordLoanType})</div>}
     <MRow label="Principal & Interest" value={fmt(pi)} />
     <MRow label="Property Tax (est.)" value={fmt(tax)} sub="~1.25% of value" />
     <MRow label="Insurance (est.)" value={fmt(ins)} sub="~0.35% of value" />
     {mi > 0 && <MRow label="Mortgage Insurance" value={fmt(mi)} sub={finalProg.type === "FHA" ? "FHA MIP 0.55%" : "PMI ~0.5%"} />}
     {fhaUp > 0 && <MRow label="FHA UFMIP (financed)" value={fmt(fhaUp)} sub="1.75% of base loan" />}
     {vaFF > 0 && <MRow label="VA Funding Fee (financed)" value={fmt(vaFF)} sub="2.3% of base loan" />}
     <MRow label="Total Housing Payment" value={fmt(totalPmt)} bold color={T.blue} />
     <MRow label="+ Existing Debts" value={fmt(affordDebts)} />
     <MRow label="Total Monthly Obligations" value={fmt(totalPmt + affordDebts)} bold />
     <div style={{ height: 1, background: T.separator, margin: "8px 0" }} />
     <MRow label="Your DTI" value={(actualDTI * 100).toFixed(1) + "%"} bold color={actualDTI <= (finalProg.maxDTI / 100) ? T.green : T.red} />
     <MRow label="Remaining Budget" value={fmt(Math.max(0, affordIncome - totalPmt - affordDebts))} color={T.green} />
    </Card>
   </Sec>
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
