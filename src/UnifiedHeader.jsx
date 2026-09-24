import { FONT, MONO } from "./lib/fonts.js";
import React, { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import { WEB_ORIGIN } from "./apiBase";


/**
 * UnifiedHeader
 *
 * Persistent top bar for ALL Blueprint tabs.
 *
 * Desktop: 2-row layout
 *   Row 1 — Brand + qualification badge + pillar dots + controls
 *   Row 2 — Stats dashboard (Price, Down, Cash Close, Payment, DTI, Qual badge)
 *
 * Mobile: unchanged (compact single row + stats strip below)
 */
export default function UnifiedHeader({
  /* Financials */
  salesPrice, calc, creditScore, downPct, hoa, includeEscrow,
  subjectRentalIncome, otherIncome, otherIncome2,
  loanType, isRefi, refiPurpose, firstTimeBuyer,
  /* Qualification */
  allGood, someGood,
  purchPillarCount, refiPillarCount,
  dpOk, refiLtvCheck,
  /* Scenarios */
  scenarioName, scenarioList, switchScenario,
  saving, loaded, cloudSyncStatus, sync,
  /* Whose blueprint this is */
  borrowerName, loanNumber,
  /* Controls */
  darkMode, themeMode, cycleTheme,
  privacyMode, setPrivacyMode,
  /* Layout */
  isDesktop, sidebarCollapsed, T,
  /* Navigation */
  setTab, onCompare, onJumpToSection,
  /* Auth */
  isCloud, isBorrower, auth,
  /* LO quick action — Arive-style blue "+" next to the account pill */
  onCreateNewBlueprint,
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
  mobileMenuOpen = false,
  /* Active tab — used for breadcrumb after the wordmark */
  tab, tabLabel,
  /* Mobile tab bar */
  mobileTabBar,
  /* Mobile scenario dropdown (2026-09-06) — rename/duplicate/remove/create */
  scenarioActions = null,
  canEditScenarios = false,
}) {
  // ── Format helpers ──
  const fmt = (v) => {
    if (v == null || !isFinite(v) || isNaN(v)) return "$0";
    if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
    if (Math.abs(v) >= 1e4) return "$" + (v / 1e3).toFixed(0) + "K";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  };
  const pct = (v, d = 1) => ((v || 0) * 100).toFixed(d) + "%";

  // "Whose file am I in?" — for a signed-in LO with a client open, the active
  // client RECORD is the source of truth. The per-scenario free-text
  // borrowerName can drift between scenarios (e.g. one scenario still holds an
  // old client's name), which made the breadcrumb show the wrong person until a
  // scenario switch reloaded it. Trust activeBorrower whenever it's present so
  // the breadcrumb always matches the sidebar client picker. (2026-07-08)
  const clientLabel = (!isBorrower && activeBorrower && (activeBorrower.name || "").trim())
    ? activeBorrower.name.trim()
    : borrowerName;

  // ── Clickable stat dropdowns (Arive-style summary popovers) ──
  const [statPop, setStatPop] = useState(null); // { key, x, y }
  const [shareCopied, setShareCopied] = useState(false);
  const statContent = (key) => {
    if (key === "price") {
      const dp = Math.max(0, salesPrice - (calc.baseLoan || 0));
      return { title: "Loan Info", section: "overview-payment", rows: [
        [isRefi ? "Home Value" : "Purchase Price", fmt(salesPrice)],
        ["Loan Amount", fmt(calc.loan)],
        ...(!isRefi ? [["Down Payment", `${fmt(dp)} (${(downPct || 0).toFixed(0)}%)`]] : []),
        ...(calc.fhaUp > 0 ? [["Financed UFMIP", fmt(calc.fhaUp)]] : []),
        ...(calc.vaFundingFee > 0 ? [["Financed VA Fee", fmt(calc.vaFundingFee)]] : []),
        ["__t", "LTV", pct(calc.ltv, 1)],
      ] };
    }
    if (key === "down") {
      const dp = salesPrice * (downPct || 0) / 100;
      return { title: "Down Payment", section: "overview-payment", rows: [
        ["Down %", `${(downPct || 0).toFixed(0)}%`],
        ["Down Amount", fmt(dp)],
        ["Loan Amount", fmt(calc.loan)],
        ["__t", "LTV", pct(calc.ltv, 1)],
      ] };
    }
    if (key === "cashclose") {
      if (isRefi) return { title: "Refi Costs", section: "overview-costs", rows: [
        ["Closing Costs", fmt(calc.totalClosingCosts)],
        ["Prepaids & Escrow", fmt(calc.totalPrepaidExp)],
        ["__t", "Total", fmt((calc.totalClosingCosts || 0) + (calc.totalPrepaidExp || 0))],
      ] };
      const dp = Math.max(0, salesPrice - (calc.baseLoan || 0));
      return { title: "Funds to Close", section: "overview-costs", rows: [
        ["Down Payment", fmt(dp)],
        ["Closing Costs", fmt(calc.totalClosingCosts)],
        ["Prepaids & Escrow", fmt(calc.totalPrepaidExp)],
        ["__t", "Cash to Close", fmt(calc.cashToClose)],
      ] };
    }
    if (key === "savings") {
      return { title: "Monthly Savings", section: "overview-payment", rows: [
        // Comparison basis: bills-priced current total (refiCurCmpTotalPmt),
        // so Current − New lands exactly on the Savings line below.
        ["Current Payment", fmt(calc.refiCurCmpTotalPmt)],
        ...((calc.refiSecondPmtSaved || 0) > 0 ? [["2nd Lien Payment (retired)", fmt(calc.refiSecondPmtSaved)]] : []),
        ...((calc.refiThirdPmtSaved || 0) > 0 ? [["3rd Lien Payment (retired)", fmt(calc.refiThirdPmtSaved)]] : []),
        ...((calc.refiDebtPmtSaved || 0) > 0 ? [["Other Debts (paid off)", fmt(calc.refiDebtPmtSaved)]] : []),
        ["New Payment", fmt(calc.refiNewTotalPmt)],
        ["__t", "Savings", `${fmt(Math.round(calc.refiMonthlyTotalSavings || 0))}/mo`],
        ...((calc.refiBreakevenMonths || 0) > 0 ? [["Breakeven", `${calc.refiBreakevenMonths} months`]] : []),
      ] };
    }
    if (key === "netcash") {
      return { title: "Net Cash in Hand", section: "overview-costs", rows: [
        ["New Loan", fmt(calc.refiNetNewLoan)],
        ["Closing Costs", "−" + fmt(calc.refiNetClosingCosts)],
        ["Prepaids & Escrow", "−" + fmt(calc.refiNetPrepaids)],
        ["Current Loan Payoff", "−" + fmt(calc.refiPayoffAmount)],
        ...((calc.refiSecondPayoffAmt || 0) > 0 ? [["2nd Lien Payoff", "−" + fmt(calc.refiSecondPayoffAmt)]] : []),
        ...((calc.refiThirdPayoffAmt || 0) > 0 ? [["3rd Lien Payoff", "−" + fmt(calc.refiThirdPayoffAmt)]] : []),
        ...((calc.refiDebtPayoffTotal || 0) > 0 ? [["Debt Payoffs", "−" + fmt(calc.refiDebtPayoffTotal)]] : []),
        ...((calc.refiSkipPmtAmt || 0) > 0 ? [["Skipped Payments", "+" + fmt(calc.refiSkipPmtAmt)]] : []),
        ...((calc.refiEscrowRefund || 0) > 0 ? [["Escrow Refund", "+" + fmt(calc.refiEscrowRefund)]] : []),
        ["__t", "Net Cash", fmt(Math.round(calc.refiNetCashInHand || 0))],
      ] };
    }
    if (key === "payment") {
      const rows = [["Principal & Interest", fmt(calc.pi)]];
      if (includeEscrow) { rows.push(["Property Tax", fmt(calc.monthlyTax)]); rows.push(["Insurance", fmt(calc.ins)]); }
      if ((calc.monthlyMI || 0) > 0) rows.push([loanType === "FHA" ? "MIP" : "PMI", fmt(calc.monthlyMI)]);
      if ((hoa || 0) > 0) rows.push(["HOA", fmt(hoa)]);
      rows.push(["__t", "Total Payment", fmt(calc.displayPayment)]);
      return { title: "Monthly Payment", section: "overview-payment", rows };
    }
    if (key === "dti") {
      const income = calc.qualifyingIncome || 0;
      const housing = calc.housingPayment || calc.displayPayment || 0;
      const otherDebt = calc.monthlyDebts || calc.totalMonthlyDebts || 0;
      const front = income > 0 ? housing / income : 0;
      return { title: "DTI Ratio", section: "overview-qualification", rows: [
        ["Monthly Income", fmt(income)],
        ["Housing Payment", fmt(housing)],
        ["Other Debts", fmt(otherDebt)],
        ["Front-End DTI", pct(front, 1)],
        ["__t", "Back-End DTI", `${pct(calc.yourDTI, 1)} / ${pct(calc.maxDTI, 0)} max`],
      ] };
    }
    if (key === "qualbadge") {
      const st = (chk) => chk === "Good!" ? true : chk === "—" ? null : false;
      const pillars = [
        { ok: st(calc.ficoCheck), label: "FICO", value: (creditScore > 0 ? `${creditScore} / ${calc.ficoMin || 620}+` : "—"), note: "Middle credit score vs the program minimum." },
        { ok: (dpOk ? true : (calc.dpWarning == null ? null : false)), label: "Down", value: `${(downPct || 0).toFixed(0)}% / ${calc.minDPpct || 0}%+`, note: "Down payment vs the minimum required." },
        { ok: st(calc.dtiCheck), label: "DTI", value: (calc.qualifyingIncome > 0 ? `${pct(calc.yourDTI, 1)} / ${pct(calc.maxDTI, 0)}` : "—"), note: "Monthly debts ÷ income vs the max allowed." },
        { ok: st(calc.cashCheck), label: "Cash", value: (calc.totalForClosing > 0 ? fmt(calc.totalForClosing) : "—"), note: "Cash on hand vs cash needed to close." },
        { ok: st(calc.resCheck), label: "Reserves", value: (calc.totalReserves > 0 ? fmt(calc.totalReserves) : "—"), note: "Post-closing reserves vs required." },
      ];
      return { title: "Qualification", section: "overview-qualification", pillars };
    }
    return null;
  };

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

  // Qualification status pill — moved out of Row 1 into the stats row (far
  // right, after DTI) per Christo 2026-07-07. Single state-driven badge
  // (Pre-Qualified / Almost There / N/5 / Action Needed); taps to Qualify.
  const qualBadge = (
    <div
      onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setStatPop(pv => pv && pv.key === "qualbadge" ? null : { key: "qualbadge", x: r.left + r.width / 2, y: r.bottom }); }}
      title="View qualification"
      style={{
        display: "flex", alignItems: "center", gap: 5,
        background: `${badgeColor}18`, borderRadius: 9999,
        padding: isDesktop ? "5px 12px" : "4px 9px",
        cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
      }}
    >
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: badgeColor, flexShrink: 0 }} />
      <span style={{ fontSize: isDesktop ? 12 : 10, fontWeight: 700, color: badgeColor, fontFamily: FONT }}>{badgeLabel}</span>
    </div>
  );

  // ── Stat cell (responsive sizing) ──
  // Under 380px the five uppercase labels plus their carets overflow the
  // strip, so step the label down and drop the caret glyph.
  const isNarrow = !isDesktop && typeof window !== "undefined" && window.innerWidth < 380;
  // Five stats + the badge on a phone (refi, or purchase once DTI shows) ran
  // the labels into each other ("DOWN CASH CLOSEPAYMENT", Christo
  // 2026-09-23): crowded mode uses the short label, tighter tracking and no
  // caret. The popover still carries the full name.
  const crowded = !isDesktop && (isRefi || calc.qualifyingIncome > 0);
  const Stat = ({ label, short, value, color, statKey }) => (
    <div
      onClick={statKey ? (e) => { const r = e.currentTarget.getBoundingClientRect(); setStatPop(pv => pv && pv.key === statKey ? null : { key: statKey, x: r.left + r.width / 2, y: r.bottom }); } : undefined}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 0, flex: 1, cursor: statKey ? "pointer" : "default", borderRadius: 8, padding: "2px 0", background: (statPop && statPop.key === statKey) ? T.pillBg : "transparent", transition: "background 0.15s" }}
    >
      <div style={{
        fontSize: isDesktop ? 10 : isNarrow ? "0.55rem" : 9, color: T.textTertiary, fontWeight: 600,
        letterSpacing: crowded ? 0.6 : 1.2, fontFamily: FONT, textTransform: "uppercase",
        marginBottom: isDesktop ? 3 : 2, whiteSpace: "nowrap", textAlign: "center",
        display: "flex", alignItems: "center", gap: 3,
      }}>{crowded && short ? short : label}{statKey && !isNarrow && !crowded && <span style={{ fontSize: 8, opacity: 0.65 }}>▾</span>}</div>
      <div style={{
        fontSize: isDesktop ? 17 : 13, fontWeight: 700,
        color: color || T.text, fontFamily: FONT,
        letterSpacing: "-0.02em", whiteSpace: "nowrap", textAlign: "center",
      }}>{value}</div>
    </div>
  );

  // ── The stat row, shared by the desktop and mobile strips ──
  // REFI (Christo 2026-07-22): Value · Loan Amount · Savings · Payment ·
  // Net Cash. Replaces Down (meaningless on a refi), Refi Cost (the borrower
  // decision numbers are savings and walk-away cash; costs live in the
  // popovers and the Costs tab), and DTI (still in the pillars/badge).
  // PURCHASE: unchanged.
  // No price yet: show placeholders instead of the fee-only defaults
  // ("Cash Close $16K / Payment $250") that read like real numbers.
  const noPrice = !(Number(salesPrice) > 0);
  const orDash = (v) => (noPrice ? "--" : v);
  const statRow = isRefi ? (<>
    <Stat label="Value" value={fmt(salesPrice)} statKey="price" />
    <Stat label="Loan Amount" short="Loan" value={fmt(calc.refiNewLoanAmt || 0)} statKey="price" />
    <Stat label="Savings" value={`${(calc.refiMonthlyTotalSavings || 0) < 0 ? "−" : ""}${fmt(Math.abs(Math.round(calc.refiMonthlyTotalSavings || 0)))}/mo`} color={(calc.refiMonthlyTotalSavings || 0) >= 0 ? T.green : T.red} statKey="savings" />
    <Stat label="Payment" value={fmt(calc.displayPayment)} color={T.blue} statKey="payment" />
    <Stat label="Net Cash" value={`${(calc.refiNetCashInHand || 0) < 0 ? "−" : ""}${fmt(Math.abs(Math.round(calc.refiNetCashInHand || 0)))}`} color={(calc.refiNetCashInHand || 0) >= 0 ? T.green : T.red} statKey="netcash" />
  </>) : (<>
    <Stat label="Price" value={fmt(salesPrice)} statKey="price" />
    <Stat label="Down" value={((downPct || 0)).toFixed(0) + "%"} statKey="down" />
    <Stat label="Cash Close" short="To Close" value={orDash(fmt(calc.cashToClose))} color={T.green} statKey="cashclose" />
    <Stat label="Payment" value={orDash(fmt(calc.displayPayment))} color={T.blue} statKey="payment" />
    {calc.qualifyingIncome > 0 && (
      <Stat label="DTI" value={pct(calc.yourDTI, 1)} color={calc.yourDTI <= calc.maxDTI ? T.text : T.red} statKey="dti" />
    )}
  </>);

  // LO-only "Share Link" + "Preview" pills. Desktop: row 1 after the
  // breadcrumb. Mobile: row 2, right of the scenario pill (2026-09-06).
  // Preview opens the client's own share URL in a new tab, so the LO sees
  // exactly the borrower view (share-link mode overrides LO auth in that tab)
  // without copying the link and pasting it into a private window.
  const shareLinkPill = (isCloud && !isBorrower && activeBorrower?.share_token) ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>

            <button
              onClick={() => {
                const url = `${WEB_ORIGIN}?share=${activeBorrower.share_token}`;
                navigator.clipboard.writeText(url).then(() => {
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2000);
                }).catch(() => { prompt('Copy this share link:', url); });
              }}
              id="bp-copy-share-btn"
              aria-label="Copy share link"
              aria-live="polite"
              style={{
                fontSize: 10, fontWeight: 600, color: '#3B6BF5',
                background: 'rgba(59,107,245,0.08)',
                border: '1px solid rgba(59,107,245,0.2)',
                borderRadius: 9999, padding: isDesktop ? '3px 9px' : '7px 11px', minHeight: isDesktop ? undefined : 32,
                cursor: 'pointer', fontFamily: FONT, marginLeft: 6,
                whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
              }}
            >
              <Icon name="link" size={11} />
              <span>{shareCopied ? 'Copied!' : 'Share Link'}</span>
            </button>
            <a
              href={`${WEB_ORIGIN}?share=${activeBorrower.share_token}`}
              target="_blank" rel="noopener noreferrer"
              title="Open this client's blueprint the way they see it"
              aria-label="Preview as borrower"
              style={{
                fontSize: 10, fontWeight: 600, color: T.textSecondary,
                background: 'transparent',
                border: `1px solid ${T.separator}`,
                borderRadius: 9999, padding: isDesktop ? '3px 9px' : '7px 11px', minHeight: isDesktop ? undefined : 32,
                cursor: 'pointer', fontFamily: FONT, textDecoration: 'none',
                whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
              }}
            >
              <Icon name="eye" size={11} />
              <span>Preview</span>
            </a>
          </div>
  ) : null;

  // Publish the header's real rendered height as a CSS var so the content
  // spacer in MortgageBlueprint can match it exactly. The mobile stats strip
  // is content-sized (label + value + padding + safe-area), so a hard-coded
  // spacer drifted and the first line of every tab slid under the header.
  const headerRef = useRef(null);
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el || typeof document === "undefined") return;
    const publish = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) document.documentElement.style.setProperty("--bp-header-h", `${h}px`);
    };
    publish();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={headerRef} style={{
      position: "fixed",
      top: 0,
      left: isBorrower ? 0 : sidebarW,
      right: 0,
      zIndex: 900,
      background: darkMode ? "rgba(5,5,5,0.92)" : "#FFFFFF",
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
          {/* Blueprint wordmark + tab breadcrumb. When the user is on the
              Overview tab the wordmark stands alone. On any other tab a
              subtle separator and the tab label appear after it
              ('Blueprint · Costs'), so the user always knows where they
              are even with the horizontal tab strip removed. */}
          {isDesktop ? (
            <span style={{
              fontSize: 16, fontWeight: 800,
              letterSpacing: "-0.03em", color: T.text,
              whiteSpace: "nowrap",
            }}>Mortgage Blueprint</span>
          ) : (
            /* Mobile (2026-09-06): the hamburger is gone. Tapping the wordmark
               opens the RealStack shell drawer (product switcher + theme + LO
               client list). The "powered by" badge appears once per surface —
               here, as the MONO microline under the wordmark. */
            <button type="button" onClick={onOpenMobileMenu} aria-label="Open RealStack menu"
              aria-expanded={mobileMenuOpen} aria-haspopup="dialog"
              style={{ background: "transparent", border: "none", padding: 0, margin: 0, cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 2, minHeight: 36, justifyContent: "center", WebkitTapHighlightColor: "transparent" }}>
              <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.03em", color: T.text, whiteSpace: "nowrap", lineHeight: 1, fontFamily: FONT }}>Blueprint</span>
              <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 500, letterSpacing: "0.15em", textTransform: "uppercase", color: T.textTertiary, lineHeight: 1, whiteSpace: "nowrap" }}>Powered by RealStack</span>
            </button>
          )}
          {isDesktop && clientLabel && clientLabel.trim() && (
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
              }} title={`Blueprint for ${clientLabel}`}>{clientLabel}</span>
            </>
          )}
          {/* Tab-name breadcrumb removed (Christo 2026-07-07) — the sidebar
              already shows where you are. Its slot now holds the Share Link
              button, which used to live on its own header row; folding it in
              here makes the fixed header one row shorter. */}
          {isDesktop && shareLinkPill}
          {/* Sync indicators — hidden on mobile to avoid visual overlap with centered badge */}
          {isDesktop && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              {saving && <span style={{ fontSize: 9, color: T.textTertiary, fontStyle: "italic" }}>saving...</span>}
              {!saving && loaded && <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.green, flexShrink: 0 }} />}
              {cloudSyncStatus === 'saving' && <span style={{ fontSize: 9, color: T.blue, fontStyle: "italic" }}></span>}
              {cloudSyncStatus === 'saved' && <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.green, flexShrink: 0 }} />}
              {cloudSyncStatus === 'error' && <span style={{ fontSize: 9, color: T.red }}>✗</span>}
              {sync?.status === 'saving' && <span style={{ fontSize: 9, color: '#3B6BF5', fontStyle: "italic" }}>syncing...</span>}
              {sync?.status === 'saved' && <span style={{ fontSize: 9, color: '#12a150' }}>live</span>}
              {sync?.onlineUsers?.length > 0 && <span style={{ fontSize: 9, color: '#3B6BF5', fontWeight: 600 }}>{sync.onlineUsers.length} online</span>}
              {selfSyncStatus === 'saving' && <span style={{ fontSize: 9, color: '#3B6BF5', fontStyle: "italic" }}>syncing...</span>}
              {selfSyncStatus === 'saved' && <span style={{ fontSize: 9, color: '#12a150' }}>synced</span>}
              {selfSyncStatus === 'error' && <span style={{ fontSize: 9, color: T.red }}>sync error</span>}
            </div>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1, minWidth: 4 }} />

        {/* Mobile: scenario switcher rides on Row 1, right-aligned next to the
            controls (Christo 2026-09-22) — it had its own row, which cost the
            borrower's share view ~40px of phone screen. Truncates to fit. */}
        {!isDesktop && (
          <div style={{ display: "flex", justifyContent: "flex-end", minWidth: 0, flexShrink: 1 }}>
            <ScenarioPill compact
              T={T} scenarioName={scenarioName} scenarioList={scenarioList || []}
              clientLabel={(!isBorrower && activeBorrower && (activeBorrower.name || "").trim()) ? activeBorrower.name.trim() : ""}
              switchScenario={switchScenario} actions={scenarioActions} canEdit={!!canEditScenarios}
            />
          </div>
        )}

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
                  background: "linear-gradient(135deg, #3B6BF5, #2B4FCE)",
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
                  border: "1px solid rgba(59,107,245,0.35)",
                  background: "rgba(59,107,245,0.08)",
                  color: "#3B6BF5", fontSize: 11, fontWeight: 600,
                  cursor: "pointer", fontFamily: FONT,
                  whiteSpace: "nowrap", flexShrink: 0,
                }}
              >
                Sign in
              </button>
            )
          )}
          {/* Create New Blueprint — Arive-style blue "+" beside the account
              pill (Christo 7.24). LO-only: the parent passes null otherwise. */}
          {onCreateNewBlueprint && (
            <button
              onClick={onCreateNewBlueprint}
              title="Create New Blueprint"
              aria-label="Create New Blueprint"
              style={{
                width: 26, height: 26, borderRadius: 9999, border: "none",
                background: "#3B6BF5", color: "#fff",
                fontSize: 18, fontWeight: 600, lineHeight: 1,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0, padding: 0, paddingBottom: 2,
                fontFamily: FONT, boxShadow: "0 1px 4px rgba(59,107,245,0.35)",
              }}
            >+</button>
          )}
          {auth?.userPill}
        </div>
      </div>

      {/* ── Mobile row 1b — LO Share Link only. The scenario pill moved up into
          Row 1 (2026-09-22), so borrowers don't get this row at all. The
          scenario is CONTEXT, not a page: it lives in the header like the
          mailbox name in Mail, not in the drawer or the tab bar. ── */}
      {/* Mobile row 1b (Share Link + Preview) removed 2026-09-23 (Christo:
          header white space). Both now live on the Share tab — the bottom
          bar's Share button — as Copy Link and Preview as borrower. Desktop
          keeps its pills on row 1, which costs no extra height. */}

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
          {statRow}
          {qualBadge}
        </div>
      ) : (
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-around",
          padding: "4px 14px 6px",
          borderTop: `1px solid ${T.separator}`,
          // 10px keeps "CASH CLOSE" and "PAYMENT" from touching at 375px.
          columnGap: 10,
        }}>
          {statRow}
          {qualBadge}
        </div>
      )}

      {/* Stat dropdown popover — Arive-style summary for the clicked stat. */}
      {statPop && typeof document !== "undefined" && (() => {
        const c = statContent(statPop.key);
        if (!c) return null;
        const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
        const W = 264;
        const left = Math.max(10, Math.min(statPop.x - W / 2, vw - W - 10));
        return createPortal(
          <>
            <div onClick={() => setStatPop(null)} onWheel={() => setStatPop(null)} style={{ position: "fixed", inset: 0, zIndex: 99998 }} />
            <div style={{ position: "fixed", left, top: statPop.y + 6, width: W, background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, boxShadow: "0 14px 40px rgba(0,0,0,0.4)", zIndex: 99999, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: T.textTertiary, fontFamily: FONT, marginBottom: 8 }}>{c.title}</div>
              {c.pillars && c.pillars.map((pl, i) => {
                const col = pl.ok === true ? T.green : pl.ok === null ? T.textTertiary : T.red;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "7px 0", borderTop: i > 0 ? `1px solid ${T.separator}` : "none" }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: col, color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{pl.ok === true ? "✓" : pl.ok === null ? "?" : "✕"}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT }}>{pl.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: col, fontFamily: FONT, whiteSpace: "nowrap" }}>{pl.value}</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: T.textTertiary, fontFamily: FONT, marginTop: 1, lineHeight: 1.3 }}>{pl.note}</div>
                    </div>
                  </div>
                );
              })}
              {!c.pillars && c.rows.map((r, i) => {
                if (r[0] === "__h") return (<div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: T.blue, fontFamily: FONT, margin: i > 0 ? "9px 0 3px" : "0 0 3px" }}>{r[1]}</div>);
                const isT = r[0] === "__t";
                const label = isT ? r[1] : r[0];
                const val = isT ? r[2] : r[1];
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderTop: isT ? `1px solid ${T.separator}` : "none", marginTop: isT ? 4 : 0 }}>
                    <span style={{ fontSize: 12.5, color: isT ? T.text : T.textSecondary, fontWeight: isT ? 700 : 500, fontFamily: FONT }}>{label}</span>
                    <span style={{ fontSize: 12.5, color: T.text, fontWeight: isT ? 700 : 600, fontFamily: FONT }}>{val}</span>
                  </div>
                );
              })}
              <div onClick={() => { const sec = c.section; setStatPop(null); if (onJumpToSection && sec) onJumpToSection(sec); else if (setTab) setTab("overview"); }} style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: T.blue, cursor: "pointer", fontFamily: FONT }}>View details →</div>
            </div>
          </>,
          document.body
        );
      })()}

      {/* The LO-mode Share Link row was folded into Row 1 (breadcrumb slot)
          on 2026-07-07 — it made the fixed header taller than the content
          spacer, so the first element of every tab slid underneath it. */}

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

