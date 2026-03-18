/**
 * Markets.jsx — PricePoint Prediction Markets Tab
 *
 * Polymarket-style prediction trading hub for Bay Area real estate.
 * Shows live markets on active MLS listings, practice mode with closed comps,
 * portfolio view with P&L, and leaderboard.
 *
 * @author Christo Granger / Claude — March 2026
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Icon from './Icon';
import {
  fetchLiveMarkets,
  fetchPracticeComps,
  buyShares,
  sellShares,
  completeOnboarding,
  submitPracticePrediction,
  selectMarket,
  closeTradingPanel,
  setActiveTab,
  setFilters,
  clearFilters,
  setSortBy,
  openComplianceModal,
  closeComplianceModal,
  clearError,
  markNotificationRead,
  checkMarketUpdates,
  selectFilteredMarkets,
  selectActiveMarket,
  selectPositionsForMarket,
  selectPortfolioWithPnL,
  selectCurrentPracticeComp,
  selectPracticeStats,
  selectUnreadNotificationCount,
  selectIsCacheStale,
  selectComplianceStatus,
  MARKET_STATUS,
  USER_ROLES,
  MIN_BET,
  MAX_BET,
} from './store/marketsSlice';


// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const fmt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '$0';
  return '$' + Math.round(n).toLocaleString();
};

const fmtK = (n) => {
  if (!n) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
};

const pct = (n) => `${(n * 100).toFixed(1)}%`;


// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export default function Markets({ T, isDesktop, FONT, onBackToBlueprint, appMode, setAppMode }) {
  const dispatch = useDispatch();

  // ── Selectors ──
  const filteredMarkets = useSelector(selectFilteredMarkets);
  const activeMarket = useSelector(selectActiveMarket);
  const portfolio = useSelector(selectPortfolioWithPnL);
  const currentComp = useSelector(selectCurrentPracticeComp);
  const practiceStats = useSelector(selectPracticeStats);
  const unreadCount = useSelector(selectUnreadNotificationCount);
  const isCacheStale = useSelector(selectIsCacheStale);
  const compliance = useSelector(selectComplianceStatus);
  const ui = useSelector((state) => state.markets.ui);
  const practiceMode = useSelector((state) => state.markets.practiceMode);

  // ── Local state ──
  const [tradeAmount, setTradeAmount] = useState('');
  const [selectedBucket, setSelectedBucket] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(!compliance.onboardingComplete);
  const [onboardingRole, setOnboardingRole] = useState(null);
  const [onboardingInsider, setOnboardingInsider] = useState(null);
  const [propertyAttestOpen, setPropertyAttestOpen] = useState(false);
  const [attestMarketId, setAttestMarketId] = useState(null);
  const [attestBucketId, setAttestBucketId] = useState(null);
  const [attestAmount, setAttestAmount] = useState(0);
  const [tradeError, setTradeError] = useState(null);
  const [tradeSuccess, setTradeSuccess] = useState(null);
  const [sellMode, setSellMode] = useState(false);
  const [sellShares_, setSellShares_] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const searchInputRef = useRef(null);
  const notifRef = useRef(null);
  const notifications = useSelector((state) => state.markets.notifications);

  // ── Fetch data on mount ──
  useEffect(() => {
    if (isCacheStale && ui.activeTab === 'live') {
      dispatch(fetchLiveMarkets(ui.filters));
    }
  }, []);

  useEffect(() => {
    if (ui.activeTab === 'practice' && practiceMode.comps.length === 0) {
      dispatch(fetchPracticeComps({ zip: ui.filters.zip || '94122' }));
    }
  }, [ui.activeTab]);

  // ── Poll for market updates every 5 minutes ──
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch(checkMarketUpdates());
    }, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [dispatch]);

  // ── Close notification dropdown on outside click ──
  useEffect(() => {
    if (!notifOpen) return;
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notifOpen]);

  // ── Clear trade messages after 3s ──
  useEffect(() => {
    if (tradeSuccess) {
      const t = setTimeout(() => setTradeSuccess(null), 3000);
      return () => clearTimeout(t);
    }
  }, [tradeSuccess]);

  // ── Handlers ──
  const handleSearch = useCallback(() => {
    dispatch(fetchLiveMarkets(ui.filters));
  }, [dispatch, ui.filters]);

  const handleCompleteOnboarding = useCallback(() => {
    if (!onboardingRole || onboardingInsider === null) return;
    dispatch(completeOnboarding({
      userId: `user_${Date.now()}`, // TODO: use real auth user ID
      roleId: onboardingRole,
      hasInsiderAccess: onboardingInsider,
    }));
    setShowOnboarding(false);
  }, [dispatch, onboardingRole, onboardingInsider]);

  const handleBuyAttempt = useCallback((marketId, bucketId, amount) => {
    setTradeError(null);
    // Open per-property attestation modal
    setAttestMarketId(marketId);
    setAttestBucketId(bucketId);
    setAttestAmount(amount);
    setPropertyAttestOpen(true);
  }, []);

  const handleBuyConfirm = useCallback(async (hasInsiderInfo) => {
    setPropertyAttestOpen(false);
    const result = await dispatch(buyShares({
      marketId: attestMarketId,
      bucketId: attestBucketId,
      amount: attestAmount,
      propertyAttestation: { hasInsiderInfo },
    }));

    if (buyShares.fulfilled.match(result)) {
      setTradeSuccess(`Bought ${result.payload.sharesAcquired.toFixed(1)} shares for ${fmt(attestAmount)}`);
      setTradeAmount('');
      setSelectedBucket(null);
    } else {
      setTradeError(result.payload?.message || 'Trade failed');
    }
  }, [dispatch, attestMarketId, attestBucketId, attestAmount]);

  const handleSell = useCallback(async (marketId, bucketId, shares) => {
    setTradeError(null);
    const result = await dispatch(sellShares({ marketId, bucketId, sharesToSell: shares }));
    if (sellShares.fulfilled.match(result)) {
      setTradeSuccess(`Sold ${shares.toFixed(1)} shares for ${fmt(result.payload.saleProceeds)}`);
      setSellMode(false);
      setSellShares_('');
    } else {
      setTradeError(result.payload?.message || 'Sell failed');
    }
  }, [dispatch]);

  const handlePracticePick = useCallback((compId, bucketId) => {
    dispatch(submitPracticePrediction({ compId, selectedBucketId: bucketId }));
  }, [dispatch]);


  // ─────────────────────────────────────────
  // STYLES
  // ─────────────────────────────────────────

  const card = {
    background: T.card,
    borderRadius: 16,
    border: `1px solid ${T.cardBorder}`,
    padding: isDesktop ? 24 : 16,
    marginBottom: 12,
  };

  const pillBtn = (active, color) => ({
    padding: '6px 14px',
    borderRadius: 9999,
    border: active ? 'none' : `1px solid ${T.cardBorder}`,
    background: active ? (color || T.blue) : 'transparent',
    color: active ? '#fff' : T.textSecondary,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

  const inputStyle = {
    background: T.inputBg || T.card,
    border: `1px solid ${T.cardBorder}`,
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 14,
    color: T.text,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: "'Inter', sans-serif",
  };

  const monoStyle = {
    fontFamily: FONT,
    letterSpacing: '-0.02em',
  };


  // ─────────────────────────────────────────
  // RENDER: ONBOARDING MODAL
  // ─────────────────────────────────────────

  if (showOnboarding) {
    return (
      <div style={{ padding: isDesktop ? 40 : 20, maxWidth: 500, margin: '0 auto' }}>
        <div style={card}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Icon name="target" size={32} style={{ color: T.blue }} />
            <h2 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: '12px 0 4px', letterSpacing: '-0.03em' }}>
              Welcome to Markets
            </h2>
            <p style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.5 }}>
              Before you start trading, we need to know a bit about your role.
              This helps us maintain fair and transparent markets.
            </p>
          </div>

          {/* Role Selection */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '2px', color: T.textTertiary, marginBottom: 10 }}>
              Your Role
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {USER_ROLES.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setOnboardingRole(role.id)}
                  style={{
                    ...pillBtn(onboardingRole === role.id, role.insiderRisk ? '#F59E0B' : '#6366F1'),
                    fontSize: 13,
                    padding: '8px 16px',
                  }}
                >
                  {role.label}
                  {role.insiderRisk && onboardingRole === role.id && (
                    <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.8 }}>Insider</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Insider Access Question */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '2px', color: T.textTertiary, marginBottom: 10 }}>
              Non-Public Information Access
            </div>
            <p style={{ fontSize: 13, color: T.textSecondary, marginBottom: 12, lineHeight: 1.5 }}>
              Do you have access to non-public information about real estate transactions or property valuations?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setOnboardingInsider(true)} style={pillBtn(onboardingInsider === true, '#F59E0B')}>
                Yes
              </button>
              <button onClick={() => setOnboardingInsider(false)} style={pillBtn(onboardingInsider === false, '#10B981')}>
                No
              </button>
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{ background: `${T.blue}10`, borderRadius: 12, padding: 14, marginBottom: 20 }}>
            <p style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6, margin: 0 }}>
              By continuing, you agree to our prediction market terms. Trading while in possession of
              material non-public information about a specific property is prohibited and will result in
              account restriction. All attestations are logged for compliance purposes.
            </p>
          </div>

          {/* Submit */}
          <button
            onClick={handleCompleteOnboarding}
            disabled={!onboardingRole || onboardingInsider === null}
            style={{
              width: '100%',
              padding: '14px 24px',
              borderRadius: 9999,
              border: 'none',
              background: (!onboardingRole || onboardingInsider === null) ? T.cardBorder : 'linear-gradient(135deg, #6366F1, #3B82F6)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: (!onboardingRole || onboardingInsider === null) ? 'not-allowed' : 'pointer',
              opacity: (!onboardingRole || onboardingInsider === null) ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
          >
            Start Trading
          </button>
        </div>
      </div>
    );
  }


  // ─────────────────────────────────────────
  // RENDER: PER-PROPERTY ATTESTATION MODAL
  // ─────────────────────────────────────────

  const AttestationModal = () => {
    if (!propertyAttestOpen) return null;
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <div style={{ ...card, maxWidth: 420, margin: 0, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Icon name="alert-triangle" size={28} style={{ color: '#F59E0B' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: '10px 0 4px' }}>
              Compliance Check
            </h3>
            <p style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5 }}>
              Do you have non-public information about this specific property?
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              onClick={() => handleBuyConfirm(true)}
              style={{
                flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${T.cardBorder}`,
                background: 'transparent', color: '#EF4444', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Yes — I have insider info
            </button>
            <button
              onClick={() => handleBuyConfirm(false)}
              style={{
                flex: 1, padding: '12px', borderRadius: 9999, border: 'none',
                background: 'linear-gradient(135deg, #6366F1, #3B82F6)', color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              No — Proceed
            </button>
          </div>
          <button
            onClick={() => setPropertyAttestOpen(false)}
            style={{
              width: '100%', padding: 10, marginTop: 10, border: 'none', background: 'transparent',
              color: T.textTertiary, fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };


  // ─────────────────────────────────────────
  // RENDER: SUB-TAB NAV
  // ─────────────────────────────────────────

  const tabs = [
    { id: 'live', label: 'Live Markets', icon: 'trending-up' },
    { id: 'practice', label: 'Practice', icon: 'target' },
    { id: 'portfolio', label: 'Portfolio', icon: 'banknote' },
  ];


  // ─────────────────────────────────────────
  // RENDER: MARKET CARD
  // ─────────────────────────────────────────

  const MarketCard = ({ market }) => {
    const positions = useSelector((state) => selectPositionsForMarket(state, market.id));
    const hasPosition = positions.length > 0;
    const totalVolume = market.buckets.reduce((s, b) => s + b.volume, 0);

    return (
      <div
        style={{ ...card, cursor: 'pointer', transition: 'all 0.15s' }}
        onClick={() => dispatch(selectMarket(market.id))}
      >
        <div style={{ display: 'flex', gap: 14 }}>
          {/* Photo */}
          {market.photo && (
            <div style={{
              width: 80, height: 80, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
              background: T.cardBorder,
            }}>
              <img
                src={market.photo}
                alt={market.address}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                loading="lazy"
              />
            </div>
          )}

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>
                  {market.address}
                </div>
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
                  {market.city}, {market.state} {market.zip}
                  {market.neighborhood && ` · ${market.neighborhood}`}
                </div>
              </div>

              {/* Status badge */}
              <div style={{
                padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '1px',
                background: market.status === MARKET_STATUS.OPEN ? '#10B98118' :
                            market.status === MARKET_STATUS.PENDING ? '#F59E0B18' : '#EF444418',
                color: market.status === MARKET_STATUS.OPEN ? '#10B981' :
                       market.status === MARKET_STATUS.PENDING ? '#F59E0B' : '#EF4444',
              }}>
                {market.status}
              </div>
            </div>

            {/* Property details */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: T.textSecondary }}>
              {market.beds && <span>{market.beds} bed</span>}
              {market.baths && <span>{market.baths} bath</span>}
              {market.sqft && <span>{market.sqft.toLocaleString()} sqft</span>}
              <span style={{ ...monoStyle, color: T.text, fontWeight: 600 }}>{fmtK(market.listPrice)}</span>
            </div>

            {/* Bucket odds preview */}
            <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
              {market.buckets.map((bucket) => (
                <div key={bucket.id} style={{
                  flex: bucket.odds, height: 6, borderRadius: 3,
                  background: bucket.id === 0 ? '#6366F1' : bucket.id === 1 ? '#3B82F6' : bucket.id === 2 ? '#06B6D4' : '#10B981',
                  opacity: 0.7, minWidth: 4,
                  transition: 'flex 0.3s ease',
                }} />
              ))}
            </div>

            {/* Volume and position indicator */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <div style={{ fontSize: 11, color: T.textTertiary, ...monoStyle }}>
                {fmt(totalVolume)} volume · {market.totalBettors} trader{market.totalBettors !== 1 ? 's' : ''}
              </div>
              {hasPosition && (
                <div style={{
                  fontSize: 10, fontWeight: 700, fontFamily: FONT, textTransform: 'uppercase',
                  letterSpacing: '1.5px', color: '#6366F1',
                }}>
                  Active Position
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };


  // ─────────────────────────────────────────
  // RENDER: TRADING PANEL
  // ─────────────────────────────────────────

  const TradingPanel = () => {
    if (!activeMarket) return null;
    const positions = useSelector((state) => selectPositionsForMarket(state, activeMarket.id));

    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 900,
        display: 'flex', alignItems: isDesktop ? 'center' : 'flex-end', justifyContent: 'center',
      }}>
        <div style={{
          background: T.bg || '#050505', borderRadius: isDesktop ? 20 : '20px 20px 0 0',
          width: isDesktop ? 520 : '100%', maxHeight: '90vh', overflow: 'auto',
          border: `1px solid ${T.cardBorder}`,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '20px 20px 12px', borderBottom: `1px solid ${T.cardBorder}`,
          }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>
                {activeMarket.address}
              </div>
              <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
                {activeMarket.city} · {fmtK(activeMarket.listPrice)} list · {activeMarket.beds}bd/{activeMarket.baths}ba
              </div>
            </div>
            <button
              onClick={() => dispatch(closeTradingPanel())}
              style={{
                background: T.pillBg, border: 'none', borderRadius: 10,
                width: 36, height: 36, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name="x" size={16} style={{ color: T.textSecondary }} />
            </button>
          </div>

          <div style={{ padding: 20 }}>
            {/* Price Buckets */}
            <div style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '2px', color: T.textTertiary, marginBottom: 10 }}>
              Pick Your Price Range
            </div>

            {/* Odds Visualization — horizontal bar chart */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, height: 8, borderRadius: 4, overflow: 'hidden' }}>
              {activeMarket.buckets.map((bucket) => {
                const bucketColors = ['#6366F1', '#3B82F6', '#06B6D4', '#10B981'];
                return (
                  <div key={bucket.id} style={{
                    flex: bucket.odds, background: bucketColors[bucket.id],
                    transition: 'flex 0.5s ease', minWidth: 4, borderRadius: 2,
                    opacity: selectedBucket === null || selectedBucket === bucket.id ? 1 : 0.3,
                  }} />
                );
              })}
            </div>

            {activeMarket.buckets.map((bucket) => {
              const isSelected = selectedBucket === bucket.id;
              const bucketColors = ['#6366F1', '#3B82F6', '#06B6D4', '#10B981'];
              const color = bucketColors[bucket.id];
              const position = positions.find((p) => p.bucketId === bucket.id);
              // Share price = odds. If you buy at 0.25 odds and win, payout is $1/share
              const impliedPayout = bucket.odds > 0 ? (1 / bucket.odds).toFixed(2) : '0';

              return (
                <div
                  key={bucket.id}
                  onClick={() => { setSelectedBucket(bucket.id); setSellMode(false); }}
                  style={{
                    ...card,
                    padding: '14px 16px',
                    marginBottom: 8,
                    cursor: 'pointer',
                    border: isSelected ? `2px solid ${color}` : `1px solid ${T.cardBorder}`,
                    background: isSelected ? `${color}08` : T.card,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{bucket.label}</div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 11, color: T.textTertiary, ...monoStyle }}>
                        <span>{fmt(bucket.volume)} vol</span>
                        <span>·</span>
                        <span>{impliedPayout}x payout</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: 22, fontWeight: 800, color, fontFamily: FONT,
                        letterSpacing: '-0.03em',
                      }}>
                        {pct(bucket.odds)}
                      </div>
                      <div style={{ fontSize: 10, color: T.textTertiary, fontFamily: FONT, marginTop: 1 }}>
                        ${bucket.odds.toFixed(2)}/share
                      </div>
                    </div>
                  </div>

                  {/* Odds bar within bucket */}
                  <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: `${color}15`, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2, background: color,
                      width: `${(bucket.odds * 100).toFixed(1)}%`,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>

                  {/* Existing position */}
                  {position && (
                    <div style={{
                      marginTop: 8, padding: '8px 12px', borderRadius: 10,
                      background: `${color}10`, fontSize: 12, color: T.textSecondary,
                      display: 'flex', justifyContent: 'space-between',
                    }}>
                      <span>{position.shares.toFixed(1)} shares @ ${position.avgCost?.toFixed(2) || '0.25'}</span>
                      <span style={{ color: position.pnl >= 0 ? '#10B981' : '#EF4444', fontWeight: 600, fontFamily: FONT }}>
                        {position.pnl >= 0 ? '+' : ''}{fmt(position.pnl)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Trade Input */}
            {selectedBucket !== null && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button onClick={() => setSellMode(false)} style={pillBtn(!sellMode, '#6366F1')}>Buy</button>
                  {positions.find((p) => p.bucketId === selectedBucket) && (
                    <button onClick={() => setSellMode(true)} style={pillBtn(sellMode, '#EF4444')}>Sell</button>
                  )}
                </div>

                {!sellMode ? (
                  <>
                    <input
                      type="number"
                      value={tradeAmount}
                      onChange={(e) => setTradeAmount(e.target.value)}
                      placeholder={`Amount ($${MIN_BET} – $${MAX_BET})`}
                      style={inputStyle}
                    />
                    {/* Quick amount buttons */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      {[50, 100, 250, 500].map((amt) => (
                        <button key={amt} onClick={() => setTradeAmount(String(amt))} style={{
                          ...pillBtn(Number(tradeAmount) === amt),
                          flex: 1, textAlign: 'center',
                        }}>
                          ${amt}
                        </button>
                      ))}
                    </div>
                    {/* Estimated payout preview */}
                    {Number(tradeAmount) >= MIN_BET && (() => {
                      const bucket = activeMarket.buckets.find((b) => b.id === selectedBucket);
                      if (!bucket) return null;
                      const shares = Number(tradeAmount) / bucket.odds;
                      const totalMarketVol = activeMarket.buckets.reduce((s, b) => s + b.volume, 0) + Number(tradeAmount);
                      const estPayout = (shares / (bucket.totalShares + shares)) * totalMarketVol;
                      const estProfit = estPayout - Number(tradeAmount);
                      return (
                        <div style={{
                          marginTop: 10, padding: '10px 14px', borderRadius: 10,
                          background: `${T.blue}08`, border: `1px solid ${T.cardBorder}`,
                          display: 'flex', justifyContent: 'space-between', fontSize: 12,
                        }}>
                          <div>
                            <div style={{ color: T.textTertiary, ...monoStyle, fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px' }}>If you win</div>
                            <div style={{ color: '#10B981', fontWeight: 700, fontFamily: FONT, fontSize: 16, marginTop: 2 }}>
                              +{fmt(estProfit)} profit
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: T.textTertiary, ...monoStyle, fontSize: 10 }}>{shares.toFixed(1)} shares</div>
                            <div style={{ color: T.text, fontWeight: 600, fontFamily: FONT, fontSize: 14, marginTop: 2 }}>
                              {fmt(estPayout)} payout
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    <button
                      onClick={() => {
                        const amt = Number(tradeAmount);
                        if (amt >= MIN_BET && amt <= MAX_BET) {
                          handleBuyAttempt(activeMarket.id, selectedBucket, amt);
                        } else {
                          setTradeError(`Enter an amount between $${MIN_BET} and $${MAX_BET}`);
                        }
                      }}
                      disabled={!tradeAmount || Number(tradeAmount) < MIN_BET}
                      style={{
                        width: '100%', padding: '14px', borderRadius: 9999, border: 'none',
                        marginTop: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                        background: Number(tradeAmount) >= MIN_BET
                          ? 'linear-gradient(135deg, #6366F1, #3B82F6)'
                          : T.cardBorder,
                        color: '#fff',
                        opacity: Number(tradeAmount) >= MIN_BET ? 1 : 0.5,
                        boxShadow: Number(tradeAmount) >= MIN_BET ? '0 0 20px rgba(99,102,241,0.3)' : 'none',
                        transition: 'all 0.2s',
                      }}
                    >
                      Buy {tradeAmount ? fmt(Number(tradeAmount)) : ''} in {activeMarket.buckets.find((b) => b.id === selectedBucket)?.label}
                    </button>
                  </>
                ) : (
                  <>
                    {(() => {
                      const pos = positions.find((p) => p.bucketId === selectedBucket);
                      if (!pos) return null;
                      return (
                        <>
                          <input
                            type="number"
                            value={sellShares_}
                            onChange={(e) => setSellShares_(e.target.value)}
                            placeholder={`Shares to sell (max ${pos.shares.toFixed(1)})`}
                            style={inputStyle}
                          />
                          <button
                            onClick={() => {
                              const shares = Number(sellShares_);
                              if (shares > 0 && shares <= pos.shares) {
                                handleSell(activeMarket.id, selectedBucket, shares);
                              }
                            }}
                            style={{
                              width: '100%', padding: '14px', borderRadius: 9999, border: 'none',
                              marginTop: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                              background: '#EF4444', color: '#fff',
                            }}
                          >
                            Sell Shares
                          </button>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {/* Trade feedback */}
            {tradeError && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: '#EF444418', color: '#EF4444', fontSize: 13, fontWeight: 500 }}>
                {tradeError}
              </div>
            )}
            {tradeSuccess && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: '#10B98118', color: '#10B981', fontSize: 13, fontWeight: 500 }}>
                {tradeSuccess}
              </div>
            )}

            {/* Balance */}
            <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: `${T.blue}08`, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontFamily: FONT, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px', color: T.textTertiary }}>
                Available Balance
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT, color: T.text, letterSpacing: '-0.03em', marginTop: 4 }}>
                {fmt(portfolio.balance)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  // ─────────────────────────────────────────
  // RENDER: PRACTICE MODE
  // ─────────────────────────────────────────

  const PracticeView = () => {
    const [practiceZip, setPracticeZip] = useState(ui.filters.zip || '94122');
    const [revealAnim, setRevealAnim] = useState(false);

    const handleLoadComps = () => {
      dispatch(fetchPracticeComps({ zip: practiceZip }));
    };

    // Trigger reveal animation when result shows
    const lastPrediction = practiceMode.predictions[practiceMode.predictions.length - 1];
    const showResult = currentComp && lastPrediction && lastPrediction.compId === currentComp?.id;

    React.useEffect(() => {
      if (showResult) {
        setRevealAnim(false);
        requestAnimationFrame(() => setRevealAnim(true));
      }
    }, [showResult, lastPrediction?.compId]);

    return (
      <div>
        {/* Practice ZIP search */}
        <div style={{ ...card, padding: '12px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={practiceZip}
              onChange={(e) => setPracticeZip(e.target.value)}
              placeholder="ZIP code for practice comps"
              style={{ ...inputStyle, flex: 1 }}
              onKeyDown={(e) => e.key === 'Enter' && handleLoadComps()}
            />
            <button onClick={handleLoadComps} style={{
              padding: '10px 20px', borderRadius: 9999, border: 'none',
              background: 'linear-gradient(135deg, #6366F1, #3B82F6)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Load
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {['94122', '94110', '94102', '94610', '94501'].map((z) => (
              <button key={z} onClick={() => { setPracticeZip(z); dispatch(fetchPracticeComps({ zip: z })); }} style={{
                ...pillBtn(practiceZip === z), flex: 1, textAlign: 'center', fontSize: 11,
              }}>
                {z}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Streak', value: practiceStats.currentStreak, color: practiceStats.currentStreak > 0 ? '#F59E0B' : T.text },
            { label: 'Accuracy', value: `${practiceStats.accuracy}%`, color: practiceStats.accuracy >= 50 ? '#10B981' : T.text },
            { label: 'Earned', value: fmt(practiceStats.practiceEarnings), color: '#6366F1' },
            { label: 'Remaining', value: practiceStats.compsRemaining, color: T.text },
          ].map((stat) => (
            <div key={stat.label} style={{
              flex: 1, minWidth: 70, ...card, padding: '12px 10px', textAlign: 'center', marginBottom: 0,
            }}>
              <div style={{ fontSize: 10, color: T.textTertiary, fontFamily: FONT, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: stat.color, fontFamily: FONT, marginTop: 4 }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {!currentComp && (
          <div style={{ ...card, textAlign: 'center', padding: 40 }}>
            <Icon name="target" size={28} style={{ color: T.textTertiary }} />
            <p style={{ color: T.textSecondary, marginTop: 12, fontSize: 14 }}>
              {ui.loading ? 'Loading practice comps...' : 'No practice comps available. Try a different ZIP code above.'}
            </p>
          </div>
        )}

        {/* Comp Card */}
        {currentComp && (
          <div style={card}>
            {currentComp.photo && (
              <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 14, height: isDesktop ? 240 : 200, position: 'relative' }}>
                <img src={currentComp.photo} alt={currentComp.address} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                {/* Comp counter badge */}
                <div style={{
                  position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(8px)', borderRadius: 8, padding: '4px 10px',
                  fontSize: 11, fontWeight: 600, fontFamily: FONT, color: '#fff',
                }}>
                  {practiceMode.currentCompIndex + 1} / {practiceMode.comps.length}
                </div>
                {/* Sold date badge */}
                {currentComp.soldDate && (
                  <div style={{
                    position: 'absolute', top: 12, left: 12, background: 'rgba(232,200,77,0.9)',
                    backdropFilter: 'blur(6px)', borderRadius: 8, padding: '4px 10px',
                    fontSize: 10, fontWeight: 800, color: '#1a1a2e', letterSpacing: 1, textTransform: 'uppercase',
                  }}>
                    Sold {new Date(currentComp.soldDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
            )}

            <div style={{ fontSize: 17, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>
              {currentComp.address}
            </div>
            <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 4 }}>
              {currentComp.city}, {currentComp.state} {currentComp.zip}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 13, color: T.textSecondary }}>
              {currentComp.beds && <span>{currentComp.beds} bed</span>}
              {currentComp.baths && <span>{currentComp.baths} bath</span>}
              {currentComp.sqft && <span>{currentComp.sqft.toLocaleString()} sqft</span>}
              {currentComp.pricePerSqft && <span style={monoStyle}>${currentComp.pricePerSqft}/sqft</span>}
            </div>
            <div style={{ fontSize: 13, color: T.text, marginTop: 6, fontWeight: 600, ...monoStyle }}>
              Listed at {fmtK(currentComp.listPrice)}
            </div>

            {/* Pick a bucket */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '2px', color: T.textTertiary, marginBottom: 10 }}>
                {showResult ? 'Result' : 'What did this sell for?'}
              </div>
              {currentComp.buckets.map((bucket) => {
                const bucketColors = ['#6366F1', '#3B82F6', '#06B6D4', '#10B981'];
                const color = bucketColors[bucket.id];
                const isWinner = showResult && lastPrediction.actualBucket === bucket.id;
                const wasPick = showResult && lastPrediction.selectedBucket === bucket.id;
                const correctPick = isWinner && wasPick;

                return (
                  <button
                    key={bucket.id}
                    onClick={() => !showResult && handlePracticePick(currentComp.id, bucket.id)}
                    disabled={showResult}
                    style={{
                      display: 'block', width: '100%', padding: '14px 16px', marginBottom: 8,
                      borderRadius: 12, textAlign: 'left', cursor: showResult ? 'default' : 'pointer',
                      border: isWinner ? `2px solid ${color}` : wasPick && !isWinner ? '2px solid #EF4444' : `1px solid ${T.cardBorder}`,
                      background: isWinner ? `${color}12` : wasPick && !isWinner ? '#EF444412' : T.card,
                      transition: 'all 0.3s ease',
                      transform: showResult && revealAnim && isWinner ? 'scale(1.02)' : 'scale(1)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{bucket.label}</span>
                      {isWinner && (
                        <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: FONT }}>
                          {correctPick ? 'Correct' : ''} {fmtK(currentComp.soldPrice)}
                        </span>
                      )}
                      {wasPick && !isWinner && <span style={{ fontSize: 12, fontWeight: 700, color: '#EF4444' }}>Your pick</span>}
                    </div>
                  </button>
                );
              })}

              {/* Result feedback */}
              {showResult && (
                <>
                  <div style={{
                    marginTop: 12, padding: '16px', borderRadius: 12, textAlign: 'center',
                    background: lastPrediction.correct ? '#10B98118' : lastPrediction.close ? '#F59E0B18' : '#EF444418',
                    transition: 'all 0.3s ease',
                    transform: revealAnim ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.95)',
                    opacity: revealAnim ? 1 : 0,
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: lastPrediction.correct ? '#10B981' : lastPrediction.close ? '#F59E0B' : '#EF4444' }}>
                      {lastPrediction.correct ? 'Nailed It!' : lastPrediction.close ? 'Close!' : 'Not Quite'}
                    </div>
                    <div style={{ fontSize: 14, color: T.textSecondary, marginTop: 4 }}>
                      Sold for <span style={{ fontWeight: 700, color: T.text, fontFamily: FONT }}>{fmtK(lastPrediction.soldPrice)}</span>
                      {lastPrediction.reward > 0 && (
                        <span style={{ fontWeight: 700, color: '#10B981' }}> — +{fmt(lastPrediction.reward)} earned</span>
                      )}
                    </div>
                    {lastPrediction.correct && practiceStats.currentStreak > 1 && (
                      <div style={{ fontSize: 12, color: '#F59E0B', fontWeight: 600, marginTop: 6, fontFamily: FONT }}>
                        {practiceStats.currentStreak} streak!
                      </div>
                    )}
                  </div>

                  {/* Next Property button */}
                  {practiceStats.compsRemaining > 0 ? (
                    <button
                      onClick={() => {
                        setRevealAnim(false);
                        // The slice auto-advances currentCompIndex on prediction
                        // Force re-fetch if we need more comps
                        if (practiceMode.currentCompIndex >= practiceMode.comps.length - 1) {
                          dispatch(fetchPracticeComps({ zip: practiceZip }));
                        }
                      }}
                      style={{
                        width: '100%', padding: '14px', borderRadius: 9999, border: 'none',
                        marginTop: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                        background: 'linear-gradient(135deg, #6366F1, #3B82F6)', color: '#fff',
                        boxShadow: '0 0 20px rgba(99,102,241,0.3)',
                        transition: 'all 0.2s',
                      }}
                    >
                      Next Property →
                    </button>
                  ) : (
                    <div style={{ marginTop: 12, textAlign: 'center' }}>
                      <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 8 }}>
                        No more comps in this area.
                      </div>
                      <button
                        onClick={handleLoadComps}
                        style={{
                          padding: '12px 24px', borderRadius: 9999, border: `1px solid ${T.cardBorder}`,
                          background: 'transparent', color: T.text, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Load More Comps
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };


  // ─────────────────────────────────────────
  // RENDER: PORTFOLIO VIEW
  // ─────────────────────────────────────────

  const PortfolioView = () => (
    <div>
      {/* Account summary */}
      <div style={{ ...card, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontFamily: FONT, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px', color: T.textTertiary }}>
          Total Account Value
        </div>
        <div style={{ fontSize: 36, fontWeight: 900, fontFamily: FONT, color: T.text, letterSpacing: '-0.04em', marginTop: 6 }}>
          {fmt(portfolio.totalAccountValue)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '1px' }}>Cash</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: FONT }}>{fmt(portfolio.balance)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '1px' }}>Invested</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: FONT }}>{fmt(portfolio.totalCurrentValue)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '1px' }}>P&L</div>
            <div style={{
              fontSize: 16, fontWeight: 700, fontFamily: FONT,
              color: portfolio.totalUnrealizedPnL >= 0 ? '#10B981' : '#EF4444',
            }}>
              {portfolio.totalUnrealizedPnL >= 0 ? '+' : ''}{fmt(portfolio.totalUnrealizedPnL)}
            </div>
          </div>
        </div>
      </div>

      {/* Active Positions */}
      <div style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '2px', color: T.textTertiary, marginBottom: 10, marginTop: 8 }}>
        Active Positions ({Object.keys(portfolio.positions).length})
      </div>

      {Object.keys(portfolio.positions).length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 30 }}>
          <p style={{ color: T.textSecondary, fontSize: 14 }}>
            No active positions yet. Browse the Live Markets tab to start trading.
          </p>
        </div>
      ) : (
        Object.entries(portfolio.positions).map(([key, pos]) => (
          <div key={key} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{pos.marketAddress || 'Property'}</div>
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{pos.bucketLabel}</div>
              </div>
              <div style={{
                padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, fontFamily: FONT,
                background: pos.marketStatus === MARKET_STATUS.OPEN ? '#10B98118' : '#F59E0B18',
                color: pos.marketStatus === MARKET_STATUS.OPEN ? '#10B981' : '#F59E0B',
                textTransform: 'uppercase', letterSpacing: '1px',
              }}>
                {pos.marketStatus}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: T.textTertiary }}>Shares</div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: FONT, color: T.text }}>{pos.shares.toFixed(1)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.textTertiary }}>Cost</div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: FONT, color: T.text }}>{fmt(pos.costBasis)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.textTertiary }}>Value</div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: FONT, color: T.text }}>{fmt(pos.currentValue)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.textTertiary }}>P&L</div>
                <div style={{
                  fontSize: 14, fontWeight: 700, fontFamily: FONT,
                  color: pos.pnl >= 0 ? '#10B981' : '#EF4444',
                }}>
                  {pos.pnl >= 0 ? '+' : ''}{fmt(pos.pnl)}
                </div>
              </div>
            </div>
          </div>
        ))
      )}

      {/* Closed Positions */}
      {portfolio.closedPositions.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '2px', color: T.textTertiary, marginBottom: 10, marginTop: 20 }}>
            Closed Positions ({portfolio.closedPositions.length})
          </div>
          {portfolio.closedPositions.slice(0, 10).map((pos, i) => (
            <div key={i} style={{ ...card, opacity: 0.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{pos.marketAddress || 'Closed Market'}</div>
                  <div style={{ fontSize: 12, color: T.textSecondary }}>{pos.bucketLabel} · {pos.shares.toFixed(1)} shares</div>
                </div>
                <div style={{
                  fontSize: 15, fontWeight: 700, fontFamily: FONT,
                  color: pos.won ? '#10B981' : '#EF4444',
                }}>
                  {pos.won ? '+' : ''}{fmt(pos.pnl)}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );


  // ─────────────────────────────────────────
  // RENDER: MAIN
  // ─────────────────────────────────────────

  return (
    <div style={{ padding: isDesktop ? '20px 40px' : '0 16px 80px', maxWidth: 700, margin: '0 auto', marginLeft: isDesktop && setAppMode ? 220 : 'auto' }}>
      {/* Desktop Sidebar */}
      {isDesktop && setAppMode && (
        <div style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 220, background: T.bg2 || T.card, borderRight: `1px solid ${T.cardBorder}`, padding: "16px 0", display: "flex", flexDirection: "column", zIndex: 10 }}>
          <div style={{ padding: "8px 16px 16px", borderBottom: `1px solid ${T.cardBorder}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <svg viewBox="0 0 100 100" fill="none" style={{width:28,height:28,borderRadius:6,overflow:"hidden",flexShrink:0}}>
                <defs><linearGradient id="mk-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6366F1"/><stop offset="100%" stopColor="#3B82F6"/></linearGradient></defs>
                <rect width="100" height="100" fill="url(#mk-bg)"/>
                <polygon points="50,12 8,30 50,25 92,30" fill="rgba(255,255,255,0.95)"/>
                <polygon points="50,25 92,30 92,34 50,29" fill="rgba(255,255,255,0.48)"/>
                <polygon points="50,25 8,30 8,34 50,29" fill="rgba(255,255,255,0.68)"/>
                <polygon points="8,38 50,33 92,38 50,43" fill="rgba(255,255,255,0.90)"/>
                <polygon points="8,38 50,43 50,46 8,41" fill="rgba(255,255,255,0.58)"/>
                <polygon points="50,43 92,38 92,41 50,46" fill="rgba(255,255,255,0.40)"/>
                <polygon points="8,52 50,47 92,52 50,57" fill="rgba(255,255,255,0.70)"/>
                <polygon points="8,52 50,57 50,60 8,55" fill="rgba(255,255,255,0.45)"/>
                <polygon points="50,57 92,52 92,55 50,60" fill="rgba(255,255,255,0.28)"/>
                <polygon points="8,66 50,61 92,66 50,71" fill="rgba(255,255,255,0.50)"/>
                <polygon points="8,66 50,71 50,74 8,69" fill="rgba(255,255,255,0.32)"/>
                <polygon points="50,71 92,66 92,69 50,74" fill="rgba(255,255,255,0.18)"/>
                <polygon points="8,80 50,75 92,80 50,85" fill="rgba(255,255,255,0.34)"/>
                <polygon points="8,80 50,85 50,88 8,83" fill="rgba(255,255,255,0.20)"/>
                <polygon points="50,85 92,80 92,83 50,88" fill="rgba(255,255,255,0.10)"/>
              </svg>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1 }}><span style={{ color: T.text }}>Real</span><span style={{ color: "#6366F1" }}>Stack</span></div>
              </div>
            </div>
            {/* Mode Toggle */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {[["blueprint","settings","Blueprint"],["pricepoint","target","PricePoint"],["markets","trending-up","Markets"]].map(([k,ico,l]) => (
                <button key={k} onClick={() => setAppMode(k)} style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderRadius: 8,
                  border: "none", fontSize: 13, fontWeight: k === appMode ? 700 : 500, fontFamily: FONT,
                  background: k === appMode ? (k === "pricepoint" ? "rgba(56,189,126,0.12)" : k === "markets" ? "rgba(99,102,241,0.12)" : `${T.blue}15`) : "transparent",
                  color: k === appMode ? (k === "pricepoint" ? "#38bd7e" : k === "markets" ? "#6366F1" : T.blue) : T.textTertiary,
                  cursor: "pointer", transition: "all 0.2s", textAlign: "left",
                }}><Icon name={ico} size={16} /> {l}</button>
              ))}
            </div>
          </div>
          {/* Markets Nav */}
          <nav style={{ padding: "10px 6px", flex: 1 }}>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => dispatch(setActiveTab(t.id))} style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 10px", borderRadius: 8,
                border: "none", fontSize: 13, fontWeight: ui.activeTab === t.id ? 600 : 400, fontFamily: FONT,
                background: ui.activeTab === t.id ? `${T.text}08` : "transparent",
                color: ui.activeTab === t.id ? T.text : T.textTertiary,
                cursor: "pointer", transition: "all 0.15s", textAlign: "left",
              }}><Icon name={t.icon} size={16} /> {t.label}</button>
            ))}
          </nav>
          {/* Balance */}
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.cardBorder}` }}>
            <div style={{ fontSize: 11, color: T.textTertiary, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>Balance</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: "'JetBrains Mono', monospace" }}>${portfolio.balance?.toLocaleString() || '10,000'}</div>
          </div>
        </div>
      )}

      <AttestationModal />
      {ui.tradingPanelOpen && <TradingPanel />}

      {/* Header */}
      <div style={{ padding: '20px 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: '-0.03em' }}>
            Markets
          </div>
          <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>
            Prediction trading on Bay Area real estate
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Notification Bell */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              style={{
                background: T.pillBg, border: 'none', borderRadius: 10,
                width: 38, height: 38, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', position: 'relative',
              }}
            >
              <Icon name="bell" size={18} style={{ color: T.textSecondary }} />
              {unreadCount > 0 && (
                <div style={{
                  position: 'absolute', top: -2, right: -2,
                  width: 18, height: 18, borderRadius: 9,
                  background: '#EF4444', color: '#fff',
                  fontSize: 10, fontWeight: 700, fontFamily: FONT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </div>
              )}
            </button>

            {/* Notification Dropdown */}
            {notifOpen && (
              <div style={{
                position: 'absolute', top: 44, right: 0, width: 320,
                background: T.card, border: `1px solid ${T.cardBorder}`,
                borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
                zIndex: 100, overflow: 'hidden', maxHeight: 400, overflowY: 'auto',
              }}>
                <div style={{
                  padding: '14px 16px', borderBottom: `1px solid ${T.cardBorder}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Notifications</div>
                  {unreadCount > 0 && (
                    <div style={{ fontSize: 11, fontFamily: FONT, fontWeight: 600, color: '#6366F1' }}>
                      {unreadCount} new
                    </div>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: T.textTertiary, fontSize: 13 }}>
                    No notifications yet. You'll be notified when markets you've bet on close.
                  </div>
                ) : (
                  notifications.slice(0, 20).map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (!notif.read) dispatch(markNotificationRead(notif.id));
                        if (notif.marketId) dispatch(selectMarket(notif.marketId));
                        setNotifOpen(false);
                      }}
                      style={{
                        padding: '12px 16px', borderBottom: `1px solid ${T.cardBorder}`,
                        cursor: 'pointer', transition: 'background 0.15s',
                        background: notif.read ? 'transparent' : `${T.blue}06`,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 14, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: notif.type === 'market_won' ? '#10B98118' : notif.type === 'market_lost' ? '#EF444418' : `${T.blue}12`,
                        }}>
                          <Icon
                            name={notif.type === 'market_won' ? 'trending-up' : notif.type === 'market_lost' ? 'trending-down' : 'info'}
                            size={14}
                            style={{ color: notif.type === 'market_won' ? '#10B981' : notif.type === 'market_lost' ? '#EF4444' : T.blue }}
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: T.text, fontWeight: notif.read ? 400 : 600, lineHeight: 1.4 }}>
                            {notif.message}
                          </div>
                          <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 3, fontFamily: FONT }}>
                            {new Date(notif.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </div>
                        </div>
                        {!notif.read && (
                          <div style={{ width: 8, height: 8, borderRadius: 4, background: '#6366F1', flexShrink: 0, marginTop: 6 }} />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Balance */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontFamily: FONT, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: T.textTertiary }}>
              Balance
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FONT, color: T.text, letterSpacing: '-0.03em' }}>
              {fmt(portfolio.balance)}
            </div>
          </div>
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div style={{ display: 'flex', gap: 4, background: T.pillBg, borderRadius: 14, padding: 3, marginBottom: 16 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => dispatch(setActiveTab(t.id))}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 12, border: 'none',
              fontSize: 13, fontWeight: ui.activeTab === t.id ? 700 : 500,
              background: ui.activeTab === t.id ? T.card : 'transparent',
              color: ui.activeTab === t.id ? T.text : T.textTertiary,
              cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: ui.activeTab === t.id ? `0 1px 4px rgba(0,0,0,0.1)` : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── LIVE MARKETS TAB ── */}
      {ui.activeTab === 'live' && (
        <div>
          {/* Search / Filters */}
          <div style={{ ...card, padding: '14px 16px' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={searchInputRef}
                type="text"
                value={ui.filters.zip}
                onChange={(e) => dispatch(setFilters({ zip: e.target.value }))}
                placeholder="ZIP code (e.g. 94122)"
                style={{ ...inputStyle, flex: 1 }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={handleSearch}
                style={{
                  padding: '10px 20px', borderRadius: 9999, border: 'none',
                  background: 'linear-gradient(135deg, #6366F1, #3B82F6)', color: '#fff',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 0 16px rgba(99,102,241,0.25)',
                }}
              >
                Search
              </button>
            </div>

            {/* Additional filters */}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={ui.filters.city}
                onChange={(e) => dispatch(setFilters({ city: e.target.value }))}
                placeholder="City"
                style={{ ...inputStyle, flex: 1, minWidth: 100, padding: '8px 12px', fontSize: 12 }}
              />
              <input
                type="number"
                value={ui.filters.minPrice || ''}
                onChange={(e) => dispatch(setFilters({ minPrice: e.target.value ? Number(e.target.value) : null }))}
                placeholder="Min price"
                style={{ ...inputStyle, flex: 1, minWidth: 80, padding: '8px 12px', fontSize: 12 }}
              />
              <input
                type="number"
                value={ui.filters.maxPrice || ''}
                onChange={(e) => dispatch(setFilters({ maxPrice: e.target.value ? Number(e.target.value) : null }))}
                placeholder="Max price"
                style={{ ...inputStyle, flex: 1, minWidth: 80, padding: '8px 12px', fontSize: 12 }}
              />
            </div>

            {/* Sort */}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Sort:</span>
              {[
                { id: 'volume', label: 'Volume' },
                { id: 'newest', label: 'Newest' },
                { id: 'most_bettors', label: 'Popular' },
              ].map((s) => (
                <button key={s.id} onClick={() => dispatch(setSortBy(s.id))} style={pillBtn(ui.sortBy === s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Loading */}
          {ui.loading && (
            <div style={{ textAlign: 'center', padding: 30, color: T.textSecondary }}>
              Loading markets...
            </div>
          )}

          {/* Error */}
          {ui.error && (
            <div style={{
              ...card, background: '#EF444412', border: '1px solid #EF444430',
              color: '#EF4444', fontSize: 13, textAlign: 'center',
            }}>
              {ui.error}
              <button onClick={() => dispatch(clearError())} style={{ marginLeft: 10, border: 'none', background: 'transparent', color: '#EF4444', textDecoration: 'underline', cursor: 'pointer' }}>
                Dismiss
              </button>
            </div>
          )}

          {/* Market list */}
          {!ui.loading && filteredMarkets.length === 0 && (
            <div style={{ ...card, textAlign: 'center', padding: 40 }}>
              <Icon name="trending-up" size={28} style={{ color: T.textTertiary }} />
              <p style={{ color: T.textSecondary, marginTop: 12, fontSize: 14 }}>
                No live markets found. Search a Bay Area ZIP code to get started.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                {['94122', '94110', '94102', '94610'].map((zip) => (
                  <button key={zip} onClick={() => { dispatch(setFilters({ zip })); dispatch(fetchLiveMarkets({ zip })); }} style={pillBtn(false)}>
                    {zip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredMarkets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      )}

      {/* ── PRACTICE TAB ── */}
      {ui.activeTab === 'practice' && <PracticeView />}

      {/* ── PORTFOLIO TAB ── */}
      {ui.activeTab === 'portfolio' && <PortfolioView />}
    </div>
  );
}
