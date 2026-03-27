import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Icon from './Icon';
import {
  getOrCreatePlayer, getDeviceId,
  submitGuess, submitPrediction, syncPlayerXP,
  fetchDaily, getExistingDailyGuess, getLeaderboard,
  updateDisplayName, getPlayer,
} from './lib/pricePointDB';

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
  // Guard: if listPrice is null/0, skip list-vs-sold insights
  if (!listing.listPrice) {
    if (listing.daysOnMarket > 30) {
      return `${listing.daysOnMarket} days on market tends to mean price reductions. Good to know for next time.`;
    }
    if (listing.daysOnMarket && listing.daysOnMarket <= 7) {
      return `Only ${listing.daysOnMarket} days on market — fast sales often signal competitive offers above asking.`;
    }
    return `${resolveNeighborhood(listing)} is a market worth watching — this one was tricky to read.`;
  }
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
const getAccuracyBand = (pctOff) => {
  if (pctOff <= 2) return 'bullseye';
  if (pctOff <= 5) return 'sharp';
  if (pctOff <= 10) return 'solid';
  if (pctOff <= 20) return 'tricky';
  return 'surprise';
};
const getXpForGuess = (pctOff) => {
  let xpEarned = 10; // base XP
  if (pctOff <= 1) xpEarned += 50;
  else if (pctOff <= 2) xpEarned += 40;
  else if (pctOff <= 5) xpEarned += 25;
  else if (pctOff <= 10) xpEarned += 15;
  return xpEarned;
};

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
  { id:"pps1",zpid:"15201001",address:"1456 25th Ave",city:"San Francisco",state:"CA",zip:"94122",beds:3,baths:2,sqft:1450,lotSqft:2500,yearBuilt:1941,propertyType:"Single Family",listPrice:1295000,zestimate:1380000,soldPrice:1350000,soldDate:"2025-12-15",daysOnMarket:18,status:"sold",_source:"sold_api",photo:"https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",neighborhood:"Central Sunset",pricePerSqft:931,description:"Beautifully updated 3BR/2BA home in the heart of Central Sunset. Open floor plan with renovated kitchen featuring quartz countertops, stainless appliances, and custom cabinetry. Hardwood floors throughout. Spacious backyard with mature landscaping. One-car garage plus driveway parking. Steps from Golden Gate Park." },
  { id:"pps2",zpid:"15302112",address:"2280 42nd Ave",city:"San Francisco",state:"CA",zip:"94116",beds:2,baths:1,sqft:1100,lotSqft:2500,yearBuilt:1938,propertyType:"Single Family",listPrice:998000,zestimate:1050000,soldPrice:1075000,soldDate:"2025-11-22",daysOnMarket:14,status:"sold",_source:"sold_api",photo:"https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800&q=80",neighborhood:"Parkside",pricePerSqft:977,description:"Charming 2BR/1BA Parkside bungalow with original character and modern updates. Sun-filled living room, eat-in kitchen with gas range, and generous closet space. Full basement with laundry and expansion potential. Low-maintenance yard. Close to Stern Grove and L-Taraval." },
  { id:"pps3",zpid:"15403223",address:"1738 16th Ave",city:"San Francisco",state:"CA",zip:"94122",beds:4,baths:2,sqft:1900,lotSqft:2500,yearBuilt:1947,propertyType:"Single Family",listPrice:1695000,zestimate:1750000,soldPrice:1810000,soldDate:"2026-01-08",daysOnMarket:9,status:"sold",_source:"sold_api",photo:"https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=800&q=80",neighborhood:"Inner Sunset",pricePerSqft:953,description:"Spacious 4BR/2BA Inner Sunset home with sweeping city views from the upper level. Remodeled baths, chef's kitchen with island, and large family room opening to a deck. Garage plus storage. Two blocks from UCSF and Irving Street shops. Highly sought-after Ulloa Elementary school district." },
  { id:"pps4",zpid:"15504334",address:"3642 Noriega St",city:"San Francisco",state:"CA",zip:"94122",beds:3,baths:1,sqft:1320,lotSqft:2500,yearBuilt:1951,propertyType:"Single Family",listPrice:1175000,zestimate:1220000,soldPrice:1195000,soldDate:"2025-10-30",daysOnMarket:22,status:"sold",_source:"sold_api",photo:"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",neighborhood:"Outer Sunset",pricePerSqft:905,description:"Well-maintained 3BR/1BA on a quiet block of Noriega. Original hardwood floors, updated electrical, and newer roof. Bright living and dining rooms with period details. Full garage with interior access. Nearby N-Judah and Noriega corridor dining. A solid home with great bones and upside." },
  { id:"pps5",zpid:"15605445",address:"1891 31st Ave",city:"San Francisco",state:"CA",zip:"94122",beds:3,baths:2,sqft:1580,lotSqft:2500,yearBuilt:1944,propertyType:"Single Family",listPrice:1425000,zestimate:1490000,soldPrice:1520000,soldDate:"2025-12-04",daysOnMarket:11,status:"sold",_source:"sold_api",photo:"https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80",neighborhood:"Outer Sunset",pricePerSqft:962,description:"Turnkey 3BR/2BA with a thoughtful remodel throughout. Open-concept main level, designer kitchen with waterfall island, and spa-inspired primary bath. South-facing backyard floods the home with natural light. Finished lower level with bonus room. Walk to Ocean Beach and Outerlands." },
  { id:"pps6",zpid:"15706556",address:"755 Kirkham St",city:"San Francisco",state:"CA",zip:"94122",beds:2,baths:2,sqft:1250,lotSqft:0,yearBuilt:1962,propertyType:"Condo",listPrice:849000,zestimate:880000,soldPrice:865000,soldDate:"2026-01-18",daysOnMarket:31,status:"sold",_source:"sold_api",photo:"https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80",neighborhood:"Inner Sunset",pricePerSqft:692,description:"Top-floor 2BR/2BA condo in a boutique 6-unit building. In-unit laundry, one-car deeded parking, and private storage. Updated kitchen with dishwasher. Dual-pane windows and radiant heat keep it cozy. HOA covers water, garbage, and common insurance. Steps to GG Park and N-Judah." },
  { id:"pps7",zpid:"15807667",address:"2415 47th Ave",city:"San Francisco",state:"CA",zip:"94116",beds:3,baths:1,sqft:1280,lotSqft:2500,yearBuilt:1940,propertyType:"Single Family",listPrice:1095000,zestimate:1140000,soldPrice:1160000,soldDate:"2025-11-11",daysOnMarket:16,status:"sold",_source:"sold_api",photo:"https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80",neighborhood:"Parkside",pricePerSqft:906,description:"Classic 3BR/1BA Parkside home with garage and full basement. Updated kitchen with granite counters. Freshly painted interior and refinished hardwood floors. Large backyard perfect for entertaining. Nearby parks, schools, and public transit. A great entry point into SF homeownership." },
  { id:"pps8",zpid:"15908778",address:"1347 10th Ave",city:"San Francisco",state:"CA",zip:"94122",beds:4,baths:3,sqft:2400,lotSqft:2800,yearBuilt:1950,propertyType:"Single Family",listPrice:1850000,zestimate:1920000,soldPrice:1975000,soldDate:"2026-01-25",daysOnMarket:8,status:"sold",_source:"sold_api",photo:"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",neighborhood:"Inner Sunset",pricePerSqft:823,description:"Stunning 4BR/3BA with panoramic views from Sutro Tower to downtown. Fully renovated top to bottom — open chef's kitchen, marble baths, and white oak floors. Two-car garage, large deck, and landscaped yard. Legal in-law unit on lower level with separate entrance. An exceptional Inner Sunset offering." },
  { id:"pps9",zpid:"16009889",address:"1633 38th Ave",city:"San Francisco",state:"CA",zip:"94122",beds:2,baths:1,sqft:1050,lotSqft:2500,yearBuilt:1936,propertyType:"Single Family",listPrice:949000,zestimate:990000,soldPrice:1010000,soldDate:"2025-09-28",daysOnMarket:19,status:"sold",_source:"sold_api",photo:"https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80",neighborhood:"Outer Sunset",pricePerSqft:962,description:"Cozy 2BR/1BA starter home with tons of potential. Original layout with separate living and dining rooms. Full basement ready for expansion (plans available). Sunny rear yard with fruit trees. One block from Sunset Blvd transit. Estate sale — priced to sell as-is." },
  { id:"pps10",zpid:"16110990",address:"1982 22nd Ave",city:"San Francisco",state:"CA",zip:"94122",beds:3,baths:2,sqft:1700,lotSqft:2500,yearBuilt:1946,propertyType:"Single Family",listPrice:1495000,zestimate:1560000,soldPrice:1545000,soldDate:"2025-10-14",daysOnMarket:13,status:"sold",_source:"sold_api",photo:"https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",neighborhood:"Central Sunset",pricePerSqft:909,description:"Move-in ready 3BR/2BA with a flexible floor plan. Renovated kitchen with breakfast bar, updated bathrooms, and gleaming hardwood throughout. Large primary suite with walk-in closet. Finished garage with laundry. Excellent Central Sunset location near shopping, dining, and express bus lines." },
];

