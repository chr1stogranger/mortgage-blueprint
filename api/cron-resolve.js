import { createClient } from '@supabase/supabase-js';

// CORS configuration
const ALLOWED_ORIGINS = [
  'https://blueprint.realstack.app',
  'https://mortgage-blueprint.vercel.app',
  'http://localhost:5173',
];

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
      return res.status(200).json({
        resolved: 0,
        checked: 0,
        errors: [],
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

    return res.status(200).json({
      resolved: allResults.resolved,
      checked: allResults.checked,
      errors: allResults.errors,
      resolvedPredictions: allResults.resolvedPredictions,
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
