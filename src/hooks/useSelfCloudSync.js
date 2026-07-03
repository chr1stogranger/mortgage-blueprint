/**
 * useSelfCloudSync — cross-device sync for SELF-OWNED blueprints.
 *
 * For homebuyers who sign in on the public calculator (no LO share link).
 * Bridges the existing localStorage scenario system ("scenario:<name>" keys)
 * to Supabase `scenarios` rows owned by the user's borrower account.
 *
 * Design principles:
 *   - Local-first: localStorage remains the source the calculator reads from.
 *     The cloud is a synced mirror, keyed by a name→cloudId map.
 *   - Opt-in: does nothing unless `enabled` (signed in + sync turned on).
 *   - Last-write-wins by timestamp, but the first merge is user-driven
 *     (CloudMergeSheet) — nothing uploads or downloads silently on day one.
 *
 * localStorage keys:
 *   bp_cloud_map      { [scenarioName]: { id, syncedAt } }
 *   bp_merge_done     '1' once the user has completed the first-run merge
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  listOwnedScenarios,
  fetchOwnedScenario,
  createOwnedScenario,
  updateOwnedScenario,
  stripDevicePrefs,
} from '../lib/cloudScenarios';

const MAP_KEY = 'bp_cloud_map';
const MERGE_DONE_KEY = 'bp_merge_done';
const PUSH_DEBOUNCE_MS = 2000;

function readMap() {
  try { return JSON.parse(localStorage.getItem(MAP_KEY) || '{}') || {}; } catch { return {}; }
}
function writeMap(map) {
  try { localStorage.setItem(MAP_KEY, JSON.stringify(map)); } catch { /* noop */ }
}

function readLocalScenarioNames() {
  const names = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('scenario:')) names.push(k.slice('scenario:'.length));
    }
  } catch { /* noop */ }
  return names;
}

