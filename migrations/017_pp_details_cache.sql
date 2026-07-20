-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 017 — pp_details_cache (persistent cache for /api/propertydetails)
-- Run in Supabase SQL Editor (one shot). Safe to re-run (idempotent).
--
-- What this does:
--   /api/propertydetails had only an in-memory Map, which every Vercel cold
--   start wipes — so the same property refetched from RapidAPI over and over.
--   This is the same flaw pp_city_cache fixed for /api/pricepoint, and the
--   same fix. Measured 2026-07-19 while the Redfin plan sat at 85% of quota.
--
--   rc_ (RentCast) rows were already enriched at most once ever, because they
--   persist into pp_property_pool. This table covers the zpid / rf_ rows,
--   which had no persistence at all.
--
-- TTL (24h) is enforced in code by comparing updated_at; rows are overwritten
-- on refresh. Only responses with real content (photos or description) are
-- written — empty results stay uncached so they get retried.
--
-- The API is tolerant of this migration NOT being applied: the Supabase read
-- and write are both wrapped, log once, and fall through to the in-memory
-- cache. Apply this to stop paying for the same lookup twice.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.pp_details_cache (
  cache_key  text primary key,          -- rc_ id for RentCast rows, else zpid
  data       jsonb not null,            -- full /api/propertydetails response body
  updated_at timestamptz not null default now()
);

-- Lets the cleanup below (and any TTL sweep) use an index instead of a scan.
create index if not exists idx_pp_details_cache_updated_at
  on public.pp_details_cache (updated_at);

-- RLS on, no public policies: only the service-role key (server-side) can
-- read/write. The browser never touches this table directly.
alter table public.pp_details_cache enable row level security;
