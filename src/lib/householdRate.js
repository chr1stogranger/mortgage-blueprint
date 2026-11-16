// Household interest rate (Christo 2026-11-15).
//
// One balance-weighted rate across everything the household owes: the
// mortgage, the car, the cards. "Your mortgage is 3%, the auto loan 5%, the
// cards 22% — together you're paying 6.1%." On a refi we price the same
// household twice, today and after the new loan, so a cash-out that
// consolidates debt shows what the blend becomes (it can go UP when a 3%
// first gets replaced, and the card should say so).
//
// Rules:
// - Weighted by balance: Σ(balance × rate) / Σ balance.
// - A debt with a balance but no rate entered is left OUT of the blend on
//   both sides and reported in `missing`. Guessing a card APR would be
//   pretend math. Deferred junior liens (CalHFA/ZIP) are a real 0%.
// - "Omit" debts are excluded: LOs omit tradelines that aren't really the
//   borrower's (authorized user, duplicates, paid by a business).
// - On a refi the subject first and junior liens come from the refi model.
//   A Mortgage/HELOC row on the Debts tab that is that same lien (linked to a
//   "(Subj)" REO, or a balance within 2% of a modeled lien) is skipped so
//   the subject loan isn't counted twice.
// - After the refi: the new loan at the note rate, subordinated juniors, and
//   Debts rows still set to Keep. Anything paid at escrow, before close, or
//   consolidated into the cash-out drops out.

const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const isLien = (d) => d.type === "Mortgage" || d.type === "HELOC";
const near = (a, b) => a > 0 && b > 0 && Math.abs(a - b) <= Math.max(a, b) * 0.02;

function summarize(items) {
  const priced = items.filter(i => !i.rateMissing && i.balance > 0);
  const balance = priced.reduce((s, i) => s + i.balance, 0);
  const weighted = priced.reduce((s, i) => s + i.balance * i.rate, 0);
  return {
    items,
    balance,                                   // priced balances (the blend's base)
    totalOwed: items.reduce((s, i) => s + i.balance, 0), // everything, rate or not
    rate: balance > 0 ? weighted / balance : null,
    monthlyInterest: priced.reduce((s, i) => s + i.monthlyInterest, 0),
    missing: items.filter(i => i.rateMissing && i.balance > 0),
  };
}

function item(key, label, kind, balance, rate, { zeroOk = false } = {}) {
  const bal = Math.max(0, num(balance));
  const r = Math.max(0, num(rate));
  const rateMissing = !(r > 0) && !zeroOk;
  return { key, label, kind, balance: bal, rate: r, rateMissing, monthlyInterest: rateMissing ? 0 : bal * r / 1200 };
}

/**
 * @param {object} p
 * @param {boolean} p.isRefi
 * @param {Array} p.debts           Debts tab rows ({id,name,type,balance,rate,payoff,linkedReoId})
 * @param {boolean} [p.debtFree]
 * @param {Array} [p.reos]          REO rows ({id, occupancy})
 * @param {object} [p.refi]         refi model, required when isRefi
 *   { firstBalance, firstRate, liens: [{pos,bal,rate,kind,plan}], newLoanAmt, newRate,
 *     consolidatedIds: Set, cashOut: boolean }
 * @returns {{ mode: "purchase"|"refi", today, after, rows }}
 */
export function householdRate({ isRefi, debts = [], debtFree = false, reos = [], refi = null }) {
  const subjectReoIds = new Set((reos || []).filter(r => /\(Subj\)/.test(r.occupancy || "")).map(r => String(r.id)));
  const liens = (isRefi && refi ? refi.liens || [] : []).filter(l => num(l.bal) > 0);
  const firstBal = isRefi && refi ? num(refi.firstBalance) : 0;
  const isSubjectDupe = (d) => isRefi && isLien(d) && (
    (d.linkedReoId && subjectReoIds.has(String(d.linkedReoId)))
    || near(num(d.balance), firstBal)
    || liens.some(l => near(num(d.balance), num(l.bal)))
  );
  const rowsIn = (debtFree ? [] : debts).filter(d => num(d.balance) > 0 && d.payoff !== "Omit" && !isSubjectDupe(d));
  const debtLabel = (d) => (d.name && String(d.name).trim()) || d.type || "Debt";
  const debtItem = (d) => ({ ...item(`debt-${d.id}`, debtLabel(d), d.type || "Other", d.balance, d.rate), debtId: d.id });

  if (!isRefi || !refi) {
    const today = summarize(rowsIn.map(debtItem));
    return { mode: "purchase", today, after: null, rows: today.items.map(i => ({ ...i, today: i.balance, after: null, fate: null })) };
  }

  // ── Refi: today ──
  const firstItem = item("subject-1st", "Current first mortgage", "Mortgage", firstBal, refi.firstRate);
  const lienItems = liens.map(l => item(`subject-${l.pos}`, `Current ${l.pos} lien`, l.kind === "heloc" ? "HELOC" : "Mortgage", l.bal, l.rate, { zeroOk: l.kind === "deferred" }));
  const debtItems = rowsIn.map(debtItem);
  const today = summarize([...(firstBal > 0 ? [firstItem] : []), ...lienItems, ...debtItems]);

  // ── Refi: after ──
  const consolidated = refi.consolidatedIds || new Set();
  const keptLiens = liens.filter(l => l.plan !== "payoff");
  const keptDebts = rowsIn.filter(d => (d.payoff || "No") === "No" && !consolidated.has(d.id));
  const newItem = item("new-loan", refi.cashOut ? "New cash-out loan" : "New first mortgage", "Mortgage", refi.newLoanAmt, refi.newRate);
  const after = summarize([
    ...(num(refi.newLoanAmt) > 0 ? [newItem] : []),
    ...lienItems.filter(i => keptLiens.some(l => `subject-${l.pos}` === i.key)),
    ...debtItems.filter(i => keptDebts.some(d => d.id === i.debtId)),
  ]);

  // Row-by-row view for the table: each thing owed today and what happens to it.
  const afterKeys = new Set(after.items.map(i => i.key));
  const rows = today.items.map(i => {
    let fate = "stays";
    if (!afterKeys.has(i.key)) {
      if (i.key === "subject-1st" || i.key.startsWith("subject-")) fate = "replaced";
      else if (consolidated.has(i.debtId)) fate = "consolidated";
      else fate = "paid";
    }
    return { ...i, today: i.balance, after: fate === "stays" ? i.balance : 0, fate };
  });
  if (num(refi.newLoanAmt) > 0) rows.push({ ...newItem, today: 0, after: newItem.balance, fate: "new" });
  return { mode: "refi", today, after, rows };
}
