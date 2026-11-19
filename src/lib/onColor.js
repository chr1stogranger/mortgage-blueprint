// Surfaces that sit straight on the page background rather than inside a card.
// On a colored background (Plaid, Ocean…; `T.onColor`, set by the *_ON_COLOR
// themes in MortgageBlueprint.jsx) Grange blue sinks into the page and tinted
// washes go see-through (Chris 2026-11-18), so on those backgrounds:
//  - big blue fills turn navy (NAVY_FILL, same navy as T.banner),
//  - primary buttons become Ops' ink pill with a rainbow edge
//    (.bp-rainbow-pill in index.css),
//  - tinted washes get a solid card underneath.
// Without a colored background every helper returns the original look.

export const NAVY_FILL = "linear-gradient(135deg, #0B2545, #163A66)";

// Props for a primary button on the page background. Spread `style` LAST
// over a base style that has no background/border/color of its own: an inline
// background or border would cover the rainbow edge.
export function canvasCta(T) {
  return T.onColor
    ? { className: "bp-rainbow-pill", style: { boxShadow: "none" } }
    : { className: undefined, style: { background: T.blue, border: "none", color: "#fff" } };
}

// A secondary (outline/tint) button on the page background: solid white with
// navy type on a colored background, `fallback` otherwise.
export function canvasGhost(T, fallback) {
  return T.onColor ? { background: "#fff", border: "none", color: "#0B2545" } : fallback;
}

// A tinted wash (`${T.green}10`, or a gradient) with a solid card under it on
// a colored background, so the text on it stays readable.
export function washOn(T, bg) {
  if (!T.onColor) return bg;
  const layer = /gradient\(/.test(bg) ? bg : `linear-gradient(${bg}, ${bg})`;
  return `${layer}, ${T.card}`;
}

// A big Grange-blue fill (hero card, section bar) that turns navy on a colored
// background.
export function blueFill(T, bg) {
  return T.onColor ? NAVY_FILL : bg;
}
