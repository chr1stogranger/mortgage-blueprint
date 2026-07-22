import { FONT } from "../lib/fonts.js";
import React from "react";


// Cash-to-Close summary card — used in both the Costs tab (top of fees) and the
// Calculator tab (right column, opposite Payment Breakdown). Brand-kit styled.
//
// PURCHASE — Down Payment + Closing Costs + Prepaids + Payoffs − Credits =
// Estimated Cash to Close.
// REFI (Christo 2026-07-22) — the full cash-out walk, mirroring his
// spreadsheet: (+) New Loan (−) Old Loan payoff (−) Closing Costs
// (−) Prepaids (−) Debts paid off (+) Credits to Borrower =
// Estimated Cash to Close (Cash Out). Positive = cash TO the borrower,
// negative = the borrower brings money.
//
// `stretch` — fill the parent's height with the total band pinned to the
// bottom edge, so it lines up with Payment Breakdown's Total Payment band.
export default function CashToCloseSummary({
  T, ACCENT, fmt,
  downPayment, closingCosts, prepaids, payoffs = 0, credits = 0,
  newLoan = 0, oldLoanPayoff = 0,
  isRefi = false,
  stretch = false,
}) {
  const total = isRefi
    ? newLoan - oldLoanPayoff - closingCosts - prepaids - payoffs + credits
    : downPayment + closingCosts + prepaids + payoffs - credits;
  const rows = isRefi ? [
    { label: "New Loan",             sign: "+", value: newLoan },
    { label: "Old Loan Payoff",      sign: "−", value: oldLoanPayoff },
    { label: "Closing Costs",        sign: "−", value: closingCosts },
    { label: "Prepaid Expenses",     sign: "−", value: prepaids },
    { label: "Debts to be Paid Off", sign: "−", value: payoffs },
    { label: "Credits to Borrower",  sign: "+", value: credits, credit: true },
  ] : [
    { label: "Down Payment",           sign: "+", value: downPayment },
    { label: "Closing Costs",          sign: "+", value: closingCosts },
    { label: "Prepaid Expenses",       sign: "+", value: prepaids },
    { label: "Loans / Debts to Payoff", sign: "+", value: payoffs },
    { label: "Credits To Buyer",        sign: "−", value: credits, credit: true },
  ];
  const totalLabel = isRefi
    ? `Estimated Cash to Close${total >= 0 ? " (Cash Out)" : ""}`
    : "Estimated Cash To Close";
  const totalColor = isRefi ? (total >= 0 ? (T.green || ACCENT) : ACCENT) : ACCENT;

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.cardBorder}`,
      borderRadius: 14,
      overflow: "hidden",
      marginBottom: 16,
      boxShadow: `0 0 0 1px ${ACCENT}10`,
      ...(stretch ? { flex: 1, display: "flex", flexDirection: "column" } : {}),
    }}>
      {/* Header band */}
      <div style={{
        background: `linear-gradient(135deg, ${ACCENT}18, ${ACCENT}0c)`,
        borderBottom: `1px solid ${ACCENT}38`,
        padding: "12px 18px",
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: ACCENT,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontFamily: FONT,
        }}>
          Cash To Close Summary
        </div>
      </div>

      {/* Rows */}
      {/* Body — styled to match Payment Breakdown rows (no dividers, same
          label color/weight, gap between rows instead of borders). Flex-grows
          under `stretch` so the total band pins to the bottom edge. */}
      <div style={{ padding: "12px 18px 14px", display: "flex", flexDirection: "column", gap: 10, ...(stretch ? { flex: 1 } : {}) }}>
        {rows.map((r) => (
          <div key={r.label} style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            minHeight: 28,
          }}>
            <span style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT }}>
              {r.label}
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              {/* Credits render green whichever sign they carry (− on
                  purchase, + on the refi walk). */}
              <span style={{
                fontFamily: FONT,
                fontSize: 13,
                color: r.credit ? T.green : T.textTertiary,
                fontWeight: 700,
                width: 12,
                textAlign: "center",
              }}>{r.sign}</span>
              <span style={{
                fontFamily: FONT,
                fontSize: 14,
                fontWeight: 600,
                color: T.text,
                textAlign: "right",
              }}>{fmt(r.value)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Total band */}
      <div style={{
        background: `${ACCENT}0E`,
        borderTop: `1.5px solid ${ACCENT}40`,
        padding: "16px 18px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          color: totalColor,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontFamily: FONT,
        }}>
          {totalLabel}
        </div>
        <div style={{
          fontFamily: FONT,
          fontSize: 22,
          fontWeight: 800,
          color: totalColor,
          letterSpacing: "-0.02em",
        }}>{isRefi && total < 0 ? `−${fmt(Math.abs(total))}` : fmt(total)}</div>
      </div>
    </div>
  );
}
