import { FONT } from "../lib/fonts.js";
import React, { useState, useContext, createContext, useMemo } from "react";
import Icon from "../Icon";
import CashToCloseSummary from "../components/CashToCloseSummary";
import { devCheckProps } from "../lib/devPropCheck.js";
import { TIERS as TITLE_ESCROW_TIERS, isRegionState, lookupTitleEscrow } from "../data/titleEscrowFees.js";

// Collapsible "where these numbers come from" chart for the refi title/escrow
// rows. Shows the full tier table with the borrower's bracket highlighted, so
// an LO can see how close the loan is to the next threshold (Christo
// 2026-07-22). Deliberately never names the underwriter — these are estimates.
function TitleEscrowScheduleNote({ T, fmt, loanAmount, state }) {
  const [open, setOpen] = useState(false);
  const applies = isRegionState(state);
  const current = applies ? lookupTitleEscrow(loanAmount, state) : null;
  if (!applies) {
    return (
      <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, padding: "6px 2px 2px", lineHeight: 1.5 }}>
        Estimated fees — no tiered schedule on file for {state || "this state"}, so these are flat defaults. Confirm with your title rep.
      </div>
    );
  }
  const cell = { padding: "4px 8px", fontSize: 11, fontFamily: FONT, whiteSpace: "nowrap" };
  return (
    <div style={{ padding: "4px 2px 2px" }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", color: T.blue, fontSize: 11, fontWeight: 600, fontFamily: FONT }}>
        <Icon name={open ? "chevron-down" : "chevron-right"} size={12} />
        Estimated fees — how the tiers work
      </div>
      {current && (
        <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, marginTop: 3, lineHeight: 1.5 }}>
          {current.overCap
            ? `Loan is above the ${fmt(5000000)} top tier — the policy adds $500 per additional $1M.`
            : `A ${fmt(Math.round(loanAmount || 0))} loan falls in the "up to ${fmt(current.tier)}" bracket.`}
        </div>
      )}
      {open && (
        <div style={{ marginTop: 8, overflowX: "auto", border: `1px solid ${T.separator}`, borderRadius: 10 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 340 }}>
            <thead>
              <tr style={{ background: T.inputBg }}>
                <th style={{ ...cell, textAlign: "left", color: T.textSecondary, fontWeight: 700 }}>Loan up to</th>
                <th style={{ ...cell, textAlign: "right", color: T.textSecondary, fontWeight: 700 }}>Lender's policy</th>
                <th style={{ ...cell, textAlign: "right", color: T.textSecondary, fontWeight: 700 }}>Escrow</th>
                <th style={{ ...cell, textAlign: "right", color: T.textSecondary, fontWeight: 700 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {TITLE_ESCROW_TIERS.map(t => {
                const active = current && !current.overCap && current.tier === t.upTo;
                return (
                  <tr key={t.upTo} style={{ background: active ? `${T.blue}14` : "transparent", borderTop: `1px solid ${T.separator}` }}>
                    <td style={{ ...cell, color: active ? T.blue : T.text, fontWeight: active ? 700 : 500 }}>{fmt(t.upTo)}</td>
                    <td style={{ ...cell, textAlign: "right", color: active ? T.blue : T.textSecondary }}>{fmt(t.loanPolicy)}</td>
                    <td style={{ ...cell, textAlign: "right", color: active ? T.blue : T.textSecondary }}>{fmt(t.escrow)}</td>
                    <td style={{ ...cell, textAlign: "right", fontWeight: 700, color: active ? T.blue : T.text }}>{fmt(t.loanPolicy + t.escrow)}</td>
                  </tr>
                );
              })}
              <tr style={{ background: current?.overCap ? `${T.blue}14` : "transparent", borderTop: `1px solid ${T.separator}` }}>
                <td style={{ ...cell, color: T.textSecondary }}>Above {fmt(5000000)}</td>
                <td colSpan={3} style={{ ...cell, textAlign: "right", color: T.textSecondary }}>
                  {fmt(3695)} + {fmt(500)} per additional $1M · escrow {fmt(1235)}
                </td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: T.textTertiary, fontFamily: FONT, padding: "6px 8px", lineHeight: 1.5 }}>
            Estimates for a single-loan residential refinance. Excludes recording fees and transfer/SB2 charges, which are itemized in section E. Confirm with your title rep.
          </div>
        </div>
      )}
    </div>
  );
}


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
      fontSize: 9, fontWeight: 700, color: T.textTertiary, fontFamily: FONT,
      letterSpacing: 1, padding: "2px 5px", border: `1px solid ${T.separator}`,
      borderRadius: 4, lineHeight: 1, whiteSpace: "nowrap",
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
// `headerExtra` — optional element (e.g. the master Edit-All lock pill)
// rendered in the header between the title and the total. Must be a
// non-button element with its own stopPropagation: the whole header is a
// <button> (nested buttons are invalid HTML and double-fire the collapse).
function CollapsibleBox({ title, total, totalColor, defaultOpen = true, headerExtra = null, fill = false, children }) {
  const { T, ACCENT, HEAD_BG, HEAD_BORDER, BODY_BORDER } = useContext(CostsCtx);
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${BODY_BORDER}`,
      borderRadius: 14,
      overflow: "hidden",
      marginBottom: 12,
      // fill: stretch to match the sibling column's height (left Costs column)
      ...(fill ? { flex: 1 } : {}),
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
            fontFamily: FONT,
          }}>{title}</span>
        </div>
        {(headerExtra || total !== undefined) && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {headerExtra}
            {total !== undefined && (
              <div style={{
                fontSize: 14,
                fontWeight: 700,
                fontFamily: FONT,
                color: totalColor || ACCENT,
              }}>{total}</div>
            )}
          </div>
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
          fontFamily: FONT,
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
                fontSize: 10, fontWeight: 700, fontFamily: FONT, letterSpacing: 1,
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
        fontFamily: FONT,
      }}>
        <span style={{ marginRight: 8 }}>{letter}.</span>
        {title}
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: FONT, color: ACCENT }}>{total}</div>
    </div>
  );
}

// CompactNumPill — tight 20px-tall numeric input pill for use as inlineEditor in FeeRow.
// Holds a local edit-string so the user can type intermediate states like "-" (before the
// digit) or "0." (before the decimal) without those being clamped to a number prematurely.
// Commits the parsed/clamped number on every keystroke once the string parses cleanly,
// and on blur falls back to clamp(value).
function CompactNumPill({ value, onChange, suffix = "", min = -Infinity, max = Infinity, width = 48, title }) {
  const { T } = useContext(CostsCtx);
  const [editStr, setEditStr] = useState(null);
  const [focused, setFocused] = useState(false);
  const display = focused ? (editStr ?? String(value)) : String(value);
  const clamp = (n) => Math.max(min, Math.min(max, n));
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: T.inputBg, border: `1px solid ${T.inputBorder}`,
      borderRadius: 9999, padding: "0 8px", height: 20,
    }}>
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onFocus={() => { setFocused(true); setEditStr(String(value)); }}
        onBlur={() => {
          setFocused(false);
          if (editStr !== null) {
            const n = parseFloat(editStr);
            onChange(isNaN(n) ? 0 : clamp(n));
            setEditStr(null);
          }
        }}
        onChange={e => {
          // Allow only digits, minus, dot. Permit intermediate states: "", "-", "1.", "-0."
          const raw = e.target.value.replace(/[^\-0-9.]/g, "");
          // Only allow one leading minus and one decimal.
          const cleaned = raw.replace(/(?!^)-/g, "").replace(/\.(?=.*\.)/g, "");
          setEditStr(cleaned);
          // Commit immediately if it parses to a finite number; otherwise leave value
          // alone so '-' or '' don't reset to 0 mid-typing.
          if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return;
          const n = parseFloat(cleaned);
          if (!isNaN(n) && isFinite(n)) onChange(clamp(n));
        }}
        title={title}
        style={{
          width, background: "transparent", border: "none", outline: "none",
          color: T.text, fontSize: 13, fontWeight: 600, fontFamily: FONT,
          textAlign: "right", padding: 0, height: 18, lineHeight: 1,
        }}
      />
      {suffix && <span style={{ color: T.textTertiary, fontSize: 12, fontFamily: FONT }}>{suffix}</span>}
    </div>
  );
}

// DashedInline — the dashed-blue in-place value editor, same visual language
// as the tax-breakdown inline editors in CalculatorContent (box around blue
// font). Replaces the old 130px Inp pill when a section is unlocked
// (Christo 2026-07-05). Raw input, height 20, tight padding — per the
// FeeRow inline-editor rule (no Inp/Sel wrappers here).
function DashedInline({ value, onChange, prefix = "$", suffix = null, max }) {
  const { T } = useContext(CostsCtx);
  const [focused, setFocused] = useState(false);
  const [editStr, setEditStr] = useState(null);
  const clamp = (n) => {
    let v = n;
    if (max != null && v > max) v = max;
    if (v < 0) v = 0;
    return v;
  };
  const fmtComma = (n) => {
    if (n === 0 || n === "0") return "0";
    if (n === "" || n == null) return "";
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  const shown = focused
    ? (editStr !== null ? editStr : (value === 0 ? "" : String(value)))
    : `${prefix || ""}${fmtComma(value || 0)}`;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <input
        type="text"
        inputMode="decimal"
        value={shown}
        onFocus={() => { setFocused(true); setEditStr(null); }}
        onBlur={() => {
          setFocused(false);
          if (editStr !== null) {
            const n = parseFloat(editStr.replace(/,/g, ""));
            onChange(isNaN(n) ? 0 : clamp(n));
            setEditStr(null);
          }
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, "");
          if (/^\d*\.?\d*$/.test(raw)) {
            setEditStr(raw);
            const n = parseFloat(raw);
            if (!isNaN(n)) onChange(clamp(n));
          }
        }}
        style={{
          background: focused ? T.inputBg : "transparent",
          border: focused ? `1.5px solid ${T.blue}` : `1px dashed ${T.blue}55`,
          borderRadius: 6, padding: "0 8px", height: 20, boxSizing: "border-box",
          color: T.blue, fontSize: 13, fontWeight: 600, fontFamily: FONT,
          textAlign: "right", width: 96, outline: "none", cursor: "text",
        }}
      />
      {suffix && <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT }}>{suffix}</span>}
    </span>
  );
}


// ── Fee catalog for the per-section "+ Add fee" menu (Christo 2026-07-05).
//    Typical CA amounts; the LO edits after adding. ──
const FEE_CATALOG = {
  A: [
    { label: "Application Fee", amount: 500 },
    { label: "Rate Lock Extension Fee", amount: 500 },
    { label: "Commitment Fee", amount: 0 },
  ],
  B: [
    { label: "VOE / Verification Fee", amount: 100 },
    { label: "Condo Questionnaire Fee", amount: 300 },
    { label: "Subordination Fee", amount: 250 },
    { label: "Final Inspection Fee", amount: 150 },
    { label: "Desk/Field Review Fee", amount: 200 },
  ],
  C: [
    { label: "Survey Fee", amount: 400 },
    { label: "Pest Inspection", amount: 150 },
    { label: "Attorney Fee", amount: 750 },
    { label: "Title — Endorsement Fee", amount: 100 },
    { label: "Title — Mobile Notary Fee", amount: 175 },
    { label: "Title — Recording Service Fee", amount: 17 },
  ],
  E: [
    { label: "State Tax / Stamps", amount: 0 },
    { label: "Intangible Tax", amount: 0 },
    { label: "City Point-of-Sale Fee", amount: 300 },
  ],
  CR: [
    { label: "Builder Credit", amount: 0 },
    { label: "Employer / Relocation Credit", amount: 0 },
    { label: "Appraisal Credit", amount: 0 },
    { label: "Seller-Paid Rate Buydown", amount: 0 },
  ],
  H: [
    { label: "Home Inspection", amount: 500 },
    { label: "HOA Capital Contribution", amount: 0 },
    { label: "Sewer Lateral / Point-of-Sale", amount: 250 },
    { label: "Home Warranty Upgrade", amount: 150 },
  ],
};

// ── Saved custom fee types (Christo 2026-07-22) ──
// A custom fee typed into "+ Add fee" used to vanish with the scenario. Now it
// is remembered per section in localStorage (this device/browser) and offered
// in the dropdown on every future scenario, tagged "saved". Amount is captured
// when the fee is added; picking it later seeds that amount. The × on a saved
// row forgets the type (not any scenario that already used it).
const FEE_LIBRARY_KEY = "bp_custom_fee_library_v1";
function readFeeLibrary() {
  try { return JSON.parse(localStorage.getItem(FEE_LIBRARY_KEY)) || {}; } catch { return {}; }
}
function saveFeeToLibrary(section, label, amount) {
  const lib = readFeeLibrary();
  const list = lib[section] || [];
  const norm = label.trim().toLowerCase();
  // Catalog fees don't need saving, and re-adding an existing saved fee just
  // refreshes its amount.
  if ((FEE_CATALOG[section] || []).some(f => f.label.toLowerCase() === norm)) return;
  lib[section] = [...list.filter(f => f.label.toLowerCase() !== norm), { label: label.trim(), amount: Number(amount) || 0 }];
  try { localStorage.setItem(FEE_LIBRARY_KEY, JSON.stringify(lib)); } catch { /* private mode — nonfatal */ }
}
function removeFeeFromLibrary(section, label) {
  const lib = readFeeLibrary();
  const norm = label.trim().toLowerCase();
  lib[section] = (lib[section] || []).filter(f => f.label.toLowerCase() !== norm);
  try { localStorage.setItem(FEE_LIBRARY_KEY, JSON.stringify(lib)); } catch { /* nonfatal */ }
}

// "+ Add fee" — searchable dropdown of catalog fees + saved custom types +
// deleted built-ins to restore + free-text custom entry. Only shows while the
// section is unlocked.
function AddFeeControl({ section, hiddenBuiltins, onAdd, onRestore, alwaysOn = false }) {
  const { T, ACCENT } = useContext(CostsCtx);
  const { unlocked } = useContext(LockCtx);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [libVersion, setLibVersion] = useState(0); // bump to re-read after ×
  if (!unlocked && !alwaysOn) return null;
  const q = query.trim().toLowerCase();
  const items = (FEE_CATALOG[section] || []).filter(f => !q || f.label.toLowerCase().includes(q));
  // eslint-disable-next-line no-unused-vars
  const _v = libVersion; // ties the read below to state so × re-renders
  const savedItems = (readFeeLibrary()[section] || []).filter(f => !q || f.label.toLowerCase().includes(q));
  const restores = (hiddenBuiltins || []).filter(f => !q || f.label.toLowerCase().includes(q));
  const pick = (label, amount, { remember = false } = {}) => {
    if (remember) saveFeeToLibrary(section, label, amount);
    onAdd(label, amount);
    setOpen(false); setQuery("");
  };
  return (
    <div style={{ padding: "6px 0 2px", position: "relative" }}>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)}
          style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, color: ACCENT, background: "transparent", border: `1px dashed ${ACCENT}55`, borderRadius: 9999, padding: "5px 14px", cursor: "pointer" }}>
          + Add fee
        </button>
      ) : (
        <div style={{ border: `1px solid ${T.separator}`, borderRadius: 12, padding: 8, background: T.card, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); setQuery(""); } }}
            placeholder="Search fees or type a custom name…"
            style={{ width: "100%", boxSizing: "border-box", background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: FONT, color: T.text, outline: "none", marginBottom: 6 }}
          />
          <div style={{ maxHeight: 180, overflowY: "auto" }}>
            {restores.map((f) => (
              <div key={"r-" + f.key} onClick={() => { onRestore(f.key); setOpen(false); setQuery(""); }}
                style={{ padding: "7px 8px", fontSize: 13, fontFamily: FONT, color: T.text, cursor: "pointer", borderRadius: 8, display: "flex", justifyContent: "space-between" }}
                onMouseEnter={(e) => e.currentTarget.style.background = T.pillBg} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <span>{f.label} <span style={{ color: T.textTertiary, fontSize: 11 }}>· restore</span></span>
                <span style={{ color: T.textTertiary }}>{"$" + f.def.toLocaleString()}</span>
              </div>
            ))}
            {savedItems.map((f) => (
              <div key={"s-" + f.label} onClick={() => pick(f.label, f.amount)}
                style={{ padding: "7px 8px", fontSize: 13, fontFamily: FONT, color: T.text, cursor: "pointer", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}
                onMouseEnter={(e) => e.currentTarget.style.background = T.pillBg} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <span>{f.label} <span style={{ color: ACCENT, fontSize: 11 }}>· saved</span></span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: T.textTertiary }}>{"$" + f.amount.toLocaleString()}</span>
                  <span title="Forget this saved fee type"
                    onClick={(e) => { e.stopPropagation(); removeFeeFromLibrary(section, f.label); setLibVersion(v => v + 1); }}
                    style={{ color: T.textTertiary, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: "0 2px" }}>✕</span>
                </span>
              </div>
            ))}
            {items.map((f) => (
              <div key={f.label} onClick={() => pick(f.label, f.amount)}
                style={{ padding: "7px 8px", fontSize: 13, fontFamily: FONT, color: T.text, cursor: "pointer", borderRadius: 8, display: "flex", justifyContent: "space-between" }}
                onMouseEnter={(e) => e.currentTarget.style.background = T.pillBg} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <span>{f.label}</span>
                <span style={{ color: T.textTertiary }}>{"$" + f.amount.toLocaleString()}</span>
              </div>
            ))}
            {q && (
              <div onClick={() => pick(query.trim(), 0, { remember: true })}
                style={{ padding: "7px 8px", fontSize: 13, fontFamily: FONT, color: ACCENT, fontWeight: 600, cursor: "pointer", borderRadius: 8 }}
                onMouseEnter={(e) => e.currentTarget.style.background = T.pillBg} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                + Add “{query.trim()}” as a custom fee <span style={{ fontWeight: 400, color: T.textTertiary }}>(remembered for future files)</span>
              </div>
            )}
            {!q && items.length === 0 && restores.length === 0 && (
              <div style={{ padding: "7px 8px", fontSize: 12, color: T.textTertiary, fontFamily: FONT }}>Type to add a custom fee</div>
            )}
          </div>
          <div onClick={() => { setOpen(false); setQuery(""); }} style={{ textAlign: "center", fontSize: 11, color: T.textTertiary, cursor: "pointer", paddingTop: 6, fontFamily: FONT }}>Cancel</div>
        </div>
      )}
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
  hidden = false, onDelete = null,
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
  // LO deleted this built-in fee — gone from the sheet (restore via "+ Add fee").
  if (hidden) return null;

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
        alignItems: alwaysVisibleControl ? "flex-start" : "center",
        justifyContent: "space-between",
        padding: "8px 0",
        minHeight: 30,
        gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", alignItems: "center", fontSize: 13, color: bold ? T.text : T.textSecondary, fontWeight: bold ? 700 : 500, lineHeight: 1.3, flexWrap: "wrap", rowGap: 2 }}>
            <span>{label}</span>
            {sub && <span style={{ color: T.textTertiary, fontSize: 11, marginLeft: 6, fontFamily: FONT }}>{sub}</span>}
            {/* prefixEditor name kept for backwards compat, but it now renders AFTER the
                label and BEFORE the calc string — so the row label stays left-aligned with
                its siblings (per Christo's spec). Used by the closing-date pills on the
                Prepaid Interest row. */}
            {prefixEditor && (
              /* flexShrink 1 + wrap (was flexShrink 0): at narrow widths the
                 pill group wraps to its own line instead of colliding with
                 the amount column (Prepaid Interest overlap bug, 2026-07-06) */
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 1, minWidth: 0, flexWrap: "wrap", rowGap: 4, marginLeft: 8 }}>
                {prefixEditor}
              </span>
            )}
            {calc && (
              <span style={{
                color: T.textTertiary,
                fontSize: 11,
                marginLeft: 8,
                fontFamily: FONT,
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}>
                · {calc}
              </span>
            )}
            <InfoTipBubble explainer={explainer} />
          </div>
          {alwaysVisibleControl && (
            /* Full-width so split pills always drop to their own compact second line */
            <div style={{ display: "flex", alignItems: "center", flexBasis: "100%" }}>{alwaysVisibleControl}</div>
          )}
          {showInlineEditor && (
            <div style={{ display: "flex", alignItems: "center", flex: "0 1 auto", minWidth: 0 }}>{inlineEditor}</div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0, gap: 6 }}>
          {autoBadge && <AutoBadge />}
          {showInlineNumberInput ? (
            <DashedInline value={value} onChange={onChange} prefix={prefix} suffix={suffix} max={max} />
          ) : (
            <div style={{
              fontSize: 13,
              fontWeight: bold ? 700 : 600,
              fontFamily: FONT,
              color: color || T.text,
              whiteSpace: "nowrap",
            }}>{displayVal}</div>
          )}
          {onDelete && (alwaysEdit || sectionUnlocked) && (
            <button type="button" onClick={onDelete} title="Remove this fee"
              style={{ background: "transparent", border: "none", cursor: "pointer", color: T.textTertiary, fontSize: 13, lineHeight: 1, padding: "2px 2px" }}>
              ✕
            </button>
          )}
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
                  fontFamily: FONT, letterSpacing: 1, textTransform: "uppercase",
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
              fontSize: 10, fontWeight: 700, fontFamily: FONT,
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

// CashToCloseSummary moved to ../components/CashToCloseSummary so the Calculator
// tab can use the same card. Imported at the top of this file.

export default function CostsContent(props) {
  // Dev-only guard for curated-props drift (see src/lib/devPropCheck.js).
  if (import.meta.env.DEV) devCheckProps("CostsContent", props, ["T", "isDesktop", "calc", "fmt", "fmt2", "isRefi", "downPct", "underwritingFee", "setUnderwritingFee", "processingFee", "setProcessingFee", "adminFee", "setAdminFee", "lenderWireFee", "setLenderWireFee", "discountPts", "setDiscountPts", "originatorComp", "setOriginatorComp", "appraisalFee", "setAppraisalFee", "creditReportFee", "setCreditReportFee", "floodCertFee", "setFloodCertFee", "mersFee", "setMersFee", "taxServiceFee", "setTaxServiceFee", "escrowFee", "setEscrowFee", "courierFee", "setCourierFee", "loanTieInFee", "setLoanTieInFee", "notaryFee", "setNotaryFee", "envProtectionLien", "setEnvProtectionLien", "titleInsurance", "setTitleInsurance", "titleSearch", "setTitleSearch", "settlementFee", "setSettlementFee", "transferTaxCity", "setTransferTaxCity", "transferTaxSplit", "setTransferTaxSplit", "transferTaxCountySplit", "setTransferTaxCountySplit", "city", "propertyState", "propertyCounty", "salesPrice", "getTTCitiesForState", "getTTForCity", "recordingFee", "setRecordingFee", "ownersTitleIns", "setOwnersTitleIns", "homeWarranty", "setHomeWarranty", "hoa", "hoaTransferFee", "setHoaTransferFee", "buyerPaysComm", "setBuyerPaysComm", "buyerCommPct", "setBuyerCommPct", "closingMonth", "setClosingMonth", "closingDay", "setClosingDay", "closingYear", "setClosingYear", "propertyTaxesInstallment", "setPropertyTaxesInstallment", "sellersProratedTaxCredit", "setSellersProratedTaxCredit", "annualIns", "setAnnualIns", "includeEscrow", "setIncludeEscrow", "lenderCredit", "setLenderCredit", "sellerCredit", "setSellerCredit", "realtorCredit", "setRealtorCredit", "emd", "setEmd", "emdPct", "setEmdPct", "emdPaid", "setEmdPaid", "customFees", "setCustomFees", "hiddenFees", "setHiddenFees", "emdLocked", "setEmdLocked", "emdFlat", "setEmdFlat", "Hero", "Card", "Sec", "Inp", "Sel", "Note", "MRow", "GuidedNextButton", "skillLevel", "isPulse", "markTouched", "ClusterContinue"]);
  const {
  T, isDesktop, calc, fmt, fmt2,
  isRefi, downPct,
  underwritingFee, setUnderwritingFee,
  processingFee, setProcessingFee,
  adminFee, setAdminFee,
  lenderWireFee, setLenderWireFee,
  discountPts, setDiscountPts,
  originatorComp, setOriginatorComp,
  appraisalFee, setAppraisalFee,
  creditReportFee, setCreditReportFee,
  floodCertFee, setFloodCertFee,
  mersFee, setMersFee,
  taxServiceFee, setTaxServiceFee,
  escrowFee, setEscrowFee,
  courierFee, setCourierFee,
  loanTieInFee, setLoanTieInFee,
  notaryFee, setNotaryFee,
  envProtectionLien, setEnvProtectionLien,
  titleInsurance, setTitleInsurance,
  titleSearch, setTitleSearch,
  settlementFee, setSettlementFee,
  transferTaxCity, setTransferTaxCity,
  transferTaxSplit, setTransferTaxSplit,
  transferTaxCountySplit, setTransferTaxCountySplit,
  city, propertyState, propertyCounty, salesPrice,
  getTTCitiesForState, getTTForCity,
  recordingFee, setRecordingFee,
  ownersTitleIns, setOwnersTitleIns,
  homeWarranty, setHomeWarranty,
  hoa, hoaTransferFee, setHoaTransferFee,
  buyerPaysComm, setBuyerPaysComm,
  buyerCommPct, setBuyerCommPct,
  closingMonth, setClosingMonth,
  closingDay, setClosingDay,
  closingYear, setClosingYear,
  customFees, setCustomFees,
  hiddenFees, setHiddenFees,
  emdLocked, setEmdLocked,
  emdFlat, setEmdFlat,
  propertyTaxesInstallment, setPropertyTaxesInstallment,
  sellersProratedTaxCredit, setSellersProratedTaxCredit,
  annualIns, setAnnualIns,
  includeEscrow, setIncludeEscrow,
  lenderCredit, setLenderCredit,
  sellerCredit, setSellerCredit,
  realtorCredit, setRealtorCredit,
  emd, setEmd, emdPct, setEmdPct, emdPaid, setEmdPaid,
  Hero, Card, Sec, Inp, Sel, Note, MRow,
  GuidedNextButton,
  // Guided-mode wiring (forwarded by OverviewTab / the standalone costs site).
  skillLevel, isPulse, markTouched, ClusterContinue,
} = props;

  const isGuided = skillLevel === "guided";
  // Section-level lock state — closing-cost subsections (A, B, C, E, H) start LOCKED for clean read-only view.
  const [sectionLocks, setSectionLocks] = useState({ A: true, B: true, C: true, E: true, F: true, H: true });
  const [escrowCalendarOpen, setEscrowCalendarOpen] = useState(false);
  const toggleLock = (k) => setSectionLocks(s => ({ ...s, [k]: !s[k] }));

  // ── LO fee management (Christo 2026-07-05): built-in fees can be deleted
  //    (zeroed + hidden), custom fees added per section via the catalog. ──
  const BUILTIN_META = {
    A: [
      { key: "originatorComp", label: "Originator Compensation", set: setOriginatorComp, def: 0 },
      { key: "adminFee", label: "Administration Fee", set: setAdminFee, def: 795 },
      { key: "lenderWireFee", label: "Lender Wire Fee", set: setLenderWireFee, def: 295 },
      { key: "underwritingFee", label: "Underwriting Fee", set: setUnderwritingFee, def: 1250 },
    ],
    B: [
      { key: "appraisalFee", label: "Appraisal Fee", set: setAppraisalFee, def: 850 },
      { key: "creditReportFee", label: "Credit Report Fee", set: setCreditReportFee, def: 134 },
      { key: "floodCertFee", label: "Flood Certificate Fee", set: setFloodCertFee, def: 8 },
      { key: "mersFee", label: "MERS Registration Fee", set: setMersFee, def: 25 },
      { key: "processingFee", label: "Processing Fee", set: setProcessingFee, def: 695 },
      { key: "taxServiceFee", label: "Tax Service Fee", set: setTaxServiceFee, def: 85 },
    ],
    C: [
      { key: "titleInsurance", label: "Lender's Title Insurance Policy", set: setTitleInsurance, def: 2000 },
      { key: "escrowFee", label: "Escrow Fee", set: setEscrowFee, def: 2400 },
      { key: "courierFee", label: "Courier / FedEx", set: setCourierFee, def: 150 },
      { key: "loanTieInFee", label: "Loan Tie-in Fee", set: setLoanTieInFee, def: 150 },
      { key: "notaryFee", label: "Notary", set: setNotaryFee, def: 175 },
      { key: "envProtectionLien", label: "Environmental Protection Lien", set: setEnvProtectionLien, def: 100 },
    ],
    E: [
      { key: "recordingFee", label: "Recording Fees", set: setRecordingFee, def: 200 },
    ],
    H: [
      { key: "ownersTitleIns", label: "Owner's Title Insurance", set: setOwnersTitleIns, def: 3000 },
      { key: "homeWarranty", label: "Home Warranty", set: setHomeWarranty, def: 500 },
    ],
    CR: [
      { key: "sellerCredit", label: "Seller Credit", set: setSellerCredit, def: 0 },
      { key: "realtorCredit", label: "Realtor Credit", set: setRealtorCredit, def: 0 },
      { key: "lenderCredit", label: "Lender Credits", set: setLenderCredit, def: 0 },
    ],
  };
  const findBuiltin = (key) => Object.values(BUILTIN_META).flat().find((m) => m.key === key);
  const isHidden = (key) => (hiddenFees || []).includes(key);
  const deleteBuiltin = (key) => {
    const m = findBuiltin(key);
    if (!m) return;
    m.set(0); // remove from totals
    setHiddenFees((h) => (h.includes(key) ? h : [...h, key]));
  };
  const restoreBuiltin = (key) => {
    const m = findBuiltin(key);
    if (!m) return;
    m.set(m.def);
    setHiddenFees((h) => h.filter((k) => k !== key));
  };
  const addCustomFee = (section, label, amount) =>
    setCustomFees((c) => [...(c || []), { id: Date.now(), section, label: String(label).slice(0, 60), amount: amount || 0 }]);
  const updateCustomFee = (id, amount) => setCustomFees((c) => (c || []).map((f) => {
    if (f.id !== id) return f;
    // Keep the saved library in step: a custom type is usually added at $0 and
    // priced a moment later — the remembered amount should be the real one.
    saveFeeToLibrary(f.section, f.label, amount);
    return { ...f, amount };
  }));
  const removeCustomFee = (id) => setCustomFees((c) => (c || []).filter((f) => f.id !== id));
  // Plain render function (NOT a component) so FeeRow/AddFeeControl keep
  // stable identity — inline component defs remount on every parent render
  // and would blur the amount input mid-typing.
  const renderSectionExtras = (section, opts = {}) => (
    <>
      {(customFees || []).filter((f) => f.section === section).map((f) => (
        <FeeRow key={f.id} label={f.label} value={f.amount}
          onChange={(v) => updateCustomFee(f.id, v)}
          onDelete={() => removeCustomFee(f.id)}
          alwaysEdit={!!opts.alwaysEdit}
          explainer={section === "CR" ? "Custom credit added by your LO — reduces cash to close" : "Custom fee added by your LO"} />
      ))}
      <AddFeeControl
        section={section}
        alwaysOn={!!opts.alwaysOn}
        hiddenBuiltins={(BUILTIN_META[section] || []).filter((m) => isHidden(m.key))}
        onAdd={(label, amount) => addCustomFee(section, label, amount)}
        onRestore={restoreBuiltin}
      />
    </>
  );

  // Master "Edit All" lock pill for a CollapsibleBox header — one click
  // unlocks (or re-locks) every lockable subsection under that master box
  // (Christo 2026-07-05). Same visual language as the per-section pill.
  // Rendered as a span with stopPropagation — the header itself is a button.
  const masterLockPill = (letters) => {
    const anyLocked = letters.some((l) => sectionLocks[l]);
    const toggleAll = (e) => {
      e.stopPropagation();
      setSectionLocks((s) => ({ ...s, ...Object.fromEntries(letters.map((l) => [l, !anyLocked])) }));
    };
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={toggleAll}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleAll(e); }}
        aria-label={anyLocked ? "Unlock all sections to edit" : "Lock all sections"}
        style={{
          fontSize: 10, fontWeight: 700, fontFamily: FONT, letterSpacing: 1,
          textTransform: "uppercase",
          color: anyLocked ? T.textTertiary : "#fff",
          background: anyLocked ? "transparent" : ACCENT,
          border: `1px solid ${anyLocked ? T.separator : ACCENT}`,
          borderRadius: 9999, padding: "3px 9px", cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 5,
          transition: "all 0.15s",
        }}
      >
        <Icon name={anyLocked ? "lock" : "unlock"} size={11} />
        {anyLocked ? "Edit All" : "Done"}
      </span>
    );
  };

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
  // Per-component escrow (refi) vs the purchase master toggle. Refi reserves
  // use the refi-side monthlies (Christo 2026-07-22).
  const gEscTax = isRefi ? !!calc.refiNewEscrowTax : includeEscrow;
  const gEscIns = isRefi ? !!calc.refiNewEscrowIns : includeEscrow;
  const gMonthlyTax = isRefi ? (calc.refiNewMonthlyTax || 0) : (calc.monthlyTax || 0);
  const gMonthlyIns = isRefi ? (calc.refiNewMonthlyIns || 0) : (calc.ins || 0);
  const escrowHOI_reserve = gEscIns ? gMonthlyIns * calc.escrowInsMonths : 0;
  const escrowTax_reserve = gEscTax ? gMonthlyTax * calc.escrowTaxMonths : 0;
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

  // monthNames feeds the EscrowCalendar labels. The old month/day pill option
  // arrays were removed 2026-07-05 — the Prepaid Interest row now uses a
  // native date picker.
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

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
      {/* Cash To Close Summary at the top of Costs was removed per Christo —
          the Calculator section's CashToCloseSummary at the bottom-right of the
          Monthly Payment view flows directly into the Closing Costs sections
          below, so a second copy here is redundant. */}

      {/* ─── Guided explainer — plain-English intro to closing costs.
          Shown only in guided mode. data-field="costs" is the pulse anchor the
          guided sequence scrolls to (step 9); the breakdown boxes below start
          collapsed in guided so this reads as a summary with opt-in depth. ─── */}
      {isGuided && (() => {
        const allCosts = totalClosingCosts + (calc.totalPrepaidExp || 0);
        const costPct = salesPrice > 0 ? (allCosts / salesPrice) * 100 : 0;
        return (
          <div data-field="costs" className={isPulse ? isPulse("costs") : ""} style={{
            borderRadius: 14, padding: "14px 16px", marginBottom: 14,
            background: `linear-gradient(135deg, ${T.blue}18, ${T.blue}0c)`,
            border: `1px solid ${T.blue}38`,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.blue, marginBottom: 6, fontFamily: FONT }}>What are closing costs?</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: T.textSecondary, fontFamily: FONT }}>
              These are one-time fees to set up your loan — lender charges, title &amp; escrow, government taxes, and prepaid items like interest and insurance. They run about <strong style={{ color: T.text }}>{costPct.toFixed(1)}%</strong> of the price (<strong style={{ color: T.text }}>{fmt2(allCosts)}</strong> here), and they're <strong style={{ color: T.text }}>separate from your down payment</strong>. Tap a section below to see the line items, then continue.
            </div>
          </div>
        );
      })()}

      {/* ─── Two-column layout on desktop (Christo 2026-07-05): Closing Costs
          on the left; Prepaids + Credits on the right — mirrors the classic
          IFW side-by-side sheet. Mobile stays stacked. ─── */}
      <div style={{ display: isDesktop ? "grid" : "block", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "stretch" }}>
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
      {/* ─── MASTER 1: Closing Costs (collapsed in guided, open otherwise) ─── */}
      <div data-field="closing-costs" />
      <CollapsibleBox title="Closing Costs" total={fmt2(totalClosingCosts)} defaultOpen={!isGuided} fill
        headerExtra={masterLockPill(isRefi ? ["A", "B", "C", "E"] : ["A", "B", "C", "E", "H"])}>

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
              // Negative values are valid (becomes Lender Credit) — CompactNumPill keeps
              // a local edit-string so the user can type the leading '-' without it being
              // immediately clamped to 0 mid-typing.
              <CompactNumPill
                value={discountPts}
                onChange={setDiscountPts}
                suffix="%"
                min={-5}
                max={10}
                width={48}
                title="1 point = 1% of loan amount. Negative values become Lender Credits."
              />
            }
          />
          <FeeRow label="Originator Compensation" value={originatorComp}  onChange={setOriginatorComp}  hidden={isHidden("originatorComp")} onDelete={() => deleteBuiltin("originatorComp")} explainer="Paid to the loan officer/originator" />
          <FeeRow label="Administration Fee"       value={adminFee}        onChange={setAdminFee}        hidden={isHidden("adminFee")} onDelete={() => deleteBuiltin("adminFee")} explainer="Lender administration fee" />
          <FeeRow label="Lender Wire Fee"          value={lenderWireFee}   onChange={setLenderWireFee}   hidden={isHidden("lenderWireFee")} onDelete={() => deleteBuiltin("lenderWireFee")} explainer="Fee to wire loan funds at closing" />
          <FeeRow label="Underwriting Fee"        value={underwritingFee} onChange={setUnderwritingFee} hidden={isHidden("underwritingFee")} onDelete={() => deleteBuiltin("underwritingFee")} explainer="Lender's fee for evaluating the loan" />
          {renderSectionExtras('A')}
        </LetterSection>

        {/* B. Services You Cannot Shop For — lockable */}
        <LetterSection letter="B" title="Services You Cannot Shop For" total={fmt2(calc.cannotShop)} lockable>
          <FeeRow label="Appraisal Fee"          value={appraisalFee}    onChange={setAppraisalFee}    hidden={isHidden("appraisalFee")} onDelete={() => deleteBuiltin("appraisalFee")} explainer="Independent appraiser values the property" />
          <FeeRow label="Credit Report Fee"      value={creditReportFee} onChange={setCreditReportFee} hidden={isHidden("creditReportFee")} onDelete={() => deleteBuiltin("creditReportFee")} explainer="Pull tri-merge credit report" />
          <FeeRow label="Flood Certificate Fee"  value={floodCertFee}    onChange={setFloodCertFee}    hidden={isHidden("floodCertFee")} onDelete={() => deleteBuiltin("floodCertFee")} explainer="Determines if property is in a flood zone" />
          <FeeRow label="MERS Registration Fee"  value={mersFee}         onChange={setMersFee}         hidden={isHidden("mersFee")} onDelete={() => deleteBuiltin("mersFee")} explainer="Mortgage Electronic Registration System" />
          <FeeRow label="Processing Fee"         value={processingFee}   onChange={setProcessingFee}   hidden={isHidden("processingFee")} onDelete={() => deleteBuiltin("processingFee")} explainer="Fee for processing loan documents" />
          <FeeRow label="Tax Service Fee"        value={taxServiceFee}   onChange={setTaxServiceFee}   hidden={isHidden("taxServiceFee")} onDelete={() => deleteBuiltin("taxServiceFee")} explainer="Lender's tax-monitoring service" />
          {renderSectionExtras('B')}
        </LetterSection>

        {/* C. Services You Can Shop For — lockable */}
        <LetterSection letter="C" title="Services You Can Shop For" total={fmt2(calc.canShop)} lockable>
          {isRefi ? (
            <>
              {/* Both refi title/escrow charges, tiered on the new loan amount.
                  Was a single flat "Title / Escrow Flat Fee" that never moved
                  with the loan (Christo 2026-07-22). */}
              <FeeRow label="Title Insurance — Lender's Policy" value={titleInsurance} onChange={setTitleInsurance} hidden={isHidden("titleInsurance")} onDelete={() => deleteBuiltin("titleInsurance")} explainer="Insures the lender's lien position. A refi needs a new loan policy; your owner's policy carries over." />
              <FeeRow label="Escrow / Settlement Fee" value={escrowFee} onChange={setEscrowFee} hidden={isHidden("escrowFee")} onDelete={() => deleteBuiltin("escrowFee")} explainer="Basic residential loan escrow services for a single-loan refinance." />
              <TitleEscrowScheduleNote T={T} fmt={fmt} loanAmount={calc.refiNewLoanAmt} state={propertyState} />
            </>
          ) : (
            <>
              {/* Title — Settlement Agent Fee + Title Search removed from
                  defaults (Christo 2026-07-05). */}
              <FeeRow label="Lender's Title Insurance Policy" value={titleInsurance} onChange={setTitleInsurance} hidden={isHidden("titleInsurance")} onDelete={() => deleteBuiltin("titleInsurance")} explainer="Lender's title insurance policy" />
              <FeeRow label="Escrow Fee"                      value={escrowFee}      onChange={setEscrowFee}      hidden={isHidden("escrowFee")} onDelete={() => deleteBuiltin("escrowFee")} explainer="Escrow company's closing fee" />
              <FeeRow label="Courier / FedEx"                 value={courierFee}     onChange={setCourierFee}     hidden={isHidden("courierFee")} onDelete={() => deleteBuiltin("courierFee")} explainer="Document courier / overnight delivery" />
              <FeeRow label="Loan Tie-in Fee"                 value={loanTieInFee}   onChange={setLoanTieInFee}   hidden={isHidden("loanTieInFee")} onDelete={() => deleteBuiltin("loanTieInFee")} explainer="Escrow's fee to coordinate with the lender" />
              <FeeRow label="Notary"                          value={notaryFee}      onChange={setNotaryFee}      hidden={isHidden("notaryFee")} onDelete={() => deleteBuiltin("notaryFee")} explainer="Notarizes closing documents" />
              <FeeRow label="Environmental Protection Lien"   value={envProtectionLien} onChange={setEnvProtectionLien} hidden={isHidden("envProtectionLien")} onDelete={() => deleteBuiltin("envProtectionLien")} explainer="Endorsement protecting against environmental liens" />
              {calc.hoaCert > 0 && <FeeRow label="HOA Certification" value={calc.hoaCert} sub="Condo/TH" readOnly autoBadge explainer="Required for condos & townhomes" />}
            </>
          )}
        {renderSectionExtras('C')}
        </LetterSection>




        {/* E back at the bottom of the left column (Christo 2026-07-05):
            these ARE closing costs — keep them in the box, below the D total. */}
        {/* E. Taxes and Other Government Charges — lockable */}
        <LetterSection letter="E" title="Taxes and Other Government Charges" total={fmt2(calc.govCharges)} lockable>
          <FeeRow label="Recording Fees" value={recordingFee} onChange={setRecordingFee} hidden={isHidden("recordingFee")} onDelete={() => deleteBuiltin("recordingFee")} explainer="County fees to record the deed and mortgage" />
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
                      fontSize: 10, fontWeight: 700, fontFamily: FONT, letterSpacing: 0.5, textTransform: "uppercase",
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
                label="Transfer Tax — City"
                value={calc.buyerCityTT}
                readOnly
                autoBadge
                sub={cityRate > 0 ? `$${cityRate}/$1K` : null}
                alwaysVisibleControl={renderToggle(transferTaxSplit, setTransferTaxSplit)}
                inlineEditor={cityDropdown}
                explainer={isRefi
                  ? "No transfer tax on refinances in California"
                  : `${transferTaxCity === "San Francisco" && transferTaxSplit !== "seller" ? "SF: Seller customarily pays 100% — toggle Seller above. " : ""}$${cityRate}/$1K × ${fmt(salesPrice)} = ${fmt2(cityFullTax)} → buyer ${citySharePct}% = ${fmt2(calc.buyerCityTT)}`}
              />
              {/* County Transfer Tax — only renders when state has a county-level rate (CA: $1.10/$1K) */}
              {countyRate > 0 && (
                <FeeRow
                  label="Transfer Tax — County"
                  value={calc.buyerCountyTT}
                  readOnly
                  autoBadge
                  sub={`$${countyRate.toFixed(2)}/$1K`}
                  alwaysVisibleControl={renderToggle(transferTaxCountySplit, setTransferTaxCountySplit)}
                  explainer={isRefi
                    ? "No county transfer tax on refinances in California"
                    : `CA Documentary Transfer Tax ($1.10/$1K statewide): $${countyRate.toFixed(2)}/$1K × ${fmt(salesPrice)} = ${fmt2(countyFullTax)} → buyer ${countySharePct}% = ${fmt2(calc.buyerCountyTT)}`}
                />
              )}
            </>);
          })()}
        {renderSectionExtras('E')}
        </LetterSection>


        {/* H. Other — the very bottom of the left column (Christo 2026-07-05). */}
        {!isRefi && (
          <LetterSection letter="H" title="Other" total={fmt2(otherCostsTotal)} lockable>
            <FeeRow label="Owner's Title Insurance" value={ownersTitleIns} onChange={setOwnersTitleIns} hidden={isHidden("ownersTitleIns")} onDelete={() => deleteBuiltin("ownersTitleIns")} explainer="Optional — protects buyer's ownership rights from title defects" />
            <FeeRow label="Home Warranty"           value={homeWarranty}   onChange={setHomeWarranty}   hidden={isHidden("homeWarranty")} onDelete={() => deleteBuiltin("homeWarranty")} explainer="One-year coverage on major home systems" />
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
                calc={`${buyerCommPct}% × ${fmt(salesPrice)} = ${fmt2(liveBuyerComm)}`}
                explainer="Commission paid to buyer's real estate agent"
                alwaysEdit
                inlineEditor={
                  <CompactNumPill
                    value={buyerCommPct}
                    onChange={setBuyerCommPct}
                    suffix="%"
                    min={0}
                    max={10}
                    width={48}
                    title="Buyer's agent commission as a % of sales price."
                  />
                }
              />
            )}
          {renderSectionExtras('H')}
          </LetterSection>
        )}
      </CollapsibleBox>

      {typeof ClusterContinue === "function" && <ClusterContinue stepId="closing-costs" />}
      </div>{/* end left column */}
      <div style={{ minWidth: 0 }}>{/* right column */}


      {/* ─── MASTER 2: Prepaids and Initial Escrow (default OPEN) ── */}
      <div data-field="prepaids" />
      <CollapsibleBox title="Prepaid Expenses" total={fmt2(calc.totalPrepaidExp)} defaultOpen={!isGuided}>

        {/* F. Prepaids — lockable so the two Property Tax rows can be revealed for editing.
            Order matches Christo's client-walkthrough spreadsheet:
              1) Prepaid Interest (with inline closing-date pills before the label)
              2) Homeowner's Insurance — First Year (read-only, derives from Setup)
              3) Property Taxes — Installment (hidden until unlocked or non-zero)
              4) Property Taxes — Sellers Prorated Reimbursement (hidden until unlocked or non-zero)
              5) Mortgage Insurance Premium (FHA/USDA only)
              6) Include Escrow Impounds toggle (gates Section G) */}
        <LetterSection letter="F" title="Prepaids" lockable>
          {/* 1. Prepaid Interest — "Closing Date" calendar picker sits BEFORE the
              label as a prefixEditor (replaced the Jul/4 month+day pills,
              Christo 2026-07-05). Native <input type="date"> = built-in calendar
              dropdown; defaults to a 30-day close from today (set in
              MortgageBlueprint state). Raw input styled tight (height 20) per
              the FeeRow inline-editor rule. */}
          <FeeRow
            label="Prepaid Interest"
            value={calc.prepaidInt}
            readOnly
            autoBadge
            prefixEditor={(() => {
              const iso = `${closingYear || new Date().getFullYear()}-${String(closingMonth).padStart(2, "0")}-${String(closingDay).padStart(2, "0")}`;
              // First payment = 1st of the SECOND month after closing (prepaid
              // interest covers the closing month; the next full month's
              // interest is paid in arrears with that first payment).
              // Aug 3 close → prepaids cover Aug → Sep accrues → due Oct 1.
              const fpDate = new Date(closingYear || new Date().getFullYear(), (closingMonth - 1) + 2, 1);
              const fpLabel = `${fpDate.toLocaleDateString("en-US", { month: "short" })} 1${fpDate.getFullYear() !== (closingYear || new Date().getFullYear()) ? `, ${fpDate.getFullYear()}` : ""}`;
              return (
                /* Two nowrap pairs inside a wrappable group — "Closing Date [picker]"
                   and "First Payment [pill]" each stay intact but can drop to a
                   second line when the panel is narrow (overlap fix 2026-07-06) */
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexWrap: "wrap", rowGap: 4, minWidth: 0 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, fontWeight: 500 }}>Closing Date</span>
                  <input
                    type="date"
                    value={iso}
                    onChange={(e) => {
                      const [y, m, d] = (e.target.value || "").split("-").map(Number);
                      // Ignore intermediate/cleared states — only commit full dates.
                      if (y && m && d) { setClosingYear(y); setClosingMonth(m); setClosingDay(d); }
                    }}
                    style={{
                      background: T.inputBg,
                      border: `1px solid ${T.inputBorder}`,
                      borderRadius: 9999,
                      padding: "0 8px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: T.text,
                      fontFamily: FONT,
                      height: 20,
                      lineHeight: 1,
                      cursor: "pointer",
                      outline: "none",
                      boxSizing: "border-box",
                      WebkitAppearance: "none",
                      appearance: "none",
                    }}
                  />
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, fontWeight: 500, marginLeft: 4 }}>First Payment</span>
                  <span style={{
                    background: T.inputBg,
                    border: `1px solid ${T.inputBorder}`,
                    borderRadius: 9999,
                    padding: "0 8px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: T.text,
                    fontFamily: FONT,
                    height: 20,
                    lineHeight: "20px",
                    boxSizing: "border-box",
                    display: "inline-block",
                    whiteSpace: "nowrap",
                  }}>{fpLabel}</span>
                  </span>
                </span>
              );
            })()}
            calc={`${calc.autoPrepaidDays} days × ${fmt2(calc.dailyInt)}/day`}
            explainer="Interest from your closing date through end of month — pick the closing date and everything recalculates. First payment is the 1st of the second month after closing: the prepaid interest covers your closing month, the next month's interest accrues, and it's paid in arrears with that first payment."
          />

          {/* 2. Homeowner's Insurance Premium.
              PURCHASE — a new policy always starts at closing: 12 months due.
              REFI — collected ONLY when the new loan escrows insurance AND the
              policy renews within ~60 days of closing (calc.prepaidIns applies
              the rule). Non-escrowed renewals are a docs condition, never a
              collection (Christo 2026-07-22). */}
          <FeeRow
            label={isRefi ? "Homeowner's Insurance Premium — Renewal (12 mo)" : "Homeowner's Insurance Premium — First Year (12 mo)"}
            value={isRefi ? calc.prepaidIns : annualIns}
            readOnly
            autoBadge
            note={!isRefi ? undefined
              : calc.prepaidIns > 0 ? `Policy renews ${calc.insRenewalDays != null ? `${calc.insRenewalDays} days after closing` : "near closing"} — premium collected at closing; escrow starts a fresh 12-month cycle.`
              : calc.insDocCondition ? "Escrow waived and the policy renews near closing — nothing collected; paid receipt for the renewal is a docs condition."
              : "Policy renews outside the 60-day window — nothing collected at closing."}
            explainer={isRefi
              ? "On a refinance the existing policy carries over. The 12-month premium is only collected at closing when the new loan escrows insurance and the policy renews within about 60 days of closing. Set the effective date in Setup."
              : "First-year homeowner's insurance, calculated from monthly insurance × 12. Edit the monthly amount in the Setup tab."}
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
          {!gEscTax && !gEscIns ? (
            <div style={{ padding: "8px 0", fontSize: 12, color: T.textSecondary }}>
              Escrow waived — taxes and insurance paid separately by borrower.
            </div>
          ) : (
            <>
              {gEscIns ? (
              <FeeRow
                label="Hazard Insurance Reserve"
                value={escrowHOI_reserve}
                readOnly
                autoBadge
                calc={`${calc.escrowInsMonths} mo × ${fmt2(gMonthlyIns)}/mo = ${fmt2(escrowHOI_reserve)}`}
                explainer="Cushion held by lender for upcoming insurance payments"
              />
              ) : (
              <div style={{ padding: "6px 0", fontSize: 11, color: T.textTertiary }}>Insurance not escrowed — borrower pays the carrier directly.</div>
              )}
              {gEscTax ? (
              <FeeRow
                label="Property Taxes"
                value={escrowTax_reserve}
                readOnly
                autoBadge
                calc={`${calc.escrowTaxMonths} mo × ${fmt2(gMonthlyTax)}/mo = ${fmt2(escrowTax_reserve)}`}
                explainer="Cushion for upcoming property tax bills"
              />
              ) : (
              <div style={{ padding: "6px 0", fontSize: 11, color: T.textTertiary }}>Taxes not escrowed — borrower pays the county directly.</div>
              )}
              {/* Escrow Calendar — chevron expander showing 12-month forward projection.
                  Sits BETWEEN the reserves and the toggle so the toggle stays last. */}
              <EscrowCalendar
                open={escrowCalendarOpen}
                onToggle={() => setEscrowCalendarOpen(o => !o)}
                closingMonth={closingMonth}
                closingDay={closingDay}
                monthlyTax={gEscTax ? gMonthlyTax : 0}
                monthlyIns={gEscIns ? gMonthlyIns : 0}
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
            hint="OFF = waive escrow impounds"
            on={includeEscrow}
            onChange={setIncludeEscrow}
          />
        </LetterSection>
      </CollapsibleBox>

      {typeof ClusterContinue === "function" && <ClusterContinue stepId="prepaids" />}



      {/* ─── MASTER 3: Credits to Buyer (default COLLAPSED) ───── */}
      <div data-field="credits" />
      <CollapsibleBox
        title="Credits to Buyer"
        total={`−${fmt2(calc.totalCredits)}`}
        totalColor={T.green}
        defaultOpen={!isGuided}
      >
        <FeeRow
          label="Earnest Money Deposit (EMD)"
          value={isRefi ? 0 : calc.emdCredit}
          readOnly
          alwaysEdit={!isRefi}
          color={!isRefi && !emdPaid ? T.muted : undefined}
          explainer={!isRefi && salesPrice > 0
            ? `${emdLocked
                ? `${emdPct}% × ${fmt(salesPrice)} = ${fmt2(calc.emdAmt)}`
                : `Flat amount: ${fmt2(calc.emdAmt)}`}${emdPaid ? " — paid to escrow, credited" : " — not yet paid ($0 credited)"}. 3% is standard in CA; unlock to enter a flat dollar amount.`
            : "Deposit — only credited toward cash to close once paid to escrow."}
          inlineEditor={!isRefi ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <button type="button"
                onClick={() => {
                  if (emdLocked) { setEmdLocked(false); if (!emdFlat && calc.emdAmt > 0) setEmdFlat(Math.round(calc.emdAmt)); }
                  else setEmdLocked(true);
                }}
                title={emdLocked ? "Unlock to enter a flat $ amount" : "Lock to % of price"}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center" }}>
                <Icon name={emdLocked ? "lock" : "unlock"} size={12} style={{ color: emdLocked ? T.textTertiary : ACCENT }} />
              </button>
              {emdLocked
                ? <CompactNumPill value={emdPct} onChange={setEmdPct} suffix="%" min={0} max={100} width={48} title="EMD as % of sales price (3% is standard in CA)." />
                : <CompactNumPill value={emdFlat} onChange={setEmdFlat} min={0} max={100000000} width={86} title="Flat EMD dollar amount" />}
            </span>
          ) : null}
        />
        {!isRefi && (
          <ToggleRow
            label="EMD Paid to Escrow"
            hint="ON = received by escrow & credited"
            on={emdPaid}
            onChange={setEmdPaid}
          />
        )}
        {!isRefi && (
          <FeeRow label="Seller Credit"   value={sellerCredit}  onChange={setSellerCredit}  alwaysEdit
            hidden={isHidden("sellerCredit")} onDelete={() => deleteBuiltin("sellerCredit")}
            explainer="Negotiated credit from seller toward buyer's closing costs" />
        )}
        {!isRefi && (
          <FeeRow label="Realtor Credit"  value={realtorCredit} onChange={setRealtorCredit} alwaysEdit
            hidden={isHidden("realtorCredit")} onDelete={() => deleteBuiltin("realtorCredit")}
            explainer="Credit from realtor (sometimes a portion of their commission)" />
        )}
        <FeeRow label="Lender Credits"    value={lenderCredit}  onChange={setLenderCredit}  alwaysEdit
          hidden={isHidden("lenderCredit")} onDelete={() => deleteBuiltin("lenderCredit")}
          explainer="Credit from lender — often in exchange for a slightly higher rate" />
        <FeeRow label="Adjustments and Other Credits" value={0} readOnly autoBadge
          explainer="Other credits or adjustments at closing" />
        <FeeRow label="Subordinate Financing" value={0} readOnly
          explainer="Second mortgages or HELOCs financing part of the purchase" />
        {renderSectionExtras('CR', { alwaysEdit: true, alwaysOn: true })}
      </CollapsibleBox>


      {/* Guided "continue" — only renders while costs is the active step.
          Sets "costs-done", which advances the guided sequence to Assets. */}
      {/* Cash to Close — anchors the bottom-right corner, balancing the
          columns (Christo 2026-07-05). Same component as the Calculator tab. */}
      <CashToCloseSummary
        T={T}
        ACCENT={T.blue}
        fmt={fmt}
        downPayment={calc.dp || 0}
        closingCosts={calc.totalClosingCosts || 0}
        prepaids={calc.totalPrepaidExp || 0}
        payoffs={calc.payoffAtClosing || 0}
        credits={calc.totalCredits || 0}
        isRefi={isRefi}
      />
      </div>{/* end right column */}
      </div>{/* end two-column grid */}

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

      {typeof ClusterContinue === "function" && <ClusterContinue stepId="credits" />}
      <GuidedNextButton />
    </CostsCtx.Provider>
  );
}
