-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 015 — pp_daily_challenges.latitude / .longitude (Daily map slide)
-- Run in Supabase SQL Editor (one shot). Safe to re-run (idempotent).
--
-- What this does:
--   Adds latitude/longitude to pp_daily_challenges so the Daily card can
--   append the static-map slide that Free Play and Live already show. The
--   carousel only renders a map when the listing carries coordinates; daily
--   rows never stored them, so the Daily had photos only.
--
-- Backfill: pulls coordinates from pp_property_pool for any daily whose zpid
-- is already in the pool. Dailies seeded after this migration store their own
-- coordinates directly from the Zillow detail payload.
--
-- The API (api/pp-daily.js) is tolerant of this migration NOT being applied:
-- it retries the daily insert without the coordinate columns on PGRST204 and
-- simply serves no map slide. Apply this to get maps on the Daily.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Add the coordinate columns ──────────────────────────────────────────
ALTER TABLE public.pp_daily_challenges
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;

ALTER TABLE public.pp_daily_challenges
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- ─── 2. Backfill from the property pool where the zpid matches ──────────────
UPDATE public.pp_daily_challenges d
SET latitude  = p.latitude,
    longitude = p.longitude
FROM public.pp_property_pool p
WHERE d.zpid = p.zpid
  AND d.latitude IS NULL
  AND p.latitude IS NOT NULL;
