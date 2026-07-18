-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 013 — pp_daily_challenges.photos (full MLS photo carousel)
-- Run in Supabase SQL Editor (one shot). Safe to re-run (idempotent).
--
-- What this does:
--   1. Adds a `photos` JSONB column to pp_daily_challenges so the Daily can
--      serve the full photo array (capped at 24 by the API) instead of just
--      the single hero shot. The legacy `photo` TEXT column keeps being
--      written (= photos[0]) for backward compatibility.
--   2. Backfills existing rows: photos = [photo] where a hero photo exists.
--
-- The API (api/pp-daily.js) is tolerant of this migration NOT being applied:
-- it retries the daily insert without `photos` on PGRST204 and serves
-- [photo] as the fallback array. Apply this to get full carousels.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Add the photos column ────────────────────────────────────────────────
ALTER TABLE public.pp_daily_challenges
  ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ─── 2. Backfill old rows from the legacy single photo ──────────────────────
UPDATE public.pp_daily_challenges
SET photos = to_jsonb(ARRAY[photo])
WHERE photos = '[]'::jsonb
  AND photo IS NOT NULL
  AND photo <> '';
