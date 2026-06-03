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
const POOL_THRESHOLD = 5;                  // below this, run discovery to grow
const POOL_QUERY_LIMIT = 1000;             // pull up to N pool rows on read
const RESPONSE_SHUFFLE_CAP = 250;          // default shuffled slice size (was 50 — the
                                           // old ceiling that capped Free Play at 50).
                                           // Override per-request with ?limit=N.
// ─── Search-pagination discovery config ───
const SOLD_SEARCH_PAGES = 6;               // recentlySold pages to page through (~40 each)
const ACTIVE_DEDUP_PAGES = 4;              // forSale pages used only to strip relabeled-active
const MIN_SEARCH_YIELD = 12;               // below this, fall back to the next discovery tier
const USRE_MAX_PAGES = 5;                  // us-real-estate /sold-homes pages (~42 each → ~200/city).
                                           // Each page = 1 RapidAPI call; tune for your plan's quota.
// TIERED sold-date window:
//   - ingest accepts anything within the last 12 months (broader pool capture)
//   - on read, 0-6mo entries are PREFERRED; 6-12mo entries only fill in when
//     the 0-6mo bucket is below POOL_THRESHOLD
const SOLD_DATE_MONTHS_INGEST = 12;
const SOLD_DATE_MONTHS_PREFERRED = 6;

