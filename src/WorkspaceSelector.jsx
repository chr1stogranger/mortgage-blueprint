import { FONT } from "./lib/fonts.js";
/**
 * WorkspaceSelector — Mode picker UI for Workspace
 *
 * Shown when user clicks the Workspace tab but hasn't chosen a mode yet.
 * Groups modes into "Scenario Comparison" and "Life Event Planning".
 */
import React from "react";
import { useWorkspace, MODE_CONFIGS, WORKSPACE_MODES } from "./WorkspaceContext";
import Icon from "./Icon";


// Visual pane layout diagrams per mode
const PANE_LAYOUTS = {
  [WORKSPACE_MODES.COMPARE_2]: [
    { label: "A", color: "#3B6BF5" },
    { label: "B", color: "#12a150" },
  ],
  [WORKSPACE_MODES.COMPARE_3]: [
    { label: "A", color: "#3B6BF5" },
    { label: "B", color: "#12a150" },
    { label: "C", color: "#8b7bf0" },
  ],
  [WORKSPACE_MODES.COMPARE_2_SUMMARY]: [
    { label: "A", color: "#3B6BF5" },
    { label: "B", color: "#12a150" },
    { label: "VS", color: "#3B6BF5" },
  ],
  [WORKSPACE_MODES.BUY_SELL_REFI]: [
    { label: "Buy", color: "#3B6BF5" },
    { label: "Sell", color: "#d98a0b" },
    { label: "Refi", color: "#12a150" },
  ],
  [WORKSPACE_MODES.SELL_BUY]: [
    { label: "Sell", color: "#d98a0b" },
    { label: "Buy", color: "#3B6BF5" },
  ],
  [WORKSPACE_MODES.REFI_RATE_TERM]: [
    { label: "Now", color: "#e5484d" },
    { label: "Refi", color: "#12a150" },
    { label: "VS", color: "#3B6BF5" },
  ],
  [WORKSPACE_MODES.REFI_CASH_OUT]: [
    { label: "Now", color: "#e5484d" },
    { label: "Cash", color: "#d98a0b" },
    { label: "VS", color: "#3B6BF5" },
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

  // Compact on every width (Christo 2026-10-31: "right-size the workspace so
  // it fits the screen"). The three groups sit side by side as columns when
  // there's room and stack on phones, so all seven modes show without
  // scrolling. Width comes from the container (auto-fit), not isDesktop:
  // the Ops side panel can be narrow on a desktop screen.
  const PanePreview = ({ mode }) => {
    const panes = PANE_LAYOUTS[mode] || [];
    return (
      <div style={{
        display: "flex", height: 26, borderRadius: 7,
        overflow: "hidden", border: `1px solid ${T.separator}`,
      }}>
        {panes.map((p, i) => (
          <div key={i} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            background: `${p.color}12`, borderRight: i < panes.length - 1 ? `1px solid ${T.separator}` : "none",
          }}>
            <span style={{
              fontSize: 9.5, fontWeight: 700, fontFamily: FONT,
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
      padding: isDesktop ? "24px 28px" : "16px 14px",
      maxWidth: 1180, margin: "0 auto",
    }}>
      {/* Header */}
      <div style={{ marginBottom: isDesktop ? 20 : 16 }}>
        <div style={{
          fontSize: isDesktop ? 26 : 22, fontWeight: 800, letterSpacing: "-0.04em",
          color: T.text, lineHeight: 1.1,
        }}>
          Workspace
        </div>
        <div style={{
          fontSize: isDesktop ? 15 : 14, color: T.textSecondary, marginTop: 6, lineHeight: 1.45,
        }}>
          Compare loan scenarios side by side, or model a life event like buying then selling.
        </div>
      </div>

      {/* Mode groups: one column each */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: isDesktop ? 18 : 14, alignItems: "start",
      }}>
      {Object.entries(groups).map(([groupName, modes]) => (
        <div key={groupName}>
          <div style={{
            fontSize: 11, fontWeight: 600, fontFamily: FONT,
            textTransform: "uppercase", letterSpacing: "1.5px",
            color: T.textTertiary, marginBottom: 8, paddingLeft: 2,
          }}>
            {groupName}
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {modes.map((mode) => (
              <button
                key={mode.key}
                onClick={() => openWorkspace(mode.key)}
                style={{
                  background: T.card, border: `1px solid ${T.cardBorder}`,
                  borderRadius: 14, padding: "12px 14px", cursor: "pointer",
                  textAlign: "left", transition: "all 0.2s",
                  boxShadow: T.cardShadow, width: "100%", boxSizing: "border-box",
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
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: `${T.accent}12`, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    color: T.accent,
                  }}>
                    <Icon name={ICONS[mode.key] || "grid"} size={15} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 15, fontWeight: 700, color: T.text,
                      letterSpacing: "-0.02em", lineHeight: 1.2,
                    }}>
                      {mode.label}
                    </div>
                    <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.35, marginTop: 1 }}>
                      {mode.description}
                    </div>
                  </div>
                </div>
                <PanePreview mode={mode.key} />
              </button>
            ))}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
