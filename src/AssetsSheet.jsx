import React from "react";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";
const ASSET_TYPES = ["Checking", "Saving", "Money Market", "Mutual Fund", "Stocks", "Bonds", "Retirement", "Gift", "Gift of Equity", "Trust", "Bridge Loan", "Other"];
const RESERVE_FACTORS = { Checking: 1, Saving: 1, "Money Market": 1, "Mutual Fund": 1, Stocks: 0.7, Bonds: 0.7, Retirement: 0.6, Gift: null, "Gift of Equity": null, Trust: 1, "Bridge Loan": 1, Other: 1 };

function fmt(v) {
  if (v == null || !isFinite(v) || isNaN(v)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

function SheetCard({ children, T, style }) {
  return (
    <div style={{ background: T.card, borderRadius: 16, padding: 18, boxShadow: T.cardShadow, marginBottom: 12, ...style }}>
      {children}
    </div>
  );
}

export default function AssetsSheet({
  assets, addAsset, updateAsset, removeAsset,
  T, Inp, Sel, TextInp, Note, calc, Progress,
}) {
  return (
    <div>
      {/* Hero summary */}
      <div style={{ textAlign: "center", marginBottom: 20, padding: "16px 0 20px", borderBottom: `1px solid ${T.separator}` }}>
        <div style={{ fontSize: 11, fontWeight: 600, fontFamily: MONO, color: T.textTertiary, textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>Total Assets</div>
        <div style={{ fontSize: 32, fontWeight: 800, fontFamily: FONT, color: T.cyan, letterSpacing: "-0.03em" }}>{fmt(calc.totalAssetValue)}</div>
      </div>

      {/* Cash to Close + Reserves summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <SheetCard T={T} style={{ padding: 14, marginBottom: 0 }}>
          <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 4 }}>Cash to Close</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: calc.totalForClosing >= calc.cashToClose ? T.green : T.text, letterSpacing: "-0.02em" }}>{fmt(calc.totalForClosing)}</div>
          <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2, marginBottom: 4 }}>of {fmt(calc.cashToClose)} needed</div>
          <Progress value={calc.totalForClosing} max={calc.cashToClose} color={calc.totalForClosing >= calc.cashToClose ? T.green : T.orange} />
          <div style={{ fontSize: 11, color: calc.totalForClosing >= calc.cashToClose ? T.green : T.orange, fontWeight: 500 }}>
            {calc.totalForClosing >= calc.cashToClose ? `\u2713 Funded \u2014 ${fmt(calc.totalForClosing - calc.cashToClose)} surplus` : `Need ${fmt(calc.cashToClose - calc.totalForClosing)} more`}
          </div>
        </SheetCard>
        <SheetCard T={T} style={{ padding: 14, marginBottom: 0 }}>
          <div style={{ fontSize: 11, color: T.textTertiary, marginBottom: 4 }}>Reserves</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT, color: calc.totalReserves >= calc.reservesReq ? T.green : T.text, letterSpacing: "-0.02em" }}>{fmt(calc.totalReserves)}</div>
          <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2, marginBottom: 4 }}>of {fmt(calc.reservesReq)} needed ({calc.reserveMonths} mo)</div>
          <Progress value={calc.totalReserves} max={calc.reservesReq} color={calc.totalReserves >= calc.reservesReq ? T.green : T.orange} />
          <div style={{ fontSize: 11, color: calc.totalReserves >= calc.reservesReq ? T.green : T.orange, fontWeight: 500 }}>
            {calc.totalReserves >= calc.reservesReq ? `\u2713 Funded \u2014 ${fmt(calc.totalReserves - calc.reservesReq)} surplus` : `Need ${fmt(calc.reservesReq - calc.totalReserves)} more`}
          </div>
        </SheetCard>
      </div>

      {/* Accounts */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: FONT }}>Accounts</span>
        <button onClick={() => { addAsset(); setTimeout(() => { const cards = document.querySelectorAll('[data-asset-card]'); if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100); }} style={{ background: `${T.blue}15`, border: `1px solid ${T.blue}33`, borderRadius: 9999, padding: "6px 14px", color: T.blue, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>+ Add</button>
      </div>

      {assets.map((a) => {
        const rf = RESERVE_FACTORS[a.type];
        const rfLabel = rf === null ? "TBD" : `${(rf * 100).toFixed(0)}%`;
        const reserveAmt = rf === null ? 0 : (a.value - (a.forClosing || 0)) * rf;
        return (
          <SheetCard key={a.id} T={T}>
            <div data-asset-card style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary }}>Asset Account</span>
              <button onClick={() => removeAsset(a.id)} style={{ background: "none", border: "none", color: T.red, fontSize: 13, cursor: "pointer" }}>Remove</button>
            </div>
            <TextInp label="Bank / Institution" value={a.bank} onChange={v => updateAsset(a.id, "bank", v)} sm />
            <Sel label="Account Type" value={a.type} onChange={v => updateAsset(a.id, "type", v)} options={ASSET_TYPES} sm req tip="Where the funds are held. Different account types have different liquidity factors for reserve calculations." />
            <Inp label="Current Value" value={a.value} onChange={v => updateAsset(a.id, "value", v)} sm req />
            <Inp label="Funds Used for Closing" value={a.forClosing} onChange={v => updateAsset(a.id, "forClosing", v)} sm tip="How much from this account you'll use for down payment and closing costs. Must be sourced and seasoned (in the account for 2+ months)." />
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13 }}>
              <span style={{ color: T.textSecondary }}>Reserve Factor</span>
              <span style={{ fontWeight: 600, color: rf === null ? T.orange : T.text }}>{rfLabel}</span>
            </div>
            {rf !== null && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
              <span style={{ color: T.textSecondary }}>Reserves</span>
              <span style={{ fontWeight: 600, fontFamily: FONT, color: T.green }}>{fmt(reserveAmt)}</span>
            </div>}
          </SheetCard>
        );
      })}
      {assets.length === 0 && (
        <SheetCard T={T} style={{ border: `2px dashed ${T.separator}`, background: "transparent", boxShadow: "none", textAlign: "center", padding: 24 }}>
          <button onClick={addAsset} style={{ background: "none", border: "none", color: T.blue, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>+ Add Asset Account</button>
        </SheetCard>
      )}
      {assets.length > 0 && (
        <button onClick={() => { addAsset(); setTimeout(() => { const cards = document.querySelectorAll('[data-asset-card]'); if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100); }} style={{ width: "100%", padding: 14, background: `${T.blue}15`, border: `1px dashed ${T.blue}44`, borderRadius: 12, color: T.blue, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: FONT, marginTop: 10 }}>+ Add Another Account</button>
      )}

      {/* Reserve factors note */}
      <Note>Reserve factors: Checking/Saving 100% · Stocks/Bonds 70% · Retirement 60% · Gift TBD</Note>

      {/* Auto-saved indicator */}
      <div style={{ textAlign: "center", marginTop: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: T.green, fontWeight: 500 }}>{"\u2713"} All changes auto-saved</span>
      </div>
    </div>
  );
}
