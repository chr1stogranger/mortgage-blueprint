/**
 * Fannie Mae 3.4 (MISMO 3.4 / ULAD XML) → Blueprint assets, debts, and REO.
 *
 * Arive's API exposes no assets, liabilities, or REO (every sub-route 404s,
 * re-probed 2026-10-27), but Arive — like every LOS — exports the full 1003
 * as a "Fannie Mae 3.4" XML file. The LO picks that file in the browser and
 * it is parsed right here: the file never leaves the device.
 *
 * Privacy: a 3.4 file carries SSNs, birth dates, and account numbers. This
 * module reads a strict whitelist of fields and never touches
 * *AccountIdentifier, TaxpayerIdentifier*, or BorrowerBirthDate. Institution
 * and creditor names still go through safeName() to drop digit runs.
 *
 * Shapes match MortgageBlueprint's addAsset / addDebt / addReo rows, so the
 * result drops straight into state. Income is deliberately left out — the
 * Arive import already brings it, and doubling it would overstate DTI.
 *
 * The XML reader is a small dependency-free tokenizer (not DOMParser) so the
 * same code runs under vitest's node environment.
 */
import { safeName } from "./arivePrefill.js";

// ── Minimal XML reader ──────────────────────────────────────────────────────
// MISMO files are plain element/attribute/text XML: no mixed content we care
// about, no DTD entities. Names are reduced to local names (prefix dropped).

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
  if (e[0] === "#") {
    const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  }
  return ENTITIES[e] ?? m;
});
const local = (name) => name.slice(name.indexOf(":") + 1);

export function parseXml(text) {
  const src = String(text ?? "")
    .replace(/^﻿/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[^>[]*(\[[\s\S]*?\])?\s*>/gi, "");
  const root = { name: "#root", attrs: {}, children: [], text: "" };
  const stack = [root];
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) { top.text += m[1]; continue; }
    if (m[6] !== undefined) { top.text += decode(m[6]); continue; }
    const [, , closing, rawName, rawAttrs, selfClose] = m;
    const name = local(rawName);
    if (closing) {
      if (stack.length > 1 && top.name === name) stack.pop();
      continue;
    }
    const attrs = {};
    for (const a of rawAttrs.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attrs[local(a[1])] = decode(a[2] ?? a[3] ?? "");
    }
    const el = { name, attrs, children: [], text: "" };
    top.children.push(el);
    if (!selfClose) stack.push(el);
  }
  return root;
}

// ── Tree helpers ────────────────────────────────────────────────────────────

const kids = (el, name) => (el?.children || []).filter((c) => c.name === name);
const kid = (el, name) => (el?.children || []).find((c) => c.name === name) || null;
/** Follow a child path, e.g. at(asset, "ASSET_DETAIL", "AssetType"). */
const at = (el, ...path) => path.reduce((e, p) => kid(e, p), el);
const txt = (el, ...path) => (at(el, ...path)?.text || "").trim();
const num = (el, ...path) => {
  const x = Number(txt(el, ...path).replace(/[$,\s]/g, ""));
  return Number.isFinite(x) ? x : 0;
};
const bool = (el, ...path) => txt(el, ...path).toLowerCase() === "true";
function findAll(el, name, out = []) {
  for (const c of el.children) {
    if (c.name === name) out.push(c);
    findAll(c, name, out);
  }
  return out;
}

// ── Enum maps (MISMO 3.4 → Blueprint) ───────────────────────────────────────

const ASSET_TYPE_MAP = {
  CheckingAccount: "Checking",
  SavingsAccount: "Saving",
  CertificateOfDepositTimeDeposit: "Saving",
  IndividualDevelopmentAccount: "Saving",
  MoneyMarketFund: "Money Market",
  MutualFund: "Mutual Fund",
  Stock: "Stocks",
  StockOptions: "Stocks",
  Bond: "Bonds",
  RetirementFund: "Retirement",
  TrustAccount: "Trust",
  BridgeLoanNotDeposited: "Bridge Loan",
  GiftOfCash: "Gift",
  GiftsNotDeposited: "Gift",
  GiftsTotal: "Gift",
  Grant: "Gift",
  GiftOfPropertyEquity: "Gift of Equity",
};

const LIABILITY_TYPE_MAP = {
  Revolving: "Revolving",
  Open30DayChargeAccount: "Revolving",
  Installment: "Installment",
  MortgageLoan: "Mortgage",
  HELOC: "HELOC",
  LeasePayment: "Auto Lease",
  CollectionsJudgmentsAndLiens: "Collection",
  TaxLien: "Collection",
};

