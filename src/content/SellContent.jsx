import React from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

export default function SellContent({
  T, isDesktop, calc, fmt,
  reos, debts,
  sellLinkedReoId, setSellLinkedReoId,
  sellPrice, setSellPrice,
  sellMortgagePayoff, setSellMortgagePayoff,
  sellCommission, setSellCommission,
  sellTransferTaxCity, setSellTransferTaxCity,
  sellEscrow, setSellEscrow,
  sellTitle, setSellTitle,
  sellOther, setSellOther,
  sellSellerCredit, setSellSellerCredit,
  sellCostBasis, setSellCostBasis,
  sellImprovements, setSellImprovements,
  sellYearsOwned, setSellYearsOwned,
  sellPrimaryRes, setSellPrimaryRes,
  married, taxState,
  TT_CITY_NAMES, getTTForCity,
  Hero, Card, Sec, Inp, Sel, Note, MRow,
  GuidedNextButton,
}) {
  return (<>
 <div style={isDesktop ? { display: "flex", gap: 24, marginTop: 20, alignItems: "flex-start" } : {}}>
 {/* LEFT: Hero + Summary (sticky on desktop) */}
 <div style={isDesktop ? { position: "sticky", top: 90, width: "50%", flexShrink: 0, maxHeight: "calc(100vh - 110px)", overflowY: "auto" } : {}}>
 <div style={isDesktop ? { marginBottom: 16 } : { marginTop: 20, marginBottom: 16 }}>
  {(() => {
   const linkedReo = sellLinkedReoId ? reos.find(r => String(r.id) === sellLinkedReoId) : null;
   return <Hero value={fmt(calc.sellNetAfterTax)} label={linkedReo ? `Net Proceeds — ${linkedReo.address || "Linked Property"}` : "Net After Tax"} color={calc.sellNetAfterTax >= 0 ? T.green : T.red} sub={calc.sellTotalCapGainsTax > 0 ? `${fmt(calc.sellTotalCapGainsTax)} est. capital gains tax` : "No capital gains tax"} />;
  })()}
 </div>
 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, margin: "0 0 16px 0" }}>
  <Card pad={12}><div style={{ fontSize: 10, color: T.textTertiary }}>Net Proceeds</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT, color: T.green, letterSpacing: "-0.02em" }}>{fmt(calc.sellNetProceeds)}</div></Card>
  <Card pad={12}><div style={{ fontSize: 10, color: T.textTertiary }}>Sell Costs</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT, color: T.red, letterSpacing: "-0.02em" }}>{fmt(calc.sellTotalCosts)}</div><div style={{ fontSize: 10, color: T.textTertiary }}>{sellPrice > 0 ? (calc.sellTotalCosts / sellPrice * 100).toFixed(1) : 0}%</div></Card>
  <Card pad={12}><div style={{ fontSize: 10, color: T.textTertiary }}>Commission</div><div style={{ fontSize: 16, fontWeight: 700, fontFamily: FONT, letterSpacing: "-0.02em" }}>{fmt(calc.sellCommAmt)}</div></Card>
 </div>
 <Card style={{ background: calc.sellNetAfterTax >= 0 ? T.successBg : T.errorBg }}>
  <MRow label="Sale Price" value={fmt(sellPrice)} bold />
  <MRow label="Mortgage Payoff" value={`-${fmt(sellMortgagePayoff)}`} color={T.red} />
  <MRow label="Total Costs" value={`-${fmt(calc.sellTotalCosts)}`} color={T.red} />
  <div style={{ borderTop: `1px solid ${T.separator}`, marginTop: 6, paddingTop: 6 }}>
   <MRow label="Net Proceeds (Pre-Tax)" value={fmt(calc.sellNetProceeds)} color={calc.sellNetProceeds >= 0 ? T.green : T.red} bold />
  </div>
  {calc.sellTotalCapGainsTax > 0 && <MRow label="Est. Capital Gains Tax" value={`-${fmt(calc.sellTotalCapGainsTax)}`} color={T.red} />}
  <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
   <MRow label="Net After Tax" value={fmt(calc.sellNetAfterTax)} color={calc.sellNetAfterTax >= 0 ? T.green : T.red} bold />
  </div>
 </Card>
 {sellCostBasis > 0 && <Sec title="Gain Calculation">
  <Card>
   <MRow label="Sale Price" value={fmt(sellPrice)} />
   <MRow label="Adjusted Cost Basis" value={`-${fmt(calc.sellAdjBasis)}`} sub={`${fmt(sellCostBasis)} purchase + ${fmt(sellImprovements)} improvements`} color={T.textSecondary} />
   <MRow label="Selling Costs" value={`-${fmt(calc.sellTotalCosts)}`} color={T.textSecondary} />
   <div style={{ borderTop: `1px solid ${T.separator}`, marginTop: 6, paddingTop: 6 }}>
    <MRow label="Gross Gain" value={fmt(calc.sellGrossGain)} color={calc.sellGrossGain > 0 ? T.green : T.red} bold />
   </div>
   {calc.sellExclusionLimit > 0 && <MRow label={`Exclusion (${married === "MFJ" ? "MFJ" : married === "MFS" ? "MFS" : "Single/HOH"})`} value={`-${fmt(calc.sellExclusionLimit)}`} sub={`Primary res ${sellYearsOwned}+ yrs`} color={T.green} />}
   <div style={{ borderTop: `1px solid ${T.separator}`, marginTop: 6, paddingTop: 6 }}>
    <MRow label="Taxable Gain" value={fmt(calc.sellTaxableGain)} color={calc.sellTaxableGain > 0 ? T.orange : T.green} bold />
   </div>
   {calc.sellTaxableGain === 0 && calc.sellGrossGain > 0 && <Note color={T.green}>Entire gain excluded under IRC §121. No federal capital gains tax owed.</Note>}
  </Card>
 </Sec>}
 {calc.sellTaxableGain > 0 && <Sec title="Tax Estimate">
  <Card>
   <MRow label="Holding Period" value={calc.sellIsLongTerm ? `${sellYearsOwned} yrs (Long-Term)` : `${sellYearsOwned} yr (Short-Term)`} sub={calc.sellIsLongTerm ? "Favorable LTCG rates" : "Taxed as ordinary income"} />
   <div style={{ borderTop: `1px solid ${T.separator}`, marginTop: 6, paddingTop: 6 }}>
    <MRow label="Federal LTCG Rate" value={calc.fedLTCGRate !== null ? `${(calc.fedLTCGRate * 100).toFixed(0)}%` : "Ordinary"} />
    <MRow label="Federal Cap Gains Tax" value={fmt(calc.sellFedCapGainsTax - calc.sellNIIT)} color={T.red} />
    {calc.sellNIIT > 0 && <MRow label="NIIT (3.8%)" value={fmt(calc.sellNIIT)} sub="Net Investment Income Tax" color={T.red} />}
    <MRow label={`State Tax (${taxState})`} value={fmt(calc.sellStateCapGainsTax)} sub={`${(calc.sellStateCapGainsRate * 100).toFixed(2)}% marginal rate`} color={T.red} />
   </div>
   <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
    <MRow label="Total Est. Tax" value={fmt(calc.sellTotalCapGainsTax)} color={T.red} bold />
   </div>
   <Note color={T.orange}>This is an estimate only — not tax advice. Consult a CPA for your specific situation. Depreciation recapture, installment sales, 1031 exchanges, and AMT may apply.</Note>
  </Card>
 </Sec>}
 </div>{/* end seller net left column */}
 {/* RIGHT: Input forms */}
 <div style={isDesktop ? { width: "50%", flexShrink: 0, minWidth: 0 } : {}}>
 <Sec title="Sale Details">
  <Card>
   {reos.length > 0 && (
    <Sel label="Link to REO Property" value={sellLinkedReoId} onChange={v => {
     setSellLinkedReoId(v);
     if (v) {
      const reo = reos.find(r => String(r.id) === v);
      if (reo) {
       setSellPrice(Number(reo.value) || 0);
       const linked = debts.filter(d => d.linkedReoId === v && (d.type === "Mortgage" || d.type === "HELOC"));
       const totalBal = linked.length > 0 ? linked.reduce((s, d) => s + (Number(d.balance) || 0), 0) : (Number(reo.mortgageBalance) || 0);
       setSellMortgagePayoff(totalBal);
       setSellPrimaryRes(reo.propUse === "Primary");
       if (reo.propUse === "Primary") setSellPrimaryRes(true);
       else setSellPrimaryRes(false);
      }
     }
    }} options={[{value: "", label: "— Manual entry —"}, ...reos.map(r => ({value: String(r.id), label: r.address || `Property (${fmt(r.value)})`}))]} tip="Select an existing property to auto-fill sale price, mortgage payoff, and residence status from your REO data." />
   )}
   {sellLinkedReoId && (() => {
    const reo = reos.find(r => String(r.id) === sellLinkedReoId);
    return reo ? <div style={{ fontSize: 11, color: T.green, marginTop: -6, marginBottom: 10 }}>✓ Linked to: {reo.address || "REO property"} · {reo.propUse}</div> : null;
   })()}
   <Inp label="Sale Price" value={sellPrice} onChange={setSellPrice} req tip="Expected selling price. If linked to an REO property, this auto-fills from the estimated value." />
   <Inp label="Mortgage Payoff" value={sellMortgagePayoff} onChange={setSellMortgagePayoff} tip="Remaining loan balance at time of sale. If linked to an REO, this pulls from the mortgage balance or linked debts." />
   <Inp label="Commission %" value={sellCommission} onChange={setSellCommission} prefix="" suffix="%" step={0.25} max={20} tip="Total real estate commission. Typically 4-6%, split between listing and buyer's agent." />
   <Sel label="City Transfer Tax" value={sellTransferTaxCity} onChange={setSellTransferTaxCity} options={TT_CITY_NAMES.map(c => ({ value: c, label: c === "Not listed" ? "Not listed" : `${c} ($${getTTForCity(c, sellPrice).rate}/$1K)` }))} />
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    <Inp label="Escrow" value={sellEscrow} onChange={setSellEscrow} sm />
    <Inp label="Title" value={sellTitle} onChange={setSellTitle} sm />
   </div>
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    <Inp label="Other Costs" value={sellOther} onChange={setSellOther} sm />
    <Inp label="Seller Credit" value={sellSellerCredit} onChange={setSellSellerCredit} sm />
   </div>
  </Card>
 </Sec>
 <Sec title="Capital Gains Estimate">
  <Card>
   <Inp label="Original Purchase Price" value={sellCostBasis} onChange={setSellCostBasis} />
   <Inp label="Capital Improvements" value={sellImprovements} onChange={setSellImprovements} />
   <Inp label="Years Owned" value={sellYearsOwned} onChange={setSellYearsOwned} prefix="" suffix="yrs" step={1} max={100} />
   <div style={{ marginTop: 8 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
     <span style={{ fontSize: 14, fontWeight: 500 }}>Primary Residence?</span>
     <button onClick={() => setSellPrimaryRes(!sellPrimaryRes)} style={{ width: 50, height: 28, borderRadius: 14, border: "none", background: sellPrimaryRes ? T.green : T.ringTrack, cursor: "pointer", position: "relative", transition: "background 0.3s" }}>
      <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, left: sellPrimaryRes ? 25 : 3, transition: "left 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
     </button>
    </div>
   </div>
  </Card>
 </Sec>
 </div>{/* end seller net right column */}
 </div>{/* end seller net desktop flex wrapper */}
 <GuidedNextButton />
</>);
}
