/**
 * Authentication gate for Blueprint.
 * Reuses Pipeline's Google Sign-In pattern — same JWT, same server verification.
 * Stores token as 'bp_token' (separate from Pipeline's 'lp_token').
 *
 * When auth is not configured (no GOOGLE_CLIENT_ID), Blueprint works in
 * "local mode" — localStorage only, no Supabase sync. This preserves
 * backward compatibility for the public calculator.
 */
import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { getSession, onAuthStateChange } from "./lib/supabaseClient";

const API_BASE = import.meta.env.VITE_API_BASE || "https://ops.realstack.app";

// ─── Context ────────────────────────────────────────────────────────────────
const BlueprintAuthContext = createContext(null);
export const useBlueprintAuth = () => useContext(BlueprintAuthContext);

// ─── Authorized emails (same as Pipeline) ───────────────────────────────────
const ALLOWED_EMAILS = [
  "chr1stogranger@gmail.com",
  "cgranger@xperthomelending.com",
  "chrisgrangermortgage@gmail.com",
  "pnoerr@xperthomelending.com",
  "peternoerrmortgage@gmail.com",
  "gina@tsdmtg.com",
  "myprocess@tsdmtg.com",
  "gmcnavarro0637@gmail.com",
];

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

function decodeJwtPayload(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch { return null; }
}

function isTokenExpired(token) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return Date.now() >= (payload.exp - 60) * 1000;
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 99999,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
  },
  card: {
    background: "#1a1f2e", border: "1px solid #2d3548", borderRadius: "16px",
    padding: "40px 36px", maxWidth: "380px", width: "90%", textAlign: "center",
    boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
  },
  logo: { fontSize: "26px", fontWeight: 700, color: "#e6edf3", marginBottom: "4px", letterSpacing: "-0.5px" },
  subtitle: { fontSize: "13px", color: "#8b949e", marginBottom: "28px" },
  googleBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
    width: "100%", padding: "11px 20px", background: "#fff", color: "#3c4043",
    border: "1px solid #dadce0", borderRadius: "8px", fontSize: "14px", fontWeight: 500,
    fontFamily: "'Inter', system-ui, sans-serif", cursor: "pointer",
    transition: "box-shadow 0.2s, background 0.2s",
  },
  skipBtn: {
    display: "block", width: "100%", marginTop: "12px", padding: "10px",
    background: "none", border: "1px solid #2d3548", borderRadius: "8px",
    color: "#8b949e", fontSize: "13px", cursor: "pointer",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  error: {
    marginTop: "12px", padding: "10px 14px",
    background: "rgba(248,81,73,0.1)", border: "1px solid rgba(248,81,73,0.3)",
    borderRadius: "8px", color: "#f85149", fontSize: "12px",
  },
  // Indigo-tinted pill — reads on light AND dark themes (was hardcoded
  // GitHub-dark #161b22, which looked like a black blob in light mode).
  userPill: {
    display: "inline-flex", alignItems: "center", gap: "6px",
    padding: "3px 8px", background: "rgba(99,102,241,0.10)",
    border: "1px solid rgba(99,102,241,0.35)",
    borderRadius: "9999px", fontSize: "11px", fontWeight: 600, color: "#6366F1",
    fontFamily: "'Inter', system-ui, sans-serif", whiteSpace: "nowrap",
  },
  avatar: { width: "18px", height: "18px", borderRadius: "50%", border: "1px solid rgba(99,102,241,0.35)" },
  signOutBtn: {
    fontSize: "10px", color: "#6366F1", background: "none",
    border: "1px solid rgba(99,102,241,0.35)", borderRadius: "9999px", padding: "2px 8px",
    cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif", marginLeft: "2px",
  },
};