/** Installment debts the 1003 doesn't subtype — refine by creditor name. */
function refineInstallment(name) {
  const s = name.toLowerCase();
  if (/student|navient|nelnet|mohela|great lakes|aidvantage|edfinancial|sallie|dept\.? of ed|department of education/.test(s)) return "Student Loan";
  if (/auto|motor|toyota|honda|ford|gm financial|ally|carmax|tesla|nissan|hyundai|kia|subaru|lexus|bmw|mercedes/.test(s)) return "Auto Loan";
  return "Installment";
}

const UNITS_TO_PROP_TYPE = { 2: "Duplex", 3: "Triplex", 4: "4-plex" };

/**
 * REO occupancy (REO_OCCUPANCY_TYPES) + propUse (occupancyToPropUse).
 * `intended` (PropertyUsageType) wins over `current` (PropertyCurrentUsageType):
 * a home the borrower lives in today but will rent out after closing is an
 * investment for DTI — it gets the 75% rent offset. A primary being sold is
 * Departing.
 */
function reoOccupancy(current, intended, disposition, isSubject) {
  const cur = String(current || "");
  const u = String(intended || current || "");
  let occ;
  if (/primary/i.test(cur) && /pending/i.test(disposition) && !isSubject) occ = "Departing";
  else if (/primary/i.test(u)) occ = "Primary";
  else if (/second/i.test(u)) occ = "Second";
  else occ = "Invest.";
  if (isSubject && occ !== "Departing") occ += " (Subj)";
  const propUse = occ.startsWith("Primary") || occ === "Departing" ? "Primary" : occ.startsWith("Second") ? "Second Home" : "Investment";
  return { occupancy: occ, propUse };
}

// ── Parser ──────────────────────────────────────────────────────────────────

export class MismoImportError extends Error {}

/**
 * @param {string} xmlText  contents of the 3.4 file
 * @param {{ seed?: number }} opts  id seed (tests pass a fixed one)
 * @returns {{ assets, debts, reos, borrowers: string[], notes: string[] }}
 */
