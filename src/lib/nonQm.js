// src/lib/nonQm.js
//
// Non-QM + second-lien products (Christo 2026-10-21): DSCR, Asset Qualifier,
// and HELOC (standalone, or 1st + HELOC piggyback). Pure functions only —
// MortgageBlueprint's calc memo feeds them, the UI reads the results.
//
// The Asset Qualifier rules are transcribed from Christo's matrix
// "Asset-Based Loan Programs Compared" (guidelines current Oct 2026, wholesale
// lenders he submits to directly). Every figure below traces to that sheet;
// where the sheet is silent the program says so in `notes` instead of guessing.
// When a lender updates its guide, edit AQ_PROGRAMS — nothing else.

import { calcPI } from "./finance.js";

// ── Product defaults ────────────────────────────────────────────────────────
// DSCR / HELOC guideline defaults (Christo picked these 2026-10-21).
export const DSCR_RULES = { minRatio: 1.0, strongRatio: 1.25, floorRatio: 0.75, maxLtvPurchase: 0.80, maxLtvCashOut: 0.75, minFico: 680, reserveMonths: 6 };
export const HELOC_RULES = { maxCltv: 0.90, minFico: 680, maxDti: 0.45, drawYears: 10, repayYears: 20, firstLtv: 0.80 };
export const AQ_MIN_FICO = 680;
export const NONQM_TYPES = ["DSCR", "Asset Qualifier"];
export const isNonQm = (loanType) => NONQM_TYPES.includes(loanType);

// ── Asset buckets ───────────────────────────────────────────────────────────
// Blueprint's asset types → the matrix's four columns. Gifts and bridge loans
// are never qualifying assets (matrix note 7); "Other" is unknown, so it
// counts for nothing rather than something.
export const AQ_BUCKET = {
  Checking: "deposit", Saving: "deposit", "Money Market": "deposit",
  "Mutual Fund": "securities", Stocks: "securities", Bonds: "securities",
  Trust: "securities",
  Retirement: "retirement",
  Gift: null, "Gift of Equity": null, "Bridge Loan": null, Other: null,
};
export const GIFT_TYPES = ["Gift", "Gift of Equity"];

/** Sum asset rows into { deposit, securities, retirement, gift }. */
export function bucketAssets(assets = [], extraDeposit = 0) {
  const b = { deposit: Number(extraDeposit) || 0, securities: 0, retirement: 0, gift: 0, excluded: 0 };
  for (const a of assets) {
    const v = Number(a && a.value) || 0;
    if (v <= 0) continue;
    if (GIFT_TYPES.includes(a.type)) { b.gift += v; continue; }
    const k = AQ_BUCKET[a.type];
    if (k) b[k] += v; else b.excluded += v;
  }
  return b;
}

/**
 * What's left in each bucket once closing is paid. Closing funds come out of
 * the accounts the borrower earmarked (each row's `forClosing`); gifts and
 * net sale proceeds cover closing first; anything still owed comes out of
 * cash, then stocks, then retirement — the order a borrower would actually
 * spend them. Program percentages then apply to what remains, so a program
 * that counts only retirement isn't charged for closing money that came out
 * of checking.
 */
export function bucketsAfterClosing(assets = [], extraDeposit = 0, cashToClose = 0) {
  const rem = { deposit: 0, securities: 0, retirement: 0 };
  let need = Math.max(0, Number(cashToClose) || 0);
  // Spend order: gifts (never qualify, so they go first), then net sale
  // proceeds, then each earmarked account. Whatever is left of the proceeds is
  // cash in the bank after closing; whatever is left of an earmark stays in
  // its own bucket. Before 2026-10-25 both were dropped, so a downsizer with
  // $400K of proceeds and $100K to close showed $0 after closing.
  for (const a of assets) {
    const v = Number(a && a.value) || 0;
    if (v > 0 && GIFT_TYPES.includes(a.type)) need = Math.max(0, need - v);
  }
  const proceeds = Math.max(0, Number(extraDeposit) || 0);
  const proceedsUsed = Math.min(proceeds, need);
  need -= proceedsUsed;
  rem.deposit += proceeds - proceedsUsed;
  for (const a of assets) {
    const v = Number(a && a.value) || 0;
    if (v <= 0 || GIFT_TYPES.includes(a.type)) continue;
    const k = AQ_BUCKET[a.type];
    const earmarked = Math.min(v, Math.max(0, Number(a.forClosing) || 0));
    const used = Math.min(earmarked, need);
    need -= used;
    if (k) rem[k] += v - used;
  }
  let owed = need;
  for (const k of ["deposit", "securities", "retirement"]) {
    const take = Math.min(rem[k], owed);
    rem[k] -= take; owed -= take;
  }
  return { ...rem, unfunded: owed };
}

