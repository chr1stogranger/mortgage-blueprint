/**
 * Browser-side Supabase client for Realtime subscriptions.
 *
 * Uses the ANON key (safe to expose in client code) — all security
 * is enforced by Row Level Security policies in the database.
 *
 * This client is used for:
 *   - Realtime subscriptions (postgres_changes on scenarios)
 *   - Presence channels (who's viewing a blueprint)
 *   - Broadcast channels (field-level editing hints)
 *
 * Heavy operations (CRUD, auth) still go through the Ops API routes
 * at ops.realstack.app, which use the SERVICE key server-side.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ── Device identity header ──
// Same localStorage key PricePoint's getDeviceId() uses (pricePointDB.js).
// Implemented inline here (not imported) to avoid a circular import —
// pricePointDB.js imports getSupabaseClient from this file.
//
// Why: the tightened RLS policies (migrations/011) bind pp_guesses /
// pp_predictions / pp_players writes to the device that owns the player row,
// read server-side via current_setting('request.headers')->>'x-device-id'.
// Sending the header is harmless under the old permissive policies, so this
// ships safely BEFORE the migration runs.
const DEVICE_ID_KEY = 'pp-device-id';
function readDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'unknown-device';
  }
}

// Singleton — one client per app lifetime
let client = null;

export function getSupabaseClient() {
  if (client) return client;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — realtime disabled');
    return null;
  }

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { 'x-device-id': readDeviceId() },
    },
    realtime: {
      params: {
        eventsPerSecond: 10,  // Rate limit to prevent flooding
      },
    },
    // We don't use Supabase Auth for LO (Google JWT handled separately)
    // Borrowers authenticate with native Supabase Auth (magic link + Google)
    auth: {
      // TEMP DIAGNOSTIC: verbose GoTrue logging to trace why the URL token
      // isn't being consumed. Remove once the sign-in loop is fixed.
      debug: true,
      autoRefreshToken: true,
      persistSession: true,
      storageKey: 'bp_supabase_auth',
      detectSessionInUrl: true,   // handles the magic-link / OAuth redirect
      // Implicit flow (token in URL hash) rather than PKCE: borrowers routinely
      // request a magic link on one device and open it on another. PKCE needs
      // the code_verifier stored on the SAME device that started sign-in, so a
      // cross-device click fails the exchange and bounces them back to login.
      // Implicit carries the session in the link itself, so any device completes
      // it. Google OAuth (same-device redirect) works under either flow.
      flowType: 'implicit',
    },
  });

  // ── Authenticate the Realtime socket with the signed-in user's JWT ──
  // Realtime postgres_changes are RLS-filtered by the socket's token. Since we
  // locked down the anon role (loan-pipeline migration 011), an unauthenticated
  // socket sees nothing. Push the user's access token to Realtime on every auth
  // change (INITIAL_SESSION fires on load) so authenticated borrowers receive
  // live updates for their own scenarios.
  try {
    client.auth.onAuthStateChange((_event, session) => {
      try { client.realtime.setAuth(session?.access_token ?? null); } catch { /* noop */ }
    });
  } catch { /* noop */ }

  // TEMP DIAGNOSTIC: expose the client for live inspection in the console.
  try { if (typeof window !== 'undefined') window.__sb = client; } catch { /* noop */ }

  return client;
}

// ─────────────────────────────────────────────────────────────────────────────
// BORROWER AUTH (native Supabase Auth)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a magic sign-in link. `next` params (like a share token) survive the
 * round-trip via emailRedirectTo.
 */
export async function signInWithMagicLink(email, { shareToken = null, name = '' } = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Sync is not configured');

  const redirectTo = new URL(window.location.origin);
  if (shareToken) redirectTo.searchParams.set('share', shareToken);

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: redirectTo.toString(),
      data: name ? { full_name: name } : undefined,
    },
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

/**
 * Google OAuth sign-in (full redirect flow — works in PWA and Capacitor
 * via the configured redirect URLs).
 */
export async function signInWithGoogle({ shareToken = null } = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Sync is not configured');

  const redirectTo = new URL(window.location.origin);
  if (shareToken) redirectTo.searchParams.set('share', shareToken);

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectTo.toString() },
  });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getSession() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

export function onAuthStateChange(callback) {
  const supabase = getSupabaseClient();
  if (!supabase) return { unsubscribe: () => {} };
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return { unsubscribe: () => data?.subscription?.unsubscribe() };
}

/**
 * Fetch the borrower_accounts row for the signed-in user (RLS-scoped).
 * Returns null when signed out or when the account row hasn't provisioned yet.
 */
export async function fetchMyAccount() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) return null;
  const { data, error } = await supabase
    .from('borrower_accounts')
    .select('id, email, name, avatar_url, borrower_id, sync_enabled, consent_at, notification_prefs')
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[Supabase] fetchMyAccount failed:', error.message);
    return null;
  }
  return data;
}

