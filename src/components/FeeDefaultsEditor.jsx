import React from "react";
import { FONT, MONO } from "../lib/fonts.js";
import Icon from "../Icon";
import { feeMetaFor, feeSectionsFor, normalizeSheet, sheetTotal } from "../lib/feeDefaults.js";

// Settings ▸ Default fees (Christo 2026-11-20). Two fee sheets, one for
// purchases and one for refinances, edited right here: change an amount,
// remove a fee, add your own. Every edit saves. See lib/feeDefaults.js for
// when each sheet is applied to a scenario.

const TYPES = [{ id: "purchase", label: "Purchase" }, { id: "refi", label: "Refinance" }];
const money = (n) => "$" + Math.round(n || 0).toLocaleString("en-US");

function Money({ T, value, onChange, ariaLabel, isDesktop, autoFocus }) {
  const [str, setStr] = React.useState(null);
  const justFocused = React.useRef(false);
  return (
    <div style={{ display: "flex", alignItems: "center", width: 112, height: 34, boxSizing: "border-box", padding: "0 10px", borderRadius: 8, background: T.inputBg, border: `1px solid ${T.inputBorder}` }}>
      <span style={{ fontSize: 13, color: T.textTertiary, fontFamily: FONT }}>$</span>
      <input
        aria-label={ariaLabel} inputMode="decimal" autoFocus={autoFocus}
        value={str ?? (value ? value.toLocaleString("en-US") : "0")}
        // Click or tab in = the whole figure is selected, so typing replaces
        // it. The text is left alone until a key is pressed (changing it here
        // would drop the selection), and the click's mouseup is swallowed once
        // so it does not turn the selection back into a caret.
        onFocus={(e) => { e.target.select(); justFocused.current = true; }}
        onMouseUp={(e) => { if (justFocused.current) { e.preventDefault(); justFocused.current = false; } }}
        onChange={(e) => { const s = e.target.value.replace(/[^\d.]/g, ""); setStr(s); onChange(Math.min(Number(s) || 0, 9999999)); }}
        onBlur={() => { setStr(null); justFocused.current = false; }}
        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", textAlign: "right", color: T.text, fontFamily: FONT, fontSize: isDesktop ? 14 : 16, fontWeight: 600 }}
      />
    </div>
  );
}