// Reserve months by loan amount: [[maxLoan, months], ...] — first row whose
// maxLoan ≥ loan wins. Beyond the last row the program doesn't publish one.
const tierMonths = (tiers, loan) => {
  for (const [max, mo] of tiers) if (loan <= max) return mo;
  return null;
};

// Newrez residual floor: $2,000 for 1 person to $3,800 for 7, +$150 each
// beyond 7. The sheet gives only the endpoints; 2–6 are interpolated evenly
// ($300 a person) and flagged as such in the program notes.
export function newrezResidualFloor(householdSize) {
  const n = Math.max(1, Math.round(Number(householdSize) || 1));
  if (n >= 7) return 3800 + (n - 7) * 150;
  return 2000 + (n - 1) * 300;
}

// TLS Asset Depletion residual: $2,500 + $250 first dependent + $150 each after.
export function tlsResidualFloor(dependents) {
  const d = Math.max(0, Math.round(Number(dependents) || 0));
  return 2500 + (d >= 1 ? 250 : 0) + Math.max(0, d - 1) * 150;
}

// ── The matrix ──────────────────────────────────────────────────────────────
// pct: share of balance counted per bucket. retUnder / retOver = retirement
// under / at-or-over 59½. null = not eligible in that program.
export const AQ_PROGRAMS = [
  {
    id: "newrez", lender: "Newrez", program: "SmartEdge Asset Qualifier",
    test: "residual", divisor: 60,
    pct: { deposit: 1, securities: 0.85, retUnder: 0.50, retOver: 0.85 },
    maxLtv: 0.80, maxLoan: 2000000, minFico: 700,
    minAssetsAfterClose: 500000, statements: "6 months, every account",
    notes: ["Residual floor runs $2,000 (1 person) to $3,800 (7); sizes 2–6 are interpolated."],
  },
  {
    id: "nexbank", lender: "NexBank", program: "Mortgage Connect, Assets as ATR",
    test: "nexbank",
    pct: { deposit: 1, securities: 0.80, retUnder: 0.70, retOver: 0.80 },
    maxLtv: 0.80, maxLoan: 2000000, minFico: 680, statements: "6 months, every account",
    notes: [],
  },
  {
    id: "tls-au", lender: "TLS", program: "Flex NQM, Asset Utilization",
    test: "tls-au", divisor: 60, residualFloor: 3500,
    pct: { deposit: 1, securities: 0.80, retUnder: 0.70, retOver: 0.80 },
    reserveTiers: [[2000000, 6], [2500000, 9], [3000000, 12]],
    maxLtv: 0.80, maxLoan: 3000000, minFico: null, statements: "4 months",
    notes: ["Retirement counts 70% even past 59½ if still in a plan at a current employer."],
  },
  {
    id: "tls-ad", lender: "TLS", program: "Flex NQM, Asset Depletion",
    test: "dti", divisor: 60, maxDti: 0.50, otherIncome: true, reservesBeforeDivide: true, residual: "tls",
    pct: { deposit: 1, securities: 0.80, retUnder: 0.70, retOver: 0.80 },
    reserveTiers: [[2000000, 6]],
    minAssets: (loan) => Math.min(1.5 * loan, 500000),
    maxLtv: 0.80, maxLoan: 2000000, minFico: null, statements: "4 months",
    notes: ["Up to 90% LTV when assets are under half of qualifying income; modeled at 80%."],
  },
  {
    id: "ad", lender: "A&D Mortgage", program: "Asset Utilization (Super Prime)",
    test: "dti", divisor: 60, maxDti: 0.55, otherIncome: true, reservesBeforeDivide: true,
    pct: { deposit: 1, securities: 1, retUnder: 0.80, retOver: 0.80 },
    reserveTiers: [[2000000, 6], [4000000, 12]],
    minAssets: (loan) => Math.min(1.1 * loan, 1000000), minAssetsWaivable: true,
    maxLtv: 0.80, maxLoan: 4000000, minFico: null, statements: "3 months",
    notes: ["Top-tier pricing caps DTI at 45%."],
  },
  {
    id: "bluepoint", lender: "BluePoint", program: "Full/Alt-Doc Gold, Asset Utilization",
    test: "dti", divisor: 84, maxDti: 0.50, otherIncome: true, primaryOnly: true,
    // Only depository percentages are published; the rest are confirmed per
    // file, so Blueprint counts deposits alone rather than invent a haircut.
    pct: { deposit: 1, securities: 0, retUnder: 0, retOver: 0 },
    reserveTiers: [[1000000, 6], [2000000, 9], [3500000, 12]], reservesPerOtherHome: 2,
    maxLtv: 0.85, maxLoan: 3500000, minFico: 700, statements: "Within 120 days",
    notes: ["Counts checking and savings only. Stock and retirement percentages are confirmed at submission."],
  },
  {
    id: "uhm", lender: "Union Home (UHM)", program: "Platinum Alt Doc, Asset Depletion",
    test: "dti", divisor: 120, maxDti: 0.50, otherIncome: true, reservesBeforeDivide: true,
    pct: { deposit: 1, securities: 0.85, retUnder: 0.80, retOver: 0.80 },
    reserveTiers: [[1000000, 6], [2000000, 9], [3000000, 12]],
    maxLtv: 0.90, maxLoan: 3000000, minFico: 680, statements: "3 months (90 days)",
    notes: [],
  },
  {
    id: "fannie", lender: "Fannie Mae", program: "Employment-related assets",
    test: "dti", divisor: "term", maxDti: 0.50, otherIncome: true, minAge: 62, agency: true, noCashOut: true,
    // Retirement and employer lump-sum payouts only; brokerage doesn't count,
    // and a plain bank balance can't be told apart from a severance payout.
    pct: { deposit: 0, securities: 0, retUnder: 1, retOver: 1 },
    maxLtv: 0.80, minFico: 620, statements: "Standard (2 months)",
    notes: ["Counts retirement accounts only. Severance or lump-sum payouts also qualify; add them as Retirement.", "Reserves per DU, not modeled."],
  },
  {
    id: "freddie", lender: "Freddie Mac", program: "Assets as repayment",
    test: "dti", divisor: 240, maxDti: 0.50, otherIncome: true, minAge: 62, agency: true, maxUnits: 2,
    pct: { deposit: 1, securities: 1, retUnder: 1, retOver: 1 },
    maxLtv: 0.80, minFico: 620, statements: "Standard (2 months)",
    notes: ["Reserves per LPA, not modeled."],
  },
];

