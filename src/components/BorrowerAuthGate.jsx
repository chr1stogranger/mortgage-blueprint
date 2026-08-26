import { FONT } from "../lib/fonts.js";
/**
 * BorrowerAuthGate — Handles the borrower authentication flow for share links.
 *
 * NOW POWERED BY NATIVE SUPABASE AUTH (magic link + Google OAuth).
 * The old custom magic-token/HMAC-session system is retired; Supabase
 * handles token issuance, refresh, and the email round-trip. RLS policies
 * (loan-pipeline migrations/010) bind all data access to auth.uid().
 *
 * Flow:
 *   1. Show branded splash screen
 *   2. Check for existing Supabase session → auto-proceed
 *   3. If no session → show auth screen (Google OAuth + Magic Link)
 *   4. Magic link redirects back here; detectSessionInUrl completes sign-in
 *   5. After auth → fetch shared data → call onAuthenticated with context
 */
import { useState, useEffect, useRef } from 'react';
import { fetchSharedData } from '../api';
import {
  getSession,
  onAuthStateChange,
  signInWithMagicLink,
  signInWithGoogle,
  verifyEmailCode,
  fetchMyAccount,
} from '../lib/supabaseClient';


const T = {
  bg: '#0a1120', card: '#0d1524', surface: '#121c30',
  cardBorder: 'rgba(255,255,255,0.06)', cardBorderHover: 'rgba(255,255,255,0.12)',
  accent: '#3B6BF5', accentLight: '#6E90FF', accentBright: '#6E90FF',
  blue: '#3B6BF5', teal: '#38c6c6', green: '#12a150', red: '#e5484d',
  text: '#EDEDED', textSecondary: '#A1A1A1', textTertiary: '#666666',
  separator: 'rgba(255,255,255,0.06)',
  inputBg: '#162034', inputBorder: 'rgba(255,255,255,0.12)',
};

// ─── Google Icon ──────────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

