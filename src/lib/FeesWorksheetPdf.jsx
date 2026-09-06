// src/lib/FeesWorksheetPdf.jsx
//
// Initial Fees Worksheet — a real, vector PDF built with @react-pdf/renderer.
// Layout mirrors the industry-standard Initial Fees Worksheet (IFW) that
// pricing engines produce, skinned with RealStack branding (Grange blue
// accent, Inter tabular figures). Handles BOTH purchase and refinance scenarios.
//
// Contract: a pure module — every input arrives
// explicitly via props; nothing reads component state. The heavy library is
// only ever loaded through renderWorksheetBlob()'s dynamic import, so the
// main bundle does not grow.
//
// Fonts: brand fonts per the Brand Kit — Inter for labels AND figures
// (digit alignment via Inter's tabular figures; the Kit retired mono
// numerals 2026-07-09), bundled as TTFs in src/assets/fonts.

import React from "react";
import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";
import interRegular from "../assets/fonts/Inter_400Regular.ttf";
import interBold from "../assets/fonts/Inter_700Bold.ttf";

// Brand fonts (Inter throughout — Brand Kit). Bundled
// TTFs ride in the lazy PDF chunk. `new URL`-style asset paths come back as
// file:// URLs under vitest/node — normalize so fontkit can read them there.
const fontSrc = (u) => {
  const s = String(u);
  if (s.startsWith("file://")) return decodeURIComponent(s.slice(7));
  // Under vitest/node, Vite returns root-relative "/src/..." asset paths —
  // resolve them against this module's real disk location for fontkit.
  if (s.startsWith("/src/") && typeof window === "undefined" && typeof process !== "undefined" && process.versions?.node) {
    try { return decodeURIComponent(new URL("../" + s.slice(5), import.meta.url).pathname); } catch { /* fall through */ }
  }
  return s;
};
try {
  Font.register({ family: "Inter", src: fontSrc(interRegular) });
  Font.register({ family: "Inter-Bold", src: fontSrc(interBold) });
  // Money strings shouldn't hyphenate/wrap mid-figure.
  Font.registerHyphenationCallback((word) => [word]);
} catch (e) {
  // If registration fails we render with react-pdf defaults rather than break sends.
  console.error("Worksheet font registration failed:", e);
}

// ── Formatters (PDF always shows real numbers; in-app PRIVACY mode is a
//    display concern and must never redact a borrower-facing document) ──
const usd = (v) =>
  v == null || !isFinite(v) || isNaN(v)
    ? "$0"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
const usd2 = (v) =>
  v == null || !isFinite(v) || isNaN(v)
    ? "$0.00"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

const INDIGO = "#3B6BF5";
const INK = "#171717";
const SUB = "#525252";
const MUTED = "#737373";
const HAIR = "#E8E8E8";
const GREEN = "#12a150";
const TINT = "#EFF3FE"; // indigo @ ~8% on white

