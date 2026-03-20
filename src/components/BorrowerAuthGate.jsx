/**
 * BorrowerAuthGate — Handles the borrower authentication flow for share links.
 *
 * Flow:
 *   1. Show branded splash screen
 *   2. Check for existing session in localStorage (bp_borrower_session)
 *   3. If valid → fetch profile + shared data → auto-proceed
 *   4. If no session → show auth screen (Google Sign-In + Magic Link)
 *   5. After auth → fetch shared data → call onAuthenticated with data
 *
 * Also handles ?magic=TOKEN&email=EMAIL for magic link verification.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchSharedData,
  fetchBorrowerProfile,
  authenticateBorrowerGoogle,
  requestBorrowerMagicLink,
  verifyBorrowerMagicLink,
} from '../api';

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

const T = {
  bg: '#050505', card: '#0A0A0A', surface: '#0F0F0F',
  cardBorder: 'rgba(255,255,255,0.06)', cardBorderHover: 'rgba(255,255,255,0.12)',
  accent: '#6366F1', accentLight: '#818CF8', accentBright: '#A5B4FC',
  blue: '#3B82F6', teal: '#06B6D4', green: '#10B981', red: '#EF4444',
  text: '#EDEDED', textSecondary: '#A1A1A1', textTertiary: '#666666',
  separator: 'rgba(255,255,255,0.06)',
  inputBg: '#1A1A1A', inputBorder: 'rgba(255,255,255,0.12)',
};

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SESSION_KEY = 'bp_borrower_session';
const BORROWER_KEY = 'bp_borrower_data';

// ─── Google Icon ──────────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

// ─── Home Icon ────────────────────────────────────────────────────────────────
const HomeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

// ─── Mail Icon ────────────────────────────────────────────────────────────────
const MailIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

// ─── Shield Icon ──────────────────────────────────────────────────────────────
const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

export default function BorrowerAuthGate({ shareToken, onAuthenticated, onError }) {
  // Phase: 'splash' → 'checking' → 'auth' → 'magic-sent' → 'magic-verify' → 'loading' → 'done'
  const [phase, setPhase] = useState('splash');
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [borrowerName, setBorrowerName] = useState('');
  const [sending, setSending] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const scriptLoadedRef = useRef(false);

  // ── Step 1: Splash → Check existing session ────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      checkExistingSession();
    }, 1200); // Show splash for 1.2s minimum
    return () => clearTimeout(timer);
  }, []);

  // ── Handle ?magic=TOKEN&email=EMAIL in URL (magic link click) ──────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const magicToken = params.get('magic');
    const magicEmail = params.get('email');
    if (magicToken && magicEmail) {
      setPhase('magic-verify');
      verifyMagicLink(magicToken, magicEmail);
    }
  }, []);

  // ── Load Google Identity Services ──────────────────────────────────────
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      if (window.google?.accounts) {
        initializeGoogle();
      } else {
        existing.addEventListener('load', initializeGoogle);
      }
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    document.head.appendChild(script);
  }, []);

  function initializeGoogle() {
    if (scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;
    if (!window.google?.accounts) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });
    setGoogleReady(true);
  }

  // ── Check existing borrower session ────────────────────────────────────
  async function checkExistingSession() {
    const sessionToken = localStorage.getItem(SESSION_KEY);
    if (sessionToken) {
      try {
        setPhase('checking');
        const profile = await fetchBorrowerProfile(sessionToken);
        if (profile?.account) {
          setBorrowerName(profile.account.name || '');
          // Session valid — load shared data
          await loadSharedData(sessionToken, profile);
          return;
        }
      } catch {
        // Session expired — clear and show auth
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(BORROWER_KEY);
      }
    }
    setPhase('auth');
  }

  // ── Google Sign-In handler ─────────────────────────────────────────────
  async function handleGoogleCredential(response) {
    try {
      setPhase('loading');
      setError('');

      const result = await authenticateBorrowerGoogle(response.credential, shareToken);

      if (result.success && result.session_token) {
        localStorage.setItem(SESSION_KEY, result.session_token);
        localStorage.setItem(BORROWER_KEY, JSON.stringify(result.account));
        setBorrowerName(result.account.name || '');
        await loadSharedData(result.session_token, result);
      } else {
        throw new Error('Authentication failed');
      }
    } catch (e) {
      setError(e.message || 'Google sign-in failed');
      setPhase('auth');
    }
  }

  function handleGoogleClick() {
    if (!window.google) return;
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // Fallback: render hidden button and click it
        const btn = document.createElement('div');
        btn.id = 'bp_borrower_g_signin';
        btn.style.display = 'none';
        document.body.appendChild(btn);
        window.google.accounts.id.renderButton(btn, { type: 'standard', size: 'large' });
        setTimeout(() => btn.querySelector('[role="button"]')?.click(), 100);
      }
    });
  }

  // ── Magic Link: Request ────────────────────────────────────────────────
  async function handleRequestMagicLink(e) {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    setError('');
    try {
      await requestBorrowerMagicLink(email.trim(), borrowerName, shareToken);
      setPhase('magic-sent');
    } catch (e) {
      setError(e.message || 'Could not send magic link');
    }
    setSending(false);
  }

  // ── Magic Link: Verify ─────────────────────────────────────────────────
  async function verifyMagicLink(token, verifyEmail) {
    try {
      setError('');
      const result = await verifyBorrowerMagicLink(token, verifyEmail);

      if (result.success && result.session_token) {
        localStorage.setItem(SESSION_KEY, result.session_token);
        localStorage.setItem(BORROWER_KEY, JSON.stringify(result.account));
        setBorrowerName(result.account.name || '');

        // Clean URL
        const url = new URL(window.location);
        url.searchParams.delete('magic');
        url.searchParams.delete('email');
        window.history.replaceState({}, '', url.toString());

        await loadSharedData(result.session_token, result);
      } else {
        throw new Error('Verification failed');
      }
    } catch (e) {
      setError(e.message || 'Invalid or expired magic link');
      setPhase('auth');
    }
  }

  // ── Load shared data and proceed ───────────────────────────────────────
  async function loadSharedData(sessionToken, authResult) {
    try {
      setPhase('loading');
      const shared = await fetchSharedData(shareToken);

      if (!shared || !shared.scenarios) {
        throw new Error('No scenarios found');
      }

      // Build the borrower context
      const borrowerContext = {
        sessionToken,
        account: authResult.account || JSON.parse(localStorage.getItem(BORROWER_KEY) || '{}'),
        shareToken,
        borrower: shared.borrower,
        accessLevel: shared.accessLevel,
        scenarios: shared.scenarios,
      };

      onAuthenticated(borrowerContext);
    } catch (e) {
      if (e.message?.includes('Share link not found')) {
        onError?.('expired');
      } else {
        setError(e.message || 'Could not load your Blueprint');
        setPhase('auth');
      }
    }
  }

  // ─── Render: Splash ────────────────────────────────────────────────────
  if (phase === 'splash' || phase === 'checking') {
    return (
      <div style={{
        minHeight: '100vh', background: T.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, margin: '0 auto 24px',
            borderRadius: 18, background: 'linear-gradient(135deg, #6366F1, #3B82F6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 60px rgba(99,102,241,0.35)',
            animation: 'pulse-glow 2s ease-in-out infinite',
          }}>
            <HomeIcon />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>
            <span style={{ color: T.text }}>Real</span><span style={{ color: T.accent }}>Stack</span>
          </div>
          <div style={{
            fontSize: 11, fontWeight: 600, color: T.textTertiary,
            textTransform: 'uppercase', letterSpacing: '2px', marginTop: 8, fontFamily: MONO,
          }}>
            BLUEPRINT
          </div>
          <div style={{
            fontSize: 14, color: T.textSecondary, marginTop: 24,
            animation: 'fade-pulse 1.5s ease-in-out infinite',
          }}>
            {phase === 'checking' ? 'Verifying your session...' : 'Loading your mortgage blueprint...'}
          </div>
        </div>
        <style>{`
          @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 40px rgba(99,102,241,0.3); } 50% { box-shadow: 0 0 80px rgba(99,102,241,0.5); } }
          @keyframes fade-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        `}</style>
      </div>
    );
  }

  // ─── Render: Magic Link Sent ───────────────────────────────────────────
  if (phase === 'magic-sent') {
    return (
      <div style={{
        minHeight: '100vh', background: T.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: '0 24px' }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 20px',
            borderRadius: 16, background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MailIcon />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: '-0.03em', marginBottom: 10 }}>
            Check your email
          </div>
          <div style={{ fontSize: 15, color: T.textSecondary, lineHeight: 1.6, marginBottom: 6 }}>
            We sent a sign-in link to
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.accent, fontFamily: MONO, marginBottom: 20 }}>
            {email}
          </div>
          <div style={{ fontSize: 13, color: T.textTertiary, lineHeight: 1.6 }}>
            Click the link in your email to access your Blueprint. The link expires in 15 minutes.
          </div>
          <button
            onClick={() => { setPhase('auth'); setError(''); }}
            style={{
              marginTop: 28, padding: '10px 20px',
              background: 'none', border: `1px solid ${T.cardBorder}`,
              borderRadius: 9999, color: T.textSecondary, fontSize: 13,
              cursor: 'pointer', fontFamily: FONT,
            }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Magic Link Verifying ──────────────────────────────────────
  if (phase === 'magic-verify') {
    return (
      <div style={{
        minHeight: '100vh', background: T.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 20px',
            borderRadius: 16, background: 'linear-gradient(135deg, #6366F1, #3B82F6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'pulse-glow 2s ease-in-out infinite',
          }}>
            <ShieldIcon />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>
            Verifying your link...
          </div>
        </div>
        <style>{`
          @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 40px rgba(99,102,241,0.3); } 50% { box-shadow: 0 0 80px rgba(99,102,241,0.5); } }
        `}</style>
      </div>
    );
  }

  // ─── Render: Loading shared data ───────────────────────────────────────
  if (phase === 'loading') {
    const firstName = borrowerName?.split(' ')[0];
    return (
      <div style={{
        minHeight: '100vh', background: T.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, margin: '0 auto 24px',
            borderRadius: 18, background: 'linear-gradient(135deg, #6366F1, #3B82F6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 60px rgba(99,102,241,0.35)',
            animation: 'pulse-glow 2s ease-in-out infinite',
          }}>
            <HomeIcon />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: '-0.03em' }}>
            {firstName ? `Welcome back, ${firstName}` : 'Loading your Blueprint...'}
          </div>
          <div style={{
            fontSize: 14, color: T.textSecondary, marginTop: 12,
            animation: 'fade-pulse 1.5s ease-in-out infinite',
          }}>
            Preparing your mortgage calculator...
          </div>
        </div>
        <style>{`
          @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 40px rgba(99,102,241,0.3); } 50% { box-shadow: 0 0 80px rgba(99,102,241,0.5); } }
          @keyframes fade-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        `}</style>
      </div>
    );
  }

  // ─── Render: Auth Screen (Google + Magic Link) ─────────────────────────
  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT, padding: '20px',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'fixed', inset: 0, opacity: 0.02, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div style={{
        position: 'relative', maxWidth: 420, width: '100%',
        animation: 'fade-in 0.4s ease-out',
      }}>
        {/* Logo + header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 20px',
            borderRadius: 16, background: 'linear-gradient(135deg, #6366F1, #3B82F6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(99,102,241,0.25)',
          }}>
            <HomeIcon />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>
            <span style={{ color: T.text }}>Real</span><span style={{ color: T.accent }}>Stack</span>
          </div>
          <div style={{
            fontSize: 10, fontWeight: 600, color: T.textTertiary,
            textTransform: 'uppercase', letterSpacing: '2px', marginTop: 6, fontFamily: MONO,
          }}>
            BLUEPRINT
          </div>
        </div>

        {/* Auth card */}
        <div style={{
          background: T.card, border: `1px solid ${T.cardBorder}`,
          borderRadius: 20, padding: '32px 28px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        }}>
          <div style={{
            fontSize: 20, fontWeight: 700, color: T.text,
            letterSpacing: '-0.03em', marginBottom: 8, textAlign: 'center',
          }}>
            Sign in to view your Blueprint
          </div>
          <div style={{
            fontSize: 14, color: T.textSecondary, lineHeight: 1.5,
            textAlign: 'center', marginBottom: 28,
          }}>
            Your loan officer has shared mortgage scenarios with you. Sign in to access them securely.
          </div>

          {/* Google Sign-In button */}
          {GOOGLE_CLIENT_ID && (
            <button
              onClick={handleGoogleClick}
              disabled={!googleReady}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', padding: '13px 20px',
                background: '#fff', color: '#3c4043',
                border: '1px solid #dadce0', borderRadius: 12,
                fontSize: 15, fontWeight: 500, cursor: googleReady ? 'pointer' : 'default',
                fontFamily: FONT, transition: 'all 0.15s',
                opacity: googleReady ? 1 : 0.6,
              }}
            >
              <GoogleIcon />
              Continue with Google
            </button>
          )}

          {/* Divider */}
          {GOOGLE_CLIENT_ID && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              margin: '20px 0', color: T.textTertiary, fontSize: 12,
            }}>
              <div style={{ flex: 1, height: 1, background: T.separator }} />
              <span style={{ fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>or</span>
              <div style={{ flex: 1, height: 1, background: T.separator }} />
            </div>
          )}

          {/* Magic link section */}
          {!showMagicLink && GOOGLE_CLIENT_ID ? (
            <button
              onClick={() => setShowMagicLink(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '13px 20px',
                background: 'transparent', color: T.textSecondary,
                border: `1px solid ${T.cardBorder}`, borderRadius: 12,
                fontSize: 14, fontWeight: 500, cursor: 'pointer',
                fontFamily: FONT, transition: 'all 0.15s',
              }}
            >
              <MailIcon />
              Sign in with email
            </button>
          ) : (
            <form onSubmit={handleRequestMagicLink}>
              <div style={{ marginBottom: 12 }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  autoFocus
                  style={{
                    width: '100%', padding: '13px 16px',
                    background: T.inputBg, color: T.text,
                    border: `1px solid ${T.inputBorder}`, borderRadius: 12,
                    fontSize: 15, fontFamily: FONT, outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = T.accent}
                  onBlur={(e) => e.target.style.borderColor = T.inputBorder}
                />
              </div>
              <button
                type="submit"
                disabled={!email.trim() || sending}
                style={{
                  width: '100%', padding: '13px 20px',
                  background: email.trim() && !sending ? 'linear-gradient(135deg, #6366F1, #3B82F6)' : 'rgba(99,102,241,0.2)',
                  color: '#fff', border: 'none', borderRadius: 12,
                  fontSize: 15, fontWeight: 600, cursor: email.trim() && !sending ? 'pointer' : 'default',
                  fontFamily: FONT, transition: 'all 0.15s',
                  boxShadow: email.trim() && !sending ? '0 4px 16px rgba(99,102,241,0.3)' : 'none',
                }}
              >
                {sending ? 'Sending...' : 'Send magic link'}
              </button>
            </form>
          )}

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 16, padding: '10px 14px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10, color: T.red, fontSize: 13, textAlign: 'center',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Security note */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          marginTop: 20, color: T.textTertiary, fontSize: 11, fontFamily: MONO,
        }}>
          <ShieldIcon />
          <span>Your financial data is encrypted and secure</span>
        </div>

        {/* Footer brand */}
        <div style={{
          textAlign: 'center', marginTop: 28,
          fontSize: 10, color: T.textTertiary, fontFamily: MONO,
          textTransform: 'uppercase', letterSpacing: '1.5px',
        }}>
          MORTGAGE TECHNOLOGY PLATFORM
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 40px rgba(99,102,241,0.3); } 50% { box-shadow: 0 0 80px rgba(99,102,241,0.5); } }
        @keyframes fade-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}
