/**
 * useVersionHistory — Version history and undo/revert for Blueprint scenarios.
 *
 * Tracks all changes made to a scenario, supports undo/redo,
 * and allows creating named bookmarks for important versions.
 *
 * Usage:
 *   const { history, undo, revertTo, createBookmark } =
 *     useVersionHistory({ scenarioId, shareToken });
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { subscribeToVersionHistory } from '../lib/supabaseClient';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://ops.realstack.app';

export default function useVersionHistory({
  scenarioId,
  shareToken = null,
  userType = 'lo',
  enabled = true,
  maxHistory = 100,            // Max entries to keep in memory
  onRevert = null,             // Callback when a revert is applied
}) {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const subscriptionRef = useRef(null);

  // ── Load version history from API ─────────────────────────────────────
  useEffect(() => {
    if (!scenarioId || !enabled) return;

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const token = localStorage.getItem('bp_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(
          `${API_BASE}/api/scenario-changes?scenario_id=${scenarioId}&limit=${maxHistory}`,
          { headers }
        );

        if (!res.ok) throw new Error('Could not load history');
        const data = await res.json();

        if (!cancelled) {
          setHistory(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [scenarioId, enabled, maxHistory]);

  // ── Subscribe to new versions in real-time ────────────────────────────
  useEffect(() => {
    if (!scenarioId || !enabled) return;

    const sub = subscribeToVersionHistory(scenarioId, (newChange) => {
      setHistory(prev => {
        const updated = [newChange, ...prev];
        return updated.slice(0, maxHistory); // Keep within limit
      });
    });

    subscriptionRef.current = sub;
    return () => sub.unsubscribe();
  }, [scenarioId, enabled, maxHistory]);

  // ── Undo: revert the most recent change ───────────────────────────────
  const undo = useCallback(async () => {
    if (history.length === 0) return null;

    const lastChange = history[0];
    if (!lastChange?.field_diffs) return null;

    // Build the "undo" state: apply old values from the diff
    const revertFields = {};
    for (const [key, diff] of Object.entries(lastChange.field_diffs)) {
      revertFields[key] = diff.old;
    }

    // Apply via the revert callback (parent component handles the state update)
    if (onRevert) {
      onRevert(revertFields, lastChange);
    }

    return revertFields;
  }, [history, onRevert]);

  // ── Revert to a specific version by ID ────────────────────────────────
  const revertTo = useCallback(async (changeId) => {
    const targetIdx = history.findIndex(h => h.id === changeId);
    if (targetIdx === -1) return null;

    // If this version has a state snapshot, use that directly
    const target = history[targetIdx];
    if (target.state_snapshot) {
      if (onRevert) {
        onRevert(target.state_snapshot, target);
      }
      return target.state_snapshot;
    }

    // Otherwise, we need to reconstruct by rolling back all changes
    // from most recent to the target (exclusive)
    const changesToUndo = history.slice(0, targetIdx);
    const revertFields = {};

    for (const change of changesToUndo) {
      if (change.field_diffs) {
        for (const [key, diff] of Object.entries(change.field_diffs)) {
          // Use the old value from the oldest change we're reverting
          revertFields[key] = diff.old;
        }
      }
    }

    if (onRevert) {
      onRevert(revertFields, target);
    }

    return revertFields;
  }, [history, onRevert]);

  // ── Create a named bookmark at the current version ────────────────────
  const createBookmark = useCallback(async (label, stateSnapshot = null) => {
    try {
      const token = localStorage.getItem('bp_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/scenario-changes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          scenario_id: scenarioId,
          changed_by: userType,
          changed_by_name: '',
          changed_by_email: '',
          field_diffs: {},
          state_snapshot: stateSnapshot,
          version_label: label,
          is_bookmark: true,
        }),
      });

      if (!res.ok) throw new Error('Could not create bookmark');
      const data = await res.json();

      // Add to local history
      setHistory(prev => [data, ...prev]);
      return data;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, [scenarioId, userType]);

  // ── Get only bookmarked versions ──────────────────────────────────────
  const bookmarks = history.filter(h => h.is_bookmark);

  // ── Get human-readable summary of a change ────────────────────────────
  const getChangeSummary = useCallback((change) => {
    if (!change?.field_diffs) return 'No changes';
    const fields = Object.keys(change.field_diffs);
    if (fields.length === 0) return change.version_label || 'Bookmark';
    if (fields.length === 1) return `Changed ${humanizeField(fields[0])}`;
    if (fields.length <= 3) return `Changed ${fields.map(humanizeField).join(', ')}`;
    return `Changed ${fields.length} fields`;
  }, []);

  return {
    history,            // Array of change records (newest first)
    bookmarks,          // Only bookmarked versions
    isLoading,
    error,

    // Actions
    undo,               // Revert the most recent change
    revertTo,           // Revert to a specific version
    createBookmark,     // Save a named snapshot
    getChangeSummary,   // Human-readable summary of a change
  };
}

// ── Humanize field names for display ──────────────────────────────────────

const FIELD_LABELS = {
  salesPrice: 'Purchase Price',
  purchasePrice: 'Purchase Price',
  downPayment: 'Down Payment',
  downPct: 'Down Payment %',
  interestRate: 'Interest Rate',
  rate: 'Interest Rate',
  loanTerm: 'Loan Term',
  term: 'Loan Term',
  creditScore: 'Credit Score',
  ficoScore: 'Credit Score',
  loanType: 'Loan Type',
  annualIncome: 'Annual Income',
  monthlyIncome: 'Monthly Income',
  hoa: 'HOA',
  annualIns: 'Insurance',
  propTax: 'Property Tax',
  city: 'City',
  propertyState: 'State',
  propType: 'Property Type',
};

function humanizeField(key) {
  return FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}
