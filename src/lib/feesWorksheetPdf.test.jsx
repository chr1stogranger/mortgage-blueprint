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

// ── Rate & Points Breakeven page (2026-09-11) ────────────────────────────────
import { buildLadderView, ladderPdfData } from "./rateLadder.js";
describe("FeesWorksheetDoc + RateLadderPage", () => {
  it("renders the worksheet with the ladder page appended", async () => {
    const calc = { ...baseCalc, loan: 650000, ltv: 72.5, fedItemizes: true, stateItemizes: true, fedTopRate: 0.24, stTopRate: 0.093, deductibleLoanPct: 1 };
    const rateLadder = {
      rungs: [{ rate: 7.0, pts: 0.016 }, { rate: 6.875, pts: 0.638 }, { rate: 6.75, pts: 1.309 }, { rate: 6.625, pts: 1.222 }, { rate: 6.5, pts: 1.628 }, { rate: 6.375, pts: 2.366 }],
      baseIdx: 0, holdYears: 5, taxMode: "auto", asOf: "2026-09-11", ltvBand: "70.01–75%",
    };
    const snap = ladderPdfData(buildLadderView({ calc, term: 30, isRefi: false, rateLadder }));
    expect(snap.spot.rate).toBe(6.5);
    expect(snap.rows.find(r => r.rate === 6.75).dominated).toBe(true);
    const buf = await renderToBuffer(<FeesWorksheetDoc {...baseProps} calc={calc} rateLadder={snap} />);
    expect(buf.length).toBeGreaterThan(20000);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

// ── VA Residual Income page (2026-09-13) ─────────────────────────────────────
import { buildVaResidualView, vaResidualPdfData } from "./vaResidual.js";
describe("FeesWorksheetDoc + VaResidualPage", () => {
  it("renders the worksheet with the VA residual page appended", async () => {
    const calc = { ...baseCalc, loan: 600000, monthlyHOA: 233, qualifyingIncome: 14000, totalMonthlyDebts: 900, reoNegativeDebt: 0 };
    const snap = vaResidualPdfData(buildVaResidualView({
      calc, isRefi: false, propertyState: "California", married: "MFJ", taxState: "California",
      vaResidual: { sqft: 1900, taxFreeIncome: 1200, childcare: 600, notes: "12 years with the same employer; 6 months reserves." },
    }));
    expect(snap.region).toBe("West");
    expect(snap.guideline).toBe(823);
    expect(snap.shelter.maintUtil).toBe(266);
    const buf = await renderToBuffer(<FeesWorksheetDoc {...baseProps} loanType="VA" calc={calc} vaResidual={snap} />);
    expect(buf.length).toBeGreaterThan(20000);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
