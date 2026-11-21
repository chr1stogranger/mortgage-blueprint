// src/lib/feeDefaults.js — the LO's default fee sheets, one for purchases and
// one for refinances (Christo 2026-11-20). Edited in Settings; a new scenario
// starts from the purchase sheet, and picking Refinance on a scenario whose
// fees are still untouched swaps in the refinance sheet.
//
// Kept on the LO's account through Ops (`?_route=bp-fee-defaults`, one personal
// settings row per person) so every device and the Ops panel share them;
// localStorage is the instant-paint copy. See reconcileFeeDefaults().
//
// Stored per device under bp_lo_default_fees as { v: 2, purchase, refi }.
// Each sheet is { savedAt, fees, customFees, hiddenFees } or null (= the
// standard sheet below). The first version of this feature stored one sheet
// in the bare { savedAt, fees, ... } shape and applied it to every new
// scenario; readFeeDefaults() carries that over to both sides.

export const FEE_DEFAULTS_KEY = "bp_lo_default_fees";

export const FEE_SECTIONS = [
  { id: "A", title: "Origination charges" },
  { id: "B", title: "Services you cannot shop for" },
  { id: "C", title: "Services you can shop for" },
  { id: "E", title: "Taxes and government fees" },
  { id: "H", title: "Other costs" },
];

// The built-in fee rows. `def` matches the useState defaults in
// MortgageBlueprint.jsx and BUILTIN_META in CostsContent.jsx.
// purchaseOnly: the row does not exist on a refinance (the itemized title
//   lines are zeroed there, see the "Section C defaults for refi" effect).
// refiDef: the standard refinance amount where it differs from a purchase.
// refiAuto: on a refinance the figure comes from the tiered title/escrow
//   schedule (src/data/titleEscrowFees.js) unless the LO pins a number.
export const FEE_META = [
  { key: "originatorComp", label: "Origination Fee", section: "A", def: 0 },
  { key: "adminFee", label: "Administration Fee", section: "A", def: 795 },
  { key: "lenderWireFee", label: "Lender Wire Fee", section: "A", def: 295 },
  { key: "underwritingFee", label: "Underwriting Fee", section: "A", def: 1250 },
  { key: "appraisalFee", label: "Appraisal Fee", section: "B", def: 850, refiDef: 595 },
  { key: "creditReportFee", label: "Credit Report Fee", section: "B", def: 134 },
  { key: "floodCertFee", label: "Flood Certificate Fee", section: "B", def: 8 },
  { key: "mersFee", label: "MERS Registration Fee", section: "B", def: 25 },
  { key: "processingFee", label: "Processing Fee", section: "B", def: 695 },
  { key: "taxServiceFee", label: "Tax Service Fee", section: "B", def: 85 },
  { key: "titleInsurance", label: "Lender's Title Insurance", section: "C", def: 2000, refiAuto: true },
  { key: "escrowFee", label: "Escrow Fee", section: "C", def: 2400, refiAuto: true },
  { key: "courierFee", label: "Courier / FedEx", section: "C", def: 150, purchaseOnly: true },
  { key: "loanTieInFee", label: "Loan Tie-in Fee", section: "C", def: 150, purchaseOnly: true },
  { key: "notaryFee", label: "Notary", section: "C", def: 175, purchaseOnly: true },
  { key: "envProtectionLien", label: "Environmental Protection Lien", section: "C", def: 100, purchaseOnly: true },
  { key: "recordingFee", label: "Recording Fees", section: "E", def: 200 },
  { key: "ownersTitleIns", label: "Owner's Title Insurance", section: "H", def: 3000, purchaseOnly: true },
  { key: "homeWarranty", label: "Home Warranty", section: "H", def: 500, purchaseOnly: true },
];

export const FEE_KEYS = FEE_META.map((m) => m.key);

// Custom fees can also sit under Credits ("CR") on the Costs tab; a sheet
// keeps those, they just are not part of the fee total.
const CUSTOM_SECTIONS = [...FEE_SECTIONS.map((s) => s.id), "CR"];

/** The fee sections a transaction type shows (a refinance has no Other costs). */
export function feeSectionsFor(type) {
  return type === "refi" ? FEE_SECTIONS.filter((s) => s.id !== "H") : FEE_SECTIONS;
}

