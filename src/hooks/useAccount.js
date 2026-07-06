/**
 * useAccount — borrower account state for the public calculator.
 *
 * Wraps Supabase Auth session + the user's borrower_accounts row and exposes:
 *   - session / account / loading
 *   - syncEnabled (opt-in, default OFF — local-first is the product default)
 *   - signOut / setSyncEnabled / refreshAccount / deleteAccount
 *
 * Anonymous users: session === null, everything works exactly as before.
 * This hook NEVER blocks the calculator — auth is always optional.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getSession,
  onAuthStateChange,
  signOut as sbSignOut,
  fetchMyAccount,
  getSupabaseClient,
} from '../lib/supabaseClient';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://ops.realstack.app';
const SYNC_PREF_KEY = 'bp_sync_enabled';

export default function useAccount() {
  const [session, setSession] = useState(null);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncEnabled, setSyncEnabledState] = useState(() => {
    try { return localStorage.getItem(SYNC_PREF_KEY) === '1'; } catch { return false; }
  });
  const mountedRef = useRef(true);

  const loadAccount = useCallback(async () => {
    try {
      const acct = await fetchMyAccount();
      if (!mountedRef.current) return;
      setAccount(acct);
      if (acct) {
        const enabled = !!acct.sync_enabled;
        setSyncEnabledState(enabled);
        try { localStorage.setItem(SYNC_PREF_KEY, enabled ? '1' : '0'); } catch { /* noop */ }
      }
    } catch {
      if (mountedRef.current) setAccount(null);
    }
  }, []);

  // ── Initial session + auth state subscription ─────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    let sub = { unsubscribe: () => {} };

    (async () => {
      const s = await getSession();
      if (!mountedRef.current) return;
      setSession(s);
      if (s) await loadAccount();
      setLoading(false);

      sub = onAuthStateChange(async (newSession) => {
        if (!mountedRef.current) return;
        setSession(newSession);
        if (newSession) {
          await loadAccount();
        } else {
          setAccount(null);
        }
      });
    })();

    return () => {
      mountedRef.current = false;
      sub.unsubscribe();
    };
  }, [loadAccount]);

  // ── Actions ────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await sbSignOut();
    setSession(null);
    setAccount(null);
    // Sync preference is account-level; local mirror off when signed out
    try { localStorage.setItem(SYNC_PREF_KEY, '0'); } catch { /* noop */ }
    setSyncEnabledState(false);
  }, []);

  const setSyncEnabled = useCallback(async (enabled) => {
    setSyncEnabledState(enabled);
    try { localStorage.setItem(SYNC_PREF_KEY, enabled ? '1' : '0'); } catch { /* noop */ }
    if (!session) return;
    // Persist server-side (RLS lets the user update their own row)
    try {
      const supabase = getSupabaseClient();
      if (supabase && account) {
        await supabase
          .from('borrower_accounts')
          .update({ sync_enabled: enabled })
          .eq('id', account.id);
      }
    } catch (e) {
      console.warn('[useAccount] sync pref save failed:', e.message);
    }
  }, [session, account]);

  const recordConsent = useCallback(async () => {
    if (!session) return;
    try {
      await fetch(`${API_BASE}/api/collab?resource=account&action=consent`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
    } catch { /* non-blocking */ }
  }, [session]);

  const claimShare = useCallback(async (shareToken) => {
    if (!session) throw new Error('Sign in first');
    const res = await fetch(`${API_BASE}/api/collab?resource=account&action=claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ share_token: shareToken }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Could not claim blueprint');
    }
    return res.json();
  }, [session]);

  // "Get Pre-Approved" intent: surface this homebuyer in the LO's Ops
  // Pipeline Leads (creates/links a blueprint-crm borrowers row server-side
  // and copies their latest scenario). Fire-and-forget — never blocks the
  // click-through to the 1003 application.
  const requestPreapproval = useCallback(async () => {
    if (!session) return null;
    try {
      const res = await fetch(`${API_BASE}/api/collab?resource=account&action=request-preapproval`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }, [session]);

  const deleteAccount = useCallback(async () => {
    if (!session) throw new Error('Not signed in');
    const res = await fetch(`${API_BASE}/api/collab?resource=account&action=delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Account deletion failed');
    }
    await signOut();
    return true;
  }, [session, signOut]);

  return {
    session,          // Supabase session | null
    account,          // borrower_accounts row | null
    loading,          // true until initial session check completes
    isSignedIn: !!session,
    syncEnabled: !!session && syncEnabled,
    setSyncEnabled,
    signOut,
    refreshAccount: loadAccount,
    recordConsent,
    claimShare,
    requestPreapproval,
    deleteAccount,
  };
}
