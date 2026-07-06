// src/components/SendWorksheetModal.jsx
//
// Preview → Send modal for the Fees Worksheet email. Renders the worksheet
// PDF client-side (lazy-loaded @react-pdf/renderer), shows an editable
// subject/body, and sends through the LO's own Gmail via the Ops endpoint
// (ops.realstack.app/api/gmail?action=send) with the PDF attached.
//
// Replaces the old mailto "Email Summary" as the primary send path. Callers
// should only render this when gmailSendAvailable() is true and fall back to
// mailto otherwise.

import React, { useEffect, useMemo, useState } from "react";
import {
  gmailSendAvailable, getStoredGmailToken, clearGmailToken,
  requestGmailToken, ensureGmailToken,
} from "../lib/gmailAuth.js";

const API_BASE = import.meta.env.VITE_API_BASE || "https://ops.realstack.app";
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";
// Ops caps attachments at ~700KB of base64 (fits its 1MB body limit).
const MAX_B64_CHARS = 700_000;

async function renderWorksheetBlob(worksheetProps) {
  // Both imports are dynamic so react-pdf stays out of the main bundle.
  const [{ pdf }, { FeesWorksheetDoc }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("../lib/FeesWorksheetPdf.jsx"),
  ]);
  return pdf(React.createElement(FeesWorksheetDoc, worksheetProps)).toBlob();
}

// Smart filename: FeesWorksheet-{BorrowerLastName|Scenario}-{MonDD}.pdf so
// inboxes and Downloads folders sort cleanly (Christo 2026-07-05).
export function worksheetFileName(borrowerName, scenarioName) {
  const last = (borrowerName || "").trim().split(/\s+/).pop() || "";
  const base = (last || scenarioName || "Scenario").replace(/[^A-Za-z0-9-_ ]/g, "").trim().replace(/\s+/g, "-");
  const d = new Date();
  const datePart = `${d.toLocaleDateString("en-US", { month: "short" })}${d.getDate()}`;
  return `FeesWorksheet-${base}-${datePart}.pdf`;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Could not read PDF"));
    reader.readAsDataURL(blob);
  });
}

// Wrap the plain-text body in a minimal branded HTML shell. The text is
// escaped first — borrower names etc. are data, not markup.
function bodyToHtml(text) {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const lines = esc(text).split("\n").map((ln) => {
    // Figure bullets ("• Label: $1,234") get mono treatment for the numbers.
    if (/^\s*•/.test(ln)) {
      return `<div style="font-family:${MONO};font-size:13.5px;padding:2px 0 2px 8px;">${ln}</div>`;
    }
    return ln.trim() === "" ? '<div style="height:10px"></div>' : `<div>${ln}</div>`;
  }).join("");
  return `<div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:15px;line-height:1.55;color:#171717;max-width:560px;">${lines}</div>`;
}

