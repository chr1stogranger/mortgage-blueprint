/**
 * SharePortal — Premium borrower-facing view of their Blueprint scenarios.
 * Loaded via ?share=UUID token. No authentication required.
 *
 * Design: RealStack brand system — dark mode, indigo/blue gradients,
 * Inter + JetBrains Mono, glassmorphic cards, subtle animations.
 *
 * Access levels:
 *   view_only  → calc_summary only, read-only
 *   can_adjust → full state_data, can create new scenarios
 *   full_edit  → full calculator access (loads into main Blueprint)
 */
import React, { useState, useEffect, useCallback } from "react";
import { fetchSharedData, saveSharedScenario } from "./api";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

const T = {
  bg: "#050505", card: "#0A0A0A", surface: "#0F0F0F",
  cardBorder: "rgba(255,255,255,0.06)", cardBorderHover: "rgba(255,255,255,0.12)",
  accent: "#6366F1", accentLight: "#818CF8", accentBright: "#A5B4FC",
  blue: "#3B82F6", teal: "#06B6D4", green: "#10B981", red: "#EF4444",
  amber: "#F59E0B", purple: "#8B5CF6",
  text: "#EDEDED", textSecondary: "#A1A1A1", textTertiary: "#666666",
  separator: "rgba(255,255,255,0.06)",
  inputBg: "#1A1A1A", inputBorder: "rgba(255,255,255,0.12)",
};

function fmt(v) {
  if (isNaN(v) || v == null) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}
function fmtRate(v) { return v ? Number(v).toFixed(3) + "%" : "\u2014"; }
function fmtPct(v) { return v != null ? Number(v).toFixed(1) + "%" : "\u2014"; }

