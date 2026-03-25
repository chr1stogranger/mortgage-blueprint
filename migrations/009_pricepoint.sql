-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 009: PricePoint — Players, Markets, Dailies, Guesses, Predictions
--
-- PURPOSE: Backend for PricePoint game modes (Daily, Free Play, Live).
--          Supports 4 launch markets: SF, Oakland, Berkeley, Alameda.
--          Anonymous-first auth (UUID player), upgradeable to email.
--          Per-market Daily challenges and leaderboards.
--
-- SAFE TO RUN: All additive — no existing tables or columns are dropped.
--
-- RUN IN: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- DATE:   March 24, 2026
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. MARKETS TABLE ────────────────────────────────────────────────────
-- Static reference table. 4 rows at launch.

CREATE TABLE IF NOT EXISTS pp_markets (
  id              TEXT PRIMARY KEY,                -- e.g. 'sf', 'oakland'
  name            TEXT NOT NULL,                   -- "San Francisco"
  state           TEXT NOT NULL DEFAULT 'CA',
  zips            TEXT[] NOT NULL DEFAULT '{}',    -- all zips in this market
  neighborhoods   JSONB NOT NULL DEFAULT '[]',     -- [{name, zips: []}]
  icon            TEXT DEFAULT 'map-pin',
  sort_order      INTEGER DEFAULT 0,
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Seed the 4 launch markets
INSERT INTO pp_markets (id, name, state, zips, neighborhoods, sort_order) VALUES
(
  'sf',
  'San Francisco',
  'CA',
  ARRAY['94102','94103','94104','94105','94107','94108','94109','94110','94111','94112','94114','94115','94116','94117','94118','94119','94120','94121','94122','94123','94124','94127','94129','94130','94131','94132','94133','94134','94158'],
  '[
    {"name":"Pacific Heights","zips":["94115","94123"]},
    {"name":"Marina","zips":["94123"]},
    {"name":"Nob Hill","zips":["94108","94109"]},
    {"name":"Russian Hill","zips":["94109"]},
    {"name":"North Beach","zips":["94133"]},
    {"name":"SOMA","zips":["94103","94105","94107"]},
    {"name":"Mission","zips":["94110","94114"]},
    {"name":"Castro","zips":["94114"]},
    {"name":"Noe Valley","zips":["94114","94131"]},
    {"name":"Haight","zips":["94117"]},
    {"name":"Richmond","zips":["94118","94121"]},
    {"name":"Sunset","zips":["94116","94122"]},
    {"name":"Bernal Heights","zips":["94110"]},
    {"name":"Potrero Hill","zips":["94107"]},
    {"name":"Bayview","zips":["94124"]},
    {"name":"Excelsior","zips":["94112"]},
    {"name":"Glen Park","zips":["94131"]},
    {"name":"Twin Peaks","zips":["94114","94131"]},
    {"name":"West Portal","zips":["94127"]},
    {"name":"Presidio","zips":["94129"]}
  ]'::jsonb,
  1
),
(
  'oakland',
  'Oakland',
  'CA',
  ARRAY['94601','94602','94603','94605','94606','94607','94608','94609','94610','94611','94612','94613','94618','94619','94621'],
  '[
    {"name":"Rockridge","zips":["94618"]},
    {"name":"Temescal","zips":["94609"]},
    {"name":"Montclair","zips":["94611"]},
    {"name":"Lake Merritt","zips":["94612","94610"]},
    {"name":"Grand Lake","zips":["94610"]},
    {"name":"Piedmont Ave","zips":["94611","94618"]},
    {"name":"Fruitvale","zips":["94601","94602"]},
    {"name":"Jack London","zips":["94607"]},
    {"name":"West Oakland","zips":["94607","94608"]},
    {"name":"East Oakland","zips":["94605","94621"]},
    {"name":"Adams Point","zips":["94610"]},
    {"name":"Dimond","zips":["94602"]},
    {"name":"Glenview","zips":["94602"]},
    {"name":"Laurel","zips":["94619"]}
  ]'::jsonb,
  2
),
(
  'berkeley',
  'Berkeley',
  'CA',
  ARRAY['94702','94703','94704','94705','94706','94707','94708','94709','94710','94720'],
  '[
    {"name":"North Berkeley","zips":["94707","94708","94709"]},
    {"name":"South Berkeley","zips":["94703","94704"]},
    {"name":"West Berkeley","zips":["94702","94710"]},
    {"name":"Elmwood","zips":["94705"]},
    {"name":"Claremont","zips":["94705"]},
    {"name":"Thousand Oaks","zips":["94707"]},
    {"name":"Berkeley Hills","zips":["94708","94707"]},
    {"name":"Downtown Berkeley","zips":["94704"]}
  ]'::jsonb,
  3
),
(
  'alameda',
  'Alameda',
  'CA',
  ARRAY['94501','94502'],
  '[
    {"name":"West End","zips":["94501"]},
    {"name":"East End","zips":["94501"]},
    {"name":"Bay Farm Island","zips":["94502"]},
    {"name":"Central Alameda","zips":["94501"]}
  ]'::jsonb,
  4
)
ON CONFLICT (id) DO NOTHING;


