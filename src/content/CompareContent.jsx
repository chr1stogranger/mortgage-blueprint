import { FONT, MONO } from "../lib/fonts.js";
import React, { useMemo, useRef, useState } from "react";
import { winnerBy, firstLeaderChange } from "../lib/compareMetrics.js";
import { LENS_MODES, LENS_HELD, netOf, solveLens, minDownFor } from "../lib/compareLens.js";
import CompareSnapshot, { InlineSnapshot } from "../components/CompareSnapshot.jsx";
import { DARK } from "../lib/theme.js";

/* ═══════════════════════════════════════════════════════════════
   CompareContent — the Compare tab (rebuilt 2026-09-23, Christo).
   One job: say which option wins and what it costs, then prove it.
     1. Plain-English verdict (who wins, and the catch)
     2. One grouped spec sheet — best value per row in green, gap to
        best under the rest, rows identical across options folded away
     3. Cost-over-time chart (purchase: cost to borrow; refi: net
        savings after closing costs, crossing zero at breakeven)
   Scenario management lives in the sidebar / header menu, so it's not
   repeated here; "+ Add option" duplicates the option on screen.
   Up to 4 columns; with more options the user picks which 4.

   2026-10-28 (Christo): purchases moved to BlueprintCompare below —
   mini Blueprint column heads (price, loan, payment ring) over Overview's
   row-by-row breakdown, plus "Line them up by". Refinances keep this
   spec sheet.
   ═══════════════════════════════════════════════════════════════ */

const MAX_COLS = 4;

export default function CompareContent(props) {
  return props.isRefi ? <SpecSheetCompare {...props} /> : <BlueprintCompare {...props} />;
}

