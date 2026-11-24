import { FONT, MONO } from "../lib/fonts.js";
import React from "react";
import Icon from "../Icon";
import { logTeamTap } from "../lib/teamTap.js";

/**
 * TeamContact — the borrower's loan officer and agent, kept in reach after the
 * top co-brand card scrolls away (LLM council 2026-11-21, "introduce, then
 * follow"):
 *
 *   TeamSidebarBlock — pinned to the bottom of the desktop sidebar
 *   TeamRail         — the same two faces in the collapsed 56px rail
 *   TeamStrip        — phones: a slim fixed row above MobileTabBar that opens
 *                      the contact sheet
 *   TeamSheetBody    — the sheet's contents (labelled roles, Call/Text/Email)
 *
 * Phones have no visible sidebar, so the strip is what reaches a borrower who
 * opened a texted link. Everything takes the same `people` list from
 * teamPeople(), so the three surfaces can't disagree.
 */

// 8 + 30 + 8, plus the 1px top border.
export const TEAM_STRIP_HEIGHT = 47;

/** [{ key, role, name, micro, short, phone, email, photo, color }] — LO first. */
export function teamPeople(loInfo, agent, T) {
  const lo = loInfo || {};
  const out = [];
  if ((lo.loanOfficer || "").trim()) {
    out.push({
      key: "lo", role: "Your loan officer", name: lo.loanOfficer.trim(),
      micro: [lo.loNmls ? `NMLS #${lo.loNmls}` : "", lo.companyName || ""].filter(Boolean).join(" · "),
      short: lo.loNmls ? `NMLS #${lo.loNmls}` : (lo.companyName || ""),
      phone: lo.loPhone || "", email: lo.loEmail || "", photo: lo.loPhoto || "", color: T.accent || T.blue,
    });
  }
  if (agent && (agent.name || "").trim()) {
    out.push({
      key: "agent", role: "Your agent", name: agent.name.trim(),
      micro: [agent.brokerage || "", agent.dre ? `DRE #${agent.dre}` : ""].filter(Boolean).join(" · "),
      short: agent.brokerage || (agent.dre ? `DRE #${agent.dre}` : ""),
      phone: agent.phone || "", email: agent.email || "", photo: agent.photo || "", color: T.purple,
    });
  }
  return out;
}

const initials = (name) => (name || "").split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 3).toUpperCase();
const digits = (phone) => (phone || "").replace(/[^\d+]/g, "");

function Face({ p, size = 32, ring }) {
  const base = { width: size, height: size, borderRadius: "50%", flexShrink: 0, boxShadow: ring ? `0 0 0 2px ${ring}` : "none" };
  if (p.photo) return <img src={p.photo} alt="" style={{ ...base, objectFit: "cover" }} />;
  return (
    <span aria-hidden="true" style={{ ...base, background: `${p.color}22`, color: p.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.36), fontWeight: 700, fontFamily: FONT }}>
      {initials(p.name)}
    </span>
  );
}

function Disc({ href, icon, label, color, size = 28, onClick }) {
  return (
    <a href={href} onClick={onClick} aria-label={label} title={label} style={{ width: size, height: size, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: `${color}15`, color, textDecoration: "none", flexShrink: 0 }}>
      <Icon name={icon} size={Math.round(size / 2)} />
    </a>
  );
}

const overline = (T) => ({ fontFamily: MONO, fontSize: 9.5, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: T.textTertiary });
const microStyle = (T) => ({ fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textTertiary, marginTop: 1, overflowWrap: "anywhere" });

