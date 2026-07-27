-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 018: PricePoint — Head-to-Head record (account-synced)
--
-- PURPOSE: Persist each player's challenge W/L/T so it follows their account
--          across devices (previously localStorage-only). Read/written via
--          /api/notifications?action=h2h.
--
-- SAFE TO RUN: additive, idempotent (IF NOT EXISTS). No data dropped.
--
-- RUN IN: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE pp_players
  ADD COLUMN IF NOT EXISTS h2h JSONB DEFAULT '{"wins":0,"losses":0,"ties":0}'::jsonb;
