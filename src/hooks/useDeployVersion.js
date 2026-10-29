import { useEffect, useRef, useState } from "react";

// Detects when a newer bundle has been deployed than the one this tab is
// running, for the blue "Update" pill in the header (Christo 2026-10-28,
// ported from RealStack Ops' hook of the same name). Stale tabs and service
// worker phantoms are a repeat offender here (see CLAUDE.md, "Verifying a
// deploy"). Compares this tab's own assets/index-*.js hash against the one
// referenced by a freshly fetched index.html: on window focus, on visibility
// change, and every 15 minutes, visible tabs only (hidden tabs stall network
// work). index.html is never served from the service worker (navigateFallback
// is null in vite.config.js), so the fetch always sees production. Inert on
// the vite dev server (no hashed bundle script) and in the native app (its
// index.html is the bundled one, so the hashes always match).
export default function useDeployVersion() {
  const [updateReady, setUpdateReady] = useState(false);
  const checking = useRef(false);
  useEffect(() => {
    const script = document.querySelector('script[src*="assets/index-"]');
    const own = script && script.src && (script.src.match(/assets\/(index-[^/?#]+\.js)/) || [])[1];
    if (!own) return;
    const check = async () => {
      if (checking.current || document.visibilityState !== "visible") return;
      checking.current = true;
      try {
        const res = await fetch(`/?_vc=${Date.now()}`, { cache: "no-store" });
        const html = await res.text();
        const fresh = (html.match(/assets\/(index-[^"'/?#]+\.js)/) || [])[1];
        if (fresh && fresh !== own) setUpdateReady(true);
      } catch { /* offline / transient — try again next trigger */ }
      finally { checking.current = false; }
    };
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVis);
    const iv = setInterval(check, 15 * 60 * 1000);
    check();
    return () => { window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", onVis); clearInterval(iv); };
  }, []);
  return updateReady;
}
