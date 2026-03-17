import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import store from './store/store'
import './index.css'
import App from './App.jsx'
import { Capacitor } from '@capacitor/core'

// ── Error Boundary ──
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#050505',
          color: '#EDEDED',
          fontFamily: 'Inter, sans-serif',
          padding: '24px'
        }}>
          <h1 style={{ fontSize: '28px', marginBottom: '16px' }}>Something went wrong</h1>
          <p style={{ fontSize: '14px', color: '#A1A1A1', marginBottom: '24px', textAlign: 'center' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              backgroundColor: '#6366F1',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '9999px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// SECURITY TODO: Move API keys to backend proxy endpoints instead of exposing on window object
window.__FRED_API_KEY__ = import.meta.env.VITE_FRED_API_KEY || "";
window.__GOOGLE_PLACES_KEY__ = import.meta.env.VITE_GOOGLE_PLACES_KEY || "";

// ── Native iOS/Android status bar styling ──
// Only runs inside Capacitor native shell, no-op on web
if (Capacitor.isNativePlatform()) {
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    // Light text on dark background (matches dark mode default)
    StatusBar.setStyle({ style: Style.Dark });
    // Let content render behind the status bar (for safe-area handling)
    StatusBar.setOverlaysWebView({ overlay: true });
  }).catch(() => {
    // Status bar plugin not available — running on web, ignore
  });
}

// ── Offline detection ──
window.addEventListener('offline', () => {
  document.title = '(Offline) RealStack Blueprint';
});
window.addEventListener('online', () => {
  document.title = 'RealStack Blueprint';
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <App />
      </Provider>
    </ErrorBoundary>
  </StrictMode>,
)