/**
 * Subscribe to changes on a specific scenario row.
 * Returns a channel that can be unsubscribed from.
 *
 * @param {string} scenarioId - UUID of the scenario to watch
 * @param {function} onUpdate - callback when scenario data changes
 * @returns {{ channel: object, unsubscribe: function }}
 */
export function subscribeToScenario(scenarioId, onUpdate) {
  const supabase = getSupabaseClient();
  if (!supabase) return { channel: null, unsubscribe: () => {} };

  const channelName = `scenario:${scenarioId}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'scenarios',
        filter: `id=eq.${scenarioId}`,
      },
      (payload) => {
        onUpdate(payload.new, payload.old);
      }
    )
    .subscribe();

  return {
    channel,
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}

/**
 * Subscribe to field lock events on a scenario.
 */
export function subscribeToLockEvents(scenarioId, onLockChange) {
  const supabase = getSupabaseClient();
  if (!supabase) return { channel: null, unsubscribe: () => {} };

  const channelName = `locks:${scenarioId}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'field_lock_events',
        filter: `scenario_id=eq.${scenarioId}`,
      },
      (payload) => {
        onLockChange(payload.new);
      }
    )
    .subscribe();

  return {
    channel,
    unsubscribe: () => supabase.removeChannel(channel),
  };
}

/**
 * Subscribe to version history changes (new entries in scenario_changes).
 */
export function subscribeToVersionHistory(scenarioId, onNewVersion) {
  const supabase = getSupabaseClient();
  if (!supabase) return { channel: null, unsubscribe: () => {} };

  const channelName = `versions:${scenarioId}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'scenario_changes',
        filter: `scenario_id=eq.${scenarioId}`,
      },
      (payload) => {
        onNewVersion(payload.new);
      }
    )
    .subscribe();

  return {
    channel,
    unsubscribe: () => supabase.removeChannel(channel),
  };
}

/**
 * Create a Presence channel for a specific scenario.
 * Tracks who is currently viewing/editing.
 *
 * @param {string} scenarioId
 * @param {object} userInfo - { email, name, avatarUrl, userType: 'lo' | 'borrower' }
 * @param {function} onPresenceChange - called with array of present users
 * @returns {{ channel, track, updateField, unsubscribe }}
 */
export function createPresenceChannel(scenarioId, userInfo, onPresenceChange) {
  const supabase = getSupabaseClient();
  if (!supabase) return { channel: null, track: () => {}, updateField: () => {}, unsubscribe: () => {} };

  const channelName = `presence:scenario:${scenarioId}`;
  const channel = supabase.channel(channelName, {
    config: { presence: { key: userInfo.email || 'anonymous' } },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users = [];
      for (const [key, presences] of Object.entries(state)) {
        if (presences.length > 0) {
          users.push(presences[0]); // Latest presence for each user
        }
      }
      onPresenceChange(users);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          email: userInfo.email,
          name: userInfo.name,
          avatar_url: userInfo.avatarUrl,
          user_type: userInfo.userType,
          active_field: null,
          cursor_section: null,
          online_at: new Date().toISOString(),
        });
      }
    });

  return {
    channel,
    // Update which field the user is currently editing
    track: async (fieldData) => {
      await channel.track({
        email: userInfo.email,
        name: userInfo.name,
        avatar_url: userInfo.avatarUrl,
        user_type: userInfo.userType,
        ...fieldData,
        online_at: new Date().toISOString(),
      });
    },
    updateField: async (fieldName, section) => {
      await channel.track({
        email: userInfo.email,
        name: userInfo.name,
        avatar_url: userInfo.avatarUrl,
        user_type: userInfo.userType,
        active_field: fieldName,
        cursor_section: section,
        online_at: new Date().toISOString(),
      });
    },
    unsubscribe: () => {
      channel.untrack();
      supabase.removeChannel(channel);
    },
  };
}

/**
 * Broadcast channel for ephemeral messages (typing indicators, etc.)
 * These are NOT persisted — fire and forget.
 */
export function createBroadcastChannel(scenarioId, onMessage) {
  const supabase = getSupabaseClient();
  if (!supabase) return { channel: null, send: () => {}, unsubscribe: () => {} };

  const channelName = `broadcast:scenario:${scenarioId}`;
  const channel = supabase
    .channel(channelName)
    .on('broadcast', { event: 'field_focus' }, (payload) => {
      onMessage(payload);
    })
    .on('broadcast', { event: 'field_blur' }, (payload) => {
      onMessage(payload);
    })
    .subscribe();

  return {
    channel,
    send: async (event, data) => {
      await channel.send({ type: 'broadcast', event, payload: data });
    },
    unsubscribe: () => supabase.removeChannel(channel),
  };
}
