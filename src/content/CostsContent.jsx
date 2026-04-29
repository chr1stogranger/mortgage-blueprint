import React, { useState, useContext, createContext, useMemo } from "react";
import Icon from "../Icon";

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
// Per-section lock context — set by LetterSection, consumed by FeeRow descendants.
// `unlocked` = section is in edit mode (FeeRow shows inline editor instead of value).
const LockCtx = createContext({ unlocked: false, letter: null });

// Small uppercase mono badge used to flag rows that are auto-derived (e.g. transfer tax,
// HOA cert, prepaid interest) so users see they're calculated, not editable.
function AutoBadge() {
  const { T } = useContext(CostsCtx);
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, color: T.textTertiary, fontFamily: MONO,
      letterSpacing: 1, padding: "2px 5px", border: `1px solid ${T.separator}`,
      borderRadius: 4, marginLeft: 8, lineHeight: 1, whiteSpace: "nowrap",
      display: "inline-flex", alignItems: "center",
    }}>AUTO</span>
  );
}

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
            fontFamily: FONT,
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
// `lockable` = whether to show the lock/unlock pill in the header (true for closing-cost subsections).
// When unlocked, children FeeRows render inline editors instead of read-only values.
function LetterSection({ letter, title, total, children, lockable = false }) {
  const { T, ACCENT, sectionLocks, toggleLock } = useContext(CostsCtx);
  const locked = lockable ? !!sectionLocks[letter] : true;
  const unlocked = lockable && !locked;
  return (
    <div style={{
      marginBottom: 14,
      // subtle background tint when section is in edit mode
      ...(unlocked ? { background: `${ACCENT}06`, borderRadius: 10, padding: "4px 10px", border: `1px solid ${ACCENT}22` } : {}),
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
        borderBottom: `1px solid ${T.separator}`,
        marginBottom: 2,
        gap: 10,
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {lockable && (
            <button
              type="button"
              onClick={() => toggleLock(letter)}
              aria-label={unlocked ? "Lock section" : "Unlock section to edit"}
              style={{
                fontSize: 10, fontWeight: 700, fontFamily: MONO, letterSpacing: 1,
                textTransform: "uppercase",
                color: unlocked ? "#fff" : T.textTertiary,
                background: unlocked ? ACCENT : "transparent",
                border: `1px solid ${unlocked ? ACCENT : T.separator}`,
                borderRadius: 9999, padding: "3px 9px", cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 5,
                transition: "all 0.15s",
              }}
            >
              <Icon name={unlocked ? "unlock" : "lock"} size={11} />
              {unlocked ? "Done" : "Edit"}
            </button>
          )}
          {total !== undefined && (
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: FONT, color: T.text }}>
              {total}
            </div>
          )}
        </div>
      </div>
      <LockCtx.Provider value={{ unlocked, letter }}>
        {children}
      </LockCtx.Provider>
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
      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: FONT, color: ACCENT }}>{total}</div>
    </div>
  );
}