function SpecSheetCompare({ T, isDesktop, fmt, pct, compareData, compareLoading, scenarioName, switchScenario, onAddOption, isRefi, privacy }) {
  const [picked, setPicked] = useState(null);      // null = default pick
  const [showSame, setShowSame] = useState(false);
  const [showAllMobile, setShowAllMobile] = useState(false);

  // Mode follows the option on screen; an option of the other kind shows "—"
  // for rows that don't apply to it.
  const refiMode = !!isRefi;
  const all = compareData || [];

  const defaultPick = useMemo(() => {
    const cur = all.find(e => e.isCurrent);
    const rest = all.filter(e => !e.isCurrent);
    return [cur, ...rest].filter(Boolean).slice(0, MAX_COLS).map(e => e.name);
  }, [all]);
  const pickNames = (picked || defaultPick).filter(n => all.some(e => e.name === n));
  const entries = all.length > MAX_COLS ? all.filter(e => pickNames.includes(e.name)) : all;

  const togglePick = (name) => {
    const cur = picked || defaultPick;
    if (cur.includes(name)) { if (cur.length > 2) setPicked(cur.filter(n => n !== name)); }
    else if (cur.length < MAX_COLS) setPicked([...cur, name]);
  };

  const PALETTE = [T.blue, T.orange, T.purple || "#8b7bf0", T.cyan || "#38c6c6"];
  const colorOf = (name) => PALETTE[Math.max(0, all.findIndex(e => e.name === name)) % PALETTE.length];

  const money = (v) => (v == null || !isFinite(v)) ? "—" : fmt(v);
  const moneyK = (v) => (v == null || !isFinite(v)) ? "—" : fmt(v, true);
  const perc = (v, d = 1) => (v == null || !isFinite(v)) ? "—" : pct(v, d);
  const months = (v) => privacy ? "••" : (v == null || !isFinite(v) || v <= 0) ? "—" : `${v} mo`;
  const rateTxt = (v) => privacy ? "•.••%" : (v == null ? "—" : `${Number(v).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`);
  const dMoney = (d) => `+${fmt(Math.abs(d))}`;
  const dPts = (d) => privacy ? "" : `+${(Math.abs(d) * 100).toFixed(1)} pts`;

  // ── Row model ──
  const kindOk = (m) => !!m && m.isRefi === refiMode;
  const g = (key) => (m) => kindOk(m) ? m[key] : null;
  const miNote = (m) => !m || !(m.mi > 0) ? null
    : m.miMode === "conv" ? "PMI · drops at 78% LTV"
    : m.miMode === "fha-11" ? "MIP · 11 years"
    : m.miMode === "fha-life" ? "MIP · life of loan" : null;

  const PURCHASE_GROUPS = [
    { title: "Every month", rows: [
      { key: "pi", label: "Principal & interest", get: g("pi"), f: money, best: "min", d: dMoney },
      { key: "tax", label: "Property tax", get: g("monthlyTax"), f: money, best: "min", d: dMoney },
      { key: "ins", label: "Insurance", get: g("ins"), f: money, best: "min", d: dMoney },
      { key: "mi", label: "Mortgage insurance", get: g("mi"), f: money, best: "min", d: dMoney, note: miNote },
      { key: "hoa", label: "HOA", get: g("hoaM"), f: money, best: "min", d: dMoney },
      { key: "pay", label: "Total payment", get: g("monthlyPayment"), f: money, best: "min", d: dMoney, total: true, keep: true, mobile: true },
    ]},
    { title: "At closing", rows: [
      // No "best" on down payment: putting less down isn't a win on its own —
      // its cost shows up in cash to close, MI and the 5-yr cost rows.
      { key: "down", label: "Down payment", get: g("downAmt"), f: money, note: m => kindOk(m) && !privacy ? `${Number(m.downPct).toFixed(m.downPct % 1 ? 1 : 0)}%` : null },
      { key: "ctc", label: "Cash to close", get: g("cashToClose"), f: money, best: "min", d: dMoney, total: true, keep: true, mobile: true },
    ]},
    { title: "The loan", rows: [
      { key: "price", label: "Price", get: g("salesPrice"), f: money },
      { key: "loan", label: "Loan amount", get: g("loan"), f: money },
      { key: "rate", label: "Rate", get: g("rate"), f: rateTxt, best: "min", tol: 0.001 },
      { key: "term", label: "Term", get: g("term"), f: v => v == null ? "—" : `${v} yr` },
      { key: "type", label: "Loan type", get: m => kindOk(m) ? m.loanType : null, f: v => v || "—", text: true },
      { key: "ltv", label: "LTV", get: g("ltv"), f: v => perc(v), best: "min", d: dPts, tol: 0.0005 },
      { key: "dti", label: "DTI", get: g("dti"), f: v => perc(v), best: "min", d: dPts, mobile: true, tol: 0.0005 },
    ]},
    { title: "Over time", rows: [
      { key: "cost5", label: "5-yr cost to borrow", sub: "interest + MI + closing costs", get: m => kindOk(m) && m.costSeries ? m.costSeries[Math.min(5, m.costSeries.length - 1)] : null, f: money, best: "min", d: dMoney, keep: true, mobile: true },
      { key: "int", label: "Total interest", sub: "full term", get: g("totalInt"), f: moneyK, best: "min", d: v => `+${fmt(Math.abs(v), true)}` },
    ]},
  ];
  const REFI_GROUPS = [
    { title: "Every month", rows: [
      { key: "pi", label: "New principal & interest", get: g("pi"), f: money, best: "min", d: dMoney },
      { key: "mi", label: "Mortgage insurance", get: g("mi"), f: money, best: "min", d: dMoney },
      { key: "pay", label: "New total payment", get: g("monthlyPayment"), f: money, best: "min", d: dMoney },
      { key: "sav", label: "Savings vs current loan", sub: "P&I + MI", get: g("savings"), f: v => v == null ? "—" : (v >= 0 ? money(v) : `−${fmt(Math.abs(v))}`), best: "max", d: dMoney, total: true, keep: true, mobile: true },
    ]},
    { title: "At closing", rows: [
      { key: "cc", label: "Closing costs", get: g("closingCosts"), f: money, best: "min", d: dMoney },
      { key: "cash", label: "Cash in hand", sub: "after costs and payoff", get: g("cashOut"), f: v => v == null ? "—" : (v >= 0 ? money(v) : `−${fmt(Math.abs(v))}`), best: "max", d: dMoney, mobile: true },
      { key: "be", label: "Breakeven", get: g("breakeven"), f: months, best: "min", d: v => privacy ? "" : `+${Math.abs(v)} mo`, total: true, keep: true, mobile: true },
    ]},
    { title: "The loan", rows: [
      { key: "loan", label: "New loan amount", get: g("loan"), f: money },
      { key: "rate", label: "Rate", get: g("rate"), f: rateTxt, best: "min", tol: 0.001 },
      { key: "drop", label: "Rate drop", get: g("rateDrop"), f: v => privacy ? "••" : (v == null ? "—" : `${v >= 0 ? "−" : "+"}${Math.abs(v).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")} pts`) },
      { key: "term", label: "Term", get: g("term"), f: v => v == null ? "—" : `${v} yr` },
      { key: "type", label: "Loan type", get: m => kindOk(m) ? m.loanType : null, f: v => v || "—", text: true },
      { key: "ltv", label: "LTV", get: g("ltv"), f: v => perc(v), best: "min", d: dPts, tol: 0.0005 },
      { key: "dti", label: "DTI", get: g("dti"), f: v => perc(v), best: "min", d: dPts, mobile: true, tol: 0.0005 },
    ]},
    { title: "Over time", rows: [
      { key: "isav", label: "Interest saved", sub: "vs keeping the current loan", get: g("intSaved"), f: v => v == null ? "—" : (v >= 0 ? moneyK(v) : `−${fmt(Math.abs(v), true)}`), best: "max", d: v => `+${fmt(Math.abs(v), true)}` },
    ]},
  ];
  const GROUPS = refiMode ? REFI_GROUPS : PURCHASE_GROUPS;

  // Resolve each row: values, display strings, best, and whether identical.
  const resolved = GROUPS.map(grp => ({
    ...grp,
    rows: grp.rows.map(row => {
      const vals = entries.map(e => { const v = row.get(e.metrics); return (row.text ? v : (v == null || !isFinite(v) ? null : v)); });
      const shown = vals.map(v => row.f(v));
      const numeric = vals.filter(v => v != null && !row.text);
      let bestV = null;
      if (row.best && numeric.length > 1) bestV = row.best === "min" ? Math.min(...numeric) : Math.max(...numeric);
      // A row where one option is "best" but it's a tie for everyone isn't a win.
      const tol = row.tol ?? 0.5;
      const allTie = numeric.length > 1 && numeric.every(v => Math.abs(v - numeric[0]) < tol);
      const identical = entries.length > 1 && shown.every(sv => sv === shown[0]);
      return { ...row, tol, vals, shown, bestV: allTie ? null : bestV, identical };
    }),
  }));
  const hiddenRows = resolved.flatMap(g => g.rows.filter(r => r.identical && !r.keep));

  // ── Verdict ──
  const verdict = useMemo(() => buildVerdict({ entries, refiMode, fmt, privacy }), [entries, refiMode, fmt, privacy]); // eslint-disable-line react-hooks/exhaustive-deps

  const S = {
    card: { background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, boxShadow: T.cardShadow },
    label: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: T.textTertiary, fontWeight: 700, fontFamily: FONT },
  };
  // No onAddOption = a view-only share link: they compare the LO's options
  // but can't add one (2026-10-12).
  const addBtn = onAddOption ? (
    <button onClick={onAddOption} style={{ font: `600 13px ${FONT}`, color: T.blue, background: `${T.blue}12`, border: `1px solid ${T.blue}33`, borderRadius: 9999, padding: "7px 16px", cursor: "pointer", whiteSpace: "nowrap" }}>
      + Add option
    </button>
  ) : null;

  if (compareLoading && all.length === 0) {
    return <div style={{ ...S.card, marginTop: 20, padding: 24, textAlign: "center", color: T.textSecondary }}>Loading comparison…</div>;
  }
  if (all.length <= 1) {
    return (
      <div style={{ ...S.card, marginTop: 20, padding: "28px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 6 }}>{onAddOption ? "Add a second option to compare" : "Only one option so far"}</div>
        <div style={{ fontSize: 13, color: T.textSecondary, maxWidth: 440, margin: "0 auto 16px", lineHeight: 1.5 }}>
          {onAddOption
            ? <>"+ Add option" copies {scenarioName ? <b>{scenarioName}</b> : "this option"}. Change one thing on Overview (rate, loan type, down payment) and come back to see which wins.</>
            : <>When your loan officer shares another option, it shows up here side by side with {scenarioName ? <b>{scenarioName}</b> : "this one"}.</>}
        </div>
        {addBtn}
      </div>
    );
  }

  const cols = entries.length;
  const gridCols = `minmax(${isDesktop ? 180 : 130}px, 1.1fr) repeat(${cols}, minmax(0, 1fr))`;
  const est = <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textTertiary, border: `1px solid ${T.separator}`, borderRadius: 9999, padding: "1px 6px" }}>Est.</span>;

  const cell = (row, i) => {
    const v = row.vals[i];
    const isBest = row.bestV != null && v != null && Math.abs(v - row.bestV) < row.tol;
    // Gap to the best value: "+$683" when you'd pay more, "−$957" when a
    // higher-is-better row (savings, cash in hand) comes up short.
    const gapRaw = (!isBest && row.bestV != null && v != null && row.d) ? row.d(v - row.bestV) : null;
    const gap = gapRaw && row.best === "max" ? gapRaw.replace(/^\+/, "−") : gapRaw;
    const note = row.note ? row.note(entries[i].metrics) : null;
    return (
      <div key={i} style={{ padding: "9px 16px", borderLeft: `1px solid ${T.separator}`, borderTop: `${row.total ? 2 : 1}px solid ${T.separator}`, fontSize: row.total ? 14 : 13, fontWeight: row.total ? 700 : 600, color: isBest ? T.green : T.text, fontFamily: FONT, minWidth: 0 }}>
        {isBest && <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 9, background: T.green, marginRight: 6, verticalAlign: "middle", transform: "translateY(-1px)" }} />}
        {row.shown[i]}
        {(gap || note) && <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: T.textTertiary }}>{[gap, note].filter(Boolean).join(" · ")}</span>}
      </div>
    );
  };

  return (<div style={{ marginTop: 20 }}>
    {/* Toolbar: count + pick-4 + add */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
      <div style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT }}>
        {all.length > MAX_COLS ? <>Comparing <b style={{ color: T.text }}>{cols} of {all.length}</b> options: pick up to {MAX_COLS}</> : <><b style={{ color: T.text }}>{all.length} options</b>{refiMode ? " · refinance" : ""}</>}
      </div>
      {addBtn}
    </div>
    {all.length > MAX_COLS && (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {all.map(e => {
          const on = pickNames.includes(e.name);
          const disabled = !on && pickNames.length >= MAX_COLS;
          return (
            <button key={e.name} onClick={() => togglePick(e.name)} disabled={disabled} aria-pressed={on}
              style={{ font: `600 12px ${FONT}`, padding: "5px 12px", borderRadius: 9999, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1,
                background: on ? `${colorOf(e.name)}18` : T.inputBg, color: on ? colorOf(e.name) : T.textSecondary,
                border: `1px solid ${on ? colorOf(e.name) + "66" : T.separator}` }}>
              {on ? "✓ " : ""}{e.name}
            </button>
          );
        })}
      </div>
    )}

    {/* 1. Verdict */}
    {verdict && (
      <div style={{ ...S.card, padding: isDesktop ? "18px 20px" : "14px 16px", display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={S.label}>The short version</div>
          <p style={{ margin: "4px 0 0", fontSize: isDesktop ? 17 : 15, lineHeight: 1.45, fontWeight: 500, color: T.text, fontFamily: FONT, maxWidth: "78ch", textWrap: "pretty" }}>
            {verdict.parts.map((p, i) => <span key={i} style={p.c ? { color: T[p.c], fontWeight: 700 } : p.b ? { fontWeight: 700 } : null}>{p.t}</span>)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {verdict.pills.map((p, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 9999, whiteSpace: "nowrap", fontFamily: FONT, color: p.c === "blue" ? T.blue : T.green, background: p.c === "blue" ? `${T.blue}14` : `${T.green}1a` }}>{p.t}</span>
          ))}
        </div>
      </div>
    )}

    {/* 2. Spec sheet */}
    {isDesktop ? (
      <div style={{ ...S.card, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: gridCols, background: `linear-gradient(135deg, ${T.blue}18, ${T.blue}0c)`, borderBottom: `1px solid ${T.blue}38` }}>
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.blue, fontFamily: FONT }}>{cols} options</span>
            <span style={{ fontSize: 11, color: T.textTertiary }}>Best in each row is green</span>
          </div>
          {entries.map(e => (
            <div key={e.name} style={{ padding: "14px 16px", borderLeft: `1px solid ${T.separator}`, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 14, fontWeight: 700, color: T.text, fontFamily: FONT }}>
                <span style={{ width: 8, height: 8, borderRadius: 9, background: colorOf(e.name), flexShrink: 0 }} />
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
              </div>
              <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 1, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {!e.isCurrent && est}<span>{e.metrics.loanType} · {e.metrics.term} yr · {rateTxt(e.metrics.rate)}</span>
              </div>
              {/* marginTop:auto pins payment + button to the cell bottom so every
                  column's figure lines up even when the spec line wraps. */}
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginTop: "auto", paddingTop: 6, color: T.text, fontFamily: FONT }}>
                {money(e.metrics.monthlyPayment)}<span style={{ fontSize: 12, color: T.textTertiary, fontWeight: 600 }}>/mo</span>
              </div>
              <button onClick={() => !e.isCurrent && switchScenario(e.name)} disabled={e.isCurrent}
                style={{ marginTop: 8, alignSelf: "flex-start", font: `600 12px ${FONT}`, color: e.isCurrent ? T.textTertiary : T.blue, background: "none", border: `1px solid ${e.isCurrent ? T.separator : T.blue + "4d"}`, borderRadius: 9999, padding: "4px 12px", cursor: e.isCurrent ? "default" : "pointer" }}>
                {e.isCurrent ? "Viewing" : "Open"}
              </button>
            </div>
          ))}
        </div>
        {resolved.map(grp => {
          const rows = grp.rows.filter(r => showSame || !r.identical || r.keep);
          if (rows.length === 0) return null;
          return (
            <React.Fragment key={grp.title}>
              <div style={{ padding: "14px 16px 6px", ...S.label, fontSize: 10, borderTop: `1px solid ${T.separator}` }}>{grp.title}</div>
              {rows.map(row => (
                <div key={row.key} style={{ display: "grid", gridTemplateColumns: gridCols }}>
                  <div style={{ padding: "9px 16px", borderTop: `${row.total ? 2 : 1}px solid ${T.separator}`, fontSize: row.total ? 14 : 13, fontWeight: row.total ? 700 : 400, color: row.total ? T.text : T.textSecondary, fontFamily: FONT }}>
                    {row.label}
                    {row.sub && <span style={{ display: "block", fontSize: 11, color: T.textTertiary, fontWeight: 400 }}>{row.sub}</span>}
                  </div>
                  {entries.map((_, i) => cell(row, i))}
                </div>
              ))}
            </React.Fragment>
          );
        })}
        {hiddenRows.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: `1px solid ${T.separator}`, fontSize: 12, color: T.textTertiary, background: T.inputBg, fontFamily: FONT }}>
            <span>{showSame ? "Showing rows that are the same for every option." : `${hiddenRows.length} ${hiddenRows.length === 1 ? "row is" : "rows are"} the same for every option: ${hiddenRows.map(r => `${r.label} ${r.shown[0]}`).join(" · ")}`}</span>
            <button onClick={() => setShowSame(v => !v)} style={{ font: `600 12px ${FONT}`, color: T.blue, background: "none", border: "none", cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}>{showSame ? "Hide" : "Show"}</button>
          </div>
        )}
      </div>
    ) : (
      /* Phone: names + payment pinned on top, each row a compact n-up grid —
         no sideways scrolling. Key rows first; "Show all" for the rest. */
      <div style={{ ...S.card, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 6, padding: 12, background: `linear-gradient(135deg, ${T.blue}18, ${T.blue}0c)`, borderBottom: `1px solid ${T.blue}38` }}>
          {entries.map(e => (
            <button key={e.name} onClick={() => !e.isCurrent && switchScenario(e.name)} style={{ textAlign: "left", background: "none", border: "none", padding: 0, cursor: e.isCurrent ? "default" : "pointer", minWidth: 0, fontFamily: FONT }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: T.text, minWidth: 0 }}>
                <span style={{ width: 6, height: 6, borderRadius: 9, background: colorOf(e.name), flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginTop: 2 }}>{moneyK(e.metrics.monthlyPayment)}</div>
              <div style={{ fontSize: 10, color: T.textTertiary }}>{e.isCurrent ? "Viewing" : "Est. · Open"}</div>
            </button>
          ))}
        </div>
        {resolved.flatMap(grp => grp.rows).filter(r => showAllMobile ? (showSame || !r.identical || r.keep) : r.mobile).map(row => (
          <div key={row.key} style={{ padding: "10px 12px", borderTop: `1px solid ${T.separator}` }}>
            <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 4, fontFamily: FONT }}>{row.label}</div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 6, fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
              {entries.map((_, i) => {
                const v = row.vals[i];
                const isBest = row.bestV != null && v != null && Math.abs(v - row.bestV) < row.tol;
                return <span key={i} style={{ color: isBest ? T.green : T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.shown[i]}</span>;
              })}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderTop: `1px solid ${T.separator}`, background: T.inputBg, fontSize: 12, color: T.textTertiary, fontFamily: FONT }}>
          <span>{showAllMobile ? "All rows" : "Key rows"}</span>
          <button onClick={() => setShowAllMobile(v => !v)} style={{ font: `600 12px ${FONT}`, color: T.blue, background: "none", border: "none", cursor: "pointer", padding: 0 }}>{showAllMobile ? "Show fewer" : "Show all"}</button>
        </div>
      </div>
    )}
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 11.5, color: T.textTertiary, fontFamily: FONT }}>
      <span>Est. = quick estimate. Open an option for exact figures.</span>
      <span>{refiMode ? "Savings compare P&I + MI; taxes and insurance carry over." : "Cost to borrow excludes principal, which becomes equity."}</span>
    </div>

    {/* 3. Chart */}
    <CostChart T={T} entries={entries} refiMode={refiMode} colorOf={colorOf} fmt={fmt} privacy={privacy} isDesktop={isDesktop} S={S} />
  </div>);
}

