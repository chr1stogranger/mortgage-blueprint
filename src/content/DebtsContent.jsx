import React, { useState } from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

const BORROWER_OPTIONS = ["Joint", "Borrower 1", "Borrower 2"];

// ──────────────────────────────────────────────────────────────
// Small controlled numeric cell for inline table editing.
// Kept local (not the full Inp component) so the table stays tight
// and doesn't render the full label/tooltip chrome inside every cell.
// ──────────────────────────────────────────────────────────────
function NumCell({ value, onChange, prefix = "$", suffix, T, align = "right", placeholder, readOnly = false }) {
  const [focused, setFocused] = useState(false);
  const [editStr, setEditStr] = useState(null);
  const safeValue = value == null || (typeof value === "number" && isNaN(value)) ? 0 : value;
  const fmtComma = (n) => {
    if (n === "" || n == null) return "";
    if (n === 0) return "";
    const parts = String(n).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };
  const display = editStr !== null ? editStr : (safeValue === 0 && focused ? "" : fmtComma(safeValue));
  return (
    <div style={{
      display: "flex", alignItems: "center",
      background: readOnly ? "transparent" : T.inputBg,
      border: readOnly ? "none" : `1px solid ${focused ? T.blue : "transparent"}`,
      borderRadius: 6, padding: "4px 6px",
      transition: "border 0.15s", width: "100%", boxSizing: "border-box",
    }}>
      {prefix && <span style={{ color: T.textTertiary, fontSize: 11, marginRight: 2, fontFamily: MONO }}>{prefix}</span>}
      <input
        type="text" inputMode="decimal" readOnly={readOnly}
        value={display}
        onFocus={() => { if (!readOnly) { setFocused(true); setEditStr(null); } }}
        onBlur={() => {
          setFocused(false);
          if (editStr !== null) {
            const n = parseFloat(editStr.replace(/,/g, ""));
            onChange(isNaN(n) ? 0 : n);
            setEditStr(null);
          }
        }}
        onChange={e => {
          if (readOnly) return;
          const raw = e.target.value.replace(/,/g, "");
          if (raw === "") { setEditStr(""); onChange(0); return; }
          if (/^-?\d*\.?\d*$/.test(raw)) {
            const parts = raw.split(".");
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            setEditStr(parts.join("."));
            const n = parseFloat(raw);
            if (!isNaN(n)) onChange(n);
          }
        }}
        placeholder={placeholder || ""}
        style={{
          background: "transparent", border: "none", outline: "none",
          color: T.text, fontSize: 12, fontWeight: 600, fontFamily: MONO,
          textAlign: align, width: "100%", minWidth: 0, padding: 0,
        }}
      />
      {suffix && <span style={{ color: T.textTertiary, fontSize: 11, marginLeft: 2, fontFamily: MONO }}>{suffix}</span>}
    </div>
  );
}

// Text cell for creditor name
function TextCell({ value, onChange, placeholder, T }) {
  return (
    <input
      type="text" value={value || ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || ""}
      style={{
        background: T.inputBg, border: "1px solid transparent", outline: "none",
        color: T.text, fontSize: 12, fontWeight: 500, fontFamily: FONT,
        width: "100%", padding: "5px 8px", borderRadius: 6, boxSizing: "border-box",
      }}
      onFocus={e => e.target.style.borderColor = T.blue}
      onBlur={e => e.target.style.borderColor = "transparent"}
    />
  );
}

// Select cell — compact dropdown
function SelCell({ value, onChange, options, T }) {
  return (
    <select value={value || ""} onChange={e => onChange(e.target.value)}
      style={{
        background: T.inputBg, border: "1px solid transparent", outline: "none",
        color: T.text, fontSize: 12, fontWeight: 500, fontFamily: FONT,
        width: "100%", padding: "5px 8px", borderRadius: 6, cursor: "pointer",
        WebkitAppearance: "menulist", boxSizing: "border-box",
      }}
    >
      {options.map(o => {
        const val = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        return <option key={val} value={val}>{label}</option>;
      })}
    </select>
  );
}

