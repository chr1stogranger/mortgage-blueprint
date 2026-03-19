/**
 * WorkspaceSelector — Mode picker UI for Workspace
 *
 * Shown when user clicks the Workspace tab but hasn't chosen a mode yet.
 * Groups modes into "Scenario Comparison" and "Life Event Planning".
 */
import React from "react";
import { useWorkspace, MODE_CONFIGS, WORKSPACE_MODES } from "./WorkspaceContext";
import Icon from "./Icon";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

// Visual pane layout diagrams per mode
const PANE_LAYOUTS = {
  [WORKSPACE_MODES.COMPARE_2]: [
    { label: "A", color: "#3B82F6" },
    { label: "B", color: "#10B981" },
  ],
  [WORKSPACE_MODES.COMPARE_3]: [
    { label: "A", color: "#3B82F6" },
    { label: "B", color: "#10B981" },
    { label: "C", color: "#8B5CF6" },
  ],
  [WORKSPACE_MODES.COMPARE_2_SUMMARY]: [
    { label: "A", color: "#3B82F6" },
    { label: "B", color: "#10B981" },
    { label: "VS", color: "#6366F1" },
  ],
  [WORKSPACE_MODES.BUY_SELL_REFI]: [
    { label: "Buy", color: "#3B82F6" },
    { label: "Sell", color: "#F59E0B" },
    { label: "Refi", color: "#10B981" },
  ],
  [WORKSPACE_MODES.SELL_BUY]: [
    { label: "Sell", color: "#F59E0B" },
    { label: "Buy", color: "#3B82F6" },
  ],
  [WORKSPACE_MODES.REFI_RATE_TERM]: [
    { label: "Now", color: "#EF4444" },
    { label: "Refi", color: "#10B981" },
    { label: "VS", color: "#6366F1" },
  ],
  [WORKSPACE_MODES.REFI_CASH_OUT]: [
    { label: "Now", color: "#EF4444" },
    { label: "Cash", color: "#F59E0B" },
    { label: "VS", color: "#6366F1" },
  ],
};

const ICONS = {
  [WORKSPACE_MODES.COMPARE_2]: "bar-chart",
  [WORKSPACE_MODES.COMPARE_3]: "bar-chart",
  [WORKSPACE_MODES.COMPARE_2_SUMMARY]: "bar-chart",
  [WORKSPACE_MODES.BUY_SELL_REFI]: "refresh-cw",
  [WORKSPACE_MODES.SELL_BUY]: "dollar",
  [WORKSPACE_MODES.REFI_RATE_TERM]: "trending-down",
  [WORKSPACE_MODES.REFI_CASH_OUT]: "banknote",
};

export default function WorkspaceSelector({ T, isDesktop }) {
  const { openWorkspace } = useWorkspace();

  const groups = {};
  Object.entries(MODE_CONFIGS).forEach(([key, config]) => {
    if (!groups[config.group]) groups[config.group] = [];
    groups[config.group].push({ key, ...config });
  });

  const PanePreview = ({ mode }) => {
    const panes = PANE_LAYOUTS[mode] || [];
    return (
      <div style={{
        display: "flex", gap: 3, height: 36, borderRadius: 6,
        overflow: "hidden", border: `1px solid ${T.separator}`,
      }}>
        {panes.map((p, i) => (
          <div key={i} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            background: `${p.color}12`, borderRight: i < panes.length - 1 ? `1px solid ${T.separator}` : "none",
          }}>
            <span style={{
              fontSize: 9, fontWeight: 700, fontFamily: MONO,
              color: p.color, textTransform: "uppercase", letterSpacing: "0.5px",
            }}>
              {p.label}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{
      padding: isDesktop ? "40px 32px" : "20px 16px",
      maxWidth: 640, margin: "0 auto",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, fontFamily: MONO,
          textTransform: "uppercase", letterSpacing: "2px",
          color: T.accent, marginBottom: 8,
        }}>
          Workspace
        </div>
        <div style={{
          fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em",
          color: T.text, lineHeight: 1.1,
        }}>
          Multi-Pane Calculator
        </div>
        <div style={{
          fontSize: 14, color: T.textSecondary, marginTop: 8, lineHeight: 1.5,
        }}>
          Compare loan scenarios side by side or model complex life events like buying then selling.
        </div>
      </div>

      {/* Mode groups */}
      {Object.entries(groups).map(([groupName, modes]) => (
        <div key={groupName} style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, fontFamily: MONO,
            textTransform: "uppercase", letterSpacing: "2px",
            color: T.textTertiary, marginBottom: 12, paddingLeft: 2,
          }}>
            {groupName}
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr",
            gap: 10,
          }}>
            {modes.map((mode) => (
              <button
                key={mode.key}
                onClick={() => openWorkspace(mode.key)}
                style={{
                  background: T.card, border: `1px solid ${T.cardBorder}`,
                  borderRadius: 12, padding: 16, cursor: "pointer",
                  textAlign: "left", transition: "all 0.2s",
                  boxShadow: T.cardShadow,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = T.accent;
                  e.currentTarget.style.background = T.cardHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = T.cardBorder;
                  e.currentTarget.style.background = T.card;
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: `${T.accent}12`, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    color: T.accent,
                  }}>
                    <Icon name={ICONS[mode.key] || "grid"} size={14} />
                  </div>
                  <div>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: T.text,
                      letterSpacing: "-0.02em",
                    }}>
                      {mode.label}
                    </div>
                  </div>
                </div>
                <div style={{
                  fontSize: 12, color: T.textSecondary, lineHeight: 1.4,
                  marginBottom: 12,
                }}>
                  {mode.description}
                </div>
                <PanePreview mode={mode.key} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