export default function SendWorksheetModal({
  open, onClose, T,
  buildWorksheetProps,       // () => props object for FeesWorksheetDoc
  defaultTo, defaultSubject, defaultBody,
  loEmail, loanOfficer, scenarioName, borrowerName,
  realtorPartner,            // optional { name, email } — enables the CC chip
  logMeta,                   // optional { scenarioName, borrowerName } for the send log
  onFallbackMailto,          // () => void — old mailto path
}) {
  const [to, setTo] = useState(defaultTo || "");
  const [subject, setSubject] = useState(defaultSubject || "");
  const [body, setBody] = useState(defaultBody || "");
  const [phase, setPhase] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState(null);
  const [ccRealtor, setCcRealtor] = useState(false); // off by default — LO opts in per send
  const linked = !!getStoredGmailToken();

  // Re-seed fields each time the modal opens (scenario may have changed).
  useEffect(() => {
    if (open) {
      setTo(defaultTo || "");
      setSubject(defaultSubject || "");
      setBody(defaultBody || "");
      setPhase("idle");
      setError(null);
      setCcRealtor(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim()), [to]);
  const fileName = worksheetFileName(borrowerName, scenarioName);

  if (!open) return null;

  const postSend = async (token, payload) =>
    fetch(`${API_BASE}/api/gmail?action=send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

  const handleSend = async () => {
    setPhase("sending");
    setError(null);
    try {
      const blob = await renderWorksheetBlob(buildWorksheetProps());
      const contentBase64 = await blobToBase64(blob);
      if (contentBase64.length > MAX_B64_CHARS) {
        throw new Error("The PDF is too large to attach — use Download and send it manually.");
      }
      const payload = {
        to: to.trim(),
        subject: subject.trim() || "Your Fees Worksheet",
        htmlBody: bodyToHtml(body),
        fromName: loanOfficer || undefined,
        cc: (ccRealtor && realtorPartner?.email) ? realtorPartner.email : undefined,
        bcc: loEmail || undefined,
        attachments: [{ filename: fileName, mimeType: "application/pdf", contentBase64 }],
        // Best-effort send log (written server-side to Supabase; see Ops gmail.js)
        log: {
          borrowerEmail: to.trim(),
          borrowerName: logMeta?.borrowerName || borrowerName || "",
          scenarioName: logMeta?.scenarioName || scenarioName || "",
          loEmail: loEmail || "",
          sentVia: "gmail",
          ccRealtor: !!(ccRealtor && realtorPartner?.email),
        },
      };
      let token = await ensureGmailToken();
      let res = await postSend(token, payload);
      if (res.status === 401) {
        // Stored token expired — silent re-auth once, then retry once.
        clearGmailToken();
        token = await requestGmailToken({ silent: true }).catch(() => requestGmailToken());
        res = await postSend(token, payload);
      }
      if (res.status === 403) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error === "Email not authorized"
          ? "This Google account isn't authorized to send. Link one of your work Gmail accounts."
          : (j.error || "Not authorized"));
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Send failed (${res.status})`);
      }
      setPhase("sent");
      setTimeout(() => onClose(true), 1600);
    } catch (e) {
      setPhase("error");
      setError(e.message || "Something went wrong sending the email.");
    }
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box", background: T.inputBg, borderRadius: 12,
    border: `1px solid ${T.inputBorder}`, padding: "11px 14px", color: T.text,
    fontSize: 14, outline: "none", fontFamily: FONT,
  };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 5, fontFamily: FONT };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={() => phase !== "sending" && onClose(false)}>
      <div style={{ background: T.card, borderRadius: "20px 20px 0 0", maxWidth: 520, width: "100%", maxHeight: "88vh", overflowY: "auto", padding: "20px 18px 30px" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT, color: T.text }}>Email Fees Worksheet</div>
          <button onClick={() => phase !== "sending" && onClose(false)}
            style={{ background: T.pillBg, border: "none", borderRadius: 20, width: 32, height: 32, fontSize: 15, cursor: "pointer", color: T.textSecondary }}>✕</button>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>To</label>
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="borrower@email.com" style={inputStyle} inputMode="email" autoCapitalize="none" />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Message</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5, minHeight: 150 }} />
        </div>

        {/* Attachment + BCC chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, fontFamily: MONO, color: T.blue, background: `${T.blue}14`, border: `1px solid ${T.blue}30`, borderRadius: 9999, padding: "5px 12px" }}>
            {fileName}
          </div>
          {loEmail && (
            <div style={{ fontSize: 11.5, fontFamily: MONO, color: T.textTertiary, background: T.pillBg, borderRadius: 9999, padding: "5px 12px" }}>
              BCC: {loEmail}
            </div>
          )}
          {realtorPartner?.email && (
            <button onClick={() => setCcRealtor(!ccRealtor)} title={ccRealtor ? "Remove realtor from CC" : "CC the realtor on this email"}
              style={{
                fontSize: 11.5, fontFamily: MONO, cursor: "pointer",
                color: ccRealtor ? T.blue : T.textTertiary,
                background: ccRealtor ? `${T.blue}14` : "transparent",
                border: `1px ${ccRealtor ? "solid" : "dashed"} ${ccRealtor ? `${T.blue}50` : T.separator}`,
                borderRadius: 9999, padding: "5px 12px",
              }}>
              {ccRealtor ? "✓ " : "+ "}CC {realtorPartner.name || realtorPartner.email}
            </button>
          )}
        </div>

        {phase === "error" && (
          <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 12, lineHeight: 1.5 }}>{error}</div>
        )}
        {phase === "sent" ? (
          <div style={{ textAlign: "center", padding: "14px 0", fontSize: 15, fontWeight: 700, color: T.green || "#10B981", fontFamily: FONT }}>
            ✓ Sent from your Gmail
          </div>
        ) : (
          <button onClick={handleSend} disabled={!emailValid || phase === "sending"}
            style={{
              width: "100%", padding: 15, border: "none", borderRadius: 9999,
              background: !emailValid ? T.pillBg : `linear-gradient(135deg, #6366F1, #3B82F6)`,
              color: !emailValid ? T.textTertiary : "#fff", fontWeight: 700, fontSize: 15,
              cursor: !emailValid || phase === "sending" ? "default" : "pointer", fontFamily: FONT,
              boxShadow: emailValid ? "0 0 20px rgba(99,102,241,0.3)" : "none",
            }}>
            {phase === "sending" ? "Sending…" : linked ? "Send from my Gmail" : "Connect Gmail & Send"}
          </button>
        )}

        {gmailSendAvailable() && !linked && phase !== "sent" && (
          <div style={{ fontSize: 11.5, color: T.textTertiary, textAlign: "center", marginTop: 10, fontFamily: FONT }}>
            A Google window will ask permission to send email on your behalf — one time per browser.
          </div>
        )}
        {onFallbackMailto && phase !== "sent" && (
          <button onClick={() => { onClose(false); onFallbackMailto(); }}
            style={{ width: "100%", marginTop: 10, padding: 12, background: "transparent", border: `1px solid ${T.separator}`, borderRadius: 9999, color: T.textSecondary, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>
            Use my mail app instead
          </button>
        )}
      </div>
    </div>
  );
}

// Shared helper so callers can offer "Download PDF" from the same renderer.
export async function downloadWorksheetPdf(worksheetProps, scenarioName, borrowerName) {
  const blob = await renderWorksheetBlob(worksheetProps);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = worksheetFileName(borrowerName, scenarioName);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ── Borrower self-send: "Email me this worksheet" via the Ops Resend
//    endpoint (no Google auth — works for local-mode/App Store users and
//    live-link borrowers). The LO is BCC'd server-side on every send, which
//    doubles as a lead-intent signal. ──
export function BorrowerSendModal({
  open, onClose, T,
  buildWorksheetProps, scenarioName, borrowerName,
  defaultTo, loanOfficer, loEmail,
}) {
  const [to, setTo] = useState(defaultTo || "");
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(null);
  useEffect(() => {
    if (open) { setTo(defaultTo || ""); setPhase("idle"); setError(null); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim()), [to]);
  if (!open) return null;

  const handleSend = async () => {
    setPhase("sending");
    setError(null);
    try {
      const blob = await renderWorksheetBlob(buildWorksheetProps());
      const contentBase64 = await blobToBase64(blob);
      if (contentBase64.length > MAX_B64_CHARS) throw new Error("PDF too large — use Save PDF instead.");
      const res = await fetch(`${API_BASE}/api/worksheet-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          borrowerName: borrowerName || "",
          scenarioName: scenarioName || "",
          loName: loanOfficer || "",
          loEmail: loEmail || "",
          filename: worksheetFileName(borrowerName, scenarioName),
          contentBase64,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Send failed (${res.status})`);
      }
      setPhase("sent");
      setTimeout(() => onClose(true), 1600);
    } catch (e) {
      setPhase("error");
      setError(e.message || "Something went wrong.");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={() => phase !== "sending" && onClose(false)}>
      <div style={{ background: T.card, borderRadius: "20px 20px 0 0", maxWidth: 460, width: "100%", padding: "20px 18px 30px" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT, color: T.text }}>Email Me This Worksheet</div>
          <button onClick={() => phase !== "sending" && onClose(false)}
            style={{ background: T.pillBg, border: "none", borderRadius: 20, width: 32, height: 32, fontSize: 15, cursor: "pointer", color: T.textSecondary }}>✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: T.textSecondary, lineHeight: 1.5, marginBottom: 14, fontFamily: FONT }}>
          Get the full fees worksheet PDF for this scenario in your inbox{loanOfficer ? ` — prepared by ${loanOfficer}` : ""}.
        </div>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="you@email.com" inputMode="email" autoCapitalize="none"
          style={{ width: "100%", boxSizing: "border-box", background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "12px 14px", color: T.text, fontSize: 15, outline: "none", fontFamily: FONT, marginBottom: 12 }} />
        {phase === "error" && <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10 }}>{error}</div>}
        {phase === "sent" ? (
          <div style={{ textAlign: "center", padding: "12px 0", fontSize: 15, fontWeight: 700, color: T.green || "#10B981", fontFamily: FONT }}>✓ Sent — check your inbox</div>
        ) : (
          <button onClick={handleSend} disabled={!emailValid || phase === "sending"}
            style={{ width: "100%", padding: 15, border: "none", borderRadius: 9999, background: !emailValid ? T.pillBg : "linear-gradient(135deg, #6366F1, #3B82F6)", color: !emailValid ? T.textTertiary : "#fff", fontWeight: 700, fontSize: 15, cursor: !emailValid || phase === "sending" ? "default" : "pointer", fontFamily: FONT, boxShadow: emailValid ? "0 0 20px rgba(99,102,241,0.3)" : "none" }}>
            {phase === "sending" ? "Sending…" : "Send to my email"}
          </button>
        )}
      </div>
    </div>
  );
}
