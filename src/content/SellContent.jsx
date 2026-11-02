import { FONT, MONO } from "../lib/fonts.js";
import React, { useState } from "react";
import { devCheckProps } from "../lib/devPropCheck.js";


export default function SellContent(props) {
  // Dev-only guard for curated-props drift (see src/lib/devPropCheck.js).
  if (import.meta.env.DEV) devCheckProps("SellContent", props, ["T", "isDesktop", "calc", "fmt", "reos", "debts", "sellLinkedReoId", "setSellLinkedReoId", "sellPrice", "setSellPrice", "sellMortgagePayoff", "setSellMortgagePayoff", "sellCommission", "setSellCommission", "sellTransferTaxCity", "setSellTransferTaxCity", "sellEscrow", "setSellEscrow", "sellTitle", "setSellTitle", "sellOther", "setSellOther", "sellSellerCredit", "setSellSellerCredit", "sellCostBasis", "setSellCostBasis", "sellImprovements", "setSellImprovements", "sellYearsOwned", "setSellYearsOwned", "sellPrimaryRes", "setSellPrimaryRes", "married", "taxState", "TT_CITY_NAMES", "getTTForCity", "Card", "Inp", "Sel", "Note", "MRow", "GuidedNextButton"]);
  const {
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
  Card, Inp, Sel, Note, MRow,
  GuidedNextButton,
} = props;

  const [costsOpen, setCostsOpen] = useState(true);
  const [taxOpen, setTaxOpen] = useState(false);

  const linkedReo = sellLinkedReoId ? reos.find(r => String(r.id) === sellLinkedReoId) : null;
  const net = calc.sellNetAfterTax;
  const tax = calc.sellTotalCapGainsTax;
  const netColor = net >= 0 ? T.green : T.red;
  const pctOf = n => (sellPrice > 0 ? (n / sellPrice * 100).toFixed(1) : "0.0");
  const taxLine = tax > 0 ? `after ${fmt(tax)} est. capital gains tax` : "no capital gains tax";
  const split = [
   { label: "Mortgage Payoff", value: sellMortgagePayoff, color: T.textSecondary },
   { label: "Selling Costs", value: calc.sellTotalCosts, color: T.orange },
   { label: "Est. Capital Gains Tax", value: tax, color: T.red },
   { label: net >= 0 ? "You Keep" : "Shortfall", value: net, color: netColor },
  ];

  const ledgerRow = { display: "grid", gridTemplateColumns: "16px 1fr auto", gap: 8, alignItems: "center", minHeight: 48, borderBottom: `1px solid ${T.separator}`, fontSize: 15, fontFamily: FONT };
  const toggleRow = { ...ledgerRow, gridTemplateColumns: "16px 1fr auto 14px", width: "100%", padding: 0, border: "none", borderBottom: `1px solid ${T.separator}`, background: "none", color: T.text, textAlign: "left", cursor: "pointer" };
  const sign = { color: T.textTertiary };
  const detail = { margin: "8px 0", padding: "2px 14px", background: T.inputBg, borderRadius: 12 };
  const overline = { fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: T.textTertiary };
  const chevron = open => (
   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: T.textTertiary, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}><path d="M9 6l6 6-6 6" /></svg>
  );
  const twoUp = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "0 10px" };
  const railHeading = { margin: "0 0 12px", fontSize: 16, fontWeight: 700, fontFamily: FONT, letterSpacing: "-0.01em" };

  return (<>
 {/* The answer first: what the seller keeps, and where the sale price goes. */}
 <Card pad={isDesktop ? 28 : 18} style={{ marginTop: 20, marginBottom: 12 }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 18 }}>
   <div style={{ minWidth: 0 }}>
    <div style={{ ...overline, marginBottom: 6 }}>{net >= 0 ? "You walk away with" : "Short at closing"}</div>
    <div style={{ fontSize: isDesktop ? 64 : 48, lineHeight: 1.05, fontWeight: 800, fontFamily: FONT, letterSpacing: "-0.035em", color: netColor }}>{fmt(net)}</div>
    <div style={{ fontSize: 14, lineHeight: 1.4, color: T.textSecondary, marginTop: 6 }}>{linkedReo?.address ? `${linkedReo.address} · ${taxLine}` : taxLine[0].toUpperCase() + taxLine.slice(1)}</div>
   </div>
   {isDesktop && net >= 0 && <div style={{ textAlign: "right", flexShrink: 0 }}>
    <div style={{ fontSize: 26, fontWeight: 700, fontFamily: FONT, letterSpacing: "-0.02em" }}>{pctOf(net)}%</div>
    <div style={{ fontSize: 13, color: T.textSecondary }}>of the {fmt(sellPrice)} sale price</div>
   </div>}
  </div>
  <div role="img" aria-label={split.map(s => `${s.label} ${pctOf(s.value)}%`).join(", ")} style={{ display: "flex", gap: 2, height: isDesktop ? 40 : 30, marginBottom: 16 }}>
   {split.map(s => <div key={s.label} style={{ flex: `${Math.max(0, s.value)} 1 0`, minWidth: 0, background: s.color, borderRadius: 5 }} />)}
  </div>
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "14px 16px" }}>
   {split.map(s => <div key={s.label} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
    <span aria-hidden="true" style={{ width: 10, height: 10, marginTop: 4, borderRadius: 3, flexShrink: 0, background: s.color }} />
    <div style={{ minWidth: 0 }}>
     <div style={{ fontSize: 12, color: T.textSecondary }}>{s.label}</div>
     <div style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT, letterSpacing: "-0.02em" }}>{fmt(s.value)} <span style={{ fontSize: 12, fontWeight: 500, color: T.textTertiary, letterSpacing: 0 }}>{pctOf(s.value)}%</span></div>
    </div>
   </div>)}
  </div>
 </Card>

 <div style={isDesktop ? { display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 12, alignItems: "start" } : {}}>
 {/* LEFT: the math, one line per step */}
 <Card pad={isDesktop ? "6px 22px 20px" : "2px 16px 16px"} style={isDesktop ? { marginBottom: 0 } : {}}>
  <div style={ledgerRow}>
   <span /><span style={{ fontWeight: 600 }}>Sale Price</span><span style={{ fontWeight: 600 }}>{fmt(sellPrice)}</span>
  </div>
  <div style={ledgerRow}>
   <span style={sign}>−</span><span style={{ color: T.textSecondary }}>Mortgage Payoff</span><span style={{ fontWeight: 500 }}>{fmt(sellMortgagePayoff)}</span>
  </div>
  <button type="button" aria-expanded={costsOpen} onClick={() => setCostsOpen(!costsOpen)} style={toggleRow}>
   <span style={sign}>−</span>
   <span style={{ color: T.textSecondary }}>Selling Costs <span style={{ fontSize: 12, color: T.textTertiary }}>{pctOf(calc.sellTotalCosts)}%</span></span>
   <span style={{ fontWeight: 500 }}>{fmt(calc.sellTotalCosts)}</span>
   {chevron(costsOpen)}
  </button>
  {costsOpen && <div style={detail}>
   <MRow label="Commission" value={fmt(calc.sellCommAmt)} sub={`${sellCommission}%`} />
   <MRow label="Transfer Tax" value={fmt(calc.sellTotalTT)} sub={calc.sellCountyTT > 0 ? `County ${fmt(calc.sellCountyTT)} + city share ${fmt(calc.sellCityTTShare)}` : `City ${fmt(calc.sellCityTTShare)}`} />
   <MRow label="Escrow" value={fmt(sellEscrow)} />
   <MRow label="Title" value={fmt(sellTitle)} />
   <MRow label="Other Costs" value={fmt(sellOther)} />
   <MRow label="Seller Credit" value={fmt(sellSellerCredit)} />
   <MRow label="Fixed Closing Fees" value={fmt(calc.sellFixedFees)} />
  </div>}
  <div style={ledgerRow}>
   <span style={sign}>=</span><span style={{ fontWeight: 600 }}>Net Proceeds (Pre-Tax)</span><span style={{ fontWeight: 700 }}>{fmt(calc.sellNetProceeds)}</span>
  </div>
  {sellCostBasis > 0 && <>
   <button type="button" aria-expanded={taxOpen} onClick={() => setTaxOpen(!taxOpen)} style={toggleRow}>
    <span style={sign}>−</span>
    <span style={{ color: T.textSecondary }}>Est. Capital Gains Tax {calc.sellTaxableGain > 0 && <span style={{ fontSize: 12, color: T.textTertiary }}>on {fmt(calc.sellTaxableGain)} gain</span>}</span>
    <span style={{ fontWeight: 500 }}>{fmt(tax)}</span>
    {chevron(taxOpen)}
   </button>
   {taxOpen && <div style={{ ...detail, padding: "12px 14px 4px" }}>
    <div style={overline}>How the gain is figured</div>
    <MRow label="Sale Price" value={fmt(sellPrice)} />
    <MRow label="Adjusted Cost Basis" value={`-${fmt(calc.sellAdjBasis)}`} sub={`${fmt(sellCostBasis)} purchase + ${fmt(sellImprovements)} improvements`} />
    <MRow label="Selling Costs" value={`-${fmt(calc.sellTotalCosts)}`} />
    <MRow label="Gross Gain" value={fmt(calc.sellGrossGain)} bold />
    {calc.sellExclusionLimit > 0 && <MRow label={`Exclusion (${married === "MFJ" ? "MFJ" : married === "MFS" ? "MFS" : "Single/HOH"})`} value={`-${fmt(calc.sellExclusionLimit)}`} sub={`Primary res ${sellYearsOwned}+ yrs`} />}
    <MRow label="Taxable Gain" value={fmt(calc.sellTaxableGain)} bold />
    {calc.sellTaxableGain === 0 && calc.sellGrossGain > 0 && <Note color={T.green}>Entire gain excluded under IRC §121. No federal capital gains tax owed.</Note>}
    {calc.sellTaxableGain > 0 && <>
     <div style={{ ...overline, marginTop: 14 }}>How the tax is figured</div>
     <MRow label="Holding Period" value={<span style={{ whiteSpace: "nowrap" }}>{calc.sellIsLongTerm ? `${sellYearsOwned} yrs (Long-Term)` : `${sellYearsOwned} yr (Short-Term)`}</span>} sub={calc.sellIsLongTerm ? "Favorable LTCG rates" : "Taxed as ordinary income"} />
     {calc.sellIsLongTerm
      ? <MRow label="Federal LTCG Rate" value={`${(calc.fedLTCGRate * 100).toFixed(0)}%`} />
      : <MRow label="Federal Rate" value="Ordinary" sub={`Averages ${((calc.sellFedCapGainsTax - calc.sellNIIT) / calc.sellTaxableGain * 100).toFixed(1)}% on top of your income`} />}
     <MRow label={calc.sellIsLongTerm ? "Federal Cap Gains Tax" : "Federal Income Tax"} value={fmt(calc.sellFedCapGainsTax - calc.sellNIIT)} />
     {calc.sellNIIT > 0 && <MRow label="NIIT (3.8%)" value={fmt(calc.sellNIIT)} sub="Net Investment Income Tax" />}
     <MRow label={`State Tax (${taxState})`} value={fmt(calc.sellStateCapGainsTax)} sub={`${(calc.sellStateCapGainsRate * 100).toFixed(2)}% marginal rate`} />
     <MRow label="Total Est. Tax" value={fmt(tax)} bold />
    </>}
   </div>}
  </>}
  <div style={{ ...ledgerRow, borderBottom: "none", minHeight: 0, padding: "16px 0 4px", alignItems: "baseline" }}>
   <span style={sign}>=</span><span style={{ fontSize: 16, fontWeight: 700 }}>Net After Tax</span><span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", color: netColor }}>{fmt(net)}</span>
  </div>
  {calc.sellTaxableGain > 0 && <Note color={T.orange}>This is an estimate only, not tax advice. Consult a CPA for your specific situation. Depreciation recapture, installment sales, 1031 exchanges, and AMT may apply.</Note>}
 </Card>

 {/* RIGHT: the inputs */}
 <Card pad={isDesktop ? "20px 22px" : "16px"} style={isDesktop ? { marginBottom: 0 } : {}}>
  <h3 style={railHeading}>Your Numbers</h3>
  {reos.length > 0 && (
   <Sel sm label="Link to REO Property" value={sellLinkedReoId} onChange={v => {
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
   }} options={[{value: "", label: "Manual entry"}, ...reos.map(r => ({value: String(r.id), label: r.address || `Property (${fmt(r.value)})`}))]} tip="Select an existing property to auto-fill sale price, mortgage payoff, and residence status from your REO data." />
  )}
  {linkedReo && <div style={{ fontSize: 11, color: T.green, marginBottom: 10 }}>✓ Linked to: {linkedReo.address || "REO property"} · {linkedReo.propUse}</div>}
  <div style={twoUp}>
   <Inp sm label="Sale Price" value={sellPrice} onChange={setSellPrice} req tip="Expected selling price. If linked to an REO property, this auto-fills from the estimated value." />
   <Inp sm label="Mortgage Payoff" value={sellMortgagePayoff} onChange={setSellMortgagePayoff} tip="Remaining loan balance at time of sale. If linked to an REO, this pulls from the mortgage balance or linked debts." />
  </div>
  {/* Stacked on a phone: half a row clips the city and its rate. */}
  <div style={isDesktop ? twoUp : {}}>
   <Inp sm label="Commission %" value={sellCommission} onChange={setSellCommission} prefix="" suffix="%" step={0.25} max={20} tip="Total real estate commission. Typically 4-6%, split between listing and buyer's agent." />
   <Sel sm label="City Transfer Tax" value={sellTransferTaxCity} onChange={setSellTransferTaxCity} options={TT_CITY_NAMES.map(c => ({ value: c, label: c === "Not listed" ? "Not listed" : `${c} ($${getTTForCity(c, sellPrice).rate}/$1K)` }))} />
  </div>
  <div style={twoUp}>
   <Inp sm label="Escrow" value={sellEscrow} onChange={setSellEscrow} />
   <Inp sm label="Title" value={sellTitle} onChange={setSellTitle} />
  </div>
  <div style={twoUp}>
   <Inp sm label="Other Costs" value={sellOther} onChange={setSellOther} />
   <Inp sm label="Seller Credit" value={sellSellerCredit} onChange={setSellSellerCredit} />
  </div>
  <div style={{ marginTop: 14, paddingTop: 16, borderTop: `1px solid ${T.separator}` }}>
   <h3 style={railHeading}>Capital Gains Estimate</h3>
   <div style={twoUp}>
    <Inp sm label="Original Purchase Price" value={sellCostBasis} onChange={setSellCostBasis} />
    <Inp sm label="Capital Improvements" value={sellImprovements} onChange={setSellImprovements} />
   </div>
   <div style={twoUp}>
    <Inp sm label="Years Owned" value={sellYearsOwned} onChange={setSellYearsOwned} prefix="" suffix="yrs" step={1} max={100} />
    <div>
     <div style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>Primary Residence?</div>
     <button type="button" role="switch" aria-checked={!!sellPrimaryRes} aria-label="Primary residence" onClick={() => setSellPrimaryRes(!sellPrimaryRes)} style={{ width: 50, height: 28, marginTop: 7, borderRadius: 14, border: "none", background: sellPrimaryRes ? T.green : T.ringTrack, cursor: "pointer", position: "relative", transition: "background 0.3s" }}>
      <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, left: sellPrimaryRes ? 25 : 3, transition: "left 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
     </button>
    </div>
   </div>
  </div>
 </Card>
 </div>
 <GuidedNextButton />
</>);
}