// ──────────────────────────────────────────────────────────────
// Table cell wrappers — MUST be at module scope. If declared inside
// DebtsContent they'd be a new component type on every parent render,
// which causes React to unmount+remount every <input> inside them on
// every keystroke → the user loses focus after each character.
// ──────────────────────────────────────────────────────────────
function HeaderCell({ children, align = "left", headBorder, T }) {
  return (
    <div style={{
      padding: "10px 8px",
      fontSize: 10.5, fontWeight: 700,
      color: T.text, letterSpacing: "0.04em",
      textTransform: "uppercase",
      fontFamily: MONO,
      textAlign: align, whiteSpace: "nowrap",
      borderRight: `1px solid ${headBorder}`,
    }}>{children}</div>
  );
}

function DataCell({ children, align = "left", pad = "6px 8px", T }) {
  return (
    <div style={{
      padding: pad, display: "flex", alignItems: "center",
      justifyContent: align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start",
      borderRight: `1px solid ${T.separator}`,
      borderBottom: `1px solid ${T.separator}`,
      minWidth: 0,
      minHeight: 40,
    }}>{children}</div>
  );
}

function TotalCell({ children, align = "right", T }) {
  return (
    <div style={{
      padding: "10px 8px",
      display: "flex", alignItems: "center",
      justifyContent: align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start",
      fontSize: 12, fontWeight: 700, fontFamily: MONO,
      color: T.text,
      borderRight: `1px solid ${T.separator}`,
    }}>{children}</div>
  );
}