// ─── RealStack Brand Icon — "Airy Iso Stack" (Brand Kit, Color Version) ──────
const HomeIcon = () => (
  <svg width="36" height="36" viewBox="0 0 100 100" fill="none">
    {/* Roof */}
    <polygon points="50,4 8,22 50,14 92,22" fill="#C7D2FE"/>
    <polygon points="50,14 92,22 92,26 50,18" fill="#4F46E5"/>
    <polygon points="8,22 50,14 50,18 8,26" fill="#6E90FF"/>
    {/* Sheet 4 — Indigo (top) */}
    <polygon points="8,32 50,24 92,32 50,40" fill="#6E90FF"/>
    <polygon points="50,40 92,32 92,35 50,43" fill="#3B6BF5"/>
    <polygon points="8,32 50,40 50,43 8,35" fill="#6E90FF"/>
    {/* Sheet 3 — Blue */}
    <polygon points="8,48 50,40 92,48 50,56" fill="#93C5FD"/>
    <polygon points="50,56 92,48 92,51 50,59" fill="#3B6BF5"/>
    <polygon points="8,48 50,56 50,59 8,51" fill="#60A5FA"/>
    {/* Sheet 2 — Teal */}
    <polygon points="8,64 50,56 92,64 50,72" fill="#67E8F9"/>
    <polygon points="50,72 92,64 92,67 50,75" fill="#38c6c6"/>
    <polygon points="8,64 50,72 50,75 8,67" fill="#22D3EE"/>
    {/* Sheet 1 — Green (bottom) */}
    <polygon points="8,80 50,72 92,80 50,88" fill="#6EE7B7"/>
    <polygon points="50,88 92,80 92,83 50,91" fill="#12a150"/>
    <polygon points="8,80 50,88 50,91 8,83" fill="#34D399"/>
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
  // Phase: 'splash' → 'checking' → 'auth' → 'magic-sent' → 'loading' → 'done'
  const [phase, setPhase] = useState('splash');
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [borrowerName, setBorrowerName] = useState('');
  const [sending, setSending] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const proceedingRef = useRef(false);

  // ── Step 1: Splash → Check existing Supabase session ────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      checkExistingSession();
    }, 1200); // Show splash for 1.2s minimum
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Listen for auth completion (magic-link / OAuth redirect back) ───────
  useEffect(() => {
    const sub = onAuthStateChange((session) => {
      if (session && !proceedingRef.current) {
        proceedingRef.current = true;
        proceedWithSession(session);
      }
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Check existing session ───────────────────────────────────────────────
  async function checkExistingSession() {
    setPhase('checking');
    try {
      const session = await getSession();
      if (session) {
        if (!proceedingRef.current) {
          proceedingRef.current = true;
          await proceedWithSession(session);
        }
        return;
      }
    } catch { /* fall through to auth screen */ }
    if (!proceedingRef.current) setPhase('auth');
  }

  // ── Google Sign-In (OAuth redirect — completes via onAuthStateChange) ───
  async function handleGoogleClick() {
    try {
      setError('');
      await signInWithGoogle({ shareToken });
      // Full-page redirect follows; nothing else to do here.
    } catch (e) {
      setError(e.message || 'Google sign-in failed');
      setPhase('auth');
    }
  }

  // ── Magic Link: Request ──────────────────────────────────────────────────
  async function handleRequestMagicLink(e) {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    setError('');
    try {
      await signInWithMagicLink(email.trim(), { shareToken, name: borrowerName });
      setPhase('magic-sent');
    } catch (err) {
      setError(err.message || 'Could not send magic link');
    }
    setSending(false);
  }

  // ── Magic Link: verify the emailed 6-digit code (in-app, no redirect) ────
  async function handleVerifyCode(e) {
    e.preventDefault();
    if (code.trim().length < 6 || verifying) return;
    setVerifying(true);
    setError('');
    try {
      await verifyEmailCode(email, code);
      // onAuthStateChange fires with the new session and proceeds.
    } catch (err) {
      setError(err.message || 'That code didn’t work — check for a newer email');
    }
    setVerifying(false);
  }

  // ── Load shared data and proceed ─────────────────────────────────────────
  async function proceedWithSession(session) {
    try {
      setPhase('loading');

      const name = session.user?.user_metadata?.full_name
        || session.user?.user_metadata?.name
        || '';
      setBorrowerName(name);

      // Account row is provisioned by the DB trigger on first sign-in;
      // may lag by a moment — retry briefly.
      let account = await fetchMyAccount();
      if (!account) {
        await new Promise(r => setTimeout(r, 800));
        account = await fetchMyAccount();
      }

      const shared = await fetchSharedData(shareToken);
      if (!shared || !shared.scenarios) {
        throw new Error('No scenarios found');
      }

      onAuthenticated({
        sessionToken: session.access_token,
        account: account || { email: session.user?.email, name },
        shareToken,
        borrower: shared.borrower,
        accessLevel: shared.accessLevel,
        scenarios: shared.scenarios,
      });
    } catch (e) {
      proceedingRef.current = false;
      if (e.message?.includes('Share link not found')) {
        onError?.('expired');
      } else {
        setError(e.message || 'Could not load your Blueprint');
        setPhase('auth');
      }
    }
  }

  // ─── Render: Splash / Checking ─────────────────────────────────────────
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
            borderRadius: 18, background: 'linear-gradient(135deg, #3B6BF5, #2B4FCE)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 60px rgba(59,107,245,0.35)',
            animation: 'pulse-glow 2s ease-in-out infinite',
          }}>
            <HomeIcon />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>
            <span style={{ color: T.text }}>Real</span><span style={{ color: T.accent }}>Stack</span>
          </div>
          <div style={{
            fontSize: 11, fontWeight: 600, color: T.textTertiary,
            textTransform: 'uppercase', letterSpacing: '2px', marginTop: 8, fontFamily: FONT,
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
          @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 40px rgba(59,107,245,0.3); } 50% { box-shadow: 0 0 80px rgba(59,107,245,0.5); } }
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
            borderRadius: 16, background: 'rgba(18,161,80,0.1)',
            border: '1px solid rgba(18,161,80,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: T.green,
          }}>
            <MailIcon />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: '-0.03em', marginBottom: 10 }}>
            Check your email
          </div>
          <div style={{ fontSize: 15, color: T.textSecondary, lineHeight: 1.6, marginBottom: 6 }}>
            We sent a sign-in code to
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.accent, fontFamily: FONT, marginBottom: 20 }}>
            {email}
          </div>
          <form onSubmit={handleVerifyCode} style={{ marginBottom: 16 }}>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
              placeholder="6-digit code"
              autoFocus
              style={{
                width: '100%', padding: '13px 16px', boxSizing: 'border-box',
                background: T.inputBg, color: T.text,
                border: `1px solid ${T.inputBorder}`, borderRadius: 12,
                fontSize: 18, fontFamily: FONT, outline: 'none',
                marginBottom: 10, textAlign: 'center', letterSpacing: '0.35em',
              }}
            />
            <button
              type="submit"
              disabled={code.trim().length < 6 || verifying}
              style={{
                width: '100%', padding: '13px 20px',
                background: code.trim().length >= 6 && !verifying ? 'linear-gradient(135deg, #3B6BF5, #2B4FCE)' : 'rgba(59,107,245,0.2)',
                color: '#fff', border: 'none', borderRadius: 9999,
                fontSize: 15, fontWeight: 600, cursor: code.trim().length >= 6 && !verifying ? 'pointer' : 'default',
                fontFamily: FONT,
              }}
            >
              {verifying ? 'Verifying...' : 'Verify code'}
            </button>
          </form>
          <div style={{ fontSize: 13, color: T.textTertiary, lineHeight: 1.6 }}>
            Enter the 6-digit code from the email, or tap the link in it — either signs you in.
          </div>
          {error && (
            <div style={{
              marginTop: 14, padding: '10px 14px',
              background: 'rgba(229,72,77,0.08)', border: '1px solid rgba(229,72,77,0.2)',
              borderRadius: 10, color: T.red, fontSize: 13, textAlign: 'center',
            }}>
              {error}
            </div>
          )}
          <button
            onClick={() => { setPhase('auth'); setError(''); setCode(''); }}
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
            borderRadius: 18, background: 'linear-gradient(135deg, #3B6BF5, #2B4FCE)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 60px rgba(59,107,245,0.35)',
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
          @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 40px rgba(59,107,245,0.3); } 50% { box-shadow: 0 0 80px rgba(59,107,245,0.5); } }
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
            borderRadius: 16, background: 'linear-gradient(135deg, #3B6BF5, #2B4FCE)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(59,107,245,0.25)',
          }}>
            <HomeIcon />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>
            <span style={{ color: T.text }}>Real</span><span style={{ color: T.accent }}>Stack</span>
          </div>
          <div style={{
            fontSize: 10, fontWeight: 600, color: T.textTertiary,
            textTransform: 'uppercase', letterSpacing: '2px', marginTop: 6, fontFamily: FONT,
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
          <button
            onClick={handleGoogleClick}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', padding: '13px 20px',
              background: '#fff', color: '#3c4043',
              border: '1px solid #dadce0', borderRadius: 12,
              fontSize: 15, fontWeight: 500, cursor: 'pointer',
              fontFamily: FONT, transition: 'all 0.15s',
            }}
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            margin: '20px 0', color: T.textTertiary, fontSize: 12,
          }}>
            <div style={{ flex: 1, height: 1, background: T.separator }} />
            <span style={{ fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>or</span>
            <div style={{ flex: 1, height: 1, background: T.separator }} />
          </div>

          {/* Magic link section */}
          {!showMagicLink ? (
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
                  background: email.trim() && !sending ? 'linear-gradient(135deg, #3B6BF5, #2B4FCE)' : 'rgba(59,107,245,0.2)',
                  color: '#fff', border: 'none', borderRadius: 12,
                  fontSize: 15, fontWeight: 600, cursor: email.trim() && !sending ? 'pointer' : 'default',
                  fontFamily: FONT, transition: 'all 0.15s',
                  boxShadow: email.trim() && !sending ? '0 4px 16px rgba(59,107,245,0.3)' : 'none',
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
              background: 'rgba(229,72,77,0.08)', border: '1px solid rgba(229,72,77,0.2)',
              borderRadius: 10, color: T.red, fontSize: 13, textAlign: 'center',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Security note */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          marginTop: 20, color: T.textTertiary, fontSize: 11, fontFamily: FONT,
        }}>
          <ShieldIcon />
          <span>Your financial data is encrypted and secure</span>
        </div>

        {/* Footer brand */}
        <div style={{
          textAlign: 'center', marginTop: 28,
          fontSize: 10, color: T.textTertiary, fontFamily: FONT,
          textTransform: 'uppercase', letterSpacing: '1.5px',
        }}>
          MORTGAGE TECHNOLOGY PLATFORM
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 40px rgba(59,107,245,0.3); } 50% { box-shadow: 0 0 80px rgba(59,107,245,0.5); } }
        @keyframes fade-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}
