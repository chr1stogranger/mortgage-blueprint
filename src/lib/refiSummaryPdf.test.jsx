// Smoke tests: the Refi Savings Summary must render as a 1-page PDF, and as
// a 2-page PDF when the fees worksheet is appended. renderToBuffer (node)
// shares the layout engine with the browser path (pdf().toBlob()).
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { RefiSummaryDoc } from "./RefiSummaryPdf.jsx";
import { householdRate } from "./householdRate.js";

const pageCount = (buf) => (buf.toString("latin1").match(/\/Type \/Page[^s]/g) || []).length;

const refiCalc = {
  // current side
  refiEffBalance: 787158, refiCurPrinThisMonth: 788.5, refiCurIntThisMonth: 4268.04,
  refiCurMonthlyTax: 1136.84, refiCurMonthlyIns: 200, refiCurTotalPmt: 6393.39,
  refiCurCmpTotalPmt: 6393.39,
  // new side
  refiNewLoanAmt: 793251, refiNewPi: 4755.94, refiNewPrinThisMonth: 789.69,
  refiNewIntThisMonth: 3966.25, refiNewMonthlyTax: 1136.84, refiNewMonthlyIns: 200,
  refiNewMI: 0, refiNewTotalPmt: 6092.78,
  // verdicts
  refiMonthlySavings: 300.61, refiPiMiSavings: 300.61, refiMonthlyTotalSavings: 300.61,
  refiBreakevenMonths: 18, refiLifetimeSavings: 166866,
  // Full 4×4 matrix so the one-page assertion covers the Cost of Waiting table.
  refiCostOfWaiting: [0.125, 0.25, 0.5, 1.0].map((drop) => ({
    drop,
    years: [1, 2, 3, 4].map((y) => ({ lostSavings: 300.61 * 12 * y, breakeven: 45 * y })),
  })),
  refiAccelPayoff: { newPayoffMos: 327, curPayoffMos: 360, yearsFaster: 2.75 },
  // cash walk
  totalClosingCosts: 5263, totalPrepaidExp: 16682.93,
  refiNetNewLoan: 793251, refiNetClosingCosts: 5263, refiNetPrepaids: 16682.93,
  refiNetPayoff: 787158, refiEstCashOut: -15853.15,
  refiSkipPmtAmt: 12786.78, refiEscrowRefund: 4000, refiNetCashInHand: 3607.31,
  // fees-page fields
  pointsCost: 0, origCharges: 2195, cannotShop: 968, canShop: 1850,
  titleEscrowTotal: 1850, hoaCert: 0, govCharges: 250, buyerCityTT: 0,
  buyerCountyTT: 0, sectionH: 0, dailyInt: 130.4, autoPrepaidDays: 10,
  prepaidInt: 1303.97, prepaidIns: 0, initialEscrow: 8557.9,
  escrowTaxMonths: 7, escrowInsMonths: 3, payoffAtClosing: 0, totalCredits: 0,
  cashToClose: 0, dp: 0, loan: 793251, pi: 4755.94, monthlyTax: 1136.84,
  ins: 200, monthlyMI: 0, housingPayment: 6092.78, hoaTransferActual: 0, buyerCommAmt: 0,
};

const props = {
  calc: refiCalc, isRefi: true,
  scenarioName: "Refi Test", loanOfficer: "Chris Granger",
  companyName: "Xpert Home Lending", companyNmls: "2179191",
  borrowerName: "Pat Borrower", propertyTBD: false,
  propertyAddress: "123 Main St", city: "Alameda", propertyState: "California",
  propertyZip: "94501", loNmls: "952015", loPhone: "(415) 987-8489",
  loEmail: "cg@example.com",
  salesPrice: 1600000, loanType: "Conventional", term: 30, rate: 6.0,
  hoa: 0, creditScore: 740, includeEscrow: true,
  refiPurpose: "Rate/Term", refiCurrentRate: 6.5, refiOriginalTerm: 30,
  refiClosedDate: "2025-02-01", refiEscrowBalance: 4000, refiCurrentMI: 0,
  refiSkipMonths: 2, closingMonth: 7, closingDay: 31, closingYear: 2026,
  discountPts: 0, originatorComp: 0, underwritingFee: 1195, adminFee: 750,
  lenderWireFee: 0, appraisalFee: 750, creditReportFee: 100, processingFee: 250,
  floodCertFee: 8, mersFee: 25, taxServiceFee: 85, titleInsurance: 0,
  escrowFee: 1850, courierFee: 0, loanTieInFee: 0, notaryFee: 0,
  envProtectionLien: 0, ownersTitleIns: 0, homeWarranty: 0, recordingFee: 250,
  propertyTaxesInstallment: 0, sellersProratedTaxCredit: 0,
};

