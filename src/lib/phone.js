// A US phone number the way people read it: (415) 987-8489. Anything that is
// not ten digits (or eleven with a leading 1) comes back as typed.
export function fmtPhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return p || "";
}