export function TeamSidebarBlock({ T, people }) {
  if (!people.length) return null;
  return (
    <div style={{ padding: "10px 12px", borderTop: `1px solid ${T.separator}`, display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={overline(T)}>Your team</div>
      {people.map(p => (
        <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Face p={p} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text, fontFamily: FONT, letterSpacing: "-0.01em", lineHeight: 1.2, overflowWrap: "anywhere" }}>{p.name}</div>
            {p.short && <div style={microStyle(T)}>{p.short}</div>}
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {p.phone && <Disc href={`tel:${digits(p.phone)}`} icon="phone" label={`Call ${p.name}`} color={T.green} onClick={() => logTeamTap("sidebar", "call", p.key)} />}
            {p.email && <Disc href={`mailto:${p.email}`} icon="mail" label={`Email ${p.name}`} color={T.blue} onClick={() => logTeamTap("sidebar", "email", p.key)} />}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TeamRail({ T, people }) {
  if (!people.length) return null;
  return (
    <div style={{ padding: "8px 4px", borderTop: `1px solid ${T.separator}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      {people.map(p => {
        const href = p.phone ? `tel:${digits(p.phone)}` : p.email ? `mailto:${p.email}` : null;
        const tip = `${p.role}: ${p.name}${p.short ? ` · ${p.short}` : ""}`;
        return href
          ? <a key={p.key} href={href} onClick={() => logTeamTap("rail", p.phone ? "call" : "email", p.key)} title={tip} aria-label={tip} style={{ display: "flex", textDecoration: "none" }}><Face p={p} size={30} /></a>
          : <span key={p.key} title={tip} style={{ display: "flex" }}><Face p={p} size={30} /></span>;
      })}
    </div>
  );
}

export function TeamStrip({ T, people, bottom, onOpen }) {
  if (!people.length) return null;
  const ground = T.sideBg || T.card;
  return (
    <button type="button" onClick={() => { logTeamTap("strip", "open"); onOpen(); }} aria-haspopup="dialog" aria-label={`Contact ${people.map(p => p.name).join(" and ")}`}
      style={{
        position: "fixed", left: 0, right: 0, bottom, zIndex: 99, height: TEAM_STRIP_HEIGHT, boxSizing: "border-box",
        display: "block", width: "100%", padding: 0, margin: 0, border: "none", borderTop: `1px solid ${T.cardBorder}`,
        background: ground, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        cursor: "pointer", textAlign: "left", fontFamily: FONT, WebkitTapHighlightColor: "transparent",
      }}>
      <span style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 auto", padding: "0 14px", height: "100%", boxSizing: "border-box" }}>
        <span style={{ display: "flex", flexShrink: 0 }}>
          {people.map((p, i) => <span key={p.key} style={{ display: "flex", marginLeft: i ? -9 : 0 }}><Face p={p} size={30} ring={T.card} /></span>)}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.text, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {people.map(p => p.name).join(" & ")}
          </span>
          <span style={{ display: "block", fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textTertiary, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {people.map(p => p.short).filter(Boolean).join(" · ")}
          </span>
        </span>
        <span style={{ flexShrink: 0, background: T.banner || T.blue, color: "#fff", borderRadius: 9999, padding: "7px 14px", fontSize: 12, fontWeight: 600 }}>Contact</span>
      </span>
    </button>
  );
}

function SheetPill({ href, icon, label, color, onClick }) {
  return (
    <a href={href} onClick={onClick} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, boxSizing: "border-box", background: `${color}15`, color, textDecoration: "none", borderRadius: 9999, fontFamily: FONT, fontSize: 14, fontWeight: 600, padding: "0 12px" }}>
      <Icon name={icon} size={16} /> {label}
    </a>
  );
}

export function TeamSheetBody({ T, people }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingBottom: 8 }}>
      {people.map((p, i) => (
        <div key={p.key} style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: i ? 18 : 0, borderTop: i ? `1px solid ${T.separator}` : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Face p={p} size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={overline(T)}>{p.role}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: T.text, fontFamily: FONT, letterSpacing: "-0.01em", marginTop: 2, overflowWrap: "anywhere" }}>{p.name}</div>
              {p.micro && <div style={{ ...microStyle(T), fontSize: 10, marginTop: 3 }}>{p.micro}</div>}
            </div>
          </div>
          {(p.phone || p.email) && (
            <div style={{ display: "flex", gap: 8 }}>
              {p.phone && <SheetPill href={`tel:${digits(p.phone)}`} icon="phone" label="Call" color={T.green} onClick={() => logTeamTap("sheet", "call", p.key)} />}
              {p.phone && <SheetPill href={`sms:${digits(p.phone)}`} icon="smartphone" label="Text" color={T.purple} onClick={() => logTeamTap("sheet", "text", p.key)} />}
              {p.email && <SheetPill href={`mailto:${p.email}`} icon="mail" label="Email" color={T.blue} onClick={() => logTeamTap("sheet", "email", p.key)} />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
