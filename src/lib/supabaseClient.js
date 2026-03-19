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

// Singleton — one client per app lifetime
let client = null;

export function getSupabaseClient() {
  if (client) return client;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — realtime disabled');
    return null;
  }

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: {
      params: {
        eventsPerSecond: 10,  // Rate limit to prevent flooding
      },
    },
    // We don't use Supabase Auth for LO (Google JWT handled separately)
    // But we will use it for borrower magic links (Phase 5)
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      storageKey: 'bp_supabase_auth',
    },
  });

  return client;
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
