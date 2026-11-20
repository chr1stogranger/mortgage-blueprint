import { describe, it, expect } from "vitest";
import { rosterLoanTeamFills, ariveOriginatorSlots, myRosterEmails } from "./dealTeamFill.js";

// Shaped like the live roster: the head LO has several sign-in addresses and
// each teammate's link names only one of them.
const ROSTER = [
  { name: "Head Lo", email: "head@work.com", role: "admin", linked_los: [] },
  { name: "Head Lo", email: "head@gmail.com", role: "admin", linked_los: [] },
  { name: "Tee Mlo", email: "tee@work.com", role: "team_lo", phone: "5551112222", linked_los: ["head@gmail.com"] },
  { name: "Tee Mlo", email: "tee@gmail.com", role: "lo", linked_los: [] },
  { name: "Lo Ay", email: "loa@work.com", role: "loa", linked_los: ["head@work.com"] },
  { name: "Pro Cessor", email: "proc@work.com", role: "processor", linked_los: ["head@work.com"] },
  { name: "Other Lo", email: "other@work.com", role: "lo", linked_los: [] },
  { name: "Other Team", email: "ot@work.com", role: "team_lo", linked_los: ["other@work.com"] },
];
const roles = (fills) => Object.fromEntries(fills.map(f => [f.role, f.email]));

describe("rosterLoanTeamFills", () => {
  it("fills the team LO linked to another of the head LO's addresses", () => {
    expect(roles(rosterLoanTeamFills([], ROSTER, "head@work.com"))).toEqual({
      lo: "head@work.com", team_lo: "tee@work.com", loa: "loa@work.com", processor: "proc@work.com",
    });
  });

  it("matches the sign-in address without regard to case", () => {
    expect(roles(rosterLoanTeamFills([], ROSTER, "Head@Work.com")).team_lo).toBe("tee@work.com");
  });

  it("never replaces a slot that is already filled", () => {
    const team = [{ role: "team_lo", name: "Someone Else", email: "x@y.com" }, { role: "lo", name: "Head Lo", email: "head@work.com" }];
    expect(roles(rosterLoanTeamFills(team, ROSTER, "head@work.com"))).toEqual({ loa: "loa@work.com", processor: "proc@work.com" });
  });

  it("does not hand one LO another LO's team", () => {
    expect(roles(rosterLoanTeamFills([], ROSTER, "other@work.com"))).toEqual({ lo: "other@work.com", team_lo: "ot@work.com" });
  });

  it("a team LO signing in takes the team slot and puts their head LO first", () => {
    expect(roles(rosterLoanTeamFills([], ROSTER, "tee@work.com"))).toEqual({ team_lo: "tee@work.com", lo: "head@gmail.com" });
  });

  it("fills nothing for someone who is not on the roster", () => {
    expect(rosterLoanTeamFills([], ROSTER, "stranger@x.com")).toEqual([]);
    expect(rosterLoanTeamFills([], [], "")).toEqual([]);
  });

  it("marks fills as roster-sourced and carries the phone", () => {
    const f = rosterLoanTeamFills([], ROSTER, "head@work.com").find(x => x.role === "team_lo");
    expect(f).toEqual({ role: "team_lo", name: "Tee Mlo", email: "tee@work.com", phone: "5551112222", company: "", source: "team" });
  });
});

describe("myRosterEmails", () => {
  it("does not treat a same-named assistant as the LO", () => {
    const roster = [{ name: "Sam", email: "a@x.com", role: "lo" }, { name: "Sam", email: "b@x.com", role: "loa" }];
    expect([...myRosterEmails(roster, "a@x.com")]).toEqual(["a@x.com"]);
  });
});

describe("ariveOriginatorSlots", () => {
  it("puts a team LO originator in the team slot and their head LO in Loan Officer", () => {
    const slots = ariveOriginatorSlots({ name: "Tee Mlo", email: "" }, ROSTER);
    expect(slots.map(s => [s.role, s.contact.email])).toEqual([["team_lo", "tee@work.com"], ["lo", "head@gmail.com"]]);
    expect(slots[0].contact.phone).toBe("5551112222");
  });

  it("matches by email before name", () => {
    const slots = ariveOriginatorSlots({ name: "Tee Mlo", email: "tee@gmail.com" }, ROSTER);
    expect(slots.map(s => s.role)).toEqual(["lo"]);
  });

  it("keeps a head LO originator as the Loan Officer", () => {
    const slots = ariveOriginatorSlots({ name: "Head Lo", email: "HEAD@work.com" }, ROSTER);
    expect(slots).toEqual([{ role: "lo", contact: { name: "Head Lo", email: "HEAD@work.com", phone: "", company: "" } }]);
  });

  it("keeps an originator who is not on the roster as the Loan Officer", () => {
    expect(ariveOriginatorSlots({ name: "Nobody Known" }, ROSTER)).toEqual([{ role: "lo", contact: { name: "Nobody Known", email: "", phone: "", company: "" } }]);
    expect(ariveOriginatorSlots(null, ROSTER)).toEqual([]);
  });
});
