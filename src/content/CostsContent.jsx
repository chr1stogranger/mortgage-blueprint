import React, { useState, useContext, createContext, useMemo } from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

// ──────────────────────────────────────────────────────────────
// Context lets the Arive-style sub-components (CollapsibleBox,
// FeeRow, LetterSection) live at MODULE scope rather than being
// re-declared on every render of CostsContent. Re-declaring them
// inside the functional component creates new function identities
// each render, which causes React to unmount/remount the children —
// including live <input> fields, dropping focus mid-keystroke.
// ──────────────────────────────────────────────────────────────
const CostsCtx = createContext(null);

// Master collapsible "card" — replaces AriveBox for top-level groups.
// Header is a button that toggles open/closed. Total stays visible
// in the header even when collapsed (Linear/Vercel pattern).
function CollapsibleBox({ title, total, totalColor, defaultOpen = true, children }) {
  const { T, ACCENT, HEAD_BG, HEAD_BORDER, BODY_BORDER } = useContext(CostsCtx);
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${BODY_BORDER}`,
      borderRadius: 14,
      overflow: "hidden",
      marginBottom: 12,
    }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          width: "100%",
          background: HEAD_BG,
          borderBottom: open ? `1px solid ${HEAD_BORDER}` : "none",
          padding: "14px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          border: "none",
          cursor: "pointer",
          fontFamily: FONT,
          textAlign: "left",
          transition: "background 0.15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span aria-hidden style={{
            display: "inline-block",
            width: 0,
            height: 0,
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderTop: `6px solid ${ACCENT}`,
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.15s ease",
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: T.text,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontFamily: MONO,
          }}>{title}</span>
        </div>
        {total !== undefined && (
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            fontFamily: MONO,
            color: totalColor || ACCENT,
            flexShrink: 0,
          }}>{total}</div>
        )}
      </button>
      {open && (
        <div style={{ padding: "10px 18px 14px" }}>{children}</div>
      )}
    </div>
  );
}

// Lettered subsection inside a CollapsibleBox (A. Origination, B. Cannot Shop, etc.)
function LetterSection({ letter, title, total, children }) {
  const { T } = useContext(CostsCtx);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "6px 0",
        borderBottom: `1px solid ${T.separator}`,
        marginBottom: 2,
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: T.text,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontFamily: MONO,
        }}>
          <span style={{ color: T.textTertiary, marginRight: 8 }}>{letter}.</span>
          {title}
        </div>
        {total !== undefined && (
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: T.text }}>
            {total}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// Computed-total row (e.g. D. Total Loan Costs A+B+C) — looks like a band, not a fee row.
function TotalBand({ letter, title, total }) {
  const { T, ACCENT } = useContext(CostsCtx);
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 12px",
      marginBottom: 14,
      background: `${ACCENT}10`,
      border: `1px solid ${ACCENT}30`,
      borderRadius: 8,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: ACCENT,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        fontFamily: MONO,
      }}>
        <span style={{ marginRight: 8 }}>{letter}.</span>
        {title}
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: MONO, color: ACCENT }}>{total}</div>
    </div>
  );
}

function FeeRow({ label, sub, value, editKey, onChange, editor, suffix = null, prefix = "$", bold = false, color, step = 1, max, isDollar = true, note, readOnly = false, calc, explainer }) {
  const { T, ACCENT, fmt2, openRow, toggleRow, Inp } = useContext(CostsCtx);
  const isOpen = editKey && openRow === editKey;
  const displayVal = isDollar ? (value === 0 ? "$0.00" : fmt2(value)) : value;
  const hasIndentBtn = editKey && !readOnly;
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
          {hasIndentBtn && (
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
      {(calc || explainer) && (
        <div style={{
          paddingLeft: hasIndentBtn ? 26 : 0,
          paddingBottom: 6,
          marginTop: -3,
          fontSize: 11,
          color: T.textTertiary,
          lineHeight: 1.4,
        }}>
          {calc && <span style={{ fontFamily: MONO }}>{calc}</span>}
          {calc && explainer && <span style={{ margin: "0 6px", color: T.separator }}>·</span>}
          {explainer && <span style={{ fontStyle: "italic" }}>{explainer}</span>}
        </div>
      )}
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

// Small inline toggle row — used for escrow on/off and buyer-pays-comm
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

// Cash-to-Close summary table (top of fees) — brand-kit styled.
// Sums Down Payment + Closing Costs + Prepaids + Payoffs − Credits.
function CashToCloseSummary({ T, ACCENT, fmt2, downPayment, closingCosts, prepaids, payoffs, credits, isRefi }) {
  const total = (isRefi ? 0 : downPayment) + closingCosts + prepaids + payoffs - credits;
  const rows = [
    !isRefi && { label: "Down Payment",         sign: "+", value: downPayment },
    { label: "Closing Costs",         sign: "+", value: closingCosts },
    { label: "Prepaid Expenses",      sign: "+", value: prepaids },
    { label: "Loans / Debts to Payoff", sign: "+", value: payoffs },
    { label: "Credits To Buyer",      sign: "−", value: credits },
  ].filter(Boolean);

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.cardBorder}`,
      borderRadius: 14,
      overflow: "hidden",
      marginBottom: 16,
      boxShadow: `0 0 0 1px ${ACCENT}10`,
    }}>
      {/* Header band */}
      <div style={{
        background: `linear-gradient(135deg, ${ACCENT}18, ${ACCENT}0c)`,
        borderBottom: `1px solid ${ACCENT}38`,
        padding: "12px 18px",
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: ACCENT,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontFamily: MONO,
        }}>
          Cash To Close Summary
        </div>
      </div>

      {/* Rows */}
      <div style={{ padding: "4px 18px 0" }}>
        {rows.map((r) => (
          <div key={r.label} style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "11px 0",
            borderBottom: `1px solid ${T.separator}`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.text, fontFamily: FONT }}>
              {r.label}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{
                fontFamily: MONO,
                fontSize: 13,
                color: r.sign === "−" ? T.green : T.textTertiary,
                fontWeight: 700,
                width: 12,
                textAlign: "center",
              }}>{r.sign}</span>
              <span style={{
                fontFamily: MONO,
                fontSize: 14,
                fontWeight: 600,
                color: T.text,
                minWidth: 110,
                textAlign: "right",
              }}>{fmt2(r.value)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Total band */}
      <div style={{
        background: `${ACCENT}0E`,
        borderTop: `1.5px solid ${ACCENT}40`,
        padding: "16px 18px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          color: ACCENT,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontFamily: MONO,
        }}>
          Estimated {isRefi ? "Refi Cost" : "Cash To Close"}
        </div>
        <div style={{
          fontFamily: MONO,
          fontSize: 22,
          fontWeight: 800,
          color: ACCENT,
          letterSpacing: "-0.02em",
        }}>{fmt2(total)}</div>
      </div>
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

  // H. Other (purchase only) — Owner's Title, Warranty, HOA Transfer, Buyer Comm
  const otherCostsTotal = isRefi ? 0 : (
    ownersTitleIns + homeWarranty +
    (hoa > 0 ? (hoaTransferFee > 0 ? hoaTransferFee : hoa) : 0) +
    liveBuyerComm
  );

  // D. Total Loan Costs = A + B + C
  const totalLoanCosts = calc.origCharges + calc.cannotShop + calc.canShop;

  // Total Closing Costs = A + B + C + E + H
  const totalClosingCosts = totalLoanCosts + calc.govCharges + otherCostsTotal;

  // Monthly pieces (used inside Prepaids labels)
  const monthlyMI = calc.monthlyMI || 0;
  const monthlyTax = calc.monthlyTax || 0;
  const monthlyIns = calc.ins || 0;

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const monthOptions = monthNames.map((m, i) => ({ value: i + 1, label: m }));
  const dayOptions = Array.from({ length: new Date(new Date().getFullYear(), closingMonth, 0).getDate() }, (_, i) => ({ value: i + 1, label: String(i + 1) }));

  return (
    <CostsCtx.Provider value={ctx}>
      {/* Cash To Close Summary — top of fees, brand-kit styled */}
      <div style={{ marginTop: 20 }}>
        <CashToCloseSummary
          T={T}
          ACCENT={ACCENT}
          fmt2={fmt2}
          downPayment={isRefi ? 0 : calc.dp}
          closingCosts={totalClosingCosts}
          prepaids={calc.totalPrepaidExp}
          payoffs={0}
          credits={calc.totalCredits}
          isRefi={isRefi}
        />
      </div>

      {/* ─── MASTER 1: Closing Costs (default OPEN) ──────────────── */}
      <CollapsibleBox title="Closing Costs" total={fmt2(totalClosingCosts)} defaultOpen={true}>

        {/* A. Origination Charges */}
        <LetterSection letter="A" title="Origination Charges" total={fmt2(calc.origCharges)}>
          <FeeRow
            label={discountPts > 0 ? `${discountPts}% of Loan Amount (Points)` : "__% of Loan Amount (Points)"}
            editKey="points"
            value={calc.pointsCost}
            calc={discountPts > 0 ? `${discountPts} pts × ${fmt(calc.loan)} = ${fmt2(calc.pointsCost)}` : undefined}
            explainer={discountPts > 0 ? "1 point = 1% of loan, typically lowers rate ~0.25%" : "Optional — buy down the rate by paying points upfront"}
            editor={
              <>
                <Inp label="Discount Points" value={discountPts} onChange={setDiscountPts} prefix="" suffix="pts" step={0.125} max={10} sm tip="1 point = 1% of loan amount. Typically reduces rate by ~0.25%." />
                <div style={{ fontSize: 11, color: T.textTertiary }}>{discountPts} pts × {fmt(calc.loan)} = {fmt2(calc.pointsCost)}</div>
              </>
            }
          />
          <FeeRow label="Originator Compensation" editKey="origComp"     value={originatorComp}  onChange={setOriginatorComp}  explainer="Paid to the loan officer/originator" />
          <FeeRow label="Underwriting Fee"        editKey="underwriting" value={underwritingFee} onChange={setUnderwritingFee} explainer="Lender's fee for evaluating the loan" />
          {processingFee > 0 && (
            <FeeRow label="Processing Fee" editKey="processing" value={processingFee} onChange={setProcessingFee} explainer="Lender's fee for processing loan documents" />
          )}
        </LetterSection>

        {/* B. Services You Cannot Shop For */}
        <LetterSection letter="B" title="Services You Cannot Shop For" total={fmt2(calc.cannotShop)}>
          <FeeRow label="Appraisal Fee"          editKey="appraisal" value={appraisalFee}    onChange={setAppraisalFee}    explainer="Independent appraiser values the property" />
          <FeeRow label="Credit Report Fee"      editKey="credit"    value={creditReportFee} onChange={setCreditReportFee} explainer="Pull tri-merge credit report" />
          <FeeRow label="Flood Certificate Fee"  editKey="flood"     value={floodCertFee}    onChange={setFloodCertFee}    explainer="Determines if property is in a flood zone" />
          <FeeRow label="MERS Registration Fee"  editKey="mers"      value={mersFee}         onChange={setMersFee}         explainer="Mortgage Electronic Registration System" />
          <FeeRow label="Tax Service Fee"        editKey="taxsvc"    value={taxServiceFee}   onChange={setTaxServiceFee}   explainer="Lender's tax-monitoring service" />
        </LetterSection>

        {/* C. Services You Can Shop For */}
        <LetterSection letter="C" title="Services You Can Shop For" total={fmt2(calc.canShop)}>
          {isRefi ? (
            <FeeRow label="Title / Escrow Flat Fee" editKey="escrowRefi" value={escrowFee} onChange={setEscrowFee} explainer="Refinances use a flat title/escrow fee" note="Refinances use a flat title/escrow fee." />
          ) : (
            <>
              <FeeRow label="Title — Insurance Binder"        editKey="titleIns"    value={titleInsurance} onChange={setTitleInsurance} explainer="Lender's title insurance policy" />
              <FeeRow label="Title — Settlement Agent Fee"    editKey="settlement"  value={settlementFee}  onChange={setSettlementFee}  explainer="Settlement/closing agent fee" />
              <FeeRow label="Title — Title Search"            editKey="titleSearch" value={titleSearch}    onChange={setTitleSearch}    explainer="Researches the property's title history" />
              <FeeRow label="Title — Escrow/Settlement Fee"   editKey="escrow"      value={escrowFee}      onChange={setEscrowFee}      explainer="Escrow company's closing fee" />
              {calc.hoaCert > 0 && <FeeRow label="HOA Certification" value={calc.hoaCert} sub="Condo/TH" explainer="Required for condos & townhomes" />}
            </>
          )}
        </LetterSection>

        {/* D. Total Loan Costs (A + B + C) — computed band */}
        <TotalBand letter="D" title="Total Loan Costs (A + B + C)" total={fmt2(totalLoanCosts)} />

        {/* E. Taxes and Other Government Charges */}
        <LetterSection letter="E" title="Taxes and Other Government Charges" total={fmt2(calc.govCharges)}>
          <FeeRow label="Recording Fees" editKey="recording" value={recordingFee} onChange={setRecordingFee} explainer="County fees to record the deed and mortgage" />
          <FeeRow
            label="Transfer Taxes"
            editKey="transferTax"
            value={calc.buyerCityTT + calc.buyerCountyTT}
            readOnly
            sub={!isRefi && calc.ttEntry && calc.ttEntry.rate > 0 ? `$${calc.ttEntry.rate}/$1K` : null}
            calc={!isRefi && calc.ttEntry && calc.ttEntry.rate > 0
              ? `$${calc.ttEntry.rate}/$1K × ${fmt(salesPrice)} = ${fmt2(calc.ttEntry.rate * salesPrice / 1000)} → buyer 50% = ${fmt2(calc.buyerCityTT + calc.buyerCountyTT)}`
              : undefined}
            explainer={isRefi ? "No transfer tax on refinances in California" : "Government tax when property changes hands; buyer customarily pays 50%"}
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
        </LetterSection>

        {/* H. Other (purchase only) */}
        {!isRefi && (
          <LetterSection letter="H" title="Other" total={fmt2(otherCostsTotal)}>
            <FeeRow label="Owner's Title Insurance" editKey="ownersTitle" value={ownersTitleIns} onChange={setOwnersTitleIns} explainer="Optional — protects buyer's ownership rights from title defects" />
            <FeeRow label="Home Warranty"           editKey="warranty"    value={homeWarranty}   onChange={setHomeWarranty}   explainer="One-year coverage on major home systems" />
            {hoa > 0 && (
              <FeeRow
                label="HOA Transfer Fee"
                editKey="hoaTransfer"
                value={hoaTransferFee > 0 ? hoaTransferFee : hoa}
                onChange={setHoaTransferFee}
                sub={hoaTransferFee === 0 ? "Auto: 1 mo HOA" : null}
                calc={hoaTransferFee === 0 ? `1 mo HOA × ${fmt2(hoa)}/mo = ${fmt2(hoa)}` : undefined}
                explainer="HOA's fee to transfer ownership records"
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
                calc={`${buyerCommPct}% × ${fmt(salesPrice)} = ${fmt2(liveBuyerComm)}`}
                explainer="Commission paid to buyer's real estate agent"
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
          </LetterSection>
        )}
      </CollapsibleBox>

      {/* ─── MASTER 2: Prepaids and Initial Escrow (default OPEN) ── */}
      <CollapsibleBox title="Prepaid Expenses" total={fmt2(calc.totalPrepaidExp)} defaultOpen={true}>

        {/* F. Prepaids */}
        <LetterSection letter="F" title="Prepaids">
          <FeeRow
            label="Hazard Insurance Premium"
            editKey="hoi"
            value={annualIns}
            onChange={setAnnualIns}
            calc={`12 mo × ${fmt2(annualIns / 12)}/mo = ${fmt2(annualIns)}`}
            explainer="First-year homeowner's insurance, paid up front at closing"
          />
          {monthlyMI > 0 && (
            <FeeRow
              label="Mortgage Insurance Premium"
              value={0}
              readOnly
              explainer="Upfront MI premium (FHA/USDA only — conv. MI is monthly)"
            />
          )}
          <FeeRow
            label="Prepaid Interest"
            value={calc.prepaidInt}
            editKey="closeDate"
            readOnly
            calc={`${calc.autoPrepaidDays} days × ${fmt2(calc.dailyInt)}/day = ${fmt2(calc.prepaidInt)}`}
            explainer="Interest from closing day through end of month"
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
              label="Property Taxes"
              value={proposedTax_atClosing}
              readOnly
              calc={`${calc.escrowTaxMonths} mo × ${fmt2(monthlyTax)}/mo = ${fmt2(proposedTax_atClosing)}`}
              explainer="Property taxes collected at closing to fund escrow account"
            />
          )}
          <ToggleRow
            label="Include Escrow Impounds"
            hint="Toggle OFF to waive escrow — no property tax or insurance reserves collected at closing"
            on={includeEscrow}
            onChange={setIncludeEscrow}
          />
        </LetterSection>

        {/* G. Initial Escrow Payment at Closing */}
        <LetterSection letter="G" title="Initial Escrow Payment at Closing">
          {!includeEscrow ? (
            <div style={{ padding: "8px 0", fontSize: 12, color: T.textSecondary }}>
              Escrow waived — taxes and insurance paid separately by borrower.
            </div>
          ) : (
            <>
              <FeeRow
                label="Aggregate Adjustment"
                value="—"
                isDollar={false}
                explainer="RESPA-required adjustment to prevent over-collection"
              />
              <FeeRow
                label="Hazard Insurance Reserve"
                value={escrowHOI_reserve}
                readOnly
                calc={`${calc.escrowInsMonths} mo × ${fmt2(monthlyIns)}/mo = ${fmt2(escrowHOI_reserve)}`}
                explainer="Cushion held by lender for upcoming insurance payments"
              />
              {monthlyMI > 0 ? (
                <FeeRow
                  label="Mortgage Insurance Reserve"
                  value={escrowMI_reserve}
                  readOnly
                  calc={`2 mo × ${fmt2(monthlyMI)}/mo = ${fmt2(escrowMI_reserve)}`}
                  explainer="Cushion for monthly MI payments"
                />
              ) : (
                <FeeRow
                  label="Mortgage Insurance Reserve"
                  value="—"
                  isDollar={false}
                  explainer="No mortgage insurance required"
                />
              )}
              <FeeRow
                label="Property Taxes"
                value={escrowTax_reserve}
                readOnly
                calc={`${calc.escrowTaxMonths} mo × ${fmt2(monthlyTax)}/mo = ${fmt2(escrowTax_reserve)}`}
                explainer="Cushion for upcoming property tax bills"
              />
            </>
          )}
        </LetterSection>
      </CollapsibleBox>

      {/* ─── MASTER 3: Credits to Buyer (default COLLAPSED) ───── */}
      <CollapsibleBox
        title="Credits to Buyer"
        total={`−${fmt2(calc.totalCredits)}`}
        totalColor={T.green}
        defaultOpen={false}
      >
        <FeeRow
          label="Earnest Money Deposit (EMD)"
          editKey="emd"
          value={isRefi ? 0 : emd}
          onChange={setEmd}
          readOnly={isRefi}
          calc={!isRefi && salesPrice > 0 && emd > 0 ? `${((emd / salesPrice) * 100).toFixed(2)}% of ${fmt(salesPrice)} sales price` : undefined}
          explainer="Money already paid to seller — reduces cash needed at closing"
        />
        {!isRefi && (
          <FeeRow label="Seller Credit"   editKey="sellerCredit"  value={sellerCredit}  onChange={setSellerCredit}
            explainer="Negotiated credit from seller toward buyer's closing costs" />
        )}
        {!isRefi && (
          <FeeRow label="Realtor Credit"  editKey="realtorCredit" value={realtorCredit} onChange={setRealtorCredit}
            explainer="Credit from realtor (sometimes a portion of their commission)" />
        )}
        <FeeRow label="Lender Credits"    editKey="lenderCredit"  value={lenderCredit}  onChange={setLenderCredit}
          explainer="Credit from lender — often in exchange for a slightly higher rate" />
        <FeeRow label="Adjustments and Other Credits" value={0} readOnly
          explainer="Other credits or adjustments at closing" />
        <FeeRow label="Subordinate Financing" value={0} readOnly
          explainer="Second mortgages or HELOCs financing part of the purchase" />
      </CollapsibleBox>

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
