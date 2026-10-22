import { FONT, MONO } from "../lib/fonts.js";
/**
 * ShellAccount — "who am I signed in as" for the RealStack shell (2026-10-22).
 *
 * Blueprint shows the account in its own header; PricePoint and Markets had
 * nothing, so you couldn't tell whose XP/streak you were playing on. This is
 * the shell-level answer, rendered by MortgageBlueprint for the non-Blueprint
 * modes:
 *   variant "row"       — desktop sidebar footer (avatar + name + email)
 *   variant "collapsed" — desktop sidebar footer when the sidebar is 56px
 *   variant "avatar"    — mobile PricePoint/Markets header, right side
 *
 * The identity is the Supabase session — the same one /api/pp-player keys
 * PricePoint progress to. The menu is position:fixed because the sidebar
 * clips overflow.
 */

import { useState, useRef } from 'react';
import Icon from '../Icon';

function initialOf(user) {
  return ((user?.name || user?.email || '?').trim()[0] || '?').toUpperCase();
}

function Avatar({ user, size, T }) {
  const [broken, setBroken] = useState(false);
  if (!user) {
    return (
      <span style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: T.inputBg, color: T.textTertiary, border: `1px dashed ${T.separator}` }}>
        <Icon name="user" size={Math.round(size * 0.5)} />
      </span>
    );
  }
  if (user.picture && !broken) {
    return <img src={user.picture} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, objectFit: "cover" }} />;
  }
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #3B6BF5, #2B4FCE)", color: "#fff", fontSize: Math.round(size * 0.43), fontWeight: 700, fontFamily: FONT }}>
      {initialOf(user)}
    </span>
  );
}

export default function ShellAccount({ variant = "row", user, appMode, onSignIn, onSignOut, T }) {
  const [menu, setMenu] = useState(null); // { top|bottom, left|right } for the fixed menu
  const btnRef = useRef(null);

  const toggle = () => {
    if (menu) { setMenu(null); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    if (variant === "avatar") setMenu({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    else if (variant === "collapsed") setMenu({ bottom: window.innerHeight - r.bottom, left: r.right + 8 });
    else setMenu({ bottom: window.innerHeight - r.top + 6, left: r.left });
  };

  // The PricePoint board nickname lives in PricePoint's own localStorage.
  let boardName = "";
  if (menu && appMode === "pricepoint") { try { boardName = localStorage.getItem("pp-display-name") || ""; } catch { /* noop */ } }

  const label = user ? (user.name || user.email) : "Guest";
  const sub = user ? (user.name ? user.email : "Signed in") : "Not signed in";
  const saveLine = appMode === "pricepoint"
    ? (user ? "Your XP, wins and streak save to this account." : "Your XP and streak are saved on this device only.")
    : (user ? "Signed in across Blueprint, PricePoint and Markets." : "Sign in to keep your work across devices.");

  const trigger = variant === "row" ? (
    <button ref={btnRef} type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={!!menu} title={user?.email || "Not signed in"}
      className="bp-sidebar-item"
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: FONT }}>
      <Avatar user={user} size={30} T={T} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
        <span style={{ display: "block", fontSize: 11, color: T.textTertiary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</span>
      </span>
      <Icon name="chevron-up" size={14} style={{ color: T.textTertiary, flexShrink: 0 }} />
    </button>
  ) : (
    <button ref={btnRef} type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={!!menu}
      aria-label={user ? `Account: ${user.email}` : "Account: not signed in"} title={user?.email || "Not signed in"}
      style={{ background: "transparent", border: "none", padding: variant === "avatar" ? 2 : 4, cursor: "pointer", display: "flex", borderRadius: "50%", flexShrink: 0 }}>
      <Avatar user={user} size={28} T={T} />
    </button>
  );

  return (
    <>
      {trigger}
      {menu && (<>
        <div onClick={() => setMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 1001 }} />
        <div role="menu" style={{ position: "fixed", ...menu, zIndex: 1002, width: 260, background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, boxShadow: T.cardShadow || "0 12px 32px rgba(15,23,41,.22)", padding: 6, fontFamily: FONT }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px 10px" }}>
            <Avatar user={user} size={36} T={T} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: T.textTertiary }}>{user ? "Signed in as" : "Playing as guest"}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user ? (user.name || user.email) : "Not signed in"}</div>
              {user?.name && <div style={{ fontSize: 11.5, color: T.textSecondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>}
            </div>
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.45, color: T.textSecondary, padding: "0 8px 8px" }}>
            {saveLine}
            {boardName && <> On the Board as <strong style={{ color: T.text }}>{boardName}</strong>.</>}
          </div>
          {(user ? onSignOut : onSignIn) && <div style={{ height: 1, background: T.separator, margin: "2px 6px 4px" }} />}
          {user && onSignOut && (
            <button role="menuitem" type="button" onClick={() => { setMenu(null); onSignOut(); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 8px", fontSize: 13, fontWeight: 500, color: T.text, background: "transparent", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: FONT }}>Sign out</button>
          )}
          {!user && onSignIn && (
            <button role="menuitem" type="button" onClick={() => { setMenu(null); onSignIn(); }}
              style={{ display: "block", width: "100%", padding: "9px 12px", fontSize: 13, fontWeight: 700, color: "#fff", background: "#3B6BF5", border: "none", borderRadius: 9999, cursor: "pointer", fontFamily: FONT }}>Sign in</button>
          )}
        </div>
      </>)}
    </>
  );
}
