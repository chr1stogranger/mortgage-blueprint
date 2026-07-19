/**
 * Arive import → Blueprint scenario state normalizer.
 *
 * Ops (`api/arive.js ?action=blueprint-import`) already whitelists the payload,
 * but this is the last gate before Arive data becomes `state_data`, so it:
 *
 *  1. Coerces `income.borrower` to a NUMBER. IncomeContent groups rows by
 *     borrower number (`groups.filter(g => g.borrowerNum === n)`); a string
 *     borrower — which is what Ops sent before 2026-07-18 — matches no card,
 *     so the row silently renders nowhere. This is the repo's classic
 *     shape-mismatch failure, so we fix it on the way in.
 *  2. Keeps the roster (`numBorrowers` / `borrowerNames`) consistent with the
 *     income rows that actually arrived.
 *  3. Blanks `asset.last4` and strips digit runs out of institution/creditor
 *     names — account numbers must never land in a Blueprint scenario, even if
 *     a future Ops change starts sending them.
 *
 * Unknown keys pass through untouched: an older Ops that sends no
 * incomes/assets/debts produces exactly the same result as before.
 */

const ASSET_TYPES = ["Checking", "Saving", "Money Market", "Mutual Fund", "Stocks", "Bonds", "Retirement", "Gift", "Gift of Equity", "Trust", "Bridge Loan", "Other"];
const DEBT_TYPES = ["Mortgage", "HELOC", "Auto Loan", "Auto Lease", "Student Loan", "Revolving", "Installment", "Collection", "Other"];
const PAY_TYPES = ["Salary", "Hourly", "Overtime", "Bonus", "Commission", "Self-Employment", "RSU", "Rental", "Retirement", "Social Security", "Disability", "Child Support", "Alimony", "Other"];
const FREQUENCIES = ["Annual", "Bi-Annual", "Quarterly", "Monthly", "Semi-Monthly", "Bi-Weekly", "Weekly", "Hourly"];
const DEBT_BORROWERS = ["Joint", "Borrower 1", "Borrower 2"];
const ASSET_OWNERS = ["", "Borrower", "Co-Borrower", "Joint"];

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);

