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
    return `This home went ${listVsSold}% over asking — competitive market in ${resolveNeighborhood(listing)}.`;
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
  return `${resolveNeighborhood(listing)} is shifting — this ${overUnder}-asking result is worth noting.`;
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

const propTypeShort = (type) => {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t.includes("single") || t.includes("sfr") || t.includes("house")) return "SFR";
  if (t.includes("condo") || t.includes("co-op")) return "Condo";
  if (t.includes("town")) return "TH";
  if (t.includes("multi") || t.includes("duplex") || t.includes("triplex") || t.includes("fourplex")) return "Multi";
  return type.length > 10 ? type.slice(0, 8) : type;
};

// ── Sample Sold Listings (fallback) ──
const SAMPLE_SOLD = [
  { id:"pps1",zpid:"15201001",address:"1456 25th Ave",city:"San Francisco",state:"CA",zip:"94122",beds:3,baths:2,sqft:1450,lotSqft:2500,yearBuilt:1941,propertyType:"Single Family",listPrice:1295000,zestimate:1380000,soldPrice:1350000,soldDate:"2025-12-15",daysOnMarket:18,status:"sold",photo:"https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",neighborhood:"Central Sunset",pricePerSqft:931,description:"Beautifully updated 3BR/2BA home in the heart of Central Sunset. Open floor plan with renovated kitchen featuring quartz countertops, stainless appliances, and custom cabinetry. Hardwood floors throughout. Spacious backyard with mature landscaping. One-car garage plus driveway parking. Steps from Golden Gate Park." },
  { id:"pps2",zpid:"15302112",address:"2280 42nd Ave",city:"San Francisco",state:"CA",zip:"94116",beds:2,baths:1,sqft:1100,lotSqft:2500,yearBuilt:1938,propertyType:"Single Family",listPrice:998000,zestimate:1050000,soldPrice:1075000,soldDate:"2025-11-22",daysOnMarket:14,status:"sold",photo:"https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800&q=80",neighborhood:"Parkside",pricePerSqft:977,description:"Charming 2BR/1BA Parkside bungalow with original character and modern updates. Sun-filled living room, eat-in kitchen with gas range, and generous closet space. Full basement with laundry and expansion potential. Low-maintenance yard. Close to Stern Grove and L-Taraval." },
  { id:"pps3",zpid:"15403223",address:"1738 16th Ave",city:"San Francisco",state:"CA",zip:"94122",beds:4,baths:2,sqft:1900,lotSqft:2500,yearBuilt:1947,propertyType:"Single Family",listPrice:1695000,zestimate:1750000,soldPrice:1810000,soldDate:"2026-01-08",daysOnMarket:9,status:"sold",photo:"https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=800&q=80",neighborhood:"Inner Sunset",pricePerSqft:953,description:"Spacious 4BR/2BA Inner Sunset home with sweeping city views from the upper level. Remodeled baths, chef's kitchen with island, and large family room opening to a deck. Garage plus storage. Two blocks from UCSF and Irving Street shops. Highly sought-after Ulloa Elementary school district." },
  { id:"pps4",zpid:"15504334",address:"3642 Noriega St",city:"San Francisco",state:"CA",zip:"94122",beds:3,baths:1,sqft:1320,lotSqft:2500,yearBuilt:1951,propertyType:"Single Family",listPrice:1175000,zestimate:1220000,soldPrice:1195000,soldDate:"2025-10-30",daysOnMarket:22,status:"sold",photo:"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",neighborhood:"Outer Sunset",pricePerSqft:905,description:"Well-maintained 3BR/1BA on a quiet block of Noriega. Original hardwood floors, updated electrical, and newer roof. Bright living and dining rooms with period details. Full garage with interior access. Nearby N-Judah and Noriega corridor dining. A solid home with great bones and upside." },
  { id:"pps5",zpid:"15605445",address:"1891 31st Ave",city:"San Francisco",state:"CA",zip:"94122",beds:3,baths:2,sqft:1580,lotSqft:2500,yearBuilt:1944,propertyType:"Single Family",listPrice:1425000,zestimate:1490000,soldPrice:1520000,soldDate:"2025-12-04",daysOnMarket:11,status:"sold",photo:"https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80",neighborhood:"Outer Sunset",pricePerSqft:962,description:"Turnkey 3BR/2BA with a thoughtful remodel throughout. Open-concept main level, designer kitchen with waterfall island, and spa-inspired primary bath. South-facing backyard floods the home with natural light. Finished lower level with bonus room. Walk to Ocean Beach and Outerlands." },
  { id:"pps6",zpid:"15706556",address:"755 Kirkham St",city:"San Francisco",state:"CA",zip:"94122",beds:2,baths:2,sqft:1250,lotSqft:0,yearBuilt:1962,propertyType:"Condo",listPrice:849000,zestimate:880000,soldPrice:865000,soldDate:"2026-01-18",daysOnMarket:31,status:"sold",photo:"https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80",neighborhood:"Inner Sunset",pricePerSqft:692,description:"Top-floor 2BR/2BA condo in a boutique 6-unit building. In-unit laundry, one-car deeded parking, and private storage. Updated kitchen with dishwasher. Dual-pane windows and radiant heat keep it cozy. HOA covers water, garbage, and common insurance. Steps to GG Park and N-Judah." },
  { id:"pps7",zpid:"15807667",address:"2415 47th Ave",city:"San Francisco",state:"CA",zip:"94116",beds:3,baths:1,sqft:1280,lotSqft:2500,yearBuilt:1940,propertyType:"Single Family",listPrice:1095000,zestimate:1140000,soldPrice:1160000,soldDate:"2025-11-11",daysOnMarket:16,status:"sold",photo:"https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80",neighborhood:"Parkside",pricePerSqft:906,description:"Classic 3BR/1BA Parkside home with garage and full basement. Updated kitchen with granite counters. Freshly painted interior and refinished hardwood floors. Large backyard perfect for entertaining. Nearby parks, schools, and public transit. A great entry point into SF homeownership." },
  { id:"pps8",zpid:"15908778",address:"1347 10th Ave",city:"San Francisco",state:"CA",zip:"94122",beds:4,baths:3,sqft:2400,lotSqft:2800,yearBuilt:1950,propertyType:"Single Family",listPrice:1850000,zestimate:1920000,soldPrice:1975000,soldDate:"2026-01-25",daysOnMarket:8,status:"sold",photo:"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",neighborhood:"Inner Sunset",pricePerSqft:823,description:"Stunning 4BR/3BA with panoramic views from Sutro Tower to downtown. Fully renovated top to bottom — open chef's kitchen, marble baths, and white oak floors. Two-car garage, large deck, and landscaped yard. Legal in-law unit on lower level with separate entrance. An exceptional Inner Sunset offering." },
  { id:"pps9",zpid:"16009889",address:"1633 38th Ave",city:"San Francisco",state:"CA",zip:"94122",beds:2,baths:1,sqft:1050,lotSqft:2500,yearBuilt:1936,propertyType:"Single Family",listPrice:949000,zestimate:990000,soldPrice:1010000,soldDate:"2025-09-28",daysOnMarket:19,status:"sold",photo:"https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80",neighborhood:"Outer Sunset",pricePerSqft:962,description:"Cozy 2BR/1BA starter home with tons of potential. Original layout with separate living and dining rooms. Full basement ready for expansion (plans available). Sunny rear yard with fruit trees. One block from Sunset Blvd transit. Estate sale — priced to sell as-is." },
  { id:"pps10",zpid:"16110990",address:"1982 22nd Ave",city:"San Francisco",state:"CA",zip:"94122",beds:3,baths:2,sqft:1700,lotSqft:2500,yearBuilt:1946,propertyType:"Single Family",listPrice:1495000,zestimate:1560000,soldPrice:1545000,soldDate:"2025-10-14",daysOnMarket:13,status:"sold",photo:"https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",neighborhood:"Central Sunset",pricePerSqft:909,description:"Move-in ready 3BR/2BA with a flexible floor plan. Renovated kitchen with breakfast bar, updated bathrooms, and gleaming hardwood throughout. Large primary suite with walk-in closet. Finished garage with laundry. Excellent Central Sunset location near shopping, dining, and express bus lines." },
];

