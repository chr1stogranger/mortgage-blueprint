import { FONT, MONO } from "../lib/fonts.js";
import React, { useMemo, useRef, useState } from "react";
import { winnerBy, firstLeaderChange } from "../lib/compareMetrics.js";
import { LENS_MODES, LENS_HELD, netOf, solveLens, minDownFor } from "../lib/compareLens.js";

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
   loan, payment ring); below, every line runs straight across one grid
   so the numbers line up, grouped like Overview's Payment Breakdown and
   Cash to Close cards, each ending in a blue total band with the winner.
   "Line them up by" re-quotes the other options with one number held
   equal (lib/compareLens.js); it's a what-if, saved options don't change. */
const LETTERS = "ABCDEFGH";

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

function BlueprintCompare({ T, isDesktop, fmt, compareData, compareLoading, scenarioName, switchScenario, onAddOption, privacy, requote }) {
  const [picked, setPicked] = useState(null);
  const [lens, setLens] = useState({ mode: "off", target: null });
  const [showMore, setShowMore] = useState(false);
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

  const targetE = entries.find(e => e.name === lens.target) || entries.find(e => e.isCurrent) || entries[0];
  const entryKey = entries.map(e => e.name).join("|");
  // Solving re-quotes each option a few thousand times in "Same payment + cash";
  // keyed on the data and the lens only, not on every parent render.
  const cols = useMemo(() => {
    const tm = targetE && targetE.metrics;
    const t = tm ? { price: tm.salesPrice, net: netOf(tm), cash: tm.cashToClose } : null;
    return entries.map(e => {
      let m = e.metrics, adj = false;
      if (lens.mode !== "off" && t && e !== targetE && e.state && requoteRef.current) {
        const quote = (price, downPct) => requoteRef.current(e.state, { salesPrice: price, downPct });
        const solved = solveLens(lens.mode, t, quote, { price: e.metrics.salesPrice, downPct: e.metrics.downPct });
        if (solved) { m = solved; adj = true; }
      }
      return { e, m, adj, d: compareDetail(m) };
    });
  }, [compareData, entryKey, lens.mode, targetE && targetE.name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (compareLoading && all.length === 0) {
    return <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, boxShadow: T.cardShadow, marginTop: 20, padding: 24, textAlign: "center", color: T.textSecondary }}>Loading comparison…</div>;
  }
  if (all.length <= 1) return <SpecSheetCompare T={T} isDesktop={isDesktop} fmt={fmt} compareData={compareData} compareLoading={compareLoading} scenarioName={scenarioName} switchScenario={switchScenario} onAddOption={onAddOption} privacy={privacy} />;

  const n = cols.length, tight = !isDesktop && n > 3;
  const held = LENS_HELD[lens.mode] || [];
  const tName = targetE.name, tm = targetE.metrics;

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
  const mo = v => <>{money(v)}<span style={{ fontSize: 11, color: T.textTertiary, fontWeight: 500 }}>/mo</span></>;
  const dash = <span style={{ color: T.textTertiary, fontWeight: 500 }}>—</span>;
  const small = (t, color) => <span style={{ display: "block", fontSize: 11, color: color || T.textTertiary, fontWeight: 500, letterSpacing: 0 }}>{t}</span>;
  const CHECK = <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3L12.5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  const winPill = t => <span style={{ display: "inline-flex", alignItems: "center", gap: 5, font: `600 11px ${FONT}`, color: T.green, background: `${T.green}1c`, borderRadius: 9999, padding: "4px 10px", whiteSpace: "nowrap", letterSpacing: 0 }}>{CHECK}{t}</span>;
  const heldTag = key => held.includes(key) ? <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, color: T.blue, background: `${T.blue}18`, border: `1px solid ${T.blue}38`, borderRadius: 9999, padding: "2px 8px" }}>Held equal</span> : null;
  const badge = name => <span style={{ width: 22, height: 22, borderRadius: 7, background: `${T.blue}1c`, color: T.blue, font: `700 12px ${FONT}`, display: "inline-grid", placeItems: "center", flexShrink: 0 }}>{letterOf(name)}</span>;
  const est = <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textTertiary, border: `1px solid ${T.separator}`, borderRadius: 9999, padding: "0 5px", marginRight: 4 }}>Est.</span>;
  const overline = { fontFamily: MONO, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: T.textTertiary, fontWeight: 600 };

  // ── Winners: best per row, skipping whatever the lens holds equal ──
  const GET = { net: c => c.d.net, cash: c => c.m.cashToClose, cost5: c => c.d.cost5, price: c => c.m.salesPrice };
  const top = (key, dir, tol) => {
    if (held.includes(key)) return null;
    const ranked = cols.filter(c => GET[key](c) != null).sort((a, b) => dir === "min" ? GET[key](a) - GET[key](b) : GET[key](b) - GET[key](a));
    if (ranked.length < 2) return null;
    const gap = Math.abs(GET[key](ranked[0]) - GET[key](ranked[1]));
    return gap < tol ? null : { c: ranked[0], runner: ranked[1], gap };
  };
  const W = { net: top("net", "min", 3), cash: top("cash", "min", 300), cost5: top("cost5", "min", 300),
    price: ["payment", "cash", "both"].includes(lens.mode) ? top("price", "max", 300) : null };

  // ── The short version ──
  const PH = { net: "has the lowest net payment", cash: "needs the least cash to close", cost5: "costs the least to borrow over 5 years",
    price: `buys the most home for the same ${lens.mode === "payment" ? "payment" : lens.mode === "cash" ? "cash" : "payment and cash"}` };
  const keys = lens.mode === "both" ? ["price", "cost5"] : lens.mode === "payment" ? ["price", "cash", "cost5"] : lens.mode === "cash" ? ["net", "cost5", "price"] : ["net", "cash", "cost5"];
  const groups = [];
  keys.filter(k => W[k]).forEach(k => { const g = groups.find(x => x.c === W[k].c); if (g) g.keys.push(k); else groups.push({ c: W[k].c, keys: [k] }); });
  const verdict = [];
  groups.forEach(g => {
    verdict.push({ t: g.c.e.name, b: 1 }, { t: " " });
    g.keys.forEach((k, i) => {
      verdict.push({ t: `${PH[k]}, ` }, { t: `${money(W[k].gap)}${k === "net" ? "/mo" : ""} ${k === "price" ? "more" : "less"}`, c: "green" }, { t: ` than ${W[k].runner.e.name}` });
      verdict.push({ t: i < g.keys.length - 1 ? ", and " : ". " });
    });
  });
  const rented = cols.find(c => (c.m.rent || 0) > 0);
  if (rented) verdict.push({ t: `If ${rented.e.name}'s rented unit sits empty, its payment is ` }, { t: `${money(rented.m.monthlyPayment)}/mo`, c: "orange" }, { t: "." });

  const lensNote = {
    off: "Each option as entered. Hold one number equal to see how the others change.",
    payment: `Each price is solved so the net payment matches ${tName}'s ${money(netOf(tm))}/mo. Down %, rate and rent stay as entered.`,
    cash: `Each down payment is solved so cash to close matches ${tName}'s ${money(tm.cashToClose)}. Prices and rates stay as entered.`,
    both: `Price and down payment are solved together to match ${tName}'s ${money(netOf(tm))}/mo net payment and ${money(tm.cashToClose)} cash to close. Rate and rent stay as entered.`,
    price: `Every option priced at ${tName}'s ${money(tm.salesPrice)}. Down %, rate and rent stay as entered.`,
  }[lens.mode] + (lens.mode === "off" ? "" : " A what-if estimate: saved options don't change.");

  // ── Grid ──
  const grid = isDesktop ? `minmax(150px, 1.2fr) repeat(${n}, minmax(0, 1fr))` : `repeat(${n}, minmax(0, 1fr))`;
  const padX = isDesktop ? 16 : tight ? 8 : 12;
  const tint = c => c.e.isCurrent ? `${T.blue}0b` : "transparent";
  const card = { background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, boxShadow: T.cardShadow, overflow: "hidden" };
  const glass = { background: T.glass, WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)", border: `1px solid ${T.glassBorder}`, borderRadius: 14, boxShadow: T.glassShadow };

  const row = (key, { label, sub, dot, tag, kind = "row" }, render) => {
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
          <div key={i} style={{ background: tint(c), minWidth: 0, fontFamily: FONT, textAlign: isDesktop ? "right" : "left",
            padding: isDesktop ? (band ? "14px 16px" : over ? "14px 16px" : kind === "adv" ? "9px 16px" : "10px 16px") : `${over || band ? 4 : 3}px ${padX}px ${band || over ? 12 : 9}px`,
            ...(band ? { fontSize: isDesktop ? 19 : 16, fontWeight: 800, color: T.blue, letterSpacing: "-0.02em", display: "flex", flexDirection: "column", alignItems: isDesktop ? "flex-end" : "flex-start", gap: 4 }
              : kind === "price" ? { display: "flex", flexDirection: "column", alignItems: isDesktop ? "flex-end" : "flex-start", gap: 3 }
              : kind === "ring" ? { display: "flex", justifyContent: "center", padding: isDesktop ? "14px 10px" : "6px 2px 12px" }
              : kind === "loan" ? { fontSize: isDesktop ? 17 : 14, fontWeight: 700, color: T.text }
              : { fontSize: isDesktop ? 14 : 13, fontWeight: kind === "sub" ? 700 : kind === "adv" ? 500 : 600, color: kind === "adv" ? T.textTertiary : T.text }) }}>
            {render(c, i)}
          </div>
        ))}
      </div>
    );
  };
  const band = (key, label, f, win) => row(key, { label, kind: "band", tag: heldTag(key) }, c => <>{f(c)}{W[key] && W[key].c === c && winPill(win)}</>);
  const slimHead = (
    <div style={{ display: "grid", gridTemplateColumns: grid, background: `linear-gradient(135deg, ${T.blue}18, ${T.blue}0c)`, borderBottom: `1px solid ${T.blue}38` }}>
      {isDesktop && <div style={{ padding: "9px 16px", alignSelf: "center", fontFamily: MONO, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: T.blue, fontWeight: 600 }}>Option</div>}
      {cols.map((c, i) => (
        <div key={i} style={{ background: tint(c), padding: `${isDesktop ? 9 : 8}px ${padX}px`, display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
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

  return (<div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
    {secBar("Compare", <>
      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", opacity: 0.8, fontWeight: 600 }}>{all.length > MAX_COLS ? `${n} of ${all.length} options` : `${n} options`}</span>
      {onAddOption && <button onClick={onAddOption} style={{ marginLeft: "auto", font: `600 12px ${FONT}`, color: "#fff", background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.38)", borderRadius: 9999, padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap" }}>+ Add option</button>}
    </>)}
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
        {lens.mode !== "off" && (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textSecondary, fontFamily: FONT }}>
            Match to
            <select value={tName} onChange={e => setLens(s => ({ ...s, target: e.target.value }))}
              style={{ font: `600 12px ${FONT}`, color: T.text, background: T.card, border: `1px solid ${T.separator}`, borderRadius: 9999, padding: "5px 10px", cursor: "pointer" }}>
              {entries.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
            </select>
          </label>
        )}
        <div style={{ flexBasis: "100%", fontSize: 12.5, color: T.textSecondary, display: "flex", gap: 8, alignItems: "flex-start", lineHeight: 1.45, fontFamily: FONT }}>
          <span style={{ width: 6, height: 6, borderRadius: 9, background: T.blue, marginTop: 6, flexShrink: 0 }} />{lensNote}
        </div>
      </div>
    )}

    {/* The short version */}
    {verdict.length > 0 && (
      <div style={{ ...glass, padding: isDesktop ? "14px 18px" : "14px 16px" }}>
        <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: T.textTertiary, fontWeight: 700, fontFamily: FONT }}>The short version</div>
        <p style={{ margin: "4px 0 0", fontSize: isDesktop ? 15 : 14, lineHeight: 1.5, fontWeight: 500, color: T.text, fontFamily: FONT, maxWidth: "80ch", textWrap: "pretty" }}>
          {verdict.map((p, i) => <span key={i} style={p.c ? { color: T[p.c], fontWeight: 700 } : p.b ? { fontWeight: 700 } : null}>{p.t}</span>)}
        </p>
      </div>
    )}

    {/* Column heads: the mini Blueprints */}
    <div style={card}>
      <div style={{ display: "grid", gridTemplateColumns: grid, background: `linear-gradient(135deg, ${T.blue}18, ${T.blue}0c)`, borderBottom: `1px solid ${T.blue}38` }}>
        {isDesktop && <div style={{ padding: "12px 16px", alignSelf: "center", fontFamily: MONO, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: T.blue, fontWeight: 600 }}>{n} options</div>}
        {cols.map((c, i) => (
          <div key={i} style={{ background: tint(c), padding: `${isDesktop ? 12 : 10}px ${isDesktop ? 14 : padX}px`, display: "flex", flexDirection: isDesktop ? "row" : "column", alignItems: isDesktop ? "center" : "flex-start", gap: isDesktop ? 9 : 6, minWidth: 0 }}>
            {badge(c.e.name)}
            <div style={{ minWidth: 0, flex: 1, fontFamily: FONT }}>
              <b style={{ display: "block", fontSize: isDesktop ? 15 : 13, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: tight ? "nowrap" : "normal" }}>{c.e.name}</b>
              {isDesktop && <span style={{ display: "block", fontSize: 11, color: T.textTertiary, lineHeight: 1.4, marginTop: 1 }}>{(!c.e.isCurrent || c.adj) && est}{c.m.loanType} · {c.m.term}-yr · {rateTxt(c.m.rate)}</span>}
            </div>
            <button type="button" onClick={() => !c.e.isCurrent && switchScenario(c.e.name)} disabled={c.e.isCurrent}
              style={{ font: `600 11px ${FONT}`, borderRadius: 9999, padding: "3px 10px", whiteSpace: "nowrap", background: "none", color: c.e.isCurrent ? T.textTertiary : T.blue, border: `1px solid ${c.e.isCurrent ? T.separator : T.blue + "4d"}`, cursor: c.e.isCurrent ? "default" : "pointer" }}>{c.e.isCurrent ? "Viewing" : "Open"}</button>
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
      {cols.some(c => (c.m.rent || 0) > 0) && row("total", { label: "Total payment", kind: "sub" }, c => mo(c.m.monthlyPayment))}
      {cols.some(c => (c.m.rent || 0) > 0) && row("rent", { label: "Unit rents", sub: "You collect the full rent" }, c => (c.m.rent || 0) > 0
        ? <><span style={{ color: T.green }}>−{money(c.m.rent)}</span><span style={{ fontSize: 11, color: T.textTertiary, fontWeight: 500 }}>/mo</span>{isDesktop && small("Lenders count 75%")}</> : dash)}
      {band("net", cols.some(c => (c.m.rent || 0) > 0) ? "Net payment" : "Total payment", c => mo(c.d.net), "Lowest")}
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
        {row("dti", { label: "DTI" }, c => c.m.dti == null ? dash : pctTxt(c.m.dti * 100))}
        {row("int", { label: "Total interest", sub: "Full term" }, c => short(c.m.totalInt))}
      </>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: `1px solid ${T.separator}`, fontSize: 12, color: T.textTertiary, background: T.inputBg, fontFamily: FONT }}>
        <span>{showMore ? "Rate, term, loan type, DTI and total interest" : "Rate, DTI, total interest and the cost chart"}</span>
        <button type="button" onClick={() => setShowMore(v => !v)} style={{ font: `600 12px ${FONT}`, color: T.blue, background: "none", border: "none", cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}>{showMore ? "Show fewer" : "See every number"}</button>
      </div>
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 11.5, color: T.textTertiary, fontFamily: FONT }}>
      <span>Est. = quick estimate. Open an option for exact figures.</span>
      {refiCount > 0 && <span>{refiCount} refinance {refiCount === 1 ? "option isn't" : "options aren't"} shown here. Open one to compare refinances.</span>}
    </div>
    {showMore && <div style={{ marginTop: -14 }}><CostChart T={T} entries={entries} refiMode={false} colorOf={colorOf} fmt={fmt} privacy={privacy} isDesktop={isDesktop} S={{ card: { background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, boxShadow: T.cardShadow }, label: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: T.textTertiary, fontWeight: 700, fontFamily: FONT } }} /></div>}
  </div>);
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
