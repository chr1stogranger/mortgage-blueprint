-- 024: Scenario version history — open or restore an earlier version.
--
-- Paste into the Supabase SQL Editor (project "loan-pipeline") BY HAND —
-- migrations do NOT auto-apply. Idempotent; safe to re-run. Run AFTER 023.
--
-- (Christo 2026-10-13) Every scenario keeps restore points, whoever saves it
-- (LO through the Ops API, borrower through the share link, direct Supabase):
--   * AUTO   — a trigger copies the row's PREVIOUS state when an edit lands
--              and the last auto version is 10+ minutes old, so each burst of
--              editing leaves the "before" state behind.
--   * DELETED — the same trigger keeps a copy of any scenario that's deleted
--              (borrowers can delete the LO's scenarios now).
--   * NAMED  — save_scenario_version(id, label): the app calls it before a
--              restore ("Before restore") so a restore can itself be undone.
-- Newest 200 per scenario are kept.
--
-- Readable by anyone who can read the scenario itself: the SELECT policy
-- re-checks `scenarios` under the caller's own RLS (team, share viewer of a
-- non-hidden row, or owner). A deleted scenario's versions are team-only.
-- Nobody writes the table directly; the trigger / function do.

-- ── 1. Table ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scenario_versions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id      uuid NOT NULL,          -- no FK: versions outlive a deleted scenario
  borrower_id      uuid,
  owner_account_id uuid,
  name             text,
  type             text,
  state_data       jsonb NOT NULL,
  calc_summary     jsonb,
  kind             text NOT NULL DEFAULT 'auto' CHECK (kind IN ('auto', 'named', 'deleted')),
  label            text,
  saved_by         text,                   -- 'lo' | 'borrower' | 'system'
  as_of            timestamptz NOT NULL DEFAULT now(),  -- when this state was current
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scenario_versions_scenario_idx ON public.scenario_versions (scenario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scenario_versions_borrower_deleted_idx ON public.scenario_versions (borrower_id, created_at DESC) WHERE kind = 'deleted';

ALTER TABLE public.scenario_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scenario_versions FROM anon, authenticated;
GRANT SELECT ON public.scenario_versions TO authenticated;

DROP POLICY IF EXISTS scenario_versions_select ON public.scenario_versions;
CREATE POLICY scenario_versions_select ON public.scenario_versions
  FOR SELECT TO authenticated
  USING (public.is_team_member()
         OR scenario_id IN (SELECT s.id FROM public.scenarios s));

-- ── 2. Automatic versions (edit bursts + deletes) ───────────────────────────
CREATE OR REPLACE FUNCTION public.snapshot_scenario_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_auto timestamptz;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.state_data IS NOT NULL THEN
      INSERT INTO scenario_versions (scenario_id, borrower_id, owner_account_id, name, type, state_data, calc_summary, kind, label, saved_by, as_of)
      VALUES (OLD.id, OLD.borrower_id, OLD.owner_account_id, OLD.name, OLD.type, OLD.state_data, OLD.calc_summary, 'deleted', 'Deleted', 'system', coalesce(OLD.updated_at, now()));
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.state_data IS DISTINCT FROM OLD.state_data AND OLD.state_data IS NOT NULL THEN
    SELECT max(created_at) INTO last_auto FROM scenario_versions WHERE scenario_id = OLD.id AND kind = 'auto';
    IF last_auto IS NULL OR last_auto < now() - interval '10 minutes' THEN
      INSERT INTO scenario_versions (scenario_id, borrower_id, owner_account_id, name, type, state_data, calc_summary, kind, saved_by, as_of)
      VALUES (OLD.id, OLD.borrower_id, OLD.owner_account_id, OLD.name, OLD.type, OLD.state_data, OLD.calc_summary, 'auto', 'system', coalesce(OLD.updated_at, now()));
      DELETE FROM scenario_versions
       WHERE id IN (SELECT id FROM scenario_versions WHERE scenario_id = OLD.id
                     ORDER BY created_at DESC OFFSET 200);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scenarios_snapshot_version ON public.scenarios;
CREATE TRIGGER scenarios_snapshot_version
  AFTER UPDATE ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_scenario_version();

DROP TRIGGER IF EXISTS scenarios_snapshot_on_delete ON public.scenarios;
CREATE TRIGGER scenarios_snapshot_on_delete
  BEFORE DELETE ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_scenario_version();

-- ── 3. Named version on demand ("Before restore") ───────────────────────────
-- Only for a caller who could read the scenario themselves: the team, a share
-- viewer of a non-hidden row, the owning account, or the service role.
CREATE OR REPLACE FUNCTION public.save_scenario_version(p_scenario_id uuid, p_label text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r   scenarios;
  vid uuid;
  who text;
BEGIN
  IF NOT (
    public.is_team_member()
    OR coalesce(auth.role(), '') = 'service_role'
    OR EXISTS (SELECT 1 FROM scenarios s
                WHERE s.id = p_scenario_id AND s.borrower_visibility <> 'hidden'
                  AND s.borrower_id IN (SELECT public.my_live_shared_borrower_ids()))
    OR EXISTS (SELECT 1 FROM scenarios s
                WHERE s.id = p_scenario_id
                  AND s.owner_account_id IN (SELECT public.my_account_ids()))
  ) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO r FROM scenarios WHERE id = p_scenario_id;
  IF NOT FOUND OR r.state_data IS NULL THEN RETURN NULL; END IF;

  who := CASE WHEN public.is_team_member() THEN 'lo' ELSE 'borrower' END;
  INSERT INTO scenario_versions (scenario_id, borrower_id, owner_account_id, name, type, state_data, calc_summary, kind, label, saved_by, as_of)
  VALUES (r.id, r.borrower_id, r.owner_account_id, r.name, r.type, r.state_data, r.calc_summary, 'named', left(coalesce(p_label, 'Saved version'), 120), who, coalesce(r.updated_at, now()))
  RETURNING id INTO vid;
  RETURN vid;
END;
$$;

REVOKE ALL ON FUNCTION public.save_scenario_version(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_scenario_version(uuid, text) TO authenticated, service_role;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- select tgname from pg_trigger where tgrelid = 'public.scenarios'::regclass and not tgisinternal;
-- select count(*) from public.scenario_versions;
