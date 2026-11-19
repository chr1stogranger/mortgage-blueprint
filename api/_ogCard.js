// The shared link-preview card layout (1200x630 PNG) behind api/og-tax.js and
// api/og-ll.js: the Plaid card from public/og-ca-tax.png and og-loan-limits.png
// (scripts/og/build-seo-og.mjs), drawn per place. _taxCard.js and _llCard.js
// build the map SVG and its labels; this file lays out everything else.
//
// Layout runs through @vercel/og (satori + resvg) in the Node runtime. Its font
// reader can't parse Geist Mono's ligature tables, so the uppercase labels are
// tracked Inter here (the static cards keep Geist Mono). resvg draws text inside
// an <img> without fonts, so map names go on as positioned text over the image.

import { readFileSync } from "node:fs";
import { ImageResponse } from "@vercel/og";

export const W = 1200, H = 630;
export const MAP = { x: 600, y: 32, w: 568, h: 566 }; // the map panel
export const INK = "#0b2545";
const RAINBOW = "linear-gradient(90deg, #3DF59A, #18D8E8, #6B7BFF, #F08AE0, #F7A54A, #F5E14A)";
const HALO = "0 0 4px #fff, 0 0 4px #fff, 0 0 3px #fff, 0 0 2px #fff, 0 0 1px #fff";
export const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const readAsset = (rel) => readFileSync(new URL(rel, import.meta.url));
let fonts = null;
const loadFonts = () => (fonts ||= [
  { name: "Inter", data: readAsset("../src/assets/fonts/Inter_400Regular.ttf"), weight: 400, style: "normal" },
  { name: "Inter", data: readAsset("../src/assets/fonts/Inter_700Bold.ttf"), weight: 700, style: "normal" },
]);

