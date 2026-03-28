-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 010: PricePoint — Notifications System
--
-- PURPOSE: Multi-channel notification infrastructure for PricePoint players.
--          Support for push notifications, email digests, and SMS.
--          Device token management. Notification queue for delivery.
--          RLS-protected with service-role background job access.
--
-- BUILDS ON: Migration 009 (pp_players, pp_markets, etc.)
--
-- SAFE TO RUN: All additive — no existing tables or columns are dropped.
--
-- RUN IN: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- DATE:   March 27, 2026
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. EXTEND pp_players WITH NOTIFICATION PREFERENCES ──────────────────

ALTER TABLE pp_players ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT false;
ALTER TABLE pp_players ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN DEFAULT false;
ALTER TABLE pp_players ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN DEFAULT false;
ALTER TABLE pp_players ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE pp_players ADD COLUMN IF NOT EXISTS phone TEXT;


-- ─── 2. NOTIFICATIONS TABLE ────────────────────────────────────────────────
-- Central log of all notifications sent to players.
-- payload is flexible JSON for future notification types.

CREATE TABLE IF NOT EXISTS pp_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES pp_players(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('prediction_resolved', 'level_up', 'weekly_digest')),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  payload         JSONB DEFAULT '{}',
  read            BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pp_notifications_player_read ON pp_notifications(player_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_pp_notifications_created ON pp_notifications(created_at DESC);


-- ─── 3. DEVICE TOKENS TABLE ────────────────────────────────────────────────
-- Push notification device tokens (iOS, Android, Web).
-- One player can have multiple devices.

CREATE TABLE IF NOT EXISTS pp_device_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES pp_players(id) ON DELETE CASCADE,
  token           TEXT NOT NULL,
  platform        TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  last_used_at    TIMESTAMPTZ DEFAULT now(),

  UNIQUE(player_id, token)
);

CREATE INDEX IF NOT EXISTS idx_pp_device_tokens_player ON pp_device_tokens(player_id);


-- ─── 4. NOTIFICATION QUEUE TABLE ───────────────────────────────────────────
-- Task queue for background job (cron) to deliver notifications.
-- Channels: push (FCM/APNs), email, sms.
-- Status: pending → sent or failed.

CREATE TABLE IF NOT EXISTS pp_notification_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES pp_notifications(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL CHECK (channel IN ('push', 'email', 'sms')),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  sent_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pp_notification_queue_pending ON pp_notification_queue(status) WHERE status = 'pending';


-- ─── 5. ROW LEVEL SECURITY ──────────────────────────────────────────────────

ALTER TABLE pp_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pp_device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE pp_notification_queue ENABLE ROW LEVEL SECURITY;

-- Notifications: anyone can read, service role can insert/update
CREATE POLICY "Players can read own notifications" ON pp_notifications FOR SELECT USING (
  player_id = (
    SELECT id FROM pp_players WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
  )
  OR player_id = (
    SELECT id FROM pp_players WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage notifications" ON pp_notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role')
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can update notifications" ON pp_notifications FOR UPDATE
  USING (auth.role() = 'service_role');

-- Device tokens: anyone can read/insert own, service role can delete
CREATE POLICY "Players can read own device tokens" ON pp_device_tokens FOR SELECT USING (
  player_id = (
    SELECT id FROM pp_players WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
  )
  OR player_id = (
    SELECT id FROM pp_players WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Players can insert own device tokens" ON pp_device_tokens FOR INSERT WITH CHECK (
  player_id = (
    SELECT id FROM pp_players WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
  )
  OR player_id = (
    SELECT id FROM pp_players WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Service role can delete device tokens" ON pp_device_tokens FOR DELETE
  USING (auth.role() = 'service_role');

-- Notification queue: service role only (no client access)
CREATE POLICY "Service role only on notification queue" ON pp_notification_queue
  USING (auth.role() = 'service_role');


-- ─── 6. HELPER FUNCTIONS ────────────────────────────────────────────────────

-- Get unread notifications for a player (most recent, limit 50)
CREATE OR REPLACE FUNCTION pp_get_unread_notifications(p_player_id UUID)
RETURNS TABLE(
  id UUID,
  type TEXT,
  title TEXT,
  body TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.type,
    n.title,
    n.body,
    n.payload,
    n.created_at
  FROM pp_notifications n
  WHERE n.player_id = p_player_id
    AND n.read = false
  ORDER BY n.created_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════
-- DONE. Next steps:
-- 1. Run this in Supabase SQL Editor
-- 2. Verify new columns on pp_players, 3 new tables in Table Editor
-- 3. Background jobs will check pp_notification_queue for pending deliveries
-- ═══════════════════════════════════════════════════════════════════════════