export default function BlueprintAuth({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [error, setError] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [localMode, setLocalMode] = useState(false); // No auth, localStorage only

  // Check for existing session
  useEffect(() => {
    const savedUser = localStorage.getItem("bp_user");
    const savedToken = localStorage.getItem("bp_token");
    if (savedUser && savedToken) {
      try {
        const parsed = JSON.parse(savedUser);
        // Membership is server-enforced on every API call (team_members table)
        if (!isTokenExpired(savedToken)) {
          setUser(parsed);
          setToken(savedToken);
          return;
        }
      } catch { /* fall through */ }
      localStorage.removeItem("bp_user");
      localStorage.removeItem("bp_token");
    }
    // If no Google Client ID configured, auto-enter local mode
    if (!GOOGLE_CLIENT_ID) {
      setLocalMode(true);
    }
  }, []);

  // Load Google Identity Services script
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || localMode || user) return;
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) { setScriptLoaded(true); return; }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
  }, [localMode, user]);

  const handleCredentialResponse = useCallback(async (response) => {
    try {
      const payload = decodeJwtPayload(response.credential);
      if (!payload) throw new Error("Invalid token");
      const { email, name, picture } = payload;
      // The SERVER decides membership (shared team_members table) — exchange
      // for a 12h session token with role. Legacy hardcoded list only as a
      // network-failure fallback.
      let userData = { email, name, picture };
      let sessionToken = null;
      try {
        const res = await fetch(`${API_BASE}/api/collab?resource=session`, {
          method: "POST",
          headers: { "Authorization": "Bearer " + response.credential },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            sessionToken = data.token;
            if (data.user) userData = { ...userData, ...data.user };
          }
        } else if (res.status === 403 || res.status === 401) {
          setError("Access denied. This account is not on the team — contact Christo to get added.");
          return;
        }
      } catch { /* network trouble — legacy fallback below */ }
      if (!sessionToken) {
        if (!ALLOWED_EMAILS.includes(email)) {
          setError("Access denied. Contact Christo to get added.");
          return;
        }
        sessionToken = response.credential;
      }
      localStorage.setItem("bp_user", JSON.stringify(userData));
      localStorage.setItem("bp_token", sessionToken);
      setUser(userData);
      setToken(sessionToken);
      setError("");
      setShowLogin(false);
    } catch {
      setError("Sign-in failed. Please try again.");
    }
  }, []);

  // ── Auto-elevate to LO mode ────────────────────────────────────────────────
  // If the person is already signed into the calculator's account system with
  // an LO-allowlist email (e.g. cgranger@xperthomelending.com), silently
  // exchange that Supabase session for a 12h LO session — no separate
  // "Sign in as Loan Officer" click in Settings. Re-runs on every auth-state
  // change and whenever the LO session lapses (user becomes null).
  useEffect(() => {
    if (user) return;
    let cancelled = false;
    const tryElevate = async (session) => {
      try {
        const s = session || await getSession();
        if (!s?.user?.email) return;
        // No client-side allowlist — the server checks the team_members table
        // (a non-team borrower session just gets a fast 403 and stays put).
        const res = await fetch(`${API_BASE}/api/collab?resource=lo-session`, {
          method: "POST",
          headers: { "Authorization": "Bearer " + s.access_token },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!data?.token || !data?.user) return;
        localStorage.setItem("bp_user", JSON.stringify(data.user));
        localStorage.setItem("bp_token", data.token);
        setUser(data.user);
        setToken(data.token);
        setLocalMode(false);
        setShowLogin(false);
        setError("");
      } catch { /* silent — the Settings button remains the fallback */ }
    };
    tryElevate();
    const sub = onAuthStateChange((newSession) => { if (newSession && !cancelled) tryElevate(newSession); });
    return () => { cancelled = true; sub?.unsubscribe?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!scriptLoaded || !window.google || user) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
    });
  }, [scriptLoaded, user, handleCredentialResponse]);

  const handleGoogleClick = () => {
    if (!window.google) return;
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        const btn = document.createElement("div");
        btn.id = "bp_g_signin";
        btn.style.display = "none";
        document.body.appendChild(btn);
        window.google.accounts.id.renderButton(btn, { type: "standard", size: "large" });
        setTimeout(() => btn.querySelector('[role="button"]')?.click(), 100);
      }
    });
  };

  const handleSignOut = () => {
    localStorage.removeItem("bp_user");
    localStorage.removeItem("bp_token");
    setUser(null);
    setToken(null);
    setError("");
  };

  const handleSkip = () => {
    setLocalMode(true);
    setShowLogin(false);
  };

  // ─── Login modal (overlays Blueprint, doesn't block it) ──────────────────
  const loginModal = showLogin && !user && !localMode ? (
    <div style={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) setShowLogin(false); }}>
      <div style={styles.card}>
        <div style={styles.logo}><span>Real</span><span style={{ color: "#6366F1" }}>Stack</span> Blueprint</div>
        <div style={styles.subtitle}>Sign in to sync scenarios across devices</div>
        <button style={styles.googleBtn} onClick={handleGoogleClick}>
          <GoogleIcon /> Sign in with Google
        </button>
        <button style={styles.skipBtn} onClick={handleSkip}>
          Continue without signing in
        </button>
        {error && <div style={styles.error}>{error}</div>}
      </div>
    </div>
  ) : null;

  // ─── User pill (shown when signed in) ────────────────────────────────────
  const userPill = user ? (
    <span style={styles.userPill}>
      {user.picture && <img src={user.picture} alt="" style={styles.avatar} referrerPolicy="no-referrer" />}
      <span>{user.name?.split(" ")[0]}</span>
      <button style={styles.signOutBtn} onClick={handleSignOut}>Sign out</button>
    </span>
  ) : null;

  // ─── Provide context to children ──────────────────────────────────────────
  const contextValue = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    localMode,
    signOut: handleSignOut,
    // Exiting local mode here matters: the login modal is gated on
    // !localMode, and a stranded LO (expired token -> local mode) had no way
    // back in (bug found 2026-07-05 — "did borrower switching go away?").
    requestLogin: () => { setLocalMode(false); setShowLogin(true); },
    userPill,
  };

  return (
    <BlueprintAuthContext.Provider value={contextValue}>
      {children}
      {loginModal}
    </BlueprintAuthContext.Provider>
  );
}
