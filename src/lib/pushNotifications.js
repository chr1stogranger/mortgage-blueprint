// Web push for PricePoint — subscribes the browser and registers the
// subscription as a pp_device_tokens row (platform 'web'), delivered by
// api/cron-deliver.js via the web-push library.
//
// The VAPID public key is public by design (it only identifies our server to
// the push service); the private half lives in Vercel env (VAPID_PRIVATE_KEY).
// Rotating the pair requires updating BOTH this constant and the env vars —
// existing subscriptions die on rotation.
export const VAPID_PUBLIC_KEY =
  'BGee3bXW3umVynzCzTIu2ps1ivUUSU9PQPLcci4arfHs0y8pjnNf86GbXyDk9NW4J2JcI1as5f-8hitWIi81VXw';

import { registerDeviceToken, unregisterDeviceToken } from './pricePointDB';

// iOS Safari only exposes PushManager inside an installed (home-screen) PWA,
// so this doubles as the "can this user even turn push on?" gate for the UI.
export function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Enable push for this browser: permission → subscribe → register token.
// Returns { ok } or { ok: false, reason } — reasons are user-presentable
// states ('denied', 'unsupported', 'no_sw', 'error'), not error prose.
export async function enablePush(playerId) {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  if (!playerId) return { ok: false, reason: 'error' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg || !reg.pushManager) return { ok: false, reason: 'no_sw' };

    // Reuse an existing subscription when there is one (re-toggling on the
    // same device), otherwise create it.
    const sub = (await reg.pushManager.getSubscription())
      || (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));

    const registered = await registerDeviceToken(playerId, JSON.stringify(sub), 'web');
    if (!registered) return { ok: false, reason: 'error' };
    return { ok: true };
  } catch (err) {
    console.error('[Push] enable failed:', err.message);
    return { ok: false, reason: 'error' };
  }
}

// Disable push for this browser: unsubscribe locally and drop the token row.
// The push_enabled preference flag is the caller's to flip — a player can have
// other devices still subscribed.
export async function disablePush(playerId) {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await unregisterDeviceToken(playerId, JSON.stringify(sub));
      await sub.unsubscribe();
    }
  } catch (err) {
    console.error('[Push] disable failed:', err.message);
  }
}
