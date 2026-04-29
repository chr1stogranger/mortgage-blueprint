import React from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

const OWNER_OPTIONS = [
  { value: "Borrower", label: "Borrower" },
  { value: "Co-Borrower", label: "Co-Borrower" },
  { value: "Joint", label: "Joint" },
];

export default function AssetsContent({
  T, isDesktop, calc, fmt, assets, addAsset, updateAsset, removeAsset,
  Hero, Card, Progress, Sec, TextInp, Inp, Sel, Note,
  RESERVE_FACTORS, ASSET_TYPES, getReserveFactor, loanType,
  guideField, isPulse, GuidedNextButton,
}) {
  // Defensive default — if AssetsContent renders before getReserveFactor wires through,
  // fall back to the static factors so the math still works.
  const rf = (type) => typeof getReserveFactor === "function"
    ? getReserveFactor(type, loanType)
    : (RESERVE_FACTORS[type] ?? 1);

  const totalValue = assets.reduce((s, a) => s + (a.value || 0), 0);
  const totalForClosing = assets.reduce((s, a) => s + (a.forClosing || 0), 0);
  const totalReserves = assets.reduce((s, a) => {
    const remaining = Math.max(0, (a.value || 0) - (a.forClosing || 0));
    return s + remaining * rf(a.type);
  }, 0);

  const closingDiff = totalForClosing - calc.cashToClose;
  const reservesDiff = totalReserves - calc.reservesReq;

  const onAdd = () => {
    addAsset();
    setTimeout(() => {
      const cards = document.querySelectorAll('[data-asset-row]');
      if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  return (<>
    <div data-field="assets-section" style={{ marginTop: 20, marginBottom: 12 }}>
      <Hero value={fmt(calc.totalAssetValue)} label="Total Assets" color={T.cyan} />
    </div>

    {/* ─── DESKTOP: tabular ─── */}
    {isDesktop ? (
      <Sec title="Assets">
        <Card>
          {/* Header row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1.2fr 0.7fr 1fr 32px",
            gap: 8,
            paddingBottom: 8,
            borderBottom: `1px solid ${T.separator}`,
            fontSize: 10, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase",
            color: T.textTertiary, fontWeight: 700,
          }}>
            <span>Bank Name</span>
            <span>Owner</span>
            <span>Type</span>
            <span style={{ textAlign: "right" }}>Current Value</span>
            <span style={{ textAlign: "right" }}>For Closing</span>
            <span style={{ textAlign: "right" }}>Factor</span>
            <span style={{ textAlign: "right" }}>For Reserves</span>
            <span></span>
          </div>

          {/* Rows */}
          {assets.length === 0 ? (
            <div data-field="add-asset" className={isPulse("add-asset")} style={{ padding: "20px 0", textAlign: "center" }}>
              <button onClick={onAdd} style={{ background: "none", border: `2px dashed ${T.separator}`, color: T.blue, fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "16px 24px", borderRadius: 12, fontFamily: FONT }}>
                + Add Asset Account
              </button>
            </div>
          ) : (
            assets.map((a, aIdx) => {
              const factor = rf(a.type);
              const factorPct = (factor * 100).toFixed(0) + "%";
              const remaining = Math.max(0, (a.value || 0) - (a.forClosing || 0));
              const reserveAmt = remaining * factor;
              const isGift = a.type === "Gift" || a.type === "Gift of Equity";
              return (
                <div key={a.id} data-asset-row data-field={aIdx === 0 ? (guideField === "asset-closing" ? "asset-closing" : "asset-value") : undefined} className={aIdx === 0 ? (isPulse("asset-value") || isPulse("asset-closing")) : ""}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1.2fr 0.7fr 1fr 32px",
                    gap: 8,
                    padding: "10px 0",
                    borderBottom: `1px solid ${T.separator}`,
                    alignItems: "center",
                    transition: "all 0.3s",
                  }}>
                  <TextInp value={a.bank} onChange={v => updateAsset(a.id, "bank", v)} sm placeholder="e.g. Chase" />
                  <Sel value={a.owner || ""} onChange={v => updateAsset(a.id, "owner", v)} options={[{ value: "", label: "—" }, ...OWNER_OPTIONS]} sm />
                  <Sel value={a.type} onChange={v => updateAsset(a.id, "type", v)} options={ASSET_TYPES.map(t => ({ value: t, label: t }))} sm />
                  <Inp value={a.value} onChange={v => updateAsset(a.id, "value", v)} sm />
                  <Inp value={a.forClosing} onChange={v => updateAsset(a.id, "forClosing", v)} sm />
                  <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, fontFamily: FONT, color: isGift ? T.orange : T.text }}>
                    {factorPct}
                  </div>
                  <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, fontFamily: FONT, color: reserveAmt > 0 ? T.green : T.textTertiary }}>
                    {fmt(reserveAmt)}
                  </div>
                  <button onClick={() => removeAsset(a.id)} aria-label="Remove" style={{ background: "none", border: "none", color: T.textTertiary, fontSize: 16, cursor: "pointer", padding: 4, borderRadius: 4, lineHeight: 1 }}>×</button>
                </div>
              );
            })
          )}

          {/* Totals row */}
          {assets.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1.2fr 0.7fr 1fr 32px",
              gap: 8,
              padding: "12px 0 4px",
              fontSize: 13,
              fontWeight: 700,
              color: T.text,
              borderTop: `2px solid ${T.separator}`,
            }}>
              <span style={{ gridColumn: "1 / 4", color: T.textSecondary, fontWeight: 600 }}>Total Funds</span>
              <span style={{ textAlign: "right", fontFamily: FONT }}>{fmt(totalValue)}</span>
              <span style={{ textAlign: "right", fontFamily: FONT }}>{fmt(totalForClosing)}</span>
              <span></span>
              <span style={{ textAlign: "right", fontFamily: FONT, color: T.green }}>{fmt(totalReserves)}</span>
              <span></span>
            </div>
          )}

          {/* Add row button */}
          {assets.length > 0 && (
            <div style={{ paddingTop: 10 }}>
              <button onClick={onAdd} style={{ width: "100%", padding: 12, background: `${T.blue}10`, border: `1px dashed ${T.blue}44`, borderRadius: 10, color: T.blue, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>
                + Add Asset Account
              </button>
            </div>
          )}
        </Card>
      </Sec>
    ) : (
      /* ─── MOBILE: card-per-account (preserve previous responsive UX) ─── */
      <Sec title="Accounts" action="+ Add" onAction={onAdd}>
        {assets.map((a, aIdx) => {
          const factor = rf(a.type);
          const factorPct = (factor * 100).toFixed(0) + "%";
          const remaining = Math.max(0, (a.value || 0) - (a.forClosing || 0));
          const reserveAmt = remaining * factor;
          return (
            <div key={a.id} data-asset-row data-field={aIdx === 0 ? (guideField === "asset-closing" ? "asset-closing" : "asset-value") : undefined} className={aIdx === 0 ? (isPulse("asset-value") || isPulse("asset-closing")) : ""} style={{ borderRadius: 18, transition: "all 0.3s" }}>
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary }}>Asset Account</span>
                  <button onClick={() => removeAsset(a.id)} style={{ background: "none", border: "none", color: T.red, fontSize: 13, cursor: "pointer" }}>Remove</button>
                </div>
                <TextInp label="Bank / Institution" value={a.bank} onChange={v => updateAsset(a.id, "bank", v)} sm />
                <Sel label="Owner" value={a.owner || ""} onChange={v => updateAsset(a.id, "owner", v)} options={[{ value: "", label: "—" }, ...OWNER_OPTIONS]} sm tip="Whose name the account is in. Joint = both borrowers." />
                <Sel label="Account Type" value={a.type} onChange={v => updateAsset(a.id, "type", v)} options={ASSET_TYPES.map(t => ({ value: t, label: t }))} sm req tip="Where the funds are held. Different account types have different liquidity factors for reserve calculations on Jumbo loans." />
                <Inp label="Current Value" value={a.value} onChange={v => updateAsset(a.id, "value", v)} sm req />
                <Inp label="Funds Used for Closing" value={a.forClosing} onChange={v => updateAsset(a.id, "forClosing", v)} sm tip="How much from this account you'll use for down payment and closing costs. Must be sourced and seasoned (in the account for 2+ months)." />
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13 }}>
                  <span style={{ color: T.textSecondary }}>Reserves Factor</span>
                  <span style={{ fontWeight: 600 }}>{factorPct}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
                  <span style={{ color: T.textSecondary }}>Funds for Reserves</span>
                  <span style={{ fontWeight: 600, fontFamily: FONT, color: reserveAmt > 0 ? T.green : T.textTertiary }}>{fmt(reserveAmt)}</span>
                </div>
              </Card>
            </div>
          );
        })}
        {assets.length === 0 && (
          <div data-field="add-asset" className={isPulse("add-asset")} style={{ borderRadius: 14, transition: "all 0.3s" }}>
            <Card style={{ border: `2px dashed ${T.separator}`, background: "transparent", boxShadow: "none", textAlign: "center", padding: 24 }}>
              <button onClick={onAdd} style={{ background: "none", border: "none", color: T.blue, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>+ Add Asset Account</button>
            </Card>
          </div>
        )}
        {assets.length > 0 && (
          <button onClick={onAdd} style={{ width: "100%", padding: 14, background: `${T.blue}15`, border: `1px dashed ${T.blue}44`, borderRadius: 12, color: T.blue, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: FONT, marginTop: 10 }}>+ Add Another Account</button>
        )}
      </Sec>
    )}

    {/* ─── BOTTOM SUMMARY: Cash to Close + Reserves progress ─── */}
    {assets.length > 0 && (
      <div style={{ marginTop: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 12 }}>
          {/* Cash to Close */}
          <Card pad={16}>
            <div style={{ fontSize: 11, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", color: T.textTertiary, fontWeight: 700, marginBottom: 8 }}>Cash to Close</div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
              <span style={{ color: T.textSecondary }}>Total Allocated</span>
              <span style={{ fontFamily: FONT, fontWeight: 600 }}>{fmt(totalForClosing)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
              <span style={{ color: T.textSecondary }}>Funds Need for Transaction</span>
              <span style={{ fontFamily: FONT, fontWeight: 600 }}>{fmt(calc.cashToClose)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 12px", fontSize: 14, borderTop: `1px solid ${T.separator}`, marginTop: 4 }}>
              <span style={{ color: T.text, fontWeight: 700 }}>Difference</span>
              <span style={{ fontFamily: FONT, fontWeight: 700, color: closingDiff >= 0 ? T.green : T.red }}>
                {closingDiff >= 0 ? fmt(closingDiff) : `−${fmt(Math.abs(closingDiff))}`}
              </span>
            </div>
            <Progress value={totalForClosing} max={calc.cashToClose} color={totalForClosing >= calc.cashToClose ? T.green : T.orange} height={10} />
            <div style={{ fontSize: 11, color: closingDiff >= 0 ? T.green : T.orange, fontWeight: 500, marginTop: 6 }}>
              {closingDiff >= 0 ? `✓ Funded — ${fmt(closingDiff)} surplus` : `Need ${fmt(Math.abs(closingDiff))} more`}
            </div>
          </Card>

          {/* Reserves */}
          <Card pad={16}>
            <div style={{ fontSize: 11, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase", color: T.textTertiary, fontWeight: 700, marginBottom: 8 }}>Reserves</div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
              <span style={{ color: T.textSecondary }}>Total Eligible</span>
              <span style={{ fontFamily: FONT, fontWeight: 600 }}>{fmt(totalReserves)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
              <span style={{ color: T.textSecondary }}>Reserves Required ({calc.reserveMonths} mo)</span>
              <span style={{ fontFamily: FONT, fontWeight: 600 }}>{fmt(calc.reservesReq)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 12px", fontSize: 14, borderTop: `1px solid ${T.separator}`, marginTop: 4 }}>
              <span style={{ color: T.text, fontWeight: 700 }}>Difference</span>
              <span style={{ fontFamily: FONT, fontWeight: 700, color: reservesDiff >= 0 ? T.green : T.red }}>
                {reservesDiff >= 0 ? fmt(reservesDiff) : `−${fmt(Math.abs(reservesDiff))}`}
              </span>
            </div>
            <Progress value={totalReserves} max={calc.reservesReq} color={totalReserves >= calc.reservesReq ? T.green : T.orange} height={10} />
            <div style={{ fontSize: 11, color: reservesDiff >= 0 ? T.green : T.orange, fontWeight: 500, marginTop: 6 }}>
              {reservesDiff >= 0 ? `✓ Funded — ${fmt(reservesDiff)} surplus` : `Need ${fmt(Math.abs(reservesDiff))} more`}
            </div>
          </Card>
        </div>

        <Note color={T.blue}>
          {loanType === "Jumbo"
            ? "Jumbo: Reserves factor varies by account type — Checking/Saving 100%, Stocks/Bonds 70%, Retirement 60%, Gift 0%."
            : `${loanType}: All qualifying assets count at 100% toward reserves (Gift excluded).`}
        </Note>
        <div style={{ textAlign: "center", marginTop: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: T.green, fontWeight: 500 }}>✓ All changes auto-saved</span>
        </div>
      </div>
    )}

    <GuidedNextButton />
  </>);
}
