import React from "react";
import Icon from "../Icon.jsx";
import { FONT, MONO } from "../lib/fonts.js";

// ── Listing banner (buydown-flyer QR → ?listing=<token>) ──
// Compact glass card at the top of the calculator: which home the numbers
// were prepared for, and who to call about it — the listing/buyer's agent and
// the loan officer. Mobile-first: most visitors scanned a flyer at an open
// house. Chrome, so glass (T.glass) is right; MONO only for the uppercase
// overline and license micro-labels.

const telHref = (p) => {
 const digits = String(p || "").replace(/[^0-9+]/g, "");
 return digits ? `tel:${digits}` : null;
};
const mailHref = (e) => (e && /@/.test(e) ? `mailto:${e}` : null);

function Pill({ href, icon, label, color }) {
 if (!href) return null;
 return (
  <a href={href} aria-label={label} style={{
   display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
   background: `${color}18`, color, textDecoration: "none",
   borderRadius: 9999, fontFamily: FONT, fontSize: 12, fontWeight: 600,
   padding: "6px 11px", minHeight: 30, flexShrink: 0, boxSizing: "border-box",
  }}>
   <Icon name={icon} size={13} />
   {label}
  </a>
 );
}

function Contact({ T, name, micro, phone, email, discColor }) {
 if (!name && !phone && !email) return null;
 const initials = String(name || "").split(/\s+/).filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
 return (
  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
   <div aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 16, background: `${discColor}1f`, color: discColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, fontFamily: FONT, flexShrink: 0 }}>
    {initials || <Icon name="user" size={14} />}
   </div>
   <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, fontFamily: FONT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name || "Contact"}</div>
    {/* Wraps instead of truncating: the license number is the part that
        matters and it sits at the end. */}
    {micro && <div style={{ fontSize: 9.5, color: T.textTertiary, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.08em", lineHeight: 1.4, marginTop: 2, overflowWrap: "anywhere" }}>{micro}</div>}
   </div>
   <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
    <Pill href={telHref(phone)} icon="phone" label="Call" color={T.green} />
    <Pill href={mailHref(email)} icon="mail" label="Email" color={T.blue} />
   </div>
  </div>
 );
}

export default function ListingBanner({ T, isDesktop, listing, fmt, onDismiss }) {
 if (!listing) return null;
 const street = listing.street || (listing.address || "").split(",")[0].trim();
 const where = [street, listing.city].filter(Boolean).join(", ") || "this home";
 const facts = [
  listing.price > 0 ? fmt(listing.price) : "",
  listing.beds > 0 ? `${listing.beds} bd` : "",
  listing.baths > 0 ? `${listing.baths} ba` : "",
  listing.sqft > 0 ? `${Number(listing.sqft).toLocaleString("en-US")} sq ft` : "",
 ].filter(Boolean).join(" · ");
 const re = listing.realtor || null;
 const lo = listing.lo || null;
 const caState = /^(CA|California)$/i.test(String(listing.state || ""));
 const reMicro = re ? [re.company, re.license ? `${caState ? "DRE" : "Lic"} #${re.license}` : ""].filter(Boolean).join(" · ") : "";
 const loMicro = lo ? [lo.company, lo.nmls ? `NMLS #${lo.nmls}` : ""].filter(Boolean).join(" · ") : "";
 const hasRe = !!(re && (re.name || re.phone || re.email));
 const hasLo = !!(lo && (lo.name || lo.phone || lo.email));
 const twoCol = isDesktop && hasRe && hasLo;
 return (
  <section aria-label="Listing scenario" style={{
   background: T.glass, border: `1px solid ${T.glassBorder}`,
   backdropFilter: "blur(20px) saturate(1.5)", WebkitBackdropFilter: "blur(20px) saturate(1.5)",
   borderRadius: 16, padding: isDesktop ? "14px 18px" : "12px 14px", boxShadow: T.glassShadow,
   margin: isDesktop ? "4px 0 14px" : "4px 0 10px", fontFamily: FONT,
  }}>
   <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
    <div style={{ width: 34, height: 34, borderRadius: 10, background: `${T.accent}1f`, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
     <Icon name="home" size={17} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
     <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 500, letterSpacing: "0.15em", textTransform: "uppercase", color: T.textTertiary, lineHeight: 1.2 }}>Prepared for</div>
     <div style={{ fontSize: 15.5, fontWeight: 700, color: T.text, letterSpacing: "-0.01em", lineHeight: 1.3, marginTop: 2 }}>{where}</div>
     {facts && <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{facts}</div>}
    </div>
    {onDismiss && (
     <button type="button" onClick={onDismiss} aria-label="Dismiss" style={{ background: "transparent", border: "none", color: T.textTertiary, cursor: "pointer", padding: 6, margin: "-4px -6px 0 0", borderRadius: 9999, display: "flex", flexShrink: 0 }}>
      <Icon name="x" size={16} />
     </button>
    )}
   </div>
   {(hasRe || hasLo) && (
    <div style={{ display: "grid", gridTemplateColumns: twoCol ? "1fr 1fr" : "1fr", gap: twoCol ? 18 : 10, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.separator}` }}>
     {hasRe && <Contact T={T} name={re.name} micro={reMicro} phone={re.phone} email={re.email} discColor={T.purple} />}
     {hasLo && <Contact T={T} name={lo.name} micro={loMicro} phone={lo.phone} email={lo.email} discColor={T.accent} />}
    </div>
   )}
   <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 10, lineHeight: 1.45 }}>
    Numbers are estimates, not a commitment to lend. Change anything below to see your own payment.
   </div>
  </section>
 );
}

// Non-blocking notice when the link is expired/unknown or the fetch failed.
export function ListingNotice({ T, onDismiss, reason = 'expired' }) {
 const msg = reason === 'unavailable'
  ? "Couldn't load this property link right now. Here's Blueprint with default numbers; refresh to try again."
  : "This property link has expired. Here's Blueprint with default numbers.";
 return (
  <div role="status" style={{
   display: "flex", alignItems: "center", gap: 10,
   background: T.glass, border: `1px solid ${T.glassBorder}`,
   backdropFilter: "blur(20px) saturate(1.5)", WebkitBackdropFilter: "blur(20px) saturate(1.5)",
   borderRadius: 14, padding: "10px 12px", boxShadow: T.glassShadow, margin: "4px 0 10px", fontFamily: FONT,
  }}>
   <span style={{ color: T.orange, display: "flex", flexShrink: 0 }}><Icon name="info" size={16} /></span>
   <span style={{ flex: 1, fontSize: 12.5, color: T.textSecondary, lineHeight: 1.45 }}>{msg}</span>
   <button type="button" onClick={onDismiss} aria-label="Dismiss" style={{ background: "transparent", border: "none", color: T.textTertiary, cursor: "pointer", padding: 4, borderRadius: 9999, display: "flex", flexShrink: 0 }}>
    <Icon name="x" size={15} />
   </button>
  </div>
 );
}
