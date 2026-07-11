import { createClient } from '@supabase/supabase-js';
import { enrichPoolRow } from './_enrich.js';

// Raise the function budget: this cron now resolves predictions AND runs the
// nightly Free Play photo backfill (folded in here to stay under the Hobby plan's
// 12-serverless-function limit — a standalone cron-enrich would be a 13th function).
export const config = { maxDuration: 60 };

// CORS configuration
const ALLOWED_ORIGINS = [
  'https://blueprint.realstack.app',
  'https://mortgage-blueprint.vercel.app',
  'http://localhost:5173',
];

// ── Free Play pool photo backfill ────────────────────────────────────────────
// County (RentCast) rows ship with photo=null, so Free Play cards look empty until
// a user opens one. This proactively enriches the freshest photo-less rows per
// market. Sized small so it shares the 60s budget with prediction resolution.
const ENRICH_MARKETS = ['sf', 'oakland', 'berkeley', 'alameda', 'la', 'sd'];
const ENRICH_ROWS_PER_MARKET = 4;
const ENRICH_MAX_CALLS = 24;   // hard cap per run — protects the RapidAPI quota
const ENRICH_MAX_ATTEMPTS = 3; // skip rows that keep failing to resolve
const enrichSleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runEnrichPass(supabase) {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return { enriched: 0, attempted: 0, skipped: 'no_api_key' };
  const apiHost = process.env.RAPIDAPI_HOST || 'real-time-real-estate-data.p.rapidapi.com';
  let calls = 0, enriched = 0, attempted = 0;
  for (const market of ENRICH_MARKETS) {
    if (calls >= ENRICH_MAX_CALLS) break;
    const { data: rows } = await supabase
      .from('pp_property_pool')
      .select('id, zpid, address, city, state, zip, sold_price, year_built, enrich_attempts, photo')
      .eq('market_id', market)
      .or('photo.is.null,photo.eq.')
      .lt('enrich_attempts', ENRICH_MAX_ATTEMPTS)
      .order('sold_date', { ascending: false })
      .limit(ENRICH_ROWS_PER_MARKET);
    for (const row of (rows || [])) {
      if (calls >= ENRICH_MAX_CALLS) break;
      attempted++; calls++;
      const r = await enrichPoolRow(supabase, row, { apiKey, apiHost });
      if (r.enriched) enriched++;
      await enrichSleep(250);
    }
  }
  console.error(`[CronResolve] enrich pass: attempted=${attempted} enriched=${enriched} calls=${calls}`);
  return { enriched, attempted };
}

// ─── Daily fresh-search pump (folded in — Hobby 12-fn limit) ───
// Pumps /api/sold-comps?freshsearch=1 for each launch market: a search-ONLY
// discovery (Zillow recentlySold, no RentCast) so sales from the last few days
// flow into pp_property_pool every day, not just on the Monday pool-seed.
// County-record (RentCast) data lags 2-4 months — this is what keeps Free Play
// comps current.
const PUMP_MARKETS = [
  'San Francisco', 'Alameda', 'Oakland', 'Berkeley',
  'Los Angeles', 'San Diego',
];

async function runFreshSearchPump() {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { skipped: 'no_cron_secret' };
  const host = process.env.VERCEL_URL || 'blueprint.realstack.app';
  const baseUrl = host.startsWith('http') ? host : `https://${host}`;
  const results = await Promise.all(PUMP_MARKETS.map(async (market) => {
    const t0 = Date.now();
    try {
      const r = await fetch(
        `${baseUrl}/api/sold-comps?city=${encodeURIComponent(market)}&freshsearch=1`,
        { headers: { Authorization: `Bearer ${secret}` } }
      );
      const j = await r.json();
      return {
        market,
        status: r.status,
        newlyAdded: j.newlyAdded ?? 0,
        poolPrimeSize: j.poolPrimeSize,
        latencyMs: Date.now() - t0,
      };
    } catch (err) {
      return { market, error: err.message, latencyMs: Date.now() - t0 };
    }
  }));
  console.error(`[CronResolve] fresh-search pump: ${JSON.stringify(results)}`);
  return results;
}

// Get Supabase admin client
function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Extract sold price and date from priceHistory
// RapidAPI uses `event` field (not `eventType`) — matches sold-comps.js pattern
function extractSoldEvent(priceHistory) {
  if (!priceHistory || !Array.isArray(priceHistory)) return null;

  const soldEvent = priceHistory.find(
    (evt) =>
      evt.event === 'Sold' ||
      evt.event === 'SOLD' ||
      (evt.event && evt.event.toLowerCase().includes('sold')) ||
      evt.event === 'Closed'
  );

  if (soldEvent && soldEvent.price) {
    return {
      soldPrice: soldEvent.price,
      soldDate: soldEvent.date || soldEvent.priceChangeDate || new Date().toISOString(),
    };
  }

  return null;
}

