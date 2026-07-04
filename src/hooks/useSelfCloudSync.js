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

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  listOwnedScenarios,
  fetchOwnedScenario,
  findOwnedScenarioIdByName,
  createOwnedScenario,
  updateOwnedScenario,
  deleteOwnedScenario,
  stripDevicePrefs,
} from '../lib/cloudScenarios';
import { subscribeToScenario } from '../lib/supabaseClient';

// Guard every cloud op so a wedged request (e.g. Supabase auth-lock contention
// across tabs) can never hang the UI forever — it fails that item instead.
function withTimeout(promise, ms = 15000, label = 'cloud op') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
  ]);
}

const MAP_KEY = 'bp_cloud_map';
const MERGE_DONE_KEY = 'bp_merge_done';
// Persistent tombstones: names the user has explicitly deleted. Kept in
// localStorage (not just an in-memory Set) so a deleted scenario stays deleted
// across reloads — otherwise a lingering or another-device-re-uploaded cloud row
// (the "Scenario 1 zombie") gets pulled straight back after every refresh.
const TOMBSTONE_KEY = 'bp_deleted_names';
function readTombstones() {
  try { return new Set(JSON.parse(localStorage.getItem(TOMBSTONE_KEY) || '[]')); }
  catch { return new Set(); }
}
function writeTombstones(set) {
  try { localStorage.setItem(TOMBSTONE_KEY, JSON.stringify([...set])); } catch { /* noop */ }
}
const PUSH_DEBOUNCE_MS = 700;   // write shortly after the last change so the
                                // other device sees it fast (was 2000).

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
  const lastWriteRef = useRef(0);   // suppress our own realtime echo
  const deletedNamesRef = useRef(readTombstones()); // persistent tombstones — never re-push/re-pull these
  useEffect(() => { scenarioNameRef.current = scenarioName; }, [scenarioName]);

  const accountId = account?.id || null;

  // ── PUSH: debounced write of the active scenario ────────────────────────
  const pushActive = useCallback(async () => {
    if (!enabled || !accountId || !getStateRef?.current) return;
    const name = scenarioNameRef.current;
    if (!name) return;
    // Never re-create a scenario the user just deleted (guards the race where a
    // pending debounced push fires after delete and resurrects it in the cloud).
    if (deletedNamesRef.current.has(name)) return;

    try {
      setStatus('saving');
      lastWriteRef.current = Date.now();   // mark so realtime ignores our echo
      const state = stripDevicePrefs(getStateRef.current());
      const map = readMap();

      // Always resolve the real cloud row by NAME at push time — never trust
      // the locally cached id (a Reset on another device can delete the row the
      // cache points to, which caused "sync error" and broke cross-device sync).
      let id = null;
      try { id = await withTimeout(findOwnedScenarioIdByName(accountId, name), 15000, 'find'); }
      catch { id = map[name]?.id || null; }

      if (id) {
        await withTimeout(updateOwnedScenario(id, { stateData: state, name }), 15000, 'update');
        map[name] = { id, syncedAt: Date.now() };
      } else {
        const created = await withTimeout(createOwnedScenario(accountId, { name, stateData: state }), 15000, 'create');
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
    // Mark the edit NOW (not just when the debounced push lands) so an
    // incoming pull / realtime echo can't revert a change during the debounce
    // window. This is what caused a toggle to "revert unless you click off."
    lastWriteRef.current = Date.now();
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(pushActive, PUSH_DEBOUNCE_MS);
  }, [enabled, pushActive]);

  // ── PULL: reconcile cloud → local. Identity is the scenario NAME:
  // exactly one cloud row per name. Same-named duplicates (from older buggy
  // versions or two devices uploading "Scenario 1") collapse to the newest,
  // and the extras are deleted. Never creates "(2)" renamed copies. ─────────
  const pullNow = useCallback(async () => {
    if (!enabled || !accountId) return;
    try {
      const cloudRows = await withTimeout(listOwnedScenarios(accountId), 15000, 'list');
      if (!cloudRows.length) return;

      // Drop any cloud row whose name the user has deleted (persistent
      // tombstone) and hard-delete it, so a lingering or another-device
      // re-uploaded "zombie" can't keep coming back on every pull.
      const tomb = deletedNamesRef.current;
      const liveRows = [];
      for (const row of cloudRows) {
        if (tomb.has(row.name)) {
          try { await withTimeout(deleteOwnedScenario(row.id), 10000, 'tombstone'); } catch { /* noop */ }
        } else {
          liveRows.push(row);
        }
      }

      // One row per name (newest updated_at wins); gather older dupes to delete.
      const byName = new Map();
      const dupes = [];
      for (const row of liveRows) {
        const cur = byName.get(row.name);
        if (!cur) { byName.set(row.name, row); continue; }
        const rowNewer = new Date(row.updated_at) >= new Date(cur.updated_at);
        byName.set(row.name, rowNewer ? row : cur);
        dupes.push(rowNewer ? cur : row);
      }
      for (const d of dupes) {
        try { await withTimeout(deleteOwnedScenario(d.id), 10000, 'dedupe'); } catch { /* noop */ }
      }

      const map = readMap();
      const localNames = new Set(readLocalScenarioNames());
      const addedNames = [];

      for (const [name, row] of byName) {
        const prev = map[name];
        const cloudTs = new Date(row.updated_at).getTime();
        const haveLocal = localNames.has(name);
        // Download cloud content when we have no local copy, or the cloud
        // version is newer than our last sync of this name.
        if (!haveLocal || cloudTs > ((prev?.syncedAt) || 0) + 1500) {
          const full = await withTimeout(fetchOwnedScenario(row.id), 15000, 'fetch');
          if (full?.state_data) {
            writeLocalScenario(name, full.state_data);
            if (!haveLocal) addedNames.push(name);
            if (name === scenarioNameRef.current && loadStateRef?.current) {
              loadStateRef.current(stripDevicePrefs(full.state_data));
            }
          }
        }
        map[name] = { id: row.id, syncedAt: Date.now() };
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

    // Adopt-by-name: if the cloud already has a scenario with this name (e.g.
    // uploaded from another device), update it in place instead of creating a
    // duplicate. This is what prevents the "Scenario 1 (2)/(3)" forking.
    let cloudByName = new Map();
    try {
      const cloudRows = await withTimeout(listOwnedScenarios(accountId), 15000, 'list');
      for (const r of cloudRows) {
        const cur = cloudByName.get(r.name);
        if (!cur || new Date(r.updated_at) > new Date(cur.updated_at)) cloudByName.set(r.name, r);
      }
    } catch { /* offline — treat as empty, create below */ }

    let uploaded = 0;
    for (const name of names) {
      const state = readLocalScenario(name);
      if (!state) continue;
      try {
        const existing = cloudByName.get(name);
        if (existing) {
          await withTimeout(updateOwnedScenario(existing.id, { stateData: state, name }), 15000, 'update');
          map[name] = { id: existing.id, syncedAt: Date.now() };
        } else {
          const created = await withTimeout(createOwnedScenario(accountId, { name, stateData: state }), 15000, 'create');
          map[name] = { id: created.id, syncedAt: Date.now() };
        }
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

  // ── RESET: wipe cloud scenarios + local sync state for a clean re-sync.
  // Deletes every cloud scenario this account owns and clears the local
  // name→id map + merge flag. Local scenarios are left untouched, so the
  // user can re-enable sync and upload a fresh, clean set from one device.
  const resetSync = useCallback(async () => {
    if (!accountId) return 0;
    let deleted = 0;
    try {
      const rows = await withTimeout(listOwnedScenarios(accountId), 15000, 'list');
      for (const r of rows) {
        try { await withTimeout(deleteOwnedScenario(r.id), 10000, 'delete'); deleted++; } catch { /* noop */ }
      }
    } catch (e) {
      console.warn('[selfCloudSync] reset failed:', e.message);
    }
    try { localStorage.removeItem(MAP_KEY); localStorage.removeItem(MERGE_DONE_KEY); } catch { /* noop */ }
    pulledRef.current = false;
    setMergeCandidates(null);
    return deleted;
  }, [accountId]);

  const skipMerge = useCallback(() => {
    try { localStorage.setItem(MERGE_DONE_KEY, '1'); } catch { /* noop */ }
    setMergeCandidates([]);
  }, []);

  // ── DELETE the cloud copy of a scenario by name + drop its mapping, so a
  // locally-deleted scenario doesn't get pulled back down on the next sync.
  const deleteByName = useCallback(async (name) => {
    // Tombstone the name and cancel any pending debounced push for it, so a
    // late save can't resurrect it right after we delete it.
    deletedNamesRef.current.add(name);
    writeTombstones(deletedNamesRef.current);
    if (pushTimer.current) { clearTimeout(pushTimer.current); pushTimer.current = null; }
    const map = readMap();
    let id = map[name]?.id;
    // If the mapping was lost, still find & delete the cloud row by name so a
    // stale cloud orphan can't keep resyncing back after a local delete.
    if (!id && accountId) {
      try {
        const rows = await withTimeout(listOwnedScenarios(accountId), 10000, 'list');
        for (const r of rows) if (r.name === name && !id) id = r.id;
      } catch { /* noop */ }
    }
    if (id) {
      try { await withTimeout(deleteOwnedScenario(id), 10000, 'delete'); } catch { /* noop */ }
    }
    delete map[name];
    writeMap(map);
  }, [accountId]);

  // ── RENAME the cloud copy in place (keep the same id) + remap, so the old
  // name doesn't linger in the cloud and resync as a duplicate.
  // Allow a name to sync again (e.g. user re-creates or renames TO a name that
  // was previously tombstoned by a delete in this session).
  const clearTombstone = useCallback((name) => {
    deletedNamesRef.current.delete(name);
    writeTombstones(deletedNamesRef.current);
  }, []);

  const renameByName = useCallback(async (oldName, newName) => {
    deletedNamesRef.current.delete(newName);
    writeTombstones(deletedNamesRef.current);
    const map = readMap();
    const entry = map[oldName];
    if (entry?.id) {
      try { await withTimeout(updateOwnedScenario(entry.id, { name: newName }), 10000, 'rename'); } catch { /* noop */ }
      map[newName] = { id: entry.id, syncedAt: Date.now() };
      delete map[oldName];
      writeMap(map);
    }
  }, []);

  // Active scenario's cloud id — recomputed only when the scenario changes or
  // a sync assigns/updates its id, so the realtime subscription below re-subs
  // only when the id actually changes (not on every debounced push).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeCloudId = useMemo(() => readMap()[scenarioName]?.id || null, [scenarioName, lastSyncedAt]);

  // ── REALTIME: live-update the active scenario when another device edits it.
  // Subscribes to postgres UPDATEs on the active scenario's cloud row (RLS
  // scopes it to this user). ─────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !accountId || !activeCloudId) return;

    const { unsubscribe } = subscribeToScenario(activeCloudId, (newRow) => {
      // Ignore the echo of our own just-sent write. Kept just above the push
      // debounce so a real remote edit isn't suppressed for long.
      if (Date.now() - lastWriteRef.current < 1500) return;
      if (!newRow?.state_data) return;

      const activeName = scenarioNameRef.current;
      writeLocalScenario(activeName, newRow.state_data);
      const map = readMap();
      if (map[activeName]) { map[activeName].syncedAt = Date.now(); writeMap(map); }

      // Apply live if this is the scenario currently on screen.
      if (loadStateRef?.current) {
        loadStateRef.current(stripDevicePrefs(newRow.state_data));
      }
      setLastSyncedAt(new Date());
    });

    return () => { try { unsubscribe(); } catch { /* noop */ } };
  }, [enabled, accountId, activeCloudId, loadStateRef]);

  // ── SAFETY NET: realtime events get missed (tab backgrounded, phone asleep,
  // socket blip) — that's what makes sync feel like it "works half the time."
  // Re-pull whenever the device regains focus/visibility and on a light
  // interval so it always catches up within seconds even if no live event
  // arrived. This also heals a stale active subscription: pullNow rewrites the
  // name→id map to the real cloud rows, which re-subscribes realtime to the
  // correct row on the next render. ──────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !accountId || !loaded) return;
    const refresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      // Never pull while a local edit is still pending its push, or within 4s of
      // the last edit — otherwise the pull reloads stale cloud state and reverts
      // the change the user just made.
      if (pushTimer.current) return;
      if (Date.now() - lastWriteRef.current < 4000) return;
      pullNow();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    const iv = setInterval(refresh, 20000);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(iv);
    };
  }, [enabled, accountId, loaded, pullNow]);

  // ── Lifecycle: when sync becomes active ─────────────────────────────────
  // If the account ALREADY has cloud scenarios (any device synced before),
  // just load them — never prompt to upload. The merge/upload prompt appears
  // only on the very first device, when the cloud is still empty.
  useEffect(() => {
    if (!enabled || !accountId || !loaded) { pulledRef.current = false; return; }
    if (pulledRef.current) return;
    pulledRef.current = true;

    (async () => {
      let cloudRows = [];
      try { cloudRows = await withTimeout(listOwnedScenarios(accountId), 15000, 'list'); }
      catch { /* offline — fall through */ }

      if (cloudRows.length > 0) {
        // Account already populated → adopt cloud, skip the upload prompt.
        try { localStorage.setItem(MERGE_DONE_KEY, '1'); } catch { /* noop */ }
        setMergeCandidates([]);
        await pullNow();
      } else {
        // First device (empty cloud) → offer to upload local scenarios, if any.
        computeMergeCandidates();
      }
    })();
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
    resetSync,          // wipe cloud scenarios + local sync state (troubleshooting)
    deleteByName,       // delete a scenario's cloud copy so it won't resync
    renameByName,       // rename a scenario's cloud copy in place
    clearTombstone,     // re-allow syncing a name after a delete (on re-create)
  };
}
