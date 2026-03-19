/**
 * useBlueprintSync — Thin sync bridge for the existing MortgageBlueprint component.
 *
 * Rather than replacing 80+ useState hooks, this hook wraps the existing
 * getState()/loadState() pattern and adds:
 *   - Realtime subscription (receive remote changes → call loadState)
 *   - Debounced writes (local changes → push to Supabase)
 *   - Presence tracking (who's online)
 *   - Lock status (which fields are locked)
 *   - Sync status indicator (saving/saved/error)
 *
 * Usage in MortgageBlueprint.jsx:
 *   const sync = useBlueprintSync({
 *     scenarioId: activeScenarioId,
 *     getState,
 *     loadState,
 *     userInfo: { email: authUser.email, name: authUser.name },
 *   });
 *   // sync.status → 'idle' | 'saving' | 'saved' | 'error'
 *   // sync.onlineUsers → [{ name, email, user_type }]
 *   // sync.lockedFields → { incomes: true, debts: false }
 *   // sync.isFieldLocked('annualIncome') → true/false
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { subscribeToScenario, subscribeToLockEvents, createPresenceChannel } from '../lib/supabaseClient';
import { updateScenario } from '../api';

const DEBOUNCE_MS = 500;          // Write delay after last change
const MERGE_COOLDOWN_MS = 300;    // Ignore remote updates shortly after local write
const STALE_THRESHOLD_MS = 45000; // Presence timeout

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
  const lastWriteRef = useRef(0);
  const prevStateRef = useRef(null);
  const subscriptionsRef = useRef([]);
  const presenceRef = useRef(null);
  const scenarioIdRef = useRef(scenarioId);
  const getStateRef = useRef(getState);
  const loadStateRef = useRef(loadState);

  // Keep refs current
  useEffect(() => { scenarioIdRef.current = scenarioId; }, [scenarioId]);
  useEffect(() => { getStateRef.current = getState; }, [getState]);
  useEffect(() => { loadStateRef.current = loadState; }, [loadState]);

  // ── Subscribe to Realtime changes ─────────────────────────────────────
  useEffect(() => {
    if (!scenarioId || !enabled) return;

    // Scenario data changes
    const scenarioSub = subscribeToScenario(scenarioId, (newRow) => {
      // Skip if we just wrote (our own echo)
      if (Date.now() - lastWriteRef.current < MERGE_COOLDOWN_MS) return;

      // Apply remote state to local calculator
      if (newRow.state_data && loadStateRef.current) {
        loadStateRef.current(newRow.state_data);
      }
      if (newRow.locked_fields) {
        setLockedFields(newRow.locked_fields);
      }
    });

    // Lock events
    const lockSub = subscribeToLockEvents(scenarioId, (lockEvent) => {
      setLockedFields(prev => ({
        ...prev,
        [lockEvent.field_key]: lockEvent.action === 'locked',
      }));
    });

    subscriptionsRef.current = [scenarioSub, lockSub];

    return () => {
      subscriptionsRef.current.forEach(s => s.unsubscribe());
      subscriptionsRef.current = [];
    };
  }, [scenarioId, enabled]);

  // ── Presence channel ──────────────────────────────────────────────────
  useEffect(() => {
    if (!scenarioId || !enabled || !userInfo.email) return;

    const presence = createPresenceChannel(
      scenarioId,
      { email: userInfo.email, name: userInfo.name, avatarUrl: userInfo.avatarUrl, userType },
      (users) => {
        const now = new Date();
        setOnlineUsers(users.filter(u => {
          if (u.email === userInfo.email) return false;
          const onlineAt = new Date(u.online_at);
          return (now - onlineAt) < STALE_THRESHOLD_MS;
        }));
      }
    );

    presenceRef.current = presence;

    return () => {
      presence.unsubscribe();
      presenceRef.current = null;
    };
  }, [scenarioId, enabled, userInfo.email, userType]);

  // ── Debounced write to Supabase ───────────────────────────────────────
  const flush = useCallback(async () => {
    if (!scenarioIdRef.current || !getStateRef.current) return;

    const currentState = getStateRef.current();
    const previousState = prevStateRef.current;

    // Compute diff
    if (previousState) {
      const diffs = {};
      let hasChanges = false;
      for (const key of Object.keys(currentState)) {
        const oldVal = previousState[key];
        const newVal = currentState[key];
        if (oldVal === newVal) continue;
        if (typeof oldVal === 'object' && typeof newVal === 'object'
            && JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;
        diffs[key] = { old: oldVal, new: newVal };
        hasChanges = true;
      }
      if (!hasChanges) return; // Nothing changed
    }

    setStatus('saving');
    lastWriteRef.current = Date.now();

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

      if (shareToken) {
        // Borrower: use share-sync endpoint
        const API_BASE = import.meta.env.VITE_API_BASE || 'https://ops.realstack.app';
        await fetch(`${API_BASE}/api/collab?resource=sync`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: shareToken,
            scenario_id: scenarioIdRef.current,
            state_data: currentState,
            calc_summary: calcSummary,
            field_diffs: {},
            changed_by: 'borrower',
            changed_by_name: userInfo.name || '',
            changed_by_email: userInfo.email || '',
          }),
        });
      } else {
        // LO: use authenticated endpoint
        await updateScenario({
          id: scenarioIdRef.current,
          state_data: currentState,
          calc_summary: calcSummary,
        });
      }

      prevStateRef.current = { ...currentState };
      setLastSavedAt(new Date());
      setStatus('saved');
      setTimeout(() => setStatus(s => s === 'saved' ? 'idle' : s), 2000);
    } catch (e) {
      console.error('[useBlueprintSync] Save failed:', e);
      setStatus('error');
    }
  }, [shareToken, userInfo]);

  // ── Trigger sync (call this after any state change) ───────────────────
  const scheduleSync = useCallback(() => {
    if (!scenarioIdRef.current || !enabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(flush, DEBOUNCE_MS);
  }, [flush, enabled]);

  // ── Check if a field is locked ────────────────────────────────────────
  const isFieldLocked = useCallback((fieldName) => {
    if (userType === 'lo') return false; // LO can edit everything
    const section = FIELD_TO_SECTION[fieldName];
    return section ? !!lockedFields[section] : false;
  }, [lockedFields, userType]);

  // ── Initialize prevState when scenario loads ──────────────────────────
  const initSync = useCallback((initialState, initialLockedFields) => {
    prevStateRef.current = initialState ? { ...initialState } : null;
    if (initialLockedFields) setLockedFields(initialLockedFields);
  }, []);

  // ── Force flush on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        flush();
      }
      subscriptionsRef.current.forEach(s => s.unsubscribe());
      if (presenceRef.current) presenceRef.current.unsubscribe();
    };
  }, [flush]);

  return {
    // Status
    status,             // 'idle' | 'saving' | 'saved' | 'error'
    lastSavedAt,

    // Presence
    onlineUsers,        // Array of other users viewing this scenario

    // Locking
    lockedFields,       // { incomes: true, debts: false, ... }
    isFieldLocked,      // (fieldName) => boolean

    // Actions
    scheduleSync,       // Call after any state change to trigger debounced write
    initSync,           // Call when a scenario is loaded to set baseline state
    flush,              // Force immediate write (e.g., before navigation)
  };
}
