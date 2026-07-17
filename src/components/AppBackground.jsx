import { useEffect, useRef } from "react";
import { RIBBONS } from "../lib/theme.js";

/**
 * Grange "liquid-glass" flowing-ribbon background (ported from loan-pipeline).
 * A fixed full-viewport canvas painted behind all app content (z-index 0).
 * Renders 6 wide woven ribbons — bundles of tightly-spaced filaments — in the
 * teal/gold/blue/violet spectrum, over a subtle temperature wash.
 *
 * Props:
 *   darkMode {boolean} — repaints the wash + line opacity for the active theme.
 *   paused   {boolean} — freezes the animation in place (Settings → Appearance).
 *
 * Honors prefers-reduced-motion (renders one static frame, no rAF loop).
 */
export default function AppBackground({ darkMode, paused }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ t: 0, scrollPhase: 0, scrollTarget: 0, raf: 0, paused: false, dark: false });

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

    function resize() {
      W = canvas.width = window.innerWidth * dpr;
      Hc = canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    }

    function onScroll() {
      S.scrollTarget = (window.scrollY || document.documentElement.scrollTop || 0) * 0.0016;
    }

    function draw() {
      const dark = S.dark;
      ctx.clearRect(0, 0, W, Hc);
      // temperature wash: cool at top, faint warm at bottom
      const g = ctx.createLinearGradient(0, 0, W, Hc);
      if (dark) { g.addColorStop(0, "#0a1120"); g.addColorStop(0.5, "#0b1424"); g.addColorStop(1, "#100f18"); }
      else { g.addColorStop(0, "#f4f9fc"); g.addColorStop(0.5, "#f7f7fd"); g.addColorStop(1, "#fbf8f1"); }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, Hc);

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
  }, []);

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
