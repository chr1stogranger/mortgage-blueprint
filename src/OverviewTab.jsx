import React, { useState } from "react";
import SetupContent from "./content/SetupContent";
import IncomeContent from "./content/IncomeContent";
import AssetsContent from "./content/AssetsContent";
import DebtsContent from "./content/DebtsContent";
import ReoContent from "./content/ReoContent";
import AmortContent from "./content/AmortContent";
import SellContent from "./content/SellContent";
import RentVsBuyContent from "./content/RentVsBuyContent";
import InvestContent from "./content/InvestContent";
import CostsContent from "./content/CostsContent";
import CalculatorContent from "./content/CalculatorContent";
import QualifyContent from "./content/QualifyContent";
import TaxContent from "./content/TaxContent";
import Prop19Content from "./content/Prop19Content";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

/* ─── Collapsible section wrapper ─── */
function CollapsibleSection({ title, T, defaultOpen = true, children, id, heroStyle = false, subtitle }) {
  const [open, setOpen] = useState(defaultOpen);
  if (heroStyle) {
    // Full-width indigo banner with white text. Slim profile per Christo
    // (2026-05-02) — shorter padding + smaller title so the banners stop
    // dominating the vertical scroll on the Overview tab.
    return (
      <div id={id}>
        <div onClick={() => setOpen(!open)} style={{
          cursor: "pointer", marginTop: 12, marginBottom: open ? 10 : 4,
          background: T.blue, padding: "10px 18px", borderRadius: 12,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 14, lineHeight: 1, color: "rgba(255,255,255,0.85)", transition: "transform 0.2s", transform: open ? "rotate(0deg)" : "rotate(-90deg)", flexShrink: 0 }}>▾</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.85)", fontFamily: FONT, marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {open && children}
      </div>
    );
  }
  // Smaller sub-section heading (also blue banner but compact).
  return (
    <div id={id}>
      <div onClick={() => setOpen(!open)} style={{
        cursor: "pointer", marginTop: 28, marginBottom: open ? 12 : 4,
        background: T.blue, padding: "12px 16px", borderRadius: 12,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", transition: "transform 0.2s", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>▾</span>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: FONT, color: "#fff", letterSpacing: "-0.02em" }}>{title}</h2>
      </div>
      {open && children}
    </div>
  );
}

function SectionDivider({ T }) {
  return <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${T.blue}30, transparent)`, margin: "28px 0 8px" }} />;
}

/* ─── Guided "Next section" button ───────────────────────────────
   Renders at the bottom of each Overview section for guided users.
   Smooth-scrolls down the single page to the next section anchor
   instead of switching tabs (guided users live on Overview). */
function OverviewNextButton({ T, targetId, label }) {
  return (
    <div style={{ marginTop: 24, marginBottom: 4, padding: "0 4px", animation: "fadeSlideUp 0.4s ease both" }}>
      <button
        onClick={() => {
          const el = document.getElementById(targetId);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        style={{
          width: "100%", padding: "14px 24px",
          background: "linear-gradient(135deg, #6366F1, #3B82F6)",
          border: "none", borderRadius: 9999, color: "#fff",
          fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: "pointer",
          boxShadow: "0 0 20px rgba(99,102,241,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          letterSpacing: "-0.01em",
        }}
      >
        <span>Next: {label}</span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   OVERVIEW TAB — Full-page single-scroll view with every tab embedded
   Each section renders the full content component from src/content/
   ═══════════════════════════════════════════════════════════════ */
export default function OverviewTab(props) {
  const {
    T, isDesktop, isRefi, setTab, skillLevel, onToggleSkillLevel,
    scenarioName, scenarioList, switchScenario, onCompare,
    isCloud, auth,
    city, propertyState, propertyZip,
    showInvestor, setShowInvestor,
    showRentVsBuy, setShowRentVsBuy,
    hasSellProperty, setHasSellProperty,
    ownsProperties, setOwnsProperties,
    showProp19, prop19, sellPrice,
  } = props;

  const isGuided = skillLevel === "guided";

  // Ordered list of section anchors actually rendered on this page.
  // Conditional sections are included only when their flag is on, so the
  // guided "Next" chain always points at a section that exists.
  const sectionFlow = [
    ["overview-setup", "Quick Start"],
    ["overview-payment", "Monthly Payment"],
    ["overview-costs", isRefi ? "Estimated Refi Costs" : "Costs"],
    ["overview-assets", "Assets"],
    ["overview-income", "Income"],
    ["overview-debts", "Debts"],
    ...(ownsProperties ? [["overview-reo", "Real Estate Owned"]] : []),
    ["overview-qualification", "Pre-Qualified?"],
    ["overview-tax", "Tax Savings"],
    ["overview-equity", "Equity"],
    ...(showRentVsBuy && !isRefi ? [["overview-rentvbuy", "Rent vs Buy"]] : []),
    ...(showInvestor ? [["overview-investor", "Investor"]] : []),
    ...(hasSellProperty && sellPrice > 0 ? [["overview-seller", "Seller Net"]] : []),
    ...(showProp19 && propertyState === "California" && !isRefi && prop19 ? [["overview-prop19", "Prop 19 Tax Xfer"]] : []),
  ];
  const nextOf = (id) => {
    const i = sectionFlow.findIndex(([sid]) => sid === id);
    return i >= 0 && i < sectionFlow.length - 1 ? sectionFlow[i + 1] : null;
  };
  // In-component wrapper: only renders for guided users, and only when
  // there's a next section to point at.
  const NextBtn = ({ fromId }) => {
    if (!isGuided) return null;
    const n = nextOf(fromId);
    if (!n) return null;
    return <OverviewNextButton T={T} targetId={n[0]} label={n[1]} />;
  };

  return (
    <div style={{ marginTop: 0, paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: 80 }}>
      {/* ═══════════════════════════════════════
          HEADER: scenario pills + sign-in (title removed — sticky bar provides context)
          ═══════════════════════════════════════ */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {(city || propertyZip) && (
            <span style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, fontFamily: FONT, letterSpacing: "0.01em" }}>
              {city}{city && propertyState ? ", " : ""}{propertyState ? (propertyState.length > 2 ? propertyState.substring(0, 2).toUpperCase() : propertyState) : ""}{propertyZip ? ` ${propertyZip}` : ""}
            </span>
          )}
          {(city || propertyZip) && <span style={{ color: T.textTertiary, fontSize: 10 }}>·</span>}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: T.pillBg, borderRadius: 8, padding: "2px 8px" }}>
            {(scenarioList || []).length > 1 ? (scenarioList || []).map(name => (
              <span key={name} onClick={() => name !== scenarioName ? switchScenario(name) : null}
                style={{ fontSize: 11, fontWeight: name === scenarioName ? 700 : 400, color: name === scenarioName ? T.blue : T.textTertiary, cursor: name === scenarioName ? "default" : "pointer", textDecoration: name === scenarioName ? "none" : "underline", whiteSpace: "nowrap", transition: "all 0.2s" }}>
                {name}
              </span>
            )) : (
              <span style={{ fontSize: 11, fontWeight: 600, color: T.blue, whiteSpace: "nowrap" }}>{scenarioName || "Scenario 1"}</span>
            )}
            {(scenarioList || []).length > 1 && onCompare && (
              <span onClick={onCompare} style={{ fontSize: 9, fontWeight: 700, color: T.blue, background: `${T.blue}15`, borderRadius: 5, padding: "1px 5px", cursor: "pointer", whiteSpace: "nowrap" }}>Compare</span>
            )}
          </div>
          {!isCloud && !auth?.localMode && auth?.requestLogin && (
            <button onClick={auth.requestLogin} style={{ fontSize: 10, color: T.blue, background: "none", border: `1px solid ${T.blue}30`, borderRadius: 8, padding: "2px 8px", cursor: "pointer", fontFamily: FONT }}>Sign in to sync</button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          SECTION 1: QUICK START (full Setup tab)
          ═══════════════════════════════════════ */}
      <CollapsibleSection
        title="Quick Start"
        T={T}
        id="overview-setup"
        defaultOpen={true}
        heroStyle={true}
      >
        <SetupContent {...props} hideHero={true} />
        <NextBtn fromId="overview-setup" />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 2: MONTHLY PAYMENT (Calculator)
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Monthly Payment" T={T} id="overview-payment" heroStyle={true}>
        <CalculatorContent {...props} />
        <NextBtn fromId="overview-payment" />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 3: CASH TO CLOSE (Costs)
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title={isRefi ? "Estimated Refi Costs" : "Costs"} T={T} id="overview-costs" heroStyle={true}>
        <CostsContent {...props} />
        <NextBtn fromId="overview-costs" />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 4: ASSETS
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Assets" T={T} id="overview-assets" heroStyle={true}>
        <AssetsContent {...props} />
        <NextBtn fromId="overview-assets" />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 5: INCOME
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Income" T={T} id="overview-income" heroStyle={true}>
        <IncomeContent {...props} />
        <NextBtn fromId="overview-income" />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 6: DEBTS
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Debts" T={T} id="overview-debts" heroStyle={true}>
        <DebtsContent {...props} />
        <NextBtn fromId="overview-debts" />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 7: REAL ESTATE OWNED (only when ownsProperties is on)
          ═══════════════════════════════════════ */}
      {ownsProperties && (<>
        <SectionDivider T={T} />
        <CollapsibleSection title="Real Estate Owned (REO)" T={T} id="overview-reo" heroStyle={true}>
          <ReoContent {...props} hideHero={true} />
          <NextBtn fromId="overview-reo" />
        </CollapsibleSection>
      </>)}

      {/* ═══════════════════════════════════════
          SECTION 8: PRE-QUALIFIED? (Qualification)
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Pre-Qualified?" T={T} id="overview-qualification" heroStyle={true}>
        <QualifyContent {...props} />
        <NextBtn fromId="overview-qualification" />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 9: TAX SAVINGS
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Tax Savings" T={T} id="overview-tax" heroStyle={true}>
        <TaxContent {...props} />
        <NextBtn fromId="overview-tax" />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 10: EQUITY (Amortization)
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Equity" T={T} id="overview-equity" heroStyle={true}>
        <AmortContent {...props} />
        <NextBtn fromId="overview-equity" />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 11: RENT VS BUY (conditional)
          ═══════════════════════════════════════ */}
      {showRentVsBuy && !isRefi && (
        <>
          <SectionDivider T={T} />
          <CollapsibleSection title="Rent vs Buy" T={T} id="overview-rentvbuy" heroStyle={true}>
            <RentVsBuyContent {...props} />
          </CollapsibleSection>
        </>
      )}

      {/* ═══════════════════════════════════════
          SECTION 12: INVESTOR (conditional)
          ═══════════════════════════════════════ */}
      {showInvestor && (
        <>
          <SectionDivider T={T} />
          <CollapsibleSection title="Investor" T={T} id="overview-investor" heroStyle={true}>
            <InvestContent {...props} />
          </CollapsibleSection>
        </>
      )}

      {/* ═══════════════════════════════════════
          SECTION 13: SELLER NET (conditional)
          ═══════════════════════════════════════ */}
      {hasSellProperty && sellPrice > 0 && (
        <>
          <SectionDivider T={T} />
          <CollapsibleSection title="Seller Net" T={T} id="overview-seller" heroStyle={true}>
            <SellContent {...props} />
          </CollapsibleSection>
        </>
      )}

      {/* ═══════════════════════════════════════
          SECTION 14: PROP 19 TAX XFER (CA only)
          ═══════════════════════════════════════ */}
      {showProp19 && propertyState === "California" && !isRefi && prop19 && (
        <>
          <SectionDivider T={T} />
          <CollapsibleSection title="Prop 19 Tax Xfer" T={T} id="overview-prop19" heroStyle={true}>
            <Prop19Content {...props} />
          </CollapsibleSection>
        </>
      )}

      {/* ═══════════════════════════════════════
          BOTTOM CTA — Share + mode switch
          ═══════════════════════════════════════ */}
      <div style={{ marginTop: 32, textAlign: "center", paddingBottom: 40 }}>
        <button onClick={() => setTab("summary")} style={{
          padding: "14px 28px",
          background: T.blue,
          border: "none",
          borderRadius: 99,
          color: "#fff",
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: FONT,
          boxShadow: `0 4px 16px ${T.blue}30`,
        }}>
          Share This Blueprint →
        </button>
        <div style={{ fontSize: 12, color: T.textTertiary, marginTop: 8 }}>
          Email a branded summary to your client or realtor
        </div>
        {onToggleSkillLevel && (
          <div style={{ marginTop: 24, paddingTop: 24, borderTop: `1px solid ${T.separator}` }}>
            <button onClick={onToggleSkillLevel} style={{
              padding: "10px 20px",
              background: "transparent",
              border: `1px solid ${T.separator}`,
              borderRadius: 99,
              color: T.textSecondary,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: FONT,
              transition: "all 0.2s",
            }}>
              {isGuided ? "Switch to Standard Mode →" : "Switch to Guided Mode →"}
            </button>
            <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 6 }}>
              {isGuided
                ? "Unlock all tabs and sections for full control"
                : "Step-by-step walkthrough for first-time homebuyers"
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
