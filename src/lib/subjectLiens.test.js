import { describe, it, expect } from "vitest";
import { syncSubjectLiens, isRefiSubjectLien, isSubjectReo } from "./subjectLiens.js";

const property = { address: "123 Example St, Springfield, California", value: 750000, propType: "Single Family", loanPurpose: "Refi Rate/Term", annualTax: 10824, annualIns: 600, hoa: 500 };
const first = { servicer: "Example Servicing", balance: 400000, rate: 4.875, payment: 2500, months: 239, escrowed: false };
const heloc = { kind: "heloc", balance: 15000, rate: 8.4, payment: 105 };

describe("syncSubjectLiens (refi with a HELOC behind the 1st)", () => {
  it("absorbs the auto-added Current Mortgage, adds the HELOC and the subject REO, and links them", () => {
    const debts = [{ id: 1, name: "Current Mortgage", type: "Mortgage", balance: 400000, monthly: 2500, payoff: "Yes - at Escrow", linkedReoId: "" }];
    const out = syncSubjectLiens({ debts, reos: [], first, second: heloc, property, now: 1000 });
    expect(out.reos).toHaveLength(1);
    const reo = out.reos[0];
    expect(reo.occupancy).toBe("Primary (Subj)");
    expect(reo.propUse).toBe("Primary");
    expect(reo.mortgageBalance).toBe(415000);
    expect(reo.includesTI).toBe(false);
    expect(reo.reoTax).toBe(902);
    expect(out.debts).toHaveLength(2);
    const [m, h] = out.debts;
    expect(m.id).toBe(1);
    expect(m.name).toBe("Example Servicing");
    expect(m.subjectLien).toBe("first");
    expect(h.type).toBe("HELOC");
    expect(h.payoff).toBe("Yes - at Escrow");
    expect(m.linkedReoId).toBe(String(reo.id));
    expect(h.linkedReoId).toBe(String(reo.id));
  });

  it("is idempotent: reading the statement again updates instead of duplicating", () => {
    const once = syncSubjectLiens({ debts: [], reos: [], first, second: heloc, property, now: 1000 });
    const twice = syncSubjectLiens({ debts: once.debts, reos: once.reos, first: { ...first, balance: 390000 }, second: heloc, property, now: 2000 });
    expect(twice.debts).toHaveLength(2);
    expect(twice.reos).toHaveLength(1);
    expect(twice.debts[0].balance).toBe(390000);
  });

  it("leaves other properties' liens and consumer debts alone", () => {
    const debts = [
      { id: 5, name: "Rental mortgage", type: "Mortgage", balance: 200000, monthly: 1500, payoff: "No", linkedReoId: "77" },
      { id: 6, name: "Visa", type: "Revolving", balance: 3000, monthly: 90, payoff: "No", linkedReoId: "" },
    ];
    const reos = [{ id: 77, occupancy: "Invest.", propUse: "Investment" }];
    const out = syncSubjectLiens({ debts, reos, first, property, now: 1000 });
    expect(out.debts.find((d) => d.id === 5)).toEqual(debts[0]);
    expect(out.debts.find((d) => d.id === 6)).toEqual(debts[1]);
    expect(out.debts).toHaveLength(3);
    expect(out.reos).toHaveLength(2);
  });
});

describe("isRefiSubjectLien", () => {
  const reos = [{ id: 1, occupancy: "Primary (Subj)" }, { id: 2, occupancy: "Invest." }];
  it("treats unlinked and subject-linked liens as the subject's", () => {
    expect(isRefiSubjectLien({ type: "Mortgage", linkedReoId: "" }, reos)).toBe(true);
    expect(isRefiSubjectLien({ type: "HELOC", linkedReoId: "1" }, reos)).toBe(true);
    expect(isRefiSubjectLien({ type: "Mortgage", linkedReoId: "2" }, reos)).toBe(false);
    expect(isRefiSubjectLien({ type: "Revolving", linkedReoId: "" }, reos)).toBe(false);
  });
  it("recognises subject REO rows", () => {
    expect(isSubjectReo(reos[0])).toBe(true);
    expect(isSubjectReo(reos[1])).toBe(false);
  });
});
