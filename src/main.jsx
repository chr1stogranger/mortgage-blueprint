import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Capacitor } from '@capacitor/core'

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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
