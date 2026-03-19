/**
 * WorkspaceView — Multi-pane layout engine for Workspace mode
 *
 * Renders 2 or 3 panes side by side on desktop.
 * Each pane is forced into single-column (mobile) layout.
 * On mobile devices, renders as swipeable tabs.
 */
import React, { useState, useRef, useCallback, useEffect } from "react";
import { useWorkspace, MODE_CONFIGS, WORKSPACE_MODES } from "./WorkspaceContext";
import WorkspaceSelector from "./WorkspaceSelector";
import ComparePane from "./ComparePane";
import RefiComparePane from "./RefiComparePane";
import DebtFreeSplash from "./DebtFreeSplash";
import Icon from "./Icon";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";
const fmtBar = (v) => "$" + Math.round(Math.abs(v)).toLocaleString("en-US");

/**
 * ProceedsBar — extracted as a proper component to avoid input focus loss.
 * Lives outside WorkspaceView so React treats it as a stable component.
 */
function ProceedsBar({ T, workspaceMode, linkedValues, updateLinkedValue }) {
  const isBSR = workspaceMode === WORKSPACE_MODES.BUY_SELL_REFI;
  const isSB = workspaceMode === WORKSPACE_MODES.SELL_BUY;
  // Local state for inputs so badge updates live while typing
  const [localExtra, setLocalExtra] = useState(linkedValues.extraCash || 0);
  const [localHoldback, setLocalHoldback] = useState(linkedValues.holdbackAmount || 0);
  const [editingExtra, setEditingExtra] = useState(null);
  const [editingHoldback, setEditingHoldback] = useState(null);
  const [glowing, setGlowing] = useState(true); // attention pulse until first interaction

  if (!isBSR && !isSB) return null;
  const netProceeds = linkedValues.sellNetAfterTax || 0;
  if (netProceeds <= 0) return null;

  const mode = linkedValues.proceedsMode || "all";
  // BSR: proceeds go to refi paydown (no closing cost deduction — those were paid at purchase)
  // SB: proceeds go to purchase down payment (closing costs deducted)
  const closingCosts = isSB ? (linkedValues.purchaseClosingCosts || 0) : 0;
  const availableForDown = netProceeds - closingCosts;

  // Use local values for live badge calculation
  let finalDown;
  if (mode === "add-extra") finalDown = availableForDown + localExtra;
  else if (mode === "hold-back") finalDown = availableForDown - localHoldback;
  else finalDown = availableForDown;
  finalDown = Math.max(0, finalDown);
  const resultLabel = isBSR ? "refi paydown" : "down payment";

  const fmtComma = (n) => { if (!n) return ""; return Math.round(n).toLocaleString("en-US"); };
  const parseNum = (s) => parseInt(String(s).replace(/,/g, "")) || 0;

  const pillStyle = (active) => ({
    padding: "4px 10px", borderRadius: 9999, border: "none", cursor: "pointer",
    fontSize: 11, fontWeight: 600, fontFamily: MONO,
    background: active ? `${T.accent}20` : T.inputBg,
    color: active ? T.accent : T.textTertiary,
    transition: "all 0.15s",
  });
  const inputStyle = {
    background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 8,
    padding: "4px 8px", width: 110, color: T.text, fontSize: 12,
    fontWeight: 600, fontFamily: MONO, outline: "none",
  };

  const dismissGlow = () => { if (glowing) setGlowing(false); };

  return (
    <div onClick={dismissGlow} style={{
      position: "sticky", top: 0, zIndex: 30,
      background: T.headerBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      borderBottom: `1px solid ${T.separator}`, padding: "10px 16px",
      ...(glowing ? {
        boxShadow: `0 0 0 2px ${T.blue}60, 0 0 20px ${T.blue}25, 0 4px 12px ${T.blue}15`,
        border: `1px solid ${T.blue}50`,
        borderBottom: `1px solid ${T.blue}50`,
        animation: "proceedsGlow 2.5s ease-in-out infinite",
      } : {}),
    }}>
      {glowing && <style>{`@keyframes proceedsGlow { 0%, 100% { box-shadow: 0 0 0 2px rgba(99,102,241,0.4), 0 0 16px rgba(99,102,241,0.15); } 50% { box-shadow: 0 0 0 3px rgba(99,102,241,0.7), 0 0 28px rgba(99,102,241,0.3); } }`}</style>}
      {glowing && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Icon name="arrow-right" size={12} />
          <span style={{ fontSize: 11, fontWeight: 600, color: T.blue, fontFamily: FONT }}>
            Review your proceeds flow and choose how to apply funds
          </span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "1.5px", color: glowing ? T.blue : T.textTertiary }}>
          Proceeds
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO, color: T.green }}>{fmtBar(netProceeds)}</span>
        <span style={{ fontSize: 11, color: T.textTertiary }}>net</span>
        {isSB && closingCosts > 0 && (<>
          <span style={{ fontSize: 11, color: T.textTertiary }}>-</span>
          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: MONO, color: T.red }}>{fmtBar(closingCosts)}</span>
          <span style={{ fontSize: 11, color: T.textTertiary }}>closing</span>
        </>)}
        {mode === "add-extra" && localExtra > 0 && (<>
          <span style={{ fontSize: 11, color: T.textTertiary }}>+</span>
          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: MONO, color: T.blue }}>{fmtBar(localExtra)}</span>
          <span style={{ fontSize: 11, color: T.textTertiary }}>extra</span>
        </>)}
        {mode === "hold-back" && localHoldback > 0 && (<>
          <span style={{ fontSize: 11, color: T.textTertiary }}>-</span>
          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: MONO, color: T.orange }}>{fmtBar(localHoldback)}</span>
          <span style={{ fontSize: 11, color: T.textTertiary }}>holdback</span>
        </>)}
        <span style={{ fontSize: 11, color: T.textTertiary }}>=</span>
        <span style={{ fontSize: 13, fontWeight: 800, fontFamily: MONO, color: T.green }}>{fmtBar(finalDown)}</span>
        <span style={{ fontSize: 11, color: T.textTertiary }}>{resultLabel}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: T.textSecondary }}>Additional funds?</span>
        <div style={{ display: "flex", gap: 3 }}>
          <button onClick={() => { updateLinkedValue("proceedsMode", "all"); setLocalExtra(0); setLocalHoldback(0); updateLinkedValue("extraCash", 0); updateLinkedValue("holdbackAmount", 0); }} style={pillStyle(mode === "all")}>Use All</button>
          <button onClick={() => { updateLinkedValue("proceedsMode", "add-extra"); setLocalHoldback(0); updateLinkedValue("holdbackAmount", 0); }} style={pillStyle(mode === "add-extra")}>+ Add Extra</button>
          <button onClick={() => { updateLinkedValue("proceedsMode", "hold-back"); setLocalExtra(0); updateLinkedValue("extraCash", 0); }} style={pillStyle(mode === "hold-back")}>- Hold Back</button>
        </div>
        {mode === "add-extra" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: T.textSecondary }}>How much?</span>
            <span style={{ fontSize: 12, color: T.textSecondary }}>$</span>
            <input type="text" inputMode="decimal"
              value={editingExtra !== null ? editingExtra : fmtComma(localExtra)}
              onFocus={() => setEditingExtra(localExtra > 0 ? String(localExtra) : "")}
              onChange={(e) => { const raw = e.target.value.replace(/,/g, ""); if (raw === "" || /^\d*$/.test(raw)) { setEditingExtra(raw); const n = parseNum(raw); setLocalExtra(n); } }}
              onBlur={() => { setEditingExtra(null); updateLinkedValue("extraCash", localExtra); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
              style={inputStyle} placeholder="0" />
          </div>
        )}
        {mode === "hold-back" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: T.textSecondary }}>How much?</span>
            <span style={{ fontSize: 12, color: T.textSecondary }}>$</span>
            <input type="text" inputMode="decimal"
              value={editingHoldback !== null ? editingHoldback : fmtComma(localHoldback)}
              onFocus={() => setEditingHoldback(localHoldback > 0 ? String(localHoldback) : "")}
              onChange={(e) => { const raw = e.target.value.replace(/,/g, ""); if (raw === "" || /^\d*$/.test(raw)) { setEditingHoldback(raw); const n = parseNum(raw); setLocalHoldback(n); } }}
              onBlur={() => { setEditingHoldback(null); updateLinkedValue("holdbackAmount", localHoldback); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
              style={inputStyle} placeholder="0" />
          </div>
        )}
        <div style={{
          marginLeft: "auto", padding: "4px 12px", borderRadius: 9999,
          background: `${T.green}12`, border: `1px solid ${T.green}25`,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ fontSize: 11, color: T.green, fontWeight: 500 }}>{isBSR ? "Refi Paydown:" : "Down Payment:"}</span>
          <span style={{ fontSize: 14, fontWeight: 800, fontFamily: MONO, color: T.green, letterSpacing: "-0.02em" }}>
            {fmtBar(finalDown)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * WorkspaceView receives:
 * - T: theme colors
 * - isDesktop: boolean
 * - renderBlueprintPane: function(paneId, paneConfig) => React element
 *     This is provided by MortgageBlueprint.jsx and renders a full Blueprint
 *     calculator instance scoped to the given pane
 * - renderSellerNetPane: function(paneId, paneConfig) => React element
 *     Renders the Seller Net Proceeds calculator for a pane
 */
export default function WorkspaceView({ T, isDesktop, renderBlueprintPane, renderSellerNetPane, onLiveRates, scenarioList, currentScenario }) {
  const {
    workspaceMode, workspaceActive, closeWorkspace,
    modeConfig, linkedValues, updateLinkedValue, paneCalcs, isDebtFree,
  } = useWorkspace();

  // Mobile tab state (which pane is active on mobile)
  const [mobileTab, setMobileTab] = useState(0);

  // ── Per-pane loaded scenario data ──
  const [paneScenarioData, setPaneScenarioData] = useState({}); // { left: {...state}, center: {...state} }
  const [paneScenarioNames, setPaneScenarioNames] = useState({}); // { left: "Scenario 1" }

  const loadScenarioIntoPane = useCallback(async (paneId, scenarioName) => {
    try {
      const raw = localStorage.getItem("scenario:" + scenarioName);
      if (raw) {
        const data = JSON.parse(raw);
        data.scenarioName = scenarioName;
        setPaneScenarioData(prev => ({ ...prev, [paneId]: data }));
        setPaneScenarioNames(prev => ({ ...prev, [paneId]: scenarioName }));
      }
    } catch (e) { console.error("Failed to load scenario:", e); }
  }, []);

  // ── Live Rates ──
  const [liveRates, setLiveRates] = useState(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState(null);

  const fetchLiveRates = useCallback(async () => {
    setRatesLoading(true);
    setRatesError(null);
    try {
      const res = await fetch("/api/rates");
      if (res.ok) {
        const data = await res.json();
        if (data["30yr_fixed"] > 2 && data["30yr_fixed"] < 15) {
          data.date = data.date || new Date().toISOString().split("T")[0];
          setLiveRates(data);
          setRatesLoading(false);
          return;
        }
      }
      throw new Error("Invalid rate data");
    } catch (e) {
      setRatesError("Could not fetch rates");
      setRatesLoading(false);
    }
  }, []);

  // Helper: get the right rate for a loan type + term
  const getLiveRate = useCallback((loanType, term) => {
    if (!liveRates) return null;
    const map = {
      "Conventional": term === 15 ? liveRates["15yr_fixed"] : liveRates["30yr_fixed"],
      "FHA": liveRates["30yr_fha"] || liveRates["30yr_fixed"],
      "VA": liveRates["30yr_va"] || liveRates["30yr_fixed"],
      "Jumbo": liveRates["30yr_jumbo"] || liveRates["30yr_fixed"],
      "USDA": liveRates["30yr_fixed"],
    };
    return map[loanType] || liveRates["30yr_fixed"];
  }, [liveRates]);

  // ── Compute and push finalDownPayment at top level (not inside ProceedsBar) ──
  useEffect(() => {
    if (workspaceMode !== WORKSPACE_MODES.BUY_SELL_REFI && workspaceMode !== WORKSPACE_MODES.SELL_BUY) return;
    const netProceeds = linkedValues.sellNetAfterTax || 0;
    if (netProceeds <= 0) return;
    const isSB = workspaceMode === WORKSPACE_MODES.SELL_BUY;
    const mode = linkedValues.proceedsMode || "all";
    // BSR: no closing cost deduction (those were paid at purchase); SB: deduct purchase closing costs
    const closingCosts = isSB ? (linkedValues.purchaseClosingCosts || 0) : 0;
    const extraCash = linkedValues.extraCash || 0;
    const holdback = linkedValues.holdbackAmount || 0;
    const availableForDown = netProceeds - closingCosts;
    let finalDown;
    if (mode === "add-extra") finalDown = availableForDown + extraCash;
    else if (mode === "hold-back") finalDown = availableForDown - holdback;
    else finalDown = availableForDown;
    finalDown = Math.max(0, finalDown);
    if (finalDown !== linkedValues.finalDownPayment) {
      updateLinkedValue("finalDownPayment", finalDown);
    }
  }, [workspaceMode, linkedValues.sellNetAfterTax, linkedValues.purchaseClosingCosts, linkedValues.proceedsMode, linkedValues.extraCash, linkedValues.holdbackAmount]);

  // If no mode selected, show the mode selector
  if (!workspaceMode) {
    return <WorkspaceSelector T={T} isDesktop={isDesktop} />;
  }

  const config = modeConfig;
  if (!config) return null;

  const panes = config.panes;
  const paneCount = panes.length;

  // ── Render individual pane content ──
  const renderPaneContent = (pane) => {
    const { id, type, label } = pane;

    switch (type) {
      case "blueprint":
      case "blueprint-purchase":
      case "blueprint-refi":
      case "blueprint-current":
      case "blueprint-cashout":
        // Check if this is the refi pane in Buy→Sell→Refi AND debt-free
        if (type === "blueprint-refi" && isDebtFree()) {
          return <DebtFreeSplash T={T} linkedValues={linkedValues} />;
        }
        return renderBlueprintPane ? renderBlueprintPane(id, pane, liveRates, paneScenarioData[id]) : (
          <div style={{ padding: 40, textAlign: "center", color: T.textTertiary }}>
            <Icon name="calculator" size={32} />
            <div style={{ marginTop: 12, fontSize: 14 }}>Blueprint Pane</div>
          </div>
        );

      case "seller-net":
        return renderSellerNetPane ? renderSellerNetPane(id, pane) : (
          <div style={{ padding: 40, textAlign: "center", color: T.textTertiary }}>
            <Icon name="dollar" size={32} />
            <div style={{ marginTop: 12, fontSize: 14 }}>Seller Net Proceeds</div>
          </div>
        );

      case "compare-summary":
        return <ComparePane T={T} />;

      case "refi-compare":
        return <RefiComparePane T={T} />;

      default:
        return <div style={{ padding: 20, color: T.textTertiary }}>Unknown pane type: {type}</div>;
    }
  };

  // ProceedsBar rendered via standalone component below

  // ── MOBILE LAYOUT: Tabbed interface ──
  if (!isDesktop) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg }}>
        {/* Tab bar */}
        <div style={{
          display: "flex", borderBottom: `1px solid ${T.separator}`,
          position: "sticky", top: 0, zIndex: 20, background: T.headerBg,
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        }}>
          <button onClick={closeWorkspace} style={{
            background: "none", border: "none", padding: "10px", cursor: "pointer",
            color: T.textTertiary, display: "flex", alignItems: "center",
          }}>
            <Icon name="chevron-left" size={18} />
          </button>
          {panes.map((p, i) => (
            <button key={p.id} onClick={() => setMobileTab(i)} style={{
              flex: 1, padding: "10px 8px", background: "none",
              border: "none", borderBottom: mobileTab === i ? `2px solid ${T.accent}` : "2px solid transparent",
              fontSize: 12, fontWeight: mobileTab === i ? 700 : 500,
              color: mobileTab === i ? T.accent : T.textTertiary,
              cursor: "pointer", fontFamily: FONT,
            }}>
              {p.label}
            </button>
          ))}
        </div>
        <ProceedsBar T={T} workspaceMode={workspaceMode} linkedValues={linkedValues} updateLinkedValue={updateLinkedValue} />
        {/* Active pane */}
        <div style={{ padding: "0 12px 80px" }}>
          {renderPaneContent(panes[mobileTab])}
        </div>
      </div>
    );
  }

  // ── DESKTOP LAYOUT: Side by side panes ──
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: "100vh", background: T.bg }}>
      {/* Workspace header bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px", borderBottom: `1px solid ${T.separator}`,
        background: T.headerBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        position: "sticky", top: 0, zIndex: 30, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={closeWorkspace} style={{
            background: "none", border: "none", cursor: "pointer",
            color: T.textTertiary, display: "flex", padding: 4, borderRadius: 4,
          }}>
            <Icon name="chevron-left" size={16} />
          </button>
          <span style={{
            fontSize: 11, fontWeight: 600, fontFamily: MONO,
            textTransform: "uppercase", letterSpacing: "2px", color: T.textTertiary,
          }}>
            Workspace
          </span>
          <span style={{
            fontSize: 12, fontWeight: 600, color: T.accent,
            background: `${T.accent}12`, padding: "2px 10px", borderRadius: 9999,
          }}>
            {config.label}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Pull Live Rates button */}
          <button onClick={fetchLiveRates} disabled={ratesLoading} style={{
            background: liveRates ? `${T.green}12` : `${T.blue}12`,
            border: `1px solid ${liveRates ? `${T.green}30` : `${T.blue}30`}`,
            borderRadius: 9999, padding: "4px 12px", cursor: ratesLoading ? "wait" : "pointer",
            fontSize: 11, fontWeight: 600, color: liveRates ? T.green : T.blue, fontFamily: MONO,
            display: "flex", alignItems: "center", gap: 5, opacity: ratesLoading ? 0.6 : 1,
          }}>
            <Icon name={liveRates ? "check" : "zap"} size={12} />
            {ratesLoading ? "Fetching..." : liveRates ? `Rates: ${liveRates["30yr_fixed"]}% · ${liveRates.date}` : "Pull Live Rates"}
          </button>
          {ratesError && <span style={{ fontSize: 10, color: T.red }}>{ratesError}</span>}

          <button onClick={() => { closeWorkspace(); }} style={{
            background: "none", border: `1px solid ${T.separator}`,
            borderRadius: 9999, padding: "4px 12px", cursor: "pointer",
            fontSize: 11, fontWeight: 500, color: T.textSecondary, fontFamily: FONT,
          }}>
            Exit Workspace
          </button>
        </div>
      </div>

      <ProceedsBar T={T} workspaceMode={workspaceMode} linkedValues={linkedValues} updateLinkedValue={updateLinkedValue} />

      {/* Panes container */}
      <div style={{
        display: "flex", flex: 1, overflow: "hidden",
      }}>
        {panes.map((pane, i) => (
          <React.Fragment key={pane.id}>
            {/* Divider between panes */}
            {i > 0 && (
              <div style={{
                width: 1, background: T.separator, flexShrink: 0,
              }} />
            )}
            {/* Pane */}
            <div style={{
              flex: 1, overflow: "auto", display: "flex", flexDirection: "column",
              minWidth: 0, // allow flex shrink
            }}>
              {/* Pane header with label + Load Scenario */}
              <div style={{
                padding: "8px 12px", borderBottom: `1px solid ${T.separator}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexShrink: 0, background: T.bg2,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: i === 0 ? T.blue : i === 1 ? T.green : T.purple,
                  }} />
                  <span style={{
                    fontSize: 13, fontWeight: 700, color: T.text, fontFamily: FONT,
                  }}>
                    {paneScenarioNames[pane.id] || pane.label}
                  </span>
                </div>
                {/* Load Scenario dropdown — only for blueprint panes */}
                {(pane.type === "blueprint" || pane.type === "blueprint-purchase" || pane.type === "blueprint-refi") && scenarioList && scenarioList.length > 0 && (
                  <select
                    value={paneScenarioNames[pane.id] || ""}
                    onChange={(e) => { if (e.target.value) loadScenarioIntoPane(pane.id, e.target.value); }}
                    style={{
                      background: T.inputBg, border: `1px solid ${T.inputBorder}`,
                      borderRadius: 8, padding: "3px 8px", color: T.textSecondary,
                      fontSize: 10, fontWeight: 600, fontFamily: MONO,
                      cursor: "pointer", outline: "none", maxWidth: 140,
                      WebkitAppearance: "none",
                    }}
                  >
                    <option value="">Load Scenario</option>
                    {scenarioList.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                )}
                {!(pane.type === "blueprint" || pane.type === "blueprint-purchase" || pane.type === "blueprint-refi") && (
                  <span style={{
                    fontSize: 10, fontWeight: 500, fontFamily: MONO,
                    color: T.textTertiary, textTransform: "uppercase", letterSpacing: "1px",
                  }}>
                    {pane.type.replace("blueprint-", "").replace("-", " ")}
                  </span>
                )}
              </div>
              {/* Pane content — scrollable independently */}
              <div style={{
                flex: 1, overflow: "auto", padding: "0 12px 40px",
                maxWidth: 480, margin: "0 auto", width: "100%",
              }}>
                {renderPaneContent(pane)}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
