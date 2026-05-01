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

// Small clickable "i" icon — opens a modal popup with the explainer text.
// Calc strings are now rendered inline next to the fee label (see FeeRow), so this
// bubble only carries the prose explainer. Mirrors the InfoTip pattern used elsewhere
// (Setup, Calculator, etc.) so behavior stays consistent.
function InfoTipBubble({ explainer }) {
  const { T } = useContext(CostsCtx);
  const [open, setOpen] = useState(false);
  if (!explainer) return null;
  return (
    <span style={{ position: "relative", display: "inline-flex", marginLeft: 6, verticalAlign: "middle" }}
      onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
      <span
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 16, height: 16, borderRadius: "50%",
          background: open ? T.blue : `${T.blue}20`, color: open ? "#fff" : T.blue,
          fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
          lineHeight: 1, transition: "all 0.2s", userSelect: "none",
        }}
      >i</span>
      {open && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(false); }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.35)" }} />
          <div style={{ position: "relative", zIndex: 1, background: T.card, border: `1px solid ${T.separator}`, borderRadius: 14, padding: "18px 20px", width: "min(320px, 85vw)", boxShadow: "0 8px 30px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: T.textSecondary }}>
              {explainer}
            </div>
            <button onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(false); }} style={{ marginTop: 12, width: "100%", padding: "10px 0", background: T.blue, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: FONT }}>Got it</button>
          </div>
        </div>
      )}
    </span>
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
    <div className="cost-letter-section" style={{
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
        <div className="cost-letter-section-rows">
          {children}
        </div>
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
  prefixEditor = null,           // NEW: always-visible editor rendered BEFORE the label
  hideWhenLockedAndZero = false, // NEW: row collapses entirely when section is locked AND value is 0
  calc, explainer,
}) {
  const { T, fmt2, Inp } = useContext(CostsCtx);
  const { unlocked: sectionUnlocked } = useContext(LockCtx);

  // Hide-when-locked-and-zero: lets a section have "advanced" rows that only appear
  // once the section is unlocked. Used by Property Taxes — Installment / Sellers
  // Prorated Reimbursement so the default (zeroed) view stays clean.
  if (hideWhenLockedAndZero && !sectionUnlocked && (value === 0 || value === null || value === undefined || value === "")) {
    return null;
  }

  // Determine effective edit mode for this row.
  // - editable (value): row's main value can be edited via inline number input.
  // - inlineEditor: separate from readOnly — appears whenever the section is unlocked OR alwaysEdit,
  //   even on readOnly rows like Transfer Taxes (where the city dropdown drives the calculated value).
  const editable = !readOnly && (alwaysEdit || sectionUnlocked);
  const showInlineEditor = (alwaysEdit || sectionUnlocked) && !!inlineEditor;
  const showInlineNumberInput = editable && !inlineEditor;

  const displayVal = isDollar ? (value === 0 || value === "" || value == null ? "$0.00" : fmt2(value)) : value;

  return (
    <div style={{ borderBottom: `1px dashed ${T.separator}` }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 0",
        minHeight: 30,
        gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", alignItems: "center", fontSize: 13, color: bold ? T.text : T.textSecondary, fontWeight: bold ? 700 : 500, lineHeight: 1.3, flexWrap: "wrap", rowGap: 2 }}>
            <span>{label}</span>
            {sub && <span style={{ color: T.textTertiary, fontSize: 11, marginLeft: 6, fontFamily: MONO }}>{sub}</span>}
            {/* prefixEditor name kept for backwards compat, but it now renders AFTER the
                label and BEFORE the calc string — so the row label stays left-aligned with
                its siblings (per Christo's spec). Used by the closing-date pills on the
                Prepaid Interest row. */}
            {prefixEditor && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: 8 }}>
                {prefixEditor}
              </span>
            )}
            {calc && (
              <span style={{
                color: T.textTertiary,
                fontSize: 11,
                marginLeft: 8,
                fontFamily: MONO,
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}>
                · {calc}
              </span>
            )}
            <InfoTipBubble explainer={explainer} />
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
      {note && (editable || readOnly) && (
        <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 4, paddingBottom: 4 }}>{note}</div>
      )}
    </div>
  );
}