/** Bounding box [x, y, w, h] of a map path (relative integer moves; "z" returns to the subpath start). */
export function pathBox(d) {
  let x = 0, y = 0, sx = 0, sy = 0, cmd = "";
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const nums = [];
  const flush = () => {
    for (let i = 0; i + 1 < nums.length; i += 2) {
      if (cmd === "M" && i === 0) { x = nums[0]; y = nums[1]; sx = x; sy = y; }
      else if (cmd === "m" && i === 0) { x += nums[0]; y += nums[1]; sx = x; sy = y; }
      else { x += nums[i]; y += nums[i + 1]; }
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    nums.length = 0;
  };
  for (const t of d.match(/[MmLlZz]|-?\d+/g)) {
    if (/[A-Za-z]/.test(t)) {
      flush();
      if (t === "z" || t === "Z") { x = sx; y = sy; }
      cmd = t;
    } else nums.push(+t);
  }
  flush();
  return [x0, y0, x1 - x0, y1 - y0];
}

/** Fit a map box [x, y, w, h] into the panel: the view origin and map units per pixel. */
export function frame([bx, by, bw, bh]) {
  const k = Math.max(bw / MAP.w, bh / MAP.h);
  const vw = MAP.w * k, vh = MAP.h * k;
  return { k, vx: bx + bw / 2 - vw / 2, vy: by + bh / 2 - vh / 2, vw, vh };
}

/**
 * Names that fit: the focus first (always), then the rest in the order given,
 * skipping any that collide, leave the panel, or sit under the tag in the lower left.
 * @param {{ text: string, x: number, y: number, onShape: boolean, focus?: boolean }[]} items  map units
 */
export function placeLabels(items, { k, vx, vy }, max = 10) {
  const taken = [];
  const out = [];
  for (const it of items) {
    if (out.length >= max) break;
    const size = it.focus ? 24 : 15;
    const px = (it.x - vx) / k, py = (it.y - vy) / k;
    const top = it.onShape ? py - size * 0.65 : py + 10; // centered on the shape, or just under a dot
    const half = it.text.length * size * 0.3 + 6;
    const lb = [px - half, top, px + half, top + size * 1.3];
    const clear = lb[0] > 8 && lb[2] < MAP.w - 8 && lb[1] > 8 && lb[3] < MAP.h - 8 && !(lb[0] < 300 && lb[3] > MAP.h - 140);
    if (!it.focus && (!clear || taken.some((o) => lb[0] < o[2] && lb[2] > o[0] && lb[1] < o[3] && lb[3] > o[1]))) continue;
    taken.push(lb);
    out.push({ text: it.text, left: Math.round(lb[0]), top: Math.round(lb[1]), width: Math.round(lb[2] - lb[0]), size, big: !!it.focus });
  }
  return out;
}

/** The Plaid water: gradient plus the engraved wave lines, as SVG to open a map panel with. */
export const waterSvg = () => {
  const wave = `<path d="M0 4.5C40 0 120 0 160 4.5S280 9 320 4.5" fill="none" stroke="rgba(255,255,255,0.13)" stroke-width="0.9"/>`;
  return `<defs>
<linearGradient id="w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B4AA8"/><stop offset="0.45" stop-color="#0A78CC"/><stop offset="1" stop-color="#13C4C2"/></linearGradient>
<pattern id="l" width="320" height="9" patternUnits="userSpaceOnUse">${wave}</pattern>
</defs>
<rect width="${MAP.w}" height="${MAP.h}" fill="url(#w)"/><rect width="${MAP.w}" height="${MAP.h}" fill="url(#l)"/>`;
};

/** A heavy outline (white under navy) for the place the card is about. */
export const heavyOutline = (d, k) => `<path fill="none" stroke="#fff" stroke-width="${7 * k}" stroke-linejoin="round" d="${d}"/><path fill="none" stroke="${INK}" stroke-width="${3.5 * k}" stroke-linejoin="round" d="${d}"/>`;

const div = (style, children) => ({ type: "div", props: { style: { display: "flex", ...style }, children } });
const text = (style, s) => ({ type: "div", props: { style: { display: "flex", ...style }, children: s } });

/**
 * The card: brand, two-line headline, subline, number tile and the rainbow pill
 * on the left; the map, its names and a tag on the right.
 * @returns {Promise<Buffer>} PNG
 */
export async function renderCard({ headline, line2, sub, tile, pill, map, tag }) {
  const hSize = headline.length > 22 ? 40 : headline.length > 18 ? 44 : headline.length > 12 ? 52 : 60;
  const el = div({ width: W, height: H, background: "#fff", fontFamily: "Inter", color: INK, position: "relative" }, [
    div({ position: "absolute", left: 64, top: 56, width: 500, height: H - 112, flexDirection: "column" }, [
      text({ fontSize: 24, fontWeight: 700, letterSpacing: -0.2 }, "Mortgage Blueprint"),
      text({ marginTop: 6, fontSize: 11, letterSpacing: 1.9, color: "#6e6e6e" }, "POWERED BY REALSTACK"),
      text({ marginTop: 34, fontSize: hSize, fontWeight: 700, lineHeight: 1.05, letterSpacing: -hSize * 0.035 }, headline),
      text({ fontSize: 60, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2.1 }, line2),
      text({ marginTop: 14, fontSize: 23, color: "#3b4f68" }, sub),
      div({ marginTop: "auto", flexDirection: "column", padding: "20px 24px", border: "1px solid rgba(8,129,129,0.16)", borderRadius: 20, background: "linear-gradient(160deg, #d9f7fa 0%, #eaf3fd 55%, #efe8fc 100%)" }, [
        text({ fontSize: 12, letterSpacing: 1.9, color: "#066a6a" }, tile.k),
        text({ marginTop: 4, fontSize: tile.v.length > 14 ? 38 : 46, fontWeight: 700, letterSpacing: -1.4 }, tile.v),
        text({ marginTop: 4, fontSize: 16, color: "#3b4f68" }, tile.s),
      ]),
      div({ marginTop: 16, padding: 2, borderRadius: 9999, backgroundImage: RAINBOW }, [
        div({ flex: 1, justifyContent: "center", padding: "15px 0", borderRadius: 9999, background: "#111", color: "#fff", fontSize: 22, fontWeight: 700 }, pill),
      ]),
    ]),
    div({ position: "absolute", left: MAP.x, top: MAP.y, width: MAP.w, height: MAP.h, borderRadius: 28, overflow: "hidden" }, [
      { type: "img", props: { src: `data:image/svg+xml;base64,${Buffer.from(map.svg).toString("base64")}`, width: MAP.w, height: MAP.h } },
      ...map.labels.map((l) => div({ position: "absolute", left: l.left, top: l.top, width: l.width, justifyContent: "center", fontSize: l.size, fontWeight: l.big ? 700 : 400, color: INK, textShadow: HALO }, l.text)),
      div({ position: "absolute", left: 22, bottom: 22, flexDirection: "column", padding: "13px 18px", border: "1px solid #dcdcdc", borderRadius: 14, background: "rgba(255,255,255,0.95)" }, [
        text({ fontSize: 20, fontWeight: 700 }, tag.a),
        text({ marginTop: 2, fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }, tag.b),
        text({ marginTop: 2, fontSize: 14, color: "#3b4f68" }, tag.c),
      ]),
    ]),
  ]);
  const res = new ImageResponse(el, { width: W, height: H, fonts: loadFonts() });
  return Buffer.from(await res.arrayBuffer());
}

/** The shared response for a card endpoint: PNG cached at the edge, or the family's static card. */
export async function sendCard(res, render, fallback, label) {
  try {
    const png = await render();
    res.setHeader("Content-Type", "image/png");
    // Rendered once, then served from the edge.
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400");
    return res.status(200).send(png);
  } catch (err) {
    console.error("og card:", label, err);
    res.setHeader("Cache-Control", "no-store");
    return res.redirect(302, fallback);
  }
}
