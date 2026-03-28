// /api/cron-deliver.js — Vercel Serverless Function (Cron)
// Processes pp_notification_queue and delivers via push, email, SMS.
// Runs daily after cron-resolve.js.
//
// Env vars needed:
//   CRON_SECRET — Vercel cron auth
//   FCM_SERVER_KEY — Firebase Cloud Messaging (push)
//   RESEND_API_KEY — Resend (email)
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER — Twilio (SMS)

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
  "https://blueprint.realstack.app",
  "https://mortgage-blueprint.vercel.app",
  "http://localhost:5173",
];

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function escapeHtml(text) {
  return String(text || "").replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

function buildEmailHtml(notification) {
  const ctaUrl = "https://blueprint.realstack.app/?v=pricepoint";
  const payload = notification.payload || {};
  const pctOff = payload.pct_off != null ? `${payload.pct_off.toFixed(1)}%` : "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:20px}
  .c{max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.08)}
  .logo{font-size:13px;font-weight:700;letter-spacing:2px;color:#6366F1;text-transform:uppercase;margin-bottom:24px}
  h1{font-size:22px;font-weight:700;color:#171717;margin:0 0 12px}
  .body{font-size:15px;line-height:1.6;color:#525252;margin:0 0 24px}
  .stat{display:inline-block;background:#F0F0FF;color:#6366F1;font-weight:700;padding:4px 12px;border-radius:8px;font-size:14px;margin:0 0 20px}
  .cta{display:inline-block;background:linear-gradient(135deg,#6366F1,#3B82F6);color:#fff;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:600;font-size:15px}
  .foot{border-top:1px solid #e5e5e5;margin-top:32px;padding-top:16px;font-size:11px;color:#999}
</style></head>
<body><div class="c">
  <div class="logo">PricePoint</div>
  <h1>${escapeHtml(notification.title)}</h1>
  <p class="body">${escapeHtml(notification.body)}</p>
  ${pctOff ? `<div class="stat">${pctOff} off</div><br><br>` : ""}
  <a href="${ctaUrl}" class="cta">Open PricePoint</a>
  <div class="foot">
    <p>You're receiving this because you enabled email notifications on PricePoint.<br>
    <a href="${ctaUrl}">Manage preferences</a></p>
  </div>
</div></body></html>`;
}

// ── Push via FCM legacy HTTP API ──
async function deliverPush(notification, deviceTokens) {
  const fcmKey = process.env.FCM_SERVER_KEY;
  if (!fcmKey) return { sent: 0, failed: 0, error: "FCM_SERVER_KEY not configured" };
  if (!deviceTokens || deviceTokens.length === 0) return { sent: 0, failed: 0, error: "No device tokens" };

  let sent = 0, failed = 0;
  for (const dt of deviceTokens) {
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
      if (resp.ok) sent++; else failed++;
    } catch { failed++; }
  }
  return { sent, failed, error: failed > 0 ? "Partial FCM failures" : null };
}

// ── Email via Resend API ──
async function deliverEmail(notification, email) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: "RESEND_API_KEY not configured" };
  if (!email) return { success: false, error: "No email address" };

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "PricePoint <notifications@realstack.app>",
        to: email,
        subject: notification.title,
        html: buildEmailHtml(notification),
      }),
    });
    return { success: resp.ok, error: resp.ok ? null : `Resend ${resp.status}` };
  } catch (e) { return { success: false, error: e.message }; }
}

// ── SMS via Twilio API ──
async function deliverSms(notification, phone) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return { success: false, error: "Twilio not configured" };
  if (!phone) return { success: false, error: "No phone number" };

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const body = new URLSearchParams({ From: from, To: phone, Body: `${notification.title}: ${notification.body}` });
    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    return { success: resp.status === 201, error: resp.status === 201 ? null : `Twilio ${resp.status}` };
  } catch (e) { return { success: false, error: e.message }; }
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Auth: cron secret
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  const secret = process.env.CRON_SECRET;
  if (!secret || (token !== secret && req.query.secret !== secret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

  try {
    // 1. Get pending queue items
    const { data: queue, error: qErr } = await supabase
      .from("pp_notification_queue")
      .select("id, notification_id, channel, status")
      .eq("status", "pending")
      .limit(100);

    if (qErr) throw qErr;
    if (!queue || queue.length === 0) {
      return res.status(200).json({ processed: 0, sent: { push: 0, email: 0, sms: 0 }, failed: 0, timestamp: new Date().toISOString() });
    }

    // 2. Get the notification details for these queue items
    const notifIds = [...new Set(queue.map(q => q.notification_id))];
    const { data: notifications } = await supabase
      .from("pp_notifications")
      .select("id, player_id, type, title, body, payload")
      .in("id", notifIds);

    const notifMap = {};
    for (const n of (notifications || [])) notifMap[n.id] = n;

    // 3. Get player info for all involved players
    const playerIds = [...new Set((notifications || []).map(n => n.player_id))];
    const { data: players } = await supabase
      .from("pp_players")
      .select("id, email, phone, push_enabled, email_enabled, sms_enabled")
      .in("id", playerIds);

    const playerMap = {};
    for (const p of (players || [])) playerMap[p.id] = p;

    // 4. Get device tokens for push
    const { data: tokens } = await supabase
      .from("pp_device_tokens")
      .select("player_id, token, platform")
      .in("player_id", playerIds);

    const tokensByPlayer = {};
    for (const t of (tokens || [])) {
      if (!tokensByPlayer[t.player_id]) tokensByPlayer[t.player_id] = [];
      tokensByPlayer[t.player_id].push(t);
    }

    // 5. Process each queue item
    const stats = { push: 0, email: 0, sms: 0 };
    let failCount = 0;

    for (const item of queue) {
      const notif = notifMap[item.notification_id];
      if (!notif) {
        await supabase.from("pp_notification_queue").update({ status: "failed", sent_at: new Date().toISOString(), error_message: "Notification not found" }).eq("id", item.id);
        failCount++;
        continue;
      }

      const player = playerMap[notif.player_id];
      if (!player) {
        await supabase.from("pp_notification_queue").update({ status: "failed", sent_at: new Date().toISOString(), error_message: "Player not found" }).eq("id", item.id);
        failCount++;
        continue;
      }

      let deliveryError = null;

      if (item.channel === "push") {
        const dt = tokensByPlayer[player.id] || [];
        const result = await deliverPush(notif, dt);
        if (result.sent > 0) stats.push += result.sent;
        if (result.error) deliveryError = result.error;
        if (result.sent === 0) failCount++;
      } else if (item.channel === "email") {
        const result = await deliverEmail(notif, player.email);
        if (result.success) stats.email++;
        else { failCount++; deliveryError = result.error; }
      } else if (item.channel === "sms") {
        const result = await deliverSms(notif, player.phone);
        if (result.success) stats.sms++;
        else { failCount++; deliveryError = result.error; }
      }

      await supabase.from("pp_notification_queue").update({
        status: deliveryError ? "failed" : "sent",
        sent_at: new Date().toISOString(),
        error_message: deliveryError || null,
      }).eq("id", item.id);
    }

    const totalSent = stats.push + stats.email + stats.sms;
    console.error(`[CronDeliver] Processed ${queue.length} queue items: ${totalSent} sent (push:${stats.push} email:${stats.email} sms:${stats.sms}), ${failCount} failed`);

    return res.status(200).json({ processed: queue.length, sent: stats, failed: failCount, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[CronDeliver] Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
