-- 026_mcp_handoffs.sql — "Open in Mortgage Blueprint" links created by the
-- public MCP server (api/mcp.js → open_in_blueprint) and opened through
-- GET /api/plan?t=<token> (api/plan.js).
--
-- Paste into the SQL Editor of the Supabase project named "loan-pipeline"
-- (Blueprint's tables live there). Safe to re-run.
--
-- payload holds property + loan fields ONLY — never income or debts (the MCP
-- tool's schema rejects those keys). ip_hash is sha256(ip + CRON_SECRET);
-- the raw IP is never stored.

create table if not exists public.mcp_handoffs (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,            -- 22-char base64url (16 random bytes)
  source_tool text not null,
  client      text not null default 'other',   -- chatgpt | claude | other
  payload     jsonb not null,                  -- property + loan fields ONLY
  ip_hash     text,                            -- sha256(ip + CRON_SECRET), never the raw IP
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days',
  opened_at   timestamptz,
  open_count  int not null default 0
);
create index if not exists mcp_handoffs_created_idx on public.mcp_handoffs (created_at);
alter table public.mcp_handoffs enable row level security;  -- no policies: service key only

-- PostgREST picks up the new table without a restart:
notify pgrst, 'reload schema';