// Small inline toggle row — used for escrow on/off and buyer-pays-comm.
// Hint renders inline next to the label (separated by a middot) so the row stays
// single-line on desktop, matching the FeeRow inline-calc treatment.
function ToggleRow({ label, hint, on, onChange }) {
  const { T, ACCENT } = useContext(CostsCtx);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px dashed ${T.separator}`, gap: 10 }}>
      <div style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", rowGap: 2, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{label}</span>
        {hint && (
          <span style={{
            fontSize: 11,
            color: T.textTertiary,
            marginLeft: 8,
            fontWeight: 400,
            lineHeight: 1.3,
          }}>· {hint}</span>
        )}
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

// Escrow Calendar — chevron-collapsible 12-month forward projection of the escrow
// account from closing date. Mirrors the property-tax breakdown chevron pattern used
// in CalculatorContent (▾ rotates 180° when expanded). Deposits flow in monthly,
// disbursements go out on:
//   - Dec (CA Property Tax Installment 1 — half annual tax)
//   - Apr (CA Property Tax Installment 2 — half annual tax)
//   - Closing-month anniversary (full annual insurance premium)
// When expanded, a compact info-chip row sits above the calendar with the key dates
// + amounts so users get the headline numbers without scanning the whole table.
function EscrowCalendar({
  open, onToggle,
  closingMonth, closingDay,
  monthlyTax, monthlyIns, annualIns,
  startingBalance,
  monthNames, fmt2,
}) {
  const { T, ACCENT } = useContext(CostsCtx);
  const annualTax = monthlyTax * 12;
  const monthlyDeposit = (annualTax + annualIns) / 12;
  const insMonthIdx = closingMonth - 1; // 0-based; insurance disburses on closing-month anniversary
  // Build 13 rows: starting balance + 12 forward months. We start from the month
  // AFTER the closing month so the first deposit row is one month post-close.
  const rows = [];
  let balance = startingBalance;
  for (let i = 0; i < 13; i++) {
    const monthIdx = (closingMonth + i) % 12;
    const monthName = monthNames[monthIdx];
    const deposit = monthlyDeposit;
    let disbursement = 0;
    if (monthIdx === 11) disbursement += annualTax / 2;     // December
    if (monthIdx === 3)  disbursement += annualTax / 2;     // April
    if (monthIdx === insMonthIdx) disbursement += annualIns; // closing-month anniversary
    balance = balance + deposit - disbursement;
    rows.push({ monthName, deposit, disbursement, balance });
  }

  // Account-info chips — compact summary, only visible when expanded.
  // Starting Balance is already shown in its own row at the top of the calendar table,
  // so we don't repeat it as a chip.
  const chips = [
    { label: "Tax Inst. 1", value: `${fmt2(annualTax / 2)} · Dec 10` },
    { label: "Tax Inst. 2", value: `${fmt2(annualTax / 2)} · Apr 10` },
    { label: "Insurance",   value: `${fmt2(annualIns)} · ${monthNames[insMonthIdx].slice(0, 3)} (annual)` },
    { label: "Monthly",     value: fmt2(monthlyDeposit) },
  ];

  return (
    <div>
      {/* Chevron toggle row — same pattern as the propTax breakdown chevron */}
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 0", cursor: "pointer", userSelect: "none",
          borderBottom: `1px dashed ${T.separator}`,
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.blue, fontFamily: FONT }}>
            {open ? "Hide Escrow Calendar" : "Show Escrow Calendar"}
          </span>
          <span style={{
            fontSize: 12, color: T.blue,
            transform: `translateY(-1px) rotate(${open ? 180 : 0}deg)`,
            transition: "transform 0.2s", display: "inline-block",
          }}>▾</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: "12px 0 8px" }}>
          {/* Compact info chips */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12,
          }}>
            {chips.map((c, i) => (
              <div key={i} style={{
                display: "inline-flex", alignItems: "baseline", gap: 6,
                padding: "5px 10px", borderRadius: 9999,
                background: `${ACCENT}10`, border: `1px solid ${ACCENT}26`,
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, color: T.textTertiary,
                  fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase",
                }}>{c.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: FONT }}>
                  {c.value}
                </span>
              </div>
            ))}
          </div>

          {/* Calendar table */}
          <div style={{
            background: T.bg || `${ACCENT}05`,
            border: `1px solid ${T.separator}`,
            borderRadius: 10, overflow: "hidden",
          }}>
            {/* Header band */}
            <div style={{
              display: "grid", gridTemplateColumns: "1.2fr 1fr 1.1fr 1fr",
              padding: "8px 12px", background: ACCENT, color: "#fff",
              fontSize: 10, fontWeight: 700, fontFamily: MONO,
              letterSpacing: 1, textTransform: "uppercase",
            }}>
              <span>Month</span>
              <span style={{ textAlign: "right" }}>Deposit</span>
              <span style={{ textAlign: "right" }}>Disbursement</span>
              <span style={{ textAlign: "right" }}>Balance</span>
            </div>
            {/* Starting balance row */}
            <div style={{
              display: "grid", gridTemplateColumns: "1.2fr 1fr 1.1fr 1fr",
              padding: "8px 12px", borderBottom: `1px solid ${T.separator}`,
              background: `${ACCENT}08`,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: FONT }}>
                Starting Balance
              </span>
              <span></span>
              <span style={{ fontSize: 12, color: T.textTertiary, fontFamily: FONT, textAlign: "right" }}>
                $0.00
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: FONT, textAlign: "right" }}>
                {fmt2(startingBalance)}
              </span>
            </div>
            {/* Monthly rows */}
            {rows.map((r, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1.2fr 1fr 1.1fr 1fr",
                padding: "8px 12px",
                borderBottom: i < rows.length - 1 ? `1px solid ${T.separator}` : "none",
                background: r.disbursement > 0 ? `${ACCENT}06` : "transparent",
              }}>
                <span style={{ fontSize: 12, color: T.text, fontFamily: FONT }}>
                  {r.monthName}
                </span>
                <span style={{ fontSize: 12, fontFamily: FONT, color: T.textSecondary, textAlign: "right" }}>
                  {fmt2(r.deposit)}
                </span>
                <span style={{
                  fontSize: 12, fontFamily: FONT,
                  color: r.disbursement > 0 ? T.red : T.textTertiary,
                  fontWeight: r.disbursement > 0 ? 600 : 400,
                  textAlign: "right",
                }}>
                  {r.disbursement > 0 ? fmt2(r.disbursement) : "—"}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: FONT, textAlign: "right" }}>
                  {fmt2(r.balance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Cash-to-Close summary table (top of fees) — brand-kit styled.
// Sums Down Payment + Closing Costs + Prepaids + Payoffs − Credits.
function CashToCloseSummary({ T, ACCENT, fmt2, downPayment, closingCosts, prepaids, payoffs, credits, isRefi }) {
  const total = (isRefi ? 0 : downPayment) + closingCosts + prepaids + payoffs - credits;
  // Payoffs and Credits rows are dynamic — hide when zero per Christo (less noise on simple deals).
  // Down Payment / Closing Costs / Prepaids stay visible even at $0 since they're load-bearing line items.
  const rows = [
    !isRefi && { label: "Down Payment",         sign: "+", value: downPayment },
    { label: "Closing Costs",         sign: "+", value: closingCosts },
    { label: "Prepaid Expenses",      sign: "+", value: prepaids },
    payoffs > 0 && { label: "Loans / Debts to Payoff", sign: "+", value: payoffs },
    credits > 0 && { label: "Credits To Buyer",      sign: "−", value: credits },
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
  propertyTaxesInstallment, setPropertyTaxesInstallment,
  sellersProratedTaxCredit, setSellersProratedTaxCredit,
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
  const [sectionLocks, setSectionLocks] = useState({ A: true, B: true, C: true, E: true, F: true, H: true });
  const [escrowCalendarOpen, setEscrowCalendarOpen] = useState(false);
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
  const shortMonthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthOptions = monthNames.map((m, i) => ({ value: i + 1, label: m }));
  // Compact options for the inline closing-date pill on the Prepaid Interest row.
  const shortMonthOptions = shortMonthNames.map((m, i) => ({ value: i + 1, label: m }));
  const dayOptions = Array.from({ length: new Date(new Date().getFullYear(), closingMonth, 0).getDate() }, (_, i) => ({ value: i + 1, label: String(i + 1) }));

  return (
    <CostsCtx.Provider value={ctx}>
      {/* Strip the trailing dashed border off the LAST row of every LetterSection
          so an unmatched border + section bottom-margin doesn't read as an empty row.
          (Prior visual bug: ToggleRow with no following sibling looked like it had
          a phantom blank line beneath it in section H.) */}
      <style>{`
        .cost-letter-section-rows > *:last-child {
          border-bottom: none !important;
        }
      `}</style>
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

        {/* F. Prepaids — lockable so the two Property Tax rows can be revealed for editing.
            Order matches Christo's client-walkthrough spreadsheet:
              1) Prepaid Interest (with inline closing-date pills before the label)
              2) Homeowner's Insurance — First Year (read-only, derives from Setup)
              3) Property Taxes — Installment (hidden until unlocked or non-zero)
              4) Property Taxes — Sellers Prorated Reimbursement (hidden until unlocked or non-zero)
              5) Mortgage Insurance Premium (FHA/USDA only)
              6) Include Escrow Impounds toggle (gates Section G) */}
        <LetterSection letter="F" title="Prepaids" lockable>
          {/* 1. Prepaid Interest — closing date pills sit BEFORE the label as a prefixEditor.
              Pills are tight (width 78 / 56) so the row stays single-line on desktop. */}
          <FeeRow
            label="Prepaid Interest"
            value={calc.prepaidInt}
            readOnly
            autoBadge
            prefixEditor={
              <>
                <div style={{ width: 72 }}>
                  <Sel value={closingMonth} onChange={v => setClosingMonth(parseInt(v))} options={shortMonthOptions} sm />
                </div>
                <div style={{ width: 56 }}>
                  <Sel value={closingDay} onChange={v => setClosingDay(parseInt(v))} options={dayOptions} sm />
                </div>
              </>
            }
            calc={`${calc.autoPrepaidDays} days × ${fmt2(calc.dailyInt)}/day = ${fmt2(calc.prepaidInt)}`}
            explainer="Interest from closing day through end of month — the closing date pills on the left drive this calc"
          />

          {/* 2. Homeowner's Insurance — First Year — read-only. Calculates from monthly
              insurance (annualIns / 12) set in Setup. No inline edit here. */}
          <FeeRow
            label="Homeowner's Insurance — First Year"
            value={annualIns}
            readOnly
            autoBadge
            calc={`12 mo × ${fmt2(annualIns / 12)}/mo = ${fmt2(annualIns)}`}
            explainer="First-year homeowner's insurance, calculated from monthly insurance × 12. Edit the monthly amount in the Setup tab."
          />

          {/* 3. Property Taxes — Installment (hidden by default; revealed when section unlocked) */}
          <FeeRow
            label="Property Taxes — Installment"
            value={propertyTaxesInstallment}
            onChange={setPropertyTaxesInstallment}
            hideWhenLockedAndZero
            explainer="Lump-sum property tax installment due to lender at closing. Common when closing falls inside a tax billing period."
          />

          {/* 4. Property Taxes — Sellers Prorated Reimbursement (hidden by default).
              Stored as a positive amount; calc subtracts it as a credit. Green text
              + the word "Reimbursement" makes the credit nature clear without needing
              a negative-sign workaround in the editor. */}
          <FeeRow
            label="Property Taxes — Sellers Prorated Reimbursement"
            value={sellersProratedTaxCredit}
            onChange={setSellersProratedTaxCredit}
            hideWhenLockedAndZero
            color={T.green}
            explainer="Credit from seller for property taxes they prepaid covering the buyer's ownership period after closing. Subtracted from total prepaids."
          />

          {/* 5. Mortgage Insurance Premium — FHA/USDA only, last in section.
              The Include Escrow Impounds toggle moved to the BOTTOM of Section G
              (mirrors how Buyer Pays Agent Commission lives at the bottom of H). */}
          {monthlyMI > 0 && (
            <FeeRow
              label="Mortgage Insurance Premium"
              value={0}
              readOnly
              autoBadge
              explainer="Upfront MI premium (FHA/USDA only — conv. MI is monthly)"
            />
          )}
        </LetterSection>

        {/* G. Initial Escrow Payment at Closing.
            Include Escrow Impounds toggle lives at the bottom of THIS section now
            (mirrors how Buyer Pays Agent Commission anchors the bottom of Section H).
            Toggle stays visible whether escrow is on or off so users can flip it back. */}
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
              {/* Escrow Calendar — chevron expander showing 12-month forward projection.
                  Sits BETWEEN the reserves and the toggle so the toggle stays last. */}
              <EscrowCalendar
                open={escrowCalendarOpen}
                onToggle={() => setEscrowCalendarOpen(o => !o)}
                closingMonth={closingMonth}
                closingDay={closingDay}
                monthlyTax={monthlyTax}
                monthlyIns={monthlyIns}
                annualIns={annualIns}
                startingBalance={escrowHOI_reserve + escrowTax_reserve}
                monthNames={monthNames}
                fmt2={fmt2}
              />
            </>
          )}
          {/* Toggle anchored at the bottom of Section G */}
          <ToggleRow
            label="Include Escrow Impounds"
            hint="Toggle OFF to waive escrow — no property tax or insurance reserves collected at closing"
            on={includeEscrow}
            onChange={setIncludeEscrow}
          />
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
