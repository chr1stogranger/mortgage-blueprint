import { FONT } from "../lib/fonts.js";
import React, { useState } from "react";
import { devCheckProps } from "../lib/devPropCheck.js";


const BORROWER_OPTIONS = ["Joint", "Borrower 1", "Borrower 2"];

// Plain-English labels over the stored payoff values. The VALUES are what the
// DTI / cash-to-close math and saved scenarios key on — never change them;
// only the wording the borrower sees.
const PAYOFF_LABELED = [
  { value: "No", label: "Keep" },
  { value: "Yes - at Escrow", label: "Pay at escrow" },
  { value: "Yes - POC", label: "Pay before close" },
  { value: "Omit", label: "Omit" },
];

const isPaidOff = (d) => d.payoff === "Yes - at Escrow" || d.payoff === "Yes - POC";
const isLienType = (d) => d.type === "Mortgage" || d.type === "HELOC";

// Desktop grid — same grammar as the Assets table (hairline rows, no cell
// gridlines, derived colored column second-to-last, remove × last).
const COLS = "1.45fr 0.8fr 1fr 1fr 0.9fr 0.85fr 1.2fr 0.95fr 32px";

export default function DebtsContent(props) {
  // Dev-only guard for curated-props drift (see src/lib/devPropCheck.js).
  if (import.meta.env.DEV) devCheckProps("DebtsContent", props, ["T", "isDesktop", "calc", "fmt", "debts", "debtFree", "setDebtFree", "ownsProperties", "setOwnsProperties", "reos", "setReos", "syncDebtBalance", "syncDebtPayment", "guideTouched", "markTouched", "isPulse", "Hero", "Card", "Sec", "TextInp", "Inp", "Sel", "Note", "Progress", "DEBT_TYPES", "PAYOFF_OPTIONS", "GuidedNextButton", "ClusterContinue"]);
  const {
  T, isDesktop, calc, fmt,
  debts, debtFree, setDebtFree,
  ownsProperties, setOwnsProperties,
  reos, setReos,
  syncDebtBalance, syncDebtPayment,
  guideTouched, markTouched, isPulse,
  Card, TextInp, Inp, Sel, Note, Progress,
  DEBT_TYPES, GuidedNextButton, ClusterContinue,
} = props;

  const [linkOpenId, setLinkOpenId] = useState(null);

  const totalMonthly = debts.reduce((s, d) => s + (Number(d.monthly) || 0), 0);
  const totalBalance = debts.reduce((s, d) => s + (Number(d.balance) || 0), 0);
  const countedInDti = debtFree ? 0 : (calc.totalMonthlyDebts || 0);
  const reoLinked = calc.reoLinkedDebtIds || new Set();
  const paidCount = debts.filter(isPaidOff).length;
  const reoCount = debts.filter(d => reoLinked.has(d.id)).length;
  const monthlyRemoved = debts.filter(d => isPaidOff(d) || d.payoff === "Omit").reduce((s, d) => s + (Number(d.monthly) || 0), 0);

  // Monthly/balance on a Mortgage/HELOC linked to an REO must flow through the
  // sync helpers so the REO's payment/balance stays in step.
  const setMonthly = (d, v) => (d.linkedReoId && isLienType(d)) ? syncDebtPayment(d.id, v) : calc.updateDebt(d.id, "monthly", v);
  const setBalance = (d, v) => (d.linkedReoId && isLienType(d)) ? syncDebtBalance(d.id, v) : calc.updateDebt(d.id, "balance", v);
  const setType = (d, v) => {
    calc.updateDebt(d.id, "type", v);
    if (v !== "Mortgage" && v !== "HELOC") calc.updateDebt(d.id, "linkedReoId", "");
  };
  const linkReo = (d, v) => {
    const oldReoId = d.linkedReoId;
    calc.updateDebt(d.id, "linkedReoId", v);
    const pmt = Number(d.monthly) || 0;
    const balN = Number(d.balance) || 0;
    if (oldReoId) {
      const otherLinkedOld = debts.filter(dd => dd.linkedReoId === oldReoId && dd.id !== d.id && isLienType(dd));
      const oldTotal = otherLinkedOld.reduce((s, dd) => s + (Number(dd.monthly) || 0), 0);
      const oldBalTotal = otherLinkedOld.reduce((s, dd) => s + (Number(dd.balance) || 0), 0);
      setReos(prev => prev.map(r => r.id === Number(oldReoId) ? { ...r, payment: oldTotal, mortgageBalance: oldBalTotal } : r));
    }
    if (v) {
      const otherLinkedNew = debts.filter(dd => dd.linkedReoId === v && dd.id !== d.id && isLienType(dd));
      const newTotal = otherLinkedNew.reduce((s, dd) => s + (Number(dd.monthly) || 0), 0) + pmt;
      const newBalTotal = otherLinkedNew.reduce((s, dd) => s + (Number(dd.balance) || 0), 0) + balN;
      setReos(prev => prev.map(r => r.id === Number(v) ? { ...r, payment: newTotal, mortgageBalance: newBalTotal } : r));
    }
  };

  const onAdd = () => {
    calc.addDebt("Revolving");
    setTimeout(() => {
      const rows = document.querySelectorAll("[data-debt-row]");
      if (rows.length) rows[rows.length - 1].scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const chip = (color, bg, children) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, alignSelf: "flex-start", fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 9999, whiteSpace: "nowrap", color, background: bg, fontFamily: FONT }}>{children}</span>
  );

  // What this debt adds to back-end DTI — the Debts analog of Assets' "For Reserves".
  const dtiCell = (d) => {
    if (isPaidOff(d)) {
      const po = Number(d.payoffAmount) || Number(d.balance) || 0;
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, color: T.green }}>{fmt(0)}</span>
          {chip(T.green, T.successBg, d.payoff === "Yes - at Escrow" ? `✓ ${fmt(po)} paid at close` : "✓ Paid before close")}
        </div>
      );
    }
    if (d.payoff === "Omit") return <span style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, color: T.textTertiary }}>Omitted</span>;
    if (reoLinked.has(d.id)) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, color: T.textTertiary }}>via REO</span>
          <span style={{ fontSize: 11, color: T.textTertiary }}>75% rent offset</span>
        </div>
      );
    }
    const mo = Number(d.monthly) || 0;
    return <span style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, color: mo > 0 ? T.orange : T.textTertiary }}>{fmt(mo)}</span>;
  };

  // Linked-property chip under the creditor for Mortgage/HELOC rows. Tapping
  // it opens the link picker (replaces the old +/− row expander).
  const linkChip = (d) => {
    if (!isLienType(d)) return null;
    const linked = reos.find(r => String(r.id) === d.linkedReoId);
    if (reos.length === 0) {
      return chip(T.textTertiary, T.pillBg, ownsProperties ? "Add property on REO tab to link" : "Not linked");
    }
    const idx = linked ? reos.indexOf(linked) : -1;
    return (
      <button onClick={() => setLinkOpenId(linkOpenId === d.id ? null : d.id)} aria-expanded={linkOpenId === d.id}
        style={{ border: "none", cursor: "pointer", padding: 0, background: "none", alignSelf: "flex-start" }}>
        {linked
          ? chip(T.blue, `${T.blue}1a`, `Linked · ${linked.address || `Property ${idx + 1}`}`)
          : chip(T.blue, `${T.blue}1a`, "+ Link property")}
      </button>
    );
  };

  const linkPicker = (d) => (
    <div style={{ padding: "10px 12px", margin: "0 0 10px", background: `${T.blue}0a`, borderRadius: 10 }}>
      <Sel label="Linked REO Property" value={d.linkedReoId || ""} onChange={v => linkReo(d, v)}
        options={[{ value: "", label: "Not linked" }, ...reos.map((r, i) => ({ value: String(r.id), label: r.address || `Property ${i + 1}` }))]} sm />
      <div style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.5 }}>
        Linking keeps this payment from being counted twice. Investment properties net it against 75% of rent; a primary or second home counts full PITIA.
      </div>
    </div>
  );

  const payoffAmount = (d) => d.payoff === "Yes - at Escrow" ? (
    <Inp value={d.payoffAmount || ""} onChange={v => calc.updateDebt(d.id, "payoffAmount", v)} placeholder={(Number(d.balance) || 0).toLocaleString("en-US")} sm />
  ) : null;

  const debtFreeSwitch = (
    <button
      data-field="debt-free-toggle"
      className={isPulse("debt-free-toggle")}
      onClick={() => { setDebtFree(!debtFree); markTouched("debt-free-toggle"); }}
      role="switch"
      aria-checked={!!debtFree}
      title={debtFree ? "Turn off to enter consumer debts" : "Turn on if you have no consumer debts"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0,
        fontFamily: FONT, fontSize: 12, fontWeight: 600, letterSpacing: 0, textTransform: "none",
        color: debtFree ? T.green : T.textSecondary,
      }}
    >
      <span style={{ width: 30, height: 18, borderRadius: 99, padding: 1, display: "inline-flex", transition: "all 0.2s", boxSizing: "border-box",
        background: debtFree ? T.green : T.inputBg, border: `1px solid ${debtFree ? T.green : T.separator}`, justifyContent: debtFree ? "flex-end" : "flex-start" }}>
        <span style={{ width: 14, height: 14, borderRadius: 99, background: debtFree ? "#fff" : T.textTertiary }} />
      </span>
      Debt-free
    </button>
  );

  const bannerMeta = debtFree ? "No consumer debt"
    : debts.length === 0 ? "No debts"
    : `${fmt(totalMonthly)}/mo · ${debts.length} ${debts.length === 1 ? "account" : "accounts"}`;

  const addButton = (
    <button onClick={onAdd} style={{ width: "100%", padding: 12, marginTop: 10, background: `${T.blue}10`, border: `1px dashed ${T.blue}44`, borderRadius: 10, color: T.blue, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>
      + Add Debt
    </button>
  );

  const emptyState = (
    <div style={{ padding: "20px 0", textAlign: "center" }}>
      <button onClick={onAdd} style={{ background: "none", border: `2px dashed ${T.separator}`, color: T.blue, fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "16px 24px", borderRadius: 12, fontFamily: FONT }}>
        + Add Debt
      </button>
      <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 8 }}>Or switch on Debt-free above if there's nothing on the credit report.</div>
    </div>
  );

  return (<>
    {/* ─── Own Properties toggle — full width, structural (gates REO tab) ─── */}
    <div data-field="debts-section" style={{ marginTop: 20, marginBottom: 16 }}>
      {guideTouched.has("owns-properties-toggle") && ClusterContinue && <ClusterContinue stepId="debts-section" />}
      <div data-field="owns-properties-toggle" className={isPulse("owns-properties-toggle")} style={{ borderRadius: 14, transition: "all 0.3s" }}>
        <Card>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Do you own any properties?</span>
            <span style={{ color: T.red, marginLeft: 3, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>*</span>
            <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>Current home, investment properties, second homes</div>
          </div>
          {/* Light-blue segmented Yes/No — matches Quick Start selector. */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => { setOwnsProperties(true); markTouched("owns-properties-toggle"); }} style={{
              flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", fontFamily: FONT,
              background: ownsProperties === true && guideTouched.has("owns-properties-toggle") ? `${T.blue}22` : T.inputBg,
              color: ownsProperties === true && guideTouched.has("owns-properties-toggle") ? T.blue : T.textSecondary,
              border: `2px solid ${ownsProperties === true && guideTouched.has("owns-properties-toggle") ? T.blue : T.separator}`,
            }}>Yes</button>
            <button onClick={() => { setOwnsProperties(false); markTouched("owns-properties-toggle"); }} style={{
              flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", fontFamily: FONT,
              background: ownsProperties === false && guideTouched.has("owns-properties-toggle") ? `${T.blue}22` : T.inputBg,
              color: ownsProperties === false && guideTouched.has("owns-properties-toggle") ? T.blue : T.textSecondary,
              border: `2px solid ${ownsProperties === false && guideTouched.has("owns-properties-toggle") ? T.blue : T.separator}`,
            }}>No</button>
          </div>
          {ownsProperties && guideTouched.has("owns-properties-toggle") && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: `${T.blue}10`, borderRadius: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.blue, marginBottom: 3 }}>REO tab unlocked</div>
              <div style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.5 }}>Add your properties in the REO tab. Mortgage & HELOC debts below can be linked to specific properties so payments aren't counted twice in DTI.</div>
            </div>
          )}
        </Card>
      </div>
    </div>

    {calc.reoNegativeDebt > 0 && (
      <Note color={T.orange}>
        {calc.reoPrimaryDebt > 0 && calc.reoInvestmentNet < 0
          ? `+${fmt(calc.reoPrimaryDebt)}/mo primary/2nd home PITIA + ${fmt(Math.abs(calc.reoInvestmentNet))}/mo investment shortfall`
          : calc.reoPrimaryDebt > 0
            ? `+${fmt(calc.reoPrimaryDebt)}/mo primary/2nd home PITIA`
            : `+${fmt(Math.abs(calc.reoInvestmentNet))}/mo investment property shortfall (75% rule)`} added as debt in DTI.
      </Note>
    )}

    {/* ─── MONTHLY DEBTS — same container + banner as the Assets table ─── */}
    <div style={{ border: `1px solid ${T.cardBorder}`, borderRadius: 14, overflow: "hidden", background: T.card, marginBottom: 16 }}>
      <div style={{
        background: `linear-gradient(135deg, ${T.blue}18, ${T.blue}0c)`,
        color: T.blue,
        borderBottom: `1px solid ${T.blue}38`,
        padding: "10px 16px",
        fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", fontFamily: FONT,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
      }}>
        <span>Monthly Debts</span>
        <span style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11, letterSpacing: 0.5 }}>
          <span style={{ opacity: 0.85 }}>{bannerMeta}</span>
          {debtFreeSwitch}
        </span>
      </div>

      <div style={{ padding: isDesktop ? "12px 16px" : "12px" }}>
        {debtFree ? (
          <div style={{ padding: "18px 0", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.green, marginBottom: 4 }}>No consumer debt: more buying power</div>
            <div style={{ fontSize: 12, color: T.textSecondary }}>More of your DTI capacity goes toward the new mortgage. Switch off Debt-free to add debts.</div>
          </div>
        ) : isDesktop ? (<>
          {/* Header row */}
          <div style={{
            display: "grid", gridTemplateColumns: COLS, gap: 8,
            paddingBottom: 8, borderBottom: `1px solid ${T.separator}`,
            fontSize: 10, fontFamily: FONT, letterSpacing: 1, textTransform: "uppercase",
            color: T.textTertiary, fontWeight: 700,
          }}>
            <span>Creditor</span>
            <span>Owner</span>
            <span>Type</span>
            <span>Balance</span>
            <span>Monthly</span>
            <span>Rate</span>
            <span>Payoff at Close</span>
            <span>Counts in DTI</span>
            <span></span>
          </div>

          {debts.length === 0 ? emptyState : debts.map((d) => (
            <div key={d.id} data-debt-row style={{ borderBottom: `1px solid ${T.separator}`, background: isPaidOff(d) ? `linear-gradient(90deg, ${T.successBg}, transparent 70%)` : "transparent" }}>
              <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "10px 0", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <TextInp value={d.name || ""} onChange={v => calc.updateDebt(d.id, "name", v)} sm placeholder="e.g. Chase Sapphire" />
                  {linkChip(d)}
                </div>
                <div style={{ minWidth: 0 }}><Sel value={d.borrower || "Joint"} onChange={v => calc.updateDebt(d.id, "borrower", v)} options={BORROWER_OPTIONS} sm /></div>
                <div style={{ minWidth: 0 }}><Sel value={d.type} onChange={v => setType(d, v)} options={DEBT_TYPES} sm /></div>
                <div style={{ minWidth: 0 }}><Inp value={d.balance} onChange={v => setBalance(d, v)} sm /></div>
                <div style={{ minWidth: 0 }}><Inp value={d.monthly} onChange={v => setMonthly(d, v)} sm /></div>
                <div style={{ minWidth: 0 }}><Inp value={d.rate} onChange={v => calc.updateDebt(d.id, "rate", v)} prefix="" suffix="%" step={0.01} sm /></div>
                <div style={{ minWidth: 0 }}>
                  <Sel value={d.payoff} onChange={v => calc.updateDebt(d.id, "payoff", v)} options={PAYOFF_LABELED} sm />
                  {payoffAmount(d)}
                </div>
                {dtiCell(d)}
                <button onClick={() => calc.removeDebt(d.id)} aria-label="Remove debt" style={{ background: "none", border: "none", color: T.textTertiary, fontSize: 16, cursor: "pointer", padding: 4, borderRadius: 4, lineHeight: 1 }}>×</button>
              </div>
              {linkOpenId === d.id && isLienType(d) && reos.length > 0 && linkPicker(d)}
            </div>
          ))}

          {debts.length > 0 && (
            <div style={{
              display: "grid", gridTemplateColumns: COLS, gap: 8,
              padding: "12px 0 4px", fontSize: 13, fontWeight: 700, color: T.text,
              borderTop: `2px solid ${T.separator}`, marginTop: -1,
            }}>
              <span style={{ gridColumn: "1 / 4", color: T.textSecondary, fontWeight: 600 }}>Total Debts</span>
              <span style={{ fontFamily: FONT }}>{fmt(totalBalance)}</span>
              <span style={{ fontFamily: FONT }}>{fmt(totalMonthly)}</span>
              <span></span>
              <span></span>
              <span style={{ fontFamily: FONT, color: T.orange }}>{fmt(countedInDti)}</span>
              <span></span>
            </div>
          )}
          {debts.length > 0 && addButton}
        </>) : (<>
          {/* ─── MOBILE: one tile per debt (mirrors Assets' card-per-account) ─── */}
          {debts.length === 0 ? emptyState : debts.map((d) => (
            <div key={d.id} data-debt-row style={{ border: `1px solid ${T.separator}`, borderRadius: 14, padding: 12, marginBottom: 10, background: isPaidOff(d) ? T.successBg : "transparent" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary }}>{d.type || "Debt"}</span>
                <button onClick={() => calc.removeDebt(d.id)} style={{ background: "none", border: "none", color: T.red, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>Remove</button>
              </div>
              <TextInp label="Creditor" value={d.name || ""} onChange={v => calc.updateDebt(d.id, "name", v)} sm placeholder="e.g. Chase Sapphire" />
              {isLienType(d) && <div style={{ display: "flex", marginBottom: 8 }}>{linkChip(d)}</div>}
              {linkOpenId === d.id && isLienType(d) && reos.length > 0 && linkPicker(d)}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Sel label="Type" value={d.type} onChange={v => setType(d, v)} options={DEBT_TYPES} sm />
                <Sel label="Owner" value={d.borrower || "Joint"} onChange={v => calc.updateDebt(d.id, "borrower", v)} options={BORROWER_OPTIONS} sm />
                <Inp label="Balance" value={d.balance} onChange={v => setBalance(d, v)} sm />
                <Inp label="Monthly" value={d.monthly} onChange={v => setMonthly(d, v)} sm />
                <Inp label="Rate" value={d.rate} onChange={v => calc.updateDebt(d.id, "rate", v)} prefix="" suffix="%" step={0.01} sm />
                <Sel label="Payoff at close" value={d.payoff} onChange={v => calc.updateDebt(d.id, "payoff", v)} options={PAYOFF_LABELED} sm />
              </div>
              {d.payoff === "Yes - at Escrow" && (
                <Inp label="Payoff Amount" value={d.payoffAmount || ""} onChange={v => calc.updateDebt(d.id, "payoffAmount", v)} placeholder={(Number(d.balance) || 0).toLocaleString("en-US")} sm tip={`Leave 0 to use full balance (${fmt(Number(d.balance) || 0)})`} />
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, marginTop: 4, borderTop: `1px solid ${T.separator}`, fontSize: 13 }}>
                <span style={{ color: T.textSecondary }}>Counts in DTI</span>
                {dtiCell(d)}
              </div>
            </div>
          ))}
          {debts.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 2px 0", fontSize: 13, fontWeight: 700 }}>
              <span style={{ color: T.textSecondary, fontWeight: 600 }}>Total · {fmt(totalBalance)} owed</span>
              <span style={{ fontFamily: FONT, color: T.orange }}>{fmt(countedInDti)}/mo in DTI</span>
            </div>
          )}
          {debts.length > 0 && addButton}
        </>)}
      </div>
    </div>

    {/* ─── BOTTOM SUMMARY — mirrors Assets: amber total, then two cards ─── */}
    {(() => {
      const income = calc.qualifyingIncome || 0;
      const totalPayment = calc.totalPayment || 0;
      const dti = calc.yourDTI;
      const maxDti = calc.maxDTI || 0.50;
      const dtiOk = dti != null && dti <= maxDti;
      const headroom = income * maxDti - totalPayment;
      const payoffs = debtFree ? 0 : (calc.payoffAtClosing || 0);
      const parts = [];
      if (!debtFree && debts.length > 0) {
        parts.push(`${debts.length} ${debts.length === 1 ? "account" : "accounts"}`);
        if (paidCount > 0) parts.push(`${paidCount} paid at close`);
        if (reoCount > 0) parts.push(`${reoCount} handled through REO`);
      }
      const labelStyle = { fontSize: 11, fontFamily: FONT, letterSpacing: 1, textTransform: "uppercase", color: T.textTertiary, fontWeight: 700 };
      const kv = { display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, gap: 12 };
      const totRow = { display: "flex", justifyContent: "space-between", padding: "8px 0 12px", fontSize: 14, borderTop: `1px solid ${T.separator}`, marginTop: 4 };
      return (
        <div>
          <Card pad={16}>
            <div style={labelStyle}>Total Monthly Debts</div>
            {/* Amber total — uniform with Income / Assets / REO heroes (debt-free flips to green). */}
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FONT, color: debtFree ? T.green : T.orange, letterSpacing: "-0.02em", marginTop: 2 }}>
              {fmt(countedInDti)}<span style={{ fontSize: 13, color: T.textTertiary, fontWeight: 600 }}>/mo counted in DTI</span>
            </div>
            <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>
              {debtFree ? "Debt-free" : parts.length ? parts.join(" · ") : "No debts entered yet"}
            </div>
          </Card>
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 12 }}>
            <Card pad={16} style={{ marginBottom: 0 }}>
              <div style={{ ...labelStyle, marginBottom: 8 }}>Back-End DTI</div>
              {income > 0 && dti != null ? (<>
                <div style={kv}><span style={{ color: T.textSecondary }}>Housing + debts</span><span style={{ fontFamily: FONT, fontWeight: 600 }}>{fmt(totalPayment)}/mo</span></div>
                <div style={kv}><span style={{ color: T.textSecondary }}>Max at {(maxDti * 100).toFixed(0)}% of {fmt(income)} income</span><span style={{ fontFamily: FONT, fontWeight: 600 }}>{fmt(income * maxDti)}/mo</span></div>
                <div style={totRow}>
                  <span style={{ color: T.text, fontWeight: 700 }}>Headroom</span>
                  <span style={{ fontFamily: FONT, fontWeight: 700, color: headroom >= 0 ? T.green : T.red }}>{headroom >= 0 ? fmt(headroom) : `−${fmt(Math.abs(headroom))}`}</span>
                </div>
                <Progress value={dti} max={maxDti} color={dtiOk ? T.green : T.red} height={10} />
                <div style={{ fontSize: 11, color: dtiOk ? T.green : T.red, fontWeight: 500, marginTop: 6 }}>
                  {dtiOk ? `✓ ${(dti * 100).toFixed(1)}% of ${(maxDti * 100).toFixed(0)}% max` : `${(dti * 100).toFixed(1)}%: above the ${(maxDti * 100).toFixed(0)}% max. Reduce debts or add income`}
                </div>
              </>) : (
                <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5 }}>Add income on the Income tab to see your back-end DTI.</div>
              )}
            </Card>
            <Card pad={16} style={{ marginBottom: 0 }}>
              <div style={{ ...labelStyle, marginBottom: 8 }}>Payoffs at Close</div>
              {paidCount > 0 && !debtFree ? (<>
                <div style={kv}><span style={{ color: T.textSecondary }}>Balances paid at escrow</span><span style={{ fontFamily: FONT, fontWeight: 600 }}>{fmt(payoffs)}</span></div>
                <div style={kv}><span style={{ color: T.textSecondary }}>Monthly removed from DTI</span><span style={{ fontFamily: FONT, fontWeight: 600 }}>{fmt(monthlyRemoved)}/mo</span></div>
                <div style={totRow}>
                  <span style={{ color: T.text, fontWeight: 700 }}>Added to cash to close</span>
                  <span style={{ fontFamily: FONT, fontWeight: 700, color: T.text }}>{fmt(payoffs)}</span>
                </div>
                <div style={{ fontSize: 11, color: T.blue, fontWeight: 500 }}>Already included in Cash to Close on the Assets tab.</div>
              </>) : (
                <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5 }}>
                  Nothing is being paid off at closing. Set a debt to <b>Pay at escrow</b> to drop its payment from DTI and roll the balance into cash to close.
                </div>
              )}
            </Card>
          </div>
          <div style={{ textAlign: "center", marginTop: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: T.green, fontWeight: 500 }}>✓ All changes auto-saved</span>
          </div>
        </div>
      );
    })()}

    <GuidedNextButton />
  </>);
}