// FeeRow — new lock-aware model. NO MORE "+" buttons.
// - locked (default, from section LockCtx): renders label / value (read-only)
// - unlocked (section is in edit mode): renders label / inline number input (or `inlineEditor` if provided)
// - readOnly: always renders as locked, with optional AUTO badge
// - alwaysEdit: renders inline editor regardless of section lock (for Points, Hazard Insurance)
// - inlineEditor: custom JSX rendered between label and value when unlocked (for Transfer Tax city dropdown)
//   Used when the editor isn't a simple number input.
function FeeRow({
  label, sub, value, onChange,
  prefix = "$", suffix = null, step = 1, max,
  isDollar = true, bold = false, color, note,
  readOnly = false, autoBadge = false, alwaysEdit = false,
  inlineEditor = null, alwaysVisibleControl = null,
  calc, explainer,
}) {
  const { T, fmt2, Inp } = useContext(CostsCtx);
  const { unlocked: sectionUnlocked } = useContext(LockCtx);

  // Determine effective edit mode for this row.
  // - editable (value): row's main value can be edited via inline number input.
  // - inlineEditor: separate from readOnly — appears whenever the section is unlocked OR alwaysEdit,
  //   even on readOnly rows like Transfer Taxes (where the city dropdown drives the calculated value).
  const editable = !readOnly && (alwaysEdit || sectionUnlocked);
  const showInlineEditor = (alwaysEdit || sectionUnlocked) && !!inlineEditor;
  const showInlineNumberInput = editable && !inlineEditor;

  const displayVal = isDollar ? (value === 0 || value === "" || value == null ? "$0.00" : fmt2(value)) : value;

  return (
    <div style={{ borderBottom: `1px dashed ${T.separator}`, paddingBottom: 2 }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 0",
        minHeight: 30,
        gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, color: bold ? T.text : T.textSecondary, fontWeight: bold ? 700 : 500, lineHeight: 1.3 }}>
            <span>{label}</span>
            {sub && <span style={{ color: T.textTertiary, fontSize: 11, marginLeft: 6, fontFamily: MONO }}>{sub}</span>}
          </div>
          {alwaysVisibleControl && (
            <div style={{ display: "flex", alignItems: "center" }}>{alwaysVisibleControl}</div>
          )}
          {showInlineEditor && (
            <div style={{ display: "flex", alignItems: "center", flex: "0 1 auto", minWidth: 0 }}>{inlineEditor}</div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0, gap: 6 }}>
          {showInlineNumberInput ? (
            <div style={{ width: 130 }}>
              <Inp value={value} onChange={onChange} prefix={prefix} suffix={suffix} step={step} max={max} sm />
            </div>
          ) : (
            <div style={{
              fontSize: 13,
              fontWeight: bold ? 700 : 600,
              fontFamily: FONT,
              color: color || T.text,
              whiteSpace: "nowrap",
            }}>{displayVal}</div>
          )}
          {autoBadge && <AutoBadge />}
        </div>
      </div>
      {(calc || explainer) && (
        <div style={{
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
      {note && (editable || readOnly) && (
        <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 4 }}>{note}</div>
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
                fontFamily: FONT,
                fontSize: 13,
                color: r.sign === "−" ? T.green : T.textTertiary,
                fontWeight: 700,
                width: 12,
                textAlign: "center",
              }}>{r.sign}</span>
              <span style={{
                fontFamily: FONT,
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
          fontFamily: FONT,
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
  transferTaxSplit, setTransferTaxSplit,
  transferTaxCountySplit, setTransferTaxCountySplit,
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
  // Section-level lock state — closing-cost subsections (A, B, C, E, H) start LOCKED for clean read-only view.
  const [sectionLocks, setSectionLocks] = useState({ A: true, B: true, C: true, E: true, H: true });
  const toggleLock = (k) => setSectionLocks(s => ({ ...s, [k]: !s[k] }));

  const ACCENT = T.blue;
  const HEAD_BG = `${ACCENT}14`;
  const HEAD_BORDER = `${ACCENT}38`;
  const BODY_BORDER = T.cardBorder;

  // Stable context value — memoized by values that actually change.
  const ctx = useMemo(() => ({
    T, ACCENT, HEAD_BG, HEAD_BORDER, BODY_BORDER,
    fmt2, Inp, sectionLocks, toggleLock,
  }), [T, ACCENT, HEAD_BG, HEAD_BORDER, BODY_BORDER, fmt2, Inp, sectionLocks]);

  // Live-computed buyer commission (defensive — don't trust calc if stale)
  const liveBuyerComm = buyerPaysComm ? salesPrice * (buyerCommPct / 100) : 0;

  // Derived numbers
  const escrowHOI_reserve = includeEscrow ? calc.ins * calc.escrowInsMonths : 0;
  const escrowTax_reserve = includeEscrow ? calc.monthlyTax * calc.escrowTaxMonths : 0;
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

        {/* A. Origination Charges — lockable */}
        <LetterSection letter="A" title="Origination Charges" total={fmt2(calc.origCharges)} lockable>
          {/* Points — ALWAYS inline editable. Negative values flip label to "Lender Credit". */}
          <FeeRow
            label={discountPts < 0
              ? `${Math.abs(discountPts)}% Lender Credit`
              : (discountPts > 0 ? `${discountPts}% of Loan Amount (Points)` : "Discount Points")}
            value={Math.abs(calc.pointsCost)}
            color={discountPts < 0 ? T.green : undefined}
            // Render value as negative when it's a credit
            isDollar={true}
            calc={discountPts !== 0
              ? `${Math.abs(discountPts)}% × ${fmt(calc.loan)} = ${discountPts < 0 ? "−" : ""}${fmt2(Math.abs(calc.pointsCost))}`
              : undefined}
            explainer={discountPts < 0
              ? "Negative — lender credits go to your closing costs (often in exchange for a slightly higher rate)"
              : (discountPts > 0
                ? "1 point = 1% of loan, typically lowers rate ~0.25%"
                : "Buy down the rate by paying points upfront, or go negative for a lender credit")}
            alwaysEdit
            inlineEditor={
              <Inp
                value={discountPts}
                onChange={setDiscountPts}
                prefix=""
                suffix="%"
                step={0.125}
                min={-5}
                max={10}
                sm
                tip="1 point = 1% of loan amount. Negative values become Lender Credits."
              />
            }
          />
          <FeeRow label="Originator Compensation" value={originatorComp}  onChange={setOriginatorComp}  explainer="Paid to the loan officer/originator" />
          <FeeRow label="Underwriting Fee"        value={underwritingFee} onChange={setUnderwritingFee} explainer="Lender's fee for evaluating the loan" />
          {processingFee > 0 && (
            <FeeRow label="Processing Fee" value={processingFee} onChange={setProcessingFee} explainer="Lender's fee for processing loan documents" />
          )}
        </LetterSection>

        {/* B. Services You Cannot Shop For — lockable */}
        <LetterSection letter="B" title="Services You Cannot Shop For" total={fmt2(calc.cannotShop)} lockable>
          <FeeRow label="Appraisal Fee"          value={appraisalFee}    onChange={setAppraisalFee}    explainer="Independent appraiser values the property" />
          <FeeRow label="Credit Report Fee"      value={creditReportFee} onChange={setCreditReportFee} explainer="Pull tri-merge credit report" />
          <FeeRow label="Flood Certificate Fee"  value={floodCertFee}    onChange={setFloodCertFee}    explainer="Determines if property is in a flood zone" />
          <FeeRow label="MERS Registration Fee"  value={mersFee}         onChange={setMersFee}         explainer="Mortgage Electronic Registration System" />
          <FeeRow label="Tax Service Fee"        value={taxServiceFee}   onChange={setTaxServiceFee}   explainer="Lender's tax-monitoring service" />
        </LetterSection>

        {/* C. Services You Can Shop For — lockable */}
        <LetterSection letter="C" title="Services You Can Shop For" total={fmt2(calc.canShop)} lockable>
          {isRefi ? (
            <FeeRow label="Title / Escrow Flat Fee" value={escrowFee} onChange={setEscrowFee} explainer="Refinances use a flat title/escrow fee" note="Refinances use a flat title/escrow fee." />
          ) : (
            <>
              <FeeRow label="Title — Insurance Binder"        value={titleInsurance} onChange={setTitleInsurance} explainer="Lender's title insurance policy" />
              <FeeRow label="Title — Settlement Agent Fee"    value={settlementFee}  onChange={setSettlementFee}  explainer="Settlement/closing agent fee" />
              <FeeRow label="Title — Title Search"            value={titleSearch}    onChange={setTitleSearch}    explainer="Researches the property's title history" />
              <FeeRow label="Title — Escrow/Settlement Fee"   value={escrowFee}      onChange={setEscrowFee}      explainer="Escrow company's closing fee" />
              {calc.hoaCert > 0 && <FeeRow label="HOA Certification" value={calc.hoaCert} sub="Condo/TH" readOnly autoBadge explainer="Required for condos & townhomes" />}
            </>
          )}
        </LetterSection>

        {/* D. Total Loan Costs (A + B + C) — computed band */}
        <TotalBand letter="D" title="Total Loan Costs (A + B + C)" total={fmt2(totalLoanCosts)} />

        {/* E. Taxes and Other Government Charges — lockable */}
        <LetterSection letter="E" title="Taxes and Other Government Charges" total={fmt2(calc.govCharges)} lockable>
          <FeeRow label="Recording Fees" value={recordingFee} onChange={setRecordingFee} explainer="County fees to record the deed and mortgage" />
          {(() => {
            // 3-way Seller / Split / Buyer toggle — ALWAYS visible. Shared by both rows but each
            // row reads its own split state (independent per Christo's spec).
            const splitOpts = [
              { v: "seller",  label: "Seller" },
              { v: "split50", label: "Split 50/50" },
              { v: "buyer",   label: "Buyer" },
            ];
            const renderToggle = (current, setter) => !isRefi ? (
              <div style={{ display: "inline-flex", background: T.pillBg, border: `1px solid ${T.separator}`, borderRadius: 9999, padding: 2, gap: 0 }}>
                {splitOpts.map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setter(opt.v)}
                    style={{
                      fontSize: 10, fontWeight: 700, fontFamily: MONO, letterSpacing: 0.5, textTransform: "uppercase",
                      padding: "4px 10px", borderRadius: 9999, border: "none", cursor: "pointer",
                      background: current === opt.v ? T.blue : "transparent",
                      color: current === opt.v ? "#fff" : T.textSecondary,
                      transition: "all 0.15s",
                    }}
                  >{opt.label}</button>
                ))}
              </div>
            ) : null;

            const citySharePct = transferTaxSplit === "buyer" ? 100 : transferTaxSplit === "seller" ? 0 : 50;
            const countySharePct = transferTaxCountySplit === "buyer" ? 100 : transferTaxCountySplit === "seller" ? 0 : 50;
            const cityRate = calc.ttEntry && calc.ttEntry.rate > 0 ? calc.ttEntry.rate : 0;
            const countyRate = calc.countyTTRate || 0;
            const cityFullTax = (salesPrice / 1000) * cityRate;
            const countyFullTax = (salesPrice / 1000) * countyRate;

            const cityDropdown = !isRefi ? (
              <div style={{ minWidth: 200, maxWidth: 280 }}>
                <Sel
                  value={transferTaxCity}
                  onChange={setTransferTaxCity}
                  options={getTTCitiesForState(propertyState).map(c => ({ value: c, label: c === "Not listed" ? "Not listed" : `${c} ($${getTTForCity(c, salesPrice).rate}/$1K)` }))}
                  sm
                  tip="City transfer tax — varies by city."
                />
              </div>
            ) : null;

            return (<>
              {/* City Transfer Tax — has city dropdown inline when section unlocked */}
              <FeeRow
                label="Transfer Tax — City (Buyer's Share)"
                value={calc.buyerCityTT}
                readOnly
                autoBadge
                sub={cityRate > 0 ? `$${cityRate}/$1K` : null}
                alwaysVisibleControl={renderToggle(transferTaxSplit, setTransferTaxSplit)}
                inlineEditor={cityDropdown}
                calc={!isRefi && cityRate > 0
                  ? `$${cityRate}/$1K × ${fmt(salesPrice)} = ${fmt2(cityFullTax)} → buyer ${citySharePct}% = ${fmt2(calc.buyerCityTT)}`
                  : undefined}
                explainer={isRefi
                  ? "No transfer tax on refinances in California"
                  : (transferTaxCity === "San Francisco" && transferTaxSplit !== "seller"
                      ? "SF: Seller customarily pays 100% — toggle Seller above"
                      : "City transfer tax — split varies by city/agreement")}
              />
              {/* County Transfer Tax — only renders when state has a county-level rate (CA: $1.10/$1K) */}
              {countyRate > 0 && (
                <FeeRow
                  label="Transfer Tax — County (Buyer's Share)"
                  value={calc.buyerCountyTT}
                  readOnly
                  autoBadge
                  sub={`$${countyRate.toFixed(2)}/$1K`}
                  alwaysVisibleControl={renderToggle(transferTaxCountySplit, setTransferTaxCountySplit)}
                  calc={!isRefi
                    ? `$${countyRate.toFixed(2)}/$1K × ${fmt(salesPrice)} = ${fmt2(countyFullTax)} → buyer ${countySharePct}% = ${fmt2(calc.buyerCountyTT)}`
                    : undefined}
                  explainer={isRefi
                    ? "No county transfer tax on refinances in California"
                    : "California Documentary Transfer Tax — $1.10/$1K statewide, set by state law"}
                />
              )}
            </>);
          })()}
        </LetterSection>

        {/* H. Other (purchase only) — lockable */}
        {!isRefi && (
          <LetterSection letter="H" title="Other" total={fmt2(otherCostsTotal)} lockable>
            <FeeRow label="Owner's Title Insurance" value={ownersTitleIns} onChange={setOwnersTitleIns} explainer="Optional — protects buyer's ownership rights from title defects" />
            <FeeRow label="Home Warranty"           value={homeWarranty}   onChange={setHomeWarranty}   explainer="One-year coverage on major home systems" />
            {hoa > 0 && (
              <FeeRow
                label="HOA Transfer Fee"
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
                value={liveBuyerComm}
                readOnly
                autoBadge
                calc={`${buyerCommPct}% × ${fmt(salesPrice)} = ${fmt2(liveBuyerComm)}`}
                explainer="Commission paid to buyer's real estate agent"
                inlineEditor={
                  <div style={{ width: 110 }}>
                    <Inp value={buyerCommPct} onChange={setBuyerCommPct} prefix="" suffix="%" step={0.1} max={10} sm />
                  </div>
                }
              />
            )}
          </LetterSection>
        )}
      </CollapsibleBox>

      {/* ─── MASTER 2: Prepaids and Initial Escrow (default OPEN) ── */}
      <CollapsibleBox title="Prepaid Expenses" total={fmt2(calc.totalPrepaidExp)} defaultOpen={true}>

        {/* F. Prepaids — not lockable per spec; Hazard Ins always inline-edit, others auto */}
        <LetterSection letter="F" title="Prepaids">
          {/* Closing date as its own always-visible row (replaces the old "+" editor on Prepaid Interest) */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: `1px dashed ${T.separator}` }}>
            <div style={{ fontSize: 13, color: T.textSecondary, fontWeight: 500 }}>Closing Date</div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ minWidth: 130 }}>
                <Sel value={closingMonth} onChange={v => setClosingMonth(parseInt(v))} options={monthOptions} sm />
              </div>
              <div style={{ minWidth: 70 }}>
                <Sel value={closingDay} onChange={v => setClosingDay(parseInt(v))} options={dayOptions} sm />
              </div>
            </div>
          </div>
          <FeeRow
            label="Hazard Insurance Premium"
            value={annualIns}
            onChange={setAnnualIns}
            alwaysEdit
            calc={`12 mo × ${fmt2(annualIns / 12)}/mo = ${fmt2(annualIns)}`}
            explainer="First-year homeowner's insurance, paid up front at closing"
          />
          {monthlyMI > 0 && (
            <FeeRow
              label="Mortgage Insurance Premium"
              value={0}
              readOnly
              autoBadge
              explainer="Upfront MI premium (FHA/USDA only — conv. MI is monthly)"
            />
          )}
          <FeeRow
            label="Prepaid Interest"
            value={calc.prepaidInt}
            readOnly
            autoBadge
            calc={`${calc.autoPrepaidDays} days × ${fmt2(calc.dailyInt)}/day = ${fmt2(calc.prepaidInt)}`}
            explainer="Interest from closing day through end of month"
          />
          {includeEscrow && (
            <FeeRow
              label="Property Taxes"
              value={proposedTax_atClosing}
              readOnly
              autoBadge
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
                label="Hazard Insurance Reserve"
                value={escrowHOI_reserve}
                readOnly
                autoBadge
                calc={`${calc.escrowInsMonths} mo × ${fmt2(monthlyIns)}/mo = ${fmt2(escrowHOI_reserve)}`}
                explainer="Cushion held by lender for upcoming insurance payments"
              />
              <FeeRow
                label="Property Taxes"
                value={escrowTax_reserve}
                readOnly
                autoBadge
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
          value={isRefi ? 0 : emd}
          onChange={setEmd}
          readOnly={isRefi}
          alwaysEdit={!isRefi}
          calc={!isRefi && salesPrice > 0 && emd > 0 ? `${((emd / salesPrice) * 100).toFixed(2)}% of ${fmt(salesPrice)} sales price` : undefined}
          explainer="Money already paid to seller — reduces cash needed at closing"
        />
        {!isRefi && (
          <FeeRow label="Seller Credit"   value={sellerCredit}  onChange={setSellerCredit}  alwaysEdit
            explainer="Negotiated credit from seller toward buyer's closing costs" />
        )}
        {!isRefi && (
          <FeeRow label="Realtor Credit"  value={realtorCredit} onChange={setRealtorCredit} alwaysEdit
            explainer="Credit from realtor (sometimes a portion of their commission)" />
        )}
        <FeeRow label="Lender Credits"    value={lenderCredit}  onChange={setLenderCredit}  alwaysEdit
          explainer="Credit from lender — often in exchange for a slightly higher rate" />
        <FeeRow label="Adjustments and Other Credits" value={0} readOnly autoBadge
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
