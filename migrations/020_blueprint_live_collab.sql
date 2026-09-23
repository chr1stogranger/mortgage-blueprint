-- 020: Live co-editing — LO and borrower on the same Blueprint.
--
-- Paste into the Supabase SQL Editor (project "loan-pipeline"). Idempotent.
--
-- Realtime postgres_changes are RLS-filtered by the socket's JWT. Before this:
--   1. An LO's socket could see NO scenarios rows (no team policy), so the LO
--      never received the borrower's edits live.
--   2. A borrower who signed in with an email other than the one on file was
--      never linked to the borrower row, so they received nothing live either
--      — even though /api/share already hands the full blueprint to any
--      holder of the share link.
-- The client tolerates this migration being un-applied (it just degrades to
-- the old no-live-updates behavior).

-- ── 1. Team members can read every scenario (matches the Ops API, which
--       already lists all scenarios to any team member via the service key).
--       Confirmed email only: an unconfirmed signup can't borrow an LO email.
CREATE OR REPLACE FUNCTION public.is_team_member()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM auth.users u
      JOIN team_members tm ON lower(tm.email) = lower(u.email)
     WHERE u.id = auth.uid()
       AND u.email_confirmed_at IS NOT NULL
       AND tm.active
  );
$$;
REVOKE ALL ON FUNCTION public.is_team_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_member() TO authenticated;

DROP POLICY IF EXISTS team_scenarios_select ON public.scenarios;
CREATE POLICY team_scenarios_select ON public.scenarios
  FOR SELECT TO authenticated USING (public.is_team_member());

DROP POLICY IF EXISTS team_locks_select ON public.field_lock_events;
CREATE POLICY team_locks_select ON public.field_lock_events
  FOR SELECT TO authenticated USING (public.is_team_member());

DROP POLICY IF EXISTS team_changes_select ON public.scenario_changes;
CREATE POLICY team_changes_select ON public.scenario_changes
  FOR SELECT TO authenticated USING (public.is_team_member());

-- ── 2. Share-link viewers: any signed-in holder of a live share link gets
--       live read access to that borrower's scenarios. Pinned to the token
--       they used — rotating or revoking the link cuts them off.
CREATE TABLE IF NOT EXISTS public.share_link_viewers (
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  borrower_id  uuid NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  share_token  uuid NOT NULL,
  seen_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (auth_user_id, borrower_id)
);
-- No policies: reachable only through the SECURITY DEFINER functions below.
ALTER TABLE public.share_link_viewers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.register_share_view(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE b_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO b_id FROM borrowers
   WHERE share_token = p_token
     AND (share_expires_at IS NULL OR share_expires_at > now());
  IF b_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO share_link_viewers (auth_user_id, borrower_id, share_token)
  VALUES (auth.uid(), b_id, p_token)
  ON CONFLICT (auth_user_id, borrower_id)
  DO UPDATE SET share_token = EXCLUDED.share_token, seen_at = now();
  RETURN b_id;
END;
$$;
REVOKE ALL ON FUNCTION public.register_share_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_share_view(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_live_shared_borrower_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT b.id
    FROM borrowers b
   WHERE (
           b.id IN (SELECT public.my_linked_borrower_ids())
           OR EXISTS (
             SELECT 1 FROM share_link_viewers v
              WHERE v.borrower_id = b.id
                AND v.auth_user_id = auth.uid()
                AND v.share_token = b.share_token
           )
         )
     AND b.share_token IS NOT NULL
     AND (b.share_expires_at IS NULL OR b.share_expires_at > NOW());
$$;
