/**
 * useBlueprintShelf — the broker's fast-switch shelf, at the BLUEPRINT level.
 *
 * Two lists of lightweight snapshot entries, persisted in localStorage:
 *   - pinned  : blueprints the broker starred (manual order, newest pin first)
 *   - recents : the last 15 blueprints opened or edited (newest first, auto-tracked)
 *
 * Each entry is a self-contained snapshot so the left panel can render without
 * loading every borrower's scenarios:
 *   { scenarioId, borrowerId, borrowerName, scenarioName, type, status, ts }
 *
 * Entries are keyed by scenarioId. Snapshots refresh every time a blueprint is
 * opened or saved, so names/status stay current. localStorage is per-device —
 * a future version can sync these off the logged-in broker.
 */

import { useState, useCallback, useEffect } from 'react';

const PINNED_KEY = 'bp_pinned_blueprints';
const RECENTS_KEY = 'bp_recent_blueprints';
const MAX_RECENTS = 15;

function readList(key) {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((e) => e && e.scenarioId != null) : [];
  } catch {
    return [];
  }
}

function writeList(key, arr) {
  try {
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {
    /* private mode / quota — skip persistence */
  }
}

export default function useBlueprintShelf() {
  const [pinned, setPinned] = useState(() => readList(PINNED_KEY));
  const [recents, setRecents] = useState(() => readList(RECENTS_KEY));

  useEffect(() => { writeList(PINNED_KEY, pinned); }, [pinned]);
  useEffect(() => { writeList(RECENTS_KEY, recents); }, [recents]);

  const isPinned = useCallback(
    (scenarioId) => pinned.some((e) => e.scenarioId === scenarioId),
    [pinned]
  );

  // Record (or refresh) a blueprint as most-recently-touched.
  // If it's pinned, just refresh the pinned snapshot; otherwise move it to the
  // front of recents, dedupe, and cap the list.
  const recordRecent = useCallback((entry) => {
    if (!entry || entry.scenarioId == null) return;
    const next = { ...entry, ts: entry.ts || Date.now() };
    setPinned((prev) =>
      prev.some((e) => e.scenarioId === next.scenarioId)
        ? prev.map((e) => (e.scenarioId === next.scenarioId ? { ...e, ...next } : e))
        : prev
    );
    setRecents((prev) => {
      const isCurrentlyPinned = JSON.parse(localStorage.getItem(PINNED_KEY) || '[]')
        .some((e) => e && e.scenarioId === next.scenarioId);
      if (isCurrentlyPinned) return prev.filter((e) => e.scenarioId !== next.scenarioId);
      const without = prev.filter((e) => e.scenarioId !== next.scenarioId);
      return [next, ...without].slice(0, MAX_RECENTS);
    });
  }, []);

  // Star / unstar a blueprint. Pinning removes it from recents; unpinning
  // drops it back into recents at the front.
  const togglePin = useCallback((entry) => {
    if (!entry || entry.scenarioId == null) return;
    const snap = { ...entry, ts: entry.ts || Date.now() };
    setPinned((prev) => {
      if (prev.some((e) => e.scenarioId === snap.scenarioId)) {
        return prev.filter((e) => e.scenarioId !== snap.scenarioId);
      }
      return [snap, ...prev];
    });
    setRecents((prev) => {
      const wasPinned = pinned.some((e) => e.scenarioId === snap.scenarioId);
      if (wasPinned) {
        // just unpinned → put back into recents at the front
        const without = prev.filter((e) => e.scenarioId !== snap.scenarioId);
        return [snap, ...without].slice(0, MAX_RECENTS);
      }
      // just pinned → remove from recents
      return prev.filter((e) => e.scenarioId !== snap.scenarioId);
    });
  }, [pinned]);

  // Drop an entry entirely (e.g. blueprint deleted).
  const removeEntry = useCallback((scenarioId) => {
    if (scenarioId == null) return;
    setPinned((prev) => prev.filter((e) => e.scenarioId !== scenarioId));
    setRecents((prev) => prev.filter((e) => e.scenarioId !== scenarioId));
  }, []);

  return { pinned, recents, isPinned, recordRecent, togglePin, removeEntry };
}
