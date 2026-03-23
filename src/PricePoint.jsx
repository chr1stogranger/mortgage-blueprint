import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Icon from './Icon';

// ═══════════════════════════════════════════════════════════════
// PRICEPOINT — Daily Real Estate Price Challenge
// "How well do you know your market?"
// ═══════════════════════════════════════════════════════════════
// 1 sold property/day, same for everyone in a market.
// List price shown — you predict the sold price.
// Address hidden until after guess.
// Spoiler-free sharing. Emotional feedback (never "wrong").
// ═══════════════════════════════════════════════════════════════

const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

// ── Feedback Messages — Emotional Design ──
const FEEDBACK = {
  bullseye: {
    messages: [
      "Nailed it. You know this market cold.",
      "That's scary accurate. You've got the eye.",
      "Bullseye. This is your neighborhood.",
    ],
    colorKey: "green",
    label: "BULLSEYE",
  },
  strong: {
    messages: [
      "Really strong read. You're dialed in.",
      "Sharp instincts. You clearly know the area.",
      "Impressive. Most people aren't this close.",
    ],
    colorKey: "green",
    label: "SHARP",
  },
  solid: {
    messages: [
      "Solid instincts. You're in the ballpark.",
      "Good read on this one. You're close.",
      "Not bad at all — you've got a feel for it.",
    ],
    colorKey: "cyan",
    label: "SOLID",
  },
  tricky: {
    messages: [
      "This one was tricky — you're not alone.",
      "Tough call. The market moved unexpectedly here.",
      "This one fooled a lot of people.",
    ],
    colorKey: "orange",
    label: "TRICKY",
  },
  surprise: {
    messages: [
      "This one surprised almost everyone.",
      "The market had other plans on this one.",
      "Wild card property — hard to predict.",
    ],
    colorKey: "orange",
    label: "SURPRISE",
  },
};

const getFeedback = (pctOff) => {
  if (pctOff <= 2) return FEEDBACK.bullseye;
  if (pctOff <= 5) return FEEDBACK.strong;
  if (pctOff <= 10) return FEEDBACK.solid;
  if (pctOff <= 20) return FEEDBACK.tricky;
  return FEEDBACK.surprise;
};

const getRandomMessage = (feedback) =>
  feedback.messages[Math.floor(Math.random() * feedback.messages.length)];

// ── Insight generator — turns a miss into a learning moment ──
const getInsight = (listing, pctOff, guessedHigher) => {
  if (pctOff <= 10) return null;
  const overUnder = listing.soldPrice > listing.listPrice ? "over" : "under";
  const listVsSold = Math.abs(((listing.soldPrice - listing.listPrice) / listing.listPrice) * 100).toFixed(0);

  if (listing.soldPrice > listing.listPrice && !guessedHigher) {
    return `This home went ${listVsSold}% over asking — competitive market in ${listing.neighborhood}.`;
  }
  if (listing.soldPrice < listing.listPrice && guessedHigher) {
    return `This one sold ${listVsSold}% under list — sat on the market ${listing.daysOnMarket} days.`;
  }
  if (listing.daysOnMarket > 30) {
    return `${listing.daysOnMarket} days on market tends to mean price reductions. Good to know for next time.`;
  }
  if (listing.daysOnMarket <= 7) {
    return `Only ${listing.daysOnMarket} days on market — fast sales often signal competitive offers above asking.`;
  }
  return `${listing.neighborhood} is shifting — this ${overUnder}-asking result is worth noting.`;
};

// ── Level System ──
const LEVELS = [
  { level: 1, name: "Studio Condo", icon: "landmark", req: 0 },
  { level: 2, name: "1BR Condo", icon: "landmark", req: 50 },
  { level: 3, name: "2BR Condo", icon: "landmark", req: 150 },
  { level: 4, name: "Townhouse", icon: "grid", req: 300 },
  { level: 5, name: "Starter Home", icon: "home", req: 500 },
  { level: 6, name: "3BR House", icon: "home", req: 800 },
  { level: 7, name: "4BR House", icon: "home", req: 1200 },
  { level: 8, name: "Craftsman", icon: "home", req: 1700 },
  { level: 9, name: "Victorian", icon: "home", req: 2400 },
  { level: 10, name: "Modern Farmhouse", icon: "trending-up", req: 3200 },
  { level: 11, name: "Luxury Home", icon: "diamond", req: 4200 },
  { level: 12, name: "Estate", icon: "crown", req: 5500 },
  { level: 13, name: "Mega Mansion", icon: "crown", req: 7000 },
];

const calcXP = (results) => {
  let xp = 0;
  results.forEach(r => {
    if (!r.revealed) return;
    xp += 10;
    const pct = Math.abs((r.guess - r.soldPrice) / r.soldPrice) * 100;
    if (pct <= 1) xp += 50;
    else if (pct <= 2) xp += 40;
    else if (pct <= 5) xp += 25;
    else if (pct <= 10) xp += 15;
  });
  return xp;
};

const getLevel = (xp) => [...LEVELS].reverse().find(l => xp >= l.req) || LEVELS[0];

// ── Daily Challenge Seed ──
const getDailyNumber = () => {
  const now = new Date();
  const start = new Date("2026-01-01");
  return Math.floor((now - start) / (1000 * 60 * 60 * 24));
};

const hashDayAndMarket = (dayNum, market) => {
  let hash = dayNum;
  if (market) {
    for (let i = 0; i < market.length; i++) {
      hash = ((hash << 5) - hash) + market.charCodeAt(i);
      hash = hash & hash;
    }
  }
  return hash;
};

const getDailyProperty = (soldListings, market) => {
  if (!soldListings || soldListings.length === 0) return null;
  const dayNum = getDailyNumber();
  const hash = hashDayAndMarket(dayNum, market);
  const idx = Math.abs(hash) % soldListings.length;
  return { ...soldListings[idx], dailyNumber: dayNum };
};

