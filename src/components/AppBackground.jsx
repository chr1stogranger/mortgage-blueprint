import { useEffect, useRef } from "react";
import { RIBBONS } from "../lib/theme.js";

/**
 * Grange app background canvas — fixed full-viewport, painted behind all
 * content (z-index 0). Three variants (Christo 2026-07-17: per-mode canvases;
 * ribbons are Markets-only now):
 *
 *   "ribbons" — the liquid-glass flowing-ribbon canvas (ported from
 *     loan-pipeline): 6 wide woven ribbons over a subtle temperature wash.
 *     Used by Markets.
 *   "house" — Blueprint mode: architectural sketch-style wireframe (Christo's
 *     2026-07-17 reference: blue linework on white paper). Layers: two-weight
 *     drafting grid + faint margin plan-fragments; then the scroll-drawn 3D
 *     model — a floor-plan BASE PLANE (room outlines, double wall lines,
 *     adjoining plan sheets, a construction diagonal) draws first, then a
 *     characterful house (hipped main roof w/ tile hatching, forward-facing
 *     gable, octagonal turret with tented roof, wrap-around porch with posts
 *     and entry steps, second-story bay/oriel, mullioned windows, chimney),
 *     and finally radiating dimension lines + a loose sketched tree. Three
 *     line weights (accent roof silhouette / major edges / fine detail).
 *     Complete at the bottom of the page; un-draws (eased) scrolling back up.
 *     Dark mode: navy→blueprint-blue wash, light-blue lines. Light mode:
 *     white-paper ground, Grange-blue lines, grid extra subtle.
 *   "target" — PricePoint mode: the PricePoint bullseye as chrome — one large
 *     thin-line concentric-ring target anchored upper-right (rings bleed
 *     off-screen), crosshair ticks at the cardinals, a faint sweep line
 *     (one rotation ≈ 40s), and a much fainter partial target lower-left.
 *     Keeps the standard Grange navy/cool ground (NOT blueprint paper).
 *
 * Props:
 *   darkMode {boolean} — repaints the wash + line opacity for the active theme.
 *   paused   {boolean} — freezes the animation in place (Settings → Appearance).
 *   variant  {"ribbons"|"house"|"target"}
 *
 * Honors prefers-reduced-motion (ribbons: one static frame; house: the
 * completed drawing as a static frame — no scroll animation; target: static
 * frame, sweep frozen).
 */