// ── SF Neighborhoods mapped to zip codes ──
const SF_NEIGHBORHOODS = [
  { name: "All of SF", zip: null },
  { name: "Sunset", zip: "94122" },
  { name: "Richmond", zip: "94118" },
  { name: "Marina", zip: "94123" },
  { name: "Pacific Heights", zip: "94115" },
  { name: "Noe Valley", zip: "94114" },
  { name: "Mission", zip: "94110" },
  { name: "Castro", zip: "94114" },
  { name: "SOMA", zip: "94103" },
  { name: "Hayes Valley", zip: "94102" },
  { name: "Bernal Heights", zip: "94110" },
  { name: "Potrero Hill", zip: "94107" },
  { name: "Excelsior", zip: "94112" },
  { name: "Bayview", zip: "94124" },
  { name: "Twin Peaks", zip: "94131" },
  { name: "Glen Park", zip: "94131" },
];

// Reverse lookup: zip → neighborhood name (first match wins for shared zips)
const ZIP_TO_HOOD = {};
SF_NEIGHBORHOODS.forEach(h => { if (h.zip && !ZIP_TO_HOOD[h.zip]) ZIP_TO_HOOD[h.zip] = h.name; });

// Resolve neighborhood: API field → zip lookup → city fallback
const resolveNeighborhood = (listing) =>
  listing.neighborhood || (listing.zip && ZIP_TO_HOOD[listing.zip]) || listing.city || "Unknown Area";

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
  const [mlsExpanded, setMlsExpanded] = useState(false);
  const [fpSelectedNeighborhood, setFpSelectedNeighborhood] = useState(null);

  // ── Active Listings (for Live Mode) ──
  const [activeListings, setActiveListings] = useState([]);

  // ── Live Mode State ──
  const [liveListings, setLiveListings] = useState([]);
  const [liveIdx, setLiveIdx] = useState(0);
  const [liveGuessInput, setLiveGuessInput] = useState("");
  const [livePrediction, setLivePrediction] = useState(null);
  const [allPredictions, setAllPredictions] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pp-predictions")) || []; } catch { return []; }
  });
  const [showLevelModal, setShowLevelModal] = useState(false);

  // ── Countdown ──
  const [countdown, setCountdown] = useState("");

  // ── Stats Tabs ──
  const [statsTab, setStatsTab] = useState("daily"); // "daily", "freeplay", or "live"
  const [leaderboardTab, setLeaderboardTab] = useState("today"); // "today", "weekly", or "alltime"
  const [leaderboardMode, setLeaderboardMode] = useState("daily"); // "daily", "free", or "live"

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
  useEffect(() => { try { localStorage.setItem("pp-predictions", JSON.stringify(allPredictions)); } catch {} }, [allPredictions]);

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

  // ── Countdown timer — only run when visible (prevents input-killing re-renders) ──
  const countdownRef = useRef(null);
  useEffect(() => {
    if (view !== "postDaily" && view !== "tomorrow") {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      return;
    }
    const update = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const diff = tomorrow - now;
      setCountdown(`${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m ${Math.floor((diff % 60000) / 1000)}s`);
    };
    update();
    countdownRef.current = setInterval(update, 1000);
    return () => { if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; } };
  }, [view]);

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
        if (data.activeListings && data.activeListings.length > 0) {
          setActiveListings(data.activeListings);
        }
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
    setAllResults(prev => [...prev, {
      guess: val, soldPrice: listing.soldPrice, pctOff: parseFloat(pctOff.toFixed(1)),
      revealed: true, isDaily: false, dailyNumber: null, timestamp: Date.now(),
      propertyType: listing.propertyType || null,
      neighborhood: listing.neighborhood || null,
      city: listing.city || null,
    }]);
  };
  const fpNextProperty = () => { setFpResult(null); setFpGuessInput(""); setMlsExpanded(false); setFpIdx(prev => prev + 1); };
  const enterFreePlay = (zip) => {
    // Exclude today's daily + next 30 days of dailies from Free Play pool (no spoilers)
    const excludedIndices = getDailyIndices(soldListings, market?.label || "", 30);
    let pool = soldListings.filter((_, i) => !excludedIndices.has(i));

    // If zip is provided, filter to that neighborhood
    if (zip) {
      pool = pool.filter(listing => listing.zip === zip);
    }

    // If exclusion removed too many (small dataset), fall back to all minus today only
    const safePool = pool.length >= 3 ? pool : soldListings.filter((_, i) => i !== (dailyProperty ? soldListings.indexOf(dailyProperty) : -1));
    setFpListings([...safePool].sort(() => Math.random() - 0.5));
    setFpIdx(0); setFpGuessInput(""); setFpResult(null); setView("freeplay");
  };

  // ── Live Mode ──
  const enterLiveMode = () => {
    // Use actual active/pending listings from API, fall back to sold listings
    const pool = activeListings.length > 0 ? activeListings : soldListings.slice(0, 10);
    setLiveListings([...pool].sort(() => Math.random() - 0.5));
    setLiveIdx(0); setLiveGuessInput(""); setLivePrediction(null); setView("live");
  };

  const handleLiveGuessInput = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setLiveGuessInput(raw.slice(0, 10));
  };

  const handleLiveGuess = () => {
    const val = parseInt(liveGuessInput.replace(/[^0-9]/g, ""));
    const listing = liveListings[liveIdx];
    if (!val || !listing) return;

    // For live mode, we can't score against sold price — we compare to list price and other predictions
    const vsListPct = listing.listPrice ? ((val - listing.listPrice) / listing.listPrice * 100).toFixed(1) : null;

    const prediction = {
      guess: val,
      listPrice: listing.listPrice,
      address: listing.address,
      neighborhood: listing.neighborhood,
      city: listing.city,
      state: listing.state,
      zip: listing.zip,
      beds: listing.beds,
      baths: listing.baths,
      sqft: listing.sqft,
      photo: listing.photo,
      propertyType: listing.propertyType,
      status: listing.status || "active",
      vsListPct: vsListPct ? parseFloat(vsListPct) : null,
      timestamp: Date.now(),
      resolved: false,
      soldPrice: null,
    };

    setLivePrediction(prediction);
    setAllPredictions(prev => [...prev, prediction]);
    // Award XP for making a prediction
    setAllResults(prev => [...prev, {
      guess: val, soldPrice: listing.listPrice || val, pctOff: Math.abs(parseFloat(vsListPct || 0)),
      revealed: true, isDaily: false, dailyNumber: null, timestamp: Date.now(),
      propertyType: listing.propertyType || null,
      neighborhood: listing.neighborhood || null,
      city: listing.city || null,
      isLive: true,
    }]);
  };

  const liveNextProperty = () => {
    setLivePrediction(null);
    setLiveGuessInput("");
    setLiveIdx(prev => prev + 1);
  };

  // ── Resolve feedback color from theme ──
  const fbColor = (fb) => T[fb?.colorKey] || T.green;

  // ── Tab Bar Navigation ──
  const TAB_VIEWS = {
    daily: view === "daily" || view === "postDaily",
    free: view === "freeplay" || view === "fpPicker",
    live: view === "live",
    stats: view === "tomorrow",
    board: view === "leaderboard",
  };
  const handleTab = (tab) => {
    if (tab === "daily") {
      if (dailyResult && dailyResult.dailyNumber === dailyNumber) setView("postDaily");
      else setView("daily");
    } else if (tab === "free") {
      if (dailyResult && dailyResult.dailyNumber === dailyNumber) setView("fpPicker");
      else setView("daily"); // gate: must play daily first
    } else if (tab === "live") {
      if (dailyResult && dailyResult.dailyNumber === dailyNumber) setView("live");
      else setView("daily"); // gate: must play daily first
    } else if (tab === "stats") {
      setView("tomorrow");
    } else if (tab === "board") {
      setView("leaderboard");
    }
  };
  const showTabBar = view !== "onboarding" && view !== "reveal";

  // ═══════════════════════════════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════════════════════════════
  // ── Memoized sub-components — stable references prevent input focus loss ──
  const OverlineLabel = useMemo(() =>
    function OverlineLabel({ children }) {
      return <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary, marginBottom: 4 }}>{children}</div>;
    }, [T.textTertiary]
  );

  const StatPill = useMemo(() =>
    function StatPill({ value, label, color }) {
      return <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: color || T.accent, background: `${color || T.accent}18`, padding: "4px 10px", borderRadius: 8, border: `1px solid ${color || T.accent}30` }}>
        {value}{label ? ` ${label}` : ""}
      </div>;
    }, [T.accent]
  );

  const PillButton = useMemo(() =>
    function PillButton({ children, onClick, disabled, accent, secondary, tealAccent, style: s }) {
      return <button onClick={onClick} disabled={disabled} style={{
        width: "100%", padding: "14px", borderRadius: 9999, fontSize: 15, fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer", fontFamily: FONT, transition: "all 0.2s",
        border: secondary ? `1px solid ${T.cardBorder}` : "none",
        background: disabled ? T.inputBg : tealAccent ? "linear-gradient(135deg, #06B6D4, #3B82F6)" : accent ? "linear-gradient(135deg, #6366F1, #3B82F6)" : secondary ? "transparent" : "linear-gradient(135deg, #6366F1, #3B82F6)",
        color: disabled ? T.textTertiary : secondary ? T.textSecondary : "#fff",
        boxShadow: disabled || secondary ? "none" : accent ? "0 0 20px rgba(99,102,241,0.3)" : tealAccent ? "0 0 20px rgba(6,182,212,0.3)" : "0 0 20px rgba(99,102,241,0.3)",
        ...s,
      }}>{children}</button>;
    }, [T, FONT]
  );

  // ── Property card (shared daily & free play) ──
  const PropertyCard = ({ listing, guess, onGuessChange, onGuess, badge, badgeColor, accentColor, showExtras }) => {
    const accent = accentColor || T.accent;
    const pType = propTypeShort(listing.propertyType);
    return (
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ position: "relative" }}>
          <img src={listing.photo} alt="" style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }}
            onError={e => { e.target.src = "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80"; }} />
          <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
            {badge && (
              <div style={{ background: `${badgeColor || accent}E6`, backdropFilter: "blur(8px)", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase" }}>{badge}</div>
            )}
            {showExtras && pType && (
              <div style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase" }}>{pType}</div>
            )}
          </div>
          {/* Neighborhood badge — pinned bottom-left of photo for quick scanning */}
          {resolveNeighborhood(listing) !== "Unknown Area" && (
            <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderRadius: 10, padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icon name="map-pin" size={13} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: FONT }}>{resolveNeighborhood(listing)}</span>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: "16px 18px 20px" }}>
          {/* Neighborhood — address hidden! */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: "-0.02em", fontFamily: FONT }}>{resolveNeighborhood(listing)}</div>
          </div>
          <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT }}>{listing.city}, {listing.state} {listing.zip}{showExtras && listing.propertyType ? ` · ${listing.propertyType}` : ""}</div>
          {/* MLS Description — expandable, Free Play only */}
          {showExtras && listing.description && (
            <div style={{ marginTop: 10, background: T.inputBg, borderRadius: 10, padding: "10px 14px", border: `1px solid ${T.cardBorder}` }}>
              <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.55, fontFamily: FONT, overflow: "hidden", maxHeight: mlsExpanded ? "none" : 54, position: "relative" }}>
                {listing.description}
                {!mlsExpanded && listing.description.length > 120 && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 28, background: `linear-gradient(transparent, ${T.inputBg})` }} />
                )}
              </div>
              {listing.description.length > 120 && (
                <button onClick={() => setMlsExpanded(!mlsExpanded)} style={{ background: "none", border: "none", color: accent, fontSize: 11, fontWeight: 600, fontFamily: MONO, letterSpacing: 1, cursor: "pointer", padding: "6px 0 0", textTransform: "uppercase" }}>{mlsExpanded ? "Show less" : "Read more"}</button>
              )}
            </div>
          )}
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
          {/* Guess — Cash App style: tap the display to type, hidden input captures keys */}
          <div style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, textAlign: "center", marginBottom: 6, fontFamily: FONT }}>What do you think it sold for?</div>
          <div onClick={() => { const el = document.getElementById(`pp-guess-${badge || "d"}`); if (el) el.focus(); }}
            style={{ position: "relative", background: T.inputBg, border: `2px solid ${T.cardBorder}`, borderRadius: 14, padding: "16px 20px", cursor: "text", textAlign: "center", marginBottom: 4, transition: "border-color 0.2s" }}>
            <div style={{ fontSize: guess ? 28 : 18, fontWeight: guess ? 900 : 500, color: guess ? T.text : T.textTertiary, fontFamily: MONO, letterSpacing: guess ? "-0.02em" : 0, transition: "all 0.15s" }}>
              {guess ? `$${parseInt(guess).toLocaleString("en-US")}` : "Tap to enter price"}
            </div>
            <input id={`pp-guess-${badge || "d"}`} value={guess || ""} onChange={onGuessChange} onKeyDown={e => e.key === "Enter" && onGuess()} inputMode="numeric" autoComplete="off"
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, fontSize: 18, border: "none", outline: "none", background: "none", boxSizing: "border-box" }}
              onFocus={e => e.target.parentElement.style.borderColor = accent} onBlur={e => e.target.parentElement.style.borderColor = T.cardBorder} />
          </div>
          {/* Live feedback — always render to keep DOM stable */}
          <div style={{ textAlign: "center", fontSize: 12, color: T.textSecondary, marginTop: 6, fontFamily: MONO, minHeight: 18, visibility: guess ? "visible" : "hidden" }}>{(() => {
            const v = parseInt(guess);
            if (!v || !listing.listPrice) return "\u00A0";
            const d = ((v - listing.listPrice) / listing.listPrice * 100).toFixed(1);
            return `${d > 0 ? "+" : ""}${d}% vs list${listing.sqft ? ` · $${Math.round(v / listing.sqft)}/sf` : ""}`;
          })()}</div>
          <div style={{ marginTop: 14 }}>
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

      {/* Persistent XP bar — visible on Free, Live, Stats */}
      {(view === "freeplay" || view === "live" || view === "tomorrow") && (
        <div onClick={() => setShowLevelModal(true)} style={{
          margin: "0 16px 12px", padding: "10px 16px", background: T.card,
          border: `1px solid ${T.cardBorder}`, borderRadius: 12,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: T.accent }}><Icon name={currentLevel.icon} size={16} /></span>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT }}>Lv.{currentLevel.level}</span>
          </div>
          <div style={{ flex: 1, height: 6, background: T.inputBg, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg, #6366F1, #3B82F6)",
              width: nextLevel ? `${((xp - currentLevel.req) / (nextLevel.req - currentLevel.req)) * 100}%` : "100%",
              transition: "width 0.5s ease" }} />
          </div>
          <span style={{ fontSize: 11, fontFamily: MONO, color: T.textTertiary, whiteSpace: "nowrap" }}>{xp}{nextLevel ? `/${nextLevel.req}` : ""} XP</span>
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
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: FONT }}>{resolveNeighborhood(dailyResult)}</div>
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
            <PillButton onClick={() => setView("fpPicker")} tealAccent>Start Free Play</PillButton>
          </div>

          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "20px", textAlign: "center", marginBottom: 16 }}>
            <OverlineLabel>NEXT DAILY IN</OverlineLabel>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: MONO, color: T.text, letterSpacing: "-0.02em", marginTop: 4 }}>{countdown}</div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, fontFamily: FONT }}>Come back tomorrow to keep your streak</div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {onBackToBlueprint && (
              <button onClick={onBackToBlueprint} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${T.cardBorder}`, background: T.card, fontSize: 12, fontWeight: 600, color: T.textSecondary, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon name="calculator" size={14} /> Blueprint</button>
            )}
            {onOpenMarkets && (
              <button onClick={onOpenMarkets} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${T.cardBorder}`, background: T.card, fontSize: 12, fontWeight: 600, color: T.textSecondary, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon name="trending-up" size={14} /> Markets</button>
            )}
          </div>
        </div>
      )}

      {/* ═══ STATS (with Daily / Free Play tabs) ═══ */}
      {view === "tomorrow" && (
        <div style={{ padding: "16px 16px 100px", animation: "ppFadeIn 0.4s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.accent }}>YOUR STATS</div>
              <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT }}>{locationLabel || market?.label}</div>
            </div>
          </div>

          {/* Stats Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[{ id: "daily", label: "Daily" }, { id: "freeplay", label: "Free Play" }, { id: "live", label: "Live" }].map(tab => (
              <button key={tab.id} onClick={() => setStatsTab(tab.id)} style={{
                flex: 1, padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: FONT,
                border: `1px solid ${statsTab === tab.id ? "transparent" : T.cardBorder}`,
                background: statsTab === tab.id ? (tab.id === "live" ? T.red : tab.id === "freeplay" ? T.cyan : T.accent) : T.card,
                color: statsTab === tab.id ? "#fff" : T.textSecondary,
                cursor: "pointer", transition: "all 0.2s"
              }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ─── DAILY STATS TAB ─── */}
          {statsTab === "daily" && (
            <>
              <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
                <OverlineLabel>YOUR STREAK</OverlineLabel>
                <div style={{ fontSize: 56, fontWeight: 900, fontFamily: MONO, color: T.accent, marginTop: 8, textAlign: "center", marginBottom: 6 }}>{streak}</div>
                <div style={{ fontSize: 14, color: T.textSecondary, textAlign: "center", fontFamily: FONT }}>consecutive days</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: MONO, color: T.text }}>{allResults.filter(r => r.isDaily).length}</div>
                  <div style={{ fontSize: 11, fontFamily: MONO, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Dailies Played</div>
                </div>
                <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: MONO, color: T.green }}>{avgAccuracy != null ? (100 - avgAccuracy).toFixed(1) : "—"}%</div>
                  <div style={{ fontSize: 11, fontFamily: MONO, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Avg Accuracy</div>
                </div>
              </div>

              {/* Accuracy Distribution */}
              <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <OverlineLabel>ACCURACY DISTRIBUTION</OverlineLabel>
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { label: "BULLSEYE", range: "≤2%", color: T.green, minPct: 0, maxPct: 2 },
                    { label: "SHARP", range: "≤5%", color: T.green, minPct: 2.01, maxPct: 5 },
                    { label: "SOLID", range: "≤10%", color: T.cyan, minPct: 5.01, maxPct: 10 },
                    { label: "TRICKY", range: "≤20%", color: T.orange, minPct: 10.01, maxPct: 20 },
                    { label: "SURPRISE", range: ">20%", color: T.orange, minPct: 20.01, maxPct: 100 },
                  ].map((band, idx) => {
                    const count = allResults.filter(r => r.isDaily && r.pctOff >= band.minPct && r.pctOff <= band.maxPct).length;
                    const total = allResults.filter(r => r.isDaily).length;
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div key={idx}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: MONO, textTransform: "uppercase" }}>{band.label}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: T.textTertiary, fontFamily: MONO }}>{count}</div>
                        </div>
                        <div style={{ height: 8, background: T.inputBg, borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", background: band.color, width: `${Math.max(pct, 3)}%`, transition: "width 0.3s ease", borderRadius: 4 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* XP & Level */}
              <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: T.accent }}><Icon name={currentLevel.icon} size={14} /></span> Lv.{currentLevel.level} — {currentLevel.name}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: MONO, color: T.textTertiary }}>{xp} XP{nextLevel ? ` / ${nextLevel.req}` : ""}</span>
                </div>
                <div style={{ height: 6, background: T.inputBg, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg, #6366F1, #3B82F6)", width: nextLevel ? `${((xp - currentLevel.req) / (nextLevel.req - currentLevel.req)) * 100}%` : "100%", transition: "width 0.5s ease" }} />
                </div>
              </div>

              {/* Next Daily Countdown */}
              <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "20px", textAlign: "center", marginBottom: 16 }}>
                <OverlineLabel>NEXT DAILY IN</OverlineLabel>
                <div style={{ fontSize: 32, fontWeight: 800, fontFamily: MONO, color: T.text, letterSpacing: "-0.02em", marginTop: 4 }}>{countdown}</div>
              </div>
            </>
          )}

          {/* ─── FREE PLAY STATS TAB ─── */}
          {statsTab === "freeplay" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: MONO, color: T.cyan }}>{allResults.filter(r => !r.isDaily).length}</div>
                  <div style={{ fontSize: 11, fontFamily: MONO, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Free Play Rounds</div>
                </div>
                <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: MONO, color: T.cyan }}>
                    {(() => {
                      const fpResults = allResults.filter(r => !r.isDaily && r.revealed && r.soldPrice);
                      return fpResults.length > 0 ? (100 - fpResults.reduce((sum, r) => sum + Math.abs((r.guess - r.soldPrice) / r.soldPrice) * 100, 0) / fpResults.length).toFixed(1) : "—";
                    })()}%
                  </div>
                  <div style={{ fontSize: 11, fontFamily: MONO, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Avg Accuracy</div>
                </div>
              </div>

              {/* Best Guess */}
              {(() => {
                const fpResults = allResults.filter(r => !r.isDaily);
                const best = fpResults.length > 0 ? fpResults.reduce((min, r) => r.pctOff < min.pctOff ? r : min) : null;
                return best ? (
                  <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                    <OverlineLabel>BEST GUESS</OverlineLabel>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 800, fontFamily: MONO, color: T.green }}>{(100 - best.pctOff).toFixed(1)}%</div>
                        <div style={{ fontSize: 11, fontFamily: MONO, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Accuracy</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: FONT }}>{best.propertyType ? propTypeShort(best.propertyType) : "—"}</div>
                        <div style={{ fontSize: 11, fontFamily: MONO, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Type</div>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Accuracy by Property Type */}
              {(() => {
                const fpResults = allResults.filter(r => !r.isDaily && r.revealed && r.soldPrice && r.propertyType);
                const types = [...new Set(fpResults.map(r => propTypeShort(r.propertyType)))].filter(Boolean);
                return types.length > 0 ? (
                  <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                    <OverlineLabel>ACCURACY BY TYPE</OverlineLabel>
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                      {types.map((type, idx) => {
                        const typeResults = fpResults.filter(r => propTypeShort(r.propertyType) === type);
                        const accuracy = 100 - typeResults.reduce((sum, r) => sum + Math.abs((r.guess - r.soldPrice) / r.soldPrice) * 100, 0) / typeResults.length;
                        return (
                          <div key={idx}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: MONO }}>{type}</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: T.cyan, fontFamily: MONO }}>{accuracy.toFixed(1)}%</div>
                            </div>
                            <div style={{ height: 6, background: T.inputBg, borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", background: T.cyan, width: `${Math.max(accuracy, 3)}%`, transition: "width 0.3s ease", borderRadius: 3 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null;
              })()}
            </>
          )}

          {/* ─── LIVE STATS TAB ─── */}
          {statsTab === "live" && (
            <>
              {(() => {
                const liveResults = allResults.filter(r => r.isLive);
                const livePreds = allPredictions;
                const pendingCount = livePreds.filter(p => !p.resolved).length;
                const resolvedCount = livePreds.filter(p => p.resolved).length;
                const avgVsList = liveResults.length > 0
                  ? liveResults.reduce((sum, r) => sum + (r.pctOff || 0), 0) / liveResults.length
                  : null;

                return (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 16, textAlign: "center" }}>
                        <div style={{ fontSize: 28, fontWeight: 800, fontFamily: MONO, color: T.red }}>{livePreds.length}</div>
                        <div style={{ fontSize: 11, fontFamily: MONO, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Predictions</div>
                      </div>
                      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 16, textAlign: "center" }}>
                        <div style={{ fontSize: 28, fontWeight: 800, fontFamily: MONO, color: T.red }}>
                          {avgVsList != null ? `${avgVsList > 0 ? "+" : ""}${avgVsList.toFixed(1)}%` : "—"}
                        </div>
                        <div style={{ fontSize: 11, fontFamily: MONO, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Avg vs List</div>
                      </div>
                    </div>

                    {/* Pending vs Resolved */}
                    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                      <OverlineLabel>PREDICTION STATUS</OverlineLabel>
                      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                        <div style={{ flex: 1, background: `${T.orange}12`, borderRadius: 12, padding: "14px 12px", textAlign: "center", border: `1px solid ${T.orange}20` }}>
                          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: MONO, color: T.orange }}>{pendingCount}</div>
                          <div style={{ fontSize: 10, fontFamily: MONO, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Pending</div>
                        </div>
                        <div style={{ flex: 1, background: `${T.green}12`, borderRadius: 12, padding: "14px 12px", textAlign: "center", border: `1px solid ${T.green}20` }}>
                          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: MONO, color: T.green }}>{resolvedCount}</div>
                          <div style={{ fontSize: 10, fontFamily: MONO, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Resolved</div>
                        </div>
                      </div>
                    </div>

                    {/* Recent Predictions */}
                    {livePreds.length > 0 && (
                      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                        <OverlineLabel>RECENT PREDICTIONS</OverlineLabel>
                        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                          {livePreds.slice(-5).reverse().map((pred, idx) => (
                            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: T.inputBg, borderRadius: 10 }}>
                              {pred.photo && <img src={pred.photo} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {resolveNeighborhood(pred)}
                                </div>
                                <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: MONO }}>
                                  {pred.beds}BR/{pred.baths}BA · {(pred.sqft || 0).toLocaleString()}sf
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: MONO, color: T.text }}>{fmt(pred.guess)}</div>
                                <div style={{ fontSize: 10, fontFamily: MONO, fontWeight: 600, color: pred.resolved ? T.green : T.orange }}>
                                  {pred.resolved ? "RESOLVED" : "PENDING"}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Accuracy by Neighborhood (Live) */}
                    {(() => {
                      const liveWithHood = liveResults.filter(r => r.neighborhood || r.city);
                      const hoods = [...new Set(liveWithHood.map(r => r.neighborhood || r.city))].filter(Boolean);
                      return hoods.length > 0 ? (
                        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                          <OverlineLabel>PREDICTIONS BY AREA</OverlineLabel>
                          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                            {hoods.map((hood, idx) => {
                              const count = liveWithHood.filter(r => (r.neighborhood || r.city) === hood).length;
                              return (
                                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT }}>{hood}</div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: T.red, fontFamily: MONO }}>{count} pred{count !== 1 ? "s" : ""}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {livePreds.length === 0 && (
                      <div style={{ textAlign: "center", padding: "40px 20px", background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14 }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8, fontFamily: FONT }}>No predictions yet</div>
                        <div style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT }}>Head to the Live tab to predict sale prices on active listings</div>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}

          <button onClick={() => { setMarketInput(market?.label || ""); setView("onboarding"); }} style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: T.textTertiary, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>Change market</button>
        </div>
      )}

      {/* ═══ LIVE MODE ═══ */}
      {view === "live" && (
        <div style={{ padding: "16px 16px 100px", animation: "ppSlideUp 0.4s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.red }}>LIVE</div>
              <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT }}>{locationLabel || market?.label} · Round {liveIdx + 1}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatPill value={`${liveListings.length - liveIdx - 1}`} label="left" color={T.red} />
            </div>
          </div>
          {liveListings[liveIdx] && !livePrediction ? (
            <>
              {PropertyCard({ listing: liveListings[liveIdx], guess: liveGuessInput, onGuessChange: handleLiveGuessInput, onGuess: handleLiveGuess, badge: "LIVE", badgeColor: T.red || "#EF4444", accentColor: T.red || "#EF4444", showExtras: true })}
              <div style={{ marginTop: 16, padding: "20px", background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary, marginBottom: 12 }}>Your Prediction</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontFamily: MONO, color: T.textTertiary }}>$</span>
                  <input
                    type="text" placeholder="0" value={fmtGuess(liveGuessInput)} onChange={handleLiveGuessInput}
                    style={{ flex: 1, fontSize: 32, fontWeight: 800, fontFamily: MONO, color: T.text, background: "transparent", border: "none", outline: "none", padding: "4px 0", paddingBottom: 0, borderBottom: `2px solid ${T.accent}` }}
                  />
                </div>
                <PillButton onClick={handleLiveGuess} accent>Lock In Prediction</PillButton>
              </div>
            </>
          ) : livePrediction ? (
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, overflow: "hidden" }}>
              <img src={livePrediction.photo} alt="" style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
              <div style={{ padding: "20px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.accent, marginBottom: 8 }}>PREDICTION LOCKED</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.text, fontFamily: FONT, marginBottom: 12 }}>
                  {livePrediction.beds}BR / {livePrediction.baths}BA · {(livePrediction.sqft || 0).toLocaleString()} sf
                </div>
                <div style={{ background: T.inputBg, padding: "12px 14px", borderRadius: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary, marginBottom: 4 }}>Your Prediction</div>
                  <div style={{ fontSize: 24, fontWeight: 800, fontFamily: MONO, color: T.text }}>{fmt(livePrediction.guess)}</div>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1, background: T.inputBg, padding: "10px 12px", borderRadius: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary }}>vs List</div>
                    <div style={{ fontSize: 16, fontWeight: 800, fontFamily: MONO, color: livePrediction.vsListPct >= 0 ? T.orange : T.green, marginTop: 2 }}>
                      {livePrediction.vsListPct ? (livePrediction.vsListPct >= 0 ? "+" : "") + livePrediction.vsListPct.toFixed(1) + "%" : "—"}
                    </div>
                  </div>
                  <div style={{ flex: 1, background: T.inputBg, padding: "10px 12px", borderRadius: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary }}>Status</div>
                    <div style={{ fontSize: 14, fontWeight: 800, fontFamily: MONO, color: livePrediction.status === "pending" ? T.orange : T.green, marginTop: 2 }}>{(livePrediction.status || "active").toUpperCase()}</div>
                  </div>
                </div>
                <div style={{ padding: "12px", background: `${T.accent}12`, borderRadius: 10, marginBottom: 12, borderLeft: `3px solid ${T.accent}` }}>
                  <div style={{ fontSize: 12, color: T.text, fontFamily: FONT, lineHeight: 1.4 }}>68% of players think it'll sell higher. We'll notify you when this one closes.</div>
                </div>
                <PillButton onClick={liveNextProperty} secondary>Next Property</PillButton>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8, fontFamily: FONT }}>All caught up!</div>
              <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 20, fontFamily: FONT }}>You've locked in predictions on all active listings.</div>
              <PillButton onClick={() => setView("postDaily")} accent>Back to Home</PillButton>
            </div>
          )}
        </div>
      )}

      {/* ═══ FREE PLAY NEIGHBORHOOD PICKER ═══ */}
      {view === "fpPicker" && (
        <div style={{ padding: "16px 16px 100px", animation: "ppFadeIn 0.4s ease" }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.cyan, marginBottom: 2 }}>CHOOSE YOUR MARKET</div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FONT, color: T.text, lineHeight: 1.1 }}>Pick a Neighborhood</div>
            <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 8, fontFamily: FONT }}>Select where you want to guess property prices</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {SF_NEIGHBORHOODS.map((hood, idx) => (
              <button
                key={idx}
                onClick={() => { enterFreePlay(hood.zip); }}
                style={{
                  padding: "16px", borderRadius: 12, border: `1px solid ${T.cardBorder}`, background: T.card,
                  fontSize: 14, fontWeight: 600, color: T.text, fontFamily: FONT,
                  cursor: "pointer", transition: "all 0.2s",
                  display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
                  minHeight: 56,
                  aspectRatio: hood.name.length > 12 ? "auto" : "1"
                }}
                onMouseEnter={(e) => { e.target.style.background = T.inputBg; e.target.style.borderColor = T.accent; }}
                onMouseLeave={(e) => { e.target.style.background = T.card; e.target.style.borderColor = T.cardBorder; }}
              >
                {hood.name}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 24, textAlign: "center" }}>
            <button onClick={() => setView("postDaily")} style={{ background: "none", border: "none", color: T.textTertiary, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>
              Back
            </button>
          </div>
        </div>
      )}

      {/* ═══ FREE PLAY ═══ */}
      {view === "freeplay" && (
        <div style={{ padding: "16px 16px 100px", animation: "ppSlideUp 0.4s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.cyan }}>FREE PLAY</div>
              <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT }}>{locationLabel || market?.label} · Round {fpIdx + 1}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatPill value={`${fpListings.length - fpIdx - 1}`} label="left" color={T.cyan} />
            </div>
          </div>
          {fpListings[fpIdx] && !fpResult ? (
            <>
              {PropertyCard({ listing: fpListings[fpIdx], guess: fpGuessInput, onGuessChange: handleFpGuessInput, onGuess: handleFpGuess, badge: "FREE PLAY", badgeColor: T.cyan, accentColor: T.cyan, showExtras: true })}
            </>
          ) : fpResult ? (
            RevealCard({ result: fpResult, onContinue: fpNextProperty,
              onRunNumbersClick: onRunNumbers ? (r) => { onRunNumbers({ price: r.soldPrice, state: r.state, city: r.city, zip: r.zip }); } : null })
          ) : (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8, fontFamily: FONT }}>All caught up!</div>
              <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 20, fontFamily: FONT }}>You've guessed on all available properties.</div>
              <PillButton onClick={() => setView("postDaily")} accent>Back to Home</PillButton>
            </div>
          )}
        </div>
      )}

      {/* ═══ LEADERBOARD (with mode + time tabs) ═══ */}
      {view === "leaderboard" && (
        <div style={{ padding: "16px 16px 100px", animation: "ppFadeIn 0.3s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.accent }}>LEADERBOARD</div>
              <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT }}>{locationLabel || market?.label}</div>
            </div>
          </div>

          {/* Mode Toggle: Daily / Free / Live */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[
              { id: "daily", label: "Daily", color: T.accent },
              { id: "free", label: "Free Play", color: T.cyan },
              { id: "live", label: "Live", color: T.red },
            ].map(mode => (
              <button key={mode.id} onClick={() => setLeaderboardMode(mode.id)} style={{
                flex: 1, padding: "10px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: FONT,
                border: `1px solid ${leaderboardMode === mode.id ? "transparent" : T.cardBorder}`,
                background: leaderboardMode === mode.id ? mode.color : T.card,
                color: leaderboardMode === mode.id ? "#fff" : T.textSecondary,
                cursor: "pointer", transition: "all 0.2s"
              }}>
                {mode.label}
              </button>
            ))}
          </div>

          {/* Time Toggle: Today / Weekly / All Time */}
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            {[
              { id: "today", label: "Today" },
              { id: "weekly", label: "Weekly" },
              { id: "alltime", label: "All Time" },
            ].map(tab => (
              <button key={tab.id} onClick={() => setLeaderboardTab(tab.id)} style={{
                flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, fontFamily: MONO,
                border: `1px solid ${leaderboardTab === tab.id ? T.accent + "40" : T.cardBorder}`,
                background: leaderboardTab === tab.id ? `${T.accent}12` : "transparent",
                color: leaderboardTab === tab.id ? T.accent : T.textTertiary,
                cursor: "pointer", transition: "all 0.2s", letterSpacing: 1, textTransform: "uppercase",
              }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Leaderboard entries */}
          {(() => {
            const modeColor = leaderboardMode === "live" ? T.red : leaderboardMode === "free" ? T.cyan : T.accent;
            const modeLabel = leaderboardMode === "live" ? "predictions" : "guesses";

            // Compute user stats per mode
            const userDailyResults = allResults.filter(r => r.isDaily && r.revealed && r.soldPrice);
            const userFreeResults = allResults.filter(r => !r.isDaily && !r.isLive && r.revealed && r.soldPrice);
            const userLiveResults = allResults.filter(r => r.isLive);

            const userAccuracy = leaderboardMode === "daily"
              ? (userDailyResults.length > 0 ? parseFloat((100 - userDailyResults.reduce((s, r) => s + Math.abs((r.guess - r.soldPrice) / r.soldPrice) * 100, 0) / userDailyResults.length).toFixed(1)) : 0)
              : leaderboardMode === "free"
              ? (userFreeResults.length > 0 ? parseFloat((100 - userFreeResults.reduce((s, r) => s + Math.abs((r.guess - r.soldPrice) / r.soldPrice) * 100, 0) / userFreeResults.length).toFixed(1)) : 0)
              : (userLiveResults.length > 0 ? parseFloat((100 - userLiveResults.reduce((s, r) => s + (r.pctOff || 0), 0) / userLiveResults.length).toFixed(1)) : 0);

            const userCount = leaderboardMode === "daily" ? userDailyResults.length
              : leaderboardMode === "free" ? userFreeResults.length
              : userLiveResults.length;

            // Mock data per mode
            const mockByMode = {
              daily: [
                { name: "Sarah K.", role: "Realtor", accuracy: 97.2, count: 21 },
                { name: "Mike T.", role: "Buyer", accuracy: 95.8, count: 15 },
                { name: "Jessica R.", role: "Realtor", accuracy: 94.1, count: 19 },
                { name: "David L.", role: "Buyer", accuracy: 91.5, count: 12 },
                { name: "Amanda W.", role: "Realtor", accuracy: 89.3, count: 9 },
              ],
              free: [
                { name: "Mike T.", role: "Buyer", accuracy: 96.4, count: 87 },
                { name: "Sarah K.", role: "Realtor", accuracy: 95.1, count: 64 },
                { name: "Raj P.", role: "Investor", accuracy: 93.8, count: 112 },
                { name: "Lily C.", role: "Buyer", accuracy: 92.0, count: 45 },
                { name: "Amanda W.", role: "Realtor", accuracy: 90.7, count: 38 },
              ],
              live: [
                { name: "Jessica R.", role: "Realtor", accuracy: 94.5, count: 34 },
                { name: "Raj P.", role: "Investor", accuracy: 93.2, count: 51 },
                { name: "Sarah K.", role: "Realtor", accuracy: 91.8, count: 28 },
                { name: "Mike T.", role: "Buyer", accuracy: 90.1, count: 22 },
                { name: "Lily C.", role: "Buyer", accuracy: 88.6, count: 19 },
              ],
            };

            const mockData = [
              ...mockByMode[leaderboardMode],
              { name: "You", role: "", accuracy: userAccuracy, count: userCount, isYou: true },
            ];
            const sorted = [...mockData].sort((a, b) => b.accuracy - a.accuracy);

            return (
              <>
                {sorted.map((entry, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: entry.isYou ? `${modeColor}12` : T.card, border: `1px solid ${entry.isYou ? `${modeColor}30` : T.cardBorder}`, borderRadius: 14, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, fontFamily: MONO,
                      background: i === 0 ? "linear-gradient(135deg, #F59E0B, #D97706)" : i === 1 ? "linear-gradient(135deg, #A1A1A1, #737373)" : i === 2 ? "linear-gradient(135deg, #D97706, #92400E)" : T.inputBg,
                      color: i < 3 ? "#fff" : T.textSecondary }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: entry.isYou ? modeColor : T.text, fontFamily: FONT }}>{entry.name}</div>
                      {entry.role && <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT }}>{entry.role}</div>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: MONO, color: entry.isYou ? modeColor : T.green }}>{entry.accuracy}%</div>
                      <div style={{ fontSize: 10, fontFamily: MONO, color: T.textTertiary }}>{entry.count} {modeLabel}</div>
                    </div>
                  </div>
                ))}
              </>
            );
          })()}

          <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: T.textTertiary, padding: 16, background: T.card, borderRadius: 14, border: `1px solid ${T.cardBorder}`, fontFamily: FONT }}>
            {leaderboardMode === "daily" ? "Leaderboard updates daily at midnight. Play more dailies to climb."
              : leaderboardMode === "free" ? "Free Play rankings based on accuracy across all rounds."
              : "Live rankings based on prediction accuracy once listings close."}
          </div>
        </div>
      )}

      {/* ═══ BOTTOM TAB BAR ═══ */}
      {showTabBar && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
          background: T.card, borderTop: `1px solid ${T.cardBorder}`,
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
          <div style={{ display: "flex", maxWidth: isDesktop ? 520 : 480, margin: "0 auto", width: "100%" }}>
            {[
              { id: "daily", label: "Daily", icon: "target" },
              { id: "free", label: "Free", icon: "play" },
              { id: "live", label: "Live", icon: "radio" },
              { id: "stats", label: "Stats", icon: "bar-chart" },
              { id: "board", label: "Board", icon: "award" },
            ].map(tab => {
              const active = TAB_VIEWS[tab.id];
              return (
                <button key={tab.id} onClick={() => handleTab(tab.id)} style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 2, padding: "10px 0 8px", background: "none", border: "none", cursor: "pointer",
                  color: active ? T.accent : T.textTertiary, transition: "color 0.2s",
                }}>
                  <Icon name={tab.icon} size={20} />
                  <span style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, letterSpacing: 0.5 }}>{tab.label}</span>
                  {active && <div style={{ width: 4, height: 4, borderRadius: 2, background: T.accent, marginTop: 1 }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ LEVEL ROADMAP MODAL ═══ */}
      {showLevelModal && (
        <div onClick={() => setShowLevelModal(false)} style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20, animation: "ppFadeIn 0.2s ease",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: 20, padding: "24px 20px", maxWidth: 380,
            width: "100%", maxHeight: "70vh", overflowY: "auto", border: `1px solid ${T.cardBorder}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase",
              fontFamily: MONO, color: T.accent, marginBottom: 4 }}>LEVEL ROADMAP</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text, fontFamily: FONT, marginBottom: 20 }}>
              Your Journey
            </div>
            {LEVELS.map((lvl, i) => {
              const unlocked = xp >= lvl.req;
              const isCurrent = currentLevel.level === lvl.level;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                  borderRadius: 12, marginBottom: 6,
                  background: isCurrent ? `${T.accent}12` : "transparent",
                  border: `1px solid ${isCurrent ? `${T.accent}30` : "transparent"}`,
                  opacity: unlocked ? 1 : 0.4,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center",
                    justifyContent: "center",
                    background: unlocked ? "linear-gradient(135deg, #6366F1, #3B82F6)" : T.inputBg,
                    color: unlocked ? "#fff" : T.textTertiary,
                  }}>
                    <Icon name={lvl.icon} size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: unlocked ? T.text : T.textTertiary, fontFamily: FONT }}>
                      Lv.{lvl.level} — {lvl.name}
                    </div>
                    <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: MONO }}>{lvl.req} XP required</div>
                  </div>
                  {isCurrent && (
                    <div style={{ fontSize: 10, fontWeight: 700, fontFamily: MONO, color: T.accent,
                      background: `${T.accent}18`, padding: "3px 8px", borderRadius: 6, letterSpacing: 1 }}>YOU</div>
                  )}
                  {unlocked && !isCurrent && (
                    <Icon name="check" size={16} style={{ color: T.green }} />
                  )}
                </div>
              );
            })}
            <button onClick={() => setShowLevelModal(false)} style={{
              width: "100%", marginTop: 16, padding: "14px", borderRadius: 9999,
              background: "linear-gradient(135deg, #6366F1, #3B82F6)", color: "#fff",
              fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: FONT,
            }}>Got It</button>
          </div>
        </div>
      )}
    </div>
  );
}
