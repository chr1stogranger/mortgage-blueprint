/**
 * store.js — Redux Store Configuration
 *
 * Central Redux store for Mortgage Blueprint.
 * Currently houses marketsSlice only. Additional slices can be added here
 * as we migrate more state out of the monolithic MortgageBlueprint component.
 *
 * @author Christo Granger / Claude — March 2026
 */

import { configureStore } from '@reduxjs/toolkit';
import marketsReducer from './marketsSlice';

// ─────────────────────────────────────────────
// LOCAL STORAGE PERSISTENCE
// ─────────────────────────────────────────────

const STORAGE_KEY = 'pricepoint_markets_state';

/**
 * Load persisted state from localStorage.
 * Only restores userProfile, userPortfolio, practiceMode, and complianceLogs.
 * Live markets and UI state always start fresh.
 */
function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;

    const persisted = JSON.parse(raw);

    // Only restore user-specific data, not market listings or UI
    return {
      markets: {
        ...persisted,
        // Always start fresh:
        liveMarkets: [],
        marketsLastFetched: null,
        notifications: persisted.notifications || [],
        ui: {
          activeTab: 'live',
          filters: { zip: '', city: '', state: 'CA', minPrice: null, maxPrice: null, neighborhood: '' },
          sortBy: 'volume',
          sortDirection: 'desc',
          selectedMarketId: null,
          tradingPanelOpen: false,
          complianceModalOpen: false,
          complianceModalType: null,
          complianceModalPropertyId: null,
          loading: false,
          error: null,
        },
      },
    };
  } catch (err) {
    console.warn('Failed to load persisted markets state:', err);
    return undefined;
  }
}

/**
 * Save select state to localStorage after each dispatch.
 * Debounced to avoid excessive writes.
 */
let saveTimeout = null;
function persistState(state) {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const toPersist = {
        userProfile: state.markets.userProfile,
        userPortfolio: state.markets.userPortfolio,
        practiceMode: state.markets.practiceMode,
        complianceLogs: state.markets.complianceLogs,
        notifications: state.markets.notifications.slice(0, 50), // keep last 50
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
    } catch (err) {
      console.warn('Failed to persist markets state:', err);
    }
  }, 500);
}

// ─────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────

const preloadedState = loadPersistedState();

const store = configureStore({
  reducer: {
    markets: marketsReducer,
    // Future slices:
    // calculator: calculatorReducer,
    // borrowers: borrowersReducer,
    // scenarios: scenariosReducer,
  },
  preloadedState,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Allow non-serializable values in compliance logs (Date objects, etc.)
      serializableCheck: {
        ignoredActions: ['markets/resolveMarket/fulfilled'],
      },
    }),
  devTools: import.meta.env.DEV,
});

// Subscribe to store changes for persistence
store.subscribe(() => {
  persistState(store.getState());
});

export default store;