// ── 3D sketch-house model ────────────────────────────────────────────────────
// Vertex/edge model in house units (x right, y up, z toward viewer / front).
// Ordered in real build order so the scroll-draw reads like a drawing being
// made on a drafting table: plan base plane → walls → roofs → turret → gable
// → bay → porch → openings → chimney → dimensions + tree.
// accent:  slightly darker/heavier stroke (roof-silhouette weight)
// detail:  lighter/thinner stroke (annotation weight)
// flourish: gets a second, slightly brighter pass once the drawing completes
function buildHouseModel() {
  const P = [];
  const add = (pts, opts = {}) => P.push({ pts, ...opts });
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // octagon ring / vertex in plan orientation (y = height)
  const octoV = (cx, cz, r, y, k) => {
    const a = ((k * 45 + 22.5) * Math.PI) / 180;
    return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
  };
  const octoRing = (cx, cz, r, y) => {
    const pts = [];
    for (let k = 0; k <= 8; k++) pts.push(octoV(cx, cz, r, y, k % 8));
    return pts;
  };
  // mullioned window on a z-plane (front-facing) / x-plane (side-facing)
  const winZ = (x0, y0, x1, y1, z) => {
    add([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [x0, y0, z]]);
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    add([[x0, my, z], [x1, my, z]], { detail: true, flourish: true });
    add([[mx, y0, z], [mx, y1, z]], { detail: true, flourish: true });
  };
  const winX = (z0, y0, z1, y1, x) => {
    add([[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], [x, y0, z0]]);
    const mz = (z0 + z1) / 2, my = (y0 + y1) / 2;
    add([[x, my, z0], [x, my, z1]], { detail: true, flourish: true });
    add([[x, y0, mz], [x, y1, mz]], { detail: true, flourish: true });
  };
  // circle arc in a vertical x/y plane at fixed z (tree canopy blobs)
  const blob = (cx, cy, r, z, a0 = 0, a1 = Math.PI * 2) => {
    const pts = [];
    const n = 20;
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z]);
    }
    return pts;
  };

  // ═══ 1. floor-plan base plane (the drafting-table sheet, y=0) ═══
  add([[-6.5, 0, -4], [17, 0, -4], [17, 0, 14.5], [-6.5, 0, 14.5], [-6.5, 0, -4]], { detail: true }); // sheet border
  add([[-6.5, 0, -4], [17, 0, 14.5]], { detail: true });                       // construction diagonal
  add([[0.35, 0, 0.35], [9.65, 0, 0.35], [9.65, 0, 7.65], [0.35, 0, 7.65], [0.35, 0, 0.35]], { detail: true }); // inner wall line (double-line walls)
  add([[0, 0, 4.3], [6.2, 0, 4.3]], { detail: true });                         // room partition
  add([[6.2, 0, 0], [6.2, 0, 4.3]], { detail: true });                         // room partition
  add([[3.4, 0, 4.3], [3.4, 0, 8]], { detail: true });                         // hall partition
  add([[-5.4, 0, 0.8], [-1.0, 0, 0.8], [-1.0, 0, 6.6], [-5.4, 0, 6.6], [-5.4, 0, 0.8]], { detail: true }); // adjoining plan sheet L
  add([[-5.4, 0, 3.7], [-1.0, 0, 3.7]], { detail: true });
  add([[12.6, 0, 9.6], [16.4, 0, 9.6], [16.4, 0, 13.6], [12.6, 0, 13.6], [12.6, 0, 9.6]], { detail: true }); // adjoining plan sheet FR

  // ═══ 2. main block (x 0..10, z 0..8, eaves y=6) ═══
  add([[0, 0, 0], [10, 0, 0], [10, 0, 8], [0, 0, 8], [0, 0, 0]]);              // base perimeter
  add([[10, 0, 0], [10, 6, 0]]);                                               // corner BR
  add([[10, 0, 8], [10, 6, 8]]);                                               // corner FR
  add([[0, 0, 0], [0, 6, 0]]);                                                 // corner BL (FL lives inside the turret)
  add([[0, 6, 0], [10, 6, 0], [10, 6, 8], [0, 6, 8], [0, 6, 0]]);              // wall top plate
  add([[2.9, 3.3, 8], [10, 3.3, 8]], { detail: true });                        // 2nd-floor band, front
  add([[10, 3.3, 0], [10, 3.3, 8]], { detail: true });                         // 2nd-floor band, right

  // hipped main roof: eave overhang + hips + ridge (accent silhouette)
  const eA = [-0.4, 6, 8.4], eB = [10.4, 6, 8.4], eC = [10.4, 6, -0.4], eD = [-0.4, 6, -0.4];
  const rA = [3.2, 9, 4], rB = [7.6, 9, 4];
  add([eA, eB, eC, eD, eA], { accent: true });                                 // eave perimeter
  add([eA, rA], { accent: true }); add([eD, rA], { accent: true });            // left hips
  add([eB, rB], { accent: true }); add([eC, rB], { accent: true });            // right hips
  add([rA, rB], { accent: true });                                             // ridge
  for (const t of [0.18, 0.36, 0.54, 0.72, 0.88])                              // tile hatching, front plane
    add([lerp3(eA, rA, t), lerp3(eB, rB, t)], { detail: true });
  for (const t of [0.25, 0.5, 0.75])                                           // tile hatching, right plane
    add([lerp3(eB, rB, t), lerp3(eC, rB, t)], { detail: true });

  // ═══ 3. octagonal turret, front-left corner (tented roof + finial) ═══
  const tx = 1.4, tz = 8.2, tr = 1.35, ter = 1.6;
  add(octoRing(tx, tz, tr, 0));                                                // base ring
  for (let k = 0; k < 8; k++) add([octoV(tx, tz, tr, 0, k), octoV(tx, tz, tr, 6.8, k)]); // shaft edges
  add(octoRing(tx, tz, tr, 3.1), { detail: true });                            // floor band
  add(octoRing(tx, tz, ter, 6.9), { accent: true });                           // eave ring
  for (let k = 0; k < 8; k++) add([octoV(tx, tz, ter, 6.9, k), [tx, 9.5, tz]], { accent: true }); // tent edges
  add([[tx, 9.5, tz], [tx, 10.05, tz]], { detail: true });                     // finial
  // turret windows on the two camera-facing facets, both stories
  for (const [ka, kb] of [[0, 1], [1, 2]]) {
    for (const [y0, y1] of [[1.1, 2.6], [4.2, 5.7]]) {
      const A = octoV(tx, tz, tr, 0, ka), B = octoV(tx, tz, tr, 0, kb);
      const pt = (u, y) => [A[0] + (B[0] - A[0]) * u, y, A[2] + (B[2] - A[2]) * u];
      add([pt(0.25, y0), pt(0.75, y0), pt(0.75, y1), pt(0.25, y1), pt(0.25, y0)]);
      add([pt(0.5, y0), pt(0.5, y1)], { detail: true, flourish: true });
    }
  }

  // ═══ 4. forward-facing gable (second story, front-right) ═══
  add([[6.4, 3.9, 8], [6.4, 3.9, 9.4], [9.4, 3.9, 9.4], [9.4, 3.9, 8]]);       // underside outline
  add([[6.4, 3.9, 9.4], [6.4, 6, 9.4]]);                                       // face corner L
  add([[9.4, 3.9, 9.4], [9.4, 6, 9.4]]);                                       // face corner R
  add([[6.4, 6, 8], [6.4, 6, 9.4]]); add([[9.4, 6, 8], [9.4, 6, 9.4]]);        // eave returns
  add([[6.15, 6, 9.55], [7.9, 8.15, 9.55], [9.65, 6, 9.55]], { accent: true }); // rakes
  add([[7.9, 8.15, 9.5], [7.9, 8.15, 6.7]], { accent: true });                 // gable ridge
  for (const t of [0.35, 0.7])                                                 // gable roof hatch, right plane
    add([lerp3([9.65, 6, 9.55], [7.9, 8.15, 9.55], t), lerp3([9.65, 6, 7.1], [7.9, 8.15, 7.1], t)], { detail: true });
  winZ(6.9, 4.3, 7.55, 5.6, 9.4);                                              // gable window pair
  winZ(8.25, 4.3, 8.9, 5.6, 9.4);

  // ═══ 5. second-story bay / oriel, front face ═══
  add([[3.0, 3.6, 8], [3.35, 3.6, 8.75], [4.25, 3.6, 8.75], [4.6, 3.6, 8]]);   // bottom outline
  add([[3.0, 5.5, 8], [3.35, 5.5, 8.75], [4.25, 5.5, 8.75], [4.6, 5.5, 8]]);   // top outline
  add([[3.35, 3.6, 8.75], [3.35, 5.5, 8.75]]);                                 // face edges
  add([[4.25, 3.6, 8.75], [4.25, 5.5, 8.75]]);
  add([[3.35, 5.5, 8.75], [3.8, 5.95, 8.1]], { detail: true });                // hip cap
  add([[4.25, 5.5, 8.75], [3.8, 5.95, 8.1]], { detail: true });
  winZ(3.45, 3.85, 4.15, 5.25, 8.75);                                          // bay window

  // ═══ 6. wrap-around porch (front + right side) ═══
  add([[2.9, 0.35, 10.1], [11.9, 0.35, 10.1], [11.9, 0.35, 0.6]]);             // deck edge
  add([[2.9, 3.35, 10.1], [11.9, 3.35, 10.1], [11.9, 3.35, 0.6]], { accent: true }); // porch roof edge
  add([[2.9, 3.9, 8], [10, 3.9, 8]], { detail: true });                        // roof attach, front
  add([[10, 3.9, 8], [10, 3.9, 0.6]], { detail: true });                       // roof attach, right
  add([[2.9, 3.35, 10.1], [2.9, 3.9, 8]], { detail: true });                   // end slope L
  add([[11.9, 3.35, 0.6], [10, 3.9, 0.6]], { detail: true });                  // end slope R
  for (const px of [3.5, 4.35, 5.65, 7.0, 8.35, 9.7, 11.05])                   // slender posts, front
    add([[px, 0.35, 10.1], [px, 3.35, 10.1]], { detail: true });
  for (const pz of [8.8, 6.8, 4.8, 2.8, 1.0])                                  // slender posts, right
    add([[11.9, 0.35, pz], [11.9, 3.35, pz]], { detail: true });
  add([[2.9, 1.15, 10.1], [4.35, 1.15, 10.1]], { detail: true });              // railing (gap at steps)
  add([[5.65, 1.15, 10.1], [11.9, 1.15, 10.1]], { detail: true });
  add([[11.9, 1.15, 10.1], [11.9, 1.15, 0.6]], { detail: true });
  add([[4.4, 0.23, 10.55], [5.6, 0.23, 10.55]], { detail: true });             // entry steps
  add([[4.4, 0.11, 10.95], [5.6, 0.11, 10.95]], { detail: true });
  add([[4.4, 0, 11.35], [5.6, 0, 11.35]], { detail: true });
  add([[4.4, 0.35, 10.1], [4.4, 0, 11.35]], { detail: true });                 // step rails
  add([[5.6, 0.35, 10.1], [5.6, 0, 11.35]], { detail: true });

  // ═══ 7. entry door + windows ═══
  add([[4.55, 0.35, 8], [4.55, 2.55, 8], [5.45, 2.55, 8], [5.45, 0.35, 8]]);   // front door
  add([[4.55, 2.2, 8], [5.45, 2.2, 8]], { detail: true });                     // transom line
  winZ(3.25, 1.0, 4.3, 2.4, 8);                                                // front, first floor
  winZ(7.0, 1.0, 8.3, 2.4, 8);
  winX(5.0, 1.0, 6.2, 2.4, 10);                                                // right side, first floor
  winX(2.0, 1.0, 3.2, 2.4, 10);
  winX(4.4, 4.2, 5.6, 5.6, 10);                                                // right side, second floor
  winX(1.4, 4.2, 2.6, 5.6, 10);

  // ═══ 8. chimney on the right roof slope ═══
  add([[8.55, 7.1, 2.85], [8.55, 9.8, 2.85], [9.25, 9.8, 2.85], [9.25, 7.35, 2.85]]);
  add([[9.25, 9.8, 2.85], [9.25, 9.8, 2.15], [9.25, 7.55, 2.15]]);
  add([[8.55, 9.8, 2.85], [8.55, 9.8, 2.15], [9.25, 9.8, 2.15]], { detail: true }); // rim
  add([[8.55, 9.5, 2.85], [9.25, 9.5, 2.85]], { detail: true });               // cap line

  // ═══ 9. radiating dimension lines + sketched tree (drawn last) ═══
  add([[0, 0, 11.7], [0, 0, 13.3]], { detail: true });                         // front dim: extensions
  add([[10, 0, 11.7], [10, 0, 13.3]], { detail: true });
  add([[0, 0, 12.7], [10, 0, 12.7]], { detail: true });                        // dim line
  add([[-0.3, 0, 12.4], [0.3, 0, 13.0]], { detail: true });                    // architectural slashes
  add([[9.7, 0, 12.4], [10.3, 0, 13.0]], { detail: true });
  add([[14.4, 0, 0], [16.0, 0, 0]], { detail: true });                         // right dim
  add([[14.4, 0, 8], [16.0, 0, 8]], { detail: true });
  add([[15.4, 0, 0], [15.4, 0, 8]], { detail: true });
  add([[15.1, 0, -0.3], [15.7, 0, 0.3]], { detail: true });
  add([[15.1, 0, 7.7], [15.7, 0, 8.3]], { detail: true });
  add([[10.6, 0, 8.7], [13.0, 0, 11.2]], { detail: true });                    // corner radials
  add([[-0.6, 0, -0.6], [-3.0, 0, -2.6]], { detail: true });
  add([[-4.75, 0, 10.5], [-4.6, 2.7, 10.5]], { detail: true });                // tree trunk
  add([[-4.3, 0, 10.5], [-4.45, 2.7, 10.5]], { detail: true });
  add(blob(-4.5, 4.3, 1.75, 10.5), { detail: true });                          // loose canopy
  add(blob(-5.5, 3.5, 1.05, 10.5), { detail: true });
  add(blob(-3.55, 3.6, 0.95, 10.5), { detail: true });
  add(blob(-4.4, 4.9, 0.8, 10.5, Math.PI * 0.15, Math.PI * 1.1), { detail: true });

  return P;
}
const HOUSE_MODEL = buildHouseModel();

