// Microsoft sign-in and the Outlook send token, through MSAL's popup flow. MSAL
// loads only for people who use it. Sign-in asks for identity alone, and sending
// asks for Mail.Send separately, so a company that won't approve mail access can
// still sign in. Ops' /api/gmail reads the "ms:" token prefix to send through Outlook.

import { Capacitor } from "@capacitor/core";

const CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID || "";
const SIGN_IN_SCOPES = ["openid", "profile", "email"];
const MAIL_SCOPES = ["User.Read", "Mail.Send"];
const OUTLOOK_TOKEN_PREFIX = "ms:";

// MSAL's popup can't run inside the Capacitor WebView, same as Google's.
export const microsoftEnabled = () => !!CLIENT_ID && !Capacitor.isNativePlatform();
export const isMicrosoftUser = (user) => user?.provider === "microsoft";

/** Is the signed-in LO on Microsoft? Reads the saved sign-in so non-React code can ask. */
export function usesOutlook() {
  try { return isMicrosoftUser(JSON.parse(localStorage.getItem("bp_user") || "{}")); } catch { return false; }
}
export const mailName = () => (usesOutlook() ? "Outlook" : "Gmail");

let appPromise = null;
function getApp() {
  if (!appPromise) {
    appPromise = import("@azure/msal-browser").then(async ({ PublicClientApplication }) => {
      const app = new PublicClientApplication({
        auth: {
          clientId: CLIENT_ID,
          authority: "https://login.microsoftonline.com/common",
          redirectUri: `${window.location.origin}/msal-redirect.html`,
        },
        cache: { cacheLocation: "localStorage" },
      });
      await app.initialize();
      return app;
    }).catch((e) => { appPromise = null; throw e; });
  }
  return appPromise;
}

/** Load MSAL ahead of the click, or the wait can cost the click's right to open a popup. */
export function preloadMicrosoft() {
  if (microsoftEnabled()) getApp().catch(() => {});
}

export const isPopupClosed = (e) => /user_cancelled|popup_window_error|empty_window_error/.test(e?.errorCode || "");

async function sha256Hex(text) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Opens Microsoft's account picker. Resolves with { idToken, nonce }: the ID token
 * for /api/collab?resource=session, and the raw nonce Supabase needs for the same
 * token (Supabase compares its SHA-256 with the token's nonce claim).
 */
export async function signInWithMicrosoft() {
  const app = await getApp();
  const nonce = crypto.randomUUID();
  const result = await app.loginPopup({ scopes: SIGN_IN_SCOPES, prompt: "select_account", nonce: await sha256Hex(nonce) });
  app.setActiveAccount(result.account);
  return { idToken: result.idToken, nonce };
}

/** A fresh ID token without UI, when the LO's 12h session lapsed. Rejects if Microsoft wants the user. */
export async function silentMicrosoftIdToken() {
  const app = await getApp();
  const account = app.getActiveAccount() || app.getAllAccounts()[0];
  if (!account) throw new Error("Not signed in to Microsoft");
  const result = await app.acquireTokenSilent({ scopes: SIGN_IN_SCOPES, account, forceRefresh: true });
  return result.idToken;
}

/** A Graph send token with the "ms:" prefix. Silent reuses what was granted; otherwise opens the popup. */
export async function outlookSendToken({ silent = false } = {}) {
  const app = await getApp();
  const account = app.getActiveAccount() || app.getAllAccounts()[0];
  if (silent && !account) throw new Error("Not connected to Outlook");
  const result = silent
    ? await app.acquireTokenSilent({ scopes: MAIL_SCOPES, account })
    : await app.acquireTokenPopup({ scopes: MAIL_SCOPES, ...(account ? { account, loginHint: account.username } : {}) });
  app.setActiveAccount(result.account);
  return OUTLOOK_TOKEN_PREFIX + result.accessToken;
}

/** Forget the Microsoft tokens on this browser, without signing them out of Microsoft everywhere. */
export async function clearMicrosoftSession() {
  try { (await getApp()).clearCache(); } catch { /* best effort */ }
}
