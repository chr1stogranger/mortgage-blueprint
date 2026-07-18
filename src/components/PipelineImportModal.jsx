import { FONT, MONO } from "../lib/fonts.js";
/**
 * PipelineImportModal — import an Arive pipeline row into Blueprint, then
 * offer to email the new Blueprint to the client.
 *
 * Flow (Christo 2026-07-18):
 *   1. loading  — pull the whitelisted import payload from Ops
 *                 (?action=blueprint-import — name/email/phone, property,
 *                 price, loan basics. NO SSNs, DOBs, or assets).
 *   2. confirm  — show exactly what will be created; "Create Blueprint".
 *   3. creating — the parent's shared creation core runs (same path as the
 *                 sidebar Import from Arive: borrower deduped by email,
 *                 deal team merged, Scenario prefilled from the file).
 *   4. email    — "Email it to {first}?" with an editable message. Sending is
 *                 ALWAYS behind the explicit Send button — never automatic.
 *                 Web + Gmail linked → sends through the LO's own Gmail via
 *                 Ops (api/gmail?action=send) with a Grange-branded HTML
 *                 wrapper and the client's live share link. Otherwise falls
 *                 back to a prefilled mailto in the LO's mail app.
 *
 * Props:
 *   open, row        — the pipeline row being imported ({ id, guid?, borrower,
 *                      class, loanAmount, ... })
 *   onClose(result)  — result = { borrowerId } once created (caller flips the
 *                      row to the normal Blueprint pill), else null
 *   T                — theme tokens
 *   fetchPayload(row), createClient(payload) — provided by MortgageBlueprint
 *   loInfo           — { loanOfficer, loEmail, loPhone, loNmls, companyName, companyNmls }
 */
import React, { useEffect, useMemo, useState } from "react";
import Icon from "../Icon.jsx";
import { WEB_ORIGIN } from "../apiBase.js";
import {
  gmailSendAvailable, getStoredGmailToken, clearGmailToken,
  requestGmailToken, ensureGmailToken,
} from "../lib/gmailAuth.js";

const API_BASE = import.meta.env.VITE_API_BASE || "https://ops.realstack.app";

const fmtMoney = (v) => (Number(v) > 0
  ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v))
  : "");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
));

