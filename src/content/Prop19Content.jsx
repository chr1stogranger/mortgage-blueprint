import React from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

export default function Prop19Content({
  T, isDesktop, fmt,
  prop19,
  prop19Eligibility, setProp19Eligibility,
  prop19OldTaxableValue, setProp19OldTaxableValue,
  prop19OldSalePrice, setProp19OldSalePrice,
  prop19SaleDate, setProp19SaleDate,
  prop19PurchaseDate, setProp19PurchaseDate,
  prop19TransfersUsed, setProp19TransfersUsed,
  city, propertyCounty,
  prop19RateOverride, setProp19RateOverride,
  Hero, Card, Sec, Inp, Note, MRow,
}) {
  return (<>

 <div style={isDesktop ? { display: "flex", gap: 24, marginTop: 20, alignItems: "flex-start" } : {}}>
  {/* LEFT: Hero + Inputs */}
  <div style={isDesktop ? { position: "sticky", top: 90, width: "50%", flexShrink: 0, maxHeight: "calc(100vh - 110px)", overflowY: "auto" } : {}}>
   <div style={isDesktop ? { marginBottom: 16 } : { marginTop: 20, marginBottom: 16 }}>
    <Hero
     value={fmt(prop19.monthlySavings)}
     label="Monthly Property-Tax Savings"
     color={prop19.monthlySavings > 0 ? T.green : T.textSecondary}
     sub={`${fmt(prop19.annualSavings)}/yr · ${fmt(prop19.thirtyYearSavings)} over 30 yrs`}
    />
   </div>
   <Note color={T.blue}>
    This is an informational estimate. Prop 19 eligibility is determined by your county assessor. Always confirm with a tax professional before relying on these numbers.
   </Note>
   <Sec title="Your Eligibility Path">
    <Card>
     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      {[["age55","55 or older"],["disabled","Severely disabled"],["disaster","Disaster victim"]].map(([val, lbl]) => (
       <button key={val} onClick={() => setProp19Eligibility(val)} style={{
        padding: "10px 8px", borderRadius: 10, fontSize: 12, fontWeight: 600,
        fontFamily: FONT, cursor: "pointer",
        background: prop19Eligibility === val ? T.blue : "transparent",
        color: prop19Eligibility === val ? "#fff" : T.text,
        border: `1px solid ${prop19Eligibility === val ? T.blue : T.separator}`,
       }}>{lbl}</button>
      ))}
     </div>
     <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 8, lineHeight: 1.5 }}>
      Informational only — we don't gate the calculator on this. Disaster path requires a declared wildfire or governor-declared disaster.
     </div>
    </Card>
   </Sec>
   <Sec title="Your Original Home">
    <Card>
     <Inp label="Current taxable value (from tax bill)" value={prop19OldTaxableValue} onChange={setProp19OldTaxableValue} tip="Your Prop 13 assessed value — check your most recent property-tax bill." />
     <Inp label="Sale price" value={prop19OldSalePrice} onChange={setProp19OldSalePrice} tip="What the outgoing home sold for (or will sell for)." />
     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
      <div>
       <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 4, fontFamily: MONO, textTransform: "uppercase", letterSpacing: 1 }}>SALE DATE</div>
       <input type="date" value={prop19SaleDate} onChange={e => setProp19SaleDate(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.separator}`, background: T.card, color: T.text, fontFamily: FONT, fontSize: 14 }} />
      </div>
      <div>
       <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 4, fontFamily: MONO, textTransform: "uppercase", letterSpacing: 1 }}>PURCHASE DATE</div>
       <input type="date" value={prop19PurchaseDate} onChange={e => setProp19PurchaseDate(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.separator}`, background: T.card, color: T.text, fontFamily: FONT, fontSize: 14 }} />
      </div>
     </div>
    </Card>
   </Sec>
   <Sec title="Transfer History">
    <Card>
     <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 8 }}>
      How many Prop 19 base-value transfers have you already used? (Lifetime cap is 3.)
     </div>
     <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
      {[0,1,2,3].map(n => (
       <button key={n} onClick={() => setProp19TransfersUsed(n)} style={{
        padding: "10px 8px", borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: MONO, cursor: "pointer",
        background: prop19TransfersUsed === n ? T.blue : "transparent",
        color: prop19TransfersUsed === n ? "#fff" : T.text,
        border: `1px solid ${prop19TransfersUsed === n ? T.blue : T.separator}`,
       }}>{n}</button>
      ))}
     </div>
    </Card>
   </Sec>
   <Sec title="Replacement County Rate">
    <Card>
     <MRow label="Replacement home" value={`${city || "—"}${propertyCounty ? ", " + propertyCounty + " Co." : ""}`} />
     <MRow label="Auto rate (from zip)" value={`${((prop19RateOverride > 0 ? prop19RateOverride/100 : prop19.countyRate) * 100).toFixed(3)}%`} />
     <Inp label="Override rate (optional)" value={prop19RateOverride} onChange={setProp19RateOverride} prefix="" suffix="%" max={5} step={0.001} />
     <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 6, lineHeight: 1.5 }}>
      County rate comes from the zip you entered in Setup. Leave override at 0 to use it automatically.
     </div>
    </Card>
   </Sec>
  </div>
  {/* RIGHT: Results + Explanation */}
  <div style={isDesktop ? { width: "50%", flexShrink: 0, minWidth: 0 } : {}}>
   {prop19.warnings.length > 0 && (
    <Sec title="Heads up">
     <Card>
      {prop19.warnings.map((w, i) => (
       <div key={i} style={{ fontSize: 12, color: T.orange, padding: "6px 0", borderBottom: i === prop19.warnings.length - 1 ? "none" : `1px solid ${T.separator}` }}>{w}</div>
      ))}
     </Card>
    </Sec>
   )}
   <Sec title="With Prop 19 transfer">
    <Card>
     <MRow label="New taxable value" value={fmt(prop19.newTaxableValue)} sub={prop19.sameOrLower ? "Replacement ≤ original sale — full base transferred" : "Replacement > original sale — base + excess"} />
     <MRow label="Effective rate" value={`${(prop19.countyRate * 100).toFixed(3)}%`} />
     <MRow label="Annual property tax" value={fmt(prop19.prop19Annual)} bold />
     <MRow label="Monthly" value={fmt(prop19.prop19Monthly)} color={T.green} />
    </Card>
   </Sec>
   <Sec title="Without Prop 19 (full reassessment)">
    <Card>
     <MRow label="Taxable value" value={fmt(prop19.replacementPrice)} />
     <MRow label="Annual property tax" value={fmt(prop19.fullReassessAnnual)} bold />
     <MRow label="Monthly" value={fmt(prop19.fullReassessMonthly)} color={T.red} />
    </Card>
   </Sec>
   <Sec title="Your savings">
    <Card>
     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {[["Monthly", fmt(prop19.monthlySavings)],["Annual", fmt(prop19.annualSavings)],["10-year", fmt(prop19.tenYearSavings)],["30-year", fmt(prop19.thirtyYearSavings)]].map(([lbl, val], i) => (
       <div key={i} style={{ background: T.pillBg, borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: prop19.annualSavings > 0 ? T.green : T.textSecondary, fontFamily: MONO }}>{val}</div>
        <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>{lbl}</div>
       </div>
      ))}
     </div>
    </Card>
   </Sec>
   <Sec title="How this was calculated">
    <Card>
     <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.6 }}>
      {prop19.sameOrLower ? (
       <>Your replacement home price ({fmt(prop19.replacementPrice)}) is <b>less than or equal to</b> your original home's sale price ({fmt(prop19.oldSP)}). Under Prop 19, your full Prop 13 taxable base transfers 1:1. New taxable value = {fmt(prop19.oldTV)}.</>
      ) : (
       <>Your replacement home price ({fmt(prop19.replacementPrice)}) is <b>greater than</b> your original home's sale price ({fmt(prop19.oldSP)}). Under Prop 19, the excess is added to your transferred base: {fmt(prop19.oldTV)} + ({fmt(prop19.replacementPrice)} − {fmt(prop19.oldSP)}) = {fmt(prop19.newTaxableValue)}.</>
      )}
     </div>
     <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 10, lineHeight: 1.5, borderTop: `1px solid ${T.separator}`, paddingTop: 10 }}>
      Not tax or legal advice. Always confirm eligibility with your county assessor and a qualified professional.
     </div>
    </Card>
   </Sec>
  </div>
 </div>
</>);
}
