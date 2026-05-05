import React, { useState, useMemo, useEffect } from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

const FREQ_OPTIONS = [
  { value: "Annual", label: "Annual" },
  { value: "Monthly", label: "Monthly" },
  { value: "Bi-Weekly", label: "Bi-Weekly" },
  { value: "Weekly", label: "Weekly" },
  { value: "Hourly", label: "Hourly" },
];

const VERIFIED_BY_OPTIONS = [
  { value: "", label: "—" },
  { value: "Verbal", label: "Verbal" },
  { value: "Paystub", label: "Paystub" },
  { value: "W-2", label: "W-2" },
  { value: "Tax Return", label: "Tax Return" },
  { value: "Award Letter", label: "Award Letter" },
  { value: "VOE", label: "VOE" },
];

// Variable-pay averaging methods. The legacy values "1Y+" and "2Y+" are
// preserved so existing scenarios keep computing correctly; the UI now
// surfaces 4 explicit choices: 1yr avg / 2yr avg / 1yr+YTD / 2yr+YTD.
const SELECTION_METHODS = [
  { value: "1Y+",     label: "1-yr avg",       short: "1-YR AVG" },
  { value: "2Y+",     label: "2-yr avg",       short: "2-YR AVG" },
  { value: "1Y_YTD",  label: "1-yr + YTD",     short: "1-YR + YTD" },
  { value: "2Y_YTD",  label: "2-yr + YTD",     short: "2-YR + YTD" },
];

// Plain-English label + jargon parenthetical for each pay type. The label
// matches what the broker (and a borrower watching the screen) reads.
function payTypeLabel(payType) {
  const map = {
    // ── Wage / W-2 income ────────────────────────────────────────
    "Salary":     { label: "Base Salary",       jargon: null,    variable: false },
    "Hourly":     { label: "Hourly wage",       jargon: null,    variable: false },
    "Overtime":   { label: "Overtime",          jargon: "OT",    variable: true  },
    "Bonus":      { label: "Bonus",             jargon: null,    variable: true  },
    "Commission": { label: "Commission",        jargon: null,    variable: true  },
    "RSU":        { label: "Stock vesting",     jargon: "RSU",   variable: true  },
    "Tips":       { label: "Tips",              jargon: null,    variable: true  },
    // ── Self-employment ─────────────────────────────────────────
    // All averaged over 2 years per Fannie/Freddie underwriting.
    "Sch-C":      { label: "Self-employment",   jargon: "Sch C", variable: true  },
    "1120-S":     { label: "S-Corp income",     jargon: "1120-S", variable: true },
    "1065":       { label: "Partnership",       jargon: "1065",  variable: true  },
    "Self-Emp":   { label: "Self-employment",   jargon: null,    variable: true  },
    // ── Fixed / award income (current amount, not averaged) ─────
    "Pension":      { label: "Pension",           jargon: null, variable: false },
    "SSI":          { label: "Social Security",   jargon: "SSI", variable: false },
    "Retirement":   { label: "Retirement income", jargon: null, variable: false },
    "Trust":        { label: "Trust income",      jargon: null, variable: false },
    "Child-Support":{ label: "Child support",     jargon: null, variable: false },
    "VA":           { label: "VA benefits",       jargon: null, variable: false },
    "Disability":   { label: "Disability",        jargon: null, variable: false },
    "Housing":      { label: "Housing allowance", jargon: null, variable: false },
    // ── Catch-all ───────────────────────────────────────────────
    "Other":      { label: "Other income",      jargon: null,    variable: true  },
  };
  return map[payType] || { label: payType, jargon: null, variable: false };
}

// Pay-type dropdown options grouped to match Christo's reference
// spreadsheet. Order matters: most-common first within each group.
const PAY_TYPE_OPTIONS = [
  { group: "Wage / W-2", items: [
    { value: "Salary",       label: "Salary" },
    { value: "Hourly",       label: "Hourly" },
    { value: "Overtime",     label: "Overtime (OT)" },
    { value: "Bonus",        label: "Bonus" },
    { value: "Commission",   label: "Commission" },
    { value: "RSU",          label: "Stock (RSU)" },
    { value: "Tips",         label: "Tips" },
  ]},
  { group: "Self-employment", items: [
    { value: "Sch-C",        label: "Schedule C" },
    { value: "1120-S",       label: "S-Corp (1120-S)" },
    { value: "1065",         label: "Partnership (1065)" },
  ]},
  { group: "Fixed / award income", items: [
    { value: "Pension",        label: "Pension" },
    { value: "SSI",            label: "Social Security" },
    { value: "Retirement",     label: "Retirement" },
    { value: "Trust",          label: "Trust" },
    { value: "Child-Support",  label: "Child support" },
    { value: "VA",             label: "VA benefits" },
    { value: "Disability",     label: "Disability" },
    { value: "Housing",        label: "Housing allowance" },
  ]},
  { group: "Other", items: [
    { value: "Other",        label: "Other" },
  ]},
];

