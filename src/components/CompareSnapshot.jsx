// src/components/CompareSnapshot.jsx
//
// Compare's "Screenshot" view (Christo 2026-10-28): the comparison laid out
// as a 1200px card, a 600px newsletter column at 2x, so a plain screenshot
// is sharp in email. Content comes from BlueprintCompare's buildSnapshot()
// (only the rows that differ per card, shared rows in one strip); this file
// is layout only. It carries its own light/dark choice so the image doesn't
// depend on the app theme, and scales to fit the window without changing
// the canvas's proportions.

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FONT, MONO } from "../lib/fonts.js";
import { DARK, LIGHT } from "../lib/theme.js";

const CANVAS = 1200;
const CHECK = <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3L12.5 5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const UP = <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 12.5V3.5M4 7.5l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;

function SnapRing({ segs, size, track, label, value, note, P, win }) {
  const sw = 22, r = (size - sw) / 2, circ = 2 * Math.PI * r;
  const live = segs.filter(s => s.v > 0.5), total = live.reduce((a, s) => a + s.v, 0);
  let off = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={sw} />
        {total > 0 && live.map((s, i) => {
          const len = s.v / total * circ;
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.c} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${Math.max(0.1, len - 5)} ${circ}`} strokeDashoffset={-off} />;
          off += len;
          return el;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.15em", textTransform: "uppercase", color: P.textTertiary, fontWeight: 600 }}>{label}</span>
        <b style={{ fontSize: size > 200 ? 46 : 38, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.05, color: win ? P.blue : P.text }}>{value}</b>
        <span style={{ fontSize: 15, color: P.textTertiary, fontWeight: 600 }}>{note}</span>
      </div>
    </div>
  );
}

export default function CompareSnapshot({ data, onClose }) {
  const [dark, setDark] = useState(false);
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

  const P = dark ? DARK : LIGHT;
  const line = dark ? "rgba(255,255,255,0.09)" : "rgba(16,27,46,0.10)";
  const track = dark ? "rgba(255,255,255,0.08)" : "rgba(16,27,46,0.08)";
  const grid = dark ? "rgba(110,144,255,0.08)" : "rgba(59,107,245,0.075)";
  const shadow = dark ? "0 1px 2px rgba(0,0,0,0.4), 0 22px 44px -20px rgba(0,0,0,0.7)" : "0 1px 2px rgba(16,27,46,0.05), 0 18px 40px -18px rgba(16,27,46,0.22)";
  const n = data.cards.length;
  const ringSize = n > 3 ? 190 : 230;
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
        <span style={{ fontSize: 12.5, color: dark ? "rgba(255,255,255,0.7)" : "#475467", flex: 1, minWidth: 160 }}>Screenshot the card. At full size it's 1200px wide, sharp in a 600px newsletter column.</span>
        <button type="button" onClick={onClose} style={{ font: `600 12.5px ${FONT}`, color: "#fff", background: LIGHT.blue, border: "none", borderRadius: 9999, padding: "7px 16px", cursor: "pointer" }}>Done</button>
      </div>

      <div style={{ width: CANVAS * scale, height: ref.current ? ref.current.offsetHeight * scale : "auto", flexShrink: 0, marginBottom: 20 }}>
        <div ref={ref} style={{
          width: CANVAS, transform: `scale(${scale})`, transformOrigin: "top left", padding: "56px 60px 44px", borderRadius: 32, color: P.text, fontFamily: FONT,
          fontVariantNumeric: "tabular-nums", backgroundColor: P.bg, border: `1px solid ${line}`,
          backgroundImage: `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px)`, backgroundSize: "30px 30px",
          display: "flex", flexDirection: "column", gap: 34 }}>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
                <defs><linearGradient id="snapMark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={LIGHT.blue} /><stop offset="1" stopColor={LIGHT.accentDeep} /></linearGradient></defs>
                <rect x="0.5" y="0.5" width="43" height="43" rx="12" fill="url(#snapMark)" />
                <path d="M11 21.5 22 12l11 9.5M14.5 19v13h15V19" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
                <path d="M19.5 32v-6h5v6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
              </svg>
              <div>
                <b style={{ display: "block", fontSize: 23, fontWeight: 800, letterSpacing: "-0.02em" }}>Mortgage Blueprint</b>
                <span style={{ display: "block", fontFamily: MONO, fontSize: 11, letterSpacing: "0.15em", color: P.textTertiary, fontWeight: 600, marginTop: 2 }}>POWERED BY REALSTACK</span>
              </div>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, color: P.blue, background: `${P.blue}1a`, border: `1px solid ${P.blue}40`, borderRadius: 9999, padding: "8px 16px" }}>{data.stamp}</span>
          </div>

          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 56, lineHeight: 1.05, fontWeight: 800, letterSpacing: "-0.035em", textWrap: "balance", maxWidth: "20ch" }}>
              {data.headline[0]} <span style={{ color: P.blue }}>{data.headline[1]}</span>
            </h2>
            <p style={{ margin: 0, fontSize: 23, lineHeight: 1.4, color: P.textSecondary, maxWidth: "46ch", textWrap: "balance" }}>{data.sub}</p>
          </div>

          {data.budget && data.budget.length > 0 && (
            <div style={{ alignSelf: "center", display: "inline-flex", alignItems: "center", gap: 14, fontSize: 19, color: P.textSecondary, background: P.card, border: `1px solid ${line}`, borderRadius: 9999, padding: "10px 22px", boxShadow: shadow, marginTop: -10 }}>
              <span style={{ fontFamily: MONO, fontSize: 12.5, letterSpacing: "0.15em", textTransform: "uppercase", color: P.blue, fontWeight: 600 }}>Budget</span>
              {data.budget.map((b, i) => <React.Fragment key={i}>
                {i > 0 && <i style={{ width: 1, height: 18, background: line }} />}
                <span><b style={{ color: P.text, fontWeight: 700 }}>{b.v}</b> {b.l}</span>
              </React.Fragment>)}
            </div>
          )}

          {/* Cards share row tracks (subgrid) so ring, notes and rows line up. */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, gridTemplateRows: "repeat(5, auto)", columnGap: 22, paddingTop: 14 }}>
            {data.cards.map((c, i) => (
              <article key={i} style={{ position: "relative", background: P.card, border: c.win ? `2px solid ${P.blue}` : `1px solid ${line}`, borderRadius: 26,
                boxShadow: c.win ? `0 0 0 6px ${P.blue}1a, ${shadow}` : shadow, padding: "30px 26px 26px",
                display: "grid", gridRow: "span 5", gridTemplateRows: "subgrid", rowGap: 20, justifyItems: "center", alignContent: "start" }}>
                {c.win && <span style={{ position: "absolute", top: -17, left: "50%", transform: "translateX(-50%)", display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
                  fontFamily: MONO, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, color: "#fff",
                  background: `linear-gradient(90deg, ${P.blue}, ${P.accentDeep})`, borderRadius: 9999, padding: "8px 16px", boxShadow: `0 8px 18px -8px ${P.accentDeep}cc` }}>{CHECK}{c.win}</span>}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
                  <span style={{ width: 34, height: 34, borderRadius: 11, background: `${P.blue}1f`, color: P.blue, font: `800 17px ${FONT}`, display: "grid", placeItems: "center" }}>{c.letter}</span>
                  <b style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{c.name}</b>
                  {c.sub && <small style={{ fontSize: 16, color: P.textTertiary }}>{c.sub}</small>}
                </div>
                <SnapRing segs={c.segs} size={ringSize} track={track} label={c.ringLabel} value={c.ringValue} note={c.ringNote} P={P} win={!!c.win} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  {c.note && <div style={{ fontSize: 15.5, fontWeight: 600, color: P.orange, textAlign: "center" }}>{c.note}</div>}
                  {c.status.length > 0 && <div style={{ display: "flex", gap: 7, justifyContent: "center", flexWrap: "wrap" }}>
                    {c.status.map((s, j) => <span key={j} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 14, fontWeight: 600, borderRadius: 9999, padding: "5px 11px", whiteSpace: "nowrap",
                      color: s.ok ? P.green : P.orange, background: s.ok ? `${P.green}1f` : `${P.orange}21` }}>{s.ok ? CHECK : UP}{s.text}</span>)}
                  </div>}
                </div>
                <div style={{ width: "100%", display: "flex", flexDirection: "column", borderTop: `1px solid ${line}` }}>
                  {c.rows.map((r, j) => (
                    <div key={j} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: r.tone === "strong" ? "14px 2px 12px" : "12px 2px", fontSize: 18.5, color: r.tone === "strong" ? P.text : P.textSecondary, fontWeight: r.tone === "strong" ? 600 : 400, borderTop: j ? `1px solid ${line}` : "none" }}>
                      <span>{r.label}</span>
                      <b style={{ fontWeight: 700, fontSize: r.tone === "strong" ? 21 : undefined, color: r.tone === "green" ? P.green : r.tone === "blue" ? P.blue : r.tone === "muted" ? P.textTertiary : P.text }}>{r.value}</b>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: P.orange, textAlign: "center" }}>{c.flag}</div>
              </article>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "8px 26px", fontSize: 16, color: P.textSecondary, marginTop: -12 }}>
            {data.legend.map(l => <span key={l.l} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><i style={{ width: 11, height: 11, borderRadius: 6, background: l.c, display: "inline-block" }} />{l.l}</span>)}
          </div>

          {data.same.length > 0 && (
            <div style={{ background: P.card, border: `1px solid ${line}`, borderRadius: 22, padding: "18px 22px", display: "flex", alignItems: "center", gap: 22, boxShadow: shadow }}>
              <div style={{ fontFamily: MONO, fontSize: 12.5, letterSpacing: "0.15em", textTransform: "uppercase", color: P.textTertiary, fontWeight: 600, lineHeight: 1.35, width: 92, flexShrink: 0 }}>Same for all {n === 2 ? "two" : n === 3 ? "three" : n === 4 ? "four" : n}</div>
              <div style={{ display: "flex", flex: 1, justifyContent: "space-between" }}>
                {data.same.map((s, i) => (
                  <div key={s.l} style={{ display: "flex", flexDirection: "column", gap: 3, padding: "0 16px", borderLeft: i ? `1px solid ${line}` : "none" }}>
                    <span style={{ fontSize: 14.5, color: P.textTertiary }}>{s.l}</span>
                    <b style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{s.v}</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.take && (
            <div style={{ borderRadius: 22, padding: "22px 30px", background: `linear-gradient(90deg, ${P.blue}, ${P.accentDeep})`, color: "#fff", fontSize: 23, lineHeight: 1.4, fontWeight: 500, textAlign: "center", textWrap: "balance", boxShadow: `0 14px 30px -14px ${P.accentDeep}bf` }}>
              {data.take.map((p, i) => <span key={i} style={p.b || p.c ? { fontWeight: 800 } : null}>{p.t}</span>)}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 30 }}>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: P.textTertiary, maxWidth: "80ch" }}>{data.disclosure} Chris Granger, NMLS #952015 · Xpert Home Lending, Inc. NMLS #2179191.</p>
            <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: "0.08em", color: P.textSecondary, fontWeight: 600, whiteSpace: "nowrap" }}>blueprint.realstack.app</span>
          </div>
        </div>
      </div>
    </div>
  );
}
