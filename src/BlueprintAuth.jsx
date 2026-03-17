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
  userPill: {
    display: "inline-flex", alignItems: "center", gap: "6px",
    padding: "4px 10px", background: "#161b22", border: "1px solid #30363d",
    borderRadius: "20px", fontSize: "11px", color: "#8b949e",
  },
  avatar: { width: "20px", height: "20px", borderRadius: "50%", border: "1px solid #30363d" },
  signOutBtn: {
    fontSize: "11px", color: "#8b949e", background: "none",
    border: "1px solid #30363d", borderRadius: "6px", padding: "2px 6px",
    cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif", marginLeft: "4px",
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
        if (ALLOWED_EMAILS.includes(parsed.email) && !isTokenExpired(savedToken)) {
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

  const handleCredentialResponse = useCallback((response) => {
    try {
      const payload = decodeJwtPayload(response.credential);
      if (!payload) throw new Error("Invalid token");
      const { email, name, picture } = payload;
      if (ALLOWED_EMAILS.includes(email)) {
        const userData = { email, name, picture };
        localStorage.setItem("bp_user", JSON.stringify(userData));
        localStorage.setItem("bp_token", response.credential);
        setUser(userData);
        setToken(response.credential);
        setError("");
        setShowLogin(false);
      } else {
        setError("Access denied. Contact Christo to get added.");
      }
    } catch {
      setError("Sign-in failed. Please try again.");
    }
  }, []);

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
    requestLogin: () => setShowLogin(true),
    userPill,
  };

  return (
    <BlueprintAuthContext.Provider value={contextValue}>
      {children}
      {loginModal}
    </BlueprintAuthContext.Provider>
  );
}
