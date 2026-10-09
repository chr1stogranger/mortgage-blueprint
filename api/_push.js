// api/_push.js — shared push sender (not a route: underscore files aren't
// deployed as functions). Used by cron-deliver (queued notifications) and
// pp-guess (instant "someone beat your call" alerts).
import webpush from 'web-push';

// Where a notification opens: Sold/Daily alerts (payload.kind === 'sold')
// land on Stats (your guesses + each home's field); property alerts open
// that home's board.
export function notificationUrl(notification) {
  const p = notification.payload || {};
  if (p.kind === 'sold') return '/?v=pricepoint&stats=1';
  return `/?v=pricepoint${p.zpid ? `&board=${encodeURIComponent(p.zpid)}` : ""}`;
}

// ── Push: web (VAPID web-push) + native (FCM legacy HTTP API) ──
// Web tokens are JSON.stringify'd PushSubscription objects registered by
// src/lib/pushNotifications.js; the payload shape matches public/push-sw.js.
// Returns deadTokens (gone subscriptions, HTTP 404/410) for the caller to prune.
function vapidConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function deliverPush(notification, deviceTokens) {
  if (!deviceTokens || deviceTokens.length === 0) return { sent: 0, failed: 0, deadTokens: [], error: "No device tokens" };

  const fcmKey = process.env.FCM_SERVER_KEY;
  if (vapidConfigured()) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:blueprint@realstack.app",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }

  let sent = 0, failed = 0;
  const deadTokens = [];
  let lastError = null;

  for (const dt of deviceTokens) {
    if (dt.platform === "web") {
      if (!vapidConfigured()) { failed++; lastError = "VAPID keys not configured"; continue; }
      try {
        const subscription = JSON.parse(dt.token);
        await webpush.sendNotification(subscription, JSON.stringify({
          title: notification.title,
          body: notification.body,
          data: { type: notification.type, url: notificationUrl(notification), payload: notification.payload || {} },
        }));
        sent++;
      } catch (e) {
        failed++;
        // 404/410 = the browser dropped the subscription — prune the row.
        if (e.statusCode === 404 || e.statusCode === 410) deadTokens.push(dt);
        else lastError = `web-push ${e.statusCode || e.message}`;
      }
      continue;
    }

    // Native ios/android tokens go through FCM.
    if (!fcmKey) { failed++; lastError = "FCM_SERVER_KEY not configured"; continue; }
    try {
      const resp = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: { Authorization: `key=${fcmKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          to: dt.token,
          notification: { title: notification.title, body: notification.body },
          data: { type: notification.type, payload: JSON.stringify(notification.payload || {}) },
        }),
      });
      if (resp.ok) sent++; else { failed++; lastError = `FCM ${resp.status}`; }
    } catch (e) { failed++; lastError = e.message; }
  }
  return { sent, failed, deadTokens, error: sent === 0 ? (lastError || "No deliverable tokens") : null };
}

