/**
 * SharePortal — Borrower-facing view of their Blueprint scenarios.
 * Loaded via ?share=UUID token. No authentication required.
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

// Simplified theme (dark only for portal)
const T = {
  bg: "#050505", card: "#0F0F0F", cardBorder: "rgba(255,255,255,0.06)",
  accent: "#6366F1", blue: "#3B82F6", green: "#10B981", red: "#EF4444",
  text: "#EDEDED", textSecondary: "#A1A1A1", textTertiary: "#666666",
  separator: "rgba(255,255,255,0.06)", inputBg: "#1A1A1A", inputBorder: "rgba(255,255,255,0.12)",
};

function fmt(v) {
  if (isNaN(v) || v == null) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}
function fmtRate(v) { return v ? Number(v).toFixed(3) + "%" : "—"; }
function fmtPct(v) { return v != null ? Number(v).toFixed(1) + "%" : "—"; }

// ─── Scenario Card (view_only) ──────────────────────────────────────────────
function ScenarioCard({ scenario, isSelected, onSelect }) {
  const cs = scenario.calc_summary || {};
  const name = scenario.name || "Untitled Scenario";
  const type = scenario.type === "refi" ? "Refinance" : "Purchase";
  const byBorrower = scenario.created_by === "borrower";

  return (
    <div
      onClick={onSelect}
      style={{
        background: isSelected ? "#0A84FF15" : T.card,
        border: `1px solid ${isSelected ? "#0A84FF40" : T.cardBorder}`,
        borderRadius: 14, padding: "18px 20px", cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text, fontFamily: FONT }}>{name}</div>
          <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
            {type}
            {byBorrower && <span style={{ color: T.accent, marginLeft: 6 }}>Your adjustment</span>}
          </div>
        </div>
        {isSelected && <span style={{ fontSize: 18, color: T.blue }}>✓</span>}
      </div>

      {/* Key metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[
          { label: "Loan Amount", value: fmt(cs.loanAmount) },
          { label: "Rate", value: fmtRate(cs.rate) },
          { label: "Monthly P&I", value: fmt(cs.monthlyPI) },
          { label: "Down Payment", value: fmt(cs.downPayment) },
          { label: "Down %", value: fmtPct(cs.downPct) },
          { label: "LTV", value: fmtPct(cs.ltv) },
        ].map(m => (
          <div key={m.label} style={{ padding: "8px 0" }}>
            <div style={{ fontSize: 10, color: T.textTertiary, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2, fontFamily: FONT }}>{m.label}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: MONO }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Additional details */}
      {(cs.loanType || cs.term || cs.creditScore) && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {cs.loanType && <span style={{ fontSize: 11, color: T.blue, background: "#0A84FF15", padding: "3px 8px", borderRadius: 6 }}>{cs.loanType}</span>}
          {cs.term && <span style={{ fontSize: 11, color: T.textSecondary, background: T.inputBg, padding: "3px 8px", borderRadius: 6 }}>{cs.term}yr</span>}
          {cs.creditScore && <span style={{ fontSize: 11, color: T.green, background: "rgba(48,209,88,0.12)", padding: "3px 8px", borderRadius: 6 }}>Credit: {cs.creditScore}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Scenario Detail (can_adjust — full state_data view) ────────────────────
function ScenarioDetail({ scenario, accessLevel, shareToken, onScenarioCreated }) {
  const cs = scenario.calc_summary || {};
  const sd = scenario.state_data || {};
  const [adjusting, setAdjusting] = useState(false);
  const [adjValues, setAdjValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Initialize adjustment values from state_data
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
      // Build new state_data with adjustments merged
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
        name: `${scenario.name || "Scenario"} — My Adjustment`,
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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.separator}` }}>
      <span style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT }}>{label}</span>
      {adjusting ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {prefix && <span style={{ color: T.textTertiary, fontSize: 14 }}>{prefix}</span>}
          <input
            value={adjValues[key] || ""}
            onChange={e => setAdjValues(prev => ({ ...prev, [key]: e.target.value }))}
            style={{
              width: 120, fontSize: 15, fontWeight: 600, color: T.text,
              background: T.inputBg, border: `1px solid ${T.inputBorder}`,
              borderRadius: 8, padding: "6px 10px", textAlign: "right",
              fontFamily: MONO, outline: "none",
            }}
          />
          {suffix && <span style={{ color: T.textTertiary, fontSize: 13 }}>{suffix}</span>}
        </div>
      ) : (
        <span style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: MONO }}>
          {prefix}{adjValues[key] ? Number(adjValues[key]).toLocaleString() : "—"}{suffix}
        </span>
      )}
    </div>
  );

  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: "20px", marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: FONT }}>Scenario Details</div>
        {accessLevel === "can_adjust" && !adjusting && (
          <button onClick={() => setAdjusting(true)} style={{
            padding: "6px 14px", background: "#0A84FF20", border: "1px solid #0A84FF40",
            borderRadius: 8, color: T.blue, fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: FONT,
          }}>Adjust Numbers</button>
        )}
        {saved && <span style={{ fontSize: 12, color: T.green }}>✓ Saved</span>}
      </div>

      {adjField("Purchase Price", "salesPrice", "$")}
      {adjField("Down Payment", "downPayment", "$")}
      {adjField("Interest Rate", "interestRate", "", "%")}
      {adjField("Loan Term", "loanTerm", "", " years")}

      {/* Computed values */}
      <div style={{ marginTop: 16, padding: "14px 16px", background: T.bg, borderRadius: 10 }}>
        <div style={{ fontSize: 11, color: T.textTertiary, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontFamily: FONT }}>Summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { label: "Loan Amount", value: fmt((Number(adjValues.salesPrice) || 0) - (Number(adjValues.downPayment) || 0)) },
            { label: "Monthly P&I", value: cs.monthlyPI ? fmt(cs.monthlyPI) : "—" },
            { label: "LTV", value: adjValues.salesPrice ? ((((Number(adjValues.salesPrice) || 0) - (Number(adjValues.downPayment) || 0)) / (Number(adjValues.salesPrice) || 1)) * 100).toFixed(1) + "%" : "—" },
            { label: "Loan Type", value: cs.loanType || "—" },
          ].map(m => (
            <div key={m.label}>
              <div style={{ fontSize: 10, color: T.textTertiary, fontFamily: FONT }}>{m.label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: MONO }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Save/Cancel buttons when adjusting */}
      {adjusting && (
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={handleSaveAdjustment} disabled={saving} style={{
            flex: 1, padding: "12px", background: "#0A84FF", border: "none",
            borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 600,
            cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
            fontFamily: FONT,
          }}>{saving ? "Saving..." : "Save My Adjustment"}</button>
          <button onClick={() => setAdjusting(false)} style={{
            padding: "12px 20px", background: T.inputBg, border: `1px solid ${T.separator}`,
            borderRadius: 10, color: T.textSecondary, fontSize: 14, cursor: "pointer",
            fontFamily: FONT,
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
  const [data, setData] = useState(null); // { borrower, accessLevel, scenarios }
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Fetch shared data on mount
  useEffect(() => {
    if (!shareToken) return;
    setLoading(true);
    fetchSharedData(shareToken)
      .then(d => {
        setData(d);
        setError("");
      })
      .catch(e => {
        setError(e.message || "Could not load share link");
      })
      .finally(() => setLoading(false));
  }, [shareToken]);

  const handleScenarioCreated = useCallback((newScenario) => {
    // Add the new scenario to the list
    setData(prev => {
      if (!prev) return prev;
      const newScenarios = Array.isArray(newScenario) ? newScenario : [newScenario];
      return {
        ...prev,
        scenarios: [...newScenarios, ...prev.scenarios],
      };
    });
  }, []);

  // ─── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📐</div>
          <div style={{ fontSize: 16, color: T.text, fontWeight: 600 }}>Loading your Blueprint...</div>
          <div style={{ fontSize: 13, color: T.textTertiary, marginTop: 4 }}>RealStack Blueprint</div>
        </div>
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
        <div style={{ textAlign: "center", maxWidth: 380, padding: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 18, color: T.text, fontWeight: 600, marginBottom: 8 }}>Link Not Found</div>
          <div style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.5 }}>
            {error === "Share link not found or expired"
              ? "This share link may have expired or been deactivated. Please contact your loan officer for a new link."
              : error}
          </div>
          <div style={{ marginTop: 24, fontSize: 12, color: T.textTertiary }}>RealStack Blueprint</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { borrower, accessLevel, scenarios } = data;
  const selected = scenarios[selectedIdx] || null;
  const canAdjust = accessLevel === "can_adjust" || accessLevel === "full_edit";

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT }}>
      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${T.separator}`,
        padding: "14px 20px",
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.text, letterSpacing: "-0.3px" }}>
              RealStack Blueprint
            </div>
            <div style={{ fontSize: 12, color: T.textTertiary, marginTop: 1 }}>
              RealStack Blueprint
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{borrower?.name || "Your Scenarios"}</div>
            <div style={{ fontSize: 11, color: T.textTertiary }}>
              {accessLevel === "view_only" ? "View Only" : accessLevel === "can_adjust" ? "Can Adjust" : "Full Access"}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px 80px" }}>
        {/* Welcome message */}
        <div style={{
          background: T.card, border: `1px solid ${T.cardBorder}`,
          borderRadius: 14, padding: "18px 20px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 15, color: T.text, fontWeight: 600, marginBottom: 6 }}>
            Welcome{borrower?.name ? `, ${borrower.name.split(" ")[0]}` : ""}!
          </div>
          <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5 }}>
            {canAdjust
              ? "Here are your mortgage scenarios. You can adjust the numbers and save your own version for your loan officer to review."
              : "Here are your mortgage scenarios prepared by your loan officer. Review the numbers below."}
          </div>
        </div>

        {/* Scenarios count */}
        <div style={{ fontSize: 12, color: T.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, fontWeight: 600 }}>
          {scenarios.length} Scenario{scenarios.length !== 1 ? "s" : ""}
        </div>

        {/* Scenario list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {scenarios.map((s, i) => (
            <ScenarioCard
              key={s.id || i}
              scenario={s}
              isSelected={selectedIdx === i}
              onSelect={() => setSelectedIdx(i)}
            />
          ))}
        </div>

        {/* No scenarios */}
        {scenarios.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: T.textTertiary }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, color: T.textSecondary }}>No scenarios yet</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Your loan officer hasn't created any scenarios for you yet.</div>
          </div>
        )}

        {/* Selected scenario detail (can_adjust/full_edit only) */}
        {selected && canAdjust && (
          <ScenarioDetail
            scenario={selected}
            accessLevel={accessLevel}
            shareToken={shareToken}
            onScenarioCreated={handleScenarioCreated}
          />
        )}

        {/* Full calculator button (full_edit only) */}
        {accessLevel === "full_edit" && selected?.state_data && onEnterFullCalculator && (
          <button
            onClick={() => onEnterFullCalculator(selected.state_data)}
            style={{
              display: "block", width: "100%", marginTop: 16,
              padding: "14px", background: T.accent, border: "none",
              borderRadius: 12, color: "#000", fontSize: 15, fontWeight: 700,
              cursor: "pointer", fontFamily: FONT, letterSpacing: "-0.2px",
            }}
          >
            Open Full Calculator
          </button>
        )}
      </div>

      {/* Footer */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(0,0,0,0.9)", backdropFilter: "blur(10px)",
        borderTop: `1px solid ${T.separator}`, padding: "10px 20px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 11, color: T.textTertiary }}>
          <span style={{ color: T.accent, fontWeight: 600 }}>RealStack Blueprint</span>
        </div>
      </div>
    </div>
  );
}