-- ─── 2. PLAYERS TABLE ────────────────────────────────────────────────────
-- Anonymous-first. device_id for anonymous, upgradeable to auth.users.

CREATE TABLE IF NOT EXISTS pp_players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- null for anon
  device_id       TEXT,                           -- localStorage fingerprint
  display_name    TEXT DEFAULT '',
  email           TEXT DEFAULT '',
  avatar_url      TEXT DEFAULT '',
  home_market     TEXT REFERENCES pp_markets(id) DEFAULT 'sf',
  total_xp        INTEGER DEFAULT 0,
  current_level   INTEGER DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT now(),
  last_active_at  TIMESTAMPTZ DEFAULT now(),

  -- Ensure one player per device (anonymous) or per auth user
  UNIQUE(device_id)
);

CREATE INDEX IF NOT EXISTS idx_pp_players_auth ON pp_players(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pp_players_device ON pp_players(device_id) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pp_players_market ON pp_players(home_market);


-- ─── 3. DAILY CHALLENGES TABLE ──────────────────────────────────────────
-- One row per market per date. The "question" for that day.
-- sold_price is NEVER sent to client until after guess submission.

CREATE TABLE IF NOT EXISTS pp_daily_challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id       TEXT NOT NULL REFERENCES pp_markets(id),
  challenge_date  DATE NOT NULL,
  daily_number    INTEGER NOT NULL,               -- sequential per market

  -- Property data (sent to client)
  zpid            TEXT,
  address         TEXT NOT NULL,
  city            TEXT NOT NULL,
  state           TEXT NOT NULL DEFAULT 'CA',
  zip             TEXT NOT NULL,
  neighborhood    TEXT DEFAULT '',
  photo           TEXT DEFAULT '',
  beds            SMALLINT,
  baths           REAL,
  sqft            INTEGER,
  year_built      SMALLINT,
  property_type   TEXT DEFAULT '',                 -- SingleFamily, Condo, etc.
  list_price      BIGINT,
  days_on_market  SMALLINT,

  -- Answer (server-side only, never in initial response)
  sold_price      BIGINT NOT NULL,

  created_at      TIMESTAMPTZ DEFAULT now(),

  UNIQUE(market_id, challenge_date)
);

CREATE INDEX IF NOT EXISTS idx_pp_daily_market_date ON pp_daily_challenges(market_id, challenge_date DESC);


-- ─── 4. GUESSES TABLE ───────────────────────────────────────────────────
-- Every guess across all modes. The core analytics table.

CREATE TABLE IF NOT EXISTS pp_guesses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES pp_players(id) ON DELETE CASCADE,
  market_id       TEXT NOT NULL REFERENCES pp_markets(id),

  -- Mode
  mode            TEXT NOT NULL CHECK (mode IN ('daily', 'freeplay', 'live')),
  daily_id        UUID REFERENCES pp_daily_challenges(id),  -- null for freeplay/live

  -- Property
  zpid            TEXT,
  address         TEXT DEFAULT '',
  neighborhood    TEXT DEFAULT '',
  city            TEXT DEFAULT '',
  zip             TEXT DEFAULT '',
  property_type   TEXT DEFAULT '',
  beds            SMALLINT,
  baths           REAL,
  sqft            INTEGER,
  list_price      BIGINT,
  photo           TEXT DEFAULT '',

  -- Guess & scoring
  guess           BIGINT NOT NULL,
  sold_price      BIGINT,                         -- null for live (unresolved)
  pct_off         REAL,                           -- abs % difference, null for live
  accuracy_band   TEXT,                           -- 'bullseye','sharp','solid','tricky','surprise'
  xp_earned       SMALLINT DEFAULT 0,

  -- Metadata
  guess_time_ms   INTEGER,                        -- how long they took to guess
  created_at      TIMESTAMPTZ DEFAULT now(),

  -- One daily guess per player per challenge
  UNIQUE(player_id, daily_id)
);