// ── Launch Markets — 4 cities with neighborhoods ──
const LAUNCH_MARKETS = [
  {
    id: "sf", name: "San Francisco", state: "CA", icon: "landmark",
    zips: ["94102","94103","94104","94105","94107","94108","94109","94110","94111","94112","94114","94115","94116","94117","94118","94119","94120","94121","94122","94123","94124","94127","94129","94130","94131","94132","94133","94134","94158"],
    neighborhoods: [
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
    ],
  },
  {
    id: "oakland", name: "Oakland", state: "CA", icon: "home",
    zips: ["94601","94602","94603","94605","94606","94607","94608","94609","94610","94611","94612","94613","94618","94619","94621"],
    neighborhoods: [
      { name: "All of Oakland", zip: null },
      { name: "Rockridge", zip: "94618" },
      { name: "Temescal", zip: "94609" },
      { name: "Montclair", zip: "94611" },
      { name: "Lake Merritt", zip: "94612" },
      { name: "Grand Lake", zip: "94610" },
      { name: "Piedmont Ave", zip: "94611" },
      { name: "Fruitvale", zip: "94601" },
      { name: "Jack London", zip: "94607" },
      { name: "West Oakland", zip: "94608" },
      { name: "East Oakland", zip: "94621" },
      { name: "Dimond", zip: "94602" },
      { name: "Laurel", zip: "94619" },
    ],
  },
  {
    id: "berkeley", name: "Berkeley", state: "CA", icon: "graduation-cap",
    zips: ["94702","94703","94704","94705","94706","94707","94708","94709","94710"],
    neighborhoods: [
      { name: "All of Berkeley", zip: null },
      { name: "North Berkeley", zip: "94707" },
      { name: "South Berkeley", zip: "94703" },
      { name: "West Berkeley", zip: "94710" },
      { name: "Elmwood", zip: "94705" },
      { name: "Claremont", zip: "94705" },
      { name: "Berkeley Hills", zip: "94708" },
      { name: "Downtown", zip: "94704" },
    ],
  },
  {
    id: "alameda", name: "Alameda", state: "CA", icon: "landmark",
    zips: ["94501","94502"],
    neighborhoods: [
      { name: "All of Alameda", zip: null },
      { name: "West End", zip: "94501" },
      { name: "East End", zip: "94501" },
      { name: "Bay Farm Island", zip: "94502" },
    ],
  },
  {
    id: "la", name: "Los Angeles", state: "CA", icon: "sun",
    zips: ["90004","90005","90006","90007","90008","90010","90011","90012","90013","90014","90015","90016","90017","90018","90019","90020","90023","90024","90025","90026","90027","90028","90029","90031","90032","90033","90034","90035","90036","90037","90038","90039","90041","90042","90043","90044","90045","90046","90047","90048","90049","90056","90057","90058","90059","90061","90062","90063","90064","90065","90066","90067","90068","90069","90071","90077","90089","90090","90094","90095","90210","90212","90230","90232","90245","90247","90248","90249","90250","90254","90260","90266","90272","90274","90275","90277","90278","90290","90291","90292","90293","90301","90302","90303","90304","90305","90401","90402","90403","90404","90405"],
    neighborhoods: [
      { name: "All of LA", zip: null },
      { name: "Hollywood", zip: "90028" },
      { name: "Silver Lake", zip: "90026" },
      { name: "Echo Park", zip: "90026" },
      { name: "Los Feliz", zip: "90027" },
      { name: "West Hollywood", zip: "90046" },
      { name: "Beverly Hills", zip: "90210" },
      { name: "Santa Monica", zip: "90401" },
      { name: "Venice", zip: "90291" },
      { name: "Mar Vista", zip: "90066" },
      { name: "Culver City", zip: "90232" },
      { name: "Westwood", zip: "90024" },
      { name: "Brentwood", zip: "90049" },
      { name: "Pacific Palisades", zip: "90272" },
      { name: "Highland Park", zip: "90042" },
      { name: "Eagle Rock", zip: "90041" },
      { name: "Atwater Village", zip: "90039" },
      { name: "Koreatown", zip: "90020" },
      { name: "Mid-Wilshire", zip: "90036" },
      { name: "Hancock Park", zip: "90004" },
      { name: "Downtown LA", zip: "90012" },
      { name: "Arts District", zip: "90013" },
      { name: "Inglewood", zip: "90301" },
      { name: "Hermosa Beach", zip: "90254" },
      { name: "Manhattan Beach", zip: "90266" },
      { name: "Redondo Beach", zip: "90277" },
      { name: "El Segundo", zip: "90245" },
      { name: "Palos Verdes", zip: "90274" },
      { name: "Playa del Rey", zip: "90293" },
      { name: "Westchester", zip: "90045" },
    ],
  },
  {
    id: "sd", name: "San Diego", state: "CA", icon: "sun",
    zips: ["92101","92102","92103","92104","92105","92106","92107","92108","92109","92110","92111","92113","92114","92115","92116","92117","92118","92119","92120","92121","92122","92123","92124","92126","92127","92128","92129","92130","92131","92132","92134","92135","92136","92139","92140","92145","92147","92152","92154","92155","92173","92176"],
    neighborhoods: [
      { name: "All of SD", zip: null },
      { name: "Downtown", zip: "92101" },
      { name: "North Park", zip: "92104" },
      { name: "Hillcrest", zip: "92103" },
      { name: "South Park", zip: "92102" },
      { name: "Mission Hills", zip: "92103" },
      { name: "Pacific Beach", zip: "92109" },
      { name: "Ocean Beach", zip: "92107" },
      { name: "Point Loma", zip: "92106" },
      { name: "La Jolla", zip: "92037" },
      { name: "Clairemont", zip: "92117" },
      { name: "Kensington", zip: "92116" },
      { name: "Normal Heights", zip: "92116" },
      { name: "University Heights", zip: "92104" },
      { name: "Bay Park", zip: "92110" },
      { name: "Carmel Valley", zip: "92130" },
      { name: "Rancho Bernardo", zip: "92127" },
      { name: "Scripps Ranch", zip: "92131" },
      { name: "Del Cerro", zip: "92120" },
      { name: "Coronado", zip: "92118" },
    ],
  },
  {
    id: "seattle", name: "Seattle", state: "WA", icon: "cloud",
    zips: ["98101","98102","98103","98104","98105","98106","98107","98108","98109","98112","98115","98116","98117","98118","98119","98121","98122","98125","98126","98133","98134","98136","98144","98146","98154","98164","98174","98177","98178","98195","98199"],
    neighborhoods: [
      { name: "All of Seattle", zip: null },
      { name: "Capitol Hill", zip: "98102" },
      { name: "Ballard", zip: "98107" },
      { name: "Fremont", zip: "98103" },
      { name: "Wallingford", zip: "98103" },
      { name: "Green Lake", zip: "98103" },
      { name: "Queen Anne", zip: "98109" },
      { name: "Magnolia", zip: "98199" },
      { name: "West Seattle", zip: "98116" },
      { name: "Columbia City", zip: "98118" },
      { name: "Beacon Hill", zip: "98108" },
      { name: "Georgetown", zip: "98108" },
      { name: "University District", zip: "98105" },
      { name: "Ravenna", zip: "98115" },
      { name: "Wedgwood", zip: "98115" },
      { name: "Madison Park", zip: "98112" },
      { name: "Leschi", zip: "98122" },
      { name: "SoDo", zip: "98134" },
      { name: "Northgate", zip: "98125" },
      { name: "Lake City", zip: "98125" },
    ],
  },
  {
    id: "miami", name: "Miami", state: "FL", icon: "sun",
    zips: ["33125","33126","33127","33128","33129","33130","33131","33132","33133","33134","33135","33136","33137","33138","33139","33140","33141","33142","33143","33144","33145","33146","33147","33149","33150","33154","33155","33156","33157","33158","33160","33161","33162","33165","33166","33167","33168","33169","33170","33172","33173","33174","33175","33176","33177","33178","33179","33180","33181","33182","33183","33184","33185","33186","33187","33189","33190","33193","33194","33196"],
    neighborhoods: [
      { name: "All of Miami", zip: null },
      { name: "Brickell", zip: "33131" },
      { name: "Downtown", zip: "33132" },
      { name: "Wynwood", zip: "33127" },
      { name: "Edgewater", zip: "33137" },
      { name: "Midtown", zip: "33137" },
      { name: "Design District", zip: "33137" },
      { name: "Coconut Grove", zip: "33133" },
      { name: "Coral Gables", zip: "33134" },
      { name: "Little Havana", zip: "33135" },
      { name: "Miami Beach", zip: "33139" },
      { name: "South Beach", zip: "33139" },
      { name: "North Beach", zip: "33141" },
      { name: "Surfside", zip: "33154" },
      { name: "Bal Harbour", zip: "33154" },
      { name: "Key Biscayne", zip: "33149" },
      { name: "Doral", zip: "33178" },
      { name: "Kendall", zip: "33176" },
      { name: "Pinecrest", zip: "33156" },
      { name: "Aventura", zip: "33180" },
    ],
  },
  {
    id: "nyc", name: "New York City", state: "NY", icon: "landmark",
    zips: ["10001","10002","10003","10004","10005","10006","10007","10009","10010","10011","10012","10013","10014","10016","10017","10018","10019","10020","10021","10022","10023","10024","10025","10026","10027","10028","10029","10030","10031","10032","10033","10034","10035","10036","10037","10038","10039","10040","10044","10065","10069","10075","10128","10280","10282","11201","11205","11206","11207","11208","11209","11210","11211","11212","11213","11214","11215","11216","11217","11218","11219","11220","11221","11222","11223","11224","11225","11226","11228","11229","11230","11231","11232","11233","11234","11235","11236","11237","11238","11239","10301","10302","10303","10304","10305","10306","10307","10308","10309","10310","10312","10314","10451","10452","10453","10454","10455","10456","10457","10458","10459","10460","10461","10462","10463","10464","10465","10466","10467","10468","10469","10470","10471","10472","10473","10474","10475"],
    neighborhoods: [
      { name: "All of NYC", zip: null },
      { name: "Upper East Side", zip: "10021" },
      { name: "Upper West Side", zip: "10024" },
      { name: "Tribeca", zip: "10013" },
      { name: "SoHo", zip: "10012" },
      { name: "West Village", zip: "10014" },
      { name: "East Village", zip: "10009" },
      { name: "Chelsea", zip: "10011" },
      { name: "Midtown", zip: "10019" },
      { name: "Harlem", zip: "10027" },
      { name: "Washington Heights", zip: "10032" },
      { name: "Lower East Side", zip: "10002" },
      { name: "FiDi", zip: "10005" },
      { name: "Williamsburg", zip: "11211" },
      { name: "Park Slope", zip: "11215" },
      { name: "DUMBO", zip: "11201" },
      { name: "Brooklyn Heights", zip: "11201" },
      { name: "Bushwick", zip: "11237" },
      { name: "Bed-Stuy", zip: "11216" },
      { name: "Crown Heights", zip: "11225" },
      { name: "Greenpoint", zip: "11222" },
      { name: "Prospect Heights", zip: "11238" },
      { name: "Bay Ridge", zip: "11209" },
      { name: "Astoria", zip: "11102" },
      { name: "Long Island City", zip: "11101" },
    ],
  },
  {
    id: "chicago", name: "Chicago", state: "IL", icon: "landmark",
    zips: ["60601","60602","60603","60604","60605","60606","60607","60608","60609","60610","60611","60612","60613","60614","60615","60616","60617","60618","60619","60620","60621","60622","60623","60624","60625","60626","60628","60629","60630","60631","60632","60633","60634","60636","60637","60638","60639","60640","60641","60642","60643","60644","60645","60646","60647","60649","60651","60652","60653","60654","60655","60656","60657","60659","60660","60661"],
    neighborhoods: [
      { name: "All of Chicago", zip: null },
      { name: "Lincoln Park", zip: "60614" },
      { name: "Lakeview", zip: "60657" },
      { name: "Wicker Park", zip: "60622" },
      { name: "Bucktown", zip: "60647" },
      { name: "Logan Square", zip: "60647" },
      { name: "West Loop", zip: "60607" },
      { name: "South Loop", zip: "60605" },
      { name: "Old Town", zip: "60610" },
      { name: "River North", zip: "60654" },
      { name: "Gold Coast", zip: "60610" },
      { name: "Andersonville", zip: "60640" },
      { name: "Ravenswood", zip: "60625" },
      { name: "Hyde Park", zip: "60615" },
      { name: "Pilsen", zip: "60608" },
      { name: "Bridgeport", zip: "60609" },
      { name: "Uptown", zip: "60640" },
      { name: "Rogers Park", zip: "60626" },
      { name: "Edgewater", zip: "60660" },
      { name: "Irving Park", zip: "60618" },
    ],
  },
  {
    id: "denver", name: "Denver", state: "CO", icon: "landmark",
    zips: ["80002","80003","80004","80005","80010","80011","80012","80013","80014","80015","80016","80017","80018","80019","80020","80021","80022","80023","80024","80030","80031","80033","80110","80111","80112","80113","80120","80121","80122","80123","80124","80126","80127","80128","80129","80130","80134","80138","80150","80160","80162","80163","80201","80202","80203","80204","80205","80206","80207","80209","80210","80211","80212","80214","80215","80216","80218","80219","80220","80221","80222","80223","80224","80226","80227","80228","80229","80230","80231","80232","80233","80234","80235","80236","80237","80238","80239","80241","80246","80247","80249","80260","80264","80290"],
    neighborhoods: [
      { name: "All of Denver", zip: null },
      { name: "LoDo", zip: "80202" },
      { name: "RiNo", zip: "80205" },
      { name: "Capitol Hill", zip: "80203" },
      { name: "Cherry Creek", zip: "80206" },
      { name: "Wash Park", zip: "80209" },
      { name: "Highland", zip: "80211" },
      { name: "LoHi", zip: "80211" },
      { name: "Sloan's Lake", zip: "80212" },
      { name: "Baker", zip: "80223" },
      { name: "Congress Park", zip: "80206" },
      { name: "City Park", zip: "80205" },
      { name: "Park Hill", zip: "80207" },
      { name: "Stapleton", zip: "80238" },
      { name: "Platt Park", zip: "80210" },
      { name: "Englewood", zip: "80110" },
      { name: "Littleton", zip: "80120" },
      { name: "Aurora", zip: "80012" },
    ],
  },
  {
    id: "portland", name: "Portland", state: "OR", icon: "cloud",
    zips: ["97201","97202","97203","97204","97205","97206","97209","97210","97211","97212","97213","97214","97215","97216","97217","97218","97219","97220","97221","97222","97223","97224","97225","97227","97229","97230","97231","97232","97233","97236","97239","97266"],
    neighborhoods: [
      { name: "All of Portland", zip: null },
      { name: "Pearl District", zip: "97209" },
      { name: "Alberta", zip: "97211" },
      { name: "Hawthorne", zip: "97214" },
      { name: "Division", zip: "97202" },
      { name: "Sellwood", zip: "97202" },
      { name: "Mississippi", zip: "97217" },
      { name: "St. Johns", zip: "97203" },
      { name: "Nob Hill", zip: "97210" },
      { name: "Irvington", zip: "97212" },
      { name: "Laurelhurst", zip: "97215" },
      { name: "Boise", zip: "97211" },
      { name: "Foster-Powell", zip: "97206" },
      { name: "Woodstock", zip: "97206" },
      { name: "Lake Oswego", zip: "97034" },
      { name: "Tigard", zip: "97223" },
    ],
  },
  {
    id: "boston", name: "Boston", state: "MA", icon: "landmark",
    zips: ["02108","02109","02110","02111","02113","02114","02115","02116","02118","02119","02120","02121","02122","02124","02125","02126","02127","02128","02129","02130","02131","02132","02134","02135","02136","02163","02199","02210","02215"],
    neighborhoods: [
      { name: "All of Boston", zip: null },
      { name: "Back Bay", zip: "02116" },
      { name: "South End", zip: "02118" },
      { name: "Beacon Hill", zip: "02108" },
      { name: "North End", zip: "02113" },
      { name: "Seaport", zip: "02210" },
      { name: "Fenway", zip: "02215" },
      { name: "Jamaica Plain", zip: "02130" },
      { name: "South Boston", zip: "02127" },
      { name: "Dorchester", zip: "02122" },
      { name: "Charlestown", zip: "02129" },
      { name: "East Boston", zip: "02128" },
      { name: "Brighton", zip: "02135" },
      { name: "Allston", zip: "02134" },
      { name: "Roxbury", zip: "02119" },
      { name: "West Roxbury", zip: "02132" },
      { name: "Roslindale", zip: "02131" },
      { name: "Cambridge", zip: "02138" },
      { name: "Somerville", zip: "02143" },
    ],
  },
  {
    id: "phoenix", name: "Phoenix", state: "AZ", icon: "sun",
    zips: ["85003","85004","85006","85007","85008","85009","85012","85013","85014","85015","85016","85017","85018","85019","85020","85021","85022","85023","85024","85027","85028","85029","85031","85032","85033","85034","85035","85037","85040","85041","85042","85043","85044","85045","85048","85050","85051","85053","85054","85083","85085","85086","85087","85251","85253","85254","85255","85256","85257","85258","85259","85260","85262","85266","85268","85281","85282","85283","85284"],
    neighborhoods: [
      { name: "All of Phoenix", zip: null },
      { name: "Downtown", zip: "85004" },
      { name: "Arcadia", zip: "85018" },
      { name: "Biltmore", zip: "85016" },
      { name: "Paradise Valley", zip: "85253" },
      { name: "Scottsdale", zip: "85251" },
      { name: "North Scottsdale", zip: "85260" },
      { name: "Tempe", zip: "85281" },
      { name: "Chandler", zip: "85224" },
      { name: "Gilbert", zip: "85234" },
      { name: "Mesa", zip: "85201" },
      { name: "Camelback East", zip: "85016" },
      { name: "Encanto", zip: "85006" },
      { name: "North Mountain", zip: "85020" },
      { name: "Ahwatukee", zip: "85044" },
      { name: "Desert Ridge", zip: "85050" },
      { name: "Norterra", zip: "85085" },
      { name: "Laveen", zip: "85339" },
    ],
  },
];

