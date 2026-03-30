import React, { useState, useRef, useEffect, useCallback } from "react";
import OverviewStickyBar from "./OverviewStickyBar";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

/* ─── Local format helpers (mirrors MortgageBlueprint.jsx) ─── */
function fmt(v, compact) {
  if (v == null || !isFinite(v) || isNaN(v)) return "$0";
  if (compact && Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
  if (compact && Math.abs(v) >= 1e4) return "$" + (v / 1e3).toFixed(0) + "K";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}
function fmt2(v) { return v == null || !isFinite(v) || isNaN(v) ? "$0.00" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v); }
function pct(v, d = 1) { return ((v || 0) * 100).toFixed(d) + "%"; }

/* ─── Tiny sub-components (same API as MortgageBlueprint) ─── */
function OCard({ children, style: s, T, pad, onClick }) {
  return (
    <div onClick={onClick} style={{ background: T.card, borderRadius: 16, padding: pad || 18, boxShadow: T.cardShadow, marginBottom: 12, cursor: onClick ? "pointer" : "default", ...s }}>
      {children}
    </div>
  );
}

function OMRow({ label, value, sub, color, bold, T, tip }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 0", borderBottom: `1px solid ${T.separator}` }}>
      <span style={{ fontSize: bold ? 15 : 14, fontWeight: bold ? 600 : 400, color: bold ? T.text : T.textSecondary, fontFamily: FONT }}>
        {label}{sub && <span style={{ color: T.textTertiary, fontSize: 12, marginLeft: 6 }}>{sub}</span>}
      </span>
      <span style={{ fontSize: bold ? 16 : 15, fontWeight: 600, fontFamily: FONT, color: color || T.text, letterSpacing: "-0.02em" }}>{value}</span>
    </div>
  );
}

function OSec({ title, T, children, action, onAction }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 28, marginBottom: 12, paddingLeft: 4 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: FONT, color: T.text, letterSpacing: "-0.02em" }}>{title}</h2>
        {action && <button onClick={onAction} style={{ background: "none", border: "none", color: T.blue, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>{action}</button>}
      </div>
      {children}
    </>
  );
}

