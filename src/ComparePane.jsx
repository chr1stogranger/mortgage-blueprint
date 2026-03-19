/**
 * ComparePane — Live comparison summary between workspace panes
 *
 * Shows real-time deltas between Scenario A and Scenario B
 * for key mortgage metrics: payment, cash to close, DTI, etc.
 */
import React from "react";
import { useWorkspace } from "./WorkspaceContext";
import Icon from "./Icon";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

const fmt = (v) => {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return "$" + Math.round(Math.abs(v)).toLocaleString("en-US");
};

const pct = (v) => {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return (v * 100).toFixed(1) + "%";
};

const pctDirect = (v) => {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return v.toFixed(2) + "%";
};

export default function ComparePane({ T }) {
  const { paneCalcs, paneStates } = useWorkspace();

  const left = paneCalcs.left;
  const center = paneCalcs.center;

  // If we don't have calc data yet, show placeholder
  if (!left && !center) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: `${T.accent}12`, display: "flex",
          alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px", color: T.accent,
        }}>
          <Icon name="bar-chart" size={24} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>
          Live Comparison
        </div>
        <div style={{ fontSize: 13, color: T.textTertiary, lineHeight: 1.5 }}>
          Start entering loan details in Scenarios A and B. The comparison will update in real time as you adjust inputs.
        </div>
      </div>
    );
  }

  const stateL = paneStates.left || {};
  const stateC = paneStates.center || {};

  // Build comparison rows
  const metrics = [
    {
      section: "Monthly Payment",
      rows: [
        { label: "Total Payment", a: left?.displayPayment, b: center?.displayPayment, format: "dollar", lowerBetter: true },
        { label: "P&I", a: left?.pi, b: center?.pi, format: "dollar", lowerBetter: true },
        { label: "Property Tax", a: left?.monthlyTax, b: center?.monthlyTax, format: "dollar" },
        { label: "Insurance", a: left?.ins, b: center?.ins, format: "dollar" },
        { label: "MI/PMI", a: left?.monthlyMI, b: center?.monthlyMI, format: "dollar", lowerBetter: true },
      ],
    },
    {
      section: "Loan Details",
      rows: [
        { label: "Loan Amount", a: left?.loan, b: center?.loan, format: "dollar" },
        { label: "Rate", a: stateL.rate, b: stateC.rate, format: "rate" },
        { label: "Term", a: stateL.term, b: stateC.term, format: "years" },
        { label: "Down Payment", a: stateL.downPct, b: stateC.downPct, format: "pctDirect" },
        { label: "LTV", a: left?.ltv, b: center?.ltv, format: "pct", lowerBetter: true },
      ],
    },
    {
      section: "Qualification",
      rows: [
        { label: "Cash to Close", a: left?.cashToClose, b: center?.cashToClose, format: "dollar", lowerBetter: true },
        { label: "DTI", a: left?.yourDTI, b: center?.yourDTI, format: "pct", lowerBetter: true },
      ],
    },
    {
      section: "Long-Term",
      rows: [
        { label: "Total Interest", a: left?.totalIntStandard, b: center?.totalIntStandard, format: "dollar", lowerBetter: true },
      ],
    },
  ];

  const formatVal = (v, format) => {
    if (v === null || v === undefined || isNaN(v)) return "—";
    switch (format) {
      case "dollar": return fmt(v);
      case "pct": return pct(v);
      case "pctDirect": return pctDirect(v);
      case "rate": return v + "%";
      case "years": return v + " yr";
      default: return String(v);
    }
  };

  const getDelta = (a, b, format) => {
    if (a == null || b == null || isNaN(a) || isNaN(b)) return null;
    return b - a;
  };

  return (
    <div style={{ padding: "16px 0" }}>
      {/* Header */}
      <div style={{ padding: "0 4px", marginBottom: 20 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, fontFamily: MONO,
          textTransform: "uppercase", letterSpacing: "2px",
          color: T.accent, marginBottom: 6,
        }}>
          Live Comparison
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{
            flex: 1, padding: "6px 10px", borderRadius: 8,
            background: `${T.blue}10`, border: `1px solid ${T.blue}20`,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.blue }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: T.blue }}>
              {stateL.scenarioName || "A"}: {stateL.loanType || "—"}
            </span>
          </div>
          <div style={{
            flex: 1, padding: "6px 10px", borderRadius: 8,
            background: `${T.green}10`, border: `1px solid ${T.green}20`,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.green }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: T.green }}>
              {stateC.scenarioName || "B"}: {stateC.loanType || "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Winner callout */}
      {left?.displayPayment != null && center?.displayPayment != null && (
        <div style={{
          margin: "0 4px 16px", padding: 14, borderRadius: 12,
          background: T.successBg, border: `1px solid ${T.successBorder}`,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.green, marginBottom: 4 }}>
            {left.displayPayment <= center.displayPayment ? "Scenario A" : "Scenario B"} saves
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: MONO, color: T.green, letterSpacing: "-0.03em" }}>
            {fmt(Math.abs(left.displayPayment - center.displayPayment))}/mo
          </div>
        </div>
      )}

      {/* Metric sections */}
      {metrics.map((section) => (
        <div key={section.section} style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, fontFamily: MONO,
            textTransform: "uppercase", letterSpacing: "1.5px",
            color: T.textTertiary, padding: "8px 4px 4px",
          }}>
            {section.section}
          </div>
          <div style={{
            background: T.card, border: `1px solid ${T.cardBorder}`,
            borderRadius: 12, overflow: "hidden",
          }}>
            {section.rows.map((row, i) => {
              const delta = getDelta(row.a, row.b, row.format);
              const betterIsA = row.lowerBetter ? (row.a < row.b) : (row.a > row.b);
              const hasBoth = row.a != null && row.b != null && !isNaN(row.a) && !isNaN(row.b);

              return (
                <div key={row.label} style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                  padding: "8px 12px", alignItems: "center",
                  borderTop: i > 0 ? `1px solid ${T.separator}` : "none",
                }}>
                  <div style={{ fontSize: 12, color: T.textSecondary, fontWeight: 500 }}>
                    {row.label}
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 600, fontFamily: MONO,
                    color: hasBoth && betterIsA && row.lowerBetter !== undefined ? T.green : T.text,
                    textAlign: "center",
                  }}>
                    {formatVal(row.a, row.format)}
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 600, fontFamily: MONO,
                    color: hasBoth && !betterIsA && row.lowerBetter !== undefined ? T.green : T.text,
                    textAlign: "center",
                  }}>
                    {formatVal(row.b, row.format)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
