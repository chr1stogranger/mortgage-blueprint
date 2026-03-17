/**
 * marketsSlice.js — PricePoint Prediction Markets
 *
 * Full Redux Toolkit slice for Polymarket-style real estate prediction trading.
 * Play money only (Phase 1). Compliance layer built in from day one.
 *
 * State domains:
 *   - liveMarkets: active MLS listings with price buckets and odds
 *   - userProfile: role declaration, compliance status, blacklist
 *   - userPortfolio: balance, active positions, closed positions
 *   - practiceMode: closed comp predictions, earnings history
 *   - ui: filters, sort, loading states
 *
 * @author Christo Granger / Claude — March 2026
 */

import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

export const STARTING_BALANCE = 10000; // $10,000 play money
export const MIN_BET = 10;
export const MAX_BET = 1000;
export const PRACTICE_REWARD_CORRECT = 500;
export const PRACTICE_REWARD_CLOSE = 100; // within one bucket

export const MARKET_STATUS = {
  OPEN: 'open',
  PENDING: 'pending',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
};

export const BUCKET_COUNT = 4;

export const USER_ROLES = [
  { id: 'home_buyer', label: 'Home Buyer', insiderRisk: false },
  { id: 'homeowner', label: 'Homeowner', insiderRisk: false },
  { id: 'real_estate_agent', label: 'Real Estate Agent', insiderRisk: true },
  { id: 'loan_officer', label: 'Loan Officer', insiderRisk: true },
  { id: 'escrow_officer', label: 'Escrow Officer', insiderRisk: true },
  { id: 'title_company', label: 'Title Company Employee', insiderRisk: true },
  { id: 'insurance_agent', label: 'Insurance Agent', insiderRisk: false },
  { id: 'appraiser', label: 'Appraiser', insiderRisk: true },
  { id: 'real_estate_attorney', label: 'Real Estate Attorney', insiderRisk: true },
  { id: 'property_inspector', label: 'Property Inspector', insiderRisk: false },
  { id: 'investor_fund_manager', label: 'Investor / Fund Manager', insiderRisk: false },
  { id: 'other', label: 'Other', insiderRisk: false },
];

// Compliance attestation types
export const ATTESTATION_TYPE = {
  ONBOARDING_ROLE: 'onboarding_role',
  ONBOARDING_INSIDER: 'onboarding_insider_access',
  PROPERTY_BET: 'property_bet_attestation',
  PROPERTY_BET_BLOCKED: 'property_bet_blocked',
};


// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/**
 * Generate 4 dynamic price buckets from comp data.
 * Buckets are evenly spaced around the estimated sale price range.
 *
 * @param {number} estimatedLow - Low end of comp-based estimate
 * @param {number} estimatedHigh - High end of comp-based estimate
 * @returns {Array} Four bucket objects with label, min, max, odds, volume
 */