// Fetch property details from RapidAPI
async function fetchPropertyDetails(zpid) {
  if (!process.env.RAPIDAPI_KEY) {
    console.error('[CronResolve] RAPIDAPI_KEY not set');
    throw new Error('RAPIDAPI_KEY missing');
  }

  const options = {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'real-time-real-estate-data.p.rapidapi.com',
    },
  };

  try {
    const response = await fetch(
      `https://real-time-real-estate-data.p.rapidapi.com/property?zpid=${zpid}`,
      options
    );

    if (!response.ok) {
      console.error(`[CronResolve] RapidAPI error for zpid ${zpid}: ${response.status}`);
      return null;
    }

    const raw = await response.json();
    return raw.data || raw;
  } catch (error) {
    console.error(`[CronResolve] Failed to fetch zpid ${zpid}: ${error.message}`);
    return null;
  }
}

// Process a batch of zpids
async function processBatch(zpids, supabase) {
  const results = {
    resolved: 0,
    errors: [],
    resolvedPredictions: [],
  };

  for (const zpid of zpids) {
    try {
      // Fetch property details
      const propertyData = await fetchPropertyDetails(zpid);

      if (!propertyData) {
        results.errors.push(`Failed to fetch zpid ${zpid}`);
        continue;
      }

      // Check for sold status via priceHistory
      const soldEvent = extractSoldEvent(propertyData.priceHistory);

      if (!soldEvent) {
        // Property not yet sold
        continue;
      }

      const soldPrice = soldEvent.soldPrice;
      const soldDate = soldEvent.soldDate;

      // Get all unresolved predictions for this zpid
      const { data: predictions, error: selectError } = await supabase
        .from('pp_predictions')
        .select('id, user_id, predicted_price, list_price, address')
        .eq('zpid', zpid)
        .eq('resolved', false);

      if (selectError) {
        results.errors.push(`Failed to fetch predictions for zpid ${zpid}: ${selectError.message}`);
        continue;
      }

      if (!predictions || predictions.length === 0) {
        continue;
      }

      // Calculate accuracy percentage
      const pctOff = Math.abs((predictions[0].predicted_price - soldPrice) / soldPrice * 100);

      // Update all predictions for this zpid as resolved
      const { error: updateError } = await supabase
        .from('pp_predictions')
        .update({
          resolved: true,
          sold_price: soldPrice,
          pct_off: parseFloat(pctOff.toFixed(2)),
          resolved_at: new Date().toISOString(),
        })
        .eq('zpid', zpid)
        .eq('resolved', false);

      if (updateError) {
        results.errors.push(`Failed to update predictions for zpid ${zpid}: ${updateError.message}`);
        continue;
      }

      // Create notifications for each prediction
      const notificationInserts = predictions.map((pred) => ({
        user_id: pred.user_id,
        type: 'prediction_resolved',
        title: 'Your prediction resolved!',
        body: `${pred.address} sold for $${(soldPrice / 1000000).toFixed(2)}M — you were ${pctOff.toFixed(1)}% off!`,
        payload: {
          zpid,
          address: pred.address,
          predicted_price: pred.predicted_price,
          sold_price: soldPrice,
          pct_off: parseFloat(pctOff.toFixed(2)),
          list_price: pred.list_price,
        },
      }));

      const { data: notifications, error: notifError } = await supabase
        .from('pp_notifications')
        .insert(notificationInserts)
        .select('id, user_id');

      if (notifError) {
        results.errors.push(`Failed to insert notifications for zpid ${zpid}: ${notifError.message}`);
        continue;
      }

      // For each notification, create queue entries per enabled channel
      const queueEntries = [];

      for (const notif of notifications) {
        // Get player's notification preferences
        const { data: playerPrefs, error: prefError } = await supabase
          .from('pp_players')
          .select('push_enabled, email_enabled, sms_enabled')
          .eq('id', notif.user_id)
          .single();

        if (prefError) {
          console.error(`[CronResolve] Failed to fetch player prefs for user ${notif.user_id}: ${prefError.message}`);
          continue;
        }

        // Always add in-app notification
        queueEntries.push({
          notification_id: notif.id,
          user_id: notif.user_id,
          channel: 'in_app',
          status: 'sent',
          sent_at: new Date().toISOString(),
        });

        // Add push notification if enabled
        if (playerPrefs?.push_enabled) {
          queueEntries.push({
            notification_id: notif.id,
            user_id: notif.user_id,
            channel: 'push',
            status: 'pending',
          });
        }

        // Add email notification if enabled
        if (playerPrefs?.email_enabled) {
          queueEntries.push({
            notification_id: notif.id,
            user_id: notif.user_id,
            channel: 'email',
            status: 'pending',
          });
        }

        // Add SMS notification if enabled
        if (playerPrefs?.sms_enabled) {
          queueEntries.push({
            notification_id: notif.id,
            user_id: notif.user_id,
            channel: 'sms',
            status: 'pending',
          });
        }
      }

      // Insert all queue entries in batch
      if (queueEntries.length > 0) {
        const { error: queueError } = await supabase
          .from('pp_notification_queue')
          .insert(queueEntries);

        if (queueError) {
          results.errors.push(`Failed to insert queue entries for zpid ${zpid}: ${queueError.message}`);
          continue;
        }
      }

      results.resolved += 1;
      results.resolvedPredictions.push({
        zpid,
        address: predictions[0].address,
        soldPrice,
        predictionCount: predictions.length,
      });

    } catch (error) {
      results.errors.push(`Unexpected error processing zpid ${zpid}: ${error.message}`);
    }
  }

  return results;
}

