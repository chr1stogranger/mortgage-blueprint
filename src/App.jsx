import { FONT } from "./lib/fonts.js";
import { useState, useEffect, Component } from 'react'
import * as Sentry from '@sentry/react'
import MortgageBlueprint from './MortgageBlueprint'
import BlueprintAuth from './BlueprintAuth'
import BorrowerAuthGate from './components/BorrowerAuthGate'
import Icon from './Icon'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://ops.realstack.app';

// ── Saved notice: "this shared Blueprint is in your account now" ────────────
// Shown once per share link in borrower mode. Opening the link is what saves
// it: Ops lists every Blueprint this email is on under "Shared with you", as
// a live view of the loan officer's file. It used to offer "Keep a copy",
// and a copy went stale the moment the LO changed a number (2026-11-21).
function SavedNotice({ shareToken }) {
  const seenKey = `bp_saved_notice_${shareToken}`;
  const [show, setShow] = useState(() => {
    try {
      // Anyone who answered the old "Keep a copy" banner has seen enough.
      return !localStorage.getItem(seenKey) && !localStorage.getItem(`bp_claim_dismissed_${shareToken}`);
    } catch { return false; }
  });
  useEffect(() => {
    if (!show) return undefined;
    try { localStorage.setItem(seenKey, '1'); } catch { /* noop */ }
    const t = setTimeout(() => setShow(false), 9000);
    return () => clearTimeout(t);
  }, [show, seenKey]);

  if (!show) return null;

  return (
    <div role="status" style={{
      // Rides above the guided step bar when it's up (--bp-guide-bar-top is
      // set by the bar in MortgageBlueprint.jsx; 0 when there is no bar).
      position: 'fixed', bottom: 'max(calc(16px + env(safe-area-inset-bottom, 0px)), calc(var(--bp-guide-bar-top, 0px) + 8px))',
      left: '50%', transform: 'translateX(-50%)', zIndex: 1500,
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(59,107,245,0.3)', borderRadius: 9999,
      padding: '8px 10px 8px 18px', maxWidth: 'calc(100vw - 32px)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <span style={{ fontSize: 13, color: '#EDEDED', lineHeight: 1.35 }}>
        <span style={{ color: '#12a150', fontWeight: 600 }}>Saved to your account.</span>{' '}
        Sign in at blueprint.realstack.app on any device to open it.
      </span>
      <button
        onClick={() => setShow(false)}
        aria-label="Dismiss"
        style={{
          background: 'none', border: 'none', color: '#8A8A8A',
          fontSize: 14, cursor: 'pointer', padding: '4px 6px', flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ── Error Boundary for Share Flow ────────────────────────────────────────────
class ShareFlowErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[ShareFlow] Error caught by boundary:', error, errorInfo);
    // Report to Sentry (no-op if VITE_SENTRY_DSN is unset — init is in main.jsx).
    if (import.meta.env.VITE_SENTRY_DSN) {
      Sentry.captureException(error, { tags: { flow: 'share' }, contexts: { react: { componentStack: errorInfo?.componentStack } } });
    }
  }
  render() {
    if (this.state.hasError) {
      const T = { bg: '#f4f9fc', accent: '#3B6BF5', text: '#171717', textSecondary: '#4B5563', red: '#e5484d' }; // light, like the app (2026-10-13)
            return (
        <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
          <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
            <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 14, background: 'rgba(229,72,77,0.1)', border: '1px solid rgba(229,72,77,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: '-0.03em', marginBottom: 8 }}>
              Something went wrong
            </div>
            <div style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.6, marginBottom: 20 }}>
              We had trouble loading your mortgage scenario. This is usually temporary.
            </div>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }} style={{ padding: '10px 24px', borderRadius: 9999, background: T.accent, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Try Again
            </button>
            <div style={{ marginTop: 16, fontSize: 13, color: T.textSecondary }}>
              Need help? Email <a href="mailto:chris@chrisgrangermortgage.com" style={{ color: T.accent }}>chris@chrisgrangermortgage.com</a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [shareToken, setShareToken] = useState(null);
  const [borrowerContext, setBorrowerContext] = useState(null);
  const [shareExpired, setShareExpired] = useState(false);

  // Detect ?share=TOKEN in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('share');
    if (token && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      setShareToken(token);
    }
  }, []);

  // ── Borrower share link flow ────────────────────────────────────────────
  if (shareToken && !borrowerContext) {
    if (shareExpired) {
      // Show expired state
      return <ShareExpiredScreen />;
    }

    return (
      <ShareFlowErrorBoundary>
        <BorrowerAuthGate
          shareToken={shareToken}
          onAuthenticated={(ctx) => {
            // ctx = { sessionToken, account, shareToken, borrower, accessLevel, scenarios }
            setBorrowerContext(ctx);
          }}
          onError={(type) => {
            if (type === 'expired') {
              setShareExpired(true);
            }
          }}
        />
      </ShareFlowErrorBoundary>
    );
  }

  // ── Borrower mode: authenticated, load full calculator ──────────────────
  if (borrowerContext) {
    const { scenarios, shareToken: st, account, borrower, sessionToken, accessLevel } = borrowerContext;

    // Every scenario the LO hasn't hidden arrives here (Ops filters hidden,
    // oldest first). Open ?scenario=<id> when it's one of them, else the first;
    // the sidebar lists the rest (Christo 2026-10-12).
    const list = Array.isArray(scenarios) ? scenarios : [];
    if (list.length === 0) return <ShareEmptyScreen />;
    let wantId = null;
    try { wantId = new URLSearchParams(window.location.search).get('scenario'); } catch { /* no URL */ }
    const scenario = (wantId && list.find(s => String(s.id) === wantId)) || list[0];
    const initialState = scenario?.state_data || null;

    return (
      <ShareFlowErrorBoundary>
      <MortgageBlueprint
        initialState={initialState}
        borrowerMode={{
          enabled: true,
          shareToken: st,
          sessionToken,
          scenarioId: scenario?.id,
          borrower: borrower || {},
          account: account || {},
          accessLevel: accessLevel || 'can_adjust',
          scenarios: list,
        }}
      />
      <SavedNotice shareToken={st} />
      </ShareFlowErrorBoundary>
    );
  }

  // ── Normal LO flow ─────────────────────────────────────────────────────
  return (
    <BlueprintAuth>
      <MortgageBlueprint />
    </BlueprintAuth>
  )
}

// ── Share Empty Screen ──────────────────────────────────────────────────────
// The link is live but the LO has hidden every scenario (or hasn't built one
// yet). Not an error — same layout as the expired screen, neutral tone.
function ShareEmptyScreen() {
  const T = {
    bg: '#f4f9fc', accent: '#3B6BF5', // light, like the app (2026-10-13)
    text: '#171717', textSecondary: '#4B5563', textTertiary: '#6B7280',
  };
  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 24 }}>
        <div style={{
          width: 56, height: 56, margin: '0 auto 16px',
          borderRadius: 14, background: 'rgba(59,107,245,0.1)',
          border: '1px solid rgba(59,107,245,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.accent,
        }}>
          <Icon name="home" size={24} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: '-0.03em', marginBottom: 8 }}>
          Almost ready
        </div>
        <div style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.6 }}>
          Your loan officer is still building your Blueprint. Check back soon.
        </div>
        <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: '10px 24px', borderRadius: 9999, background: T.accent, color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
          Check again
        </button>
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.04em' }}>
            <span style={{ color: T.textTertiary }}>Real</span><span style={{ color: T.accent }}>Stack</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Share Expired Screen ──────────────────────────────────────────────────