export function parseMismo34(xmlText, { seed = Date.now() } = {}) {
  const head = String(xmlText ?? "").slice(0, 2000);
  if (!/<\s*([\w-]+:)?MESSAGE\b/.test(head) && !/<\s*([\w-]+:)?DEAL\b/.test(String(xmlText ?? ""))) {
    if (/^\s*[0-9A-Z]{3}\s/.test(head) || /^EH\s|^00A/m.test(head)) {
      throw new MismoImportError("This looks like a Fannie Mae 3.2 (.fnm) file. Export the loan as Fannie Mae 3.4 (MISMO XML) instead.");
    }
    throw new MismoImportError("That file isn't a Fannie Mae 3.4 (MISMO XML) export.");
  }

  const tree = parseXml(xmlText);
  const deal = findAll(tree, "DEAL").find((d) => kid(d, "ASSETS") || kid(d, "LIABILITIES") || kid(d, "PARTIES"));
  if (!deal) throw new MismoImportError("No loan found in this file.");

  // Borrower roles → slot 1 / 2 (Primary classification first, then file order).
  const borrowerRoles = [];
  for (const party of kids(kid(deal, "PARTIES"), "PARTY")) {
    for (const role of kids(kid(party, "ROLES"), "ROLE")) {
      const roleType = txt(role, "ROLE_DETAIL", "PartyRoleType");
      if (!kid(role, "BORROWER") && roleType !== "Borrower") continue;
      const first = txt(party, "INDIVIDUAL", "NAME", "FirstName");
      const last = txt(party, "INDIVIDUAL", "NAME", "LastName");
      borrowerRoles.push({
        label: role.attrs.label || "",
        primary: /primary/i.test(txt(role, "BORROWER", "BORROWER_DETAIL", "BorrowerClassificationType")),
        name: [first, last].filter(Boolean).join(" "),
      });
    }
  }
  borrowerRoles.sort((a, b) => Number(b.primary) - Number(a.primary));
  const slotOf = new Map(borrowerRoles.map((r, i) => [r.label, Math.min(2, i + 1)]));

  // xlink relationships: from-label → [to-labels] per arcrole.
  const rel = {};
  for (const r of kids(kid(deal, "RELATIONSHIPS"), "RELATIONSHIP")) {
    const role = String(r.attrs.arcrole || "").split("/").pop();
    if (!role || !r.attrs.from || !r.attrs.to) continue;
    ((rel[role] ||= {})[r.attrs.from] ||= []).push(r.attrs.to);
  }
  const ownerSlots = (arcrole, label) => [...new Set((rel[arcrole]?.[label] || []).map((l) => slotOf.get(l)).filter(Boolean))];

  const notes = [];
  const assets = [];
  const reos = [];
  const reoIdByAssetLabel = new Map();
  let id = seed;

  for (const asset of kids(kid(deal, "ASSETS"), "ASSET")) {
    const label = asset.attrs.label || "";
    const owned = kid(asset, "OWNED_PROPERTY");
    if (owned) {
      const detail = kid(owned, "OWNED_PROPERTY_DETAIL");
      const disposition = txt(detail, "OwnedPropertyDispositionStatusType");
      if (/^sold$/i.test(disposition)) { notes.push("Skipped a property marked Sold."); continue; }
      const prop = kid(owned, "PROPERTY");
      const addr = kid(prop, "ADDRESS");
      const isSubject = bool(detail, "OwnedPropertySubjectIndicator");
      const { occupancy, propUse } = reoOccupancy(
        txt(prop, "PROPERTY_DETAIL", "PropertyCurrentUsageType"),
        txt(prop, "PROPERTY_DETAIL", "PropertyUsageType"),
        disposition, isSubject,
      );
      const units = num(prop, "PROPERTY_DETAIL", "FinancedUnitCount");
      const street = [txt(addr, "AddressLineText"), txt(addr, "AddressUnitIdentifier") && `#${txt(addr, "AddressUnitIdentifier")}`].filter(Boolean).join(" ");
      const reo = {
        id: id++,
        address: [street, txt(addr, "CityName"), [txt(addr, "StateCode"), txt(addr, "PostalCode")].filter(Boolean).join(" ")].filter(Boolean).join(", "),
        propType: UNITS_TO_PROP_TYPE[units] || "Single Family",
        occupancy,
        value: num(prop, "PROPERTY_DETAIL", "PropertyEstimatedValueAmount"),
        mortgageBalance: num(detail, "OwnedPropertyLienUPBAmount"),
        payment: 0,
        includesTI: true,
        reoTax: 0, reoIns: 0, reoHoa: 0,
        rentalIncome: num(detail, "OwnedPropertyRentalIncomeGrossAmount"),
        propUse,
        linkedDebtIdx: -1,
        // Working fields, stripped before return.
        _maintenance: num(detail, "OwnedPropertyMaintenanceExpenseAmount"),
        _net: num(detail, "OwnedPropertyRentalIncomeNetAmount"),
        _hasGross: !!at(detail, "OwnedPropertyRentalIncomeGrossAmount"),
      };
      reos.push(reo);
      reoIdByAssetLabel.set(label, reo.id);
      continue;
    }

    const typeRaw = txt(asset, "ASSET_DETAIL", "AssetType");
    const type = ASSET_TYPE_MAP[typeRaw] || "Other";
    const holder = txt(asset, "ASSET_HOLDER", "NAME", "FullName");
    const value = num(asset, "ASSET_DETAIL", "AssetCashOrMarketValueAmount");
    if (!(value > 0)) continue;
    const slots = ownerSlots("ASSET_IsAssociatedWith_ROLE", label);
    assets.push({
      id: id++,
      bank: safeName(holder) || (type === "Other" ? safeName(txt(asset, "ASSET_DETAIL", "AssetTypeOtherDescription")) || typeRaw : type),
      last4: "",
      owner: slots.length >= 2 ? "Joint" : slots[0] === 2 ? "Co-Borrower" : slots[0] === 1 ? "Borrower" : "",
      type,
      value,
      forClosing: 0,
    });
  }

  // Liabilities. The owned-property link runs ASSET → LIABILITY.
  const reoIdByLiability = new Map();
  for (const [assetLabel, liabLabels] of Object.entries(rel.ASSET_IsAssociatedWith_LIABILITY || {})) {
    const reoId = reoIdByAssetLabel.get(assetLabel);
    if (reoId) for (const l of liabLabels) reoIdByLiability.set(l, reoId);
  }

  const debts = [];
  for (const liab of kids(kid(deal, "LIABILITIES"), "LIABILITY")) {
    const label = liab.attrs.label || "";
    const d = kid(liab, "LIABILITY_DETAIL");
    const creditor = safeName(txt(liab, "LIABILITY_HOLDER", "NAME", "FullName"));
    const typeRaw = txt(d, "LiabilityType");
    let type = LIABILITY_TYPE_MAP[typeRaw] || "Other";
    if (type === "Installment") type = refineInstallment(creditor);
    const balance = num(d, "LiabilityUnpaidBalanceAmount");
    const monthly = num(d, "LiabilityMonthlyPaymentAmount");
    if (!(balance > 0) && !(monthly > 0)) continue;
    const payoff = bool(d, "LiabilityExclusionIndicator") ? "Omit"
      : bool(d, "LiabilityPayoffWithCurrentAssetsIndicator") ? "Yes - POC"
      : bool(d, "LiabilityPayoffStatusIndicator") ? "Yes - at Escrow"
      : "No";
    const slots = ownerSlots("LIABILITY_IsAssociatedWith_ROLE", label);
    const reoId = reoIdByLiability.get(label);
    const isLien = type === "Mortgage" || type === "HELOC";
    debts.push({
      id: id++,
      name: creditor || (typeRaw ? typeRaw.replace(/([a-z])([A-Z])/g, "$1 $2") : "Liability"),
      type,
      borrower: slots.length === 1 ? `Borrower ${slots[0]}` : "Joint",
      balance,
      monthly,
      rate: 0,
      months: num(d, "LiabilityRemainingTermMonthsCount"),
      payoff,
      payoffAmount: 0,
      linkedReoId: reoId && isLien ? String(reoId) : "",
      _includesTI: bool(d, "LiabilityPaymentIncludesTaxesInsuranceIndicator"),
    });
  }

  // REO payment / balance from linked liens (mirrors DebtsContent.linkReo),
  // then taxes/insurance/HOA and — when the file only has net rent — gross
  // rent backed out of the 1003 formula: net = 75% × gross − PITIA.
  for (const reo of reos) {
    const linked = debts.filter((x) => x.linkedReoId === String(reo.id));
    if (linked.length) {
      reo.payment = linked.reduce((s, x) => s + x.monthly, 0);
      reo.mortgageBalance = linked.reduce((s, x) => s + x.balance, 0);
    }
    const tiInPayment = linked.some((x) => x.type === "Mortgage" && x._includesTI);
    if (reo._maintenance > 0 && !tiInPayment) {
      reo.includesTI = false;
      reo.reoTax = reo._maintenance;
    }
    if (!reo._hasGross && reo._net !== 0 && reo.propUse === "Investment") {
      const pitia = reo.payment + (reo.includesTI ? 0 : reo._maintenance);
      const gross = Math.round((reo._net + pitia) / 0.75);
      if (gross > 0) reo.rentalIncome = gross;
    }
    delete reo._maintenance; delete reo._net; delete reo._hasGross;
  }
  for (const x of debts) delete x._includesTI;

  if (reos.some((r) => r.reoTax > 0)) notes.push("Taxes, insurance and HOA come over as one total in each property's Tax field.");

  return { assets, debts, reos, borrowers: borrowerRoles.map((r) => r.name).filter(Boolean), notes };
}

