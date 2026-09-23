import { FONT } from "../lib/fonts.js";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  presenceRoot, controlFor, keyFor, findByKey, outlineBoxFor, initialsOf, presenceColor,
} from "../lib/fieldPresence";

/**
 * LivePresenceLayer — Ops-style "who's where" for live co-editing.
 *
 *  - Broadcasts the field I'm in (focus) or last clicked (buttons/toggles)
 *    via onLocalField(key, active).
 *  - Draws each other person's field as an outline + initials tag, solid
 *    while they're in it, dashed/faded for the last field they touched.
 *
 * Positions are re-measured every frame while markers exist (scroll, layout
 * shifts, the phone keyboard) — markers are few, so it's cheap. Markers sit
 * under the fixed header (z-index) so they never cover it.
 */
export default function LivePresenceLayer({ users = [], tab, onLocalField }) {
  const [boxes, setBoxes] = useState([]);
  const elsRef = useRef(new Map());   // email → element being outlined
  const cbRef = useRef(onLocalField);
  useLayoutEffect(() => { cbRef.current = onLocalField; });

  // ── Broadcast my field ─────────────────────────────────────────────────
  useEffect(() => {
    let lastKey = null;
    const send = (target, active) => {
      const root = presenceRoot();
      const el = controlFor(target, root);
      if (!el) return;
      const key = keyFor(el, root);
      if (!key) return;
      lastKey = key;
      cbRef.current?.(key, active);
    };
    const onFocusIn = (e) => send(e.target, true);
    const onFocusOut = () => {
      // Keep the key (it becomes "last touched"); just mark not-active —
      // unless focus moved straight into another control (focusin follows).
      setTimeout(() => {
        const root = presenceRoot();
        if (!controlFor(document.activeElement, root) && lastKey) cbRef.current?.(lastKey, false);
      }, 0);
    };
    // Safari doesn't focus buttons on click — catch toggles/buttons here.
    const onPointerDown = (e) => {
      const root = presenceRoot();
      const el = controlFor(e.target, root);
      if (el && el.matches('button,[role="button"],[role="switch"],[role="tab"],[role="checkbox"]')) send(el, false);
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, []);

  // ── Draw theirs ────────────────────────────────────────────────────────
  const targets = users.filter(u => u.field && u.tab === tab);
  const sig = targets.map(u => `${u.email}|${u.field}|${u.field_active ? 1 : 0}`).join(',');

  useEffect(() => {
    if (!targets.length) return;
    let raf = 0;
    let lastResolve = 0;
    let prevStr = '';
    const frame = (t) => {
      const root = presenceRoot();
      // Re-resolve which element each key names ~2x/s (sections expand,
      // lists re-render); measure positions every frame.
      if (t - lastResolve > 500) {
        lastResolve = t;
        const m = new Map();
        for (const u of targets) {
          const el = findByKey(root, u.field);
          if (el) m.set(u.email, outlineBoxFor(el));
        }
        elsRef.current = m;
      }
      const headerH = parseFloat(document.documentElement.style.getPropertyValue('--bp-header-h')) || 0;
      const next = [];
      for (const u of targets) {
        const el = elsRef.current.get(u.email);
        if (!el || !el.isConnected) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.bottom < headerH || r.top > window.innerHeight) continue;
        next.push({
          email: u.email, top: r.top, left: r.left, width: r.width, height: r.height,
          active: !!u.field_active, color: presenceColor(u.email),
          initials: initialsOf(u.name, u.email), name: u.name || u.email,
          clipTop: Math.max(0, headerH - r.top),
        });
      }
      const str = JSON.stringify(next);
      if (str !== prevStr) { prevStr = str; setBoxes(next); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, tab]);

  // Nobody to draw on this tab → nothing, even if a stale frame is in state
  const shown = targets.length ? boxes : [];
  if (!shown.length) return null;
  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 40 }}>
      {shown.map(b => (
        <div key={b.email} style={{
          position: 'fixed', top: b.top - 3, left: b.left - 3, width: b.width + 6, height: b.height + 6,
          borderRadius: 14, boxSizing: 'border-box',
          border: `2px ${b.active ? 'solid' : 'dashed'} ${b.color}`,
          opacity: b.active ? 1 : 0.6,
          clipPath: b.clipTop ? `inset(${b.clipTop + 3}px 0 0 0)` : undefined,
          transition: 'opacity .2s',
        }}>
          <div title={b.name} style={{
            position: 'absolute', top: -10, right: 10, height: 18, minWidth: 18, padding: '0 6px',
            borderRadius: 9999, background: b.color, color: '#fff', boxSizing: 'border-box',
            fontSize: 10, fontWeight: 700, fontFamily: FONT, letterSpacing: '0.04em',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(10,17,32,0.25)',
          }}>{b.initials}</div>
        </div>
      ))}
    </div>
  );
}
