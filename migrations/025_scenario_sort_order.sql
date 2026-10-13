-- 025: Shared scenario order — the sidebar order the LO and borrower drag.
--
-- Paste into the Supabase SQL Editor (project "loan-pipeline") BY HAND —
-- migrations do NOT auto-apply. Idempotent; safe to re-run. Run AFTER 024.
--
-- (Christo 2026-10-13) Dragging a scenario in the Blueprint sidebar now
-- persists for everyone on the file: the LO writes it through the Ops
-- scenarios API, the borrower through the share link (PATCH /api/share
-- { order: [id, ...] }). Both set sort_order = position. NULL = never
-- ordered; those rows list after every ordered row, in fetch order. Until
-- this runs, LO drags fail and roll back, and the share link answers 409
-- order_unavailable.
--
-- RLS and triggers are unaffected: the visibility guard (023) only watches
-- borrower_visibility, and the version trigger (024) only fires when
-- state_data changes, so a reorder leaves no restore point behind.

ALTER TABLE public.scenarios ADD COLUMN IF NOT EXISTS sort_order integer;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- select column_name, data_type from information_schema.columns
--  where table_schema = 'public' and table_name = 'scenarios' and column_name = 'sort_order';
