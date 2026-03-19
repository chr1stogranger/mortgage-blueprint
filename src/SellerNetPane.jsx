/**
 * SellerNetPane — Standalone Seller Net Proceeds calculator for Workspace
 *
 * Mirrors the Seller Net tab from MortgageBlueprint.jsx but runs independently
 * with its own state. Reports net proceeds back to workspace context for
 * cross-pane data linking.
 */
import React, { useState, useMemo, useEffect } from "react";
import Icon from "./Icon";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

let T = {};

function fmt(v) {
  if (v == null || !isFinite(v) || isNaN(v)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

// ── Compact UI (same as BlueprintPane) ──
function PaneInp({ label, value, onChange, prefix = "$", suffix, step = 1, min = 0, max, tip }) {
  const [focused, setFocused] = useState(false);
  const [editStr, setEditStr] = useState(null);
  const fmtComma = (n) => { if (n === 0 || n === "") return ""; const parts = String(n).split("."); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ","); return parts.join("."); };
  const clamp = (n) => { if (isNaN(n)) return 0; if (min !== undefined && n < min) return min; if (max !== undefined && n > max) return max; return n; };
  const display = editStr !== null ? editStr : (value === 0 && focused ? "" : fmtComma(value));
  return (<div style={{ marginBottom: 10 }}>
    {label && <div style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary, marginBottom: 4, fontFamily: FONT }}>{label}</div>}
    <div style={{ display: "flex", alignItems: "center", background: T.inputBg, borderRadius: 10, padding: "8px 10px", border: focused ? `2px solid ${T.blue}` : `1px solid ${T.inputBorder}` }}>
      {prefix && <span style={{ color: T.textSecondary, fontSize: 14, fontWeight: 600, marginRight: 3 }}>{prefix}</span>}
      <input type="text" inputMode="decimal" value={display}
        onFocus={() => { setFocused(true); setEditStr(null); }}
        onBlur={() => { setFocused(false); if (editStr !== null) { const n = clamp(parseFloat(editStr.replace(/,/g, ""))); onChange(isNaN(n) ? 0 : n); setEditStr(null); } }}
        onChange={e => { const raw = e.target.value.replace(/,/g, ""); if (raw === "" || raw === "-") { setEditStr(""); return; } if (/^-?\d*\.?\d*$/.test(raw)) { const n = parseFloat(raw); setEditStr(raw.replace(/\B(?=(\d{3})+(?!\d))/g, ",")); if (!isNaN(n)) onChange(n); } }}
        style={{ background: "transparent", border: "none", outline: "none", color: T.text, fontSize: 14, fontWeight: 600, fontFamily: FONT, width: "100%", letterSpacing: "-0.02em" }} />
      {suffix && <span style={{ color: T.textTertiary, fontSize: 11, marginLeft: 4 }}>{suffix}</span>}
    </div>
  </div>);
}

function PaneCard({ children, style: s }) {
  return (<div style={{ background: T.card, borderRadius: 12, padding: 14, boxShadow: T.cardShadow, marginBottom: 10, ...s }}>{children}</div>);
}

