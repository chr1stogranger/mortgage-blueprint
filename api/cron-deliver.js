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
import { deliverPush, notificationUrl } from './_push.js';
import { safeEq } from './_safeEq.js';
import { safePhotoUrl } from './_photoUrl.js';
import { unsubUrl, unsubHeaders, loadSender, FALLBACK_SENDER } from './_ppUnsub.js';

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

const money = (v) => (v == null || !isFinite(v) ? "—" : `$${Math.round(v).toLocaleString("en-US")}`);

// The property's board for a resolved-call email: every call on that home,
// ranked by distance to the sold price, with display names (same source as
// /api/pp-guess's scoreboard) plus a photo from the live guess rows. Cached
// per zpid for the run — every player on one home shares it.
const boardCache = new Map();
async function loadBoard(supabase, zpid) {
  if (!zpid) return null;
  if (boardCache.has(zpid)) return boardCache.get(zpid);
  let board = null;
  try {
    const { data } = await supabase
      .from("pp_predictions")
      .select("player_id, predicted_price, resolved, sold_price, pp_players(display_name)")
      .eq("zpid", zpid)
      .limit(200);
    const sold = (data || []).find(r => r.resolved && r.sold_price)?.sold_price || null;
    const rows = (data || [])
      .filter(r => r.predicted_price)
      .map(r => ({ playerId: r.player_id, name: (r.pp_players?.display_name || "").trim(), guess: r.predicted_price }));
    if (sold) rows.sort((a, b) => Math.abs(a.guess - sold) - Math.abs(b.guess - sold));
    let photo = null;
    const { data: g } = await supabase
      .from("pp_guesses")
      .select("photo")
      .eq("zpid", zpid).not("photo", "is", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (g?.photo) photo = safePhotoUrl(g.photo) || null;
    board = { rows, sold, photo };
  } catch (e) {
    console.error(`[CronDeliver] board lookup failed for ${zpid}: ${e.message}`);
  }
  boardCache.set(zpid, board);
  return board;
}

const BOARD_MAX = 10;
function boardHtml(board, playerId, soldPrice) {
  let rows = board?.rows || [];
  if (rows.length === 0) return "";
  // Rank by the sold price this email is built from: loadBoard sorts only when
  // the prediction row already carried one, and the payload may know it first.
  if (soldPrice) rows = [...rows].sort((a, b) => Math.abs(a.guess - soldPrice) - Math.abs(b.guess - soldPrice));
  const ranked = rows.map((r, i) => ({ ...r, rank: i + 1, you: r.playerId === playerId }));
  let shown = ranked.slice(0, BOARD_MAX);
  const mine = ranked.find(r => r.you);
  if (mine && mine.rank > BOARD_MAX) shown = [...shown, mine];
  const cell = "padding:10px 12px;font-size:14px;border-bottom:1px solid #EEF0F4;";
  const body = shown.map((r) => {
    const winner = soldPrice && r.rank === 1;
    const bg = r.you ? "#EFF3FE" : winner ? "#ECFDF3" : "#ffffff";
    const off = soldPrice ? `${(Math.abs(r.guess - soldPrice) / soldPrice * 100).toFixed(1)}%` : "";
    const gap = mine && r === mine && mine.rank > BOARD_MAX + 1
      ? `<tr><td colspan="4" style="padding:4px 12px;font-size:12px;color:#999;text-align:center;border-bottom:1px solid #EEF0F4">&middot;&middot;&middot;</td></tr>` : "";
    return `${gap}<tr style="background:${bg}">
      <td style="${cell}width:28px;font-weight:800;color:${winner ? "#16A34A" : "#999"};text-align:center">${r.rank}</td>
      <td style="${cell}font-weight:${r.you ? 800 : 600};color:#171717">${r.you ? "You" : escapeHtml(r.name || "Player")}${winner ? ` <span style="font-size:10px;font-weight:700;letter-spacing:1px;color:#16A34A;text-transform:uppercase">&nbsp;Closest</span>` : ""}</td>
      <td style="${cell}text-align:right;color:#737373;font-size:12px;font-weight:600">${off}</td>
      <td style="${cell}text-align:right;font-weight:800;color:#171717;white-space:nowrap">${money(r.guess)}</td>
    </tr>`;
  }).join("");
  return `<div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#737373;margin:28px 0 10px">Final Board &middot; ${rows.length} ${rows.length === 1 ? "call" : "calls"}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden">${body}</table>`;
}

export function buildEmailHtml(notification, board, sender = FALLBACK_SENDER) {
  const payload = notification.payload || {};
  // Deep link straight to the property's board when the notification is about one.
  const ctaUrl = `https://blueprint.realstack.app${notificationUrl(notification)}`;
  const resolved = notification.type === "prediction_resolved";
  const sold = payload.sold_price || board?.sold || null;
  const guess = payload.predicted_price || null;
  const photo = resolved ? (safePhotoUrl(payload.photo) || board?.photo || null) : null;
  const pctOff = payload.pct_off != null ? `${Number(payload.pct_off).toFixed(1)}%` : "";
  const stat = (label, value, color = "#171717") => `<td width="33%" style="padding:14px 4px;text-align:center;vertical-align:top">
      <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#737373;margin-bottom:6px">${label}</div>
      <div style="font-size:16px;font-weight:800;color:${color};white-space:nowrap">${value}</div></td>`;
  const stats = resolved && (guess || sold) ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;background:#F7F8FA;border:1px solid #E5E7EB;border-radius:12px;margin:0 0 4px"><tr>
      ${stat("Your guess", money(guess), "#3B6BF5")}${stat("Sold for", money(sold))}${stat("Off by", pctOff || "—")}
    </tr></table>` : "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;margin:0;padding:20px}
  .c{max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)}
  .in{padding:32px 32px 36px}
  .logo{font-size:13px;font-weight:700;letter-spacing:2px;color:#3B6BF5;text-transform:uppercase;margin-bottom:20px}
  h1{font-size:22px;font-weight:700;color:#171717;margin:0 0 10px}
  .body{font-size:15px;line-height:1.6;color:#525252;margin:0 0 20px}
  .stat{display:inline-block;background:#EFF3FE;color:#3B6BF5;font-weight:700;padding:4px 12px;border-radius:8px;font-size:14px;margin:0 0 20px}
  .cta{display:inline-block;background:linear-gradient(135deg,#3B6BF5, #2B4FCE);background-color:#3B6BF5;color:#fff !important;padding:14px 28px;border-radius:9999px;text-decoration:none;font-weight:600;font-size:15px}
  .foot{border-top:1px solid #e5e5e5;margin-top:32px;padding-top:16px;font-size:11px;color:#999}
  @media (max-width:480px){.in{padding:24px 20px 28px}}
</style></head>
<body><div class="c">
  ${photo ? `<a href="${ctaUrl}"><img src="${escapeHtml(photo)}" alt="${escapeHtml(payload.address || "The home")}" width="560" style="display:block;width:100%;max-width:560px;height:auto;max-height:320px;object-fit:cover;border:0"></a>` : ""}
  <div class="in">
  <div class="logo">PricePoint</div>
  <h1>${escapeHtml(notification.title)}</h1>
  <p class="body">${escapeHtml(notification.body)}</p>
  ${stats || (pctOff ? `<div class="stat">${pctOff} off</div><br><br>` : "")}
  ${resolved ? boardHtml(board, notification.player_id, sold) : ""}
  <div style="margin-top:28px"><a href="${ctaUrl}" class="cta">${resolved ? "See the board" : "Open PricePoint"}</a></div>
  <div class="foot">
    <p>You're receiving this because you enabled email notifications on PricePoint.<br>
    <a href="${escapeHtml(unsubUrl(notification.player_id))}">Unsubscribe</a> &middot; <a href="${ctaUrl}">Manage preferences</a></p>
    <p>PricePoint &mdash; powered by RealStack &middot; ${escapeHtml(sender.company)} NMLS #${escapeHtml(sender.companyNmls)} &middot; Chris Granger NMLS #${escapeHtml(sender.nmls)}${sender.address ? `<br>${escapeHtml(sender.address)}` : ""}</p>
  </div>
  </div>
</div></body></html>`;
}

// ── Email via Resend API ──
async function deliverEmail(notification, email, board = null, sender = FALLBACK_SENDER) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: "RESEND_API_KEY not configured" };
  if (!email) return { success: false, error: "No email address" };
  // One-click unsubscribe needs a signing key; without one the footer link
  // would be dead, so don't send rather than send non-compliant mail.
  if (!process.env.UNSUBSCRIBE_SECRET && !process.env.CRON_SECRET) return { success: false, error: "No unsubscribe signing key" };

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "PricePoint <blueprint@realstack.app>",
        to: email,
        subject: notification.title,
        html: buildEmailHtml(notification, board, sender),
        headers: unsubHeaders(notification.player_id),
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
  // Exact match — startsWith would let blueprint.realstack.app.evil.com pass (re-audit M-3).
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Auth: cron secret
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  const secret = process.env.CRON_SECRET;
  if (!secret || (!safeEq(token, secret) && !safeEq(req.query.secret, secret))) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  boardCache.clear(); // warm instances reuse module state — never serve last run's board

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
    let sender = null; // footer identity, looked up once on the first email

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
        // Prune subscriptions the browser has dropped (web-push 404/410).
        for (const dead of (result.deadTokens || [])) {
          await supabase.from("pp_device_tokens").delete().eq("player_id", player.id).eq("token", dead.token);
        }
      } else if (item.channel === "email") {
        if (!player.email_enabled) {
          // Unsubscribed (email link or in-app toggle) after this was queued.
          deliveryError = "Email notifications turned off";
        } else {
          const board = notif.type === "prediction_resolved" ? await loadBoard(supabase, notif.payload?.zpid) : null;
          sender ??= await loadSender(supabase);
          const result = await deliverEmail(notif, player.email, board, sender);
          if (result.success) stats.email++;
          else { failCount++; deliveryError = result.error; }
        }
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