/* ─── Plain-English verdict ─── */
function buildVerdict({ entries, refiMode, fmt, privacy }) {
  if (entries.length < 2) return null;
  const M = e => e.metrics;
  const $ = v => fmt(Math.abs(v));
  const parts = [], pills = [];
  if (refiMode) {
    const ok = entries.filter(e => M(e).isRefi);
    if (ok.length < 2) return null;
    const bestSav = winnerBy(ok, e => M(e).savings, "max");
    const fastBE = winnerBy(ok.filter(e => M(e).breakeven > 0), e => M(e).breakeven, "min");
    const mostCash = winnerBy(ok.filter(e => (M(e).cashOut || 0) > 0), e => M(e).cashOut, "max");
    if (!bestSav || !(M(bestSav).savings > 0)) {
      const least = winnerBy(ok, e => M(e).savings, "max");
      parts.push({ t: "None of these options lowers the payment. " }, { t: least.name, b: 1 }, { t: " adds the least: " }, { t: `${$(M(least).savings)}/mo`, c: "orange" }, { t: " more than the current loan." });
      pills.push({ t: `Smallest increase · ${least.name}`, c: "green" });
    } else {
      parts.push({ t: bestSav.name, b: 1 }, { t: " saves the most: " }, { t: `${$(M(bestSav).savings)}/mo`, c: "green" }, { t: " vs the current loan" });
      if (M(bestSav).breakeven > 0) parts.push({ t: `, breaking even in ${privacy ? "••" : M(bestSav).breakeven} months` });
      parts.push({ t: ". " });
      pills.push({ t: `Most savings · ${bestSav.name}`, c: "green" });
      if (fastBE && fastBE.name !== bestSav.name) {
        parts.push({ t: fastBE.name, b: 1 }, { t: ` breaks even fastest (${privacy ? "••" : M(fastBE).breakeven} months). ` });
        pills.push({ t: `Fastest breakeven · ${fastBE.name}`, c: "green" });
      } else if (fastBE) pills.push({ t: `Fastest breakeven · ${fastBE.name}`, c: "green" });
    }
    // A shorter term can raise the payment (no monthly savings) yet save the
    // most interest — say so, or the 15-year option reads as a loser.
    const mostInt = winnerBy(ok.filter(e => (M(e).intSaved || 0) > 0), e => M(e).intSaved, "max");
    if (mostInt && (!bestSav || mostInt.name !== bestSav.name)) {
      parts.push({ t: mostInt.name, b: 1 }, { t: " saves the most interest over the life of the loan (" }, { t: fmt(M(mostInt).intSaved, true), c: "green" }, { t: "). " });
      pills.push({ t: `Most interest saved · ${mostInt.name}`, c: "green" });
    }
    if (mostCash) { parts.push({ t: mostCash.name, b: 1 }, { t: " puts the most cash in hand: " }, { t: $(M(mostCash).cashOut), c: "blue" }, { t: "." }); pills.push({ t: `Most cash · ${mostCash.name}`, c: "blue" }); }
    return { parts, pills };
  }
  const ok = entries.filter(e => !M(e).isRefi);
  if (ok.length < 2) return null;
  const lowPay = winnerBy(ok, e => M(e).monthlyPayment, "min");
  const lowCash = winnerBy(ok, e => M(e).cashToClose, "min");
  const low5 = winnerBy(ok, e => M(e).costSeries ? M(e).costSeries[5] : null, "min");
  const others = ok.filter(e => e.name !== lowPay.name).sort((a, b) => M(a).monthlyPayment - M(b).monthlyPayment).slice(0, 2);
  parts.push({ t: lowPay.name, b: 1 }, { t: " has the lowest payment: " });
  others.forEach((o, i) => {
    parts.push({ t: `${$(M(o).monthlyPayment - M(lowPay).monthlyPayment)}/mo less`, c: "green" }, { t: ` than ${o.name}` });
    parts.push({ t: i < others.length - 1 ? " and " : ". " });
  });
  pills.push({ t: `Lowest payment · ${lowPay.name}`, c: "green" });
  if (low5) {
    if (low5.name === lowPay.name) parts.push({ t: "It also costs the least to borrow over 5 years. " });
    else parts.push({ t: "But " }, { t: low5.name, b: 1 }, { t: " costs the least to borrow over 5 years (" }, { t: `${$(M(lowPay).costSeries[5] - M(low5).costSeries[5])} less`, c: "green" }, { t: "). " });
    pills.push({ t: `Lowest 5-yr cost · ${low5.name}`, c: "green" });
  }
  if (lowCash) {
    if (lowCash.name === lowPay.name) parts.push({ t: "And it needs the least cash at closing." });
    else parts.push({ t: "The catch: it needs " }, { t: `${$(M(lowPay).cashToClose - M(lowCash).cashToClose)} more cash`, c: "orange" }, { t: " at closing than " }, { t: lowCash.name, b: 1 }, { t: "." });
    pills.push({ t: `Least cash · ${lowCash.name}`, c: "blue" });
  }
  return { parts, pills };
}

/* ─── Cost-over-time chart ─── */
function CostChart({ T, entries, refiMode, colorOf, fmt, privacy, isDesktop, S }) {
  const series = entries
    .filter(e => refiMode ? (e.metrics.isRefi && e.metrics.netSeries) : (!e.metrics.isRefi && e.metrics.costSeries))
    .map(e => ({ name: e.name, values: refiMode ? e.metrics.netSeries : e.metrics.costSeries }));
  if (series.length < 2) return null;
  const years = Math.max(...series.map(s => s.values.length - 1));
  const all = series.flatMap(s => s.values);
  // Round-number axis: step = 1/2/2.5/5 × 10^k so ticks read $500K, $1.0M…
  const rawLo = refiMode ? Math.min(0, ...all) : 0, rawHi = Math.max(1, ...all);
  const span = rawHi - rawLo, rough = span / 4, mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(st => st >= rough) || rough;
  const lo = Math.floor(rawLo / step) * step;
  const hi = Math.ceil(rawHi / step) * step;
  const W = 720, H = 230, pl = 64, pr = 18, pt = 16, pb = 30;
  const x = y => pl + (y / years) * (W - pl - pr);
  const yv = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const ticks = []; for (let t = lo; t <= hi + step / 2; t += step) ticks.push(t);
  const tickLbl = v => privacy ? "•••" : `${v < 0 ? "−" : ""}${fmt(Math.abs(v), true)}`;
  const xStep = years <= 10 ? 2 : 5;
  const xTicks = []; for (let y = 0; y <= years; y += xStep) xTicks.push(y);
  const cross = refiMode ? null : firstLeaderChange(series);
  const mark = refiMode ? null : 5;

  return (
    <div style={{ ...S.card, marginTop: 14, padding: isDesktop ? "16px 18px" : "14px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <div>
          <div style={S.label}>{refiMode ? "Net savings over time" : "Cost to borrow over time"}</div>
          <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT }}>
            {refiMode ? "Monthly savings minus closing costs. Above zero means the refi has paid for itself." : "Interest, mortgage insurance and closing costs. Not principal, which becomes equity."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: T.textSecondary, fontFamily: FONT }}>
          {series.map(s => <span key={s.name}><i style={{ display: "inline-block", width: 10, height: 3, borderRadius: 2, marginRight: 6, verticalAlign: "middle", background: colorOf(s.name) }} />{s.name}</span>)}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={refiMode ? "Net refinance savings by year for each option" : "Cumulative cost to borrow by year for each option"} style={{ display: "block" }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pl} x2={W - pr} y1={yv(t)} y2={yv(t)} stroke={T.separator} strokeWidth="1" />
            <text x={pl - 8} y={yv(t) + 3} textAnchor="end" fontSize="10" fill={T.textTertiary} fontFamily={FONT}>{tickLbl(t)}</text>
          </g>
        ))}
        {refiMode && lo < 0 && <line x1={pl} x2={W - pr} y1={yv(0)} y2={yv(0)} stroke={T.textTertiary} strokeWidth="1.2" strokeDasharray="3 3" />}
        {xTicks.map(y => <text key={y} x={x(y)} y={H - 10} textAnchor="middle" fontSize="10" fill={T.textTertiary} fontFamily={FONT}>Yr {y}</text>)}
        {series.map(s => (
          <polyline key={s.name} fill="none" stroke={colorOf(s.name)} strokeWidth="2.2" strokeLinejoin="round"
            points={s.values.map((v, y) => `${x(y)},${yv(v)}`).join(" ")} />
        ))}
        {mark && years >= mark && series.map(s => s.values[mark] != null && (
          <circle key={s.name} cx={x(mark)} cy={yv(s.values[mark])} r="3.5" fill={colorOf(s.name)} />
        ))}
        {cross && <line x1={x(cross.year)} x2={x(cross.year)} y1={pt} y2={H - pb} stroke={T.green} strokeWidth="1.2" strokeDasharray="4 3" />}
      </svg>
      <div style={{ fontSize: 12, color: T.textSecondary, fontFamily: FONT, marginTop: 2 }}>
        {refiMode
          ? "Each line crosses zero at its breakeven month; steeper lines save faster. A shorter term can run below zero here because more of each payment goes to principal, so check Interest saved."
          : cross
            ? <><b>{cross.to}</b> becomes cheaper to borrow than <b>{cross.from}</b> around year {cross.year} (green line).</>
            : "The lowest line stays cheapest the whole way; dots mark year 5."}
      </div>
    </div>
  );
}