// ── Merge into an open scenario ─────────────────────────────────────────────

const debtKey = (d) => `${String(d.name).toLowerCase()}|${Math.round(Number(d.balance) || 0)}`;
const assetKey = (a) => `${String(a.bank).toLowerCase()}|${a.type}|${Math.round(Number(a.value) || 0)}`;
const reoKey = (r) => String(r.address || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);

/**
 * Append parsed rows to what the scenario already has, skipping rows that
 * are already there (same creditor + balance, same account + value, same
 * street address) — re-importing the same file is a no-op, not a doubling.
 * A skipped REO's id is remapped so its debts still link to the existing row.
 */
export function mergeMismoImport(current, parsed) {
  const cur = { assets: current.assets || [], debts: current.debts || [], reos: current.reos || [] };
  const reoIdMap = new Map();
  const reosHave = new Map(cur.reos.filter((r) => reoKey(r)).map((r) => [reoKey(r), r.id]));
  const newReos = [];
  for (const r of parsed.reos) {
    const k = reoKey(r);
    if (k && reosHave.has(k)) reoIdMap.set(String(r.id), String(reosHave.get(k)));
    else newReos.push(r);
  }
  const assetsHave = new Set(cur.assets.map(assetKey));
  const debtsHave = new Set(cur.debts.map(debtKey));
  const newAssets = parsed.assets.filter((a) => !assetsHave.has(assetKey(a)));
  const newDebts = parsed.debts
    .filter((d) => !debtsHave.has(debtKey(d)))
    .map((d) => (reoIdMap.has(d.linkedReoId) ? { ...d, linkedReoId: reoIdMap.get(d.linkedReoId) } : d));
  return {
    assets: [...cur.assets, ...newAssets],
    debts: [...cur.debts, ...newDebts],
    reos: [...cur.reos, ...newReos],
    added: { assets: newAssets.length, debts: newDebts.length, reos: newReos.length },
    skipped: {
      assets: parsed.assets.length - newAssets.length,
      debts: parsed.debts.length - newDebts.length,
      reos: parsed.reos.length - newReos.length,
    },
  };
}
