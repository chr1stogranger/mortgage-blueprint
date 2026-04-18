import React, { useState, useContext, createContext, useMemo } from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

// ──────────────────────────────────────────────────────────────
// Context lets the Arive-style sub-components (AriveBox, FeeRow,
// SubHead) live at MODULE scope rather than being re-declared on
// every render of CostsContent. Re-declaring them inside the
// functional component creates new function identities each render,
// which causes React to unmount/remount the children — including
// live <input> fields, dropping focus mid-keystroke.
// ──────────────────────────────────────────────────────────────
const CostsCtx = createContext(null);

function AriveBox({ title, total, children, footer, highlightTotal = true }) {
  const { T, ACCENT, HEAD_BG, HEAD_BORDER, BODY_BORDER } = useContext(CostsCtx);
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${BODY_BORDER}`,
      borderRadius: 14,
      overflow: "hidden",
      marginBottom: 12,
      display: "flex",
      flexDirection: "column",
      height: "100%",
    }}>
      <div style={{
        background: HEAD_BG,
        borderBottom: `1px solid ${HEAD_BORDER}`,
        padding: "12px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: "-0.01em" }}>{title}</div>
        {total !== undefined && (
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: MONO, color: highlightTotal ? ACCENT : T.text }}>{total}</div>
        )}
      </div>
      <div style={{ padding: "10px 16px 12px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1 }}>{children}</div>
        {footer && <div style={{ marginTop: 12 }}>{footer}</div>}
      </div>
    </div>
  );
}

function SubHead({ children }) {
  const { T } = useContext(CostsCtx);
  return (
    <div style={{
      fontSize: 12,
      fontWeight: 700,
      color: T.text,
      padding: "8px 0 6px",
      letterSpacing: "-0.01em",
    }}>{children}</div>
  );
}

function FeeRow({ label, sub, value, editKey, onChange, editor, suffix = null, prefix = "$", bold = false, color, step = 1, max, isDollar = true, note, readOnly = false }) {
  const { T, ACCENT, fmt2, openRow, toggleRow, Inp } = useContext(CostsCtx);
  const isOpen = editKey && openRow === editKey;
  const displayVal = isDollar ? (value === 0 ? "$0.00" : fmt2(value)) : value;
  return (
    <div style={{ borderBottom: `1px dashed ${T.separator}`, paddingBottom: 2 }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 0",
        minHeight: 28,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          {editKey && !readOnly && (
            <button
              onClick={() => toggleRow(editKey)}
              aria-label={`Edit ${label}`}
              style={{
                width: 18, height: 18, borderRadius: 4,
                border: `1px solid ${isOpen ? ACCENT : T.inputBorder}`,
                background: isOpen ? ACCENT : "transparent",
                color: isOpen ? "#fff" : T.textSecondary,
                fontSize: 14, lineHeight: 1, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", padding: 0, flexShrink: 0,
                transition: "all 0.15s",
              }}
            >{isOpen ? "−" : "+"}</button>
          )}
          <div style={{ fontSize: 13, color: bold ? T.text : T.textSecondary, fontWeight: bold ? 700 : 500, lineHeight: 1.3 }}>
            <span>{label}</span>
            {sub && <span style={{ color: T.textTertiary, fontSize: 11, marginLeft: 6, fontFamily: MONO }}>{sub}</span>}
          </div>
        </div>
        <div style={{
          fontSize: 13,
          fontWeight: bold ? 700 : 600,
          fontFamily: MONO,
          color: color || T.text,
          flexShrink: 0,
          marginLeft: 10,
        }}>{displayVal}</div>
      </div>
      {isOpen && (
        <div style={{ padding: "4px 0 10px 26px" }}>
          {editor ? editor : (
            <Inp label={label} value={value} onChange={onChange} suffix={suffix} prefix={prefix} step={step} max={max} sm />
          )}
          {note && <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 4 }}>{note}</div>}
        </div>
      )}
    </div>
  );
}

// Small inline toggle row — used for escrow on/off under Property Taxes
function ToggleRow({ label, hint, on, onChange }) {
  const { T, ACCENT } = useContext(CostsCtx);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px dashed ${T.separator}` }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 1 }}>{hint}</div>}
      </div>
      <button
        onClick={() => onChange(!on)}
        aria-label={label}
        style={{
          width: 40, height: 22, borderRadius: 9999, border: "none",
          background: on ? ACCENT : T.separator,
          position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: "50%", background: "#fff",
          position: "absolute", top: 2, left: on ? 20 : 2,
          transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </button>
    </div>
  );
}

