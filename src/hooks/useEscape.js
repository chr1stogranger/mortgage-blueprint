import { useEffect, useRef } from "react";

// Close a popover/menu on Escape while it's open (QA 2026-10-27: the Pillars
// popover and scenario menu ignored Esc and left their click-catcher up).
export default function useEscape(active, onClose) {
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => { if (e.key === "Escape") cb.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
}
