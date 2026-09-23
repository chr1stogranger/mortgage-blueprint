import { FONT, MONO } from "../lib/fonts.js";
import React, { useState, useEffect, useCallback } from "react";
import Icon from "../Icon";
import { WEB_ORIGIN } from "../apiBase";
import {
  fetchShareAccessAsLo, addShareAccessAsLo, removeShareAccessAsLo,
  fetchShareAccessAsBorrower, addShareAccessAsBorrower, removeShareAccessAsBorrower,
} from "../api";

/**
 * "People with access" — the share link's guest list (migration 021).
 * The link only opens for these emails (plus the loan team). The LO manages
 * the whole list; a borrower can add people (a parent, a second email) and
 * remove the ones borrowers added.
 */
const KIND_LABEL = { borrower: "Borrower", coborrower: "Co-Borrower" };

export default function ShareAccessCard({ T, Card, isBorrower, borrowerId, shareToken }) {
  const [list, setList] = useState(null);     // null = loading
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const api = isBorrower
    ? { load: () => fetchShareAccessAsBorrower(shareToken), add: (e) => addShareAccessAsBorrower(shareToken, e), remove: (e) => removeShareAccessAsBorrower(shareToken, e) }
    : { load: () => fetchShareAccessAsLo(borrowerId), add: (e) => addShareAccessAsLo(borrowerId, e), remove: (e) => removeShareAccessAsLo(borrowerId, e) };
  const ready = isBorrower ? !!shareToken : !!borrowerId;

  const run = useCallback(async (fn) => {
    setBusy(true); setError("");
    try { const r = await fn(); setList(r.emails || []); return true; }
    catch (e) { setError(e.message || "Something went wrong"); return false; }
    finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBorrower, borrowerId, shareToken]);

  useEffect(() => {
    if (!ready) return;
    run(api.load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, borrowerId, shareToken]);

  const add = async () => {
    const email = draft.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email"); return; }
    if (await run(() => api.add(email))) setDraft("");
  };

  const copyLink = async () => {
    if (!shareToken) return;
    try {
      await navigator.clipboard.writeText(`${WEB_ORIGIN}?share=${shareToken}`);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch { setError("Couldn't copy. Long-press the address bar to share instead"); }
  };

  if (!ready) return null;

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary }}>People with access</div>
        {shareToken && (
          <button onClick={copyLink} style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 9999,
            border: `1px solid ${T.blue}30`, background: `${T.blue}12`, color: T.blue,
            fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
          }}>
            <Icon name={copied ? "check" : "link"} size={13} />{copied ? "Copied" : "Copy link"}
          </button>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: T.textSecondary, fontFamily: FONT, lineHeight: 1.5, marginBottom: 12 }}>
        {isBorrower
          ? "Only these emails can open your blueprint. Add a parent, a partner, or another email you use, then send them the link."
          : "The share link only opens for these emails (and your team). Add a parent, a partner, or a borrower's second email."}
      </div>

      {list === null ? (
        <div style={{ fontSize: 13, color: T.textTertiary, fontFamily: FONT, padding: "6px 0 10px" }}>Loading…</div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          {list.length === 0 && (
            <div style={{ fontSize: 13, color: T.textTertiary, fontFamily: FONT, padding: "4px 0 8px" }}>
              No emails yet. Add the borrower's email on the client record.
            </div>
          )}
          {list.map(item => (
            <div key={item.email} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 0",
              borderTop: `1px solid ${T.separator}`,
            }}>
              <Icon name="mail" size={14} color={T.textTertiary} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.email}</div>
                <div style={{ fontSize: 11.5, color: T.textTertiary, fontFamily: FONT }}>
                  {KIND_LABEL[item.kind] || (item.added_by_role === "lo" ? "Added by loan officer"
                    : item.added_by_role === "borrower" ? `Added by ${item.added_by_email || "borrower"}`
                    : "Has opened this blueprint")}
                </div>
              </div>
              {item.removable && (
                <button aria-label={`Remove ${item.email}`} title="Remove access" disabled={busy}
                  onClick={() => run(() => api.remove(item.email))}
                  style={{
                    width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "transparent", border: `1px solid ${T.separator}`, borderRadius: 9999,
                    color: T.textSecondary, cursor: busy ? "wait" : "pointer", padding: 0, flexShrink: 0,
                  }}>
                  <Icon name="x" size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); add(); }} style={{ display: "flex", gap: 8 }}>
        <input value={draft} onChange={e => { setDraft(e.target.value); setError(""); }}
          placeholder="name@email.com" inputMode="email" autoComplete="off" aria-label="Email to give access"
          style={{
            flex: 1, minWidth: 0, boxSizing: "border-box", background: T.inputBg || T.card, borderRadius: 9999,
            border: `1px solid ${T.inputBorder || T.separator}`, padding: "10px 14px", color: T.text,
            fontSize: 16, outline: "none", fontFamily: FONT,
          }} />
        <button type="submit" disabled={busy || !draft.trim()} style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 9999,
          border: "none", background: T.blue, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: FONT,
          cursor: busy ? "wait" : "pointer", opacity: (busy || !draft.trim()) ? 0.55 : 1, flexShrink: 0,
        }}>
          <Icon name="plus" size={14} />Add
        </button>
      </form>
      {error && <div style={{ marginTop: 8, fontSize: 12.5, color: T.red, fontFamily: FONT }}>{error}</div>}
    </Card>
  );
}
