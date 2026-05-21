/**
 * useBlueprintShelf — persists the broker's "shelf" of borrowers for fast switching.
 *
 * Two lists, both stored in localStorage and keyed by borrower id:
 *   - recentIds : the last N borrowers whose blueprint was opened (newest first, auto-tracked)
 *   - pinnedIds : borrowers the broker explicitly starred (manual, stable order)
 *
 * Borrower-id level (not scenario level) on purpose: a "blueprint" in the broker's
 * head = a client situation. We resolve ids back to full borrower objects from the
 * live borrowerList at render time, so nothing here ever goes stale or stores PII.
 *
 * localStorage is per-device. That's fine for v1 — a future version can sync these
 * off the logged-in broker so recents follow them between phone and desktop.
 */

import { useState, useCallback, useEffect } from 'react';

const RECENTS_KEY = 'bp_recent_borrowers';
const PINNED_KEY = 'bp_pinned_borrowers';
const MAX_RECENTS = 15;

function readIds(key) {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeIds(key, arr) {
  try {
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {
    /* private mode / quota — silently skip persistence */
  }
}

export default function useBlueprintShelf() {
  const [recentIds, setRecentIds] = useState(() => readIds(RECENTS_KEY));
  const [pinnedIds, setPinnedIds] = useState(() => readIds(PINNED_KEY));

  useEffect(() => { writeIds(RECENTS_KEY, recentIds); }, [recentIds]);
  useEffect(() => { writeIds(PINNED_KEY, pinnedIds); }, [pinnedIds]);

  // Record a borrower as most-recently-opened (moves it to the front, dedupes, caps).
  const recordRecent = useCallback((id) => {
    if (id == null) return;
    setRecentIds((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENTS));
  }, []);

  // Star / unstar a borrower.
  const togglePin = useCallback((id) => {
    if (id == null) return;
    setPinnedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]));
  }, []);

  const isPinned = useCallback((id) => pinnedIds.includes(id), [pinnedIds]);

  return { recentIds, pinnedIds, recordRecent, togglePin, isPinned };
}
