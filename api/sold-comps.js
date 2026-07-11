// /api/sold-comps.js — Vercel Serverless Function
//
// POOL-FIRST architecture (introduced 2026-05-28):
// 1. Read pp_property_pool from Supabase, filtered to the city and to
//    sold_date >= NOW() - 6 months.
// 2. If the pool has >= POOL_THRESHOLD entries, return a shuffled slice
//    immediately. No RapidAPI calls. Instant response.
// 3. If the pool is thin, run aggressive discovery (curated zpids + active
//    listing seeds + nearbyHomes harvest), validate with the 6-month cutoff,
//    upsert into the pool, re-read, and return.
//
// The pool grows monotonically with traffic. Once warm, each city serves
// large variety with no RapidAPI burn.
//
// Usage:
//   /api/sold-comps?city=San Francisco                — read pool / grow it
//   /api/sold-comps?city=San Francisco&zip=94112      — pool filtered by zip
//   /api/sold-comps?city=San Francisco&fresh=1        — force discovery pass

import { createClient } from '@supabase/supabase-js';
import { applyCors, isPrivileged } from './_cors.js';
import { rateLimited } from './_ratelimit.js';

// Allow longer execution so multi-page discovery finishes inside the timeout.
export const config = { maxDuration: 60 };

// ─── Supabase admin client (server-side, bypasses RLS) ───
function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── Pool config ───
const POOL_THRESHOLD = 40;                 // below this, run discovery to grow. Raised from 5
                                           // with the RentCast source: one licensed call can fill
                                           // a whole city, so thin pools (like Alameda's stuck-at-5)
                                           // now self-heal on the next organic visit.
const POOL_QUERY_LIMIT = 1000;             // pull up to N pool rows on read
const RESPONSE_SHUFFLE_CAP = 250;          // default shuffled slice size (was 50 — the
                                           // old ceiling that capped Free Play at 50).
                                           // Override per-request with ?limit=N.
// ─── Search-pagination discovery config ───
const SOLD_SEARCH_PAGES = 6;               // recentlySold pages to page through (~40 each)
const ACTIVE_DEDUP_PAGES = 4;              // forSale pages used only to strip relabeled-active
const MIN_SEARCH_YIELD = 12;               // below this, fall back to the next discovery tier
const PRIME_DISCOVERY_MIN = 8;             // if 0-3mo bucket has fewer than this, run a
                                           // search-only freshness top-up on organic visits
const FRESH_COOLDOWN_MS = 6 * 60 * 60 * 1000; // per-warm-instance cooldown between
                                           // freshness-triggered discoveries per market
const RENTCAST_SALE_DAYS = 365;            // "sold within the last N days" window for RentCast discovery
const RENTCAST_PAGE_LIMIT = 500;           // RentCast max records per call — one call seeds a whole city
// TIERED sold-date window:
//   - ingest accepts anything within the last 12 months (broader pool capture)
//   - on read, 0-6mo entries are PREFERRED; 6-12mo entries only fill in when
//     the 0-6mo bucket is below POOL_THRESHOLD
const SOLD_DATE_MONTHS_INGEST = 12;
const SOLD_DATE_MONTHS_PREFERRED = 6;
const SOLD_DATE_MONTHS_PRIME = 3;     // 0-3mo = prime tier, always served first

// Freshness-discovery cooldown, per warm serverless instance. Ephemeral by
// design: cold starts reset it, which just means an occasional extra search.
const freshAttemptAt = {};

// ─── Map city name → market_id used as pool key ───
function cityToMarketId(city) {
  const key = String(city || '').toLowerCase().trim();
  // Must map every shipped market to the SAME short id used by pp_markets
  // (migration 010), the client's LAUNCH_MARKETS, and pp-daily. Multi-word
  // cities that fell through to the raw spaced string ('los angeles', 'san diego')
  // is what split the pool from the Daily (audit 2026-07-09). Re-keyed by
  // migration 012.
  const map = {
    'san francisco': 'sf',
    'alameda': 'alameda',
    'oakland': 'oakland',
    'berkeley': 'berkeley',
    'los angeles': 'la',
    'san diego': 'sd',
    'seattle': 'seattle',
    'miami': 'miami',
    'new york city': 'nyc',
    'new york': 'nyc',
    'chicago': 'chicago',
    'denver': 'denver',
    'portland': 'portland',
    'boston': 'boston',
    'phoenix': 'phoenix',
  };
  return map[key] || key;
}

// ─── Cutoff helpers ───
function monthsAgoDate(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}
function monthsAgoDateStr(months) {
  return monthsAgoDate(months).toISOString().split('T')[0];
}

// ─── Zip-to-neighborhood mapping for curated zpids ───
const ZIP_NEIGHBORHOODS = {
  "94122": "sunset", "94116": "sunset", "94121": "sunset_richmond",
  "94118": "richmond",
  "94110": "mission",
  "94114": "noe",
  "94115": "pachts",
  "94107": "soma",
  "94112": "excelsior",
  "94103": "soma",        // SOMA extends into 94103
  "94102": "hayes",       // Hayes Valley
  "94123": "marina",      // Marina
  "94124": "bayview",     // Bayview
  "94131": "twinpeaks",   // Twin Peaks / Glen Park
};

// ─── VERIFIED zpids — confirmed working with RapidAPI property-details March 2026 ───
// These are the ONLY zpids we KNOW return valid data. Always fetch these first.
const VERIFIED_ZPIDS = {
  "san francisco": {
    // Richmond (confirmed: 659 12th Ave $4.95M, etc.)
    richmond: ["15098085", "15094834", "15091588"],
    // Sunset (confirmed: 1495 21st Ave $2.93M, etc.)
    sunset: ["15105418", "15095869", "15115454"],
    // Mission / Bernal Heights (confirmed: 115 Ellsworth $2.63M, etc.)
    mission: ["15161966", "15150065", "15162139"],
    // Noe Valley
    noe: ["15182650", "15132286", "460322503"],
    // Pacific Heights
    pachts: ["15080888", "15082566", "15074528"],
    // Excelsior (confirmed: 907 Athens St)
    excelsior: ["15177062", "15167859", "15167742"],
  },
};

// ─── Additional UNVERIFIED zpids — may or may not work, used as fallback ───
// These extend neighborhood coverage but haven't been individually confirmed.
const EXTRA_ZPIDS = {
  "san francisco": {
    sunset: ["15092973", "15106327", "15120027", "15126338", "15108844", "15111975"],
    richmond: ["184816884", "15089898", "15094989", "15088761", "15090133"],
    sunset_richmond: ["15083291", "15086455", "15084819"],
    mission: ["15161587", "15164646", "15163900", "15160233", "15158901"],
    noe: ["460896185", "15133901", "15131455", "15134688"],
    pachts: ["121339149", "15079201", "15081345", "15076912"],
    soma: ["79842917", "80747470", "79846879", "80743387", "79844512"],
    hayes: ["15067233", "15069891", "15068455", "15070612"],
    excelsior: ["15169891", "15176420", "15174980", "15168533"],
    marina: ["15057901", "15059244", "15058612", "15060388"],
    bayview: ["15185901", "15187233", "15186455", "15188612"],
    twinpeaks: ["15140233", "15142588", "15141455", "15143312"],
  },
};

