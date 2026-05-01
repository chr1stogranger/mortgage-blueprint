import React from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

// Cash-to-Close summary card — used in both the Costs tab (top of fees) and the
// Calculator tab (left column, below the donut). Brand-kit styled.
//
// Sums Down Payment + Closing Costs + Prepaids + Payoffs − Credits.
// Payoffs and Credits rows are dynamic — hide when zero per Christo (less noise
// on simple deals). Down Payment / Closing Costs / Prepaids stay visible even at
// $0 since they're load-bearing line items.
export default function CashToCloseSummary({
  T, ACCENT, fmt2,
  downPayment, closingCosts, prepaids, payoffs = 0, credits = 0,
  isRefi = false,
}) {
  const total = (isRefi ? 0 : downPayment) + closingCosts + prepaids + payoffs - credits;
  const rows = [
    !isRefi && { label: "Down Payment",         sign: "+", value: downPayment },
    { label: "Closing Costs",         sign: "+", value: closingCosts },
    { label: "Prepaid Expenses",      sign: "+", value: prepaids },
    payoffs > 0 && { label: "Loans / Debts to Payoff", sign: "+", value: payoffs },
    credits > 0 && { label: "Credits To Buyer",      sign: "−", value: credits },
  ].filter(Boolean);

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.cardBorder}`,
      borderRadius: 14,
      overflow: "hidden",
      marginBottom: 16,
      boxShadow: `0 0 0 1px ${ACCENT}10`,
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
          fontFamily: MONO,
        }}>
          Cash To Close Summary
        </div>
      </div>

      {/* Rows */}
      <div style={{ padding: "4px 18px 0" }}>
        {rows.map((r) => (
          <div key={r.label} style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "11px 0",
            borderBottom: `1px solid ${T.separator}`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.text, fontFamily: FONT }}>
              {r.label}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{
                fontFamily: FONT,
                fontSize: 13,
                color: r.sign === "−" ? T.green : T.textTertiary,
                fontWeight: 700,
                width: 12,
                textAlign: "center",
              }}>{r.sign}</span>
              <span style={{
                fontFamily: FONT,
                fontSize: 14,
                fontWeight: 600,
                color: T.text,
                minWidth: 110,
                textAlign: "right",
              }}>{fmt2(r.value)}</span>
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
          color: ACCENT,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontFamily: MONO,
        }}>
          Estimated {isRefi ? "Refi Cost" : "Cash To Close"}
        </div>
        <div style={{
          fontFamily: FONT,
          fontSize: 22,
          fontWeight: 800,
          color: ACCENT,
          letterSpacing: "-0.02em",
        }}>{fmt2(total)}</div>
      </div>
    </div>
  );
}
