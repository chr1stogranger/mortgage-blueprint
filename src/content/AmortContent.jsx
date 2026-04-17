import React from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

export default function AmortContent({
  T, isDesktop, calc, fmt,
  payExtra, setPayExtra, extraPayment, setExtraPayment,
  amortView, setAmortView,
  term, rate, salesPrice,
  appreciationRate, setAppreciationRate,
  isPulse, markTouched,
  Hero, Card, Inp, Tab, MRow, AmortChart,
  GuidedNextButton,
}) {
  return (<>
 <div style={isDesktop ? { display: "flex", gap: 24, marginTop: 20, alignItems: "flex-start" } : {}}>
 {/* ── LEFT: Hero + Summary + Chart (sticky on desktop) ── */}
 <div style={isDesktop ? { position: "sticky", top: 90, width: "50%", flexShrink: 0, maxHeight: "calc(100vh - 110px)", overflowY: "auto" } : {}}>
 <div style={isDesktop ? { marginBottom: 16 } : { marginTop: 20, marginBottom: 16 }}>
  <Hero value={fmt(calc.totalIntWithExtra)} label="Total Interest" color={T.blue} sub={calc.intSaved > 100 ? `Save ${fmt(calc.intSaved)}` : null} />
 </div>
 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: isDesktop ? "0 0 12px" : "16px 0" }}>
  <Card pad={14}>
   <div style={{ fontSize: 11, color: T.textTertiary, fontWeight: 500 }}>Payoff</div>
   <div style={{ fontSize: 22, fontWeight: 700, fontFamily: FONT, letterSpacing: "-0.03em" }}>{calc.amortSchedule.length} <span style={{ fontSize: 13, color: T.textTertiary }}>mo</span></div>
   {calc.monthsSaved > 0 && <div style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>{calc.monthsSaved} months saved</div>}
  </Card>
  <div data-field="amort-section" className={isPulse("amort-section")} onClick={() => markTouched("amort-section")} style={{ borderRadius: 14, transition: "all 0.3s" }}>
  <Card pad={14}>
   <div style={{ fontSize: 11, color: T.textTertiary, fontWeight: 500 }}>Extra Payment</div>
   <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
    <button onClick={() => { setPayExtra(!payExtra); markTouched("amort-section"); }} style={{ width: 44, height: 26, borderRadius: 13, background: payExtra ? T.green : T.ringTrack, border: "none", cursor: "pointer", position: "relative", transition: "background 0.3s" }}>
     <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#FFF", position: "absolute", top: 3, left: payExtra ? 21 : 3, transition: "left 0.3s" }} />
    </button>
   </div>
  </Card>
  </div>
 </div>
 {payExtra && <div data-field="amort-extra" className={isPulse("amort-extra")} style={{ borderRadius: 18, transition: "all 0.3s" }}><Card><Inp label="Monthly Extra Payment" value={extraPayment} onChange={setExtraPayment} tip="Additional principal paid each month beyond your required payment. Reduces total interest and shortens your loan term." /></Card></div>}
 {payExtra && calc.intSaved > 100 && (
  <Card style={{ background: T.successBg }}>
   <div style={{ fontSize: 13, fontWeight: 600, color: T.green, marginBottom: 4 }}>With Extra Payments</div>
   <MRow label="Interest Saved" value={fmt(calc.intSaved)} color={T.green} bold />
   <MRow label="Time Saved" value={`${calc.monthsSaved} months`} color={T.green} bold />
  </Card>
 )}
 <Card><AmortChart /></Card>
 </div>{/* end amort left column */}
 {/* ── RIGHT: Schedule table (scrollable on desktop) ── */}
 <div style={isDesktop ? { width: "50%", flexShrink: 0, minWidth: 0 } : {}}>
 <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
  {["monthly","yearly","equity"].map(v => <Tab key={v} label={v === "equity" ? "Equity" : v.charAt(0).toUpperCase() + v.slice(1)} active={amortView === v} onClick={() => setAmortView(v)} />)}
  <button onClick={() => {
   const rows = [["Month","Payment","Interest","Principal","Extra","Balance"]];
   calc.amortSchedule.forEach(d => rows.push([d.m, (d.int + d.prin + (d.extra||0)).toFixed(2), d.int.toFixed(2), d.prin.toFixed(2), (d.extra||0).toFixed(2), d.bal.toFixed(2)]));
   const csv = rows.map(r => r.join(",")).join("\n");
   const blob = new Blob([csv], { type: "text/csv" });
   const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `amortization-${term}yr-${rate}pct.csv`; a.click();
  }} style={{ background: "none", border: `1px solid ${T.separator}`, borderRadius: 10, padding: "6px 10px", fontSize: 11, color: T.textSecondary, cursor: "pointer", fontFamily: FONT, marginLeft: "auto" }}>
   ⬇ CSV
  </button>
 </div>
 {amortView === "yearly" && (
  <Card pad={12}>
   <div style={{ display: "grid", gridTemplateColumns: "0.7fr 1fr 1fr 1fr 1.2fr", gap: 0, fontSize: 11, color: T.textTertiary, fontWeight: 600, paddingBottom: 8, borderBottom: `1px solid ${T.separator}` }}>
    <span>Year</span><span style={{textAlign:"right"}}>Interest</span><span style={{textAlign:"right"}}>Principal</span><span style={{textAlign:"right"}}>Total</span><span style={{textAlign:"right"}}>Balance</span>
   </div>
   {calc.yearlyData.map((d, i) => (
    <div key={i} style={{ display: "grid", gridTemplateColumns: "0.7fr 1fr 1fr 1fr 1.2fr", gap: 0, fontSize: 12, padding: "8px 0", borderBottom: `1px solid ${T.separator}`, fontFamily: FONT }}>
     <span style={{ color: T.textSecondary }}>{d.year}</span>
     <span style={{ textAlign: "right", color: T.blue }}>{fmt(d.int)}</span>
     <span style={{ textAlign: "right", color: T.green }}>{fmt(d.prin)}</span>
     <span style={{ textAlign: "right" }}>{fmt(d.int + d.prin)}</span>
     <span style={{ textAlign: "right", color: T.textSecondary }}>{fmt(d.bal)}</span>
    </div>
   ))}
  </Card>
 )}
 {amortView === "monthly" && (
  <Card pad={12}>
   <div style={{ display: "grid", gridTemplateColumns: "0.5fr 1fr 1fr 1fr 0.8fr 1.2fr", gap: 0, fontSize: 11, color: T.textTertiary, fontWeight: 600, paddingBottom: 8, borderBottom: `1px solid ${T.separator}` }}>
    <span>#</span><span style={{textAlign:"right"}}>P&I</span><span style={{textAlign:"right"}}>Interest</span><span style={{textAlign:"right"}}>Principal</span><span style={{textAlign:"right"}}>Extra</span><span style={{textAlign:"right"}}>Balance</span>
   </div>
   {calc.amortSchedule.slice(0, 120).map((d, i) => (
    <div key={i} style={{ display: "grid", gridTemplateColumns: "0.5fr 1fr 1fr 1fr 0.8fr 1.2fr", gap: 0, fontSize: 11, padding: "6px 0", borderBottom: `1px solid ${T.separator}`, fontFamily: FONT }}>
     <span style={{ color: T.textTertiary }}>{d.m}</span>
     <span style={{ textAlign: "right", color: T.text, fontWeight: 600 }}>{fmt(d.int + d.prin)}</span>
     <span style={{ textAlign: "right", color: T.blue }}>{fmt(d.int)}</span>
     <span style={{ textAlign: "right", color: T.green }}>{fmt(d.prin)}</span>
     <span style={{ textAlign: "right", color: T.orange }}>{d.extra > 0 ? fmt(d.extra) : "—"}</span>
     <span style={{ textAlign: "right", color: T.textSecondary }}>{fmt(d.bal)}</span>
    </div>
   ))}
  </Card>
 )}
 {amortView === "equity" && (() => {
  const appRate = (appreciationRate || 3) / 100;
  const data = calc.yearlyData.map((d, i) => {
   const homeVal = salesPrice * Math.pow(1 + appRate, d.year);
   const equity = homeVal - d.bal;
   const prinPaid = calc.loan - d.bal;
   const appreciation = homeVal - salesPrice;
   return { year: d.year, homeVal, equity, bal: d.bal, prinPaid, appreciation, dp: calc.dp };
  });
  if (data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => d.homeVal));
  const W = 440, H = 260, pad = { t: 16, r: 16, b: 32, l: 52 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  const xStep = cW / (data.length - 1 || 1);
  const y = v => pad.t + cH - (maxVal > 0 ? (v / maxVal) * cH : 0);
  const valPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${pad.l + i * xStep},${y(d.homeVal)}`).join(" ");
  const balPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${pad.l + i * xStep},${y(d.bal)}`).join(" ");
  const eqArea = valPath + " " + data.slice().reverse().map((d, i) => `L${pad.l + (data.length - 1 - i) * xStep},${y(d.bal)}`).join(" ") + " Z";
  const ticks = [0, 1, 2, 3, 4].map(i => maxVal * i / 4);
  const yr5 = data.find(d => d.year === 5);
  const yr10 = data.find(d => d.year === 10);
  const last = data[data.length - 1];
  return (<>
   <Card pad={14}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
     <div style={{ fontSize: 13, fontWeight: 600 }}>Equity Growth</div>
     <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 11, color: T.textSecondary }}>Appreciation</span>
      <div style={{ display: "flex", alignItems: "center", background: T.bgAccent, borderRadius: 8, overflow: "hidden" }}>
       <button onClick={() => setAppreciationRate(Math.max(0, (appreciationRate || 3) - 0.5))} style={{ background: "none", border: "none", color: T.textSecondary, fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "4px 8px", fontFamily: FONT }}>−</button>
       <span style={{ fontSize: 13, fontWeight: 700, color: T.green, minWidth: 36, textAlign: "center", fontFamily: FONT }}>{appreciationRate || 3}%</span>
       <button onClick={() => setAppreciationRate(Math.min(15, (appreciationRate || 3) + 0.5))} style={{ background: "none", border: "none", color: T.textSecondary, fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "4px 8px", fontFamily: FONT }}>+</button>
      </div>
     </div>
    </div>
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
     {ticks.map((t, i) => (<g key={i}><line x1={pad.l} y1={y(t)} x2={W - pad.r} y2={y(t)} stroke={T.separator} strokeWidth="0.5" />
      <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fill={T.textTertiary} fontSize="8" fontFamily={FONT}>{t >= 1e6 ? `${(t/1e6).toFixed(1)}M` : t >= 1000 ? `${(t/1000).toFixed(0)}k` : t.toFixed(0)}</text></g>))}
     <path d={eqArea} fill={T.green} opacity="0.15" />
     <path d={valPath} fill="none" stroke={T.green} strokeWidth="2" />
     <path d={balPath} fill="none" stroke={T.orange} strokeWidth="2" strokeDasharray="4,3" />
     {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0 || i === data.length - 1).map((d, idx) => (
      <text key={idx} x={pad.l + data.indexOf(d) * xStep} y={H - 8} textAnchor="middle" fill={T.textTertiary} fontSize="9" fontFamily={FONT}>Yr {d.year}</text>
     ))}
     <rect x={W - 140} y={pad.t} width={124} height={42} rx={8} fill={T.card} opacity="0.95" />
     <circle cx={W - 128} cy={pad.t + 12} r={4} fill={T.green} /><text x={W - 120} y={pad.t + 16} fill={T.textSecondary} fontSize="9" fontFamily={FONT}>Home Value</text>
     <circle cx={W - 128} cy={pad.t + 26} r={4} fill={T.orange} /><text x={W - 120} y={pad.t + 30} fill={T.textSecondary} fontSize="9" fontFamily={FONT}>Loan Balance</text>
     <text x={W - 120} y={pad.t + 40} fill={T.green} fontSize="8" fontFamily={FONT} opacity="0.7">Shaded = Equity</text>
    </svg>
   </Card>
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
    {[yr5 && { label: "Year 5", eq: yr5.equity }, yr10 && { label: "Year 10", eq: yr10.equity }, last && { label: `Year ${last.year}`, eq: last.equity }].filter(Boolean).map((d, i) => (
     <Card key={i} pad={12}>
      <div style={{ fontSize: 10, color: T.textTertiary }}>{d.label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: T.green, fontFamily: FONT }}>{fmt(d.eq, true)}</div>
     </Card>
    ))}
   </div>
   {last && (
    <Card style={{ marginTop: 8, background: `${T.green}08`, border: `1px solid ${T.green}15` }}>
     <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: T.green }}>Equity Breakdown at Payoff</div>
     <MRow label="Down Payment" value={fmt(calc.dp)} />
     <MRow label="Principal Paid" value={fmt(last.prinPaid)} />
     <MRow label="Appreciation" value={fmt(last.appreciation)} color={T.green} />
     <MRow label="Total Equity" value={fmt(last.equity)} bold color={T.green} />
    </Card>
   )}
  </>);
 })()}
 </div>{/* end amort right column */}
 </div>{/* end amort desktop flex wrapper */}
 <GuidedNextButton />
</>);
}