// Get zpids for a city — verified first, then extras
function getZpidsForCity(city) {
  const key = city.toLowerCase().trim();
  const verified = VERIFIED_ZPIDS[key] || {};
  const extras = EXTRA_ZPIDS[key] || {};
  // Verified zpids come first so they're always in the fetch batch
  const verifiedList = Object.values(verified).flat();
  const extraList = Object.values(extras).flat();
  return { verified: verifiedList, extras: extraList, all: [...verifiedList, ...extraList] };
}

// Get zpids for a specific zip code — verified first
function getZpidsForZip(city, zip) {
  const key = city.toLowerCase().trim();
  const verified = VERIFIED_ZPIDS[key] || {};
  const extras = EXTRA_ZPIDS[key] || {};

  const hoodKey = ZIP_NEIGHBORHOODS[zip];
  if (!hoodKey) return { verified: [], extras: [], all: [] };

  const matchHood = (name) => name === hoodKey || name.includes(hoodKey) || hoodKey.includes(name);

  const vList = [];
  for (const [name, list] of Object.entries(verified)) {
    if (matchHood(name)) vList.push(...list);
  }
  const eList = [];
  for (const [name, list] of Object.entries(extras)) {
    if (matchHood(name)) eList.push(...list);
  }
  return { verified: vList, extras: eList, all: [...vList, ...eList] };
}

// ─── Discovered zpids cache — persists across warm invocations ───
const discoveredZpids = new Map(); // zip → Set of discovered zpids

// ─── TEMP: candidate sold-data host evaluation probe ───
// GET /api/sold-comps?hosttest=usre|redfin&hzip=94116
// Makes ONE call to the candidate RapidAPI host and returns aggregate
// freshness/volume/photo stats + a truncated raw sample for field mapping.
// No user data; 10-min in-memory result cache limits upstream burn.
// REMOVE after the source decision (see PricePoint provider research doc).
const hostTestCache = new Map(); // key → { at, body }
const HOSTTEST_PATHS = {
  usre: {
    host: 'us-real-estate.p.rapidapi.com',
    paths: (zip) => [
      `/v2/sold-homes-by-zipcode?zip_code=${zip}&offset=0&limit=50&sort=sold_date&max_sold_days=90`,
      `/v2/sold-homes-by-zipcode?zipcode=${zip}&offset=0&limit=50`,
      `/v2/sold-homes-by-zipcode?postal_code=${zip}&offset=0&limit=50&sort=sold_date`,
      `/sold-homes?city=San%20Francisco&state_code=CA&offset=0&limit=50&sort=sold_date&max_sold_days=90`,
      `/v2/sold-homes?city=San%20Francisco&state_code=CA&offset=0&limit=50&sort=sold_date`,
    ],
  },
  redfin: {
    host: 'redfin-com-data.p.rapidapi.com',
    paths: (zip) => [
      `/properties/search-sold?location=${zip}&limit=50&soldWithin=90`,
      `/property/search-sold?location=${zip}`,
    ],
  },
};

function hostTestExtractList(data) {
  const cands = [
    data?.data?.home_search?.results, data?.data?.results, data?.results,
    data?.data?.homes, data?.homes, data?.data, data?.properties,
  ];
  for (const c of cands) if (Array.isArray(c) && c.length) return c;
  return Array.isArray(data) ? data : [];
}

function hostTestNormalize(item) {
  const soldDate = item?.description?.sold_date || item?.last_sold_date || item?.soldDate
    || item?.sold_date || item?.lastSoldDate || item?.soldDateTime || null;
  const soldPrice = item?.description?.sold_price || item?.last_sold_price || item?.soldPrice
    || item?.sold_price || item?.price?.value || item?.price || null;
  const addr = item?.location?.address?.line || item?.address?.line || item?.streetLine?.value
    || item?.streetLine || item?.address || null;
  const photo = item?.primary_photo?.href || item?.photos?.[0]?.href || item?.imgSrc
    || item?.photos?.[0] || item?.primaryPhotoDisplayLevel || null;
  return { soldDate, soldPrice, addr: typeof addr === 'string' ? addr : JSON.stringify(addr || '').slice(0, 60), hasPhoto: !!photo };
}

async function handleHostTest(req, res) {
  const which = String(req.query.hosttest);
  const zip = String(req.query.hzip || '94116').replace(/[^0-9]/g, '').slice(0, 5) || '94116';
  const cfg = HOSTTEST_PATHS[which];
  if (!cfg) return res.status(400).json({ error: 'hosttest must be usre or redfin' });
  const cacheKey = `${which}:${zip}`;
  const hit = hostTestCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return res.status(200).json(hit.body);
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return res.status(500).json({ error: 'no RAPIDAPI_KEY' });

  const attempts = [];
  for (const path of cfg.paths(zip)) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      let r, text;
      try {
        r = await fetch(`https://${cfg.host}${path}`, {
          headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': cfg.host },
          signal: controller.signal,
        });
        text = await r.text();
      } finally { clearTimeout(timer); }
      if (!r.ok) { attempts.push({ path, status: r.status, body: text.slice(0, 200) }); continue; }
      let data; try { data = JSON.parse(text); } catch { attempts.push({ path, status: r.status, body: 'non-JSON' }); continue; }
      const list = hostTestExtractList(data);
      if (list.length === 0) {
        attempts.push({ path, status: r.status, empty: true, rawTopLevel: text.slice(0, 900) });
        continue;
      }
      const norm = list.map(hostTestNormalize);
      const dated = norm.filter(n => n.soldDate && n.soldPrice);
      const daysAgo = (ds) => Math.round((Date.now() - new Date(ds)) / 86400000);
      const body = {
        host: cfg.host, path, status: r.status, zip,
        rawCount: list.length,
        usable: dated.length,
        withPhoto: norm.filter(n => n.hasPhoto).length,
        newestDaysAgo: dated.length ? Math.min(...dated.map(n => daysAgo(n.soldDate))) : null,
        oldestDaysAgo: dated.length ? Math.max(...dated.map(n => daysAgo(n.soldDate))) : null,
        sample: dated.slice(0, 5).map(n => ({ addr: n.addr, soldDate: String(n.soldDate).slice(0, 10), soldPrice: n.soldPrice, hasPhoto: n.hasPhoto })),
        rawFirstItemKeys: list[0] ? Object.keys(list[0]).slice(0, 25) : [],
        rawFirstItem: list[0] ? JSON.stringify(list[0]).slice(0, 700) : null,
        attempts,
      };
      hostTestCache.set(cacheKey, { at: Date.now(), body });
      return res.status(200).json(body);
    } catch (e) {
      attempts.push({ path, error: String(e.message || e).slice(0, 160) });
    }
  }
  const body = { host: cfg.host, zip, error: 'all paths failed', attempts };
  hostTestCache.set(cacheKey, { at: Date.now(), body });
  return res.status(200).json(body);
}

