import { useState, useEffect } from 'react'
import MortgageBlueprint from './MortgageBlueprint'
import BlueprintAuth from './BlueprintAuth'
import BorrowerAuthGate from './components/BorrowerAuthGate'

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
    );
  }

  // ── Borrower mode: authenticated, load full calculator ──────────────────
  if (borrowerContext) {
    const { scenarios, shareToken: st, account, borrower, sessionToken, accessLevel } = borrowerContext;

    // Pick the first scenario's state_data (or let user choose if multiple — future enhancement)
    const scenario = scenarios[0];
    const initialState = scenario?.state_data || null;

    return (
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
          This share link may have expired or been deactivated. Contact your loan officer for a new link.
        </div>
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.04em' }}>
            <span style={{ color: T.textTertiary }}>Real</span><span style={{ color: T.accent }}>Stack</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App
