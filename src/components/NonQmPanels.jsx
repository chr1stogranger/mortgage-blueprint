import { FONT, MONO } from "../lib/fonts.js";
import React, { useState } from "react";
import Icon from "../Icon";
import { DSCR_RULES, HELOC_RULES } from "../lib/nonQm.js";

/* ═══════════════════════════════════════════════════════════════
   NON-QM + HELOC PANELS (2026-10-21)
   The product-specific inputs and verdicts for DSCR, Asset Qualifier
   and HELOC. Every number comes from calc (MortgageBlueprint's memo,
   which calls lib/nonQm.js); nothing is re-derived here.
   ═══════════════════════════════════════════════════════════════ */

const overline = (T, color) => ({ fontFamily: MONO, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, color: color || T.textTertiary });

function Panel({ T, children, style }) {
  return <div style={{ background: T.card, borderRadius: 16, padding: 18, boxShadow: T.cardShadow, marginBottom: 12, ...style }}>{children}</div>;
}

// Verdict band: overline + big figure + one explanatory line.
function Verdict({ T, color, label, figure, unit, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, background: `linear-gradient(${color}14, ${color}14), ${T.card}`, border: `1.5px solid ${color}66`, marginBottom: 12, flexWrap: "wrap" }}>
      <div>
        <div style={overline(T, color)}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, color: T.text, fontFamily: FONT }}>
          {figure}{unit && <span style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, marginLeft: 4 }}>{unit}</span>}
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: T.textSecondary, lineHeight: 1.5, fontFamily: FONT, flex: 1, minWidth: 180 }}>{children}</div>
    </div>
  );
}

function Line({ T, label, value, color, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "7px 0", borderBottom: `1px solid ${T.separator}` }}>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: bold ? T.text : T.textSecondary, fontFamily: FONT }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: bold ? 800 : 600, color: color || T.text, fontFamily: FONT, whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

function Chips({ T, items }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
      {items.map(t => (
        <span key={t} style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary, background: T.pillBg, borderRadius: 9999, padding: "3px 10px", fontFamily: FONT }}>{t}</span>
      ))}
    </div>
  );
}

// ── DSCR ────────────────────────────────────────────────────────────────────
export function DscrPanel({ T, calc, fmt }) {
  const d = calc.dscr;
  if (!d) return null;
  const color = d.pass === null ? T.textTertiary : d.pass ? (d.ratio >= DSCR_RULES.strongRatio ? T.green : T.blue) : T.red;
  return (
    <Panel T={T}>
      <Verdict T={T} color={color} label={d.pass === null ? "DSCR" : d.pass ? `DSCR · ${d.tier}` : "DSCR · Below 1.00"}
        figure={d.ratio !== null ? d.ratio.toFixed(2) : "—"}>
        {d.ratio !== null
          ? <>Rent <b style={{ color: T.text }}>{fmt(d.rent)}</b> ÷ PITIA <b style={{ color: T.text }}>{fmt(d.pitia)}</b>. {d.pass ? "Qualifies on the property alone: no income, no DTI." : <>Needs <b style={{ color: T.text }}>{fmt(d.rentNeeded)}/mo</b> of rent to reach 1.00, or a smaller loan.</>}</>
          : "Enter the expected monthly rent. DSCR qualifies on the property's rent, not your income."}
      </Verdict>
      <Line T={T} label="Rent needed for 1.00" value={`${fmt(d.rentNeeded)}/mo`} />
      <Line T={T} label={`Rent for ${DSCR_RULES.strongRatio.toFixed(2)} (best pricing)`} value={`${fmt(d.pitia * DSCR_RULES.strongRatio)}/mo`} />
      <Line T={T} label="PITIA counted" value={`${fmt(d.pitia)}/mo`} />
      <Chips T={T} items={[`${DSCR_RULES.minFico}+ FICO`, `${Math.round(DSCR_RULES.maxLtvPurchase * 100)}% max LTV purchase`, `${Math.round(DSCR_RULES.maxLtvCashOut * 100)}% cash-out`, `${DSCR_RULES.reserveMonths} months reserves`, "Investment only", "Full PITIA, all escrows"]} />
    </Panel>
  );
}

