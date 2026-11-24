import { describe, it, expect } from "vitest";
import { mergeClientMatches } from "./CreateClientModal.jsx";

const clients = [{ id: 1, name: "Jane Smith", email: "jane@x.com" }, { id: 2, name: "Bob Jones", email: "" }];
const arive = [
  { id: "a1", name: "Jane Smith", email: "JANE@x.com", loan_amount: 500000 },
  { id: "a2", name: "Janet Lee", email: "janet@x.com", property: "1 Main St, Oakland", loan_amount: 640000, purpose: "Purchase" },
];
const ops = [
  { name: "Janet Lee", email: "janet@x.com", detail: "Lead", kind: "lead" },
  { name: "Janice Wu", email: "janice@x.com", detail: "Closed Mar 2025", kind: "past_client" },
  { name: "Zed Other", email: "zed@x.com", detail: "", kind: "lead" },
];

describe("mergeClientMatches", () => {
  it("needs two characters", () => {
    expect(mergeClientMatches("j", clients, arive, ops)).toEqual([]);
  });
  it("shows one row per person: Blueprint beats Arive beats Ops", () => {
    const out = mergeClientMatches("jan", clients, arive, ops);
    expect(out.map((m) => [m.source, m.name])).toEqual([
      ["blueprint", "Jane Smith"],
      ["arive", "Janet Lee"],
      ["ops", "Janice Wu"],
    ]);
    expect(out[1].detail).toBe("1 Main St, Oakland · $640,000 · Purchase");
    expect(out[2].detail).toBe("Past client · Closed Mar 2025");
  });
  it("matches local lists by email too, and keeps people with no email", () => {
    expect(mergeClientMatches("zed@", clients, [], ops).map((m) => m.name)).toEqual(["Zed Other"]);
    expect(mergeClientMatches("bob", clients, [], ops).map((m) => m.source)).toEqual(["blueprint"]);
  });
});