/**
 * Run a borrower through every Asset Qualifier program in the matrix.
 *
 * @param {object} p
 * @param {Array}  p.assets            Blueprint asset rows ({ type, value })
 * @param {number} p.extraDeposit      net sale proceeds etc. (counts as cash)
 * @param {number|null} p.borrowerAge  oldest borrower; null = unknown
 * @param {number} p.householdSize     Newrez residual table
 * @param {number} p.dependents        TLS residual table
 * @param {number} p.otherFinancedHomes  BluePoint +2 mo reserves each
 * @param {number} p.cashToClose       total cash due at closing
 * @param {number} p.loanAmount        subject first lien
 * @param {number} p.termMonths        Fannie divides by the loan term
 * @param {number} p.ltv               fraction
 * @param {number} p.fico
 * @param {boolean} p.isPrimary
 * @param {number} p.units
 * @param {boolean} p.isCashOut
 * @param {number} p.housingPayment    new PITIA incl. HOA/MI
 * @param {number} p.otherMonthlyDebts consumer liabilities (monthly)
 * @param {number} p.reoMonthlyDebt    other-property shortfall (monthly)
 * @param {number} p.otherIncome       monthly qualifying income besides assets
 * @param {number} p.otherMortgageBalances  REO mortgage balances
 * @param {number} p.otherDebtBalances      every other balance owed
 * @param {number} p.agencyLoanLimit   county high-balance limit
 */
