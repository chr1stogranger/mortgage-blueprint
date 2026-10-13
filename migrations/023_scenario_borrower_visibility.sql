-- 023: Per-scenario borrower visibility — Show all / Hide / View-only.
--
-- Paste into the Supabase SQL Editor (project "loan-pipeline") BY HAND —
-- migrations do NOT auto-apply. Idempotent; safe to re-run. Run AFTER 020/021.
--
-- One column, three mutually exclusive states (Christo 2026-10-12):
--   editable  (default) borrower sees it and can edit it
--   view_only           borrower sees it, can't edit it (LO sidebar: lock)
--   hidden              borrower never receives it   (LO sidebar: eye-slash)
-- The link-level borrowers.share_access_level still applies on top; the most
-- restrictive of the two wins.
--
-- The Ops API filters hidden rows out of /api/share and the account "me" /
-- claim actions, and rejects borrower sync writes to non-editable rows. This
-- migration is the database half: RLS hides them from a share viewer's direct
-- Supabase reads/realtime, blocks direct updates to non-editable rows, and a
-- trigger stops anyone but the team / service role from flipping the column.

-- ── 1. The column ───────────────────────────────────────────────────────────
ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS borrower_visibility text NOT NULL DEFAULT 'editable'
  CHECK (borrower_visibility IN ('editable', 'view_only', 'hidden'));

-- ── 2. Share-viewer RLS: never see hidden rows, only update editable ones ──
-- team_scenarios_select (is_team_member()) and own_scenarios_* are untouched;
-- policies are OR'ed, so a team member who is also a share viewer still sees
-- everything.
DROP POLICY IF EXISTS shared_scenarios_select ON public.scenarios;
CREATE POLICY shared_scenarios_select ON public.scenarios
  FOR SELECT TO authenticated
  USING (borrower_id IN (SELECT public.my_live_shared_borrower_ids())
         AND borrower_visibility <> 'hidden');

DROP POLICY IF EXISTS shared_scenarios_update ON public.scenarios;
CREATE POLICY shared_scenarios_update ON public.scenarios
  FOR UPDATE TO authenticated
  USING (borrower_id IN (SELECT public.my_editable_shared_borrower_ids())
         AND borrower_visibility = 'editable')
  WITH CHECK (borrower_id IN (SELECT public.my_editable_shared_borrower_ids())
         AND borrower_visibility = 'editable');

-- ── 3. Only the team (or the service role) may change borrower_visibility ──
-- WITH CHECK above already pins an editable row to 'editable' for a share
-- viewer; this closes every other path (own_scenarios_* updates, future
-- policies). Allowed: the Ops API (service key), a confirmed active team
-- member, and direct SQL from the dashboard / migrations (postgres, which
-- isn't a PostgREST client role). Rejected: any other anon/authenticated JWT.
CREATE OR REPLACE FUNCTION public.guard_scenario_borrower_visibility()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.borrower_visibility IS DISTINCT FROM OLD.borrower_visibility THEN
    IF coalesce(auth.role(), '') = 'service_role'
       OR current_user NOT IN ('anon', 'authenticated')
       OR public.is_team_member() THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Only your loan officer can change who sees this scenario'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scenarios_guard_borrower_visibility ON public.scenarios;
CREATE TRIGGER scenarios_guard_borrower_visibility
  BEFORE UPDATE ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.guard_scenario_borrower_visibility();

-- ── Verify ──────────────────────────────────────────────────────────────────
-- select policyname, qual, with_check from pg_policies where tablename = 'scenarios';
-- select tgname from pg_trigger where tgrelid = 'public.scenarios'::regclass and not tgisinternal;
