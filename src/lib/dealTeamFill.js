// Who goes on the loan side of the Deal Team, worked out from the Ops roster
// (team_members). Pure, so the rules are tested without the Team tab.
//
// Roster rows: { name, email, role, phone, linked_los }. One person can hold
// several rows (Chris signs in with four addresses), and a teammate's
// linked_los names only one of them, so "linked to me" is matched against
// every LO row that carries the signed-in person's name.

const low = (v) => String(v || "").trim().toLowerCase();
const HEAD_ROLES = ["admin", "lo"];

const entry = (role, m) => ({ role, name: m.name || "", email: m.email || "", phone: m.phone || "", company: "", source: "team" });

/** Every address the signed-in LO is known by on the roster (always includes the sign-in address). */
export function myRosterEmails(roster, signedInEmail) {
  const mine = low(signedInEmail);
  const set = new Set(mine ? [mine] : []);
  const me = (roster || []).find(m => low(m.email) === mine);
  if (me && low(me.name) && HEAD_ROLES.includes(me.role)) {
    for (const m of roster) {
      if (HEAD_ROLES.includes(m.role) && low(m.name) === low(me.name) && low(m.email)) set.add(low(m.email));
    }
  }
  return set;
}

/**
 * Loan-team slots to fill from the roster when a client's Team tab opens.
 * Only empty slots are filled; nothing already on the deal is replaced.
 *   - Head LO signs in: they take Loan Officer; the Team Loan Officer, LOA and
 *     Processor linked to them fill their slots.
 *   - Team LO signs in: they take Team Loan Officer and the LO they work under
 *     takes Loan Officer.
 */
export function rosterLoanTeamFills(team, roster, signedInEmail) {
  const list = Array.isArray(roster) ? roster : [];
  const has = (role) => (team || []).some(e => e.role === role);
  const me = list.find(m => low(m.email) === low(signedInEmail));
  if (!me) return [];
  const fills = [];

  if (me.role === "team_lo") {
    if (!has("team_lo")) fills.push(entry("team_lo", me));
    const headEmail = low((me.linked_los || [])[0]);
    const head = headEmail && list.find(m => low(m.email) === headEmail);
    if (head && !has("lo")) fills.push(entry("lo", head));
    return fills;
  }

  if (!has("lo")) fills.push(entry("lo", me));
  const mine = myRosterEmails(list, signedInEmail);
  const linkedToMe = (m) => Array.isArray(m.linked_los) && m.linked_los.some(x => mine.has(low(x)));
  for (const role of ["team_lo", "loa", "processor"]) {
    if (has(role)) continue;
    const linked = list.find(m => m.role === role && linkedToMe(m));
    if (linked) fills.push(entry(role, linked));
  }
  return fills;
}

/**
 * Where an Arive file's loan originator belongs. A file originated by a team
 * LO puts them in the Team Loan Officer slot and the LO they work under in
 * Loan Officer; anyone else is the Loan Officer. Roster match is by email,
 * then by name (Arive often sends the name alone).
 * Returns [{ role, contact }], contact = { name, email, phone, company }.
 */
export function ariveOriginatorSlots(originator, roster) {
  if (!originator || !(originator.name || originator.email)) return [];
  const list = Array.isArray(roster) ? roster : [];
  const m = list.find(x => low(x.email) && low(x.email) === low(originator.email))
    || list.find(x => low(x.name) && low(x.name) === low(originator.name) && x.role === "team_lo")
    || list.find(x => low(x.name) && low(x.name) === low(originator.name));
  const contact = {
    name: originator.name || m?.name || "",
    email: originator.email || m?.email || "",
    phone: originator.phone || m?.phone || "",
    company: "",
  };
  if (m?.role !== "team_lo") return [{ role: "lo", contact }];
  const slots = [{ role: "team_lo", contact }];
  const headEmail = low((m.linked_los || [])[0]);
  const head = headEmail && list.find(x => low(x.email) === headEmail);
  if (head) slots.push({ role: "lo", contact: { name: head.name || "", email: head.email || "", phone: head.phone || "", company: "" } });
  return slots;
}
