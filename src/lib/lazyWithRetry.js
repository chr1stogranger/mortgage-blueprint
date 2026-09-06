import { lazy } from "react";

// lazy() wrapper that self-heals after a deploy. When a stale index.html asks
// for a chunk hash that no longer exists, the dynamic import fails with a
// "Failed to fetch dynamically imported module" style error. We catch that
// specific failure and reload ONCE to pull the fresh index.html + current
// chunk hashes. A sessionStorage flag prevents an infinite reload loop; a
// successful load clears the flag so a future deploy can self-heal too.
export function lazyWithRetry(factory) {
  const KEY = "rs-chunk-reloaded";
  return lazy(() =>
    factory()
      .then((mod) => { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } return mod; })
      .catch((err) => {
        const msg = (err && err.message) || "";
        const isChunkError = /dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically/i.test(msg);
        try {
          if (isChunkError && !sessionStorage.getItem(KEY)) {
            sessionStorage.setItem(KEY, "1");
            window.location.reload();
            return new Promise(() => {}); // never resolves; the reload takes over
          }
        } catch { /* ignore */ }
        throw err;
      })
  );
}

export default lazyWithRetry;
