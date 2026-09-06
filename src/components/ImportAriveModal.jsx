import { FONT, MONO } from "../lib/fonts.js";
/**
 * ImportAriveModal — create a Blueprint client from an existing Arive file.
 *
 * Search your Arive loans by borrower name/email/property, pick one, and the
 * parent's onImport(loanId) builds the client: borrower record (deduped by
 * email), Scenario 1 prefilled from the loan (price, down, rate, loan type,
 * property, FICO, income), deal team from the file's contacts, co-borrower
 * email linked. Re-running the import on the same client just adds a fresh
 * scenario — nothing is overwritten.
 */
import React, { useState, useEffect, useRef } from "react";
import Icon from "../Icon";


const fmtMoney = (v) => (v > 0 ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v) : "");
const prettyStatus = (s) => (s || "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function ImportAriveModal({ open, onClose, onImport, searchArive, initialQuery, T }) {
  const [query, setQuery] = useState(initialQuery || "");
  const [results, setResults] = useState(null); // null = not searched yet
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState(null);
  const [err, setErr] = useState(null);
  const debounceRef = useRef(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (open) { setQuery(initialQuery || ""); setResults(null); setSearching(false); setImportingId(null); setErr(null); }
  }, [open, initialQuery]);

  // Debounced search-as-you-type (Arive full-list scan takes a few seconds)
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) { setResults(null); setSearching(false); return; }
    setSearching(true); setErr(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const seq = ++seqRef.current;
    debounceRef.current = setTimeout(() => {
      searchArive(q)
        .then((d) => { if (seq === seqRef.current) { setResults(d.results || []); setSearching(false); } })
        .catch(() => { if (seq === seqRef.current) { setErr("Arive search failed — try again."); setSearching(false); } });
    }, 500);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  if (!open) return null;

  const busy = !!importingId;
  const inputStyle = { width: "100%", boxSizing: "border-box", background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "12px 14px", color: T.text, fontSize: 15, outline: "none", fontFamily: FONT };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1300, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => !busy && onClose()}>
      <div style={{ background: T.card, borderRadius: "20px 20px 0 0", maxWidth: 500, width: "100%", padding: "20px 18px 30px", maxHeight: "82vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT, color: T.text, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="download" size={17} /> Import from Arive
          </div>
          <button aria-label="Close" onClick={() => !busy && onClose()} style={{ background: T.pillBg, border: "none", borderRadius: 20, width: 32, height: 32, fontSize: 15, cursor: "pointer", color: T.textSecondary }}>✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: T.textTertiary, fontFamily: FONT, marginBottom: 14, lineHeight: 1.5 }}>
          Pull an existing Arive file into Blueprint — client, numbers, property, and deal team come prepopulated.
        </div>
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Arive by borrower, email, or property…" style={{ ...inputStyle, marginBottom: 12 }} />

        <div style={{ overflowY: "auto", flex: 1, minHeight: 120 }}>
          {searching && (
            <div style={{ padding: "22px 0", textAlign: "center", fontSize: 13, color: T.textSecondary, fontFamily: FONT }}>
              Searching your Arive files…
            </div>
          )}
          {err && <div style={{ fontSize: 13, color: T.red, fontWeight: 600, padding: "10px 0", fontFamily: FONT }}>{err}</div>}
          {!searching && results && results.length === 0 && (
            <div style={{ padding: "22px 0", textAlign: "center", fontSize: 13, color: T.textTertiary, fontFamily: FONT }}>
              No Arive files match "{query.trim()}"
            </div>
          )}
          {!searching && results && results.map((r) => (
            <div key={r.id} onClick={() => { if (busy) return; setImportingId(r.id); setErr(null); onImport(r).catch((e) => { setErr(e?.message || "Import failed — try again."); setImportingId(null); }); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 12px", marginBottom: 8,
                background: T.inputBg, borderRadius: 12, border: `1px solid ${importingId === r.id ? T.blue : T.inputBorder}`,
                cursor: busy ? "default" : "pointer", opacity: busy && importingId !== r.id ? 0.5 : 1,
              }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                  {r.status && (
                    <span style={{ fontSize: 9.5, fontWeight: 600, fontFamily: MONO, textTransform: "uppercase", letterSpacing: 0.6, color: T.blue, background: `${T.blue}14`, padding: "2px 7px", borderRadius: 9999, flexShrink: 0 }}>
                      {prettyStatus(r.status)}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: T.textTertiary, fontFamily: FONT, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[r.property, fmtMoney(r.loan_amount), r.purpose].filter(Boolean).join(" · ") || r.email}
                </div>
              </div>
              {importingId === r.id
                ? <span style={{ fontSize: 12, color: T.blue, fontWeight: 700, fontFamily: FONT, flexShrink: 0 }}>Importing…</span>
                : <Icon name="chevron-right" size={15} />}
            </div>
          ))}
          {!results && !searching && (
            <div style={{ padding: "22px 0", textAlign: "center", fontSize: 13, color: T.textTertiary, fontFamily: FONT }}>
              Type at least 2 characters to search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
