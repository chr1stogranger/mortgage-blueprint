/**
 * useBlueprintSync — Thin sync bridge for the existing MortgageBlueprint component.
 *
 * Rather than replacing 80+ useState hooks, this hook wraps the existing
 * getState()/loadState() pattern and adds:
 *   - Realtime subscription (receive remote changes → merge → loadState)
 *   - Debounced writes (borrower: local changes → share-sync endpoint)
 *   - Presence (who's online, and which scenario each person is on)
 *   - Lock status (which fields are locked)
 *   - Sync status indicator (saving/saved/error)
 *
 * Echo + clobber rules (live co-editing, 2026-09-22):
 *   - `baseRef` is the last state known to be in the DB (what we wrote or
 *     what we received). A write whose state equals it is skipped — so a
 *     remote change applied on screen is never written straight back.
 *   - An incoming row equal to something we just sent is our own echo.
 *   - Otherwise only the keys the REMOTE side changed (vs baseRef) are laid
 *     over the local state, so the other person's edit can't wipe fields
 *     you're mid-typing.
 *   Comparisons ignore per-device UI keys (theme), which getState carries
 *   but loadState never applies.
 *
 * The LO's writes go through MortgageBlueprint's saveToCloud, which must call
 * noteLocalWrite(state) so the echo check knows about them.
 */

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { subscribeToScenario, subscribeToLockEvents, createPresenceChannel, fetchScenarioRow } from '../lib/supabaseClient';
import { updateScenario, shareAuthHeaders } from '../api';

const DEBOUNCE_MS = 500;          // Write delay after last change
const RECENT_SENT = 8;            // How many of our own writes to remember for echo detection

// Per-device keys: in getState() but never applied by loadState.
const UI_ONLY_KEYS = new Set(['darkMode', 'themeMode']);

// Stable stringify (sorted keys) so key order never reads as a change.
function stable(v) {
  if (v === undefined) return 'undefined';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined)
    .map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
}
export function stateSig(state) {
  if (!state) return '';
  const o = {};
  for (const k of Object.keys(state)) if (!UI_ONLY_KEYS.has(k)) o[k] = state[k];
  return stable(o);
}
// Keys whose value differs between a and b (UI-only keys ignored).
export function changedKeys(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  const out = [];
  for (const k of keys) {
    if (UI_ONLY_KEYS.has(k)) continue;
    if (stable(a?.[k]) !== stable(b?.[k])) out.push(k);
  }
  return out;
}

/**
 * Decide what an incoming realtime row means for this client.
 *   base     — last state known to be in the DB before this row
 *   local    — what's on screen now (getState())
 *   remote   — the row's state_data
 *   sentSigs — signatures of our recent writes
 * Returns the state to loadState(), or null when there's nothing to apply.
 */
export function resolveRemote({ base, local, remote, sentSigs = [] }) {
  if (!remote || typeof remote !== 'object') return null;
  const remoteSig = stateSig(remote);
  if (sentSigs.includes(remoteSig)) return null;          // our own echo
  if (local && stateSig(local) === remoteSig) return null; // already showing it
  if (!base || !local) return remote;
  const moved = changedKeys(base, remote);
  if (moved.length === 0) return null;                     // DB unchanged since we last knew it
  const merged = { ...local };
  for (const k of moved) merged[k] = remote[k];
  return merged;
}

/**
 * Should this client write `state`?
 *   - Not if the DB already holds it (echo).
 *   - Not if nothing was touched locally since the last remote change was
 *     applied: whatever moved since is that change's knock-on (title/escrow/
 *     EMD recomputing from the new price…). Writing it back carries the OLD
 *     values into the DB and the windows ping-pong ($1 ↔ $1,000,000 with 3
 *     windows open, 2026-09-22) — adopt it as the baseline instead.
 *   - Unless there were unsaved local edits when the remote change landed:
 *     those were merged in and still need saving.
 * Returns 'write' | 'skip' | 'adopt'.
 */
export function decideWrite({ stateSig: sig, baseSig, lastRemoteApplyAt = 0, lastUserInputAt = 0, pendingLocal = false }) {
  if (baseSig && sig === baseSig) return 'skip';
  if (baseSig && lastRemoteApplyAt > lastUserInputAt && !pendingLocal) return 'adopt';
  return 'write';
}

