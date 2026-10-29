// src/components/CompareSnapshot.jsx
//
// The Compare "payoff" card (Christo 2026-10-28): the comparison laid out as
// a 1200px card, a 600px newsletter column at 2x, so a plain screenshot is
// sharp in email. It's the first thing on the Compare tab (InlineSnapshot,
// scaled to the column; stacked into a phone layout when the column is too
// narrow to read a scaled card) and opens full screen for an exact capture
// (default export). Content comes from BlueprintCompare's buildSnapshot()
// — only the rows that differ per card, shared rows in one strip — so this
// file is layout only.

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FONT, MONO } from "../lib/fonts.js";
import { DARK, LIGHT } from "../lib/theme.js";

const CANVAS = 1200;
// Below this column width a scaled 1200px card gets too small to read, so
// the inline card switches to the stacked phone layout.
const FLUID_BELOW = 720;
const CHECK = <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3L12.5 5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const UP = <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 12.5V3.5M4 7.5l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

function SnapRing({ segs, size, sw, track, label, value, note, P, win, big }) {
  const r = (size - sw) / 2, circ = 2 * Math.PI * r;
  const live = segs.filter(s => s.v > 0.5), total = live.reduce((a, s) => a + s.v, 0);
  let off = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={sw} />
        {total > 0 && live.map((s, i) => {
          const len = s.v / total * circ;
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.c} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${Math.max(0.1, len - sw / 4.4)} ${circ}`} strokeDashoffset={-off} />;
          off += len;
          return el;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        <span style={{ fontFamily: MONO, fontSize: big ? 13 : 10, letterSpacing: "0.15em", textTransform: "uppercase", color: P.textTertiary, fontWeight: 600 }}>{label}</span>
        <b style={{ fontSize: big ? (size > 200 ? 46 : 38) : 30, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.05, color: win ? P.blue : P.text }}>{value}</b>
        <span style={{ fontSize: big ? 15 : 12, color: P.textTertiary, fontWeight: 600 }}>{note}</span>
      </div>
    </div>
  );
}

// The card itself. `fluid` = the stacked phone layout at the container's
// width; otherwise the fixed 1200px canvas (callers scale it).
export const SnapshotCard = React.forwardRef(function SnapshotCard({ data, dark, fluid }, ref) {
  const P = dark ? DARK : LIGHT;
  const line = dark ? "rgba(255,255,255,0.09)" : "rgba(16,27,46,0.10)";
  const track = dark ? "rgba(255,255,255,0.08)" : "rgba(16,27,46,0.08)";
  const gridLine = dark ? "rgba(110,144,255,0.08)" : "rgba(59,107,245,0.075)";
  const shadow = dark ? "0 1px 2px rgba(0,0,0,0.4), 0 22px 44px -20px rgba(0,0,0,0.7)" : "0 1px 2px rgba(16,27,46,0.05), 0 18px 40px -18px rgba(16,27,46,0.22)";
  const n = data.cards.length;
  // Only reserve the note and flag rows when some card uses them, so cards
  // don't carry empty bands; when one does, every card keeps the same track.
  const hasSlot = data.cards.some(c => c.note || c.status.length), hasFlag = data.cards.some(c => c.flag);
  const tracks = 3 + (hasSlot ? 1 : 0) + (hasFlag ? 1 : 0);
  const big = !fluid;
  const z = (desk, phone) => big ? desk : phone;

  return (
    <div ref={ref} style={{
      width: fluid ? "100%" : CANVAS, padding: z("56px 60px 44px", "22px 16px 18px"), borderRadius: z(32, 20), color: P.text, fontFamily: FONT,
      fontVariantNumeric: "tabular-nums", backgroundColor: P.bg, border: `1px solid ${line}`,
      backgroundImage: `linear-gradient(${gridLine} 1px, transparent 1px), linear-gradient(90deg, ${gridLine} 1px, transparent 1px)`, backgroundSize: z("30px 30px", "22px 22px"),
      display: "flex", flexDirection: "column", gap: z(34, 18) }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: z(14, 10) }}>
          <svg width={z(44, 32)} height={z(44, 32)} viewBox="0 0 44 44" aria-hidden="true">
            <defs><linearGradient id="snapMark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={LIGHT.blue} /><stop offset="1" stopColor={LIGHT.accentDeep} /></linearGradient></defs>
            <rect x="0.5" y="0.5" width="43" height="43" rx="12" fill="url(#snapMark)" />
            <path d="M11 21.5 22 12l11 9.5M14.5 19v13h15V19" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
            <path d="M19.5 32v-6h5v6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
          </svg>
          <div>
            <b style={{ display: "block", fontSize: z(23, 16), fontWeight: 800, letterSpacing: "-0.02em" }}>Mortgage Blueprint</b>
            <span style={{ display: "block", fontFamily: MONO, fontSize: z(11, 9), letterSpacing: "0.15em", color: P.textTertiary, fontWeight: 600, marginTop: 2 }}>POWERED BY REALSTACK</span>
          </div>
        </div>
        <span style={{ fontFamily: MONO, fontSize: z(13, 10), letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, color: P.blue, background: `${P.blue}1a`, border: `1px solid ${P.blue}40`, borderRadius: 9999, padding: z("8px 16px", "5px 10px"), whiteSpace: "nowrap" }}>{data.stamp}</span>
      </div>

      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: z(12, 8), alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: z(56, 28), lineHeight: 1.08, fontWeight: 800, letterSpacing: "-0.035em", textWrap: "balance", maxWidth: z("21ch", "none") }}>
          {data.headline[0]} <span style={{ color: P.blue }}>{data.headline[1]}</span>
        </h2>
        <p style={{ margin: 0, fontSize: z(23, 15), lineHeight: 1.4, color: P.textSecondary, maxWidth: "46ch", textWrap: "balance" }}>{data.sub}</p>
      </div>

      {data.budget && data.budget.length > 0 && (
        <div style={{ alignSelf: "center", display: "inline-flex", alignItems: "center", flexWrap: "wrap", justifyContent: "center", gap: z(14, 8), fontSize: z(19, 13.5), color: P.textSecondary, background: P.card, border: `1px solid ${line}`, borderRadius: z(9999, 16), padding: z("10px 22px", "8px 14px"), boxShadow: shadow, marginTop: z(-10, -4) }}>
          <span style={{ fontFamily: MONO, fontSize: z(12.5, 10), letterSpacing: "0.15em", textTransform: "uppercase", color: P.blue, fontWeight: 600 }}>Budget</span>
          {data.budget.map((b, i) => <React.Fragment key={i}>
            {i > 0 && <i style={{ width: 1, height: z(18, 14), background: line }} />}
            <span><b style={{ color: P.text, fontWeight: 700 }}>{b.v}</b> {b.l}</span>
          </React.Fragment>)}
        </div>
      )}

      {/* Canvas: cards share row tracks (subgrid) so ring, notes and rows line
          up. Phone: one card per row, same contents. */}
      <div style={big
        ? { display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, gridTemplateRows: `repeat(${tracks}, auto)`, columnGap: 22, paddingTop: 14 }
        : { display: "flex", flexDirection: "column", gap: 20, paddingTop: 10 }}>
        {data.cards.map((c, i) => (
          <article key={i} style={{ position: "relative", background: P.card, border: c.win ? `2px solid ${P.blue}` : `1px solid ${line}`, borderRadius: z(26, 18),
            boxShadow: c.win ? `0 0 0 ${z(6, 4)}px ${P.blue}1a, ${shadow}` : shadow, padding: z("30px 26px 26px", "22px 16px 14px"),
            ...(big ? { display: "grid", gridRow: `span ${tracks}`, gridTemplateRows: "subgrid", rowGap: 20, justifyItems: "center", alignContent: "start" }
              : { display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }) }}>
            {c.win && <span style={{ position: "absolute", top: z(-17, -13), left: "50%", transform: "translateX(-50%)", display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
              fontFamily: MONO, fontSize: z(13, 10.5), letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, color: "#fff",
              background: `linear-gradient(90deg, ${P.blue}, ${P.accentDeep})`, borderRadius: 9999, padding: z("8px 16px", "6px 12px"), boxShadow: `0 8px 18px -8px ${P.accentDeep}cc` }}>{CHECK}{c.win}</span>}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: z(6, 4), textAlign: "center" }}>
              <span style={{ width: z(34, 28), height: z(34, 28), borderRadius: z(11, 9), background: `${P.blue}1f`, color: P.blue, font: `800 ${z(17, 14)}px ${FONT}`, display: "grid", placeItems: "center" }}>{c.letter}</span>
              <b style={{ fontSize: z(28, 21), fontWeight: 800, letterSpacing: "-0.02em" }}>{c.name}</b>
              {c.sub && <small style={{ fontSize: z(16, 13), color: P.textTertiary }}>{c.sub}</small>}
            </div>
            <SnapRing segs={c.segs} size={big ? (n > 3 ? 190 : 230) : 168} sw={big ? 22 : 17} track={track} label={c.ringLabel} value={c.ringValue} note={c.ringNote} P={P} win={!!c.win} big={big} />
            {(big ? hasSlot : (c.note || c.status.length > 0)) && <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              {c.note && <div style={{ fontSize: z(15.5, 13), fontWeight: 600, color: P.orange, textAlign: "center" }}>{c.note}</div>}
              {c.status.length > 0 && <div style={{ display: "flex", gap: 7, justifyContent: "center", flexWrap: "wrap" }}>
                {c.status.map((s, j) => <span key={j} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: z(14, 12.5), fontWeight: 600, borderRadius: 9999, padding: z("5px 11px", "4px 10px"), whiteSpace: "nowrap",
                  color: s.ok ? P.green : P.orange, background: s.ok ? `${P.green}1f` : `${P.orange}21` }}>{s.ok ? CHECK : UP}{s.text}</span>)}
              </div>}
            </div>}
            <div style={{ width: "100%", display: "flex", flexDirection: "column", borderTop: `1px solid ${line}` }}>
              {c.rows.map((r, j) => (
                <div key={j} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: r.tone === "strong" ? z("14px 2px 12px", "11px 2px 4px") : z("12px 2px", "9px 2px"), fontSize: z(18.5, 14.5), color: r.tone === "strong" ? P.text : P.textSecondary, fontWeight: r.tone === "strong" ? 600 : 400, borderTop: j ? `1px solid ${line}` : "none" }}>
                  <span>{r.label}</span>
                  <b style={{ fontWeight: 700, fontSize: r.tone === "strong" ? z(21, 16) : undefined, color: r.tone === "green" ? P.green : r.tone === "blue" ? P.blue : r.tone === "muted" ? P.textTertiary : P.text }}>{r.value}</b>
                </div>
              ))}
            </div>
            {(big ? hasFlag : !!c.flag) && <div style={{ fontSize: z(14.5, 12.5), fontWeight: 600, color: P.orange, textAlign: "center" }}>{c.flag}</div>}
          </article>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: z("8px 26px", "6px 14px"), fontSize: z(16, 12), color: P.textSecondary, marginTop: z(-12, -4) }}>
        {data.legend.map(l => <span key={l.l} style={{ display: "inline-flex", alignItems: "center", gap: z(8, 5) }}><i style={{ width: z(11, 8), height: z(11, 8), borderRadius: 6, background: l.c, display: "inline-block" }} />{l.l}</span>)}
      </div>

      {data.same.length > 0 && (
        <div style={{ background: P.card, border: `1px solid ${line}`, borderRadius: z(22, 16), padding: z("18px 22px", "14px 14px"), display: "flex", flexDirection: big ? "row" : "column", alignItems: big ? "center" : "stretch", gap: z(22, 10), boxShadow: shadow }}>
          <div style={{ fontFamily: MONO, fontSize: z(12.5, 10), letterSpacing: "0.15em", textTransform: "uppercase", color: P.textTertiary, fontWeight: 600, lineHeight: 1.35, width: big ? 92 : "auto", flexShrink: 0 }}>Same for all {n === 2 ? "two" : n === 3 ? "three" : n === 4 ? "four" : n}</div>
          <div style={big ? { display: "flex", flex: 1, justifyContent: "space-between" } : { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 12px" }}>
            {data.same.map((s, i) => (
              <div key={s.l} style={{ display: "flex", flexDirection: "column", gap: 3, padding: big ? "0 16px" : 0, borderLeft: big && i ? `1px solid ${line}` : "none" }}>
                <span style={{ fontSize: z(14.5, 11.5), color: P.textTertiary }}>{s.l}</span>
                <b style={{ fontSize: z(20, 15), fontWeight: 700, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{s.v}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.take && (
        <div style={{ borderRadius: z(22, 16), padding: z("22px 30px", "14px 16px"), background: `linear-gradient(90deg, ${P.blue}, ${P.accentDeep})`, color: "#fff", fontSize: z(23, 15), lineHeight: 1.4, fontWeight: 500, textAlign: "center", textWrap: "balance", boxShadow: `0 14px 30px -14px ${P.accentDeep}bf` }}>
          {data.take.map((p, i) => <span key={i} style={p.b || p.c ? { fontWeight: 800 } : null}>{p.t}</span>)}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: big ? "row" : "column", justifyContent: "space-between", alignItems: big ? "flex-end" : "flex-start", gap: z(30, 8) }}>
        <p style={{ margin: 0, fontSize: z(13, 10.5), lineHeight: 1.5, color: P.textTertiary, maxWidth: "80ch" }}>{data.disclosure} Chris Granger, NMLS #952015 · Xpert Home Lending, Inc. NMLS #2179191.</p>
        <span style={{ fontFamily: MONO, fontSize: z(13, 10.5), letterSpacing: "0.08em", color: P.textSecondary, fontWeight: 600, whiteSpace: "nowrap" }}>blueprint.realstack.app</span>
      </div>
    </div>
  );
});

// Inline at the top of Compare: the 1200px card scaled to the column, or the
// stacked phone layout when the column is narrow.
export function InlineSnapshot({ data, dark }) {
  const boxRef = useRef(null), cardRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const measure = () => setBox({ w: boxRef.current ? boxRef.current.clientWidth : 0, h: cardRef.current ? cardRef.current.offsetHeight : 0 });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    if (boxRef.current) ro.observe(boxRef.current);
    if (cardRef.current) ro.observe(cardRef.current);
    return () => ro.disconnect();
  }, [data, dark]);
  const fluid = box.w > 0 && box.w < FLUID_BELOW;
  const scale = box.w ? Math.min(1, box.w / CANVAS) : 1;
  return (
    <div ref={boxRef} style={{ width: "100%", height: fluid || !box.h ? "auto" : box.h * scale, overflow: "hidden" }}>
      {fluid
        ? <SnapshotCard ref={cardRef} data={data} dark={dark} fluid />
        : <div style={{ width: CANVAS, transform: `scale(${scale})`, transformOrigin: "top left" }}><SnapshotCard ref={cardRef} data={data} dark={dark} /></div>}
    </div>
  );
}

// Full screen: the exact 1200px card for a clean screenshot.
export default function CompareSnapshot({ data, onClose, pairControl, dark: startDark = false }) {
  const [dark, setDark] = useState(startDark);
  const [scale, setScale] = useState(1);
  const ref = useRef(null);
  useLayoutEffect(() => {
    const fit = () => {
      const h = ref.current ? ref.current.offsetHeight : 1400;
      setScale(Math.min(1, (window.innerWidth - 32) / CANVAS, (window.innerHeight - 92) / h));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [data, dark]);
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const ctl = on => ({ border: "none", background: on ? "#fff" : "transparent", color: on ? LIGHT.blue : "rgba(255,255,255,0.85)", font: `600 12.5px ${FONT}`, padding: "6px 13px", borderRadius: 9999, cursor: "pointer" });

  return (
    <div role="dialog" aria-modal="true" aria-label="Compare screenshot view"
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: dark ? "#050a14" : "#dfe7f0", display: "flex", flexDirection: "column", alignItems: "center", overflow: "auto",
        paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)", paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}>
      <div style={{ width: "100%", maxWidth: CANVAS, display: "flex", alignItems: "center", gap: 10, padding: "12px 0", flexWrap: "wrap", fontFamily: FONT }}>
        <span style={{ display: "inline-flex", gap: 3, padding: 3, borderRadius: 9999, background: "rgba(16,27,46,0.55)" }}>
          <button type="button" onClick={() => setDark(false)} aria-pressed={!dark} style={ctl(!dark)}>Light</button>
          <button type="button" onClick={() => setDark(true)} aria-pressed={dark} style={ctl(dark)}>Dark</button>
        </span>
        {pairControl && (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: dark ? "rgba(255,255,255,0.85)" : "#344054" }}>
            Takeaway compares
            <select value={pairControl.value} onChange={e => pairControl.onChange(e.target.value)}
              style={{ font: `600 12.5px ${FONT}`, color: "#101828", background: "#fff", border: "1px solid rgba(16,27,46,0.15)", borderRadius: 9999, padding: "5px 10px", cursor: "pointer" }}>
              <option value="">{pairControl.allLabel}</option>
              {pairControl.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        )}
        <span style={{ fontSize: 12.5, color: dark ? "rgba(255,255,255,0.7)" : "#475467", flex: 1, minWidth: 160 }}>Screenshot the card. At full size it's 1200px wide, sharp in a 600px newsletter column.</span>
        <button type="button" onClick={onClose} style={{ font: `600 12.5px ${FONT}`, color: "#fff", background: LIGHT.blue, border: "none", borderRadius: 9999, padding: "7px 16px", cursor: "pointer" }}>Done</button>
      </div>
      <div style={{ width: CANVAS * scale, height: ref.current ? ref.current.offsetHeight * scale : "auto", flexShrink: 0, marginBottom: 20 }}>
        <div style={{ width: CANVAS, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <SnapshotCard ref={ref} data={data} dark={dark} />
        </div>
      </div>
    </div>
  );
}