// Grange-branded HTML shell — mirrors the email-templates/ house style (dark
// card, wordmark, pill CTA) with the current Grange blue, not the retired
// indigo. The LO's message is escaped data, never markup.
export function buildBlueprintEmailHtml({ message, shareUrl, loInfo = {} }) {
  const msgHtml = esc(message).split("\n")
    .map((ln) => (ln.trim() === "" ? '<div style="height:10px"></div>' : `<div>${ln}</div>`))
    .join("");
  const footerLines = [
    [loInfo.loanOfficer, loInfo.loNmls ? `NMLS #${loInfo.loNmls}` : ""].filter(Boolean).join(" · "),
    [loInfo.companyName, loInfo.companyNmls ? `NMLS #${loInfo.companyNmls}` : ""].filter(Boolean).join(" · "),
    [loInfo.loPhone, loInfo.loEmail].filter(Boolean).join(" · "),
  ].filter(Boolean).map((ln) => esc(ln)).join("<br>");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;margin:0;padding:0;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <tr><td align="center" style="padding:40px 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#0A0A0A;border:1px solid rgba(255,255,255,0.06);border-radius:20px;overflow:hidden;">
      <tr><td align="center" style="padding:36px 32px 6px;">
        <div style="width:56px;height:56px;margin:0 auto 16px;border-radius:14px;background:linear-gradient(135deg,#3B6BF5,#2B4FCE);text-align:center;line-height:56px;">
          <img src="https://blueprint.realstack.app/icon-128.png" width="34" height="34" alt="RealStack" style="vertical-align:middle;border:0;" />
        </div>
        <div style="font-size:24px;font-weight:800;letter-spacing:-0.04em;">
          <span style="color:#EDEDED;">Real</span><span style="color:#3B6BF5;">Stack</span>
        </div>
        <div style="font-size:10px;font-weight:600;color:#666666;text-transform:uppercase;letter-spacing:2px;margin-top:6px;">Blueprint</div>
      </td></tr>
      <tr><td style="padding:22px 32px 6px;">
        <div style="font-size:15px;color:#D4D4D4;line-height:1.6;">${msgHtml}</div>
      </td></tr>
      <tr><td align="center" style="padding:18px 32px 6px;">
        <a href="${esc(shareUrl)}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#3B6BF5,#2B4FCE);color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:9999px;box-shadow:0 4px 16px rgba(59,107,245,0.3);">Open my Blueprint</a>
      </td></tr>
      <tr><td style="padding:14px 32px 0;">
        <p style="font-size:12px;color:#666666;line-height:1.6;margin:0;text-align:center;">Works in any browser. On your phone, open the link and choose &ldquo;Add to Home Screen&rdquo; to keep it as an app.</p>
      </td></tr>
      <tr><td style="padding:22px 32px 0;"><div style="height:1px;background:rgba(255,255,255,0.06);"></div></td></tr>
      <tr><td style="padding:18px 32px 32px;text-align:center;">
        <p style="font-size:12px;color:#A1A1A1;line-height:1.7;margin:0;">${footerLines}</p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

export default function PipelineImportModal({ open, row, onClose, T, fetchPayload, createClient, loInfo = {} }) {
  const [phase, setPhase] = useState("loading"); // loading | confirm | creating | email | sending | sent | error
  const [payload, setPayload] = useState(null);
  const [borrower, setBorrower] = useState(null); // created Blueprint client row
  const [message, setMessage] = useState("");
  const [error, setError] = useState(null);

  const firstName = (payload?.borrower?.name || row?.borrower || "").trim().split(/\s+/)[0] || "";

  // Load the import payload each time the modal opens for a row.
  useEffect(() => {
    if (!open || !row) return;
    let live = true;
    setPhase("loading"); setPayload(null); setBorrower(null); setError(null);
    fetchPayload(row)
      .then((p) => {
        if (!live) return;
        if (!p?.borrower) throw new Error("no borrower");
        setPayload(p); setPhase("confirm");
      })
      .catch(() => {
        if (!live) return;
        setError("Couldn't pull this file from Arive. If Ops was just updated, give it a minute and try again.");
        setPhase("error");
      });
    return () => { live = false; };
  }, [open, row]); // eslint-disable-line react-hooks/exhaustive-deps

  const shareUrl = borrower?.share_token ? `${WEB_ORIGIN}?share=${borrower.share_token}` : "https://blueprint.realstack.app";
  const clientEmail = (payload?.borrower?.email || borrower?.email || "").trim();
  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail), [clientEmail]);
  const gmailPath = gmailSendAvailable();

  if (!open || !row) return null;

  const busy = phase === "creating" || phase === "sending";

  const handleCreate = async () => {
    setPhase("creating"); setError(null);
    try {
      const { borrower: b } = await createClient(payload);
      setBorrower(b);
      setMessage([
        `Hi ${firstName || "there"} — I've set up a personalized mortgage Blueprint for you. Feel free to explore it: adjust the numbers, compare scenarios, and see what your payment really looks like. You can also download the app to keep it on your phone.`,
        "",
        `— ${loInfo.loanOfficer || "Your loan officer"}`,
      ].join("\n"));
      setPhase("email");
    } catch (e) {
      setError(e?.message || "Import failed — try again.");
      setPhase("confirm");
    }
  };

  const subject = "Your personalized mortgage Blueprint";

  const handleSend = async () => {
    if (!emailValid) return;
    // Fallback: no Gmail send here (native app / no client id) → mail app.
    if (!gmailPath) {
      const body = `${message}\n\nOpen your Blueprint: ${shareUrl}`;
      const bcc = loInfo.loEmail ? `&bcc=${encodeURIComponent(loInfo.loEmail)}` : "";
      window.open(`mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}${bcc}`, "_self");
      onClose({ borrowerId: borrower?.id });
      return;
    }
    setPhase("sending"); setError(null);
    try {
      const sendPayload = {
        to: clientEmail,
        subject,
        htmlBody: buildBlueprintEmailHtml({ message, shareUrl, loInfo }),
        fromName: loInfo.loanOfficer || undefined,
        bcc: loInfo.loEmail || undefined,
        log: {
          borrowerEmail: clientEmail,
          borrowerName: payload?.borrower?.name || "",
          scenarioName: "Blueprint invite (Arive import)",
          loEmail: loInfo.loEmail || "",
          sentVia: "gmail",
        },
      };
      const post = (token) => fetch(`${API_BASE}/api/gmail?action=send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(sendPayload),
      });
      let token = await ensureGmailToken();
      let res = await post(token);
      if (res.status === 401) {
        // Stored token expired — silent re-auth once, then retry once.
        clearGmailToken();
        token = await requestGmailToken({ silent: true }).catch(() => requestGmailToken());
        res = await post(token);
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
      setTimeout(() => onClose({ borrowerId: borrower?.id }), 1500);
    } catch (e) {
      setError(e?.message || "Something went wrong sending the email.");
      setPhase("email");
    }
  };

  const close = () => { if (!busy) onClose(borrower?.id ? { borrowerId: borrower.id } : null); };

  const microLabel = {
    fontFamily: MONO, fontSize: 9.5, fontWeight: 600, letterSpacing: 1,
    textTransform: "uppercase", color: T.textTertiary,
  };
  const inputStyle = {
    width: "100%", boxSizing: "border-box", background: T.inputBg, borderRadius: 12,
    border: `1px solid ${T.inputBorder}`, padding: "11px 14px", color: T.text,
    fontSize: 14, outline: "none", fontFamily: FONT,
  };
  const primaryBtn = (enabled) => ({
    width: "100%", padding: 14, border: "none", borderRadius: 9999,
    background: enabled ? "linear-gradient(135deg, #3B6BF5, #2B4FCE)" : T.pillBg,
    color: enabled ? "#fff" : T.textTertiary, fontWeight: 700, fontSize: 15,
    cursor: enabled ? "pointer" : "default", fontFamily: FONT,
    boxShadow: enabled ? "0 0 20px rgba(59,107,245,0.3)" : "none",
  });
  const ghostBtn = {
    width: "100%", marginTop: 10, padding: 12, background: "transparent",
    border: `1px solid ${T.separator}`, borderRadius: 9999, color: T.textSecondary,
    fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FONT,
  };

  const detailRow = (label, value) => (value ? (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "6px 0", borderBottom: `1px solid ${T.separator}` }}>
      <span style={{ ...microLabel, width: 74, flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: FONT, fontSize: 13.5, color: T.text, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  ) : null);

  const pf = payload?.prefill || {};
  const price = pf.salesPrice || pf.refiHomeValue || null;
  const loanBits = [
    payload?.loan?.purpose || (pf.isRefi ? "Refinance" : "Purchase"),
    pf.loanType,
    pf.rate ? `${pf.rate}%` : null,
    pf.term ? `${pf.term} yr` : null,
    pf.downPct ? `${pf.downPct}% down` : null,
  ].filter(Boolean).join(" · ");
  const place = [pf.city, pf.propertyState, pf.propertyZip].filter(Boolean).join(", ");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1300, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={close}>
      <div style={{ background: T.card, borderRadius: "20px 20px 0 0", maxWidth: 500, width: "100%", maxHeight: "86vh", overflowY: "auto", padding: "20px 18px 30px" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: FONT, color: T.text, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="download" size={17} />
            {phase === "email" || phase === "sending" || phase === "sent" ? "Email the Blueprint" : "Import to Blueprint"}
          </div>
          <button onClick={close} aria-label="Close" style={{ background: T.pillBg, border: "none", borderRadius: 9999, width: 32, height: 32, cursor: busy ? "default" : "pointer", color: T.textSecondary, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="x" size={14} />
          </button>
        </div>

        {phase === "loading" && (
          <div style={{ padding: "28px 0", textAlign: "center", fontSize: 13, color: T.textSecondary, fontFamily: FONT }}>
            Pulling {row.borrower || "this file"} from Arive…
          </div>
        )}

        {phase === "error" && (
          <>
            <div style={{ fontSize: 13, color: T.red, fontWeight: 600, padding: "14px 0", fontFamily: FONT, lineHeight: 1.5 }}>{error}</div>
            <button onClick={() => onClose(null)} style={ghostBtn}>Close</button>
          </>
        )}

        {(phase === "confirm" || phase === "creating") && payload && (
          <>
            <div style={{ fontSize: 12.5, color: T.textTertiary, fontFamily: FONT, marginBottom: 12, lineHeight: 1.5 }}>
              This creates a Blueprint client with a scenario prefilled from the Arive file. Only the basics come over — no SSNs, birthdates, or asset details.
            </div>
            <div style={{ background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder}`, padding: "6px 14px 8px", marginBottom: 16 }}>
              {detailRow("Client", payload.borrower.name)}
              {detailRow("Email", payload.borrower.email || "— none on file —")}
              {detailRow("Phone", payload.borrower.phone)}
              {detailRow(pf.isRefi ? "Home value" : "Price", price ? fmtMoney(price) : null)}
              {detailRow("Loan", loanBits)}
              {detailRow("Property", place)}
              {row.class === "lead" ? detailRow("Status", "Lead") : null}
            </div>
            {error && <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, fontFamily: FONT }}>{error}</div>}
            <button onClick={handleCreate} disabled={phase === "creating"} style={primaryBtn(phase !== "creating")}>
              {phase === "creating" ? "Creating…" : "Create Blueprint"}
            </button>
            <button onClick={() => onClose(null)} style={ghostBtn}>Cancel</button>
          </>
        )}

        {(phase === "email" || phase === "sending") && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: `${T.green || "#12a150"}14`, border: `1px solid ${T.green || "#12a150"}30`, borderRadius: 12, marginBottom: 14 }}>
              <Icon name="check" size={15} style={{ color: T.green || "#12a150", flexShrink: 0 }} />
              <span style={{ fontFamily: FONT, fontSize: 13, color: T.text, fontWeight: 600 }}>
                Blueprint created for {payload?.borrower?.name || row.borrower}
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT, color: T.text, marginBottom: 4 }}>
              Email it to {firstName || "the client"}?
            </div>
            <div style={{ fontSize: 12.5, color: T.textTertiary, fontFamily: FONT, marginBottom: 12, lineHeight: 1.5 }}>
              {emailValid
                ? `A branded email with your message and their personal Blueprint link goes to ${clientEmail}. Nothing sends until you hit the button.`
                : "This client has no email on the Arive file — open their Blueprint and add one, then send the link from the share menu."}
            </div>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5, minHeight: 130, marginBottom: 10 }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontFamily: FONT, color: T.accent, background: `${T.accent}14`, border: `1px solid ${T.accent}30`, borderRadius: 9999, padding: "5px 12px" }}>
                <Icon name="link" size={11} /> Their Blueprint link is included
              </div>
              {loInfo.loEmail ? (
                <div style={{ fontSize: 11.5, fontFamily: FONT, color: T.textTertiary, background: T.pillBg, borderRadius: 9999, padding: "5px 12px" }}>
                  BCC: {loInfo.loEmail}
                </div>
              ) : null}
            </div>
            {error && <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, fontFamily: FONT, lineHeight: 1.5 }}>{error}</div>}
            <button onClick={handleSend} disabled={!emailValid || phase === "sending"} style={primaryBtn(emailValid && phase !== "sending")}>
              {phase === "sending" ? "Sending…"
                : gmailPath ? (getStoredGmailToken() ? "Send email" : "Connect Gmail & send") : "Open in my mail app"}
            </button>
            <button onClick={() => onClose({ borrowerId: borrower?.id })} style={ghostBtn}>Skip for now</button>
          </>
        )}

        {phase === "sent" && (
          <div style={{ textAlign: "center", padding: "20px 0", fontSize: 15, fontWeight: 700, color: T.green || "#12a150", fontFamily: FONT }}>
            Sent — {firstName || "the client"} has their Blueprint
          </div>
        )}
      </div>
    </div>
  );
}