// ─── Animated loading spinner ───────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
      <div style={{ textAlign: "center" }}>
        {/* Animated logo mark */}
        <div style={{
          width: 64, height: 64, margin: "0 auto 20px",
          borderRadius: 16,
          background: "linear-gradient(135deg, #6366F1, #3B82F6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 40px rgba(99,102,241,0.3)",
          animation: "pulse-glow 2s ease-in-out infinite",
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>
          <span style={{ color: T.text }}>Real</span><span style={{ color: T.accent }}>Stack</span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.textTertiary, textTransform: "uppercase", letterSpacing: "2px", marginTop: 6, fontFamily: MONO }}>
          BLUEPRINT
        </div>
        <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 16, animation: "fade-pulse 1.5s ease-in-out infinite" }}>
          Loading your mortgage blueprint...
        </div>
      </div>
      <style>{`
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 40px rgba(99,102,241,0.3); } 50% { box-shadow: 0 0 60px rgba(99,102,241,0.5); } }
        @keyframes fade-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}

// ─── Error state ────────────────────────────────────────────────────────────
function ErrorState({ error }) {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
      <div style={{ textAlign: "center", maxWidth: 400, padding: 24 }}>
        <div style={{
          width: 56, height: 56, margin: "0 auto 16px",
          borderRadius: 14, background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: "-0.03em", marginBottom: 8 }}>Link Not Found</div>
        <div style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.6 }}>
          {error === "Share link not found or expired"
            ? "This share link may have expired or been deactivated. Contact your loan officer for a new link."
            : error}
        </div>
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.04em" }}>
            <span style={{ color: T.textTertiary }}>Real</span><span style={{ color: T.accent }}>Stack</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Scenario Card ──────────────────────────────────────────────────────────
function ScenarioCard({ scenario, isSelected, onSelect }) {
  const cs = scenario.calc_summary || {};
  const name = scenario.name || "Untitled Scenario";
  const type = scenario.type === "refi" ? "Refinance" : "Purchase";
  const byBorrower = scenario.created_by === "borrower";

  return (
    <div
      onClick={onSelect}
      style={{
        background: isSelected ? "rgba(99,102,241,0.06)" : T.surface,
        border: `1px solid ${isSelected ? "rgba(99,102,241,0.25)" : T.cardBorder}`,
        borderRadius: 16, padding: "20px 22px", cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: isSelected ? "0 0 20px rgba(99,102,241,0.08)" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: FONT, letterSpacing: "-0.02em" }}>{name}</div>
          <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 3, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {type}
            {byBorrower && <span style={{ color: T.accent, marginLeft: 8 }}>YOUR ADJUSTMENT</span>}
          </div>
        </div>
        {isSelected && (
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            background: "linear-gradient(135deg, #6366F1, #3B82F6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        )}
      </div>

      {/* Key metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          { label: "Loan Amount", value: fmt(cs.loanAmount) },
          { label: "Rate", value: fmtRate(cs.rate) },
          { label: "Monthly P&I", value: fmt(cs.monthlyPI), highlight: true },
          { label: "Down Payment", value: fmt(cs.downPayment) },
          { label: "Down %", value: fmtPct(cs.downPct) },
          { label: "LTV", value: fmtPct(cs.ltv) },
        ].map(m => (
          <div key={m.label} style={{ padding: "6px 0" }}>
            <div style={{ fontSize: 9, color: T.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3, fontFamily: MONO }}>{m.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: m.highlight ? T.accent : T.text, fontFamily: MONO }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Tags */}
      {(cs.loanType || cs.term || cs.creditScore) && (
        <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
          {cs.loanType && <span style={{ fontSize: 10, fontWeight: 600, color: T.accentLight, background: `${T.accent}12`, padding: "3px 8px", borderRadius: 6, fontFamily: MONO }}>{cs.loanType}</span>}
          {cs.term && <span style={{ fontSize: 10, fontWeight: 600, color: T.textSecondary, background: "rgba(255,255,255,0.04)", padding: "3px 8px", borderRadius: 6, fontFamily: MONO }}>{cs.term}yr</span>}
          {cs.creditScore > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: T.green, background: "rgba(16,185,129,0.1)", padding: "3px 8px", borderRadius: 6, fontFamily: MONO }}>FICO {cs.creditScore}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Scenario Detail (can_adjust) ───────────────────────────────────────────
function ScenarioDetail({ scenario, accessLevel, shareToken, onScenarioCreated }) {
  const cs = scenario.calc_summary || {};
  const sd = scenario.state_data || {};
  const [adjusting, setAdjusting] = useState(false);
  const [adjValues, setAdjValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (sd) {
      setAdjValues({
        salesPrice: sd.salesPrice || sd.purchasePrice || "",
        downPayment: sd.downPayment || "",
        interestRate: sd.interestRate || sd.rate || "",
        loanTerm: sd.loanTerm || sd.term || 30,
      });
    }
  }, [scenario.id]);

  const handleSaveAdjustment = async () => {
    setSaving(true);
    try {
      const newStateData = { ...sd, ...adjValues };
      const newCalcSummary = {
        ...cs,
        salesPrice: Number(adjValues.salesPrice) || cs.salesPrice,
        downPayment: Number(adjValues.downPayment) || cs.downPayment,
        rate: Number(adjValues.interestRate) || cs.rate,
        term: Number(adjValues.loanTerm) || cs.term,
        loanAmount: (Number(adjValues.salesPrice) || cs.salesPrice || 0) - (Number(adjValues.downPayment) || cs.downPayment || 0),
      };
      const result = await saveSharedScenario(shareToken, {
        name: `${scenario.name || "Scenario"} \u2014 My Adjustment`,
        type: scenario.type || "purchase",
        state_data: newStateData,
        calc_summary: newCalcSummary,
      });
      setSaved(true);
      setAdjusting(false);
      if (onScenarioCreated) onScenarioCreated(result);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert("Could not save: " + e.message);
    }
    setSaving(false);
  };

  const adjField = (label, key, prefix = "", suffix = "") => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${T.separator}` }}>
      <span style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT }}>{label}</span>
      {adjusting ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {prefix && <span style={{ color: T.textTertiary, fontSize: 14 }}>{prefix}</span>}
          <input
            value={adjValues[key] || ""}
            onChange={e => setAdjValues(prev => ({ ...prev, [key]: e.target.value }))}
            style={{
              width: 130, fontSize: 16, fontWeight: 700, color: T.text,
              background: T.inputBg, border: `1px solid ${T.accent}40`,
              borderRadius: 10, padding: "8px 12px", textAlign: "right",
              fontFamily: MONO, outline: "none",
            }}
          />
          {suffix && <span style={{ color: T.textTertiary, fontSize: 13 }}>{suffix}</span>}
        </div>
      ) : (
        <span style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: MONO }}>
          {prefix}{adjValues[key] ? Number(adjValues[key]).toLocaleString() : "\u2014"}{suffix}
        </span>
      )}
    </div>
  );

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24, marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: MONO }}>SCENARIO DETAILS</div>
        {accessLevel === "can_adjust" && !adjusting && (
          <button onClick={() => setAdjusting(true)} style={{
            padding: "7px 14px", background: `${T.accent}12`, border: `1px solid ${T.accent}30`,
            borderRadius: 9999, color: T.accentLight, fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: FONT, transition: "all 0.15s",
          }}>Adjust Numbers</button>
        )}
        {saved && <span style={{ fontSize: 12, color: T.green, fontWeight: 600 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ verticalAlign: "-2px", marginRight: 4 }}><polyline points="20 6 9 17 4 12"/></svg>Saved</span>}
      </div>

      {adjField("Purchase Price", "salesPrice", "$")}
      {adjField("Down Payment", "downPayment", "$")}
      {adjField("Interest Rate", "interestRate", "", "%")}
      {adjField("Loan Term", "loanTerm", "", " years")}

      {/* Summary */}
      <div style={{ marginTop: 18, padding: 16, background: `${T.accent}06`, borderRadius: 12, border: `1px solid ${T.accent}10` }}>
        <div style={{ fontSize: 9, color: T.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontFamily: MONO, fontWeight: 700 }}>ESTIMATED SUMMARY</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            { label: "Loan Amount", value: fmt((Number(adjValues.salesPrice) || 0) - (Number(adjValues.downPayment) || 0)) },
            { label: "Monthly P&I", value: cs.monthlyPI ? fmt(cs.monthlyPI) : "\u2014" },
            { label: "LTV", value: adjValues.salesPrice ? ((((Number(adjValues.salesPrice) || 0) - (Number(adjValues.downPayment) || 0)) / (Number(adjValues.salesPrice) || 1)) * 100).toFixed(1) + "%" : "\u2014" },
            { label: "Loan Type", value: cs.loanType || "\u2014" },
          ].map(m => (
            <div key={m.label}>
              <div style={{ fontSize: 9, color: T.textTertiary, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: MONO, marginTop: 2 }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {adjusting && (
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button onClick={handleSaveAdjustment} disabled={saving} style={{
            flex: 1, padding: 14, background: "linear-gradient(135deg, #6366F1, #3B82F6)", border: "none",
            borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 700,
            cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
            fontFamily: FONT, boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
          }}>{saving ? "Saving..." : "Save My Adjustment"}</button>
          <button onClick={() => setAdjusting(false)} style={{
            padding: "14px 20px", background: "rgba(255,255,255,0.04)", border: `1px solid ${T.separator}`,
            borderRadius: 12, color: T.textSecondary, fontSize: 14, cursor: "pointer", fontFamily: FONT,
          }}>Cancel</button>
        </div>
      )}
    </div>
  );
}

// ─── Main SharePortal Component ─────────────────────────────────────────────
export default function SharePortal({ shareToken, onEnterFullCalculator }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (!shareToken) return;
    setLoading(true);
    fetchSharedData(shareToken)
      .then(d => { setData(d); setError(""); })
      .catch(e => { setError(e.message || "Could not load share link"); })
      .finally(() => setLoading(false));
  }, [shareToken]);

  const handleScenarioCreated = useCallback((newScenario) => {
    setData(prev => {
      if (!prev) return prev;
      const newScenarios = Array.isArray(newScenario) ? newScenario : [newScenario];
      return { ...prev, scenarios: [...newScenarios, ...prev.scenarios] };
    });
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const { borrower, accessLevel, scenarios } = data;
  const selected = scenarios[selectedIdx] || null;
  const canAdjust = accessLevel === "can_adjust" || accessLevel === "full_edit";
  const firstName = borrower?.name?.split(" ")[0] || "";

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT }}>
      {/* Global styles */}
      <style>{`
        @keyframes gradient-shift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .share-card { animation: fade-in 0.4s ease-out forwards; opacity: 0; }
        .share-card:nth-child(1) { animation-delay: 0.1s; }
        .share-card:nth-child(2) { animation-delay: 0.2s; }
        .share-card:nth-child(3) { animation-delay: 0.3s; }
      `}</style>

      {/* ── Header (glassmorphic) ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(5,5,5,0.7)", backdropFilter: "blur(20px) saturate(180%)",
        borderBottom: `1px solid ${T.separator}`,
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Logo mark */}
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, #6366F1, #3B82F6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 12px rgba(99,102,241,0.25)",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1 }}>
                <span style={{ color: T.text }}>Real</span><span style={{ color: T.accent }}>Stack</span>
              </div>
              <div style={{ fontSize: 9, fontWeight: 600, color: T.textTertiary, textTransform: "uppercase", letterSpacing: "1.5px", fontFamily: MONO }}>BLUEPRINT</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: T.text, fontWeight: 600, fontFamily: FONT }}>{borrower?.name || "Your Blueprint"}</div>
            <div style={{ fontSize: 10, color: T.textTertiary, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {accessLevel === "view_only" ? "VIEW ONLY" : accessLevel === "can_adjust" ? "CAN ADJUST" : "FULL ACCESS"}
            </div>
          </div>
        </div>
      </div>

      {/* ── Hero Section ── */}
      <div style={{
        position: "relative", overflow: "hidden",
        padding: "48px 20px 40px",
        background: "linear-gradient(180deg, rgba(99,102,241,0.08) 0%, rgba(5,5,5,0) 100%)",
      }}>
        {/* Subtle grid pattern */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.03,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        <div style={{ maxWidth: 640, margin: "0 auto", position: "relative" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.accent, textTransform: "uppercase", letterSpacing: "2px", fontFamily: MONO, marginBottom: 12 }}>
            YOUR MORTGAGE BLUEPRINT
          </div>
          <h1 style={{
            fontSize: 36, fontWeight: 900, color: T.text,
            letterSpacing: "-0.05em", lineHeight: 1.1, margin: 0,
            fontFamily: FONT,
          }}>
            {firstName ? `Welcome, ${firstName}.` : "Welcome."}
          </h1>
          <p style={{
            fontSize: 16, color: T.textSecondary, lineHeight: 1.6,
            margin: "14px 0 0", maxWidth: 480, fontFamily: FONT,
          }}>
            {canAdjust
              ? "Your loan officer has prepared your mortgage scenarios below. Adjust the numbers to explore different options."
              : "Review the mortgage scenarios your loan officer has prepared for you."}
          </p>

          {/* Glow divider */}
          <div style={{
            width: 60, height: 2, marginTop: 24,
            background: "linear-gradient(90deg, #6366F1, #3B82F6)",
            borderRadius: 2,
          }} />
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 20px 120px" }}>

        {/* Scenario count */}
        <div style={{
          fontSize: 10, fontWeight: 600, color: T.textTertiary,
          textTransform: "uppercase", letterSpacing: "0.1em",
          marginBottom: 14, fontFamily: MONO,
        }}>
          {scenarios.length} SCENARIO{scenarios.length !== 1 ? "S" : ""}
        </div>

        {/* Scenario list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {scenarios.map((s, i) => (
            <div key={s.id || i} className="share-card">
              <ScenarioCard
                scenario={s}
                isSelected={selectedIdx === i}
                onSelect={() => setSelectedIdx(i)}
              />
            </div>
          ))}
        </div>

        {/* No scenarios — empty state */}
        {scenarios.length === 0 && (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            background: T.surface, borderRadius: 16,
            border: `1px dashed ${T.cardBorder}`,
          }}>
            <div style={{
              width: 56, height: 56, margin: "0 auto 16px",
              borderRadius: 14, background: "rgba(255,255,255,0.03)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.textTertiary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div style={{ fontSize: 16, color: T.textSecondary, fontWeight: 600, fontFamily: FONT }}>No scenarios yet</div>
            <div style={{ fontSize: 13, color: T.textTertiary, marginTop: 6, lineHeight: 1.5, fontFamily: FONT }}>
              Your loan officer is working on your mortgage blueprint. Check back soon.
            </div>
          </div>
        )}

        {/* Selected scenario detail */}
        {selected && canAdjust && (
          <ScenarioDetail
            scenario={selected}
            accessLevel={accessLevel}
            shareToken={shareToken}
            onScenarioCreated={handleScenarioCreated}
          />
        )}

        {/* Full calculator button */}
        {accessLevel === "full_edit" && selected?.state_data && onEnterFullCalculator && (
          <button
            onClick={() => onEnterFullCalculator(selected.state_data)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", marginTop: 18,
              padding: 16, background: "linear-gradient(135deg, #6366F1, #3B82F6)",
              border: "none", borderRadius: 12, color: "#fff",
              fontSize: 16, fontWeight: 700, cursor: "pointer",
              fontFamily: FONT, letterSpacing: "-0.02em",
              boxShadow: "0 4px 20px rgba(99,102,241,0.3)",
            }}
          >
            Open Full Calculator
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        )}

        {/* Disclaimer */}
        <div style={{
          marginTop: 32, padding: "14px 16px",
          background: "rgba(255,255,255,0.02)", borderRadius: 10,
          border: `1px solid ${T.separator}`,
        }}>
          <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.6, fontFamily: FONT }}>
            Subject to lender requirements. Rates change daily. This is not a commitment to lend or a guarantee of approval. Contact your loan officer for personalized guidance.
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(5,5,5,0.85)", backdropFilter: "blur(16px) saturate(180%)",
        borderTop: `1px solid ${T.separator}`,
        padding: "10px 20px",
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.04em" }}>
            <span style={{ color: T.textTertiary }}>Real</span><span style={{ color: T.accent }}>Stack</span>
          </div>
          <div style={{ fontSize: 10, color: T.textTertiary, fontFamily: MONO, letterSpacing: "0.04em" }}>
            MORTGAGE TECHNOLOGY PLATFORM
          </div>
        </div>
      </div>
    </div>
  );
}
