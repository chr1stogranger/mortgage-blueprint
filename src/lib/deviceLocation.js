// Device location for PricePoint "Near me" — web and the native app.
//
// Web: the browser's navigator.geolocation. Native (iOS/Android): the
// @capacitor/geolocation plugin, which asks through the OS permission sheet
// (Info.plist NSLocationWhenInUseUsageDescription / Android manifest). Plain
// navigator.geolocation inside WKWebView never called back without that
// declaration, so the app used to skip GPS entirely (2026-10-18).
//
// Neither path can hang a screen: the fix itself is capped at `timeoutMs`.
// The native permission sheet is NOT capped — it's modal and the user always
// answers it, and capping it would drop the fix right after they tap Allow.
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

const isNative = () => Capacitor.isNativePlatform();
const withTimeout = (p, ms) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error('geolocation timeout')), ms)),
]);
const toPoint = (pos) => ({ lat: pos.coords.latitude, lng: pos.coords.longitude });

// Native: ask once if never asked; true when any location access is granted.
async function nativeAllowed() {
  let perm = await Geolocation.checkPermissions();
  if (perm.location !== 'granted' && perm.coarseLocation !== 'granted' && String(perm.location).startsWith('prompt')) {
    perm = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
  }
  return perm.location === 'granted' || perm.coarseLocation === 'granted';
}

// One fix → { lat, lng }, or null (denied, location off, timed out, unsupported).
export async function getDevicePosition({ timeoutMs = 8000, maximumAge = 30 * 60 * 1000 } = {}) {
  try {
    if (isNative()) {
      if (!(await nativeAllowed())) return null;
      return toPoint(await withTimeout(Geolocation.getCurrentPosition({ timeout: 6000, maximumAge }), timeoutMs));
    }
    if (!navigator.geolocation) return null;
    const perm = navigator.permissions?.query ? await navigator.permissions.query({ name: 'geolocation' }).catch(() => null) : null;
    if (perm?.state === 'denied') return null;
    return toPoint(await withTimeout(new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000, maximumAge })), timeoutMs));
  } catch {
    return null;
  }
}

// Follow the device while you walk. Returns a stop function.
export function watchDevicePosition(onPoint) {
  const opts = { maximumAge: 60 * 1000, timeout: 20000 };
  if (isNative()) {
    let stopped = false;
    let id = null;
    Geolocation.watchPosition(opts, (pos) => { if (pos && !stopped) onPoint(toPoint(pos)); })
      .then((cid) => { id = cid; if (stopped) Geolocation.clearWatch({ id }).catch(() => {}); })
      .catch(() => {});
    return () => { stopped = true; if (id != null) Geolocation.clearWatch({ id }).catch(() => {}); };
  }
  if (!navigator.geolocation) return () => {};
  const id = navigator.geolocation.watchPosition((pos) => onPoint(toPoint(pos)), () => {}, opts);
  return () => navigator.geolocation.clearWatch(id);
}
