// App backgrounds, Settings → Appearance → Background (2026-10-31).
//
// VENDORED from loan-pipeline src/theme.js `BACKGROUNDS` (Ops My Account →
// Appearance) so "Match Ops" can paint whatever the LO picked there. Keep the
// ids and css in sync when Ops adds or changes one; an unknown id falls back
// to the Blueprint default.
//
// The choice is stored per device ('bp_bg_choice'):
//   "default" — Blueprint's own per-mode canvas (house / target / chart)
//   "ops"     — follow the LO's Ops background (read from Ops; live from the
//               Ops panel, which also hands over light/dark)
//   <id>      — one of BACKGROUNDS below
// Borrower-facing views (share links) always use "default".
export const BACKGROUNDS = [
  { id: "ribbons", label: "Grange Ribbons", kind: "ribbons" },
  // Gradients
  { id: "realstack", label: "RealStack", kind: "gradient", tone: "dark", css: "linear-gradient(135deg, #1E3BA8 0%, #3B6BF5 50%, #8B7BF0 100%)" },
  { id: "snow",     label: "Snow",     kind: "gradient", tone: "light", css: "linear-gradient(135deg, #E9F2FF 0%, #CCE0FF 100%)" },
  { id: "ocean",    label: "Ocean",    kind: "gradient", tone: "dark",  css: "linear-gradient(135deg, #0C66E4 0%, #37B4C3 100%)" },
  { id: "deep",     label: "Deep Sea", kind: "gradient", tone: "dark",  css: "linear-gradient(135deg, #0055CC 0%, #09326C 100%)" },
  { id: "crystal",  label: "Crystal",  kind: "gradient", tone: "dark",  css: "linear-gradient(135deg, #09326C 0%, #C25FB0 100%)" },
  { id: "rainbow",  label: "Rainbow",  kind: "gradient", tone: "dark",  css: "linear-gradient(135deg, #6E5DC6 0%, #E774BB 100%)" },
  { id: "peach",    label: "Peach",    kind: "gradient", tone: "dark",  css: "linear-gradient(135deg, #E34935 0%, #F5A33B 100%)" },
  { id: "flower",   label: "Flower",   kind: "gradient", tone: "dark",  css: "linear-gradient(135deg, #E774BB 0%, #F87168 100%)" },
  { id: "earth",    label: "Earth",    kind: "gradient", tone: "dark",  css: "linear-gradient(135deg, #216E4E 0%, #42B2A0 100%)" },
  { id: "alien",    label: "Alien",    kind: "gradient", tone: "dark",  css: "linear-gradient(135deg, #505F79 0%, #172B4D 100%)" },
  { id: "volcano",  label: "Volcano",  kind: "gradient", tone: "dark",  css: "linear-gradient(135deg, #43290F 0%, #C9372C 100%)" },
  // Solids
  { id: "blue",   label: "Blue",   kind: "solid", tone: "dark", css: "#0079BF" },
  { id: "orange", label: "Orange", kind: "solid", tone: "dark", css: "#D29034" },
  { id: "green",  label: "Green",  kind: "solid", tone: "dark", css: "#519839" },
  { id: "red",    label: "Red",    kind: "solid", tone: "dark", css: "#B04632" },
  { id: "purple", label: "Purple", kind: "solid", tone: "dark", css: "#89609E" },
  { id: "pink",   label: "Pink",   kind: "solid", tone: "dark", css: "#CD5A91" },
  { id: "lime",   label: "Lime",   kind: "solid", tone: "dark", css: "#4BBF6B" },
  { id: "sky",    label: "Sky",    kind: "solid", tone: "dark", css: "#00AECC" },
  { id: "grey",   label: "Grey",   kind: "solid", tone: "dark", css: "#838C91" },
];

export const backgroundById = (id) => BACKGROUNDS.find((b) => b.id === id) || null;

export const BG_CHOICE_KEY = "bp_bg_choice";

export function readBgChoice() {
  try {
    const v = localStorage.getItem(BG_CHOICE_KEY);
    if (v === "default" || v === "ops" || backgroundById(v)) return v;
  } catch { /* private mode */ }
  return null; // never chosen: LOs get "ops", everyone else "default"
}