function readLocalScenario(name) {
  try {
    const raw = localStorage.getItem('scenario:' + name);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeLocalScenario(name, stateData) {
  try { localStorage.setItem('scenario:' + name, JSON.stringify(stateData)); } catch { /* noop */ }
}

export default function useSelfCloudSync({
  enabled = false,          // signed in + syncEnabled + not LO/borrower mode
  account = null,           // borrower_accounts row
  scenarioName,             // active local scenario name
  setScenarioList = null,   // setter — lets pull add downloaded scenarios
  getStateRef,              // ref → getState()
  loadStateRef,             // ref → loadState(s)
  loaded = false,           // calculator finished its initial local load
}) {
  const [status, setStatus] = useState('idle');  // idle | saving | saved | error
  const [mergeCandidates, setMergeCandidates] = useState(null); // null = not computed
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const pushTimer = useRef(null);
  const scenarioNameRef = useRef(scenarioName);
  const pulledRef = useRef(false);
  useEffect(() => { scenarioNameRef.current = scenarioName; }, [scenarioName]);

  const accountId = account?.id || null;

  // ── PUSH: debounced write of the active scenario ────────────────────────
  const pushActive = useCallback(async () => {
    if (!enabled || !accountId || !getStateRef?.current) return;
    const name = scenarioNameRef.current;
    if (!name) return;

    try {
      setStatus('saving');
      const state = stripDevicePrefs(getStateRef.current());
      const map = readMap();
      const entry = map[name];

      if (entry?.id) {
        await updateOwnedScenario(entry.id, { stateData: state, name });
        map[name] = { id: entry.id, syncedAt: Date.now() };
      } else {
        const created = await createOwnedScenario(accountId, { name, stateData: state });
        map[name] = { id: created.id, syncedAt: Date.now() };
      }
      writeMap(map);
      setLastSyncedAt(new Date());
      setStatus('saved');
      setTimeout(() => setStatus(s => (s === 'saved' ? 'idle' : s)), 2000);
    } catch (e) {
      console.warn('[selfCloudSync] push failed:', e.message);
      setStatus('error');
    }
  }, [enabled, accountId, getStateRef]);

  const schedulePush = useCallback(() => {
    if (!enabled) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(pushActive, PUSH_DEBOUNCE_MS);
  }, [enabled, pushActive]);

  // ── PULL: on sign-in / mount, download newer cloud copies ───────────────
  const pullNow = useCallback(async () => {
    if (!enabled || !accountId) return;
    try {
      const cloudRows = await listOwnedScenarios(accountId);
      if (!cloudRows.length) return;

      const map = readMap();
      const idToName = {};
      for (const [name, entry] of Object.entries(map)) {
        if (entry?.id) idToName[entry.id] = name;
      }

      const localNames = new Set(readLocalScenarioNames());
      const addedNames = [];

      for (const row of cloudRows) {
        let name = idToName[row.id];

        if (!name) {
          // New-to-this-device cloud scenario → download it
          name = row.name || 'My Blueprint';
          // Avoid clobbering an unmapped local scenario with the same name
          let candidate = name;
          let n = 2;
          while (localNames.has(candidate) && map[candidate]?.id !== row.id) {
            candidate = `${name} (${n++})`;
          }
          name = candidate;

          const full = await fetchOwnedScenario(row.id);
          if (full?.state_data) {
            writeLocalScenario(name, full.state_data);
            map[name] = { id: row.id, syncedAt: Date.now() };
            localNames.add(name);
            addedNames.push(name);
          }
          continue;
        }

        // Known scenario → refresh local copy if the cloud version is newer
        const entry = map[name];
        const cloudTs = new Date(row.updated_at).getTime();
        if (cloudTs > (entry.syncedAt || 0) + 1500) {
          const full = await fetchOwnedScenario(row.id);
          if (full?.state_data) {
            writeLocalScenario(name, full.state_data);
            map[name] = { id: row.id, syncedAt: Date.now() };
            // If it's the active scenario, apply it live
            if (name === scenarioNameRef.current && loadStateRef?.current) {
              loadStateRef.current(stripDevicePrefs(full.state_data));
            }
          }
        }
      }

      writeMap(map);

      if (addedNames.length && setScenarioList) {
        setScenarioList(prev => {
          const merged = [...prev];
          for (const n of addedNames) if (!merged.includes(n)) merged.push(n);
          return merged;
        });
      }
      setLastSyncedAt(new Date());
    } catch (e) {
      console.warn('[selfCloudSync] pull failed:', e.message);
    }
  }, [enabled, accountId, loadStateRef, setScenarioList]);

  // ── FIRST-RUN MERGE detection ───────────────────────────────────────────
  const computeMergeCandidates = useCallback(() => {
    let done = false;
    try { done = localStorage.getItem(MERGE_DONE_KEY) === '1'; } catch { /* noop */ }
    if (done) { setMergeCandidates([]); return; }

    const map = readMap();
    const unmapped = readLocalScenarioNames().filter(n => !map[n]?.id);
    setMergeCandidates(unmapped);
  }, []);

  /**
   * Upload the chosen local scenarios to the cloud (first-run merge).
   * `names` — subset of mergeCandidates the user checked.
   */
  const uploadLocal = useCallback(async (names) => {
    if (!accountId) throw new Error('Not signed in');
    const map = readMap();
    let uploaded = 0;
    for (const name of names) {
      const state = readLocalScenario(name);
      if (!state) continue;
      try {
        const created = await createOwnedScenario(accountId, { name, stateData: state });
        map[name] = { id: created.id, syncedAt: Date.now() };
        uploaded++;
      } catch (e) {
        console.warn(`[selfCloudSync] upload of "${name}" failed:`, e.message);
      }
    }
    writeMap(map);
    try { localStorage.setItem(MERGE_DONE_KEY, '1'); } catch { /* noop */ }
    setMergeCandidates([]);
    return uploaded;
  }, [accountId]);

  const skipMerge = useCallback(() => {
    try { localStorage.setItem(MERGE_DONE_KEY, '1'); } catch { /* noop */ }
    setMergeCandidates([]);
  }, []);

  // ── Lifecycle: when sync becomes active, pull once + detect merge ───────
  useEffect(() => {
    if (!enabled || !accountId || !loaded) { pulledRef.current = false; return; }
    if (pulledRef.current) return;
    pulledRef.current = true;
    computeMergeCandidates();
    pullNow();
  }, [enabled, accountId, loaded, computeMergeCandidates, pullNow]);

  // ── Flush pending push on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pushTimer.current) {
        clearTimeout(pushTimer.current);
        pushActive();
      }
    };
  }, [pushActive]);

  return {
    status,             // idle | saving | saved | error
    lastSyncedAt,
    schedulePush,       // call from the autosave effect
    pushNow: pushActive,
    pullNow,
    mergeCandidates,    // null (not computed) | [] (nothing to merge) | [names]
    uploadLocal,
    skipMerge,
  };
}