// Perspective projection: yaw about Y (shows front + right faces), high-angle
// downward pitch (aerial three-quarter view), then a simple perspective
// divide. Returns unfitted 2D pts.
function projectModel() {
  const cx = 5.2, cy = 3.4, cz = 5;             // model center
  const yaw = -0.62, pitch = 0.32, D = 44;      // camera
  const cy_ = Math.cos(yaw), sy_ = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return HOUSE_MODEL.map((p) => ({
    detail: p.detail,
    accent: p.accent,
    flourish: p.flourish,
    pts: p.pts.map(([x, y, z]) => {
      const dx = x - cx, dy = y - cy, dz = z - cz;
      const x1 = dx * cy_ + dz * sy_;
      const z1 = -dx * sy_ + dz * cy_;
      const y2 = dy * cp - z1 * sp;
      const z2 = dy * sp + z1 * cp;
      const s = D / (D - z2);
      return [x1 * s, -y2 * s];
    }),
  }));
}
const HOUSE_PROJECTED = projectModel();

export default function AppBackground({ darkMode, paused, variant = "ribbons" }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ t: 0, scrollPhase: 0, scrollTarget: 0, raf: 0, paused: false, dark: false, p: 0 });

  // keep latest props in the animation state without restarting the effect
  useEffect(() => { stateRef.current.dark = darkMode; }, [darkMode]);
  useEffect(() => { stateRef.current.paused = paused; }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const S = stateRef.current;
    const dpr = window.devicePixelRatio || 1;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, Hc = 0;

    function sizeCanvas() {
      W = canvas.width = window.innerWidth * dpr;
      Hc = canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    }

    function paintWash() {
      ctx.clearRect(0, 0, W, Hc);
      // temperature wash: cool at top, faint warm at bottom
      const g = ctx.createLinearGradient(0, 0, W, Hc);
      if (S.dark) { g.addColorStop(0, "#0a1120"); g.addColorStop(0.5, "#0b1424"); g.addColorStop(1, "#100f18"); }
      else { g.addColorStop(0, "#f4f9fc"); g.addColorStop(0.5, "#f7f7fd"); g.addColorStop(1, "#fbf8f1"); }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, Hc);
    }

    // ── house variant: blueprint paper + scroll-drawn 3D sketch house ──────
    if (variant === "house") {
      S.p = 0;
      S.scrollTarget = 0;
      let house = null; // { paths: [{ px, segs, len, detail, accent, flourish }], total }

      function layout() {
        // fit the projected model (house + plan sheet) generously in the
        // right-lower region; the sheet may bleed off-edge like a drafting
        // table — clamped for narrow screens
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of HOUSE_PROJECTED) for (const [x, y] of p.pts) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
        const bw = maxX - minX, bh = maxY - minY;
        const scale = Math.min((Hc * 0.80) / bh, (W * 1.02) / bw);
        const ox = W * 0.66 - (minX + bw / 2) * scale;   // center-x → right of center
        const oy = Hc * 0.58 - (minY + bh / 2) * scale;  // center-y → below middle
        let total = 0;
        const paths = HOUSE_PROJECTED.map((p) => {
          const px = p.pts.map(([x, y]) => [ox + x * scale, oy + y * scale]);
          const segs = [];
          let len = 0;
          for (let i = 1; i < px.length; i++) {
            const d = Math.hypot(px[i][0] - px[i - 1][0], px[i][1] - px[i - 1][1]);
            segs.push(d);
            len += d;
          }
          total += len;
          return { px, segs, len, detail: p.detail, accent: p.accent, flourish: p.flourish };
        });
        house = { paths, total };
      }

      // partial stroke by walking segments — no setLineDash tricks
      function strokePartial(path, maxLen) {
        const pts = path.px;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        let used = 0;
        for (let i = 1; i < pts.length; i++) {
          const seg = path.segs[i - 1];
          if (used + seg <= maxLen) {
            ctx.lineTo(pts[i][0], pts[i][1]);
            used += seg;
          } else {
            const f = seg === 0 ? 0 : (maxLen - used) / seg;
            ctx.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f,
                       pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f);
            break;
          }
        }
        ctx.stroke();
      }

      function paintBlueprintWash() {
        ctx.clearRect(0, 0, W, Hc);
        const dark = S.dark;
        const g = ctx.createLinearGradient(0, 0, W * 0.7, Hc);
        if (dark) { g.addColorStop(0, "#0a1120"); g.addColorStop(0.55, "#0c1a3a"); g.addColorStop(1, "#0d2456"); }
        else { g.addColorStop(0, "#f7fafd"); g.addColorStop(0.55, "#f4f8fc"); g.addColorStop(1, "#eef4fa"); }
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, Hc);
        // soft glow behind the house / calmer center column
        const r = ctx.createRadialGradient(W * 0.7, Hc * 0.62, 0, W * 0.7, Hc * 0.62, Math.max(W, Hc) * 0.6);
        if (dark) { r.addColorStop(0, "rgba(18,58,140,0.28)"); r.addColorStop(1, "rgba(18,58,140,0)"); }
        else { r.addColorStop(0, "rgba(59,107,245,0.04)"); r.addColorStop(1, "rgba(59,107,245,0)"); }
        ctx.fillStyle = r;
        ctx.fillRect(0, 0, W, Hc);
      }

      function paintGrid() {
        const dark = S.dark;
        const minor = 8 * dpr, major = 40 * dpr;
        ctx.lineWidth = 1;
        // light mode extra subtle — the white-paper look should dominate
        ctx.strokeStyle = dark ? "rgba(150,180,255,0.035)" : "rgba(43,79,206,0.026)";
        ctx.beginPath();
        for (let x = 0; x <= W; x += minor) { ctx.moveTo(x, 0); ctx.lineTo(x, Hc); }
        for (let y = 0; y <= Hc; y += minor) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
        ctx.stroke();
        ctx.strokeStyle = dark ? "rgba(150,180,255,0.075)" : "rgba(43,79,206,0.050)";
        ctx.beginPath();
        for (let x = 0; x <= W; x += major) { ctx.moveTo(x, 0); ctx.lineTo(x, Hc); }
        for (let y = 0; y <= Hc; y += major) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
        ctx.stroke();
      }

      // faint plan fragments in the margins — like the plan sheets behind
      // the house in blueprint art; kept out of the center content column
      function paintFragments() {
        const dark = S.dark;
        const u = dpr;
        ctx.strokeStyle = dark ? "rgba(170,195,255,0.10)" : "rgba(43,79,206,0.075)";
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        const line = (pts) => {
          ctx.beginPath();
          pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * u, y * u) : ctx.lineTo(x * u, y * u)));
          ctx.stroke();
        };
        const circle = (cx, cy, r) => {
          ctx.beginPath();
          ctx.arc(cx * u, cy * u, r * u, 0, Math.PI * 2);
          ctx.stroke();
        };
        const Wc = W / u, Hcc = Hc / u; // work in CSS px

        // top-left: floor-plan corner (double wall lines + door opening + swing)
        line([[0, 96], [148, 96], [148, 0]]);
        line([[0, 104], [104, 104], [104, 148], [140, 148], [140, 104], [156, 104], [156, 0]]);
        ctx.beginPath();
        ctx.arc(104 * u, 148 * u, 36 * u, Math.PI / 2, Math.PI, false);
        ctx.stroke();

        // left margin, mid: wall section — two parallel lines with hatch ticks
        const wy = Hcc * 0.52;
        line([[0, wy], [88, wy]]);
        line([[0, wy + 10], [88, wy + 10]]);
        for (let x = 6; x < 88; x += 12) line([[x, wy + 10], [x + 8, wy]]);

        // bottom-left: compass rose
        const cx0 = 72, cy0 = Hcc - 84;
        circle(cx0, cy0, 34);
        circle(cx0, cy0, 26);
        line([[cx0, cy0 + 30], [cx0, cy0 - 30]]);
        line([[cx0 - 7, cy0 - 20], [cx0, cy0 - 30], [cx0 + 7, cy0 - 20]]);
        line([[cx0 - 30, cy0], [cx0 + 30, cy0]]);

        // top-right: dimension line with arrowheads + tick marks
        const dy0 = 56, dx0 = Wc - 260, dx1 = Wc - 40;
        line([[dx0, dy0 - 12], [dx0, dy0 + 12]]);
        line([[dx1, dy0 - 12], [dx1, dy0 + 12]]);
        line([[dx0, dy0], [dx1, dy0]]);
        line([[dx0 + 10, dy0 - 4], [dx0, dy0], [dx0 + 10, dy0 + 4]]);
        line([[dx1 - 10, dy0 - 4], [dx1, dy0], [dx1 - 10, dy0 + 4]]);
        line([[(dx0 + dx1) / 2, dy0 - 6], [(dx0 + dx1) / 2, dy0 + 6]]);
      }

      function draw() {
        const dark = S.dark;
        paintBlueprintWash();
        paintGrid();
        paintFragments();
        // model strokes, drawn to cumulative length = progress × total length
        // three sketch weights: accent (roof silhouette) / major / fine detail
        const accentCol = dark ? "rgba(225,236,255,0.42)" : "rgba(43,79,206,0.34)";
        const mainCol = dark ? "rgba(210,225,255,0.32)" : "rgba(43,79,206,0.24)";
        const detailCol = dark ? "rgba(190,210,255,0.18)" : "rgba(43,79,206,0.13)";
        const p = Math.min(1, Math.max(0, S.p));
        const target = p * house.total;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        let acc = 0;
        for (const path of house.paths) {
          if (acc >= target) break;
          ctx.strokeStyle = path.accent ? accentCol : path.detail ? detailCol : mainCol;
          ctx.lineWidth = (path.accent ? 1.35 : path.detail ? 0.6 : 1.0) * dpr;
          strokePartial(path, target - acc);
          acc += path.len;
        }
        // completed-state flourish: window mullions get a brighter pass
        if (p >= 0.995) {
          ctx.strokeStyle = dark ? "rgba(220,232,255,0.45)" : "rgba(43,79,206,0.34)";
          ctx.lineWidth = 0.6 * dpr;
          for (const path of house.paths) {
            if (path.flourish) strokePartial(path, Infinity);
          }
        }
      }

      function onScroll() {
        // re-read scrollHeight per event — tab switches change document height
        const doc = document.documentElement;
        const range = (doc.scrollHeight || 0) - window.innerHeight;
        // barely-scrollable page → show the house ~complete (no divide-by-zero)
        S.scrollTarget = range > 24
          ? Math.min(1, Math.max(0, (window.scrollY || doc.scrollTop || 0) / Math.max(1, range)))
          : 1;
      }

      function resize() { sizeCanvas(); layout(); draw(); }

      function loop() {
        if (!S.paused) {
          const d = S.scrollTarget - S.p;
          if (Math.abs(d) > 0.0004) {
            S.p += d * 0.08; // eased — drawing trails the scroll
            if (Math.abs(S.scrollTarget - S.p) < 0.0004) S.p = S.scrollTarget;
            draw();
          }
        }
        S.raf = window.requestAnimationFrame(loop); // idle frames do no canvas work
      }

      S.redraw = () => { sizeCanvas(); layout(); draw(); }; // theme-flip / paused repaint
      sizeCanvas();
      layout();
      window.addEventListener("resize", resize);
      if (reduce) {
        // static frame: the completed house, no scroll animation
        S.p = 1;
        S.scrollTarget = 1;
        draw();
      } else {
        onScroll(); // seed target from current position
        draw();
        window.addEventListener("scroll", onScroll, { passive: true });
        S.raf = window.requestAnimationFrame(loop);
      }

      return () => {
        window.cancelAnimationFrame(S.raf);
        window.removeEventListener("resize", resize);
        window.removeEventListener("scroll", onScroll);
      };
    }

    // ── target variant: PricePoint bullseye over the standard Grange wash ──
    if (variant === "target") {
      const T0 = performance.now();
      let angle = -Math.PI / 5; // sweep angle (also the reduced-motion static angle)

      function drawTarget(cx, cy, unit, radii, alpha) {
        ctx.lineWidth = 1 * dpr;
        ctx.strokeStyle = alpha;
        for (const rr of radii) {
          ctx.beginPath();
          ctx.arc(cx, cy, rr * unit, 0, Math.PI * 2);
          ctx.stroke();
        }
        // fine crosshair ticks at the cardinal points of each ring
        const tick = 7 * dpr;
        ctx.beginPath();
        for (const rr of radii) {
          const r = rr * unit;
          ctx.moveTo(cx + r - tick, cy); ctx.lineTo(cx + r + tick, cy);
          ctx.moveTo(cx - r - tick, cy); ctx.lineTo(cx - r + tick, cy);
          ctx.moveTo(cx, cy + r - tick); ctx.lineTo(cx, cy + r + tick);
          ctx.moveTo(cx, cy - r - tick); ctx.lineTo(cx, cy - r + tick);
        }
        ctx.stroke();
      }

      function draw() {
        const dark = S.dark;
        paintWash();
        const unit = Math.max(W, Hc);
        // hero target: upper-right, rings bleeding off-screen
        const cx = W * 0.86, cy = Hc * 0.14;
        const ringCol = dark ? "rgba(59,107,245,0.13)" : "rgba(43,79,206,0.09)";
        drawTarget(cx, cy, unit, [0.055, 0.115, 0.19, 0.28, 0.385, 0.50], ringCol);
        // small solid center dot
        ctx.fillStyle = dark ? "rgba(59,107,245,0.30)" : "rgba(43,79,206,0.22)";
        ctx.beginPath();
        ctx.arc(cx, cy, 3 * dpr, 0, Math.PI * 2);
        ctx.fill();
        // faint sweep line — one rotation ≈ 40s
        const sweepR = 0.52 * unit;
        ctx.strokeStyle = dark ? "rgba(110,144,255,0.035)" : "rgba(43,79,206,0.030)";
        ctx.lineWidth = 1 * dpr;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * sweepR, cy + Math.sin(angle) * sweepR);
        ctx.stroke();
        // counterweight: much fainter partial target, lower-left
        const ringCol2 = dark ? "rgba(59,107,245,0.06)" : "rgba(43,79,206,0.045)";
        drawTarget(W * 0.04, Hc * 0.94, unit, [0.05, 0.105, 0.17], ringCol2);
      }

      function resize() { sizeCanvas(); draw(); }

      function loop(now) {
        if (!S.paused) {
          angle = -Math.PI / 5 + ((now - T0) / 40000) * Math.PI * 2;
          draw();
        }
        S.raf = window.requestAnimationFrame(loop);
      }

      S.redraw = () => { sizeCanvas(); draw(); }; // theme-flip / paused repaint
      sizeCanvas();
      window.addEventListener("resize", resize);
      draw();
      if (!reduce) S.raf = window.requestAnimationFrame(loop);

      return () => {
        window.cancelAnimationFrame(S.raf);
        window.removeEventListener("resize", resize);
      };
    }

    // ── ribbons variant (default) ──────────────────────────────────────────
    function resize() { sizeCanvas(); }

    function onScroll() {
      S.scrollTarget = (window.scrollY || document.documentElement.scrollTop || 0) * 0.0016;
    }

    function draw() {
      const dark = S.dark;
      paintWash();

      const ribbons = 6;        // few wide bands + open negative space
      const perRibbon = 18;     // tightly-bundled filaments = woven look
      const bundleH = 56 * dpr; // ribbon thickness
      for (let r = 0; r < ribbons; r++) {
        const c = RIBBONS[r % RIBBONS.length];
        const isGold = (r % RIBBONS.length) === 2;      // ease gold so it warms, not shouts
        const alpha = (dark ? 0.40 : 0.30) * (isGold ? 0.72 : 1);
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
        ctx.lineWidth = dpr;
        const ry = ((r + 0.5) / ribbons) * Hc;
        const amp = (0.15 + (r % 3) * 0.06) * Hc;        // wide, open sweeps
        const freq = 0.00066 + (r % 4) * 0.00017;        // low freq = big arcs
        const phase = S.t * 0.05 + S.scrollPhase + r * 0.95;
        for (let i = 0; i < perRibbon; i++) {
          const f = i / (perRibbon - 1) - 0.5;
          const yo = f * bundleH;
          const ph = phase + f * 0.85;
          const a = amp * (1 + f * 0.14);
          ctx.beginPath();
          for (let x = 0; x <= W; x += 16 * dpr) {
            const y = ry + yo
              + Math.sin(x * freq + ph) * a
              + Math.sin(x * freq * 2.1 + ph * 1.35) * a * 0.22;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
    }

    function loop() {
      if (!S.paused) {
        S.t += 0.02;                                       // very slow idle drift
        S.scrollPhase += (S.scrollTarget - S.scrollPhase) * 0.06; // eased scroll response
        draw();
      }
      S.raf = window.requestAnimationFrame(loop);
    }

    S.redraw = () => { resize(); draw(); };  // expose for theme-flip / paused repaint
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    if (reduce) { draw(); }
    else { S.raf = window.requestAnimationFrame(loop); }

    return () => {
      window.cancelAnimationFrame(S.raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
    };
  }, [variant]);

  // repaint a static frame immediately on theme flip (covers the reduced-motion / paused case)
  useEffect(() => {
    stateRef.current.dark = darkMode;
    stateRef.current.redraw?.();
  }, [darkMode]);

  return (
    <canvas
      id="rs-bg"
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
    />
  );
}
