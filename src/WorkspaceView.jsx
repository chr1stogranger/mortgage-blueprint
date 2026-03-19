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
import DebtFreeSplash from "./DebtFreeSplash";
import Icon from "./Icon";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

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
    const mode = linkedValues.proceedsMode || "all";
    const closingCosts = linkedValues.purchaseClosingCosts || 0;
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

      default:
        return <div style={{ padding: 20, color: T.textTertiary }}>Unknown pane type: {type}</div>;
    }
  };

  // ── Proceeds Control Bar (Buy→Sell→Refi AND Sell→Buy modes) ──
  const ProceedsBar = () => {
    const isBSR = workspaceMode === WORKSPACE_MODES.BUY_SELL_REFI;
    const isSB = workspaceMode === WORKSPACE_MODES.SELL_BUY;
    if (!isBSR && !isSB) return null;
    const netProceeds = linkedValues.sellNetAfterTax || 0;
    if (netProceeds <= 0) return null;

    const fmt = (v) => "$" + Math.round(Math.abs(v)).toLocaleString("en-US");
    const mode = linkedValues.proceedsMode || "all";
    const closingCosts = linkedValues.purchaseClosingCosts || 0;
    const extraCash = linkedValues.extraCash || 0;
    const holdback = linkedValues.holdbackAmount || 0;

    // Core math: proceeds - closing costs on purchase = available for down
    const availableForDown = netProceeds - closingCosts;
    let finalDown;
    if (mode === "add-extra") finalDown = availableForDown + extraCash;
    else if (mode === "hold-back") finalDown = availableForDown - holdback;
    else finalDown = availableForDown; // "all"

    finalDown = Math.max(0, finalDown);

    const pillStyle = (active) => ({
      padding: "4px 10px", borderRadius: 9999, border: "none", cursor: "pointer",
      fontSize: 11, fontWeight: 600, fontFamily: MONO,
      background: active ? `${T.accent}20` : T.inputBg,
      color: active ? T.accent : T.textTertiary,
      transition: "all 0.15s",
    });

    const inputStyle = {
      background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 8,
      padding: "4px 8px", width: 100, color: T.text, fontSize: 12,
      fontWeight: 600, fontFamily: MONO, outline: "none",
    };

    return (
      <div style={{
        position: "sticky", top: 0, zIndex: 30,
        background: T.headerBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${T.separator}`, padding: "10px 16px",
      }}>
        {/* Row 1: Math breakdown */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "1.5px", color: T.textTertiary }}>
            Proceeds Flow
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO, color: T.green }}>{fmt(netProceeds)}</span>
            <span style={{ fontSize: 11, color: T.textTertiary }}>net</span>
            <span style={{ fontSize: 11, color: T.textTertiary }}>-</span>
            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: MONO, color: T.red }}>{fmt(closingCosts)}</span>
            <span style={{ fontSize: 11, color: T.textTertiary }}>closing costs</span>
            <span style={{ fontSize: 11, color: T.textTertiary }}>=</span>
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO, color: T.blue }}>{fmt(availableForDown)}</span>
            <span style={{ fontSize: 11, color: T.textTertiary }}>available for down</span>
          </div>
        </div>

        {/* Row 2: Q1 — Add extra or hold back? */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: T.textSecondary }}>Additional funds?</span>
          <div style={{ display: "flex", gap: 3 }}>
            <button onClick={() => updateLinkedValue("proceedsMode", "all")} style={pillStyle(mode === "all")}>Use All</button>
            <button onClick={() => updateLinkedValue("proceedsMode", "add-extra")} style={pillStyle(mode === "add-extra")}>+ Add Extra</button>
            <button onClick={() => updateLinkedValue("proceedsMode", "hold-back")} style={pillStyle(mode === "hold-back")}>- Hold Back</button>
          </div>

          {/* Q2a: How much extra? */}
          {mode === "add-extra" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: T.textSecondary }}>How much?</span>
              <span style={{ fontSize: 12, color: T.textSecondary }}>$</span>
              <input type="text" inputMode="decimal" value={extraCash > 0 ? extraCash.toLocaleString("en-US") : ""}
                onChange={(e) => updateLinkedValue("extraCash", parseInt(e.target.value.replace(/,/g, "")) || 0)}
                style={inputStyle} placeholder="0" />
            </div>
          )}

          {/* Q2b: How much to hold back? */}
          {mode === "hold-back" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: T.textSecondary }}>How much?</span>
              <span style={{ fontSize: 12, color: T.textSecondary }}>$</span>
              <input type="text" inputMode="decimal" value={holdback > 0 ? holdback.toLocaleString("en-US") : ""}
                onChange={(e) => updateLinkedValue("holdbackAmount", parseInt(e.target.value.replace(/,/g, "")) || 0)}
                style={inputStyle} placeholder="0" />
            </div>
          )}

          {/* Final result */}
          <div style={{
            marginLeft: "auto", padding: "4px 12px", borderRadius: 9999,
            background: `${T.green}12`, border: `1px solid ${T.green}25`,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ fontSize: 11, color: T.green, fontWeight: 500 }}>Down Payment:</span>
            <span style={{ fontSize: 14, fontWeight: 800, fontFamily: MONO, color: T.green, letterSpacing: "-0.02em" }}>
              {fmt(finalDown)}
            </span>
          </div>
        </div>
      </div>
    );
  };

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
        <ProceedsBar />
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

      <ProceedsBar />

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