function SectionDivider({ T }) {
  return <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${T.blue}30, transparent)`, margin: "28px 0 8px" }} />;
}

function JumpLink({ label, T, onClick }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", cursor: "pointer", marginTop: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.blue, fontFamily: FONT }}>{label}</span>
      <span style={{ fontSize: 14, color: T.blue }}>→</span>
    </div>
  );
}

/* ─── Collapsible section wrapper ─── */
function CollapsibleSection({ title, T, defaultOpen = true, children, id, action, onAction }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, marginBottom: open ? 12 : 4, paddingLeft: 4 }}>
        <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <span style={{ fontSize: 14, color: T.textTertiary, transition: "transform 0.2s", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>▾</span>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: FONT, color: T.text, letterSpacing: "-0.02em" }}>{title}</h2>
        </div>
        {action && <button onClick={onAction} style={{ background: "none", border: "none", color: T.blue, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>{action}</button>}
      </div>
      {open && children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   OVERVIEW TAB — The full-page scrollable deal view
   ═══════════════════════════════════════════════════════════════ */
export default function OverviewTab({
  /* All state from MortgageBlueprint */
  salesPrice, setSalesPrice,
  downPct, setDownPct, downMode, setDownMode,
  rate, setRate,
  term, setTerm,
  loanType, setLoanType,
  propType, setPropType,
  loanPurpose, setLoanPurpose,
  propertyState, setPropertyState,
  city, setCity,
  propertyZip,
  annualIns, setAnnualIns,
  hoa, setHoa,
  includeEscrow, setIncludeEscrow,
  closingMonth, closingDay,
  isRefi,
  firstTimeBuyer,
  creditScore,
  married,
  taxState,
  darkMode,
  isDesktop,
  T,
  calc,
  paySegs,
  /* Qualification */
  allGood, someGood,
  purchPillarCount, refiPillarCount,
  dpOk, refiLtvCheck,
  refiPurpose,
  /* Debts */
  debts, debtFree,
  ownsProperties,
  /* Income */
  incomes,
  /* Assets */
  assets,
  /* Amortization */
  payExtra, setPayExtra,
  extraPayment, setExtraPayment,
  appreciationRate, setAppreciationRate,
  /* Sell */
  hasSellProperty,
  sellPrice, sellMortgagePayoff,
  /* Navigation */
  setTab,
  /* Render helpers from parent */
  PayRing, StopLight, AmortChart, Progress,
  Inp, Sel, SearchSelect, Note, InfoTip,
  /* Live Rates */
  liveRates, fetchRates, ratesLoading, ratesError, fredApiKey,
  /* Misc */
  loanTypes, propTypes, closingMonths,
  scenarioName,
  isBorrower,
  /* REO */
  reos,
}) {
  const qualRef = useRef(null);

  const scrollToQualification = useCallback(() => {
    const el = document.getElementById("overview-qualification");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div style={{ marginTop: 12, paddingBottom: 80 }}>
      {/* ── Sticky Bar (appears on scroll) ── */}
      <OverviewStickyBar
        salesPrice={salesPrice}
        calc={calc}
        creditScore={creditScore}
        downPct={downPct}
        loanType={loanType}
        isRefi={isRefi}
        refiPurpose={refiPurpose}
        firstTimeBuyer={firstTimeBuyer}
        isDesktop={isDesktop}
        darkMode={darkMode}
        T={T}
        allGood={allGood}
        someGood={someGood}
        purchPillarCount={purchPillarCount}
        refiPillarCount={refiPillarCount}
        dpOk={dpOk}
        refiLtvCheck={refiLtvCheck}
        onPillarStripClick={scrollToQualification}
      />

      {/* ═══════════════════════════════════════
          SECTION 1: LOAN STRUCTURE (EDITABLE)
          ═══════════════════════════════════════ */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 34, fontWeight: 700, fontFamily: FONT, color: T.blue, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          {isRefi ? "Refinance" : "Purchase"} Overview
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.textSecondary, marginTop: 2, fontFamily: FONT }}>
          {scenarioName || "Your complete loan picture"}
        </div>
      </div>

      {/* Qualification Badge — large, prominent */}
      <OCard T={T} style={{
        background: allGood ? `${T.green}12` : someGood ? `${T.orange}08` : `${T.card}`,
        border: `1px solid ${allGood ? T.green + "30" : someGood ? T.orange + "25" : T.separator}`,
        marginTop: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 12, height: 12, borderRadius: "50%",
              background: allGood ? T.green : someGood ? T.orange : T.textTertiary,
            }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: allGood ? T.green : someGood ? T.orange : T.text, fontFamily: FONT }}>
                {allGood ? "Pre-Qualified" : someGood ? "Almost There" : "Complete Your Info"}
              </div>
              <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
                {isRefi ? refiPillarCount : purchPillarCount} of {isRefi ? 3 : 5} pillars cleared
              </div>
            </div>
          </div>
          <div onClick={scrollToQualification} style={{ padding: "6px 12px", background: T.blue, borderRadius: 8, cursor: "pointer" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#fff", fontFamily: FONT }}>Details</span>
          </div>
        </div>
      </OCard>

      {/* Key Stats Bar */}
      <div style={{ display: "grid", gridTemplateColumns: isRefi ? "1fr 1fr 1fr" : "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
        {(isRefi ? [
          { l: "New Loan", v: fmt(calc.refiNewLoanAmt || calc.loan), c: T.blue },
          { l: "New LTV", v: pct(calc.refiNewLTV || calc.ltv, 0), c: T.orange },
          { l: "Refi Costs", v: fmt(calc.totalClosingCosts), c: T.green },
        ] : [
          { l: "Loan Amount", v: fmt(calc.loan), c: T.blue },
          { l: "LTV", v: pct(calc.ltv, 0), c: T.orange },
          { l: "Cash to Close", v: fmt(calc.cashToClose), c: T.green },
        ]).map((m, i) => (
          <OCard key={i} T={T} pad={14}>
            <div style={{ fontSize: 10, color: T.textTertiary, fontWeight: 500, marginBottom: 4 }}>{m.l}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: m.c, fontFamily: FONT, letterSpacing: "-0.03em" }}>{m.v}</div>
          </OCard>
        ))}
      </div>

      {/* Loan Inputs */}
      <OCard T={T} style={{ marginTop: 4 }}>
        {/* Price + Down Payment */}
        <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } : {}}>
          <Inp label={isRefi ? "Home Value" : "Purchase Price"} value={salesPrice} onChange={setSalesPrice} max={100000000} req />
          {!isRefi && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 500, color: T.textSecondary, fontFamily: FONT }}>
                  Down Payment<span style={{ color: T.red, marginLeft: 3, fontSize: 13, fontWeight: 700 }}>*</span>
                </div>
                <div style={{ display: "flex", background: T.inputBg, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.inputBorder}` }}>
                  <button onClick={() => setDownMode("pct")} style={{ padding: "3px 8px", fontSize: 10, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: FONT, background: downMode === "pct" ? T.blue : "transparent", color: downMode === "pct" ? "#fff" : T.textTertiary }}>%</button>
                  <button onClick={() => setDownMode("dollar")} style={{ padding: "3px 8px", fontSize: 10, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: FONT, background: downMode === "dollar" ? T.blue : "transparent", color: downMode === "dollar" ? "#fff" : T.textTertiary }}>$</button>
                </div>
              </div>
              {downMode === "pct" ? (
                <Inp value={downPct} onChange={setDownPct} prefix="" suffix="%" step={0.01} max={100} req />
              ) : (
                <Inp value={Math.round(salesPrice * downPct / 100)} onChange={v => { const p = salesPrice > 0 ? (v / salesPrice) * 100 : 0; setDownPct(Math.round(p * 100) / 100); }} prefix="$" suffix="" step={1000} max={salesPrice} req />
              )}
              <div style={{ fontSize: 11, color: T.textTertiary, marginTop: -8, marginBottom: 4 }}>
                {downMode === "pct" ? `${fmt(Math.round(salesPrice * downPct / 100))} down` : `${downPct.toFixed(1)}% of ${fmt(salesPrice)}`}
              </div>
            </div>
          )}
        </div>
        {!isRefi && calc.dpWarning === "fail" && <Note color={T.red}>{loanType} requires minimum {calc.minDPpct}% down. Current: {downPct}%</Note>}

        {/* Rate + Term + Type */}
        <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 8 } : { marginTop: 8 }}>
          <Inp label="Rate" value={rate} onChange={setRate} prefix="" suffix="%" step={0.001} max={30} sm req />
          <Sel label="Term" value={term} onChange={v => setTerm(parseInt(v))} options={[{value:30,label:"30 Year"},{value:25,label:"25 Year"},{value:20,label:"20 Year"},{value:15,label:"15 Year"},{value:10,label:"10 Year"}]} sm req />
          <Sel label="Loan Type" value={loanType} onChange={setLoanType} options={["Conventional","FHA","VA","Jumbo","USDA"]} sm req />
        </div>

        {/* Property details */}
        <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 } : { marginTop: 4 }}>
          <Inp label="Insurance" value={annualIns} onChange={setAnnualIns} suffix="/yr" max={50000} sm />
          <Inp label="HOA" value={hoa} onChange={setHoa} suffix="/mo" max={10000} sm />
        </div>
      </OCard>

      {/* ═══════════════════════════════════════
          SECTION 2: MONTHLY PAYMENT BREAKDOWN
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Monthly Payment" T={T} id="overview-payment">
        <OCard T={T}>
          <div style={{ display: "flex", flexDirection: isDesktop ? "row" : "column", alignItems: "center", gap: isDesktop ? 24 : 12 }}>
            {/* PayRing */}
            <div style={{ flexShrink: 0 }}>
              <PayRing segments={paySegs} total={calc.displayPayment} size={isDesktop ? 240 : 180} />
            </div>
            {/* Line items */}
            <div style={{ flex: 1, width: "100%" }}>
              {paySegs.filter(s => s.v > 0).map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.separator}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.c }} />
                    <span style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT }}>{s.l}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, fontFamily: FONT, color: T.text }}>{fmt(s.v)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", marginTop: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: FONT }}>Total Payment</span>
                <span style={{ fontSize: 17, fontWeight: 700, color: T.blue, fontFamily: FONT, letterSpacing: "-0.02em" }}>{fmt(calc.displayPayment)}/mo</span>
              </div>
            </div>
          </div>
        </OCard>

        {/* Closing date info */}
        {closingMonth > 0 && (() => {
          const mos = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          const skipMo = mos[closingMonth % 12];
          const firstMo = mos[(closingMonth + 1) % 12];
          return (
            <div style={{ background: `${T.blue}10`, borderRadius: 10, padding: "10px 14px", marginTop: -4 }}>
              <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6 }}>
                <span style={{ fontWeight: 600, color: T.blue }}>Close {mos[closingMonth-1]} {closingDay}</span> → {calc.autoPrepaidDays} days prepaid interest · No payment in <strong>{skipMo}</strong> · First payment <strong>{firstMo} 1st</strong>
              </div>
            </div>
          );
        })()}
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 3: CASH TO CLOSE SUMMARY
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title={isRefi ? "Estimated Refi Costs" : "Cash to Close"} T={T} id="overview-costs" action="Full Breakdown →" onAction={() => setTab("costs")}>
        {/* Summary cards */}
        {!isRefi && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <OCard T={T} pad={12}>
              <div style={{ fontSize: 10, color: T.textTertiary }}>Down Payment</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.dp)}</div>
              <div style={{ fontSize: 10, color: T.textTertiary }}>{downPct}%</div>
            </OCard>
            <OCard T={T} pad={12}>
              <div style={{ fontSize: 10, color: T.textTertiary }}>Closing Costs</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: T.blue }}>{fmt(calc.totalClosingCosts)}</div>
            </OCard>
          </div>
        )}
        {!isRefi && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <OCard T={T} pad={12}>
              <div style={{ fontSize: 10, color: T.textTertiary }}>Prepaids & Escrow</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: T.orange }}>{fmt(calc.totalPrepaidExp)}</div>
            </OCard>
            <OCard T={T} pad={12}>
              <div style={{ fontSize: 10, color: T.textTertiary }}>Credits</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: T.green }}>-{fmt(calc.totalCredits)}</div>
            </OCard>
          </div>
        )}

        {/* Total */}
        <OCard T={T} style={{ background: `${T.green}10`, border: `1px solid ${T.green}25` }}>
          <OMRow T={T} label={isRefi ? "Total Refi Costs" : "Down Payment"} value={isRefi ? "" : fmt(calc.dp)} />
          {!isRefi && <OMRow T={T} label="Closing Costs" value={fmt(calc.totalClosingCosts)} />}
          <OMRow T={T} label={isRefi ? "Closing + Prepaids" : "Prepaids & Escrow"} value={isRefi ? fmt(calc.totalClosingCosts + calc.totalPrepaidExp) : fmt(calc.totalPrepaidExp)} />
          {!isRefi && calc.totalCredits > 0 && <OMRow T={T} label="Credits" value={`-${fmt(calc.totalCredits)}`} color={T.green} />}
          <div style={{ borderTop: `2px solid ${T.green}40`, marginTop: 8, paddingTop: 8 }}>
            <OMRow T={T} label={isRefi ? "TOTAL REFI COSTS" : "ESTIMATED CASH TO CLOSE"} value={fmt(isRefi ? calc.totalClosingCosts + calc.totalPrepaidExp - calc.totalCredits : calc.cashToClose)} color={T.green} bold />
          </div>
        </OCard>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 4: QUALIFICATION (5 PILLARS)
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <div id="overview-qualification">
        <CollapsibleSection title="Qualification" T={T} action="Full Details →" onAction={() => setTab("qualify")}>
          <StopLight
            onPillarClick={(pillarLabel) => {
              if (pillarLabel === "FICO" || pillarLabel === "Credit") setTab("setup");
              else if (pillarLabel === "DTI") setTab("income");
              else if (pillarLabel === "Cash" || pillarLabel === "Reserves") setTab("assets");
              else if (pillarLabel === "Down") setTab("calc");
            }}
            checks={isRefi ? [
              { label: "FICO", ok: calc.ficoCheck === "Good!" ? true : calc.ficoCheck === "—" ? null : false, sub: creditScore > 0 ? `${creditScore} / ${calc.ficoMin}+` : "Enter score", icon: "bar-chart" },
              { label: "DTI", ok: calc.dtiCheck === "Good!" ? true : calc.dtiCheck === "—" ? null : false, sub: calc.qualifyingIncome > 0 ? `${pct(calc.yourDTI, 1)} / ${pct(calc.maxDTI, 0)}` : "Add income", icon: "scale" },
              { label: "LTV", ok: refiLtvCheck === "Good!" ? true : refiLtvCheck === "—" ? null : false, sub: calc.refiNewLTV > 0 ? `${pct(calc.refiNewLTV, 0)} / ${refiPurpose === "Cash-Out" ? "80%" : "95%"}` : "Enter loan", icon: "home" },
            ] : [
              { label: "FICO", ok: calc.ficoCheck === "Good!" ? true : calc.ficoCheck === "—" ? null : false, sub: creditScore > 0 ? `${creditScore} / ${calc.ficoMin}+` : "Enter score", icon: "bar-chart" },
              { label: "Down", ok: calc.dpWarning === null ? true : false, sub: `${downPct}% / ${calc.minDPpct}%+`, icon: "home" },
              { label: "DTI", ok: calc.dtiCheck === "Good!" ? true : calc.dtiCheck === "—" ? null : false, sub: calc.qualifyingIncome > 0 ? `${pct(calc.yourDTI, 1)} / ${pct(calc.maxDTI, 0)}` : "Add income", icon: "scale" },
              { label: "Cash", ok: calc.cashCheck === "Good!" ? true : calc.cashCheck === "—" ? null : false, sub: calc.totalForClosing > 0 ? `${fmt(calc.totalForClosing)}` : "Add assets", icon: "dollar" },
              { label: "Reserves", ok: calc.resCheck === "Good!" ? true : calc.resCheck === "—" ? null : false, sub: calc.totalReserves > 0 ? `${fmt(calc.totalReserves)}` : "Add assets", icon: "landmark" },
            ]}
          />

          {/* Progress bar */}
          <OCard T={T} pad={14}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.textTertiary }}>Approval Progress</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: allGood ? T.green : someGood ? T.orange : T.textTertiary, fontFamily: FONT }}>
                {isRefi ? refiPillarCount : purchPillarCount} / {isRefi ? 3 : 5}
              </span>
            </div>
            <div style={{ height: 12, background: T.ringTrack, borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${(isRefi ? refiPillarCount / 3 : purchPillarCount / 5) * 100}%`,
                background: allGood ? T.green : someGood ? T.orange : T.ringTrack,
                borderRadius: 99,
                transition: "all 0.6s ease",
              }} />
            </div>
          </OCard>

          {/* Pre-Approved CTA */}
          {allGood && !isRefi && (
            <OCard T={T} style={{ background: `${T.green}15`, textAlign: "center", padding: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.green, fontFamily: FONT }}>PRE-QUALIFIED</div>
              <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 4 }}>All 5 pillars cleared — based on the information you provided.</div>
              <button onClick={() => window.open("https://2179191.my1003app.com/952015/register", "_blank")} style={{ marginTop: 14, width: "100%", padding: "14px 20px", background: "linear-gradient(135deg, #4a90d9, #3a7dc4)", border: "none", borderRadius: 14, cursor: "pointer", boxShadow: "0 4px 16px rgba(74,144,217,0.35)" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: FONT }}>Get Pre-Approved →</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Complete my application to lock in your approval</div>
              </button>
            </OCard>
          )}

          {/* DTI Summary (if income entered) */}
          {calc.qualifyingIncome > 0 && (
            <OCard T={T} pad={14}>
              <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 6 }}>DTI: {pct(calc.yourDTI, 1)} / {pct(calc.maxDTI, 0)}</div>
              <div style={{ height: 10, background: T.ringTrack, borderRadius: 99, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${Math.min(100, (calc.yourDTI / calc.maxDTI) * 100)}%`, background: calc.yourDTI <= calc.maxDTI ? T.green : T.red, borderRadius: 99 }} />
              </div>
              <div style={{ fontSize: 11, color: T.textTertiary }}>
                Housing: {fmt(calc.totalPayment)}/mo · Income: {fmt(calc.qualifyingIncome)}/mo · Min needed: {fmt(calc.totalPayment / calc.maxDTI)}/mo
              </div>
            </OCard>
          )}
        </CollapsibleSection>
      </div>

      {/* ═══════════════════════════════════════
          SECTION 5: INCOME SUMMARY
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Income" T={T} action="Edit Income →" onAction={() => setTab("income")}>
        <OCard T={T}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: T.textTertiary }}>Monthly Qualifying Income</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: FONT, color: T.green, letterSpacing: "-0.03em" }}>
                {fmt(calc.qualifyingIncome || calc.monthlyIncome)}
              </div>
            </div>
            <div style={{ fontSize: 13, color: T.textTertiary, fontFamily: FONT }}>
              {fmt((calc.qualifyingIncome || calc.monthlyIncome) * 12)}/yr
            </div>
          </div>
          {incomes.length > 0 ? (
            incomes.map((inc, i) => (
              <div key={inc.id || i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${T.separator}` }}>
                <div>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{inc.source || inc.payType || "Income"}</div>
                  <div style={{ fontSize: 11, color: T.textTertiary }}>{inc.payType} · Borrower {inc.borrower || 1}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: FONT, color: T.text }}>
                  {fmt(inc.monthlyQualifying || inc.amount || 0)}/mo
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: "center", padding: 16, color: T.textTertiary, fontSize: 13 }}>
              No income entered — <span onClick={() => setTab("income")} style={{ color: T.blue, cursor: "pointer", fontWeight: 600 }}>add income</span>
            </div>
          )}
        </OCard>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 6: DEBTS (PARTIALLY EDITABLE)
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Debts & Liabilities" T={T} action="Edit Debts →" onAction={() => setTab("debts")}>
        <OCard T={T}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: T.textTertiary }}>Monthly Debts</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: FONT, color: debtFree ? T.green : T.red, letterSpacing: "-0.03em" }}>
                {debtFree ? "$0" : fmt(calc.totalMonthlyDebts)}
              </div>
            </div>
            {debtFree && <div style={{ fontSize: 12, fontWeight: 600, color: T.green }}>Debt free!</div>}
          </div>

          {!debtFree && debts.length > 0 && debts.map((d, i) => (
            <div key={d.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: `1px solid ${T.separator}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{d.name || d.type || "Debt"}</div>
                <div style={{ fontSize: 11, color: T.textTertiary }}>{d.type}{d.balance > 0 ? ` · Bal: ${fmt(d.balance)}` : ""}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, fontFamily: FONT, color: (d.payoff === "Yes - at Escrow" || d.payoff === "Yes - POC") ? T.green : T.text, textDecoration: (d.payoff === "Yes - at Escrow" || d.payoff === "Yes - POC") ? "line-through" : "none" }}>
                  {fmt(d.monthly)}/mo
                </span>
                {(d.payoff === "Yes - at Escrow" || d.payoff === "Yes - POC") && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: T.green, background: `${T.green}15`, padding: "2px 6px", borderRadius: 4 }}>PAYOFF</span>
                )}
              </div>
            </div>
          ))}
          {!debtFree && debts.length === 0 && (
            <div style={{ textAlign: "center", padding: 16, color: T.textTertiary, fontSize: 13 }}>
              No debts entered — <span onClick={() => setTab("debts")} style={{ color: T.blue, cursor: "pointer", fontWeight: 600 }}>add debts</span>
            </div>
          )}
        </OCard>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 7: TAX SAVINGS
          ═══════════════════════════════════════ */}
      {loanPurpose !== "Purchase Investment" && loanPurpose !== "Purchase 2nd Home" && (
        <>
          <SectionDivider T={T} />
          <CollapsibleSection title="Tax Savings" T={T} action="Full Analysis →" onAction={() => setTab("tax")}>
            <OCard T={T}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <div style={{ fontSize: 11, color: T.textTertiary }}>Annual Tax Savings</div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: FONT, color: T.purple, letterSpacing: "-0.03em" }}>{fmt(calc.totalTaxSavings)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: T.textTertiary }}>After-Tax Payment</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT }}>{fmt(calc.afterTaxPayment)}/mo</div>
                </div>
              </div>
            </OCard>
            {calc.yearlyInc > 0 && (
              <OCard T={T} pad={14}>
                {/* Itemized vs Standard */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, fontSize: 12, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: T.textTertiary, marginBottom: 2 }}>Itemized Deductions</div>
                    <div style={{ fontWeight: 700, fontFamily: FONT }}>{fmt(calc.fedItemized)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: T.textTertiary, marginBottom: 2 }}>Standard Deduction</div>
                    <div style={{ fontWeight: 700, fontFamily: FONT }}>{fmt(calc.fedStdDeduction)}</div>
                  </div>
                </div>
                {calc.fedItemizes && (
                  <div style={{ background: `${T.green}08`, borderRadius: 10, padding: "8px 12px", marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.green }}>Federal Benefit: {fmt(calc.fedDelta)} above standard deduction</div>
                    <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>Saves {fmt(calc.fedSavings)} in federal taxes + {fmt(calc.stateSavings || 0)} state</div>
                  </div>
                )}
                {!calc.fedItemizes && (
                  <div style={{ background: `${T.orange}08`, borderRadius: 10, padding: "8px 12px", marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.orange }}>Standard deduction is higher — no additional federal tax benefit from homeownership yet</div>
                  </div>
                )}
              </OCard>
            )}
            {calc.yearlyInc <= 0 && (
              <div onClick={() => setTab("income")} style={{ cursor: "pointer" }}>
                <OCard T={T} style={{ background: `${T.orange}10`, border: `1px solid ${T.orange}30` }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.orange }}>Add income to see tax savings</div>
                  <div style={{ fontSize: 12, color: T.textSecondary }}>Tap to go to the Income tab</div>
                </OCard>
              </div>
            )}
          </CollapsibleSection>
        </>
      )}

      {/* ═══════════════════════════════════════
          SECTION 8: AMORTIZATION (EDITABLE)
          ═══════════════════════════════════════ */}
      <SectionDivider T={T} />
      <CollapsibleSection title="Amortization" T={T} action="Full Schedule →" onAction={() => setTab("amort")}>
        {/* Hero stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <OCard T={T} pad={14}>
            <div style={{ fontSize: 11, color: T.textTertiary }}>Total Interest</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: FONT, color: T.blue, letterSpacing: "-0.03em" }}>{fmt(calc.totalIntWithExtra)}</div>
            {calc.intSaved > 100 && <div style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>Save {fmt(calc.intSaved)}</div>}
          </OCard>
          <OCard T={T} pad={14}>
            <div style={{ fontSize: 11, color: T.textTertiary }}>Payoff</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: FONT, letterSpacing: "-0.03em" }}>{calc.amortSchedule?.length || (term * 12)} <span style={{ fontSize: 13, color: T.textTertiary }}>mo</span></div>
            {calc.monthsSaved > 0 && <div style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>{calc.monthsSaved} months saved</div>}
          </OCard>
        </div>

        {/* Extra Payment toggle + input */}
        <OCard T={T} pad={14}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: payExtra ? 12 : 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Extra Monthly Payment</span>
            <button onClick={() => setPayExtra(!payExtra)} style={{ width: 48, height: 28, borderRadius: 14, background: payExtra ? T.green : T.ringTrack, border: "none", cursor: "pointer", position: "relative", transition: "background 0.3s" }}>
              <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, left: payExtra ? 23 : 3, transition: "left 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </button>
          </div>
          {payExtra && (
            <>
              <Inp label="Monthly Extra Payment" value={extraPayment} onChange={setExtraPayment} />
              {calc.intSaved > 100 && (
                <div style={{ background: `${T.green}10`, borderRadius: 10, padding: "10px 14px", marginTop: -4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.green }}>Interest Saved: {fmt(calc.intSaved)} · Time Saved: {calc.monthsSaved} months</div>
                </div>
              )}
            </>
          )}
        </OCard>

        {/* AmortChart */}
        <OCard T={T}>
          <AmortChart />
        </OCard>

        {/* Equity Growth */}
        {salesPrice > 0 && calc.yearlyData && calc.yearlyData.length > 0 && (() => {
          const appRate = (appreciationRate || 3) / 100;
          const yr5 = calc.yearlyData.find(d => d.year === 5);
          const yr10 = calc.yearlyData.find(d => d.year === 10);
          const last = calc.yearlyData[calc.yearlyData.length - 1];
          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[yr5 && { label: "Year 5", eq: salesPrice * Math.pow(1 + appRate, 5) - yr5.bal },
                yr10 && { label: "Year 10", eq: salesPrice * Math.pow(1 + appRate, 10) - yr10.bal },
                last && { label: `Year ${last.year}`, eq: salesPrice * Math.pow(1 + appRate, last.year) - last.bal }
              ].filter(Boolean).map((d, i) => (
                <OCard key={i} T={T} pad={12}>
                  <div style={{ fontSize: 10, color: T.textTertiary }}>{d.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.green, fontFamily: FONT }}>{fmt(d.eq, true)}</div>
                  <div style={{ fontSize: 9, color: T.textTertiary }}>equity</div>
                </OCard>
              ))}
            </div>
          );
        })()}

        {/* Yearly summary table (compact) */}
        {calc.yearlyData && calc.yearlyData.length > 0 && (
          <OCard T={T} pad={12}>
            <div style={{ display: "grid", gridTemplateColumns: "0.7fr 1fr 1fr 1.2fr", gap: 0, fontSize: 11, color: T.textTertiary, fontWeight: 600, paddingBottom: 8, borderBottom: `1px solid ${T.separator}` }}>
              <span>Year</span><span style={{textAlign:"right"}}>Interest</span><span style={{textAlign:"right"}}>Principal</span><span style={{textAlign:"right"}}>Balance</span>
            </div>
            {calc.yearlyData.slice(0, 10).map((d, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "0.7fr 1fr 1fr 1.2fr", gap: 0, fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${T.separator}`, fontFamily: FONT }}>
                <span style={{ color: T.textSecondary }}>{d.year}</span>
                <span style={{ textAlign: "right", color: T.blue }}>{fmt(d.int)}</span>
                <span style={{ textAlign: "right", color: T.green }}>{fmt(d.prin)}</span>
                <span style={{ textAlign: "right", color: T.textSecondary }}>{fmt(d.bal)}</span>
              </div>
            ))}
            {calc.yearlyData.length > 10 && (
              <div onClick={() => setTab("amort")} style={{ textAlign: "center", padding: "10px 0", cursor: "pointer" }}>
                <span style={{ fontSize: 12, color: T.blue, fontWeight: 600 }}>View all {calc.yearlyData.length} years →</span>
              </div>
            )}
          </OCard>
        )}
      </CollapsibleSection>

      {/* ═══════════════════════════════════════
          SECTION 9: NET PROCEEDS (CONDITIONAL)
          ═══════════════════════════════════════ */}
      {hasSellProperty && sellPrice > 0 && (
        <>
          <SectionDivider T={T} />
          <CollapsibleSection title="Net Proceeds of Sale" T={T} action="Edit Sale →" onAction={() => setTab("sell")}>
            <OCard T={T} style={{ background: calc.sellNetAfterTax >= 0 ? `${T.green}08` : `${T.red}08` }}>
              <OMRow T={T} label="Sale Price" value={fmt(sellPrice)} bold />
              <OMRow T={T} label="Mortgage Payoff" value={`-${fmt(sellMortgagePayoff)}`} color={T.red} />
              <OMRow T={T} label="Total Costs" value={`-${fmt(calc.sellTotalCosts)}`} color={T.red} />
              <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
                <OMRow T={T} label="Net After Tax" value={fmt(calc.sellNetAfterTax)} color={calc.sellNetAfterTax >= 0 ? T.green : T.red} bold />
              </div>
            </OCard>
          </CollapsibleSection>
        </>
      )}

      {/* ═══════════════════════════════════════
          BOTTOM CTA
          ═══════════════════════════════════════ */}
      <div style={{ marginTop: 32, textAlign: "center" }}>
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
      </div>
    </div>
  );
}
