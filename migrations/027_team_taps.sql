-- 027_team_taps.sql — one row per tap on a loan officer / agent contact
-- control (POST /api/team-tap, src/lib/teamTap.js), so the placements can be
-- compared: top card vs desktop sidebar vs the phone strip and its sheet.
--
-- Paste into the SQL Editor of the Supabase project named "loan-pipeline"
-- (Blueprint's tables live there). Safe to re-run. Until it runs, taps are
-- dropped silently and nothing else changes.
--
-- Counts only: no share token, no borrower id, no IP, no user agent.

create table if not exists public.team_taps (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  surface    text not null,   -- card | sidebar | rail | strip | sheet
  action     text not null,   -- call | text | email | open (strip opened the sheet)
  who        text,            -- lo | agent (null for open)
  audience   text,            -- partner (/r/<slug>) | borrower (share link)
  device     text,            -- phone | desktop
  partner    text             -- /r/<slug> when the visit came from a partner link
);
create index if not exists team_taps_created_idx on public.team_taps (created_at);
alter table public.team_taps enable row level security;  -- no policies: service key only

notify pgrst, 'reload schema';

-- Which placement gets used (last 30 days):
--   select device, surface, action, who, count(*)
--   from public.team_taps
--   where created_at > now() - interval '30 days'
--   group by 1, 2, 3, 4 order by 1, 5 desc;
