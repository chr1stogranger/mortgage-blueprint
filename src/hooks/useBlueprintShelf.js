/**
 * useBlueprintShelf — the broker's fast-switch shelf, at the CLIENT level.
 *
 * Two lists of lightweight snapshot entries, persisted in localStorage:
 *   - pinned  : clients the broker starred (manual order, newest pin first)
 *   - recents : the last 15 clients opened or edited (newest first, auto-tracked)
 *
 * One row per client (deduped by borrowerId). Clicking a row opens that client's
 * first blueprint. Each entry is a self-contained snapshot:
 *   { borrowerId, borrowerName, status, ts }
 * where borrowerName is already formatted "Last, First" for display.
 *
 * Snapshots refresh every time a client's blueprint is opened or saved, so the
 * name/status stay current. localStorage is per-device.
 */

import { useState, useCallback, useEffect } from 'react';

const PINNED_KEY = 'bp_pinned_clients';
const RECENTS_KEY = 'bp_recent_clients';
const MAX_RECENTS = 15;

function readList(key) {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((e) => e && e.borrowerId != null) : [];
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
    (borrowerId) => pinned.some((e) => e.borrowerId === borrowerId),
    [pinned]
  );

  // Record (or refresh) a client as most-recently-touched. If pinned, just
  // refresh the pinned snapshot; otherwise move it to the front of recents.
  const recordRecent = useCallback((entry) => {
    if (!entry || entry.borrowerId == null) return;
    const next = { ...entry, ts: entry.ts || Date.now() };
    setPinned((prev) =>
      prev.some((e) => e.borrowerId === next.borrowerId)
        ? prev.map((e) => (e.borrowerId === next.borrowerId ? { ...e, ...next } : e))
        : prev
    );
    setRecents((prev) => {
      const isCurrentlyPinned = JSON.parse(localStorage.getItem(PINNED_KEY) || '[]')
        .some((e) => e && e.borrowerId === next.borrowerId);
      if (isCurrentlyPinned) return prev.filter((e) => e.borrowerId !== next.borrowerId);
      const without = prev.filter((e) => e.borrowerId !== next.borrowerId);
      return [next, ...without].slice(0, MAX_RECENTS);
    });
  }, []);

  // Star / unstar a client. Pinning removes it from recents; unpinning drops it
  // back into recents at the front.
  const togglePin = useCallback((entry) => {
    if (!entry || entry.borrowerId == null) return;
    const snap = { ...entry, ts: entry.ts || Date.now() };
    const wasPinned = pinned.some((e) => e.borrowerId === snap.borrowerId);
    setPinned((prev) =>
      wasPinned
        ? prev.filter((e) => e.borrowerId !== snap.borrowerId)
        : [snap, ...prev]
    );
    setRecents((prev) => {
      if (wasPinned) {
        const without = prev.filter((e) => e.borrowerId !== snap.borrowerId);
        return [snap, ...without].slice(0, MAX_RECENTS);
      }
      return prev.filter((e) => e.borrowerId !== snap.borrowerId);
    });
  }, [pinned]);

  // Drop a client entirely.
  const removeEntry = useCallback((borrowerId) => {
    if (borrowerId == null) return;
    setPinned((prev) => prev.filter((e) => e.borrowerId !== borrowerId));
    setRecents((prev) => prev.filter((e) => e.borrowerId !== borrowerId));
  }, []);

  return { pinned, recents, isPinned, recordRecent, togglePin, removeEntry };
}