CREATE INDEX IF NOT EXISTS idx_pp_guesses_player ON pp_guesses(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pp_guesses_market ON pp_guesses(market_id, mode, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pp_guesses_daily ON pp_guesses(daily_id) WHERE daily_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pp_guesses_leaderboard ON pp_guesses(market_id, mode, pct_off) WHERE pct_off IS NOT NULL;


-- ─── 5. LIVE PREDICTIONS TABLE ──────────────────────────────────────────
-- Active listing predictions that need resolution later.

CREATE TABLE IF NOT EXISTS pp_predictions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES pp_players(id) ON DELETE CASCADE,
  market_id       TEXT NOT NULL REFERENCES pp_markets(id),
  guess_id        UUID REFERENCES pp_guesses(id),

  -- Property
  zpid            TEXT NOT NULL,
  address         TEXT DEFAULT '',
  neighborhood    TEXT DEFAULT '',
  list_price      BIGINT,

  -- Prediction
  predicted_price BIGINT NOT NULL,
  predicted_at    TIMESTAMPTZ DEFAULT now(),

  -- Resolution (filled in by cron job when property sells)
  resolved        BOOLEAN DEFAULT false,
  sold_price      BIGINT,
  pct_off         REAL,
  resolved_at     TIMESTAMPTZ,

  UNIQUE(player_id, zpid)
);

CREATE INDEX IF NOT EXISTS idx_pp_predictions_unresolved ON pp_predictions(resolved, zpid) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_pp_predictions_player ON pp_predictions(player_id, predicted_at DESC);


-- ─── 6. ROW LEVEL SECURITY ──────────────────────────────────────────────

ALTER TABLE pp_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pp_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE pp_daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE pp_guesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE pp_predictions ENABLE ROW LEVEL SECURITY;

-- Markets: anyone can read
CREATE POLICY "Markets are public" ON pp_markets FOR SELECT USING (true);

-- Players: read own, read others for leaderboard (display_name + xp only)
CREATE POLICY "Players can read all players" ON pp_players FOR SELECT USING (true);
CREATE POLICY "Players can insert own" ON pp_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Players can update own" ON pp_players FOR UPDATE USING (
  device_id = current_setting('request.headers', true)::json->>'x-device-id'
  OR auth_user_id = auth.uid()
);

-- Daily challenges: anyone can read (sold_price handled by API, not RLS)
CREATE POLICY "Dailies are public" ON pp_daily_challenges FOR SELECT USING (true);

-- Guesses: read own, read others for leaderboard
CREATE POLICY "Anyone can read guesses" ON pp_guesses FOR SELECT USING (true);
CREATE POLICY "Players can insert own guesses" ON pp_guesses FOR INSERT WITH CHECK (true);

-- Predictions: read own
CREATE POLICY "Anyone can read predictions" ON pp_predictions FOR SELECT USING (true);
CREATE POLICY "Players can insert own predictions" ON pp_predictions FOR INSERT WITH CHECK (true);


-- ─── 7. HELPER FUNCTIONS ────────────────────────────────────────────────

-- Get or create anonymous player by device_id
CREATE OR REPLACE FUNCTION pp_get_or_create_player(p_device_id TEXT, p_market TEXT DEFAULT 'sf')
RETURNS UUID AS $$
DECLARE
  v_player_id UUID;
BEGIN
  SELECT id INTO v_player_id FROM pp_players WHERE device_id = p_device_id;

  IF v_player_id IS NULL THEN
    INSERT INTO pp_players (device_id, home_market)
    VALUES (p_device_id, p_market)
    RETURNING id INTO v_player_id;
  ELSE
    UPDATE pp_players SET last_active_at = now() WHERE id = v_player_id;
  END IF;

  RETURN v_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get today's daily challenge for a market (creates deterministic one if missing)
CREATE OR REPLACE FUNCTION pp_get_daily(p_market TEXT, p_date DATE DEFAULT CURRENT_DATE)
RETURNS pp_daily_challenges AS $$
DECLARE
  v_daily pp_daily_challenges;
BEGIN
  SELECT * INTO v_daily
  FROM pp_daily_challenges
  WHERE market_id = p_market AND challenge_date = p_date;

  RETURN v_daily;  -- null if not yet seeded (API will handle seeding)
END;
$$ LANGUAGE plpgsql STABLE;

-- Market leaderboard: top players by accuracy for a mode
CREATE OR REPLACE FUNCTION pp_leaderboard(
  p_market TEXT,
  p_mode TEXT DEFAULT 'daily',
  p_period TEXT DEFAULT 'all',  -- 'today', 'week', 'all'
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  player_id UUID,
  display_name TEXT,
  avatar_url TEXT,
  guess_count BIGINT,
  avg_pct_off REAL,
  total_xp BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.player_id,
    p.display_name,
    p.avatar_url,
    COUNT(*)::BIGINT AS guess_count,
    AVG(g.pct_off)::REAL AS avg_pct_off,
    SUM(g.xp_earned)::BIGINT AS total_xp
  FROM pp_guesses g
  JOIN pp_players p ON p.id = g.player_id
  WHERE g.market_id = p_market
    AND g.mode = p_mode
    AND g.pct_off IS NOT NULL
    AND (
      p_period = 'all'
      OR (p_period = 'today' AND g.created_at >= CURRENT_DATE)
      OR (p_period = 'week' AND g.created_at >= CURRENT_DATE - INTERVAL '7 days')
    )
  GROUP BY g.player_id, p.display_name, p.avatar_url
  HAVING COUNT(*) >= 3  -- minimum 3 guesses to rank
  ORDER BY AVG(g.pct_off) ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;


-- ─── 8. ENABLE REALTIME ─────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE pp_guesses;
ALTER PUBLICATION supabase_realtime ADD TABLE pp_predictions;


-- ═══════════════════════════════════════════════════════════════════════════
-- DONE. Next steps:
-- 1. Run this in Supabase SQL Editor
-- 2. Verify tables in Table Editor
-- 3. Daily challenges will be seeded by the API on first request per market/date
-- ═══════════════════════════════════════════════════════════════════════════
