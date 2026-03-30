import React, { useState, useEffect, useRef } from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

/**
 * OverviewStickyBar
 *
 * Compact deal dashboard that pins to the top of the Overview tab when the user
 * scrolls past the Loan Structure section.
 *
 * Props:
 *   salesPrice, calc, creditScore, downPct, loanType, isRefi, refiPurpose,
 *   firstTimeBuyer, isDesktop, darkMode, T,
 *   allGood, someGood, purchPillarCount, refiPillarCount, dpOk, refiLtvCheck,
 *   onPillarStripClick — scrolls to qualification section
 */
export default function OverviewStickyBar({
  salesPrice, calc, creditScore, downPct, loanType, isRefi, refiPurpose,
  firstTimeBuyer, isDesktop, darkMode, T,
  allGood, someGood, purchPillarCount, refiPillarCount, dpOk, refiLtvCheck,
  onPillarStripClick,
}) {
  // ── Sticky visibility (appears after scrolling past ~400px) ──
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 380);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  // ── Qualification badge logic ──
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

  // ── Five pillar dots ──
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

  // ── Format helpers (local to avoid import issues) ──
  const fmt = (v) => {
    if (v == null || !isFinite(v) || isNaN(v)) return "$0";
    if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
    if (Math.abs(v) >= 1e4) return "$" + (v / 1e3).toFixed(0) + "K";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  };
  const pct = (v, d = 1) => ((v || 0) * 100).toFixed(d) + "%";

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: isDesktop ? 180 : 0,
      right: 0,
      zIndex: 900,
      background: darkMode ? "rgba(5,5,5,0.88)" : "rgba(250,250,250,0.92)",
      backdropFilter: "blur(20px) saturate(180%)",
      WebkitBackdropFilter: "blur(20px) saturate(180%)",
      borderBottom: `1px solid ${T.separator}`,
      padding: isDesktop ? "8px 24px" : "6px 12px",
      paddingTop: isDesktop ? 8 : "max(6px, env(safe-area-inset-top))",
      transition: "transform 0.25s ease, opacity 0.25s ease",
      transform: visible ? "translateY(0)" : "translateY(-100%)",
      opacity: visible ? 1 : 0,
    }}>
      {/* Row 1: Badge + Key Numbers */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: isDesktop ? 16 : 8,
        flexWrap: "nowrap",
        overflow: "hidden",
      }}>
        {/* Qualification Badge */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          background: badgeBg,
          borderRadius: 8,
          padding: isDesktop ? "5px 10px" : "4px 8px",
          flexShrink: 0,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: badgeColor,
          }} />
          <span style={{
            fontSize: isDesktop ? 12 : 10,
            fontWeight: 700,
            color: badgeColor,
            fontFamily: FONT,
            whiteSpace: "nowrap",
          }}>{badgeLabel}</span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: T.separator, flexShrink: 0 }} />

        {/* Key Numbers */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: isDesktop ? 16 : 6,
          flex: 1,
          overflow: "hidden",
        }}>
          {/* Sales Price */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: T.textTertiary, fontWeight: 600, letterSpacing: 0.5, fontFamily: MONO, textTransform: "uppercase" }}>
              {isRefi ? "Value" : "Price"}
            </div>
            <div style={{ fontSize: isDesktop ? 15 : 13, fontWeight: 700, color: T.text, fontFamily: FONT, letterSpacing: "-0.02em" }}>
              {fmt(salesPrice)}
            </div>
          </div>

          {/* Monthly Payment */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: T.textTertiary, fontWeight: 600, letterSpacing: 0.5, fontFamily: MONO, textTransform: "uppercase" }}>Payment</div>
            <div style={{ fontSize: isDesktop ? 15 : 13, fontWeight: 700, color: T.blue, fontFamily: FONT, letterSpacing: "-0.02em" }}>
              {fmt(calc.displayPayment)}
            </div>
          </div>

          {/* Cash to Close / Refi Costs */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: T.textTertiary, fontWeight: 600, letterSpacing: 0.5, fontFamily: MONO, textTransform: "uppercase" }}>
              {isRefi ? "Refi Cost" : "Cash Close"}
            </div>
            <div style={{ fontSize: isDesktop ? 15 : 13, fontWeight: 700, color: T.green, fontFamily: FONT, letterSpacing: "-0.02em" }}>
              {isRefi ? fmt(calc.totalClosingCosts + calc.totalPrepaidExp) : fmt(calc.cashToClose)}
            </div>
          </div>

          {/* DTI */}
          {calc.qualifyingIncome > 0 && (
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: T.textTertiary, fontWeight: 600, letterSpacing: 0.5, fontFamily: MONO, textTransform: "uppercase" }}>DTI</div>
              <div style={{
                fontSize: isDesktop ? 15 : 13,
                fontWeight: 700,
                fontFamily: FONT,
                letterSpacing: "-0.02em",
                color: calc.yourDTI <= calc.maxDTI ? T.text : T.red,
              }}>
                {pct(calc.yourDTI, 1)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Pillar Dot Strip */}
      <div
        onClick={onPillarStripClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginTop: 4,
          cursor: "pointer",
          paddingLeft: 2,
        }}
      >
        {pillars.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: p.color,
              transition: "background 0.3s",
            }} />
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              color: p.color,
              fontFamily: MONO,
              letterSpacing: 0.3,
              opacity: 0.8,
            }}>{p.label}</span>
            {i < pillars.length - 1 && (
              <div style={{ width: 1, height: 10, background: T.separator, marginLeft: 2, marginRight: 2 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