// ─── Map city name → market_id used as pool key ───
function cityToMarketId(city) {
  const key = String(city || '').toLowerCase().trim();
  const map = {
    'san francisco': 'sf',
    'alameda': 'alameda',
    'oakland': 'oakland',
    'berkeley': 'berkeley',
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

export default async function handler(req, res) {
  // Shared scoped CORS (now also covers the Capacitor native origins) + rate limit.
  if (applyCors(req, res)) return;
  if (rateLimited(req, res, { limit: 20 })) return;

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
    const ingestCutoff = monthsAgoDate(SOLD_DATE_MONTHS_INGEST);
    const ingestCutoffStr = monthsAgoDateStr(SOLD_DATE_MONTHS_INGEST);
    const preferredCutoff = monthsAgoDate(SOLD_DATE_MONTHS_PREFERRED);

    const excludeSet = new Set();
    if (exclude) exclude.split(",").forEach(z => excludeSet.add(z.trim()));

    // How many to return this request. Defaults to RESPONSE_SHUFFLE_CAP (250),
    // clamped to [10, 500]. Lets the client ask for more or fewer via ?limit=N.
    const responseCap = Math.min(500, Math.max(10, parseInt(req.query.limit, 10) || RESPONSE_SHUFFLE_CAP));

    // ─── TEMP PROBE: &probe=1 (owner-only) ───
    // Calls the us-real-estate /sold-homes endpoint and dumps a redacted shape
    // summary so we can confirm the mapper. REMOVE once verified.
    // Gated behind CRON_SECRET so anonymous callers can't trigger raw RapidAPI
    // calls or read response internals (CIO audit H-2 / L-2).
    if (req.query.probe === '1' && isPrivileged(req)) {
      const apiKey = process.env.RAPIDAPI_KEY;
      const soldHost = process.env.USRE_HOST || 'us-real-estate.p.rapidapi.com';
      if (!apiKey) return res.status(500).json({ error: 'RAPIDAPI_KEY not configured' });
      const url = `https://${soldHost}/sold-homes?state_code=CA&city=${encodeURIComponent(city)}&limit=42&offset=0&sort=sold_date`;
      try {
        const r = await fetch(url, { headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': soldHost } });
        const text = await r.text();
        let json = null; try { json = JSON.parse(text); } catch {}
        const results = json ? extractUsreResults(json) : [];
        const rows = results.map(d => usRealEstateItemToPoolRow(d, marketId, ingestCutoff)).filter(Boolean);
        const stripQs = (u) => typeof u === 'string' ? u.split('?')[0] : u;
        const r0 = rows[0] || null;
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({
          httpStatus: r.status,
          rawResultCount: Array.isArray(results) ? results.length : 0,
          mappedRowCount: rows.length,
          firstMappedRow: r0 ? {
            zpid: r0.zpid, city: r0.city, state: r0.state, zip: r0.zip,
            beds: r0.beds, baths: r0.baths, sqft: r0.sqft, year_built: r0.year_built,
            sold_price: r0.sold_price, sold_date: r0.sold_date, list_price: r0.list_price,
            property_type: r0.property_type, hasPhoto: !!r0.photo, photoHost: r0.photo ? stripQs(r0.photo).replace(/^https?:\/\//,'').split('/')[0] : null,
            photosCount: r0.photos.length, lat: r0.latitude, lon: r0.longitude,
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
        return { fresh: [], older: [], all: [] };
      }
      const rows = (data || []).filter(r => !excludeSet.has(String(r.zpid)));
      const fresh = rows.filter(r => new Date(r.sold_date) >= preferredCutoff);
      const older = rows.filter(r => new Date(r.sold_date) < preferredCutoff);
      return { fresh, older, all: rows };
    }

    // Pick the best shuffled slice given a {fresh, older} pool.
    // Returns 'fresh-only' when fresh >= POOL_THRESHOLD, else fills with older.
    function pickShuffledSlice(p) {
      if (p.fresh.length >= POOL_THRESHOLD) {
        return {
          rows: [...p.fresh].sort(() => Math.random() - 0.5).slice(0, responseCap),
          tier: 'fresh',
        };
      }
      // Mix: all fresh first, then fill with shuffled older
      const combined = [...p.fresh, ...[...p.older].sort(() => Math.random() - 0.5)];
      return {
        rows: combined.slice(0, responseCap),
        tier: p.fresh.length === 0 ? 'older-only' : 'mixed',
      };
    }

    let pool = await readPool();
    // 'Healthy' = enough across the whole 12-month window to skip another
    // discovery pass. The slice still prefers fresh.
    const totalSize = pool.all.length;

    if (!forceDiscover && totalSize >= POOL_THRESHOLD) {
      const { rows: shuffled, tier } = pickShuffledSlice(pool);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        soldListings: shuffled.map(poolRowToListing),
        count: shuffled.length,
        city,
        zip: zip || null,
        poolSize: totalSize,
        poolFreshSize: pool.fresh.length,
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
        poolFreshSize: pool.fresh.length,
        poolOlderSize: pool.older.length,
        servedTier: tier,
        source: 'pool-only-no-apikey',
        hasMore: false,
      });
    }

    console.error(`[SoldComps] Pool thin for ${marketId} (fresh=${pool.fresh.length}, all=${pool.all.length}). Discovering via search pagination...`);

    const poolZpidSet = new Set(pool.all.map(r => String(r.zpid)));

    // ─── PRIMARY discovery: page the recentlySold search endpoint ───
    // Returns ~40 sold listings per page directly (price + dateSold in the
    // payload), so there are NO per-zpid property-details calls. Relabeled-
    // active garbage is stripped by deduping against the forSale results.
    // This is the high-yield, low-cost path that fills a whole city in one pass.
    // PRIMARY: us-real-estate /sold-homes — real closed sales at volume for any
    // CA city, no curated zpid list needed. This is what fills Alameda/Berkeley/etc.
    const usre = await discoverSoldViaUsRealEstate(
      city, marketId, ingestCutoff, excludeSet, poolZpidSet
    );
    let newRows = usre.rows;
    let discoverySource = 'us-real-estate';
    let funnelDbg = { usreRows: newRows.length, usreDiag: usre.diag };

    // SECONDARY: legacy recentlySold search (only if us-real-estate came back thin).
    if (newRows.length < MIN_SEARCH_YIELD) {
      const haveSet = new Set([...poolZpidSet, ...newRows.map(r => String(r.zpid))]);
      const searchRows = await discoverSoldViaSearch(
        city, apiKey, apiHost, marketId, ingestCutoff, excludeSet, haveSet
      );
      if (searchRows.length > 0) {
        newRows = [...newRows, ...searchRows];
        discoverySource = newRows.length > searchRows.length ? 'usre+search' : 'search';
      }
      funnelDbg.searchRows = searchRows.length;

      // TERTIARY: curated-zpid + nearbyHomes property-details funnel (reliable for SF).
      if (newRows.length < MIN_SEARCH_YIELD) {
        const haveSet2 = new Set([...poolZpidSet, ...newRows.map(r => String(r.zpid))]);
        const fb = await discoverViaPropertyDetails(
          city, zip, apiKey, apiHost, marketId, ingestCutoff, excludeSet, haveSet2
        );
        if (fb.rows.length > 0) {
          newRows = [...newRows, ...fb.rows];
          discoverySource += '+details';
        }
        funnelDbg = { ...funnelDbg, ...fb.funnel };
      }
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

    console.error(`[SoldComps] ${marketId}${zip ? ` zip=${zip}` : ''}: added ${newRows.length} via ${discoverySource}, pool now fresh=${pool.fresh.length} older=${pool.older.length}`);

    res.setHeader("Cache-Control", "no-store");
    const responseBody = {
      soldListings: shuffled.map(poolRowToListing),
      count: shuffled.length,
      city,
      zip: zip || null,
      poolSize: pool.all.length,
      poolFreshSize: pool.fresh.length,
      poolOlderSize: pool.older.length,
      servedTier: tier,
      newlyAdded: newRows.length,
      discoverySource,
      source: 'pool+discovery',
      hasMore: pool.all.length > shuffled.length,
      timestamp: new Date().toISOString(),
    };
    if (req.query.debug === '1') {
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
    listPrice: r.list_price || r.sold_price,
    zestimate: null,
    soldPrice: r.sold_price,
    soldDate: r.sold_date,
    daysOnMarket: 0,
    status: 'sold',
    photo: isUsablePhoto(r.photo) ? r.photo : null,
    photos: Array.isArray(r.photos) ? r.photos.filter(isUsablePhoto).slice(0, 6) : [],
    neighborhood: r.neighborhood || '',
    pricePerSqft: (r.sqft && r.sold_price) ? Math.round(r.sold_price / r.sqft) : 0,
    latitude: r.latitude || null,
    longitude: r.longitude || null,
    description: r.description || '',
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

// ─── PRIMARY discovery: us-real-estate dedicated /sold-homes endpoint ───
// Realtor.com-backed. Returns real closed sales at volume (≈42/page on the
// Basic plan, paginated) with price, sold date, photos, beds/baths/sqft and
// lat/lng inline — no per-zpid detail calls. This is the high-yield path that
// fills a whole city in one pass for ANY CA city, with no curated zpid list.
async function discoverSoldViaUsRealEstate(city, marketId, ingestCutoff, excludeSet, poolZpidSet) {
  const apiKey = process.env.RAPIDAPI_KEY;
  // NOTE: deliberately NOT reading RAPIDAPI_SOLD_HOST — that Vercel env var
  // predates this integration and points at the old host, which silently
  // hijacked these requests (its router answers /sold-homes with a 400
  // "Required parameter is missing"). USRE_HOST is a fresh name; default is
  // the correct us-real-estate host.
  const soldHost = process.env.USRE_HOST || 'us-real-estate.p.rapidapi.com';
  // diag is surfaced via ?debug=1 so failures are visible without server logs:
  // status = last HTTP status, body = last error/empty body snippet,
  // perPage = the page size that worked, pages = pages successfully consumed.
  const diag = { host: soldHost, status: null, body: null, perPage: null, pages: 0 };
  if (!apiKey) { diag.body = 'no RAPIDAPI_KEY'; return { rows: [], diag }; }
  // The plan caps results per call; the accepted `limit` ceiling isn't
  // documented, so adapt: try big, fall back smaller until a size works.
  const LIMIT_CANDIDATES = [42, 20, 10];
  let perPage = null;
  const rows = [];
  const seen = new Set();
  let offset = 0;
  for (let page = 0; page < USRE_MAX_PAGES; page++) {
    let results = null;
    for (const lim of (perPage ? [perPage] : LIMIT_CANDIDATES)) {
      const url = `https://${soldHost}/sold-homes?state_code=CA&city=${encodeURIComponent(city)}&limit=${lim}&offset=${offset}&sort=sold_date`;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        let r, text;
        try {
          r = await fetch(url, { headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': soldHost }, signal: controller.signal });
          text = await r.text();
        } finally { clearTimeout(timer); }
        diag.status = r.status;
        if (!r.ok) { diag.body = text.slice(0, 160); continue; }     // try smaller limit
        let data = null;
        try { data = JSON.parse(text); } catch { diag.body = 'non-JSON response'; continue; }
        const arr = extractUsreResults(data);
        if (!Array.isArray(arr) || arr.length === 0) { diag.body = text.slice(0, 160); continue; }
        results = arr; perPage = lim; diag.perPage = lim;
        break;
      } catch (e) { diag.body = String(e && e.message || e).slice(0, 160); }
    }
    if (!results) break;
    diag.pages = page + 1;
    for (const d of results) {
      const row = usRealEstateItemToPoolRow(d, marketId, ingestCutoff);
      if (!row) continue;
      if (seen.has(row.zpid) || excludeSet.has(row.zpid) || poolZpidSet.has(row.zpid)) continue;
      seen.add(row.zpid);
      rows.push(row);
    }
    if (results.length < perPage) break; // last page reached
    offset += perPage;
  }
  console.error(`[SoldComps] us-real-estate discovery ${marketId}: kept ${rows.length} (status=${diag.status} perPage=${diag.perPage} pages=${diag.pages} body=${diag.body || 'n/a'})`);
  return { rows, diag };
}

// Wrapper-agnostic: find the first array of listing-shaped objects anywhere in
// the response (handles data.results / data.home_search.results / top-level).
function extractUsreResults(json) {
  const stack = [json];
  let guard = 0;
  while (stack.length && guard++ < 10000) {
    const o = stack.shift();
    if (Array.isArray(o)) {
      if (o.length && o[0] && typeof o[0] === 'object' && (o[0].description || o[0].property_id)) return o;
    } else if (o && typeof o === 'object') {
      for (const k of Object.keys(o)) stack.push(o[k]);
    }
  }
  return [];
}

// Map one us-real-estate /sold-homes item → pp_property_pool row. Returns null
// if it has no usable sold price+date or the sale is outside the ingest window.
function usRealEstateItemToPoolRow(d, marketId, ingestCutoff) {
  const desc = d.description || {};
  const loc = d.location || {};
  const addr = loc.address || {};
  const soldPrice = desc.sold_price || d.sold_price || null;
  const soldDate = normalizeSoldDateStr(desc.sold_date || d.sold_date || null);
  if (!soldPrice || !soldDate) return null;
  if (new Date(soldDate) < ingestCutoff) return null;
  // Realtor data has no Zillow zpid — use property_id with an "re_" prefix so it
  // can't collide with real zpids from the other discovery paths.
  const pid = d.property_id || d.listing_id || d.permalink;
  if (!pid) return null;
  const zpid = `re_${pid}`;
  const photoList = Array.isArray(d.photos) ? d.photos.map(p => p && p.href).filter(Boolean) : [];
  const mainPhoto = (d.primary_photo && d.primary_photo.href) || photoList[0] || null;
  const coord = addr.coordinate || {};
  return {
    market_id: marketId,
    zpid,
    address: addr.line || null,
    city: addr.city || null,
    state: addr.state_code || 'CA',
    zip: addr.postal_code || null,
    neighborhood: (Array.isArray(loc.neighborhoods) && loc.neighborhoods[0] && loc.neighborhoods[0].name) || null,
    beds: desc.beds || null,
    baths: desc.baths || desc.baths_consolidated || null,
    sqft: desc.sqft || null,
    lot_sqft: desc.lot_sqft || null,
    year_built: desc.year_built || null,
    property_type: normalizeHomeType(desc.type),
    list_price: d.list_price || desc.list_price || soldPrice,
    sold_price: soldPrice,
    sold_date: soldDate,
    photo: isUsablePhoto(mainPhoto) ? mainPhoto : null,
    photos: photoList.filter(isUsablePhoto).slice(0, 6),
    description: desc.text || null,
    latitude: coord.lat || null,
    longitude: coord.lon || null,
    detail_url: d.permalink ? `https://www.realtor.com/realestateandhomes-detail/${d.permalink}` : null,
  };
}

// ─── SECONDARY discovery: paginate recentlySold, dedup against active ───
// Works for ANY city with no curated zpid lists. Returns pool-ready rows.
async function discoverSoldViaSearch(city, apiKey, apiHost, marketId, ingestCutoff, excludeSet, poolZpidSet) {
  const location = `${city}, CA`;
  const [activeItems, soldItems] = await Promise.all([
    searchPages(location, 'forSale', apiKey, apiHost, ACTIVE_DEDUP_PAGES),
    searchPages(location, 'recentlySold', apiKey, apiHost, SOLD_SEARCH_PAGES),
  ]);
  const activeZpids = new Set(activeItems.map(r => String(r?.zpid)).filter(Boolean));

  const rows = [];
  const seen = new Set();
  let rejRelabeled = 0, rejNoSoldData = 0, rejTooOld = 0;
  for (const d of soldItems) {
    const zpid = String(d?.zpid || '');
    if (!zpid || seen.has(zpid)) continue;
    if (activeZpids.has(zpid)) { rejRelabeled++; continue; }   // relabeled-active garbage
    if (excludeSet.has(zpid) || poolZpidSet.has(zpid)) continue;
    const soldPrice = d.price || d.lastSoldPrice || null;
    const soldDate = normalizeSoldDateStr(d.dateSold || d.lastSoldDate || null);
    if (!soldPrice || !soldDate) { rejNoSoldData++; continue; }
    if (new Date(soldDate) < ingestCutoff) { rejTooOld++; continue; }
    seen.add(zpid);
    rows.push(searchItemToPoolRow(d, marketId, soldPrice, soldDate));
  }
  console.error(`[SoldComps] search discovery ${marketId}: active=${activeItems.length}, soldRaw=${soldItems.length}, relabeled=${rejRelabeled}, kept=${rows.length}`);
  return rows;
}

// ─── FALLBACK discovery: legacy curated-zpid + nearbyHomes property-details ───
// Per-zpid property-details calls (slower, quota-heavier). Only runs when the
// search path yields too few. Returns { rows, funnel } for the debug payload.
async function discoverViaPropertyDetails(city, zip, apiKey, apiHost, marketId, ingestCutoff, excludeSet, haveSet) {
  const zpidData = zip ? getZpidsForZip(city, zip) : getZpidsForCity(city);
  const curatedZpids = [...zpidData.verified, ...zpidData.extras];
  const discovered = await discoverSoldZpidsForCity(city, apiKey, apiHost);
  const candidateZpids = [...new Set([...curatedZpids, ...discovered])]
    .filter(z => !excludeSet.has(z) && !haveSet.has(String(z)));

  if (candidateZpids.length === 0) {
    return { rows: [], funnel: { fbCurated: curatedZpids.length, fbDiscovered: discovered.length, fbCandidate: 0 } };
  }

  const DISCOVERY_BATCH_CAP = 25;
  const zpidsToFetch = [...candidateZpids].sort(() => Math.random() - 0.5).slice(0, DISCOVERY_BATCH_CAP);
  const TIMEOUT_MS = 5000;
  const results = await Promise.allSettled(
    zpidsToFetch.map(zpid => fetchPropertyDetails(zpid, apiKey, apiHost, TIMEOUT_MS))
  );

  const rows = [];
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
    if (!soldPrice || !soldDate) { rejNoSoldData++; continue; }
    if (new Date(soldDate) < ingestCutoff) { rejTooOld++; continue; }
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
  return {
    rows,
    funnel: {
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
