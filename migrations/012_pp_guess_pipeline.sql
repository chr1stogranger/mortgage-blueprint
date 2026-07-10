-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 012 — PricePoint Guess Pipeline v2
-- Run in Supabase SQL Editor (one shot). Safe to re-run (idempotent).
--
-- What this does:
--   1. Allow mode = 'challenge' on pp_guesses (challenge-link guesses now persist)
--   2. pp_award_xp() — server-side XP INCREMENT (replaces the client overwrite)
--   3. pp_leaderboard_v2() — ranked board, period-scaled minimums, own-row union
--   4. pp_property_pool.enrich_attempts — for the nightly photo backfill cron
--   5. Re-key mis-keyed pool rows ('los angeles' → 'la', etc.) so the LA/SD
--      Daily can seed from the pool (fixes the 503 after the whitelist fix)
--
-- Level thresholds in pp_award_xp MUST match the client LEVELS table
-- (src/PricePoint.jsx ~line 182). If you change one, change both.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Allow 'challenge' mode on pp_guesses ────────────────────────────────
-- The mode CHECK was created inline in 009 with an auto-generated name, so we
-- look it up before dropping it (don't assume the name).
DO $$
DECLARE
  v_con TEXT;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'pp_guesses'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%mode%';

  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE pp_guesses DROP CONSTRAINT %I', v_con);
  END IF;

  ALTER TABLE pp_guesses
    ADD CONSTRAINT pp_guesses_mode_check
    CHECK (mode IN ('daily', 'freeplay', 'live', 'challenge'));
END $$;


-- ─── 2. pp_award_xp: increment total_xp + recompute level ────────────────────
-- SECURITY DEFINER so the server endpoint (service role) can call it. Deliberately
-- NOT granted to anon — XP can only be awarded through the server-scored endpoint,
-- never directly from a client (prevents XP inflation).
CREATE OR REPLACE FUNCTION pp_award_xp(p_player_id UUID, p_xp INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_total INTEGER;
  v_level INTEGER;
BEGIN
  UPDATE pp_players
  SET total_xp       = COALESCE(total_xp, 0) + GREATEST(COALESCE(p_xp, 0), 0),
      last_active_at = now()
  WHERE id = p_player_id
  RETURNING total_xp INTO v_total;

  IF v_total IS NULL THEN
    RETURN NULL;  -- player not found
  END IF;

  -- Thresholds mirror client LEVELS (src/PricePoint.jsx ~line 182)
  v_level := CASE
    WHEN v_total >= 7000 THEN 13
    WHEN v_total >= 5500 THEN 12
    WHEN v_total >= 4200 THEN 11
    WHEN v_total >= 3200 THEN 10
    WHEN v_total >= 2400 THEN 9
    WHEN v_total >= 1700 THEN 8
    WHEN v_total >= 1200 THEN 7
    WHEN v_total >= 800  THEN 6
    WHEN v_total >= 500  THEN 5
    WHEN v_total >= 300  THEN 4
    WHEN v_total >= 150  THEN 3
    WHEN v_total >= 50   THEN 2
    ELSE 1
  END;

  UPDATE pp_players SET current_level = v_level WHERE id = p_player_id;
  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Postgres grants function EXECUTE to PUBLIC by default, and anon/authenticated
-- inherit it — so we must revoke from PUBLIC (not just the two roles) to actually
-- lock this down, then hand EXECUTE back to service_role (the server endpoint).
REVOKE ALL ON FUNCTION pp_award_xp(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION pp_award_xp(UUID, INTEGER) TO service_role;


-- ─── 3. pp_leaderboard_v2: rank + period-scaled minimums + own-row union ─────
-- Same shape as v1 plus a `rank` column. Minimum guesses to appear scales by
-- period so a fresh "today" board isn't empty: today >= 1, week >= 2, all >= 3.
-- When p_player_id is passed, the caller's own row is always returned (with its
-- true rank) even if it falls outside p_limit. v1 is left in place for old
-- clients that still call it.
CREATE OR REPLACE FUNCTION pp_leaderboard_v2(
  p_market    TEXT,
  p_mode      TEXT DEFAULT 'daily',
  p_period    TEXT DEFAULT 'all',   -- 'today' | 'week' | 'all'
  p_limit     INTEGER DEFAULT 20,
  p_player_id UUID DEFAULT NULL
)
RETURNS TABLE(
  rank         BIGINT,
  player_id    UUID,
  display_name TEXT,
  avatar_url   TEXT,
  guess_count  BIGINT,
  avg_pct_off  REAL,
  total_xp     BIGINT
) AS $$
DECLARE
  v_min INTEGER := CASE p_period
                     WHEN 'today' THEN 1
                     WHEN 'week'  THEN 2
                     ELSE 3
                   END;
BEGIN
  RETURN QUERY
  WITH scored AS (
    SELECT
      g.player_id                 AS pid,
      p.display_name              AS dname,
      p.avatar_url                AS av,
      COUNT(*)::BIGINT            AS gcount,
      AVG(g.pct_off)::REAL        AS avgpct,
      SUM(g.xp_earned)::BIGINT    AS xp
    FROM pp_guesses g
    JOIN pp_players p ON p.id = g.player_id
    WHERE g.market_id = p_market
      AND g.mode      = p_mode
      AND g.pct_off IS NOT NULL
      AND (
        p_period = 'all'
        OR (p_period = 'today' AND g.created_at >= CURRENT_DATE)
        OR (p_period = 'week'  AND g.created_at >= CURRENT_DATE - INTERVAL '7 days')
      )
    GROUP BY g.player_id, p.display_name, p.avatar_url
    HAVING COUNT(*) >= v_min
  ),
  ranked AS (
    SELECT
      ROW_NUMBER() OVER (ORDER BY avgpct ASC, gcount DESC)::BIGINT AS rnk,
      pid, dname, av, gcount, avgpct, xp
    FROM scored
  )
  SELECT rnk, pid, dname, av, gcount, avgpct, xp
  FROM ranked
  WHERE rnk <= p_limit
     OR (p_player_id IS NOT NULL AND pid = p_player_id)
  ORDER BY rnk ASC;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION pp_leaderboard_v2(TEXT, TEXT, TEXT, INTEGER, UUID)
  TO anon, authenticated;


-- ─── 4. pp_property_pool.enrich_attempts (nightly photo backfill cron) ───────
ALTER TABLE public.pp_property_pool
  ADD COLUMN IF NOT EXISTS enrich_attempts SMALLINT DEFAULT 0;


-- ─── 5. Re-key mis-keyed pool rows to canonical market ids ───────────────────
-- /api/sold-comps historically stored multi-word cities under their spaced name
-- ('los angeles', 'san diego', 'new york city') while /api/pp-daily and the
-- client query by the short id ('la','sd','nyc'). That mismatch is why the LA/SD
-- Daily returned 503 (empty pool) even though Free Play had listings. The code
-- fix (cityToMarketId) ships with the same deploy; this re-keys existing rows.
UPDATE public.pp_property_pool SET market_id = 'la'  WHERE market_id = 'los angeles';
UPDATE public.pp_property_pool SET market_id = 'sd'  WHERE market_id = 'san diego';
UPDATE public.pp_property_pool SET market_id = 'nyc' WHERE market_id IN ('new york city', 'new york');


-- ─── Verification (optional — run to sanity-check) ───────────────────────────
-- SELECT mode FROM pg_constraint c
--   JOIN pg_class t ON t.oid = c.conrelid
--   WHERE t.relname = 'pp_guesses' AND c.contype = 'c';
-- SELECT pp_award_xp(NULL, 0);                       -- expect NULL (no player)
-- SELECT * FROM pp_leaderboard_v2('sf','daily','all',20,NULL) LIMIT 5;
-- SELECT market_id, COUNT(*) FROM pp_property_pool GROUP BY market_id ORDER BY 2 DESC;
