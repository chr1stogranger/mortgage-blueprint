-- 021: Share links become a guest list.
--
-- Paste into the Supabase SQL Editor (project "loan-pipeline"). Idempotent.
-- Run AFTER 020. The Ops API tolerates this being un-applied (it falls back
-- to the old "anyone with the link" behavior until the function exists).
--
-- Who may open a borrower's share link (signed in, confirmed email):
--   * the borrower's email on file, and the co-borrower email
--   * any email in share_access_emails for that borrower (added by the LO or
--     by an already-allowed borrower from their Team tab)
--   * active team members
-- Everyone else gets "ask your loan officer for access".

-- ── 1. The guest list ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.share_access_emails (
  borrower_id    uuid NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  email          text NOT NULL CHECK (email = lower(email) AND position('@' in email) > 1),
  added_by_role  text NOT NULL CHECK (added_by_role IN ('lo', 'borrower', 'grandfathered')),
  added_by_email text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (borrower_id, email)
);
-- Service key + SECURITY DEFINER functions only.
ALTER TABLE public.share_access_emails ENABLE ROW LEVEL SECURITY;

-- ── 2. One rule, used by the API (via RPC) and by RLS ─────────────────────
CREATE OR REPLACE FUNCTION public.share_email_allowed(p_borrower uuid, p_email text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(trim(p_email), '') <> '' AND (
       EXISTS (SELECT 1 FROM team_members tm
                WHERE tm.active AND lower(tm.email) = lower(trim(p_email)))
    OR EXISTS (SELECT 1 FROM borrowers b
                WHERE b.id = p_borrower
                  AND (lower(b.email) = lower(trim(p_email))
                    OR lower(b.coborrower_email) = lower(trim(p_email))))
    OR EXISTS (SELECT 1 FROM share_access_emails s
                WHERE s.borrower_id = p_borrower AND s.email = lower(trim(p_email)))
  );
$$;
-- Not callable by clients (would let anyone probe who's on a file).
REVOKE ALL ON FUNCTION public.share_email_allowed(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.share_email_allowed(uuid, text) TO service_role;

-- Borrowers whose live share link the signed-in user is allowed on.
CREATE OR REPLACE FUNCTION public.my_allowed_share_borrower_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT lower(u.email) AS e FROM auth.users u
     WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
  )
  SELECT b.id
    FROM borrowers b, me
   WHERE b.share_token IS NOT NULL
     AND (b.share_expires_at IS NULL OR b.share_expires_at > now())
     AND (lower(b.email) = me.e
       OR lower(b.coborrower_email) = me.e
       OR EXISTS (SELECT 1 FROM share_access_emails s
                   WHERE s.borrower_id = b.id AND s.email = me.e));
$$;
REVOKE ALL ON FUNCTION public.my_allowed_share_borrower_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_allowed_share_borrower_ids() TO authenticated;

-- The existing policies call these two; re-point them at the guest list.
-- (Previously: any account linked to the borrower row, which the legacy
-- magic-link flow did for ANY email that arrived via the share token; and
-- 020's share_link_viewers, which admitted anyone holding the link.)
CREATE OR REPLACE FUNCTION public.my_live_shared_borrower_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.my_allowed_share_borrower_ids();
$$;

CREATE OR REPLACE FUNCTION public.my_editable_shared_borrower_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT b.id FROM borrowers b
   WHERE b.id IN (SELECT public.my_allowed_share_borrower_ids())
     AND b.share_access_level IN ('can_adjust', 'full_edit');
$$;

-- ── 3. Grandfather everyone already using a link, so nobody is locked out ─
-- a) signed-in viewers registered since 020
INSERT INTO share_access_emails (borrower_id, email, added_by_role)
SELECT v.borrower_id, lower(u.email), 'grandfathered'
  FROM share_link_viewers v JOIN auth.users u ON u.id = v.auth_user_id
 WHERE u.email IS NOT NULL AND position('@' in u.email) > 1
ON CONFLICT DO NOTHING;
-- b) anyone who has edited a blueprint through a share link
INSERT INTO share_access_emails (borrower_id, email, added_by_role)
SELECT DISTINCT s.borrower_id, lower(trim(c.changed_by_email)), 'grandfathered'
  FROM scenario_changes c JOIN scenarios s ON s.id = c.scenario_id
 WHERE c.changed_by = 'borrower' AND s.borrower_id IS NOT NULL
   AND position('@' in coalesce(c.changed_by_email, '')) > 1
ON CONFLICT DO NOTHING;
-- c) accounts already linked to a borrower row
INSERT INTO share_access_emails (borrower_id, email, added_by_role)
SELECT a.borrower_id, lower(trim(a.email)), 'grandfathered'
  FROM borrower_accounts a
 WHERE a.borrower_id IS NOT NULL AND position('@' in coalesce(a.email, '')) > 1
ON CONFLICT DO NOTHING;
