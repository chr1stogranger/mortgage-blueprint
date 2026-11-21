import { describe, it, expect } from "vitest";
import {
  FEE_META, feeMetaFor, feeSectionsFor, standardSheet, normalizeSheet, parseFeeDefaults,
  readFeeDefaults, writeFeeDefaults, sheetTotal, feesMatchSheet, sheetFromScenario, FEE_DEFAULTS_KEY,
  canonFeeDefaults, reconcileFeeDefaults, readSyncMarker, writeSyncMarker, fetchAccountFeeDefaults, pushAccountFeeDefaults,
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

describe("account sync", () => {
  const A = { purchase: { fees: { adminFee: 1 } }, refi: null };
  const B = { purchase: { fees: { adminFee: 2 } }, refi: { fees: { adminFee: 3 } } };
  const none = { purchase: null, refi: null };
  const me = "lo@example.test";
  const marker = (store, email = me) => ({ email, json: canonFeeDefaults(store) });

  it("the account wins on a device that has nothing pending", () => {
    expect(reconcileFeeDefaults({ local: A, marker: marker(A), email: me, server: B, serverHasRow: true })).toEqual({ store: B, push: false });
    expect(reconcileFeeDefaults({ local: A, marker: null, email: me, server: B, serverHasRow: true })).toEqual({ store: B, push: false });
  });
  it("an edit that never reached the account is sent up", () => {
    expect(reconcileFeeDefaults({ local: B, marker: marker(A), email: me, server: A, serverHasRow: true })).toEqual({ store: B, push: true });
  });
  it("a reset on another device comes down as the standard sheets", () => {
    expect(reconcileFeeDefaults({ local: A, marker: marker(A), email: me, server: none, serverHasRow: true }).store).toEqual(none);
  });
  it("first sync uploads this device's sheets", () => {
    expect(reconcileFeeDefaults({ local: A, marker: null, email: me, deviceOwner: me, server: null, serverHasRow: false })).toEqual({ store: A, push: true });
    expect(reconcileFeeDefaults({ local: none, marker: null, email: me, deviceOwner: "", server: null, serverHasRow: false })).toEqual({ store: none, push: false });
  });
  it("another LO's leftovers are not saved onto this account", () => {
    expect(reconcileFeeDefaults({ local: A, marker: marker(A, "other@example.test"), email: me, deviceOwner: "other@example.test", server: null, serverHasRow: false })).toEqual({ store: none, push: false });
    expect(reconcileFeeDefaults({ local: A, marker: marker(B, "other@example.test"), email: me, server: B, serverHasRow: true })).toEqual({ store: B, push: false });
  });
  it("the sync marker round-trips", () => {
    const st = memStore();
    expect(readSyncMarker(st)).toBeNull();
    writeSyncMarker(st, me, A);
    expect(readSyncMarker(st)).toEqual(marker(A));
  });
  it("reads and writes through Ops", async () => {
    const calls = [];
    const ok = (body) => async (url, opts) => { calls.push({ url, opts }); return { ok: true, json: async () => body }; };
    expect(await fetchAccountFeeDefaults("https://ops.test", "tok", ok({ sheets: A, updated_at: "2026-11-20T00:00:00Z" }))).toEqual({ server: A, serverHasRow: true });
    expect(await fetchAccountFeeDefaults("https://ops.test", "tok", ok({ sheets: null, updated_at: null }))).toEqual({ server: null, serverHasRow: false });
    expect(await fetchAccountFeeDefaults("https://ops.test", "tok", async () => ({ ok: false }))).toBeNull();
    expect(await fetchAccountFeeDefaults("https://ops.test", "tok", async () => { throw new Error("offline"); })).toBeNull();
    expect(await pushAccountFeeDefaults("https://ops.test", "tok", A, ok({ ok: true }))).toBe(true);
    const sent = calls[calls.length - 1];
    expect(sent.url).toBe("https://ops.test/api/pipeline-data?_route=bp-fee-defaults");
    expect(JSON.parse(sent.opts.body)).toEqual({ sheets: { v: 2, purchase: A.purchase, refi: null } });
    expect(sent.opts.headers.Authorization).toBe("Bearer tok");
    expect(await pushAccountFeeDefaults("https://ops.test", "tok", A, async () => ({ ok: false }))).toBe(false);
  });
});
