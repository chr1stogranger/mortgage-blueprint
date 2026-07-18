import { useEffect, useRef } from "react";
import { RIBBONS } from "../lib/theme.js";

/**
 * Grange app background canvas — fixed full-viewport, painted behind all
 * content (z-index 0). Two variants:
 *
 *   "ribbons" (default) — the liquid-glass flowing-ribbon canvas (ported from
 *     loan-pipeline): 6 wide woven ribbons over a subtle temperature wash.
 *     Used by PricePoint / Markets.
 *   "house" — Blueprint mode only (approved exception to the ribbons-everywhere
 *     brand rule, Christo 2026-07-17): a faint technical-drawing house plan in
 *     Grange blue that draws itself stroke-by-stroke as you scroll the page,
 *     over an ultra-faint blueprint grid. Complete at the bottom of the page;
 *     un-draws (eased) as you scroll back up.
 *
 * Props:
 *   darkMode {boolean} — repaints the wash + line opacity for the active theme.
 *   paused   {boolean} — freezes the animation in place (Settings → Appearance).
 *   variant  {"ribbons"|"house"}
 *
 * Honors prefers-reduced-motion (ribbons: one static frame; house: the
 * completed drawing as a static frame — no scroll animation).
 */

// House plan as ordered stroke paths in normalized [0,1]² coordinates (y down),
// in real build order: ground → foundation → walls → floor → roof → chimney →
// door + swing → windows → garage → dimension line → compass rose.
// detail:  lighter/thinner stroke (dimension + annotation weight)
// flourish: gets a second, slightly brighter pass once the drawing completes
function buildHousePaths() {
  const arc = (cx, cy, r, a0, a1, n) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
  };
  return [
    { pts: [[0.10, 0.84], [0.90, 0.84]] },                                                   // ground / datum line
    { pts: [[0.28, 0.84], [0.72, 0.84], [0.72, 0.88], [0.28, 0.88], [0.28, 0.84]] },         // foundation
    { pts: [[0.30, 0.84], [0.30, 0.54]] },                                                   // left wall
    { pts: [[0.70, 0.84], [0.70, 0.54]] },                                                   // right wall
    { pts: [[0.30, 0.54], [0.70, 0.54]] },                                                   // floor / eaves line
    { pts: [[0.26, 0.54], [0.50, 0.32], [0.74, 0.54]] },                                     // roof gable
    { pts: [[0.585, 0.398], [0.585, 0.30], [0.645, 0.30], [0.645, 0.453]] },                 // chimney (on right slope)
    { pts: [[0.46, 0.84], [0.46, 0.70], [0.54, 0.70], [0.54, 0.84]] },                       // front door
    { pts: arc(0.46, 0.84, 0.08, 0, -Math.PI / 2, 12), detail: true, flourish: true },       // door swing arc
    { pts: [[0.34, 0.62], [0.42, 0.62], [0.42, 0.72], [0.34, 0.72], [0.34, 0.62]] },         // left window
    { pts: [[0.34, 0.67], [0.42, 0.67], [0.38, 0.67], [0.38, 0.62], [0.38, 0.72]], detail: true, flourish: true }, // left mullions
    { pts: [[0.58, 0.62], [0.66, 0.62], [0.66, 0.72], [0.58, 0.72], [0.58, 0.62]] },         // right window
    { pts: [[0.58, 0.67], [0.66, 0.67], [0.62, 0.67], [0.62, 0.62], [0.62, 0.72]], detail: true, flourish: true }, // right mullions
    { pts: [[0.72, 0.84], [0.72, 0.66], [0.90, 0.66], [0.90, 0.84]] },                       // garage
    { pts: [[0.28, 0.885], [0.28, 0.945], [0.28, 0.92], [0.305, 0.912], [0.28, 0.92], [0.72, 0.92], [0.695, 0.912], [0.72, 0.92], [0.72, 0.945], [0.72, 0.885]], detail: true }, // dimension line + ticks/arrows
    { pts: arc(0.85, 0.20, 0.045, -Math.PI / 2, Math.PI * 1.5, 24), detail: true },          // compass ring
    { pts: [[0.85, 0.245], [0.85, 0.155], [0.838, 0.172], [0.85, 0.155], [0.862, 0.172]], detail: true }, // compass needle (N)
  ];
}
const HOUSE_PATHS = buildHousePaths();

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

    // ── house variant: scroll-drawn technical plan ─────────────────────────
    if (variant === "house") {
      S.p = 0;
      S.scrollTarget = 0;
      let house = null; // { paths: [{ px, segs, len, detail, flourish }], total }

      function layout() {
        const size = Math.min(W, Hc) * 0.8;
        const x0 = (W - size) / 2, y0 = (Hc - size) / 2;
        let total = 0;
        const paths = HOUSE_PATHS.map((p) => {
          const px = p.pts.map(([x, y]) => [x0 + x * size, y0 + y * size]);
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

      function draw() {
        const dark = S.dark;
        paintWash();
        // ultra-faint blueprint grid (kin to the SharePortal hero grid)
        const grid = 40 * dpr;
        ctx.strokeStyle = "rgba(59,107,245,0.03)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= W; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, Hc); }
        for (let y = 0; y <= Hc; y += grid) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
        ctx.stroke();
        // plan strokes, drawn to cumulative length = progress × total length
        const mainCol = dark ? "rgba(59,107,245,0.14)" : "rgba(43,79,206,0.10)";
        const detailCol = dark ? "rgba(59,107,245,0.08)" : "rgba(43,79,206,0.06)";
        const p = Math.min(1, Math.max(0, S.p));
        const target = p * house.total;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        let acc = 0;
        for (const path of house.paths) {
          if (acc >= target) break;
          ctx.strokeStyle = path.detail ? detailCol : mainCol;
          ctx.lineWidth = (path.detail ? 1 : 1.5) * dpr;
          strokePartial(path, target - acc);
          acc += path.len;
        }
        // completed-state flourish: mullions + door swing get a brighter pass
        if (p >= 0.995) {
          ctx.strokeStyle = dark ? "rgba(59,107,245,0.22)" : "rgba(43,79,206,0.17)";
          ctx.lineWidth = 1 * dpr;
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