export function generatePriceBuckets(estimatedLow, estimatedHigh) {
  const range = estimatedHigh - estimatedLow;
  const step = range / 2; // 4 buckets span 2x the estimated range
  const floor = Math.max(0, estimatedLow - step / 2);

  const bucketEdges = [
    floor,
    floor + step,
    floor + step * 2,
    floor + step * 3,
  ];

  const formatPrice = (n) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toLocaleString()}`;
  };

  return [
    {
      id: 0,
      label: `Under ${formatPrice(bucketEdges[1])}`,
      min: 0,
      max: bucketEdges[1],
      odds: 0.25,
      volume: 0,
      totalShares: 0,
    },
    {
      id: 1,
      label: `${formatPrice(bucketEdges[1])} – ${formatPrice(bucketEdges[2])}`,
      min: bucketEdges[1],
      max: bucketEdges[2],
      odds: 0.25,
      volume: 0,
      totalShares: 0,
    },
    {
      id: 2,
      label: `${formatPrice(bucketEdges[2])} – ${formatPrice(bucketEdges[3])}`,
      min: bucketEdges[2],
      max: bucketEdges[3],
      odds: 0.25,
      volume: 0,
      totalShares: 0,
    },
    {
      id: 3,
      label: `Over ${formatPrice(bucketEdges[3])}`,
      min: bucketEdges[3],
      max: Infinity,
      odds: 0.25,
      volume: 0,
      totalShares: 0,
    },
  ];
}

/**
 * Recalculate odds for all buckets based on volume distribution.
 * Uses a simple proportional model: odds = bucketVolume / totalVolume.
 * Minimum odds floor of 0.02 (2%) to prevent zero-odds lockout.
 *
 * @param {Array} buckets - Array of bucket objects with volume
 * @returns {Array} Updated buckets with recalculated odds
 */
export function recalculateOdds(buckets) {
  const totalVolume = buckets.reduce((sum, b) => sum + b.volume, 0);

  if (totalVolume === 0) {
    // No bets yet — equal odds
    return buckets.map((b) => ({ ...b, odds: 1 / buckets.length }));
  }

  const ODDS_FLOOR = 0.02;
  const rawOdds = buckets.map((b) => Math.max(ODDS_FLOOR, b.volume / totalVolume));
  const rawSum = rawOdds.reduce((s, o) => s + o, 0);

  // Normalize so odds sum to 1.0
  return buckets.map((b, i) => ({
    ...b,
    odds: rawOdds[i] / rawSum,
  }));
}

/**
 * Calculate payout for a winning position.
 * Proportional payout: (userShares / totalSharesInBucket) * totalMarketVolume
 *
 * @param {number} userShares - Shares the user holds in winning bucket
 * @param {number} bucketTotalShares - Total shares in the winning bucket
 * @param {number} totalMarketVolume - Total money across all buckets
 * @returns {number} Payout amount
 */
export function calculatePayout(userShares, bucketTotalShares, totalMarketVolume) {
  if (bucketTotalShares === 0) return 0;
  return (userShares / bucketTotalShares) * totalMarketVolume;
}

/**
 * Determine which bucket a sale price falls into.
 * @param {number} salePrice
 * @param {Array} buckets
 * @returns {number} Winning bucket ID, or -1 if no match
 */
export function getWinningBucketId(salePrice, buckets) {
  for (const bucket of buckets) {
    if (salePrice >= bucket.min && salePrice < bucket.max) return bucket.id;
  }
  // Edge case: exact max of last bucket (Infinity) — should be bucket 3
  return buckets[buckets.length - 1].id;
}

/**
 * Generate a compliance log entry.
 */
function createComplianceLog(type, userId, propertyId, attestation, metadata = {}) {
  return {
    id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    userId,
    propertyId,
    attestation,
    timestamp: new Date().toISOString(),
    ...metadata,
  };
}


// ─────────────────────────────────────────────
// ASYNC THUNKS
// ─────────────────────────────────────────────

/**
 * Fetch live markets from MLS API with filters.
 * Calls the existing /api/pricepoint endpoint and transforms into market objects.
 */
export const fetchLiveMarkets = createAsyncThunk(
  'markets/fetchLiveMarkets',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const { zip, city, state, minPrice, maxPrice, status } = filters;

      // Build query params for existing PricePoint API
      const params = new URLSearchParams();
      if (zip) params.set('zip', zip);
      if (city) params.set('city', city);
      if (state) params.set('state', state || 'CA');

      const response = await fetch(`/api/pricepoint?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`MLS API error: ${response.status}`);
      }

      const data = await response.json();
      const listings = data.activeListings || [];

      // Transform MLS listings into market objects
      const markets = listings
        .filter((listing) => {
          if (minPrice && listing.listPrice < minPrice) return false;
          if (maxPrice && listing.listPrice > maxPrice) return false;
          if (status && listing.status !== status) return false;
          return true;
        })
        .map((listing) => {
          // Estimate sale price range from comps
          // Use zestimate if available, otherwise ±10% of list price
          const estCenter = listing.zestimate || listing.listPrice;
          const estimatedLow = Math.round(estCenter * 0.9);
          const estimatedHigh = Math.round(estCenter * 1.1);

          return {
            id: listing.zpid || listing.id,
            propertyId: listing.zpid || listing.id,
            address: listing.address,
            city: listing.city,
            state: listing.state,
            zip: listing.zip,
            neighborhood: listing.neighborhood || null,
            listPrice: listing.listPrice,
            zestimate: listing.zestimate || null,
            estimatedLow,
            estimatedHigh,
            beds: listing.beds,
            baths: listing.baths,
            sqft: listing.sqft,
            yearBuilt: listing.yearBuilt,
            photo: listing.photo,
            daysOnMarket: listing.daysOnMarket,
            pricePerSqft: listing.pricePerSqft,
            buckets: generatePriceBuckets(estimatedLow, estimatedHigh),
            status: listing.status === 'PENDING' ? MARKET_STATUS.PENDING : MARKET_STATUS.OPEN,
            totalVolume: 0,
            totalBettors: 0,
            createdAt: new Date().toISOString(),
            closedAt: null,
            salePrice: null,
            winningBucketId: null,
          };
        });

      return { markets, filters, fetchedAt: new Date().toISOString() };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

/**
 * Fetch closed comps for Practice Mode.
 * Pulls recently sold properties (last 30-60 days) from MLS API.
 */