const s = StyleSheet.create({
  page: { paddingTop: 18, paddingBottom: 14, paddingHorizontal: 34, fontFamily: "Inter", fontSize: 9, color: INK, backgroundColor: "#FFFFFF" },
  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  loName: { fontFamily: "Inter-Bold", fontSize: 15 },
  loMeta: { fontSize: 8.5, color: SUB, marginTop: 2 },
  hTitle: { fontFamily: "Inter-Bold", fontSize: 19, color: INDIGO, textAlign: "right" },
  hSub: { fontSize: 8.5, color: SUB, textAlign: "right", marginTop: 2 },
  rule: { height: 2, backgroundColor: INDIGO, marginTop: 7, marginBottom: 6 },
  advisory: { fontSize: 8.5, color: SUB, textAlign: "center", marginBottom: 4 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: MUTED, marginBottom: 6 },
  // Loan summary grid
  grid: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: HAIR, backgroundColor: "#FAFAFA", borderRadius: 4, padding: 5, marginBottom: 8 },
  cell: { width: "33.33%", paddingVertical: 2, paddingHorizontal: 6 },
  cellLabel: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, lineHeight: 1.15 },
  cellValue: { fontFamily: "Inter-Bold", fontSize: 9.5, marginTop: 1, lineHeight: 1.15 },
  // Columns of fee boxes
  cols: { flexDirection: "row", gap: 10 },
  col: { flex: 1 },
  box: { borderWidth: 1, borderColor: HAIR, borderRadius: 4, marginBottom: 7, overflow: "hidden" },
  secHead: { flexDirection: "row", justifyContent: "space-between", backgroundColor: TINT, paddingVertical: 4, paddingHorizontal: 8 },
  secTitle: { fontFamily: "Inter-Bold", fontSize: 8.5, color: INDIGO, textTransform: "uppercase", letterSpacing: 0.8 },
  secTotal: { fontFamily: "Inter-Bold", fontSize: 9, color: INDIGO },
  subHead: { fontFamily: "Inter-Bold", fontSize: 7.5, color: SUB, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 8, paddingTop: 3, paddingBottom: 2, lineHeight: 1.2 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.8, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: HAIR },
  rowLabel: { fontSize: 8.5, color: SUB, flexShrink: 1, paddingRight: 6, lineHeight: 1.2 },
  rowValue: { fontFamily: "Inter", fontSize: 8.5, color: INK, lineHeight: 1.2 },
  totalBar: { flexDirection: "row", justifyContent: "space-between", backgroundColor: INDIGO, paddingVertical: 5, paddingHorizontal: 8 },
  totalLabel: { fontFamily: "Inter-Bold", fontSize: 9, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 0.6 },
  totalValue: { fontFamily: "Inter-Bold", fontSize: 10, color: "#FFFFFF" },
  // Footer
  disclaimer: { fontSize: 6.6, color: MUTED, lineHeight: 1.35, marginTop: 2 },
  footBrand: { fontSize: 8, fontFamily: "Inter-Bold", color: INK, marginTop: 6 },
  footGen: { fontSize: 7, color: MUTED, marginTop: 2 },
});

const Row = ({ label, value, color, bold, cents }) => (
  <View style={s.row}>
    <Text style={[s.rowLabel, bold ? { fontFamily: "Inter-Bold", color: INK } : null]}>{label}</Text>
    <Text style={[s.rowValue, bold ? { fontFamily: "Inter-Bold" } : null, color ? { color } : null]}>
      {typeof value === "number" ? (cents ? usd2(value) : usd(value)) : value}
    </Text>
  </View>
);

// `grow` stretches the box to fill its column — used on the bottom row so the
// two boxes are equal height and their indigo total bars sit on the same line
// (pair with a <Spacer/> just before the TotalBar).
const Box = ({ title, total, children, grow }) => (
  <View style={grow ? [s.box, { flexGrow: 1, marginBottom: 0 }] : s.box} wrap={false}>
    <View style={s.secHead}>
      <Text style={s.secTitle}>{title}</Text>
      {total !== undefined && <Text style={s.secTotal}>{usd(total)}</Text>}
    </View>
    {children}
  </View>
);

const Spacer = () => <View style={{ flexGrow: 1 }} />;

const TotalBar = ({ label, value }) => (
  <View style={s.totalBar}>
    <Text style={s.totalLabel}>{label}</Text>
    <Text style={s.totalValue}>{usd(value)}</Text>
  </View>
);

const Cell = ({ label, value }) => (
  <View style={s.cell}>
    <Text style={s.cellLabel}>{label}</Text>
    <Text style={s.cellValue}>{value}</Text>
  </View>
);

// Drop zero-value rows: a fee worksheet only shows fees that exist.
const rows = (list) => list.filter((r) => r && (typeof r.value !== "number" || Math.abs(r.value) >= 0.5));

