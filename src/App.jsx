import { useState, useEffect, Component } from 'react'
import MortgageBlueprint from './MortgageBlueprint'
import BlueprintAuth from './BlueprintAuth'
import BorrowerAuthGate from './components/BorrowerAuthGate'

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
  }
  render() {
    if (this.state.hasError) {
      const T = { bg: '#050505', accent: '#6366F1', text: '#EDEDED', textSecondary: '#A1A1A1', red: '#EF4444' };
      const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
      return (
        <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
          <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
            <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              Need help? Email <a href="mailto:chr1stogranger@gmail.com" style={{ color: T.accent }}>chr1stogranger@gmail.com</a>
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

    // Pick the first scenario's state_data (or let user choose if multiple — future enhancement)
    const scenario = scenarios[0];
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
          scenarios,
        }}
      />
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

// ── Share Expired Screen ──────────────────────────────────────────────────
function ShareExpiredScreen() {
  const T = {
    bg: '#050505', accent: '#6366F1',
    text: '#EDEDED', textSecondary: '#A1A1A1', textTertiary: '#666666',
    red: '#EF4444',
  };
  const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
  const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 24 }}>
        <div style={{
          width: 56, height: 56, margin: '0 auto 16px',
          borderRadius: 14, background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
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
        <div style={{ marginTop: 24, padding: '16px 20px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12 }}>
          <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 8 }}>Need a new link? Contact your loan officer:</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 4 }}>Chris Granger</div>
          <div style={{ fontSize: 13, color: T.textSecondary }}>NMLS #952015</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="mailto:chr1stogranger@gmail.com" style={{ padding: '8px 16px', borderRadius: 9999, background: T.accent, color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
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
