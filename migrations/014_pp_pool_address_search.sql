-- 014: Live address search (feature A3)
-- /api/pp-address caches every searched property in pp_property_pool so repeat
-- searches cost zero RapidAPI calls. Active (not-yet-sold) listings have no
-- sold price/date, but the original schema (sql/2026-05-28-pp_property_pool.sql)
-- declared both columns NOT NULL. Relax them.
--
-- Safe because every existing reader already filters on sold_date:
--   * /api/sold-comps  → WHERE sold_date >= ingest cutoff
--   * /api/pp-daily    → WHERE sold_date >= 12-month cutoff
-- so NULL-sold rows are invisible to the sold-price game. /api/pp-guess reads
-- the pool by zpid and checks `if (poolRow?.sold_price)` — NULL is handled.
--
-- APPLY BY HAND in the Supabase SQL editor (same workflow as prior migrations).
-- Until applied, /api/pp-address still works — it just can't persist unsold
-- searches to the pool (the upsert fails non-fatally and is logged).

ALTER TABLE public.pp_property_pool ALTER COLUMN sold_price DROP NOT NULL;
ALTER TABLE public.pp_property_pool ALTER COLUMN sold_date DROP NOT NULL;
