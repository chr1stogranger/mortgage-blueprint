import React from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

export default function CostsContent({
  T, isDesktop, calc, fmt, fmt2,
  isRefi, downPct,
  underwritingFee, setUnderwritingFee,
  processingFee, setProcessingFee,
  discountPts, setDiscountPts,
  appraisalFee, setAppraisalFee,
  creditReportFee, setCreditReportFee,
  floodCertFee, setFloodCertFee,
  mersFee, setMersFee,
  taxServiceFee, setTaxServiceFee,
  escrowFee, setEscrowFee,
  titleInsurance, setTitleInsurance,
  titleSearch, setTitleSearch,
  settlementFee, setSettlementFee,
  transferTaxCity, setTransferTaxCity,
  city, propertyState, salesPrice,
  getTTCitiesForState, getTTForCity,
  recordingFee, setRecordingFee,
  ownersTitleIns, setOwnersTitleIns,
  homeWarranty, setHomeWarranty,
  hoa, hoaTransferFee, setHoaTransferFee,
  buyerPaysComm, setBuyerPaysComm,
  buyerCommPct, setBuyerCommPct,
  closingMonth, setClosingMonth,
  closingDay, setClosingDay,
  annualIns, setAnnualIns,
  includeEscrow,
  lenderCredit, setLenderCredit,
  sellerCredit, setSellerCredit,
  realtorCredit, setRealtorCredit,
  emd, setEmd,
  Hero, Card, Sec, Inp, Sel, Note, MRow,
  GuidedNextButton,
}) {
  return (<>
 <div style={isDesktop ? { display: "flex", gap: 24, marginTop: 20, alignItems: "flex-start" } : {}}>
 {/* ── LEFT: Hero + Summary cards (sticky on desktop) ── */}
 <div style={isDesktop ? { position: "sticky", top: 90, width: "50%", flexShrink: 0, maxHeight: "calc(100vh - 110px)", overflowY: "auto" } : {}}>
 <div style={isDesktop ? { marginBottom: 16 } : { marginTop: 20, marginBottom: 16 }}>
  <Hero value={fmt(isRefi ? calc.totalClosingCosts + calc.totalPrepaidExp : calc.cashToClose)} label={isRefi ? "Estimated Refi Costs" : "Estimated Cash to Close"} color={T.green} />
 </div>
 {isRefi ? (
 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: isDesktop ? "0 0 12px" : "16px 0 16px" }}>
  <Card pad={12}><div style={{ fontSize: 10, color: T.textTertiary }}>Closing Costs</div><div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: T.blue, letterSpacing: "-0.03em" }}>{fmt(calc.totalClosingCosts)}</div></Card>
  <Card pad={12}><div style={{ fontSize: 10, color: T.textTertiary }}>Prepaids</div><div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: T.orange, letterSpacing: "-0.03em" }}>{fmt(calc.totalPrepaidExp)}</div></Card>
 </div>
 ) : (<>
 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: isDesktop ? "0 0 8px" : "16px 0" }}>
  <Card pad={12}><div style={{ fontSize: 10, color: T.textTertiary }}>Down Payment</div><div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, letterSpacing: "-0.03em" }}>{fmt(calc.dp)}</div><div style={{ fontSize: 10, color: T.textTertiary }}>{downPct}%</div></Card>
  <Card pad={12}><div style={{ fontSize: 10, color: T.textTertiary }}>Closing Costs</div><div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: T.blue, letterSpacing: "-0.03em" }}>{fmt(calc.totalClosingCosts)}</div></Card>
 </div>
 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: isDesktop ? 12 : 16 }}>
  <Card pad={12}><div style={{ fontSize: 10, color: T.textTertiary }}>Prepaids & Escrow</div><div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: T.orange, letterSpacing: "-0.03em" }}>{fmt(calc.totalPrepaidExp)}</div></Card>
  <Card pad={12}><div style={{ fontSize: 10, color: T.textTertiary }}>Credits</div><div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: T.green, letterSpacing: "-0.03em" }}>-{fmt(calc.totalCredits)}</div></Card>
 </div>
 </>)}
 {/* Closing costs subtotal — visible in left column on desktop */}
 {isDesktop && (
 <Card style={{ background: `${T.blue}10`, border: `1px solid ${T.blue}25` }}>
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
   {[["A. Lender Fees", fmt2(calc.origCharges)], ["B. Cannot Shop", fmt2(calc.cannotShop)], ["C. Can Shop", fmt2(calc.canShop)], ["D. Government", fmt2(calc.govCharges)], ...(!isRefi ? [["H. Other Costs", fmt2(calc.sectionH)]] : [])].map(([l, v], i) => (
    <div key={i} style={{ padding: "6px 12px", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
     <span style={{ color: T.textSecondary }}>{l}</span>
     <span style={{ fontWeight: 600, fontFamily: FONT }}>{v}</span>
    </div>
   ))}
  </div>
  <div style={{ borderTop: `2px solid ${T.blue}40`, marginTop: 6, paddingTop: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between" }}>
   <span style={{ fontWeight: 700, fontSize: 14, color: T.blue }}>Total Closing Costs</span>
   <span style={{ fontWeight: 700, fontSize: 14, fontFamily: FONT, color: T.blue }}>{fmt(calc.totalClosingCosts)}</span>
  </div>
 </Card>
 )}
 {/* Estimated Funds to Close — also in left column on desktop */}
 {isDesktop && (
 <Card style={{ background: T.successBg, border: `1px solid ${T.green}30`, marginTop: 12 }}>
  <div style={{ fontSize: 12, fontWeight: 700, color: T.green, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>{isRefi ? "Estimated Refi Costs" : "Estimated Funds to Close"}</div>
  {!isRefi && <MRow label="Down Payment" value={fmt(calc.dp)} />}
  <MRow label={isRefi ? "A\u2013D. Total Closing Costs" : "A\u2013D,H. Total Closing Costs"} value={fmt(calc.totalClosingCosts)} />
  <MRow label={includeEscrow ? "E–F. Prepaids & Escrow" : "E. Prepaids"} value={fmt(calc.totalPrepaidExp)} />
  {calc.totalCredits > 0 && <MRow label="G. Credits Applied" value={`-${fmt(calc.totalCredits)}`} color={T.green} />}
  <div style={{ borderTop: `2px solid ${T.green}40`, marginTop: 8, paddingTop: 8 }}>
   <MRow label={isRefi ? "TOTAL REFI COSTS" : "ESTIMATED CASH FROM BORROWER"} value={fmt(isRefi ? calc.totalClosingCosts + calc.totalPrepaidExp - calc.totalCredits : calc.cashToClose)} color={T.green} bold />
  </div>
 </Card>
 )}
 </div>{/* end costs left column */}
 {/* ── RIGHT: All fee detail sections (scrollable on desktop) ── */}
 <div style={isDesktop ? { width: "50%", flexShrink: 0, minWidth: 0 } : {}}>
 {/* ── A. LENDER FEES ── */}
 <Sec title="A. Lender Fees">
  <Card>
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    <Inp label="Underwriting Fee" value={underwritingFee} onChange={setUnderwritingFee} sm />
    <Inp label="Processing Fee" value={processingFee} onChange={setProcessingFee} sm />
   </div>
   <Inp label="Discount Points" value={discountPts} onChange={setDiscountPts} prefix="" suffix="pts" step={0.125} max={10} sm tip="Upfront fee to lower your rate. 1 point = 1% of loan amount, typically reduces rate by ~0.25%. Worth it if you keep the loan 4+ years." />
   {discountPts > 0 && <MRow label="Points Cost" value={fmt2(calc.pointsCost)} sub={`${discountPts} pts × ${fmt(calc.loan)}`} color={T.orange} />}
   <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
    <MRow label="Total Lender Fees" value={fmt2(calc.origCharges)} bold />
   </div>
  </Card>
 </Sec>

 {/* ── B. SERVICES YOU CANNOT SHOP FOR ── */}
 <Sec title="B. Services You Cannot Shop For">
  <Card>
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    <Inp label="Appraisal" value={appraisalFee} onChange={setAppraisalFee} sm />
    <Inp label="Credit Report" value={creditReportFee} onChange={setCreditReportFee} sm />
   </div>
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
    <Inp label="Flood Cert" value={floodCertFee} onChange={setFloodCertFee} sm />
    <Inp label="MERS" value={mersFee} onChange={setMersFee} sm />
    <Inp label="Tax Service" value={taxServiceFee} onChange={setTaxServiceFee} sm />
   </div>
   <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
    <MRow label="Total Cannot Shop" value={fmt2(calc.cannotShop)} bold />
   </div>
  </Card>
 </Sec>

 {/* ── C. SERVICES YOU CAN SHOP FOR ── */}
 <Sec title="C. Services You Can Shop For">
  <Card>
   {isRefi ? (<>
    <Inp label="Escrow/Closing Fee" value={escrowFee} onChange={setEscrowFee} sm />
    <Note color={T.blue}>Refinances use a flat title/escrow fee. Default $1,995 — adjust if your title company quotes differently.</Note>
   </>) : (<>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
     <Inp label="Title Insurance" value={titleInsurance} onChange={setTitleInsurance} sm />
     <Inp label="Title Search" value={titleSearch} onChange={setTitleSearch} sm />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
     <Inp label="Settlement Agent" value={settlementFee} onChange={setSettlementFee} sm />
     <Inp label="Escrow/Closing Fee" value={escrowFee} onChange={setEscrowFee} sm />
    </div>
    {calc.hoaCert > 0 && <MRow label="HOA Certification" value={fmt2(calc.hoaCert)} sub="Condo/Townhouse" />}
   </>)}
   <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
    <MRow label="Total Can Shop" value={fmt2(calc.canShop)} bold />
   </div>
   {!isRefi && <Note color={T.blue}>Title and escrow fees are negotiable. Shop around for the best rates — you have the right to choose your own providers.</Note>}
  </Card>
 </Sec>

 {/* ── D. TAXES & GOVERNMENT FEES ── */}
 <Sec title="D. Taxes & Government Fees">
  <Card>
   {!isRefi && <>
   <Sel label="City Transfer Tax" value={transferTaxCity} onChange={setTransferTaxCity} options={getTTCitiesForState(propertyState).map(c => ({ value: c, label: c === "Not listed" ? "Not listed" : `${c} ($${getTTForCity(c, salesPrice).rate}/$1K)` }))} tip="Government tax charged when property changes hands. Rate varies by city. Typically split between buyer and seller." />
   {transferTaxCity === city && transferTaxCity !== "Not listed" && <div style={{ fontSize: 11, color: T.green, fontWeight: 600, marginTop: -4, marginBottom: 8 }}>✓ Auto-matched from property city</div>}
   {!getTTCitiesForState(propertyState).includes(city) && transferTaxCity === "Not listed" && <div style={{ fontSize: 11, color: T.textTertiary, marginTop: -4, marginBottom: 8 }}>{city || "This city"} has no city transfer tax — only county ($1.10/$1K)</div>}
   <MRow label="City Transfer Tax (Buyer 50%)" value={fmt2(calc.buyerCityTT)} sub={calc.buyerCityTT === 0 && transferTaxCity !== "Not listed" ? "Seller pays" : null} />
   {calc.ttEntry.rate > 0 && <div style={{ fontSize: 11, color: T.textTertiary, marginTop: -4, marginBottom: 8 }}>Tier: ${calc.ttEntry.rate}/$1K for {calc.ttEntry.label}</div>}
   </>}
   {isRefi && <Note color={T.blue}>No transfer tax on refinances in California.</Note>}
   <Inp label="Recording Fees" value={recordingFee} onChange={setRecordingFee} sm />
   <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
    <MRow label="Total Government Fees" value={fmt2(calc.govCharges)} bold />
   </div>
   {!isRefi && transferTaxCity === "San Francisco" && <Note color={T.blue}>SF: Seller customarily pays 100% of transfer tax.</Note>}
  </Card>
 </Sec>

 {/* ── H. OTHER COSTS ── */}
 {!isRefi && (
 <Sec title="H. Other Costs">
  <Card>
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    <Inp label="Owner's Title Insurance" value={ownersTitleIns} onChange={setOwnersTitleIns} sm tip="Protects the buyer's ownership interest. One-time premium paid at closing. Separate from the lender's title policy in Section C." />
    <Inp label="Home Warranty" value={homeWarranty} onChange={setHomeWarranty} sm tip="Annual home warranty plan covering major systems and appliances. Typically $400–$600." />
   </div>
   {hoa > 0 && (
    <>
     <Inp label="HOA Transfer Fee" value={hoaTransferFee || hoa} onChange={setHoaTransferFee} sm tip="Fee charged by the HOA when ownership transfers. Defaults to 1 month of HOA dues. Covers document prep, account setup, and move-in/out processing." />
     {hoaTransferFee === 0 && <div style={{ fontSize: 11, color: T.textTertiary, marginTop: -6, marginBottom: 8, paddingLeft: 2 }}>Auto: 1 month HOA ({fmt(hoa)})</div>}
    </>
   )}
   {/* Buyer Agent Commission — toggle + % input */}
   <div style={{ marginTop: 8, padding: "12px 14px", background: T.inputBg, borderRadius: 12, border: `1px solid ${T.cardBorder}` }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: buyerPaysComm ? 10 : 0 }}>
     <div>
      <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>Buyer Pays Agent Commission</div>
      <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 1 }}>Toggle on if buyer is responsible for their agent's fee</div>
     </div>
     <button
      onClick={() => setBuyerPaysComm(!buyerPaysComm)}
      style={{
       width: 40, height: 22, borderRadius: 9999, border: "none",
       background: buyerPaysComm ? T.blue : T.separator,
       position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0
      }}
     >
      <div style={{
       width: 18, height: 18, borderRadius: "50%", background: "#fff",
       position: "absolute", top: 2, left: buyerPaysComm ? 20 : 2,
       transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
      }} />
     </button>
    </div>
    {buyerPaysComm && (
     <>
      <Inp label="Commission Rate" value={buyerCommPct} onChange={setBuyerCommPct} prefix="" suffix="%" step={0.1} max={10} sm />
      <MRow label="Buyer Agent Commission" value={fmt(calc.buyerCommAmt)} sub={`${buyerCommPct}% of ${fmt(salesPrice)}`} color={T.orange} />
     </>
    )}
   </div>
   <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
    <MRow label="Total Other Costs" value={fmt2(calc.sectionH)} bold />
   </div>
  </Card>
 </Sec>
 )}

 {/* ── CLOSING COSTS SUBTOTAL (mobile only — desktop shows in left column) ── */}
 {!isDesktop && <Card style={{ background: `${T.blue}10`, border: `1px solid ${T.blue}25` }}>
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
   {[["A. Lender Fees", fmt2(calc.origCharges)], ["B. Cannot Shop", fmt2(calc.cannotShop)], ["C. Can Shop", fmt2(calc.canShop)], ["D. Government", fmt2(calc.govCharges)], ...(!isRefi ? [["H. Other Costs", fmt2(calc.sectionH)]] : [])].map(([l, v], i) => (
    <div key={i} style={{ padding: "6px 12px", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
     <span style={{ color: T.textSecondary }}>{l}</span>
     <span style={{ fontWeight: 600, fontFamily: FONT }}>{v}</span>
    </div>
   ))}
  </div>
  <div style={{ borderTop: `2px solid ${T.blue}40`, marginTop: 6, paddingTop: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between" }}>
   <span style={{ fontWeight: 700, fontSize: 14, color: T.blue }}>Total Closing Costs</span>
   <span style={{ fontWeight: 700, fontSize: 14, fontFamily: FONT, color: T.blue }}>{fmt(calc.totalClosingCosts)}</span>
  </div>
 </Card>}

 {/* ── E. PREPAIDS & ESCROW ── */}
 <Sec title="E. Prepaids">
  <Card>
   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
    <Sel label="Closing Month" value={closingMonth} onChange={v => setClosingMonth(parseInt(v))} options={[{value:1,label:"January"},{value:2,label:"February"},{value:3,label:"March"},{value:4,label:"April"},{value:5,label:"May"},{value:6,label:"June"},{value:7,label:"July"},{value:8,label:"August"},{value:9,label:"September"},{value:10,label:"October"},{value:11,label:"November"},{value:12,label:"December"}]} sm />
    <Sel label="Closing Day" value={closingDay} onChange={v => setClosingDay(parseInt(v))} options={Array.from({length: new Date(new Date().getFullYear(), closingMonth, 0).getDate()}, (_,i) => ({value:i+1,label:String(i+1)}))} sm />
   </div>
   <MRow label="Prepaid Interest" value={fmt2(calc.prepaidInt)} sub={`${calc.autoPrepaidDays} days × ${fmt2(calc.dailyInt)}/day`} />
   <Inp label="Homeowner's Insurance (Annual)" value={annualIns} onChange={setAnnualIns} suffix="/yr" sm />
   <MRow label="Hazard Insurance Premium (12 mo)" value={fmt2(annualIns)} sub={`${fmt2(annualIns / 12)}/mo × 12`} />
   <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
    <MRow label="Total Prepaids" value={fmt2(calc.prepaidInt + annualIns)} bold />
   </div>
  </Card>
 </Sec>

 {includeEscrow && <Sec title="F. Initial Escrow Payment at Closing">
  <Card>
   <MRow label={`Property Tax Reserve (${calc.escrowTaxMonths} mo)`} value={fmt2(calc.monthlyTax * calc.escrowTaxMonths)} sub={`${fmt(calc.monthlyTax)}/mo × ${calc.escrowTaxMonths}`} />
   <MRow label={`Hazard Insurance Reserve (${calc.escrowInsMonths} mo)`} value={fmt2(calc.ins * calc.escrowInsMonths)} sub={`${fmt(calc.ins)}/mo × ${calc.escrowInsMonths}`} />
   {calc.monthlyMI > 0 && <MRow label="Mortgage Insurance Reserve" value={fmt2(calc.monthlyMI * 2)} sub={`${fmt(calc.monthlyMI)}/mo × 2`} />}
   <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
    <MRow label="Total Initial Escrow" value={fmt2(calc.initialEscrow)} bold />
   </div>
   <Note color={T.blue}>Closing in {["January","February","March","April","May","June","July","August","September","October","November","December"][closingMonth-1]} → {calc.escrowTaxMonths} months property tax + {calc.escrowInsMonths} months insurance held in escrow.</Note>
  </Card>
 </Sec>}
 {!includeEscrow && <Card style={{ background: `${T.orange}10`, border: `1px solid ${T.orange}25` }}>
  <Note color={T.orange}>Escrow waived — no initial escrow collected at closing. Tax & insurance paid separately by borrower.</Note>
 </Card>}

 {/* ── FIRST PAYMENT EXPLAINER ── */}
 {(() => {
   const mos = ["January","February","March","April","May","June","July","August","September","October","November","December"];
   const shortMos = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
   const cm = closingMonth - 1;
   const skipMo = mos[(cm + 1) % 12];
   const firstPmtMo = mos[(cm + 2) % 12];
   const daysRemaining = calc.autoPrepaidDays - 1;
   return <Card style={{ background: `${T.blue}08`, border: `1px solid ${T.blue}18` }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: T.blue, marginBottom: 8 }}>When Is My First Payment?</div>
    <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6 }}>
     <div style={{ marginBottom: 6 }}>You close on <strong>{shortMos[cm]} {closingDay}</strong>. We collect {daysRemaining} days remaining in {mos[cm]} + 1 day in {mos[(cm + 1) % 12]} = <strong>{calc.autoPrepaidDays} days</strong> of prepaid interest.</div>
     <div style={{ marginBottom: 6 }}>You have <strong>no mortgage payment in {skipMo}</strong> — your first full month of ownership.</div>
     <div style={{ marginBottom: 6 }}>Your first payment is due <strong>{firstPmtMo} 1st</strong>, and isn't considered late until after <strong>{firstPmtMo} 15th</strong>.</div>
     <div style={{ background: `${T.green}12`, borderRadius: 8, padding: "8px 10px", marginTop: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.green }}>That's ~{closingDay <= 15 ? "1.5 to 2" : "1 to 1.5"} months with no mortgage payment after closing!</span>
     </div>
    </div>
   </Card>;
 })()}

 {/* ── G. CREDITS ── */}
 <Sec title="G. Credits">
  <Card>
   {isRefi ? (<>
    <Inp label="Lender Credit" value={lenderCredit} onChange={setLenderCredit} sm tip="Credit from the lender, usually in exchange for a slightly higher interest rate. Reduces your out-of-pocket closing costs." />
   </>) : (<>
    <Inp label="Seller Credit" value={sellerCredit} onChange={setSellerCredit} sm tip="Money the seller agrees to pay toward your closing costs. Negotiate this in your purchase offer. Max allowed varies by loan type." />
    <Inp label="Lender Credit" value={lenderCredit} onChange={setLenderCredit} sm tip="Credit from the lender, usually in exchange for a slightly higher interest rate. Reduces your out-of-pocket closing costs." />
    <Inp label="Realtor Credit" value={realtorCredit} onChange={setRealtorCredit} sm tip="Commission rebate from your buyer's agent applied toward your closing costs." />
    <Inp label="EMD (Earnest Money Deposit)" value={emd} onChange={setEmd} sm tip="Good-faith deposit submitted with your offer. Credited back to you at closing — reduces cash needed." />
   </>)}
   <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
    <MRow label="Total Credits" value={`-${fmt(calc.totalCredits)}`} color={T.green} bold />
   </div>
  </Card>
 </Sec>

 {/* ── ESTIMATED FUNDS TO CLOSE (mobile only — desktop shows in left column) ── */}
 {!isDesktop && (
 <Card style={{ background: T.successBg, border: `1px solid ${T.green}30` }}>
  <div style={{ fontSize: 12, fontWeight: 700, color: T.green, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>{isRefi ? "Estimated Refi Costs" : "Estimated Funds to Close"}</div>
  {!isRefi && <MRow label="Down Payment" value={fmt(calc.dp)} />}
  <MRow label={isRefi ? "A\u2013D. Total Closing Costs" : "A\u2013D,H. Total Closing Costs"} value={fmt(calc.totalClosingCosts)} />
  <MRow label={includeEscrow ? "E\u2013F. Prepaids & Escrow" : "E. Prepaids"} value={fmt(calc.totalPrepaidExp)} />
  {calc.totalCredits > 0 && <MRow label="G. Credits Applied" value={`-${fmt(calc.totalCredits)}`} color={T.green} />}
  <div style={{ borderTop: `2px solid ${T.green}40`, marginTop: 8, paddingTop: 8 }}>
   <MRow label={isRefi ? "TOTAL REFI COSTS" : "ESTIMATED CASH FROM BORROWER"} value={fmt(isRefi ? calc.totalClosingCosts + calc.totalPrepaidExp - calc.totalCredits : calc.cashToClose)} color={T.green} bold />
  </div>
 </Card>
 )}
 </div>{/* end costs right column */}
 </div>{/* end costs desktop flex wrapper */}
 <GuidedNextButton />
</>);
}
