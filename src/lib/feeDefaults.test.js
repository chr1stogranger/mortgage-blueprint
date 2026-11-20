import { describe, it, expect } from "vitest";
import {
  FEE_META, feeMetaFor, feeSectionsFor, standardSheet, normalizeSheet, parseFeeDefaults,
  readFeeDefaults, writeFeeDefaults, sheetTotal, feesMatchSheet, sheetFromScenario, FEE_DEFAULTS_KEY,
} from "./feeDefaults.js";

const memStore = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
};
const standardFees = () => Object.fromEntries(FEE_META.map((m) => [m.key, m.def]));

describe("standard sheets", () => {
  it("purchase carries every built-in fee at its factory amount", () => {
    const s = standardSheet("purchase");
    expect(Object.keys(s.fees)).toHaveLength(FEE_META.length);
    expect(s.fees.underwritingFee).toBe(1250);
    expect(s.fees.titleInsurance).toBe(2000);
    expect(sheetTotal(s)).toBe(12812);
  });
  it("refinance drops the purchase-only rows and leaves title and escrow on the schedule", () => {
    const s = standardSheet("refi");
    expect("ownersTitleIns" in s.fees).toBe(false);
    expect("homeWarranty" in s.fees).toBe(false);
    expect(s.fees.titleInsurance).toBeNull();
    expect(s.fees.escrowFee).toBeNull();
    expect("courierFee" in s.fees).toBe(false);
    expect(s.fees.appraisalFee).toBe(595);
    expect(sheetTotal(s)).toBe(4082);
    expect(feeMetaFor("refi")).toHaveLength(FEE_META.length - 6);
    expect(feeSectionsFor("refi").map((x) => x.id)).toEqual(["A", "B", "C", "E"]);
  });
});

describe("normalizeSheet", () => {
  it("lays stored values over the standard sheet and zeroes removed fees", () => {
    const s = normalizeSheet("purchase", { fees: { adminFee: 995, bogus: 5, appraisalFee: -4 }, hiddenFees: ["homeWarranty", "nope"] });
    expect(s.fees.adminFee).toBe(995);
    expect(s.fees.appraisalFee).toBe(850);
    expect(s.fees.homeWarranty).toBe(0);
    expect(s.hiddenFees).toEqual(["homeWarranty"]);
    expect("bogus" in s.fees).toBe(false);
  });
  it("keeps a pinned refinance title figure and an explicit schedule choice", () => {
    expect(normalizeSheet("refi", { fees: { titleInsurance: 900 } }).fees.titleInsurance).toBe(900);
    expect(normalizeSheet("refi", { fees: { titleInsurance: null } }).fees.titleInsurance).toBeNull();
    expect(normalizeSheet("purchase", { fees: { titleInsurance: null } }).fees.titleInsurance).toBe(2000);
  });
  it("keeps custom fees and credits, drops junk", () => {
    const s = normalizeSheet("purchase", { customFees: [
      { id: 1, section: "B", label: " Pest inspection ", amount: 150 },
      { id: 2, section: "CR", label: "Promo credit", amount: 500 },
      { id: 3, section: "Z", label: "x", amount: 1 }, { id: 4, section: "A", label: "  ", amount: 1 },
    ] });
    expect(s.customFees.map((f) => f.label)).toEqual(["Pest inspection", "Promo credit"]);
    expect(sheetTotal(s)).toBe(12812 + 150);
  });
});

