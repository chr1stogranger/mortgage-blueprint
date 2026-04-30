import React, { useState } from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

function AutoBadge({ T }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, color: T.textTertiary, fontFamily: MONO,
      letterSpacing: 1, padding: "2px 5px", border: `1px solid ${T.separator}`,
      borderRadius: 4, marginLeft: 6, lineHeight: 1, whiteSpace: "nowrap",
      display: "inline-flex", alignItems: "center",
    }}>AUTO</span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ReoContent — Real Estate Owned (rebuilt to match Christo's spreadsheet)
   Top: blue-banner Income Analysis table (must-have).
   Below: per-row expand for linked debts / equity / DTI impact details.
   Bottom: Planning-to-sell card + DTI Impact summary card.
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
  Hero, Card, Sec, Inp, Sel, TextInp, Note, Progress,
  REO_PROPERTY_TYPES, REO_OCCUPANCY_TYPES,
  isPulse, markTouched,
  hideHero = false,
  GuidedNextButton,
}) {
  const ACCENT = T.blue;
  const HEAD_BG = `${ACCENT}14`;
  const HEAD_BORDER = `${ACCENT}38`;
  const [expandedRowId, setExpandedRowId] = useState(null);

  const propTypeOpts = (REO_PROPERTY_TYPES || ["Single Family", "Duplex", "Triplex", "4-plex", "Condo", "Townhouse", "PUD", "Land", "Commercial"]).map(t => ({ value: t, label: t }));
  const occupOpts = (REO_OCCUPANCY_TYPES || ["Primary", "Primary (Subj)", "Departing", "Second", "Second (Subj)", "Invest.", "Invest. (Subj)"]).map(t => ({ value: t, label: t }));

  // Per-row derived values
  const computeRow = (r) => {
    const linked = debts.filter(d => d.linkedReoId === String(r.id) && (d.type === "Mortgage" || d.type === "HELOC"));
    const helocLinked = linked.filter(d => d.type === "HELOC");
    const mortLinked = linked.filter(d => d.type === "Mortgage");
    const linkedMortBal = mortLinked.reduce((s, d) => s + (Number(d.balance) || 0), 0);
    const linkedMortPmt = mortLinked.reduce((s, d) => s + (Number(d.monthly) || 0), 0);
    const helocPmt = helocLinked.reduce((s, d) => s + (Number(d.monthly) || 0), 0);
    const helocBal = helocLinked.reduce((s, d) => s + (Number(d.balance) || 0), 0);
    const hasLinked = mortLinked.length > 0;

    const liens = (hasLinked ? linkedMortBal : (Number(r.mortgageBalance) || 0)) + helocBal;
    const value = Number(r.value) || 0;
    const ltv = value > 0 ? (liens / value) * 100 : 0;
    const pi = hasLinked ? linkedMortPmt : (Number(r.payment) || 0);
    const tax = Number(r.reoTax) || 0;
    const ins = Number(r.reoIns) || 0;
    const hoa = Number(r.reoHoa) || 0;
    const expenses = pi + (r.includesTI ? 0 : (tax + ins + hoa)) + helocPmt;
    const income = Number(r.rentalIncome) || 0;
    const net = income - expenses;
    const isInvestment = (r.propUse || "Investment") === "Investment" || (r.occupancy || "").startsWith("Invest");
    const dtiImpact = isInvestment ? (income * 0.75) - expenses : -expenses;
    const equity = value - liens;

    return { linked, mortLinked, helocLinked, liens, ltv, pi, helocPmt, helocBal, expenses, income, net, equity, isInvestment, dtiImpact, hasLinked, linkedMortBal, linkedMortPmt };
  };

  // Aggregate totals across all REOs
  const totals = reos.reduce((acc, r) => {
    const c = computeRow(r);
    acc.value += Number(r.value) || 0;
    acc.liens += c.liens;
    acc.expenses += c.expenses;
    acc.income += c.income;
    acc.net += c.net;
    acc.dtiImpact += c.dtiImpact;
    return acc;
  }, { value: 0, liens: 0, expenses: 0, income: 0, net: 0, dtiImpact: 0 });

  // 15-col grid
  const COLS = "minmax(140px, 1fr) 110px 115px 100px 100px 70px 90px 80px 90px 80px 90px 100px 100px 90px 64px";

  // ─── Empty state — no REOs ───
  if (!reos || reos.length === 0) {
    return (<>
      <div style={{ marginTop: 20 }}>
        <div style={{ border: `1px solid ${T.cardBorder}`, borderRadius: 14, overflow: "hidden", background: T.card }}>
          <div style={{
            background: ACCENT, color: "#fff", padding: "10px 16px",
            fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", fontFamily: MONO,
          }}>Real Estate Owned — Income Analysis</div>
          <div style={{ padding: "28px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>No properties added yet</div>
            <div style={{ fontSize: 12, color: T.textTertiary, marginBottom: 14, lineHeight: 1.5 }}>
              Track primary, second-home, or investment properties here.<br/>
              Investment rentals get the 75% income offset in DTI.
            </div>
            <button onClick={addReo} style={{
              padding: "10px 20px", background: ACCENT, border: "none", borderRadius: 9999,
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
              boxShadow: `0 4px 14px ${ACCENT}30`,
            }}>+ Add Property</button>
          </div>
        </div>
      </div>
      {GuidedNextButton && <GuidedNextButton />}
    </>);
  }

  return (<>
    {/* ─── DESKTOP: tabular Income Analysis ─── */}
    {isDesktop ? (
      <div style={{
        border: `1px solid ${T.cardBorder}`, borderRadius: 14, overflow: "hidden",
        background: T.card, marginTop: 20, marginBottom: 16,
      }}>
        {/* Blue banner */}
        <div style={{
          background: ACCENT, color: "#fff", padding: "10px 16px",
          fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", fontFamily: MONO,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>Real Estate Owned — Income Analysis</span>
          <span style={{ fontSize: 11, opacity: 0.85, fontFamily: MONO, letterSpacing: 0.5 }}>
            {fmt(totals.value)} total value
          </span>
        </div>

        {/* Column headers */}
        <div style={{
          display: "grid", gridTemplateColumns: COLS, gap: 0,
          background: HEAD_BG, borderBottom: `1px solid ${HEAD_BORDER}`,
          padding: "8px 12px",
          fontSize: 10, fontFamily: MONO, fontWeight: 700, letterSpacing: 1,
          textTransform: "uppercase", color: T.textTertiary,
        }}>
          <span>Address</span>
          <span>Type</span>
          <span>Occup.</span>
          <span style={{ textAlign: "right" }}>Value</span>
          <span style={{ textAlign: "right" }}>Liens</span>
          <span style={{ textAlign: "right" }}>LTV</span>
          <span style={{ textAlign: "right" }}>P&amp;I</span>
          <span style={{ textAlign: "right" }}>Tax</span>
          <span style={{ textAlign: "right" }}>Insurance</span>
          <span style={{ textAlign: "right" }}>HOA</span>
          <span style={{ textAlign: "right" }}>HELOC</span>
          <span style={{ textAlign: "right" }}>Expenses</span>
          <span style={{ textAlign: "right" }}>Income</span>
          <span style={{ textAlign: "right" }}>Net</span>
          <span></span>
        </div>

        {/* Rows */}
        {reos.map((r) => {
          const c = computeRow(r);
          const isExpanded = expandedRowId === r.id;
          const piMerged = r.includesTI;
          return (
            <React.Fragment key={r.id}>
              <div style={{
                display: "grid", gridTemplateColumns: COLS, gap: 0,
                padding: "8px 12px", borderBottom: `1px solid ${T.separator}`,
                alignItems: "center",
                background: isExpanded ? `${ACCENT}06` : "transparent",
              }}>
                <TextInp value={r.address} onChange={v => updateReo(r.id, "address", v)} placeholder="123 Main St" sm />
                <Sel value={r.propType || "Single Family"} onChange={v => updateReo(r.id, "propType", v)} options={propTypeOpts} sm />
                <Sel value={r.occupancy || "Invest."} onChange={v => updateReo(r.id, "occupancy", v)} options={occupOpts} sm />
                <Inp value={r.value} onChange={v => updateReo(r.id, "value", v)} sm />
                {/* Liens */}
                {c.hasLinked ? (
                  <div style={{ textAlign: "right", fontSize: 12, fontFamily: FONT, fontWeight: 600, color: T.text, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                    {fmt(c.liens)}<AutoBadge T={T} />
                  </div>
                ) : (
                  <Inp value={r.mortgageBalance} onChange={v => updateReo(r.id, "mortgageBalance", v)} sm />
                )}
                {/* LTV */}
                <div style={{ textAlign: "right", fontSize: 12, fontFamily: FONT, fontWeight: 600, color: c.ltv > 80 ? T.orange : T.text }}>
                  {Number(r.value) > 0 ? `${c.ltv.toFixed(0)}%` : "—"}
                </div>
                {/* P&I — when piMerged: span 4 cols across P&I+Tax+Ins+HOA */}
                {piMerged ? (
                  <div style={{ gridColumn: "span 4", display: "flex", alignItems: "center", gap: 6 }}>
                    {c.hasLinked ? (
                      <div style={{ flex: 1, textAlign: "right", fontSize: 12, fontFamily: FONT, fontWeight: 600 }}>
                        {fmt(c.pi)}<AutoBadge T={T} />
                      </div>
                    ) : (
                      <div style={{ flex: 1 }}>
                        <Inp value={r.payment} onChange={v => updateReo(r.id, "payment", v)} sm />
                      </div>
                    )}
                    <span title="Payment includes Tax / Ins / HOA — click to split"
                      onClick={() => updateReo(r.id, "includesTI", false)}
                      style={{ fontSize: 9, fontWeight: 700, color: T.green, fontFamily: MONO, letterSpacing: 0.5, padding: "2px 6px", border: `1px solid ${T.green}55`, borderRadius: 4, textTransform: "uppercase", whiteSpace: "nowrap", cursor: "pointer" }}>PITIA</span>
                  </div>
                ) : (
                  <>
                    {c.hasLinked ? (
                      <div style={{ textAlign: "right", fontSize: 12, fontFamily: FONT, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                        {fmt(c.pi)}<AutoBadge T={T} />
                      </div>
                    ) : (
                      <Inp value={r.payment} onChange={v => updateReo(r.id, "payment", v)} sm />
                    )}
                    <Inp value={r.reoTax} onChange={v => updateReo(r.id, "reoTax", v)} sm />
                    <Inp value={r.reoIns} onChange={v => updateReo(r.id, "reoIns", v)} sm />
                    <Inp value={r.reoHoa} onChange={v => updateReo(r.id, "reoHoa", v)} sm />
                  </>
                )}
                {/* HELOC — auto from linked HELOC debts */}
                <div style={{ textAlign: "right", fontSize: 12, fontFamily: FONT, fontWeight: 600, color: c.helocPmt > 0 ? T.text : T.textTertiary, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  {c.helocPmt > 0 ? <>{fmt(c.helocPmt)}<AutoBadge T={T} /></> : "—"}
                </div>
                {/* Expenses — auto */}
                <div style={{ textAlign: "right", fontSize: 12, fontFamily: FONT, fontWeight: 700, color: T.text, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  {fmt(c.expenses)}<AutoBadge T={T} />
                </div>
                {/* Income */}
                <Inp value={r.rentalIncome} onChange={v => updateReo(r.id, "rentalIncome", v)} sm />
                {/* Net — auto */}
                <div style={{ textAlign: "right", fontSize: 13, fontFamily: FONT, fontWeight: 700, color: c.net >= 0 ? T.green : T.red }}>
                  {fmt(c.net)}
                </div>
                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                  <button onClick={() => setExpandedRowId(isExpanded ? null : r.id)} aria-label="Toggle details" style={{
                    width: 22, height: 22, borderRadius: 4,
                    background: isExpanded ? `${ACCENT}20` : "transparent",
                    border: `1px solid ${T.separator}`, color: T.textSecondary,
                    fontSize: 12, lineHeight: 1, cursor: "pointer", padding: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{isExpanded ? "−" : "+"}</button>
                  <button onClick={() => removeReo(r.id)} aria-label="Remove" style={{
                    width: 22, height: 22, borderRadius: 4,
                    background: "transparent", border: "none", color: T.textTertiary,
                    fontSize: 14, lineHeight: 1, cursor: "pointer", padding: 0,
                  }}>×</button>
                </div>
              </div>

              {/* Expand panel — linked debts UI + equity/cash flow detail */}
              {isExpanded && (
                <div style={{ padding: "14px 20px", background: `${ACCENT}06`, borderBottom: `1px solid ${T.separator}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.textTertiary, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                        Linked Debts ({c.linked.length})
                      </div>
                      {c.linked.length === 0 && (
                        <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 8 }}>
                          Link Mortgage or HELOC debts so payments don't double-count in DTI.
                        </div>
                      )}
                      {c.linked.map(d => (
                        <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 12, color: T.textSecondary }}>
                          <span>{d.type}{d.name ? ` — ${d.name}` : ""} · <span style={{ fontFamily: FONT, fontWeight: 600 }}>{fmt(d.monthly)}/mo</span></span>
                          <button onClick={() => calc.updateDebt(d.id, "linkedReoId", "")} style={{
                            background: `${T.red}15`, border: "none", borderRadius: 6, padding: "3px 8px",
                            fontSize: 10, color: T.red, cursor: "pointer", fontWeight: 700, fontFamily: FONT,
                          }}>Unlink</button>
                        </div>
                      ))}
                      {(() => {
                        const reoIdStr = String(r.id);
                        const unlinkable = debts.filter(d => (d.type === "Mortgage" || d.type === "HELOC") && !d.linkedReoId);
                        if (unlinkable.length === 0) return null;
                        return (
                          <div style={{ borderTop: `1px solid ${T.separator}`, marginTop: 8, paddingTop: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary, marginBottom: 4 }}>Available to link:</div>
                            {unlinkable.map(d => (
                              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 12, color: T.textSecondary }}>
                                <span>{d.type}{d.name ? ` — ${d.name}` : ""} · <span style={{ fontFamily: FONT, fontWeight: 600 }}>{fmt(d.monthly)}/mo</span></span>
                                <button onClick={() => calc.updateDebt(d.id, "linkedReoId", reoIdStr)} style={{
                                  background: `${ACCENT}20`, border: "none", borderRadius: 6, padding: "3px 8px",
                                  fontSize: 10, color: ACCENT, cursor: "pointer", fontWeight: 700, fontFamily: FONT,
                                }}>Link</button>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.textTertiary, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                        DTI &amp; Equity
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                        <div>
                          <div style={{ color: T.textSecondary, fontSize: 11 }}>Equity</div>
                          <div style={{ fontFamily: FONT, fontWeight: 700, color: c.equity >= 0 ? T.green : T.red, fontSize: 14 }}>{fmt(c.equity)}</div>
                        </div>
                        <div>
                          <div style={{ color: T.textSecondary, fontSize: 11 }}>LTV</div>
                          <div style={{ fontFamily: FONT, fontWeight: 700, color: T.text, fontSize: 14 }}>{Number(r.value) > 0 ? `${c.ltv.toFixed(1)}%` : "—"}</div>
                        </div>
                        <div>
                          <div style={{ color: T.textSecondary, fontSize: 11 }}>Cash Flow</div>
                          <div style={{ fontFamily: FONT, fontWeight: 700, color: c.net >= 0 ? T.green : T.red, fontSize: 14 }}>{fmt(c.net)}/mo</div>
                        </div>
                        <div>
                          <div style={{ color: T.textSecondary, fontSize: 11 }}>DTI Impact</div>
                          <div style={{ fontFamily: FONT, fontWeight: 700, color: c.dtiImpact >= 0 ? T.green : T.orange, fontSize: 14 }}>{c.dtiImpact >= 0 ? "+" : ""}{fmt(c.dtiImpact)}/mo</div>
                          {c.isInvestment && c.income > 0 && (
                            <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 2 }}>75% of {fmt(c.income)} − expenses</div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0 0", marginTop: 10, borderTop: `1px solid ${T.separator}` }}>
                        <span style={{ fontSize: 12, color: T.textSecondary }}>Payment includes Tax, Ins &amp; HOA?</span>
                        <div onClick={() => updateReo(r.id, "includesTI", !r.includesTI)} style={{ width: 44, height: 24, borderRadius: 99, background: r.includesTI ? T.green : T.inputBg, cursor: "pointer", padding: 2, transition: "all 0.3s", flexShrink: 0 }}>
                          <div style={{ width: 20, height: 20, borderRadius: 99, background: "#fff", transform: r.includesTI ? "translateX(20px)" : "translateX(0)", transition: "transform 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}

        {/* Totals row */}
        <div style={{
          display: "grid", gridTemplateColumns: COLS, gap: 0,
          padding: "10px 12px", background: T.inputBg,
          borderTop: `1px solid ${HEAD_BORDER}`,
          alignItems: "center",
          fontSize: 12, fontWeight: 700, fontFamily: MONO, letterSpacing: 0.5,
          textTransform: "uppercase", color: T.text,
        }}>
          <span style={{ gridColumn: "1 / 4" }}>Total Rental Income / Loss</span>
          <span style={{ textAlign: "right", fontFamily: FONT }}>{fmt(totals.value)}</span>
          <span style={{ textAlign: "right", fontFamily: FONT }}>{fmt(totals.liens)}</span>
          <span></span>
          <span style={{ gridColumn: "7 / 12" }}></span>
          <span style={{ textAlign: "right", fontFamily: FONT }}>{fmt(totals.expenses)}</span>
          <span style={{ textAlign: "right", fontFamily: FONT }}>{fmt(totals.income)}</span>
          <span style={{ textAlign: "right", fontFamily: FONT, color: totals.net >= 0 ? T.green : T.red, fontSize: 13 }}>{fmt(totals.net)}</span>
          <span></span>
        </div>

        <div style={{ padding: "10px 12px" }}>
          <button onClick={addReo} style={{
            width: "100%", padding: 12, background: `${ACCENT}10`,
            border: `1px dashed ${ACCENT}44`, borderRadius: 10,
            color: ACCENT, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FONT,
          }}>+ Add Property</button>
        </div>
      </div>
    ) : (
      // ─── MOBILE: card-per-property ───
      <div style={{ marginTop: 20 }}>
        {reos.map((r, i) => {
          const c = computeRow(r);
          return (
            <div key={r.id} style={{ border: `1px solid ${T.cardBorder}`, borderRadius: 14, marginBottom: 12, overflow: "hidden", background: T.card }}>
              <div style={{ background: ACCENT, color: "#fff", padding: "8px 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: MONO, display: "flex", justifyContent: "space-between" }}>
                <span>{r.address || `Property ${i + 1}`}</span>
                <button onClick={() => removeReo(r.id)} style={{ background: "none", border: "none", color: "#fff", fontSize: 13, cursor: "pointer", opacity: 0.85 }}>Remove</button>
              </div>
              <div style={{ padding: "12px 14px" }}>
                <TextInp label="Address" value={r.address} onChange={v => updateReo(r.id, "address", v)} sm />
                <Sel label="Type" value={r.propType || "Single Family"} onChange={v => updateReo(r.id, "propType", v)} options={propTypeOpts} sm />
                <Sel label="Occup." value={r.occupancy || "Invest."} onChange={v => updateReo(r.id, "occupancy", v)} options={occupOpts} sm />
                <Inp label="Value" value={r.value} onChange={v => updateReo(r.id, "value", v)} sm />
                <Inp label="Liens" value={c.hasLinked ? c.liens : r.mortgageBalance} onChange={v => c.hasLinked ? syncReoBalance(r.id, v) : updateReo(r.id, "mortgageBalance", v)} sm />
                <Inp label={c.hasLinked ? "P&I (linked)" : (r.includesTI ? "Payment (PITIA)" : "P&I")} value={c.hasLinked ? c.pi : r.payment} onChange={v => c.hasLinked ? syncReoPayment(r.id, v) : updateReo(r.id, "payment", v)} sm />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                  <span style={{ fontSize: 12, color: T.textSecondary }}>Includes Tax/Ins/HOA?</span>
                  <div onClick={() => updateReo(r.id, "includesTI", !r.includesTI)} style={{ width: 44, height: 24, borderRadius: 99, background: r.includesTI ? T.green : T.inputBg, cursor: "pointer", padding: 2 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 99, background: "#fff", transform: r.includesTI ? "translateX(20px)" : "translateX(0)", transition: "transform 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                  </div>
                </div>
                {!r.includesTI && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <Inp label="Tax" value={r.reoTax} onChange={v => updateReo(r.id, "reoTax", v)} sm />
                    <Inp label="Ins" value={r.reoIns} onChange={v => updateReo(r.id, "reoIns", v)} sm />
                    <Inp label="HOA" value={r.reoHoa} onChange={v => updateReo(r.id, "reoHoa", v)} sm />
                  </div>
                )}
                <Inp label="Rental Income" value={r.rentalIncome} onChange={v => updateReo(r.id, "rentalIncome", v)} sm />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                  <div>
                    <span style={{ fontSize: 11, color: T.textTertiary }}>Net Cash Flow</span>
                    <div style={{ fontWeight: 700, color: c.net >= 0 ? T.green : T.red, fontFamily: FONT }}>{fmt(c.net)}/mo</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: T.textTertiary }}>DTI Impact</span>
                    <div style={{ fontWeight: 700, color: c.dtiImpact >= 0 ? T.green : T.orange, fontFamily: FONT }}>{c.dtiImpact >= 0 ? "+" : ""}{fmt(c.dtiImpact)}/mo</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <button onClick={addReo} style={{
          width: "100%", padding: 14, background: `${ACCENT}15`,
          border: `1px dashed ${ACCENT}55`, borderRadius: 12,
          color: ACCENT, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT,
        }}>+ Add Property</button>
      </div>
    )}

    {/* ─── Planning to sell card ─── */}
    {setHasSellProperty && (
      <Card>
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Planning to sell a property?</span>
          <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>Pick which one to unlock the Seller Net calculator</div>
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
              setSellPrimaryRes && setSellPrimaryRes((reo.propUse || "") === "Primary");
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
            <div style={{ fontSize: 11, color: T.green, marginTop: 4, fontWeight: 500 }}>
              ✓ Seller Net unlocked — linked to {reo.address || "selected property"}
            </div>
          ) : null;
        })()}
        {hasSellProperty && !sellLinkedReoId && (
          <div style={{ fontSize: 11, color: T.green, marginTop: 4, fontWeight: 500 }}>
            ✓ Seller Net unlocked — manual entry mode
          </div>
        )}
      </Card>
    )}

    {/* ─── Bottom REO summary card ─── */}
    <Card pad={16}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", color: T.textTertiary, fontWeight: 700 }}>REO DTI Impact</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FONT, color: totals.dtiImpact >= 0 ? T.green : T.orange, letterSpacing: "-0.02em", marginTop: 2 }}>
            {totals.dtiImpact >= 0 ? "+" : ""}{fmt(totals.dtiImpact)}<span style={{ fontSize: 13, color: T.textTertiary, fontWeight: 600 }}>/mo</span>
          </div>
          <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>
            {totals.dtiImpact >= 0 ? "Net positive — adds to qualifying income" : "Net negative — adds to monthly debt obligations"}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, paddingTop: 12, borderTop: `1px solid ${T.separator}`, marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: MONO, color: T.textTertiary, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 700 }}>Total Value</div>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT, marginTop: 2 }}>{fmt(totals.value)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontFamily: MONO, color: T.textTertiary, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 700 }}>Total Liens</div>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT, marginTop: 2, color: T.red }}>{fmt(totals.liens)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontFamily: MONO, color: T.textTertiary, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 700 }}>Total Equity</div>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT, marginTop: 2, color: T.green }}>{fmt(totals.value - totals.liens)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontFamily: MONO, color: T.textTertiary, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 700 }}>Net Cash Flow</div>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT, marginTop: 2, color: totals.net >= 0 ? T.green : T.red }}>{fmt(totals.net)}/mo</div>
        </div>
      </div>
      <Note color={T.blue}>
        DTI rule: Investment properties get 75% of gross rent netted against PITIA. Primary &amp; second-home PITIA counts as full debt.
      </Note>
    </Card>

    {GuidedNextButton && <GuidedNextButton />}
  </>);
}
