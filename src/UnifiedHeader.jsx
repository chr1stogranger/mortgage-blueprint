import React from "react";
import Icon from "./Icon";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

/**
 * UnifiedHeader
 *
 * Persistent top bar for ALL Blueprint tabs. Merges the old:
 *   - Header bar (Blueprint logo, scenario picker, payment, dark/light, privacy)
 *   - Qualification strip (Pre-Qualified banner + pillar dots)
 *   - OverviewStickyBar (key stats on scroll)
 *
 * Always visible. Single source of truth for deal summary + controls.
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

  // ── Stat cell ──
  const Stat = ({ label, value, color }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 0, flex: 1 }}>
      <div style={{
        fontSize: 9, color: T.textTertiary, fontWeight: 600,
        letterSpacing: 1.2, fontFamily: MONO, textTransform: "uppercase",
        marginBottom: 2, whiteSpace: "nowrap", textAlign: "center",
      }}>{label}</div>
      <div style={{
        fontSize: isDesktop ? 15 : 13, fontWeight: 700,
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
      {/* ── Row 1: Logo / Badge (centered) / Controls ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: isDesktop ? "10px 24px" : "8px 14px",
        paddingTop: isDesktop ? 10 : "max(8px, env(safe-area-inset-top))",
        gap: isDesktop ? 16 : 8,
        minHeight: isDesktop ? 48 : 40,
        position: !isDesktop ? "relative" : undefined,
      }}>
        {/* Left: Logo + Sync */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, minWidth: 0, zIndex: 1 }}>
          {/* Blueprint wordmark */}
          <span style={{
            fontSize: isDesktop ? 16 : 14, fontWeight: 800,
            letterSpacing: "-0.03em", color: T.text,
            whiteSpace: "nowrap",
          }}>Blueprint</span>

          {/* Sync indicators */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {saving && <span style={{ fontSize: 9, color: T.textTertiary, fontStyle: "italic" }}>saving...</span>}
            {!saving && loaded && <span style={{ fontSize: 9, color: T.green }}>✓</span>}
            {cloudSyncStatus === 'saving' && <span style={{ fontSize: 9, color: T.blue, fontStyle: "italic" }}></span>}
            {cloudSyncStatus === 'saved' && <span style={{ fontSize: 9, color: T.green }}>✓</span>}
            {cloudSyncStatus === 'error' && <span style={{ fontSize: 9, color: T.red }}>✗</span>}
            {sync?.status === 'saving' && <span style={{ fontSize: 9, color: '#6366F1', fontStyle: "italic" }}>syncing...</span>}
            {sync?.status === 'saved' && <span style={{ fontSize: 9, color: '#10B981' }}>live ✓</span>}
            {sync?.onlineUsers?.length > 0 && <span style={{ fontSize: 9, color: '#6366F1', fontWeight: 600 }}>{sync.onlineUsers.length} online</span>}
          </div>
        </div>

        {/* Spacer pushes right section to edge */}
        <div style={{ flex: 1 }} />

        {/* Desktop only: Key Stats inline */}
        {isDesktop && <>
          <div style={{ width: 1, height: 28, background: T.separator, flexShrink: 0, opacity: 0.5 }} />
          <div style={{
            display: "flex", alignItems: "center", flex: 1,
            justifyContent: "space-around", gap: 8,
            overflow: "hidden",
          }}>
            <Stat label={isRefi ? "Value" : "Price"} value={fmt(salesPrice)} />
            <Stat label="Payment" value={fmt(calc.displayPayment)} color={T.blue} />
            <Stat label={isRefi ? "Refi Cost" : "Cash Close"} value={isRefi ? fmt(calc.totalClosingCosts + calc.totalPrepaidExp) : fmt(calc.cashToClose)} color={T.green} />
            <Stat label="LTV" value={pct(calc.ltv, 0)} />
            {calc.qualifyingIncome > 0 && (
              <Stat label="DTI" value={pct(calc.yourDTI, 1)} color={calc.yourDTI <= calc.maxDTI ? T.text : T.red} />
            )}
          </div>
          <div style={{ width: 1, height: 28, background: T.separator, flexShrink: 0, opacity: 0.5 }} />
        </>}

        {/* Center (mobile): Qualification badge + Pillar dots — absolutely centered */}
        {!isDesktop && (
          <div style={{
            position: "absolute", left: 0, right: 0, top: 0, bottom: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, pointerEvents: "none",
          }}>
            <div
              onClick={() => setTab("qualify")}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: `${badgeColor}18`,
                borderRadius: 9999, padding: "4px 8px",
                cursor: "pointer", transition: "all 0.2s",
                pointerEvents: "auto",
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: badgeColor, boxShadow: allGood ? `0 0 6px ${T.green}60` : "none" }} />
              <span style={{
                fontSize: 9, fontWeight: 700,
                color: badgeColor, fontFamily: FONT, whiteSpace: "nowrap",
              }}>{badgeLabel}</span>
            </div>
            <div
              onClick={() => setTab("qualify")}
              style={{ display: "flex", alignItems: "center", gap: 3, cursor: "pointer", pointerEvents: "auto" }}
            >
              {pillars.map((p, i) => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: p.color, transition: "all 0.3s",
                  boxShadow: p.color === T.green ? `0 0 4px ${T.green}50` : "none",
                }} />
              ))}
            </div>
          </div>
        )}

        {/* Desktop: Qualification badge + Pillar dots + Controls together */}
        {isDesktop && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <div
              onClick={() => setTab("qualify")}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: `${badgeColor}18`,
                borderRadius: 9999, padding: "5px 12px",
                cursor: "pointer", transition: "all 0.2s",
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: badgeColor, boxShadow: allGood ? `0 0 6px ${T.green}60` : "none" }} />
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: badgeColor, fontFamily: FONT, whiteSpace: "nowrap",
              }}>{badgeLabel}</span>
            </div>
            <div
              onClick={() => setTab("qualify")}
              style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", flexShrink: 0 }}
            >
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
        )}

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

      {/* ── Row 2 (Mobile only): Key Stats strip ── */}
      {!isDesktop && (
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-around",
          padding: "4px 14px 6px",
          borderTop: `1px solid ${T.separator}`,
          gap: 2,
        }}>
          <Stat label={isRefi ? "Value" : "Price"} value={fmt(salesPrice)} />
          <Stat label="Payment" value={fmt(calc.displayPayment)} color={T.blue} />
          <Stat label={isRefi ? "Refi Cost" : "Cash Close"} value={isRefi ? fmt(calc.totalClosingCosts + calc.totalPrepaidExp) : fmt(calc.cashToClose)} color={T.green} />
          <Stat label="Down" value={((downPct || 0)).toFixed(0) + "%"} />
          {calc.qualifyingIncome > 0 && (
            <Stat label="DTI" value={pct(calc.yourDTI, 1)} color={calc.yourDTI <= calc.maxDTI ? T.text : T.red} />
          )}
        </div>
      )}

      {/* ── LO mode row: Borrower picker + Share link ── */}
      {isCloud && !isBorrower && BorrowerPicker && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: isDesktop ? "0 24px 6px" : "0 14px 6px", flexWrap: "wrap",
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