/** Remove digit runs / masked account fragments from a free-text name. */
export function safeName(s) {
  return String(s ?? "")
    .replace(/[*xX#•·]{2,}\s*\d*/g, " ")
    .replace(/\b\d{3,}\b/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[-–—:,#]+\s*$/, "")
    .trim()
    .slice(0, 80);
}

/**
 * Map a borrower reference to slot 1 or 2.
 * Accepts a number (1/2), "Borrower 2"/"Co-Borrower", or a borrower's name
 * (which is what the pre-2026-07-18 Ops payload sent).
 */
export function toBorrowerSlot(value, names = {}) {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 1) return Math.min(2, Math.round(num));
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return 1;
  if (/co[\s-]?borrower|borrower\s*2|secondary/.test(s)) return 2;
  if (/borrower\s*1|primary/.test(s)) return 1;
  // Name match against the roster, e.g. borrower: "Sam Reyes"
  for (const key of [2, 1]) {
    const nm = String(names[key] ?? "").trim().toLowerCase();
    if (nm && (nm === s || s.includes(nm) || nm.includes(s))) return key;
  }
  return 1;
}

function normIncome(row, names, i) {
  const freq = oneOf(row.freq ?? row.frequency, FREQUENCIES, "Monthly");
  const amount = n(row.amount);
  const cy = new Date().getFullYear();
  return {
    id: row.id ?? Date.now() + i,
    borrower: toBorrowerSlot(row.borrower, names),
    source: safeName(row.source),
    start: String(row.start ?? ""),
    end: String(row.end ?? ""),
    payType: oneOf(row.payType, PAY_TYPES, "Salary"),
    amount,
    frequency: freq,
    ytd: n(row.ytd),
    py1: n(row.py1),
    py2: n(row.py2),
    py1Year: n(row.py1Year) || cy - 1,
    py2Year: n(row.py2Year) || cy - 2,
    selection: row.selection === "YTD" || row.selection === "1Y" || row.selection === "2Y" ? row.selection : "Amount",
    verifiedBy: String(row.verifiedBy ?? ""),
    monthlyIncome: n(row.monthlyIncome),
  };
}

function normAsset(row, i) {
  return {
    id: row.id ?? Date.now() + i,
    bank: safeName(row.bank),
    last4: "",                                   // never imported
    owner: oneOf(row.owner, ASSET_OWNERS, ""),
    type: oneOf(row.type, ASSET_TYPES, "Other"),
    value: n(row.value),
    forClosing: n(row.forClosing),
  };
}

function normDebt(row, i) {
  return {
    id: row.id ?? Date.now() + i,
    name: safeName(row.name),
    type: oneOf(row.type, DEBT_TYPES, "Revolving"),
    borrower: oneOf(row.borrower, DEBT_BORROWERS, "Joint"),
    balance: n(row.balance),
    monthly: n(row.monthly),
    rate: n(row.rate),
    months: n(row.months),
    payoff: oneOf(row.payoff, ["No", "Yes - at Escrow", "Yes - POC", "Omit"], "No"),
    payoffAmount: n(row.payoffAmount),
    linkedReoId: String(row.linkedReoId ?? ""),
  };
}

export function normalizeArivePrefill(prefill) {
  const pf = { ...(prefill || {}) };

  const names = pf.borrowerNames && typeof pf.borrowerNames === "object" ? { ...pf.borrowerNames } : {};

  if (Array.isArray(pf.incomes)) {
    pf.incomes = pf.incomes
      .filter((r) => r && typeof r === "object")
      .map((r, i) => normIncome(r, names, i));
  }
  if (Array.isArray(pf.assets)) {
    pf.assets = pf.assets.filter((r) => r && typeof r === "object").map(normAsset);
  }
  if (Array.isArray(pf.debts)) {
    pf.debts = pf.debts.filter((r) => r && typeof r === "object").map(normDebt);
  }

  // Roster must cover every borrower slot that actually has an income row —
  // otherwise IncomeContent never renders the card holding that income.
  const maxSlot = Array.isArray(pf.incomes)
    ? pf.incomes.reduce((m, r) => Math.max(m, r.borrower || 1), 0)
    : 0;
  const declared = n(pf.numBorrowers);
  const needed = Math.max(maxSlot, declared);
  if (needed >= 2) pf.numBorrowers = Math.min(2, needed);
  else delete pf.numBorrowers;

  if (Object.keys(names).length && pf.numBorrowers >= 2) pf.borrowerNames = names;
  else delete pf.borrowerNames;

  return pf;
}

/**
 * Totals for the import preview. Mirrors the calculator's own income math
 * (selection + frequency), so the modal shows the number the Income tab will.
 */
export function summarizePrefill(prefill) {
  const pf = prefill || {};
  const incomes = Array.isArray(pf.incomes) ? pf.incomes : [];
  const assets = Array.isArray(pf.assets) ? pf.assets : [];
  const debts = Array.isArray(pf.debts) ? pf.debts : [];
  const perMonth = (r) => {
    const a = n(r.amount);
    switch (r.frequency) {
      case "Annual": return a / 12;
      case "Bi-Annual": return (a * 2) / 12;
      case "Quarterly": return (a * 4) / 12;
      case "Semi-Monthly": return a * 2;
      case "Bi-Weekly": return (a * 26) / 12;
      case "Weekly": return (a * 52) / 12;
      case "Hourly": return (a * 2080) / 12;
      default: return a;
    }
  };
  return {
    monthlyIncome: Math.round(incomes.reduce((s, r) => s + perMonth(r), 0)),
    incomeCount: incomes.length,
    assetsTotal: Math.round(assets.reduce((s, r) => s + n(r.value), 0)),
    assetsCount: assets.length,
    monthlyDebts: Math.round(debts.filter((d) => d.payoff === "No").reduce((s, r) => s + n(r.monthly), 0)),
    debtsCount: debts.length,
    borrowers: Math.max(1, n(pf.numBorrowers) || 1),
  };
}