// Verify CORS origin
function verifyCORS(origin) {
  return ALLOWED_ORIGINS.includes(origin);
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', verifyCORS(origin) ? origin : '');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Authentication: Check CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[CronResolve] CRON_SECRET not configured');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  // Accept secret from Authorization header (Vercel cron sends this)
  // or as query param (for manual testing)
  const authHeader = req.headers.authorization || '';
  const querySecret = req.query.secret || '';
  const providedSecret = authHeader.replace('Bearer ', '') || querySecret;

  if (providedSecret !== cronSecret) {
    console.error('[CronResolve] Unauthorized request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error('[CronResolve] Supabase configuration missing');
      return res.status(500).json({ error: 'Database configuration missing' });
    }

    // Get distinct zpids with unresolved predictions
    const { data: predictions, error: selectError } = await supabase
      .from('pp_predictions')
      .select('zpid')
      .eq('resolved', false)
      .order('zpid');

    if (selectError) {
      console.error(`[CronResolve] Failed to fetch unresolved predictions: ${selectError.message}`);
      return res.status(500).json({ error: selectError.message });
    }

    // Extract unique zpids
    const uniqueZpids = [...new Set(predictions.map((p) => p.zpid))];

    if (uniqueZpids.length === 0) {
      console.error('[CronResolve] No unresolved predictions found');
      // Still run the Free Play photo backfill + fresh-search pump even when
      // there's nothing to resolve. Parallel — they hit different APIs and
      // must share the 60s budget.
      let enrich = null, freshSearch = null;
      const [enrichR, pumpR] = await Promise.allSettled([
        runEnrichPass(supabase),
        runFreshSearchPump(),
      ]);
      if (enrichR.status === 'fulfilled') enrich = enrichR.value;
      else console.error(`[CronResolve] enrich pass failed: ${enrichR.reason?.message}`);
      if (pumpR.status === 'fulfilled') freshSearch = pumpR.value;
      else console.error(`[CronResolve] fresh-search pump failed: ${pumpR.reason?.message}`);
      return res.status(200).json({
        resolved: 0,
        checked: 0,
        errors: [],
        enrich,
        freshSearch,
        timestamp: new Date().toISOString(),
      });
    }

    // Process in batches of 10 (max per invocation)
    const batchSize = 10;
    const allResults = {
      resolved: 0,
      checked: 0,
      errors: [],
      resolvedPredictions: [],
    };

    for (let i = 0; i < uniqueZpids.length; i += batchSize) {
      const batch = uniqueZpids.slice(i, i + batchSize);
      allResults.checked += batch.length;

      // Process batch in parallel chunks of 5
      const chunkSize = 5;
      for (let j = 0; j < batch.length; j += chunkSize) {
        const chunk = batch.slice(j, j + chunkSize);
        const batchResults = await processBatch(chunk, supabase);

        allResults.resolved += batchResults.resolved;
        allResults.errors.push(...batchResults.errors);
        allResults.resolvedPredictions.push(...batchResults.resolvedPredictions);
      }
    }

    // Log summary
    console.error(
      `[CronResolve] Checked ${allResults.checked} zpids, resolved ${allResults.resolved} predictions for ${allResults.resolvedPredictions.length} properties`
    );

    // Free Play photo backfill + fresh-search pump (folded in). Non-fatal,
    // parallel to share the 60s budget.
    let enrich = null, freshSearch = null;
    const [enrichR, pumpR] = await Promise.allSettled([
      runEnrichPass(supabase),
      runFreshSearchPump(),
    ]);
    if (enrichR.status === 'fulfilled') enrich = enrichR.value;
    else console.error(`[CronResolve] enrich pass failed: ${enrichR.reason?.message}`);
    if (pumpR.status === 'fulfilled') freshSearch = pumpR.value;
    else console.error(`[CronResolve] fresh-search pump failed: ${pumpR.reason?.message}`);

    return res.status(200).json({
      resolved: allResults.resolved,
      checked: allResults.checked,
      errors: allResults.errors,
      resolvedPredictions: allResults.resolvedPredictions,
      enrich,
      freshSearch,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error(`[CronResolve] Unexpected error: ${error.message}`);
    return res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