/* ─── Purchase compare: mini Blueprints on a breakdown (2026-10-28) ───
   Each column opens like a small Overview (name, purchase price + down,
   loan, payment ring); below, every line runs across one grid, grouped
   like Overview's Payment Breakdown and Cash to Close cards, each ending
   in a blue total band with the winner. Rows that match across every
   option fold into one "Same for all" strip so the differences carry the
   screen. "Line them up by" re-quotes options with one number held equal
   to another option or to the borrower's own numbers (lib/compareLens.js),
   and those numbers double as a budget the totals are checked against.
   It's a what-if: saved options never change. "Screenshot" renders the
   same comparison as a 1200px newsletter card (components/CompareSnapshot). */
const LETTERS = "ABCDEFGH";
const MINE = "\u0000mine"; // "Match to: My numbers" — can't collide with a scenario name
const COUNT_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five"];

function compareDetail(m) {
  const r = (Number(m.rate) || 0) / 1200, loan = Number(m.loan) || 0, pi = Number(m.pi) || 0;
  const interest = loan * r;
  let bal = loan, int5 = 0;
  for (let i = 0; i < 60; i++) { const it = bal * r; int5 += it; bal = Math.max(0, bal - (pi - it)); }
  const cost5 = m.costSeries ? m.costSeries[Math.min(5, m.costSeries.length - 1)] : null;
  // Whatever the payment carries beyond PITI + MI + HOA (a piggyback HELOC,
  // live-engine extras) gets its own line so the rows add up to the total.
  const other = (m.monthlyPayment || 0) - (pi + (m.monthlyTax || 0) + (m.ins || 0) + (m.mi || 0) + (m.hoaM || 0));
  return {
    interest, principal: Math.max(0, pi - interest), int5, cost5,
    mi5: cost5 != null ? Math.max(0, cost5 - int5 - (m.closingCosts || 0)) : (m.mi || 0) * 60,
    other: other > 0.5 ? other : 0, net: netOf(m),
    prepaids: (m.cashToClose || 0) - (m.downAmt || 0) - (m.closingCosts || 0),
    equity5: m.loanType === "HELOC" ? null : (m.salesPrice || 0) - bal,
  };
}

// Dollar box for "My numbers": digits only, shown with thousands commas.
function MoneyBox({ T, label, value, onChange, suffix, strong }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontFamily: FONT }}>
      <span style={{ fontSize: 11.5, color: strong ? T.blue : T.textTertiary, fontWeight: 600 }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 3, background: T.inputBg, border: `1px solid ${strong ? T.blue + "66" : T.inputBorder}`, borderRadius: 10, padding: "0 10px" }}>
        <span style={{ color: T.textTertiary, fontWeight: 600, fontSize: 14 }}>$</span>
        <input inputMode="numeric" aria-label={label} value={value == null ? "" : Math.round(value).toLocaleString("en-US")}
          onChange={e => { const n = Number(e.target.value.replace(/[^0-9]/g, "")); onChange(n > 0 ? n : null); }}
          style={{ width: 104, border: "none", background: "transparent", color: T.text, font: `600 14px ${FONT}`, padding: "7px 0", outline: "none" }} />
        {suffix && <span style={{ color: T.textTertiary, fontSize: 12, fontWeight: 500 }}>{suffix}</span>}
      </span>
    </label>
  );
}

