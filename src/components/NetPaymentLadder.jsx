import { FONT } from "../lib/fonts.js";
import React from "react";

/* ═══════════════════════════════════════════════════════════════
   NET PAYMENT LADDER
   The walkdown from full PITIA to the true net cost of owning:

     Full Payment (PITIA)
     − Rental Income (75%)      → Net Payment
     − Tax Savings (Yr 1)       → After-Tax Cash Flow
     − Principal Reduction      → Adjusted Housing Expense
     − Appreciation             → True Net Cost

   Every term comes from the calc memo in MortgageBlueprint.jsx
   ("Net-payment ladder — SINGLE SOURCE OF TRUTH"). Do NOT recompute
   any of them here or in a caller — three copies of this math had
   already drifted apart before this component existed.

   Rendered in two places:
     • variant="compact" — the Advanced disclosure under Payment Breakdown.
       Rent and Net Payment already sit in that card (2026-10-27), so the
       compact ladder opens AT Net Payment instead of repeating the rent step.
     • variant="full"    — the bottom of the Tax Savings section
   Renders bare rows (no card wrapper) so each caller supplies its own
   surface.
   ═══════════════════════════════════════════════════════════════ */
export default function NetPaymentLadder({
  T, fmt, calc,
  appreciationRate, setAppreciationRate,
  subjectRentalIncome = 0,
  includeEscrow = true,
  variant = "compact",
}) {
  const compact = variant === "compact";
  const pad = compact ? 8 : 10;

  const rentCredit = calc.ladderRentCredit || 0;
  const taxSavings = calc.ladderTaxSavings || 0;
  const netCost = calc.netPostSaleExpense || 0;

  // Rental primary: Year-1 tax nets Schedule A (occupied share) and the rented
  // side's Schedule E result, which can be a cost when the rental shows a profit.
  const rentalTax = (calc.rentalTaxEffect || 0) / 12;
  const hasRentalTax = calc.isRentalPrimary && (calc.schedETaxableNow || 0) !== 0;
  const schedANote = hasRentalTax
    ? `Schedule A (the ${100 - (calc.rentalSharePct || 0)}% you live in) saves ${fmt(calc.monthlyTaxSavings || 0)}. Schedule E (the rented ${calc.rentalSharePct || 0}%) ${rentalTax >= 0 ? `saves ${fmt(rentalTax)}: its loss after depreciation offsets other income` : `costs ${fmt(-rentalTax)}: its profit is taxable`}.`
    : null;

  // A deduction line — indented, green, always shown with a leading minus.
  // A negative value is a cost instead (tax owed on rental profit): "+", orange.
  const Deduct = ({ label, value, note }) => (
    <div style={{ padding: `${pad}px 0 ${pad}px 16px`, borderBottom: `1px solid ${T.separator}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
        <span style={{ color: T.textSecondary, fontFamily: FONT }}>{value < 0 ? "+" : "−"} {label}</span>
        <span style={{ fontFamily: FONT, fontWeight: 600, color: value < 0 ? T.orange : T.green }}>{value < 0 ? "+" : "−"}{fmt(Math.abs(value))}</span>
      </div>
      {note && (
        <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 3, lineHeight: 1.5, fontFamily: FONT }}>{note}</div>
      )}
    </div>
  );

  // A running subtotal — tinted band, the number the client actually repeats back.
  const Subtotal = ({ label, value, tint, strong }) => (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: strong ? "14px" : "12px", borderRadius: strong ? 12 : 10, marginTop: 4,
      background: `${tint}${strong ? "18" : "0C"}`,
      border: strong ? `1.5px solid ${tint}55` : "none",
      fontSize: strong ? 15 : 14,
    }}>
      <span style={{ color: T.text, fontWeight: 700, fontFamily: FONT }}>{label}</span>
      <span style={{
        fontFamily: FONT, fontWeight: strong ? 800 : 700, color: T.text,
        fontSize: strong ? 18 : 14, letterSpacing: strong ? "-0.02em" : 0,
      }}>{fmt(value)}</span>
    </div>
  );

  // Compact + rent: the card above already shows Total − rent = Net Payment.
  const opensAtNet = compact && rentCredit > 0;

  return (
    <div>
      {opensAtNet ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: `${pad + 2}px 0`, borderBottom: `1px solid ${T.separator}`, fontSize: 14 }}>
          <span style={{ color: T.text, fontWeight: 600, fontFamily: FONT }}>
            Net Payment
            <span style={{ fontSize: 11, fontWeight: 500, color: T.textTertiary, marginLeft: 6 }}>
              {includeEscrow ? "from above" : `full PITIA ${fmt(calc.housingPayment)} − rent`}
            </span>
          </span>
          <span style={{ fontFamily: FONT, fontWeight: 700, color: T.text }}>{fmt(calc.netPayment)}</span>
        </div>
      ) : (<>
      {/* Opening line — full PITIA, not displayPayment. Taxes and insurance are
          real monthly cost even when the loan has no escrow account. */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${pad + 2}px 0`, borderBottom: `1px solid ${T.separator}`, fontSize: 14 }}>
        <span style={{ color: T.text, fontWeight: 600, fontFamily: FONT }}>Full Payment (PITIA)</span>
        <span style={{ fontFamily: FONT, fontWeight: 700, color: T.text }}>{fmt(calc.housingPayment)}</span>
      </div>
      {!includeEscrow && (
        <div style={{ fontSize: 11, color: T.textTertiary, padding: "6px 0 0", lineHeight: 1.5, fontFamily: FONT }}>
          Your loan has no escrow account, but tax and insurance are still monthly cost. The ladder starts from the full payment.
        </div>
      )}

      {/* 1. Rent — the only step that puts cash back in the borrower's pocket
             every month. The other three are tax, equity and paper wealth. */}
      {rentCredit > 0 && (<>
        <Deduct
          label="Rental Income"
          value={rentCredit}
          note={`Full gross rent: what actually lands in your account. Lenders count only 75% (${fmt(rentCredit * 0.75)}) when qualifying you for the loan, but that haircut is an underwriting rule, not an expense. Vacancy and upkeep will still take a bite out of this.`}
        />
        <Subtotal label="Net Payment" value={calc.netPayment} tint={T.blue} />
      </>)}
      </>)}

      {/* 2. Tax savings → after-tax cash flow */}
      {(taxSavings > 0 || (hasRentalTax && taxSavings !== 0)) && (<>
        <Deduct label={taxSavings < 0 ? "Tax on Rental Income (Yr 1)" : "Tax Savings (Yr 1)"} value={taxSavings} note={schedANote} />
        <Subtotal label="After-Tax Cash Flow" value={calc.afterTaxPayment} tint={T.green} />
      </>)}
      {calc.isInvestment && (
        <div style={{ fontSize: 11, color: T.textTertiary, padding: "10px 0 0 16px", lineHeight: 1.6, fontFamily: FONT }}>
          Tax savings aren't shown here. An investment property deducts through Schedule E, not the itemized primary-residence deductions. See the Schedule E pro forma in Tax Savings.
        </div>
      )}

      {/* 3. Principal → adjusted housing expense */}
      <Deduct label="Principal Reduction" value={calc.monthlyPrinReduction} />
      <Subtotal label="Adjusted Housing Expense" value={calc.adjustedHousingExpense} tint={T.blue} />

      {/* 4. Appreciation → true net cost. Rate is editable right here so the
             conversation can run the number at 2% / 3% / 5% live. */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${pad}px 0 ${pad}px 16px`, borderBottom: `1px solid ${T.separator}`, fontSize: 13, marginTop: 4 }}>
        <span style={{ color: T.textSecondary, fontFamily: FONT }}>Annual Appreciation</span>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 2, background: T.pillBg, borderRadius: 99, padding: "2px 4px" }}>
          <button
            onClick={() => setAppreciationRate(Math.max(0, Number((( appreciationRate || 0) - 0.5).toFixed(1))))}
            aria-label="Decrease appreciation rate"
            style={{ background: "none", border: "none", color: T.textSecondary, fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "2px 8px", fontFamily: FONT, lineHeight: 1 }}
          >−</button>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.green, minWidth: 40, textAlign: "center", fontFamily: FONT }}>{appreciationRate || 0}%</span>
          <button
            onClick={() => setAppreciationRate(Math.min(15, Number((( appreciationRate || 0) + 0.5).toFixed(1))))}
            aria-label="Increase appreciation rate"
            style={{ background: "none", border: "none", color: T.textSecondary, fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "2px 8px", fontFamily: FONT, lineHeight: 1 }}
          >+</button>
        </div>
      </div>
      <Deduct label="Monthly Appreciation" value={calc.monthlyAppreciation} />

      <Subtotal label="True Net Cost of Owning" value={netCost} tint={netCost < 0 ? T.green : T.blue} strong />

      {netCost < 0 && (
        <div style={{ fontSize: compact ? 11 : 12, color: T.green, fontWeight: 600, lineHeight: 1.6, marginTop: 8, fontFamily: FONT }}>
          Negative means the property builds wealth faster than it costs to own. Rent, tax savings, equity and appreciation together more than cover the payment.
        </div>
      )}

      <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.6, marginTop: 10, fontFamily: FONT }}>
        Year-1 estimate. Tax savings decline as the loan amortizes, principal reduction grows, and appreciation is a projection, not a guarantee. Not tax advice.
      </div>
    </div>
  );
}
