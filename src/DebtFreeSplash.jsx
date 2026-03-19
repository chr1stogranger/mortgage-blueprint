/**
 * DebtFreeSplash — Celebration + summary when sale proceeds
 * fully cover the mortgage payoff in Buy→Sell→Refi mode.
 *
 * Shows: confirmation, payoff breakdown, surplus funds, and
 * optional "what if you kept the mortgage?" toggle for v2.
 */
import React from "react";
import Icon from "./Icon";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

const fmt = (v) => "$" + Math.round(Math.abs(v || 0)).toLocaleString("en-US");

export default function DebtFreeSplash({ T, linkedValues }) {
  const proceeds = linkedValues.proceedsUseAll
    ? linkedValues.sellNetAfterTax
    : linkedValues.proceedsToApply;
  const loanBalance = linkedValues.purchaseLoanAmount || 0;
  const surplus = proceeds - loanBalance;
  const propertyValue = linkedValues.purchasePropertyValue || 0;

  return (
    <div style={{ padding: "32px 4px", textAlign: "center" }}>
      {/* Hero checkmark */}
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: `${T.green}15`, display: "flex",
        alignItems: "center", justifyContent: "center",
        margin: "0 auto 20px", color: T.green,
      }}>
        <Icon name="check" size={36} />
      </div>

      {/* Title */}
      <div style={{
        fontSize: 24, fontWeight: 800, letterSpacing: "-0.04em",
        color: T.text, lineHeight: 1.1, marginBottom: 6,
      }}>
        Mortgage-Free
      </div>
      <div style={{
        fontSize: 14, color: T.textSecondary, lineHeight: 1.5,
        marginBottom: 28, maxWidth: 320, margin: "0 auto 28px",
      }}>
        Your sale proceeds fully cover the loan payoff. No refinance needed.
      </div>

      {/* Key number */}
      <div style={{
        background: T.successBg, border: `1px solid ${T.successBorder}`,
        borderRadius: 16, padding: "20px 24px", marginBottom: 20,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, fontFamily: MONO,
          textTransform: "uppercase", letterSpacing: "2px",
          color: T.green, marginBottom: 8,
        }}>
          Surplus After Payoff
        </div>
        <div style={{
          fontSize: 32, fontWeight: 800, fontFamily: MONO,
          color: T.green, letterSpacing: "-0.03em",
        }}>
          {fmt(surplus)}
        </div>
      </div>

      {/* Breakdown card */}
      <div style={{
        background: T.card, border: `1px solid ${T.cardBorder}`,
        borderRadius: 12, overflow: "hidden", textAlign: "left",
        boxShadow: T.cardShadow,
      }}>
        <div style={{
          padding: "10px 14px", borderBottom: `1px solid ${T.separator}`,
          fontSize: 11, fontWeight: 600, fontFamily: MONO,
          textTransform: "uppercase", letterSpacing: "1.5px",
          color: T.textTertiary,
        }}>
          Payoff Breakdown
        </div>

        {[
          { label: "Net Sale Proceeds", value: fmt(proceeds), color: T.green },
          { label: "Loan Balance Payoff", value: `-${fmt(loanBalance)}`, color: T.red },
        ].map((row, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 14px", borderTop: i > 0 ? `1px solid ${T.separator}` : "none",
          }}>
            <span style={{ fontSize: 13, color: T.textSecondary }}>{row.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: MONO, color: row.color }}>
              {row.value}
            </span>
          </div>
        ))}

        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 14px", borderTop: `2px solid ${T.separator}`,
          background: T.successBg,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Remaining Funds</span>
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: MONO, color: T.green }}>
            {fmt(surplus)}
          </span>
        </div>
      </div>

      {/* What you could do with the surplus */}
      {surplus > 10000 && (
        <div style={{
          marginTop: 20, background: T.card, border: `1px solid ${T.cardBorder}`,
          borderRadius: 12, padding: 16, textAlign: "left",
          boxShadow: T.cardShadow,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, fontFamily: MONO,
            textTransform: "uppercase", letterSpacing: "1.5px",
            color: T.textTertiary, marginBottom: 12,
          }}>
            Surplus Allocation Ideas
          </div>
          {[
            { icon: "shield", label: "Emergency Reserve", desc: "6 months of expenses", color: T.blue },
            { icon: "home", label: "Home Improvements", desc: "Renovation or repairs", color: T.green },
            { icon: "trending-up", label: "Investment", desc: "Grow your wealth", color: T.purple },
            { icon: "banknote", label: "Closing Costs", desc: "Cover purchase fees", color: T.orange },
          ].map((item, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "8px 0",
              borderTop: i > 0 ? `1px solid ${T.separator}` : "none",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `${item.color}12`, display: "flex",
                alignItems: "center", justifyContent: "center",
                color: item.color, flexShrink: 0,
              }}>
                <Icon name={item.icon} size={14} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{item.label}</div>
                <div style={{ fontSize: 11, color: T.textTertiary }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Property ownership note */}
      {propertyValue > 0 && (
        <div style={{
          marginTop: 16, padding: "12px 14px", borderRadius: 12,
          background: `${T.accent}08`, border: `1px solid ${T.accent}15`,
          textAlign: "left",
        }}>
          <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5 }}>
            You'll own your {fmt(propertyValue)} home free and clear — no monthly mortgage payment, just taxes, insurance, and HOA.
          </div>
        </div>
      )}
    </div>
  );
}
