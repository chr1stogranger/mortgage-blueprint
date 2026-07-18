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
 *   "house" — Blueprint mode: architectural blueprint-paper ground (navy→
 *     blueprint-blue wash dark / cool paper light) with a two-weight drafting
 *     grid, faint plan fragments in the margins (floor-plan corner, wall
 *     section, compass rose, dimension line), and the hero: a 3D perspective
 *     wireframe house (real vertex/edge model, perspective-projected) that
 *     draws itself stroke-by-stroke as you scroll. Complete at the bottom of
 *     the page; un-draws (eased) as you scroll back up.
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

// ── 3D wireframe house model ─────────────────────────────────────────────────
// Vertex/edge model in house units (x right, y up, z toward viewer / front).
// Main two-story block with hip roof + chimney, attached garage wing with
// gable roof + paneled door, covered entry porch, windows with mullions.
// Paths are ordered in real build order so the scroll-draw reads like
// construction: ground → slab → walls → roof → garage → porch → chimney →
// door/windows → hatching → dimension line.
// detail:  lighter/thinner stroke (annotation weight)
// flourish: gets a second, slightly brighter pass once the drawing completes
function buildHouseModel() {
  const P = [];
  const add = (pts, opts = {}) => P.push({ pts, ...opts });
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // ground / datum line, running past the house
  add([[-4.5, 0, 7], [21.5, 0, 7]]);

  // main block slab + walls (x 0..10, z 0..7, walls to y=6)
  add([[0, 0, 0], [10, 0, 0], [10, 0, 7], [0, 0, 7], [0, 0, 0]]);            // base perimeter
  add([[0, 0, 7], [0, 6, 7]]);                                               // corner FL
  add([[10, 0, 7], [10, 6, 7]]);                                             // corner FR
  add([[10, 0, 0], [10, 6, 0]]);                                             // corner BR
  add([[0, 0, 0], [0, 6, 0]]);                                               // corner BL
  add([[0, 6, 0], [10, 6, 0], [10, 6, 7], [0, 6, 7], [0, 6, 0]]);            // wall top plate
  add([[0, 3.1, 7], [10, 3.1, 7]], { detail: true });                        // 2nd-floor line, front
  add([[10, 3.1, 0], [10, 3.1, 7]], { detail: true });                       // 2nd-floor line, right

  // hip roof: eave overhang rectangle at y=6, ridge (3,9,3.5)→(7,9,3.5)
  const eA = [-0.5, 6, 7.5], eB = [10.5, 6, 7.5], eC = [10.5, 6, -0.5], eD = [-0.5, 6, -0.5];
  const rA = [3, 9, 3.5], rB = [7, 9, 3.5];
  add([eA, eB, eC, eD, eA]);                                                 // eave perimeter
  add([eA, rA]); add([eD, rA]);                                              // left hips
  add([eB, rB]); add([eC, rB]);                                              // right hips
  add([rA, rB]);                                                             // ridge

  // garage wing (x 10..16, z 1..7, walls to y=3.6, gable ridge along x at y=5.4)
  add([[10, 0, 7], [16, 0, 7], [16, 0, 1], [10, 0, 1]]);                     // garage base
  add([[16, 0, 7], [16, 3.6, 7]]);                                           // garage corner FR
  add([[16, 0, 1], [16, 3.6, 1]]);                                           // garage corner BR
  add([[10, 3.6, 7], [16, 3.6, 7]]);                                         // garage plate, front
  add([[16, 3.6, 1], [16, 3.6, 7]]);                                         // garage plate, right
  const gA = [10, 3.6, 7.4], gB = [16.6, 3.6, 7.4], gC = [16.6, 3.6, 0.6], gD = [10, 3.6, 0.6];
  const gR1 = [10, 5.4, 4], gR2 = [16.6, 5.4, 4];
  add([gA, gB, gC, gD]);                                                     // garage eaves
  add([gB, gR2, gC]);                                                        // gable end rakes
  add([gR1, gR2]);                                                           // garage ridge
  add([[11, 0, 7], [11, 2.8, 7], [15, 2.8, 7], [15, 0, 7]]);                 // garage door
  add([[11, 0.8, 7], [15, 0.8, 7]], { detail: true });                       // door panel lines
  add([[11, 1.5, 7], [15, 1.5, 7]], { detail: true });
  add([[11, 2.2, 7], [15, 2.2, 7]], { detail: true });

  // entry porch (x 3.2..6.8, z 7..9, flat roof at y=3)
  add([[3.2, 0.15, 7], [3.2, 0.15, 9], [6.8, 0.15, 9], [6.8, 0.15, 7]]);     // porch slab
  add([[3.2, 3, 7], [3.2, 3, 9], [6.8, 3, 9], [6.8, 3, 7]]);                 // porch roof
  add([[3.4, 0.15, 8.8], [3.4, 3, 8.8]]);                                    // post L
  add([[6.6, 0.15, 8.8], [6.6, 3, 8.8]]);                                    // post R

  // chimney on right roof slope (verticals rise out of the roof plane)
  add([[7.5, 7.1, 3.1], [7.5, 10, 3.1], [8.4, 10, 3.1], [8.4, 7.35, 3.1]]);  // front face
  add([[8.4, 10, 3.1], [8.4, 10, 2.2], [8.4, 7.6, 2.2]]);                    // right face
  add([[7.5, 10, 3.1], [7.5, 10, 2.2], [8.4, 10, 2.2]], { detail: true });   // top rim
  add([[7.5, 9.65, 3.1], [8.4, 9.65, 3.1]], { detail: true });               // cap line

  // front door (under porch)
  add([[4.6, 0.15, 7], [4.6, 2.35, 7], [5.4, 2.35, 7], [5.4, 0.15, 7]]);

  // windows — front face (z=7); mullions are detail + flourish
  const win = (x0, y0, x1, y1, z) => {
    add([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [x0, y0, z]]);
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    add([[x0, my, z], [x1, my, z]], { detail: true, flourish: true });
    add([[mx, y0, z], [mx, y1, z]], { detail: true, flourish: true });
  };
  win(1.2, 0.9, 2.8, 2.4, 7);   // first floor L
  win(7.6, 0.9, 9.2, 2.4, 7);   // first floor R
  win(1.2, 3.8, 2.8, 5.3, 7);   // second floor L
  win(4.2, 3.8, 5.8, 5.3, 7);   // second floor C
  win(7.2, 3.8, 8.8, 5.3, 7);   // second floor R
  // upper window on the right face (x=10 plane), above the garage roof
  add([[10, 4.2, 4.8], [10, 5.4, 4.8], [10, 5.4, 3.2], [10, 4.2, 3.2], [10, 4.2, 4.8]]);
  add([[10, 4.8, 4.8], [10, 4.8, 3.2]], { detail: true, flourish: true });

  // roof-plane hatching (tile lines), parallel to the eaves — detail weight
  for (const t of [0.28, 0.52, 0.76]) add([lerp3(eA, rA, t), lerp3(eB, rB, t)], { detail: true });
  for (const t of [0.34, 0.67]) add([lerp3(gA, gR1, t), lerp3(gB, gR2, t)], { detail: true });

  // dimension line in front of the house at grade — extension lines,
  // dim line, architectural slash ticks
  add([[0, 0, 9.6], [0, -1.5, 9.6]], { detail: true });
  add([[10, 0, 9.6], [10, -1.5, 9.6]], { detail: true });
  add([[0, -1.1, 9.6], [10, -1.1, 9.6]], { detail: true });
  add([[-0.3, -1.4, 9.6], [0.3, -0.8, 9.6]], { detail: true });
  add([[9.7, -1.4, 9.6], [10.3, -0.8, 9.6]], { detail: true });

  return P;
}
const HOUSE_MODEL = buildHouseModel();