// Backward compat: SF_NEIGHBORHOODS points to the SF market neighborhoods
const SF_NEIGHBORHOODS = LAUNCH_MARKETS[0].neighborhoods;

// Reverse lookup: zip → neighborhood name (all markets)
const ZIP_TO_HOOD = {};
LAUNCH_MARKETS.forEach(m => {
  m.neighborhoods.forEach(h => {
    if (h.zip && !ZIP_TO_HOOD[h.zip]) ZIP_TO_HOOD[h.zip] = h.name;
  });
});

// Resolve neighborhood: zip lookup (our markets) → API field → city fallback
// Zip-based lookup takes priority because Zillow neighborhood labels often
// don't match zip boundaries (e.g. Zillow may label a 94122 property as
// "Noe Valley" when it's in the Sunset zip). Our markets define the
// authoritative neighborhood-to-zip mapping.
const resolveNeighborhood = (listing) =>
  (listing.zip && ZIP_TO_HOOD[listing.zip]) || listing.neighborhood || listing.city || "Unknown Area";

// ═══════════════════════════════════════════════════════════════
// ── Level-Up Sound (Web Audio API — ascending C-E-G-C chord) ──
const playLevelUpSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.6);
    });
    // Shimmer overlay — high soft tone
    const shimmer = ctx.createOscillator();
    const sGain = ctx.createGain();
    shimmer.type = "triangle";
    shimmer.frequency.value = 2093; // C7
    sGain.gain.setValueAtTime(0, ctx.currentTime + 0.4);
    sGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.5);
    sGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    shimmer.connect(sGain);
    sGain.connect(ctx.destination);
    shimmer.start(ctx.currentTime + 0.4);
    shimmer.stop(ctx.currentTime + 1.2);
  } catch (e) { /* Audio not available — silent fallback */ }
};

// ── Data Version — bump this to force all clients to clear stale localStorage and re-fetch ──
// v2: added _source field for mode separation (sold_api vs active_api)
const PP_DATA_VERSION = 2;
function migrateLocalStorage() {
  try {
    const stored = parseInt(localStorage.getItem("pp-data-version") || "0", 10);
    if (stored < PP_DATA_VERSION) {
      // Clear stale listing data (keep player ID, display name, market selection)
      localStorage.removeItem("pp-sold-listings");
      localStorage.removeItem("pp-all-results");
      localStorage.removeItem("pp-daily-result");
      localStorage.removeItem("pp-predictions");
      localStorage.setItem("pp-data-version", String(PP_DATA_VERSION));
      console.log(`[PricePoint] Data version upgraded ${stored} → ${PP_DATA_VERSION}, cleared stale listings`);
      return true; // signal: need fresh fetch
    }
  } catch {}
  return false;
}

// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function PricePoint({ T, isDesktop, FONT, onRunNumbers, onBackToBlueprint, onOpenMarkets, realtorPartner, appMode, setAppMode, sidebarTab, sidebarTabKey, onTabChange }) {
  // Run migration BEFORE any useState initializers read localStorage
  const [needsFreshFetch] = useState(() => migrateLocalStorage());

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
  const [liveHoodFilter, setLiveHoodFilter] = useState(null); // null = all, or zip string
  const [liveHoodName, setLiveHoodName] = useState(null); // display name of selected neighborhood
  const [livePrediction, setLivePrediction] = useState(null);
  const [allPredictions, setAllPredictions] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pp-predictions")) || []; } catch { return []; }
  });
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [showMarketSwitcher, setShowMarketSwitcher] = useState(false);

  // ── Level-Up Celebration ──
  const [levelUpData, setLevelUpData] = useState(null); // { newLevel, oldLevel, xp }
  const [showLevelUpShare, setShowLevelUpShare] = useState(false);
  const prevLevelRef = useRef(null);

  // ── Supabase Player ID (anonymous-first) ──
  const [playerId, setPlayerId] = useState(() => {
    try { return localStorage.getItem('pp-player-id') || null; } catch { return null; }
  });
  const [supabaseDaily, setSupabaseDaily] = useState(null); // server-side daily challenge

  // ── Property Details (lazy-fetched for Live mode: photos + description) ──
  const [propertyDetails, setPropertyDetails] = useState({}); // keyed by zpid
  const [detailsLoading, setDetailsLoading] = useState(null); // zpid currently loading
  const detailsCacheRef = useRef({}); // persist across re-renders

  const fetchingRef = useRef({}); // track in-flight fetches to avoid duplicates
  const fetchPropertyDetails = useCallback(async (zpid) => {
    if (!zpid) return;
    // Already have it cached WITH content — just ensure state is synced
    const cached = detailsCacheRef.current[zpid];
    if (cached && (cached.photos?.length > 0 || cached.description)) {
      setPropertyDetails(prev => prev[zpid] ? prev : { ...prev, [zpid]: cached });
      return;
    }
    // Already fetching this zpid
    if (fetchingRef.current[zpid]) return;
    fetchingRef.current[zpid] = true;
    setDetailsLoading(zpid);
    try {
      const res = await fetch(`/api/propertydetails?zpid=${zpid}`);
      if (res.ok) {
        const data = await res.json();
        // Only cache results that have actual content (photos or description)
        // Empty results will be re-fetched next time
        if (data.photos?.length > 0 || data.description) {
          detailsCacheRef.current[zpid] = data;
        }
        setPropertyDetails(prev => ({ ...prev, [zpid]: data }));
      }
    } catch (e) {
      console.error("[PricePoint] Failed to fetch details for zpid", zpid, e);
    } finally {
      fetchingRef.current[zpid] = false;
      setDetailsLoading(prev => prev === zpid ? null : prev);
    }
  }, []);

  // Auto-fetch details when live listing changes — prefetch current + next 3 in PARALLEL
  useEffect(() => {
    if (view === "live" && liveListings.length > 0) {
      const zpids = liveListings.slice(liveIdx, liveIdx + 4).map(l => l?.zpid).filter(Boolean);
      if (zpids.length) Promise.all(zpids.map(z => fetchPropertyDetails(z)));
    }
  }, [view, liveIdx, liveListings, fetchPropertyDetails]);

  // Auto-fetch details for Free Play — prefetch current + next 2 in PARALLEL
  useEffect(() => {
    if (view === "freeplay" && fpListings.length > 0) {
      const zpids = fpListings.slice(fpIdx, fpIdx + 3).map(l => l?.zpid).filter(Boolean);
      if (zpids.length) Promise.all(zpids.map(z => fetchPropertyDetails(z)));
    }
  }, [view, fpIdx, fpListings, fetchPropertyDetails]);

  // ── Countdown ──
  const [countdown, setCountdown] = useState("");

  // ── Stats Tabs ──
  const [statsTab, setStatsTab] = useState("daily"); // "daily", "freeplay", or "live"
  const [leaderboardTab, setLeaderboardTab] = useState("today"); // "today", "weekly", or "alltime"
  const [leaderboardMode, setLeaderboardMode] = useState("daily"); // "daily", "free", or "live"
  const [lbData, setLbData] = useState([]); // Supabase leaderboard rows
  const [lbLoading, setLbLoading] = useState(false);

  // ── Nickname ──
  const [showNicknamePrompt, setShowNicknamePrompt] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [displayName, setDisplayName] = useState(() => {
    try { return localStorage.getItem('pp-display-name') || ""; } catch { return ""; }
  });

  // ── Refs ──
  const revealCounterRef = useRef(null);

  // ── Derived ──
  const dailyNumber = getDailyNumber();
  const dailyProperty = useMemo(() => getDailyProperty(soldListings, market?.label || ""), [soldListings, market]);
  const xp = useMemo(() => calcXP(allResults), [allResults]);
  const currentLevel = useMemo(() => getLevel(xp), [xp]);
  const nextLevel = useMemo(() => LEVELS.find(l => l.req > xp), [xp]);

  // ── Detect level-up and trigger celebration ──
  useEffect(() => {
    if (prevLevelRef.current === null) {
      // First render — just store, don't celebrate
      prevLevelRef.current = currentLevel.level;
      return;
    }
    if (currentLevel.level > prevLevelRef.current) {
      const oldLevel = LEVELS.find(l => l.level === prevLevelRef.current) || LEVELS[0];
      setLevelUpData({ newLevel: currentLevel, oldLevel, xp });
      // Haptic feedback + sound
      if (navigator.vibrate) navigator.vibrate([50, 30, 100, 50, 200]);
      playLevelUpSound();
      // Auto-dismiss after 4.5s → show share card
      setTimeout(() => {
        setLevelUpData(null);
        setShowLevelUpShare(true);
      }, 4500);
    }
    prevLevelRef.current = currentLevel.level;
  }, [currentLevel.level]);

  // ── Nickname prompt — show after 3rd guess if no display_name set ──
  const nicknamePromptShownRef = useRef(false);
  useEffect(() => {
    if (
      allResults.length >= 3 &&
      !displayName &&
      !nicknamePromptShownRef.current &&
      !showNicknamePrompt &&
      !levelUpData &&
      !showLevelUpShare &&
      playerId
    ) {
      // Small delay so it doesn't collide with the reveal animation
      const timer = setTimeout(() => {
        nicknamePromptShownRef.current = true;
        setShowNicknamePrompt(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [allResults.length, displayName, playerId, levelUpData, showLevelUpShare]);

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

  // ── Persistence (debounced single write — avoids 5 separate effects thrashing localStorage) ──
  const persistTimerRef = useRef(null);
  useEffect(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      try {
        if (market) { localStorage.setItem("pp-market", JSON.stringify(market)); localStorage.setItem("pp-location-label", locationLabel || ""); }
        localStorage.setItem("pp-all-results", JSON.stringify(allResults));
        if (dailyResult) localStorage.setItem("pp-daily-result", JSON.stringify(dailyResult));
        if (soldListings !== SAMPLE_SOLD) localStorage.setItem("pp-sold-listings", JSON.stringify(soldListings));
        localStorage.setItem("pp-predictions", JSON.stringify(allPredictions));
      } catch {}
    }, 500);
    return () => { if (persistTimerRef.current) clearTimeout(persistTimerRef.current); };
  }, [market, locationLabel, allResults, dailyResult, soldListings, allPredictions]);

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

  // ── Supabase: Register anonymous player + fetch server-side daily ──
  useEffect(() => {
    const initSupabase = async () => {
      try {
        const marketId = market?.id || 'sf';
        // 1. Get or create player
        let pid = playerId;
        if (!pid) {
          pid = await getOrCreatePlayer(marketId);
          if (pid) {
            setPlayerId(pid);
            try { localStorage.setItem('pp-player-id', pid); } catch {}
          }
        }
        // 2. Fetch today's server-side daily challenge
        const daily = await fetchDaily(marketId);
        if (daily) {
          setSupabaseDaily(daily);
          // Check if we already guessed (e.g. returning user)
          if (pid && daily.id) {
            const existing = await getExistingDailyGuess(pid, daily.id);
            if (existing && !dailyResult) {
              // Player already guessed today — reconstruct result from DB
              // (The sold_price reveal comes via separate API call)
              console.log('[PricePoint] Existing daily guess found in Supabase');
            }
          }
        }
      } catch (err) {
        console.warn('[PricePoint] Supabase init failed (offline mode):', err.message);
      }
    };
    if (market) initSupabase();
  }, [market?.id]);

  // ── Fetch leaderboard from Supabase when mode/tab/market changes ──
  useEffect(() => {
    const fetchLB = async () => {
      if (!market?.id) return;
      setLbLoading(true);
      try {
        const periodMap = { today: 'today', weekly: 'week', alltime: 'all' };
        const modeMap = { daily: 'daily', free: 'freeplay', live: 'live' };
        const rows = await getLeaderboard(
          market.id,
          modeMap[leaderboardMode] || 'daily',
          periodMap[leaderboardTab] || 'all',
          20
        );
        setLbData(rows || []);
      } catch (err) {
        console.warn('[PricePoint] Leaderboard fetch failed:', err.message);
        setLbData([]);
      }
      setLbLoading(false);
    };
    fetchLB();
  }, [market?.id, leaderboardMode, leaderboardTab]);

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

  // ── Auto-fetch — fetch fresh data when market is set, or after version migration ──
  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (!market) return;
    const needsData = soldListings === SAMPLE_SOLD || activeListings.length === 0 || needsFreshFetch;
    if (needsData && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      // After version migration, bypass CDN cache to get data with _source tags
      fetchListings(market.zip || market.city || market.label, needsFreshFetch);
    }
  }, [market]);

  // ── Fetch listings from API ──
  const fetchListings = useCallback(async (searchValue, bypassCache = false) => {
    if (!searchValue || searchValue.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const isZip = /^\d{5}$/.test(searchValue.trim());
      let params = isZip ? `zip=${searchValue.trim()}` : `city=${encodeURIComponent(searchValue.trim())}&state=CA`;
      if (bypassCache) params += "&fresh=1";
      const resp = await fetch(`/api/pricepoint?${params}`);
      if (!resp.ok) throw new Error(`API returned ${resp.status}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      // ── Clean ingestion: trust _source tags, no heuristics ──
      // Active listings (_source: "active_api") → Live mode pool
      if (data.activeListings && data.activeListings.length > 0) {
        setActiveListings(data.activeListings);
      }
      // Sold listings (_source: "sold_api") → Free Play pool
      // Merge with existing (SAMPLE_SOLD + prior data), deduplicate by zpid
      if (data.soldListings && data.soldListings.length > 0) {
        setSoldListings(prev => {
          const existingZpids = new Set(prev.map(l => l.zpid));
          const newOnes = data.soldListings.filter(l => !existingZpids.has(l.zpid));
          return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
        });
        const label = data.location || searchValue;
        setLocationLabel(label);
        return { success: true, label };
      } else if (data.activeListings && data.activeListings.length > 0) {
        // We got active but no sold — still a partial success
        const label = data.location || searchValue;
        setLocationLabel(label);
        return { success: true, label };
      } else {
        setError("No listings found. Using sample data.");
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

  // ── Select a launch market (from picker or switcher) ──
  const selectMarket = async (launchMarket) => {
    const mkt = { id: launchMarket.id, city: launchMarket.name, label: `${launchMarket.name}, ${launchMarket.state}`, zip: launchMarket.zips[0] };
    setMarket(mkt);
    setLocationLabel(mkt.label);
    setShowMarketSwitcher(false);
    try { localStorage.setItem("pp-market", JSON.stringify(mkt)); localStorage.setItem("pp-location-label", mkt.label); } catch {}
    await fetchListings(launchMarket.name);
    if (dailyResult && dailyResult.dailyNumber === dailyNumber) setView("postDaily");
    else if (view === "onboarding") setView("daily");
  };

  // ── Legacy: Set Market from text input (backward compat) ──
  const handleSetMarket = async () => {
    const val = marketInput.trim();
    if (!val) return;
    // Check if input matches a launch market
    const match = LAUNCH_MARKETS.find(m => m.name.toLowerCase() === val.toLowerCase() || m.zips.includes(val));
    if (match) { selectMarket(match); return; }
    const isZip = /^\d{5}$/.test(val);
    const result = await fetchListings(val);
    const label = result?.label || val;
    const mkt = isZip ? { zip: val, label } : { city: val, label };
    setMarket(mkt);
    setLocationLabel(label);
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

  // ── Save nickname ──
  const handleSaveNickname = async () => {
    const name = nicknameInput.trim();
    if (!name || name.length < 2) return;
    setNicknameSaving(true);
    const success = await updateDisplayName(playerId, name);
    if (success) {
      setDisplayName(name);
      try { localStorage.setItem('pp-display-name', name); } catch {}
      setShowNicknamePrompt(false);
    }
    setNicknameSaving(false);
  };

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

    // ── Supabase: persist daily guess (fire-and-forget) ──
    if (playerId) {
      const pctOffRound = parseFloat(pctOff.toFixed(1));
      const band = getAccuracyBand(pctOffRound);
      const xpEarned = getXpForGuess(pctOffRound);
      const newTotalXp = calcXP([...allResults, result]);
      const newLevel = getLevel(newTotalXp);
      submitGuess({
        playerId, marketId: market?.id || 'sf', mode: 'daily',
        dailyId: supabaseDaily?.id || null,
        zpid: dailyProperty.zpid || null,
        address: dailyProperty.address, neighborhood: dailyProperty.neighborhood,
        city: dailyProperty.city, zip: dailyProperty.zip,
        propertyType: dailyProperty.propertyType || '',
        beds: dailyProperty.beds, baths: dailyProperty.baths, sqft: dailyProperty.sqft,
        listPrice: dailyProperty.listPrice, photo: dailyProperty.photo,
        guess: val, soldPrice: dailyProperty.soldPrice,
        pctOff: pctOffRound, accuracyBand: band, xpEarned,
      }).catch(e => console.warn('[PricePoint] Supabase daily guess failed:', e));
      syncPlayerXP(playerId, newTotalXp, newLevel.level)
        .catch(e => console.warn('[PricePoint] XP sync failed:', e));
    }
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
    const pctOffRound = parseFloat(pctOff.toFixed(1));
    setFpResult({
      guess: val, soldPrice: listing.soldPrice, listPrice: listing.listPrice,
      address: listing.address, neighborhood: listing.neighborhood,
      city: listing.city, state: listing.state, beds: listing.beds, baths: listing.baths,
      sqft: listing.sqft, photo: listing.photo, pctOff: pctOffRound,
      feedback, feedbackMessage: getRandomMessage(feedback), insight,
      dailyNumber: null, timestamp: Date.now(), revealed: true, isDaily: false,
    });
    const newResult = {
      guess: val, soldPrice: listing.soldPrice, pctOff: pctOffRound,
      revealed: true, isDaily: false, dailyNumber: null, timestamp: Date.now(),
      propertyType: listing.propertyType || null,
      neighborhood: listing.neighborhood || null,
      city: listing.city || null,
    };
    setAllResults(prev => [...prev, newResult]);

    // ── Supabase: persist free play guess (fire-and-forget) ──
    if (playerId) {
      const band = getAccuracyBand(pctOffRound);
      const xpEarned = getXpForGuess(pctOffRound);
      const newTotalXp = calcXP([...allResults, newResult]);
      const newLevel = getLevel(newTotalXp);
      submitGuess({
        playerId, marketId: market?.id || 'sf', mode: 'freeplay',
        zpid: listing.zpid || null,
        address: listing.address, neighborhood: listing.neighborhood,
        city: listing.city, zip: listing.zip,
        propertyType: listing.propertyType || '',
        beds: listing.beds, baths: listing.baths, sqft: listing.sqft,
        listPrice: listing.listPrice, photo: listing.photo,
        guess: val, soldPrice: listing.soldPrice,
        pctOff: pctOffRound, accuracyBand: band, xpEarned,
      }).catch(e => console.warn('[PricePoint] Supabase freeplay guess failed:', e));
      syncPlayerXP(playerId, newTotalXp, newLevel.level)
        .catch(e => console.warn('[PricePoint] XP sync failed:', e));
    }
  };
  const fpNextProperty = () => { setFpResult(null); setFpGuessInput(""); setMlsExpanded(false); setFpIdx(prev => prev + 1); };

  // ═══════════════════════════════════════════════════════════════
  // FIRST-PRINCIPLES MODE SEPARATION
  // ─────────────────────────────────────────────────────────────
  // The _source field (set by the API) is the ONLY truth for mode separation:
  //   _source === "sold_api"   → Free Play (sold in last 3 months)
  //   _source === "active_api" → Live mode (active + pending on market)
  //
  // enterFreePlay and enterLiveMode are SYNCHRONOUS — zero API calls.
  // All data is pre-loaded when the market is selected. Tapping a
  // neighborhood is an instant in-memory filter, not a network request.
  // ═══════════════════════════════════════════════════════════════

  // Trusted sold = came from the recentlySold API endpoint AND has a real soldPrice
  const isTrueSold = (l) => l._source === "sold_api" && l.soldPrice;
  // Trusted active = came from the forSale API endpoint (active or pending)
  const isTrueActive = (l) => l._source === "active_api";

  const enterFreePlay = (zip, hoodName) => {
    // Step 1: Filter to trusted sold listings only
    let trueSold = soldListings.filter(isTrueSold);

    // Step 2: Exclude daily spoilers
    const excludedIndices = getDailyIndices(trueSold, market?.label || "", 30);
    let pool = trueSold.filter((_, i) => !excludedIndices.has(i));

    // Step 3: Filter to zip if provided
    if (zip) pool = pool.filter(l => l.zip === zip);

    // Step 4: If zip filter left too few, relax daily exclusion
    if (zip && pool.length < 3) {
      pool = trueSold.filter(l => l.zip === zip);
    }

    // Step 5: Backfill with SAMPLE_SOLD (curated, always have _source:"sold_api")
    if (pool.length < 3) {
      const poolZpids = new Set(pool.map(l => l.zpid));
      const samples = (zip ? SAMPLE_SOLD.filter(l => l.zip === zip) : SAMPLE_SOLD).filter(l => !poolZpids.has(l.zpid));
      pool = [...pool, ...samples];
    }

    // Step 6: Final fallback
    if (pool.length === 0) {
      pool = zip ? SAMPLE_SOLD.filter(l => l.zip === zip) : [...SAMPLE_SOLD];
    }

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setFpListings(shuffled);
    setFpSelectedNeighborhood(hoodName || null);
    setFpIdx(0); setFpGuessInput(""); setFpResult(null); setView("freeplay");

    // Prefetch property details for first 3 in PARALLEL
    setTimeout(() => {
      const zpids = shuffled.slice(0, 3).map(l => l?.zpid).filter(Boolean);
      if (zpids.length) Promise.all(zpids.map(z => fetchPropertyDetails(z)));
    }, 100);
  };

  // ── Live Mode — SYNCHRONOUS, no API calls ──
  const enterLiveMode = (zipFilter, hoodName) => {
    // Only show listings from the forSale API endpoint
    let pool = activeListings.filter(isTrueActive);

    if (zipFilter) {
      pool = pool.filter(l => l.zip === zipFilter || (l.zipcode && l.zipcode === zipFilter));
    }

    pool.sort(() => Math.random() - 0.5);
    setLiveListings(pool);
    setLiveHoodFilter(zipFilter || null);
    setLiveHoodName(hoodName || null);
    setLiveIdx(0); setLiveGuessInput(""); setLivePrediction(null); setView("live");

    // Prefetch property details for first 3 in PARALLEL
    setTimeout(() => {
      const zpids = pool.slice(0, 3).map(l => l?.zpid).filter(Boolean);
      if (zpids.length) Promise.all(zpids.map(z => fetchPropertyDetails(z)));
    }, 100);
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
    const newResult = {
      guess: val, soldPrice: listing.listPrice || val, pctOff: Math.abs(parseFloat(vsListPct || 0)),
      revealed: true, isDaily: false, dailyNumber: null, timestamp: Date.now(),
      propertyType: listing.propertyType || null,
      neighborhood: listing.neighborhood || null,
      city: listing.city || null,
      isLive: true,
    };
    setAllResults(prev => [...prev, newResult]);

    // ── Supabase: persist live guess + prediction (fire-and-forget) ──
    if (playerId) {
      const xpEarned = 10; // base XP for live prediction (no accuracy yet)
      const newTotalXp = calcXP([...allResults, newResult]);
      const newLevel = getLevel(newTotalXp);
      submitGuess({
        playerId, marketId: market?.id || 'sf', mode: 'live',
        zpid: listing.zpid || null,
        address: listing.address, neighborhood: listing.neighborhood,
        city: listing.city, zip: listing.zip,
        propertyType: listing.propertyType || '',
        beds: listing.beds, baths: listing.baths, sqft: listing.sqft,
        listPrice: listing.listPrice, photo: listing.photo,
        guess: val, soldPrice: null, pctOff: null, accuracyBand: null,
        xpEarned,
      }).then(guessRow => {
        // Also create prediction record for future resolution
        if (guessRow) {
          submitPrediction({
            playerId, marketId: market?.id || 'sf',
            guessId: guessRow.id,
            zpid: listing.zpid || '',
            address: listing.address, neighborhood: listing.neighborhood,
            listPrice: listing.listPrice, predictedPrice: val,
          }).catch(e => console.warn('[PricePoint] Supabase prediction failed:', e));
        }
      }).catch(e => console.warn('[PricePoint] Supabase live guess failed:', e));
      syncPlayerXP(playerId, newTotalXp, newLevel.level)
        .catch(e => console.warn('[PricePoint] XP sync failed:', e));
    }
  };

  const liveNextProperty = () => {
    setLivePrediction(null);
    setLiveGuessInput("");
    setMlsExpanded(false);
    setLiveIdx(prev => prev + 1);
  };

  // ── Resolve feedback color from theme ──
  const fbColor = (fb) => T[fb?.colorKey] || T.green;

  // ── Tab Bar Navigation ──
  const TAB_VIEWS = {
    daily: view === "daily" || view === "postDaily",
    free: view === "freeplay" || view === "fpPicker",
    live: view === "live" || view === "livePicker",
    stats: view === "tomorrow",
    board: view === "leaderboard",
  };
  const handleTab = (tab) => {
    if (tab === "daily") {
      if (dailyResult && dailyResult.dailyNumber === dailyNumber) setView("postDaily");
      else setView("daily");
    } else if (tab === "free") {
      // If already in free play flow, stay there
      if (view === "freeplay" || view === "fpPicker") return;
      if (dailyResult && dailyResult.dailyNumber === dailyNumber) setView("fpPicker");
      else setView("daily");
    } else if (tab === "live") {
      // If already in live flow, stay there
      if (view === "live" || view === "livePicker") return;
      if (dailyResult && dailyResult.dailyNumber === dailyNumber) setView("livePicker");
      else setView("daily");
    } else if (tab === "stats") {
      setView("tomorrow");
    } else if (tab === "board") {
      setView("leaderboard");
    }
  };
  const showTabBar = view !== "onboarding" && view !== "reveal";

  // ── Desktop sidebar tab sync ──
  // When parent sends a sidebarTab change, navigate to that tab
  useEffect(() => {
    if (sidebarTab) handleTab(sidebarTab);
  }, [sidebarTab, sidebarTabKey]);

  // Report current active tab to parent for sidebar highlighting
  const currentTab = TAB_VIEWS.daily ? "daily" : TAB_VIEWS.free ? "free" : TAB_VIEWS.live ? "live" : TAB_VIEWS.stats ? "stats" : TAB_VIEWS.board ? "board" : "daily";
  useEffect(() => {
    if (onTabChange) onTabChange(currentTab);
  }, [currentTab]);

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

  // ── Static map URL builder (Mapbox) ──
  const getStaticMapUrl = (lat, lng) => {
    if (!lat || !lng) return null;
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) return null;
    // Mapbox Static Images API — dark style, indigo marker, retina (@2x)
    const marker = `pin-s+6366f1(${lng},${lat})`;
    return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${marker}/${lng},${lat},14.5,0/800x520@2x?access_token=${token}&attribution=false&logo=false`;
  };

  // ── Photo Carousel (for Live mode with property details) ──
  const PhotoCarousel = ({ photos, fallbackPhoto, badge, badgeColor, accent, pType, showExtras, listing, FONT, MONO }) => {
    const [idx, setIdx] = useState(0);
    const touchStartX = useRef(null);
    const basePhotos = photos && photos.length > 0 ? photos : [fallbackPhoto || "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80"];
    // Append map as last slide if lat/lng available
    const mapUrl = getStaticMapUrl(listing?.latitude, listing?.longitude);
    const allPhotos = mapUrl ? [...basePhotos, mapUrl] : basePhotos;
    const photoCount = basePhotos.length; // real photos only (for counter display)
    const count = allPhotos.length;
    const isMapSlide = mapUrl && idx === count - 1;
    const go = (dir) => setIdx(i => dir === "next" ? (i + 1) % count : (i - 1 + count) % count);
    return (
      <div style={{ position: "relative", touchAction: "pan-y" }}
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          if (touchStartX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          touchStartX.current = null;
          if (Math.abs(dx) > 40) go(dx < 0 ? "next" : "prev");
        }}>
        <img src={allPhotos[idx]} alt={isMapSlide ? "Property location map" : ""} style={{ width: "100%", height: 260, objectFit: "cover", display: "block", transition: "opacity 0.25s" }}
          onError={e => { e.target.src = "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80"; }} />
        {/* Map slide "Location" label — top left on map, replaces badges */}
        {isMapSlide ? (
          <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
            <div style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "5px 12px", display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase" }}>
              <Icon name="map-pin" size={12} /> LOCATION
            </div>
          </div>
        ) : (
          /* Top badges — photos only */
          <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
            {badge && (
              <div style={{ background: `${badgeColor || accent}E6`, backdropFilter: "blur(8px)", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase" }}>{badge}</div>
            )}
            {showExtras && pType && (
              <div style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase" }}>{pType}</div>
            )}
          </div>
        )}
        {/* Photo count pill — top right. Shows "1/3" for photos, "MAP" on map slide */}
        {count > 1 && (
          <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "#fff", fontFamily: MONO }}>
            {isMapSlide ? (<span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon name="map-pin" size={10} /> MAP</span>) : `${idx + 1} / ${photoCount}`}
          </div>
        )}
        {/* Prev / Next arrows */}
        {count > 1 && (
          <>
            <button onClick={() => go("prev")} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.45)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}><Icon name="chevron-left" size={16} /></button>
            <button onClick={() => go("next")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.45)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}><Icon name="chevron-right" size={16} /></button>
          </>
        )}
        {/* Dot indicators */}
        {count > 1 && count <= 12 && (
          <div style={{ position: "absolute", bottom: listing && resolveNeighborhood(listing) !== "Unknown Area" && !isMapSlide ? 48 : 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5 }}>
            {allPhotos.map((_, i) => {
              const isMap = mapUrl && i === count - 1;
              return (
                <div key={i} onClick={() => setIdx(i)} style={{ width: i === idx ? (isMap ? 20 : 16) : 6, height: 6, borderRadius: 3, background: i === idx ? "#fff" : isMap ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.5)", cursor: "pointer", transition: "all 0.2s" }} />
              );
            })}
          </div>
        )}
        {/* Neighborhood badge — hidden on map slide (map already shows location) */}
        {!isMapSlide && listing && resolveNeighborhood(listing) !== "Unknown Area" && (
          <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderRadius: 10, padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="map-pin" size={13} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: FONT }}>{resolveNeighborhood(listing)}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Property card (shared daily & free play) ──
  const PropertyCard = ({ listing, guess, onGuessChange, onGuess, badge, badgeColor, accentColor, showExtras, showPropertyType, showAddress, showZillowLink, labelOverrides, details, isLoadingDetails }) => {
    const accent = accentColor || T.accent;
    const pType = propTypeShort(listing.propertyType);
    const showType = showExtras || showPropertyType;
    const hasMultiplePhotos = details?.photos?.length > 1;
    const hasMap = !!(listing.latitude && listing.longitude);
    const useCarousel = hasMultiplePhotos || hasMap; // map slide gives every geolocated listing a carousel
    const desc = details?.description || listing.description;
    const yearBuilt = listing.yearBuilt || details?.yearBuilt;
    return (
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, overflow: "hidden" }}>
        {useCarousel ? (
          <PhotoCarousel photos={details?.photos} fallbackPhoto={listing.photo} badge={badge} badgeColor={badgeColor} accent={accent} pType={pType} showExtras={showType} listing={listing} FONT={FONT} MONO={MONO} />
        ) : (
        <div style={{ position: "relative" }}>
          <img src={listing.photo} alt="" style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }}
            onError={e => { e.target.src = "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80"; }} />
          <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
            {badge && (
              <div style={{ background: `${badgeColor || accent}E6`, backdropFilter: "blur(8px)", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase" }}>{badge}</div>
            )}
            {showType && pType && (
              <div style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase" }}>{pType}</div>
            )}
          </div>
          {/* Loading photos indicator */}
          {isLoadingDetails && (
            <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "#fff", fontFamily: MONO, animation: "ppPulse 1.2s ease infinite" }}>Loading photos...</div>
          )}
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
        )}
        <div style={{ padding: "16px 18px 20px" }}>
          {/* Address or Neighborhood heading */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: showAddress ? 17 : 20, fontWeight: 700, color: T.text, letterSpacing: "-0.02em", fontFamily: FONT }}>{showAddress ? listing.address : resolveNeighborhood(listing)}</div>
          </div>
          <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT }}>
            {showAddress ? `${resolveNeighborhood(listing)} · ${listing.city}, ${listing.state} ${listing.zip}` : `${listing.city}, ${listing.state} ${listing.zip}`}{(showExtras || showPropertyType) && listing.propertyType ? ` · ${listing.propertyType}` : ""}
          </div>
          {/* MLS Description — from details API or listing */}
          {showExtras && desc && (
            <div style={{ marginTop: 10, background: T.inputBg, borderRadius: 10, padding: "10px 14px", border: `1px solid ${T.cardBorder}` }}>
              <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.55, fontFamily: FONT, overflow: "hidden", maxHeight: mlsExpanded ? "none" : 54, position: "relative" }}>
                {desc}
                {!mlsExpanded && desc.length > 120 && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 28, background: `linear-gradient(transparent, ${T.inputBg})` }} />
                )}
              </div>
              {desc.length > 120 && (
                <button onClick={() => setMlsExpanded(!mlsExpanded)} style={{ background: "none", border: "none", color: accent, fontSize: 11, fontWeight: 600, fontFamily: MONO, letterSpacing: 1, cursor: "pointer", padding: "6px 0 0", textTransform: "uppercase" }}>{mlsExpanded ? "Show less" : "Read more"}</button>
              )}
            </div>
          )}
          {/* Specs */}
          <div style={{ display: "flex", gap: 6, margin: "14px 0", flexWrap: "wrap" }}>
            {[[listing.beds, "Beds"], [listing.baths, "Baths"], [(listing.sqft || 0).toLocaleString(), "SqFt"], [yearBuilt, "Built"]].map(([v, l], i) => (
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
          {/* View on Zillow link — Live mode only, shown before guess to enable informed predictions */}
          {showZillowLink && listing.detailUrl && (
            <a href={listing.detailUrl.startsWith("http") ? listing.detailUrl : `https://www.zillow.com${listing.detailUrl}`} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 16px", marginBottom: 14, borderRadius: 10, border: `1px solid ${T.cardBorder}`, background: T.inputBg, textDecoration: "none", color: T.textSecondary, fontSize: 12, fontWeight: 600, fontFamily: FONT, transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = T.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.cardBorder; e.currentTarget.style.color = T.textSecondary; }}>
              <Icon name="external-link" size={13} /> View Full Listing on Zillow
            </a>
          )}
          {/* Guess — Cash App style: tap the display to type, hidden input captures keys */}
          <div style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, textAlign: "center", marginBottom: 6, fontFamily: FONT }}>{labelOverrides?.guessLabel || "What do you think it sold for?"}</div>
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
            <PillButton onClick={onGuess} disabled={!guess} accent={accent === T.accent} tealAccent={accent === T.cyan}>{labelOverrides?.buttonLabel || "Final Answer"}</PillButton>
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
        @keyframes lvlSpring {
          0% { transform: scale(0); opacity: 0 }
          50% { transform: scale(1.3); opacity: 1 }
          70% { transform: scale(0.9) }
          85% { transform: scale(1.05) }
          100% { transform: scale(1) }
        }
        @keyframes lvlGlow {
          0% { box-shadow: 0 0 0 0 rgba(99,102,241,0.6) }
          50% { box-shadow: 0 0 60px 30px rgba(99,102,241,0.3) }
          100% { box-shadow: 0 0 80px 40px rgba(99,102,241,0) }
        }
        @keyframes lvlBarFill {
          0% { width: 70% }
          60% { width: 100% }
          70% { width: 100%; filter: brightness(1.5) }
          100% { width: 100%; filter: brightness(1) }
        }
        @keyframes lvlParticle {
          0% { transform: translate(0, 0) scale(1); opacity: 1 }
          100% { transform: translate(var(--px), var(--py)) scale(0); opacity: 0 }
        }
        @keyframes lvlRing {
          0% { transform: scale(0.3); opacity: 0.8; border-width: 4px }
          100% { transform: scale(2.5); opacity: 0; border-width: 1px }
        }
        @keyframes lvlUnlockSlide {
          0% { transform: translateY(30px); opacity: 0 }
          100% { transform: translateY(0); opacity: 1 }
        }
        @keyframes lvlShimmer {
          0% { background-position: -200% center }
          100% { background-position: 200% center }
        }
        @keyframes lvlFadeOut {
          0% { opacity: 1 }
          80% { opacity: 1 }
          100% { opacity: 0 }
        }
      `}</style>

      {shareToast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 999, padding: "12px 24px", borderRadius: 12, background: T.accent, color: "#fff", fontSize: 14, fontWeight: 600, animation: "ppSlideUp 0.3s ease", boxShadow: "0 8px 32px rgba(99,102,241,0.3)", fontFamily: FONT }}>
          Copied to clipboard
        </div>
      )}

      {/* ═══ LEVEL-UP CELEBRATION ═══ */}
      {levelUpData && (() => {
        const particles = Array.from({ length: 24 }, (_, i) => {
          const angle = (i / 24) * Math.PI * 2;
          const dist = 80 + Math.random() * 120;
          const colors = ["#6366F1", "#3B82F6", "#06B6D4", "#10B981", "#F59E0B", "#EC4899", "#A5B4FC", "#818CF8"];
          return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, color: colors[i % colors.length], size: 4 + Math.random() * 6, delay: Math.random() * 0.3 };
        });
        return (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 500,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            animation: "ppFadeIn 0.3s ease, lvlFadeOut 4.5s ease forwards",
            pointerEvents: "none",
          }}>
            {/* Dark overlay */}
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }} />

            {/* Expanding ring */}
            <div style={{
              position: "absolute", width: 200, height: 200, borderRadius: "50%",
              border: "3px solid #6366F1", animation: "lvlRing 1.2s ease-out forwards",
              animationDelay: "0.4s", opacity: 0,
            }} />
            <div style={{
              position: "absolute", width: 200, height: 200, borderRadius: "50%",
              border: "3px solid #3B82F6", animation: "lvlRing 1.2s ease-out forwards",
              animationDelay: "0.6s", opacity: 0,
            }} />

            {/* Particles */}
            {particles.map((p, i) => (
              <div key={i} style={{
                position: "absolute", width: p.size, height: p.size, borderRadius: "50%",
                background: p.color,
                "--px": `${p.x}px`, "--py": `${p.y}px`,
                animation: `lvlParticle 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
                animationDelay: `${0.3 + p.delay}s`, opacity: 0,
              }} />
            ))}

            {/* XP bar fill animation */}
            <div style={{
              position: "relative", zIndex: 2, width: 200, marginBottom: 32,
            }}>
              <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 4,
                  background: "linear-gradient(90deg, #6366F1, #3B82F6, #06B6D4)",
                  animation: "lvlBarFill 1s ease-in-out forwards",
                }} />
              </div>
              <div style={{
                textAlign: "center", fontSize: 10, fontFamily: MONO, color: "rgba(255,255,255,0.5)",
                marginTop: 6, letterSpacing: 2, textTransform: "uppercase",
              }}>MAX</div>
            </div>

            {/* Level icon + number (spring animation) */}
            <div style={{
              position: "relative", zIndex: 2, textAlign: "center",
              animation: "lvlSpring 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, lvlGlow 1.5s ease-out 0.5s",
              animationDelay: "0.5s", opacity: 0,
              animationFillMode: "forwards",
            }}>
              {/* Icon circle */}
              <div style={{
                width: 80, height: 80, borderRadius: "50%", margin: "0 auto 16px",
                background: "linear-gradient(135deg, #6366F1, #3B82F6, #06B6D4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 40px rgba(99,102,241,0.4)",
              }}>
                <Icon name={levelUpData.newLevel.icon} size={36} style={{ color: "#fff" }} />
              </div>

              {/* LEVEL UP text */}
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase",
                fontFamily: MONO, marginBottom: 8,
                background: "linear-gradient(90deg, #A5B4FC, #6366F1, #3B82F6, #06B6D4, #A5B4FC)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                animation: "lvlShimmer 2s linear infinite",
              }}>LEVEL UP</div>

              {/* Level number + name */}
              <div style={{ fontSize: 48, fontWeight: 900, color: "#fff", fontFamily: MONO, letterSpacing: "-0.03em", lineHeight: 1 }}>
                {levelUpData.newLevel.level}
              </div>
              <div style={{
                fontSize: 20, fontWeight: 700, color: "#fff", fontFamily: FONT, marginTop: 8,
                textShadow: "0 0 20px rgba(99,102,241,0.5)",
              }}>
                {levelUpData.newLevel.name}
              </div>
            </div>

            {/* Unlock message */}
            <div style={{
              position: "relative", zIndex: 2, marginTop: 28,
              animation: "lvlUnlockSlide 0.6s ease forwards",
              animationDelay: "1.8s", opacity: 0,
            }}>
              <div style={{
                background: "rgba(255,255,255,0.08)", backdropFilter: "blur(12px)",
                borderRadius: 14, padding: "12px 24px", border: "1px solid rgba(255,255,255,0.12)",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 11, fontFamily: MONO, letterSpacing: 2, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: 4 }}>UNLOCKED</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", fontFamily: FONT }}>
                  {levelUpData.newLevel.level >= 10 ? "Luxury Market Insights" :
                   levelUpData.newLevel.level >= 7 ? "Advanced Analytics" :
                   levelUpData.newLevel.level >= 5 ? "Neighborhood Deep Dive" :
                   levelUpData.newLevel.level >= 3 ? "Free Play Mode" :
                   "Keep Going!"}
                </div>
              </div>
            </div>

            {/* XP earned line */}
            <div style={{
              position: "relative", zIndex: 2, marginTop: 16,
              animation: "lvlUnlockSlide 0.6s ease forwards",
              animationDelay: "2.2s", opacity: 0,
              fontSize: 12, fontFamily: MONO, color: "rgba(255,255,255,0.4)", letterSpacing: 1,
            }}>
              {levelUpData.xp} XP EARNED
            </div>
          </div>
        );
      })()}

      {/* ═══ LEVEL-UP SHARE CARD ═══ */}
      {showLevelUpShare && (
        <div onClick={() => setShowLevelUpShare(false)} style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 400,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20, animation: "ppFadeIn 0.3s ease",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: 24, padding: "28px 24px", maxWidth: 340,
            width: "100%", border: `1px solid ${T.cardBorder}`,
            animation: "ppScaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}>
            {/* Share card header */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%", margin: "0 auto 12px",
                background: "linear-gradient(135deg, #6366F1, #3B82F6)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon name={currentLevel.icon} size={28} style={{ color: "#fff" }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", fontFamily: MONO, color: T.accent, marginBottom: 4 }}>LEVEL UP</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: T.text, fontFamily: MONO }}>Level {currentLevel.level}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: T.textSecondary, fontFamily: FONT, marginTop: 2 }}>{currentLevel.name}</div>
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <div style={{ flex: 1, background: T.inputBg, borderRadius: 12, padding: "10px 12px", textAlign: "center", border: `1px solid ${T.cardBorder}` }}>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: MONO, color: T.text }}>{allResults.length}</div>
                <div style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 2 }}>GUESSES</div>
              </div>
              <div style={{ flex: 1, background: T.inputBg, borderRadius: 12, padding: "10px 12px", textAlign: "center", border: `1px solid ${T.cardBorder}` }}>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: MONO, color: T.text }}>{xp}</div>
                <div style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 2 }}>TOTAL XP</div>
              </div>
              <div style={{ flex: 1, background: T.inputBg, borderRadius: 12, padding: "10px 12px", textAlign: "center", border: `1px solid ${T.cardBorder}` }}>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: MONO, color: T.accent }}>{allResults.length > 0 ? (100 - (allResults.reduce((s, r) => s + (r.pctOff || 0), 0) / allResults.length)).toFixed(1) : "—"}%</div>
                <div style={{ fontSize: 9, fontFamily: MONO, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 2 }}>ACCURACY</div>
              </div>
            </div>

            {/* Share button */}
            <button onClick={() => {
              const avg = allResults.length > 0 ? (100 - (allResults.reduce((s, r) => s + (r.pctOff || 0), 0) / allResults.length)).toFixed(1) : "—";
              const text = `I just reached Level ${currentLevel.level} — ${currentLevel.name} on PricePoint!\n\n${allResults.length} guesses · ${avg}% accuracy · ${xp} XP\n\nThink you know real estate prices? Try it: blueprint.realstack.app`;
              if (navigator.share) {
                navigator.share({ text }).catch(() => {});
              } else {
                navigator.clipboard.writeText(text).then(() => { setShareToast(true); setTimeout(() => setShareToast(false), 2000); });
              }
            }} style={{
              width: "100%", padding: "14px", borderRadius: 9999,
              background: "linear-gradient(135deg, #6366F1, #3B82F6)", color: "#fff",
              fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: FONT,
              boxShadow: "0 0 20px rgba(99,102,241,0.3)", marginBottom: 8,
            }}>
              Share Achievement
            </button>
            <button onClick={() => setShowLevelUpShare(false)} style={{
              width: "100%", padding: "12px", borderRadius: 9999,
              background: "transparent", color: T.textSecondary,
              fontSize: 14, fontWeight: 500, border: `1px solid ${T.cardBorder}`, cursor: "pointer", fontFamily: FONT,
            }}>
              Continue Playing
            </button>
          </div>
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

      {/* ═══ ONBOARDING — Market Picker ═══ */}
      {view === "onboarding" && (
        <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100vh", animation: "ppFadeIn 0.5s ease" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.accent, marginBottom: 16 }}>PRICEPOINT</div>
            <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.04em", margin: "0 0 16px", color: T.text, fontFamily: FONT }}>How well do you<br />know your market?</h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: T.textSecondary, margin: 0, fontFamily: FONT }}>One home. One guess. Every day.<br />Pick your city to start playing.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {LAUNCH_MARKETS.map(m => (
              <button key={m.id} onClick={() => selectMarket(m)} disabled={loading}
                style={{
                  background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16,
                  padding: "20px 16px", cursor: "pointer", textAlign: "center",
                  transition: "all 0.2s", position: "relative", overflow: "hidden",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = `${T.accent}08`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.cardBorder; e.currentTarget.style.background = T.card; }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, margin: "0 auto 10px",
                  background: `${T.accent}15`, display: "flex", alignItems: "center", justifyContent: "center",
                  color: T.accent,
                }}>
                  <Icon name={m.icon} size={20} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: FONT }}>{m.name}</div>
                <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: MONO, marginTop: 4, letterSpacing: 1 }}>
                  {m.neighborhoods.length - 1} NEIGHBORHOODS
                </div>
              </button>
            ))}
          </div>
          {loading && (
            <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: T.textSecondary, fontFamily: FONT, animation: "ppPulse 1.2s ease infinite" }}>Loading listings...</div>
          )}
          {error && <div style={{ marginTop: 12, fontSize: 12, color: T.orange, textAlign: "center", fontFamily: FONT }}>{error}</div>}
        </div>
      )}

      {/* ═══ DAILY CHALLENGE ═══ */}
      {view === "daily" && dailyProperty && (
        <div style={{ padding: "16px 16px 100px", animation: "ppSlideUp 0.5s ease-out" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.accent }}>DAILY CHALLENGE #{dailyNumber}</div>
              <div onClick={() => setShowMarketSwitcher(true)} style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>{locationLabel || market?.label || "Your Market"} <Icon name="chevron-down" size={12} /></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {streak > 0 && <StatPill value={`${streak}d`} label="streak" color={T.orange} />}
              <StatPill value={`Lv.${currentLevel.level}`} color={T.accent} />
            </div>
          </div>
          {PropertyCard({ listing: dailyProperty, guess: guessInput, onGuessChange: handleGuessInput, onGuess: handleDailyGuess, badge: "DAILY", badgeColor: T.accent, accentColor: T.accent, showPropertyType: true })}
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
              <div onClick={() => setShowMarketSwitcher(true)} style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>{locationLabel || market?.label || "Your Market"} <Icon name="chevron-down" size={12} /></div>
            </div>
            {displayName ? (
              <button onClick={() => { setNicknameInput(displayName); setShowNicknamePrompt(true); }} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 9999,
                background: `${T.accent}12`, border: `1px solid ${T.accent}30`, cursor: "pointer",
                fontSize: 13, fontWeight: 600, color: T.accent, fontFamily: FONT,
              }}>
                {displayName} <Icon name="edit-2" size={12} />
              </button>
            ) : (
              <button onClick={() => setShowNicknamePrompt(true)} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 9999,
                background: `${T.accent}12`, border: `1px solid ${T.accent}30`, cursor: "pointer",
                fontSize: 12, fontWeight: 600, color: T.accent, fontFamily: FONT,
              }}>
                Set name <Icon name="user" size={12} />
              </button>
            )}
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

          <button onClick={() => setShowMarketSwitcher(true)} style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: T.textTertiary, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>Change market</button>
        </div>
      )}

      {/* ═══ LIVE MODE ═══ */}
      {view === "live" && (
        <div style={{ padding: "16px 16px 100px", animation: "ppSlideUp 0.4s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.red }}>LIVE</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <div onClick={() => setShowMarketSwitcher(true)} style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>{locationLabel || market?.label || "Your Market"} <Icon name="chevron-down" size={12} /></div>
                <span style={{ color: T.textTertiary, fontSize: 13 }}>·</span>
                <div onClick={() => setView("livePicker")} style={{ fontSize: 13, color: T.red, fontFamily: FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}>{liveHoodName || "All"} <Icon name="chevron-right" size={12} /></div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatPill value={`${liveListings.length - liveIdx - 1}`} label="left" color={T.red} />
            </div>
          </div>
          {liveListings[liveIdx] && !livePrediction ? (
            <>
              {PropertyCard({ listing: liveListings[liveIdx], guess: liveGuessInput, onGuessChange: handleLiveGuessInput, onGuess: handleLiveGuess, badge: "LIVE", badgeColor: T.red || "#EF4444", accentColor: T.red || "#EF4444", showExtras: true, showAddress: true, showZillowLink: true, labelOverrides: { guessLabel: "Your Prediction", buttonLabel: "Lock In Prediction" }, details: propertyDetails[liveListings[liveIdx]?.zpid] || null, isLoadingDetails: detailsLoading === liveListings[liveIdx]?.zpid })}
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
          ) : liveListings.length === 0 ? (
            /* No active listings available from the API */
            <div style={{ textAlign: "center", padding: "48px 20px" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: `${T.red}12`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: `1px solid ${T.red}20` }}>
                <Icon name="radio" size={24} style={{ color: T.red }} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8, fontFamily: FONT }}>No active listings right now</div>
              <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 8, fontFamily: FONT, lineHeight: 1.5 }}>
                We couldn't find active or pending listings in {locationLabel || market?.label || "your market"}.
              </div>
              <div style={{ fontSize: 13, color: T.textTertiary, marginBottom: 24, fontFamily: FONT, lineHeight: 1.5 }}>
                New listings drop daily — check back soon.
              </div>
              <PillButton onClick={() => setView("fpPicker")} tealAccent style={{ marginBottom: 10 }}>Play Free Play Instead</PillButton>
              <PillButton onClick={() => handleTab("daily")} secondary>Back to Daily</PillButton>
            </div>
          ) : (
            /* Went through all available active listings */
            <div style={{ textAlign: "center", padding: "48px 20px" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: `${T.green}12`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: `1px solid ${T.green}20` }}>
                <Icon name="check" size={24} style={{ color: T.green }} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8, fontFamily: FONT }}>All caught up!</div>
              <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 24, fontFamily: FONT, lineHeight: 1.5 }}>
                You've locked in predictions on all {liveListings.length} active listing{liveListings.length !== 1 ? "s" : ""}. We'll let you know when they close.
              </div>
              <PillButton onClick={() => setView("livePicker")} style={{ marginBottom: 10, background: T.red, color: "#fff" }}>Try Another Neighborhood</PillButton>
              <PillButton onClick={() => setView("fpPicker")} tealAccent style={{ marginBottom: 10 }}>Play Free Play</PillButton>
              <PillButton onClick={() => handleTab("daily")} secondary>Back to Daily</PillButton>
            </div>
          )}
        </div>
      )}

      {/* ═══ LIVE NEIGHBORHOOD PICKER ═══ */}
      {view === "livePicker" && (
        <div style={{ padding: "16px 16px 100px", animation: "ppFadeIn 0.4s ease" }}>
          {/* Market switcher pill */}
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => setShowMarketSwitcher(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.inputBg, border: `1px solid ${T.cardBorder}`, borderRadius: 9999, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT, cursor: "pointer" }}>
              <Icon name="map-pin" size={14} /> {market?.label || "Select City"} <Icon name="chevron-down" size={12} />
            </button>
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.red, marginBottom: 2 }}>LIVE PREDICTIONS</div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FONT, color: T.text, lineHeight: 1.1 }}>Pick a Neighborhood</div>
            <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 8, fontFamily: FONT }}>Predict sale prices on active listings</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {(LAUNCH_MARKETS.find(m => m.id === market?.id)?.neighborhoods || SF_NEIGHBORHOODS).map((hood, idx) => (
              <button
                key={idx}
                onClick={() => { enterLiveMode(hood.zip, hood.name); }}
                style={{
                  padding: "16px", borderRadius: 12, border: `1px solid ${T.cardBorder}`, background: T.card,
                  fontSize: 14, fontWeight: 600, color: T.text, fontFamily: FONT,
                  cursor: "pointer", transition: "all 0.2s",
                  display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
                  minHeight: 56,
                }}
                onMouseEnter={(e) => { e.target.style.background = T.inputBg; e.target.style.borderColor = T.red; }}
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

      {/* ═══ FREE PLAY NEIGHBORHOOD PICKER ═══ */}
      {view === "fpPicker" && (
        <div style={{ padding: "16px 16px 100px", animation: "ppFadeIn 0.4s ease" }}>
          {/* Market switcher pill */}
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => setShowMarketSwitcher(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.inputBg, border: `1px solid ${T.cardBorder}`, borderRadius: 9999, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT, cursor: "pointer" }}>
              <Icon name="map-pin" size={14} /> {market?.label || "Select City"} <Icon name="chevron-down" size={12} />
            </button>
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.cyan, marginBottom: 2 }}>FREE PLAY</div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FONT, color: T.text, lineHeight: 1.1 }}>Pick a Neighborhood</div>
            <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 8, fontFamily: FONT }}>Select where you want to guess property prices</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {(LAUNCH_MARKETS.find(m => m.id === market?.id)?.neighborhoods || SF_NEIGHBORHOODS).map((hood, idx) => (
              <button
                key={idx}
                onClick={() => { enterFreePlay(hood.zip, hood.name); }}
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
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <div onClick={() => setShowMarketSwitcher(true)} style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>{locationLabel || market?.label || "Your Market"} <Icon name="chevron-down" size={12} /></div>
                <span style={{ color: T.textTertiary, fontSize: 13 }}>·</span>
                <div onClick={() => setView("fpPicker")} style={{ fontSize: 13, color: T.cyan, fontFamily: FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}>{fpSelectedNeighborhood || "All"} <Icon name="chevron-right" size={12} /></div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatPill value={`${Math.max(0, fpListings.length - fpIdx - 1)}`} label="left" color={T.cyan} />
            </div>
          </div>
          {fpListings[fpIdx] && !fpResult ? (
            <>
              {PropertyCard({ listing: fpListings[fpIdx], guess: fpGuessInput, onGuessChange: handleFpGuessInput, onGuess: handleFpGuess, badge: "FREE PLAY", badgeColor: T.cyan, accentColor: T.cyan, showExtras: true, details: propertyDetails[fpListings[fpIdx]?.zpid] || null, isLoadingDetails: detailsLoading === fpListings[fpIdx]?.zpid })}
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
              <div onClick={() => setShowMarketSwitcher(true)} style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>{locationLabel || market?.label || "Your Market"} <Icon name="chevron-down" size={12} /></div>
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

            // Build leaderboard from Supabase data + current user
            const supabaseEntries = (lbData || []).map(row => ({
              name: row.display_name || `Player ${(row.player_id || '').slice(0, 4)}`,
              role: "",
              accuracy: row.avg_pct_off != null ? parseFloat((100 - row.avg_pct_off).toFixed(1)) : 0,
              count: row.guess_count || 0,
              isYou: row.player_id === playerId,
            }));

            // Check if "You" already in Supabase results
            const youInResults = supabaseEntries.some(e => e.isYou);

            // Build final list: Supabase rows + user row if not already included
            const entries = [
              ...supabaseEntries.map(e => e.isYou ? { ...e, name: "You", accuracy: Math.max(e.accuracy, userAccuracy), count: Math.max(e.count, userCount) } : e),
              ...(!youInResults && userCount > 0 ? [{ name: "You", role: "", accuracy: userAccuracy, count: userCount, isYou: true }] : []),
            ];
            const sorted = [...entries].sort((a, b) => b.accuracy - a.accuracy);

            if (lbLoading) {
              return (
                <div style={{ textAlign: "center", padding: 40, color: T.textTertiary, fontFamily: FONT, fontSize: 13 }}>
                  Loading leaderboard...
                </div>
              );
            }

            if (sorted.length === 0) {
              return (
                <div style={{ textAlign: "center", padding: 40, color: T.textTertiary, fontFamily: FONT }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>
                    <Icon name="award" size={32} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.textSecondary, marginBottom: 6 }}>No rankings yet</div>
                  <div style={{ fontSize: 12 }}>Play at least 3 rounds to appear on the board.</div>
                </div>
              );
            }

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

      {/* ═══ NICKNAME PROMPT ═══ */}
      {showNicknamePrompt && (
        <div onClick={() => setShowNicknamePrompt(false)} style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 250,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "ppFadeIn 0.3s ease",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: 20, padding: 32, width: "90%", maxWidth: 360,
            border: `1px solid ${T.cardBorder}`, textAlign: "center",
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `${T.accent}18`,
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Icon name="user" size={24} style={{ color: T.accent }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: FONT, marginBottom: 4 }}>
              Claim your spot
            </div>
            <div style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT, marginBottom: 20, lineHeight: 1.5 }}>
              Pick a name to show on the leaderboard. Keep it short and fun.
            </div>
            <input
              type="text"
              value={nicknameInput}
              onChange={e => setNicknameInput(e.target.value.slice(0, 20))}
              onKeyDown={e => e.key === "Enter" && handleSaveNickname()}
              placeholder="e.g. Chris G."
              autoFocus
              style={{
                width: "100%", padding: "12px 16px", fontSize: 16, fontFamily: FONT,
                background: T.inputBg, color: T.text, border: `1px solid ${T.cardBorder}`,
                borderRadius: 12, outline: "none", textAlign: "center",
                boxSizing: "border-box",
              }}
              onFocus={e => e.target.style.borderColor = T.accent}
              onBlur={e => e.target.style.borderColor = T.cardBorder}
            />
            <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: MONO, marginTop: 6 }}>
              {nicknameInput.length}/20
            </div>
            <button
              onClick={handleSaveNickname}
              disabled={nicknameInput.trim().length < 2 || nicknameSaving}
              style={{
                width: "100%", padding: "12px 0", marginTop: 16, fontSize: 15, fontWeight: 700,
                fontFamily: FONT, borderRadius: 9999, border: "none", cursor: "pointer",
                background: nicknameInput.trim().length >= 2 ? "linear-gradient(135deg, #6366F1, #3B82F6)" : T.inputBg,
                color: nicknameInput.trim().length >= 2 ? "#fff" : T.textTertiary,
                opacity: nicknameSaving ? 0.6 : 1,
                boxShadow: nicknameInput.trim().length >= 2 ? "0 0 20px rgba(99,102,241,0.3)" : "none",
              }}
            >
              {nicknameSaving ? "Saving..." : "Join the Board"}
            </button>
            <button
              onClick={() => setShowNicknamePrompt(false)}
              style={{
                marginTop: 12, fontSize: 13, color: T.textTertiary, fontFamily: FONT,
                background: "none", border: "none", cursor: "pointer", padding: 8,
              }}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* ═══ MARKET SWITCHER BOTTOM SHEET ═══ */}
      {showMarketSwitcher && (
        <div onClick={() => setShowMarketSwitcher(false)} style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          animation: "ppFadeIn 0.2s ease",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: "20px 20px 0 0", padding: "24px 20px 32px",
            maxWidth: 420, width: "100%", border: `1px solid ${T.cardBorder}`, borderBottom: "none",
            animation: "ppSlideUp 0.3s ease",
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: T.cardBorder, margin: "0 auto 20px" }} />
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.accent, marginBottom: 4 }}>SWITCH MARKET</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: FONT, marginBottom: 20 }}>Choose your city</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {LAUNCH_MARKETS.map(m => {
                const isActive = market?.id === m.id || market?.city === m.name;
                return (
                  <button key={m.id} onClick={() => { if (!isActive) selectMarket(m); else setShowMarketSwitcher(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                      background: isActive ? `${T.accent}12` : T.inputBg,
                      border: `1px solid ${isActive ? `${T.accent}30` : T.cardBorder}`,
                      borderRadius: 14, cursor: "pointer", width: "100%", textAlign: "left",
                      transition: "all 0.15s",
                    }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: isActive ? "linear-gradient(135deg, #6366F1, #3B82F6)" : T.inputBg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: isActive ? "#fff" : T.textTertiary,
                      border: isActive ? "none" : `1px solid ${T.cardBorder}`,
                    }}>
                      <Icon name={m.icon} size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: isActive ? T.text : T.textSecondary, fontFamily: FONT }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: MONO, letterSpacing: 1, marginTop: 1 }}>{m.neighborhoods.length - 1} neighborhoods</div>
                    </div>
                    {isActive && (
                      <div style={{ fontSize: 10, fontWeight: 700, fontFamily: MONO, color: T.accent, background: `${T.accent}18`, padding: "3px 8px", borderRadius: 6, letterSpacing: 1 }}>ACTIVE</div>
                    )}
                  </button>
                );
              })}
            </div>
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