function BlueprintCompare({ T, isDesktop, fmt, compareData, compareLoading, scenarioName, switchScenario, onAddOption, privacy, requote }) {
  const [picked, setPicked] = useState(null);
  const [lens, setLens] = useState({ mode: "off", target: null });
  const [mine, setMine] = useState({ price: null, net: null, cash: null });
  const [showMore, setShowMore] = useState(false);
  const [unfold, setUnfold] = useState(false);
  const [shot, setShot] = useState(false);
  const [pair, setPair] = useState(""); // "" = all options, else "A name\u0001B name"
  // Typing in My numbers re-solves every option; let React keep the input snappy.
  const mineD = React.useDeferredValue(mine);
  const requoteRef = useRef(requote);
  requoteRef.current = requote;

  const all = (compareData || []).filter(e => e.metrics && !e.metrics.isRefi);
  const refiCount = (compareData || []).length - all.length;
  const defaultPick = [all.find(e => e.isCurrent), ...all.filter(e => !e.isCurrent)].filter(Boolean).slice(0, MAX_COLS).map(e => e.name);
  const pickNames = (picked || defaultPick).filter(n => all.some(e => e.name === n));
  const entries = all.length > MAX_COLS ? all.filter(e => pickNames.includes(e.name)) : all;
  const togglePick = (name) => {
    const cur = picked || defaultPick;
    if (cur.includes(name)) { if (cur.length > 2) setPicked(cur.filter(n => n !== name)); }
    else if (cur.length < MAX_COLS) setPicked([...cur, name]);
  };
  const letterOf = name => LETTERS[Math.max(0, all.findIndex(e => e.name === name))] || "?";
  const PALETTE = [T.blue, T.orange, T.purple, T.cyan];
  const colorOf = name => PALETTE[Math.max(0, all.findIndex(e => e.name === name)) % PALETTE.length];

  const current = entries.find(e => e.isCurrent) || entries[0];
  const useMine = lens.target === MINE;
  const targetE = useMine ? null : (entries.find(e => e.name === lens.target) || current);
  const entryKey = entries.map(e => e.name).join("|");
  const mineKey = useMine ? `${mineD.price}|${mineD.net}|${mineD.cash}` : "";
  // Solving re-quotes each option a few thousand times in "Same payment + cash";
  // keyed on the data and the lens only, not on every parent render.
  const cols = useMemo(() => {
    const bm = current && current.metrics;
    if (!bm) return [];
    const tm = targetE ? targetE.metrics : bm;
    const t = useMine
      ? { price: mineD.price || bm.salesPrice, net: mineD.net || netOf(bm), cash: mineD.cash || bm.cashToClose }
      : { price: tm.salesPrice, net: netOf(tm), cash: tm.cashToClose };
    return entries.map(e => {
      let m = e.metrics, adj = false;
      if (lens.mode !== "off" && (useMine || e !== targetE) && e.state && requoteRef.current) {
        const quote = (price, downPct) => requoteRef.current(e.state, { salesPrice: price, downPct });
        const solved = solveLens(lens.mode, t, quote, { price: e.metrics.salesPrice, downPct: e.metrics.downPct });
        if (solved) { m = solved; adj = true; }
      }
      return { e, m, adj, d: compareDetail(m) };
    });
  }, [compareData, entryKey, lens.mode, lens.target, mineKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (compareLoading && all.length === 0) {
    return <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, boxShadow: T.cardShadow, marginTop: 20, padding: 24, textAlign: "center", color: T.textSecondary }}>Loading comparison…</div>;
  }
  if (all.length <= 1) return <SpecSheetCompare T={T} isDesktop={isDesktop} fmt={fmt} compareData={compareData} compareLoading={compareLoading} scenarioName={scenarioName} switchScenario={switchScenario} onAddOption={onAddOption} privacy={privacy} />;

  const n = cols.length, tight = !isDesktop && n > 3;
  const held = LENS_HELD[lens.mode] || [];
  const bm = current.metrics;
  const whose = useMine ? "your" : `${targetE.name}'s`;
  const tVal = {
    price: useMine ? (mine.price || bm.salesPrice) : targetE.metrics.salesPrice,
    net: useMine ? (mine.net || netOf(bm)) : netOf(targetE.metrics),
    cash: useMine ? (mine.cash || bm.cashToClose) : targetE.metrics.cashToClose,
  };

  // ── Formatting ──
  const money = v => (v == null || !isFinite(v)) ? "—" : fmt(v);
  const short = v => {
    if (privacy) return fmt(v);
    if (v == null || !isFinite(v)) return "—";
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, "")}M`;
    return `$${Math.round(v / 1000)}K`;
  };
  const moneyFit = v => isDesktop ? money(v) : short(v);
  const pctTxt = v => privacy ? "••%" : `${Number(v).toFixed(Math.abs(v - Math.round(v)) < 0.05 ? 0 : 1)}%`;
  const rateTxt = v => privacy ? "•.••%" : `${Number(v).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`;
  const mo = v => <span>{money(v)}<span style={{ fontSize: 11, color: T.textTertiary, fontWeight: 500 }}>/mo</span></span>;
  const dash = <span style={{ color: T.textTertiary, fontWeight: 500 }}>—</span>;
  const small = (t, color, weight = 500) => <span style={{ display: "block", fontSize: 11, color: color || T.textTertiary, fontWeight: weight, letterSpacing: 0 }}>{t}</span>;
  const CHECK = <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3L12.5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  const winPill = t => <span style={{ display: "inline-flex", alignItems: "center", gap: 5, font: `600 11px ${FONT}`, color: T.green, background: `${T.green}1c`, borderRadius: 9999, padding: "4px 10px", whiteSpace: "nowrap", letterSpacing: 0 }}>{CHECK}{t}</span>;
  const heldTag = key => held.includes(key) ? <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, color: T.blue, background: `${T.blue}18`, border: `1px solid ${T.blue}38`, borderRadius: 9999, padding: "2px 8px" }}>Held equal</span> : null;
  const badge = name => <span style={{ width: 22, height: 22, borderRadius: 7, background: `${T.blue}1c`, color: T.blue, font: `700 12px ${FONT}`, display: "inline-grid", placeItems: "center", flexShrink: 0 }}>{letterOf(name)}</span>;
  const est = <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textTertiary, border: `1px solid ${T.separator}`, borderRadius: 9999, padding: "0 5px", marginRight: 4 }}>Est.</span>;
  const overline = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: T.textTertiary, fontWeight: 600 };

  // ── Budget: My numbers double as caps the totals are checked against ──
  const checkNet = useMine && mine.net > 0 && !held.includes("net");
  const checkCash = useMine && mine.cash > 0 && !held.includes("cash");
  const fitsNet = c => !checkNet || Math.round(c.d.net) <= mine.net;
  const fitsCash = c => !checkCash || Math.round(c.m.cashToClose) <= mine.cash;
  const budgetTag = (key, c) => {
    if (key === "net" && checkNet) return fitsNet(c) ? small("Fits budget", T.green, 600) : small(`${money(c.d.net - mine.net)}/mo over`, T.orange, 600);
    if (key === "cash" && checkCash) return fitsCash(c) ? small("Fits budget", T.green, 600) : small(`${money(c.m.cashToClose - mine.cash)} over`, T.orange, 600);
    return null;
  };

  // ── Winners: best per row, skipping whatever the lens holds equal ──
  const GET = { net: c => c.d.net, cash: c => c.m.cashToClose, cost5: c => c.d.cost5, price: c => c.m.salesPrice };
  const top = (key, dir, tol) => {
    if (held.includes(key)) return null;
    const ranked = cols.filter(c => GET[key](c) != null).sort((a, b) => dir === "min" ? GET[key](a) - GET[key](b) : GET[key](b) - GET[key](a));
    if (ranked.length < 2) return null;
    const gap = Math.abs(GET[key](ranked[0]) - GET[key](ranked[1]));
    return gap < tol ? null : { c: ranked[0], runner: ranked[1], gap };
  };
  const solving = lens.mode === "payment" || lens.mode === "both";
  const W = { net: top("net", "min", 3), cash: top("cash", "min", 300), cost5: top("cost5", "min", 300),
    price: ["payment", "cash", "both"].includes(lens.mode) ? top("price", "max", 300) : null };

  // ── The short version ──
  // All options: each winner against every other option. Head to head:
  // just the two picked (Christo 2026-10-28: "the duplex versus the condo").
  const DIR = { net: "min", cash: "min", cost5: "min", price: "max" }, TOL = { net: 3, cash: 300, cost5: 300, price: 300 };
  const sameWhat = lens.mode === "payment" ? "payment" : lens.mode === "cash" ? "cash" : "payment and cash";
  const PH = { net: "has the lowest net payment", cash: "needs the least cash to close", cost5: "costs the least to borrow over 5 years", price: `buys the most home for the same ${sameWhat}` };
  const PH2 = { net: "has the lower net payment", cash: "needs less cash to close", cost5: "costs less to borrow over 5 years", price: `buys more home for the same ${sameWhat}` };
  const EVEN = { net: "net payment", cash: "cash to close", cost5: "5-year cost", price: "price" };
  const keys = (lens.mode === "both" ? ["price", "cost5"] : lens.mode === "payment" ? ["price", "cash", "cost5"] : lens.mode === "cash" ? ["net", "cost5", "price"] : ["net", "cash", "cost5"]).filter(k => !held.includes(k));
  const gapTxt = (k, g) => `${money(g)}${k === "net" ? "/mo" : ""} ${DIR[k] === "max" ? "more" : "less"}`;
  const joinParts = list => list.flatMap((x, i) => i === 0 ? x : [{ t: i === list.length - 1 ? " and " : ", " }, ...x]);
  const pairNames = pair ? pair.split("\u0001") : null;
  const pairCols = pairNames ? pairNames.map(nm => cols.find(c => c.e.name === nm)).filter(Boolean) : [];
  const headToHead = pairCols.length === 2;
  const talk = headToHead ? pairCols : cols;
  const groups = [], even = [];
  keys.forEach(k => {
    const ranked = talk.filter(c => GET[k](c) != null).sort((a, b) => DIR[k] === "min" ? GET[k](a) - GET[k](b) : GET[k](b) - GET[k](a));
    if (ranked.length < 2) return;
    const w = ranked[0], rest = ranked.slice(1).filter(o => Math.abs(GET[k](o) - GET[k](w)) >= TOL[k]);
    if (!rest.length) { even.push(k); return; }
    const phrase = [{ t: `${(headToHead ? PH2 : PH)[k]}, ` }, ...joinParts(rest.map(o => [{ t: gapTxt(k, Math.abs(GET[k](o) - GET[k](w))), c: "green" }, { t: ` than ${o.e.name}` }]))];
    const g = groups.find(x => x.c === w);
    if (g) g.phrases.push(phrase); else groups.push({ c: w, phrases: [phrase] });
  });
  // One winner, several wins: "X has …. It also costs …" reads better than a chain of "and"s.
  const sentences = groups.map(g => [{ t: g.c.e.name, b: 1 }, { t: " " }, ...g.phrases.flatMap((ph, i) => i === 0 ? [...ph, { t: ". " }] : [{ t: "It also " }, ...ph, { t: ". " }])]);
  if (even.length) sentences.push([{ t: `${headToHead ? "They're" : "They're all"} about even on ${even.map(k => EVEN[k]).join(" and ")}. ` }]);
  if (checkNet || checkCash) {
    const fits = talk.filter(c => fitsNet(c) && fitsCash(c));
    sentences.push(fits.length === talk.length ? [{ t: headToHead ? "Both fit your budget. " : `All ${n} fit your budget. ` }]
      : fits.length === 0 ? [{ t: headToHead ? "Neither fits your budget" : "None fits your budget", c: "orange" }, { t: " as shown. " }]
      : [{ t: "Only " }, { t: fits.map(c => c.e.name).join(" and "), b: 1 }, { t: ` ${fits.length === 1 ? "fits" : "fit"} your budget. ` }]);
  }
  const rented = talk.find(c => (c.m.rent || 0) > 0);
  if (rented) sentences.push([{ t: `If ${rented.e.name}'s rented unit sits empty, its payment is ` }, { t: `${money(rented.m.monthlyPayment)}/mo`, c: "orange" }, { t: "." }]);
  const pairOptions = cols.flatMap((a, i) => cols.slice(i + 1).map(b => [`${a.e.name}\u0001${b.e.name}`, `${a.e.name} vs ${b.e.name}`]));


  const budgetBits = [checkNet && `${money(mine.net)}/mo net`, checkCash && `${money(mine.cash)} cash to close`].filter(Boolean);
  const checkSuffix = budgetBits.length ? ` Totals are checked against your budget of ${budgetBits.join(" and ")}.` : "";
  const lensNote = ({
    off: useMine ? (budgetBits.length ? `Each option as entered, checked against your budget of ${budgetBits.join(" and ")}.` : "Enter a max net payment or cash to close to check each option against it.")
      : "Each option as entered. Hold one number equal to see how the others change.",
    price: `Every option priced at ${whose} ${money(tVal.price)}. Down %, rate and rent stay as entered.`,
    payment: `Each price is solved so the net payment matches ${whose} ${money(tVal.net)}/mo. Down %, rate and rent stay as entered.`,
    cash: `Each down payment is solved so cash to close matches ${whose} ${money(tVal.cash)}. Prices and rates stay as entered.`,
    both: `Price and down payment are solved together to match ${whose} ${money(tVal.net)}/mo net payment and ${money(tVal.cash)} cash to close. Rate and rent stay as entered.`,
  })[lens.mode] + (lens.mode === "off" ? "" : checkSuffix + " A what-if estimate: saved options don't change.");

  // ── Fold rows that match across every option into one strip ──
  const eqv = (get, tol = 0.5) => { const v = cols.map(get); return v.every(x => x != null && Math.abs(x - v[0]) < tol) ? v[0] : undefined; };
  const folded = new Set(), sameItems = [];
  const fold = (keysToHide, label, value) => { keysToHide.forEach(k => folded.add(k)); if (label) sameItems.push([label, value]); };
  if (!unfold && n > 1) {
    const price = eqv(c => c.m.salesPrice), down = eqv(c => c.m.downAmt);
    if (price !== undefined && down !== undefined) fold(["price", "down"], "Price", money(price));
    if (down !== undefined) fold(["down"], "Down", `${short(down)} · ${pctTxt(cols[0].m.downPct)}`);
    const loan = eqv(c => c.m.loan);
    if (loan !== undefined) fold(["loan"], "Loan", money(loan));
    if (eqv(c => c.m.rate, 0.0001) !== undefined && eqv(c => c.m.term) !== undefined && cols.every(c => c.m.loanType === cols[0].m.loanType)) fold(["rate", "term", "type"], "Rate", `${rateTxt(cols[0].m.rate)} · ${cols[0].m.term}-yr ${cols[0].m.loanType}`);
    const p = eqv(c => c.d.principal), i = eqv(c => c.d.interest);
    if (p !== undefined && i !== undefined) fold(["principal", "interest"], "Principal & interest", `${money(p + i)}/mo`);
    [["tax", "Tax", c => c.m.monthlyTax || 0], ["ins", "Insurance", c => c.m.ins || 0], ["mi", "Mortgage ins.", c => c.m.mi || 0], ["other", "HELOC & other", c => c.d.other], ["hoa", "HOA", c => c.m.hoaM || 0], ["rent", "Unit rents", c => c.m.rent || 0]]
      .forEach(([k, l, get]) => { const v = eqv(get); if (v !== undefined) fold([k], v > 0.5 ? l : null, `${k === "rent" ? "−" : ""}${money(v)}/mo`); });
    const cc = eqv(c => c.m.closingCosts);
    if (cc !== undefined) fold(["closing", "closing5"], "Closing costs", money(cc));
    const pre = eqv(c => c.d.prepaids);
    if (pre !== undefined) fold(["prepaids"], "Prepaids", money(pre));
    const i5 = eqv(c => c.d.int5);
    if (i5 !== undefined) fold(["int5"], "Interest, 5 yrs", money(i5));
    const m5 = eqv(c => c.d.mi5);
    if (m5 !== undefined) fold(["mi5"], m5 > 0.5 ? "MI, 5 yrs" : null, money(m5));
    const eq5 = eqv(c => c.d.equity5);
    if (eq5 !== undefined) fold(["equity5"], "Equity, 5 yrs", money(eq5));
  }
  const shown = k => !folded.has(k);

  // ── Grid ──
  const grid = isDesktop ? `minmax(150px, 200px) repeat(${n}, minmax(0, 1fr))` : `repeat(${n}, minmax(0, 1fr))`;
  const padX = isDesktop ? 16 : tight ? 8 : 12;
  const align = isDesktop ? "center" : "flex-start";
  const tint = c => c.e.isCurrent ? `${T.blue}0b` : "transparent";
  const card = { background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, boxShadow: T.cardShadow, overflow: "hidden" };
  const glass = { background: T.glass, WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)", border: `1px solid ${T.glassBorder}`, borderRadius: 14, boxShadow: T.glassShadow };

  const row = (key, { label, sub, dot, tag, kind = "row" }, render) => {
    if (!shown(key)) return null;
    const band = kind === "band", over = kind === "price" || kind === "loan" || kind === "ring";
    return (
      <div key={key} style={{ display: "grid", gridTemplateColumns: grid, borderTop: band ? `1.5px solid ${T.blue}40` : `1px solid ${T.separator}`, background: band ? `${T.blue}0e` : "transparent", alignItems: band || over ? "stretch" : "start" }}>
        <div style={{ ...(isDesktop ? { padding: band ? "16px 16px" : over ? "16px 16px 10px" : "10px 16px" } : { gridColumn: "1 / -1", padding: `${band ? 11 : 9}px ${padX}px 0` }),
          display: "flex", flexWrap: "wrap", alignItems: over ? "flex-start" : "center", alignContent: "flex-start", gap: "4px 7px", minWidth: 0, fontFamily: FONT,
          ...(over ? overline : band ? { fontSize: isDesktop ? 12 : 11, fontWeight: 700, color: T.blue, letterSpacing: "0.08em", textTransform: "uppercase" }
            : { fontSize: isDesktop ? 13 : 12, color: kind === "sub" ? T.text : kind === "adv" ? T.textTertiary : T.textSecondary, fontWeight: kind === "sub" ? 600 : 400 }) }}>
          {dot && <span style={{ width: 8, height: 8, borderRadius: 4, background: dot, flexShrink: 0 }} />}
          <span>{label}{sub && isDesktop && <span style={{ display: "block", fontFamily: FONT, fontSize: 11, color: T.textTertiary, fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>{sub}</span>}</span>
          {tag}
        </div>
        {cols.map((c, i) => (
          <div key={i} style={{ background: tint(c), minWidth: 0, fontFamily: FONT, textAlign: isDesktop ? "center" : "left",
            padding: isDesktop ? (band || over ? "14px 16px" : kind === "adv" ? "9px 16px" : "10px 16px") : `${over || band ? 4 : 3}px ${padX}px ${band || over ? 12 : 9}px`,
            ...(band ? { fontSize: isDesktop ? 19 : 16, fontWeight: 800, color: T.blue, letterSpacing: "-0.02em", display: "flex", flexDirection: "column", alignItems: align, gap: 4 }
              : kind === "price" ? { display: "flex", flexDirection: "column", alignItems: align, gap: 3 }
              : kind === "ring" ? { display: "flex", justifyContent: "center", padding: isDesktop ? "14px 10px" : "6px 2px 12px" }
              : kind === "loan" ? { fontSize: isDesktop ? 17 : 14, fontWeight: 700, color: T.text }
              : { fontSize: isDesktop ? 14 : 13, fontWeight: kind === "sub" ? 700 : kind === "adv" ? 500 : 600, color: kind === "adv" ? T.textTertiary : T.text }) }}>
            {render(c, i)}
          </div>
        ))}
      </div>
    );
  };
  const band = (key, label, f, win) => row(key, { label, kind: "band", tag: heldTag(key) }, c => <>
    <span>{f(c)}</span>
    {W[key] && W[key].c === c && winPill(win)}
    {budgetTag(key, c)}
  </>);
  const slimHead = (
    <div style={{ display: "grid", gridTemplateColumns: grid, background: `linear-gradient(135deg, ${T.blue}18, ${T.blue}0c)`, borderBottom: `1px solid ${T.blue}38` }}>
      {isDesktop && <div style={{ padding: "9px 16px", alignSelf: "center", fontFamily: MONO, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: T.blue, fontWeight: 600 }}>Option</div>}
      {cols.map((c, i) => (
        <div key={i} style={{ background: tint(c), padding: `${isDesktop ? 9 : 8}px ${padX}px`, display: "flex", alignItems: "center", justifyContent: isDesktop ? "center" : "flex-start", gap: 7, minWidth: 0 }}>
          {badge(c.e.name)}<b style={{ fontSize: 13, fontFamily: FONT, color: T.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: tight ? "nowrap" : "normal" }}>{c.e.name}</b>
        </div>
      ))}
    </div>
  );
  const secBar = (title, extra) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: isDesktop ? "11px 16px" : "10px 14px", borderRadius: 12, background: `linear-gradient(90deg, ${T.blue}, ${T.accentDeep})`, color: "#fff", fontFamily: FONT, fontWeight: 700, fontSize: 15, boxShadow: `0 8px 18px -10px ${T.accentDeep}b3` }}>
      <span style={{ width: 5, height: 5, borderRadius: 9, background: "currentColor", opacity: 0.75 }} />{title}{extra}
    </div>
  );
  const barPill = { font: `600 12px ${FONT}`, color: "#fff", background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.38)", borderRadius: 9999, padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap" };
  const PARTS = [
    ["principal", "Principal", T.cyan, c => c.d.principal],
    ["interest", "Interest", T.blue, c => c.d.interest],
    ["tax", "Tax", T.orange, c => c.m.monthlyTax || 0],
    ["ins", "Insurance", T.green, c => c.m.ins || 0],
    ["mi", "Mortgage insurance", T.red, c => c.m.mi || 0],
    ["other", "HELOC & other", T.pink, c => c.d.other],
    ["hoa", "HOA", T.purple, c => c.m.hoaM || 0],
  ].filter(([k, , , get]) => k !== "other" || cols.some(c => get(c) > 0));
  const miNote = m => !(m.mi > 0) ? null : m.miMode === "conv" ? "PMI · drops at 78% LTV" : m.miMode === "fha-11" ? "MIP · 11 years" : m.miMode === "fha-life" ? "MIP · life of loan" : null;
  const ringSize = isDesktop ? 124 : n > 3 ? 70 : 92;
  const anyRent = cols.some(c => (c.m.rent || 0) > 0);
  const pickMine = () => setMine(m => ({ price: m.price ?? Math.round(bm.salesPrice), net: m.net ?? Math.round(netOf(bm)), cash: m.cash ?? Math.round(bm.cashToClose) }));
  const setTarget = v => { if (v === MINE) pickMine(); setLens(s => ({ ...s, target: v })); };

  // ── The payoff card (same data, laid out as a 1200px newsletter image) ──
  const snapData = buildSnapshot({ cols, n, lens, held, W, solving, sentences, rented, sameItems, PARTS, checkNet, checkCash, fitsNet, fitsCash, mine, tVal, money, short, pctTxt, rateTxt, letterOf, useMine });

  return (<div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
    {secBar("Compare", <>
      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", opacity: 0.8, fontWeight: 600 }}>{all.length > MAX_COLS ? `${n} of ${all.length} options` : `${n} options`}</span>
      <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button type="button" onClick={() => setShot(true)} style={barPill}>Full screen</button>
        {onAddOption && <button type="button" onClick={onAddOption} style={barPill}>+ Add option</button>}
      </span>
    </>)}
    {/* The payoff first: the newsletter card, inline. Details follow below. */}
    <InlineSnapshot data={snapData} dark={T.bg === DARK.bg} />
    {all.length > MAX_COLS && (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: T.textSecondary, fontFamily: FONT }}>
        <span>Pick up to {MAX_COLS}:</span>
        {all.map(e => {
          const on = pickNames.includes(e.name), disabled = !on && pickNames.length >= MAX_COLS;
          return <button key={e.name} onClick={() => togglePick(e.name)} disabled={disabled} aria-pressed={on}
            style={{ font: `600 12px ${FONT}`, padding: "5px 12px", borderRadius: 9999, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1,
              background: on ? `${T.blue}18` : T.inputBg, color: on ? T.blue : T.textSecondary, border: `1px solid ${on ? T.blue + "66" : T.separator}` }}>{letterOf(e.name)} · {e.name}</button>;
        })}
      </div>
    )}

    {/* Line them up by */}
    {requote && (
      <div style={{ ...glass, padding: "12px 14px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px 14px" }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.textTertiary, fontFamily: FONT }}>Line them up by</span>
        <span role="group" aria-label="Hold one number equal" style={{ display: isDesktop ? "inline-flex" : "grid", gridTemplateColumns: "1fr 1fr", width: isDesktop ? "auto" : "100%", gap: 3, padding: 3, borderRadius: isDesktop ? 9999 : 16, background: T.pillBg, border: `1px solid ${T.separator}`, flexWrap: "wrap" }}>
          {LENS_MODES.map(([m, l], i) => {
            const on = lens.mode === m;
            return <button key={m} type="button" aria-pressed={on} onClick={() => setLens(s => ({ ...s, mode: m }))}
              style={{ gridColumn: !isDesktop && i === 0 ? "1 / -1" : undefined, border: "none", background: on ? T.card : "transparent", color: on ? T.blue : T.textSecondary, boxShadow: on ? T.cardShadow : "none", font: `600 12px ${FONT}`, padding: "6px 12px", borderRadius: isDesktop ? 9999 : 12, cursor: "pointer", whiteSpace: "nowrap" }}>{l}</button>;
          })}
        </span>
        {lens.mode !== "off" ? (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textSecondary, fontFamily: FONT }}>
            Match to
            <select value={useMine ? MINE : targetE.name} onChange={e => setTarget(e.target.value)}
              style={{ font: `600 12px ${FONT}`, color: T.text, background: T.card, border: `1px solid ${T.separator}`, borderRadius: 9999, padding: "5px 10px", cursor: "pointer" }}>
              {entries.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
              <option value={MINE}>My numbers</option>
            </select>
          </label>
        ) : (
          <button type="button" aria-pressed={useMine} onClick={() => setTarget(useMine ? null : MINE)}
            style={{ font: `600 12px ${FONT}`, borderRadius: 9999, padding: "6px 12px", cursor: "pointer", whiteSpace: "nowrap", color: useMine ? T.blue : T.textSecondary, background: useMine ? `${T.blue}14` : "none", border: `1px solid ${useMine ? T.blue + "55" : T.separator}` }}>
            {useMine ? "Checking against my budget" : "Check against my budget"}
          </button>
        )}
        {useMine && (
          <div style={{ flexBasis: "100%", display: "flex", flexWrap: "wrap", gap: "10px 14px" }}>
            {lens.mode === "price" && <MoneyBox T={T} label="Purchase price" value={mine.price} strong onChange={v => setMine(m => ({ ...m, price: v }))} />}
            <MoneyBox T={T} label={lens.mode === "payment" || lens.mode === "both" ? "Net payment" : "Max net payment"} suffix="/mo" value={mine.net} strong={lens.mode === "payment" || lens.mode === "both"} onChange={v => setMine(m => ({ ...m, net: v }))} />
            <MoneyBox T={T} label={lens.mode === "cash" || lens.mode === "both" ? "Cash to close" : "Max cash to close"} value={mine.cash} strong={lens.mode === "cash" || lens.mode === "both"} onChange={v => setMine(m => ({ ...m, cash: v }))} />
          </div>
        )}
        <div style={{ flexBasis: "100%", fontSize: 12.5, color: T.textSecondary, display: "flex", gap: 8, alignItems: "flex-start", lineHeight: 1.45, fontFamily: FONT }}>
          <span style={{ width: 6, height: 6, borderRadius: 9, background: T.blue, marginTop: 6, flexShrink: 0 }} />{lensNote}
        </div>
      </div>
    )}

    {/* The short version */}
    {sentences.length > 0 && (
      <div style={{ ...glass, padding: isDesktop ? "14px 18px" : "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: T.textTertiary, fontWeight: 700, fontFamily: FONT }}>The short version</div>
          {n > 2 && (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textSecondary, fontFamily: FONT }}>
              Compare
              <select value={headToHead ? pair : ""} onChange={e => setPair(e.target.value)} aria-label="Which options the short version compares"
                style={{ font: `600 12px ${FONT}`, color: T.text, background: T.card, border: `1px solid ${T.separator}`, borderRadius: 9999, padding: "5px 10px", cursor: "pointer" }}>
                <option value="">All {n} options</option>
                {pairOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          )}
        </div>
        <p style={{ margin: "6px 0 0", fontSize: isDesktop ? 15 : 14, lineHeight: 1.5, fontWeight: 500, color: T.text, fontFamily: FONT, textWrap: "pretty" }}>
          {sentences.flat().map((p, i) => <span key={i} style={p.c ? { color: T[p.c], fontWeight: 700 } : p.b ? { fontWeight: 700 } : null}>{p.t}</span>)}
        </p>
      </div>
    )}

    {/* Same for all — the rows that match everywhere, folded */}
    {(sameItems.length > 0 || unfold) && (
      <div style={{ ...glass, padding: isDesktop ? "12px 18px" : "12px 14px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px 22px", fontFamily: FONT }}>
        <span style={{ ...overline, color: T.blue }}>{unfold ? "Every row shown" : `Same for all ${n}`}</span>
        {sameItems.map(([l, v]) => (
          <span key={l} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 11, color: T.textTertiary }}>{l}</span>
            <b style={{ fontSize: 14, color: T.text, fontWeight: 700 }}>{v}</b>
          </span>
        ))}
        <button type="button" onClick={() => setUnfold(u => !u)} style={{ marginLeft: "auto", font: `600 12px ${FONT}`, color: T.blue, background: "none", border: "none", cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}>{unfold ? "Fold matching rows" : "Show as rows"}</button>
      </div>
    )}

    {/* Column heads: the mini Blueprints */}
    <div style={card}>
      <div style={{ display: "grid", gridTemplateColumns: grid, background: `linear-gradient(135deg, ${T.blue}18, ${T.blue}0c)`, borderBottom: `1px solid ${T.blue}38` }}>
        {isDesktop && <div style={{ padding: "12px 16px", alignSelf: "center", fontFamily: MONO, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: T.blue, fontWeight: 600 }}>{n} options</div>}
        {cols.map((c, i) => (
          // Same stack in every column (badge, name, spec, button) so names
          // line up whether or not the spec line carries an Est. tag.
          <div key={i} style={{ background: tint(c), padding: `${isDesktop ? 14 : 10}px ${isDesktop ? 14 : padX}px`, display: "flex", flexDirection: "column", alignItems: align, gap: 6, minWidth: 0, textAlign: isDesktop ? "center" : "left", fontFamily: FONT }}>
            {badge(c.e.name)}
            <b style={{ fontSize: isDesktop ? 15 : 13, color: T.text, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: tight ? "nowrap" : "normal" }}>{c.e.name}</b>
            {isDesktop && <span style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.4 }}>{(!c.e.isCurrent || c.adj) && est}{c.m.loanType} · {c.m.term}-yr · {rateTxt(c.m.rate)}</span>}
            <button type="button" onClick={() => !c.e.isCurrent && switchScenario(c.e.name)} disabled={c.e.isCurrent}
              style={{ marginTop: "auto", font: `600 11px ${FONT}`, borderRadius: 9999, padding: "3px 10px", whiteSpace: "nowrap", background: "none", color: c.e.isCurrent ? T.textTertiary : T.blue, border: `1px solid ${c.e.isCurrent ? T.separator : T.blue + "4d"}`, cursor: c.e.isCurrent ? "default" : "pointer" }}>{c.e.isCurrent ? "Viewing" : "Open"}</button>
          </div>
        ))}
      </div>
      {row("price", { label: "Purchase price", kind: "price", tag: heldTag("price") }, c => {
        const o = c.e.metrics, priceAdj = Math.abs(c.m.salesPrice - o.salesPrice) > 1, downAdj = Math.abs(c.m.downAmt - o.downAmt) > 1;
        const min = minDownFor(c.m);
        return <>
          <span style={{ fontSize: isDesktop ? 24 : tight ? 14 : 17, fontWeight: 800, letterSpacing: "-0.02em", color: priceAdj ? T.blue : T.text }}>{moneyFit(c.m.salesPrice)}</span>
          <span style={{ fontSize: isDesktop ? 13 : 11.5, color: T.textSecondary }}>{isDesktop || !tight ? "Down " : ""}<b style={{ color: priceAdj || downAdj ? T.blue : T.text, fontWeight: 700 }}>{moneyFit(c.m.downAmt)}</b> · {pctTxt(c.m.downPct)}</span>
          {priceAdj ? small(`was ${short(o.salesPrice)}`) : downAdj ? small(`was ${short(o.downAmt)}${isDesktop ? " down" : ""}`) : null}
          {min && c.m.downPct < min.pct - 0.001 && small(isDesktop ? `Below the ${min.pct}% minimum for ${min.label}` : `Below ${min.pct}% min.`, T.orange)}
          {W.price && W.price.c === c && winPill("Most home")}
        </>;
      })}
      {row("loan", { label: "Loan amount", kind: "loan" }, c => {
        const adj = Math.abs(c.m.loan - c.e.metrics.loan) > 1;
        return <><span style={{ color: adj ? T.blue : T.text }}>{moneyFit(c.m.loan)}</span>{small(`${pctTxt((c.m.ltv || 0) * 100)} LTV`)}</>;
      })}
      {row("ring", { label: "Payment split", sub: "Ring colors match the rows below", kind: "ring" }, c => (
        <Ring T={T} size={ringSize} segs={PARTS.map(([k, , col, get]) => ({ k, c: col, v: get(c) }))} label={(c.m.rent || 0) > 0 ? "Net / mo" : "Monthly"} value={isDesktop || n < 4 ? money(c.d.net) : short(c.d.net)} />
      ))}
    </div>

    {secBar("Monthly Payment")}
    <div style={card}>
      {slimHead}
      {PARTS.map(([k, l, col, get]) => row(k, { label: l, dot: col }, c => get(c) > 0.5 ? <>{mo(get(c))}{k === "mi" && isDesktop && miNote(c.m) && small(miNote(c.m))}</> : dash))}
      {/* With no rent anywhere the band already is the total. */}
      {anyRent && row("total", { label: "Total payment", kind: "sub" }, c => mo(c.m.monthlyPayment))}
      {anyRent && row("rent", { label: "Unit rents", sub: "You collect the full rent" }, c => (c.m.rent || 0) > 0
        ? <><span><span style={{ color: T.green }}>−{money(c.m.rent)}</span><span style={{ fontSize: 11, color: T.textTertiary, fontWeight: 500 }}>/mo</span></span>{isDesktop && small("Lenders count 75%")}</> : dash)}
      {band("net", anyRent ? "Net payment" : "Total payment", c => mo(c.d.net), "Lowest")}
    </div>

    {secBar("Cash to Close")}
    <div style={card}>
      {slimHead}
      {row("down", { label: "Down payment" }, c => <>{money(c.m.downAmt)}{isDesktop && small(`${pctTxt(c.m.downPct)} of ${short(c.m.salesPrice)}`)}</>)}
      {row("closing", { label: "Closing costs" }, c => money(c.m.closingCosts))}
      {row("prepaids", { label: "Prepaids and credits", sub: "Taxes, insurance, interest, less credits" }, c => money(c.d.prepaids))}
      {band("cash", "Cash to close", c => money(c.m.cashToClose), "Least")}
    </div>

    {secBar("Over Time")}
    <div style={card}>
      {slimHead}
      {row("int5", { label: "Interest", sub: "First 5 years" }, c => money(c.d.int5))}
      {row("mi5", { label: "Mortgage insurance", sub: "First 5 years" }, c => c.d.mi5 > 0.5 ? money(c.d.mi5) : dash)}
      {row("closing5", { label: "Closing costs" }, c => money(c.m.closingCosts))}
      {band("cost5", "Cost to borrow, 5 yrs", c => money(c.d.cost5), "Lowest")}
      {row("equity5", { label: "Equity after 5 years, before appreciation", kind: "adv" }, c => c.d.equity5 == null ? dash : money(c.d.equity5))}
      {showMore && <>
        {row("rate", { label: "Rate" }, c => rateTxt(c.m.rate))}
        {row("term", { label: "Term" }, c => `${c.m.term} yr`)}
        {row("type", { label: "Loan type" }, c => c.m.loanType)}
        {row("apr", { label: "APR", sub: "Estimated" }, c => c.m.apr > 0 ? rateTxt(c.m.apr) : dash)}
        {row("dti", { label: "DTI" }, c => c.m.dti == null ? dash : pctTxt(c.m.dti * 100))}
        {row("int", { label: "Total interest", sub: "Full term" }, c => short(c.m.totalInt))}
      </>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: `1px solid ${T.separator}`, fontSize: 12, color: T.textTertiary, background: T.inputBg, fontFamily: FONT }}>
        <span>{showMore ? "Rate, term, loan type, APR, DTI and total interest" : "Rate, APR, DTI, total interest and the cost chart"}</span>
        <button type="button" onClick={() => setShowMore(v => !v)} style={{ font: `600 12px ${FONT}`, color: T.blue, background: "none", border: "none", cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}>{showMore ? "Show fewer" : "See every number"}</button>
      </div>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 11.5, color: T.textTertiary, fontFamily: FONT }}>
      <span>Est. = quick estimate. Open an option for exact figures.</span>
      {refiCount > 0 && <span>{refiCount} refinance {refiCount === 1 ? "option isn't" : "options aren't"} shown here. Open one to compare refinances.</span>}
    </div>
    {showMore && <div style={{ marginTop: -14 }}><CostChart T={T} entries={entries} refiMode={false} colorOf={colorOf} fmt={fmt} privacy={privacy} isDesktop={isDesktop} S={{ card: { background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, boxShadow: T.cardShadow }, label: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: T.textTertiary, fontWeight: 700, fontFamily: FONT } }} /></div>}
    {shot && <CompareSnapshot data={snapData} dark={T.bg === DARK.bg} onClose={() => setShot(false)}
      pairControl={n > 2 ? { value: headToHead ? pair : "", allLabel: `All ${n} options`, options: pairOptions, onChange: setPair } : null} />}
  </div>);
}

