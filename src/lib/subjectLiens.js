// Subject-property liens on a refi (Christo 2026-11-24).
//
// When a mortgage statement is read on a refi, the loan on it is assumed to be
// paid off at closing, and so is a HELOC or second lien behind it. Both go on
// the Debts tab as "Yes - at Escrow", the property goes on the REO tab as the
// subject ("Primary (Subj)"), and the debts are linked to that REO row.
//
// The refi lien model (1st/2nd/3rd + payoff walk) stays the source of truth for
// the money: these rows are the 1003 picture, so every cash and DTI sum skips
// them (isRefiSubjectLien / isSubjectReo) and nothing is counted twice.

export const SUBJECT_OCCUPANCIES = ["Primary (Subj)", "Second (Subj)", "Invest. (Subj)"];

export const isSubjectReo = (r) => !!r && /\(Subj\)\s*$/.test(String(r.occupancy || ""));

const isLien = (d) => d && (d.type === "Mortgage" || d.type === "HELOC");

// On a refi, a lien debt belongs to the subject property when it says so
// (subjectLien), is linked to the subject REO, or isn't linked to any property
// (the auto-added "Current Mortgage" row). Liens linked to OTHER properties
// are REO business and still count where they always did.
export function isRefiSubjectLien(d, reos = []) {
  if (!isLien(d)) return false;
  if (d.subjectLien) return true;
  if (!d.linkedReoId) return true;
  const reo = reos.find((r) => String(r.id) === String(d.linkedReoId));
  return isSubjectReo(reo);
}

const subjectOccupancy = (loanPurpose) =>
  /Investment/.test(loanPurpose || "") ? "Invest. (Subj)"
    : /2nd Home|Second/.test(loanPurpose || "") ? "Second (Subj)"
    : "Primary (Subj)";

const occupancyToPropUse = (occ) =>
  occ.startsWith("Invest") ? "Investment" : occ.startsWith("Second") ? "Second Home" : "Primary";

const REO_TYPES = ["Single Family", "Duplex", "Triplex", "4-plex", "Condo", "Townhouse", "PUD"];
const reoPropType = (propType) => {
  const p = String(propType || "");
  if (REO_TYPES.includes(p)) return p;
  if (/condo/i.test(p)) return "Condo";
  if (/town/i.test(p)) return "Townhouse";
  if (/2|duplex/i.test(p)) return "Duplex";
  if (/3|triplex/i.test(p)) return "Triplex";
  if (/4|four/i.test(p)) return "4-plex";
  return "Single Family";
};

const n = (v) => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);
const r2 = (v) => Math.round(n(v) * 100) / 100;

// Pure: returns the next { debts, reos } plus a list of what changed.
//   first  — { servicer, balance, rate, payment, months, escrowed } (required)
//   second — { kind: 'heloc'|'closed', balance, rate, payment } or null
//   secondPlan — 'payoff' | 'sub'
//   property — { address, value, propType, loanPurpose, annualTax, annualIns, hoa }
export function syncSubjectLiens({ debts = [], reos = [], first, second = null, secondPlan = "payoff", property = {}, now = Date.now() }) {
  const changes = [];
  let nextReos = reos.slice();
  let nextDebts = debts.slice();

  // ── The subject property on the REO tab ──
  let reo = nextReos.find(isSubjectReo);
  const occupancy = reo?.occupancy || subjectOccupancy(property.loanPurpose);
  const liensBal = n(first?.balance) + (second ? n(second.balance) : 0);
  const liensPmt = n(first?.payment) + (second ? n(second.payment) : 0);
  const escrowed = !!first?.escrowed;
  const reoFields = {
    address: property.address || reo?.address || "",
    occupancy,
    propUse: occupancyToPropUse(occupancy),
    value: n(property.value) || n(reo?.value),
    mortgageBalance: r2(liensBal),
    payment: r2(liensPmt),
    includesTI: escrowed,
    reoTax: escrowed ? 0 : r2(n(property.annualTax) / 12),
    reoIns: escrowed ? 0 : r2(n(property.annualIns) / 12),
    reoHoa: r2(property.hoa),
  };
  if (reo) {
    reo = { ...reo, ...reoFields };
    nextReos = nextReos.map((r) => (r.id === reo.id ? reo : r));
    changes.push("Subject property updated on REO");
  } else {
    reo = { id: now, propType: reoPropType(property.propType), rentalIncome: 0, linkedDebtIdx: -1, ...reoFields };
    nextReos = [...nextReos, reo];
    changes.push("Subject property added to REO");
  }
  const reoId = String(reo.id);

  // ── The liens on the Debts tab, linked to that REO ──
  const claimed = new Set();
  const findLien = (tag, pick) => {
    const tagged = nextDebts.find((d) => d.subjectLien === tag);
    if (tagged) return tagged;
    return nextDebts.find((d) => !claimed.has(d.id) && !d.subjectLien && isRefiSubjectLien(d, nextReos) && pick(d));
  };
  const upsert = (existing, row, label) => {
    if (existing) {
      claimed.add(existing.id);
      nextDebts = nextDebts.map((d) => (d.id === existing.id ? { ...d, ...row } : d));
      changes.push(`${label} updated in Debts`);
    } else {
      const id = now + nextDebts.length + 1;
      claimed.add(id);
      nextDebts = [...nextDebts, { id, borrower: "Joint", payoffAmount: 0, ...row }];
      changes.push(`${label} added to Debts`);
    }
  };

  const firstExisting = findLien("first", (d) => d.type === "Mortgage");
  upsert(firstExisting, {
    name: first?.servicer || firstExisting?.name || "Current Mortgage",
    type: "Mortgage",
    balance: r2(first?.balance),
    monthly: r2(first?.payment),
    rate: n(first?.rate),
    months: n(first?.months) || firstExisting?.months || 0,
    payoff: "Yes - at Escrow",
    linkedReoId: reoId,
    subjectLien: "first",
  }, "1st mortgage");

  if (second && n(second.balance) > 0) {
    const secondExisting = findLien("second", (d) => d.type === "HELOC" || d.type === "Mortgage");
    const isHeloc = second.kind !== "closed";
    upsert(secondExisting, {
      name: second.lender || secondExisting?.name || (isHeloc ? "HELOC" : "2nd Mortgage"),
      type: isHeloc ? "HELOC" : "Mortgage",
      balance: r2(second.balance),
      monthly: r2(second.payment),
      rate: n(second.rate),
      months: secondExisting?.months || 0,
      payoff: secondPlan === "sub" ? "No" : "Yes - at Escrow",
      linkedReoId: reoId,
      subjectLien: "second",
    }, isHeloc ? "HELOC" : "2nd mortgage");
  }

  return { debts: nextDebts, reos: nextReos, reoId, changes };
}