function ShareExpiredScreen() {
  const T = {
    bg: '#f4f9fc', accent: '#3B6BF5', // light, like the app (2026-10-13)
    text: '#171717', textSecondary: '#4B5563', textTertiary: '#6B7280',
    red: '#e5484d',
  };
    
  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 24 }}>
        <div style={{
          width: 56, height: 56, margin: '0 auto 16px',
          borderRadius: 14, background: 'rgba(229,72,77,0.1)',
          border: '1px solid rgba(229,72,77,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: '-0.03em', marginBottom: 8 }}>
          Link Not Found
        </div>
        <div style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.6 }}>
          This share link may have expired or been deactivated.
        </div>
        <div style={{ marginTop: 24, padding: '16px 20px', background: 'rgba(59,107,245,0.06)', border: '1px solid rgba(59,107,245,0.15)', borderRadius: 12 }}>
          <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 8 }}>Need a new link? Contact your loan officer:</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 4 }}>Chris Granger</div>
          <div style={{ fontSize: 13, color: T.textSecondary }}>NMLS #952015</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="mailto:chris@chrisgrangermortgage.com" style={{ padding: '8px 16px', borderRadius: 9999, background: T.accent, color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
              Email
            </a>
            <a href="tel:4159878489" style={{ padding: '8px 16px', borderRadius: 9999, background: 'transparent', color: T.accent, textDecoration: 'none', fontSize: 13, fontWeight: 600, border: `1px solid ${T.accent}` }}>
              Call
            </a>
            <a href="https://calendly.com/chrisgranger" target="_blank" rel="noopener noreferrer" style={{ padding: '8px 16px', borderRadius: 9999, background: 'transparent', color: T.accent, textDecoration: 'none', fontSize: 13, fontWeight: 600, border: `1px solid ${T.accent}` }}>
              Schedule
            </a>
          </div>
        </div>
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.04em' }}>
            <span style={{ color: T.textTertiary }}>Real</span><span style={{ color: T.accent }}>Stack</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App