export default function CostsContent({
  T, isDesktop, calc, fmt, fmt2,
  isRefi, downPct,
  underwritingFee, setUnderwritingFee,
  processingFee, setProcessingFee,
  discountPts, setDiscountPts,
  originatorComp, setOriginatorComp,
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
  includeEscrow, setIncludeEscrow,
  lenderCredit, setLenderCredit,
  sellerCredit, setSellerCredit,
  realtorCredit, setRealtorCredit,
  emd, setEmd,
  Hero, Card, Sec, Inp, Sel, Note, MRow,
  GuidedNextButton,
}) {
  const [openRow, setOpenRow] = useState(null);
  const toggleRow = (key) => setOpenRow(openRow === key ? null : key);

  const ACCENT = T.blue;
  const HEAD_BG = `${ACCENT}14`;
  const HEAD_BORDER = `${ACCENT}38`;
  const BODY_BORDER = T.cardBorder;

  // Stable context value — memoized by values that actually change.
  const ctx = useMemo(() => ({
    T, ACCENT, HEAD_BG, HEAD_BORDER, BODY_BORDER,
    fmt2, openRow, toggleRow, Inp,
  }), [T, ACCENT, HEAD_BG, HEAD_BORDER, BODY_BORDER, fmt2, openRow, Inp]);

  // Live-computed buyer commission (defensive — don't trust calc if stale)
  const liveBuyerComm = buyerPaysComm ? salesPrice * (buyerCommPct / 100) : 0;

  // Derived numbers
  const escrowHOI_reserve = includeEscrow ? calc.ins * calc.escrowInsMonths : 0;
  const escrowTax_reserve = includeEscrow ? calc.monthlyTax * calc.escrowTaxMonths : 0;
  const escrowMI_reserve = includeEscrow && calc.monthlyMI > 0 ? calc.monthlyMI * 2 : 0;
  const proposedTax_atClosing = includeEscrow ? calc.monthlyTax * calc.escrowTaxMonths : 0;
  const thirdPartyTotal = calc.cannotShop + calc.canShop + (isRefi ? 0 : (ownersTitleIns + homeWarranty + (hoa > 0 ? (hoaTransferFee > 0 ? hoaTransferFee : hoa) : 0) + liveBuyerComm));

  // Monthly pieces
  const firstMortgagePI = calc.pi || 0;
  const monthlyMI = calc.monthlyMI || 0;
  const monthlyTax = calc.monthlyTax || 0;
  const monthlyIns = calc.ins || 0;
  const monthlyTotal = calc.displayPayment || (firstMortgagePI + monthlyMI + monthlyTax + monthlyIns + (hoa || 0));

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const monthOptions = monthNames.map((m, i) => ({ value: i + 1, label: m }));
  const dayOptions = Array.from({ length: new Date(new Date().getFullYear(), closingMonth, 0).getDate() }, (_, i) => ({ value: i + 1, label: String(i + 1) }));

  return (
    <CostsCtx.Provider value={ctx}>
      {/* Hero — total cash to close */}
      <div style={{ marginTop: 20, marginBottom: 16 }}>
        <Hero
          value={fmt(isRefi ? calc.totalClosingCosts + calc.totalPrepaidExp - calc.totalCredits : calc.cashToClose)}
          label={isRefi ? "Estimated Refi Costs" : "Estimated Cash to Close"}
          color={ACCENT}
        />
      </div>

      {/* 2-column Arive-style grid */}
      <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "stretch" } : {}}>

        {/* ─── BOX 1: Lender Fees ─────────────────────────── */}
        <AriveBox title="Lender Fees" total={fmt2(calc.origCharges)}>
          <FeeRow
            label={discountPts > 0 ? `${discountPts}% of Loan Amount (Points)` : "__% of Loan Amount (Points)"}
            editKey="points"
            value={calc.pointsCost}
            editor={
              <>
                <Inp label="Discount Points" value={discountPts} onChange={setDiscountPts} prefix="" suffix="pts" step={0.125} max={10} sm tip="1 point = 1% of loan amount. Typically reduces rate by ~0.25%." />
                <div style={{ fontSize: 11, color: T.textTertiary }}>{discountPts} pts × {fmt(calc.loan)} = {fmt2(calc.pointsCost)}</div>
              </>
            }
          />
          <FeeRow
            label="Originator Compensation"
            editKey="origComp"
            value={originatorComp}
            onChange={setOriginatorComp}
          />
          <FeeRow
            label="Underwriting Fee"
            editKey="underwriting"
            value={underwritingFee}
            onChange={setUnderwritingFee}
          />
          {processingFee > 0 && (
            <FeeRow label="Processing Fee" editKey="processing" value={processingFee} onChange={setProcessingFee} />
          )}
        </AriveBox>

        {/* ─── BOX 2: Taxes & Other Government Fees ────────── */}
        <AriveBox title="Taxes and Other Government Fees" total={fmt2(calc.govCharges)}>
          <FeeRow
            label="Recording Fees"
            editKey="recording"
            value={recordingFee}
            onChange={setRecordingFee}
          />
          <FeeRow
            label="Transfer Taxes"
            editKey="transferTax"
            value={calc.buyerCityTT + calc.buyerCountyTT}
            readOnly
            sub={!isRefi && calc.ttEntry && calc.ttEntry.rate > 0 ? `$${calc.ttEntry.rate}/$1K` : null}
            editor={!isRefi ? (
              <>
                <Sel
                  label="City Transfer Tax"
                  value={transferTaxCity}
                  onChange={setTransferTaxCity}
                  options={getTTCitiesForState(propertyState).map(c => ({ value: c, label: c === "Not listed" ? "Not listed" : `${c} ($${getTTForCity(c, salesPrice).rate}/$1K)` }))}
                  tip="Government tax when property changes hands."
                />
                <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 4 }}>
                  Buyer portion (50%): {fmt2(calc.buyerCityTT)}
                  {transferTaxCity === "San Francisco" && " — SF: Seller customarily pays 100%"}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: T.blue }}>No transfer tax on refinances in California.</div>
            )}
          />
        </AriveBox>

        {/* ─── BOX 3: Third Party Fees ───────────────────── */}
        <AriveBox title="Third Party Fees" total={fmt2(thirdPartyTotal)}>
          <SubHead>Services You Cannot Shop For</SubHead>
          <FeeRow label="Appraisal Fee" editKey="appraisal" value={appraisalFee} onChange={setAppraisalFee} />
          <FeeRow label="Credit Report Fee" editKey="credit" value={creditReportFee} onChange={setCreditReportFee} />
          <FeeRow label="Flood Certificate Fee" editKey="flood" value={floodCertFee} onChange={setFloodCertFee} />
          <FeeRow label="MERS Registration Fee" editKey="mers" value={mersFee} onChange={setMersFee} />
          <FeeRow label="Tax Service Fee" editKey="taxsvc" value={taxServiceFee} onChange={setTaxServiceFee} />

          {isRefi ? (
            <>
              <SubHead>Services You Can Shop For</SubHead>
              <FeeRow label="Title / Escrow Flat Fee" editKey="escrowRefi" value={escrowFee} onChange={setEscrowFee} note="Refinances use a flat title/escrow fee." />
            </>
          ) : (
            <>
              <SubHead>Services You Can Shop For</SubHead>
              <FeeRow label="Title — Insurance Binder" editKey="titleIns" value={titleInsurance} onChange={setTitleInsurance} />
              <FeeRow label="Title — Settlement Agent Fee" editKey="settlement" value={settlementFee} onChange={setSettlementFee} />
              <FeeRow label="Title — Title Search" editKey="titleSearch" value={titleSearch} onChange={setTitleSearch} />
              <FeeRow label="Title — Escrow/Settlement Fee" editKey="escrow" value={escrowFee} onChange={setEscrowFee} />
              {calc.hoaCert > 0 && <FeeRow label="HOA Certification" value={calc.hoaCert} sub="Condo/TH" />}
            </>
          )}

          {!isRefi && (
            <>
              <SubHead>Other Costs</SubHead>
              <FeeRow label="Owner's Title Insurance" editKey="ownersTitle" value={ownersTitleIns} onChange={setOwnersTitleIns} />
              <FeeRow label="Home Warranty" editKey="warranty" value={homeWarranty} onChange={setHomeWarranty} />
              {hoa > 0 && (
                <FeeRow
                  label="HOA Transfer Fee"
                  editKey="hoaTransfer"
                  value={hoaTransferFee > 0 ? hoaTransferFee : hoa}
                  onChange={setHoaTransferFee}
                  sub={hoaTransferFee === 0 ? "Auto: 1 mo HOA" : null}
                />
              )}
              <ToggleRow
                label="Buyer Pays Agent Commission"
                hint="Toggle on if buyer is responsible for their agent's fee"
                on={buyerPaysComm}
                onChange={setBuyerPaysComm}
              />
              {buyerPaysComm && (
                <FeeRow
                  label="Buyer Agent Commission"
                  editKey="buyerComm"
                  value={liveBuyerComm}
                  sub={`${buyerCommPct}% × ${fmt(salesPrice)}`}
                  editor={
                    <>
                      <Inp label="Commission Rate" value={buyerCommPct} onChange={setBuyerCommPct} prefix="" suffix="%" step={0.1} max={10} sm />
                      <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 4 }}>
                        {buyerCommPct}% × {fmt(salesPrice)} = <strong>{fmt2(liveBuyerComm)}</strong>
                      </div>
                    </>
                  }
                />
              )}
            </>
          )}
        </AriveBox>

        {/* ─── BOX 4: Prepaids & Initial Escrow ─────────── */}
        <AriveBox title="Prepaids and Initial Escrow Payment at Closing" total={fmt2(calc.totalPrepaidExp)}>
          <SubHead>Prepaids</SubHead>
          <FeeRow
            label={`Hazard Insurance Premium (12 Months @ ${fmt2(annualIns / 12)})`}
            editKey="hoi"
            value={annualIns}
            onChange={setAnnualIns}
          />
          {monthlyMI > 0 && (
            <FeeRow
              label="Mortgage Insurance Premium"
              value={0}
              sub="— mo @ —"
              readOnly
            />
          )}
          <FeeRow
            label={`Prepaid Interest (${calc.autoPrepaidDays} Days @ ${fmt2(calc.dailyInt)})`}
            value={calc.prepaidInt}
            editKey="closeDate"
            readOnly
            editor={
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Sel label="Closing Month" value={closingMonth} onChange={v => setClosingMonth(parseInt(v))} options={monthOptions} sm />
                  <Sel label="Closing Day" value={closingDay} onChange={v => setClosingDay(parseInt(v))} options={dayOptions} sm />
                </div>
                <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 4 }}>
                  Daily interest: {fmt2(calc.dailyInt)} × {calc.autoPrepaidDays} days = {fmt2(calc.prepaidInt)}
                </div>
              </>
            }
          />
          {includeEscrow && (
            <FeeRow
              label={`Property Taxes (${calc.escrowTaxMonths} Months @ ${fmt2(monthlyTax)})`}
              value={proposedTax_atClosing}
              readOnly
            />
          )}
          <ToggleRow
            label="Include Escrow Impounds"
            hint="Toggle OFF to waive escrow — no property tax or insurance reserves collected at closing"
            on={includeEscrow}
            onChange={setIncludeEscrow}
          />

          <SubHead>Initial Escrow Payment at Closing</SubHead>
          {!includeEscrow ? (
            <div style={{ padding: "8px 0", fontSize: 12, color: T.textSecondary }}>
              Escrow waived — taxes and insurance paid separately by borrower.
            </div>
          ) : (
            <>
              <FeeRow label="Aggregate Adjustment" value="—" isDollar={false} />
              <FeeRow
                label={`Hazard Insurance Reserve (${calc.escrowInsMonths} Months @ ${fmt2(monthlyIns)})`}
                value={escrowHOI_reserve}
                readOnly
              />
              {monthlyMI > 0 ? (
                <FeeRow
                  label={`Mortgage Insurance Reserve (2 Months @ ${fmt2(monthlyMI)})`}
                  value={escrowMI_reserve}
                  readOnly
                />
              ) : (
                <FeeRow label="Mortgage Insurance Reserve" value="—" isDollar={false} />
              )}
              <FeeRow
                label={`Property Taxes (${calc.escrowTaxMonths} Months @ ${fmt2(monthlyTax)})`}
                value={escrowTax_reserve}
                readOnly
              />
            </>
          )}
        </AriveBox>

        {/* ─── BOX 5: Estimated Proposed Monthly Housing Expense ── */}
        <AriveBox
          title="Estimated Proposed Monthly Housing Expense"
          total={undefined}
          footer={
            <div style={{
              padding: "12px 14px",
              border: `1.5px solid ${ACCENT}`,
              borderRadius: 10,
              background: HEAD_BG,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Total Estimated Monthly Payment
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: MONO, color: ACCENT }}>
                {fmt2(monthlyTotal)}
              </div>
            </div>
          }
        >
          <FeeRow label="First Mortgage P&I" value={firstMortgagePI} readOnly />
          <FeeRow label="Other Financing P&I" value={0} readOnly />
          <FeeRow label="Homeowner's Insurance" value={monthlyIns} readOnly />
          <FeeRow label="Supplemental Property Insurance" value={0} readOnly />
          <FeeRow label="Property Taxes" value={monthlyTax} readOnly />
          <FeeRow label="Mortgage Insurance" value={monthlyMI} readOnly />
          <FeeRow label="Homeowner Assn. Dues" value={hoa || 0} readOnly />
          <FeeRow label="Other" value={0} readOnly />
        </AriveBox>

        {/* ─── BOX 6: Estimated Funds To Close ─────────── */}
        <AriveBox
          title={isRefi ? "Estimated Refi Costs" : "Estimated Funds To Close"}
          total={undefined}
          footer={
            <div style={{
              padding: "12px 14px",
              border: `1.5px solid ${ACCENT}`,
              borderRadius: 10,
              background: HEAD_BG,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {isRefi ? "Total Refi Costs" : "Cash From Borrower (A−B)"}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: MONO, color: ACCENT }}>
                {fmt2(isRefi ? calc.totalClosingCosts + calc.totalPrepaidExp - calc.totalCredits : calc.cashToClose)}
              </div>
            </div>
          }
        >
          {!isRefi && <FeeRow label="Downpayment / Funds from Borrower" value={calc.dp} bold readOnly />}
          <FeeRow label="Lender Fees" value={calc.origCharges} readOnly />
          <FeeRow label="Third Party Fees" value={thirdPartyTotal} readOnly />
          <FeeRow label="Taxes and Other Government Fees" value={calc.govCharges} readOnly />
          <FeeRow label="Prepaids and Initial Escrow" value={calc.totalPrepaidExp} readOnly />
          <FeeRow label="Estimated Total Payoffs" value={0} readOnly />

          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: `2px solid ${T.separator}`, marginTop: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Funds Due From Borrower (A)</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: MONO, color: T.text }}>
              {fmt2((isRefi ? 0 : calc.dp) + calc.origCharges + thirdPartyTotal + calc.govCharges + calc.totalPrepaidExp)}
            </div>
          </div>

          <FeeRow label="Deposit (EMD)" editKey="emd" value={isRefi ? 0 : emd} onChange={setEmd} readOnly={isRefi} />
          <FeeRow label="Lender Credits" editKey="lenderCredit" value={lenderCredit} onChange={setLenderCredit} />
          {!isRefi && (
            <>
              <FeeRow label="Seller Credits" editKey="sellerCredit" value={sellerCredit} onChange={setSellerCredit} />
              <FeeRow label="Realtor Credit" editKey="realtorCredit" value={realtorCredit} onChange={setRealtorCredit} />
            </>
          )}
          <FeeRow label="Adjustments and Other Credits" value={0} readOnly />
          <FeeRow label="Subordinate Financing" value={0} readOnly />

          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: `2px solid ${T.separator}`, marginTop: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Total Credits Applied (B)</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: MONO, color: T.green }}>−{fmt2(calc.totalCredits)}</div>
          </div>
        </AriveBox>

      </div>

      {/* First-payment explainer */}
      {(() => {
        const cm = closingMonth - 1;
        const shortMos = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const skipMo = monthNames[(cm + 1) % 12];
        const firstPmtMo = monthNames[(cm + 2) % 12];
        const daysRemaining = calc.autoPrepaidDays - 1;
        return (
          <Card style={{ background: `${T.blue}08`, border: `1px solid ${T.blue}18`, marginTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.blue, marginBottom: 8 }}>When Is My First Payment?</div>
            <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6 }}>
              <div style={{ marginBottom: 6 }}>You close on <strong>{shortMos[cm]} {closingDay}</strong>. We collect {daysRemaining} days remaining in {monthNames[cm]} + 1 day in {monthNames[(cm + 1) % 12]} = <strong>{calc.autoPrepaidDays} days</strong> of prepaid interest.</div>
              <div style={{ marginBottom: 6 }}>You have <strong>no mortgage payment in {skipMo}</strong> — your first full month of ownership.</div>
              <div style={{ marginBottom: 6 }}>Your first payment is due <strong>{firstPmtMo} 1st</strong>, and isn't considered late until after <strong>{firstPmtMo} 15th</strong>.</div>
              <div style={{ background: `${T.green}12`, borderRadius: 8, padding: "8px 10px", marginTop: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.green }}>That's ~{closingDay <= 15 ? "1.5 to 2" : "1 to 1.5"} months with no mortgage payment after closing!</span>
              </div>
            </div>
          </Card>
        );
      })()}

      <GuidedNextButton />
    </CostsCtx.Provider>
  );
}
