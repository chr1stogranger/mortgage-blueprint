// src/lib/estimatePdf.js
//
// Branded estimate HTML builder — extracted verbatim from MortgageBlueprint.jsx
// (CIO audit M-4: first slice of the monolith-extraction roadmap).
// Pure function: takes every input explicitly, returns an HTML string.
// The caller (handlePrintPdf) writes it to a popup and prints.
//
// SECURITY: esc() below HTML-escapes all user-entered free text (audit C-3).
// Keep escaping any new interpolated field you add.

/**
 * Build the branded estimate document.
 * @param {
 *  calc: object, fmt: Function, fmt2: Function, scenarioName: string,
 *  loanOfficer: string, companyName: string, companyNmls: string,
 *  borrowerName: string, propertyTBD: boolean, propertyAddress: string,
 *  city: string, propertyState: string, propertyZip: string,
 *  loNmls: string, loPhone: string, loEmail: string,
 *  realtorPartner: object|null, isRefi: boolean, refiSkipMonths: number,
 *  salesPrice: number, downPct: number, loanType: string, term: number,
 *  rate: number, hoa: number,
 * } p
 * @returns {} string — complete HTML document
 */
export function generateEstimateHtml({
 calc, fmt, fmt2, scenarioName, loanOfficer, companyName, companyNmls,
 borrowerName, propertyTBD, propertyAddress, city, propertyState, propertyZip,
 loNmls, loPhone, loEmail, realtorPartner, isRefi, refiSkipMonths,
 salesPrice, downPct, loanType, term, rate, hoa,
}) {
  const c = calc;
  // Escape user-entered free text before interpolating into this HTML string.
  // The result is written to a popup via document.write(), so any unescaped
  // borrower/LO/realtor input (e.g. a name containing <img onerror=...>) would
  // execute as script. esc() neutralizes the 5 HTML-significant characters.
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const loName = esc(loanOfficer || "Loan Officer");
  const coName = esc(companyName || "");
  const bName = esc(borrowerName || "Valued Client");
  const propAddr = propertyTBD ? "TBD" : esc(propertyAddress || "");
  const propLoc = esc(`${city}, ${propertyState}${propertyZip ? " " + propertyZip : ""}`);
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const row = (l, v, bold, color) => `<tr><td style="padding:8px 16px;font-size:13px;color:#4a5568;border-bottom:1px solid #f0f0f0;${bold ? "font-weight:700;" : ""}">${l}</td><td style="padding:8px 16px;text-align:right;font-size:13px;font-weight:600;color:${color || "#1a202c"};border-bottom:1px solid #f0f0f0;font-family:system-ui">${v}</td></tr>`;
  const hdr = (t) => `<tr><td colspan="2" style="padding:14px 16px 6px;font-weight:700;font-size:13px;color:#2563eb;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #2563eb">${t}</td></tr>`;
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(scenarioName)} - Loan Estimate</title><style>
   *{box-sizing:border-box;margin:0;padding:0}
   body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f7f8fc;color:#1a202c;-webkit-font-smoothing:antialiased}
   .wrapper{max-width:640px;margin:0 auto;background:#fff;border-radius:0}
   .header{background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:28px 32px;color:#fff}
   .header-top{display:flex;justify-content:space-between;align-items:flex-start}
   .lo-info h2{font-size:20px;font-weight:700;margin-bottom:2px;letter-spacing:-0.3px}
   .lo-info .title{font-size:12px;opacity:0.85;font-weight:400}
   .lo-contact{font-size:11px;opacity:0.8;text-align:right;line-height:1.6}
   .lo-contact a{color:#fff;text-decoration:none}
   .prepared-for{margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.2);font-size:12px;opacity:0.85}
   .prepared-for strong{font-size:14px;opacity:1;display:block;margin-top:2px}
   .hero-bar{background:#f0f7ff;padding:24px 32px;text-align:center;border-bottom:1px solid #e2e8f0}
   .hero-bar .big{font-size:38px;font-weight:800;color:#1e3a5f;letter-spacing:-1.5px;font-family:system-ui}
   .hero-bar .sub{font-size:13px;color:#64748b;margin-top:4px}
   .body-content{padding:24px 32px}
   table{width:100%;border-collapse:collapse;margin:0 0 20px 0}
   .section-note{background:#f8fafc;border-left:3px solid #2563eb;padding:12px 16px;margin:16px 0;font-size:12px;color:#475569;line-height:1.5;border-radius:0 6px 6px 0}
   .footer{background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0}
   .footer-brand{font-size:13px;font-weight:600;color:#1e3a5f}
   .footer-legal{font-size:10px;color:#94a3b8;line-height:1.5;margin-top:8px}
   .footer-nmls{font-size:10px;color:#94a3b8;margin-top:4px}
   .estimate-banner{background:#fef3c7;border-bottom:1px solid #d98a0b;padding:8px 32px;text-align:center;font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px}
   @media print{body{background:#fff}.wrapper{box-shadow:none}}
   @media(max-width:500px){.header{padding:20px 18px}.body-content{padding:18px}.hero-bar{padding:18px}.header-top{flex-direction:column}.lo-contact{text-align:left;margin-top:10px}}
  </style></head><body><div class="wrapper">`;

  // HEADER
  html += `<div class="header"><div class="header-top"><div class="lo-info"><h2>${loName}</h2><div class="title">Loan Officer${loNmls ? " · NMLS #" + esc(loNmls) : ""}</div></div><div class="lo-contact">`;
  if (loPhone) html += `<div><a href="tel:${loPhone.replace(/\D/g,"")}">${esc(loPhone)}</a></div>`;
  if (loEmail) html += `<div><a href="mailto:${encodeURIComponent(loEmail)}">${esc(loEmail)}</a></div>`;
  html += `</div></div>`;
  if (realtorPartner) {
   html += `<div style="display:flex;align-items:center;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.15)">`;
   html += `<div><div style="font-size:14px;font-weight:600">${esc(realtorPartner.name)}</div><div style="font-size:11px;opacity:0.85">${esc(realtorPartner.title || "Realtor")}${realtorPartner.brokerage ? " · " + esc(realtorPartner.brokerage) : ""}${realtorPartner.dre ? " · DRE #" + esc(realtorPartner.dre) : ""}</div></div>`;
   if (realtorPartner.phone) html += `<div style="margin-left:auto;font-size:12px"><a href="tel:${realtorPartner.phone.replace(/\D/g,"")}" style="color:#fff">${esc(realtorPartner.phone)}</a></div>`;
   html += `</div>`;
  }
  html += `<div class="prepared-for">Prepared for<strong>${bName}</strong>${dateStr}</div>`;
  html += `</div>`;
  html += `<div class="estimate-banner">Hypothetical Estimate — For Illustrative Purposes Only — Not a Loan Offer</div>`;

  if (isRefi) {
   // REFI HERO
   const savColor = c.refiMonthlySavings > 0 ? "#16a34a" : "#dc2626";
   html += `<div class="hero-bar"><div class="big" style="color:${savColor}">${fmt(c.refiMonthlySavings)}<span style="font-size:18px;font-weight:400">/mo savings</span></div><div class="sub">Monthly P&I Savings · Breakeven in ${c.refiBreakevenMonths} months</div></div>`;

   html += `<div class="body-content">`;
   // Monthly Payment side-by-side comparison table
   const pdelta = (cur, nw) => {
    const d = Math.round(nw - cur);
    if (Math.abs(d) < 1) return '<span style="color:#888">—</span>';
    const color = d < 0 ? "#16a34a" : "#dc2626";
    const sign = d < 0 ? "-" : "+";
    return '<span style="color:' + color + '">' + sign + "$" + Math.abs(d).toLocaleString() + "</span>";
   };
   const pmtRow4 = (label, cur, nw, bold) => {
    const style = bold ? "padding:10px 16px;font-size:13px;font-weight:700;color:#1a202c;border-top:2px solid #e2e8f0" : "padding:8px 16px;font-size:13px;color:#4a5568;border-bottom:1px solid #f0f0f0";
    return '<tr><td style="' + style + '">' + label + '</td><td style="' + style + ';text-align:right;font-family:system-ui">' + fmt(cur) + '</td><td style="' + style + ';text-align:right;font-family:system-ui;color:#2563eb">' + fmt(nw) + '</td><td style="' + style + ';text-align:right;font-family:system-ui">' + pdelta(cur, nw) + '</td></tr>';
   };
   html += '<table style="width:100%;border-collapse:collapse;margin-bottom:16px">';
   html += '<tr><td colspan="4" style="padding:14px 16px 6px;font-weight:700;font-size:13px;color:#2563eb;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #2563eb">Monthly Payment</td></tr>';
   html += '<tr style="background:#f8fafc"><td style="padding:8px 16px;font-size:11px;font-weight:600;color:#888;text-transform:uppercase"></td><td style="padding:8px 16px;font-size:11px;font-weight:600;color:#888;text-align:right;text-transform:uppercase">Current</td><td style="padding:8px 16px;font-size:11px;font-weight:600;color:#2563eb;text-align:right;text-transform:uppercase">New</td><td style="padding:8px 16px;font-size:11px;font-weight:600;color:#888;text-align:right;text-transform:uppercase">Delta</td></tr>';
   html += pmtRow4("Principal", c.refiCurPrinThisMonth, c.refiNewPrinThisMonth);
   html += pmtRow4("Interest", c.refiCurIntThisMonth, c.refiNewIntThisMonth);
   if (c.refiNewMonthlyTax > 0) html += pmtRow4("Taxes", c.refiCurMonthlyTax, c.refiNewMonthlyTax);
   if (c.refiNewMonthlyIns > 0) html += pmtRow4("Insurance", c.refiCurMonthlyIns, c.refiNewMonthlyIns);
   html += pmtRow4("Total Payment", c.refiCurTotalPmt, c.refiNewTotalPmt, true);
   html += '<tr style="background:#f0fdf4"><td colspan="3" style="padding:10px 16px;font-size:13px;font-weight:700;color:#16a34a">Monthly Savings</td><td style="padding:10px 16px;text-align:right;font-size:13px;font-weight:700;color:#16a34a;font-family:system-ui">' + fmt(c.refiMonthlyTotalSavings) + '</td></tr>';
   html += '</table>';
   html += `<table>${hdr("Savings Analysis")}${row("Monthly P&I Savings",fmt(c.refiMonthlySavings),false,c.refiMonthlySavings>0?"#16a34a":"#dc2626")}${row("Estimated Closing Costs",fmt(c.totalClosingCosts))}${row("Months to Breakeven",c.refiBreakevenMonths+" months")}${row("Lifetime Interest Savings",fmt(c.refiIntSavings),true,"#16a34a")}</table>`;
   const cashOutLabel = c.refiEstCashOut >= 0 ? "Estimated Cash Out" : "Cash to Close";
   const cashOutValue = c.refiEstCashOut >= 0 ? fmt(c.refiEstCashOut) : fmt(Math.abs(c.refiEstCashOut));
   const cashInHandLabel = c.refiNetCashInHand >= 0 ? "Net Cash in Hand" : "Cash to Close at Signing";
   const cashInHandValue = c.refiNetCashInHand >= 0 ? fmt(c.refiNetCashInHand) : fmt(Math.abs(c.refiNetCashInHand));
   html += `<table>${hdr("Net Cash Out")}${row("New Loan Amount",fmt(c.refiNetNewLoan))}${row("Closing Costs","-"+fmt(c.refiNetClosingCosts))}${row("Prepaids & Escrow","-"+fmt(c.refiNetPrepaids))}${row("Current Loan Payoff","-"+fmt(c.refiNetPayoff))}${row(cashOutLabel,cashOutValue,false,c.refiEstCashOut>=0?"#16a34a":"#dc2626")}${c.refiSkipPmtAmt>0?row("Skip "+refiSkipMonths+" Payment(s)","+"+fmt(c.refiSkipPmtAmt),false,"#16a34a"):""}${c.refiEscrowRefund>0?row("Escrow Balance Refund","+"+fmt(c.refiEscrowRefund),false,"#16a34a"):""}${row(cashInHandLabel,cashInHandValue,true,c.refiNetCashInHand>=0?"#16a34a":"#dc2626")}</table>`;
   html += `<table>${hdr("3-Point Refi Test")}${row("Rate Drop ≥ 0.50%",c.refiRateDrop.toFixed(2)+"% "+(c.refiTest1Pass?"✓":"✗"))}${row("Breakeven < 24 Months",c.refiBreakevenMonths+" mos "+(c.refiTest2Pass?"✓":"✗"))}${row("Payoff 1+ Year Faster",c.refiAccelPayoff.yearsFaster.toFixed(1)+" yrs "+(c.refiTest3Pass?"✓":"✗"))}${row("Score",c.refiTestScore+"/3",true,c.refiTestScore>=2?"#16a34a":"#dc2626")}</table>`;
  } else {
   // PURCHASE HERO
   html += `<div class="hero-bar"><div class="big">${fmt(c.housingPayment)}<span style="font-size:18px;font-weight:400">/mo</span></div><div class="sub">${propAddr !== "TBD" && propAddr ? propAddr + " · " : ""}${fmt(c.cashToClose)} cash to close</div></div>`;

   html += `<div class="body-content">`;
   html += `<table>${hdr("Property & Loan Details")}`;
   if (propAddr) html += row("Property", propAddr);
   html += `${row("Location",propLoc)}${row("Purchase Price",fmt(salesPrice))}${row("Down Payment",fmt(c.dp)+" ("+downPct+"%)")}${row("Base Loan Amount",fmt(c.baseLoan))}`;
   if (c.fhaUp > 0) html += row("FHA Upfront MIP",fmt(c.fhaUp));
   if (c.vaFundingFee > 0) html += row("VA Funding Fee",fmt(c.vaFundingFee));
   html += `${row("Total Loan Amount",fmt(c.loan),true)}${row("Loan Type",loanType+" · "+term+" Year")}${row("Interest Rate",rate+"%")}${row("Loan Category",c.loanCategory)}</table>`;

   html += `<table>${hdr("Monthly Payment Breakdown")}${row("Principal & Interest",fmt(c.pi))}${row("Property Tax",fmt(c.monthlyTax))}${row("Homeowner's Insurance",fmt(c.ins))}`;
   if (c.monthlyMI > 0) html += row("Mortgage Insurance",fmt(c.monthlyMI));
   if (hoa > 0) html += row("HOA Dues",fmt(hoa));
   html += `${row("TOTAL PAYMENT",fmt(c.housingPayment),true,"#1e3a5f")}</table>`;

   // Cash to Close — 3-5 bucket summary + detailed breakdown
   html += `<table>${hdr("Estimated Funds to Close")}`;
   html += row("Down Payment", fmt(c.dp));
   html += row("Closing Costs", fmt(c.totalClosingCosts));
   // Sub-items for closing costs
   const subStyle = 'padding:4px 16px 4px 32px;font-size:12px;color:#718096;border-bottom:1px solid #f0f0f0';
   const subValStyle = 'padding:4px 16px;font-size:12px;color:#718096;text-align:right;border-bottom:1px solid #f0f0f0';
   html += `<tr><td style="${subStyle}">Lender Fees</td><td style="${subValStyle}">${fmt(c.origCharges)}</td></tr>`;
   html += `<tr><td style="${subStyle}">Third Party Fees</td><td style="${subValStyle}">${fmt(c.cannotShop + c.canShop)}</td></tr>`;
   html += `<tr><td style="${subStyle}">Taxes & Gov't Fees</td><td style="${subValStyle}">${fmt(c.govCharges)}</td></tr>`;
   html += row("Prepaid Expenses", fmt(c.totalPrepaidExp));
   html += `<tr><td style="${subStyle}">Prepaid Interest (${c.autoPrepaidDays} days)</td><td style="${subValStyle}">${fmt2(c.prepaidInt)}</td></tr>`;
   html += `<tr><td style="${subStyle}">Prepaid Insurance (12 mo)</td><td style="${subValStyle}">${fmt(c.prepaidIns)}</td></tr>`;
   if (c.initialEscrow > 0) html += `<tr><td style="${subStyle}">Initial Escrow (${c.escrowTaxMonths} mo tax + ${c.escrowInsMonths} mo ins)</td><td style="${subValStyle}">${fmt(c.initialEscrow)}</td></tr>`;
   if (c.payoffAtClosing > 0) html += row("Loans Paid Off at Closing", fmt(c.payoffAtClosing));
   if (c.totalCredits > 0) html += row("Credits", "(" + fmt(c.totalCredits) + ")", false, "#16a34a");
   html += row("ESTIMATED CASH TO CLOSE", fmt(c.cashToClose), true, "#1e3a5f");
   html += `</table>`;

   if (calc.yearlyInc > 0) {
    // calc exposes qualifyingIncome (monthly), housingPayment, and yourDTI (a
    // fraction = totalPayment / qualifyingIncome). It does NOT define monthlyGross,
    // frontDti, or dti — referencing those threw a TypeError that broke this PDF
    // for every scenario with income. Front-end DTI = housing payment / income.
    const frontDtiPct = calc.qualifyingIncome > 0 ? (calc.housingPayment / calc.qualifyingIncome) * 100 : 0;
    const backDtiPct = (calc.yourDTI ?? 0) * 100;
    html += `<table>${hdr("Qualification Snapshot")}${row("Gross Monthly Income",fmt(calc.qualifyingIncome))}${row("Front-End DTI (Housing)",frontDtiPct.toFixed(1)+"%")}${row("Back-End DTI (Total Debt)",backDtiPct.toFixed(1)+"%")}${row("After-Tax Monthly Payment (Yr 1)",fmt(calc.afterTaxPayment))}</table>`;
   }
  }

  html += `<div class="section-note">This is a hypothetical estimate for educational purposes only. It is not a loan offer, commitment to lend, or official rate quote. Actual rates, terms, and costs may vary significantly. Contact a licensed loan officer for a personalized quote based on your specific financial situation.</div>`;
  html += `</div>`;

  // FOOTER
  html += `<div class="footer"><div class="footer-brand">${coName}${companyNmls ? " · NMLS #" + esc(companyNmls) : ""}</div>`;
  html += `<div class="footer-legal">DISCLAIMER: This is a hypothetical estimate generated for educational and illustrative purposes only. It does not constitute a loan offer, pre-approval, rate lock, or commitment to lend. All figures are approximate and based on general market assumptions. Actual rates, fees, and terms will vary based on individual credit profile, property details, and lender guidelines. Please consult a licensed mortgage professional for an official quote.</div>`;
  html += `<div class="footer-nmls">Generated by RealStack Blueprint · ${dateStr}</div>`;
  html += `</div></div></body></html>`;
  return html;
}
