import React from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

export default function AssetsContent({
  T, isDesktop, calc, fmt, assets, addAsset, updateAsset, removeAsset,
  Hero, Card, Progress, Sec, TextInp, Inp, Sel, Note,
  RESERVE_FACTORS, ASSET_TYPES, guideField, isPulse, GuidedNextButton,
}) {
  return (<>
 <div style={isDesktop ? { display: "flex", gap: 24, marginTop: 20, alignItems: "flex-start" } : {}}>
 {/* LEFT: Hero + Summary cards (sticky) */}
 <div style={isDesktop ? { position: "sticky", top: 90, width: "50%", flexShrink: 0, maxHeight: "calc(100vh - 110px)", overflowY: "auto" } : {}}>
 <div data-field="assets-section" style={isDesktop ? { marginBottom: 16 } : { marginTop: 20, marginBottom: 16 }}>
  <Hero value={fmt(calc.totalAssetValue)} label="Total Assets" color={T.cyan} />
 </div>
 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "16px 0" }}>
  <Card pad={14}>
   <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 4 }}>Cash to Close</div>
   <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: calc.totalForClosing >= calc.cashToClose ? T.green : T.text, letterSpacing: "-0.02em" }}>{fmt(calc.totalForClosing)}</div>
   <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2, marginBottom: 4 }}>of {fmt(calc.cashToClose)} needed</div>
   <Progress value={calc.totalForClosing} max={calc.cashToClose} color={calc.totalForClosing >= calc.cashToClose ? T.green : T.orange} />
   <div style={{ fontSize: 11, color: calc.totalForClosing >= calc.cashToClose ? T.green : T.orange, fontWeight: 500 }}>
    {calc.totalForClosing >= calc.cashToClose ? `✓ Funded — ${fmt(calc.totalForClosing - calc.cashToClose)} surplus` : `Need ${fmt(calc.cashToClose - calc.totalForClosing)} more`}
   </div>
  </Card>
  <Card pad={14}>
   <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 4 }}>Reserves</div>
   <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: calc.totalReserves >= calc.reservesReq ? T.green : T.text, letterSpacing: "-0.02em" }}>{fmt(calc.totalReserves)}</div>
   <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2, marginBottom: 4 }}>of {fmt(calc.reservesReq)} needed ({calc.reserveMonths} mo)</div>
   <Progress value={calc.totalReserves} max={calc.reservesReq} color={calc.totalReserves >= calc.reservesReq ? T.green : T.orange} />
   <div style={{ fontSize: 11, color: calc.totalReserves >= calc.reservesReq ? T.green : T.orange, fontWeight: 500 }}>
    {calc.totalReserves >= calc.reservesReq ? `✓ Funded — ${fmt(calc.totalReserves - calc.reservesReq)} surplus` : `Need ${fmt(calc.reservesReq - calc.totalReserves)} more`}
   </div>
  </Card>
 </div>
 </div>{/* end assets left column */}
 {/* RIGHT: Account list (scrollable) */}
 <div style={isDesktop ? { width: "50%", flexShrink: 0, minWidth: 0 } : {}}>
 <Sec title="Accounts" action="+ Add" onAction={() => { addAsset(); setTimeout(() => { const cards = document.querySelectorAll('[data-asset-card]'); if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100); }}>
  {assets.map((a, aIdx) => {
   const rf = RESERVE_FACTORS[a.type];
   const rfLabel = rf === null ? "TBD" : `${(rf * 100).toFixed(0)}%`;
   const reserveAmt = rf === null ? 0 : (a.value - (a.forClosing || 0)) * rf;
   return (
    <div key={a.id} data-field={aIdx === 0 ? (guideField === "asset-closing" ? "asset-closing" : "asset-value") : undefined} className={aIdx === 0 ? (isPulse("asset-value") || isPulse("asset-closing")) : ""} style={{ borderRadius: 18, transition: "all 0.3s" }}>
    <Card>
     <div data-asset-card style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary }}>Asset Account</span>
      <button onClick={() => removeAsset(a.id)} style={{ background: "none", border: "none", color: T.red, fontSize: 13, cursor: "pointer" }}>Remove</button>
     </div>
     <TextInp label="Bank / Institution" value={a.bank} onChange={v => updateAsset(a.id, "bank", v)} sm />
     <Sel label="Account Type" value={a.type} onChange={v => updateAsset(a.id, "type", v)} options={ASSET_TYPES} sm req tip="Where the funds are held. Different account types have different liquidity factors for reserve calculations." />
     <Inp label="Current Value" value={a.value} onChange={v => updateAsset(a.id, "value", v)} sm req />
     <Inp label="Funds Used for Closing" value={a.forClosing} onChange={v => updateAsset(a.id, "forClosing", v)} sm tip="How much from this account you'll use for down payment and closing costs. Must be sourced and seasoned (in the account for 2+ months)." />
     <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13 }}>
      <span style={{ color: T.textSecondary }}>Reserve Factor</span>
      <span style={{ fontWeight: 600, color: rf === null ? T.orange : T.text }}>{rfLabel}</span>
     </div>
     {rf !== null && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
      <span style={{ color: T.textSecondary }}>Reserves</span>
      <span style={{ fontWeight: 600, fontFamily: FONT, color: T.green }}>{fmt(reserveAmt)}</span>
     </div>}
    </Card>
    </div>
   );
  })}
  {assets.length === 0 && (
   <div data-field="add-asset" className={isPulse("add-asset")} style={{ borderRadius: 14, transition: "all 0.3s" }}>
   <Card style={{ border: `2px dashed ${T.separator}`, background: "transparent", boxShadow: "none", textAlign: "center", padding: 24 }}>
    <button onClick={addAsset} style={{ background: "none", border: "none", color: T.blue, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>+ Add Asset Account</button>
   </Card>
   </div>
  )}
 </Sec>
 {assets.length > 0 && (
  <button onClick={() => { addAsset(); setTimeout(() => { const cards = document.querySelectorAll('[data-asset-card]'); if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100); }} style={{ width: "100%", padding: 14, background: `${T.blue}15`, border: `1px dashed ${T.blue}44`, borderRadius: 12, color: T.blue, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: FONT, marginTop: 10 }}>+ Add Another Account</button>
 )}
 <div style={{ textAlign: "center", marginTop: 8, marginBottom: 4 }}>
  <span style={{ fontSize: 11, color: T.green, fontWeight: 500 }}>✓ All changes auto-saved</span>
 </div>
 <Note>Reserve factors: Checking/Saving 100% · Stocks/Bonds 70% · Retirement 60% · Gift TBD</Note>
 </div>{/* end assets right column */}
 </div>{/* end assets desktop flex wrapper */}
 <GuidedNextButton />
</>);
}
