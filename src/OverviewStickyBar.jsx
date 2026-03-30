import React, { useState, useEffect } from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

/**
 * OverviewStickyBar
 *
 * Compact deal dashboard pinned to the top when user scrolls.
 * Now rendered from MortgageBlueprint.jsx on ALL Blueprint tabs.
 */
export default function OverviewStickyBar({
  salesPrice, calc, creditScore, downPct, loanType, isRefi, refiPurpose,
  firstTimeBuyer, isDesktop, darkMode, T,
  allGood, someGood, purchPillarCount, refiPillarCount, dpOk, refiLtvCheck,
  sidebarCollapsed,
  onPillarStripClick,
}) {
  const [visible, setVisible] = useState(() => typeof window !== "undefined" && window.scrollY > 280);
  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 280);
    handleScroll(); // run immediately in case page is already scrolled
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  // ── Qualification badge ──
  const totalPillars = isRefi ? 3 : 5;
  const passedPillars = isRefi ? refiPillarCount : purchPillarCount;
  const hasData = calc.qualifyingIncome > 0 || creditScore > 0 || salesPrice > 0;

  let badgeLabel, badgeColor, badgeBg;
  if (allGood) {
    badgeLabel = "Pre-Qualified";
    badgeColor = T.green;
    badgeBg = `${T.green}18`;
  } else if (someGood && passedPillars >= (isRefi ? 2 : 3)) {
    badgeLabel = "Almost There";
    badgeColor = T.orange;
    badgeBg = `${T.orange}18`;
  } else if (someGood) {
    badgeLabel = "Action Needed";
    badgeColor = T.orange;
    badgeBg = `${T.orange}12`;
  } else if (hasData) {
    badgeLabel = "Action Needed";
    badgeColor = T.red;
    badgeBg = `${T.red}12`;
  } else {
    badgeLabel = "Enter Info";
    badgeColor = T.textTertiary;
    badgeBg = `${T.textTertiary}12`;
  }

  // ── Pillar status ──
  const getPillarStatus = (check) => {
    if (check === "Good!") return T.green;
    if (check === "—") return T.textTertiary;
    return T.red;
  };

  const purchasePillars = [
    { label: "FICO", color: getPillarStatus(calc.ficoCheck) },
    { label: "Down", color: dpOk ? T.green : (calc.dpWarning === null ? T.textTertiary : T.red) },
    { label: "DTI", color: getPillarStatus(calc.dtiCheck) },
    { label: "Cash", color: getPillarStatus(calc.cashCheck) },
    { label: "Reserves", color: getPillarStatus(calc.resCheck) },
  ];
  const refiPillars = [
    { label: "FICO", color: getPillarStatus(calc.ficoCheck) },
    { label: "DTI", color: getPillarStatus(calc.dtiCheck) },
    { label: "LTV", color: refiLtvCheck === "Good!" ? T.green : refiLtvCheck === "—" ? T.textTertiary : T.red },
  ];
  const pillars = isRefi ? refiPillars : purchasePillars;

  // ── Format helpers ──
  const fmt = (v) => {
    if (v == null || !isFinite(v) || isNaN(v)) return "$0";
    if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
    if (Math.abs(v) >= 1e4) return "$" + (v / 1e3).toFixed(0) + "K";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  };
  const pct = (v, d = 1) => ((v || 0) * 100).toFixed(d) + "%";

  const sidebarW = isDesktop ? (sidebarCollapsed ? 56 : 180) : 0;

  // ── Stat cell component ──
  const Stat = ({ label, value, color }) => (
    <div style={{ textAlign: "center", minWidth: isDesktop ? 80 : 50 }}>
      <div style={{ fontSize: 9, color: T.textTertiary, fontWeight: 600, letterSpacing: 1, fontFamily: MONO, textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: isDesktop ? 16 : 13, fontWeight: 700, color: color || T.text, fontFamily: MONO, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: sidebarW,
      right: 0,
      zIndex: 900,
      background: darkMode ? "rgba(5,5,5,0.92)" : "rgba(250,250,250,0.95)",
      backdropFilter: "blur(20px) saturate(180%)",
      WebkitBackdropFilter: "blur(20px) saturate(180%)",
      borderBottom: `1px solid ${T.separator}`,
      transition: "transform 0.25s ease, opacity 0.25s ease, left 0.2s",
      transform: visible ? "translateY(0)" : "translateY(-100%)",
      opacity: visible ? 1 : 0,
    }}>
      {/* Single row: Badge | Stats | Pillars */}
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: isDesktop ? "10px 28px" : "8px 12px",
        paddingTop: isDesktop ? 10 : "max(8px, env(safe-area-inset-top))",
        gap: isDesktop ? 20 : 10,
      }}>
        {/* Qualification Badge */}
        <div
          onClick={onPillarStripClick}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: badgeBg,
            borderRadius: 9999,
            padding: isDesktop ? "6px 14px" : "5px 10px",
            flexShrink: 0,
            cursor: "pointer",
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: badgeColor }} />
          <span style={{ fontSize: isDesktop ? 12 : 10, fontWeight: 700, color: badgeColor, fontFamily: FONT, whiteSpace: "nowrap" }}>{badgeLabel}</span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 28, background: T.separator, flexShrink: 0, opacity: 0.5 }} />

        {/* Key Stats — evenly spaced */}
        <div style={{ display: "flex", alignItems: "center", flex: 1, justifyContent: "space-around", gap: isDesktop ? 12 : 4 }}>
          <Stat label={isRefi ? "Value" : "Price"} value={fmt(salesPrice)} />
          <Stat label="Payment" value={fmt(calc.displayPayment)} color={T.blue} />
          <Stat label={isRefi ? "Refi Cost" : "Cash Close"} value={isRefi ? fmt(calc.totalClosingCosts + calc.totalPrepaidExp) : fmt(calc.cashToClose)} color={T.green} />
          <Stat label="LTV" value={pct(calc.ltv, 0)} />
          {calc.qualifyingIncome > 0 && (
            <Stat label="DTI" value={pct(calc.yourDTI, 1)} color={calc.yourDTI <= calc.maxDTI ? T.text : T.red} />
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 28, background: T.separator, flexShrink: 0, opacity: 0.5 }} />

        {/* Pillar Dots (compact) */}
        <div
          onClick={onPillarStripClick}
          style={{ display: "flex", alignItems: "center", gap: isDesktop ? 8 : 4, cursor: "pointer", flexShrink: 0 }}
        >
          {pillars.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: p.color }} />
              {isDesktop && (
                <span style={{ fontSize: 9, fontWeight: 600, color: p.color, fontFamily: MONO, letterSpacing: 0.3, opacity: 0.85 }}>{p.label}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