// Perspective projection: yaw about Y (shows front + right faces), slight
// downward pitch, then a simple perspective divide. Returns unfitted 2D pts.
function projectModel() {
  const cx = 7, cy = 3.8, cz = 3.5;             // model center
  const yaw = -0.58, pitch = 0.17, D = 34;      // camera
  const cy_ = Math.cos(yaw), sy_ = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return HOUSE_MODEL.map((p) => ({
    detail: p.detail,
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

export default function AppBackground({ darkMode, paused, variant = "ribbons", complete = false }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ t: 0, scrollPhase: 0, scrollTarget: 0, raf: 0, paused: false, dark: false, p: 0 });

  // keep latest props in the animation state without restarting the effect
  useEffect(() => { stateRef.current.dark = darkMode; }, [darkMode]);
  useEffect(() => { stateRef.current.paused = paused; }, [paused]);
  // Views with their own inner scroll (Workspace split-pane) can't drive the
  // scroll-draw — `complete` eases the house to fully drawn while they're open.
  useEffect(() => { stateRef.current.forceComplete = complete; }, [complete]);

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

    // ── house variant: blueprint paper + scroll-drawn 3D wireframe house ───
    if (variant === "house") {
      S.p = 0;
      S.scrollTarget = 0;
      let house = null; // { paths: [{ px, segs, len, detail, flourish }], total }

      function layout() {
        // fit the projected model into the lower-right third-ish of the
        // viewport: generous (~62vh tall), clamped for narrow screens
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of HOUSE_PROJECTED) for (const [x, y] of p.pts) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
        const bw = maxX - minX, bh = maxY - minY;
        const scale = Math.min((Hc * 0.78) / bh, (W * 0.95) / bw);  // zoomed in per Christo 2026-07-18 (was 0.62)
        const ox = W * 0.56 - (minX + bw / 2) * scale;   // optically centered: garage wing extends right, so the main block lands at screen center (Christo 2026-07-18)
        const oy = Hc * 0.58 - (minY + bh / 2) * scale;  // center-y → just below middle
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
          return { px, segs, len, detail: p.detail, flourish: p.flourish };
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
        else { g.addColorStop(0, "#f4f9fc"); g.addColorStop(0.55, "#eef5fc"); g.addColorStop(1, "#e7f0fa"); }
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, Hc);
        // soft blueprint glow behind the house / calmer center column
        const r = ctx.createRadialGradient(W * 0.5, Hc * 0.58, 0, W * 0.5, Hc * 0.58, Math.max(W, Hc) * 0.6);
        if (dark) { r.addColorStop(0, "rgba(18,58,140,0.28)"); r.addColorStop(1, "rgba(18,58,140,0)"); }
        else { r.addColorStop(0, "rgba(59,107,245,0.06)"); r.addColorStop(1, "rgba(59,107,245,0)"); }
        ctx.fillStyle = r;
        ctx.fillRect(0, 0, W, Hc);
      }

      function paintGrid() {
        const dark = S.dark;
        const minor = 8 * dpr, major = 40 * dpr;
        ctx.lineWidth = 1;
        ctx.strokeStyle = dark ? "rgba(150,180,255,0.035)" : "rgba(43,79,206,0.040)";
        ctx.beginPath();
        for (let x = 0; x <= W; x += minor) { ctx.moveTo(x, 0); ctx.lineTo(x, Hc); }
        for (let y = 0; y <= Hc; y += minor) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
        ctx.stroke();
        ctx.strokeStyle = dark ? "rgba(150,180,255,0.075)" : "rgba(43,79,206,0.070)";
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
        ctx.strokeStyle = dark ? "rgba(170,195,255,0.10)" : "rgba(43,79,206,0.085)";
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
        // house strokes, drawn to cumulative length = progress × total length
        const mainCol = dark ? "rgba(210,225,255,0.34)" : "rgba(43,79,206,0.26)";
        const detailCol = dark ? "rgba(190,210,255,0.20)" : "rgba(43,79,206,0.15)";
        const p = Math.min(1, Math.max(0, S.p));
        const target = p * house.total;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        let acc = 0;
        for (const path of house.paths) {
          if (acc >= target) break;
          ctx.strokeStyle = path.detail ? detailCol : mainCol;
          ctx.lineWidth = (path.detail ? 0.7 : 1.15) * dpr;
          strokePartial(path, target - acc);
          acc += path.len;
        }
        // completed-state flourish: window mullions get a brighter pass
        if (p >= 0.995) {
          ctx.strokeStyle = dark ? "rgba(220,232,255,0.45)" : "rgba(43,79,206,0.34)";
          ctx.lineWidth = 0.7 * dpr;
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
          const d = (S.forceComplete ? 1 : S.scrollTarget) - S.p;
          if (Math.abs(d) > 0.0004) {
            S.p += d * 0.08; // eased — drawing trails the scroll
            const tgt = S.forceComplete ? 1 : S.scrollTarget;
            if (Math.abs(tgt - S.p) < 0.0004) S.p = tgt;
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