export default async function handler(req, res) {
  // Shared scoped CORS (now also covers the Capacitor native origins) + rate limit.
  if (applyCors(req, res)) return;
  if (rateLimited(req, res, { limit: 20 })) return;

  if (req.query.hosttest) return handleHostTest(req, res);

  try {
    const { city, zip, fresh, exclude } = req.query;
    if (!city) {
      return res.status(400).json({ error: "Missing ?city=San Francisco" });
    }

    const marketId = cityToMarketId(city);
    // ?fresh=1 forces a multi-page RapidAPI discovery pass — the most expensive
    // thing this API can do. Unauthenticated callers could use it to burn the
    // RapidAPI quota (CIO audit H-2), so it now requires the CRON_SECRET
    // (the pool-seed cron sends it). For everyone else the flag is ignored and
    // the request is served from the pool as normal — discovery still runs
    // automatically whenever the pool is genuinely thin.
    const forceDiscover = fresh === "1" && isPrivileged(req);
    // freshsearch=1 (privileged): force a search-ONLY discovery — Zillow
    // recentlySold, no RentCast. Used by the DAILY cron so fresh sales flow in
    // without burning RentCast's monthly quota (county records lag anyway).
    const forceFreshSearch = req.query.freshsearch === "1" && isPrivileged(req);
    const ingestCutoff = monthsAgoDate(SOLD_DATE_MONTHS_INGEST);
    const ingestCutoffStr = monthsAgoDateStr(SOLD_DATE_MONTHS_INGEST);
    const preferredCutoff = monthsAgoDate(SOLD_DATE_MONTHS_PREFERRED);
    const primeCutoff = monthsAgoDate(SOLD_DATE_MONTHS_PRIME);

    const excludeSet = new Set();
    if (exclude) exclude.split(",").forEach(z => excludeSet.add(z.trim()));

    // How many to return this request. Defaults to RESPONSE_SHUFFLE_CAP (250),
    // clamped to [10, 500]. Lets the client ask for more or fewer via ?limit=N.
    const responseCap = Math.min(500, Math.max(10, parseInt(req.query.limit, 10) || RESPONSE_SHUFFLE_CAP));

    // ─── TEMP PROBE: &probe=1 (owner-only) ───
    // Calls the RentCast /v1/properties endpoint and dumps a redacted shape
    // summary so we can confirm the mapper. REMOVE once verified.
    // Gated behind CRON_SECRET so anonymous callers can't trigger raw
    // provider calls or read response internals (CIO audit H-2 / L-2).
    if (req.query.probe === '1' && isPrivileged(req)) {
      const rcKey = process.env.RENTCAST_API_KEY;
      if (!rcKey) return res.status(500).json({ error: 'RENTCAST_API_KEY not configured' });
      const url = `https://api.rentcast.io/v1/properties?city=${encodeURIComponent(city)}&state=CA&saleDateRange=${RENTCAST_SALE_DAYS}&limit=50&offset=0`;
      try {
        const r = await fetch(url, { headers: { 'X-Api-Key': rcKey, 'Accept': 'application/json' } });
        const text = await r.text();
        let json = null; try { json = JSON.parse(text); } catch {}
        const results = Array.isArray(json) ? json : [];
        const rows = results.map(d => rentcastRecordToPoolRow(d, marketId, ingestCutoff)).filter(Boolean);
        const r0 = rows[0] || null;
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({
          httpStatus: r.status,
          rawResultCount: results.length,
          mappedRowCount: rows.length,
          firstMappedRow: r0 ? {
            zpid: r0.zpid, city: r0.city, state: r0.state, zip: r0.zip,
            beds: r0.beds, baths: r0.baths, sqft: r0.sqft, year_built: r0.year_built,
            sold_price: r0.sold_price, sold_date: r0.sold_date,
            property_type: r0.property_type, lat: r0.latitude, lon: r0.longitude,
          } : null,
          rawBodyIfEmpty: rows.length === 0 ? text.slice(0, 300) : undefined,
        });
      } catch (e) { return res.status(200).json({ error: e.message }); }
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    // ─── 1. Read pool (12-month ingest window, then partition) ───
    // selectFromPool returns an object split into 'fresh' (within 6 months) and
    // 'older' (6-12 months). Callers prefer fresh; older is fallback only.
    async function readPool() {
      let q = supabase
        .from('pp_property_pool')
        .select('*')
        .eq('market_id', marketId)
        .gte('sold_date', ingestCutoffStr)
        .limit(POOL_QUERY_LIMIT);
      if (zip) q = q.eq('zip', zip);
      const { data, error } = await q;
      if (error) {
        console.error('[SoldComps] Pool read error:', error.message);
        return { prime: [], fresh: [], older: [], all: [] };
      }
      // Cull non-playable cards (0-bed/non-residential) on read too, so junk
      // already persisted in the pool never reaches a player — no migration.
      const rows = (data || []).filter(r => !excludeSet.has(String(r.zpid)) && isPlayableRow(r));
      // Three-way recency partition: prime (0-3mo) > fresh (3-6mo) > older (6-12mo)
      const prime = rows.filter(r => new Date(r.sold_date) >= primeCutoff);
      const fresh = rows.filter(r => {
        const d = new Date(r.sold_date);
        return d >= preferredCutoff && d < primeCutoff;
      });
      const older = rows.filter(r => new Date(r.sold_date) < preferredCutoff);
      return { prime, fresh, older, all: rows };
    }

    // Pick the best slice given a {prime, fresh, older} pool.
    // Recency-tiered: shuffled prime (0-3mo) first, then shuffled fresh
    // (3-6mo), then shuffled older (6-12mo). responseCap slices from the
    // front, so the OLDEST rows are always the first to be cut.
    function pickShuffledSlice(p) {
      const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
      const fresh6 = p.prime.length + p.fresh.length; // 0-6mo count
      const combined = [...shuffle(p.prime), ...shuffle(p.fresh), ...shuffle(p.older)];
      const rows = combined.slice(0, responseCap);
      const tier =
        fresh6 >= POOL_THRESHOLD ? 'fresh' :
        fresh6 === 0 ? 'older-only' : 'mixed';
      return { rows, tier };
    }

    let pool = await readPool();
    // 'Healthy' = enough entries in the 0-6mo window. A pool stuffed with
    // stale 6-12mo sales is NOT healthy — it must trigger discovery so
    // recent comps keep flowing. (Was: total 12-month count.)
    const totalSize = pool.all.length;
    const fresh6Size = pool.prime.length + pool.fresh.length;

    // RentCast quota guard: if this market already has RentCast rows, a repeat
    // discovery won't find more — RentCast already gave us everything it had.
    // Without this, a small city stuck below POOL_THRESHOLD would burn one
    // RentCast request on EVERY visit. Only the weekly cron (fresh=1) refreshes.
    const alreadyRentcasted = pool.all.some(r => String(r.zpid).startsWith('rc_'));

    // Discovery triggers:
    //  - forceDiscover / forceFreshSearch (privileged cron)
    //  - bulk-thin: fewer than POOL_THRESHOLD 0-6mo rows AND market not yet
    //    RentCast-seeded (the quota guard)
    //  - prime-thin: fewer than PRIME_DISCOVERY_MIN 0-3mo rows — even for
    //    seeded markets — but search-only and cooldown-guarded, so a market
    //    with genuinely few recent sales doesn't re-search on every visit.
    const bulkHealthy = fresh6Size >= POOL_THRESHOLD || alreadyRentcasted;
    // Cooldown key includes the zip: a Sunset top-up shouldn't freeze
    // freshness discovery for Richmond/Noe/citywide for 6 hours.
    const freshKey = zip ? `${marketId}:${zip}` : marketId;
    const cooledDown = (Date.now() - (freshAttemptAt[freshKey] || 0)) > FRESH_COOLDOWN_MS;
    const primeThin = pool.prime.length < PRIME_DISCOVERY_MIN;
    const needDiscovery = forceDiscover || forceFreshSearch || !bulkHealthy || (primeThin && cooledDown);

    if (!needDiscovery) {
      const { rows: shuffled, tier } = pickShuffledSlice(pool);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        soldListings: shuffled.map(poolRowToListing),
        count: shuffled.length,
        city,
        zip: zip || null,
        poolSize: totalSize,
        poolPrimeSize: pool.prime.length,
        poolFreshSize: pool.prime.length + pool.fresh.length,
        poolOlderSize: pool.older.length,
        servedTier: tier,
        source: 'pool',
        hasMore: totalSize > shuffled.length,
        timestamp: new Date().toISOString(),
      });
    }

    // ─── 2. Pool is thin (or fresh=1) — run discovery to grow it ───
    const apiKey = process.env.RAPIDAPI_KEY;
    const apiHost = process.env.RAPIDAPI_HOST || "real-time-real-estate-data.p.rapidapi.com";
    if (!apiKey) {
      // No discovery possible — return whatever the pool has, even if thin.
      const { rows: shuffled, tier } = pickShuffledSlice(pool);
      return res.status(200).json({
        soldListings: shuffled.map(poolRowToListing),
        count: shuffled.length,
        city,
        zip: zip || null,
        poolSize: pool.all.length,
        poolPrimeSize: pool.prime.length,
        poolFreshSize: pool.prime.length + pool.fresh.length,
        poolOlderSize: pool.older.length,
        servedTier: tier,
        source: 'pool-only-no-apikey',
        hasMore: false,
      });
    }

    console.error(`[SoldComps] Discovery for ${marketId} (prime=${pool.prime.length}, fresh6=${fresh6Size}, all=${pool.all.length}, forced=${forceDiscover || forceFreshSearch})...`);
    freshAttemptAt[freshKey] = Date.now();

    const poolZpidSet = new Set(pool.all.map(r => String(r.zpid)));

    // ─── PRIMARY: Zillow recentlySold search — the FRESHNESS source ───
    // Zillow shows sales within days of closing; RentCast county records lag
    // 2-4 months. Search always runs first so yesterday's sales enter the
    // pool. ~40 sold listings per page, no per-zpid detail calls.
    const sr = await discoverSoldViaSearch(
      city, apiKey, apiHost, marketId, ingestCutoff, excludeSet, poolZpidSet, zip
    );
    let newRows = sr.rows;
    let discoverySource = 'search';
    let funnelDbg = { searchRows: newRows.length, searchRetry: sr.retryZpids.length };

    // ─── SECONDARY: RentCast /v1/properties — the VOLUME seeder ───
    // Licensed county-record sales (up to 500/call) — fills whole cities like
    // Alameda/Berkeley. Monthly-quota-limited, so: never for freshsearch (the
    // daily cron), and otherwise same policy as before — weekly forceDiscover,
    // or a not-yet-seeded market.
    if (!forceFreshSearch && (forceDiscover || !alreadyRentcasted)) {
      const haveSet = new Set([...poolZpidSet, ...newRows.map(r => String(r.zpid))]);
      const rc = await discoverSoldViaRentCast(
        city, marketId, ingestCutoff, excludeSet, haveSet
      );
      if (rc.rows.length > 0) {
        newRows = [...newRows, ...rc.rows];
        discoverySource += '+rentcast';
      }
      funnelDbg.rcRows = rc.rows.length;
      funnelDbg.rcDiag = rc.diag;
    }

    // ─── TERTIARY: property-details funnel — the TRUSTED validator ───
    // Per-zpid detail calls read Zillow priceHistory (real sold date + price).
    // The search feed's unvalidated recentlySold zpids go in as PRIORITY
    // candidates: that's where the newest genuine sales are (this host's
    // search payload rarely carries usable dateSold, so search alone can't
    // ingest them). Runs for freshsearch too — search-only would yield ~0.
    if (newRows.length < MIN_SEARCH_YIELD) {
      const haveSet2 = new Set([...poolZpidSet, ...newRows.map(r => String(r.zpid))]);
      const fb = await discoverViaPropertyDetails(
        city, zip, apiKey, apiHost, marketId, ingestCutoff, excludeSet, haveSet2, sr.retryZpids, supabase
      );
      if (fb.rows.length > 0) {
        newRows = [...newRows, ...fb.rows];
        discoverySource += '+details';
      }
      funnelDbg = { ...funnelDbg, ...fb.funnel };
    }

    // ─── Upsert into pool (dedup by market_id + zpid) ───
    if (newRows.length > 0) {
      const { error: upsertErr } = await supabase
        .from('pp_property_pool')
        .upsert(newRows, { onConflict: 'market_id,zpid', ignoreDuplicates: true });
      if (upsertErr) {
        console.error('[SoldComps] Pool upsert error:', upsertErr.message);
      } else {
        console.error(`[SoldComps] Inserted ${newRows.length} new rows into pool for ${marketId} (via ${discoverySource})`);
      }
    }

    // ─── Re-read pool and return ───
    pool = await readPool();
    const { rows: shuffled, tier } = pickShuffledSlice(pool);

    console.error(`[SoldComps] ${marketId}${zip ? ` zip=${zip}` : ''}: added ${newRows.length} via ${discoverySource}, pool now prime=${pool.prime.length} fresh=${pool.fresh.length} older=${pool.older.length}`);

    res.setHeader("Cache-Control", "no-store");
    const responseBody = {
      soldListings: shuffled.map(poolRowToListing),
      count: shuffled.length,
      city,
      zip: zip || null,
      poolSize: pool.all.length,
      poolPrimeSize: pool.prime.length,
      poolFreshSize: pool.prime.length + pool.fresh.length,
      poolOlderSize: pool.older.length,
      servedTier: tier,
      newlyAdded: newRows.length,
      discoverySource,
      source: 'pool+discovery',
      hasMore: pool.all.length > shuffled.length,
      timestamp: new Date().toISOString(),
    };
    // debug funnel internals are owner-only (CIO audit L-2)
    if (req.query.debug === '1' && isPrivileged(req)) {
      responseBody.funnel = { ...funnelDbg, ingestCutoffStr };
    }
    return res.status(200).json(responseBody);
  } catch (err) {
    console.error("[SoldComps] Error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Convert a pp_property_pool row into the listing shape the client expects ───
// Mirrors the inline object the pre-pool code used to build per fetch result.
function poolRowToListing(r) {
  return {
    id: `sc${r.id || r.zpid}`,
    zpid: String(r.zpid),
    address: r.address || 'Unknown',
    city: r.city || '',
    state: r.state || 'CA',
    zip: r.zip || '',
    beds: r.beds || 0,
    baths: r.baths || 0,
    sqft: r.sqft || 0,
    lotSqft: r.lot_sqft || 0,
    yearBuilt: r.year_built || null,
    propertyType: r.property_type || 'Single Family',
    // Read-guard: a stored list_price wildly below the sold price is rental
    // contamination from Zillow enrichment (e.g. $5,600/mo rent persisted as
    // "list price" on a $1.05M sale). Treat it as unknown → fall back to sold.
    listPrice: (r.list_price && r.list_price >= 50000 && (!r.sold_price || r.list_price >= r.sold_price * 0.2))
      ? r.list_price : r.sold_price,
    zestimate: null,
    soldPrice: r.sold_price,
    soldDate: r.sold_date,
    daysOnMarket: 0,
    status: 'sold',
    photo: isUsablePhoto(r.photo) ? r.photo : null,
    photos: Array.isArray(r.photos) ? r.photos.filter(isUsablePhoto).slice(0, 6) : [],
    // cleanNeighborhood on READ too — scrubs the legal-parcel junk already
    // persisted in existing pool rows without needing a migration.
    neighborhood: cleanNeighborhood(r.neighborhood) || '',
    pricePerSqft: (r.sqft && r.sold_price) ? Math.round(r.sold_price / r.sqft) : 0,
    latitude: r.latitude || null,
    longitude: r.longitude || null,
    // Read-guard: descriptions that read like rental listings (Zillow page was
    // a for-rent listing when enriched) confuse the sold-price guessing game.
    description: (r.description && /lease type|rent due|notice period|security deposit|monthly rent|per month|application fee|pet deposit/i.test(r.description))
      ? '' : (r.description || ''),
    detailUrl: r.detail_url || null,
    _source: 'sold_comps',
  };
}

// ─── Shape-tolerant extraction of a search response's listing array ───
function extractSearchList(data) {
  return Array.isArray(data?.data) ? data.data
    : Array.isArray(data?.results) ? data.results
    : Array.isArray(data?.props) ? data.props
    : Array.isArray(data?.searchResults) ? data.searchResults
    : Array.isArray(data?.data?.results) ? data.data.results
    : Array.isArray(data) ? data
    : [];
}

// ─── Normalize a sold date (ms-number or string) to YYYY-MM-DD, or null ───
function normalizeSoldDateStr(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const d = typeof raw === 'number' ? new Date(raw) : new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

// ─── Page the search endpoint (40/page) until exhausted or maxPages hit ───
// De-dupes by zpid across pages; stops early when a page adds nothing new or
// returns a partial page (guards an endpoint that ignores &page).
async function searchPages(location, status, apiKey, apiHost, maxPages) {
  const out = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({ location, status });
    if (page > 1) params.set('page', String(page));
    const url = `https://${apiHost}/search?${params}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let data;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost },
        signal: controller.signal,
      });
      if (!res.ok) break;
      data = await res.json();
    } catch {
      break;
    } finally {
      clearTimeout(timer);
    }
    const list = extractSearchList(data);
    if (list.length === 0) break;
    let added = 0;
    for (const it of list) {
      const z = String(it?.zpid || '');
      if (z && seen.has(z)) continue;
      if (z) seen.add(z);
      out.push(it);
      added++;
    }
    if (added === 0) break;          // nothing new — exhausted/looping
    if (list.length < 20) break;     // partial page → likely the last
  }
  return out;
}

// ─── Convert a search-endpoint sold item into a pp_property_pool row ───
function searchItemToPoolRow(d, marketId, soldPrice, soldDate) {
  let lot = null;
  if (d.lotAreaValue) {
    lot = (d.lotAreaUnit === 'acres' || d.lotAreaUnits === 'acres')
      ? Math.round(d.lotAreaValue * 43560)
      : Math.round(d.lotAreaValue);
  }
  const rawPhoto = d.imgSrc || d.hiResImageLink || null;
  const photo = isUsablePhoto(rawPhoto) ? rawPhoto : null;
  return {
    market_id: marketId,
    zpid: String(d.zpid),
    address: d.streetAddress || d.address || null,
    city: d.city || null,
    state: d.state || 'CA',
    zip: d.zipcode || null,
    neighborhood: d.buildingName || null,
    beds: d.bedrooms || null,
    baths: d.bathrooms || null,
    sqft: d.livingArea || null,
    lot_sqft: lot,
    year_built: d.yearBuilt || null,
    property_type: normalizeHomeType(d.homeType),
    list_price: d.listPrice || d.originalListPrice || soldPrice,
    sold_price: soldPrice,
    sold_date: soldDate,
    photo,
    photos: photo ? [photo] : [],
    description: d.description || null,
    latitude: d.latitude || null,
    longitude: d.longitude || null,
    detail_url: d.detailUrl || (d.hdpUrl ? `https://www.zillow.com${d.hdpUrl}` : null),
  };
}

// ─── PRIMARY discovery: RentCast /v1/properties (licensed county records) ───
// Returns up to 500 properties sold within RENTCAST_SALE_DAYS in ONE call,
// with sold price + date, beds/baths/sqft, year built, property type and
// lat/lng. Explicit display rights (no MLS-photo copyright exposure); records
// carry no photos — the client falls back to the Mapbox map slide and the
// NO_PHOTO placeholder. Works for ANY CA city, no curated zpid list.
async function discoverSoldViaRentCast(city, marketId, ingestCutoff, excludeSet, poolZpidSet) {
  const rcKey = process.env.RENTCAST_API_KEY;
  // diag is surfaced via ?debug=1 so failures are visible without server logs.
  const diag = { status: null, body: null, raw: 0 };
  if (!rcKey) { diag.body = 'no RENTCAST_API_KEY'; return { rows: [], diag }; }
  // NOTE: RentCast's city parameter is case-sensitive — normalize to Title Case.
  const cityParam = String(city).trim().replace(/\w\S*/g, t => t[0].toUpperCase() + t.slice(1).toLowerCase());
  const url = `https://api.rentcast.io/v1/properties?city=${encodeURIComponent(cityParam)}&state=CA&saleDateRange=${RENTCAST_SALE_DAYS}&limit=${RENTCAST_PAGE_LIMIT}&offset=0`;
  let results = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let r, text;
    try {
      r = await fetch(url, { headers: { 'X-Api-Key': rcKey, 'Accept': 'application/json' }, signal: controller.signal });
      text = await r.text();
    } finally { clearTimeout(timer); }
    diag.status = r.status;
    if (!r.ok) { diag.body = text.slice(0, 160); return { rows: [], diag }; }
    try { results = JSON.parse(text); } catch { diag.body = 'non-JSON response'; return { rows: [], diag }; }
    if (!Array.isArray(results)) { diag.body = text.slice(0, 160); return { rows: [], diag }; }
  } catch (e) {
    diag.body = String(e && e.message || e).slice(0, 160);
    return { rows: [], diag };
  }
  diag.raw = results.length;
  const rows = [];
  const seen = new Set();
  for (const d of results) {
    const row = rentcastRecordToPoolRow(d, marketId, ingestCutoff);
    if (!row) continue;
    if (seen.has(row.zpid) || excludeSet.has(row.zpid) || poolZpidSet.has(row.zpid)) continue;
    seen.add(row.zpid);
    rows.push(row);
  }
  console.error(`[SoldComps] rentcast discovery ${marketId}: raw=${results.length} kept=${rows.length} (status=${diag.status})`);
  return { rows, diag };
}

// County "subdivision" values are often legal parcel descriptions, not
// neighborhood names ("PARCEL MAP OF 987 DE HARO STREET", "TRACT 7512",
// "LOT 4 BLOCK A" …). Those leak into the card AND the challenge share text.
// Only pass through values that plausibly read like a neighborhood.
function cleanNeighborhood(name) {
  if (!name || typeof name !== 'string') return null;
  const n = name.trim();
  if (n.length < 3 || n.length > 40) return null;
  if (/\d{3,}/.test(n)) return null; // long digit runs = legal/parcel refs
  if (/\b(PARCEL|MAP|TRACT|LOT|BLOCK|SURVEY|SUBDIVISION|RESUB|PORTION|ASSESSOR|RECORD|FILED|CONDO PLAN|PLAN NO)\b/i.test(n)) return null;
  return n;
}

// A property makes a sensible price-guessing card only if it's a recognizable
// home with beds and living area. We INCLUDE Multi-Family (RentCast's tag for
// 2-4 unit residential — duplex/triplex/fourplex, financeable as residential
// and prime lead-gen). We EXCLUDE "Apartment" (5+ unit commercial buildings),
// "Land" (no structure), and 0-bed rows (almost always mislabeled multi-unit /
// commercial like a "0 bed, 1,750 sqft" building, not real studios).
// Used at BOTH ingest and read so existing junk is culled too.
const PLAYABLE_TYPES = new Set(['Single Family', 'Condo', 'Townhouse', 'Manufactured', 'Multi-Family']);
function isPlayableRow(r) {
  const beds = r.beds;
  const sqft = r.sqft;
  const type = r.property_type;
  if (beds == null || beds < 1) return false;
  if (!sqft || sqft < 300) return false;
  if (type && !PLAYABLE_TYPES.has(type)) return false;
  return true;
}

// Map one RentCast property record → pp_property_pool row. Returns null when
// the record has no usable sale, is outside the ingest window, or wouldn't
// make a sensible game card.
function rentcastRecordToPoolRow(d, marketId, ingestCutoff) {
  const soldPrice = d.lastSalePrice || null;
  const soldDate = normalizeSoldDateStr(d.lastSaleDate || null);
  if (!soldPrice || !soldDate) return null;
  if (new Date(soldDate) < ingestCutoff) return null;
  if (!d.id) return null;
  if (soldPrice < 50000) return null;                // family transfers / non-arms-length noise
  // Quality gate (residential, ≥1 bed, real living area) — see isPlayableRow.
  if (!isPlayableRow({ beds: d.bedrooms, sqft: d.squareFootage, property_type: d.propertyType })) return null;
  // RentCast ids are address slugs — prefix so they can't collide with zpids.
  const zpid = `rc_${d.id}`;
  return {
    market_id: marketId,
    zpid,
    address: d.addressLine1 || d.formattedAddress || null,
    city: d.city || null,
    state: d.state || 'CA',
    zip: d.zipCode || null,
    neighborhood: cleanNeighborhood(d.subdivision),
    beds: d.bedrooms ?? null,
    baths: d.bathrooms ?? null,
    sqft: d.squareFootage || null,
    lot_sqft: d.lotSize || null,
    year_built: d.yearBuilt || null,
    property_type: d.propertyType || 'Single Family',
    list_price: soldPrice,            // county records carry no list price
    sold_price: soldPrice,
    sold_date: soldDate,
    photo: null,                      // no photos in licensed records — client
    photos: [],                       // shows Mapbox map slide + placeholder
    description: null,
    latitude: d.latitude || null,
    longitude: d.longitude || null,
    detail_url: null,
  };
}

// ─── SECONDARY discovery: paginate recentlySold, dedup against active ───
// Works for ANY city with no curated zpid lists. Returns pool-ready rows.
async function discoverSoldViaSearch(city, apiKey, apiHost, marketId, ingestCutoff, excludeSet, poolZpidSet, zip = null) {
  // Zip-scoped when the caller asked for a specific neighborhood — a zip
  // search surfaces that zip's newest sales instead of burying them in a
  // ~250-item citywide feed.
  const location = zip ? String(zip) : `${city}, CA`;
  const [activeItems, soldItems] = await Promise.all([
    searchPages(location, 'forSale', apiKey, apiHost, ACTIVE_DEDUP_PAGES),
    searchPages(location, 'recentlySold', apiKey, apiHost, SOLD_SEARCH_PAGES),
  ]);
  const activeZpids = new Set(activeItems.map(r => String(r?.zpid)).filter(Boolean));

  const rows = [];
  const seen = new Set();
  // zpids the feed CLAIMS sold but couldn't be validated from the search
  // payload alone (missing date, or unproven active-overlap). These are the
  // best candidates for per-zpid property-details validation — the newest
  // genuine sales live here, in feed order (newest first).
  const retryZpids = [];
  let rejRelabeled = 0, rejNoSoldData = 0, rejTooOld = 0, keptProven = 0;
  for (const d of soldItems) {
    const zpid = String(d?.zpid || '');
    if (!zpid || seen.has(zpid)) continue;
    if (excludeSet.has(zpid) || poolZpidSet.has(zpid)) continue;
    const soldPrice = d.price || d.lastSoldPrice || null;
    const soldDate = normalizeSoldDateStr(d.dateSold || d.lastSoldDate || null);
    if (activeZpids.has(zpid)) {
      // A zpid in BOTH feeds is usually relabeled-active garbage (a fake
      // "sold" whose price is just the list price). BUT the freshest REAL
      // sales also overlap the stale forSale cache — a home that sold
      // yesterday was for sale until yesterday. Blanket-rejecting these was
      // silently discarding every brand-new sale (SF: relabeled=164, kept=0).
      // Keep the listing only when it can PROVE the sale: a real sold date
      // plus a sold price that differs from its list price (garbage rows
      // carry soldPrice === listPrice, or no date at all).
      const listPrice = d.listPrice || d.originalListPrice || null;
      const provenSale = soldDate && soldPrice && (!listPrice || soldPrice !== listPrice);
      if (!provenSale) { rejRelabeled++; retryZpids.push(zpid); continue; }
      keptProven++;
    }
    if (!soldPrice || !soldDate) { rejNoSoldData++; retryZpids.push(zpid); continue; }
    if (new Date(soldDate) < ingestCutoff) { rejTooOld++; continue; }
    seen.add(zpid);
    rows.push(searchItemToPoolRow(d, marketId, soldPrice, soldDate));
  }
  console.error(`[SoldComps] search discovery ${marketId}: active=${activeItems.length}, soldRaw=${soldItems.length}, relabeled=${rejRelabeled}, provenOverlap=${keptProven}, noSoldData=${rejNoSoldData}, tooOld=${rejTooOld}, kept=${rows.length}, retry=${retryZpids.length}`);
  return { rows, retryZpids: retryZpids.slice(0, 150) };
}

// ─── FALLBACK discovery: legacy curated-zpid + nearbyHomes property-details ───
// Per-zpid property-details calls (slower, quota-heavier). Only runs when the
// search path yields too few. Returns { rows, funnel } for the debug payload.
const JUNK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // relabeled-junk zpids retry after 7 days
const JUNK_CAP = 800;

async function discoverViaPropertyDetails(city, zip, apiKey, apiHost, marketId, ingestCutoff, excludeSet, haveSet, priorityZpids = [], supabase = null) {
  const DISCOVERY_BATCH_CAP = 25;

  // Junk memory: zpids that already failed priceHistory validation (relabeled
  // actives with no sale). Without it every run re-burns its 25 detail calls
  // on the same fakes and the queue never advances. Stored in pp_city_cache
  // (service-role only, no migration). 7-day TTL so a home that genuinely
  // sells after being junk-validated is picked up within a week.
  const junkKey = `sc-failed:${marketId}`;
  let junk = {}; // { zpid: attemptedAtMs }
  if (supabase) {
    try {
      const { data: row } = await supabase
        .from('pp_city_cache').select('data').eq('cache_key', junkKey).maybeSingle();
      const now = Date.now();
      for (const [z, t] of Object.entries(row?.data?.zpids || {})) {
        if (now - t < JUNK_TTL_MS) junk[z] = t;
      }
    } catch (e) {
      console.error(`[SoldComps] junk-memory read failed (continuing): ${e.message}`);
    }
  }

  // Priority candidates (search-feed recentlySold rejects) keep FEED ORDER
  // and are validated before any curated/seed candidate.
  const priority = [...new Set(priorityZpids.map(String))]
    .filter(z => !excludeSet.has(z) && !haveSet.has(z) && !junk[z]);

  // Seed/curated discovery costs ~9 extra API calls — skip it entirely when
  // the priority list already fills the batch.
  let curatedZpids = [], discovered = [];
  if (priority.length < DISCOVERY_BATCH_CAP) {
    const zpidData = zip ? getZpidsForZip(city, zip) : getZpidsForCity(city);
    curatedZpids = [...zpidData.verified, ...zpidData.extras];
    discovered = await discoverSoldZpidsForCity(city, apiKey, apiHost);
  }
  const prioritySet = new Set(priority);
  const others = [...new Set([...curatedZpids, ...discovered])]
    .map(String)
    .filter(z => !excludeSet.has(z) && !haveSet.has(z) && !prioritySet.has(z) && !junk[z])
    .sort(() => Math.random() - 0.5);
  const candidateZpids = [...priority, ...others];

  if (candidateZpids.length === 0) {
    return { rows: [], funnel: { fbPriority: priority.length, fbCurated: curatedZpids.length, fbDiscovered: discovered.length, fbCandidate: 0 } };
  }

  const zpidsToFetch = candidateZpids.slice(0, DISCOVERY_BATCH_CAP);
  const TIMEOUT_MS = 5000;
  const results = await Promise.allSettled(
    zpidsToFetch.map(zpid => fetchPropertyDetails(zpid, apiKey, apiHost, TIMEOUT_MS))
  );

  const rows = [];
  const newJunk = [];
  let fetchedCount = 0, soldCount = 0, rejNoSoldData = 0, rejTooOld = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status !== 'fulfilled' || !r.value) continue;
    fetchedCount++;
    const d = r.value;
    const zpid = String(zpidsToFetch[i]);
    const soldEvent = extractSoldEvent(d.priceHistory || []);
    const soldPrice = soldEvent?.price || d.lastSoldPrice || d.lastSale?.price || null;
    const soldDate = soldEvent?.date || d.lastSoldDate || d.lastSale?.date || null;
    if (!soldPrice || !soldDate) { rejNoSoldData++; newJunk.push(zpid); continue; }
    if (new Date(soldDate) < ingestCutoff) { rejTooOld++; newJunk.push(zpid); continue; }
    soldCount++;
    const photos = extractPhotos(d);
    const mainPhoto = photos[0] || d.imgSrc || d.hiResImageLink || null;
    rows.push({
      market_id: marketId,
      zpid,
      address: d.streetAddress || d.address?.streetAddress || null,
      city: d.city || d.address?.city || null,
      state: d.state || d.address?.state || 'CA',
      zip: d.zipcode || d.address?.zipcode || null,
      neighborhood: d.neighborhoodRegion?.name || null,
      beds: d.bedrooms || null,
      baths: d.bathrooms || null,
      sqft: d.livingArea || d.livingAreaValue || null,
      lot_sqft: d.lotAreaValue
        ? (d.lotAreaUnits === 'acres' ? Math.round(d.lotAreaValue * 43560) : Math.round(d.lotAreaValue))
        : null,
      year_built: d.yearBuilt || null,
      property_type: normalizeHomeType(d.homeType),
      list_price: extractListPrice(d.priceHistory || []) || soldPrice,
      sold_price: soldPrice,
      sold_date: soldDate,
      photo: mainPhoto,
      photos: photos.slice(0, 6),
      description: d.description || null,
      latitude: d.latitude || null,
      longitude: d.longitude || null,
      detail_url: d.hdpUrl ? `https://www.zillow.com${d.hdpUrl}` : null,
    });
  }
  // Persist junk memory (merge + prune oldest beyond cap). Non-fatal.
  if (supabase && newJunk.length > 0) {
    try {
      const now = Date.now();
      for (const z of newJunk) junk[z] = now;
      let entries = Object.entries(junk);
      if (entries.length > JUNK_CAP) {
        entries = entries.sort((a, b) => b[1] - a[1]).slice(0, JUNK_CAP);
      }
      await supabase.from('pp_city_cache').upsert(
        { cache_key: junkKey, data: { zpids: Object.fromEntries(entries) }, updated_at: new Date().toISOString() },
        { onConflict: 'cache_key' }
      );
      console.error(`[SoldComps] junk-memory ${marketId}: +${newJunk.length} (total ${entries.length})`);
    } catch (e) {
      console.error(`[SoldComps] junk-memory write failed (continuing): ${e.message}`);
    }
  }

  return {
    rows,
    funnel: {
      fbPriority: priority.length,
      fbCurated: curatedZpids.length,
      fbDiscovered: discovered.length,
      fbCandidate: candidateZpids.length,
      fbAttempted: zpidsToFetch.length,
      fbFetched: fetchedCount,
      fbSold: soldCount,
      fbRejNoSoldData: rejNoSoldData,
      fbRejTooOld: rejTooOld,
    },
  };
}

