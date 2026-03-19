/**
 * WorkspaceContext — Cross-pane data linking for Workspace mode
 *
 * Manages shared state between 2-3 Blueprint/SellerNet panes.
 * Each pane has isolated calculator state, but linked fields
 * (like net proceeds → refi paydown) flow through this context.
 */
import React, { createContext, useContext, useState, useCallback, useRef } from "react";

const WorkspaceContext = createContext(null);

export const WORKSPACE_MODES = {
  COMPARE_2: "compare-2",         // 2 Blueprints side by side
  COMPARE_3: "compare-3",         // 3 Blueprints side by side
  COMPARE_2_SUMMARY: "compare-2-summary", // 2 Blueprints + Compare pane
  BUY_SELL_REFI: "buy-sell-refi", // Purchase | Seller Net | Refi (or Debt-Free)
  SELL_BUY: "sell-buy",           // Seller Net | Purchase
};

export const MODE_CONFIGS = {
  [WORKSPACE_MODES.COMPARE_2]: {
    label: "2-Up Compare",
    description: "Two loan scenarios side by side",
    group: "Scenario Comparison",
    panes: [
      { id: "left", type: "blueprint", label: "Scenario A" },
      { id: "right", type: "blueprint", label: "Scenario B" },
    ],
  },
  [WORKSPACE_MODES.COMPARE_3]: {
    label: "3-Up Compare",
    description: "Three loan scenarios head to head",
    group: "Scenario Comparison",
    panes: [
      { id: "left", type: "blueprint", label: "Scenario A" },
      { id: "center", type: "blueprint", label: "Scenario B" },
      { id: "right", type: "blueprint", label: "Scenario C" },
    ],
  },
  [WORKSPACE_MODES.COMPARE_2_SUMMARY]: {
    label: "2-Up + Summary",
    description: "Two scenarios with live comparison",
    group: "Scenario Comparison",
    panes: [
      { id: "left", type: "blueprint", label: "Scenario A" },
      { id: "center", type: "blueprint", label: "Scenario B" },
      { id: "right", type: "compare-summary", label: "Compare" },
    ],
  },
  [WORKSPACE_MODES.BUY_SELL_REFI]: {
    label: "Buy → Sell → Refi",
    description: "Purchase, sell old home, refi with proceeds",
    group: "Life Event Planning",
    panes: [
      { id: "left", type: "blueprint-purchase", label: "Purchase" },
      { id: "center", type: "seller-net", label: "Seller Net" },
      { id: "right", type: "blueprint-refi", label: "Refi" }, // or "debt-free"
    ],
  },
  [WORKSPACE_MODES.SELL_BUY]: {
    label: "Sell → Buy",
    description: "Sell first, then buy with proceeds",
    group: "Life Event Planning",
    panes: [
      { id: "left", type: "seller-net", label: "Seller Net" },
      { id: "right", type: "blueprint-purchase", label: "Purchase" },
    ],
  },
};

export function WorkspaceProvider({ children }) {
  const [workspaceMode, setWorkspaceMode] = useState(null); // null = workspace inactive
  const [workspaceActive, setWorkspaceActive] = useState(false);

  // ── Pane state stores (each pane gets its own calculator state) ──
  // Keyed by pane id: "left", "center", "right"
  const [paneStates, setPaneStates] = useState({});
  const [paneCalcs, setPaneCalcs] = useState({}); // computed calc objects per pane

  // ── Linked values (cross-pane data flow) ──
  const [linkedValues, setLinkedValues] = useState({
    // Buy→Sell→Refi links:
    sellNetProceeds: 0,       // from seller-net → refi pane
    sellNetAfterTax: 0,       // from seller-net → refi pane (after cap gains)
    proceedsToApply: 0,       // how much of proceeds to use (user-controlled)
    proceedsUseAll: true,     // default: use all proceeds
    purchaseSalesPrice: 0,    // from purchase → linked info
    purchaseLoanAmount: 0,    // from purchase → refi seed
    purchaseRate: 0,          // from purchase → refi "current rate"
    purchasePropertyValue: 0, // from purchase → refi property value
    purchaseClosingCosts: 0,  // from purchase calc → used to compute available-for-down
    // Sell→Buy proceeds flow:
    proceedsMode: "all",      // "all" | "add-extra" | "hold-back"
    extraCash: 0,             // additional funds to bring (add-extra mode)
    holdbackAmount: 0,        // funds to hold back (hold-back mode)
    finalDownPayment: 0,      // computed: proceeds - closing costs +/- adjustments
  });

  // ── Pane scenario names (for localStorage isolation) ──
  const [paneScenarios, setPaneScenarios] = useState({
    left: "_workspace:left",
    center: "_workspace:center",
    right: "_workspace:right",
  });

  // Update a single linked value
  const updateLinkedValue = useCallback((key, value) => {
    setLinkedValues(prev => ({ ...prev, [key]: value }));
  }, []);

  // Update a pane's calc results (called by BlueprintPane after recalculation)
  const updatePaneCalc = useCallback((paneId, calcObj) => {
    setPaneCalcs(prev => ({ ...prev, [paneId]: calcObj }));
  }, []);

  // Update a pane's state snapshot (for compare summary)
  const updatePaneState = useCallback((paneId, stateObj) => {
    setPaneStates(prev => ({ ...prev, [paneId]: stateObj }));
  }, []);

  // Open workspace with a specific mode
  const openWorkspace = useCallback((mode) => {
    setWorkspaceMode(mode);
    setWorkspaceActive(true);
    // Reset linked values
    setLinkedValues({
      sellNetProceeds: 0, sellNetAfterTax: 0, proceedsToApply: 0,
      proceedsUseAll: true, purchaseSalesPrice: 0, purchaseLoanAmount: 0,
      purchaseRate: 0, purchasePropertyValue: 0, purchaseClosingCosts: 0,
      proceedsMode: "all", extraCash: 0, holdbackAmount: 0, finalDownPayment: 0,
    });
    setPaneStates({});
    setPaneCalcs({});
  }, []);

  // Close workspace
  const closeWorkspace = useCallback(() => {
    setWorkspaceActive(false);
    setWorkspaceMode(null);
  }, []);

  // Check if refi pane should show debt-free state
  const isDebtFree = useCallback(() => {
    if (workspaceMode !== WORKSPACE_MODES.BUY_SELL_REFI) return false;
    const proceeds = linkedValues.proceedsUseAll
      ? linkedValues.sellNetAfterTax
      : linkedValues.proceedsToApply;
    return proceeds > 0 && proceeds >= linkedValues.purchaseLoanAmount && linkedValues.purchaseLoanAmount > 0;
  }, [workspaceMode, linkedValues]);

  const value = {
    workspaceMode, workspaceActive,
    paneStates, paneCalcs, linkedValues, paneScenarios,
    openWorkspace, closeWorkspace,
    updateLinkedValue, updatePaneCalc, updatePaneState,
    isDebtFree,
    modeConfig: workspaceMode ? MODE_CONFIGS[workspaceMode] : null,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be inside WorkspaceProvider");
  return ctx;
}

export default WorkspaceContext;
