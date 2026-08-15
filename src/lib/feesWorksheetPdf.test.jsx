// Smoke tests: the Fees Worksheet must render to a real PDF for both
// purchase and refi scenarios without throwing. Uses renderToBuffer (node)
// — the browser path (pdf().toBlob()) shares the same layout engine.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { FeesWorksheetDoc } from "./FeesWorksheetPdf.jsx";

const baseCalc = {
  dp: 246000, loan: 984000, pi: 6221, monthlyTax: 1281, ins: 125, monthlyMI: 0,
  housingPayment: 7860, pointsCost: 9840, origCharges: 12180, cannotShop: 1797,
  canShop: 6888, titleEscrowTotal: 6888, hoaCert: 0, govCharges: 877,
  buyerCityTT: 0, buyerCountyTT: 677, sectionH: 3500, totalClosingCosts: 25242,
  dailyInt: 174.9, autoPrepaidDays: 16, prepaidInt: 2798, prepaidIns: 1500,
  initialEscrow: 9843, escrowTaxMonths: 7, escrowInsMonths: 3,
  totalPrepaidExp: 14141, payoffAtClosing: 0, totalCredits: 0, cashToClose: 285383,
  hoaTransferActual: 0, buyerCommAmt: 0,
};

const baseProps = {
  calc: baseCalc,
  scenarioName: "Test Scenario", loanOfficer: "Chris Granger",
  companyName: "Xpert Home Lending", companyNmls: "2179191",
  borrowerName: "Pat Borrower", propertyTBD: false,
  propertyAddress: "123 Main St", city: "Alameda", propertyState: "California",
  propertyZip: "94501", loNmls: "952015", loPhone: "(415) 987-8489",
  loEmail: "cgranger@xperthomelending.com", isRefi: false,
  salesPrice: 1230000, downPct: 20, loanType: "Conventional", term: 30,
  rate: 6.495, hoa: 233, creditScore: 740, includeEscrow: true,
  discountPts: 1, originatorComp: 0, underwritingFee: 1250, adminFee: 795,
  lenderWireFee: 295, appraisalFee: 850, creditReportFee: 134,
  processingFee: 695, floodCertFee: 8, mersFee: 25, taxServiceFee: 85,
  titleInsurance: 2000, titleSearch: 1261, settlementFee: 502, escrowFee: 2400,
  courierFee: 150, loanTieInFee: 150, notaryFee: 175, envProtectionLien: 100,
  ownersTitleIns: 3000, homeWarranty: 500, recordingFee: 200,
  propertyTaxesInstallment: 0, sellersProratedTaxCredit: 0,
};

describe("FeesWorksheetDoc", () => {
  it("renders a purchase worksheet PDF", async () => {
    const buf = await renderToBuffer(React.createElement(FeesWorksheetDoc, baseProps));
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("renders a refinance worksheet PDF", async () => {
    const refiCalc = {
      ...baseCalc,
      refiNewLoanAmt: 650000, refiNewPi: 4100, refiNewTotalPmt: 5500,
      refiCurTotalPmt: 6100, refiCurCmpTotalPmt: 6100, refiNewMonthlyTax: 900, refiNewMonthlyIns: 120,
      refiNewMI: 0, refiMonthlyTotalSavings: 600, refiNetNewLoan: 650000,
      refiNetClosingCosts: 8000, refiNetPrepaids: 3000, refiNetPayoff: 600000,
      refiEstCashOut: 39000, refiSkipPmtAmt: 0, refiEscrowRefund: 0,
      refiNetCashInHand: 39000,
    };
    const buf = await renderToBuffer(
      React.createElement(FeesWorksheetDoc, {
        ...baseProps, isRefi: true, refiPurpose: "Cash-Out", refiHomeValue: 1100000,
        refiCashOut: 50000, refiSkipMonths: 1, calc: refiCalc,
      })
    );
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
