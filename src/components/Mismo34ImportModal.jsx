import { FONT, MONO } from "../lib/fonts.js";
/**
 * Mismo34ImportModal — fill an open scenario's Assets, Debts, and REO from a
 * Fannie Mae 3.4 (MISMO XML) export of the 1003.
 *
 * Arive's API has no assets or liabilities, but Arive (and every other LOS)
 * exports the full 1003 as a 3.4 file. The LO picks it here; it is parsed in
 * the browser (src/lib/mismo34Import.js) and never uploaded — the file holds
 * SSNs and account numbers, and only whitelisted fields are read.
 *
 * Flow: pick → preview (what will be added, what's already here) → Add.
 * Rows are appended; anything already in the scenario is skipped, so
 * re-importing the same file changes nothing.
 *
 * Props: open, onClose, onApply(merged), existing { assets, debts, reos }, T, fmt
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../Icon";
import useEscape from "../hooks/useEscape.js";
import { parseMismo34, mergeMismoImport, MismoImportError } from "../lib/mismo34Import.js";

const MAX_BYTES = 15 * 1024 * 1024;

export default function Mismo34ImportModal({ open, onClose, onApply, existing, T, fmt }) {
  const [parsed, setParsed] = useState(null);
  const [fileName, setFileName] = useState("");
  const [err, setErr] = useState(null);
  const [reading, setReading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setParsed(null); setFileName(""); setErr(null); setReading(false); setDragOver(false); }
  }, [open]);
  useEscape(open, onClose);

  const merged = useMemo(() => (parsed ? mergeMismoImport(existing || {}, parsed) : null), [parsed, existing]);

  if (!open) return null;

  const readFile = (file) => {
    if (!file) return;
    setErr(null); setParsed(null); setFileName(file.name);
    if (file.size > MAX_BYTES) { setErr("That file is too large to be a 3.4 export."); return; }
    setReading(true);
    file.text()
      .then((text) => setParsed(parseMismo34(text)))
      .catch((e) => setErr(e instanceof MismoImportError ? e.message : "Couldn't read that file. Export it from Arive again and retry."))
      .finally(() => setReading(false));
  };

  const added = merged?.added || { assets: 0, debts: 0, reos: 0 };
  const skipped = merged?.skipped || { assets: 0, debts: 0, reos: 0 };
  const nothingNew = merged && added.assets + added.debts + added.reos === 0;
  const newAssets = merged ? merged.assets.slice(merged.assets.length - added.assets) : [];
  const newDebts = merged ? merged.debts.slice(merged.debts.length - added.debts) : [];
  const newReos = merged ? merged.reos.slice(merged.reos.length - added.reos) : [];
  const assetTotal = newAssets.reduce((s, a) => s + (Number(a.value) || 0), 0);
  const debtMonthly = newDebts.filter((d) => d.payoff === "No").reduce((s, d) => s + (Number(d.monthly) || 0), 0);
  const payoffCount = newDebts.filter((d) => d.payoff === "Yes - at Escrow" || d.payoff === "Yes - POC").length;
  const reoLiens = newDebts.filter((d) => d.linkedReoId).length;

  const microLabel = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: T.textTertiary, fontWeight: 600 };
  const row = (label, value, extra) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.separator}` }}>
      <span style={{ ...microLabel, width: 64, flexShrink: 0 }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: FONT, fontSize: 13.5, color: T.text, fontWeight: 600 }}>
        {value}
        {extra ? <span style={{ display: "block", fontWeight: 500, fontSize: 12, color: T.textTertiary, marginTop: 2 }}>{extra}</span> : null}
      </span>
    </div>
  );
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const skipNote = (n) => (n ? `${n} already in this scenario, skipped` : null);

  const pillBtn = (primary, enabled = true) => ({
    width: "100%", padding: 13, borderRadius: 9999, fontFamily: FONT, fontWeight: 700, fontSize: 14,
    cursor: enabled ? "pointer" : "default",
    border: primary ? "none" : `1px solid ${T.separator}`,
    background: primary ? (enabled ? "linear-gradient(135deg, #3B6BF5, #2B4FCE)" : T.pillBg) : "transparent",
    color: primary ? (enabled ? "#fff" : T.textTertiary) : T.textSecondary,
  });

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Import a Fannie Mae 3.4 file" style={{ background: T.card, borderRadius: 20, maxWidth: 500, width: "100%", padding: "20px 18px 22px", maxHeight: "86vh", overflowY: "auto", boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT, color: T.text, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="file" size={17} /> Import a 3.4 file
          </div>
          <button aria-label="Close" onClick={onClose} style={{ background: T.pillBg, border: "none", borderRadius: 9999, width: 32, height: 32, cursor: "pointer", color: T.textSecondary, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="x" size={14} />
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: T.textTertiary, fontFamily: FONT, marginBottom: 14, lineHeight: 1.5 }}>
          Fills Assets, Debts, and REO from the 1003. In Arive, export the loan as <span style={{ color: T.textSecondary, fontWeight: 600 }}>Fannie Mae 3.4</span>.{" "}
          <span style={{ color: T.textSecondary, fontWeight: 600 }}>The file stays on this device. SSNs and account numbers are never read.</span>
        </div>

        <input ref={inputRef} type="file" accept=".xml,text/xml,application/xml" style={{ display: "none" }}
          onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ""; }} />

        <div
          role="button" tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); readFile(e.dataTransfer.files?.[0]); }}
          style={{
            border: `2px dashed ${dragOver ? T.blue : T.separator}`, background: dragOver ? `${T.blue}0d` : "transparent",
            borderRadius: 14, padding: parsed ? "12px 14px" : "26px 14px", textAlign: "center", cursor: "pointer",
            color: T.blue, fontFamily: FONT, fontWeight: 600, fontSize: 14, marginBottom: 14, transition: "all 0.15s",
          }}>
          {reading ? "Reading…" : fileName ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: T.text, maxWidth: "100%" }}>
              <Icon name="file" size={14} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</span>
              <span style={{ color: T.blue, fontSize: 12.5, flexShrink: 0 }}>Change</span>
            </span>
          ) : (<>
            Choose a 3.4 file
            <div style={{ fontSize: 11.5, fontWeight: 500, color: T.textTertiary, marginTop: 4 }}>or drop the .xml here</div>
          </>)}
        </div>

        {err && <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 12, fontFamily: FONT, lineHeight: 1.5 }}>{err}</div>}

        {merged && (<>
          <div style={{ background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "4px 14px 6px", marginBottom: 12 }}>
            {parsed.borrowers.length > 0 && row("File", parsed.borrowers.join(" & "))}
            {row("Assets",
              added.assets ? `${plural(added.assets, "account", "accounts")} · ${fmt(assetTotal)}` : "None to add",
              skipNote(skipped.assets))}
            {row("Debts",
              added.debts ? `${plural(added.debts, "debt", "debts")} · ${fmt(debtMonthly)}/mo` : "None to add",
              [payoffCount ? `${payoffCount} marked to pay off at closing` : null, skipNote(skipped.debts)].filter(Boolean).join(" · ") || null)}
            {row("REO",
              added.reos ? plural(added.reos, "property", "properties") : "None to add",
              [reoLiens ? `${plural(reoLiens, "lien", "liens")} linked` : null, skipNote(skipped.reos)].filter(Boolean).join(" · ") || null)}
          </div>
          {parsed.notes.length > 0 && (
            <div style={{ fontSize: 12, color: T.textTertiary, fontFamily: FONT, lineHeight: 1.5, marginBottom: 12 }}>
              {parsed.notes.join(" ")}
            </div>
          )}
          <div style={{ fontSize: 12, color: T.textTertiary, fontFamily: FONT, lineHeight: 1.5, marginBottom: 14 }}>
            Income isn't imported from the file. Rates aren't in a 3.4 file, so each debt's rate stays blank.
          </div>
          <button disabled={nothingNew} onClick={() => onApply(merged)} style={pillBtn(true, !nothingNew)}>
            {nothingNew ? "Everything here is already in this scenario" : "Add to this scenario"}
          </button>
        </>)}
        <button onClick={onClose} style={{ ...pillBtn(false), marginTop: 10 }}>Cancel</button>
      </div>
    </div>
  , document.body);
}