export function evaluateAssetPrograms(p) {
  const b = bucketAssets(p.assets, p.extraDeposit);
  const age = Number(p.borrowerAge) > 0 ? Number(p.borrowerAge) : null;
  const over5912 = age !== null && age >= 59.5;
  const loan = Math.max(0, Number(p.loanAmount) || 0);
  const housing = Math.max(0, Number(p.housingPayment) || 0);
  const otherDebts = Math.max(0, Number(p.otherMonthlyDebts) || 0) + Math.max(0, Number(p.reoMonthlyDebt) || 0);
  const allPayments = housing + otherDebts;
  // Gift funds can pay closing costs but never qualify (matrix note 7);
  // bucketsAfterClosing spends them (and earmarked accounts) first.
  const left = bucketsAfterClosing(p.assets, p.extraDeposit, p.cashToClose);
  const otherIncome = Math.max(0, Number(p.otherIncome) || 0);
  const ltv = Number(p.ltv) || 0;
  const fico = Number(p.fico) || 0;

  return AQ_PROGRAMS.map((pg) => {
    const blockers = [];
    const notes = [...pg.notes];
    const retPct = over5912 ? pg.pct.retOver : pg.pct.retUnder;
    const eligible = b.deposit * pg.pct.deposit + b.securities * pg.pct.securities + b.retirement * retPct;
    const afterClose = left.unfunded > 0 ? -left.unfunded
      : left.deposit * pg.pct.deposit + left.securities * pg.pct.securities + left.retirement * retPct;
    if (left.unfunded > 0) blockers.push("Not enough assets to close");
    if (age === null && pg.pct.retUnder !== pg.pct.retOver && b.retirement > 0) notes.push("Age not entered: retirement counted at the under-59½ rate.");

    // Program eligibility — independent of the asset math.
    if (pg.minAge) {
      if (age === null) blockers.push(`Borrower must be ${pg.minAge}+ (enter age)`);
      else if (age < pg.minAge) blockers.push(`Borrower must be ${pg.minAge}+`);
    }
    if (ltv > pg.maxLtv + 1e-9) blockers.push(`LTV ${(ltv * 100).toFixed(1)}% over ${Math.round(pg.maxLtv * 100)}% max`);
    const maxLoan = pg.agency ? Number(p.agencyLoanLimit) || 0 : pg.maxLoan;
    if (maxLoan > 0 && loan > maxLoan) blockers.push(`Loan over ${pg.agency ? "the agency limit" : "$" + (maxLoan / 1e6).toFixed(1) + "M max"}`);
    if (pg.minFico && fico > 0 && fico < pg.minFico) blockers.push(`FICO under ${pg.minFico}`);
    if (pg.primaryOnly && !p.isPrimary) blockers.push("Primary residence only");
    if (pg.maxUnits && (Number(p.units) || 1) > pg.maxUnits) blockers.push(`1–${pg.maxUnits} units only`);
    if (pg.noCashOut && p.isCashOut) blockers.push("No cash-out refinance");

    let reserveMonths = 0;
    if (pg.reserveTiers) {
      const mo = tierMonths(pg.reserveTiers, loan);
      if (mo === null) blockers.push("Loan above the published reserve tiers");
      reserveMonths = (mo || 0) + (pg.reservesPerOtherHome ? pg.reservesPerOtherHome * (Number(p.otherFinancedHomes) || 0) : 0);
    }
    const reserves = reserveMonths * housing;

    const r = {
      id: pg.id, lender: pg.lender, program: pg.program, test: pg.test, maxLtv: pg.maxLtv, minFico: pg.minFico,
      statements: pg.statements, pctUsed: { ...pg.pct, ret: retPct },
      eligible, afterClose, reserveMonths, reserves, blockers, notes,
      pass: null, headline: "", detail: "", margin: 0,
    };

    if (eligible <= 0) {
      r.headline = "No eligible assets";
      r.detail = pg.agency && pg.id === "fannie" ? "Fannie counts retirement accounts only." : "Add assets on the Assets tab.";
      return r;
    }

    let testPass = false;
    if (pg.test === "residual") {
      // Newrez: (eligible − cash to close) ÷ 60 − all monthly debts ≥ floor.
      const monthly = afterClose / pg.divisor;
      const floor = newrezResidualFloor(p.householdSize);
      const residual = monthly - allPayments;
      const minOk = afterClose >= pg.minAssetsAfterClose;
      if (!minOk) blockers.push(`Needs $${(pg.minAssetsAfterClose / 1000).toFixed(0)}K left after closing`);
      testPass = residual >= floor;
      r.monthlyIncome = monthly; r.residual = residual; r.residualFloor = floor; r.margin = residual - floor;
      r.headline = `Residual ${fmtK(residual)}/mo vs ${fmtK(floor)} floor`;
      r.detail = `${fmtK(afterClose)} counted after closing ÷ ${pg.divisor} = ${fmtK(monthly)}/mo, less ${fmtK(allPayments)}/mo of payments.`;
    } else if (pg.test === "nexbank") {
      // Pass any one of three methods; assets left after closing must cover it.
      const methods = [
        { name: "Mortgage only", need: 1.25 * (loan + (Number(p.otherMortgageBalances) || 0)), how: "125% of all mortgage debt" },
        { name: "Simplified", need: 1.20 * loan + 0.30 * (Number(p.otherDebtBalances) || 0), how: "120% of new loan + 30% of other balances" },
        { name: "Traditional", need: loan + 60 * otherDebts, how: "100% of new loan + 60 months of other payments" },
      ];
      const best = methods.reduce((m, x) => (x.need < m.need ? x : m));
      testPass = afterClose >= best.need;
      r.methods = methods.map(m => ({ ...m, pass: afterClose >= m.need }));
      r.required = best.need; r.margin = afterClose - best.need;
      r.headline = `${fmtK(afterClose)} left vs ${fmtK(best.need)} needed (${best.name})`;
      r.detail = `Easiest method: ${best.how}.`;
    } else if (pg.test === "tls-au") {
      // Sufficiency AND residual, both required.
      const need = loan + 60 * allPayments;
      const monthly = afterClose / pg.divisor;
      const residual = monthly - allPayments;
      const enoughReserves = afterClose >= reserves;
      if (!enoughReserves) blockers.push(`Needs ${reserveMonths} months of reserves`);
      testPass = afterClose > need && residual >= pg.residualFloor;
      r.required = need; r.monthlyIncome = monthly; r.residual = residual; r.residualFloor = pg.residualFloor;
      r.margin = Math.min(afterClose - need, residual - pg.residualFloor);
      r.headline = `${fmtK(afterClose)} left vs ${fmtK(need)} needed · residual ${fmtK(residual)}/mo`;
      r.detail = `Must exceed the loan plus 60 months of every payment, and leave ${fmtK(pg.residualFloor)}/mo residual.`;
    } else {
      // Divide-and-DTI.
      const divisor = pg.divisor === "term" ? Math.max(1, Number(p.termMonths) || 360) : pg.divisor;
      const pool = afterClose - (pg.reservesBeforeDivide ? reserves : 0);
      const monthly = Math.max(0, pool) / divisor;
      const income = monthly + (pg.otherIncome ? otherIncome : 0);
      const dti = income > 0 ? allPayments / income : Infinity;
      if (!pg.reservesBeforeDivide && reserves > 0 && afterClose < reserves) blockers.push(`Needs ${reserveMonths} months of reserves`);
      if (pg.minAssets) {
        const need = pg.minAssets(loan);
        const waived = pg.minAssetsWaivable && income > 0 && monthly < income / 2;
        if (!waived && pool < need) blockers.push(`Needs ${fmtK(need)} after closing${pg.reservesBeforeDivide ? " and reserves" : ""}`);
      }
      testPass = dti <= pg.maxDti;
      if (pg.residual === "tls") {
        const floor = tlsResidualFloor(p.dependents);
        const residual = income - allPayments;
        r.residual = residual; r.residualFloor = floor;
        if (residual < floor) { testPass = false; blockers.push(`Residual under ${fmtK(floor)}/mo`); }
      }
      r.monthlyIncome = monthly; r.income = income; r.dti = dti; r.maxDti = pg.maxDti;
      r.margin = income * pg.maxDti - allPayments;
      r.headline = isFinite(dti) ? `DTI ${(dti * 100).toFixed(1)}% vs ${Math.round(pg.maxDti * 100)}% max` : "No qualifying income";
      r.detail = `${fmtK(Math.max(0, pool))} ÷ ${divisor} = ${fmtK(monthly)}/mo asset income${pg.otherIncome && otherIncome > 0 ? ` + ${fmtK(otherIncome)} other` : ""}.`;
    }
    r.pass = testPass && blockers.length === 0;
    return r;
  });
}