const isRefiType = (type) => type === "refi";
const num = (v) => (typeof v === "number" && isFinite(v) && v >= 0 ? v : null);

/** The fee rows that exist for a transaction type. */
export function feeMetaFor(type) {
  return isRefiType(type) ? FEE_META.filter((m) => !m.purchaseOnly) : FEE_META;
}

/** The standard (factory) sheet. A null fee means "tiered by loan amount". */
export function standardSheet(type) {
  const fees = {};
  feeMetaFor(type).forEach((m) => { fees[m.key] = !isRefiType(type) ? m.def : m.refiAuto ? null : (m.refiDef ?? m.def); });
  return { savedAt: null, fees, customFees: [], hiddenFees: [] };
}

const cleanCustom = (list) => (Array.isArray(list) ? list : [])
  .filter((f) => f && typeof f.label === "string" && f.label.trim() && CUSTOM_SECTIONS.includes(f.section))
  .map((f, i) => ({ id: f.id ?? `d${i}`, section: f.section, label: f.label.trim().slice(0, 60), amount: num(Number(f.amount)) ?? 0 }));

/** A stored sheet laid over the standard one, so every row has an answer. */
export function normalizeSheet(type, raw) {
  const base = standardSheet(type);
  if (!raw || typeof raw !== "object") return base;
  const keys = feeMetaFor(type).map((m) => m.key);
  const hiddenFees = (Array.isArray(raw.hiddenFees) ? raw.hiddenFees : []).filter((k) => keys.includes(k));
  const fees = { ...base.fees };
  keys.forEach((k) => {
    const v = raw.fees ? raw.fees[k] : undefined;
    if (v === null && base.fees[k] === null) fees[k] = null;
    else if (num(v) !== null) fees[k] = v;
    if (hiddenFees.includes(k)) fees[k] = 0;
  });
  return { savedAt: raw.savedAt || null, fees, customFees: cleanCustom(raw.customFees), hiddenFees };
}

/** Parse what is in storage into { purchase, refi } (each a raw sheet or null). */
export function parseFeeDefaults(json) {
  let d = null;
  try { d = typeof json === "string" ? JSON.parse(json) : json; } catch { d = null; }
  if (!d || typeof d !== "object") return { purchase: null, refi: null };
  if (d.v === 2) return { purchase: d.purchase || null, refi: d.refi || null };
  if (!d.fees) return { purchase: null, refi: null };
  // First-version single sheet: it applied to every new scenario, and a
  // refinance re-priced title and escrow off the schedule regardless.
  // A refinance also always took its own appraisal figure.
  const drop = ["titleInsurance", "escrowFee", "appraisalFee", ...FEE_META.filter((m) => m.purchaseOnly).map((m) => m.key)];
  const refiFees = Object.fromEntries(Object.entries(d.fees).filter(([k]) => !drop.includes(k)));
  return {
    purchase: d,
    refi: { ...d, fees: refiFees, hiddenFees: (d.hiddenFees || []).filter((k) => !drop.includes(k)) },
  };
}

export function readFeeDefaults(storage) {
  try { return parseFeeDefaults(storage.getItem(FEE_DEFAULTS_KEY)); } catch { return { purchase: null, refi: null }; }
}

export function writeFeeDefaults(storage, store) {
  try {
    if (!store.purchase && !store.refi) storage.removeItem(FEE_DEFAULTS_KEY);
    else storage.setItem(FEE_DEFAULTS_KEY, JSON.stringify({ v: 2, purchase: store.purchase || null, refi: store.refi || null }));
  } catch { /* private mode */ }
}

/** Dollar total of a sheet's flat fees (tiered rows count as 0). */
export function sheetTotal(sheet) {
  const built = Object.values(sheet.fees || {}).reduce((t, v) => t + (v || 0), 0);
  return built + (sheet.customFees || []).reduce((t, f) => t + (f.section === "CR" ? 0 : (f.amount || 0)), 0);
}

const sameCustom = (a, b) => {
  const sig = (l) => (l || []).map((f) => `${f.section}|${f.label}|${f.amount || 0}`).sort().join("\n");
  return sig(a) === sig(b);
};
const sameSet = (a, b) => [...(a || [])].sort().join("|") === [...(b || [])].sort().join("|");

