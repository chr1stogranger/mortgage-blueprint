// src/lib/gmailAuth.js
//
// Gmail OAuth for one-click "send from my Gmail" — mirrors the working
// Google Identity Services (GIS) token flow in RealStack Ops
// (loan-pipeline/src/MortgagePipeline.jsx). Blueprint requests a short-lived
// access token in the browser and hands it to the Ops endpoint
// (ops.realstack.app/api/gmail?action=send), which validates the account
// against its allowlist and does the actual Gmail API send.
//
// Scopes: gmail.send (to send) AND gmail.readonly — the Ops endpoint
// validates every token by calling Gmail /profile, which requires readonly.
//
// Storage: localStorage only (key: bp_gmail_token). NEVER put this token in
// scenario state — getState() syncs to Supabase and must not carry OAuth
// tokens.

import { Capacitor } from "@capacitor/core";

const TOKEN_KEY = "bp_gmail_token";
const GIS_SRC = "https://accounts.google.com/gsi/client";
const SCOPES =
  "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send";

export const GMAIL_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

// Gmail send is available on web only: GIS popups are unreliable inside the
// Capacitor WebView, and the native app ships localMode. Callers fall back
// to the mailto: path when this is false.
export function gmailSendAvailable() {
  return !!GMAIL_CLIENT_ID && !Capacitor.isNativePlatform();
}

export function getStoredGmailToken() {
  try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
}

export function storeGmailToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* private mode */ }
}

export function clearGmailToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
}

let gisLoadPromise = null;
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = GIS_SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => { gisLoadPromise = null; reject(new Error("Could not load Google sign-in")); };
    document.head.appendChild(el);
  });
  return gisLoadPromise;
}

/**
 * Request a fresh Gmail access token via the GIS popup.
 * @param {{ silent?: boolean }} opts — silent:true tries prompt:'' (no UI if
 *   the user already granted; used for expired-token retries).
 * @returns {Promise<string>} access token
 */
export async function requestGmailToken({ silent = false } = {}) {
  if (!gmailSendAvailable()) throw new Error("Gmail send not available here");
  await loadGis();
  return new Promise((resolve, reject) => {
    let settled = false;
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GMAIL_CLIENT_ID,
      scope: SCOPES,
      callback: (resp) => {
        if (settled) return;
        settled = true;
        if (resp?.access_token) {
          storeGmailToken(resp.access_token);
          resolve(resp.access_token);
        } else {
          reject(new Error(resp?.error_description || resp?.error || "Gmail authorization failed"));
        }
      },
      error_callback: (err) => {
        if (settled) return;
        settled = true;
        reject(new Error(err?.message || "Gmail authorization was closed"));
      },
    });
    client.requestAccessToken(silent ? { prompt: "" } : {});
  });
}

/**
 * Best-effort token: stored one first (cheap — the send call will 401 if
 * it's stale and the caller retries via requestGmailToken), else popup.
 */
export async function ensureGmailToken() {
  const stored = getStoredGmailToken();
  if (stored) return stored;
  return requestGmailToken();
}

/**
 * Auto-connect on login: silently mint a send token for the account the LO
 * just signed in with (login_hint skips the account chooser). Google only
 * allows this with NO consent UI if the user granted the gmail scopes once
 * before in this browser — the first-ever send still shows one popup. All
 * failures are swallowed: this is opportunistic warming, the send button
 * handles the interactive path itself.
 */
let warmAttempted = false;
export function warmGmailToken(email) {
  if (warmAttempted || !gmailSendAvailable() || getStoredGmailToken()) return;
  warmAttempted = true;
  loadGis()
    .then(() => new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GMAIL_CLIENT_ID,
        scope: SCOPES,
        callback: (resp) => resp?.access_token ? resolve(resp.access_token) : reject(new Error(resp?.error || "no token")),
        error_callback: (err) => reject(new Error(err?.message || "silent auth unavailable")),
      });
      client.requestAccessToken({ prompt: "", login_hint: email || "" });
    }))
    .then((token) => storeGmailToken(token))
    .catch(() => { /* not granted yet — the send button will ask when needed */ });
}
