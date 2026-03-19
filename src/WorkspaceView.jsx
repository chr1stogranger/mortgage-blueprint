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
    if (workspaceMode !== WORKSPACE_MODES.BUY_SELL_REFI && workspaceMode !== WORKSPACE_MODES.SELL_BUY) return null;
    const netProceeds = linkedValues.sellNetAfterTax || 0;
    if (netProceeds <= 0) return null;

    const isSellBuy = workspaceMode === WORKSPACE_MODES.SELL_BUY;
    const fmt = (v) => "$" + Math.round(v).toLocaleString("en-US");
    const applied = linkedValues.proceedsUseAll ? netProceeds : linkedValues.proceedsToApply;
    const extraCash = linkedValues.extraCashContribution || 0;
    const totalForDown = applied + extraCash;
    const remaining = netProceeds - applied;

    return (
      <div style={{
        position: "sticky", top: 0, zIndex: 30,
        background: T.headerBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${T.separator}`, padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="arrow-right" size={14} />
          <span style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "1px" }}>
            Proceeds Flow
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          <div style={{ fontSize: 13, color: T.text }}>
            <span style={{ color: T.green, fontWeight: 700, fontFamily: MONO }}>{fmt(netProceeds)}</span>
            <span style={{ color: T.textTertiary }}> net from sale</span>
          </div>

          <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: T.textTertiary }}>Apply:</span>
            <button
              onClick={() => updateLinkedValue("proceedsUseAll", !linkedValues.proceedsUseAll)}
              style={{
                background: linkedValues.proceedsUseAll ? `${T.green}15` : T.inputBg,
                border: `1px solid ${linkedValues.proceedsUseAll ? T.green : T.inputBorder}`,
                borderRadius: 9999, padding: "3px 10px", cursor: "pointer",
                fontSize: 12, fontWeight: 600, color: linkedValues.proceedsUseAll ? T.green : T.text,
                fontFamily: MONO,
              }}
            >
              {linkedValues.proceedsUseAll ? "All" : "Custom"}
            </button>
          </div>

          {!linkedValues.proceedsUseAll && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="range"
                min={0} max={netProceeds} step={1000}
                value={linkedValues.proceedsToApply}
                onChange={(e) => updateLinkedValue("proceedsToApply", Number(e.target.value))}
                style={{ width: 120, accentColor: T.accent }}
              />
              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: MONO, color: T.blue }}>
                {fmt(applied)}
              </span>
            </div>
          )}

          {remaining > 0 && !linkedValues.proceedsUseAll && (
            <div style={{ fontSize: 11, color: T.textTertiary }}>
              {fmt(remaining)} in reserves
            </div>
          )}

          {/* Extra cash contribution (Sell→Buy mode) */}
          {isSellBuy && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: T.textTertiary, fontSize: 12 }}>+</span>
              <input
                type="text" inputMode="decimal"
                placeholder="Extra cash"
                value={extraCash > 0 ? extraCash.toLocaleString("en-US") : ""}
                onChange={(e) => {
                  const v = parseInt(e.target.value.replace(/,/g, "")) || 0;
                  updateLinkedValue("extraCashContribution", v);
                }}
                style={{
                  background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 8,
                  padding: "3px 8px", width: 90, color: T.text, fontSize: 12,
                  fontWeight: 600, fontFamily: MONO, outline: "none",
                }}
              />
              {totalForDown > 0 && (
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: MONO, color: T.blue }}>
                  = {fmt(totalForDown)} for down
                </span>
              )}
            </div>
          )}
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
