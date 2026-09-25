import { FONT, MONO } from "./lib/fonts.js";
import React, { useState, useEffect, useRef, Suspense } from "react";
import { STATE_ABBR } from "./citiesData.js";
import { SetupContent, IncomeContent, AssetsContent, DebtsContent, ReoContent, AmortContent, SellContent, RentVsBuyContent, InvestContent, CostsContent, CalculatorContent, QualifyContent, TaxContent, Prop19Content, RateLadderContent, VaResidualContent } from "./content/index.js";


/* ─── Collapsible section wrapper ─── */
// `open` + `onToggle` make it controlled (Quick Start's auto-collapse);
// `collapsedSubtitle` replaces the subtitle only while the section is shut.
function CollapsibleSection({ title, T, defaultOpen = true, children, id, heroStyle = false, subtitle, collapsedSubtitle, open: openProp, onToggle }) {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const setOpen = onToggle ?? setOpenState;
  // ONE line — title, then the summary (collapsed) or explainer subtitle inline
  // to its right (Christo 2026-09-24/25: two-line banners read as too big).
  const inlineText = !open && collapsedSubtitle ? collapsedSubtitle : subtitle;
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
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.2, flexShrink: 0 }}>
              {title}
            </div>
            {inlineText && (
              <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)", fontFamily: FONT, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {inlineText}
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
    showRefi3, renderRefiSummarySection, renderRefi3Section,
    hasSellProperty, setHasSellProperty,
    ownsProperties, setOwnsProperties,
    showProp19, prop19, sellPrice,
    showRateLadder, vaResidualOn,
    salesPrice, creditScore, refiCurrentBalance, isTabFieldsComplete,
    blueprintLoaded, activeScenarioId,
  } = props;

  const isGuided = skillLevel === "guided";

  // Quick Start opens only when the Blueprint still needs its setup inputs
  // (Christo 2026-09-23, LLM council): a filled Blueprint opens on the payment
  // donut, with Quick Start shrunk to a one-line summary banner. A blank one
  // keeps the form on top so the donut never shows a payment built on default
  // ZIP/FICO. Guided mode always keeps it open (its steps start there).
  // The decision is re-made when the Blueprint loads or the scenario changes,
  // and again when setup flips to complete WITHOUT the user editing this page
  // (a cloud/client load whose data lands after the scenario id). A flip
  // caused by the user typing never collapses the section under the cursor,
  // and a manual open/close sticks until the next scenario.
  const setupFilled = !!isTabFieldsComplete?.("setup");
  const [setupOpen, setSetupOpen] = useState(() => isGuided || !setupFilled);
  const setupManual = useRef(false);
  const lastEditAt = useRef(0);
  const prevSetupFilled = useRef(setupFilled);
  const markEdit = () => { lastEditAt.current = Date.now(); };
  const toggleSetup = (v) => { setupManual.current = true; setSetupOpen(v); };
  const setupSnapshotKey = `${blueprintLoaded ? 1 : 0}|${activeScenarioId || ""}|${scenarioName || ""}|${isGuided ? 1 : 0}`;
  useEffect(() => {
    setupManual.current = false;
    setSetupOpen(isGuided || !setupFilled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupSnapshotKey]);
  useEffect(() => {
    const flippedOn = setupFilled && !prevSetupFilled.current;
    prevSetupFilled.current = setupFilled;
    if (flippedOn && !isGuided && !setupManual.current && Date.now() - lastEditAt.current > 3000) setSetupOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupFilled]);
  const compactUsd = (v) => v >= 1e6 ? `$${parseFloat((v / 1e6).toFixed(2))}M` : `$${Math.round(v / 1000)}K`;
  const setupSummary = [
    isRefi ? "Refinance" : "Purchase",
    // Phones keep the numbers: the one-line banner truncates, and the city
    // pushed price + FICO off the end.
    !isDesktop ? null : city && propertyState ? `${city}, ${STATE_ABBR[propertyState] || propertyState}` : propertyZip,
    isRefi ? (refiCurrentBalance > 0 ? `${compactUsd(refiCurrentBalance)} balance` : null) : (salesPrice > 0 ? compactUsd(salesPrice) : null),
    creditScore > 0 ? `${creditScore} FICO` : null,
  ].filter(Boolean).join(" · ");

  // No paddingTop on the root below: the parent content spacer in
  // MortgageBlueprint.jsx already reserves 98px + env(safe-area-inset-top) to
  // clear the fixed UnifiedHeader. Re-applying the safe-area inset here
  // double-counted it and left a large white gap at the top of the Overview.
  // (Christo 2026-05-27.)
  return (
    <Suspense fallback={null}>
    {/* Edits anywhere on the page (not the sidebar/header that load other
        Blueprints) mark "the user is typing" for Quick Start's auto-collapse. */}
    <div onPointerDownCapture={markEdit} onKeyDownCapture={markEdit} style={{ marginTop: 0, paddingTop: 0, paddingBottom: 80 }}>
      {/* Top-of-page block removed (Christo 2026-09-23): the "Blueprint ·
          loan #" eyebrow, the mobile city/ZIP line, the inline scenario list +
          Compare chip, and the Synced / Sign-in-to-sync chip. Every piece is
          elsewhere: scenarios in the header dropdown, location in Quick Start,
          Compare in the tab bar, account + sync status in the header. */}

      {/* Guided progress strip — slim, non-floating "Step X of N" indicator.
          Driven by guidedStep computed in MortgageBlueprint (mirrors guideField). */}
      {isGuided && props.guidedStep && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 2px" }}>
          <div style={{ flex: 1, height: 3, background: T.separator, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round((props.guidedStep.current / props.guidedStep.total) * 100)}%`, background: props.guidedStep.done ? T.green : T.blue, borderRadius: 2, transition: "width 0.4s ease" }} />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 0.5, color: T.textTertiary, whiteSpace: "nowrap" }}>
            {props.guidedStep.done ? "ALL STEPS DONE" : `STEP ${props.guidedStep.current} OF ${props.guidedStep.total}`} · {props.guidedStep.label.toUpperCase()}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          SECTION 1: QUICK START (full Setup tab)
          ═══════════════════════════════════════ */}
      <CollapsibleSection
        title="Quick Start"
        T={T}
        id="overview-setup"
        open={setupOpen}
        onToggle={toggleSetup}
        collapsedSubtitle={setupSummary}
        heroStyle={true}
      >
        <SetupContent {...props} hideHero={true} hideModules={true} />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 2: MONTHLY PAYMENT (Calculator)
          ═══════════════════════════════════════ */}
      {/* A collapsed Quick Start is a one-line header: no divider, so the
          donut section sits right under it. */}
      {setupOpen && <SectionDivider T={T} />}
      {/* Refi reads "New Loan" — this whole section IS the new loan being
          built, and "Monthly Payment" undersold it (Christo 2026-08-04). */}
      <CollapsibleSection title={isRefi ? "New Loan" : "Monthly Payment"} T={T} id="overview-payment" heroStyle={true}>
        <CalculatorContent {...props} />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          ADD TO THIS BLUEPRINT — the Modules toggles, moved out of Quick
          Start to sit right under the donut (Christo 2026-09-23). Purchase
          only, like the card itself; refi keeps its 3-Point toggle in
          Quick Start.
          ═══════════════════════════════════════ */}
      {!isRefi && (
        <>
          <SectionDivider T={T} />
          <CollapsibleSection title="Add to this Blueprint" T={T} id="overview-modules" heroStyle={true} subtitle="Turn on the sections that fit this buyer">
            <SetupContent {...props} modulesOnly={true} />
          </CollapsibleSection>
        </>
      )}

      {/* ═══════════════════════════════════════
          SECTION 2b (REFI): REFI SUMMARY + 3-POINT TEST
          Folded into the one-screen scroll (Christo 7.24). Bodies come from
          MortgageBlueprint's render functions — the SAME JSX the standalone
          routable tabs use, so there's one source of truth.
          ═══════════════════════════════════════ */}
      {isRefi && renderRefiSummarySection && (
        <>
          <SectionDivider T={T} />
          <CollapsibleSection title="Refi Summary" T={T} id="overview-refi" heroStyle={true}>
            {renderRefiSummarySection()}
          </CollapsibleSection>
        </>
      )}
      {isRefi && showRefi3 && renderRefi3Section && (
        <>
          <SectionDivider T={T} />
          <CollapsibleSection title="3-Point Refi Test" T={T} id="overview-refi3" heroStyle={true}>
            {renderRefi3Section()}
          </CollapsibleSection>
        </>
      )}

      {/* ═══════════════════════════════════════
          SECTION 3: CASH TO CLOSE (Costs)
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title={isRefi ? "Estimated Refi Costs" : "Costs"} T={T} id="overview-costs" heroStyle={true}>
        <CostsContent {...props} />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          RATE & POINTS BREAKEVEN (module, 2026-09-11)
          ═══════════════════════════════════════ */}
      {showRateLadder && (
        <>
          <SectionDivider T={T} />
          <CollapsibleSection title="Rate & Points Breakeven" T={T} id="overview-rateladder" heroStyle={true} subtitle="Buy the rate down, take a credit, or stay at par">
            <RateLadderContent {...props} />
          </CollapsibleSection>
        </>
      )}

      {/* ═══════════════════════════════════════
          SECTION 4: ASSETS
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Assets" T={T} id="overview-assets" heroStyle={true}>
        <AssetsContent {...props} />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 5: DEBTS
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Debts" T={T} id="overview-debts" heroStyle={true}>
        <DebtsContent {...props} />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 6: REAL ESTATE OWNED (only when ownsProperties is on)
          ═══════════════════════════════════════ */}
      {ownsProperties && (<>
        <SectionDivider T={T} />
        <CollapsibleSection title="Real Estate Owned (REO)" T={T} id="overview-reo" heroStyle={true}>
          <ReoContent {...props} hideHero={true} />
        </CollapsibleSection>
      </>)}

      {/* ═══════════════════════════════════════
          SECTION 7: INCOME — sits after Debts/REO so the guided pulse
          flows straight down (assets → debts → REO → income)
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Income" T={T} id="overview-income" heroStyle={true}>
        <IncomeContent {...props} />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 8: PRE-QUALIFIED? (Qualification)
          ═══════════════════════════════════════ */}
      {/* ═══════════════════════════════════════
          VA RESIDUAL INCOME (VA loans, module on — 2026-09-13)
          ═══════════════════════════════════════ */}
      {vaResidualOn && (
        <>
          <SectionDivider T={T} />
          <CollapsibleSection title="VA Residual Income" T={T} id="overview-varesidual" heroStyle={true} subtitle="Balance available for family support, against the VA table">
            <VaResidualContent {...props} />
          </CollapsibleSection>
        </>
      )}

      <SectionDivider T={T} />
      <CollapsibleSection title="Pre-Qualified?" T={T} id="overview-qualification" heroStyle={true}>
        <QualifyContent {...props} />
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 9: TAX SAVINGS — purchase only. On a refi they already own
          the home; the interest-deduction pitch isn't the story (Christo 7.24).
          ═══════════════════════════════════════ */}
      {!isRefi && (
        <>
          <SectionDivider T={T} />
          <CollapsibleSection title="Tax Savings" T={T} id="overview-tax" heroStyle={true}>
            <TaxContent {...props} />
          </CollapsibleSection>
        </>
      )}

      {/* ═══════════════════════════════════════
          SECTION 10: EQUITY (Amortization)
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Equity" T={T} id="overview-equity" heroStyle={true}>
        <AmortContent {...props} />
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
    </Suspense>
  );
}
