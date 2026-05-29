// /api/pp-daily.js â Vercel Serverless Function
// Manages PricePoint Daily challenges: fetches or seeds today's challenge per market.
//
// GET /api/pp-daily?market=sf
//   â Returns today's daily challenge (without sold_price)
//
// GET /api/pp-daily?market=sf&reveal=true&player=<uuid>
//   â Returns daily WITH sold_price (only if player has already guessed)
//
// Fetches property details DIRECTLY from RapidAPI (no serverless-to-serverless call)
// to avoid cascading timeout issues.

import { createClient } from '@supabase/supabase-js';

// Supabase admin client (server-side only â uses SERVICE key)
function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ââ Daily number: days since epoch (per market) ââ
function getDailyNumber(marketId) {
  const epoch = new Date('2026-03-25').getTime(); // PricePoint launch date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - epoch) / 86400000) + 1;
}

function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ââ Known-good zpids that have recently sold â verified March 2026 ââ
// These are REAL recently sold properties with photos, beds, and sold prices.
// Grouped by neighborhood for variety across daily challenges.
const DAILY_SEED_ZPIDS = {
  sf: [
    // Richmond (confirmed working: 659 12th Ave, sold $4.95M, March 2026)
    "15098085", "15094834", "15091588",
    // Sunset (confirmed working: 1495 21st Ave, sold $2.93M, March 2026)
    "15105418", "15095869", "15115454",
    // Mission / Bernal Heights (confirmed: 115 Ellsworth, sold $2.63M)
    "15161966", "15150065", "15162139",
    // Noe Valley
    "15182650", "15132286", "460322503",
    // Pacific Heights
    "15080888", "15082566", "15074528",
    // Excelsior
    "15177062", "15167859", "15167742",
  ],
};

