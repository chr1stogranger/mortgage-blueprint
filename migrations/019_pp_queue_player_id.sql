-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 019: PricePoint — notification queue player_id
--
-- PURPOSE: api/cron-resolve.js has always inserted a player_id on
--          pp_notification_queue rows, but migration 010 never created the
--          column — so every queue insert failed with PGRST204 and email/SMS
--          notifications silently never went out. (The code now also
--          strip-and-retries without the column, so it works either way;
--          this makes the schema match the code and helps ops queries.)
--
-- SAFE TO RUN: Additive only.
--
-- RUN IN: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- DATE:   August 25, 2026
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE pp_notification_queue
  ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES pp_players(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pp_notification_queue_player
  ON pp_notification_queue(player_id);