// Turns the on-screen comparison into the newsletter card's content:
// headline, one card per option (only the rows that differ), the shared
// strip, a one-line takeaway and the ad disclosure.
function buildSnapshot({ cols, n, lens, held, W, solving, sentences, rented, sameItems, PARTS, checkNet, checkCash, fitsNet, fitsCash, mine, tVal, money, short, pctTxt, rateTxt, letterOf, useMine }) {
  const word = COUNT_WORDS[n] || String(n);
  const allEq = get => cols.every(c => Math.abs(get(c) - get(cols[0])) < 0.5);
  const samePrice = allEq(c => c.m.salesPrice), sameRate = cols.every(c => Math.abs(c.m.rate - cols[0].m.rate) < 0.0001 && c.m.term === cols[0].m.term);
  const nets = cols.map(c => c.d.net), spread = (Math.max(...nets) - Math.min(...nets)) / Math.max(1, Math.max(...nets));
  const names = cols.map(c => c.e.name);
  const nameList = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  const terms = sameRate ? ` at ${rateTxt(cols[0].m.rate)} on a ${cols[0].m.term}-year loan` : "";

  let headline, sub, stamp = "Side by side";
  if (solving) {
    headline = [`${money(tVal.net)}/mo${lens.mode === "both" ? ` and ${short(tVal.cash)} cash` : ""}.`, "How much home does each buy?"];
    sub = `Prices solved so each lands on the same ${lens.mode === "both" ? "payment and cash to close" : "net payment"}${terms}.`;
    stamp = "Built to a budget";
  } else if (lens.mode === "cash") {
    headline = [`${short(tVal.cash)} to close.`, `${word} ways to spend it.`];
    sub = `Down payments solved so each needs the same cash${terms}.`;
  } else if (samePrice) {
    headline = [`Same ${short(cols[0].m.salesPrice)} purchase price.`, spread > 0.05 ? `${word} very different payments.` : `${word} ways to buy.`];
    sub = `${nameList} at the same price${cols.every(c => Math.abs(c.m.downPct - cols[0].m.downPct) < 0.05) ? `, ${pctTxt(cols[0].m.downPct)} down` : ""}${terms}.`;
  } else {
    headline = [`${word} options,`, "side by side."];
    sub = `${nameList}${terms}.`;
  }

  const ribbonKey = solving ? "price" : "net";
  const winC = W[ribbonKey] ? W[ribbonKey].c : null;
  const differs = get => !allEq(get);
  // Property type only when the option's name doesn't already say it.
  const subLine = (m, name) => [!String(name).toLowerCase().includes(String(m.propType || "").toLowerCase()) && m.propType, m.hoaM > 0.5 && `HOA ${money(m.hoaM)}/mo`, m.rent > 0.5 && `rents ${money(m.rent)}/mo`].filter(Boolean).join(" · ");
  const cards = cols.map(c => {
    const rows = [];
    if (differs(x => x.m.salesPrice)) rows.push({ label: "Home price", value: money(c.m.salesPrice), tone: Math.abs(c.m.salesPrice - c.e.metrics.salesPrice) > 1 ? "blue" : null });
    if (differs(x => x.m.downAmt)) rows.push({ label: "Down payment", value: `${short(c.m.downAmt)} · ${pctTxt(c.m.downPct)}` });
    if (cols.some(x => (x.m.rent || 0) > 0)) rows.push({ label: "Total payment", value: money(c.m.monthlyPayment) });
    [["Insurance", x => x.m.ins || 0], ["HOA", x => x.m.hoaM || 0], ["Mortgage ins.", x => x.m.mi || 0]]
      .forEach(([l, get]) => { if (differs(get)) rows.push({ label: l, value: get(c) > 0.5 ? money(get(c)) : "—", tone: get(c) > 0.5 ? null : "muted" }); });
    if (differs(x => x.m.rent || 0)) rows.push({ label: "Rent collected", value: c.m.rent > 0.5 ? `−${money(c.m.rent)}` : "—", tone: c.m.rent > 0.5 ? "green" : "muted" });
    rows.push({ label: "Cash to close", value: money(c.m.cashToClose), tone: "strong" });
    const status = [];
    if (checkNet) status.push(fitsNet(c) ? { ok: true, text: "Payment fits" } : { ok: false, text: `${money(c.d.net - mine.net)}/mo over` });
    if (checkCash) status.push(fitsCash(c) ? { ok: true, text: "Cash fits" } : { ok: false, text: `Cash ${money(c.m.cashToClose - mine.cash)} over` });
    const min = minDownFor(c.m);
    return {
      letter: letterOf(c.e.name), name: c.e.name, sub: subLine(c.m, c.e.name),
      segs: PARTS.map(([, , col, get]) => ({ c: col, v: get(c) })),
      ringLabel: c.m.rent > 0.5 ? "Net / mo" : "Per month", ringValue: money(c.d.net), ringNote: c.m.rent > 0.5 ? "after rent" : "all in",
      // No "if the unit sits empty" line here: the Total payment row already says it.
      note: null,
      flag: min && c.m.downPct < min.pct - 0.001 ? `Below the ${min.pct}% minimum for ${min.label}` : null,
      status, rows, win: winC === c ? (solving ? "Most home" : "Lowest payment") : null,
    };
  });
  const legend = PARTS.filter(([, , , get]) => cols.some(c => get(c) > 0.5)).map(([, l, col]) => ({ l: l === "Mortgage insurance" ? "Mortgage ins." : l, c: col }));
  // "My numbers" shown on the card when they're the budget or the target.
  const budget = useMine ? [
    (checkNet || held.includes("net")) && { v: `${money(tVal.net)}/mo`, l: "net" },
    (checkCash || held.includes("cash")) && { v: money(tVal.cash), l: "cash to close" },
  ].filter(Boolean) : null;
  const termOf = c => `${money(c.m.salesPrice)}, ${pctTxt(c.m.downPct)} down, ${money(c.m.loan)} ${c.m.term}-year ${c.m.loanType} at ${rateTxt(c.m.rate)}${c.m.apr > 0 ? ` (APR ${rateTxt(c.m.apr)})` : ""}`;
  const terms2 = cols.every(c => termOf(c) === termOf(cols[0])) ? [`All ${word.toLowerCase()}: ${termOf(cols[0])}`] : cols.map(c => `${c.e.name}: ${termOf(c)}`);
  return {
    headline, sub, stamp, budget, cards, legend,
    // Five fit across the 1200px card; the rate drops the loan type to stay on one line.
    same: sameItems.slice(0, 5).map(([l, v]) => ({ l, v: l === "Rate" ? v.replace(/(-yr).*$/, "$1") : v })),
    take: sentences[0] || null,
    disclosure: `Example only, not a loan offer or commitment. ${terms2.join("; ")}. Payments include principal, interest, estimated property tax and homeowners insurance, plus HOA and mortgage insurance where shown${rented ? "; net payments subtract the rent shown" : ""}. Rates, APRs and payments are estimates and vary by borrower and market.`,
  };
}

// Payment ring with the net payment in the middle — Overview's PayRing
// colors, sized to sit in a compare column.
function Ring({ T, size, segs, label, value }) {
  const sw = Math.max(9, Math.round(size / 9)), r = (size - sw) / 2, circ = 2 * Math.PI * r;
  const live = segs.filter(s => s.v > 0.5), total = live.reduce((a, s) => a + s.v, 0);
  let off = 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.ringTrack} strokeWidth={sw} />
        {total > 0 && live.map(s => {
          const len = s.v / total * circ;
          const el = <circle key={s.k} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.c} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${Math.max(0.1, len - 3)} ${circ}`} strokeDashoffset={-off} />;
          off += len;
          return el;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
        <span style={{ fontFamily: MONO, fontSize: size > 100 ? 9 : 7, letterSpacing: "0.12em", textTransform: "uppercase", color: T.textTertiary, fontWeight: 600 }}>{label}</span>
        <b style={{ fontSize: size > 100 ? 19 : size > 80 ? 14 : 11.5, fontWeight: 800, color: T.text, letterSpacing: "-0.02em" }}>{value}</b>
      </div>
    </div>
  );
}
