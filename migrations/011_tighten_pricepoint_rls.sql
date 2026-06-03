-- 011_tighten_pricepoint_rls.sql
-- CIO audit H-3: the INSERT policies from 009_pricepoint.sql were
-- `WITH CHECK (true)` — anyone holding the anon key (i.e. anyone who views
-- the page source) could insert arbitrary players, guesses, and predictions
-- and poison the PricePoint leaderboard.
--
-- This migration binds writes to the device that owns the player row, using
-- the same `x-device-id` request-header pattern the pp_players UPDATE policy
-- already uses. The web client now sends that header on every Supabase
-- request (src/lib/supabaseClient.js).
--
-- ── RUN ORDER (important) ───────────────────────────────────────────────
-- 1. Deploy the client first (the supabaseClient.js change adding the
--    x-device-id header). Sending the header is harmless under the old
--    permissive policies.
-- 2. THEN run this migration in the Supabase SQL editor.
--
-- ── KNOWN SOFT IMPACT ───────────────────────────────────────────────────
-- Old cached clients (stale PWA tabs, and the v1.0 native App Store build)
-- do NOT send the header. After this migration their direct guess inserts
-- fail RLS — submitGuess() already handles this gracefully (logs a warning,
-- returns null, gameplay continues locally; the guess just doesn't reach the
-- leaderboard). Player creation and display-name updates are unaffected —
-- they go through SECURITY DEFINER RPCs (pp_get_or_create_player,
-- pp_set_display_name) which bypass RLS. Ship the header in the next native
-- build to restore leaderboard writes for App Store users.
--
-- ── ROLLBACK ────────────────────────────────────────────────────────────
-- Re-run section 6 of 009_pricepoint.sql (the original permissive policies).

-- Helper expression used throughout:
--   current_setting('request.headers', true)::json->>'x-device-id'
-- PostgREST exposes request headers via this GUC; `true` makes it return
-- NULL instead of erroring when unset.

-- ─── pp_players: INSERT bound to the inserting device ───────────────────
-- (Normal player creation uses the pp_get_or_create_player SECURITY DEFINER
-- RPC and bypasses RLS entirely — this policy only governs direct inserts.)
DROP POLICY IF EXISTS "Players can insert own" ON pp_players;
CREATE POLICY "Players can insert own device row" ON pp_players
  FOR INSERT WITH CHECK (
    device_id = current_setting('request.headers', true)::json->>'x-device-id'
    OR auth_user_id = auth.uid()
  );

-- ─── pp_guesses: INSERT only for a player you own ────────────────────────
DROP POLICY IF EXISTS "Players can insert own guesses" ON pp_guesses;
CREATE POLICY "Players can insert own guesses" ON pp_guesses
  FOR INSERT WITH CHECK (
    player_id IN (
      SELECT id FROM pp_players
      WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
         OR auth_user_id = auth.uid()
    )
  );

-- ─── pp_predictions: same ownership binding ──────────────────────────────
DROP POLICY IF EXISTS "Players can insert own predictions" ON pp_predictions;
CREATE POLICY "Players can insert own predictions" ON pp_predictions
  FOR INSERT WITH CHECK (
    player_id IN (
      SELECT id FROM pp_players
      WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
         OR auth_user_id = auth.uid()
    )
  );

-- ─── VERIFY ──────────────────────────────────────────────────────────────
-- After running, this should list the three new policies:
--   SELECT tablename, policyname, cmd, with_check
--   FROM pg_policies
--   WHERE tablename IN ('pp_players','pp_guesses','pp_predictions')
--     AND cmd = 'INSERT';
--
-- Functional check: play a PricePoint round in a fresh browser — the guess
-- should land in pp_guesses. Then try an insert with no x-device-id header
-- (e.g. from the SQL editor impersonating anon) — it should be rejected.
