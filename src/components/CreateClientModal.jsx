import { FONT, MONO } from "../lib/fonts.js";
/**
 * CreateClientModal — the "+" / New client sheet.
 *
 * Name + optional email / phone + the Add to CRM toggle, and (2026-11-23) a
 * look-up that runs off the Client Name field so an LO doesn't hand-type
 * someone who already exists. As they type, one list shows matches from:
 *
 *   Blueprint — a client they already have here        → opens that client
 *   Arive     — a loan file (searchArive, debounced)   → full import: numbers,
 *               property, deal team (parent's onImportArive)
 *   Ops       — a lead or past client (fetchOpsContacts, read once per open,
 *               filtered locally)                      → fills name + email;
 *               the LO adds a phone if they want and hits Create
 *
 * One person, one row: matched by email, Blueprint beats Arive beats Ops, so
 * the row always leads to the richest thing we can do for that person.
 *
 * Every source is optional. A missing prop, a 503 from an unconnected Arive or
 * a failed Ops read just leaves that source out of the list — the blank form
 * underneath always works.
 *
 * The toggle tags the borrower `source: blueprint-crm`, which is what puts
 * them on the Leads tab in RealStack Ops. A contact picked from Ops is in the
 * CRM already, so the toggle is replaced by a line saying so.
 */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "../Icon";

const low = (s) => String(s || "").trim().toLowerCase();
const fmtMoney = (v) => (v > 0 ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v) : "");
const MAX_ROWS = 6;

// Merge the three sources into one de-duplicated list (exported for tests).
// q: lowercased query (2+ chars). clients: Blueprint borrowers. arive: search
// rows. ops: [{ name, email, detail, kind }].
export function mergeClientMatches(q, clients = [], arive = [], ops = []) {
  if (!q || q.length < 2) return [];
  const hit = (...parts) => parts.some((p) => low(p).includes(q));
  const seen = new Set();
  const out = [];
  const push = (row) => {
    const e = low(row.email);
    if (e) { if (seen.has(e)) return; seen.add(e); }
    out.push(row);
  };
  for (const b of clients) {
    if (!hit(b.name, b.email)) continue;
    push({ key: "bp:" + b.id, source: "blueprint", name: b.name || b.email, email: b.email || "", detail: b.email || "Already in Blueprint", raw: b });
  }
  for (const r of arive) {
    push({
      key: "ar:" + r.id, source: "arive", name: r.name, coName: r.co_name || "", email: r.email || "",
      detail: [r.property, fmtMoney(r.loan_amount), r.purpose].filter(Boolean).join(" · ") || r.email || "Arive file",
      raw: r,
    });
  }
  for (const c of ops) {
    if (!hit(c.name, c.email)) continue;
    push({ key: "ops:" + c.kind + ":" + c.email, source: "ops", name: c.name, email: c.email, detail: [c.kind === "past_client" ? "Past client" : "Lead", c.detail].filter(Boolean).join(" · "), raw: c });
  }
  return out;
}

const SOURCE_LABEL = { blueprint: "Blueprint", arive: "Arive", ops: "Ops" };
const SOURCE_ACTION = { blueprint: "Open", arive: "Import", ops: "Use" };

