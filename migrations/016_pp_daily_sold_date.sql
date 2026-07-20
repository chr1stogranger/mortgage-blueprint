-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 016 — pp_daily_challenges.sold_date (Daily "SOLD MMM 'YY" pill)
-- Run in Supabase SQL Editor (one shot). Safe to re-run (idempotent).
--
-- What this does:
--   Adds sold_date to pp_daily_challenges so the Daily card can show the same
--   lower-right photo pill Sold/Free Play already shows ("SOLD NOV '25").
--   Daily rows stored sold_price but never the DATE, so the pill had nothing
--   to render (Christo 2026-07-19).
--
-- Not a spoiler: this is WHEN the home sold, never for how much. sold_price
-- stays server-side and is only added to the response after the player has
-- guessed (see the reveal check in api/pp-daily.js).
--
-- Backfill: pulls sold_date from pp_property_pool for any daily whose zpid is
-- already in the pool. Dailies seeded after this migration store their own
-- date directly (pool path and direct-discovery path both populate it).
--
-- The API is tolerant of this migration NOT being applied: it retries the
-- daily insert without sold_date on PGRST204 and serves soldDate: null, which
-- the card renders as no pill. Apply this to turn the pill on.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Add the column ──────────────────────────────────────────────────────
ALTER TABLE public.pp_daily_challenges
  ADD COLUMN IF NOT EXISTS sold_date DATE;

-- ─── 2. Backfill from the property pool where the zpid matches ──────────────
UPDATE public.pp_daily_challenges d
SET sold_date = p.sold_date
FROM public.pp_property_pool p
WHERE d.zpid = p.zpid
  AND d.sold_date IS NULL
  AND p.sold_date IS NOT NULL;