/** Summary across programs: how many pass, the strongest pass. */
export function summarizeAssetPrograms(results = []) {
  const scored = results.filter(r => r.pass !== null);
  const passing = results.filter(r => r.pass === true);
  return {
    evaluated: scored.length,
    passCount: passing.length,
    total: results.length,
    best: passing[0] || null,
    anyData: scored.length > 0,
  };
}

// ── DSCR ────────────────────────────────────────────────────────────────────
/**
 * Debt-service coverage: monthly rent ÷ full PITIA (incl. HOA).
 * @returns {{ ratio:number|null, pass:boolean|null, tier:string, rentNeeded:number, shortfall:number }}
 */
export function computeDscr({ rent, pitia, minRatio = DSCR_RULES.minRatio }) {
  const r = Number(rent) || 0, pmt = Number(pitia) || 0;
  const rentNeeded = pmt * minRatio;
  if (pmt <= 0 || r <= 0) return { ratio: null, pass: null, tier: r <= 0 ? "Enter rent" : "—", rent: r, pitia: pmt, rentNeeded, shortfall: 0 };
  const ratio = r / pmt;
  const tier = ratio >= DSCR_RULES.strongRatio ? "Strong" : ratio >= minRatio ? "Qualifies" : ratio >= DSCR_RULES.floorRatio ? "Under 1.00" : "Under 0.75";
  return { ratio, pass: ratio >= minRatio - 1e-9, tier, rent: r, pitia: pmt, rentNeeded, shortfall: Math.max(0, rentNeeded - r) };
}