// ── Get indices of next N daily properties (for exclusion from Free Play) ──
const getDailyIndices = (soldListings, market, days) => {
  if (!soldListings || soldListings.length === 0) return new Set();
  const today = getDailyNumber();
  const indices = new Set();
  for (let d = 0; d <= days; d++) {
    const hash = hashDayAndMarket(today + d, market);
    indices.add(Math.abs(hash) % soldListings.length);
  }
  return indices;
};

// ── Helpers ──
const fmt = (n) => n?.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) ?? "—";

// ── Sample Sold Listings (fallback) ──
const SAMPLE_SOLD = [
  { id:"pps1",zpid:"15201001",address:"1456 25th Ave",city:"San Francisco",state:"CA",zip:"94122",beds:3,baths:2,sqft:1450,lotSqft:2500,yearBuilt:1941,propertyType:"Single Family",listPrice:1295000,zestimate:1380000,soldPrice:1350000,soldDate:"2025-12-15",daysOnMarket:18,status:"sold",photo:"https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",neighborhood:"Central Sunset",pricePerSqft:931 },
  { id:"pps2",zpid:"15302112",address:"2280 42nd Ave",city:"San Francisco",state:"CA",zip:"94116",beds:2,baths:1,sqft:1100,lotSqft:2500,yearBuilt:1938,propertyType:"Single Family",listPrice:998000,zestimate:1050000,soldPrice:1075000,soldDate:"2025-11-22",daysOnMarket:14,status:"sold",photo:"https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800&q=80",neighborhood:"Parkside",pricePerSqft:977 },
  { id:"pps3",zpid:"15403223",address:"1738 16th Ave",city:"San Francisco",state:"CA",zip:"94122",beds:4,baths:2,sqft:1900,lotSqft:2500,yearBuilt:1947,propertyType:"Single Family",listPrice:1695000,zestimate:1750000,soldPrice:1810000,soldDate:"2026-01-08",daysOnMarket:9,status:"sold",photo:"https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=800&q=80",neighborhood:"Inner Sunset",pricePerSqft:953 },
  { id:"pps4",zpid:"15504334",address:"3642 Noriega St",city:"San Francisco",state:"CA",zip:"94122",beds:3,baths:1,sqft:1320,lotSqft:2500,yearBuilt:1951,propertyType:"Single Family",listPrice:1175000,zestimate:1220000,soldPrice:1195000,soldDate:"2025-10-30",daysOnMarket:22,status:"sold",photo:"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",neighborhood:"Outer Sunset",pricePerSqft:905 },
  { id:"pps5",zpid:"15605445",address:"1891 31st Ave",city:"San Francisco",state:"CA",zip:"94122",beds:3,baths:2,sqft:1580,lotSqft:2500,yearBuilt:1944,propertyType:"Single Family",listPrice:1425000,zestimate:1490000,soldPrice:1520000,soldDate:"2025-12-04",daysOnMarket:11,status:"sold",photo:"https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80",neighborhood:"Outer Sunset",pricePerSqft:962 },
  { id:"pps6",zpid:"15706556",address:"755 Kirkham St",city:"San Francisco",state:"CA",zip:"94122",beds:2,baths:2,sqft:1250,lotSqft:0,yearBuilt:1962,propertyType:"Condo",listPrice:849000,zestimate:880000,soldPrice:865000,soldDate:"2026-01-18",daysOnMarket:31,status:"sold",photo:"https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80",neighborhood:"Inner Sunset",pricePerSqft:692 },
  { id:"pps7",zpid:"15807667",address:"2415 47th Ave",city:"San Francisco",state:"CA",zip:"94116",beds:3,baths:1,sqft:1280,lotSqft:2500,yearBuilt:1940,propertyType:"Single Family",listPrice:1095000,zestimate:1140000,soldPrice:1160000,soldDate:"2025-11-11",daysOnMarket:16,status:"sold",photo:"https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80",neighborhood:"Parkside",pricePerSqft:906 },
  { id:"pps8",zpid:"15908778",address:"1347 10th Ave",city:"San Francisco",state:"CA",zip:"94122",beds:4,baths:3,sqft:2400,lotSqft:2800,yearBuilt:1950,propertyType:"Single Family",listPrice:1850000,zestimate:1920000,soldPrice:1975000,soldDate:"2026-01-25",daysOnMarket:8,status:"sold",photo:"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",neighborhood:"Inner Sunset",pricePerSqft:823 },
  { id:"pps9",zpid:"16009889",address:"1633 38th Ave",city:"San Francisco",state:"CA",zip:"94122",beds:2,baths:1,sqft:1050,lotSqft:2500,yearBuilt:1936,propertyType:"Single Family",listPrice:949000,zestimate:990000,soldPrice:1010000,soldDate:"2025-09-28",daysOnMarket:19,status:"sold",photo:"https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80",neighborhood:"Outer Sunset",pricePerSqft:962 },
  { id:"pps10",zpid:"16110990",address:"1982 22nd Ave",city:"San Francisco",state:"CA",zip:"94122",beds:3,baths:2,sqft:1700,lotSqft:2500,yearBuilt:1946,propertyType:"Single Family",listPrice:1495000,zestimate:1560000,soldPrice:1545000,soldDate:"2025-10-14",daysOnMarket:13,status:"sold",photo:"https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",neighborhood:"Central Sunset",pricePerSqft:909 },
];

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function PricePoint({ T, isDesktop, FONT, onRunNumbers, onBackToBlueprint, onOpenMarkets, realtorPartner, appMode, setAppMode }) {

  // ── Game State ──
  const [view, setView] = useState("daily");
  const [market, setMarket] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pp-market")) || null; } catch { return null; }
  });
  const [marketInput, setMarketInput] = useState("");
  const [guessInput, setGuessInput] = useState("");
  const [dailyResult, setDailyResult] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("pp-daily-result"));
      if (stored && stored.dailyNumber === getDailyNumber()) return stored;
      return null;
    } catch { return null; }
  });
  const [allResults, setAllResults] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pp-all-results")) || []; } catch { return []; }
  });
  const [soldListings, setSoldListings] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("pp-sold-listings"));
      return stored && stored.length > 0 ? stored : SAMPLE_SOLD;
    } catch { return SAMPLE_SOLD; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [revealPhase, setRevealPhase] = useState(0);
  const [shareToast, setShareToast] = useState(false);
  const [locationLabel, setLocationLabel] = useState(() => {
    try { return localStorage.getItem("pp-location-label") || ""; } catch { return ""; }
  });

  // ── Free Play State ──
  const [fpListings, setFpListings] = useState([]);
  const [fpIdx, setFpIdx] = useState(0);
  const [fpGuessInput, setFpGuessInput] = useState("");
  const [fpResult, setFpResult] = useState(null);

  // ── Countdown ──
  const [countdown, setCountdown] = useState("");

  // ── Refs ──
  const revealCounterRef = useRef(null);

  // ── Derived ──
  const dailyNumber = getDailyNumber();
  const dailyProperty = useMemo(() => getDailyProperty(soldListings, market?.label || ""), [soldListings, market]);
  const xp = useMemo(() => calcXP(allResults), [allResults]);
  const currentLevel = useMemo(() => getLevel(xp), [xp]);
  const nextLevel = useMemo(() => LEVELS.find(l => l.req > xp), [xp]);

  // ── Streak (consecutive days played) ──
  const streak = useMemo(() => {
    if (allResults.length === 0) return 0;
    const dailyNums = [...new Set(allResults.filter(r => r.dailyNumber != null).map(r => r.dailyNumber))].sort((a, b) => b - a);
    if (dailyNums.length === 0) return 0;
    let s = 0;
    const today = getDailyNumber();
    for (let i = 0; i < dailyNums.length; i++) {
      if (dailyNums[i] === today - i) s++;
      else break;
    }
    return s;
  }, [allResults]);

  const avgAccuracy = useMemo(() => {
    const revealed = allResults.filter(r => r.revealed && r.soldPrice);
    if (revealed.length === 0) return null;
    return revealed.reduce((sum, r) => sum + Math.abs((r.guess - r.soldPrice) / r.soldPrice) * 100, 0) / revealed.length;
  }, [allResults]);

  // ── Persistence ──
  useEffect(() => { try { if (market) localStorage.setItem("pp-market", JSON.stringify(market)); if (locationLabel) localStorage.setItem("pp-location-label", locationLabel); } catch {} }, [market, locationLabel]);
  useEffect(() => { try { localStorage.setItem("pp-all-results", JSON.stringify(allResults)); } catch {} }, [allResults]);
  useEffect(() => { try { if (dailyResult) localStorage.setItem("pp-daily-result", JSON.stringify(dailyResult)); } catch {} }, [dailyResult]);
  useEffect(() => { try { if (soldListings !== SAMPLE_SOLD) localStorage.setItem("pp-sold-listings", JSON.stringify(soldListings)); } catch {} }, [soldListings]);

  // ── Initialize view ──
  useEffect(() => {
    if (!market) {
      try {
        const oldHometown = JSON.parse(localStorage.getItem("pp-hometown"));
        if (oldHometown) {
          setMarket(oldHometown);
          setLocationLabel(oldHometown.label || oldHometown.zip || oldHometown.city || "");
          if (dailyResult && dailyResult.dailyNumber === dailyNumber) setView("postDaily");
          else setView("daily");
          fetchListings(oldHometown.zip || oldHometown.city);
          return;
        }
      } catch {}
      setView("onboarding");
    } else if (dailyResult && dailyResult.dailyNumber === dailyNumber) {
      setView("postDaily");
    } else {
      setView("daily");
    }
  }, []);

  // ── Countdown timer ──
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const diff = tomorrow - now;
      setCountdown(`${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m ${Math.floor((diff % 60000) / 1000)}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Auto-fetch ──
  useEffect(() => {
    if (market && soldListings === SAMPLE_SOLD) {
      fetchListings(market.zip || market.city || market.label);
    }
  }, [market]);

  // ── Fetch live listings ──
  const fetchListings = useCallback(async (searchValue) => {
    if (!searchValue || searchValue.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const isZip = /^\d{5}$/.test(searchValue.trim());
      const params = isZip ? `zip=${searchValue.trim()}` : `city=${encodeURIComponent(searchValue.trim())}&state=CA`;
      const resp = await fetch(`/api/pricepoint?${params}`);
      if (!resp.ok) throw new Error(`API returned ${resp.status}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      if (data.soldListings && data.soldListings.length > 0) {
        setSoldListings(data.soldListings);
        const label = data.location || searchValue;
        setLocationLabel(label);
        return { success: true, label };
      } else {
        setError("No sold listings found. Using sample data.");
        return { success: false };
      }
    } catch (err) {
      console.error("PricePoint fetch error:", err);
      setError("Could not load live data. Using sample data.");
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Set Market ──
  const handleSetMarket = async () => {
    const val = marketInput.trim();
    if (!val) return;
    const isZip = /^\d{5}$/.test(val);
    const result = await fetchListings(val);
    const label = result?.label || val;
    const mkt = isZip ? { zip: val, label } : { city: val, label };
    setMarket(mkt);
    setLocationLabel(label);
    // Also save as pp-hometown for backward compat
    try { localStorage.setItem("pp-hometown", JSON.stringify(mkt)); } catch {}
    if (dailyResult && dailyResult.dailyNumber === dailyNumber) setView("postDaily");
    else setView("daily");
  };

  // ── Format guess input — store raw digits only, format visually ──
  const handleGuessInput = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setGuessInput(raw);
  };
  const handleFpGuessInput = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setFpGuessInput(raw);
  };
  const fmtGuess = (raw) => raw ? parseInt(raw).toLocaleString("en-US") : "";

  // ── Submit Daily Guess ──
  const handleDailyGuess = () => {
    const val = parseInt(guessInput.replace(/[^0-9]/g, ""));
    if (!val || !dailyProperty) return;
    const pctOff = Math.abs((val - dailyProperty.soldPrice) / dailyProperty.soldPrice) * 100;
    const feedback = getFeedback(pctOff);
    const guessedHigher = val > dailyProperty.soldPrice;
    const insight = getInsight(dailyProperty, pctOff, guessedHigher);
    const result = {
      guess: val, soldPrice: dailyProperty.soldPrice, listPrice: dailyProperty.listPrice,
      address: dailyProperty.address, neighborhood: dailyProperty.neighborhood,
      city: dailyProperty.city, state: dailyProperty.state, zip: dailyProperty.zip,
      beds: dailyProperty.beds, baths: dailyProperty.baths, sqft: dailyProperty.sqft,
      photo: dailyProperty.photo, pctOff: parseFloat(pctOff.toFixed(1)),
      feedback, feedbackMessage: getRandomMessage(feedback), insight,
      dailyNumber, timestamp: Date.now(), revealed: true, isDaily: true,
    };
    setDailyResult(result);
    setAllResults(prev => [...prev, result]);
    startReveal();
  };

  // ── Reveal Animation ──
  const startReveal = () => {
    setView("reveal");
    setRevealPhase(0);
    let count = 0;
    if (revealCounterRef.current) clearInterval(revealCounterRef.current);
    revealCounterRef.current = setInterval(() => {
      count++;
      if (count >= 30) {
        clearInterval(revealCounterRef.current);
        setTimeout(() => setRevealPhase(1), 100);
        setTimeout(() => setRevealPhase(2), 800);
      }
    }, 50);
  };

  // ── Share Result (spoiler-free!) ──
  const shareResult = (result) => {
    const accuracy = (100 - result.pctOff).toFixed(1);
    const bars = result.pctOff <= 2 ? "|||||" : result.pctOff <= 5 ? "||||." : result.pctOff <= 10 ? "|||.." : result.pctOff <= 20 ? "||..." : "|....";
    const text = [
      `PricePoint Daily #${result.dailyNumber} — ${locationLabel || result.city}`,
      `${result.neighborhood} · ${result.beds}BR/${result.baths}BA · ${(result.sqft || 0).toLocaleString()}sf`,
      `[${bars}] ${accuracy}% accuracy`,
      streak > 1 ? `${streak} day streak` : "",
      "",
      "How well do you know your market?",
      "pricepoint.realstack.app",
    ].filter(Boolean).join("\n");
    if (navigator.share) {
      navigator.share({ text }).catch(() => {
        navigator.clipboard.writeText(text);
        setShareToast(true); setTimeout(() => setShareToast(false), 2500);
      });
    } else {
      navigator.clipboard.writeText(text);
      setShareToast(true); setTimeout(() => setShareToast(false), 2500);
    }
  };

  // ── Free Play ──
  const handleFpGuess = () => {
    const val = parseInt(fpGuessInput.replace(/[^0-9]/g, ""));
    const listing = fpListings[fpIdx];
    if (!val || !listing) return;
    const pctOff = Math.abs((val - listing.soldPrice) / listing.soldPrice) * 100;
    const feedback = getFeedback(pctOff);
    const insight = getInsight(listing, pctOff, val > listing.soldPrice);
    setFpResult({
      guess: val, soldPrice: listing.soldPrice, listPrice: listing.listPrice,
      address: listing.address, neighborhood: listing.neighborhood,
      city: listing.city, state: listing.state, beds: listing.beds, baths: listing.baths,
      sqft: listing.sqft, photo: listing.photo, pctOff: parseFloat(pctOff.toFixed(1)),
      feedback, feedbackMessage: getRandomMessage(feedback), insight,
      dailyNumber: null, timestamp: Date.now(), revealed: true, isDaily: false,
    });
    setAllResults(prev => [...prev, { guess: val, soldPrice: listing.soldPrice, pctOff: parseFloat(pctOff.toFixed(1)), revealed: true, isDaily: false, dailyNumber: null, timestamp: Date.now() }]);
  };
  const fpNextProperty = () => { setFpResult(null); setFpGuessInput(""); setFpIdx(prev => prev + 1); };
  const enterFreePlay = () => {
    // Exclude today's daily + next 30 days of dailies from Free Play pool (no spoilers)
    const excludedIndices = getDailyIndices(soldListings, market?.label || "", 30);
    const pool = soldListings.filter((_, i) => !excludedIndices.has(i));
    // If exclusion removed too many (small dataset), fall back to all minus today only
    const safePool = pool.length >= 3 ? pool : soldListings.filter((_, i) => i !== (dailyProperty ? soldListings.indexOf(dailyProperty) : -1));
    setFpListings([...safePool].sort(() => Math.random() - 0.5));
    setFpIdx(0); setFpGuessInput(""); setFpResult(null); setView("freeplay");
  };

  // ── Resolve feedback color from theme ──
  const fbColor = (fb) => T[fb?.colorKey] || T.green;

  // ═══════════════════════════════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════════════════════════════
  const OverlineLabel = ({ children }) => (
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary, marginBottom: 4 }}>{children}</div>
  );

  const StatPill = ({ value, label, color }) => (
    <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: color || T.accent, background: `${color || T.accent}18`, padding: "4px 10px", borderRadius: 8, border: `1px solid ${color || T.accent}30` }}>
      {value}{label ? ` ${label}` : ""}
    </div>
  );

  const PillButton = ({ children, onClick, disabled, accent, secondary, tealAccent, style: s }) => (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", padding: "14px", borderRadius: 9999, fontSize: 15, fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer", fontFamily: FONT, transition: "all 0.2s",
      border: secondary ? `1px solid ${T.cardBorder}` : "none",
      background: disabled ? T.inputBg : tealAccent ? "linear-gradient(135deg, #06B6D4, #3B82F6)" : accent ? "linear-gradient(135deg, #6366F1, #3B82F6)" : secondary ? "transparent" : "linear-gradient(135deg, #6366F1, #3B82F6)",
      color: disabled ? T.textTertiary : secondary ? T.textSecondary : "#fff",
      boxShadow: disabled || secondary ? "none" : accent ? "0 0 20px rgba(99,102,241,0.3)" : tealAccent ? "0 0 20px rgba(6,182,212,0.3)" : "0 0 20px rgba(99,102,241,0.3)",
      ...s,
    }}>{children}</button>
  );

  // ── Property card (shared daily & free play) ──
  const PropertyCard = ({ listing, guess, onGuessChange, onGuess, badge, badgeColor, accentColor }) => {
    const accent = accentColor || T.accent;
    return (
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ position: "relative" }}>
          <img src={listing.photo} alt="" style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }}
            onError={e => { e.target.src = "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80"; }} />
          {badge && (
            <div style={{ position: "absolute", top: 12, left: 12, background: `${badgeColor || accent}E6`, backdropFilter: "blur(8px)", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase" }}>{badge}</div>
          )}
        </div>
        <div style={{ padding: "16px 18px 20px" }}>
          {/* Neighborhood — address hidden! */}
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: "-0.02em", fontFamily: FONT }}>{listing.neighborhood}</div>
          <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT }}>{listing.city}, {listing.state} {listing.zip}</div>
          {/* Specs */}
          <div style={{ display: "flex", gap: 6, margin: "14px 0", flexWrap: "wrap" }}>
            {[[listing.beds, "Beds"], [listing.baths, "Baths"], [(listing.sqft || 0).toLocaleString(), "SqFt"], [listing.yearBuilt, "Built"]].map(([v, l], i) => (
              <div key={i} style={{ background: T.inputBg, borderRadius: 10, padding: "8px 14px", textAlign: "center", flex: 1, minWidth: 60, border: `1px solid ${T.cardBorder}` }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: MONO }}>{v}</div>
                <div style={{ fontSize: 9, color: T.textTertiary, marginTop: 2, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase" }}>{l}</div>
              </div>
            ))}
          </div>
          {/* List Price */}
          <div style={{ background: T.inputBg, borderRadius: 12, padding: "14px 18px", border: `1px solid ${T.cardBorder}`, marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <OverlineLabel>LIST PRICE</OverlineLabel>
              <div style={{ fontSize: 26, fontWeight: 800, color: T.text, fontFamily: MONO, marginTop: 2 }}>{fmt(listing.listPrice)}</div>
            </div>
            {listing.daysOnMarket && (
              <div style={{ textAlign: "right" }}>
                <OverlineLabel>DAYS ON MKT</OverlineLabel>
                <div style={{ fontSize: 22, fontWeight: 700, color: T.textSecondary, fontFamily: MONO, marginTop: 2 }}>{listing.daysOnMarket}</div>
              </div>
            )}
          </div>
          {/* Guess */}
          <div style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, textAlign: "center", marginBottom: 8, fontFamily: FONT }}>What do you think it sold for?</div>
          {guess && <div style={{ textAlign: "center", fontSize: 32, fontWeight: 900, color: T.text, fontFamily: MONO, marginBottom: 8, letterSpacing: "-0.02em" }}>${parseInt(guess).toLocaleString("en-US")}</div>}
          <input value={guess || ""} onChange={onGuessChange} onKeyDown={e => e.key === "Enter" && onGuess()} placeholder="Enter price" inputMode="numeric" autoComplete="off"
            style={{ width: "100%", background: T.inputBg, border: `2px solid ${T.cardBorder}`, borderRadius: 14, padding: "14px 20px", fontSize: 18, fontWeight: 600, color: T.text, textAlign: "center", outline: "none", fontFamily: MONO, boxSizing: "border-box" }}
            onFocus={e => e.target.style.borderColor = accent} onBlur={e => e.target.style.borderColor = T.cardBorder} />
          {/* Live feedback */}
          {guess && (() => {
            const v = parseInt(guess);
            if (!v) return null;
            const d = ((v - listing.listPrice) / listing.listPrice * 100).toFixed(1);
            return <div style={{ textAlign: "center", fontSize: 12, color: T.textSecondary, marginTop: 8, fontFamily: MONO }}>{d > 0 ? "+" : ""}{d}% vs list{listing.sqft ? ` · $${Math.round(v / listing.sqft)}/sf` : ""}</div>;
          })()}
          <div style={{ marginTop: 16 }}>
            <PillButton onClick={onGuess} disabled={!guess} accent={accent === T.accent} tealAccent={accent === T.cyan}>Final Answer</PillButton>
          </div>
        </div>
      </div>
    );
  };

  // ── Reveal card ──
  const RevealCard = ({ result, onShare, onContinue, onRunNumbersClick, showPhases }) => {
    const color = fbColor(result.feedback);
    return (
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 24, padding: "32px 24px", maxWidth: 420, width: "100%", animation: "ppScaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <OverlineLabel>SOLD FOR</OverlineLabel>
          <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-0.03em", fontFamily: MONO, color: showPhases && revealPhase >= 1 ? color : showPhases ? T.textTertiary : color, transition: "color 0.3s", animation: showPhases && revealPhase < 1 ? "ppPulse 0.3s ease infinite" : "none" }}>{fmt(result.soldPrice)}</div>
        </div>
        {(!showPhases || revealPhase >= 1) && (
          <div style={{ animation: "ppSlideUp 0.4s ease" }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 20, background: T.inputBg, borderRadius: 14, padding: "14px 16px", border: `1px solid ${T.cardBorder}` }}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 2, color: T.textTertiary, textTransform: "uppercase" }}>YOUR GUESS</div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: MONO, color: T.text, marginTop: 4 }}>{fmt(result.guess)}</div>
              </div>
              <div style={{ width: 1, background: T.cardBorder }} />
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 2, color: T.textTertiary, textTransform: "uppercase" }}>ACCURACY</div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: MONO, marginTop: 4, color }}>{(100 - result.pctOff).toFixed(1)}%</div>
              </div>
            </div>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 9999, fontSize: 11, fontWeight: 700, fontFamily: MONO, letterSpacing: 2, color, background: `${color}18`, border: `1px solid ${color}30`, marginBottom: 10 }}>{result.feedback.label}</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: T.textSecondary, lineHeight: 1.5, fontFamily: FONT }}>{result.feedbackMessage}</div>
            </div>
            {result.insight && (
              <div style={{ background: T.inputBg, borderRadius: 12, padding: "12px 16px", border: `1px solid ${T.cardBorder}`, marginBottom: 16, borderLeft: `3px solid ${T.blue}` }}>
                <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5, fontFamily: FONT }}>{result.insight}</div>
              </div>
            )}
            <div style={{ textAlign: "center", marginBottom: 20, padding: "10px 0", borderTop: `1px solid ${T.cardBorder}`, borderBottom: `1px solid ${T.cardBorder}` }}>
              <div style={{ fontSize: 10, fontFamily: MONO, letterSpacing: 2, color: T.textTertiary, textTransform: "uppercase", marginBottom: 4 }}>ADDRESS</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: FONT }}>{result.address}</div>
              <div style={{ fontSize: 12, color: T.textSecondary, fontFamily: FONT }}>{result.neighborhood} · {result.city}, {result.state}</div>
            </div>
          </div>
        )}
        {(!showPhases || revealPhase >= 2) && (
          <div style={{ animation: "ppSlideUp 0.3s ease" }}>
            {onShare && <PillButton onClick={() => onShare(result)} accent style={{ marginBottom: 10 }}>Share Your Result</PillButton>}
            {onRunNumbersClick && (
              <button onClick={() => onRunNumbersClick(result)} style={{ width: "100%", padding: 12, borderRadius: 9999, border: `1px solid ${T.blue}40`, background: `${T.blue}12`, color: T.blue, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Icon name="calculator" size={14} /> Run Numbers in Blueprint
              </button>
            )}
            {onContinue && <PillButton onClick={onContinue} secondary>{onShare ? "Continue" : "Next Property"}</PillButton>}
          </div>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{ maxWidth: isDesktop ? 520 : 480, margin: "0 auto", width: "100%", minHeight: "100vh", fontFamily: FONT, color: T.text, boxSizing: "border-box", position: "relative" }}>
      <style>{`
        @keyframes ppFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ppSlideUp { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes ppPulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }
        @keyframes ppScaleIn { from { opacity: 0; transform: scale(0.9) } to { opacity: 1; transform: scale(1) } }
      `}</style>

      {shareToast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 999, padding: "12px 24px", borderRadius: 12, background: T.accent, color: "#fff", fontSize: 14, fontWeight: 600, animation: "ppSlideUp 0.3s ease", boxShadow: "0 8px 32px rgba(99,102,241,0.3)", fontFamily: FONT }}>
          Copied to clipboard
        </div>
      )}

      {/* ═══ ONBOARDING ═══ */}
      {view === "onboarding" && (
        <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100vh", animation: "ppFadeIn 0.5s ease" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.accent, marginBottom: 16 }}>PRICEPOINT</div>
            <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.04em", margin: "0 0 16px", color: T.text, fontFamily: FONT }}>How well do you<br />know your market?</h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: T.textSecondary, margin: 0, fontFamily: FONT }}>One home. One guess. Every day.<br />See the list price, predict the sold price.</p>
          </div>
          <div>
            <OverlineLabel>YOUR MARKET</OverlineLabel>
            <input value={marketInput} onChange={e => setMarketInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSetMarket()} placeholder="ZIP code or city..." autoFocus
              style={{ width: "100%", background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 12, padding: "16px 20px", fontSize: 18, fontWeight: 600, color: T.text, outline: "none", textAlign: "center", fontFamily: FONT, transition: "border-color 0.2s", boxSizing: "border-box" }}
              onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.inputBorder} />
            {error && <div style={{ marginTop: 8, fontSize: 12, color: T.orange, textAlign: "center", fontFamily: FONT }}>{error}</div>}
            <div style={{ marginTop: 16 }}><PillButton onClick={handleSetMarket} disabled={!marketInput.trim() || loading} accent>{loading ? "Finding listings..." : "Start Playing"}</PillButton></div>
            <button onClick={() => { setSoldListings(SAMPLE_SOLD); setMarket({ city: "San Francisco", label: "San Francisco, CA" }); setLocationLabel("San Francisco, CA"); setView(dailyResult && dailyResult.dailyNumber === dailyNumber ? "tomorrow" : "daily"); }}
              style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: T.textTertiary, fontSize: 13, cursor: "pointer", fontFamily: FONT }}>Skip — try with sample data</button>
          </div>
        </div>
      )}

      {/* ═══ DAILY CHALLENGE ═══ */}
      {view === "daily" && dailyProperty && (
        <div style={{ padding: "16px 16px 100px", animation: "ppSlideUp 0.5s ease-out" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.accent }}>DAILY CHALLENGE #{dailyNumber}</div>
              <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT }}>{locationLabel || market?.label || "Your Market"}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {streak > 0 && <StatPill value={`${streak}d`} label="streak" color={T.orange} />}
              <StatPill value={`Lv.${currentLevel.level}`} color={T.accent} />
            </div>
          </div>
          {PropertyCard({ listing: dailyProperty, guess: guessInput, onGuessChange: handleGuessInput, onGuess: handleDailyGuess, badge: "DAILY", badgeColor: T.accent, accentColor: T.accent })}
        </div>
      )}

      {/* ═══ REVEAL ═══ */}
      {view === "reveal" && dailyResult && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(5,5,5,0.95)", backdropFilter: "blur(20px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, animation: "ppFadeIn 0.3s ease", padding: 16 }}>
          {RevealCard({ result: dailyResult, showPhases: true, onShare: shareResult, onContinue: () => setView("postDaily"),
            onRunNumbersClick: onRunNumbers ? (r) => { onRunNumbers({ price: r.soldPrice, state: r.state, city: r.city, zip: r.zip }); } : null })}
        </div>
      )}

      {/* ═══ POST-DAILY — Funnel into Free Play ═══ */}
      {view === "postDaily" && (
        <div style={{ padding: "16px 16px 100px", animation: "ppSlideUp 0.5s ease-out" }}>
          {dailyResult && (
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <OverlineLabel>TODAY'S RESULT</OverlineLabel>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
                <img src={dailyResult.photo} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover" }}
                  onError={e => { e.target.src = "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80"; }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: FONT }}>{dailyResult.neighborhood}</div>
                  <div style={{ fontSize: 12, color: T.textSecondary, fontFamily: FONT }}>{dailyResult.beds}BR/{dailyResult.baths}BA · {(dailyResult.sqft || 0).toLocaleString()}sf</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: MONO, color: fbColor(dailyResult.feedback) }}>{(100 - dailyResult.pctOff).toFixed(1)}%</div>
                  <div style={{ fontSize: 10, fontFamily: MONO, fontWeight: 600, letterSpacing: 1, color: fbColor(dailyResult.feedback) }}>{dailyResult.feedback.label}</div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}><PillButton onClick={() => shareResult(dailyResult)} accent>Share Result</PillButton></div>
            </div>
          )}

          <div style={{ background: `linear-gradient(135deg, ${T.cyan}12, ${T.accent}12)`, border: `1px solid ${T.cyan}30`, borderRadius: 16, padding: "28px 20px", textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.cyan, marginBottom: 10 }}>KEEP GOING?</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text, fontFamily: FONT, lineHeight: 1.3, marginBottom: 6 }}>Your instincts are warmed up</div>
            <div style={{ fontSize: 14, color: T.textSecondary, fontFamily: FONT, lineHeight: 1.5, marginBottom: 20 }}>Jump into Free Play for unlimited rounds.<br />Same market, no spoilers for future dailies.</div>
            <PillButton onClick={enterFreePlay} tealAccent>Start Free Play</PillButton>
          </div>

          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "20px", textAlign: "center", marginBottom: 16 }}>
            <OverlineLabel>NEXT DAILY IN</OverlineLabel>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: MONO, color: T.text, letterSpacing: "-0.02em", marginTop: 4 }}>{countdown}</div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, fontFamily: FONT }}>Come back tomorrow to keep your streak</div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <PillButton onClick={() => setView("tomorrow")} secondary style={{ flex: 1 }}>Stats</PillButton>
            <PillButton onClick={() => setView("leaderboard")} secondary style={{ flex: 1 }}>Leaderboard</PillButton>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {onBackToBlueprint && (
              <button onClick={onBackToBlueprint} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${T.cardBorder}`, background: T.card, fontSize: 12, fontWeight: 600, color: T.textSecondary, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon name="calculator" size={14} /> Blueprint</button>
            )}
            {onOpenMarkets && (
              <button onClick={onOpenMarkets} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${T.cardBorder}`, background: T.card, fontSize: 12, fontWeight: 600, color: T.textSecondary, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon name="trending-up" size={14} /> Markets</button>
            )}
          </div>
        </div>
      )}

      {/* ═══ TOMORROW ═══ */}
      {view === "tomorrow" && (
        <div style={{ padding: "16px 16px 100px", animation: "ppFadeIn 0.4s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.accent }}>PRICEPOINT</div>
              <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT }}>{locationLabel || market?.label}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {streak > 0 && <StatPill value={`${streak}d`} label="streak" color={T.orange} />}
              <StatPill value={`Lv.${currentLevel.level}`} color={T.accent} />
            </div>
          </div>

          {dailyResult && (
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <OverlineLabel>TODAY'S RESULT</OverlineLabel>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
                <img src={dailyResult.photo} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover" }}
                  onError={e => { e.target.src = "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80"; }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: FONT }}>{dailyResult.neighborhood}</div>
                  <div style={{ fontSize: 12, color: T.textSecondary, fontFamily: FONT }}>{dailyResult.beds}BR/{dailyResult.baths}BA · {(dailyResult.sqft || 0).toLocaleString()}sf</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: MONO, color: fbColor(dailyResult.feedback) }}>{(100 - dailyResult.pctOff).toFixed(1)}%</div>
                  <div style={{ fontSize: 10, fontFamily: MONO, fontWeight: 600, letterSpacing: 1, color: fbColor(dailyResult.feedback) }}>{dailyResult.feedback.label}</div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}><PillButton onClick={() => shareResult(dailyResult)} accent>Share Result</PillButton></div>
            </div>
          )}

          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "24px 20px", textAlign: "center", marginBottom: 16 }}>
            <OverlineLabel>NEXT PROPERTY IN</OverlineLabel>
            <div style={{ fontSize: 32, fontWeight: 800, fontFamily: MONO, color: T.text, letterSpacing: "-0.02em", marginTop: 4 }}>{countdown}</div>
            <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 6, fontFamily: FONT }}>Come back tomorrow to keep your streak alive</div>
          </div>

          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <OverlineLabel>YOUR STATS</OverlineLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 10 }}>
              {[[allResults.filter(r => r.isDaily).length, "Dailies"], [streak, "Streak"], [avgAccuracy != null ? `${(100 - avgAccuracy).toFixed(1)}%` : "—", "Avg"]].map(([val, label], i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: MONO, color: T.text }}>{val}</div>
                  <div style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${T.cardBorder}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: T.accent }}><Icon name={currentLevel.icon} size={14} /></span> Lv.{currentLevel.level} — {currentLevel.name}
                </span>
                <span style={{ fontSize: 11, fontFamily: MONO, color: T.textTertiary }}>{xp} XP{nextLevel ? ` / ${nextLevel.req}` : ""}</span>
              </div>
              <div style={{ height: 6, background: T.inputBg, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg, #6366F1, #3B82F6)", width: nextLevel ? `${((xp - currentLevel.req) / (nextLevel.req - currentLevel.req)) * 100}%` : "100%", transition: "width 0.5s ease" }} />
              </div>
            </div>
          </div>

          <PillButton onClick={() => {
            if (dailyResult && dailyResult.dailyNumber === dailyNumber) { enterFreePlay(); }
            else { setView("daily"); }
          }} secondary style={{ marginBottom: 10 }}>{dailyResult && dailyResult.dailyNumber === dailyNumber ? "Free Play — Unlimited Rounds" : "Play Today's Daily First"}</PillButton>
          <PillButton onClick={() => setView("leaderboard")} secondary style={{ marginBottom: 10 }}>Market Leaderboard</PillButton>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {onBackToBlueprint && (
              <button onClick={onBackToBlueprint} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${T.cardBorder}`, background: T.card, fontSize: 12, fontWeight: 600, color: T.textSecondary, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon name="calculator" size={14} /> Blueprint</button>
            )}
            {onOpenMarkets && (
              <button onClick={onOpenMarkets} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${T.cardBorder}`, background: T.card, fontSize: 12, fontWeight: 600, color: T.textSecondary, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon name="trending-up" size={14} /> Markets</button>
            )}
          </div>
          <button onClick={() => { setMarketInput(market?.label || ""); setView("onboarding"); }} style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: T.textTertiary, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>Change market</button>
        </div>
      )}

      {/* ═══ FREE PLAY ═══ */}
      {view === "freeplay" && (
        <div style={{ padding: "16px 16px 100px", animation: "ppSlideUp 0.4s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.cyan }}>FREE PLAY</div>
              <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT }}>{locationLabel || market?.label} · Unlimited rounds</div>
            </div>
            <button onClick={() => setView("postDaily")} style={{ background: T.inputBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: T.textSecondary, cursor: "pointer", fontFamily: FONT }}>Back</button>
          </div>
          {fpListings[fpIdx] && !fpResult ? (
            <>
              {PropertyCard({ listing: fpListings[fpIdx], guess: fpGuessInput, onGuessChange: handleFpGuessInput, onGuess: handleFpGuess, badge: "FREE PLAY", badgeColor: T.cyan, accentColor: T.cyan })}
              <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: T.textTertiary, fontFamily: MONO }}>{fpListings.length - fpIdx - 1} more in queue</div>
            </>
          ) : fpResult ? (
            {RevealCard({ result: fpResult, onContinue: fpNextProperty,
              onRunNumbersClick: onRunNumbers ? (r) => { onRunNumbers({ price: r.soldPrice, state: r.state, city: r.city, zip: r.zip }); } : null })}
          ) : (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8, fontFamily: FONT }}>All caught up!</div>
              <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 20, fontFamily: FONT }}>You've guessed on all available properties.</div>
              <PillButton onClick={() => setView("postDaily")} accent>Back to Home</PillButton>
            </div>
          )}
        </div>
      )}

      {/* ═══ LEADERBOARD ═══ */}
      {view === "leaderboard" && (
        <div style={{ padding: "16px 16px 100px", animation: "ppFadeIn 0.3s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.accent }}>LEADERBOARD</div>
              <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT }}>{locationLabel || market?.label}</div>
            </div>
            <button onClick={() => setView("postDaily")} style={{ background: T.inputBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: T.textSecondary, cursor: "pointer", fontFamily: FONT }}>Back</button>
          </div>
          {[
            { name: "Sarah K.", role: "Realtor", accuracy: 97.2, guesses: 21 },
            { name: "Mike T.", role: "Buyer", accuracy: 95.8, guesses: 15 },
            { name: "Jessica R.", role: "Realtor", accuracy: 94.1, guesses: 19 },
            { name: "You", role: "", accuracy: avgAccuracy != null ? parseFloat((100 - avgAccuracy).toFixed(1)) : 0, guesses: allResults.length, isYou: true },
            { name: "David L.", role: "Buyer", accuracy: 91.5, guesses: 12 },
            { name: "Amanda W.", role: "Realtor", accuracy: 89.3, guesses: 9 },
          ].sort((a, b) => b.accuracy - a.accuracy).map((entry, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: entry.isYou ? `${T.accent}12` : T.card, border: `1px solid ${entry.isYou ? `${T.accent}30` : T.cardBorder}`, borderRadius: 14, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, fontFamily: MONO,
                background: i === 0 ? "linear-gradient(135deg, #F59E0B, #D97706)" : i === 1 ? "linear-gradient(135deg, #A1A1A1, #737373)" : i === 2 ? "linear-gradient(135deg, #D97706, #92400E)" : T.inputBg,
                color: i < 3 ? "#fff" : T.textSecondary }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: entry.isYou ? T.accent : T.text, fontFamily: FONT }}>{entry.name}</div>
                {entry.role && <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT }}>{entry.role}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: MONO, color: entry.isYou ? T.accent : T.green }}>{entry.accuracy}%</div>
                <div style={{ fontSize: 10, fontFamily: MONO, color: T.textTertiary }}>{entry.guesses} guesses</div>
              </div>
            </div>
          ))}
          <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: T.textTertiary, padding: 16, background: T.card, borderRadius: 14, border: `1px solid ${T.cardBorder}`, fontFamily: FONT }}>
            Leaderboard updates daily at midnight.<br />Play more dailies to climb the rankings.
          </div>
        </div>
      )}
    </div>
  );
}