// Fields that map to lockable sections
const FIELD_TO_SECTION = {};
const LOCKABLE_SECTIONS = {
  incomes: ['annualIncome', 'monthlyIncome', 'incomes', 'incomeSource', 'incomeFrequency'],
  debts: ['debts', 'monthlyDebts', 'carPayment', 'studentLoans', 'creditCards', 'otherDebt'],
  creditScore: ['creditScore', 'ficoScore'],
  assets: ['assets', 'totalAssets', 'bankBalance', 'retirementFunds', 'giftFunds'],
  employmentInfo: ['employer', 'employerName', 'yearsAtJob', 'employmentType', 'jobTitle'],
};
for (const [section, fields] of Object.entries(LOCKABLE_SECTIONS)) {
  for (const field of fields) FIELD_TO_SECTION[field] = section;
}

export default function useBlueprintSync({
  scenarioId,
  scenarioName = '',
  roomId = null,       // borrower UUID — presence room shared by all their scenarios
  getState,
  loadState,
  userInfo = {},       // { email, name, avatarUrl }
  userType = 'lo',     // 'lo' | 'borrower'
  shareToken = null,   // for borrower access
  enabled = true,
}) {
  const [status, setStatus] = useState('idle');        // idle, saving, saved, error
  const [lockedFields, setLockedFields] = useState({});
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const debounceRef = useRef(null);
  const baseRef = useRef(null);        // last state known to be in the DB
  const sentSigsRef = useRef([]);      // signatures of our recent writes
  const subscriptionsRef = useRef([]);
  const presenceRef = useRef(null);
  const hereRef = useRef({});          // my { tab, field, field_active } for presence
  const lastUserInputAtRef = useRef(0);    // last real keystroke/tap in this window
  const lastRemoteApplyAtRef = useRef(0);  // last time a remote change was applied here
  const pendingLocalRef = useRef(false);   // unsaved local edits existed when it was
  const scenarioIdRef = useRef(scenarioId);
  const getStateRef = useRef(getState);
  const loadStateRef = useRef(loadState);
  // userInfo arrives as a fresh object literal every render — read it through
  // a ref so flush stays stable (an unstable flush re-ran the unmount cleanup
  // below on EVERY render, which tore down the realtime + presence channels).
  const userInfoRef = useRef(userInfo);
  useLayoutEffect(() => { userInfoRef.current = userInfo; });

  // Keep refs current
  useEffect(() => { scenarioIdRef.current = scenarioId; }, [scenarioId]);
  useEffect(() => { getStateRef.current = getState; }, [getState]);
  useEffect(() => { loadStateRef.current = loadState; }, [loadState]);

  // ── Record a write we made (ours or saveToCloud's) ────────────────────
  // Returns an undo for when the write fails.
  const noteLocalWrite = useCallback((state) => {
    if (!state) return () => {};
    const prevBase = baseRef.current;
    const prevSent = sentSigsRef.current;
    pendingLocalRef.current = false;
    baseRef.current = { ...state };
    sentSigsRef.current = [stateSig(state), ...prevSent].slice(0, RECENT_SENT);
    return () => { baseRef.current = prevBase; sentSigsRef.current = prevSent; };
  }, []);

  // True when `state` is already what the DB holds → writing it is an echo.
  const isEcho = useCallback((state) => (
    !!baseRef.current && stateSig(state) === stateSig(baseRef.current)
  ), []);

  // Real user activity in this window (vs. effects recomputing after a
  // remote change). Capture phase so nothing can swallow it.
  useEffect(() => {
    // Only interactions with a control count — a finger landing to scroll
    // (pointerdown) or an arrow key paging the page isn't an edit.
    const mark = (e) => {
      if (e.type === 'input' || e.type === 'change' || e.type === 'paste'
          || e.target?.closest?.('input,select,textarea,button,label,[role="button"],[role="switch"],[role="checkbox"],[contenteditable="true"]')) {
        lastUserInputAtRef.current = Date.now();
      }
    };
    const evs = ['keydown', 'input', 'change', 'pointerdown', 'paste'];
    evs.forEach(e => document.addEventListener(e, mark, true));
    return () => evs.forEach(e => document.removeEventListener(e, mark, true));
  }, []);

  // See decideWrite. 'adopt' makes `state` the baseline without writing.
  const shouldWrite = useCallback((state) => {
    const d = decideWrite({
      stateSig: stateSig(state),
      baseSig: baseRef.current ? stateSig(baseRef.current) : '',
      lastRemoteApplyAt: lastRemoteApplyAtRef.current,
      lastUserInputAt: lastUserInputAtRef.current,
      pendingLocal: pendingLocalRef.current,
    });
    if (d === 'adopt') baseRef.current = { ...state };
    return d === 'write';
  }, []);

  // ── Subscribe to Realtime changes ─────────────────────────────────────
  useEffect(() => {
    if (!scenarioId || !enabled) return;

    // Scenario data changes (also fed by the catch-up re-read below)
    const onRow = (newRow) => {
      if (newRow.locked_fields) setLockedFields(newRow.locked_fields);
      const remote = newRow.state_data;
      if (!remote || typeof remote !== 'object' || !loadStateRef.current) return;

      const base = baseRef.current;
      baseRef.current = { ...remote };
      // Lay only the fields the other side changed over our local state, so
      // anything we're mid-edit on survives (and is written after, merged).
      const local = getStateRef.current ? getStateRef.current() : null;
      const next = resolveRemote({ base, local, remote, sentSigs: sentSigsRef.current });
      if (next) {
        // Were there local edits not yet saved? They were merged into `next`
        // and must still be written (see decideWrite).
        pendingLocalRef.current = pendingLocalRef.current
          || (!!base && !!local && changedKeys(base, local).length > 0);
        lastRemoteApplyAtRef.current = Date.now();
        loadStateRef.current(next);
      }
    };
    const scenarioSub = subscribeToScenario(scenarioId, onRow);

    // Catch-up: realtime events are lost while a phone sleeps or the socket
    // blips. Re-read the row (RLS-scoped) on return and run it through the
    // same merge — a no-op when nothing changed.
    let lastCatchUp = 0;
    const catchUp = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCatchUp < 3000) return;
      lastCatchUp = Date.now();
      const row = await fetchScenarioRow(scenarioId).catch(() => null);
      if (row && scenarioIdRef.current === scenarioId) onRow(row);
    };
    document.addEventListener('visibilitychange', catchUp);
    window.addEventListener('online', catchUp);

    // Lock events
    const lockSub = subscribeToLockEvents(scenarioId, (lockEvent) => {
      setLockedFields(prev => ({
        ...prev,
        [lockEvent.field_key]: lockEvent.action === 'locked',
      }));
    });

    subscriptionsRef.current = [scenarioSub, lockSub];

    return () => {
      document.removeEventListener('visibilitychange', catchUp);
      window.removeEventListener('online', catchUp);
      subscriptionsRef.current.forEach(s => s.unsubscribe());
      subscriptionsRef.current = [];
    };
  }, [scenarioId, enabled]);

  // ── Presence (one room per borrower; payload says which scenario) ─────
  const locationRef = useRef({ scenarioId, scenarioName });
  useLayoutEffect(() => { locationRef.current = { scenarioId, scenarioName }; });
  useEffect(() => {
    if (!roomId || !enabled || !userInfo.email) return;

    const presence = createPresenceChannel(
      roomId,
      { email: userInfo.email, name: userInfo.name, avatarUrl: userInfo.avatarUrl, userType },
      locationRef.current,
      (users) => {
        // Supabase drops disconnected clients itself — no staleness cutoff
        // (online_at is only stamped on track, so a time cutoff hid anyone
        // connected for more than a minute). Dedupe tabs by email, newest wins.
        const byEmail = new Map();
        for (const u of users) {
          if (!u.email || u.email === userInfo.email) continue;
          const prev = byEmail.get(u.email);
          if (!prev || String(u.online_at) > String(prev.online_at)) byEmail.set(u.email, u);
        }
        setOnlineUsers([...byEmail.values()]);
      }
    );

    presenceRef.current = presence;
    // Re-announce tab/field after a room change (new channel starts blank)
    if (Object.keys(hereRef.current).length) presence.track(hereRef.current);

    return () => {
      presence.unsubscribe();
      presenceRef.current = null;
      setOnlineUsers([]);
    };
  }, [roomId, enabled, userInfo.email, userType]);

  useEffect(() => {
    presenceRef.current?.track({ scenario_id: scenarioId || null, scenario_name: scenarioName || '' });
  }, [scenarioId, scenarioName]);

  // Where I am inside the blueprint: { tab, field, field_active } — drives the
  // other person's field outline + initials, and their Jump/Follow.
  const setPresenceInfo = useCallback((partial) => {
    hereRef.current = { ...hereRef.current, ...partial };
    presenceRef.current?.track(partial);
  }, []);

  // ── Debounced write to Supabase ───────────────────────────────────────
  const flush = useCallback(async () => {
    if (!scenarioIdRef.current || !getStateRef.current) return;

    const currentState = getStateRef.current();
    const base = baseRef.current;
    if (!shouldWrite(currentState)) return; // echo, or a remote change's knock-on

    const fieldDiffs = {};
    if (base) {
      for (const k of changedKeys(base, currentState)) {
        fieldDiffs[k] = { old: base[k] ?? null, new: currentState[k] ?? null };
      }
    }

    setStatus('saving');

    try {
      // Build lightweight calc_summary
      const sp = Number(currentState.salesPrice) || 0;
      const dp = sp * (Number(currentState.downPct) || 0) / 100;
      const la = sp - dp;
      const r = Number(currentState.rate) || 0;
      const t = Number(currentState.term) || 30;
      const mr = r / 100 / 12;
      const np = t * 12;
      let pi = 0;
      if (mr > 0 && np > 0 && la > 0) {
        pi = la * (mr * Math.pow(1 + mr, np)) / (Math.pow(1 + mr, np) - 1);
      }

      const calcSummary = {
        salesPrice: sp, loanAmount: la, downPayment: dp,
        downPct: Number(currentState.downPct) || 0,
        ltv: sp > 0 ? Math.round((la / sp) * 1000) / 10 : 0,
        rate: r, term: t,
        creditScore: Number(currentState.creditScore) || 0,
        monthlyPI: Math.round(pi),
        loanType: currentState.loanType || 'Conventional',
      };

      // Register before the request so the realtime echo is recognized even
      // if it beats the HTTP response back.
      const undoNote = noteLocalWrite(currentState);

      try {
        if (shareToken) {
          // Borrower: use share-sync endpoint
          const API_BASE = import.meta.env.VITE_API_BASE || 'https://ops.realstack.app';
          const res = await fetch(`${API_BASE}/api/collab?resource=sync`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...(await shareAuthHeaders()) },
            body: JSON.stringify({
              token: shareToken,
              scenario_id: scenarioIdRef.current,
              state_data: currentState,
              calc_summary: calcSummary,
              field_diffs: fieldDiffs,
              changed_by: 'borrower',
              changed_by_name: userInfoRef.current.name || '',
              changed_by_email: userInfoRef.current.email || '',
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
          }
        } else {
          // LO: use authenticated endpoint
          await updateScenario({
            id: scenarioIdRef.current,
            state_data: currentState,
            calc_summary: calcSummary,
          });
        }
      } catch (e) {
        undoNote();
        throw e;
      }

      setLastSavedAt(new Date());
      setStatus('saved');
      setTimeout(() => setStatus(s => s === 'saved' ? 'idle' : s), 2000);
    } catch (e) {
      console.error('[useBlueprintSync] Save failed:', e);
      setStatus('error');
    }
  }, [shareToken, noteLocalWrite, shouldWrite]);

  // ── Trigger sync (call this after any state change) ───────────────────
  const scheduleSync = useCallback(() => {
    if (!scenarioIdRef.current || !enabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { debounceRef.current = null; flush(); }, DEBOUNCE_MS);
  }, [flush, enabled]);

  // ── Check if a field is locked ────────────────────────────────────────
  const isFieldLocked = useCallback((fieldName) => {
    if (userType === 'lo') return false; // LO can edit everything
    const section = FIELD_TO_SECTION[fieldName];
    return section ? !!lockedFields[section] : false;
  }, [lockedFields, userType]);

  // ── Initialize baseline when scenario loads ───────────────────────────
  const initSync = useCallback((initialState, initialLockedFields) => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    baseRef.current = initialState ? { ...initialState } : null;
    sentSigsRef.current = [];
    pendingLocalRef.current = false;
    lastRemoteApplyAtRef.current = 0;
    if (initialLockedFields) setLockedFields(initialLockedFields);
  }, []);

  // ── Force flush on unmount (only) ─────────────────────────────────────
  // Channels are torn down by their own effects' cleanups above.
  const flushRef = useRef(flush);
  useLayoutEffect(() => { flushRef.current = flush; });
  useEffect(() => () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
      flushRef.current();
    }
  }, []);

  return {
    // Status
    status,             // 'idle' | 'saving' | 'saved' | 'error'
    lastSavedAt,

    // Presence
    onlineUsers,        // Other people on this borrower's file: [{ name, email, user_type, scenario_id, scenario_name }]

    // Locking
    lockedFields,       // { incomes: true, debts: false, ... }
    isFieldLocked,      // (fieldName) => boolean

    // Actions
    scheduleSync,       // Call after any state change to trigger debounced write
    initSync,           // Call when a scenario is loaded to set baseline state
    flush,              // Force immediate write (e.g., before navigation)
    noteLocalWrite,     // Call when a write happens outside this hook (LO saveToCloud)
    isEcho,             // (state) => true if the DB already holds exactly this state
    shouldWrite,        // (state) => false for echoes and remote-change knock-ons
    setPresenceInfo,    // ({ tab, field, field_active }) => broadcast where I am
  };
}