export default function CreateClientModal({ open, onClose, onCreate, initialName, T, clients, onOpenExisting, searchArive, onImportArive, fetchOpsContacts }) {
  const [name, setName] = useState(initialName || "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addToCrm, setAddToCrm] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [opsContacts, setOpsContacts] = useState([]);
  const [ariveRows, setAriveRows] = useState([]);
  const [ariveSearching, setAriveSearching] = useState(false);
  const [picked, setPicked] = useState(null);      // the Ops contact the form was filled from
  const [actingKey, setActingKey] = useState(null); // row being opened / imported
  const seqRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setName(initialName || ""); setEmail(""); setPhone(""); setAddToCrm(true); setBusy(false); setErr(null);
    setAriveRows([]); setAriveSearching(false); setPicked(null); setActingKey(null);
  }, [open, initialName]);

  // Ops leads + past clients: one read per open, filtered locally as they type.
  useEffect(() => {
    if (!open || !fetchOpsContacts) return;
    let live = true;
    fetchOpsContacts()
      .then((d) => {
        if (!live) return;
        const tag = (rows, kind) => (Array.isArray(rows) ? rows : []).map((c) => ({ name: c.name || c.email, email: c.email || "", detail: c.detail || "", kind }));
        setOpsContacts([...tag(d?.leads, "lead"), ...tag(d?.past_clients, "past_client")]);
      })
      .catch(() => { /* Ops look-up is a bonus; the form works without it */ });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const q = low(name);
  const looking = !picked && q.length >= 2;

  // Arive: debounced search-as-you-type (its full-list scan takes a few seconds).
  useEffect(() => {
    if (!open || !searchArive || !onImportArive) return;
    const seq = ++seqRef.current;
    if (!looking) { setAriveRows([]); setAriveSearching(false); return; }
    setAriveSearching(true);
    const t = setTimeout(() => {
      searchArive(q)
        .then((d) => { if (seq === seqRef.current) { setAriveRows(d?.results || []); setAriveSearching(false); } })
        .catch(() => { if (seq === seqRef.current) { setAriveRows([]); setAriveSearching(false); } });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, looking, open]);

  const matches = useMemo(
    () => (looking ? mergeClientMatches(q, onOpenExisting ? clients || [] : [], ariveRows, opsContacts) : []),
    [looking, q, clients, onOpenExisting, ariveRows, opsContacts],
  );

  if (!open) return null;

  const emailOk = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const phoneOk = !phone.trim() || phone.replace(/\D/g, "").length >= 10;
  const locked = busy || !!actingKey;
  const canCreate = name.trim().length > 0 && emailOk && phoneOk && !locked;
  const inputStyle = { width: "100%", boxSizing: "border-box", background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "12px 14px", color: T.text, fontSize: 15, outline: "none", fontFamily: FONT };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 5, fontFamily: FONT };
  const hintStyle = { fontWeight: 400, color: T.textTertiary };

  const pick = async (m) => {
    if (locked) return;
    setErr(null);
    if (m.source === "ops") {
      setPicked(m.raw); setName(m.name || ""); setEmail(m.email || "");
      return;
    }
    setActingKey(m.key);
    try {
      if (m.source === "blueprint") await onOpenExisting(m.raw);
      else await onImportArive(m.raw);
      onClose();
    } catch (e) {
      setErr(e?.message || (m.source === "arive" ? "Import failed. Try again." : "Could not open that client."));
      setActingKey(null);
    }
  };

  const shown = matches.slice(0, MAX_ROWS);

  // Portaled to <body>: the app shell is a z-index:1 stacking context, which
  // traps a modal under the docked panels no matter its own z-index.
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => !locked && onClose()}>
      <div style={{ background: T.card, borderRadius: 20, maxWidth: 460, width: "100%", padding: "20px 18px 24px", boxShadow: "0 24px 64px rgba(0,0,0,0.35)", maxHeight: "92vh", overflowY: "auto", boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT, color: T.text }}>Create New Client</div>
          <button aria-label="Close" onClick={() => !locked && onClose()} style={{ background: T.pillBg, border: "none", borderRadius: 20, width: 32, height: 32, cursor: "pointer", color: T.textSecondary, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="x" size={15} /></button>
        </div>

        <label style={labelStyle}>Client Name {(searchArive || fetchOpsContacts) && <span style={hintStyle}>(type to find them in Arive or Ops)</span>}</label>
        <input autoFocus autoComplete="off" value={name}
          onChange={(e) => { setName(e.target.value); if (picked) setPicked(null); }}
          placeholder="Jane Homebuyer" style={{ ...inputStyle, marginBottom: 12 }} />

        {looking && (shown.length > 0 || ariveSearching) && (
          <div data-testid="client-matches" style={{ marginTop: -4, marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.12em", color: T.textTertiary, marginBottom: 6 }}>
              {shown.length > 0 ? "Already have them?" : "Checking Arive"}
            </div>
            <div style={{ maxHeight: 216, overflowY: "auto" }}>
              {shown.map((m) => {
                const acting = actingKey === m.key;
                return (
                  <button type="button" key={m.key} onClick={() => pick(m)} disabled={locked}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "9px 12px", marginBottom: 6,
                      background: T.inputBg, borderRadius: 12, border: `1px solid ${acting ? T.blue : T.inputBorder}`,
                      cursor: locked ? "default" : "pointer", opacity: locked && !acting ? 0.5 : 1, fontFamily: FONT,
                    }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.name}{m.coName ? <span style={{ fontWeight: 500, color: T.textSecondary }}> &amp; {m.coName}</span> : null}
                        </span>
                        <span style={{ fontSize: 9.5, fontWeight: 600, fontFamily: MONO, textTransform: "uppercase", letterSpacing: 0.6, color: T.blue, background: `${T.blue}14`, padding: "2px 7px", borderRadius: 9999, flexShrink: 0 }}>
                          {SOURCE_LABEL[m.source]}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: T.textTertiary, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.detail}</div>
                    </div>
                    <span style={{ fontSize: 12, color: T.blue, fontWeight: 700, flexShrink: 0, display: "flex", alignItems: "center", gap: 3 }}>
                      {acting ? (m.source === "arive" ? "Importing…" : "Opening…") : <>{SOURCE_ACTION[m.source]}<Icon name="chevron-right" size={13} /></>}
                    </span>
                  </button>
                );
              })}
            </div>
            {(ariveSearching || matches.length > MAX_ROWS) && (
              <div style={{ fontSize: 12, color: T.textTertiary, fontFamily: FONT, padding: "2px 2px 0" }}>
                {ariveSearching ? "Searching your Arive files…" : `${matches.length - MAX_ROWS} more. Keep typing to narrow it down.`}
              </div>
            )}
          </div>
        )}

        <label style={labelStyle}>Email <span style={hintStyle}>(optional: enables live links & worksheet sends)</span></label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@email.com" inputMode="email" autoCapitalize="none" style={{ ...inputStyle, marginBottom: 12, borderColor: emailOk ? T.inputBorder : T.red }} />
        <label style={labelStyle}>Phone <span style={hintStyle}>(optional: lets you text their live link)</span></label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(510) 555-0123" inputMode="tel" style={{ ...inputStyle, marginBottom: 14, borderColor: phoneOk ? T.inputBorder : T.red }} />

        {picked ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0 16px", gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT }}>From RealStack Ops</div>
              <div style={{ fontSize: 11.5, color: T.textTertiary, fontFamily: FONT, lineHeight: 1.4 }}>
                {picked.kind === "past_client" ? "A past client" : "A lead"} already in your CRM. Their Blueprint links to that record by email.
              </div>
            </div>
            <button type="button" onClick={() => { setPicked(null); setName(""); setEmail(""); }} style={{ background: T.pillBg, border: "none", borderRadius: 9999, padding: "7px 13px", fontSize: 12, fontWeight: 600, color: T.textSecondary, cursor: "pointer", fontFamily: FONT, flexShrink: 0 }}>Clear</button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0 16px", gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT }}>Add to CRM</div>
              <div style={{ fontSize: 11.5, color: T.textTertiary, fontFamily: FONT, lineHeight: 1.4 }}>Adds this client to your Leads in RealStack Ops</div>
            </div>
            <button type="button" role="switch" aria-checked={!!addToCrm} onClick={() => setAddToCrm(!addToCrm)} aria-label="Add to CRM" style={{ width: 40, height: 22, borderRadius: 9999, border: "none", background: addToCrm ? T.blue : T.separator, position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: addToCrm ? 20 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </button>
          </div>
        )}

        {err && <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, fontFamily: FONT }}>{err}</div>}
        <button disabled={!canCreate}
          onClick={async () => {
            setBusy(true); setErr(null);
            // A contact picked from Ops is in the CRM already: no blueprint-crm
            // tag, or Ops would list them twice.
            try { await onCreate({ name: name.trim(), email: email.trim(), phone: phone.trim(), addToCrm: picked ? false : addToCrm }); onClose(); }
            catch (e) { setErr(e.message || "Could not create client"); setBusy(false); }
          }}
          style={{ width: "100%", padding: 15, border: "none", borderRadius: 9999, background: canCreate ? "linear-gradient(135deg, #3B6BF5, #2B4FCE)" : T.pillBg, color: canCreate ? "#fff" : T.textTertiary, fontWeight: 700, fontSize: 15, cursor: canCreate ? "pointer" : "default", fontFamily: FONT, boxShadow: canCreate ? "0 0 20px rgba(59,107,245,0.3)" : "none" }}>
          {busy ? "Creating…" : "Create Client"}
        </button>
      </div>
    </div>
  , document.body);
}
