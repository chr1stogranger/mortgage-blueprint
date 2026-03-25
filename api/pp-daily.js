// /api/pp-daily.js — Vercel Serverless Function
// Manages PricePoint Daily challenges: fetches or seeds today's challenge per market.
//
// GET /api/pp-daily?market=sf
//   → Returns today's daily challenge (without sold_price)
//
// GET /api/pp-daily?market=sf&reveal=true&player=<uuid>
//   → Returns daily WITH sold_price (only if player has already guessed)
//
// Uses Supabase service role key to bypass RLS for seeding.

import { createClient } from '@supabase/supabase-js';

// Supabase admin client (server-side only — uses SERVICE key)
function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ── Daily number: days since epoch (per market) ──
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

// ── Fetch sold listings from RapidAPI (reuses pricepoint.js logic) ──
async function fetchSoldListings(market) {
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
  if (!RAPIDAPI_KEY) {
    console.error('[pp-daily] Missing RAPIDAPI_KEY');
    return [];
  }

  const res = await fetch(
    `https://zillow-com-api.p.rapidapi.com/search?location=${encodeURIComponent(market.name + ', ' + market.state)}&listingStatus=sold&home_type=Houses,Condos,Townhomes,MultiFamily&sortSelection=priorityscore&page=1`,
    {
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'zillow-com-api.p.rapidapi.com',
      },
    }
  );

  if (!res.ok) {
    console.error('[pp-daily] RapidAPI error:', res.status);
    return [];
  }

  const data = await res.json();
  // Extract listings from various response shapes
  const props = data.searchResults || data.props || data.results || data.data?.results || [];
  return Array.isArray(props) ? props : [];
}

// ── Normalize a raw listing into daily challenge format ──
function normalizeForDaily(raw) {
  const sqft = raw.livingArea || 0;
  let homeType = raw.homeType || raw.propertyType || '';
  if (homeType === 'SINGLE_FAMILY') homeType = 'SingleFamily';
  else if (homeType === 'CONDO') homeType = 'Condo';
  else if (homeType === 'TOWNHOUSE') homeType = 'Townhouse';
  else if (homeType === 'MULTI_FAMILY') homeType = 'MultiFamily';

  return {
    zpid: String(raw.zpid || ''),
    address: raw.streetAddress || raw.address || 'Unknown',
    city: raw.city || '',
    state: raw.state || 'CA',
    zip: raw.zipcode || raw.zip || '',
    neighborhood: raw.neighborhood || '',
    photo: raw.imgSrc || raw.image || raw.photos?.[0] || '',
    beds: raw.bedrooms || raw.beds || null,
    baths: raw.bathrooms || raw.baths || null,
    sqft: sqft || null,
    year_built: raw.yearBuilt || null,
    property_type: homeType,
    list_price: raw.listPrice || raw.originalListPrice || null,
    days_on_market: raw.daysOnZillow || raw.daysOnMarket || null,
    sold_price: raw.price || raw.soldPrice || null,
  };
}

// ── Pick a deterministic daily property ──
// Uses the daily number as a seed to pick consistently for a given date
function pickDailyProperty(listings, dailyNumber) {
  if (!listings.length) return null;
  // Filter to properties with a sold price and photo
  const valid = listings.filter(l => {
    const p = normalizeForDaily(l);
    return p.sold_price && p.sold_price > 50000 && p.photo && p.beds;
  });
  if (!valid.length) return null;
  // Deterministic pick: daily number mod valid count
  const idx = (dailyNumber * 7 + 3) % valid.length;  // simple hash
  return normalizeForDaily(valid[idx]);
}

// ── Market metadata ──
const MARKETS = {
  sf: { name: 'San Francisco', state: 'CA' },
  oakland: { name: 'Oakland', state: 'CA' },
  berkeley: { name: 'Berkeley', state: 'CA' },
  alameda: { name: 'Alameda', state: 'CA' },
};

// ── In-memory cache for seeded dailies (survives warm starts) ──
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

    // 2. If no daily exists, seed one from RapidAPI
    if (!daily) {
      console.log(`[pp-daily] Seeding daily for ${marketId} on ${today} (#${dailyNumber})`);

      const listings = await fetchSoldListings(MARKETS[marketId]);
      const property = pickDailyProperty(listings, dailyNumber);

      if (!property) {
        return res.status(503).json({
          error: 'No suitable listings found to seed daily challenge',
          market: marketId,
          date: today,
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
          console.error('[pp-daily] Insert error:', insertErr.message);
          return res.status(500).json({ error: 'Failed to seed daily challenge' });
        }
      } else {
        daily = inserted;
      }

      if (daily) dailyCache.set(cacheKey, daily);
    }

    if (!daily) {
      return res.status(500).json({ error: 'Failed to load daily challenge' });
    }

    // 3. Build response — strip sold_price unless reveal is requested
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
