/**
 * useSyncedScenario — The core real-time collaboration hook.
 *
 * This hook replaces local useState for scenario data with a synced version
 * that writes to Supabase and subscribes to live changes from other users.
 *
 * Flow:
 *   1. Load scenario from Supabase (via Ops API)
 *   2. Subscribe to Realtime changes on that scenario row
 *   3. User edits → optimistic local update → debounced write to DB
 *   4. Other user's changes arrive via Realtime → merge into local state
 *   5. Field locking prevents borrowers from editing LO-verified fields
 *
 * Usage:
 *   const { state, setField, setFields, lockedFields, isRemoteUpdate, isSaving } =
 *     useSyncedScenario({ scenarioId, shareToken, userType, userInfo });
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { subscribeToScenario, subscribeToLockEvents } from '../lib/supabaseClient';
import { updateScenario, fetchScenario } from '../api';

// ─── Constants ──────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 400;          // Write delay after last keystroke
const MERGE_COOLDOWN_MS = 200;    // Ignore remote updates within this window after local write
const MAX_BATCH_FIELDS = 50;      // Safety: max fields in a single write

// Fields that can be locked by the LO
export const LOCKABLE_SECTIONS = {
  incomes: {
    label: 'Income',
    fields: ['annualIncome', 'monthlyIncome', 'incomes', 'incomeSource', 'incomeFrequency'],
    description: 'Verified income from documents',
  },
  debts: {
    label: 'Debts & Liabilities',
    fields: ['debts', 'monthlyDebts', 'carPayment', 'studentLoans', 'creditCards', 'otherDebt'],
    description: 'Verified debts from credit report',
  },
  creditScore: {
    label: 'Credit Score',
    fields: ['creditScore', 'ficoScore'],
    description: 'Verified FICO from credit pull',
  },
  assets: {
    label: 'Assets',
    fields: ['assets', 'totalAssets', 'bankBalance', 'retirementFunds', 'giftFunds'],
    description: 'Verified assets from bank statements',
  },
  employmentInfo: {
    label: 'Employment',
    fields: ['employer', 'employerName', 'yearsAtJob', 'employmentType', 'jobTitle'],
    description: 'Verified employment details',
  },
};

// Build a flat lookup: field name → section key
const FIELD_TO_SECTION = {};
for (const [sectionKey, section] of Object.entries(LOCKABLE_SECTIONS)) {
  for (const field of section.fields) {
    FIELD_TO_SECTION[field] = sectionKey;
  }
}

// ─── Utility: compute diff between two state objects ────────────────────────

function computeDiff(oldState, newState) {
  const diff = {};
  const allKeys = new Set([...Object.keys(oldState || {}), ...Object.keys(newState || {})]);

  for (const key of allKeys) {
    const oldVal = oldState?.[key];
    const newVal = newState?.[key];

    // Skip unchanged values (handle objects/arrays via JSON comparison)
    if (oldVal === newVal) continue;
    if (typeof oldVal === 'object' && typeof newVal === 'object'
        && JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;

    diff[key] = { old: oldVal, new: newVal };
  }

  return Object.keys(diff).length > 0 ? diff : null;
}

// ─── The Hook ───────────────────────────────────────────────────────────────

export default function useSyncedScenario({
  scenarioId,
  shareToken = null,
  userType = 'lo',            // 'lo' | 'borrower'
  userInfo = {},              // { email, name }
  onRemoteUpdate = null,      // callback when remote changes arrive
  onVersionCreated = null,    // callback when a version is saved
  enabled = true,             // set false to disable sync (local-only mode)
}) {
  // ── State ─────────────────────────────────────────────────────────────
  const [state, setState] = useState({});
  const [lockedFields, setLockedFields] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRemoteUpdate, setIsRemoteUpdate] = useState(false);
  const [error, setError] = useState(null);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [conflicts, setConflicts] = useState([]); // fields with simultaneous edit conflicts

  // ── Refs for debouncing and tracking ──────────────────────────────────
  const debounceTimer = useRef(null);
  const pendingChanges = useRef({});
  const lastWriteTimestamp = useRef(0);
  const stateRef = useRef(state);
  const previousStateRef = useRef(null);    // For diff computation
  const subscriptionsRef = useRef([]);
  const scenarioIdRef = useRef(scenarioId);

  // Keep stateRef in sync
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { scenarioIdRef.current = scenarioId; }, [scenarioId]);

  // ── Load initial scenario data ────────────────────────────────────────
  useEffect(() => {
    if (!scenarioId || !enabled) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        let scenarioData;

        if (shareToken) {
          // Borrower: fetch via public share endpoint
          const API_BASE = import.meta.env.VITE_API_BASE || 'https://ops.realstack.app';
          const res = await fetch(`${API_BASE}/api/share?token=${shareToken}`);
          if (!res.ok) throw new Error('Share link not found');
          const data = await res.json();
          // Find the matching scenario
          scenarioData = data.scenarios?.find(s => s.id === scenarioId);
          if (!scenarioData) {
            // If no specific scenario, use the first one
            scenarioData = data.scenarios?.[0];
          }
        } else {
          // LO: fetch via authenticated endpoint
          scenarioData = await fetchScenario(scenarioId);
        }

        if (cancelled) return;

        if (scenarioData) {
          const stateData = scenarioData.state_data || {};
          setState(stateData);
          previousStateRef.current = { ...stateData };
          setLockedFields(scenarioData.locked_fields || {});
          setCurrentVersion(scenarioData.current_version || 1);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [scenarioId, shareToken, enabled]);

  // ── Subscribe to Realtime changes ─────────────────────────────────────
  useEffect(() => {
    if (!scenarioId || !enabled) return;

    // Subscribe to scenario data changes
    const scenarioSub = subscribeToScenario(scenarioId, (newRow, oldRow) => {
      // Ignore changes we just wrote (within cooldown window)
      if (Date.now() - lastWriteTimestamp.current < MERGE_COOLDOWN_MS) {
        return;
      }

      // Merge remote state_data into local state
      if (newRow.state_data) {
        setIsRemoteUpdate(true);
        setState(prev => {
          // Merge strategy: remote wins for fields not in pendingChanges
          const merged = { ...prev };
          const conflictedFields = [];
          for (const [key, value] of Object.entries(newRow.state_data)) {
            if (key in pendingChanges.current) {
              // Conflict: both local and remote changed the same field
              // Keep local value but track the conflict
              if (pendingChanges.current[key] !== value) {
                conflictedFields.push(key);
              }
            } else {
              merged[key] = value;
            }
          }
          // Notify about conflicts (non-blocking — local changes preserved)
          if (conflictedFields.length > 0) {
            console.warn(`[Sync] Conflict on fields: ${conflictedFields.join(', ')} — local changes preserved`);
            setConflicts(conflictedFields);
            // Auto-clear conflict indicator after 5 seconds
            setTimeout(() => setConflicts([]), 5000);
          }
          return merged;
        });

        // Update locked fields if they changed
        if (newRow.locked_fields) {
          setLockedFields(newRow.locked_fields);
        }

        // Update version
        if (newRow.current_version) {
          setCurrentVersion(newRow.current_version);
        }

        // Notify parent component
        if (onRemoteUpdate) {
          onRemoteUpdate(newRow.state_data, oldRow?.state_data);
        }

        // Clear remote update flag after a tick (for UI flash)
        setTimeout(() => setIsRemoteUpdate(false), 150);
      }
    });

    // Subscribe to lock events
    const lockSub = subscribeToLockEvents(scenarioId, (lockEvent) => {
      setLockedFields(prev => ({
        ...prev,
        [lockEvent.field_key]: lockEvent.action === 'locked',
      }));
    });

    subscriptionsRef.current = [scenarioSub, lockSub];

    return () => {
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
      subscriptionsRef.current = [];
    };
  }, [scenarioId, enabled, onRemoteUpdate]);

  // ── Debounced write to database ───────────────────────────────────────
  const flushChanges = useCallback(async () => {
    const changes = { ...pendingChanges.current };
    pendingChanges.current = {};

    if (Object.keys(changes).length === 0 || !scenarioIdRef.current) return;

    setIsSaving(true);
    lastWriteTimestamp.current = Date.now();

    try {
      const currentState = stateRef.current;
      const previousState = previousStateRef.current || {};

      // Compute diff for version history
      const fieldDiffs = {};
      for (const key of Object.keys(changes)) {
        fieldDiffs[key] = {
          old: previousState[key],
          new: currentState[key],
        };
      }

      // Build calc_summary from current state (lightweight metrics)
      const calcSummary = buildCalcSummary(currentState);

      // Write to Supabase via Ops API
      if (shareToken) {
        // Borrower: use share endpoint for updates
        const API_BASE = import.meta.env.VITE_API_BASE || 'https://ops.realstack.app';
        await fetch(`${API_BASE}/api/collab?resource=sync`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: shareToken,
            scenario_id: scenarioIdRef.current,
            state_data: currentState,
            calc_summary: calcSummary,
            field_diffs: fieldDiffs,
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

        // Record version history separately
        const API_BASE = import.meta.env.VITE_API_BASE || 'https://ops.realstack.app';
        const token = localStorage.getItem('bp_token');
        if (token) {
          fetch(`${API_BASE}/api/collab?resource=changes`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              scenario_id: scenarioIdRef.current,
              changed_by: 'lo',
              changed_by_email: userInfo.email || '',
              changed_by_name: userInfo.name || '',
              field_diffs: fieldDiffs,
            }),
          }).catch(() => {}); // Non-blocking
        }
      }

      previousStateRef.current = { ...currentState };
      setLastSavedAt(new Date());

      if (onVersionCreated) {
        onVersionCreated({ fieldDiffs, version: currentVersion });
      }
    } catch (e) {
      console.error('[useSyncedScenario] Save failed:', e);
      setError('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }, [shareToken, userType, userInfo, currentVersion, onVersionCreated]);

  // ── setField: update a single field with debounced sync ───────────────
  const setField = useCallback((fieldName, value) => {
    // Check if field is locked (borrower only)
    if (userType === 'borrower') {
      const section = FIELD_TO_SECTION[fieldName];
      if (section && lockedFields[section]) {
        console.warn(`[useSyncedScenario] Field "${fieldName}" is locked (section: ${section})`);
        return false; // Signal that the edit was rejected
      }
    }

    // Optimistic local update
    setState(prev => ({ ...prev, [fieldName]: value }));

    // Track pending change
    pendingChanges.current[fieldName] = true;

    // Debounce the write
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(flushChanges, DEBOUNCE_MS);

    return true; // Edit accepted
  }, [userType, lockedFields, flushChanges]);

  // ── setFields: update multiple fields at once ─────────────────────────
  const setFields = useCallback((fieldMap) => {
    if (Object.keys(fieldMap).length > MAX_BATCH_FIELDS) {
      console.warn('[useSyncedScenario] Too many fields in batch update');
      return false;
    }

    // Check locks for borrower
    if (userType === 'borrower') {
      for (const fieldName of Object.keys(fieldMap)) {
        const section = FIELD_TO_SECTION[fieldName];
        if (section && lockedFields[section]) {
          console.warn(`[useSyncedScenario] Field "${fieldName}" is locked`);
          return false;
        }
      }
    }

    // Optimistic local update
    setState(prev => ({ ...prev, ...fieldMap }));

    // Track all pending changes
    for (const key of Object.keys(fieldMap)) {
      pendingChanges.current[key] = true;
    }

    // Debounce the write
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(flushChanges, DEBOUNCE_MS);

    return true;
  }, [userType, lockedFields, flushChanges]);

  // ── Force flush (e.g., before navigation) ─────────────────────────────
  const forceFlush = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    return flushChanges();
  }, [flushChanges]);

  // ── isFieldLocked: check if a specific field is locked ────────────────
  const isFieldLocked = useCallback((fieldName) => {
    const section = FIELD_TO_SECTION[fieldName];
    return section ? !!lockedFields[section] : false;
  }, [lockedFields]);

  // ── getSectionLockStatus: get lock state for a whole section ──────────
  const getSectionLockStatus = useCallback((sectionKey) => {
    return !!lockedFields[sectionKey];
  }, [lockedFields]);

  // ── Cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        // Flush any pending changes before unmount
        flushChanges();
      }
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
    };
  }, [flushChanges]);

  return {
    // State
    state,
    setState,               // Direct setState (for loading initial state)
    lockedFields,
    currentVersion,
    lastSavedAt,

    // Status
    isLoading,
    isSaving,
    isRemoteUpdate,
    conflicts,        // Array of field names with simultaneous edit conflicts (auto-clears after 5s)
    error,

    // Actions
    setField,               // Update single field (debounced sync)
    setFields,              // Update multiple fields (debounced sync)
    forceFlush,             // Force immediate write

    // Lock helpers
    isFieldLocked,
    getSectionLockStatus,
    LOCKABLE_SECTIONS,
  };
}


// ─── Build a calc_summary from state (for Pipeline display) ─────────────────

function buildCalcSummary(state) {
  const salesPrice = Number(state.salesPrice) || Number(state.purchasePrice) || 0;
  const downPayment = Number(state.downPayment) || 0;
  const downPct = Number(state.downPct) || (salesPrice > 0 ? (downPayment / salesPrice) * 100 : 0);
  const loanAmount = salesPrice - downPayment;
  const rate = Number(state.interestRate) || Number(state.rate) || 0;
  const term = Number(state.loanTerm) || Number(state.term) || 30;
  const creditScore = Number(state.creditScore) || Number(state.ficoScore) || 0;

  // Monthly P&I calculation
  const monthlyRate = rate / 100 / 12;
  const numPayments = term * 12;
  let monthlyPI = 0;
  if (monthlyRate > 0 && numPayments > 0 && loanAmount > 0) {
    monthlyPI = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))
      / (Math.pow(1 + monthlyRate, numPayments) - 1);
  }

  return {
    salesPrice,
    loanAmount,
    downPayment,
    downPct: Math.round(downPct * 10) / 10,
    ltv: salesPrice > 0 ? Math.round((loanAmount / salesPrice) * 1000) / 10 : 0,
    rate,
    term,
    creditScore,
    monthlyPI: Math.round(monthlyPI),
    loanType: state.loanType || state.mortgageType || 'Conventional',
  };
}