// ── Asset Qualifier ─────────────────────────────────────────────────────────
// Inputs the asset programs need that Blueprint doesn't otherwise ask for.
export function AssetQualifierInputs({ T, calc, nonQm, setNonQm, Inp, isDesktop, onOpenPrograms }) {
  const s = calc.aqSummary;
  const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
  return (
    <Panel T={T}>
      <div style={{ ...overline(T, T.blue), marginBottom: 10 }}>Asset Qualifier</div>
      <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "1fr 1fr", gap: "0 10px" }}>
        <Inp label="Oldest borrower's age" value={nonQm.borrowerAge || 0} onChange={v => setNonQm({ borrowerAge: num(v) || null })} prefix="" max={110} sm
          tip={"Sets the retirement-account percentage (59½+ counts more) and unlocks the Fannie Mae and Freddie Mac programs (62+)."} />
        <Inp label="Household size" value={nonQm.householdSize} onChange={v => setNonQm({ householdSize: Math.max(1, num(v) || 1) })} prefix="" max={15} sm
          tip={"People in the household. Newrez's residual-income floor scales with it."} />
        <Inp label="Dependents" value={nonQm.dependents} onChange={v => setNonQm({ dependents: Math.max(0, num(v) || 0) })} prefix="" max={12} sm
          tip={"TLS adds $250 to its residual floor for the first dependent and $150 for each after."} />
        <Inp label="Other financed homes" value={nonQm.otherFinancedHomes} onChange={v => setNonQm({ otherFinancedHomes: Math.max(0, num(v) || 0) })} prefix="" max={20} sm
          tip={"BluePoint adds 2 months of reserves for each other financed property."} />
      </div>
      {s && (
        <div onClick={onOpenPrograms} role={onOpenPrograms ? "button" : undefined}
          style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, padding: "10px 12px", borderRadius: 12, border: `1px solid ${T.separator}`, cursor: onOpenPrograms ? "pointer" : "default" }}>
          <Icon name={s.passCount > 0 ? "check-circle" : "alert-circle"} size={18} style={{ color: s.passCount > 0 ? T.green : s.anyData ? T.red : T.textTertiary, flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 13, color: T.textSecondary, fontFamily: FONT, lineHeight: 1.45 }}>
            {!s.anyData ? "Add assets to run the programs."
              : s.passCount > 0 ? <><b style={{ color: T.text }}>{s.passCount} of {s.total}</b> programs approve this file. Best fit: <b style={{ color: T.text }}>{s.best.lender}</b>.</>
              : <>None of the {s.total} programs approve this file yet.</>}
          </div>
          {onOpenPrograms && <span style={{ fontSize: 13, fontWeight: 600, color: T.blue, fontFamily: FONT, whiteSpace: "nowrap" }}>See programs →</span>}
        </div>
      )}
    </Panel>
  );
}

const TEST_LABEL = { residual: "Residual income", nexbank: "Asset sufficiency", "tls-au": "Sufficiency + residual", dti: "Assets as income (DTI)" };