// The worksheet PAGE, extracted so other documents can append it — the Refi
// Savings Summary PDF optionally carries it as page 2 (Christo 2026-07-22).
export function FeesWorksheetPage(p) {
  const c = p.calc || {};
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const propLine = p.propertyTBD ? "TBD" : (p.propertyAddress || "—");
  const locLine = `${p.city || ""}${p.propertyState ? ", " + p.propertyState : ""}${p.propertyZip ? " " + p.propertyZip : ""}`;
  const isRefi = !!p.isRefi;

  // Custom LO-added fees, grouped into their sections.
  const custom = (sec) => (p.customFees || []).filter((f) => f.section === sec).map((f) => ({ label: f.label, value: f.amount }));

  // ── Section data ──
  const lenderRows = rows([
    p.discountPts > 0 && { label: `${Number(p.discountPts).toFixed(3)}% of Loan Amount (Points)`, value: c.pointsCost },
    { label: "Originator Compensation", value: p.originatorComp },
    { label: "Underwriting Fee", value: p.underwritingFee },
    { label: "Admin Fee", value: p.adminFee },
    { label: "Lender Wire Fee", value: p.lenderWireFee },
    ...custom("A"),
  ]);
  const cannotShopRows = rows([
    { label: "Appraisal Fee", value: p.appraisalFee },
    { label: "Credit Report Fee", value: p.creditReportFee },
    { label: "Processing Fee", value: p.processingFee },
    { label: "Flood Certificate Fee", value: p.floodCertFee },
    { label: "MERS Registration Fee", value: p.mersFee },
    { label: "Tax Service Fee", value: p.taxServiceFee },
    ...custom("B"),
  ]);
  const canShopRows = rows([
    { label: "Title - Lender's Title Insurance", value: p.titleInsurance },
    { label: "Title - Escrow/Settlement Fee", value: p.escrowFee },
    { label: "Courier / Messenger Fee", value: p.courierFee },
    { label: "Loan Tie-In Fee", value: p.loanTieInFee },
    { label: "Notary Fee", value: p.notaryFee },
    { label: "Environmental Protection Lien", value: p.envProtectionLien },
    { label: "HOA Certification", value: c.hoaCert },
    ...custom("C"),
  ]);
  const otherRows = isRefi ? [] : rows([
    { label: "Owner's Title Insurance", value: p.ownersTitleIns },
    { label: "Home Warranty", value: p.homeWarranty },
    { label: "HOA Transfer Fee", value: c.hoaTransferActual },
    { label: "Buyer-Paid Commission", value: c.buyerCommAmt },
    ...custom("H"),
  ]);
  const govRows = rows([
    { label: "Recording Fees - Mortgage", value: p.recordingFee },
    { label: "City Transfer Tax (buyer share)", value: c.buyerCityTT },
    { label: "County Transfer Tax (buyer share)", value: c.buyerCountyTT },
    ...custom("E"),
  ]);
  const prepaidRows = rows([
    { label: `Prepaid Interest (${c.autoPrepaidDays || 0} days @ ${usd2(c.dailyInt)}/day)`, value: c.prepaidInt, cents: true },
    { label: "Hazard Insurance Premium (12 months)", value: c.prepaidIns },
    { label: "Property Taxes (installment due at close)", value: p.propertyTaxesInstallment },
    p.sellersProratedTaxCredit > 0 && { label: "Seller's Prorated Tax Credit", value: -p.sellersProratedTaxCredit, color: GREEN },
    { label: `Initial Escrow (${c.escrowTaxMonths || 0} mo tax + ${c.escrowInsMonths || 0} mo ins)`, value: c.initialEscrow },
  ]);

  return (
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.loName}>{p.loanOfficer || "Loan Officer"}</Text>
            <Text style={s.loMeta}>Loan Officer{p.loNmls ? ` · NMLS #${p.loNmls}` : ""}</Text>
            {!!p.loPhone && <Text style={s.loMeta}>{p.loPhone}</Text>}
            {!!p.loEmail && <Text style={s.loMeta}>{p.loEmail}</Text>}
          </View>
          <View>
            <Text style={s.hTitle}>FEES WORKSHEET</Text>
            <Text style={s.hSub}>
              <Text style={{ color: INK, fontFamily: "Inter-Bold" }}>Real</Text>
              <Text style={{ color: INDIGO, fontFamily: "Inter-Bold" }}>Stack</Text>
              {"  Blueprint"}
            </Text>
            {!!p.borrowerName && <Text style={s.hSub}>Prepared for {p.borrowerName}</Text>}
          </View>
        </View>
        <View style={s.rule} />
        <Text style={s.advisory}>
          Your actual rate, payment and costs could be higher. Get an official Loan Estimate before choosing a loan.
        </Text>
        <View style={s.metaRow}>
          <Text>Scenario: {p.scenarioName || "—"}</Text>
          <Text>Preparation Date: {dateStr} {timeStr}</Text>
        </View>

        {/* Loan summary grid */}
        <View style={s.grid}>
          <Cell label="Loan Purpose" value={isRefi ? `Refinance: ${p.refiPurpose || "Rate/Term"}` : "Purchase"} />
          <Cell label={isRefi ? "Estimated Value" : "Purchase Price"} value={usd(isRefi ? p.refiHomeValue || p.salesPrice : p.salesPrice)} />
          <Cell label="Loan Amount" value={usd(isRefi ? c.refiNewLoanAmt : c.loan)} />
          <Cell label="Loan Type" value={`${p.loanType || ""} · ${p.term || ""} Year Fixed`} />
          <Cell label="Rate" value={`${p.rate ?? ""}%`} />
          {!isRefi
            ? <Cell label="Down Payment" value={`${usd(c.dp)} (${p.downPct}%)`} />
            : <Cell label="Cash Out" value={usd(p.refiCashOut || 0)} />}
          <Cell label="Property" value={propLine !== "—" ? propLine : locLine} />
          <Cell label="Escrow (Impounds)" value={p.includeEscrow ? "Yes" : "Waived"} />
          <Cell label="Credit Score" value={p.creditScore > 0 ? String(p.creditScore) : "Not verified"} />
          {p.closingMonth > 0 && (() => {
            // Closing date from state; first payment = 1st of the second month
            // after closing (prepaids cover the closing month, the next full
            // month's interest is paid in arrears with that first payment).
            const cy = p.closingYear || new Date().getFullYear();
            const closeStr = new Date(cy, p.closingMonth - 1, p.closingDay || 1)
              .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            const fp = new Date(cy, (p.closingMonth - 1) + 2, 1);
            const fpStr = fp.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            return (
              <>
                <Cell label="Closing Date" value={closeStr} />
                <Cell label="First Payment" value={fpStr} />
              </>
            );
          })()}
        </View>

        {/* Fee sections — two columns */}
        <View style={s.cols}>
          <View style={s.col}>
            <Box title="Lender Fees" total={c.origCharges}>
              {lenderRows.map((r, i) => <Row key={i} {...r} />)}
            </Box>
            <Box title="Third Party Fees" total={(c.cannotShop || 0) + (c.canShop || 0)}>
              <Text style={s.subHead}>Services You Cannot Shop For</Text>
              {cannotShopRows.map((r, i) => <Row key={i} {...r} />)}
              <Text style={s.subHead}>Services You Can Shop For</Text>
              {canShopRows.map((r, i) => <Row key={i} {...r} />)}
            </Box>
          </View>
          <View style={s.col}>
            <Box title="Taxes & Government Fees" total={c.govCharges}>
              {govRows.map((r, i) => <Row key={i} {...r} />)}
            </Box>
            <Box title="Prepaids & Initial Escrow" total={c.totalPrepaidExp}>
              {prepaidRows.map((r, i) => <Row key={i} {...r} />)}
            </Box>
            {otherRows.length > 0 && (
              <Box title="Other Costs" total={c.sectionH}>
                {otherRows.map((r, i) => <Row key={i} {...r} />)}
              </Box>
            )}
          </View>
        </View>

        {/* Bottom row: monthly payment + funds to close. Both boxes grow to
            equal height and a Spacer pushes each TotalBar to the bottom, so
            the two indigo bars always sit on the same line. */}
        <View style={s.cols}>
          <View style={s.col}>
            {!isRefi ? (
              <Box title="Estimated Monthly Payment" grow>
                <Row label="Principal & Interest" value={c.pi} />
                <Row label="Property Taxes" value={c.monthlyTax} />
                <Row label="Homeowner's Insurance" value={c.ins} />
                {c.monthlyMI >= 0.5 && <Row label="Mortgage Insurance" value={c.monthlyMI} />}
                {p.hoa >= 0.5 && <Row label="Homeowner Assn. Dues" value={p.hoa} />}
                <Spacer />
                <TotalBar label="Total Monthly Payment" value={c.housingPayment} />
              </Box>
            ) : (
              <Box title="Estimated Monthly Payment" grow>
                {/* Comparison basis (2026-08-14): bills, not the servicer's
                    escrow collection, so Current − New = Monthly Savings on
                    this card's own face. */}
                <Row label="Current Total Payment" value={c.refiCurCmpTotalPmt} />
                {(c.refiSecondPmtSaved || 0) >= 0.5 && <Row label="2nd Lien Payment (paid off)" value={c.refiSecondPmtSaved} />}
                {(c.refiThirdPmtSaved || 0) >= 0.5 && <Row label="3rd Lien Payment (paid off)" value={c.refiThirdPmtSaved} />}
                <Row label="New Principal & Interest" value={c.refiNewPi} />
                {c.refiNewMonthlyTax >= 0.5 && <Row label="New Property Taxes" value={c.refiNewMonthlyTax} />}
                {c.refiNewMonthlyIns >= 0.5 && <Row label="New Insurance" value={c.refiNewMonthlyIns} />}
                {c.refiNewMI >= 0.5 && <Row label="New Mortgage Insurance" value={c.refiNewMI} />}
                {p.hoa >= 0.5 && <Row label="Homeowner Assn. Dues" value={p.hoa} />}
                <Row label="New Total Payment" value={c.refiNewTotalPmt} bold />
                <Spacer />
                <TotalBar label="Monthly Savings" value={c.refiMonthlyTotalSavings} />
              </Box>
            )}
          </View>
          <View style={s.col}>
            {!isRefi ? (
              <Box title="Estimated Funds to Close" grow>
                <Row label="Down Payment" value={c.dp} />
                <Row label="Closing Costs" value={c.totalClosingCosts} />
                <Row label="Prepaids & Initial Escrow" value={c.totalPrepaidExp} />
                {c.payoffAtClosing >= 0.5 && <Row label="Debts Paid at Closing" value={c.payoffAtClosing} />}
                {c.totalCredits >= 0.5 && (
                  <>
                    <Text style={s.subHead}>Credits</Text>
                    {p.sellerCredit >= 0.5 && <Row label="Seller Credit" value={-p.sellerCredit} color={GREEN} />}
                    {p.lenderCredit >= 0.5 && <Row label="Lender Credit" value={-p.lenderCredit} color={GREEN} />}
                    {p.realtorCredit >= 0.5 && <Row label="Realtor Credit" value={-p.realtorCredit} color={GREEN} />}
                    {c.emdCredit >= 0.5 && <Row label="EMD (Deposit Already Paid)" value={-c.emdCredit} color={GREEN} />}
                    {(p.customFees || []).filter((f) => f.section === "CR" && (f.amount || 0) >= 0.5).map((f, k) => (
                      <Row key={"cr" + k} label={f.label} value={-f.amount} color={GREEN} />
                    ))}
                  </>
                )}
                <Spacer />
                <TotalBar label="Estimated Cash to Close" value={c.cashToClose} />
              </Box>
            ) : (
              <Box title="Net Cash Out" grow>
                <Row label="New Loan Amount" value={c.refiNetNewLoan} />
                <Row label="Closing Costs" value={-(c.refiNetClosingCosts || 0)} />
                <Row label="Prepaids & Escrow" value={-(c.refiNetPrepaids || 0)} />
                <Row label={((c.refiSecondPayoffAmt || 0) >= 0.5 || (c.refiThirdPayoffAmt || 0) >= 0.5) ? `Loan Payoffs (${c.refiLienLabel || "1st + 2nd"})` : "Current Loan Payoff"} value={-(c.refiNetPayoff || 0)} />
                <Row
                  label={c.refiEstCashOut >= 0 ? "Estimated Cash Out" : "Cash to Close"}
                  value={Math.abs(c.refiEstCashOut || 0)}
                  color={c.refiEstCashOut >= 0 ? GREEN : undefined}
                />
                {c.refiSkipPmtAmt >= 0.5 && <Row label={`Skip ${p.refiSkipMonths} Payment(s)`} value={c.refiSkipPmtAmt} color={GREEN} />}
                {c.refiEscrowRefund >= 0.5 && <Row label="Escrow Balance Refund" value={c.refiEscrowRefund} color={GREEN} />}
                <Spacer />
                <TotalBar
                  label={c.refiNetCashInHand >= 0 ? "Net Cash in Hand" : "Cash to Close at Signing"}
                  value={Math.abs(c.refiNetCashInHand || 0)}
                />
              </Box>
            )}
          </View>
        </View>

        {/* Footer */}
        <Text style={s.disclaimer}>
          This estimate is provided for illustrative and informational purposes only, based on the loan scenario provided. It is a hypothetical
          estimate: NOT a Loan Estimate, loan approval, rate lock, or commitment to lend. Actual rates, payments, and costs could be higher and
          will vary based on credit profile, property details, and lender guidelines. Until you lock your rate, terms are subject to change.
          Contact a licensed loan officer for an official quote.
        </Text>
        <Text style={s.footBrand}>
          {p.companyName || ""}{p.companyNmls ? ` · Company NMLS #${p.companyNmls}` : ""}
        </Text>
        <Text style={s.footGen}>Generated by Mortgage Blueprint, powered by RealStack · {dateStr}</Text>
      </Page>
  );
}

export function FeesWorksheetDoc(p) {
  return (
    <Document title={`Fees Worksheet: ${p.scenarioName || ""}`} author={p.loanOfficer || "Loan Officer"}>
      <FeesWorksheetPage {...p} />
    </Document>
  );
}
