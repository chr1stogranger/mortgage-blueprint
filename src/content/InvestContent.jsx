import React from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

export default function InvestContent({
  T, isDesktop, calc, fmt, invCalc,
  invMonthlyRent, setInvMonthlyRent,
  invVacancy, setInvVacancy,
  invRentGrowth, setInvRentGrowth,
  invMgmt, setInvMgmt,
  invMaintPct, setInvMaintPct,
  invCapEx, setInvCapEx,
  hoa,
  invHoldYears, setInvHoldYears,
  invSellerComm, setInvSellerComm,
  invSellClosing, setInvSellClosing,
  appreciationRate, setAppreciationRate,
  Hero, Card, Sec, Inp, MRow, GuidedNextButton,
}) {
  return (<>
 <div style={isDesktop ? { display: "flex", gap: 24, marginTop: 20, alignItems: "flex-start" } : {}}>
 {/* LEFT: Hero + Inputs (sticky) */}
 <div style={isDesktop ? { position: "sticky", top: 90, width: "50%", flexShrink: 0, maxHeight: "calc(100vh - 110px)", overflowY: "auto" } : {}}>
 <div style={isDesktop ? { marginBottom: 16 } : { marginTop: 20, marginBottom: 16 }}>
  <Hero value={fmt(invCalc.monthlyCashFlow)} label="Monthly Cash Flow" color={invCalc.monthlyCashFlow >= 0 ? T.green : T.red} sub={`Cap Rate: ${invCalc.capRate.toFixed(2)}% · CoC: ${invCalc.cashOnCash.toFixed(1)}%`} />
 </div>
 <Sec title="Rental Income">
  <Card>
   <Inp label="Monthly Rent" value={invMonthlyRent} onChange={setInvMonthlyRent} />
   <Inp label="Vacancy Rate" value={invVacancy} onChange={setInvVacancy} prefix="" suffix="%" max={100} />
   <Inp label="Annual Rent Growth" value={invRentGrowth} onChange={setInvRentGrowth} prefix="" suffix="%" max={50} />
   <MRow label="Effective Gross Income" value={fmt(invCalc.egi) + "/yr"} />
  </Card>
 </Sec>
 <Sec title="Operating Expenses">
  <Card>
   <Inp label="Property Mgmt" value={invMgmt} onChange={setInvMgmt} prefix="" suffix="% of EGI" max={100} />
   <Inp label="Maintenance" value={invMaintPct} onChange={setInvMaintPct} prefix="" suffix="% of value" max={20} />
   <Inp label="CapEx Reserve" value={invCapEx} onChange={setInvCapEx} prefix="" suffix="% of value" max={20} />
   <MRow label="Property Taxes" value={fmt(invCalc.annualTax) + "/yr"} />
   <MRow label="Insurance" value={fmt(invCalc.annualIns) + "/yr"} />
   {hoa > 0 && <MRow label="HOA" value={fmt(invCalc.annualHOA) + "/yr"} />}
   <MRow label="Mgmt Fee" value={fmt(invCalc.annualMgmt) + "/yr"} />
   <MRow label="Maintenance" value={fmt(invCalc.annualMaint) + "/yr"} />
   <MRow label="CapEx Reserve" value={fmt(invCalc.annualCapEx) + "/yr"} />
   <div style={{ borderTop: `1px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
    <MRow label="Total Operating Expenses" value={fmt(invCalc.totalOpEx) + "/yr"} bold />
    <MRow label="OpEx Ratio" value={invCalc.opExRatio.toFixed(1) + "%"} />
   </div>
  </Card>
 </Sec>
 </div>{/* end invest left column */}
 {/* RIGHT: Analysis (scrollable) */}
 <div style={isDesktop ? { width: "50%", flexShrink: 0, minWidth: 0 } : {}}>
 <Sec title="Key Metrics">
  <Card>
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
    {[
     ["NOI", fmt(invCalc.noi) + "/yr", invCalc.noi >= 0 ? T.green : T.red],
     ["Cap Rate", invCalc.capRate.toFixed(2) + "%", invCalc.capRate >= 5 ? T.green : invCalc.capRate >= 3 ? T.orange : T.red],
     ["Cash-on-Cash", invCalc.cashOnCash.toFixed(1) + "%", invCalc.cashOnCash >= 8 ? T.green : invCalc.cashOnCash >= 4 ? T.orange : T.red],
     ["DSCR", invCalc.dscr.toFixed(2) + "x", invCalc.dscr >= 1.25 ? T.green : invCalc.dscr >= 1.0 ? T.orange : T.red],
     ["GRM", invCalc.grm.toFixed(1) + " yrs", invCalc.grm <= 15 ? T.green : invCalc.grm <= 20 ? T.orange : T.red],
     ["Monthly CF", fmt(invCalc.monthlyCashFlow), invCalc.monthlyCashFlow >= 0 ? T.green : T.red],
    ].map(([label, val, color], i) => (
     <div key={i} style={{ background: T.pillBg, borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: FONT }}>{val}</div>
      <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>{label}</div>
     </div>
    ))}
   </div>
  </Card>
 </Sec>
 <Sec title="Quick Rules">
  <Card>
   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.separator}` }}>
    <div>
     <div style={{ fontSize: 14, fontWeight: 600 }}>1% Rule</div>
     <div style={{ fontSize: 12, color: T.textTertiary }}>Monthly rent ≥ 1% of purchase price</div>
    </div>
    <div style={{ fontSize: 14, fontWeight: 700, color: invCalc.onePercentPass ? T.green : T.red }}>
     {invCalc.onePercentRule.toFixed(2)}% {invCalc.onePercentPass ? "✓" : "✗"}
    </div>
   </div>
   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.separator}` }}>
    <div>
     <div style={{ fontSize: 14, fontWeight: 600 }}>DSCR ≥ 1.25x</div>
     <div style={{ fontSize: 12, color: T.textTertiary }}>Lender threshold for DSCR loans</div>
    </div>
    <div style={{ fontSize: 14, fontWeight: 700, color: invCalc.dscr >= 1.25 ? T.green : T.red }}>
     {invCalc.dscr.toFixed(2)}x {invCalc.dscr >= 1.25 ? "✓" : "✗"}
    </div>
   </div>
   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
    <div>
     <div style={{ fontSize: 14, fontWeight: 600 }}>Break-even Occupancy</div>
     <div style={{ fontSize: 12, color: T.textTertiary }}>Min occupancy to cover all costs</div>
    </div>
    <div style={{ fontSize: 14, fontWeight: 700, color: invCalc.breakEvenOcc <= 85 ? T.green : invCalc.breakEvenOcc <= 95 ? T.orange : T.red }}>
     {invCalc.breakEvenOcc.toFixed(1)}%
    </div>
   </div>
  </Card>
 </Sec>
 <Sec title="Cash Flow Breakdown">
  <Card>
   <MRow label="Gross Rent" value={fmt(invCalc.annualRent) + "/yr"} />
   <MRow label="− Vacancy" value={"(" + fmt(invCalc.vacancyLoss) + ")"} />
   <MRow label="= EGI" value={fmt(invCalc.egi)} bold />
   <MRow label="− Operating Expenses" value={"(" + fmt(invCalc.totalOpEx) + ")"} />
   <MRow label="= NOI" value={fmt(invCalc.noi)} bold />
   <MRow label="− Debt Service (P&I)" value={"(" + fmt(invCalc.annualDebt) + ")"} />
   {calc.monthlyMI > 0 && <MRow label="− Mortgage Insurance" value={"(" + fmt(calc.monthlyMI * 12) + ")"} />}
   <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
    <MRow label="Annual Cash Flow" value={fmt(invCalc.annualCashFlow)} bold />
    <MRow label="Monthly Cash Flow" value={fmt(invCalc.monthlyCashFlow)} />
   </div>
  </Card>
 </Sec>
 <Sec title="Exit Strategy">
  <Card>
   <Inp label="Hold Period" value={invHoldYears} onChange={setInvHoldYears} prefix="" suffix="years" max={50} />
   <Inp label="Seller Commission" value={invSellerComm} onChange={setInvSellerComm} prefix="" suffix="%" max={20} />
   <Inp label="Selling Costs" value={invSellClosing} onChange={setInvSellClosing} prefix="" suffix="% of sale" />
   <Inp label="Appreciation" value={appreciationRate} onChange={setAppreciationRate} prefix="" suffix="%/yr" />
  </Card>
 </Sec>
 {invCalc.projections.length > 1 && (
 <Sec title={`${invHoldYears}-Year Projection`}>
  <Card>
   {(() => { const p = invCalc.projections[invHoldYears] || invCalc.projections[invCalc.projections.length - 1]; return (<>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
     {[
      ["Sale Price", fmt(p.value), T.blue],
      ["Net Proceeds", fmt(p.saleNet), T.green],
      ["Total Cash Flow", fmt(p.cumCashFlow), p.cumCashFlow >= 0 ? T.green : T.red],
      ["Total Return", fmt(p.totalReturn), p.totalReturn >= 0 ? T.green : T.red],
      ["Return on Cash", p.totalReturnPct.toFixed(1) + "%", p.totalReturnPct >= 0 ? T.green : T.red],
      ["IRR", p.irr.toFixed(1) + "%", p.irr >= 10 ? T.green : p.irr >= 5 ? T.orange : T.red],
     ].map(([l, v, c], i) => (
      <div key={i} style={{ background: T.pillBg, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
       <div style={{ fontSize: 17, fontWeight: 700, color: c, fontFamily: FONT }}>{v}</div>
       <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>{l}</div>
      </div>
     ))}
    </div>
   </>);})()}
   <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
     <thead>
      <tr style={{ borderBottom: `2px solid ${T.separator}` }}>
       {["Yr","Value","Equity","NOI","Cash Flow","Cum CF","IRR"].map(h => (
        <th key={h} style={{ padding: "6px 4px", textAlign: "right", color: T.textTertiary, fontWeight: 600, fontSize: 11 }}>{h}</th>
       ))}
      </tr>
     </thead>
     <tbody>
      {invCalc.projections.filter(p => p.yr > 0).map(p => (
       <tr key={p.yr} style={{ borderBottom: `1px solid ${T.separator}`, background: p.yr === invHoldYears ? T.pillBg : "transparent" }}>
        <td style={{ padding: "6px 4px", fontWeight: p.yr === invHoldYears ? 700 : 400 }}>{p.yr}</td>
        <td style={{ padding: "6px 4px", textAlign: "right" }}>{fmt(p.value, true)}</td>
        <td style={{ padding: "6px 4px", textAlign: "right" }}>{fmt(p.equity, true)}</td>
        <td style={{ padding: "6px 4px", textAlign: "right", color: p.noi >= 0 ? T.green : T.red }}>{fmt(p.noi, true)}</td>
        <td style={{ padding: "6px 4px", textAlign: "right", color: p.cashFlow >= 0 ? T.green : T.red }}>{fmt(p.cashFlow, true)}</td>
        <td style={{ padding: "6px 4px", textAlign: "right", color: p.cumCashFlow >= 0 ? T.green : T.red }}>{fmt(p.cumCashFlow, true)}</td>
        <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: 600, color: p.irr >= 10 ? T.green : p.irr >= 5 ? T.orange : T.red }}>{p.irr.toFixed(1)}%</td>
       </tr>
      ))}
     </tbody>
    </table>
   </div>
  </Card>
 </Sec>
 )}
 <Card style={{ background: T.pillBg, marginTop: 8 }}>
  <div style={{ fontSize: 12, color: T.textTertiary, lineHeight: 1.6, textAlign: "center" }}>
   Investment analysis uses current loan terms from Calculator tab. Adjust purchase price, down payment, and rate there. Toggle this module in Settings → Modules.
  </div>
 </Card>
 </div>{/* end invest right column */}
 </div>{/* end invest desktop flex wrapper */}
 <GuidedNextButton />
</>);
}
