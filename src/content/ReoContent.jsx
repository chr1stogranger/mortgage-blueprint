import React from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

/* ═══════════════════════════════════════════════════════════════
   ReoContent — Real Estate Owned
   Properties the borrower already owns: primary, second homes, or
   investment rentals. Mortgage / HELOC debts can be linked here so
   payments aren't double-counted in DTI. Investment properties get
   the 75% rental offset rule; primary / second home PITIA counts as
   debt.
   ═══════════════════════════════════════════════════════════════ */
export default function ReoContent({
  T, isDesktop, calc, fmt,
  reos, addReo, updateReo, removeReo,
  syncReoPayment, syncReoBalance,
  debts, setReos, debtFree,
  hasSellProperty, setHasSellProperty,
  sellLinkedReoId, setSellLinkedReoId,
  setSellPrice, setSellMortgagePayoff, setSellPrimaryRes,
  ownsProperties, setOwnsProperties,
  Hero, Card, Sec, Inp, Sel, Note,
  isPulse, markTouched,
  hideHero = false,
  GuidedNextButton,
}) {
  const ACCENT = T.blue;

  // ─── Empty state: no properties owned at all ───
  if (!reos || reos.length === 0) {
    return (<>
      {!hideHero && (
        <div data-field="reo-section" style={{ marginTop: 20, marginBottom: 16 }}>
          <Hero value="$0" label="Total Equity" color={T.textSecondary} sub="No properties added yet" />
        </div>
      )}
      <Card>
        <div style={{ textAlign: "center", padding: "20px 12px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>No properties added yet</div>
          <div style={{ fontSize: 12, color: T.textTertiary, marginBottom: 14, lineHeight: 1.5 }}>
            Track primary, second-home, or investment properties here.<br/>
            Rental income (75%) offsets investment PITIA in DTI.
          </div>
          <button onClick={addReo} style={{
            padding: "10px 20px", background: ACCENT, border: "none", borderRadius: 9999,
            color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
            boxShadow: `0 4px 14px ${ACCENT}30`,
          }}>+ Add Property</button>
        </div>
      </Card>
    </>);
  }

  return (<>
    {/* ─── Hero ─── */}
    {!hideHero && (
      <div data-field="reo-section" style={{ marginTop: 20, marginBottom: 16 }}>
        <Hero
          value={fmt(calc.reoTotalEquity)}
          label="Total Equity"
          color={T.green}
          sub={`${reos.length} ${reos.length === 1 ? "property" : "properties"}`}
        />
      </div>
    )}

    {/* ─── Totals stat card ─── */}
    <Card pad={16}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 10, color: T.textTertiary, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Total Value</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: MONO, color: T.text, marginTop: 4, letterSpacing: "-0.02em" }}>{fmt(calc.reoTotalValue)}</div>
        </div>
        <div style={{ borderLeft: `1px solid ${T.separator}`, borderRight: `1px solid ${T.separator}` }}>
          <div style={{ fontSize: 10, color: T.textTertiary, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Total Debt</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: MONO, color: T.red, marginTop: 4, letterSpacing: "-0.02em" }}>{fmt(calc.reoTotalDebt)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: T.textTertiary, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Net Cash Flow</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: MONO, color: calc.reoNetCashFlow >= 0 ? T.green : T.red, marginTop: 4, letterSpacing: "-0.02em" }}>{fmt(calc.reoNetCashFlow)}/mo</div>
        </div>
      </div>
    </Card>

    {/* ─── Planning to sell? ─── */}
    {setHasSellProperty && (
      <Card>
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Planning to sell a property?</span>
          <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>Select which one to unlock Seller Net calculations</div>
        </div>
        <Sel label="" value={hasSellProperty ? (sellLinkedReoId || "__yes__") : ""} onChange={v => {
          if (v === "") {
            setHasSellProperty(false);
            setSellLinkedReoId && setSellLinkedReoId("");
          } else if (v === "__yes__") {
            setHasSellProperty(true);
            setSellLinkedReoId && setSellLinkedReoId("");
          } else {
            setHasSellProperty(true);
            setSellLinkedReoId && setSellLinkedReoId(v);
            const reo = reos.find(r => String(r.id) === v);
            if (reo) {
              setSellPrice && setSellPrice(Number(reo.value) || 0);
              const linked = debts.filter(d => d.linkedReoId === v && (d.type === "Mortgage" || d.type === "HELOC"));
              const totalBal = linked.length > 0 ? linked.reduce((s, d) => s + (Number(d.balance) || 0), 0) : (Number(reo.mortgageBalance) || 0);
              setSellMortgagePayoff && setSellMortgagePayoff(totalBal);
              setSellPrimaryRes && setSellPrimaryRes(reo.propUse === "Primary");
            }
          }
        }} options={[
          { value: "", label: "— Not selling —" },
          ...reos.map((r, i) => ({ value: String(r.id), label: r.address || `Property ${i + 1} (${fmt(r.value)})` })),
          { value: "__yes__", label: "Yes — I'll enter details manually" },
        ]} sm />
        {hasSellProperty && sellLinkedReoId && (() => {
          const reo = reos.find(r => String(r.id) === sellLinkedReoId);
          return reo ? (
            <div style={{ fontSize: 11, color: T.green, marginTop: 2, fontWeight: 500 }}>
              ✓ Seller Net unlocked — linked to {reo.address || "selected property"}
            </div>
          ) : null;
        })()}
        {hasSellProperty && !sellLinkedReoId && (
          <div style={{ fontSize: 11, color: T.green, marginTop: 2, fontWeight: 500 }}>
            ✓ Seller Net unlocked — manual entry mode
          </div>
        )}
      </Card>
    )}

    {/* ─── Per-property cards ─── */}
    {reos.map((r, i) => {
      const linked = debts.filter(d => d.linkedReoId === String(r.id) && (d.type === "Mortgage" || d.type === "HELOC"));
      const multiLinked = linked.length > 1;
      const hasLinked = linked.length > 0;
      const linkedBal = linked.reduce((s, d) => s + (Number(d.balance) || 0), 0);
      const linkedPmt = linked.reduce((s, d) => s + (Number(d.monthly) || 0), 0);
      const effectiveBal = hasLinked ? linkedBal : (Number(r.mortgageBalance) || 0);
      const effectivePmt = hasLinked ? linkedPmt : (Number(r.payment) || 0);
      const tihoa = (Number(r.reoTax) || 0) + (Number(r.reoIns) || 0) + (Number(r.reoHoa) || 0);
      const fullPITIA = effectivePmt + (r.includesTI ? 0 : tihoa);
      const cashFlow = (Number(r.rentalIncome) || 0) - fullPITIA;
      const equity = (Number(r.value) || 0) - effectiveBal;
      const ltv = r.value > 0 ? (effectiveBal / r.value * 100) : 0;
      const isInvestment = r.propUse === "Investment";
      const dtiImpact = isInvestment ? ((Number(r.rentalIncome) || 0) * 0.75) - fullPITIA : -fullPITIA;

      const allLinkableReoIdStr = String(r.id);
      const unlinkable = debts.filter(d => (d.type === "Mortgage" || d.type === "HELOC") && d.linkedReoId !== allLinkableReoIdStr && !d.linkedReoId);
      const totalLinkedWithTI = linkedPmt + (r.includesTI ? 0 : tihoa);

      return (
        <Sec key={r.id} title={r.address || `Property ${i + 1}`}>
          <Card>
            <Inp label="Address" value={r.address} onChange={v => updateReo(r.id, "address", v)} prefix="" type="text" />
            <Sel label="Use" value={r.propUse} onChange={v => updateReo(r.id, "propUse", v)} options={["Primary", "Second Home", "Investment"]} tip="Investment properties qualify for the 75% rental income offset in DTI. Primary and second homes count the full PITIA as debt with no rental offset." />

            {/* DTI rule badge */}
            {isInvestment ? (
              <div style={{ fontSize: 11, color: T.blue, background: `${T.blue}10`, borderRadius: 10, padding: "8px 12px", marginBottom: 10, fontWeight: 500 }}>
                DTI: 75% of rent offsets PITIA (investment netting rule)
              </div>
            ) : (
              <div style={{ fontSize: 11, color: T.orange, background: `${T.orange}10`, borderRadius: 10, padding: "8px 12px", marginBottom: 10, fontWeight: 500 }}>
                DTI: Full PITIA counts as debt — no rental offset
              </div>
            )}

            <Inp label="Est. Value" value={r.value} onChange={v => updateReo(r.id, "value", v)} />

            <Inp
              label={hasLinked ? `Mortgage Balance${multiLinked ? ` (from ${linked.length} debts)` : ""}` : "Mortgage Balance"}
              value={hasLinked ? linkedBal : r.mortgageBalance}
              onChange={v => hasLinked ? syncReoBalance(r.id, v) : updateReo(r.id, "mortgageBalance", v)}
            />
            {multiLinked && <div style={{ fontSize: 11, color: T.textTertiary, marginTop: -8, marginBottom: 8 }}>Edit individual balances on the Debts tab.</div>}

            <Inp
              label={hasLinked ? `Monthly Payment${multiLinked ? ` (from ${linked.length} debts)` : ""}` : "Monthly Payment"}
              value={hasLinked ? linkedPmt : r.payment}
              onChange={v => hasLinked ? syncReoPayment(r.id, v) : updateReo(r.id, "payment", v)}
            />
            {multiLinked && <div style={{ fontSize: 11, color: T.textTertiary, marginTop: -8, marginBottom: 8 }}>Edit individual payments on the Debts tab.</div>}

            {/* Tax, Ins & HOA toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.separator}` }}>
              <span style={{ fontSize: 13, color: T.textSecondary }}>Payment includes Tax, Ins &amp; HOA?</span>
              <div onClick={() => updateReo(r.id, "includesTI", !r.includesTI)} style={{ width: 52, height: 30, borderRadius: 99, background: r.includesTI ? T.green : T.inputBg, cursor: "pointer", padding: 2, transition: "all 0.3s" }}>
                <div style={{ width: 26, height: 26, borderRadius: 99, background: "#fff", transform: r.includesTI ? "translateX(22px)" : "translateX(0)", transition: "transform 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
              </div>
            </div>
            {!r.includesTI && (<>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                <Inp label="Tax" value={r.reoTax} onChange={v => updateReo(r.id, "reoTax", v)} sm />
                <Inp label="Insurance" value={r.reoIns} onChange={v => updateReo(r.id, "reoIns", v)} sm />
                <Inp label="HOA" value={r.reoHoa} onChange={v => updateReo(r.id, "reoHoa", v)} sm />
              </div>
              <div style={{ fontSize: 10, color: T.textTertiary, marginTop: -4, marginBottom: 8, fontFamily: MONO }}>
                Monthly · Total: {fmt(tihoa)}/mo
              </div>
            </>)}

            <Inp label="Monthly Rental Income" value={r.rentalIncome} onChange={v => updateReo(r.id, "rentalIncome", v)} />

            {/* Linked debts */}
            <div style={{ background: `${ACCENT}10`, borderRadius: 12, padding: "10px 12px", marginBottom: 10, marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6, fontFamily: MONO, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Linked Debts{linked.length > 0 ? ` (${linked.length})` : ""}
              </div>
              {linked.length === 0 && (
                <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 6 }}>
                  No debts linked yet. Link Mortgage or HELOC debts below, or from the Debts tab.
                </div>
              )}
              {linked.map(d => (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: T.textSecondary, padding: "4px 0" }}>
                  <span>
                    {d.type}{d.name ? ` — ${d.name}` : ""} · <span style={{ fontFamily: MONO }}>{fmt(d.monthly)}/mo</span>
                  </span>
                  <button onClick={() => calc.updateDebt(d.id, "linkedReoId", "")} style={{
                    background: `${T.red}15`, border: "none", borderRadius: 6, padding: "3px 8px",
                    fontSize: 10, color: T.red, cursor: "pointer", fontWeight: 700, fontFamily: FONT,
                  }}>Unlink</button>
                </div>
              ))}
              {linked.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: T.text, borderTop: `1px solid ${T.separator}`, marginTop: 4, paddingTop: 4 }}>
                  <span>Total from linked debts</span>
                  <span style={{ fontFamily: MONO }}>{fmt(totalLinkedWithTI)}/mo</span>
                </div>
              )}
              {unlinkable.length > 0 && (
                <div style={{ borderTop: linked.length > 0 ? `1px solid ${T.separator}` : "none", marginTop: linked.length > 0 ? 6 : 0, paddingTop: linked.length > 0 ? 6 : 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary, marginBottom: 4 }}>Available to link:</div>
                  {unlinkable.map(d => (
                    <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: T.textSecondary, padding: "4px 0" }}>
                      <span>
                        {d.type}{d.name ? ` — ${d.name}` : ""} · <span style={{ fontFamily: MONO }}>{fmt(d.monthly)}/mo</span>
                      </span>
                      <button onClick={() => {
                        calc.updateDebt(d.id, "linkedReoId", allLinkableReoIdStr);
                        const pmt = Number(d.monthly) || 0;
                        const bal = Number(d.balance) || 0;
                        const otherLinked = debts.filter(dd => dd.linkedReoId === allLinkableReoIdStr && (dd.type === "Mortgage" || dd.type === "HELOC"));
                        const newPmtTotal = otherLinked.reduce((s, dd) => s + (Number(dd.monthly) || 0), 0) + pmt;
                        const newBalTotal = otherLinked.reduce((s, dd) => s + (Number(dd.balance) || 0), 0) + bal;
                        setReos(prev => prev.map(rr => rr.id === r.id ? { ...rr, payment: newPmtTotal, mortgageBalance: newBalTotal } : rr));
                      }} style={{
                        background: `${ACCENT}20`, border: "none", borderRadius: 6, padding: "3px 8px",
                        fontSize: 10, color: ACCENT, cursor: "pointer", fontWeight: 700, fontFamily: FONT,
                      }}>Link</button>
                    </div>
                  ))}
                </div>
              )}
              {linked.length === 0 && unlinkable.length === 0 && !debtFree && (
                <div style={{ fontSize: 11, color: T.textTertiary }}>
                  Add Mortgage or HELOC debts on the Debts tab first, then link them here.
                </div>
              )}
            </div>

            {/* Equity / LTV summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingTop: 6, paddingBottom: 2 }}>
              <div>
                <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Equity</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: equity >= 0 ? T.green : T.red, fontFamily: MONO, letterSpacing: "-0.02em" }}>{fmt(equity)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>LTV</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: MONO, letterSpacing: "-0.02em" }}>{r.value > 0 ? `${ltv.toFixed(1)}%` : "—"}</div>
              </div>
            </div>

            {/* Cash flow + DTI impact */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingTop: 8, borderTop: `1px solid ${T.separator}`, marginTop: 8 }}>
              <div>
                <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Cash Flow</span>
                <div style={{ fontSize: 15, fontWeight: 700, color: cashFlow >= 0 ? T.green : T.red, fontFamily: MONO }}>{fmt(cashFlow)}/mo</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>DTI Impact</span>
                <div style={{ fontSize: 15, fontWeight: 700, color: dtiImpact >= 0 ? T.green : T.orange, fontFamily: MONO }}>{dtiImpact >= 0 ? "+" : ""}{fmt(dtiImpact)}/mo</div>
                {isInvestment && (Number(r.rentalIncome) || 0) > 0 && (
                  <div style={{ fontSize: 10, color: T.textTertiary, fontFamily: MONO }}>75% of {fmt(Number(r.rentalIncome) || 0)}</div>
                )}
              </div>
            </div>

            {/* Remove button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={() => removeReo(r.id)} style={{
                background: T.errorBg, border: "none", borderRadius: 9999, padding: "6px 16px",
                fontSize: 12, color: T.red, cursor: "pointer", fontFamily: FONT, fontWeight: 600,
              }}>Remove</button>
            </div>
          </Card>
        </Sec>
      );
    })}

    {/* ─── Add Property CTA ─── */}
    <div data-field="add-reo" className={isPulse ? isPulse("add-reo") : ""} style={{ borderRadius: 14, transition: "all 0.3s", marginTop: 10 }}>
      <button onClick={addReo} style={{
        width: "100%", padding: 14, background: `${ACCENT}15`,
        border: `1px dashed ${ACCENT}55`, borderRadius: 12,
        color: ACCENT, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT,
      }}>+ Add Property</button>
    </div>

    {GuidedNextButton && <GuidedNextButton />}
  </>);
}