// ─── Dynamic discovery for cities without curated zpids ───
// Returns a generous pool of candidate zpids whose property-details responses
// usually contain a usable Sold event in priceHistory. Strategy:
//
//   1. Search active listings in the city (search?status=forSale — works reliably
//      for any market; the same call returns 41 results even for Alameda).
//   2. Return the ACTIVE listing zpids themselves as the primary pool. Every
//      actively-listed home was previously sold — its property-details
//      priceHistory carries that sold event, which the existing pipeline
//      (extractSoldEvent → 5y window → soldPrice required) already validates
//      and converts into a valid sold comp.
//   3. Also harvest RECENTLY_SOLD entries from a few seeds' nearbyHomes as a
//      bonus — those are even fresher sales. They're appended after the active
//      pool so they get a shot if the active fetches succeed first.
//
// Returning ~40 candidates instead of ~3 means even at RapidAPI's ~40% per-zpid
// success rate we have ~16 expected hits, well above the MAX_FETCH cap.
//
// Safe to call: empty array means "discovery couldn't seed pool", not "errored".
async function discoverSoldZpidsForCity(city, apiKey, apiHost) {
  // Step 1: get active-listing zpids in this city via search?status=forSale
  let activeZpids = [];
  try {
    const params = new URLSearchParams({ location: `${city}, CA`, status: "forSale" });
    const url = `https://${apiHost}/search?${params}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": apiHost },
        signal: controller.signal,
      });
      if (!res.ok) return [];
      const data = await res.json();
      // Same shape-tolerant extraction pricepoint.js uses
      const list = Array.isArray(data?.data) ? data.data
        : Array.isArray(data?.results) ? data.results
        : Array.isArray(data?.props) ? data.props
        : Array.isArray(data?.searchResults) ? data.searchResults
        : Array.isArray(data?.data?.results) ? data.data.results
        : Array.isArray(data) ? data
        : [];
      activeZpids = list.map(r => r?.zpid).filter(Boolean).map(String);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return [];
  }
  if (activeZpids.length === 0) return [];

  // Step 2: pull property-details for 8 seeds. Each seed's nearbyHomes lists
  // ~5-10 RECENTLY_SOLD entries, so 8 seeds yield ~40-80 unique nearby zpids
  // (the high-pass-rate candidates for our 6-month sold-date filter).
  const seeds = activeZpids.slice(0, 8);
  const seedResults = await Promise.allSettled(
    seeds.map(z => fetchPropertyDetails(z, apiKey, apiHost, 5000))
  );

  // Step 3: collect RECENTLY_SOLD zpids from each successful seed's nearbyHomes.
  const nearby = new Set();
  for (const r of seedResults) {
    if (r.status !== "fulfilled" || !r.value) continue;
    const nh = r.value.nearbyHomes;
    if (!Array.isArray(nh)) continue;
    for (const n of nh) {
      if (n?.zpid && n.homeStatus === "RECENTLY_SOLD") {
        nearby.add(String(n.zpid));
      }
    }
  }

  // CRITICAL ORDER: nearbyHomes-RECENTLY_SOLD first, then active-listing zpids
  // as low-priority fallback. Nearby entries are Zillow's signal the home sold
  // in the last ~6 months — they consistently pass our 6-month sold-date
  // filter at ingest. Active homes' priceHistory typically points to a
  // years-old prior sale and fails the filter. Putting nearby first means the
  // batch cap (DISCOVERY_BATCH_CAP=20) fills with high-pass-rate candidates
  // instead of getting wasted on active listings.
  const combined = new Set(nearby);
  for (const z of activeZpids) combined.add(z);
  return [...combined];
}

// ─── Fetch property details from RapidAPI with timeout ───
async function fetchPropertyDetails(zpid, apiKey, apiHost, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://${apiHost}/property-details?zpid=${zpid}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": apiHost,
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`API ${res.status} for zpid ${zpid}`);
    }
    const raw = await res.json();
    return raw.data || raw;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Extract the MOST RECENT "Sold" event from priceHistory ───
// Previously returned the first match in iteration order, which is wrong for
// homes with multiple sales in history (flips, etc.) when priceHistory isn't
// guaranteed reverse-chronological. Now collects all Sold-like events with a
// date, sorts by date DESC, returns the freshest.
function extractSoldEvent(history) {
  if (!Array.isArray(history)) return null;
  const candidates = history
    .filter(evt => evt && evt.date && evt.event && (
      evt.event === "Sold" ||
      String(evt.event).toLowerCase().includes("sold") ||
      evt.event === "Closed"
    ));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => new Date(b.date) - new Date(a.date));
  const best = candidates[0];
  return { price: best.price || null, date: best.date, event: best.event };
}

// ─── Extract original list price from priceHistory ───
function extractListPrice(history) {
  if (!Array.isArray(history)) return null;
  for (const evt of history) {
    if (evt.event && (evt.event === "Listed for sale" || evt.event === "Listed" || evt.event.includes("list"))) {
      return evt.price || null;
    }
  }
  return null;
}

// Zillow's imgSrc is sometimes a maps.googleapis.com Street View image signed
// for Zillow's referrer — those 403 when hotlinked from our domain and render
// as a broken/blank box. Treat them as "no photo" so the client placeholder
// shows instead.
function isUsablePhoto(url) {
  return !!url && typeof url === 'string'
    && !url.includes('maps.googleapis.com')
    && !url.includes('streetview');
}

// ─── Extract photos ───
function extractPhotos(d) {
  const urls = [];
  if (d.photos && Array.isArray(d.photos)) {
    for (let i = 0; i < d.photos.length && urls.length < 12; i++) {
      const jpegs = d.photos[i]?.mixedSources?.jpeg || [];
      if (jpegs.length > 0) urls.push(jpegs[jpegs.length - 1].url);
    }
    if (urls.length > 0) return urls.filter(isUsablePhoto);
  }
  if (d.responsivePhotos && Array.isArray(d.responsivePhotos)) {
    for (let i = 0; i < d.responsivePhotos.length && urls.length < 12; i++) {
      const srcs = d.responsivePhotos[i]?.mixedSources?.jpeg || [];
      if (srcs.length > 0) urls.push(srcs[srcs.length - 1].url);
    }
    if (urls.length > 0) return urls.filter(isUsablePhoto);
  }
  if (isUsablePhoto(d.imgSrc)) return [d.imgSrc];
  return [];
}

function normalizeHomeType(type) {
  if (!type) return "Single Family";
  const map = {
    SINGLE_FAMILY: "Single Family",
    MULTI_FAMILY: "Multi Family",
    CONDO: "Condo",
    CONDOS_COOPS: "Condo",
    TOWNHOUSE: "Townhouse",
    APARTMENT: "Apartment",
  };
  return map[type] || type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
