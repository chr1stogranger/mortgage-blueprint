/**
 * usePresence — Real-time presence tracking for a Blueprint scenario.
 *
 * Shows who is currently viewing or editing the same scenario.
 * Uses Supabase Presence (in-memory, no database writes for heartbeats).
 *
 * Features:
 *   - See who else is online (avatar, name, role)
 *   - See which field another user is editing
 *   - Broadcast focus/blur events for field-level indicators
 *
 * Usage:
 *   const { onlineUsers, updateMyField, clearMyField } =
 *     usePresence({ scenarioId, userInfo });
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPresenceChannel, createBroadcastChannel } from '../lib/supabaseClient';

// How long before a user is considered "gone" (no heartbeat)
const STALE_THRESHOLD_MS = 45_000;

export default function usePresence({
  scenarioId,
  userInfo = {},     // { email, name, avatarUrl, userType: 'lo' | 'borrower' }
  enabled = true,
}) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [fieldFocus, setFieldFocus] = useState({});  // { email: 'salesPrice' }
  const presenceRef = useRef(null);
  const broadcastRef = useRef(null);

  // ── Set up presence channel ───────────────────────────────────────────
  useEffect(() => {
    if (!scenarioId || !enabled || !userInfo.email) return;

    const presence = createPresenceChannel(
      scenarioId,
      userInfo,
      (users) => {
        // Filter out stale users and self
        const now = new Date();
        const active = users.filter(u => {
          if (u.email === userInfo.email) return false; // Don't show self
          const onlineAt = new Date(u.online_at);
          return (now - onlineAt) < STALE_THRESHOLD_MS;
        });
        setOnlineUsers(active);
      }
    );

    presenceRef.current = presence;

    // Broadcast channel for field focus events
    const broadcast = createBroadcastChannel(scenarioId, (payload) => {
      if (payload.event === 'field_focus') {
        setFieldFocus(prev => ({
          ...prev,
          [payload.payload.email]: payload.payload.field,
        }));
      } else if (payload.event === 'field_blur') {
        setFieldFocus(prev => {
          const next = { ...prev };
          delete next[payload.payload.email];
          return next;
        });
      }
    });

    broadcastRef.current = broadcast;

    return () => {
      presence.unsubscribe();
      broadcast.unsubscribe();
      presenceRef.current = null;
      broadcastRef.current = null;
    };
  }, [scenarioId, enabled, userInfo.email]);

  // ── Update which field I'm currently editing ──────────────────────────
  const updateMyField = useCallback((fieldName, section) => {
    if (presenceRef.current) {
      presenceRef.current.updateField(fieldName, section);
    }
    if (broadcastRef.current) {
      broadcastRef.current.send('field_focus', {
        email: userInfo.email,
        name: userInfo.name,
        field: fieldName,
        section,
      });
    }
  }, [userInfo]);

  // ── Clear my field focus (I stopped editing) ──────────────────────────
  const clearMyField = useCallback(() => {
    if (presenceRef.current) {
      presenceRef.current.updateField(null, null);
    }
    if (broadcastRef.current) {
      broadcastRef.current.send('field_blur', {
        email: userInfo.email,
      });
    }
  }, [userInfo]);

  // ── Get who is editing a specific field ───────────────────────────────
  const getFieldEditor = useCallback((fieldName) => {
    for (const [email, field] of Object.entries(fieldFocus)) {
      if (field === fieldName) {
        const user = onlineUsers.find(u => u.email === email);
        return user || { email, name: email.split('@')[0] };
      }
    }
    return null;
  }, [fieldFocus, onlineUsers]);

  return {
    onlineUsers,       // Array of { email, name, avatar_url, user_type, active_field }
    fieldFocus,        // Map of email → field currently being edited
    updateMyField,     // Call when user focuses a field
    clearMyField,      // Call when user blurs a field
    getFieldEditor,    // Check if someone else is editing a specific field
  };
}