// ── HELOC ───────────────────────────────────────────────────────────────────
/**
 * HELOC payments. During the draw period the payment is interest-only on
 * what's drawn; after it, the balance amortizes over the repayment period.
 * Qualifying payment is interest-only on the FULL line (Christo's default),
 * because the borrower can draw it all the day after closing.
 */
export function computeHelocPayments({ line, drawn, rate, repayYears = HELOC_RULES.repayYears }) {
  const L = Math.max(0, Number(line) || 0);
  const D = Math.min(L, Math.max(0, Number(drawn) || 0));
  const mr = (Number(rate) || 0) / 100 / 12;
  return {
    line: L, drawn: D,
    ioPayment: D * mr,
    qualifyingPayment: L * mr,
    repayPayment: calcPI(D, Number(rate) || 0, repayYears),
    fullLineRepayPayment: calcPI(L, Number(rate) || 0, repayYears),
  };
}

/** 1st + HELOC purchase split: first lien at firstLtv, HELOC fills the rest. */
export function computePiggyback({ price, downPct, firstLtv = HELOC_RULES.firstLtv }) {
  const P = Math.max(0, Number(price) || 0);
  const financed = Math.max(0, P * (1 - (Number(downPct) || 0) / 100));
  const first = Math.min(financed, P * firstLtv);
  const heloc = Math.max(0, financed - first);
  return { first, heloc, cltv: P > 0 ? financed / P : 0, firstLtv: P > 0 ? first / P : 0 };
}