// ââ Fetch property details directly from RapidAPI ââ
async function fetchPropertyDirect(zpid, apiKey, apiHost, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://${apiHost}/property-details?zpid=${zpid}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': apiHost,
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const raw = await res.json();
    return raw.data || raw;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ââ Extract sold event from priceHistory ââ
function extractSoldEvent(history) {
  if (!Array.isArray(history)) return null;
  for (const evt of history) {
    if (evt.event && (evt.event === 'Sold' || evt.event.toLowerCase().includes('sold') || evt.event === 'Closed')) {
      return { price: evt.price || null, date: evt.date || null };
    }
  }
  return null;
}

// ââ Extract list price from priceHistory ââ
function extractListPrice(history) {
  if (!Array.isArray(history)) return null;
  for (const evt of history) {
    if (evt.event && (evt.event === 'Listed for sale' || evt.event === 'Listed' || evt.event.includes('list'))) {
      return evt.price || null;
    }
  }
  return null;
}

// ââ Extract photos ââ
function extractPhotos(d) {
  const urls = [];
  if (d.photos && Array.isArray(d.photos)) {
    for (let i = 0; i < d.photos.length && urls.length < 12; i++) {
      const jpegs = d.photos[i]?.mixedSources?.jpeg || [];
      if (jpegs.length > 0) urls.push(jpegs[jpegs.length - 1].url);
    }
  }
  if (urls.length > 0) return urls[0]; // primary photo (full array available via propertydetails)
  return d.imgSrc || d.hiResImageLink || '';
}

function normalizeHomeType(type) {
  if (!type) return 'Single Family';
  const map = { SINGLE_FAMILY: 'Single Family', CONDO: 'Condo', TOWNHOUSE: 'Townhouse', MULTI_FAMILY: 'Multi Family' };
  return map[type] || type.replace(/_/g, ' ');
}

// ââ Fetch sold listings directly from RapidAPI (no sold-comps middleman) ââ
// Dynamic discovery for markets without a curated seed list.
// Same approach as sold-comps.js: search active listings for the city, return
// the active zpids themselves as the primary candidate pool (every active home
// has a prior Sold event in its priceHistory the downstream pipeline will pick
// up). Bonus: harvest RECENTLY_SOLD entries from a few seeds' nearbyHomes for
// even fresher comps. Returns [] only if the search itself can't find any
// active listings; caller treats that as "no suitable listings" and 503s.
async function discoverSoldZpidsForCity(cityName, apiKey, apiHost) {
  let activeZpids = [];
  try {
    const params = new URLSearchParams({ location: `${cityName}, CA`, status: 'forSale' });
    const url = `https://${apiHost}/search?${params}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost },
        signal: controller.signal,
      });
      if (!res.ok) return [];
      const data = await res.json();
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

  const seeds = activeZpids.slice(0, 6);
  const seedResults = await Promise.allSettled(
    seeds.map(z => fetchPropertyDirect(z, apiKey, apiHost, 5000))
  );
  const nearby = new Set();
  for (const r of seedResults) {
    if (r.status !== 'fulfilled' || !r.value) continue;
    const nh = r.value.nearbyHomes;
    if (!Array.isArray(nh)) continue;
    for (const n of nh) {
      if (n?.zpid && n.homeStatus === 'RECENTLY_SOLD') {
        nearby.add(String(n.zpid));
      }
    }
  }

  // Nearby RECENTLY_SOLD first (passes our 6-month filter reliably), then
  // active-listing zpids as fallback. Matches sold-comps.js ordering.
  const combined = new Set(nearby);
  for (const z of activeZpids) combined.add(z);
  return [...combined];
}

async function fetchSoldListingsDirect(marketId, dailyNumber) {
  const apiKey = process.env.RAPIDAPI_KEY;
  const apiHost = process.env.RAPIDAPI_HOST || 'real-time-real-estate-data.p.rapidapi.com';
  if (!apiKey) {
    console.error('[pp-daily] No RAPIDAPI_KEY configured');
    return [];
  }

  let seedZpids = DAILY_SEED_ZPIDS[marketId] || [];

  // Dynamic fallback when the market has no curated seed list (alameda,
  // oakland, berkeley). Without this, Daily 503s for every non-SF market.
  if (seedZpids.length === 0) {
    const cityName = MARKETS[marketId]?.name;
    if (cityName) {
      console.error(`[pp-daily] No curated seed zpids for "${marketId}" — discovering via ${cityName}`);
      seedZpids = await discoverSoldZpidsForCity(cityName, apiKey, apiHost);
      console.error(`[pp-daily] Discovery for ${cityName}: ${seedZpids.length} zpids`);
    }
  }

  if (seedZpids.length === 0) return [];

  // Pick 3 zpids to try (rotated by daily number for variety)
  const startIdx = (dailyNumber * 3) % seedZpids.length;
  const zpidsToTry = [];
  for (let i = 0; i < 3; i++) {
    zpidsToTry.push(seedZpids[(startIdx + i) % seedZpids.length]);
  }

  console.error(`[pp-daily] Fetching ${zpidsToTry.length} zpids directly: ${zpidsToTry.join(', ')}`);

  const results = await Promise.allSettled(
    zpidsToTry.map(zpid => fetchPropertyDirect(zpid, apiKey, apiHost, 7000))
  );

  const listings = [];
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 6); // 6-month window — matches pool

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status !== 'fulfilled' || !r.value) continue;

    const d = r.value;
    const soldEvent = extractSoldEvent(d.priceHistory || []);
    const soldPrice = soldEvent?.price || d.lastSoldPrice || null;
    const soldDate = soldEvent?.date || null;

    if (!soldPrice || soldPrice < 50000) continue;
    if (soldDate) {
      const saleDate = new Date(soldDate);
      if (saleDate < cutoff) continue;
    }

    const photo = extractPhotos(d);
    const beds = d.bedrooms || 0;
    if (!beds || !photo) continue;

    listings.push({
      zpid: String(zpidsToTry[i]),
      address: d.streetAddress || d.address?.streetAddress || 'Unknown',
      city: d.city || d.address?.city || 'San Francisco',
      state: d.state || d.address?.state || 'CA',
      zip: d.zipcode || d.address?.zipcode || '',
      neighborhood: d.neighborhoodRegion?.name || '',
      photo,
      beds,
      baths: d.bathrooms || null,
      sqft: d.livingArea || d.livingAreaValue || null,
      yearBuilt: d.yearBuilt || null,
      propertyType: normalizeHomeType(d.homeType),
      listPrice: extractListPrice(d.priceHistory || []) || soldPrice,
      daysOnMarket: d.daysOnZillow || null,
      soldPrice,
      soldDate,
    });
  }

  console.error(`[pp-daily] Got ${listings.length} valid sold listings from direct fetch`);
  return listings;
}

// ââ Pick a deterministic daily property ââ
function pickDailyProperty(listings, dailyNumber) {
  if (!listings.length) return null;
  const idx = (dailyNumber * 7 + 3) % listings.length;
  const l = listings[idx];
  return {
    zpid: l.zpid,
    address: l.address,
    city: l.city,
    state: l.state,
    zip: l.zip,
    neighborhood: l.neighborhood,
    photo: l.photo,
    beds: l.beds,
    baths: l.baths,
    sqft: l.sqft,
    year_built: l.yearBuilt,
    property_type: l.propertyType,
    list_price: l.listPrice,
    days_on_market: l.daysOnMarket,
    sold_price: l.soldPrice,
  };
}

// ââ Market metadata ââ
const MARKETS = {
  sf: { name: 'San Francisco', state: 'CA' },
  oakland: { name: 'Oakland', state: 'CA' },
  berkeley: { name: 'Berkeley', state: 'CA' },
  alameda: { name: 'Alameda', state: 'CA' },
};

// ââ In-memory cache for seeded dailies (survives warm starts) ââ
const dailyCache = new Map();

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const marketId = (req.query.market || 'sf').toLowerCase();
  const reveal = req.query.reveal === 'true';
  const playerId = req.query.player || null;
  const today = getTodayDate();
  const dailyNumber = getDailyNumber(marketId);

  if (!MARKETS[marketId]) {
    return res.status(400).json({ error: 'Invalid market. Valid: sf, oakland, berkeley, alameda' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    // 1. Check if today's daily already exists
    const cacheKey = `${marketId}-${today}`;
    let daily = dailyCache.get(cacheKey) || null;

    if (!daily) {
      const { data, error } = await supabase
        .from('pp_daily_challenges')
        .select('*')
        .eq('market_id', marketId)
        .eq('challenge_date', today)
        .single();

      if (data && !error) {
        daily = data;
        dailyCache.set(cacheKey, daily);
      }
    }

    // 2. If no daily exists, pick one from pp_property_pool (preferred) or
    //    fall back to direct discovery if the pool is empty for this market.
    if (!daily) {
      console.error(`[pp-daily] Seeding daily for ${marketId} on ${today} (#${dailyNumber})`);

      // Read pool for the market within the last 6 months.
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

      const { data: poolRows } = await supabase
        .from('pp_property_pool')
        .select('*')
        .eq('market_id', marketId)
        .gte('sold_date', sixMonthsAgoStr)
        .limit(500);

      let property = null;
      if (poolRows && poolRows.length > 0) {
        // Pick deterministically based on daily number so the same daily shows
        // for everyone in the market. Mod into pool length.
        const idx = (dailyNumber * 7 + 3) % poolRows.length;
        const r = poolRows[idx];
        property = {
          zpid: String(r.zpid),
          address: r.address,
          city: r.city,
          state: r.state || 'CA',
          zip: r.zip,
          neighborhood: r.neighborhood,
          photo: r.photo,
          beds: r.beds,
          baths: r.baths,
          sqft: r.sqft,
          year_built: r.year_built,
          property_type: r.property_type,
          list_price: r.list_price,
          days_on_market: 0,
          sold_price: r.sold_price,
        };
        console.error(`[pp-daily] Picked from pool (${poolRows.length} entries) → ${r.address}`);
      } else {
        // Pool is empty for this market — fall back to direct discovery so the
        // first request after deploy can still serve a Daily. Subsequent
        // requests will hit the pool because /api/sold-comps populates it.
        console.error(`[pp-daily] Pool empty for ${marketId} — falling back to direct discovery`);
        const listings = await fetchSoldListingsDirect(marketId, dailyNumber);
        property = pickDailyProperty(listings, dailyNumber);
      }

      if (!property) {
        return res.status(503).json({
          error: 'No suitable listings found to seed daily challenge',
          market: marketId,
          date: today,
          debug: { source: poolRows && poolRows.length > 0 ? 'pool' : 'discovery' },
        });
      }

      const row = {
        market_id: marketId,
        challenge_date: today,
        daily_number: dailyNumber,
        ...property,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('pp_daily_challenges')
        .insert(row)
        .select()
        .single();

      if (insertErr) {
        // Race condition: another request seeded it first
        if (insertErr.code === '23505') {
          const { data: existing } = await supabase
            .from('pp_daily_challenges')
            .select('*')
            .eq('market_id', marketId)
            .eq('challenge_date', today)
            .single();
          daily = existing;
        } else {
          // Surface the full Supabase error so we can diagnose schema/RLS issues from the response.
          // None of these fields are sensitive (no PII, no secrets), just Postgres error metadata.
          console.error('[pp-daily] Insert error:', JSON.stringify({
            code: insertErr.code,
            message: insertErr.message,
            details: insertErr.details,
            hint: insertErr.hint,
          }));
          return res.status(500).json({
            error: 'Failed to seed daily challenge',
            supabase: {
              code: insertErr.code,
              message: insertErr.message,
              details: insertErr.details,
              hint: insertErr.hint,
            },
            attemptedRowKeys: Object.keys(row),
          });
        }
      } else {
        daily = inserted;
      }

      if (daily) dailyCache.set(cacheKey, daily);
    }

    if (!daily) {
      return res.status(500).json({ error: 'Failed to load daily challenge' });
    }

    // 3. Build response â strip sold_price unless reveal is requested
    const response = {
      id: daily.id,
      marketId: daily.market_id,
      challengeDate: daily.challenge_date,
      dailyNumber: daily.daily_number,
      zpid: daily.zpid,
      address: daily.address,
      city: daily.city,
      state: daily.state,
      zip: daily.zip,
      neighborhood: daily.neighborhood,
      photo: daily.photo,
      beds: daily.beds,
      baths: daily.baths,
      sqft: daily.sqft,
      yearBuilt: daily.year_built,
      propertyType: daily.property_type,
      listPrice: daily.list_price,
      daysOnMarket: daily.days_on_market,
    };

    // Only include sold_price if player has already guessed
    if (reveal && playerId) {
      const { data: existingGuess } = await supabase
        .from('pp_guesses')
        .select('id')
        .eq('player_id', playerId)
        .eq('daily_id', daily.id)
        .single();

      if (existingGuess) {
        response.soldPrice = daily.sold_price;
      }
    }

    // CDN cache: 1 hour (daily doesn't change within a day)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    return res.status(200).json(response);

  } catch (err) {
    console.error('[pp-daily] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