export default function DebtsContent({
  T, isDesktop, calc, fmt,
  debts, debtFree, setDebtFree,
  ownsProperties, setOwnsProperties,
  reos, setReos,
  syncDebtBalance, syncDebtPayment,
  guideTouched, markTouched, isPulse,
  Hero, Card, Sec, TextInp, Inp, Sel, Note,
  DEBT_TYPES, PAYOFF_OPTIONS, GuidedNextButton,
}) {
  const [expandedRowId, setExpandedRowId] = useState(null);
  const toggleExpand = (id) => setExpandedRowId(expandedRowId === id ? null : id);

  // Totals (summed across all debts, regardless of payoff — the sheet shows raw totals)
  const totalMonthly = debts.reduce((s, d) => s + (Number(d.monthly) || 0), 0);
  const totalBalance = debts.reduce((s, d) => s + (Number(d.balance) || 0), 0);
  const totalInterestYr = debts.reduce((s, d) => s + ((Number(d.balance) || 0) * (Number(d.rate) || 0) / 100), 0);
  // Only "Yes - at Escrow" contributes to the Payoff Amount column.
  // "Yes - before closing" (stored as legacy "Yes - POC") is paid outside
  // of closing and is NOT included in the closing payoff figure.
  const totalPayoff = debts.reduce((s, d) => {
    if (d.payoff !== "Yes - at Escrow") return s;
    const po = Number(d.payoffAmount) || Number(d.balance) || 0;
    return s + po;
  }, 0);


  // ACCENT: indigo brand
  const ACCENT = T.blue;
  const HEAD_BG = `${ACCENT}14`;
  const HEAD_BORDER = `${ACCENT}38`;

  // Column widths — desktop grid (10 data cols + 1 remove)
  const COLS_DESKTOP = "110px 95px minmax(140px, 1fr) 100px 110px 70px 85px 100px 105px 110px 32px";
  // Mobile: Type | Creditor | Monthly | Balance | Payoff? + expand chevron
  const COLS_MOBILE = "90px minmax(100px, 1fr) 80px 90px 80px 28px";


  return (<>
    {/* ─── Own Properties toggle — full width, structural (gates REO tab) ─── */}
    <div data-field="debts-section" style={{ marginTop: 20, marginBottom: 16 }}>
      <div data-field="owns-properties-toggle" className={isPulse("owns-properties-toggle")} style={{ borderRadius: 14, transition: "all 0.3s" }}>
        <Card>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Do you own any properties?</span>
            <span style={{ color: T.red, marginLeft: 3, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>*</span>
            <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>Current home, investment properties, second homes</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => { setOwnsProperties(true); markTouched("owns-properties-toggle"); }} style={{
              flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.3s", fontFamily: FONT,
              background: ownsProperties === true && guideTouched.has("owns-properties-toggle") ? T.green : "transparent",
              color: ownsProperties === true && guideTouched.has("owns-properties-toggle") ? "#fff" : T.textSecondary,
              border: `2px solid ${ownsProperties === true && guideTouched.has("owns-properties-toggle") ? T.green : T.separator}`,
            }}>Yes</button>
            <button onClick={() => { setOwnsProperties(false); markTouched("owns-properties-toggle"); }} style={{
              flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.3s", fontFamily: FONT,
              background: ownsProperties === false && guideTouched.has("owns-properties-toggle") ? T.pillBg : "transparent",
              color: ownsProperties === false && guideTouched.has("owns-properties-toggle") ? T.text : T.textSecondary,
              border: `2px solid ${ownsProperties === false && guideTouched.has("owns-properties-toggle") ? T.textTertiary : T.separator}`,
            }}>No</button>
          </div>
          {ownsProperties && guideTouched.has("owns-properties-toggle") && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: `${T.blue}10`, borderRadius: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.blue, marginBottom: 3 }}>REO tab unlocked</div>
              <div style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.5 }}>Add your properties in the REO tab. Mortgage & HELOC debts below can be linked to specific properties so payments aren't counted twice in DTI.</div>
            </div>
          )}
        </Card>
      </div>
    </div>

    {/* ─── MONTHLY DEBTS TABLE — always rendered; debt-free pill hides body ─── */}
    {<>
      {calc.reoNegativeDebt > 0 && (
        <Note color={T.orange}>
          {calc.reoPrimaryDebt > 0 && calc.reoInvestmentNet < 0
            ? `+${fmt(calc.reoPrimaryDebt)}/mo primary/2nd home PITIA + ${fmt(Math.abs(calc.reoInvestmentNet))}/mo investment shortfall`
            : calc.reoPrimaryDebt > 0
              ? `+${fmt(calc.reoPrimaryDebt)}/mo primary/2nd home PITIA`
              : `+${fmt(Math.abs(calc.reoInvestmentNet))}/mo investment property shortfall (75% rule)`} added as debt in DTI.
        </Note>
      )}

      <div style={{
        border: `1px solid ${T.cardBorder}`,
        borderRadius: 14,
        overflow: "hidden",
        background: T.card,
        marginBottom: 16,
      }}>
        {/* Banner header — "MONTHLY DEBTS" */}
        <div style={{
          background: ACCENT,
          color: "#fff",
          padding: "10px 16px",
          fontSize: 12, fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontFamily: MONO,
          textAlign: "center",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>Monthly Debts</span>
          {/* Debt-free inline pill — moved here from the standalone toggle card */}
          <button
            data-field="debt-free-toggle"
            className={isPulse("debt-free-toggle")}
            onClick={() => { setDebtFree(!debtFree); markTouched("debt-free-toggle"); }}
            aria-pressed={debtFree}
            title={debtFree ? "Click to edit consumer debts" : "Click if you have no consumer debts"}
            style={{
              padding: "4px 12px", borderRadius: 9999,
              background: debtFree ? "#fff" : "rgba(255,255,255,0.2)",
              border: `1px solid ${debtFree ? "#fff" : "rgba(255,255,255,0.35)"}`,
              color: debtFree ? T.green : "#fff",
              fontSize: 11, fontWeight: 700, cursor: "pointer",
              fontFamily: MONO, letterSpacing: "0.06em", textTransform: "uppercase",
              display: "inline-flex", alignItems: "center", gap: 6,
              transition: "all 0.15s",
            }}
          >
            <span style={{
              display: "inline-block", width: 10, height: 10, borderRadius: 99,
              background: debtFree ? T.green : "transparent",
              border: `1.5px solid ${debtFree ? T.green : "rgba(255,255,255,0.7)"}`,
            }} />
            Debt-Free
          </button>
        </div>

        {/* When debt-free, hide the body and show a clean message */}
        {debtFree && (
          <div style={{ padding: "28px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.green, marginBottom: 4 }}>No consumer debt — more buying power</div>
            <div style={{ fontSize: 12, color: T.textSecondary }}>Click the Debt-Free pill above to add debts.</div>
          </div>
        )}
        {/* Desktop table — only on desktop, hidden in debt-free mode */}
        {!debtFree && isDesktop && (
          <>
            {/* Column headers */}
            <div style={{
              display: "grid",
              gridTemplateColumns: COLS_DESKTOP,
              background: HEAD_BG,
              borderBottom: `1px solid ${HEAD_BORDER}`,
            }}>
              <HeaderCell T={T} headBorder={HEAD_BORDER}>Type</HeaderCell>
              <HeaderCell T={T} headBorder={HEAD_BORDER}>Borrower</HeaderCell>
              <HeaderCell T={T} headBorder={HEAD_BORDER}>Creditor</HeaderCell>
              <HeaderCell align="right" T={T} headBorder={HEAD_BORDER}>Monthly</HeaderCell>
              <HeaderCell align="right" T={T} headBorder={HEAD_BORDER}>Balance</HeaderCell>
              <HeaderCell align="right" T={T} headBorder={HEAD_BORDER}>% of Bal</HeaderCell>
              <HeaderCell align="right" T={T} headBorder={HEAD_BORDER}>Int Rate</HeaderCell>
              <HeaderCell align="right" T={T} headBorder={HEAD_BORDER}>Interest (yr)</HeaderCell>
              <HeaderCell align="center" T={T} headBorder={HEAD_BORDER}>Payoff at Closing?</HeaderCell>
              <HeaderCell align="right" T={T} headBorder={HEAD_BORDER}>Payoff Amt</HeaderCell>
              <HeaderCell align="center" T={T} headBorder={HEAD_BORDER}> </HeaderCell>
            </div>

            {/* Rows */}
            {debts.map((d) => {
              const bal = Number(d.balance) || 0;
              const mo = Number(d.monthly) || 0;
              const rate = Number(d.rate) || 0;
              const pctOfBal = bal > 0 ? (mo / bal * 100) : 0;
              const interestYr = bal * rate / 100;
              const isExpanded = expandedRowId === d.id;
              // Only "Yes - at Escrow" shows & contributes to the Payoff Amount column.
              // "Yes - before closing" is paid outside escrow, so no payoff amount there.
              const willPayoff = d.payoff === "Yes - at Escrow";
              const payoffAmt = willPayoff ? (Number(d.payoffAmount) || bal) : 0;
              const needsLinkUI = d.type === "Mortgage" || d.type === "HELOC";

              return (
                <React.Fragment key={d.id}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: COLS_DESKTOP,
                    background: isExpanded ? `${ACCENT}0A` : "transparent",
                    cursor: needsLinkUI || true ? "default" : "default",
                  }}>
                    <DataCell T={T}><SelCell value={d.type} onChange={v => {
                      calc.updateDebt(d.id, "type", v);
                      if (v !== "Mortgage" && v !== "HELOC") calc.updateDebt(d.id, "linkedReoId", "");
                    }} options={DEBT_TYPES} T={T} /></DataCell>
                    <DataCell T={T}><SelCell value={d.borrower || "Joint"} onChange={v => calc.updateDebt(d.id, "borrower", v)} options={BORROWER_OPTIONS} T={T} /></DataCell>
                    <DataCell T={T}><TextCell value={d.name} onChange={v => calc.updateDebt(d.id, "name", v)} placeholder="Creditor name" T={T} /></DataCell>
                    <DataCell align="right" T={T}><NumCell value={d.monthly} onChange={v => (d.linkedReoId && needsLinkUI) ? syncDebtPayment(d.id, v) : calc.updateDebt(d.id, "monthly", v)} T={T} /></DataCell>
                    <DataCell align="right" T={T}><NumCell value={d.balance} onChange={v => (d.linkedReoId && needsLinkUI) ? syncDebtBalance(d.id, v) : calc.updateDebt(d.id, "balance", v)} T={T} /></DataCell>
                    <DataCell align="right" T={T}>
                      <span style={{ fontSize: 12, fontFamily: MONO, color: T.textSecondary, fontWeight: 600 }}>
                        {bal > 0 ? `${pctOfBal.toFixed(1)}%` : "—"}
                      </span>
                    </DataCell>
                    <DataCell align="right" T={T}><NumCell value={d.rate} onChange={v => calc.updateDebt(d.id, "rate", v)} prefix="" suffix="%" T={T} /></DataCell>
                    <DataCell align="right" T={T}>
                      <span style={{ fontSize: 12, fontFamily: MONO, color: T.textSecondary, fontWeight: 600 }}>
                        {interestYr > 0 ? fmt(interestYr) : "$0"}
                      </span>
                    </DataCell>
                    <DataCell align="center" T={T}><SelCell value={d.payoff} onChange={v => calc.updateDebt(d.id, "payoff", v)} options={PAYOFF_OPTIONS} T={T} /></DataCell>
                    <DataCell align="right" T={T}>
                      {willPayoff ? (
                        <NumCell value={d.payoffAmount || 0} onChange={v => calc.updateDebt(d.id, "payoffAmount", v)} placeholder={String(bal)} T={T} />
                      ) : (
                        <span style={{ fontSize: 12, fontFamily: MONO, color: T.textTertiary }}>—</span>
                      )}
                    </DataCell>
                    <DataCell align="center" pad="6px 4px" T={T}>
                      <button onClick={() => {
                        if (needsLinkUI) toggleExpand(d.id);
                        else calc.removeDebt(d.id);
                      }} aria-label={needsLinkUI ? "Expand" : "Remove"}
                        style={{
                          width: 22, height: 22, borderRadius: 4,
                          background: "transparent",
                          border: `1px solid ${T.separator}`,
                          color: T.textSecondary, cursor: "pointer",
                          fontSize: 14, lineHeight: 1, padding: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >{needsLinkUI ? (isExpanded ? "−" : "+") : "×"}</button>
                    </DataCell>
                  </div>

                  {/* Expansion — for Mortgage/HELOC linked REO + row-level notes */}
                  {isExpanded && needsLinkUI && (
                    <div style={{
                      padding: "14px 20px",
                      background: `${ACCENT}08`,
                      borderBottom: `1px solid ${T.separator}`,
                    }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
                        <div>
                          {reos.length > 0 ? (
                            <Sel label="Linked REO Property" value={d.linkedReoId || ""} onChange={v => {
                              const oldReoId = d.linkedReoId;
                              calc.updateDebt(d.id, "linkedReoId", v);
                              const pmt = Number(d.monthly) || 0;
                              const balN = Number(d.balance) || 0;
                              if (oldReoId) {
                                const otherLinkedOld = debts.filter(dd => dd.linkedReoId === oldReoId && dd.id !== d.id && (dd.type === "Mortgage" || dd.type === "HELOC"));
                                const oldTotal = otherLinkedOld.reduce((s, dd) => s + (Number(dd.monthly) || 0), 0);
                                const oldBalTotal = otherLinkedOld.reduce((s, dd) => s + (Number(dd.balance) || 0), 0);
                                setReos(prev => prev.map(r => r.id === Number(oldReoId) ? { ...r, payment: oldTotal, mortgageBalance: oldBalTotal } : r));
                              }
                              if (v) {
                                const otherLinkedNew = debts.filter(dd => dd.linkedReoId === v && dd.id !== d.id && (dd.type === "Mortgage" || dd.type === "HELOC"));
                                const newTotal = otherLinkedNew.reduce((s, dd) => s + (Number(dd.monthly) || 0), 0) + pmt;
                                const newBalTotal = otherLinkedNew.reduce((s, dd) => s + (Number(dd.balance) || 0), 0) + balN;
                                setReos(prev => prev.map(r => r.id === Number(v) ? { ...r, payment: newTotal, mortgageBalance: newBalTotal } : r));
                              }
                            }} options={[{ value: "", label: "— Not linked —" }, ...reos.map((r, i) => ({ value: String(r.id), label: r.address || `Property ${i + 1}` }))]} sm />
                          ) : ownsProperties ? (
                            <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.4 }}>
                              Add properties on the REO tab to link this debt.
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.4 }}>
                              Toggle "Do you own any properties?" above to unlock the REO tab.
                            </div>
                          )}
                          {d.linkedReoId && (
                            <div style={{ fontSize: 11, color: ACCENT, marginTop: 6, fontWeight: 500, lineHeight: 1.4 }}>
                              Linked to REO — payment handled via 75% rental offset in DTI, not counted as standalone debt.
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <button onClick={() => calc.removeDebt(d.id)} style={{
                            padding: "6px 14px", borderRadius: 9999,
                            background: "transparent", border: `1px solid ${T.red}`,
                            color: T.red, fontSize: 12, fontWeight: 600, cursor: "pointer",
                            fontFamily: FONT,
                          }}>Remove Debt</button>
                        </div>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* Empty state */}
            {debts.length === 0 && (
              <div style={{ padding: "24px 16px", textAlign: "center" }}>
                <button onClick={() => calc.addDebt("Revolving")} style={{
                  padding: "10px 20px", borderRadius: 9999,
                  background: "transparent", border: `1.5px solid ${ACCENT}`,
                  color: ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  fontFamily: FONT,
                }}>+ Add your first debt</button>
              </div>
            )}

            {/* Totals row */}
            {debts.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: COLS_DESKTOP,
                background: T.inputBg,
                borderTop: `1px solid ${HEAD_BORDER}`,
              }}>
                <TotalCell align="left" T={T}><span style={{ paddingLeft: 8, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 11 }}>Totals</span></TotalCell>
                <TotalCell T={T}> </TotalCell>
                <TotalCell T={T}> </TotalCell>
                <TotalCell align="right" T={T}>{fmt(totalMonthly)}</TotalCell>
                <TotalCell align="right" T={T}>{fmt(totalBalance)}</TotalCell>
                <TotalCell T={T}> </TotalCell>
                <TotalCell T={T}> </TotalCell>
                <TotalCell align="right" T={T}>{fmt(totalInterestYr)}</TotalCell>
                <TotalCell T={T}> </TotalCell>
                <TotalCell align="right" T={T}>{totalPayoff > 0 ? fmt(totalPayoff) : "—"}</TotalCell>
                <TotalCell T={T}> </TotalCell>
              </div>
            )}
          </>
        )}

        {/* Mobile — condensed 5-col + tap row to expand full editor */}
        {!debtFree && !isDesktop && (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: COLS_MOBILE,
              background: HEAD_BG,
              borderBottom: `1px solid ${HEAD_BORDER}`,
            }}>
              <HeaderCell T={T} headBorder={HEAD_BORDER}>Type</HeaderCell>
              <HeaderCell T={T} headBorder={HEAD_BORDER}>Creditor</HeaderCell>
              <HeaderCell align="right" T={T} headBorder={HEAD_BORDER}>Monthly</HeaderCell>
              <HeaderCell align="right" T={T} headBorder={HEAD_BORDER}>Balance</HeaderCell>
              <HeaderCell align="center" T={T} headBorder={HEAD_BORDER}>Payoff at Closing?</HeaderCell>
              <HeaderCell align="center" T={T} headBorder={HEAD_BORDER}> </HeaderCell>
            </div>

            {debts.map((d) => {
              const isExpanded = expandedRowId === d.id;
              const needsLinkUI = d.type === "Mortgage" || d.type === "HELOC";
              const bal = Number(d.balance) || 0;
              return (
                <React.Fragment key={d.id}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: COLS_MOBILE,
                    background: isExpanded ? `${ACCENT}0A` : "transparent",
                  }}>
                    <DataCell T={T}><SelCell value={d.type} onChange={v => calc.updateDebt(d.id, "type", v)} options={DEBT_TYPES} T={T} /></DataCell>
                    <DataCell T={T}><TextCell value={d.name} onChange={v => calc.updateDebt(d.id, "name", v)} placeholder="Creditor" T={T} /></DataCell>
                    <DataCell align="right" T={T}><NumCell value={d.monthly} onChange={v => calc.updateDebt(d.id, "monthly", v)} T={T} /></DataCell>
                    <DataCell align="right" T={T}><NumCell value={d.balance} onChange={v => calc.updateDebt(d.id, "balance", v)} T={T} /></DataCell>
                    <DataCell align="center" T={T}><SelCell value={d.payoff} onChange={v => calc.updateDebt(d.id, "payoff", v)} options={PAYOFF_OPTIONS} T={T} /></DataCell>
                    <DataCell align="center" pad="6px 4px" T={T}>
                      <button onClick={() => toggleExpand(d.id)} aria-label="Expand" style={{
                        width: 22, height: 22, borderRadius: 4,
                        background: "transparent", border: `1px solid ${T.separator}`,
                        color: T.textSecondary, cursor: "pointer",
                        fontSize: 14, lineHeight: 1, padding: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{isExpanded ? "−" : "+"}</button>
                    </DataCell>
                  </div>
                  {isExpanded && (
                    <div style={{
                      padding: "12px 14px",
                      background: `${ACCENT}08`,
                      borderBottom: `1px solid ${T.separator}`,
                    }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <Sel label="Borrower" value={d.borrower || "Joint"} onChange={v => calc.updateDebt(d.id, "borrower", v)} options={BORROWER_OPTIONS} sm />
                        <Inp label="Interest Rate" value={d.rate} onChange={v => calc.updateDebt(d.id, "rate", v)} prefix="" suffix="%" sm step={0.01} />
                      </div>
                      {d.payoff === "Yes - at Escrow" && (
                        <Inp label="Payoff Amount" value={d.payoffAmount || 0} onChange={v => calc.updateDebt(d.id, "payoffAmount", v)} sm tip={`Leave 0 to use full balance (${fmt(bal)})`} />
                      )}
                      {needsLinkUI && reos.length > 0 && (
                        <Sel label="Linked REO Property" value={d.linkedReoId || ""} onChange={v => calc.updateDebt(d.id, "linkedReoId", v)} options={[{ value: "", label: "— Not linked —" }, ...reos.map((r, i) => ({ value: String(r.id), label: r.address || `Property ${i + 1}` }))]} sm />
                      )}
                      <button onClick={() => calc.removeDebt(d.id)} style={{
                        marginTop: 8, padding: "8px 14px", borderRadius: 9999,
                        background: "transparent", border: `1px solid ${T.red}`,
                        color: T.red, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        fontFamily: FONT, width: "100%",
                      }}>Remove Debt</button>
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {debts.length === 0 && (
              <div style={{ padding: "20px 16px", textAlign: "center" }}>
                <button onClick={() => calc.addDebt("Revolving")} style={{
                  padding: "10px 20px", borderRadius: 9999,
                  background: "transparent", border: `1.5px solid ${ACCENT}`,
                  color: ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  fontFamily: FONT,
                }}>+ Add your first debt</button>
              </div>
            )}

            {/* Mobile totals */}
            {debts.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: COLS_MOBILE,
                background: T.inputBg,
                borderTop: `1px solid ${HEAD_BORDER}`,
              }}>
                <TotalCell align="left" T={T}><span style={{ paddingLeft: 8, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 11 }}>Totals</span></TotalCell>
                <TotalCell T={T}> </TotalCell>
                <TotalCell align="right" T={T}>{fmt(totalMonthly)}</TotalCell>
                <TotalCell align="right" T={T}>{fmt(totalBalance)}</TotalCell>
                <TotalCell T={T}> </TotalCell>
                <TotalCell T={T}> </TotalCell>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Debt button — moved here from the blue banner, matches Assets pattern */}
      {!debtFree && (
        <button onClick={() => calc.addDebt("Revolving")} style={{
          width: "100%", padding: 12, marginBottom: 16,
          background: `${ACCENT}10`, border: `1px dashed ${ACCENT}44`, borderRadius: 10,
          color: ACCENT, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FONT,
        }}>
          + Add Debt
        </button>
      )}

      {/* Bottom summary card — Total Monthly Debts + back-end DTI progress (mirrors Assets pattern) */}
      {(() => {
        const monthlyDebts = debtFree ? 0 : (calc.totalMonthlyDebts || 0);
        const housing = calc.housingPayment || 0;
        const income = calc.qualifyingIncome || 0;
        const dti = income > 0 ? ((housing + monthlyDebts) / income) : null;
        const maxDti = calc.maxDTI || 0.50;
        const dtiOk = dti !== null && dti <= maxDti;
        return (
          <Card pad={16}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 11, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", color: T.textTertiary, fontWeight: 700 }}>Total Monthly Debts</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FONT, color: debtFree ? T.green : T.text, letterSpacing: "-0.02em", marginTop: 2 }}>
                  {fmt(monthlyDebts)}<span style={{ fontSize: 13, color: T.textTertiary, fontWeight: 600 }}>/mo</span>
                </div>
              </div>
              {!debtFree && calc.qualifyingDebts && calc.qualifyingDebts.length > 0 && (
                <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: MONO, letterSpacing: 0.5 }}>
                  {calc.qualifyingDebts.length} qualifying
                </div>
              )}
            </div>
            {income > 0 && dti !== null ? (<>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 4px", fontSize: 13, borderTop: `1px solid ${T.separator}`, marginTop: 8 }}>
                <span style={{ color: T.textSecondary, fontWeight: 500 }}>Back-end DTI ({calc.qualifyingIncome > 0 ? `${fmt(calc.qualifyingIncome)}/mo income` : "income"})</span>
                <span style={{ fontFamily: FONT, fontWeight: 700, color: dtiOk ? T.green : T.red }}>
                  {(dti * 100).toFixed(1)}% / {(maxDti * 100).toFixed(0)}% max
                </span>
              </div>
              <Progress value={dti} max={maxDti} color={dtiOk ? T.green : T.red} height={10} />
              <div style={{ fontSize: 11, color: dtiOk ? T.green : T.red, fontWeight: 500, marginTop: 6 }}>
                {dtiOk ? `✓ Within limits — ${fmt(income * maxDti - housing - monthlyDebts)}/mo headroom` : `Above max — reduce debts or increase income`}
              </div>
            </>) : (
              <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5, paddingTop: 6, borderTop: `1px solid ${T.separator}`, marginTop: 8 }}>
                Add income on the Income tab to see your back-end DTI.
              </div>
            )}
            {calc.reoNegativeDebt > 0 && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: `${T.orange}10`, borderRadius: 8, fontSize: 11, color: T.orange, lineHeight: 1.5 }}>
                +{fmt(calc.reoNegativeDebt)}/mo from REO properties already included in DTI calc.
              </div>
            )}
          </Card>
        );
      })()}
    </>}

    <GuidedNextButton />
  </>);
}
