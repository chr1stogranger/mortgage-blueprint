// Smoke tests: the Refi Savings Summary must render as a 1-page PDF, and as
// a 2-page PDF when the fees worksheet is appended. renderToBuffer (node)
// shares the layout engine with the browser path (pdf().toBlob()).
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { RefiSummaryDoc } from "./RefiSummaryPdf.jsx";

const pageCount = (buf) => (buf.toString("latin1").match(/\/Type \/Page[^s]/g) || []).length;

const refiCalc = {
  // current side
  refiEffBalance: 787158, refiCurPrinThisMonth: 788.5, refiCurIntThisMonth: 4268.04,
  refiCurMonthlyTax: 1136.84, refiCurMonthlyIns: 200, refiCurTotalPmt: 6393.39,
  // new side
  refiNewLoanAmt: 793251, refiNewPi: 4755.94, refiNewPrinThisMonth: 789.69,
  refiNewIntThisMonth: 3966.25, refiNewMonthlyTax: 1136.84, refiNewMonthlyIns: 200,
  refiNewMI: 0, refiNewTotalPmt: 6092.78,
  // verdicts
  refiMonthlySavings: 300.61, refiMonthlyTotalSavings: 300.61,
  refiBreakevenMonths: 18, refiLifetimeSavings: 166866,
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

  it("appends the fees worksheet as page 2 when includeFees is set", async () => {
    const buf = await renderToBuffer(React.createElement(RefiSummaryDoc, { ...props, includeFees: true }));
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(buf)).toBe(2);
  });
});