export default function FeeDefaultsEditor({ T, isDesktop, store, onChange, scenarioType, onUseScenario, onApply }) {
  const [type, setType] = React.useState(scenarioType === "refi" ? "refi" : "purchase");
  const [adding, setAdding] = React.useState(null); // section id with the add-fee form open
  const [draft, setDraft] = React.useState({ label: "", amount: 0 });
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [applied, setApplied] = React.useState(false);

  const raw = store[type] || null;
  const sheet = normalizeSheet(type, raw);
  const meta = feeMetaFor(type);
  const isRefi = type === "refi";
  const save = (patch) => onChange(type, { ...sheet, ...patch, savedAt: new Date().toISOString() });
  const pickType = (t) => { setType(t); setAdding(null); setConfirmReset(false); setApplied(false); };

  const setFee = (key, v) => save({ fees: { ...sheet.fees, [key]: v } });
  const removeFee = (key) => save({ fees: { ...sheet.fees, [key]: 0 }, hiddenFees: [...sheet.hiddenFees, key] });
  const restoreFee = (m) => save({ fees: { ...sheet.fees, [m.key]: m.def }, hiddenFees: sheet.hiddenFees.filter((k) => k !== m.key) });
  const setCustom = (id, amount) => save({ customFees: sheet.customFees.map((f) => (f.id === id ? { ...f, amount } : f)) });
  const removeCustom = (id) => save({ customFees: sheet.customFees.filter((f) => f.id !== id) });
  const addCustom = () => {
    const label = draft.label.trim();
    if (!label) return;
    save({ customFees: [...sheet.customFees, { id: Date.now(), section: adding, label: label.slice(0, 60), amount: draft.amount || 0 }] });
    setAdding(null); setDraft({ label: "", amount: 0 });
  };

  const rowStyle = { display: "flex", alignItems: "center", gap: 8, minHeight: 44, borderBottom: `1px solid ${T.separator}` };
  const labelStyle = { flex: 1, minWidth: 0, fontSize: 13, color: T.text, fontFamily: FONT, lineHeight: 1.3 };
  const iconBtn = { width: 30, height: 30, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", borderRadius: 9999, color: T.textTertiary, cursor: "pointer", padding: 0 };
  const ghost = (on = true) => ({ padding: "9px 16px", background: "transparent", border: `1px solid ${T.inputBorder}`, borderRadius: 9999, color: on ? T.text : T.textTertiary, fontWeight: 600, fontSize: 13, cursor: on ? "pointer" : "default", fontFamily: FONT });
  const linkBtn = { background: "none", border: "none", padding: 0, color: T.blue, fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: "pointer" };

  const sections = [...feeSectionsFor(type), ...(sheet.customFees.some((f) => f.section === "CR") ? [{ id: "CR", title: "Credits" }] : [])];
  const canApply = scenarioType === type;

  return (
    <div>
      <div style={{ fontSize: 12, color: T.textTertiary, lineHeight: 1.5, margin: "0 0 12px", fontFamily: FONT }}>
        Set the fees you quote. One sheet for purchases, one for refinances.
      </div>
      <div role="tablist" aria-label="Fee sheet" style={{ display: "flex", gap: 4, padding: 4, borderRadius: 9999, background: T.pillBg, marginBottom: 12 }}>
        {TYPES.map((t) => {
          const on = t.id === type;
          return (
            <button key={t.id} role="tab" aria-selected={on} onClick={() => pickType(t.id)}
              style={{ flex: 1, padding: "8px 0", borderRadius: 9999, border: "none", background: on ? T.blue : "transparent", color: on ? "#fff" : T.textSecondary, fontWeight: 700, fontSize: 13, fontFamily: FONT, cursor: "pointer" }}>
              {t.label}{store[t.id] ? "" : " (standard)"}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5, marginBottom: 4, fontFamily: FONT }}>
        {isRefi
          ? "Choosing Refinance on a scenario brings these in, as long as its fees have not been edited yet."
          : "Every new scenario starts from these."}
      </div>

      {sections.map((sec) => {
        const built = meta.filter((m) => m.section === sec.id);
        const custom = sheet.customFees.filter((f) => f.section === sec.id);
        return (
          <div key={sec.id} style={{ marginTop: 14 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: T.textTertiary, paddingBottom: 4, borderBottom: `1px solid ${T.separator}` }}>
              {sec.id === "CR" ? sec.title : `${sec.id}. ${sec.title}`}
            </div>
            {built.map((m) => {
              const hidden = sheet.hiddenFees.includes(m.key);
              const tiered = sheet.fees[m.key] === null;
              return (
                <div key={m.key} style={rowStyle}>
                  <span style={{ ...labelStyle, color: hidden ? T.textTertiary : T.text, textDecoration: hidden ? "line-through" : "none" }}>{m.label}</span>
                  {tiered ? (
                    <span style={{ fontSize: 12, color: T.textSecondary, fontFamily: FONT, textAlign: "right" }}>Tiered by loan amount</span>
                  ) : hidden ? (
                    <button onClick={() => restoreFee(m)} style={linkBtn}>Restore</button>
                  ) : (
                    <>
                      <Money T={T} isDesktop={isDesktop} value={sheet.fees[m.key]} onChange={(v) => setFee(m.key, v)} ariaLabel={`${m.label}, ${isRefi ? "refinance" : "purchase"} default`} />
                      <button onClick={() => removeFee(m.key)} aria-label={`Remove ${m.label}`} title="Remove this fee" style={iconBtn}><Icon name="x" size={14} /></button>
                    </>
                  )}
                </div>
              );
            })}
            {custom.map((f) => (
              <div key={f.id} style={rowStyle}>
                <span style={labelStyle}>{f.label}</span>
                <Money T={T} isDesktop={isDesktop} value={f.amount} onChange={(v) => setCustom(f.id, v)} ariaLabel={`${f.label}, ${isRefi ? "refinance" : "purchase"} default`} />
                <button onClick={() => removeCustom(f.id)} aria-label={`Remove ${f.label}`} title="Remove this fee" style={iconBtn}><Icon name="x" size={14} /></button>
              </div>
            ))}
            {sec.id !== "CR" && (adding === sec.id ? (
              <form onSubmit={(e) => { e.preventDefault(); addCustom(); }} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 0" }}>
                <input autoFocus aria-label="Fee name" placeholder="Fee name" value={draft.label} maxLength={60}
                  onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                  style={{ flex: "1 1 140px", minWidth: 0, height: 34, boxSizing: "border-box", padding: "0 10px", borderRadius: 8, background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, fontFamily: FONT, fontSize: isDesktop ? 14 : 16, outline: "none" }} />
                <Money T={T} isDesktop={isDesktop} value={draft.amount} onChange={(v) => setDraft((d) => ({ ...d, amount: v }))} ariaLabel="Fee amount" />
                <button type="submit" disabled={!draft.label.trim()} style={{ padding: "8px 14px", borderRadius: 9999, border: "none", background: T.blue, color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: FONT, cursor: draft.label.trim() ? "pointer" : "default", opacity: draft.label.trim() ? 1 : 0.5 }}>Add</button>
                <button type="button" onClick={() => setAdding(null)} style={{ ...linkBtn, color: T.textTertiary }}>Cancel</button>
              </form>
            ) : (
              <button onClick={() => { setAdding(sec.id); setDraft({ label: "", amount: 0 }); }} style={{ ...linkBtn, display: "inline-flex", alignItems: "center", gap: 4, padding: "9px 0 0" }}>
                <Icon name="plus" size={12} />Add a fee
              </button>
            ))}
          </div>
        );
      })}

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${T.inputBorder}` }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: FONT }}>
          {isRefi ? "Flat fees, before title and escrow" : "Flat fees"}
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: FONT }}>{money(sheetTotal(sheet))}</span>
      </div>
      <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.5, marginTop: 4, fontFamily: FONT }}>
        {isRefi
          ? "Title insurance and escrow come from the refinance schedule for the loan amount. Points, prepaids and reserves are figured per loan."
          : "Points, transfer tax, prepaids and reserves are figured per loan."}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
        <button onClick={() => { onApply(type); setApplied(true); }} disabled={!canApply} style={ghost(canApply)}>Apply to this scenario</button>
        <button onClick={() => { onUseScenario(type); setApplied(false); }} disabled={!canApply} style={ghost(canApply)}>Copy this scenario's fees</button>
        {raw && (confirmReset ? (
          <>
            <button onClick={() => { onChange(type, null); setConfirmReset(false); }} style={{ ...linkBtn, color: T.red }}>Yes, reset</button>
            <button onClick={() => setConfirmReset(false)} style={{ ...linkBtn, color: T.textTertiary }}>Keep mine</button>
          </>
        ) : (
          <button onClick={() => setConfirmReset(true)} style={{ ...linkBtn, color: T.textTertiary, textDecoration: "underline" }}>Reset to standard</button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 8, fontFamily: FONT, lineHeight: 1.5 }}>
        {!canApply
          ? `The open scenario is a ${scenarioType === "refi" ? "refinance" : "purchase"}, so these two buttons work from the ${scenarioType === "refi" ? "Refinance" : "Purchase"} sheet.`
          : applied ? "Applied to the open scenario."
          : raw?.savedAt ? `Saved ${new Date(raw.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} on this device.`
          : "This is the standard sheet. Any change you make here is saved on this device."}
      </div>
    </div>
  );
}
