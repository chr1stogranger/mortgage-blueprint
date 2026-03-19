/**
 * RefiComparePane — Comparison summary for Refi workspace modes
 *
 * Shows side-by-side current loan vs proposed refi with key deltas:
 * payment savings, rate drop, breakeven, total interest savings, etc.
 */
import React from "react";
import { useWorkspace, WORKSPACE_MODES } from "./WorkspaceContext";
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

export default function RefiComparePane({ T }) {
  const { paneCalcs, paneStates, workspaceMode } = useWorkspace();

  const current = paneCalcs.left;
  const proposed = paneCalcs.center;
  const currentState = paneStates.left || {};
  const proposedState = paneStates.center || {};
  const isCashOut = workspaceMode === WORKSPACE_MODES.REFI_CASH_OUT;

  if (!current && !proposed) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: `${T.accent}12`, display: "flex",
          alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px", color: T.accent,
        }}>
          <Icon name="trending-down" size={24} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>
          Refi Comparison
        </div>
        <div style={{ fontSize: 13, color: T.textTertiary, lineHeight: 1.5 }}>
          Enter your current loan details on the left and proposed refi on the center pane. The comparison will update in real time.
        </div>
      </div>
    );
  }

  // Key metrics
  const currentPayment = current?.displayPayment || current?.housingPayment || 0;
  const proposedPayment = proposed?.displayPayment || proposed?.housingPayment || 0;
  const monthlySavings = currentPayment - proposedPayment;
  const annualSavings = monthlySavings * 12;

  const currentRate = currentState.rate || 0;
  const proposedRate = proposedState.rate || 0;
  const rateDrop = currentRate - proposedRate;

  const currentLoan = current?.loan || 0;
  const proposedLoan = proposed?.loan || 0;

  const currentTotalInt = current?.totalInt || 0;
  const proposedTotalInt = proposed?.totalInt || 0;
  const interestSaved = currentTotalInt - proposedTotalInt;

  // Refi closing costs (estimate from proposed pane)
  const refiCosts = proposed?.totalClosingCosts || 4500;
  const breakEvenMonths = monthlySavings > 0 ? Math.ceil(refiCosts / monthlySavings) : 0;

  // Cash out amount (for cash-out refi)
  const cashOutAmount = isCashOut ? Math.max(0, proposedLoan - currentLoan) : 0;

  const savingsPositive = monthlySavings > 0;

  return (
    <div style={{ padding: "16px 0" }}>
      {/* Hero — monthly savings */}
      <div style={{ marginBottom: 16, textAlign: "center" }}>
        <div style={{
          fontSize: 28, fontWeight: 800, fontFamily: FONT,
          color: savingsPositive ? T.green : T.red,
          letterSpacing: "-0.04em", lineHeight: 1,
        }}>
          {savingsPositive ? "" : "+"}{fmt(monthlySavings)}/mo
        </div>
        <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4, fontFamily: FONT }}>
          {savingsPositive ? "Monthly Savings" : "Monthly Increase"}
          {rateDrop > 0 && <span style={{ color: T.green }}> · {rateDrop.toFixed(2)}% rate drop</span>}
        </div>
      </div>

      {/* Key metrics strip */}
      <div style={{ display: "grid", gridTemplateColumns: isCashOut ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr", gap: 4, marginBottom: 16 }}>
        {[
          { label: "Savings/yr", value: fmt(annualSavings), color: savingsPositive ? T.green : T.red },
          { label: "Breakeven", value: breakEvenMonths > 0 ? `${breakEvenMonths} mo` : "—", color: breakEvenMonths <= 24 ? T.green : breakEvenMonths <= 48 ? T.orange : T.red },
          { label: "Int Saved", value: fmt(interestSaved), color: interestSaved > 0 ? T.green : T.red },
          ...(isCashOut ? [{ label: "Cash Out", value: fmt(cashOutAmount), color: T.blue }] : []),
        ].map((m, i) => (
          <div key={i} style={{ textAlign: "center", padding: "8px 4px", background: T.pillBg, borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: m.color, letterSpacing: "-0.02em" }}>{m.value}</div>
            <div style={{ fontSize: 8, color: T.textTertiary, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "1px" }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Side by side comparison */}
      <div style={{
        background: T.card, borderRadius: 12, overflow: "hidden",
        boxShadow: T.cardShadow, marginBottom: 12,
      }}>
        {/* Header row */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          padding: "8px 12px", borderBottom: `1px solid ${T.separator}`,
          background: T.bg2,
        }}>
          <span style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, color: T.textTertiary, textTransform: "uppercase", letterSpacing: "1px" }}>Metric</span>
          <span style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, color: T.red, textTransform: "uppercase", letterSpacing: "1px", textAlign: "center" }}>Current</span>
          <span style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, color: T.green, textTransform: "uppercase", letterSpacing: "1px", textAlign: "center" }}>Proposed</span>
        </div>

        {[
          { label: "Rate", current: currentRate + "%", proposed: proposedRate + "%", better: proposedRate < currentRate },
          { label: "Term", current: (currentState.term || 30) + " yr", proposed: (proposedState.term || 30) + " yr" },
          { label: "Loan Amount", current: fmt(currentLoan), proposed: fmt(proposedLoan), better: proposedLoan < currentLoan && !isCashOut },
          { label: "Payment", current: fmt(currentPayment), proposed: fmt(proposedPayment), better: proposedPayment < currentPayment },
          { label: "P&I", current: fmt(current?.pi), proposed: fmt(proposed?.pi), better: (proposed?.pi || 0) < (current?.pi || 0) },
          { label: "Tax", current: fmt(current?.monthlyTax), proposed: fmt(proposed?.monthlyTax) },
          { label: "Insurance", current: fmt(current?.ins), proposed: fmt(proposed?.ins) },
          { label: "MI/PMI", current: fmt(current?.monthlyMI), proposed: fmt(proposed?.monthlyMI), better: (proposed?.monthlyMI || 0) < (current?.monthlyMI || 0) },
          { label: "LTV", current: pct(current?.ltv), proposed: pct(proposed?.ltv), better: (proposed?.ltv || 1) < (current?.ltv || 1) },
          { label: "Loan Type", current: currentState.loanType || "—", proposed: proposedState.loanType || "—" },
          { label: "Total Interest", current: fmt(currentTotalInt), proposed: fmt(proposedTotalInt), better: proposedTotalInt < currentTotalInt },
        ].map((row, i) => (
          <div key={row.label} style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            padding: "6px 12px", alignItems: "center",
            borderTop: i > 0 ? `1px solid ${T.separator}` : "none",
          }}>
            <span style={{ fontSize: 12, color: T.textSecondary, fontWeight: 500 }}>{row.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: MONO, color: T.text, textAlign: "center" }}>{row.current}</span>
            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: MONO, color: row.better ? T.green : T.text, textAlign: "center" }}>{row.proposed}</span>
          </div>
        ))}
      </div>

      {/* Breakeven analysis */}
      {monthlySavings > 0 && refiCosts > 0 && (
        <div style={{
          background: T.card, borderRadius: 12, padding: 14,
          boxShadow: T.cardShadow, marginBottom: 12,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "1.5px", color: T.textTertiary, marginBottom: 8 }}>
            Breakeven Analysis
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.separator}` }}>
            <span style={{ fontSize: 12, color: T.textSecondary }}>Est. Refi Closing Costs</span>
            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: MONO, color: T.text }}>{fmt(refiCosts)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.separator}` }}>
            <span style={{ fontSize: 12, color: T.textSecondary }}>Monthly Savings</span>
            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: MONO, color: T.green }}>{fmt(monthlySavings)}/mo</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Breakeven</span>
            <span style={{
              fontSize: 15, fontWeight: 800, fontFamily: MONO,
              color: breakEvenMonths <= 24 ? T.green : breakEvenMonths <= 48 ? T.orange : T.red,
            }}>
              {breakEvenMonths} months
            </span>
          </div>
          <div style={{
            padding: "6px 8px", borderRadius: 8, marginTop: 4,
            background: breakEvenMonths <= 24 ? T.successBg : breakEvenMonths <= 48 ? T.warningBg : T.errorBg,
            fontSize: 10, fontWeight: 600, textAlign: "center",
            color: breakEvenMonths <= 24 ? T.green : breakEvenMonths <= 48 ? T.orange : T.red,
          }}>
            {breakEvenMonths <= 12 ? "Excellent — refi pays for itself within a year"
              : breakEvenMonths <= 24 ? "Good — refi breaks even in under 2 years"
              : breakEvenMonths <= 48 ? "Consider if you plan to stay 4+ years"
              : "Long breakeven — may not be worth it unless rates drop further"}
          </div>
        </div>
      )}

      {/* Cash-out details (for cash-out refi mode) */}
      {isCashOut && cashOutAmount > 0 && (
        <div style={{
          background: T.card, borderRadius: 12, padding: 14,
          boxShadow: T.cardShadow, marginBottom: 12,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "1.5px", color: T.textTertiary, marginBottom: 8 }}>
            Cash-Out Summary
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.separator}` }}>
            <span style={{ fontSize: 12, color: T.textSecondary }}>Current Balance</span>
            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: MONO, color: T.text }}>{fmt(currentLoan)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.separator}` }}>
            <span style={{ fontSize: 12, color: T.textSecondary }}>New Loan Amount</span>
            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: MONO, color: T.text }}>{fmt(proposedLoan)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Cash to You</span>
            <span style={{ fontSize: 16, fontWeight: 800, fontFamily: MONO, color: T.blue }}>{fmt(cashOutAmount)}</span>
          </div>
          <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 4, lineHeight: 1.4 }}>
            Cash-out is limited to 80% LTV on conventional. The cash can be used for debt payoff, home improvements, investments, or reserves.
          </div>
        </div>
      )}

      {/* Seasoning note */}
      <div style={{
        padding: "8px 10px", borderRadius: 8,
        background: `${T.blue}08`, border: `1px solid ${T.blue}15`,
        fontSize: 10, color: T.blue, fontWeight: 500, lineHeight: 1.4,
      }}>
        Refi available after 6-month seasoning period. Actual balance at time of refi will be slightly lower due to principal payments.
      </div>
    </div>
  );
}
