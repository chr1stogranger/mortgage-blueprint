import React, { useState } from "react";
import SetupContent from "./content/SetupContent";
import IncomeContent from "./content/IncomeContent";
import AssetsContent from "./content/AssetsContent";
import DebtsContent from "./content/DebtsContent";
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
function CollapsibleSection({ title, T, defaultOpen = true, children, id }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, marginBottom: open ? 12 : 4, paddingLeft: 4 }}>
        <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <span style={{ fontSize: 14, color: T.textTertiary, transition: "transform 0.2s", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>▾</span>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: FONT, color: T.text, letterSpacing: "-0.02em" }}>{title}</h2>
        </div>
      </div>
      {open && children}
    </div>
  );
}

function SectionDivider({ T }) {
  return <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${T.blue}30, transparent)`, margin: "28px 0 8px" }} />;
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

  const [showModules, setShowModules] = useState(false);
  const isGuided = skillLevel === "guided";

  return (
    <div style={{ marginTop: 0, paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: 80 }}>
      {/* ═══════════════════════════════════════
          HEADER: Title + scenario pills + sign-in
          ═══════════════════════════════════════ */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 34, fontWeight: 700, fontFamily: FONT, color: T.blue, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          {isRefi ? "Refinance" : "Purchase"} Overview
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          {(city || propertyZip) && (
            <span style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, fontFamily: MONO, letterSpacing: "0.01em" }}>
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
      <CollapsibleSection title="Quick Start" T={T} id="overview-setup" defaultOpen={true}>
        <SetupContent {...props} />
      </CollapsibleSection>

      {/* Module Toggles — collapsible "Additional Modules" */}
      <div style={{ marginTop: 14 }}>
        <button onClick={() => setShowModules(!showModules)} style={{ background: 'none', border: 'none', color: T.textSecondary, fontFamily: MONO, fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px', cursor: 'pointer', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', transform: showModules ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>{'\u25B8'}</span>
          Additional Modules
        </button>
        {showModules && (
          <div style={{ marginTop: 8, padding: 14, background: T.inputBg, borderRadius: 12, border: `1px solid ${T.cardBorder}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Own Properties?', desc: 'Show Real Estate Owned analysis', val: ownsProperties, set: setOwnsProperties },
              { label: 'Selling a Property?', desc: 'Show Seller Net Proceeds calculator', val: hasSellProperty, set: setHasSellProperty },
              { label: 'Investment Analysis?', desc: 'Show NOI, Cap Rate, DSCR metrics', val: showInvestor, set: setShowInvestor },
              ...(!isRefi ? [{ label: 'Buy vs Rent?', desc: 'Compare buying vs renting over time', val: showRentVsBuy, set: setShowRentVsBuy }] : []),
            ].map(m => (
              <div key={m.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 1 }}>{m.desc}</div>
                </div>
                <button onClick={() => m.set(!m.val)} style={{ width: 40, height: 22, borderRadius: 9999, border: 'none', background: m.val ? T.blue : T.separator, position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: m.val ? 20 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════
          SECTION 2: MONTHLY PAYMENT (Calculator)
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Monthly Payment" T={T} id="overview-payment">
        <CalculatorContent {...props} />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 3: CASH TO CLOSE (Costs)
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title={isRefi ? "Estimated Refi Costs" : "Cash to Close"} T={T} id="overview-costs">
        <CostsContent {...props} />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 4: FINANCIAL INFO (Income + Debts + Assets)
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Financial Info" T={T} id="overview-financial">
        <IncomeContent {...props} />
        <DebtsContent {...props} />
        <AssetsContent {...props} />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 5: PRE-QUALIFIED? (Qualification)
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Pre-Qualified?" T={T} id="overview-qualification">
        <QualifyContent {...props} />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 6: TAX SAVINGS
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Tax Savings" T={T} id="overview-tax">
        <TaxContent {...props} />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 7: EQUITY (Amortization)
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Equity" T={T} id="overview-equity">
        <AmortContent {...props} />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 8: RENT VS BUY (conditional)
          ═══════════════════════════════════════ */}
      {showRentVsBuy && !isRefi && (
        <>
          <SectionDivider T={T} />
          <CollapsibleSection title="Rent vs Buy" T={T} id="overview-rentvbuy">
            <RentVsBuyContent {...props} />
          </CollapsibleSection>
        </>
      )}

      {/* ═══════════════════════════════════════
          SECTION 9: INVESTOR (conditional)
          ═══════════════════════════════════════ */}
      {showInvestor && (
        <>
          <SectionDivider T={T} />
          <CollapsibleSection title="Investor" T={T} id="overview-investor">
            <InvestContent {...props} />
          </CollapsibleSection>
        </>
      )}

      {/* ═══════════════════════════════════════
          SECTION 10: SELLER NET (conditional)
          ═══════════════════════════════════════ */}
      {hasSellProperty && sellPrice > 0 && (
        <>
          <SectionDivider T={T} />
          <CollapsibleSection title="Seller Net" T={T} id="overview-seller">
            <SellContent {...props} />
          </CollapsibleSection>
        </>
      )}

      {/* ═══════════════════════════════════════
          SECTION 11: PROP 19 TAX XFER (CA only)
          ═══════════════════════════════════════ */}
      {showProp19 && propertyState === "California" && !isRefi && prop19 && (
        <>
          <SectionDivider T={T} />
          <CollapsibleSection title="Prop 19 Tax Xfer" T={T} id="overview-prop19">
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