// Render <optgroup>s so the long pay-type list stays scannable in the
// inline select dropdown. Used in both variable and non-variable
// component-row headers.
function PayTypeOptions() {
  return (
    <>
      {PAY_TYPE_OPTIONS.map(g => (
        <optgroup key={g.group} label={g.group}>
          {g.items.map(item => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

// Frequency → monthly conversion (parity with parent toMonthly).
function toMonthly(amount, frequency) {
  const a = Number(amount) || 0;
  switch (frequency) {
    case "Annual":   return a / 12;
    case "Monthly":  return a;
    case "Bi-Weekly": return (a * 26) / 12;
    case "Weekly":   return (a * 52) / 12;
    case "Hourly":   return (a * 40 * 52) / 12;
    default: return a / 12;
  }
}

// Compute all 4 averaging methods at once so the UI can preview them
// side-by-side. ytd / py1 / py2 are annual amounts; monthsElapsed is the
// number of months represented by the YTD figure (defaults to current
// month). Returns annual qualifying $/yr per method.
function computeMethods({ ytd, py1, py2, monthsElapsed }) {
  const y  = Number(ytd) || 0;
  const p1 = Number(py1) || 0;
  const p2 = Number(py2) || 0;
  const m  = Math.max(1, Number(monthsElapsed) || 1);
  const ytdAnn = y > 0 ? (y * 12) / m : 0;
  return {
    "1Y+":    p1,
    "2Y+":    (p1 + p2) / 2,
    "1Y_YTD": (p1 + ytdAnn) / 2,
    "2Y_YTD": (p1 + p2 + ytdAnn) / 3,
  };
}

// Mo. Income for one row, honoring the user-picked Selection.
function computeMoIncome(inc, isVariable, monthsElapsed) {
  const sel = inc.selection || (isVariable ? "2Y+" : "Amount");
  if (!isVariable || sel === "Amount") {
    return toMonthly(Number(inc.amount) || 0, inc.frequency);
  }
  // Legacy "YTD" alone — preserved for back-compat with older scenarios.
  if (sel === "YTD") {
    const y = Number(inc.ytd) || 0;
    const m = Math.max(1, Number(monthsElapsed) || 1);
    return y > 0 ? (y * 12 / m) / 12 : 0;
  }
  const methods = computeMethods({
    ytd: inc.ytd, py1: inc.py1, py2: inc.py2, monthsElapsed,
  });
  const annual = methods[sel] || 0;
  return annual / 12;
}

// ─── Variable-pay averaging panel (the 2nd-level chevron expand) ─────
function VariableCalcPanel({ inc, updateIncome, monthsElapsed, T, fmt, ACCENT }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const monthLabel = now.toLocaleString("default", { month: "short" });
  const methods = computeMethods({
    ytd: inc.ytd, py1: inc.py1, py2: inc.py2, monthsElapsed,
  });
  const sel = inc.selection || "2Y+";
  const annual = methods[sel] || 0;
  const monthly = annual / 12;

  // Year selectors — broker can override py1Year / py2Year to skip a
  // distorted year or pick a different historical window. Default to
  // currentYear - 1 / currentYear - 2. Build option lists that exclude
  // the year picked in the OTHER slot so the broker can't double-count.
  const py1Year = inc.py1Year || (currentYear - 1);
  const py2Year = inc.py2Year || (currentYear - 2);
  const yearChoices = (excludeYear) => {
    const out = [];
    for (let y = currentYear - 1; y >= currentYear - 6; y--) {
      out.push(y);
    }
    return out.filter(y => y !== excludeYear);
  };

  const inputStyle = {
    width: "100%", padding: "8px 8px 8px 22px",
    fontFamily: FONT, fontSize: 13, fontWeight: 500,
    border: `1px solid ${T.inputBorder}`, borderRadius: 6,
    background: T.inputBg, color: T.text, outline: "none",
    boxSizing: "border-box",
  };
  // Label style for the 3 history-input cells. Reserves 2 lines of
  // height (~26px) so single-line labels (2025, 2024) hold the same
  // vertical space as the YTD label which always wraps to "{year}
  // YTD" + "(thru {month})". Without this the YTD input pill sits
  // ~13px below its siblings on mobile.
  const cellLabelStyle = {
    fontSize: 10,
    color: T.textTertiary,
    marginBottom: 3,
    letterSpacing: 0.4,
    fontFamily: FONT,
    minHeight: 26,
    lineHeight: 1.2,
  };

  return (
    <div style={{
      background: `${T.orange}08`, borderTop: `1px solid ${T.orange}30`,
      padding: "8px 10px 10px", borderRadius: "0 0 8px 8px",
    }}>
      <div style={{
        fontSize: 9, color: T.orange, letterSpacing: "0.08em",
        textTransform: "uppercase", fontWeight: 700, marginBottom: 6,
      }}>Bonus / variable history &amp; averaging</div>

      {/* 3 history inputs — auto-labeled by year.
          Christo (2026-05-05): on mobile, "{year} YTD (thru {month})"
          wraps to 2 lines while "{year-1}" / "{year-2}" stay on one
          line, which pushed the YTD pill below the others. Fix:
          - "(thru {month})" is forced onto its own line via a block
            child, so the YTD label is reliably 2 lines on every width.
          - All three labels reserve a 2-line minHeight (cellLabelStyle)
            so the label rows are equal height.
          - The grid is `alignItems: "end"` as a belt-and-suspenders
            measure: even if a label still wraps unexpectedly the
            input pills stay anchored to the bottom row. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8, alignItems: "end" }}>
        <div>
          <div style={cellLabelStyle}>
            {currentYear} YTD
            <div style={{ color: T.textTertiary, fontSize: 9, fontWeight: 400, letterSpacing: 0.3 }}>
              (thru {monthLabel})
            </div>
          </div>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: T.textTertiary, fontSize: 13, fontFamily: FONT }}>$</span>
            <input
              type="text" inputMode="decimal"
              value={inc.ytd === 0 || inc.ytd == null ? "" : Number(inc.ytd).toLocaleString()}
              onChange={(e) => {
                const n = parseFloat(String(e.target.value).replace(/[^0-9.]/g, ""));
                updateIncome(inc.id, "ytd", isNaN(n) ? 0 : n);
              }}
              style={inputStyle}
              placeholder="0"
            />
          </div>
        </div>
        <div>
          {/* Year selector — broker picks which calendar year py1
              represents. Default currentYear - 1. Excludes whatever
              year is in py2Year so we can't double-count. */}
          <div style={cellLabelStyle}>
            <select
              value={py1Year}
              onChange={(e) => updateIncome(inc.id, "py1Year", parseInt(e.target.value, 10))}
              style={{
                fontSize: 10, color: T.textTertiary, fontFamily: FONT,
                background: "transparent", border: "none", padding: 0,
                letterSpacing: 0.4, cursor: "pointer", fontWeight: 500,
                outline: "none",
              }}>
              {yearChoices(py2Year).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: T.textTertiary, fontSize: 13, fontFamily: FONT }}>$</span>
            <input
              type="text" inputMode="decimal"
              value={inc.py1 === 0 || inc.py1 == null ? "" : Number(inc.py1).toLocaleString()}
              onChange={(e) => {
                const n = parseFloat(String(e.target.value).replace(/[^0-9.]/g, ""));
                updateIncome(inc.id, "py1", isNaN(n) ? 0 : n);
              }}
              style={inputStyle}
              placeholder="0"
            />
          </div>
        </div>
        <div>
          <div style={cellLabelStyle}>
            <select
              value={py2Year}
              onChange={(e) => updateIncome(inc.id, "py2Year", parseInt(e.target.value, 10))}
              style={{
                fontSize: 10, color: T.textTertiary, fontFamily: FONT,
                background: "transparent", border: "none", padding: 0,
                letterSpacing: 0.4, cursor: "pointer", fontWeight: 500,
                outline: "none",
              }}>
              {yearChoices(py1Year).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: T.textTertiary, fontSize: 13, fontFamily: FONT }}>$</span>
            <input
              type="text" inputMode="decimal"
              value={inc.py2 === 0 || inc.py2 == null ? "" : Number(inc.py2).toLocaleString()}
              onChange={(e) => {
                const n = parseFloat(String(e.target.value).replace(/[^0-9.]/g, ""));
                updateIncome(inc.id, "py2", isNaN(n) ? 0 : n);
              }}
              style={inputStyle}
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Method selector. Each option label includes the resulting $/yr so
          the broker can decide before changing the selection. */}
      <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 8, alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: T.textSecondary, fontWeight: 500, fontFamily: FONT }}>Averaging method</div>
        <select
          value={sel}
          onChange={(e) => updateIncome(inc.id, "selection", e.target.value)}
          style={{
            padding: "5px 10px", fontSize: 12, fontWeight: 500,
            border: `1px solid ${ACCENT}44`, borderRadius: 6,
            background: `${ACCENT}08`, color: ACCENT, cursor: "pointer", fontFamily: FONT,
          }}
        >
          {SELECTION_METHODS.map(m => (
            <option key={m.value} value={m.value}>
              {m.label} ({fmt(methods[m.value] || 0)}/yr)
            </option>
          ))}
        </select>
      </div>

      {/* 4-tile preview — all 4 methods side-by-side, active highlighted. */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6,
        padding: "5px 6px", background: T.card, borderRadius: 6,
        border: `0.5px solid ${T.separator}`,
      }}>
        {SELECTION_METHODS.map(m => {
          const isActive = sel === m.value;
          return (
            <div key={m.value} onClick={() => updateIncome(inc.id, "selection", m.value)}
              style={{
                textAlign: "center",
                background: isActive ? `${ACCENT}15` : "transparent",
                borderRadius: 4, padding: "3px 0",
                cursor: "pointer", transition: "all 0.2s",
              }}>
              <div style={{
                fontSize: 9, color: isActive ? ACCENT : T.textTertiary,
                letterSpacing: 0.4, fontWeight: isActive ? 700 : 600,
                fontFamily: FONT,
              }}>{m.short}</div>
              <div style={{
                fontFamily: FONT, fontSize: 11,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? ACCENT : T.textSecondary,
              }}>{fmt(methods[m.value] || 0)}</div>
            </div>
          );
        })}
      </div>

      {/* Result summary banner. */}
      <div style={{
        marginTop: 6, padding: "5px 10px",
        background: `${ACCENT}12`, borderRadius: 6,
        fontSize: 10, color: ACCENT, lineHeight: 1.4, fontFamily: FONT,
      }}>
        Using <strong>{(SELECTION_METHODS.find(m => m.value === sel) || {}).label || sel}</strong> · qualifying {fmt(annual)}/yr → <strong>{fmt(monthly)}/mo</strong>.
        {sel !== "2Y+" && sel !== "1Y+" && " Higher methods qualify for more income, but only if the lender allows it."}
      </div>
    </div>
  );
}

// ─── Component row inside an expanded employer block ────────────────
function ComponentRow({
  inc, isExpanded, onToggleExpand, updateIncome, removeIncome,
  monthsElapsed, T, fmt, ACCENT,
}) {
  const meta = payTypeLabel(inc.payType);
  const isVar = meta.variable;
  const mo = computeMoIncome(inc, isVar, monthsElapsed);
  const sel = inc.selection || (isVar ? "2Y+" : "Amount");
  const methodLabel = (SELECTION_METHODS.find(m => m.value === sel) || {}).label;

  // Year-span suffix for the method chip — e.g. "· '24–'25" for a
  // 2-yr avg over 2024–2025. Helps the broker confirm at a glance
  // which calendar years are in the qualifying calc without
  // expanding the panel. Audit-trail visibility per the LLM Council.
  const cy = new Date().getFullYear();
  const py1Y = inc.py1Year || (cy - 1);
  const py2Y = inc.py2Year || (cy - 2);
  const yy = (y) => String(y).slice(-2);
  let yearSpan = "";
  if (isVar && (sel === "1Y+")) yearSpan = ` · '${yy(py1Y)}`;
  else if (isVar && (sel === "2Y+")) {
    const lo = Math.min(py1Y, py2Y), hi = Math.max(py1Y, py2Y);
    yearSpan = ` · '${yy(lo)}–'${yy(hi)}`;
  }
  else if (isVar && (sel === "1Y_YTD")) yearSpan = ` · '${yy(py1Y)} + YTD`;
  else if (isVar && (sel === "2Y_YTD")) {
    const lo = Math.min(py1Y, py2Y), hi = Math.max(py1Y, py2Y);
    yearSpan = ` · '${yy(lo)}–'${yy(hi)} + YTD`;
  }

  // Subline removed (2026-05-05) — was redundant with the inline
  // averaging-method chip and the pay-type dropdown right below.
  const dotColor = isVar ? T.orange : ACCENT;

  return (
    <div style={{
      background: T.card, borderRadius: 8, marginBottom: 6,
      border: isVar ? `1px solid ${T.orange}40` : `0.5px solid ${T.separator}`,
    }}>
      {/* Header row. Two layouts:
          - VARIABLE rows (Bonus, Commission, RSU, etc.): 6-column
            header showing label + pay type + verified by + $/mo
            + chevron. Amount/frequency live in the averaging panel.
          - NON-VARIABLE rows (Base Salary, Hourly, etc.): single-
            line 8-column header that ALSO inlines Amount +
            Frequency + a trash icon. Christo (2026-05-05 r3): for
            base income there's no averaging panel, so collapsing
            the bottom Amount/Frequency/Remove row into the header
            saves ~36px per row with no loss of editing surface. */}
      {isVar ? (
        // ─── Variable header ───────────────────────────────────
        // Christo (2026-05-05 r4): chevron moved from the far-right
        // to immediately left of the label so it visually anchors
        // the expand/collapse to the row's identity instead of
        // floating at the end.
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "14px 28px minmax(110px, 1fr) 100px 110px 90px",
            gap: 8, alignItems: "center", padding: "7px 10px",
          }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: dotColor, marginLeft: 4 }} />
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            title={isExpanded ? "Hide averaging detail" : "Show averaging detail"}
            style={{
              background: `${T.orange}18`, border: `1px solid ${T.orange}55`,
              color: T.orange, fontSize: 16, fontWeight: 700,
              cursor: "pointer", textAlign: "center", userSelect: "none",
              width: 28, height: 28, borderRadius: 6, padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              transform: `rotate(${isExpanded ? 180 : 0}deg)`,
              transition: "transform 0.2s",
            }}>▾</button>
          <div
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0, cursor: "pointer" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: FONT, whiteSpace: "nowrap" }}>
              {meta.label}
            </span>
            {meta.jargon && (
              <span style={{ color: T.textTertiary, fontSize: 10, fontWeight: 400, fontFamily: FONT }}>({meta.jargon})</span>
            )}
            {methodLabel && (
              <span style={{ color: T.textTertiary, fontSize: 10, fontWeight: 400, fontFamily: FONT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                · {methodLabel}{yearSpan}
              </span>
            )}
          </div>
          <select
            value={inc.payType}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateIncome(inc.id, "payType", e.target.value)}
            style={{
              width: "100%", padding: "3px 6px", fontSize: 11,
              border: `0.5px solid ${T.separator}`, borderRadius: 5,
              background: T.inputBg, color: T.text, fontFamily: FONT,
              height: 24,
            }}>
            <PayTypeOptions />
          </select>
          <select
            value={inc.verifiedBy || ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateIncome(inc.id, "verifiedBy", e.target.value)}
            style={{
              width: "100%", padding: "3px 6px", fontSize: 11,
              borderRadius: 5, height: 24, fontFamily: FONT,
              color: inc.verifiedBy ? T.green : T.orange,
              fontWeight: 600,
              background: inc.verifiedBy ? `${T.green}10` : `${T.orange}08`,
              border: inc.verifiedBy
                ? `0.5px solid ${T.green}55`
                : `0.5px dashed ${T.orange}66`,
            }}>
            {VERIFIED_BY_OPTIONS.map(v => <option key={v.value} value={v.value} style={{ color: T.text, background: T.inputBg }}>{v.label || "not verified"}</option>)}
          </select>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: T.text }}>
              {fmt(mo)}
            </span>
            <span style={{ fontSize: 10, color: T.textTertiary, fontFamily: FONT, marginLeft: 2 }}>/mo</span>
          </div>
        </div>
      ) : (
        // ─── Non-variable single-line header ──────────────────
        // dot | label | pay type | $amount | freq | verified | $/mo | trash
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "14px minmax(90px, 1fr) 90px 130px 80px 100px 90px 24px",
            gap: 6, alignItems: "center", padding: "8px 10px",
          }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: dotColor, marginLeft: 4 }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: FONT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {meta.label}
            </span>
            {meta.jargon && (
              <span style={{ color: T.textTertiary, fontSize: 10, fontWeight: 400, fontFamily: FONT }}>({meta.jargon})</span>
            )}
          </div>
          {/* Pay type */}
          <select
            value={inc.payType}
            onChange={(e) => updateIncome(inc.id, "payType", e.target.value)}
            style={{
              width: "100%", padding: "3px 6px", fontSize: 11,
              border: `0.5px solid ${T.separator}`, borderRadius: 5,
              background: T.inputBg, color: T.text, fontFamily: FONT,
              height: 24,
            }}>
            <PayTypeOptions />
          </select>
          {/* Amount with $ prefix INSIDE the input */}
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", left: 7, top: "50%", transform: "translateY(-50%)",
              color: T.textTertiary, fontSize: 11, fontFamily: FONT, pointerEvents: "none",
            }}>$</span>
            <input type="text" inputMode="decimal"
              value={inc.amount === 0 || inc.amount == null ? "" : Number(inc.amount).toLocaleString()}
              onChange={(e) => {
                const n = parseFloat(String(e.target.value).replace(/[^0-9.]/g, ""));
                updateIncome(inc.id, "amount", isNaN(n) ? 0 : n);
              }}
              placeholder="0"
              style={{
                width: "100%", padding: "3px 6px 3px 18px", fontSize: 11,
                border: `0.5px solid ${T.separator}`, borderRadius: 5,
                background: T.inputBg, color: T.text, fontFamily: FONT,
                boxSizing: "border-box", height: 24,
              }} />
          </div>
          {/* Frequency */}
          <select value={inc.frequency || "Annual"}
            onChange={(e) => updateIncome(inc.id, "frequency", e.target.value)}
            style={{
              width: "100%", padding: "3px 6px", fontSize: 11,
              border: `0.5px solid ${T.separator}`, borderRadius: 5,
              background: T.inputBg, color: T.text, fontFamily: FONT,
              height: 24,
            }}>
            {FREQ_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          {/* Verified by */}
          <select
            value={inc.verifiedBy || ""}
            onChange={(e) => updateIncome(inc.id, "verifiedBy", e.target.value)}
            style={{
              width: "100%", padding: "3px 6px", fontSize: 11,
              borderRadius: 5, height: 24, fontFamily: FONT,
              color: inc.verifiedBy ? T.green : T.orange,
              fontWeight: 600,
              background: inc.verifiedBy ? `${T.green}10` : `${T.orange}08`,
              border: inc.verifiedBy
                ? `0.5px solid ${T.green}55`
                : `0.5px dashed ${T.orange}66`,
            }}>
            {VERIFIED_BY_OPTIONS.map(v => <option key={v.value} value={v.value} style={{ color: T.text, background: T.inputBg }}>{v.label || "not verified"}</option>)}
          </select>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: T.text }}>
              {fmt(mo)}
            </span>
            <span style={{ fontSize: 10, color: T.textTertiary, fontFamily: FONT, marginLeft: 2 }}>/mo</span>
          </div>
          {/* Trash icon-only Remove */}
          <button onClick={() => removeIncome(inc.id)}
            aria-label="Remove this component"
            title="Remove this component"
            style={{
              background: "transparent", border: `0.5px solid ${T.separator}`,
              color: T.red, cursor: "pointer",
              width: 22, height: 22, borderRadius: 5, padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        </div>
      )}

      {/* Inline averaging panel for variable pay. */}
      {isVar && isExpanded && (
        <VariableCalcPanel
          inc={inc} updateIncome={updateIncome}
          monthsElapsed={monthsElapsed}
          T={T} fmt={fmt} ACCENT={ACCENT}
        />
      )}

      {/* Non-variable rows have no bottom row — Amount / Frequency /
          Remove are all inline in the single-line header above. */}

      {/* Variable rows: Remove only, slim bar. Pay type / Verified by
          live in the header; Amount / Frequency live in the
          averaging panel above. */}
      {isVar && (
        <div style={{ padding: "0 10px 6px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => removeIncome(inc.id)} aria-label="Remove this component"
            title="Remove this component"
            style={{
              background: "transparent", border: `0.5px solid ${T.separator}`,
              color: T.red, cursor: "pointer",
              padding: "3px 8px", borderRadius: 5,
              fontSize: 10, fontFamily: FONT, fontWeight: 500,
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Employer group (top-level row + chevron-expand component list) ──
function EmployerGroup({
  source, components, borrowerNum, isExpanded, onToggleExpand,
  componentExpandState, toggleComponentExpand,
  updateIncome, addIncome, removeIncome,
  monthsElapsed, T, fmt, ACCENT,
}) {
  // Local edit state for the source field. Committing on every keystroke
  // would re-key the group (because grouping is by source), destroy the
  // input, and lose focus — so the user could only type one character
  // at a time. Buffer locally; commit on blur or Enter.
  const [draftSource, setDraftSource] = useState(source || "");
  useEffect(() => { setDraftSource(source || ""); }, [source]);
  const commitSource = () => {
    if (draftSource !== (source || "")) {
      components.forEach(c => updateIncome(c.id, "source", draftSource));
    }
  };

  const totalMo = components.reduce(
    (s, c) => s + computeMoIncome(c, payTypeLabel(c.payType).variable, monthsElapsed),
    0,
  );

  // Current vs. Previous employer status — derived from whether ANY
  // component in the group has an `end` date set. Toggling is a
  // group-level action: setting "Previous" stamps today's date on
  // every component's `end`; clearing it back to "Current" wipes
  // them all. For mortgage qualification the distinction matters —
  // current employers anchor the YTD slot; previous employers
  // contribute history without YTD annualization.
  const isPrevious = components.some(c => c.end && c.end !== "");
  const togglePrevEmployer = () => {
    if (isPrevious) {
      components.forEach(c => updateIncome(c.id, "end", ""));
    } else {
      const today = new Date().toISOString().slice(0, 10);
      components.forEach(c => updateIncome(c.id, "end", today));
    }
  };
  const endDate = components.find(c => c.end)?.end || "";

  // Common employer subtitle: pull a representative job title or fallback.
  // For now we don't store a title separately, so use the source field with
  // the start date if available.
  const firstStart = components.find(c => c.start)?.start || "";
  const subtitle = firstStart ? `Since ${firstStart}` : `${components.length} component${components.length === 1 ? "" : "s"}`;

  const borColor = borrowerNum === 1 ? ACCENT : T.cyan;
  const borBg = `${borColor}18`;

  return (
    <div style={{ background: isExpanded ? `${ACCENT}06` : T.card }}>
      {/* Top employer row — click to expand. Grid: chevron, name +
          subtitle (flex), Current/Previous status pill, $/mo, spacer.
          The status pill is the only addition since the redundancy
          cleanup; it's information-bearing (current vs. prior job
          changes how the income is treated for qualification). */}
      <div onClick={onToggleExpand}
        style={{
          display: "grid",
          gridTemplateColumns: "32px 1fr 110px 120px 18px",
          gap: 8, alignItems: "center", padding: "12px 14px",
          cursor: "pointer",
          borderBottom: `1px solid ${T.separator}`,
        }}>
        {/* Chevron bumped from 12px text to a 28px filled tile so it's
            tappable and visible at a glance. Christo (2026-05-05): the
            previous size was hard to see. */}
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: isExpanded ? `${ACCENT}18` : `${ACCENT}08`,
          border: `0.5px solid ${ACCENT}33`,
          color: ACCENT, fontSize: 16, fontWeight: 700,
          transition: "transform 0.2s",
          transform: `rotate(${isExpanded ? 0 : -90}deg)`,
        }}>▾</div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            border: `1px dashed ${draftSource ? "transparent" : ACCENT + "55"}`,
            borderRadius: 6, padding: "2px 6px",
            background: draftSource ? "transparent" : `${ACCENT}06`,
            transition: "all 0.15s",
          }}>
            <input
              type="text"
              value={draftSource}
              placeholder="Click to name this employer"
              onChange={(e) => setDraftSource(e.target.value)}
              onBlur={commitSource}
              onKeyDown={(e) => { if (e.key === "Enter") { commitSource(); e.target.blur(); } }}
              onClick={(e) => e.stopPropagation()}
              style={{
                fontSize: 15, fontWeight: 600, color: T.text,
                fontFamily: FONT, border: "none", outline: "none",
                background: "transparent", flex: 1, padding: 0,
                letterSpacing: "-0.01em",
              }}
            />
            {!draftSource && (
              <span style={{ color: ACCENT, fontSize: 11, opacity: 0.7, flexShrink: 0 }}>✎</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 1, fontFamily: FONT }}>
            {subtitle}
            {isPrevious && endDate && (
              <span style={{ marginLeft: 6, color: T.textTertiary }}>· ended {endDate}</span>
            )}
          </div>
        </div>
        {/* Current / Previous toggle pill. Click stops propagation so
            the row's chevron-expand doesn't fire. */}
        <button
          onClick={(e) => { e.stopPropagation(); togglePrevEmployer(); }}
          title={isPrevious ? "Mark this as your current employer" : "Mark this as a previous employer"}
          style={{
            background: isPrevious ? `${T.textTertiary}14` : `${T.green}12`,
            color: isPrevious ? T.textSecondary : T.green,
            border: isPrevious
              ? `0.5px solid ${T.separator}`
              : `0.5px solid ${T.green}55`,
            fontSize: 10, fontWeight: 600, fontFamily: FONT,
            padding: "4px 10px", borderRadius: 9999,
            cursor: "pointer", letterSpacing: 0.3,
            textAlign: "center", whiteSpace: "nowrap",
          }}>
          {isPrevious ? "Previous" : "Current ✓"}
        </button>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 14, color: T.text }}>
            {fmt(totalMo)}
          </span>
          <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, marginLeft: 2 }}>/mo</span>
        </div>
        <div></div>
      </div>

      {/* Component list (expanded state). The "Components" label was
          dropped (2026-05-05) — it ate ~22px of whitespace without
          adding information; the component rows are visually obvious. */}
      {isExpanded && (
        <div style={{ padding: "8px 14px 12px", background: `${ACCENT}06` }}>
          {components.map(c => (
            <ComponentRow
              key={c.id}
              inc={c}
              isExpanded={!!componentExpandState[c.id]}
              onToggleExpand={() => toggleComponentExpand(c.id)}
              updateIncome={updateIncome}
              removeIncome={removeIncome}
              monthsElapsed={monthsElapsed}
              T={T} fmt={fmt} ACCENT={ACCENT}
            />
          ))}

          <button
            onClick={() => addIncome(borrowerNum, source)}
            style={{
              marginTop: 6, padding: "6px 10px",
              fontSize: 11, fontWeight: 500, color: ACCENT,
              background: "transparent", border: `1px dashed ${ACCENT}44`,
              borderRadius: 6, cursor: "pointer", fontFamily: FONT,
            }}>+ Add component (commission, overtime, ESPP…)</button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────
export default function IncomeContent({
  T, isDesktop, calc, fmt,
  incomes, addIncome, updateIncome, removeIncome,
  otherIncome, setOtherIncome, otherIncome2, setOtherIncome2,
  numBorrowers = 2, setNumBorrowers,
  borrowerNames = {}, setBorrowerNames,
  otherIncomeByBorrower = {}, setOtherIncomeByBorrower,
  Hero, Card, Sec, TextInp, Inp, Sel, Note, Progress,
  VARIABLE_PAY_TYPES, PAY_TYPES, loanType,
  isPulse, GuidedNextButton,
}) {
  const ACCENT = T.blue;
  const SUB_BG = `linear-gradient(135deg, ${ACCENT}18, ${ACCENT}0c)`;
  const monthsElapsed = Math.max(1, new Date().getMonth() + 1);

  // Expand state — keyed by `borrowerNum::source` for employer rows
  // and by income id for component-level (variable averaging) rows.
  // Variable components default to EXPANDED so the averaging panel is
  // immediately visible — a salary row only needs the basics, but every
  // variable-pay row has math the broker needs to see/configure.
  const [expandedEmployers, setExpandedEmployers] = useState({});
  const [expandedComponents, setExpandedComponents] = useState(() => {
    const initial = {};
    incomes.forEach(i => {
      if (payTypeLabel(i.payType).variable) initial[i.id] = true;
    });
    return initial;
  });
  // Auto-expand newly-added variable components and components whose pay
  // type was just changed to a variable type.
  useEffect(() => {
    setExpandedComponents(prev => {
      const next = { ...prev };
      let changed = false;
      incomes.forEach(i => {
        if (payTypeLabel(i.payType).variable && next[i.id] == null) {
          next[i.id] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [incomes]);

  // Group all incomes by (borrower, source). Each group becomes one
  // employer row with chevron-expand to its components.
  //
  // Order: insertion order within each borrower bucket. Christo
  // (2026-05-05): "if you're adding an employer it should be below
  // the previous employer, so the most recent employer is on top."
  // The current/most-recent job is entered first; subsequent +Add
  // clicks add older employers (or new blanks), which should appear
  // BELOW the existing ones. Alphabetical sort would float a freshly
  // added empty source ("" < "Apple") to the top — wrong.
  const employerGroups = useMemo(() => {
    const groups = [];
    const seen = new Map(); // key: `${borrower}::${source}` → group index
    incomes.forEach(inc => {
      const bor = inc.borrower || 1;
      const src = inc.source || "";
      const key = `${bor}::${src}`;
      let idx = seen.get(key);
      if (idx == null) {
        idx = groups.length;
        seen.set(key, idx);
        groups.push({ key, source: src, borrowerNum: bor, components: [] });
      }
      groups[idx].components.push(inc);
    });
    // Stable sort: BOR 1 groups first (in insertion order), then
    // BOR 2 groups (in insertion order). JS Array#sort is stable
    // (V8/SpiderMonkey both since ES2019), so equal-borrower groups
    // keep the order in which they first appeared in `incomes`.
    groups.sort((a, b) => a.borrowerNum - b.borrowerNum);
    return groups;
  }, [incomes]);

  const toggleEmployer = (key) => {
    setExpandedEmployers(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const toggleComponent = (id) => {
    setExpandedComponents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Bottom DTI summary (unchanged from prior version).
  const monthlyIncome = calc.monthlyIncome || 0;
  const housing = calc.housingPayment || 0;
  const totalDebts = calc.totalMonthlyDebts || 0;
  const reoExtra = calc.reoNegativeDebt || 0;
  const backDTI = monthlyIncome > 0 ? (housing + totalDebts + reoExtra) / monthlyIncome : null;
  const frontDTI = monthlyIncome > 0 ? housing / monthlyIncome : null;
  const isFHA = loanType === "FHA";
  const backMax = isFHA ? 0.5699 : (calc.maxDTI || 0.50);
  const frontMax = 0.47;
  const backOk = backDTI !== null && backDTI <= backMax;
  const frontOk = frontDTI !== null && frontDTI <= frontMax;

  // Total qualifying $/mo across all groups (just sums the component
  // monthly income; matches the parent calc layer which aggregates
  // the same way).
  const totalEmploymentMo = employerGroups.reduce((s, g) =>
    s + g.components.reduce((cs, c) => cs + computeMoIncome(c, payTypeLabel(c.payType).variable, monthsElapsed), 0)
  , 0);

  // Build the borrower roster: 1..numBorrowers.
  const borrowerList = [];
  for (let n = 1; n <= numBorrowers; n++) borrowerList.push(n);

  // Per-borrower "Other Monthly Income" — back-compat with the legacy
  // single-borrower otherIncome / otherIncome2 state. For BOR ≥ 3 we
  // use the new otherIncomeByBorrower map.
  const getOther = (n) => {
    if (n === 1) return otherIncome || 0;
    if (n === 2) return otherIncome2 || 0;
    return otherIncomeByBorrower[n] || 0;
  };
  const setOther = (n, v) => {
    if (n === 1) setOtherIncome(v);
    else if (n === 2) setOtherIncome2(v);
    else if (setOtherIncomeByBorrower) setOtherIncomeByBorrower(prev => ({ ...prev, [n]: v }));
  };

  const setBorrowerName = (n, name) => {
    if (setBorrowerNames) setBorrowerNames(prev => ({ ...prev, [n]: name }));
  };

  // Distinct color accent per borrower so multi-borrower scrolling is
  // scannable. BOR 1 indigo, BOR 2 cyan, BOR 3+ purple/teal/coral.
  const borrowerAccent = (n) => {
    const accents = [ACCENT, T.cyan, T.purple || T.blue, T.green, T.orange];
    return accents[(n - 1) % accents.length] || ACCENT;
  };

  return (<>
    <div style={{ marginTop: 20 }}>
      {borrowerList.map((n) => {
        const groups = employerGroups.filter(g => g.borrowerNum === n);
        const subtotalMo = groups.reduce((s, g) =>
          s + g.components.reduce((cs, c) => cs + computeMoIncome(c, payTypeLabel(c.payType).variable, monthsElapsed), 0)
        , 0);
        const otherMo = getOther(n);
        const totalForBorrower = subtotalMo + otherMo;
        const accent = borrowerAccent(n);
        const subBg = `linear-gradient(135deg, ${accent}18, ${accent}0c)`;
        const isLast = n === numBorrowers;
        const canRemove = numBorrowers > 1;
        return (
          <div key={n} style={{
            border: `1px solid ${T.cardBorder}`, borderRadius: 14,
            overflow: "hidden", background: T.card, marginBottom: 16,
          }}>
            {/* Per-borrower banner header. Banner shows the BOR pill,
                the editable name input ("John Doe" pattern from the
                spreadsheet), and the borrower's qualifying subtotal. */}
            <div style={{
              background: subBg, color: accent,
              borderBottom: `1px solid ${accent}38`,
              padding: "10px 16px",
              fontFamily: FONT,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                  textTransform: "uppercase", padding: "3px 8px",
                  borderRadius: 6, background: `${accent}22`, color: accent,
                  border: `0.5px solid ${accent}55`, whiteSpace: "nowrap",
                }}>BOR {n}</span>
                <input
                  type="text"
                  value={borrowerNames[n] || ""}
                  placeholder={`Borrower ${n} name (optional)`}
                  onChange={(e) => setBorrowerName(n, e.target.value)}
                  style={{
                    flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600,
                    color: accent, background: "transparent",
                    border: "none", outline: "none", padding: 0,
                    fontFamily: FONT, letterSpacing: "-0.01em",
                  }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, opacity: 0.85, letterSpacing: 0.5 }}>
                  {fmt(totalForBorrower)}/mo
                </span>
                {canRemove && setNumBorrowers && (
                  <button
                    onClick={() => {
                      // Only allow removing the last borrower in the list,
                      // and only if they have no incomes (avoid orphaning data).
                      if (n !== numBorrowers) return;
                      const hasIncomes = incomes.some(i => i.borrower === n);
                      if (hasIncomes) {
                        if (!window.confirm(`Borrower ${n} has employer entries — remove anyway? Their incomes will be deleted.`)) return;
                      }
                      setNumBorrowers(numBorrowers - 1);
                    }}
                    title={n === numBorrowers ? `Remove Borrower ${n}` : "Only the last borrower can be removed"}
                    disabled={n !== numBorrowers}
                    style={{
                      background: "transparent", border: `0.5px solid ${accent}55`,
                      color: accent, cursor: n === numBorrowers ? "pointer" : "not-allowed",
                      width: 22, height: 22, borderRadius: 5, padding: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      opacity: n === numBorrowers ? 1 : 0.3,
                    }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Empty state per borrower */}
            {groups.length === 0 && (
              <div style={{ padding: "20px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 10, fontFamily: FONT }}>
                  No employment income for this borrower yet.
                </div>
                <button onClick={() => addIncome(n, "")} style={{
                  padding: "7px 16px", borderRadius: 9999,
                  background: "transparent", border: `1px solid ${accent}`,
                  color: accent, fontSize: 12, fontWeight: 500,
                  cursor: "pointer", fontFamily: FONT,
                }}>+ Add first employer</button>
              </div>
            )}

            {/* Employer groups for this borrower */}
            {groups.map(g => (
              <EmployerGroup
                key={g.key}
                source={g.source}
                components={g.components}
                borrowerNum={g.borrowerNum}
                isExpanded={!!expandedEmployers[g.key]}
                onToggleExpand={() => toggleEmployer(g.key)}
                componentExpandState={expandedComponents}
                toggleComponentExpand={toggleComponent}
                updateIncome={updateIncome}
                addIncome={addIncome}
                removeIncome={removeIncome}
                monthsElapsed={monthsElapsed}
                T={T} fmt={fmt} ACCENT={accent}
              />
            ))}

            {/* Add-employer + Other-income footer for this borrower */}
            {groups.length > 0 && (
              <div style={{
                background: `${accent}06`, padding: "10px 14px",
                borderTop: `1px solid ${accent}22`,
                display: "flex", justifyContent: "flex-start",
              }}>
                <button onClick={() => addIncome(n, "")} style={{
                  padding: "6px 12px", fontSize: 12, fontWeight: 500,
                  color: accent, background: "transparent",
                  border: `1px dashed ${accent}44`, borderRadius: 6,
                  cursor: "pointer", fontFamily: FONT,
                }}>+ Add employer</button>
              </div>
            )}

            {/* Other Monthly Income inline under each borrower's card */}
            <div style={{
              padding: "10px 14px 12px",
              borderTop: `0.5px solid ${T.separator}`,
              display: "grid", gridTemplateColumns: isDesktop ? "1fr 200px" : "1fr",
              gap: 10, alignItems: "center",
            }}>
              <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, letterSpacing: 0.3 }}>
                Other Monthly Income
                <span style={{ marginLeft: 6, fontSize: 10, color: T.textTertiary, fontWeight: 400 }}>
                  (alimony, SSI, pension, disability, child support…)
                </span>
              </div>
              <Inp
                value={getOther(n)}
                onChange={(v) => setOther(n, v)}
              />
            </div>
          </div>
        );
      })}

      {/* Add Borrower button + total */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 16, padding: "0 4px", flexWrap: "wrap", gap: 8,
      }}>
        {setNumBorrowers && numBorrowers < 4 ? (
          <button onClick={() => setNumBorrowers(numBorrowers + 1)} style={{
            padding: "8px 16px", fontSize: 12, fontWeight: 500,
            color: ACCENT, background: "transparent",
            border: `1px dashed ${ACCENT}66`, borderRadius: 9999,
            cursor: "pointer", fontFamily: FONT,
          }}>+ Add Borrower</button>
        ) : <span />}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 10, color: T.textTertiary, letterSpacing: 0.4, fontWeight: 600, fontFamily: FONT }}>QUALIFYING TOTAL</span>
          <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 14, color: ACCENT }}>{fmt(totalEmploymentMo)}/mo</span>
        </div>
      </div>
    </div>

    {/* ─── BOTTOM SUMMARY: Total Monthly Income + DTI progress ─── */}
    <Card pad={16}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: FONT, letterSpacing: 1, textTransform: "uppercase", color: T.textTertiary, fontWeight: 700 }}>Total Monthly Income</div>
          {/* Amber total — uniform across Income / Assets / Debts / REO summary heroes for scroll-and-scan consistency. */}
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FONT, color: T.orange, letterSpacing: "-0.02em", marginTop: 2 }}>
            {fmt(monthlyIncome)}<span style={{ fontSize: 13, color: T.textTertiary, fontWeight: 600 }}>/mo</span>
          </div>
          <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2, fontFamily: FONT, letterSpacing: 0.3 }}>
            {fmt(monthlyIncome * 12)}/yr
          </div>
        </div>
        {isFHA && (
          <div style={{ background: `${T.orange}10`, border: `1px solid ${T.orange}33`, borderRadius: 8, padding: "4px 10px", fontSize: 10, fontWeight: 700, color: T.orange, fontFamily: FONT, letterSpacing: 0.5, textTransform: "uppercase" }}>
            FHA caps: front 47% / back 56.99%
          </div>
        )}
      </div>

      {monthlyIncome > 0 && backDTI !== null ? (<>
        {isFHA && (<>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 4px", fontSize: 13, borderTop: `1px solid ${T.separator}`, marginTop: 8 }}>
            <span style={{ color: T.textSecondary, fontWeight: 500 }}>Front-end DTI (housing only)</span>
            <span style={{ fontFamily: FONT, fontWeight: 700, color: frontOk ? T.green : T.red }}>
              {(frontDTI * 100).toFixed(1)}% / {(frontMax * 100).toFixed(0)}% max
            </span>
          </div>
          <Progress value={frontDTI} max={frontMax} color={frontOk ? T.green : T.red} height={8} />
          <div style={{ height: 8 }} />
        </>)}

        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 4px", fontSize: 13, borderTop: isFHA ? "none" : `1px solid ${T.separator}`, marginTop: isFHA ? 0 : 8 }}>
          <span style={{ color: T.textSecondary, fontWeight: 500 }}>Back-end DTI (housing + debts)</span>
          <span style={{ fontFamily: FONT, fontWeight: 700, color: backOk ? T.green : T.red }}>
            {(backDTI * 100).toFixed(1)}% / {(backMax * 100).toFixed(isFHA ? 2 : 0)}% max
          </span>
        </div>
        <Progress value={backDTI} max={backMax} color={backOk ? T.green : T.red} height={10} />
        <div style={{ fontSize: 11, color: backOk ? T.green : T.red, fontWeight: 500, marginTop: 6 }}>
          {backOk
            ? `✓ Within limits — ${fmt(monthlyIncome * backMax - housing - totalDebts - reoExtra)}/mo headroom`
            : `Above ${loanType} max — reduce debts or increase income`}
        </div>
      </>) : (
        <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.separator}` }}>
          Enter employment income above to see your DTI.
        </div>
      )}
    </Card>

    <GuidedNextButton />
  </>);
}
