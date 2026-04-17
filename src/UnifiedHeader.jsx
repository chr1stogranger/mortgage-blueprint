import React from "react";
import Icon from "./Icon";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

/**
 * UnifiedHeader
 *
 * Persistent top bar for ALL Blueprint tabs.
 *
 * Desktop: 2-row layout
 *   Row 1 — Brand + qualification badge + pillar dots + controls
 *   Row 2 — Stats dashboard (Price, Payment, Cash Close, LTV, DTI)
 *
 * Mobile: unchanged (compact single row + stats strip below)
 */
export default function UnifiedHeader({
  /* Financials */
  salesPrice, calc, creditScore, downPct,
  loanType, isRefi, refiPurpose, firstTimeBuyer,
  /* Qualification */
  allGood, someGood,
  purchPillarCount, refiPillarCount,
  dpOk, refiLtvCheck,
  /* Scenarios */
  scenarioName, scenarioList, switchScenario,
  saving, loaded, cloudSyncStatus, sync,
  /* Controls */
  darkMode, themeMode, cycleTheme,
  privacyMode, setPrivacyMode,
  /* Layout */
  isDesktop, sidebarCollapsed, T,
  /* Navigation */
  setTab, onCompare,
  /* Auth */
  isCloud, isBorrower, auth,
  borrowerList, activeBorrower, borrowerLoading,
  borrowerScenarios, borrowerScenariosLoading,
  BorrowerPicker, borrowerPickerCallbacks,
  /* Skill level */
  skillLevel, onToggleSkillLevel,
  /* Mobile tab bar */
  mobileTabBar,
}) {
  // ── Format helpers ──
  const fmt = (v) => {
    if (v == null || !isFinite(v) || isNaN(v)) return "$0";
    if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
    if (Math.abs(v) >= 1e4) return "$" + (v / 1e3).toFixed(0) + "K";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  };
  const pct = (v, d = 1) => ((v || 0) * 100).toFixed(d) + "%";

  // ── Qualification badge ──
  const totalPillars = isRefi ? 3 : 5;
  const passedPillars = isRefi ? refiPillarCount : purchPillarCount;
  const hasData = calc.qualifyingIncome > 0 || creditScore > 0 || salesPrice > 0;

  let badgeLabel, badgeColor;
  if (allGood) {
    badgeLabel = isRefi ? "Refi Qualified" : "Pre-Qualified";
    badgeColor = T.green;
  } else if (someGood && passedPillars >= (isRefi ? 2 : 3)) {
    badgeLabel = "Almost There";
    badgeColor = T.orange;
  } else if (someGood) {
    badgeLabel = `${passedPillars}/${totalPillars} Pillars`;
    badgeColor = T.orange;
  } else if (hasData) {
    badgeLabel = "Action Needed";
    badgeColor = T.red;
  } else {
    badgeLabel = `${totalPillars} Pillars`;
    badgeColor = T.textTertiary;
  }

  // ── Pillar dot data ──
  const gpc = (check) => check === "Good!" ? T.green : check === "—" ? T.ringTrack : T.red;
  const purchasePillars = [
    { label: "FICO", color: gpc(calc.ficoCheck) },
    { label: "Down", color: dpOk ? T.green : (calc.dpWarning === "—" || calc.dpWarning === null) ? T.ringTrack : T.red },
    { label: "DTI", color: gpc(calc.dtiCheck) },
    { label: "Cash", color: gpc(calc.cashCheck) },
    { label: "Res", color: gpc(calc.resCheck) },
  ];
  const refiPillars = [
    { label: "FICO", color: gpc(calc.ficoCheck) },
    { label: "DTI", color: gpc(calc.dtiCheck) },
    { label: "LTV", color: refiLtvCheck === "Good!" ? T.green : refiLtvCheck === "—" ? T.ringTrack : T.red },
  ];
  const pillars = isRefi ? refiPillars : purchasePillars;

  const sidebarW = isDesktop ? (sidebarCollapsed ? 56 : 180) : 0;

  // ── Stat cell (responsive sizing) ──
  const Stat = ({ label, value, color }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 0, flex: 1 }}>
      <div style={{
        fontSize: isDesktop ? 10 : 9, color: T.textTertiary, fontWeight: 600,
        letterSpacing: 1.2, fontFamily: MONO, textTransform: "uppercase",
        marginBottom: isDesktop ? 3 : 2, whiteSpace: "nowrap", textAlign: "center",
      }}>{label}</div>
      <div style={{
        fontSize: isDesktop ? 17 : 13, fontWeight: 700,
        color: color || T.text, fontFamily: MONO,
        letterSpacing: "-0.02em", whiteSpace: "nowrap", textAlign: "center",
      }}>{value}</div>
    </div>
  );

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: isBorrower ? 0 : sidebarW,
      right: 0,
      zIndex: 900,
      background: darkMode ? "rgba(5,5,5,0.92)" : "rgba(250,250,250,0.95)",
      backdropFilter: "blur(20px) saturate(180%)",
      WebkitBackdropFilter: "blur(20px) saturate(180%)",
      borderBottom: `1px solid ${T.separator}`,
      transition: "left 0.2s",
      fontFamily: FONT,
    }}>
      {/* ══════════════════════════════════════════════════════════
          ROW 1 — Brand + Qualification + Controls
          Desktop: 44px   Mobile: 40px
         ══════════════════════════════════════════════════════════ */}
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: isDesktop ? "0 32px" : "0 14px",
        paddingTop: isDesktop ? 0 : "max(0px, env(safe-area-inset-top))",
        gap: isDesktop ? 16 : 8,
        minHeight: isDesktop ? 44 : 40,
        position: !isDesktop ? "relative" : undefined,
      }}>
        {/* Left: Logo + Skill Badge + Sync */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, minWidth: 0, zIndex: 1 }}>
          {/* Blueprint wordmark */}
          <span style={{
            fontSize: isDesktop ? 16 : 14, fontWeight: 800,
            letterSpacing: "-0.03em", color: T.text,
            whiteSpace: "nowrap",
          }}>Blueprint</span>

          {/* Experience badge — tap to toggle between Guided ↔ Standard */}
          {skillLevel && (
            <div
              onClick={onToggleSkillLevel}
              title={skillLevel === 'guided' || skillLevel === 'beginner' ? 'Switch to Standard mode' : 'Switch to Guided mode'}
              style={{
                padding: '3px 8px',
                borderRadius: 9999,
                fontSize: 9,
                fontFamily: MONO,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                background: T.blue + '15',
                color: T.blue,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.2s',
              }}
            >
              {skillLevel === 'guided' || skillLevel === 'beginner' ? 'GUIDED' : 'STANDARD'}
              <span style={{ fontSize: 8, opacity: 0.6 }}>⇄</span>
            </div>
          )}
          {/* Sync indicators — hidden on mobile to avoid visual overlap with centered badge */}
          {isDesktop && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              {saving && <span style={{ fontSize: 9, color: T.textTertiary, fontStyle: "italic" }}>saving...</span>}
              {!saving && loaded && <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.green, flexShrink: 0 }} />}
              {cloudSyncStatus === 'saving' && <span style={{ fontSize: 9, color: T.blue, fontStyle: "italic" }}></span>}
              {cloudSyncStatus === 'saved' && <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.green, flexShrink: 0 }} />}
              {cloudSyncStatus === 'error' && <span style={{ fontSize: 9, color: T.red }}>✗</span>}
              {sync?.status === 'saving' && <span style={{ fontSize: 9, color: '#6366F1', fontStyle: "italic" }}>syncing...</span>}
              {sync?.status === 'saved' && <span style={{ fontSize: 9, color: '#10B981' }}>live</span>}
              {sync?.onlineUsers?.length > 0 && <span style={{ fontSize: 9, color: '#6366F1', fontWeight: 600 }}>{sync.onlineUsers.length} online</span>}
            </div>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Divider before controls */}
        <div style={{ width: 1, height: 22, background: T.separator, flexShrink: 0, opacity: 0.4 }} />

        {/* Controls: Dark/Light + Privacy */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button
            onClick={cycleTheme}
            title={themeMode === 'auto' ? 'Auto theme' : themeMode === 'light' ? 'Light mode' : 'Dark mode'}
            style={{
              background: T.pillBg,
              border: `1px solid ${T.separator}`,
              borderRadius: 8, width: 28, height: 28,
              fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s", flexShrink: 0,
              color: themeMode === 'dark' ? T.blue : themeMode === 'light' ? T.orange : T.text,
            }}
          >
            {themeMode === 'auto' ? '◐' : themeMode === 'light' ? '○' : '☽'}
          </button>

          <button
            onClick={() => setPrivacyMode(!privacyMode)}
            title={privacyMode ? "Show values" : "Hide values"}
            style={{
              background: privacyMode ? `${T.blue}20` : T.pillBg,
              border: `1px solid ${T.separator}`,
              borderRadius: 8, width: 28, height: 28,
              fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s", flexShrink: 0,
              color: T.textSecondary,
            }}
          >
            {privacyMode ? "⊘" : <Icon name="eye" size={13} />}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          ROW 2 — Stats Dashboard
          Desktop: dedicated row with breathing room (48px)
          Mobile: compact strip (unchanged)
         ══════════════════════════════════════════════════════════ */}
      {isDesktop ? (
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-around",
          padding: "0 48px",
          height: 48,
          borderTop: `1px solid ${T.separator}`,
        }}>
          <Stat label={isRefi ? "Value" : "Price"} value={fmt(salesPrice)} />
          <Stat label="Payment" value={fmt(calc.displayPayment)} color={T.blue} />

          {/* ── Qualification Pillars — centered in stats bar ── */}
          <div
            onClick={() => setTab("qualify")}
            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexShrink: 0 }}
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              background: `${badgeColor}18`,
              borderRadius: 9999, padding: "5px 12px",
              transition: "all 0.2s",
            }}>
              {allGood
                ? <Icon name="check" size={14} style={{ color: T.green, flexShrink: 0 }} />
                : <div style={{ width: 7, height: 7, borderRadius: "50%", background: badgeColor }} />
              }
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: badgeColor, fontFamily: FONT, whiteSpace: "nowrap",
              }}>{badgeLabel}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {pillars.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: p.color, transition: "all 0.3s",
                    boxShadow: p.color === T.green ? `0 0 4px ${T.green}50` : "none",
                  }} />
                  <span style={{
                    fontSize: 8, fontWeight: 600, color: p.color,
                    fontFamily: MONO, letterSpacing: 0.3, opacity: 0.85,
                  }}>{p.label}</span>
                </div>
              ))}
            </div>
          </div>

          <Stat label={isRefi ? "Refi Cost" : "Cash Close"} value={isRefi ? fmt(calc.totalClosingCosts + calc.totalPrepaidExp) : fmt(calc.cashToClose)} color={T.green} />
          <Stat label="LTV" value={pct(calc.ltv, 0)} />
          {calc.qualifyingIncome > 0 && (
            <Stat label="DTI" value={pct(calc.yourDTI, 1)} color={calc.yourDTI <= calc.maxDTI ? T.text : T.red} />
          )}
        </div>
      ) : (
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-around",
          padding: "4px 14px 6px",
          borderTop: `1px solid ${T.separator}`,
          gap: 2,
        }}>
          <Stat label={isRefi ? "Value" : "Price"} value={fmt(salesPrice)} />
          <Stat label="Payment" value={fmt(calc.displayPayment)} color={T.blue} />

          {/* ── Qualification Pillars — centered in stats bar (mobile) ── */}
          <div
            onClick={() => setTab("qualify")}
            style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flexShrink: 0 }}
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              background: `${badgeColor}18`,
              borderRadius: 9999, padding: "3px 7px",
              transition: "all 0.2s",
            }}>
              {allGood
                ? <Icon name="check" size={11} style={{ color: T.green, flexShrink: 0 }} />
                : <div style={{ width: 6, height: 6, borderRadius: "50%", background: badgeColor }} />
              }
              <span style={{
                fontSize: 8, fontWeight: 700,
                color: badgeColor, fontFamily: FONT, whiteSpace: "nowrap",
              }}>{badgeLabel}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {pillars.map((p, i) => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: p.color, transition: "all 0.3s",
                  boxShadow: p.color === T.green ? `0 0 4px ${T.green}50` : "none",
                }} />
              ))}
            </div>
          </div>

          <Stat label={isRefi ? "Refi Cost" : "Cash Close"} value={isRefi ? fmt(calc.totalClosingCosts + calc.totalPrepaidExp) : fmt(calc.cashToClose)} color={T.green} />
          {calc.qualifyingIncome > 0 && (
            <Stat label="DTI" value={pct(calc.yourDTI, 1)} color={calc.yourDTI <= calc.maxDTI ? T.text : T.red} />
          )}
        </div>
      )}

      {/* ── LO mode row: Borrower picker + Share link ── */}
      {isCloud && !isBorrower && BorrowerPicker && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: isDesktop ? "0 32px 6px" : "0 14px 6px", flexWrap: "wrap",
        }}>
          {auth?.userPill}
          <BorrowerPicker
            borrowers={borrowerList}
            activeBorrower={activeBorrower}
            loading={borrowerLoading}
            scenarios={borrowerScenarios}
            scenariosLoading={borrowerScenariosLoading}
            T={T}
            onSelect={borrowerPickerCallbacks?.onSelect}
            onSelectScenario={borrowerPickerCallbacks?.onSelectScenario}
            onAutoCreateScenario={borrowerPickerCallbacks?.onAutoCreateScenario}
            onCreateNew={borrowerPickerCallbacks?.onCreateNew}
          />
          {activeBorrower?.share_token && (
            <button
              onClick={() => {
                const url = `${window.location.origin}?share=${activeBorrower.share_token}`;
                navigator.clipboard.writeText(url).then(() => {
                  const btn = document.getElementById('bp-copy-share-btn');
                  if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Share Link'; }, 2000); }
                }).catch(() => { prompt('Copy this share link:', url); });
              }}
              id="bp-copy-share-btn"
              style={{
                fontSize: 10, fontWeight: 600, color: '#6366F1',
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 8, padding: '4px 8px',
                cursor: 'pointer', fontFamily: FONT,
                whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Icon name="link" size={11} />
              Share Link
            </button>
          )}
        </div>
      )}

      {/* ── Mobile tab bar ── */}
      {mobileTabBar}
    </div>
  );
}
