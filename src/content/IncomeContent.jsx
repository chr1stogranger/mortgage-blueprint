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
    "Salary":     { label: "Base Salary",      jargon: null,  variable: false },
    "Hourly":     { label: "Hourly wage",      jargon: null,  variable: false },
    "Bonus":      { label: "Annual Bonus",     jargon: null,  variable: true  },
    "Commission": { label: "Commission",       jargon: null,  variable: true  },
    "Overtime":   { label: "Overtime",         jargon: null,  variable: true  },
    "RSU":        { label: "Stock vesting",    jargon: "RSU", variable: true  },
    "Tips":       { label: "Tips",             jargon: null,  variable: true  },
    "Self-Emp":   { label: "Self-employment",  jargon: null,  variable: true  },
    "Other":      { label: "Other earned",     jargon: null,  variable: true  },
  };
  return map[payType] || { label: payType, jargon: null, variable: false };
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

  const inputStyle = {
    width: "100%", padding: "8px 8px 8px 22px",
    fontFamily: FONT, fontSize: 13, fontWeight: 500,
    border: `1px solid ${T.inputBorder}`, borderRadius: 6,
    background: T.inputBg, color: T.text, outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{
      background: `${T.orange}08`, borderTop: `1px solid ${T.orange}30`,
      padding: 12, borderRadius: "0 0 8px 8px",
    }}>
      <div style={{
        fontSize: 9, color: T.orange, letterSpacing: "0.08em",
        textTransform: "uppercase", fontWeight: 700, marginBottom: 8,
      }}>Bonus / variable history &amp; averaging</div>

      {/* 3 history inputs — auto-labeled by year. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: T.textTertiary, marginBottom: 3, letterSpacing: 0.4, fontFamily: FONT }}>
            {currentYear} YTD <span style={{ color: T.textTertiary, fontSize: 9 }}>(thru {monthLabel})</span>
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
          <div style={{ fontSize: 10, color: T.textTertiary, marginBottom: 3, letterSpacing: 0.4, fontFamily: FONT }}>{currentYear - 1}</div>
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
          <div style={{ fontSize: 10, color: T.textTertiary, marginBottom: 3, letterSpacing: 0.4, fontFamily: FONT }}>{currentYear - 2}</div>
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
      <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: T.textSecondary, fontWeight: 500, fontFamily: FONT }}>Averaging method</div>
        <select
          value={sel}
          onChange={(e) => updateIncome(inc.id, "selection", e.target.value)}
          style={{
            padding: "7px 10px", fontSize: 12, fontWeight: 500,
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
        padding: 8, background: T.card, borderRadius: 6,
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
        marginTop: 8, padding: "6px 10px",
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

  // Plain-English secondary line per component:
  //   Salary: "Current rate · counts in full"
  //   Variable: "Variable · using <method>"
  let subline;
  if (!isVar) {
    subline = "Current rate · counts in full";
  } else if (methodLabel) {
    subline = `Variable · using ${methodLabel}`;
  } else {
    subline = "Variable pay";
  }

  const dotColor = isVar ? T.orange : ACCENT;

  return (
    <div style={{
      background: T.card, borderRadius: 8, marginBottom: 4,
      border: isVar ? `1px solid ${T.orange}30` : `0.5px solid ${T.separator}`,
    }}>
      {/* Top row — component summary + 2nd chevron when variable. */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "14px 1.2fr 130px 110px 30px",
        gap: 8, alignItems: "center", padding: "8px 10px",
      }}>
        <div style={{ width: 6, height: 6, borderRadius: 3, background: dotColor, marginLeft: 4 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.text, fontFamily: FONT }}>
            {meta.label}
            {meta.jargon && (
              <span style={{ color: T.textTertiary, fontSize: 10, fontWeight: 400, marginLeft: 5 }}>({meta.jargon})</span>
            )}
          </div>
          <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 1, fontFamily: FONT }}>{subline}</div>
        </div>
        <div>
          {/* Verified-by chip. Shows green when set, neutral otherwise. */}
          {inc.verifiedBy ? (
            <span style={{
              background: `${T.green}18`, color: T.green,
              fontSize: 9, fontWeight: 600,
              padding: "2px 7px", borderRadius: 6,
              border: `0.5px solid ${T.green}40`,
              fontFamily: FONT, letterSpacing: 0.2,
            }}>{inc.verifiedBy} ✓</span>
          ) : (
            <span style={{
              fontSize: 9, color: T.textTertiary,
              fontFamily: FONT, letterSpacing: 0.2,
            }}>not verified</span>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 13, color: T.text }}>
            {fmt(mo)}
          </span>
          <span style={{ fontSize: 10, color: T.textTertiary, fontFamily: FONT, marginLeft: 2 }}>/mo</span>
        </div>
        {isVar ? (
          <span
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            title={isExpanded ? "Hide averaging detail" : "Edit averaging history & method"}
            style={{
              color: T.orange, fontSize: 11, fontWeight: 700,
              cursor: "pointer", textAlign: "center", userSelect: "none",
              transform: `rotate(${isExpanded ? 180 : 0}deg)`,
              transition: "transform 0.2s",
            }}>▾</span>
        ) : (
          <span style={{ color: T.textTertiary, fontSize: 11 }}>·</span>
        )}
      </div>

      {/* Inline averaging panel for variable pay. */}
      {isVar && isExpanded && (
        <VariableCalcPanel
          inc={inc} updateIncome={updateIncome}
          monthsElapsed={monthsElapsed}
          T={T} fmt={fmt} ACCENT={ACCENT}
        />
      )}

      {/* Inline edit fields (always visible for the simple, non-variable case). */}
      {!isVar && (
        <div style={{
          padding: "0 10px 8px",
          display: "grid",
          gridTemplateColumns: "1fr 90px 110px 90px",
          gap: 6, alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 9, color: T.textTertiary, letterSpacing: 0.3, marginBottom: 2 }}>Pay type</div>
            <select value={inc.payType}
              onChange={(e) => updateIncome(inc.id, "payType", e.target.value)}
              style={{
                width: "100%", padding: "5px 7px", fontSize: 11,
                border: `0.5px solid ${T.separator}`, borderRadius: 5,
                background: T.inputBg, color: T.text, fontFamily: FONT,
              }}>
              <option value="Salary">Salary</option>
              <option value="Hourly">Hourly</option>
              <option value="Bonus">Bonus</option>
              <option value="Commission">Commission</option>
              <option value="Overtime">Overtime</option>
              <option value="RSU">Stock (RSU)</option>
              <option value="Tips">Tips</option>
              <option value="Self-Emp">Self-emp</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, color: T.textTertiary, letterSpacing: 0.3, marginBottom: 2 }}>Amount</div>
            <input type="text" inputMode="decimal"
              value={inc.amount === 0 || inc.amount == null ? "" : Number(inc.amount).toLocaleString()}
              onChange={(e) => {
                const n = parseFloat(String(e.target.value).replace(/[^0-9.]/g, ""));
                updateIncome(inc.id, "amount", isNaN(n) ? 0 : n);
              }}
              placeholder="0"
              style={{
                width: "100%", padding: "5px 7px", fontSize: 11,
                border: `0.5px solid ${T.separator}`, borderRadius: 5,
                background: T.inputBg, color: T.text, fontFamily: FONT, boxSizing: "border-box",
              }} />
          </div>
          <div>
            <div style={{ fontSize: 9, color: T.textTertiary, letterSpacing: 0.3, marginBottom: 2 }}>Frequency</div>
            <select value={inc.frequency || "Annual"}
              onChange={(e) => updateIncome(inc.id, "frequency", e.target.value)}
              style={{
                width: "100%", padding: "5px 7px", fontSize: 11,
                border: `0.5px solid ${T.separator}`, borderRadius: 5,
                background: T.inputBg, color: T.text, fontFamily: FONT,
              }}>
              {FREQ_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, color: T.textTertiary, letterSpacing: 0.3, marginBottom: 2 }}>Verified</div>
            <select value={inc.verifiedBy || ""}
              onChange={(e) => updateIncome(inc.id, "verifiedBy", e.target.value)}
              style={{
                width: "100%", padding: "5px 7px", fontSize: 11,
                border: `0.5px solid ${T.separator}`, borderRadius: 5,
                background: T.inputBg, color: T.text, fontFamily: FONT,
              }}>
              {VERIFIED_BY_OPTIONS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Variable-pay edit row — pay type / verified by. The amount/freq
          are computed by the averaging panel above. */}
      {isVar && (
        <div style={{
          padding: "0 10px 8px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 90px",
          gap: 6, alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 9, color: T.textTertiary, letterSpacing: 0.3, marginBottom: 2 }}>Pay type</div>
            <select value={inc.payType}
              onChange={(e) => updateIncome(inc.id, "payType", e.target.value)}
              style={{
                width: "100%", padding: "5px 7px", fontSize: 11,
                border: `0.5px solid ${T.separator}`, borderRadius: 5,
                background: T.inputBg, color: T.text, fontFamily: FONT,
              }}>
              <option value="Salary">Salary</option>
              <option value="Hourly">Hourly</option>
              <option value="Bonus">Bonus</option>
              <option value="Commission">Commission</option>
              <option value="Overtime">Overtime</option>
              <option value="RSU">Stock (RSU)</option>
              <option value="Tips">Tips</option>
              <option value="Self-Emp">Self-emp</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, color: T.textTertiary, letterSpacing: 0.3, marginBottom: 2 }}>Verified by</div>
            <select value={inc.verifiedBy || ""}
              onChange={(e) => updateIncome(inc.id, "verifiedBy", e.target.value)}
              style={{
                width: "100%", padding: "5px 7px", fontSize: 11,
                border: `0.5px solid ${T.separator}`, borderRadius: 5,
                background: T.inputBg, color: T.text, fontFamily: FONT,
              }}>
              {VERIFIED_BY_OPTIONS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => removeIncome(inc.id)} aria-label="Remove component"
              style={{
                background: "transparent", border: `0.5px solid ${T.separator}`,
                color: T.textTertiary, cursor: "pointer",
                padding: "4px 8px", borderRadius: 5,
                fontSize: 10, fontFamily: FONT,
              }}>Remove</button>
          </div>
        </div>
      )}

      {/* Remove button for non-variable rows */}
      {!isVar && (
        <div style={{ padding: "0 10px 8px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => removeIncome(inc.id)} aria-label="Remove component"
            style={{
              background: "transparent", border: `0.5px solid ${T.separator}`,
              color: T.textTertiary, cursor: "pointer",
              padding: "4px 8px", borderRadius: 5,
              fontSize: 10, fontFamily: FONT,
            }}>Remove</button>
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

  // Common employer subtitle: pull a representative job title or fallback.
  // For now we don't store a title separately, so use the source field with
  // the start date if available.
  const firstStart = components.find(c => c.start)?.start || "";
  const subtitle = firstStart ? `Since ${firstStart}` : `${components.length} component${components.length === 1 ? "" : "s"}`;

  const borColor = borrowerNum === 1 ? ACCENT : T.cyan;
  const borBg = `${borColor}18`;

  return (
    <div style={{ background: isExpanded ? `${ACCENT}06` : T.card }}>
      {/* Top employer row — click to expand. */}
      <div onClick={onToggleExpand}
        style={{
          display: "grid",
          gridTemplateColumns: "24px 1.4fr 1fr 120px 18px",
          gap: 8, alignItems: "center", padding: "12px 14px",
          cursor: "pointer",
          borderBottom: `1px solid ${T.separator}`,
        }}>
        <div style={{
          color: isExpanded ? ACCENT : T.textTertiary, fontSize: 12,
          fontWeight: isExpanded ? 700 : 400, transition: "transform 0.2s",
          transform: `rotate(${isExpanded ? 0 : -90}deg)`,
        }}>▾</div>
        <div style={{ minWidth: 0 }}>
          <input
            type="text"
            value={draftSource}
            placeholder="Employer name"
            onChange={(e) => setDraftSource(e.target.value)}
            onBlur={commitSource}
            onKeyDown={(e) => { if (e.key === "Enter") { commitSource(); e.target.blur(); } }}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 14, fontWeight: 500, color: T.text,
              fontFamily: FONT, border: "none", outline: "none",
              background: "transparent", width: "100%", padding: 0,
            }}
          />
          <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 1, fontFamily: FONT }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <span style={{
            background: borBg, color: borColor,
            fontSize: 9, fontWeight: 500,
            padding: "2px 7px", borderRadius: 6,
            border: `0.5px solid ${borColor}38`,
            fontFamily: FONT, letterSpacing: 0.3,
          }}>BOR {borrowerNum}</span>
          <span style={{
            background: T.card, color: T.textTertiary,
            fontSize: 9, fontWeight: 500,
            padding: "2px 7px", borderRadius: 6,
            border: `0.5px solid ${T.separator}`,
            fontFamily: FONT, letterSpacing: 0.3,
          }}>{components.length} component{components.length === 1 ? "" : "s"}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 14, color: T.text }}>
            {fmt(totalMo)}
          </span>
          <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, marginLeft: 2 }}>/mo</span>
        </div>
        <div></div>
      </div>

      {/* Component list (expanded state). */}
      {isExpanded && (
        <div style={{ padding: "8px 14px 14px", background: `${ACCENT}06` }}>
          <div style={{
            fontSize: 9, color: T.textTertiary, letterSpacing: 0.4,
            textTransform: "uppercase", fontWeight: 700, padding: "4px 0 6px", fontFamily: FONT,
          }}>Components</div>

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
  Hero, Card, Sec, TextInp, Inp, Sel, Note, Progress,
  VARIABLE_PAY_TYPES, PAY_TYPES, loanType,
  isPulse, GuidedNextButton,
}) {
  const ACCENT = T.blue;
  const SUB_BG = `linear-gradient(135deg, ${ACCENT}18, ${ACCENT}0c)`;
  const monthsElapsed = Math.max(1, new Date().getMonth() + 1);

  // Expand state — keyed by `borrowerNum::source` for employer rows
  // and by income id for component-level (variable averaging) rows.
  const [expandedEmployers, setExpandedEmployers] = useState({});
  const [expandedComponents, setExpandedComponents] = useState({});

  // Group all incomes by (borrower, source). Each group becomes one
  // employer row with chevron-expand to its components.
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
    // Sort: BOR1 first, then BOR2; within borrower, source name asc.
    groups.sort((a, b) => {
      if (a.borrowerNum !== b.borrowerNum) return a.borrowerNum - b.borrowerNum;
      return (a.source || "").localeCompare(b.source || "");
    });
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

  return (<>
    <div style={{ marginTop: 20 }}>
      <div style={{
        border: `1px solid ${T.cardBorder}`, borderRadius: 14,
        overflow: "hidden", background: T.card, marginBottom: 16,
      }}>
        {/* Banner header — soft tint matching Payment Breakdown style. */}
        <div style={{
          background: SUB_BG, color: ACCENT,
          borderBottom: `1px solid ${ACCENT}38`,
          padding: "10px 16px",
          fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", fontFamily: FONT,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>Employment Income</span>
          <span style={{ fontSize: 11, opacity: 0.85, fontFamily: FONT, letterSpacing: 0.5 }}>
            {fmt(totalEmploymentMo)}/mo
          </span>
        </div>

        {/* Empty state */}
        {employerGroups.length === 0 && (
          <div style={{ padding: "28px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 12, fontFamily: FONT }}>
              No employment income yet.
            </div>
            <button onClick={() => addIncome(1, "")} style={{
              padding: "10px 20px", borderRadius: 9999,
              background: "transparent", border: `1.5px solid ${ACCENT}`,
              color: ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
            }}>+ Add first employer</button>
          </div>
        )}

        {/* Employer groups */}
        {employerGroups.map(g => (
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
            T={T} fmt={fmt} ACCENT={ACCENT}
          />
        ))}

        {/* Add-employer row — BOR1 + BOR2 quick adds */}
        {employerGroups.length > 0 && (
          <div style={{
            background: `${ACCENT}06`, padding: "10px 14px",
            borderTop: `1px solid ${ACCENT}22`,
            display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
          }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => addIncome(1, "")} style={{
                padding: "6px 12px", fontSize: 12, fontWeight: 500,
                color: ACCENT, background: "transparent",
                border: `1px dashed ${ACCENT}44`, borderRadius: 6,
                cursor: "pointer", fontFamily: FONT,
              }}>+ Add employer · BOR 1</button>
              <button onClick={() => addIncome(2, "")} style={{
                padding: "6px 12px", fontSize: 12, fontWeight: 500,
                color: T.cyan, background: "transparent",
                border: `1px dashed ${T.cyan}44`, borderRadius: 6,
                cursor: "pointer", fontFamily: FONT,
              }}>+ Add employer · BOR 2</button>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 10, color: T.textTertiary, letterSpacing: 0.4, fontWeight: 600, fontFamily: FONT }}>QUALIFYING TOTAL</span>
              <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 14, color: ACCENT }}>{fmt(totalEmploymentMo)}/mo</span>
            </div>
          </div>
        )}
      </div>

      {/* Other income — non-employment recurring streams */}
      <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: 10, marginBottom: 16 }}>
        <Inp
          label="Other Monthly Income — BOR 1"
          value={otherIncome}
          onChange={setOtherIncome}
          tip="Recurring income outside employment: alimony, Social Security, pension, disability, child support."
        />
        <Inp
          label="Other Monthly Income — BOR 2"
          value={otherIncome2}
          onChange={setOtherIncome2}
          tip="Recurring income outside employment for BOR 2."
        />
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
