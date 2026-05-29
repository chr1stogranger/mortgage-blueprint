-- pp_property_pool: accumulating server-side cache of validated sold properties
-- per market. Populated by /api/sold-comps when on-demand discovery runs;
-- read by /api/sold-comps and /api/pp-daily to serve fast cached responses.
--
-- Strategy: every successful property-details fetch with a Sold event from the
-- last 6 months is upserted here. ON CONFLICT (market_id, zpid) DO NOTHING
-- prevents duplicates, so the pool grows monotonically.
--
-- Sold properties older than 6 months become invisible automatically because
-- callers query with WHERE sold_date >= now() - interval '6 months'. We could
-- prune them periodically but it's not required — they just sit there.

CREATE TABLE IF NOT EXISTS public.pp_property_pool (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id       text        NOT NULL,                          -- 'sf', 'alameda', 'oakland', 'berkeley'
  zpid            text        NOT NULL,                          -- Zillow property id (stringified)
  address         text,
  city            text,
  state           text        DEFAULT 'CA',
  zip             text,
  neighborhood    text,
  beds            integer,
  baths           numeric,
  sqft            integer,
  lot_sqft        integer,
  year_built      integer,
  property_type   text,
  list_price      bigint,
  sold_price      bigint      NOT NULL,
  sold_date       date        NOT NULL,
  photo           text,                                          -- primary photo URL
  photos          jsonb,                                         -- array of up to ~6 photo URLs
  description     text,
  latitude        numeric,
  longitude       numeric,
  detail_url      text,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pp_property_pool_unique UNIQUE (market_id, zpid)
);

-- Primary access pattern: read all entries for a market within the last 6 months.
CREATE INDEX IF NOT EXISTS pp_property_pool_market_solddate_idx
  ON public.pp_property_pool (market_id, sold_date DESC);

-- RLS on. No public policies = no client access. The /api/sold-comps and
-- /api/pp-daily serverless functions use the service_role key, which bypasses
-- RLS automatically, so the server side keeps working.
ALTER TABLE public.pp_property_pool ENABLE ROW LEVEL SECURITY;