/**
 * ScenarioPill — mobile header scenario switcher (2026-09-06).
 *
 * Renders as plain text (no chevron, no tap) for a borrower with a single
 * scenario. Otherwise a glass pill that opens a portal dropdown listing every
 * scenario, with a per-row kebab revealing Rename / Duplicate / Delete inline,
 * and a "+ New scenario" footer. Mirrors the desktop sidebar's scnMenu.
 */
function ScenarioPill({ T, scenarioName, scenarioList, clientLabel, switchScenario, actions, canEdit, compact = false }) {
  const [open, setOpen] = useState(false);
  const [menuFor, setMenuFor] = useState(null);      // scenario name with the action strip open
  const [editing, setEditing] = useState(null);      // scenario name being renamed
  const [editValue, setEditValue] = useState("");
  const [rect, setRect] = useState(null);
  const btnRef = useRef(null);
  const interactive = scenarioList.length > 1 || canEdit;
  const label = clientLabel ? `${clientLabel} · ${scenarioName || "Scenario 1"}` : (scenarioName || "Scenario 1");
  const openMenu = () => {
    if (!interactive) return;
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setMenuFor(null); setEditing(null);
    setOpen(true);
  };
  const close = () => { setOpen(false); setMenuFor(null); setEditing(null); };
  const nextName = () => { let n = scenarioList.length + 1; while (scenarioList.includes(`Scenario ${n}`)) n++; return `Scenario ${n}`; };
  const pillStyle = {
    display: "flex", alignItems: "center", gap: compact ? 5 : 6, minHeight: compact ? 30 : 32,
    maxWidth: compact ? "100%" : 250, minWidth: 0,
    padding: compact ? "5px 9px 5px 9px" : "6px 12px 6px 10px", borderRadius: 9999, boxSizing: "border-box",
    background: open ? "rgba(59,107,245,0.15)" : (T.glass || T.pillBg),
    border: `1px solid ${open ? (T.blue || "#3B6BF5") : (T.glassBorder || T.separator)}`,
    color: T.text, fontFamily: FONT, cursor: interactive ? "pointer" : "default",
    WebkitTapHighlightColor: "transparent",
  };
  const nameSpan = <span style={{ fontSize: compact ? 12.5 : 13, fontWeight: 700, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{label}</span>;
  return (
    <>
      {interactive ? (
        <button ref={btnRef} type="button" onClick={open ? close : openMenu} aria-haspopup="listbox" aria-expanded={open} aria-label="Switch scenario" style={pillStyle}>
          <Icon name="copy" size={13} color={T.blue} />
          {nameSpan}
          <Icon name={open ? "chevron-up" : "chevron-down"} size={14} color={T.textSecondary} />
        </button>
      ) : (
        <div style={pillStyle}><Icon name="copy" size={13} color={T.blue} />{nameSpan}</div>
      )}
      {open && rect && typeof document !== "undefined" && createPortal(
        <>
          <div onClick={close} onWheel={close} style={{ position: "fixed", inset: 0, zIndex: 99998 }} />
          <div role="listbox" style={{ position: "fixed", left: 12, right: 12, top: rect.bottom + 6, maxHeight: "calc(100vh - 160px)", overflowY: "auto", background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.38)", zIndex: 99999, fontFamily: FONT }}>
            <div style={{ display: "flex", alignItems: "center", padding: "6px 12px 8px" }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.2, color: T.textTertiary }}>Scenarios</span>
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 500, color: T.textTertiary }}>{scenarioList.length}</span>
            </div>
            {scenarioList.map((name) => {
              const active = name === scenarioName;
              const isEditing = editing === name;
              const strip = menuFor === name && !isEditing;
              return (
                <div key={name}>
                  <div role="option" aria-selected={active}
                    onClick={() => { if (isEditing) return; if (!active) switchScenario && switchScenario(name); close(); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px 0 12px", minHeight: 46, borderRadius: 10, cursor: isEditing ? "default" : "pointer",
                      background: active ? T.tabActiveBg : "transparent", borderLeft: `3px solid ${active ? (T.blue || "#3B6BF5") : "transparent"}` }}>
                    <Icon name="copy" size={15} color={active ? T.blue : T.textSecondary} />
                    {isEditing ? (
                      <input value={editValue} autoFocus onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { const v = editValue.trim(); if (v && v !== name) actions?.rename?.(name, v); setEditing(null); } if (e.key === "Escape") setEditing(null); }}
                        onBlur={() => { const v = editValue.trim(); if (v && v !== name) actions?.rename?.(name, v); setEditing(null); }}
                        style={{ flex: 1, minWidth: 0, background: T.inputBg, border: `1px solid ${T.blue}`, borderRadius: 6, padding: "4px 6px", fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT, outline: "none" }} />
                    ) : (
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? T.blue : T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                    )}
                    {canEdit && !isEditing && (
                      <button type="button" aria-label={`Options for ${name}`} onClick={(e) => { e.stopPropagation(); setMenuFor(strip ? null : name); }}
                        style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", borderRadius: 8, cursor: "pointer", color: strip ? T.blue : T.textSecondary, padding: 0, flexShrink: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>
                      </button>
                    )}
                  </div>
                  {strip && (
                    <div style={{ display: "flex", gap: 6, padding: "4px 8px 8px 40px" }}>
                      {[
                        ["Rename", "edit", () => { setEditing(name); setEditValue(name); setMenuFor(null); }],
                        ["Duplicate", "copy", () => { actions?.duplicate?.(name); close(); }],
                        ...(scenarioList.length > 1 ? [["Delete", "trash", () => { actions?.remove?.(name); close(); }]] : []),
                      ].map(([l, ico, fn]) => (
                        <button key={l} type="button" onClick={(e) => { e.stopPropagation(); fn(); }}
                          style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 36, padding: "0 12px", borderRadius: 9999, border: `1px solid ${T.cardBorder}`, background: T.pillBg, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: FONT, color: l === "Delete" ? T.red : T.text }}>
                          <Icon name={ico} size={13} color={l === "Delete" ? T.red : T.textSecondary} />{l}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {canEdit && actions?.create && (
              <>
                <div style={{ height: 1, background: T.separator, margin: "6px 8px" }} />
                <button type="button" onClick={() => { actions.create(nextName()); close(); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 44, padding: "0 12px", background: "transparent", border: "none", borderRadius: 10, cursor: "pointer", color: T.blue, fontSize: 13, fontWeight: 600, fontFamily: FONT, textAlign: "left" }}>
                  <Icon name="plus" size={15} />New scenario
                </button>
              </>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