function PaneRow({ label, value, sub, color, bold }) {
  return (<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: `1px solid ${T.separator}` }}>
    <span style={{ fontSize: bold ? 13 : 12, fontWeight: bold ? 600 : 400, color: bold ? T.text : T.textSecondary, fontFamily: FONT }}>
      {label}{sub && <span style={{ color: T.textTertiary, fontSize: 10, marginLeft: 4 }}>{sub}</span>}
    </span>
    <span style={{ fontSize: bold ? 15 : 13, fontWeight: 600, fontFamily: MONO, color: color || T.text, letterSpacing: "-0.02em" }}>{value}</span>
  </div>);
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function SellerNetPane({ theme, paneId, onNetProceedsUpdate, sharedFilingStatus }) {
  T = theme;

  // ── State ──
  const [sellPrice, setSellPrice] = useState(1200000);
  const [mortgagePayoff, setMortgagePayoff] = useState(400000);
  const [commission, setCommission] = useState(5);
  const [escrowCost, setEscrowCost] = useState(3500);
  const [titleCost, setTitleCost] = useState(2500);
  const [otherCosts, setOtherCosts] = useState(0);
  const [sellerCredit, setSellerCredit] = useState(0);

  // Capital gains
  const [costBasis, setCostBasis] = useState(600000);
  const [improvements, setImprovements] = useState(50000);
  const [yearsOwned, setYearsOwned] = useState(10);
  const [primaryRes, setPrimaryRes] = useState(true);
  const [filingStatus, setFilingStatus] = useState(sharedFilingStatus || "MFJ");

  // Auto-fill filing status from main app
  useEffect(() => {
    if (sharedFilingStatus) setFilingStatus(sharedFilingStatus);
  }, [sharedFilingStatus]);

  // ── Calculation ──
  const calc = useMemo(() => {
    const commAmt = sellPrice * (commission / 100);
    const transferTax = sellPrice * 0.0011; // ~$1.10/$1000 default
    const totalCosts = commAmt + escrowCost + titleCost + transferTax + otherCosts + sellerCredit;
    const netProceeds = sellPrice - mortgagePayoff - totalCosts;

    // Capital gains
    const adjBasis = costBasis + improvements;
    const grossGain = sellPrice - adjBasis - totalCosts;
    const isMFJ = filingStatus === "MFJ";
    const exclusionLimit = primaryRes && yearsOwned >= 2 ? (isMFJ ? 500000 : 250000) : 0;
    const taxableGain = Math.max(0, grossGain - exclusionLimit);
    const isLongTerm = yearsOwned >= 1;

    // Federal capital gains tax (simplified)
    const fedRate = isLongTerm ? (taxableGain > 500000 ? 0.20 : taxableGain > 90000 ? 0.15 : 0) : 0.24;
    const fedTax = taxableGain * fedRate;
    // State (CA default ~9.3%)
    const stateTax = taxableGain * 0.093;
    // NIIT
    const niit = taxableGain > 200000 ? taxableGain * 0.038 : 0;
    const totalCapGainsTax = fedTax + stateTax + niit;
    const netAfterTax = netProceeds - totalCapGainsTax;

    return {
      commAmt, transferTax, totalCosts, netProceeds,
      adjBasis, grossGain, exclusionLimit, taxableGain,
      isLongTerm, fedRate, fedTax, stateTax, niit, totalCapGainsTax,
      netAfterTax,
    };
  }, [sellPrice, mortgagePayoff, commission, escrowCost, titleCost, otherCosts, sellerCredit, costBasis, improvements, yearsOwned, primaryRes, filingStatus]);

  // ── Report back to workspace ──
  useEffect(() => {
    if (onNetProceedsUpdate) {
      onNetProceedsUpdate({
        sellNetProceeds: calc.netProceeds,
        sellNetAfterTax: calc.netAfterTax,
      });
    }
  }, [calc.netProceeds, calc.netAfterTax]);

  return (
    <div style={{ padding: "12px 0" }}>
      {/* Hero — compact */}
      <div style={{ marginBottom: 12, textAlign: "center" }}>
        <div style={{ fontSize: 26, fontWeight: 800, fontFamily: FONT, color: calc.netAfterTax >= 0 ? T.green : T.red, letterSpacing: "-0.04em", lineHeight: 1 }}>
          {fmt(calc.netAfterTax)}
        </div>
        <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 3, fontFamily: FONT }}>
          Net After Tax{calc.totalCapGainsTax > 0 && <span style={{ color: T.orange }}> · {fmt(calc.totalCapGainsTax)} cap gains</span>}
        </div>
      </div>

      {/* Quick metrics — tighter */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 10 }}>
        {[
          { label: "Net", value: fmt(calc.netProceeds), color: T.green },
          { label: "Costs", value: fmt(calc.totalCosts), color: T.red },
          { label: "Comm", value: fmt(calc.commAmt), color: T.text },
        ].map((m, i) => (
          <div key={i} style={{ textAlign: "center", padding: "6px 4px", background: T.pillBg, borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: m.color, letterSpacing: "-0.02em" }}>{m.value}</div>
            <div style={{ fontSize: 8, color: T.textTertiary, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "1px" }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Sale Details — compact with 2-col grids */}
      <PaneCard>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <PaneInp label="Sale Price" value={sellPrice} onChange={setSellPrice} />
          <PaneInp label="Mortgage Payoff" value={mortgagePayoff} onChange={setMortgagePayoff} />
        </div>
        <PaneInp label="Commission %" value={commission} onChange={setCommission} prefix="" suffix="%" step={0.25} max={10} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <PaneInp label="Escrow" value={escrowCost} onChange={setEscrowCost} />
          <PaneInp label="Title" value={titleCost} onChange={setTitleCost} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <PaneInp label="Other Costs" value={otherCosts} onChange={setOtherCosts} />
          <PaneInp label="Seller Credit" value={sellerCredit} onChange={setSellerCredit} />
        </div>
      </PaneCard>

      {/* Summary — compact */}
      <PaneCard style={{ background: calc.netAfterTax >= 0 ? T.successBg : T.errorBg, padding: 10 }}>
        <PaneRow label="Sale Price" value={fmt(sellPrice)} bold />
        <PaneRow label="Mortgage Payoff" value={`-${fmt(mortgagePayoff)}`} color={T.red} />
        <PaneRow label="Total Costs" value={`-${fmt(calc.totalCosts)}`} color={T.red} />
        <div style={{ borderTop: `1px solid ${T.separator}`, marginTop: 3, paddingTop: 3 }}>
          <PaneRow label="Net Proceeds" value={fmt(calc.netProceeds)} color={calc.netProceeds >= 0 ? T.green : T.red} bold />
        </div>
        {calc.totalCapGainsTax > 0 && <PaneRow label="Cap Gains Tax" value={`-${fmt(calc.totalCapGainsTax)}`} color={T.red} />}
        <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 3, paddingTop: 3 }}>
          <PaneRow label="Net After Tax" value={fmt(calc.netAfterTax)} color={calc.netAfterTax >= 0 ? T.green : T.red} bold />
        </div>
      </PaneCard>

      {/* Capital Gains — inline, always visible, compact */}
      <PaneCard style={{ padding: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "1.5px", color: T.textTertiary, marginBottom: 8 }}>
          Capital Gains Estimate
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <PaneInp label="Original Purchase Price" value={costBasis} onChange={setCostBasis} />
          <PaneInp label="Improvements" value={improvements} onChange={setImprovements} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, alignItems: "end" }}>
          <PaneInp label="Years Owned" value={yearsOwned} onChange={setYearsOwned} prefix="" suffix="yrs" step={1} max={50} />
          {/* Primary Residence — Yes/No pills */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: T.textSecondary, marginBottom: 4, fontFamily: FONT }}>Primary Residence</div>
            <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.inputBorder}` }}>
              {[true, false].map(v => (
                <button key={String(v)} onClick={() => setPrimaryRes(v)} style={{
                  flex: 1, padding: "6px 0", border: "none", cursor: "pointer",
                  background: primaryRes === v ? (v ? T.green : T.red) : T.inputBg,
                  color: primaryRes === v ? "#fff" : T.textTertiary,
                  fontSize: 11, fontWeight: 600, fontFamily: FONT,
                }}>
                  {v ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>
          {/* Filing Status — dropdown */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: T.textSecondary, marginBottom: 4, fontFamily: FONT }}>Filing Status</div>
            <select value={filingStatus} onChange={e => setFilingStatus(e.target.value)} style={{
              width: "100%", background: T.inputBg, borderRadius: 8, border: `1px solid ${T.inputBorder}`,
              padding: "6px 8px", color: T.text, fontSize: 11, fontWeight: 500,
              outline: "none", cursor: "pointer", fontFamily: FONT, WebkitAppearance: "none",
            }}>
              <option value="MFJ">Married Filing Jointly</option>
              <option value="MFS">Married Filing Separately</option>
              <option value="Single">Single</option>
              <option value="HOH">Head of Household</option>
            </select>
          </div>
        </div>
        {/* Exemption callout */}
        {primaryRes && yearsOwned >= 2 && (
          <div style={{ padding: "6px 8px", borderRadius: 8, background: `${T.blue}08`, border: `1px solid ${T.blue}15`, marginTop: 2, marginBottom: 4 }}>
            <div style={{ fontSize: 10, color: T.blue, fontWeight: 600, lineHeight: 1.4 }}>
              IRC §121: Up to {filingStatus === "MFJ" ? "$500K" : "$250K"} excluded — lived in home 2 of last 5 years ({filingStatus === "MFJ" ? "married filing jointly" : filingStatus === "MFS" ? "married filing separately" : filingStatus === "HOH" ? "head of household" : "single"})
            </div>
          </div>
        )}
        {primaryRes && yearsOwned < 2 && (
          <div style={{ padding: "6px 8px", borderRadius: 8, background: T.warningBg, marginTop: 2, marginBottom: 4, fontSize: 10, color: T.orange, fontWeight: 600 }}>
            Must have lived in home 2 of the last 5 years for §121 exclusion
          </div>
        )}
        {/* Result — inline */}
        {calc.taxableGain > 0 ? (
          <div style={{ borderTop: `1px solid ${T.separator}`, paddingTop: 6, marginTop: 2 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <PaneRow label="Taxable Gain" value={fmt(calc.taxableGain)} color={T.orange} />
              <PaneRow label="Total Tax" value={fmt(calc.totalCapGainsTax)} color={T.red} bold />
            </div>
          </div>
        ) : calc.grossGain > 0 ? (
          <div style={{ padding: "6px 8px", borderRadius: 8, background: T.successBg, marginTop: 4, fontSize: 10, color: T.green, fontWeight: 600, textAlign: "center" }}>
            Entire gain excluded — no capital gains tax owed
          </div>
        ) : null}
      </PaneCard>
    </div>
  );
}
