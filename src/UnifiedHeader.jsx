import React from "react";
import Icon from "./Icon";
import { WEB_ORIGIN } from "./apiBase";

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
  /* Whose blueprint this is */
  borrowerName,
  /* Controls */
  darkMode, themeMode, cycleTheme,
  privacyMode, setPrivacyMode,
  /* Layout */
  isDesktop, sidebarCollapsed, T,
  /* Navigation */
  setTab, onCompare,
  /* Auth */
  isCloud, isBorrower, auth,
  /* Borrower account (self-serve sign-in on the public calculator) */
  showAccountButton, selfAccount, onOpenAccountSheet, selfSyncStatus,
  borrowerList, activeBorrower, borrowerLoading,
  borrowerScenarios, borrowerScenariosLoading,
  BorrowerPicker, borrowerPickerCallbacks,
  /* Skill level */
  skillLevel, onToggleSkillLevel,
  /* App mode — shown as pill toggle on mobile (desktop uses sidebar) */
  appMode, setAppMode,
  /* Mobile drawer — opens the RealStack shell sidebar on mobile */
  onOpenMobileMenu,
  /* Active tab — used for breadcrumb after the wordmark */
  tab, tabLabel,
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

  const sidebarW = isDesktop ? (sidebarCollapsed ? 56 : 270) : 0;

  // ── Stat cell (responsive sizing) ──
  const Stat = ({ label, value, color }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 0, flex: 1 }}>
      <div style={{
        fontSize: isDesktop ? 10 : 9, color: T.textTertiary, fontWeight: 600,
        letterSpacing: 1.2, fontFamily: FONT, textTransform: "uppercase",
        marginBottom: isDesktop ? 3 : 2, whiteSpace: "nowrap", textAlign: "center",
      }}>{label}</div>
      <div style={{
        fontSize: isDesktop ? 17 : 13, fontWeight: 700,
        color: color || T.text, fontFamily: FONT,
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
        // Breathing room below the controls so the avatar / theme toggle don't
        // sit flush against the bottom border. Needed because in standalone-PWA
        // mode the safe-area paddingTop above, combined with border-box sizing,
        // squeezes the content box and pushes the row's contents to the very
        // bottom edge (the account circle was touching the divider). (2026-07-03)
        paddingBottom: isDesktop ? 0 : 7,
        gap: isDesktop ? 16 : 8,
        minHeight: isDesktop ? 44 : 48,
        position: "relative",
      }}>
        {/* Left: Hamburger (mobile) + Logo + Sync */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, minWidth: 0, zIndex: 1 }}>
          {/* Mobile hamburger — opens the RealStack shell drawer with
              product switcher (Blueprint / PricePoint / Markets), tab nav,
              scenarios, and settings. Desktop uses the persistent sidebar
              instead so we don't render the hamburger there. */}
          {!isDesktop && onOpenMobileMenu && (
            <button
              onClick={onOpenMobileMenu}
              title="Open menu"
              style={{
                background: "transparent", border: "none",
                width: 28, height: 28, padding: 0, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: T.text, flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}
          {/* Blueprint wordmark + tab breadcrumb. When the user is on the
              Overview tab the wordmark stands alone. On any other tab a
              subtle separator and the tab label appear after it
              ('Blueprint · Costs'), so the user always knows where they
              are even with the horizontal tab strip removed. */}
          <span style={{
            fontSize: isDesktop ? 16 : 14, fontWeight: 800,
            letterSpacing: "-0.03em", color: T.text,
            whiteSpace: "nowrap",
          }}>Blueprint</span>
          {borrowerName && borrowerName.trim() && (
            <>
              <span style={{
                fontSize: isDesktop ? 14 : 12, color: T.textTertiary,
                fontWeight: 500, marginLeft: 2, marginRight: 2,
                userSelect: "none",
              }}>·</span>
              <span style={{
                fontSize: isDesktop ? 14 : 12, fontWeight: 600,
                color: T.blue, fontFamily: FONT,
                whiteSpace: "nowrap", letterSpacing: "-0.01em",
                minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
                maxWidth: isDesktop ? 260 : 130,
              }} title={`Blueprint for ${borrowerName}`}>{borrowerName}</span>
            </>
          )}
          {tab && tab !== "overview" && tabLabel && (
            <>
              <span style={{
                fontSize: isDesktop ? 14 : 12, color: T.textTertiary,
                fontWeight: 500, marginLeft: 2, marginRight: 2,
                userSelect: "none",
              }}>·</span>
              <span style={{
                fontSize: isDesktop ? 14 : 12, fontWeight: 600,
                color: T.textSecondary, fontFamily: FONT,
                whiteSpace: "nowrap", letterSpacing: "-0.01em",
                minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
              }}>{tabLabel}</span>
            </>
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
              {selfSyncStatus === 'saving' && <span style={{ fontSize: 9, color: '#6366F1', fontStyle: "italic" }}>syncing...</span>}
              {selfSyncStatus === 'saved' && <span style={{ fontSize: 9, color: '#10B981' }}>synced</span>}
              {selfSyncStatus === 'error' && <span style={{ fontSize: 9, color: T.red }}>sync error</span>}
            </div>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Absolutely centered Qualification status. Per Christo's 2026-05-03
            rule: when ALL pillars pass (allGood), show the "Pre-Qualified"
            BADGE only — clean, declarative, borrower-friendly. When any
            pillar is failing or incomplete, show the 5 PILLAR DOTS only —
            the non-green dot becomes the alert and the broker can tap it
            to jump straight to the failing pillar. Never both at once.

            paddingTop on mobile honors the iOS safe-area-inset so the
            badge isn't hidden behind the status bar / Dynamic Island. */}
        <div style={{
          position: "absolute", left: 0, right: 0, top: 0, bottom: 0,
          paddingTop: isDesktop ? 0 : "max(0px, env(safe-area-inset-top))",
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: isDesktop ? 10 : 6, pointerEvents: "none",
        }}>
          {allGood ? (
            // ── ALL GREEN → show the Pre-Qualified badge only ──
            <div
              onClick={() => setTab("qualify")}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: `${badgeColor}18`,
                borderRadius: 9999, padding: isDesktop ? "5px 12px" : "4px 8px",
                cursor: "pointer", transition: "all 0.2s",
                pointerEvents: "auto",
              }}
            >
              <Icon name="check" size={isDesktop ? 14 : 12} style={{ color: T.green, flexShrink: 0 }} />
              <span style={{
                fontSize: isDesktop ? 11 : 9, fontWeight: 700,
                color: badgeColor, fontFamily: FONT, whiteSpace: "nowrap",
              }}>{badgeLabel}</span>
            </div>
          ) : (
            // ── Anything red or gray → show the 5 dots only ──
            <div
              onClick={() => setTab("qualify")}
              style={{ display: "flex", alignItems: "center", gap: isDesktop ? 6 : 4, cursor: "pointer", pointerEvents: "auto" }}
            >
              {pillars.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <div style={{
                    width: isDesktop ? 8 : 7, height: isDesktop ? 8 : 7, borderRadius: "50%",
                    background: p.color, transition: "all 0.3s",
                    boxShadow: p.color === T.green ? `0 0 4px ${T.green}50` : p.color === T.red ? `0 0 4px ${T.red}50` : "none",
                  }} />
                  {isDesktop && (
                    <span style={{
                      fontSize: 9, fontWeight: 600, color: p.color,
                      fontFamily: FONT, letterSpacing: 0.3, opacity: 0.9,
                    }}>{p.label}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Divider before controls */}
        <div style={{ width: 1, height: 22, background: T.separator, flexShrink: 0, opacity: 0.4 }} />

        {/* Controls: Dark/Light only. The privacy/eye button was removed
            (2026-05-03) — Christo confirmed nobody uses it, and the
            extra button was eating header space. State stays in
            MortgageBlueprint in case we re-surface it via a settings
            menu later. */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {/* ── Borrower account: sign-in pill (anonymous) / avatar (signed in).
              Hidden in LO mode and share-link borrower mode. ── */}
          {showAccountButton && (
            selfAccount ? (
              <button
                onClick={onOpenAccountSheet}
                title={selfAccount.email || 'My account'}
                style={{
                  width: 28, height: 28, borderRadius: "50%", border: "none",
                  background: "linear-gradient(135deg, #6366F1, #3B82F6)",
                  color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: FONT, flexShrink: 0, padding: 0,
                }}
              >
                {((selfAccount.name || selfAccount.email || '?').trim()[0] || '?').toUpperCase()}
              </button>
            ) : (
              <button
                onClick={onOpenAccountSheet}
                title="Save your Blueprint to an account"
                style={{
                  padding: isDesktop ? "4px 12px" : "4px 10px",
                  borderRadius: 9999,
                  border: "1px solid rgba(99,102,241,0.35)",
                  background: "rgba(99,102,241,0.08)",
                  color: "#6366F1", fontSize: 11, fontWeight: 600,
                  cursor: "pointer", fontFamily: FONT,
                  whiteSpace: "nowrap", flexShrink: 0,
                }}
              >
                Sign in
              </button>
            )
          )}
          <button
            onClick={cycleTheme}
            title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              background: T.pillBg,
              border: `1px solid ${T.separator}`,
              borderRadius: 8, width: 28, height: 28,
              fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s", flexShrink: 0,
              color: themeMode === 'dark' ? T.blue : T.orange,
            }}
          >
            {themeMode === 'dark' ? '☽' : '○'}
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
          <Stat label={isRefi ? "Refi Cost" : "Cash Close"} value={isRefi ? fmt(calc.totalClosingCosts + calc.totalPrepaidExp) : fmt(calc.cashToClose)} color={T.green} />
          <Stat label="Down" value={((downPct || 0)).toFixed(0) + "%"} />
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
          <Stat label={isRefi ? "Refi Cost" : "Cash Close"} value={isRefi ? fmt(calc.totalClosingCosts + calc.totalPrepaidExp) : fmt(calc.cashToClose)} color={T.green} />
          <Stat label="Down" value={((downPct || 0)).toFixed(0) + "%"} />
          {calc.qualifyingIncome > 0 && (
            <Stat label="DTI" value={pct(calc.yourDTI, 1)} color={calc.yourDTI <= calc.maxDTI ? T.text : T.red} />
          )}
        </div>
      )}

      {/* ── LO mode row: Borrower picker + Share link ── */}
      {isCloud && !isBorrower && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: isDesktop ? "0 32px 6px" : "0 14px 6px", flexWrap: "wrap",
        }}>
          {auth?.userPill}
          {/* Borrower/blueprint switcher moved to the left sidebar (SidebarSwitcher). */}
          {activeBorrower?.share_token && (
            <button
              onClick={() => {
                const url = `${WEB_ORIGIN}?share=${activeBorrower.share_token}`;
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

      {/* The mobile-only Blueprint↔PricePoint segmented toggle pill row was
          removed (2026-05-03) per Christo. Cross-product navigation is a
          platform-level concern and belongs at the RealStack shell layer
          (or the desktop sidebar switcher), not in Blueprint's sticky
          header. Desktop product switching still works via the sidebar. */}

      {/* ── Mobile tab bar ── */}
      {mobileTabBar}
    </div>
  );
}
