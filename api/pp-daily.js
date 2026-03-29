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

// ── Fetch sold listings via internal sold-comps endpoint ──
// Uses a rotating zip code to keep the request small and fast (avoids Vercel timeout).
// Each day picks a different neighborhood so the daily challenge varies.
const MARKET_ZIPS = {
  sf: ["94122", "94118", "94110", "94114", "94115", "94107", "94112", "94103", "94102", "94123", "94124", "94131"],
  oakland: ["94601", "94602", "94603", "94606", "94607", "94609", "94610", "94611", "94612"],
  berkeley: ["94702", "94703", "94704", "94705", "94707", "94708", "94709", "94710"],
  alameda: ["94501", "94502"],
};

async function fetchSoldListings(market, marketId, dailyNumber) {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://blueprint.realstack.app');

  // Try zip-specific first, fall back to city-wide
  const zips = MARKET_ZIPS[marketId] || [];
  const zip = zips.length > 0 ? zips[dailyNumber % zips.length] : null;
  const urls = [];
  if (zip) urls.push(`${baseUrl}/api/sold-comps?city=${encodeURIComponent(market.name)}&zip=${zip}`);
  urls.push(`${baseUrl}/api/sold-comps?city=${encodeURIComponent(market.name)}`); // city-wide fallback

  for (const url of urls) {
    try {
      console.log(`[pp-daily] Fetching sold comps from: ${url}`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        console.error('[pp-daily] sold-comps error:', res.status);
        continue;
      }

      const data = await res.json();
      const listings = data.soldListings || [];
      if (listings.length > 0) {
        console.log(`[pp-daily] Got ${listings.length} sold listings from ${url}`);
        return listings;
      }
      console.log(`[pp-daily] 0 sold from ${url}, trying next...`);
    } catch (err) {
      console.error('[pp-daily] fetchSoldListings error:', err.message);
    }
  }
  return [];
}

// ── Normalize a sold-comps listing into daily challenge format ──
// sold-comps already returns normalized data, just map field names for the DB
function normalizeForDaily(listing) {
  return {
    zpid: String(listing.zpid || ''),
    address: listing.address || 'Unknown',
    city: listing.city || '',
    state: listing.state || 'CA',
    zip: listing.zip || '',
    neighborhood: listing.neighborhood || '',
    photo: listing.photo || (listing.photos && listing.photos[0]) || '',
    beds: listing.beds || null,
    baths: listing.baths || null,
    sqft: listing.sqft || null,
    year_built: listing.yearBuilt || null,
    property_type: listing.propertyType || 'Single Family',
    list_price: listing.listPrice || null,
    days_on_market: listing.daysOnMarket || null,
    sold_price: listing.soldPrice || null,
  };
}

// ── Pick a deterministic daily property ──
// Uses the daily number as a seed to pick consistently for a given date
function pickDailyProperty(listings, dailyNumber) {
  if (!listings.length) return null;
  // Filter to recent properties with a sold price, photo, and beds
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 5);
  const valid = listings.filter(l => {
    if (!l.soldPrice || l.soldPrice < 50000) return false;
    if (!l.photo && !(l.photos && l.photos[0])) return false;
    if (!l.beds) return false;
    // Filter ancient sales
    if (l.soldDate) {
      const saleDate = new Date(l.soldDate);
      if (saleDate < cutoff) return false;
    }
    return true;
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

      const listings = await fetchSoldListings(MARKETS[marketId], marketId, dailyNumber);
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