/** Standalone HELOC behind an existing first: how big can the line be. */
export function computeStandaloneLine({ homeValue, firstBalance, maxCltv = HELOC_RULES.maxCltv, requested }) {
  const V = Math.max(0, Number(homeValue) || 0);
  const B = Math.max(0, Number(firstBalance) || 0);
  const maxLine = Math.max(0, V * maxCltv - B);
  const req = Number(requested);
  const line = req > 0 ? req : maxLine;
  return { maxLine, line, cltv: V > 0 ? (B + line) / V : 0, overMax: req > 0 && req > maxLine + 0.5 };
}

// ── The ability-to-repay pillar ─────────────────────────────────────────────
// Every pillar row (header, Overview, Qualify, Summary) shows the same third
// pillar. For most loans it's DTI; DSCR and Asset Qualifier swap in their own
// test, so the label, figure and explanation all come from here.
export function repayPillar(calc, { fmt, pct, loanType }) {
  const ok = calc.dtiCheck === "Good!" ? true : calc.dtiCheck === "—" ? null : false;
  if (calc.qualMethod === "dscr" && calc.dscr) {
    const d = calc.dscr;
    return {
      ok, label: "DSCR", fullLabel: "Debt Service Coverage (DSCR)",
      sub: d.ratio !== null ? `${d.ratio.toFixed(2)} / ${DSCR_RULES.minRatio.toFixed(2)}` : "Add rent",
      value: d.ratio !== null ? `DSCR ${d.ratio.toFixed(2)}` : "DSCR",
      detail: d.ratio !== null
        ? `Rent ${fmt(d.rent)}/mo ÷ PITIA ${fmt(d.pitia)}/mo = ${d.ratio.toFixed(2)}. Needs ${DSCR_RULES.minRatio.toFixed(2)}+.${d.shortfall > 0 ? ` Short ${fmt(d.shortfall)}/mo of rent.` : ""} No income or DTI used.`
        : "DSCR qualifies on the property's rent, not your income. Enter the monthly rent.",
      action: "Edit rent",
    };
  }
  if (calc.qualMethod === "assets" && calc.aqSummary) {
    const s = calc.aqSummary;
    return {
      ok, label: "Assets", fullLabel: "Asset Qualification",
      sub: s.anyData ? `${s.passCount} of ${s.total} programs` : "Add assets",
      value: s.anyData ? `${s.passCount}/${s.total} programs` : "Assets",
      detail: s.anyData
        ? (s.passCount > 0 ? `${s.passCount} of ${s.total} asset programs approve this file. Best fit: ${s.best.lender} ${s.best.program}.` : `None of the ${s.total} asset programs approve this file yet. See the program table on Qualify.`)
        : "Asset Qualifier turns savings and investments into qualifying income. Add assets to run the programs.",
      action: "Edit assets",
    };
  }
  const hasInc = calc.qualifyingIncome > 0;
  return {
    ok, label: "DTI", fullLabel: "DTI Ratio",
    sub: hasInc ? `${pct(calc.yourDTI, 1)} / ${pct(calc.maxDTI, 0)}` : "Add income",
    value: hasInc ? `DTI ${pct(calc.yourDTI, 1)}` : "DTI",
    detail: hasInc ? `Max ${pct(calc.maxDTI, 0)} for ${loanType}. Total payment ${fmt(calc.totalPayment)}/mo ÷ income ${fmt(calc.qualifyingIncome)}/mo = ${pct(calc.yourDTI, 1)}.` : "Add income on the Income tab to calculate DTI.",
    action: hasInc ? "Edit income & debts" : "Go to Income tab",
  };
}

function fmtK(v) {
  const n = Number(v) || 0;
  const s = Math.abs(n) >= 1e6 ? `$${(Math.abs(n) / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e4 ? `$${Math.round(Math.abs(n) / 1e3)}K` : `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
  return n < 0 ? `−${s}` : s;
}