describe("storage", () => {
  it("round-trips both sheets and clears the key when neither is set", () => {
    const st = memStore();
    writeFeeDefaults(st, { purchase: { fees: { adminFee: 1 } }, refi: null });
    expect(readFeeDefaults(st)).toEqual({ purchase: { fees: { adminFee: 1 } }, refi: null });
    writeFeeDefaults(st, { purchase: null, refi: null });
    expect(st.getItem(FEE_DEFAULTS_KEY)).toBeNull();
    expect(readFeeDefaults(st)).toEqual({ purchase: null, refi: null });
  });
  it("carries the first-version single sheet to both sides", () => {
    const legacy = { savedAt: "2026-07-05T00:00:00.000Z", fees: { ...standardFees(), adminFee: 995, titleInsurance: 1800, appraisalFee: 700 }, customFees: [], hiddenFees: ["homeWarranty", "mersFee"] };
    const { purchase, refi } = parseFeeDefaults(JSON.stringify(legacy));
    expect(normalizeSheet("purchase", purchase).fees.titleInsurance).toBe(1800);
    const r = normalizeSheet("refi", refi);
    expect(r.fees.adminFee).toBe(995);
    expect(r.fees.titleInsurance).toBeNull();
    expect(r.fees.appraisalFee).toBe(595);
    expect(r.hiddenFees).toEqual(["mersFee"]);
  });
  it("survives garbage", () => {
    expect(parseFeeDefaults("{nope")).toEqual({ purchase: null, refi: null });
    expect(parseFeeDefaults(null)).toEqual({ purchase: null, refi: null });
  });
});

describe("feesMatchSheet", () => {
  const live = (over = {}) => ({ fees: { ...standardFees(), ...over.fees }, customFees: over.customFees || [], hiddenFees: over.hiddenFees || [] });
  it("an untouched scenario matches the standard purchase sheet", () => {
    expect(feesMatchSheet(live(), "purchase", null)).toBe(true);
  });
  it("an edited amount, an added fee or a removed fee no longer matches", () => {
    expect(feesMatchSheet(live({ fees: { adminFee: 800 } }), "purchase", null)).toBe(false);
    expect(feesMatchSheet(live({ customFees: [{ id: 1, section: "B", label: "Pest", amount: 100 }] }), "purchase", null)).toBe(false);
    expect(feesMatchSheet(live({ fees: { mersFee: 0 }, hiddenFees: ["mersFee"] }), "purchase", null)).toBe(false);
  });
  it("matches the LO's own sheet", () => {
    const sheet = { fees: { adminFee: 995 }, hiddenFees: ["mersFee"], customFees: [{ id: 9, section: "B", label: "Pest", amount: 100 }] };
    const cur = live({ fees: { adminFee: 995, mersFee: 0 }, hiddenFees: ["mersFee"], customFees: [{ id: 1, section: "B", label: "Pest", amount: 100 }] });
    expect(feesMatchSheet(cur, "purchase", sheet)).toBe(true);
  });
  it("a refinance ignores schedule-priced title and escrow and the purchase-only rows", () => {
    const cur = live({ fees: { appraisalFee: 595, titleInsurance: 755, escrowFee: 785, courierFee: 0, ownersTitleIns: 0 }, hiddenFees: ["ownersTitleIns"] });
    expect(feesMatchSheet(cur, "refi", null)).toBe(true);
    expect(feesMatchSheet(cur, "refi", { fees: { titleInsurance: 900 } })).toBe(false);
  });
});

describe("sheetFromScenario", () => {
  const cur = { fees: { ...standardFees(), adminFee: 500, titleInsurance: 755, escrowFee: 785 }, customFees: [{ id: 1, section: "A", label: "Lock fee", amount: 250 }], hiddenFees: ["homeWarranty"] };
  const now = new Date("2026-11-20T12:00:00Z");
  it("purchase takes every figure", () => {
    const s = sheetFromScenario("purchase", cur, { now });
    expect(s.fees.adminFee).toBe(500);
    expect(s.fees.titleInsurance).toBe(755);
    expect(s.fees.homeWarranty).toBe(0);
    expect(s.savedAt).toBe(now.toISOString());
    expect(s.customFees).toHaveLength(1);
  });
  it("refinance leaves title and escrow on the schedule unless they were typed", () => {
    expect(sheetFromScenario("refi", cur, { now }).fees.titleInsurance).toBeNull();
    const kept = sheetFromScenario("refi", cur, { now, keepTitleEscrow: true });
    expect(kept.fees.titleInsurance).toBe(755);
    expect(kept.hiddenFees).toEqual([]);
  });
});
