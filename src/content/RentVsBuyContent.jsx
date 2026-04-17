import React from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

export default function RentVsBuyContent({
  T, isDesktop, calc, fmt, rbCalc,
  rbCurrentRent, setRbCurrentRent,
  rbRentGrowth, setRbRentGrowth,
  rbInvestReturn, setRbInvestReturn,
  Hero, Card, Sec, Inp, Note, MRow,
  GuidedNextButton,
}) {
  return (<>
 <div style={isDesktop ? { display: "flex", gap: 24, marginTop: 20, alignItems: "flex-start" } : {}}>
 {/* LEFT: Hero + Summary (sticky) */}
 <div style={isDesktop ? { position: "sticky", top: 90, width: "50%", flexShrink: 0, maxHeight: "calc(100vh - 110px)", overflowY: "auto" } : {}}>
 <div style={isDesktop ? { marginBottom: 16 } : { marginTop: 20, marginBottom: 16 }}>
  <Hero value={rbCalc.breakEvenYear ? `Year ${rbCalc.breakEvenYear}` : "—"} label="Break-even Point" color={T.blue} sub="When buying beats renting" />
 </div>
 <Sec title="Your Renting Costs">
  <Card>
   <Inp label="Current Monthly Rent" value={rbCurrentRent} onChange={setRbCurrentRent} />
   <Inp label="Annual Rent Increase" value={rbRentGrowth} onChange={setRbRentGrowth} prefix="" suffix="%" />
   <Inp label="Investment Return (if renting)" value={rbInvestReturn} onChange={setRbInvestReturn} prefix="" suffix="%" max={100} />
   <Note>If you rent, your down payment + closing costs ({fmt(calc.cashToClose)}) could be invested at {rbInvestReturn}% instead.</Note>
  </Card>
 </Sec>
 <Sec title="Monthly Cost Comparison">
  <Card>
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
    <div style={{ background: T.pillBg, borderRadius: 12, padding: "14px", textAlign: "center" }}>
     <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 4 }}>RENTING</div>
     <div style={{ fontSize: 22, fontWeight: 700, color: T.red, fontFamily: FONT }}>{fmt(rbCurrentRent)}</div>
     <div style={{ fontSize: 11, color: T.textTertiary }}>per month today</div>
    </div>
    <div style={{ background: T.pillBg, borderRadius: 12, padding: "14px", textAlign: "center" }}>
     <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 4 }}>BUYING</div>
     <div style={{ fontSize: 22, fontWeight: 700, color: T.blue, fontFamily: FONT }}>{fmt(calc.housingPayment)}</div>
     <div style={{ fontSize: 11, color: T.textTertiary }}>PITI + HOA</div>
    </div>
   </div>
   <div style={{ background: T.pillBg, borderRadius: 12, padding: "12px", textAlign: "center" }}>
    <div style={{ fontSize: 13, color: T.textSecondary }}>Buying is <strong style={{ color: calc.housingPayment > rbCurrentRent ? T.red : T.green }}>{fmt(Math.abs(calc.housingPayment - rbCurrentRent))}/mo {calc.housingPayment > rbCurrentRent ? "more" : "less"}</strong> than renting today</div>
   </div>
  </Card>
 </Sec>
 <Sec title="But Buying Builds Wealth">
  <Card>
   <MRow label="Monthly Tax Savings" value={fmt(calc.monthlyTaxSavings)} />
   <MRow label="Monthly Principal Paydown" value={fmt(calc.monthlyPrinReduction)} />
   <MRow label="Monthly Appreciation" value={fmt(calc.monthlyAppreciation)} />
   <div style={{ borderTop: `1px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
    <MRow label="True Net Cost of Buying" value={fmt(calc.housingPayment - calc.monthlyTaxSavings - calc.monthlyPrinReduction - calc.monthlyAppreciation)} bold />
    <MRow label="True Net Cost of Renting" value={fmt(rbCurrentRent)} bold />
   </div>
   {(calc.housingPayment - calc.monthlyTaxSavings - calc.monthlyPrinReduction - calc.monthlyAppreciation) < rbCurrentRent && (
    <Note color={T.green}>When you factor in tax savings, equity, and appreciation, buying is actually <strong>cheaper</strong> than renting!</Note>
   )}
  </Card>
 </Sec>
 </div>{/* end rentvbuy left column */}
 {/* RIGHT: Tables & details (scrollable) */}
 <div style={isDesktop ? { width: "50%", flexShrink: 0, minWidth: 0, overflow: "hidden" } : {}}>
 <Sec title="Wealth Comparison Over Time">
  <Card>
   <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
     <thead>
      <tr style={{ borderBottom: `2px solid ${T.separator}` }}>
       {["Year","Rent/mo","Home Value","Equity","Renter $","Advantage"].map(h => (
        <th key={h} style={{ padding: "6px 4px", textAlign: "right", color: T.textTertiary, fontWeight: 600, fontSize: 11 }}>{h}</th>
       ))}
      </tr>
     </thead>
     <tbody>
      {rbCalc.data.filter(d => [1,2,3,5,7,10,15,20,25,30].includes(d.yr)).map(d => {
       const adv = d.buyerNet - d.renterNet;
       return (
       <tr key={d.yr} style={{ borderBottom: `1px solid ${T.separator}`, background: d.yr === rbCalc.breakEvenYear ? "rgba(52,199,89,0.1)" : "transparent" }}>
        <td style={{ padding: "6px 4px", fontWeight: d.yr === rbCalc.breakEvenYear ? 700 : 400 }}>{d.yr}{d.yr === rbCalc.breakEvenYear ? " ★" : ""}</td>
        <td style={{ padding: "6px 4px", textAlign: "right" }}>{fmt(d.rentMo)}</td>
        <td style={{ padding: "6px 4px", textAlign: "right" }}>{fmt(d.homeVal, true)}</td>
        <td style={{ padding: "6px 4px", textAlign: "right", color: T.green }}>{fmt(d.equity, true)}</td>
        <td style={{ padding: "6px 4px", textAlign: "right" }}>{fmt(d.renterWealth, true)}</td>
        <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: 600, color: adv >= 0 ? T.green : T.red }}>{adv >= 0 ? "+" : ""}{fmt(adv, true)}</td>
       </tr>
      );})}
     </tbody>
    </table>
   </div>
   {rbCalc.breakEvenYear && (
    <Note color={T.green}>★ Buying overtakes renting at <strong>Year {rbCalc.breakEvenYear}</strong>. After that, homeownership pulls further and further ahead.</Note>
   )}
  </Card>
 </Sec>
 <Sec title="Snapshot Comparison">
  <Card>
   {[
    ["5 Years", rbCalc.yr5],
    ["10 Years", rbCalc.yr10],
    ["30 Years", rbCalc.yr30],
   ].map(([label, d], i) => { const adv = (d.buyerNet || 0) - (d.renterNet || 0); return (
    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < 2 ? `1px solid ${T.separator}` : "none" }}>
     <div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 12, color: T.textTertiary }}>Home: {fmt(d.homeVal || 0)} · Equity: {fmt(d.equity || 0)}</div>
     </div>
     <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: adv >= 0 ? T.green : T.red, fontFamily: FONT }}>{adv >= 0 ? "+" : ""}{fmt(adv)}</div>
      <div style={{ fontSize: 11, color: T.textTertiary }}>{adv >= 0 ? "Buy wins" : "Rent wins"}</div>
     </div>
    </div>
   );})}
  </Card>
 </Sec>
 <Sec title="The Hidden Costs of Renting">
  <Card>
   <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.7 }}>
    <p style={{ margin: "0 0 10px 0" }}>Rent increases by ~{rbRentGrowth}% per year. Your {fmt(rbCurrentRent)}/mo rent becomes <strong>{fmt(Math.round(rbCurrentRent * Math.pow(1 + rbRentGrowth / 100, 10)))}/mo in 10 years</strong> and <strong>{fmt(Math.round(rbCurrentRent * Math.pow(1 + rbRentGrowth / 100, 30)))}/mo in 30 years</strong>.</p>
    <p style={{ margin: "0 0 10px 0" }}>Meanwhile, a fixed-rate mortgage payment of {fmt(calc.pi)}/mo <strong>never changes</strong> for 30 years.</p>
    <p style={{ margin: 0 }}>Over 30 years, you'll pay <strong>{fmt(Math.round(rbCalc.data.reduce((s, d) => s + d.annualRentCost, 0)))}</strong> in total rent — and own nothing. Or you'll pay into a home that could be worth <strong>{fmt(rbCalc.yr30.homeVal || 0)}</strong>.</p>
   </div>
  </Card>
 </Sec>
 <Card style={{ background: T.pillBg, marginTop: 8 }}>
  <div style={{ fontSize: 12, color: T.textTertiary, lineHeight: 1.6, textAlign: "center" }}>
   Rent vs Buy analysis available for First-Time Homebuyers. Adjust assumptions above. Tax savings use your data from the Tax Savings tab.
  </div>
 </Card>
 </div>{/* end rentvbuy right column */}
 </div>{/* end rentvbuy desktop flex wrapper */}
 <GuidedNextButton />
</>);
}