export const fetchPracticeComps = createAsyncThunk(
  'markets/fetchPracticeComps',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      params.set('zip', filters.zip || '94122');
      if (filters.city) params.set('city', filters.city);
      params.set('state', filters.state || 'CA');

      const response = await fetch(`/api/pricepoint?${params.toString()}`);
      if (!response.ok) throw new Error(`MLS API error: ${response.status}`);

      const data = await response.json();
      const soldListings = data.soldListings || [];

      // Transform into practice comp objects
      const comps = soldListings.map((listing) => {
        const estCenter = listing.zestimate || listing.listPrice || listing.soldPrice;
        const estimatedLow = Math.round(estCenter * 0.9);
        const estimatedHigh = Math.round(estCenter * 1.1);

        return {
          id: listing.zpid || listing.id,
          propertyId: listing.zpid || listing.id,
          address: listing.address,
          city: listing.city,
          state: listing.state,
          zip: listing.zip,
          listPrice: listing.listPrice,
          soldPrice: listing.soldPrice,
          soldDate: listing.soldDate,
          beds: listing.beds,
          baths: listing.baths,
          sqft: listing.sqft,
          photo: listing.photo,
          pricePerSqft: listing.pricePerSqft,
          buckets: generatePriceBuckets(estimatedLow, estimatedHigh),
          estimatedLow,
          estimatedHigh,
        };
      });

      return { comps, fetchedAt: new Date().toISOString() };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

/**
 * Buy shares in a price bucket.
 *
 * COMPLIANCE FLOW (runs before any position opens):
 * 1. Check if user has completed onboarding (role declaration)
 * 2. Check if user is blacklisted
 * 3. Check per-property attestation (passed in as parameter)
 * 4. If attestation = "has insider info" → block + log
 * 5. Validate balance
 * 6. Execute trade
 * 7. Recalculate odds
 */
export const buyShares = createAsyncThunk(
  'markets/buyShares',
  async ({ marketId, bucketId, amount, propertyAttestation }, { getState, rejectWithValue }) => {
    const state = getState().markets;
    const { userProfile, userPortfolio, liveMarkets } = state;

    // ── COMPLIANCE LAYER 1: Onboarding check ──
    if (!userProfile.onboardingComplete) {
      return rejectWithValue({
        code: 'ONBOARDING_REQUIRED',
        message: 'Complete your profile setup before trading. We need to know your role in the real estate industry.',
      });
    }

    // ── COMPLIANCE: Blacklist check ──
    if (userProfile.isBlacklisted) {
      return rejectWithValue({
        code: 'BLACKLISTED',
        message: 'Your account has been restricted from trading due to a compliance violation. Contact support for details.',
      });
    }

    // ── COMPLIANCE LAYER 2: Per-property attestation ──
    // propertyAttestation: { hasInsiderInfo: boolean }
    if (!propertyAttestation || propertyAttestation.hasInsiderInfo === undefined) {
      return rejectWithValue({
        code: 'ATTESTATION_REQUIRED',
        message: 'You must confirm whether you have non-public information about this property before placing a trade.',
      });
    }

    const market = liveMarkets.find((m) => m.id === marketId);
    if (!market) {
      return rejectWithValue({ code: 'MARKET_NOT_FOUND', message: 'Market not found.' });
    }

    // If user admits insider info → block and log
    if (propertyAttestation.hasInsiderInfo === true) {
      const log = createComplianceLog(
        ATTESTATION_TYPE.PROPERTY_BET_BLOCKED,
        userProfile.userId,
        market.propertyId,
        { hasInsiderInfo: true, role: userProfile.role },
        { attemptedAmount: amount, attemptedBucket: bucketId }
      );
      return rejectWithValue({
        code: 'INSIDER_INFO_BLOCKED',
        message: 'Trade blocked. You indicated you have non-public information about this property. This attempt has been logged.',
        complianceLog: log,
      });
    }

    // ── VALIDATION ──
    if (market.status === MARKET_STATUS.CLOSED || market.status === MARKET_STATUS.CANCELLED) {
      return rejectWithValue({ code: 'MARKET_CLOSED', message: 'This market is no longer accepting trades.' });
    }

    if (amount < MIN_BET) {
      return rejectWithValue({ code: 'MIN_BET', message: `Minimum trade is $${MIN_BET}.` });
    }

    if (amount > MAX_BET) {
      return rejectWithValue({ code: 'MAX_BET', message: `Maximum trade is $${MAX_BET}.` });
    }

    if (amount > userPortfolio.balance) {
      return rejectWithValue({ code: 'INSUFFICIENT_BALANCE', message: 'Insufficient balance for this trade.' });
    }

    const bucket = market.buckets.find((b) => b.id === bucketId);
    if (!bucket) {
      return rejectWithValue({ code: 'BUCKET_NOT_FOUND', message: 'Price bucket not found.' });
    }

    // ── EXECUTE TRADE ──
    // Shares purchased = amount / current odds (lower odds = more shares = higher risk/reward)
    const sharePrice = bucket.odds;
    const sharesAcquired = amount / sharePrice;

    // Log the attestation
    const complianceLog = createComplianceLog(
      ATTESTATION_TYPE.PROPERTY_BET,
      userProfile.userId,
      market.propertyId,
      { hasInsiderInfo: false, role: userProfile.role },
      { amount, bucketId, sharesAcquired }
    );

    return {
      marketId,
      bucketId,
      amount,
      sharesAcquired,
      sharePrice,
      complianceLog,
      timestamp: new Date().toISOString(),
    };
  }
);

/**
 * Sell shares from an active position.
 * Payout = shares * current odds (sell at current market price).
 */
export const sellShares = createAsyncThunk(
  'markets/sellShares',
  async ({ marketId, bucketId, sharesToSell }, { getState, rejectWithValue }) => {
    const state = getState().markets;
    const { userPortfolio, liveMarkets } = state;

    const market = liveMarkets.find((m) => m.id === marketId);
    if (!market) {
      return rejectWithValue({ code: 'MARKET_NOT_FOUND', message: 'Market not found.' });
    }

    if (market.status === MARKET_STATUS.CLOSED) {
      return rejectWithValue({ code: 'MARKET_CLOSED', message: 'Cannot sell — market has already closed.' });
    }

    const positionKey = `${marketId}_${bucketId}`;
    const position = userPortfolio.activePositions[positionKey];
    if (!position || position.shares <= 0) {
      return rejectWithValue({ code: 'NO_POSITION', message: 'You have no position in this bucket.' });
    }

    if (sharesToSell > position.shares) {
      return rejectWithValue({ code: 'INSUFFICIENT_SHARES', message: 'You cannot sell more shares than you hold.' });
    }

    const bucket = market.buckets.find((b) => b.id === bucketId);
    const currentPrice = bucket.odds;
    const saleProceeds = sharesToSell * currentPrice;

    return {
      marketId,
      bucketId,
      sharesToSell,
      saleProceeds,
      currentPrice,
      timestamp: new Date().toISOString(),
    };
  }
);

/**
 * Resolve a market when a property closes.
 *
 * Flow:
 * 1. Detect closed status from MLS API
 * 2. Fetch actual sale price
 * 3. Determine winning bucket
 * 4. Calculate proportional payouts for all shareholders
 * 5. Update portfolios
 * 6. Move positions to closedPositions
 * 7. Queue push notification
 */
export const resolveMarket = createAsyncThunk(
  'markets/resolveMarket',
  async ({ marketId, salePrice }, { getState, rejectWithValue }) => {
    const state = getState().markets;
    const market = state.liveMarkets.find((m) => m.id === marketId);

    if (!market) {
      return rejectWithValue({ code: 'MARKET_NOT_FOUND', message: 'Market not found.' });
    }

    if (market.status === MARKET_STATUS.CLOSED) {
      return rejectWithValue({ code: 'ALREADY_RESOLVED', message: 'Market already resolved.' });
    }

    if (!salePrice || salePrice <= 0) {
      return rejectWithValue({ code: 'INVALID_SALE_PRICE', message: 'Invalid sale price.' });
    }

    // Determine winning bucket
    const winningBucketId = getWinningBucketId(salePrice, market.buckets);
    const winningBucket = market.buckets.find((b) => b.id === winningBucketId);
    const totalMarketVolume = market.buckets.reduce((sum, b) => sum + b.volume, 0);

    // Calculate payout per share for the winning bucket
    const payoutPerShare = winningBucket.totalShares > 0
      ? totalMarketVolume / winningBucket.totalShares
      : 0;

    return {
      marketId,
      salePrice,
      winningBucketId,
      totalMarketVolume,
      payoutPerShare,
      winningBucketTotalShares: winningBucket.totalShares,
      closedAt: new Date().toISOString(),
    };
  }
);

/**
 * Check for property status changes across all live markets.
 * This would run on a polling interval or be triggered by user action.
 */
export const checkMarketUpdates = createAsyncThunk(
  'markets/checkMarketUpdates',
  async (_, { getState, dispatch }) => {
    const state = getState().markets;
    const openMarkets = state.liveMarkets.filter(
      (m) => m.status === MARKET_STATUS.OPEN || m.status === MARKET_STATUS.PENDING
    );

    const updates = [];

    for (const market of openMarkets) {
      try {
        // Check MLS API for status changes
        // In production, this would be a batch API call
        const params = new URLSearchParams({ zip: market.zip });
        const response = await fetch(`/api/pricepoint?${params.toString()}`);
        if (!response.ok) continue;

        const data = await response.json();
        const allListings = [...(data.activeListings || []), ...(data.soldListings || [])];
        const listing = allListings.find(
          (l) => (l.zpid || l.id) === market.propertyId
        );

        if (!listing) continue;

        // Check if property has sold
        if (listing.soldPrice && listing.soldPrice > 0) {
          updates.push({ marketId: market.id, salePrice: listing.soldPrice });
          dispatch(resolveMarket({ marketId: market.id, salePrice: listing.soldPrice }));
        }
        // Check if status changed to pending
        else if (listing.status === 'PENDING' && market.status === MARKET_STATUS.OPEN) {
          updates.push({ marketId: market.id, newStatus: MARKET_STATUS.PENDING });
        }
      } catch (err) {
        console.warn(`Failed to check market ${market.id}:`, err);
      }
    }

    return { updates, checkedAt: new Date().toISOString() };
  }
);

/**
 * Cross-reference RETR API for blacklist enforcement.
 * Checks if any user who bet on a property also closed a deal on it.
 *
 * NOTE: RETR API integration is a placeholder — will need real endpoint.
 */
export const checkBlacklistViolations = createAsyncThunk(
  'markets/checkBlacklistViolations',
  async ({ userId, propertyId }, { rejectWithValue }) => {
    try {
      // TODO: Replace with actual RETR API call
      // const response = await fetch(`/api/retr/check?userId=${userId}&propertyId=${propertyId}`);
      // const data = await response.json();
      // return { isViolation: data.userClosedDealOnProperty, userId, propertyId };

      // Placeholder — returns no violation
      return { isViolation: false, userId, propertyId };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);


// ─────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────

const initialState = {
  // ── Live Markets ──
  liveMarkets: [],
  marketsLastFetched: null,
  marketsCacheExpiry: 4 * 60 * 60 * 1000, // 4 hours in ms

  // ── User Profile & Compliance ──
  userProfile: {
    userId: null,
    role: null,
    roleLabel: null,
    isInsiderRole: false,
    hasInsiderAccess: null,       // self-reported at onboarding
    onboardingComplete: false,
    isBlacklisted: false,
    blacklistReason: null,
    blacklistDate: null,
  },

  // ── Compliance Audit Trail ──
  complianceLogs: [],

  // ── User Portfolio ──
  userPortfolio: {
    balance: STARTING_BALANCE,
    totalEarnings: 0,
    totalLosses: 0,
    totalTrades: 0,
    activePositions: {},
    // Shape: { [marketId_bucketId]: { marketId, bucketId, shares, avgCost, currentValue, pnl } }
    closedPositions: [],
    // Shape: [{ marketId, bucketId, shares, costBasis, payout, pnl, closedAt, won }]
  },

  // ── Practice Mode ──
  practiceMode: {
    comps: [],
    compsLastFetched: null,
    currentCompIndex: 0,
    predictions: [],
    // Shape: [{ compId, selectedBucket, actualBucket, correct, reward, timestamp }]
    practiceEarnings: 0,
    practiceStreak: 0,
    bestStreak: 0,
  },

  // ── Notifications Queue ──
  notifications: [],
  // Shape: [{ id, type, message, marketId, timestamp, read }]

  // ── UI State ──
  ui: {
    activeTab: 'live', // 'live' | 'practice' | 'portfolio' | 'leaderboard'
    filters: {
      zip: '',
      city: '',
      state: 'CA',
      minPrice: null,
      maxPrice: null,
      neighborhood: '',
    },
    sortBy: 'volume', // 'volume' | 'newest' | 'closing_soon' | 'most_bettors'
    sortDirection: 'desc',
    selectedMarketId: null,
    tradingPanelOpen: false,
    complianceModalOpen: false,
    complianceModalType: null, // 'onboarding' | 'property_attestation'
    complianceModalPropertyId: null,
    loading: false,
    error: null,
  },
};


// ─────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────

const marketsSlice = createSlice({
  name: 'markets',
  initialState,
  reducers: {
    // ── User Profile / Compliance ──

    /**
     * Complete onboarding with role declaration.
     * Layer 1 compliance: user self-identifies their role and insider access.
     */
    completeOnboarding(state, action) {
      const { userId, roleId, hasInsiderAccess } = action.payload;
      const roleConfig = USER_ROLES.find((r) => r.id === roleId);

      state.userProfile.userId = userId;
      state.userProfile.role = roleId;
      state.userProfile.roleLabel = roleConfig?.label || 'Unknown';
      state.userProfile.isInsiderRole = roleConfig?.insiderRisk || false;
      state.userProfile.hasInsiderAccess = hasInsiderAccess;
      state.userProfile.onboardingComplete = true;

      // Log the onboarding attestation
      state.complianceLogs.push(
        createComplianceLog(ATTESTATION_TYPE.ONBOARDING_ROLE, userId, null, {
          role: roleId,
          roleLabel: roleConfig?.label,
          isInsiderRole: roleConfig?.insiderRisk,
        })
      );
      state.complianceLogs.push(
        createComplianceLog(ATTESTATION_TYPE.ONBOARDING_INSIDER, userId, null, {
          hasInsiderAccess,
        })
      );
    },

    /**
     * Blacklist a user (called when RETR cross-reference finds a violation).
     */
    blacklistUser(state, action) {
      const { reason } = action.payload;
      state.userProfile.isBlacklisted = true;
      state.userProfile.blacklistReason = reason;
      state.userProfile.blacklistDate = new Date().toISOString();
    },

    // ── Market Management ──

    /**
     * Update a market's status (e.g., open → pending).
     */
    updateMarketStatus(state, action) {
      const { marketId, status } = action.payload;
      const market = state.liveMarkets.find((m) => m.id === marketId);
      if (market) {
        market.status = status;
      }
    },

    /**
     * Manually recalculate odds for a specific market.
     */
    updateOdds(state, action) {
      const { marketId } = action.payload;
      const market = state.liveMarkets.find((m) => m.id === marketId);
      if (market) {
        market.buckets = recalculateOdds(market.buckets);
      }
    },

    // ── Practice Mode ──

    /**
     * Submit a practice mode prediction on a closed comp.
     */
    submitPracticePrediction(state, action) {
      const { compId, selectedBucketId } = action.payload;
      const comp = state.practiceMode.comps.find((c) => c.id === compId);
      if (!comp) return;

      const actualBucketId = getWinningBucketId(comp.soldPrice, comp.buckets);
      const correct = selectedBucketId === actualBucketId;
      const close = Math.abs(selectedBucketId - actualBucketId) === 1;

      let reward = 0;
      if (correct) {
        reward = PRACTICE_REWARD_CORRECT;
        state.practiceMode.practiceStreak += 1;
        state.practiceMode.bestStreak = Math.max(
          state.practiceMode.bestStreak,
          state.practiceMode.practiceStreak
        );
      } else if (close) {
        reward = PRACTICE_REWARD_CLOSE;
        state.practiceMode.practiceStreak = 0;
      } else {
        state.practiceMode.practiceStreak = 0;
      }

      state.practiceMode.predictions.push({
        compId,
        selectedBucket: selectedBucketId,
        actualBucket: actualBucketId,
        correct,
        close,
        reward,
        soldPrice: comp.soldPrice,
        timestamp: new Date().toISOString(),
      });

      state.practiceMode.practiceEarnings += reward;
      state.userPortfolio.balance += reward;
      state.userPortfolio.totalEarnings += reward;

      // Advance to next comp
      if (state.practiceMode.currentCompIndex < state.practiceMode.comps.length - 1) {
        state.practiceMode.currentCompIndex += 1;
      }
    },

    /**
     * Award practice capital (for rewards, bonuses, etc.).
     */
    earnPracticeCapital(state, action) {
      const { amount, reason } = action.payload;
      state.userPortfolio.balance += amount;
      state.userPortfolio.totalEarnings += amount;
      state.practiceMode.practiceEarnings += amount;
    },

    // ── Notifications ──

    addNotification(state, action) {
      state.notifications.unshift({
        id: `notif_${Date.now()}`,
        read: false,
        timestamp: new Date().toISOString(),
        ...action.payload,
      });
    },

    markNotificationRead(state, action) {
      const notif = state.notifications.find((n) => n.id === action.payload);
      if (notif) notif.read = true;
    },

    clearNotifications(state) {
      state.notifications = [];
    },

    // ── UI State ──

    setActiveTab(state, action) {
      state.ui.activeTab = action.payload;
    },

    setFilters(state, action) {
      state.ui.filters = { ...state.ui.filters, ...action.payload };
    },

    clearFilters(state) {
      state.ui.filters = { ...initialState.ui.filters };
    },

    setSortBy(state, action) {
      state.ui.sortBy = action.payload;
    },

    setSortDirection(state, action) {
      state.ui.sortDirection = action.payload;
    },

    selectMarket(state, action) {
      state.ui.selectedMarketId = action.payload;
      state.ui.tradingPanelOpen = !!action.payload;
    },

    closeTradingPanel(state) {
      state.ui.tradingPanelOpen = false;
      state.ui.selectedMarketId = null;
    },

    openComplianceModal(state, action) {
      const { type, propertyId } = action.payload;
      state.ui.complianceModalOpen = true;
      state.ui.complianceModalType = type;
      state.ui.complianceModalPropertyId = propertyId || null;
    },

    closeComplianceModal(state) {
      state.ui.complianceModalOpen = false;
      state.ui.complianceModalType = null;
      state.ui.complianceModalPropertyId = null;
    },

    clearError(state) {
      state.ui.error = null;
    },

    // ── Portfolio Reset (dev/testing) ──
    resetPortfolio(state) {
      state.userPortfolio = { ...initialState.userPortfolio };
      state.practiceMode.predictions = [];
      state.practiceMode.practiceEarnings = 0;
      state.practiceMode.practiceStreak = 0;
    },
  },

  extraReducers: (builder) => {
    // ── fetchLiveMarkets ──
    builder
      .addCase(fetchLiveMarkets.pending, (state) => {
        state.ui.loading = true;
        state.ui.error = null;
      })
      .addCase(fetchLiveMarkets.fulfilled, (state, action) => {
        const { markets, fetchedAt } = action.payload;

        // Merge new markets with existing (preserve bet data for markets we already track)
        const existingIds = new Set(state.liveMarkets.map((m) => m.id));
        const newMarkets = markets.filter((m) => !existingIds.has(m.id));

        // Update existing markets' listing data (price, status, photo) but keep buckets/bets
        for (const incoming of markets) {
          const existing = state.liveMarkets.find((m) => m.id === incoming.id);
          if (existing) {
            existing.listPrice = incoming.listPrice;
            existing.daysOnMarket = incoming.daysOnMarket;
            existing.photo = incoming.photo;
            // Don't overwrite buckets — those have live bet data
          }
        }

        state.liveMarkets = [...state.liveMarkets, ...newMarkets];
        state.marketsLastFetched = fetchedAt;
        state.ui.loading = false;
      })
      .addCase(fetchLiveMarkets.rejected, (state, action) => {
        state.ui.loading = false;
        state.ui.error = action.payload || 'Failed to fetch markets';
      });

    // ── fetchPracticeComps ──
    builder
      .addCase(fetchPracticeComps.pending, (state) => {
        state.ui.loading = true;
        state.ui.error = null;
      })
      .addCase(fetchPracticeComps.fulfilled, (state, action) => {
        state.practiceMode.comps = action.payload.comps;
        state.practiceMode.compsLastFetched = action.payload.fetchedAt;
        state.practiceMode.currentCompIndex = 0;
        state.ui.loading = false;
      })
      .addCase(fetchPracticeComps.rejected, (state, action) => {
        state.ui.loading = false;
        state.ui.error = action.payload || 'Failed to fetch practice comps';
      });

    // ── buyShares ──
    builder
      .addCase(buyShares.fulfilled, (state, action) => {
        const { marketId, bucketId, amount, sharesAcquired, sharePrice, complianceLog, timestamp } = action.payload;

        // Deduct balance
        state.userPortfolio.balance -= amount;
        state.userPortfolio.totalTrades += 1;

        // Update or create position
        const positionKey = `${marketId}_${bucketId}`;
        const existing = state.userPortfolio.activePositions[positionKey];

        if (existing) {
          // Average in: new avg cost = (oldCost * oldShares + newCost * newShares) / totalShares
          const totalShares = existing.shares + sharesAcquired;
          const totalCost = existing.costBasis + amount;
          state.userPortfolio.activePositions[positionKey] = {
            ...existing,
            shares: totalShares,
            costBasis: totalCost,
            avgCost: totalCost / totalShares,
            lastTradeAt: timestamp,
          };
        } else {
          state.userPortfolio.activePositions[positionKey] = {
            marketId,
            bucketId,
            shares: sharesAcquired,
            costBasis: amount,
            avgCost: sharePrice,
            currentValue: amount, // starts at cost
            pnl: 0,
            lastTradeAt: timestamp,
          };
        }

        // Update market bucket volume and shares
        const market = state.liveMarkets.find((m) => m.id === marketId);
        if (market) {
          const bucket = market.buckets.find((b) => b.id === bucketId);
          if (bucket) {
            bucket.volume += amount;
            bucket.totalShares += sharesAcquired;
          }
          market.totalVolume += amount;
          market.totalBettors += existing ? 0 : 1; // only count new bettors

          // Recalculate odds after trade
          market.buckets = recalculateOdds(market.buckets);
        }

        // Log compliance attestation
        if (complianceLog) {
          state.complianceLogs.push(complianceLog);
        }
      })
      .addCase(buyShares.rejected, (state, action) => {
        const payload = action.payload || {};

        // Log blocked attempts too
        if (payload.complianceLog) {
          state.complianceLogs.push(payload.complianceLog);
        }

        state.ui.error = payload.message || 'Trade failed';
      });

    // ── sellShares ──
    builder
      .addCase(sellShares.fulfilled, (state, action) => {
        const { marketId, bucketId, sharesToSell, saleProceeds, currentPrice, timestamp } = action.payload;

        const positionKey = `${marketId}_${bucketId}`;
        const position = state.userPortfolio.activePositions[positionKey];

        // Credit balance
        state.userPortfolio.balance += saleProceeds;
        state.userPortfolio.totalTrades += 1;

        // Update position
        const remainingShares = position.shares - sharesToSell;
        const soldCostBasis = (position.costBasis / position.shares) * sharesToSell;
        const pnlOnSale = saleProceeds - soldCostBasis;

        if (pnlOnSale >= 0) {
          state.userPortfolio.totalEarnings += pnlOnSale;
        } else {
          state.userPortfolio.totalLosses += Math.abs(pnlOnSale);
        }

        if (remainingShares <= 0) {
          // Position fully closed
          delete state.userPortfolio.activePositions[positionKey];
        } else {
          state.userPortfolio.activePositions[positionKey] = {
            ...position,
            shares: remainingShares,
            costBasis: position.costBasis - soldCostBasis,
            lastTradeAt: timestamp,
          };
        }

        // Update market bucket
        const market = state.liveMarkets.find((m) => m.id === marketId);
        if (market) {
          const bucket = market.buckets.find((b) => b.id === bucketId);
          if (bucket) {
            bucket.volume -= saleProceeds;
            bucket.totalShares -= sharesToSell;
          }
          market.totalVolume -= saleProceeds;

          // Recalculate odds
          market.buckets = recalculateOdds(market.buckets);
        }
      })
      .addCase(sellShares.rejected, (state, action) => {
        state.ui.error = action.payload?.message || 'Sell failed';
      });

    // ── resolveMarket ──
    builder
      .addCase(resolveMarket.fulfilled, (state, action) => {
        const { marketId, salePrice, winningBucketId, totalMarketVolume, payoutPerShare, closedAt } = action.payload;

        // Update market
        const market = state.liveMarkets.find((m) => m.id === marketId);
        if (market) {
          market.status = MARKET_STATUS.CLOSED;
          market.salePrice = salePrice;
          market.winningBucketId = winningBucketId;
          market.closedAt = closedAt;
        }

        // Process all active positions for this market
        const positionKeys = Object.keys(state.userPortfolio.activePositions).filter(
          (key) => key.startsWith(`${marketId}_`)
        );

        for (const key of positionKeys) {
          const position = state.userPortfolio.activePositions[key];
          const won = position.bucketId === winningBucketId;
          const payout = won ? position.shares * payoutPerShare : 0;
          const pnl = payout - position.costBasis;

          // Move to closed positions
          state.userPortfolio.closedPositions.push({
            ...position,
            payout,
            pnl,
            won,
            salePrice,
            closedAt,
          });

          // Credit payout
          if (won) {
            state.userPortfolio.balance += payout;
            state.userPortfolio.totalEarnings += pnl > 0 ? pnl : 0;
          } else {
            state.userPortfolio.totalLosses += position.costBasis;
          }

          // Remove active position
          delete state.userPortfolio.activePositions[key];
        }

        // Add notification
        if (positionKeys.length > 0) {
          const won = state.userPortfolio.closedPositions.some(
            (p) => p.marketId === marketId && p.won
          );
          state.notifications.unshift({
            id: `notif_resolve_${marketId}_${Date.now()}`,
            type: won ? 'market_won' : 'market_lost',
            message: won
              ? `You won! ${market?.address || 'Property'} sold for $${salePrice.toLocaleString()}.`
              : `Market closed. ${market?.address || 'Property'} sold for $${salePrice.toLocaleString()}.`,
            marketId,
            salePrice,
            timestamp: closedAt,
            read: false,
          });
        }
      })
      .addCase(resolveMarket.rejected, (state, action) => {
        state.ui.error = action.payload?.message || 'Failed to resolve market';
      });

    // ── checkMarketUpdates ──
    builder
      .addCase(checkMarketUpdates.fulfilled, (state, action) => {
        const { updates } = action.payload;
        for (const update of updates) {
          if (update.newStatus) {
            const market = state.liveMarkets.find((m) => m.id === update.marketId);
            if (market) market.status = update.newStatus;
          }
        }
      });

    // ── checkBlacklistViolations ──
    builder
      .addCase(checkBlacklistViolations.fulfilled, (state, action) => {
        if (action.payload.isViolation) {
          state.userProfile.isBlacklisted = true;
          state.userProfile.blacklistReason = `RETR cross-reference: user closed deal on property ${action.payload.propertyId}`;
          state.userProfile.blacklistDate = new Date().toISOString();
        }
      });
  },
});


// ─────────────────────────────────────────────
// ACTIONS EXPORT
// ─────────────────────────────────────────────

export const {
  completeOnboarding,
  blacklistUser,
  updateMarketStatus,
  updateOdds,
  submitPracticePrediction,
  earnPracticeCapital,
  addNotification,
  markNotificationRead,
  clearNotifications,
  setActiveTab,
  setFilters,
  clearFilters,
  setSortBy,
  setSortDirection,
  selectMarket,
  closeTradingPanel,
  openComplianceModal,
  closeComplianceModal,
  clearError,
  resetPortfolio,
} = marketsSlice.actions;


// ─────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────

// Base selectors
const selectMarketsState = (state) => state.markets;
const selectLiveMarkets = (state) => state.markets.liveMarkets;
const selectUserPortfolio = (state) => state.markets.userPortfolio;
const selectPracticeMode = (state) => state.markets.practiceMode;
const selectUI = (state) => state.markets.ui;
const selectUserProfile = (state) => state.markets.userProfile;

/**
 * Select filtered and sorted markets for display.
 */
export const selectFilteredMarkets = createSelector(
  [selectLiveMarkets, selectUI],
  (markets, ui) => {
    let filtered = [...markets];

    // Apply filters
    const { zip, city, neighborhood, minPrice, maxPrice } = ui.filters;
    if (zip) filtered = filtered.filter((m) => m.zip === zip);
    if (city) filtered = filtered.filter((m) => m.city?.toLowerCase().includes(city.toLowerCase()));
    if (neighborhood) {
      filtered = filtered.filter((m) =>
        m.neighborhood?.toLowerCase().includes(neighborhood.toLowerCase())
      );
    }
    if (minPrice) filtered = filtered.filter((m) => m.listPrice >= minPrice);
    if (maxPrice) filtered = filtered.filter((m) => m.listPrice <= maxPrice);

    // Apply sort
    const direction = ui.sortDirection === 'desc' ? -1 : 1;
    switch (ui.sortBy) {
      case 'volume':
        filtered.sort((a, b) => (b.totalVolume - a.totalVolume) * direction);
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) * direction);
        break;
      case 'closing_soon':
        filtered.sort((a, b) => (a.daysOnMarket - b.daysOnMarket) * direction);
        break;
      case 'most_bettors':
        filtered.sort((a, b) => (b.totalBettors - a.totalBettors) * direction);
        break;
      default:
        filtered.sort((a, b) => (b.totalVolume - a.totalVolume) * direction);
    }

    return filtered;
  }
);

/**
 * Select the currently active/selected market for the trading panel.
 */
export const selectActiveMarket = createSelector(
  [selectLiveMarkets, selectUI],
  (markets, ui) => markets.find((m) => m.id === ui.selectedMarketId) || null
);

/**
 * Select all user positions for a specific market.
 */
export const selectPositionsForMarket = createSelector(
  [selectUserPortfolio, (_, marketId) => marketId],
  (portfolio, marketId) => {
    return Object.entries(portfolio.activePositions)
      .filter(([key]) => key.startsWith(`${marketId}_`))
      .map(([key, position]) => ({ key, ...position }));
  }
);

/**
 * Calculate current value and P&L for all active positions.
 * Position value = shares * current bucket odds
 */
export const selectPortfolioWithPnL = createSelector(
  [selectUserPortfolio, selectLiveMarkets],
  (portfolio, markets) => {
    const positions = {};
    let totalCurrentValue = 0;
    let totalUnrealizedPnL = 0;

    for (const [key, position] of Object.entries(portfolio.activePositions)) {
      const market = markets.find((m) => m.id === position.marketId);
      const bucket = market?.buckets.find((b) => b.id === position.bucketId);
      const currentPrice = bucket?.odds || 0;
      const currentValue = position.shares * currentPrice;
      const pnl = currentValue - position.costBasis;

      positions[key] = {
        ...position,
        currentValue,
        pnl,
        currentPrice,
        marketAddress: market?.address,
        marketStatus: market?.status,
        bucketLabel: bucket?.label,
      };

      totalCurrentValue += currentValue;
      totalUnrealizedPnL += pnl;
    }

    return {
      positions,
      totalCurrentValue,
      totalUnrealizedPnL,
      balance: portfolio.balance,
      totalAccountValue: portfolio.balance + totalCurrentValue,
      totalEarnings: portfolio.totalEarnings,
      totalLosses: portfolio.totalLosses,
      totalTrades: portfolio.totalTrades,
      closedPositions: portfolio.closedPositions,
    };
  }
);

/**
 * Get the current practice comp for the user.
 */
export const selectCurrentPracticeComp = createSelector(
  [selectPracticeMode],
  (practice) => {
    if (practice.comps.length === 0) return null;
    return practice.comps[practice.currentCompIndex] || null;
  }
);

/**
 * Get practice mode stats.
 */
export const selectPracticeStats = createSelector(
  [selectPracticeMode],
  (practice) => {
    const total = practice.predictions.length;
    const correct = practice.predictions.filter((p) => p.correct).length;
    const close = practice.predictions.filter((p) => p.close && !p.correct).length;
    const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : 0;

    return {
      totalPredictions: total,
      correctPredictions: correct,
      closePredictions: close,
      accuracy: Number(accuracy),
      practiceEarnings: practice.practiceEarnings,
      currentStreak: practice.practiceStreak,
      bestStreak: practice.bestStreak,
      compsRemaining: practice.comps.length - practice.currentCompIndex,
    };
  }
);

/**
 * Get unread notification count.
 */
export const selectUnreadNotificationCount = createSelector(
  [(state) => state.markets.notifications],
  (notifications) => notifications.filter((n) => !n.read).length
);

/**
 * Check if markets cache is stale.
 */
export const selectIsCacheStale = createSelector(
  [selectMarketsState],
  (marketsState) => {
    if (!marketsState.marketsLastFetched) return true;
    const elapsed = Date.now() - new Date(marketsState.marketsLastFetched).getTime();
    return elapsed > marketsState.marketsCacheExpiry;
  }
);

/**
 * Select compliance status summary.
 */
export const selectComplianceStatus = createSelector(
  [selectUserProfile, (state) => state.markets.complianceLogs],
  (profile, logs) => ({
    onboardingComplete: profile.onboardingComplete,
    role: profile.roleLabel,
    isInsiderRole: profile.isInsiderRole,
    hasInsiderAccess: profile.hasInsiderAccess,
    isBlacklisted: profile.isBlacklisted,
    blacklistReason: profile.blacklistReason,
    totalAttestations: logs.filter((l) => l.type === ATTESTATION_TYPE.PROPERTY_BET).length,
    blockedAttempts: logs.filter((l) => l.type === ATTESTATION_TYPE.PROPERTY_BET_BLOCKED).length,
  })
);

// Named selector exports for convenience
export {
  selectMarketsState,
  selectLiveMarkets,
  selectUserPortfolio,
  selectPracticeMode,
  selectUI,
  selectUserProfile,
};


// ─────────────────────────────────────────────
// DEFAULT EXPORT
// ─────────────────────────────────────────────

export default marketsSlice.reducer;
