// Resolves API URLs correctly on both the web app and the native (Capacitor) app.
//
// On the web, the app is served from https://blueprint.realstack.app, so the
// serverless functions live at the same origin and a relative path like
// "/api/rates" works fine.
//
// In the native iOS/Android app, Capacitor serves the bundled files from
// https://localhost. A relative "/api/rates" would hit https://localhost/api/rates,
// which does not exist — there is no server inside the app bundle. So when running
// natively we must call the deployed API by its absolute URL.

import { Capacitor } from "@capacitor/core";

// Production API origin (where the Vercel serverless functions are deployed).
export const API_BASE = Capacitor.isNativePlatform()
  ? "https://blueprint.realstack.app"
  : "";

// Build a full URL for an API path, e.g. apiUrl("/api/rates").
export const apiUrl = (path) => `${API_BASE}${path}`;

// Canonical web origin for SHAREABLE links (e.g. borrower share links).
//
// On the web, window.location.origin already is https://blueprint.realstack.app.
// In the native iOS/Android app, window.location.origin is https://localhost,
// so a share link built from it would be dead for anyone else. Use this instead
// of window.location.origin anywhere you build a link you hand to another person.
export const WEB_ORIGIN = Capacitor.isNativePlatform()
  ? "https://blueprint.realstack.app"
  : window.location.origin;
