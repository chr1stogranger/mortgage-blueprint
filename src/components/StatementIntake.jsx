import { FONT, MONO } from "../lib/fonts.js";
import React, { useRef, useState } from "react";
import Icon from "../Icon.jsx";

// StatementIntake — the mortgage statement as the first step of a refi
// (Refi Hunter Phase 2, Christo 2026-10-31). Sits under "Do you have a mortgage
// statement?" in Your Current Loan. Drop a PDF or snap a photo (phones get the
// camera from the file picker), and Claude reads it straight into the
// current-loan fields below. The same documents still show in the desktop
// live-preview panel; this card only moves the upload into the flow, so it
// works on phones and with the preview closed.
//
// Upload/extract/remove are the parent's existing handlers (handleStatementFile,
// handleStatementAutofill, handleStatementRemove) — one code path for both
// surfaces. LO-only for now: the statements API is staff-authenticated.
//
// Props:
//   T, isDesktop
//   available     — cloud + LO + saved scenario (stmtAvailable)
//   docs          — [{ id, name }] (stmtDocs.docs)
//   loading       — the document list is still loading
//   busy          — '' | 'uploading' | 'extracting'
//   fill          — { lines: [], notes } after an autofill, else null
//   onFile(file)  — upload one file (auto-reads it afterwards)
//   onAutofill()  — read every uploaded statement again
//   onRemove(id)  — remove one document
//   onView(id)    — desktop: open it in the preview panel
//   onDismissFill()
export default function StatementIntake({
  T, isDesktop, available, docs = [], loading, busy, fill,
  onFile, onAutofill, onRemove, onView, onDismissFill,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  if (!available) {
    return (
      <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 14, background: T.inputBg, border: `1px dashed ${T.separator}`, fontSize: 12, color: T.textSecondary, lineHeight: 1.5, fontFamily: FONT }}>
        Sign in and open this as a client to upload the statement and have it read for you. You can still type the numbers in below.
      </div>
    );
  }

  const pick = (files) => {
    const f = files && files[0];
    if (f) onFile(f);
  };
  const working = busy === "uploading" ? "Uploading…" : busy === "extracting" ? "Reading the statement…" : "";

  return (
    <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a mortgage statement"
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !busy) { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!busy) pick(e.dataTransfer.files); }}
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 14, cursor: busy ? "wait" : "pointer",
          background: dragOver ? `${T.blue}14` : T.inputBg,
          border: `1.5px dashed ${dragOver ? T.blue : `${T.blue}66`}`,
          fontFamily: FONT,
        }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 9999, background: `${T.blue}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name={busy ? "clock" : "file"} size={17} style={{ color: T.blue }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
            {working || (docs.length ? "Add another statement" : isDesktop ? "Drop the statement here, or click to choose it" : "Upload or take a photo of the statement")}
          </div>
          <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2, lineHeight: 1.4 }}>
            {working ? "This takes about 15 seconds." : "PDF or photo, up to 10MB. We read the balance, rate, payment split, escrow and any second lien, then fill them in below for you to check."}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/*"
          style={{ display: "none" }}
          onChange={(e) => { pick(e.target.files); e.target.value = ""; }}
        />
      </div>

      {(docs.length > 0 || loading) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {loading && !docs.length && <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT }}>Loading statements…</span>}
          {docs.map((d) => (
            <span key={d.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%", padding: "4px 6px 4px 12px", borderRadius: 9999, background: T.inputBg, border: `1px solid ${T.separator}`, fontSize: 12, fontWeight: 600, color: T.text, fontFamily: FONT }}>
              {isDesktop && onView ? (
                <button type="button" onClick={() => onView(d.id)} title="Show it in the preview panel" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: T.text, font: "inherit", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{d.name}</button>
              ) : (
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{d.name}</span>
              )}
              <button type="button" aria-label={`Remove ${d.name}`} onClick={() => onRemove(d.id)} disabled={!!busy} style={{ background: "none", border: "none", padding: 2, cursor: busy ? "default" : "pointer", color: T.textTertiary, display: "inline-flex" }}>
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
          {docs.length > 0 && (
            <button type="button" onClick={onAutofill} disabled={!!busy} style={{ padding: "5px 14px", borderRadius: 9999, border: "none", background: busy ? `${T.blue}1f` : T.blue, color: busy ? T.blue : "#fff", fontSize: 12, fontWeight: 600, cursor: busy ? "wait" : "pointer", fontFamily: FONT }}>
              {busy === "extracting" ? "Reading…" : "Read again"}
            </button>
          )}
        </div>
      )}

      {fill && (
        <div style={{ padding: "10px 12px", borderRadius: 12, background: fill.lines.length ? T.successBg : T.inputBg, border: `1px solid ${fill.lines.length ? `${T.green}33` : T.separator}`, fontFamily: FONT }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: fill.lines.length ? T.green : T.textSecondary }}>
              {fill.lines.length ? `Read ${fill.lines.length} field${fill.lines.length !== 1 ? "s" : ""} from the statement` : "Nothing filled"}
            </span>
            <button type="button" aria-label="Dismiss" onClick={onDismissFill} style={{ background: "none", border: "none", cursor: "pointer", color: T.textTertiary, padding: 0, display: "inline-flex" }}><Icon name="x" size={12} /></button>
          </div>
          {fill.lines.length > 0 && <div style={{ fontSize: 12, color: T.text, marginTop: 4, lineHeight: 1.5 }}>{fill.lines.join(" · ")}</div>}
          {fill.notes && <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4, lineHeight: 1.45 }}>{fill.notes}</div>}
          {fill.lines.length > 0 && <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 4 }}>Check each one against the statement below before you send anything.</div>}
        </div>
      )}
    </div>
  );
}