// The full lender matrix, one row per program. Tap a row for the math.
export function AssetProgramTable({ T, calc, fmt, isDesktop }) {
  const [open, setOpen] = useState(null);
  const rs = calc.aqResults;
  const s = calc.aqSummary;
  if (!rs) return null;
  const pill = (r) => {
    const c = r.pass === true ? T.green : r.pass === false ? T.red : T.textTertiary;
    return <span style={{ fontSize: 11, fontWeight: 700, color: c, background: `${c}18`, borderRadius: 9999, padding: "3px 10px", fontFamily: FONT, whiteSpace: "nowrap" }}>{r.pass === true ? "Approves" : r.pass === false ? "Declines" : "No data"}</span>;
  };
  return (
    <Panel T={T} style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px 10px" }}>
        <div style={overline(T, T.blue)}>Asset Qualifier · {s.passCount} of {s.total} approve</div>
        <div style={{ fontSize: 12.5, color: T.textSecondary, lineHeight: 1.5, fontFamily: FONT, marginTop: 4 }}>
          Every program counts your accounts differently and tests them differently. Guidelines current as of October 2026. Tap a program for the math.
        </div>
      </div>
      {rs.map(r => {
        const isOpen = open === r.id;
        return (
          <div key={r.id} style={{ borderTop: `1px solid ${T.separator}` }}>
            <button type="button" onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen}
              style={{ width: "100%", display: "grid", gridTemplateColumns: isDesktop ? "minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1.6fr) auto" : "minmax(0, 1fr) auto", gap: 10, alignItems: "center", padding: "11px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: FONT }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{r.lender}</div>
                <div style={{ fontSize: 11.5, color: T.textTertiary }}>{r.program}</div>
                {!isDesktop && <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 3 }}>{r.headline}</div>}
              </div>
              {isDesktop && <div style={{ fontSize: 12, color: T.textSecondary }}>{TEST_LABEL[r.test]}</div>}
              {isDesktop && <div style={{ fontSize: 12.5, color: T.text, fontWeight: 600 }}>{r.headline}</div>}
              {pill(r)}
            </button>
            {isOpen && (
              <div style={{ padding: "0 18px 14px", fontFamily: FONT }}>
                <div style={{ fontSize: 12.5, color: T.textSecondary, lineHeight: 1.55, marginBottom: 8 }}>{r.detail}</div>
                <Line T={T} label="Eligible assets" value={fmt(r.eligible)} />
                <Line T={T} label="Counted" value={`Cash ${Math.round(r.pctUsed.deposit * 100)}% · Stocks ${Math.round(r.pctUsed.securities * 100)}% · Retirement ${Math.round(r.pctUsed.ret * 100)}%`} />
                <Line T={T} label="Left after closing" value={fmt(r.afterClose)} color={r.afterClose < 0 ? T.red : undefined} />
                {r.reserveMonths > 0 && <Line T={T} label={`Reserves (${r.reserveMonths} mo)`} value={fmt(r.reserves)} />}
                {r.monthlyIncome !== undefined && <Line T={T} label="Assets as monthly income" value={`${fmt(r.monthlyIncome)}/mo`} />}
                {r.methods && r.methods.map(m => <Line key={m.name} T={T} label={`${m.name}: ${m.how}`} value={fmt(m.need)} color={m.pass ? T.green : T.red} />)}
                {r.residualFloor !== undefined && <Line T={T} label="Residual vs floor" value={`${fmt(r.residual)} / ${fmt(r.residualFloor)}`} color={r.residual >= r.residualFloor ? T.green : T.red} />}
                <Line T={T} label="Max LTV · min FICO" value={`${Math.round(r.maxLtv * 100)}% · ${r.minFico || "not stated"}`} />
                <Line T={T} label="Statements" value={r.statements} />
                {r.blockers.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: T.red, lineHeight: 1.5 }}>{r.blockers.map(b => <div key={b}>· {b}</div>)}</div>
                )}
                {r.notes.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 11.5, color: T.textTertiary, lineHeight: 1.5 }}>{r.notes.map(n => <div key={n}>{n}</div>)}</div>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div style={{ padding: "10px 18px 14px", borderTop: `1px solid ${T.separator}`, fontSize: 11, color: T.textTertiary, lineHeight: 1.5, fontFamily: FONT }}>
        Never eligible: real estate equity, RSUs and unvested stock, business accounts, 529 plans, and gift funds as qualifying assets (gifts can still pay closing costs). For discussion only, not a loan approval.
      </div>
    </Panel>
  );
}

// ── HELOC ───────────────────────────────────────────────────────────────────
export function HelocPanel({ T, calc, fmt, pct, nonQm, setNonQm, Inp, Sel, isDesktop }) {
  const h = calc.heloc;
  if (!h || (!h.piggy && !h.standalone)) return null;
  const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
  const rateInput = (
    <Inp label={h.rateEstimated ? "HELOC rate (est.)" : "HELOC rate"} value={h.rate} onChange={v => setNonQm({ helocRate: num(v) > 0 ? num(v) : null })} prefix="" suffix="%" step={0.125} max={20} sm
      tip={"HELOCs are variable, usually prime plus a margin, and aren't in the live rate feed. Until you enter a quote this is the first-lien rate + 1.25%."} />
  );

  if (h.piggy) {
    const sp = h.split, p = h.piggyPmts;
    return (
      <Panel T={T}>
        <div style={{ ...overline(T, T.blue), marginBottom: 10 }}>1st mortgage + HELOC</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
          <Sel label="First mortgage" value={String(nonQm.helocFirstLtv || 80)} onChange={v => setNonQm({ helocFirstLtv: Number(v) })} sm
            options={[80, 75, 70].map(x => ({ value: String(x), label: `${x}% of price` }))} />
          {rateInput}
        </div>
        {sp.heloc > 0 ? (
          <>
            <Line T={T} label="First mortgage" value={fmt(sp.first)} />
            <Line T={T} label="HELOC (drawn at closing)" value={fmt(sp.heloc)} />
            <Line T={T} label="Combined LTV" value={pct(sp.cltv, 1)} color={sp.cltv > HELOC_RULES.maxCltv + 1e-9 ? T.red : undefined} />
            <Line T={T} label="HELOC payment, interest-only" value={`${fmt(p.ioPayment)}/mo`} bold />
            <Line T={T} label="After the 10-year draw period" value={`${fmt(p.repayPayment)}/mo`} />
            <div style={{ fontSize: 12, color: T.textTertiary, lineHeight: 1.5, marginTop: 8, fontFamily: FONT }}>
              The first mortgage stays at {Math.round(sp.firstLtv * 100)}%, so there's no PMI and the first can stay under the conforming limit. The HELOC payment is in your monthly payment and DTI.
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: T.textSecondary, lineHeight: 1.5, marginTop: 4, fontFamily: FONT }}>
            With {Math.round(100 - (nonQm.helocFirstLtv || 80))}% or more down the first mortgage covers everything, so there's no HELOC. Lower the down payment (to as little as {Math.round((1 - HELOC_RULES.maxCltv) * 100)}%) to bring one in.
          </div>
        )}
        <Chips T={T} items={[`${HELOC_RULES.minFico}+ FICO`, `${Math.round(HELOC_RULES.maxCltv * 100)}% max CLTV`, `${Math.round(HELOC_RULES.maxDti * 100)}% max DTI`, "10-yr draw · 20-yr repay"]} />
      </Panel>
    );
  }

  // Standalone line behind the current first.
  const L = h.line, p = h.pmts;
  const lineSet = nonQm.helocLine !== null && nonQm.helocLine !== undefined;
  const drawSet = nonQm.helocDraw !== null && nonQm.helocDraw !== undefined && nonQm.helocDraw !== "";
  return (
    <Panel T={T}>
      <div style={{ ...overline(T, T.blue), marginBottom: 10 }}>Standalone HELOC</div>
      <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr 1fr" : "1fr 1fr", gap: "0 10px" }}>
        <Inp label="Line amount" value={Math.round(L.line)} onChange={v => setNonQm({ helocLine: num(v) > 0 ? num(v) : null })} sm
          tip={`Up to ${Math.round(HELOC_RULES.maxCltv * 100)}% of the home's value, less what you owe on the first. Leave it at the max or enter a smaller line.`}
          rightSlot={lineSet ? <button type="button" onClick={() => setNonQm({ helocLine: null })} style={{ background: "none", border: "none", color: T.blue, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Max</button> : null} />
        <Inp label="Drawn at closing" value={Math.round(p.drawn)} onChange={v => setNonQm({ helocDraw: num(v) })} sm
          tip={"How much you take out on day one. You pay interest only on what's drawn."}
          rightSlot={drawSet ? <button type="button" onClick={() => setNonQm({ helocDraw: null })} style={{ background: "none", border: "none", color: T.blue, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>All</button> : null} />
        {rateInput}
      </div>
      {L.maxLine <= 0 ? (
        <div style={{ fontSize: 12.5, color: T.red, lineHeight: 1.5, fontFamily: FONT }}>
          No room for a line: the first mortgage already uses {pct(L.cltv, 0)} or more of the home's value. Enter the home value and current balance in Setup.
        </div>
      ) : (
        <>
          <Line T={T} label={`Max line at ${Math.round(HELOC_RULES.maxCltv * 100)}% CLTV`} value={fmt(L.maxLine)} />
          <Line T={T} label="Combined LTV" value={pct(L.cltv, 1)} color={L.overMax ? T.red : undefined} />
          <Line T={T} label="First mortgage (unchanged)" value={`${fmt(calc.refiCurTotalPmt)}/mo`} />
          <Line T={T} label="HELOC payment, interest-only" value={`${fmt(p.ioPayment)}/mo`} bold />
          <Line T={T} label="After the 10-year draw period" value={`${fmt(p.repayPayment)}/mo`} />
          <Line T={T} label="Qualifying payment (full line, interest-only)" value={`${fmt(p.qualifyingPayment)}/mo`} />
        </>
      )}
      {L.overMax && <div style={{ fontSize: 12, color: T.red, marginTop: 8, fontFamily: FONT }}>That line is over the {Math.round(HELOC_RULES.maxCltv * 100)}% CLTV max of {fmt(L.maxLine)}.</div>}
      <Chips T={T} items={[`${HELOC_RULES.minFico}+ FICO`, `${Math.round(HELOC_RULES.maxCltv * 100)}% max CLTV`, `${Math.round(HELOC_RULES.maxDti * 100)}% max DTI`, "Keeps your first mortgage"]} />
    </Panel>
  );
}