describe("RefiSummaryDoc", () => {
  it("renders the one-page savings summary", async () => {
    const buf = await renderToBuffer(React.createElement(RefiSummaryDoc, props));
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(buf)).toBe(1);
  });

  // Cash-out with consolidated debts: the Household Interest Rate section
  // prints, and the page (with the full Cost of Waiting matrix) stays one page.
  it("fits the household rate section on page 1 for a debt-consolidation cash-out", async () => {
    const debts = [
      { id: 1, name: "Toyota", type: "Auto Loan", balance: 22000, monthly: 520, rate: 5, payoff: "No" },
      { id: 2, name: "Chase Sapphire", type: "Revolving", balance: 18000, monthly: 540, rate: 22, payoff: "Yes - at Escrow" },
      { id: 3, name: "Amex", type: "Revolving", balance: 9000, monthly: 270, rate: 24, payoff: "Yes - at Escrow" },
      { id: 4, name: "Sallie Mae", type: "Student Loan", balance: 30000, monthly: 300, rate: 0, payoff: "No" },
    ];
    const hh = householdRate({ isRefi: true, debts, refi: { firstBalance: 787158, firstRate: 3, liens: [], newLoanAmt: 830000, newRate: 6, consolidatedIds: new Set([2, 3]), cashOut: true } });
    const calc = { ...refiCalc, householdRate: JSON.parse(JSON.stringify(hh)),
      refiPaidDebts: debts.slice(1, 3), refiDebtPmtSaved: 810, refiDebtBalTotal: 27000 };
    const doc = React.createElement(RefiSummaryDoc, { ...props, calc, refiPurpose: "Cash-Out" });
    const buf = await renderToBuffer(doc);
    expect(pageCount(buf)).toBe(1);
    // The LO's switch turns it off.
    const off = RefiSummaryDoc({ ...props, calc, refiPurpose: "Cash-Out", refiPdfHousehold: false });
    expect(JSON.stringify(off, (k, v) => (k === "_owner" ? undefined : v))).not.toContain("Household Interest Rate");
    const on = RefiSummaryDoc({ ...props, calc, refiPurpose: "Cash-Out" });
    expect(JSON.stringify(on, (k, v) => (k === "_owner" ? undefined : v))).toContain("Household Interest Rate");
    // Rate/Term never prints it.
    const tree = RefiSummaryDoc({ ...props, calc, refiPurpose: "Rate/Term" });
    expect(JSON.stringify(tree, (k, v) => (k === "_owner" ? undefined : v))).not.toContain("Household Interest Rate");
  });

  it("never adds a page, even with a long debt list and a paid-off 2nd", async () => {
    const debts = Array.from({ length: 9 }, (_, i) => ({ id: i + 1, name: `Creditor Number ${i + 1}`, type: i % 2 ? "Revolving" : "Installment", balance: 5000 + i * 1000, monthly: 150, rate: i === 8 ? 0 : 18 + i, payoff: i < 5 ? "Yes - at Escrow" : "No" }));
    const hh = householdRate({ isRefi: true, debts, refi: { firstBalance: 787158, firstRate: 3, liens: [{ pos: "2nd", bal: 60000, rate: 9.5, kind: "heloc", plan: "payoff" }], newLoanAmt: 900000, newRate: 6, consolidatedIds: new Set([1, 2, 3, 4, 5]), cashOut: true } });
    const calc = { ...refiCalc, householdRate: JSON.parse(JSON.stringify(hh)), refiPaidDebts: debts.slice(0, 5), refiDebtPmtSaved: 750, refiDebtBalTotal: 35000,
      refiLiens: [{ pos: "2nd", kind: "heloc", bal: 60000, rate: 9.5, pmt: 475, plan: "payoff" }], refiLienPmtSaved: 475, refiLienPmtCur: 475, refiCurTotalDebt: 882158, refiBlendedRate: 4.2, refiLienLabel: "1st + 2nd + Debts" };
    // This page is already at its edge without the section (a paid-off 2nd
    // plus consolidated debts), so the rule is: the household section never
    // adds a page. Side by side with Cost of Waiting it costs no height.
    const base = await renderToBuffer(React.createElement(RefiSummaryDoc, { ...props, calc: { ...calc, householdRate: null }, refiPurpose: "Cash-Out" }));
    const buf = await renderToBuffer(React.createElement(RefiSummaryDoc, { ...props, calc, refiPurpose: "Cash-Out" }));
    expect(pageCount(buf)).toBeLessThanOrEqual(pageCount(base));
  });

  it("appends the fees worksheet as page 2 when includeFees is set", async () => {
    const buf = await renderToBuffer(React.createElement(RefiSummaryDoc, { ...props, includeFees: true }));
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(buf)).toBe(2);
  });
});
