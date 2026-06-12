-- pp_city_cache — persistent server-side cache for /api/pricepoint responses.
-- The old in-memory Map died on every Vercel cold start, forcing a full
-- ~16-call RapidAPI re-fetch (~20s) per city. This table survives cold starts
-- and is shared across all lambda instances. TTL (24h) is enforced in code
-- by comparing updated_at; rows are simply overwritten on refresh.
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).

create table if not exists pp_city_cache (
  cache_key  text primary key,          -- e.g. "san francisco, ca"
  data       jsonb not null,            -- full /api/pricepoint response body
  updated_at timestamptz not null default now()
);

-- RLS on, no public policies: only the service-role key (server-side) can
-- read/write. The browser never touches this table directly.
alter table pp_city_cache enable row level security;
