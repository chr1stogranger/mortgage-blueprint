import { FONT } from "../lib/fonts.js";
import React, { useEffect, useState } from "react";
import Icon from "../Icon";

/**
 * MobileTabBar — the ONE bottom tab bar for the RealStack shell on phones.
 *
 * Lifted from PricePoint's bar (2026-09-06, council verdict: "bar = pages").
 * Each product mounts its own item list under its own appMode, so two bars
 * can never render in the same shell at once.
 *
 *   <MobileTabBar T={T} items={[{ id, label, icon }]} activeId="overview" onSelect={fn} />
 *
 * Hides itself while a text input has focus: Blueprint's Overview is
 * form-heavy and a fixed bar rides the Android keyboard / jitters on iOS.
 */

// 10 top + 20 icon + 2 gap + 12 label + 1 + 4 dot + 8 bottom ≈ 57, plus the
// 1px border. Callers use this to size padding and stack pills above the bar.
export const MOBILE_TAB_BAR_HEIGHT = 58;

const isTextField = (el) => {
  if (!el || el === document.body) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const t = (el.getAttribute("type") || "text").toLowerCase();
    return !["checkbox", "radio", "range", "button", "submit", "reset", "file", "color"].includes(t);
  }
  return el.isContentEditable === true;
};

/** True while a text field has focus (with a short blur grace period). */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    let timer = null;
    const onFocusIn = (e) => { if (timer) { clearTimeout(timer); timer = null; } if (isTextField(e.target)) setOpen(true); };
    const onFocusOut = () => { timer = setTimeout(() => { if (!isTextField(document.activeElement)) setOpen(false); }, 120); };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => { document.removeEventListener("focusin", onFocusIn); document.removeEventListener("focusout", onFocusOut); if (timer) clearTimeout(timer); };
  }, []);
  return open;
}

export default function MobileTabBar({ items, activeId, onSelect, T, maxWidth = 480, hideOnKeyboard = true }) {
  const keyboardOpen = useKeyboardOpen();
  if (hideOnKeyboard && keyboardOpen) return null;
  const accent = T.accent || T.blue || "#3B6BF5";
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: T.sideBg || T.card, borderTop: `1px solid ${T.cardBorder}`,
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      <div role="tablist" style={{ display: "flex", maxWidth, margin: "0 auto", width: "100%" }}>
        {items.map((it) => {
          const active = it.id === activeId;
          return (
            <button key={it.id} role="tab" aria-selected={active} aria-label={it.label}
              onClick={() => onSelect && onSelect(it.id)}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 2, padding: "10px 0 8px", minHeight: 44, background: "none", border: "none", cursor: "pointer",
                color: active ? accent : T.textTertiary, transition: "color 0.2s", fontFamily: FONT,
                WebkitTapHighlightColor: "transparent",
              }}>
              <Icon name={it.icon} size={20} />
              <span style={{ fontSize: 10, fontWeight: 600, fontFamily: FONT, letterSpacing: 0.5 }}>{it.label}</span>
              <div style={{ width: 4, height: 4, borderRadius: 2, background: active ? accent : "transparent", marginTop: 1 }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