/**
 * True when a scenario's fee state is still exactly what the sheet for `type`
 * would have produced, so it is safe to swap in the other type's sheet.
 * Tiered rows (refi title/escrow left on the schedule) are not compared, and
 * hidden-fee keys that do not exist for the type are ignored.
 */
export function feesMatchSheet(current, type, rawSheet) {
  const sheet = normalizeSheet(type, rawSheet);
  const keys = feeMetaFor(type).map((m) => m.key);
  const feesOk = keys.every((k) => sheet.fees[k] === null || (current.fees?.[k] || 0) === sheet.fees[k]);
  const hidden = (current.hiddenFees || []).filter((k) => keys.includes(k));
  return feesOk && sameCustom(current.customFees, sheet.customFees) && sameSet(hidden, sheet.hiddenFees);
}

/**
 * Take a scenario's live fee state as the sheet for `type`.
 * keepTitleEscrow: on a refinance, title and escrow are kept as flat figures
 * only when the LO typed them; otherwise they stay on the schedule.
 */
export function sheetFromScenario(type, current, { keepTitleEscrow = false, now = new Date() } = {}) {
  const meta = feeMetaFor(type);
  const keys = meta.map((m) => m.key);
  const fees = {};
  meta.forEach((m) => {
    if (isRefiType(type) && m.refiAuto && !keepTitleEscrow) fees[m.key] = null;
    else fees[m.key] = num(current.fees?.[m.key]) ?? (isRefiType(type) ? (m.refiDef ?? m.def) : m.def);
  });
  return normalizeSheet(type, {
    savedAt: now.toISOString(), fees,
    customFees: current.customFees, hiddenFees: (current.hiddenFees || []).filter((k) => keys.includes(k)),
  });
}

// ── Account sync ────────────────────────────────────────────────────────────
// bp_lo_default_fees_synced remembers what this device last exchanged with the
// account ({ email, json }). A local copy that differs from it is an edit that
// has not reached the account yet.
export const FEE_DEFAULTS_SYNC_KEY = "bp_lo_default_fees_synced";

const hasAny = (store) => !!(store && (store.purchase || store.refi));
export const canonFeeDefaults = (store) => JSON.stringify({ v: 2, purchase: store?.purchase || null, refi: store?.refi || null });

export function readSyncMarker(storage) {
  try { const m = JSON.parse(storage.getItem(FEE_DEFAULTS_SYNC_KEY) || "null"); return m && typeof m.json === "string" ? m : null; } catch { return null; }
}
export function writeSyncMarker(storage, email, store) {
  try { storage.setItem(FEE_DEFAULTS_SYNC_KEY, JSON.stringify({ email, json: canonFeeDefaults(store) })); } catch { /* private mode */ }
}

/**
 * Decide what a device shows after reading the account, and whether it should
 * write back.
 *  - The account has sheets: they win, unless this device holds an edit by
 *    the same person that never reached the account.
 *  - The account has nothing yet: this device's sheets are uploaded, as long
 *    as the device is this person's (or nobody's). Another LO's leftovers are
 *    dropped instead of being saved onto this account.
 */
export function reconcileFeeDefaults({ local, marker, email, deviceOwner, server, serverHasRow }) {
  const mine = !!marker && marker.email === email;
  if (serverHasRow) {
    if (mine && canonFeeDefaults(local) !== marker.json) return { store: local, push: true };
    return { store: { purchase: server?.purchase || null, refi: server?.refi || null }, push: false };
  }
  if (mine || !deviceOwner || deviceOwner === email) return { store: local, push: hasAny(local) };
  return { store: { purchase: null, refi: null }, push: false };
}

const feeDefaultsUrl = (base) => `${base}/api/pipeline-data?_route=bp-fee-defaults`;

/** Read the account's sheets. Returns null when the account cannot be reached. */
export async function fetchAccountFeeDefaults(base, token, fetchImpl = fetch) {
  try {
    const r = await fetchImpl(feeDefaultsUrl(base), { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const d = await r.json();
    return { server: d?.sheets || null, serverHasRow: !!d?.updated_at };
  } catch { return null; }
}

/** Save the sheets to the account. Resolves true when the account took them. */
export async function pushAccountFeeDefaults(base, token, store, fetchImpl = fetch) {
  try {
    const r = await fetchImpl(feeDefaultsUrl(base), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: `{"sheets":${canonFeeDefaults(store)}}`,
    });
    return r.ok;
  } catch { return false; }
}
