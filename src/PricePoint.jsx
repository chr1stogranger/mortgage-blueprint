import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import Icon from './Icon';

const PP_HOMES = [
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

const PP_LISTINGS = [
  { id:"pp1",zpid:"15103285",address:"1334 28th Ave",city:"San Francisco",state:"CA",zip:"94122",beds:3,baths:1,sqft:1250,lotSqft:2997,yearBuilt:1940,propertyType:"Single Family",listPrice:1195000,zestimate:1413700,daysOnMarket:8,status:"active",photo:"https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",neighborhood:"Central Sunset",pricePerSqft:956 },
  { id:"pp2",zpid:"15204891",address:"1522 44th Ave",city:"San Francisco",state:"CA",zip:"94122",beds:3,baths:2,sqft:1650,lotSqft:2500,yearBuilt:1942,propertyType:"Single Family",listPrice:1395000,zestimate:1510000,daysOnMarket:12,status:"active",photo:"https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80",neighborhood:"Outer Sunset",pricePerSqft:845 },
  { id:"pp3",zpid:"15091234",address:"2150 19th Ave",city:"San Francisco",state:"CA",zip:"94116",beds:4,baths:3,sqft:2200,lotSqft:2500,yearBuilt:1955,propertyType:"Single Family",listPrice:1895000,zestimate:1820000,daysOnMarket:21,status:"active",photo:"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",neighborhood:"Parkside",pricePerSqft:861 },
  { id:"pp4",zpid:"15305672",address:"1741 35th Ave",city:"San Francisco",state:"CA",zip:"94122",beds:2,baths:1,sqft:1100,lotSqft:2500,yearBuilt:1938,propertyType:"Single Family",listPrice:995000,zestimate:1075000,daysOnMarket:5,status:"active",photo:"https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800&q=80",neighborhood:"Outer Sunset",pricePerSqft:905 },
  { id:"pp5",zpid:"15198345",address:"1248 12th Ave",city:"San Francisco",state:"CA",zip:"94122",beds:3,baths:2,sqft:1800,lotSqft:2500,yearBuilt:1948,propertyType:"Single Family",listPrice:1650000,zestimate:1720000,daysOnMarket:3,status:"active",photo:"https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=800&q=80",neighborhood:"Inner Sunset",pricePerSqft:917 },
  { id:"pp6",zpid:"15401298",address:"3855 Noriega St",city:"San Francisco",state:"CA",zip:"94122",beds:3,baths:2,sqft:1480,lotSqft:2500,yearBuilt:1951,propertyType:"Single Family",listPrice:1295000,zestimate:1340000,daysOnMarket:16,status:"active",photo:"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",neighborhood:"Outer Sunset",pricePerSqft:875 },
  { id:"pp7",zpid:"15502876",address:"1560 22nd Ave",city:"San Francisco",state:"CA",zip:"94122",beds:4,baths:2,sqft:1950,lotSqft:2500,yearBuilt:1945,propertyType:"Single Family",listPrice:1550000,zestimate:1610000,daysOnMarket:9,status:"active",photo:"https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80",neighborhood:"Central Sunset",pricePerSqft:795 },
  { id:"pp8",zpid:"15087654",address:"680 Kirkham St",city:"San Francisco",state:"CA",zip:"94122",beds:2,baths:2,sqft:1350,lotSqft:2500,yearBuilt:1960,propertyType:"Condo",listPrice:895000,zestimate:920000,daysOnMarket:28,status:"active",photo:"https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80",neighborhood:"Inner Sunset",pricePerSqft:663 },
  { id:"pp9",zpid:"15612098",address:"2480 46th Ave",city:"San Francisco",state:"CA",zip:"94116",beds:3,baths:1,sqft:1350,lotSqft:2500,yearBuilt:1939,propertyType:"Single Family",listPrice:1150000,zestimate:1200000,daysOnMarket:14,status:"active",photo:"https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80",neighborhood:"Parkside",pricePerSqft:852 },
  { id:"pp10",zpid:"15098123",address:"1123 8th Ave",city:"San Francisco",state:"CA",zip:"94122",beds:5,baths:3,sqft:2800,lotSqft:3000,yearBuilt:1952,propertyType:"Single Family",listPrice:1950000,zestimate:2050000,daysOnMarket:7,status:"active",photo:"https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&q=80",neighborhood:"Inner Sunset",pricePerSqft:696 },
];

const PP_SOLD_LISTINGS = [
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

export default function PricePoint({ T, isDesktop, FONT, onRunNumbers, onBackToBlueprint, onOpenMarkets, realtorPartner }) {
  // ── Markets integration — check if current listing has an active market ──
  const liveMarkets = useSelector((state) => state.markets?.liveMarkets || []);

  // ── State Variables ──
  const [ppGuessInput, setPpGuessInput] = useState("");
  const [ppGuesses, setPpGuesses] = useState([]);
  const [ppView, setPpView] = useState("cards");
  const [ppShowReveal, setPpShowReveal] = useState(null);
  const [ppRevealAnim, setPpRevealAnim] = useState(false);
  const [ppCardAnim, setPpCardAnim] = useState("");
  const [ppSkipped, setPpSkipped] = useState([]);
  const [ppWeeklyMode, setPpWeeklyMode] = useState(false);
  const [ppNotif, setPpNotif] = useState(null);
  const [ppPrevBadgeCount, setPpPrevBadgeCount] = useState(0);
  const [ppSoldMode, setPpSoldMode] = useState(true);
  const [ppRevealCounter, setPpRevealCounter] = useState(null);
  const [ppRevealDone, setPpRevealDone] = useState(false);
  const [ppConfetti, setPpConfetti] = useState([]);
  const [ppHometown, setPpHometown] = useState(() => { try { return JSON.parse(localStorage.getItem("pp-hometown")) || null; } catch(e) { return null; } });
  const [ppSavedLocations, setPpSavedLocations] = useState(() => { try { return JSON.parse(localStorage.getItem("pp-saved-locs")) || []; } catch(e) { return []; } });
  const [ppShowHometownSetup, setPpShowHometownSetup] = useState(false);
  const [ppHometownInput, setPpHometownInput] = useState("");
  const [ppLeaderboardFilter, setPpLeaderboardFilter] = useState("all");
  const [ppHistoryFilter, setPpHistoryFilter] = useState("all");
  const [ppPublicProfile, setPpPublicProfile] = useState(() => { try { const v = localStorage.getItem("pp-public"); return v === null ? true : v === "true"; } catch(e) { return true; } });
  const [ppSearchZip, setPpSearchZip] = useState("");
  const [ppPropertyDetails, setPpPropertyDetails] = useState({});
  const [ppPhotoIdx, setPpPhotoIdx] = useState(0);
  const [ppDescExpanded, setPpDescExpanded] = useState(false);
  const ppPhotoTouchRef = useRef({ startX: 0, startY: 0 });
  const [ppLiveActive, setPpLiveActive] = useState([]);
  const [ppLiveSold, setPpLiveSold] = useState([]);
  const [ppLoading, setPpLoading] = useState(false);
  const [ppError, setPpError] = useState(null);
  const [ppDataSource, setPpDataSource] = useState("hardcoded");
  const [ppLocationLabel, setPpLocationLabel] = useState("");
  const ppTouchStartX = useRef(null);
  const ppTouchStartY = useRef(null);

  // ── Touch Swipe Navigation ──
  const PP_VIEWS = ["cards","results","stats","leaderboard"];
  const ppHandleTouchStart = (e) => { ppTouchStartX.current = e.touches[0].clientX; ppTouchStartY.current = e.touches[0].clientY; };
  const ppHandleTouchEnd = (e) => {
    if (ppTouchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - ppTouchStartX.current;
    const dy = e.changedTouches[0].clientY - ppTouchStartY.current;
    ppTouchStartX.current = null; ppTouchStartY.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
    const cur = PP_VIEWS.indexOf(ppView);
    if (cur === -1) return;
    if (dx < -60 && cur < PP_VIEWS.length - 1) setPpView(PP_VIEWS[cur + 1]);
    else if (dx > 60 && cur > 0) setPpView(PP_VIEWS[cur - 1]);
  };

  // ── Refs and Timers ──
  const ppFetchTimer = useRef(null);

  // ── Format Helpers ──
  const ppFmt = n => n?.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}) ?? "—";
  const ppAbsPct = (g,a) => (Math.abs((g-a)/a)*100).toFixed(1);
  const ppPct = (g,a) => (((g-a)/a)*100).toFixed(1);

  // ── Live Data Fetching ──
  const ppFetchListings = (searchValue) => {
    if (!searchValue || searchValue.trim().length < 2) return;
    clearTimeout(ppFetchTimer.current);
    ppFetchTimer.current = setTimeout(() => ppFetchListingsNow(searchValue), 500);
  };

  const ppFetchListingsNow = async (searchValue) => {
    if (!searchValue || searchValue.trim().length < 2) return;
    setPpLoading(true);
    setPpError(null);
    try {
      const sv = searchValue.trim();
      const isZip = /^\d{5}$/.test(sv);
      let params;
      if (isZip) {
        params = `zip=${sv}`;
      } else {
        const cityStateMatch = sv.match(/^(.+?)[,\s]+([A-Za-z]{2})$/);
        if (cityStateMatch) {
          params = `city=${encodeURIComponent(cityStateMatch[1].trim())}&state=${encodeURIComponent(cityStateMatch[2].trim().toUpperCase())}`;
        } else {
          params = `city=${encodeURIComponent(sv)}&state=CA`;
        }
      }
      const resp = await fetch(`/api/pricepoint?${params}`);
      if (!resp.ok) throw new Error(`API returned ${resp.status}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      const hasActive = data.activeListings && data.activeListings.length > 0;
      const hasSold = data.soldListings && data.soldListings.length > 0;
      if (!hasActive && !hasSold) {
        setPpError("No listings found for this location. Using sample data.");
        setPpDataSource("hardcoded");
      } else {
        setPpLiveActive(data.activeListings || []);
        setPpLiveSold(data.soldListings || []);
        setPpDataSource("live");
        const locLabel = data.location || searchValue;
        setPpLocationLabel(locLabel);
        if (ppHometown && (ppHometown.zip === searchValue || ppHometown.city === searchValue)) {
          const updated = { ...ppHometown, label: locLabel };
          setPpHometown(updated);
        }
        setPpGuesses([]);
        setPpGuessInput("");
        try { localStorage.removeItem("pp-guesses"); } catch(e){}
      }
    } catch (err) {
      console.error("PricePoint fetch error:", err);
      setPpError(`Could not load live data: ${err.message}. Using sample data.`);
      setPpDataSource("hardcoded");
    } finally {
      setPpLoading(false);
    }
  };

  // ── Hometown Management ──
  const ppSaveHometown = () => {
    const val = ppHometownInput.trim();
    if (!val) return;
    const isZip = /^\d{5}$/.test(val);
    const cityStateMatch = val.match(/^(.+?)[,\s]+([A-Za-z]{2})$/);
    let ht;
    if (isZip) {
      ht = { zip: val, label: val };
    } else if (cityStateMatch) {
      ht = { city: cityStateMatch[1].trim(), state: cityStateMatch[2].trim().toUpperCase(), label: cityStateMatch[1].trim() + ", " + cityStateMatch[2].trim().toUpperCase() };
    } else {
      ht = { city: val, label: val };
    }
    setPpHometown(ht);
    setPpShowHometownSetup(false);
    setPpSearchZip(val);
    ppFetchListings(val);
    setPpSavedLocations(prev => {
      const exists = prev.find(l => l.label === ht.label);
      if (exists) return prev;
      return [ht, ...prev].slice(0, 5);
    });
  };

  const ppChangeHometown = () => {
    setPpHometownInput(ppHometown?.label || "");
    setPpShowHometownSetup(true);
  };

  const ppHandleSearch = () => {
    if (ppSearchZip.trim()) ppFetchListings(ppSearchZip.trim());
  };

  // ── Effects ──
  useEffect(() => { try { if (ppHometown) localStorage.setItem("pp-hometown", JSON.stringify(ppHometown)); } catch(e){} }, [ppHometown]);
  useEffect(() => { try { localStorage.setItem("pp-public", String(ppPublicProfile)); } catch(e){} }, [ppPublicProfile]);
  useEffect(() => { try { const s = localStorage.getItem("pp-guesses"); if (s) setPpGuesses(JSON.parse(s)); } catch(e){} }, []);
  useEffect(() => { try { localStorage.setItem("pp-guesses", JSON.stringify(ppGuesses)); } catch(e){} }, [ppGuesses]);
  useEffect(() => { try { localStorage.setItem("pp-saved-locs", JSON.stringify(ppSavedLocations)); } catch(e){} }, [ppSavedLocations]);
  useEffect(() => {
    if (realtorPartner) {
      if (realtorPartner.farmZip && !ppSearchZip) setPpSearchZip(realtorPartner.farmZip);
    }
  }, []);

  // ── Auto-load on mount: hometown → geolocation → sample data ──
  const geoAttempted = useRef(false);
  useEffect(() => {
    if (ppDataSource !== "hardcoded" || ppLiveActive.length > 0 || ppLiveSold.length > 0) return;
    // 1. If we have a saved hometown, use it
    if (ppHometown && (ppHometown.zip || ppHometown.city)) {
      const search = ppHometown.zip || ppHometown.city;
      setPpSearchZip(search);
      ppFetchListings(search);
      return;
    }
    // 2. Try browser geolocation → reverse geocode → auto-fetch
    if (!geoAttempted.current && navigator.geolocation) {
      geoAttempted.current = true;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            // Free US Census Bureau reverse geocode — no API key needed
            const geoResp = await fetch(`https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${longitude}&y=${latitude}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`);
            const geoData = await geoResp.json();
            const match = geoData?.result?.geographies?.["Census Tracts"]?.[0];
            if (match) {
              const state = match.STATE;
              const county = match.COUNTY;
              const stateAbbr = match.STUSAB || "";
              const geoName = match.BASENAME || "";
              // Try to get zip from the address matching layer
              const addrResp = await fetch(`https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${longitude}&y=${latitude}&benchmark=Public_AR_Current&vintage=Current_Current&layers=86&format=json`);
              const addrData = await addrResp.json();
              const zcta = addrData?.result?.geographies?.["ZIP Code Tabulation Areas"]?.[0];
              if (zcta?.ZCTA5CE20) {
                const zip = zcta.ZCTA5CE20;
                setPpSearchZip(zip);
                ppFetchListings(zip);
                // Save as hometown for next time
                const ht = { zip, label: `${geoName}, ${stateAbbr}`.trim() || zip };
                setPpHometown(ht);
                setPpSavedLocations(prev => {
                  const exists = prev.find(l => l.label === ht.label);
                  if (exists) return prev;
                  return [ht, ...prev].slice(0, 5);
                });
                return;
              }
            }
          } catch (err) {
            console.log("Geolocation reverse geocode failed, using sample data:", err);
          }
        },
        () => { /* Permission denied or error — just use sample data */ },
        { timeout: 5000, maximumAge: 300000 } // 5s timeout, cache for 5 min
      );
    }
    // 3. Fall back: just use sample data (no blocking)
  }, []);

  // ── Data Sources ──
  const PP_ACTIVE_SOURCE = ppDataSource === "live" && ppLiveActive.length > 0 ? ppLiveActive : PP_LISTINGS;
  const PP_SOLD_SOURCE = ppDataSource === "live" && ppLiveSold.length > 0 ? ppLiveSold : PP_SOLD_LISTINGS;

  // ── Weekly Challenge ──
  const ppWeekSeed = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const ppWeeklyListings = useMemo(() => {
    const src = PP_SOLD_SOURCE.slice();
    if (src.length <= 5) return src;
    const shuffled = src.map((v,i) => ({ v, sort: ((ppWeekSeed * 9301 + i * 49297) % 233280) })).sort((a,b) => a.sort - b.sort).map(x => x.v);
    return shuffled.slice(0, 5);
  }, [ppWeekSeed, PP_SOLD_SOURCE]);
  const ppWeeklyRemaining = ppWeeklyListings.filter(l => !ppGuesses.find(g => g.listingId === l.id));

  const ppActiveListings = ppWeeklyMode
    ? ppWeeklyRemaining.filter(l => !ppSkipped.includes(l.id))
    : ppSoldMode
    ? PP_SOLD_SOURCE.filter(l => !ppGuesses.find(g => g.listingId === l.id) && !ppSkipped.includes(l.id))
    : PP_ACTIVE_SOURCE.filter(l => !ppGuesses.find(g => g.listingId === l.id) && !ppSkipped.includes(l.id));
  const ppCurrentListing = ppActiveListings[0];
  const ppTotalListings = ppSoldMode ? PP_SOLD_SOURCE.length : PP_ACTIVE_SOURCE.length;

  // ── Core Game Logic ──
  const ppHandleGuess = () => {
    const val = parseInt(ppGuessInput.replace(/[^0-9]/g,""));
    if (!val || !ppCurrentListing) return;
    const isSold = ppSoldMode && ppCurrentListing.soldPrice;
    setPpCardAnim("pp-submitted");
    setTimeout(() => {
      const newGuess = {
        listingId:ppCurrentListing.id, zpid:ppCurrentListing.zpid, guess:val,
        soldPrice: isSold ? ppCurrentListing.soldPrice : null,
        listPrice:ppCurrentListing.listPrice, zestimate:ppCurrentListing.zestimate,
        revealPrice: isSold ? ppCurrentListing.soldPrice : null,
        address:ppCurrentListing.address, city:ppCurrentListing.city, state:ppCurrentListing.state, zip:ppCurrentListing.zip,
        propertyType:ppCurrentListing.propertyType, neighborhood:ppCurrentListing.neighborhood,
        sqft:ppCurrentListing.sqft, beds:ppCurrentListing.beds, baths:ppCurrentListing.baths,
        photo:ppCurrentListing.photo, timestamp:Date.now(),
        revealed: isSold ? true : false,
        isSoldMode: !!isSold,
      };
      setPpGuesses(prev => [...prev, newGuess]);
      setPpGuessInput("");
      setPpCardAnim("");
      setPpPhotoIdx(0);
      setPpDescExpanded(false);
      if (isSold) {
        setPpRevealCounter(null);
        setPpRevealDone(false);
        setPpConfetti([]);
        setPpShowReveal(newGuess);
        setTimeout(() => setPpRevealAnim(true), 50);
        const soldP = ppCurrentListing.soldPrice;
        const startVal = val;
        const steps = 30;
        const stepTime = 35;
        let step = 0;
        const counterInterval = setInterval(() => {
          step++;
          const progress = step / steps;
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = Math.round(startVal + (soldP - startVal) * eased);
          setPpRevealCounter(current);
          if (step >= steps) {
            clearInterval(counterInterval);
            setPpRevealCounter(soldP);
            setPpRevealDone(true);
            const pctOffCheck = Math.abs((val - soldP) / soldP) * 100;
            if (pctOffCheck <= 5) {
              const particles = Array.from({ length: pctOffCheck <= 2 ? 40 : 20 }, (_, i) => ({
                id: i, x: Math.random() * 100, delay: Math.random() * 0.3,
                color: ["#38bd7e","#e8c84d","#6366F1","#3B82F6","#EC4899","#06B6D4"][Math.floor(Math.random()*6)],
                rotation: Math.random() * 360, speed: 1 + Math.random() * 2,
              }));
              setPpConfetti(particles);
              setTimeout(() => setPpConfetti([]), 3000);
            }
          }
        }, stepTime);
        const pctOff = Math.abs((val - ppCurrentListing.soldPrice) / ppCurrentListing.soldPrice) * 100;
        const bonus = pctOff <= 1 ? 50 : pctOff <= 2 ? 40 : pctOff <= 5 ? 25 : pctOff <= 10 ? 15 : 0;
        setTimeout(() => { setPpNotif(`+${10 + bonus} XP earned!${bonus > 0 ? ` ${pctOff.toFixed(1)}% accuracy bonus` : ""}`); setTimeout(() => setPpNotif(null), 3000); }, 2000);
      } else {
        setPpNotif(`Locked in ${ppFmt(val)} — +10 XP`);
        setTimeout(() => setPpNotif(null), 3000);
      }
    }, 400);
  };

  const ppSimulateSold = (idx) => {
    const g = ppGuesses[idx];
    if (g.revealed) { setPpShowReveal(g); setTimeout(() => setPpRevealAnim(true), 50); return; }
    const base = g.zestimate || g.listPrice;
    const v = (Math.random() - 0.4) * 0.08;
    const sold = Math.round(base * (1 + v));
    const updated = [...ppGuesses]; updated[idx] = {...g, revealed:true, soldPrice:sold};
    setPpGuesses(updated); setPpShowReveal(updated[idx]); setTimeout(() => setPpRevealAnim(true), 50);
  };

  const ppCloseReveal = () => { setPpRevealAnim(false); setPpConfetti([]); setTimeout(() => { setPpShowReveal(null); setPpRevealCounter(null); setPpRevealDone(false); }, 300); };
  const ppHandleInput = (e) => { const r = e.target.value.replace(/[^0-9]/g,""); setPpGuessInput(r ? "$" + parseInt(r).toLocaleString() : ""); };
  const ppSkipListing = () => {
    if (!ppCurrentListing) return;
    setPpCardAnim("pp-submitted");
    setTimeout(() => { setPpSkipped(prev => [...prev, ppCurrentListing.id]); setPpCardAnim(""); setPpPhotoIdx(0); setPpDescExpanded(false); setPpGuessInput(""); }, 400);
  };
  const ppResetAll = () => { setPpGuesses([]); setPpSkipped([]); setPpGuessInput(""); setPpShowReveal(null); setPpLiveActive([]); setPpLiveSold([]); setPpDataSource("hardcoded"); setPpLocationLabel(""); setPpError(null); setPpPropertyDetails({}); try { localStorage.removeItem("pp-guesses"); } catch(e){} };

  // ── Property Details Fetching ──
  const ppFetchDetails = async (zpid) => {
    if (!zpid || ppPropertyDetails[zpid]?.loading) return;
    if (ppPropertyDetails[zpid]?.photos?.length > 0) return;
    setPpPropertyDetails(prev => ({ ...prev, [zpid]: { loading: true, photos: [], description: "", error: null } }));
    try {
      const resp = await fetch(`/api/propertydetails?zpid=${zpid}`);
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setPpPropertyDetails(prev => ({ ...prev, [zpid]: { loading: false, photos: data.photos || [], description: data.description || "", error: null, listPrice: data.listPrice || null, zestimate: data.zestimate || null } }));
      if (data.listPrice && ppCurrentListing?.zpid === String(zpid)) {
        const src = ppSoldMode ? ppLiveSold : ppLiveActive;
        const idx = src.findIndex(l => String(l.zpid) === String(zpid));
        if (idx >= 0 && !src[idx].listPrice) {
          const updated = [...src];
          updated[idx] = { ...updated[idx], listPrice: data.listPrice };
          if (ppSoldMode) setPpLiveSold(updated); else setPpLiveActive(updated);
        }
      }
    } catch (err) {
      console.error("Detail fetch error:", err);
      setPpPropertyDetails(prev => ({ ...prev, [zpid]: { loading: false, photos: [], description: "", error: err.message } }));
    }
  };

  useEffect(() => {
    if (ppCurrentListing?.zpid) {
      ppFetchDetails(ppCurrentListing.zpid);
      setPpPhotoIdx(0);
      setPpDescExpanded(false);
    }
  }, [ppCurrentListing?.zpid]);

  // ── Stats Calculations ──
  const ppGetRevealPrice = (g) => g.revealPrice || g.soldPrice;
  const ppRevealed = ppGuesses.filter(g => g.revealed && ppGetRevealPrice(g));
  const ppCompGuesses = ppGuesses.filter(g => !g.isSoldMode);
  const ppCompRevealed = ppCompGuesses.filter(g => g.revealed && ppGetRevealPrice(g));
  const ppPracticeGuesses = ppGuesses.filter(g => g.isSoldMode);
  const ppPracticeRevealed = ppPracticeGuesses.filter(g => g.revealed && ppGetRevealPrice(g));

  const ppCalcStats = (reveals) => {
    const rp = (g) => ppGetRevealPrice(g);
    const avgDiff = reveals.length > 0 ? (reveals.reduce((s,g) => s + Math.abs((g.guess-rp(g))/rp(g))*100, 0)/reveals.length).toFixed(1) : "—";
    const overCount = reveals.filter(g => g.guess > rp(g)).length;
    const underCount = reveals.filter(g => g.guess < rp(g)).length;
    let curStreak = 0;
    for (let i = reveals.length-1; i >= 0; i--) { if (parseFloat(ppAbsPct(reveals[i].guess, rp(reveals[i]))) <= 5) curStreak++; else break; }
    let bestStreak = 0, ts = 0;
    for (const g of reveals) { if (parseFloat(ppAbsPct(g.guess, rp(g))) <= 5) { ts++; bestStreak = Math.max(bestStreak, ts); } else ts = 0; }
    return { avgDiff, overCount, underCount, curStreak, bestStreak };
  };

  const ppCompStats = ppCalcStats(ppCompRevealed);
  const ppPracticeStats = ppCalcStats(ppPracticeRevealed);
  const ppAllStats = ppCalcStats(ppRevealed);
  const ppCompAvgDiff = ppCompStats.avgDiff, ppCompOverCount = ppCompStats.overCount, ppCompUnderCount = ppCompStats.underCount, ppCompCurStreak = ppCompStats.curStreak, ppCompBestStreak = ppCompStats.bestStreak;
  const ppPracticeAvgDiff = ppPracticeStats.avgDiff, ppPracticeOverCount = ppPracticeStats.overCount, ppPracticeUnderCount = ppPracticeStats.underCount, ppPracticeCurStreak = ppPracticeStats.curStreak, ppPracticeBestStreak = ppPracticeStats.bestStreak;
  const ppAvgDiff = ppAllStats.avgDiff, ppOverCount = ppAllStats.overCount, ppUnderCount = ppAllStats.underCount, ppCurStreak = ppAllStats.curStreak, ppBestStreak = ppAllStats.bestStreak;

  // ── XP & Level System ──
  const ppCalcXP = (guesses) => {
    let xp = 0;
    guesses.forEach(g => {
      xp += 10;
      if (g.revealed && g.soldPrice) {
        const pct = Math.abs((g.guess - g.soldPrice) / g.soldPrice) * 100;
        if (pct <= 1) xp += 50;
        else if (pct <= 2) xp += 40;
        else if (pct <= 5) xp += 25;
        else if (pct <= 10) xp += 15;
      }
    });
    xp += ppBestStreak * 5;
    return xp;
  };

  const ppXP = ppCalcXP(ppGuesses);
  const ppCurrentHome = [...PP_HOMES].reverse().find(h => ppXP >= h.req) || PP_HOMES[0];
  const ppNextHome = PP_HOMES.find(h => h.req > ppXP);
  const ppLevel = ppCurrentHome.level;
  const ppXPtoNext = ppNextHome ? ppNextHome.req - ppXP : 0;
  const ppLevelProgress = ppNextHome ? (ppXP - ppCurrentHome.req) / (ppNextHome.req - ppCurrentHome.req) : 1;

  // ── Badges ──
  const ppBadges = [];
  if (ppGuesses.length >= 1) ppBadges.push({ id: "first", icon: "target", name: "First Guess", desc: "Made your first guess" });
  if (ppRevealed.some(g => parseFloat(ppAbsPct(g.guess, g.soldPrice)) <= 1)) ppBadges.push({ id: "bullseye", icon: "target", name: "Bullseye", desc: "Within 1% of sold price" });
  if (ppRevealed.some(g => parseFloat(ppAbsPct(g.guess, g.soldPrice)) <= 2)) ppBadges.push({ id: "sharp", icon: "target", name: "Sharpshooter", desc: "Within 2% of sold price" });
  if (ppBestStreak >= 3) ppBadges.push({ id: "streak3", icon: "zap", name: "On Fire", desc: "3+ streak within 5%" });
  if (ppBestStreak >= 5) ppBadges.push({ id: "streak5", icon: "zap", name: "Blazing", desc: "5+ streak within 5%" });
  if (ppGuesses.length >= 10) ppBadges.push({ id: "ten", icon: "bar-chart", name: "Getting Started", desc: "10 total guesses" });
  if (ppGuesses.length >= 25) ppBadges.push({ id: "twentyfive", icon: "bar-chart", name: "Market Watcher", desc: "25 total guesses" });
  if (ppGuesses.length >= 50) ppBadges.push({ id: "fifty", icon: "star", name: "Market Expert", desc: "50 total guesses" });
  if (ppGuesses.length >= 100) ppBadges.push({ id: "hundred", icon: "crown", name: "Legend", desc: "100 total guesses" });
  if (ppLevel >= 5) ppBadges.push({ id: "homeowner", icon: "home", name: "Homeowner", desc: "Reached Level 5" });
  if (ppLevel >= 10) ppBadges.push({ id: "mogul", icon: "trending-up", name: "Property Mogul", desc: "Reached Level 10" });
  if (ppLevel >= 13) ppBadges.push({ id: "mansion", icon: "crown", name: "Mega Mansion", desc: "Reached max level" });
  if (ppAvgDiff !== "—" && parseFloat(ppAvgDiff) <= 5 && ppRevealed.length >= 5) ppBadges.push({ id: "consistent", icon: "zap", name: "Consistent", desc: "Under 5% avg with 5+ reveals" });

  useEffect(() => {
    if (ppBadges.length > ppPrevBadgeCount && ppPrevBadgeCount > 0) {
      const newBadge = ppBadges[ppBadges.length - 1];
      setPpNotif(`New Badge: ${newBadge.name}!`);
      setTimeout(() => setPpNotif(null), 4000);
    }
    setPpPrevBadgeCount(ppBadges.length);
  }, [ppBadges.length]);

  // ── Leaderboard ──
  const PP_LEADERBOARD_ALL = [
    { name:"Sarah K.",role:"Agent · Compass",category:"agent",avgDiff:2.1,streak:7,guesses:34,badge:"target" },
    { name:"Mike T.",role:"Lender · First Republic",category:"agent",avgDiff:3.4,streak:4,guesses:28,badge:"zap" },
    { name: ppPublicProfile ? "You" : "Anonymous", role:"Lender",category:"agent",avgDiff:ppCompAvgDiff === "—" ? 99 : parseFloat(ppCompAvgDiff),streak:ppCompCurStreak,guesses:ppCompGuesses.length,badge: PP_HOMES[[...PP_HOMES].reverse().findIndex(h => ppXP >= h.req) >= 0 ? PP_HOMES.length - 1 - [...PP_HOMES].reverse().findIndex(h => ppXP >= h.req) : 0]?.icon || "landmark", isYou: true },
    { name:"Jessica R.",role:"Agent · Coldwell Banker",category:"agent",avgDiff:4.8,streak:2,guesses:41,badge:"star" },
    { name:"Rachel M.",role:"Agent · KW",category:"agent",avgDiff:5.6,streak:3,guesses:22,badge:"" },
    { name:"Tom W.",role:"Lender · Chase",category:"agent",avgDiff:6.2,streak:1,guesses:15,badge:"" },
    { name:"David L.",role:"Investor",category:"buyer",avgDiff:5.1,streak:1,guesses:19,badge:"" },
    { name:"Emily C.",role:"First-Time Buyer",category:"buyer",avgDiff:6.8,streak:2,guesses:12,badge:"home" },
    { name:"Jason P.",role:"Buyer · Relocating",category:"buyer",avgDiff:7.3,streak:0,guesses:9,badge:"" },
    { name:"Karen S.",role:"Investor · Flipper",category:"buyer",avgDiff:3.9,streak:5,guesses:31,badge:"dollar" },
    { name:"Alex N.",role:"Buyer · Move-Up",category:"buyer",avgDiff:8.1,streak:0,guesses:7,badge:"" },
    { name:"Brian H.",role:"Buyer · Downsizer",category:"buyer",avgDiff:5.5,streak:1,guesses:16,badge:"" },
  ].sort((a,b) => a.avgDiff === 99 ? 1 : b.avgDiff === 99 ? -1 : a.avgDiff - b.avgDiff);

  const PP_LEADERBOARD = ppLeaderboardFilter === "all" ? PP_LEADERBOARD_ALL
    : ppLeaderboardFilter === "agents" ? PP_LEADERBOARD_ALL.filter(p => p.category === "agent" || p.isYou)
    : PP_LEADERBOARD_ALL.filter(p => p.category === "buyer" || p.isYou);

  // ── Main Render ──
  return (
    <div style={{ maxWidth: isDesktop ? 1100 : 480, margin: "0 auto", width: "100%", overflowX: "hidden", boxSizing: "border-box" }}>
      <style>{`
        html, body { background: ${T.bg} !important; overflow-x: hidden; }
        @keyframes ppFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes ppSlideUp { from { opacity:0; transform:translateY(30px) } to { opacity:1; transform:translateY(0) } }
        @keyframes ppCardExit { to { opacity:0; transform:translateX(120%) rotate(8deg) } }
        @keyframes ppNotifIn { from { opacity:0; transform:translateY(-20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes ppConfettiFall { 0% { transform: translateY(-20px) rotate(0deg); opacity:1 } 100% { transform: translateY(400px) rotate(720deg); opacity:0 } }
        @keyframes ppPulseGreen { 0%,100% { box-shadow: 0 0 0 0 rgba(56,189,126,0.4) } 50% { box-shadow: 0 0 30px 10px rgba(56,189,126,0.15) } }
        @keyframes ppCounterPop { 0% { transform:scale(1) } 50% { transform:scale(1.15) } 100% { transform:scale(1) } }
        .pp-submitted { animation: ppCardExit 0.4s ease-in forwards }
        .pp-rvl-ov { position:fixed; inset:0; background:rgba(0,0,0,0.92); display:flex; align-items:center; justify-content:center; z-index:200; opacity:0; transition:opacity 0.3s; backdrop-filter:blur(16px) }
        .pp-rvl-ov.vis { opacity:1 }
        .pp-rvl-cd { background:${T.card}; border:1px solid rgba(56,189,126,0.2); border-radius:28px; padding:36px 28px; max-width:${isDesktop ? "540px" : "420px"}; width:92%; transform:translateY(100%); transition:transform 0.5s cubic-bezier(0.34,1.56,0.64,1); position:relative; overflow:hidden }
        .pp-rvl-ov.vis .pp-rvl-cd { transform:translateY(0) }
        .pp-sticky-guess { position:sticky; bottom:0; left:0; right:0; z-index:10; padding:12px 16px 16px; background:linear-gradient(transparent, ${T.bg} 20%); backdrop-filter:blur(8px) }
      `}</style>

      {ppNotif && <div style={{ position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:300,padding:"12px 24px",borderRadius:14,fontSize:13,fontWeight:600,background:"rgba(56,189,126,0.15)",color:"#38bd7e",border:"1px solid rgba(56,189,126,0.3)",animation:"ppNotifIn 0.3s ease",maxWidth:380,textAlign:"center" }}>{ppNotif}</div>}

      {/* Header */}
      <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <button onClick={onBackToBlueprint} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "2px 0", marginBottom: 4, fontSize: 12, fontWeight: 600, color: T.blue, fontFamily: FONT }}>
            ← Blueprint
          </button>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>PricePoint</div>
          <div style={{ fontSize: 12, color: T.textTertiary }}>
            {ppDataSource === "live" ? `Live · ${ppLocationLabel}` : ppHometown ? `${ppHometown.label} · ${ppSoldMode ? "Recently Sold" : "On Market"}` : ppSoldMode ? "Recently Sold" : "On Market"}
            {ppDataSource === "live" && <span style={{ marginLeft:6, fontSize:9, padding:"1px 5px", borderRadius:4, background:"rgba(56,189,126,0.15)", color:"#38bd7e", fontWeight:700 }}>LIVE</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {ppSavedLocations.length > 1 ? (
            <select onChange={e => { const loc = ppSavedLocations.find(l => l.label === e.target.value); if (loc) { setPpHometown(loc); setPpSearchZip(loc.zip || loc.city || loc.label); ppFetchListings(loc.zip || loc.city || loc.label); } else ppChangeHometown(); }} value={ppHometown?.label || ""} style={{ background: T.pillBg, borderRadius: 10, padding: "6px 8px", fontSize: 11, fontWeight: 600, color: T.textTertiary, border: `1px solid ${T.cardBorder}`, cursor: "pointer", appearance: "auto", fontFamily: FONT, maxWidth: 120 }}>
              {ppSavedLocations.map(l => <option key={l.label} value={l.label}>{l.label}</option>)}
              <option value="__new">+ New location</option>
            </select>
          ) : ppHometown ? (
            <button onClick={ppChangeHometown} style={{ background: T.pillBg, borderRadius: 10, padding: "6px 10px", fontSize: 11, fontWeight: 600, color: T.textTertiary, border: "none", cursor: "pointer" }}>{ppHometown.label}</button>
          ) : null}
          <div style={{ background: T.pillBg, borderRadius: 10, padding: "6px 12px", fontSize: 14, fontWeight: 700, color: T.text, opacity: (ppSoldMode ? ppPracticeCurStreak : ppCompCurStreak) > 0 ? 1 : 0.4 }}>{ppSoldMode ? ppPracticeCurStreak : ppCompCurStreak}</div>
          <div style={{ background: "linear-gradient(135deg, rgba(56,189,126,0.15), rgba(56,189,126,0.05))", borderRadius: 10, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4, border: "1px solid rgba(56,189,126,0.2)" }}>
            <span style={{ display: "flex", alignItems: "center", color: "#38bd7e" }}><Icon name={ppCurrentHome.icon} size={16} /></span>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#38bd7e" }}>Lv.{ppLevel}</span>
          </div>
        </div>
      </div>

      {/* View Navigation Tabs */}
      <div style={{ padding: "0 18px 10px" }}>
        <div style={{ display: "flex", background: T.pillBg, borderRadius: 12, padding: 3 }}>
          {[["cards","Play",0],["results","History",3],["stats","Stats",10],["leaderboard","Board",20]].map(([k,l,minGuesses]) => {
            const unlocked = ppGuesses.length >= minGuesses;
            return (
              <button key={k} onClick={() => unlocked && setPpView(k)} style={{
                flex: 1, padding: "8px 0", borderRadius: 10, border: "none", fontSize: 12, fontWeight: 600,
                background: ppView === k ? "linear-gradient(135deg,#38bd7e,#2d9d68)" : "transparent",
                color: ppView === k ? "#fff" : !unlocked ? `${T.textTertiary}40` : T.textTertiary,
                cursor: unlocked ? "pointer" : "default", transition: "all 0.2s", whiteSpace: "nowrap",
                position: "relative",
              }}>{l}{!unlocked && <span style={{ display:"block", fontSize:8, opacity:0.5 }}>{minGuesses - ppGuesses.length} more</span>}</button>
            );
          })}
        </div>
      </div>

      {/* Search Bar */}
      {ppView === "cards" && (
        <div style={{ padding: "0 18px 10px" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={ppSearchZip}
              onChange={e => setPpSearchZip(e.target.value)}
              onKeyDown={e => e.key === "Enter" && ppHandleSearch()}
              placeholder="City, State (e.g. Oakland, CA)"
              style={{
                flex: 1, background: T.pillBg, border: `1px solid ${T.cardBorder}`, borderRadius: 12,
                padding: "10px 14px", fontSize: 14, color: T.text, outline: "none", boxSizing: "border-box",
              }}
            />
            <button
              onClick={ppHandleSearch}
              disabled={ppLoading || !ppSearchZip.trim()}
              style={{
                padding: "10px 16px", borderRadius: 12, border: "none", fontSize: 13, fontWeight: 700,
                background: ppSearchZip.trim() && !ppLoading ? "linear-gradient(135deg,#38bd7e,#2d9d68)" : T.pillBg,
                color: ppSearchZip.trim() && !ppLoading ? "#fff" : T.textTertiary,
                cursor: ppSearchZip.trim() && !ppLoading ? "pointer" : "not-allowed",
                transition: "all 0.2s", whiteSpace: "nowrap",
              }}
            >
              {ppLoading ? "⏳" : "Search"}
            </button>
          </div>
          {ppError && (
            <div style={{ marginTop: 6, fontSize: 11, color: "#e8c84d", background: "rgba(232,200,77,0.08)", borderRadius: 8, padding: "6px 10px" }}>
              {ppError}
            </div>
          )}
          {ppDataSource === "live" && (
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: T.textTertiary }}>
                {PP_ACTIVE_SOURCE.length} active · {PP_SOLD_SOURCE.length} sold
              </span>
              <div style={{ display: "flex", gap: 10 }}>
                {ppHometown && ppLocationLabel !== ppHometown.label && (
                  <button onClick={() => { setPpSearchZip(ppHometown.zip || ppHometown.city); ppFetchListings(ppHometown.zip || ppHometown.city); }} style={{ fontSize: 11, color: "#38bd7e", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                    Back to {ppHometown.label}
                  </button>
                )}
                <button onClick={() => { setPpDataSource("hardcoded"); setPpLiveActive([]); setPpLiveSold([]); setPpLocationLabel(""); setPpGuesses([]); setPpSearchZip(""); try{localStorage.removeItem("pp-guesses")}catch(e){} }} style={{ fontSize: 11, color: T.textTertiary, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                  Sample data
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading Overlay */}
      {ppLoading && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 12, animation: "ppFadeIn 0.5s ease infinite alternate" }}></div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>Searching listings...</div>
          <div style={{ fontSize: 12, color: T.textTertiary, marginTop: 4 }}>Pulling live data from Zillow</div>
        </div>
      )}

      {/* Hometown Setup */}
      {ppShowHometownSetup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 250, backdropFilter: "blur(12px)", animation: "ppFadeIn 0.3s ease" }}>
          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 24, padding: "32px 24px", maxWidth: 380, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}></div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 6 }}>Set Your Hometown</div>
            <div style={{ fontSize: 13, color: T.textTertiary, marginBottom: 20, lineHeight: 1.5 }}>
              This is where PricePoint will pull properties from. Your leaderboard will be based on your city.
            </div>
            <input
              value={ppHometownInput}
              onChange={e => setPpHometownInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && ppSaveHometown()}
              placeholder="City, State (e.g. San Francisco, CA)"
              autoFocus
              style={{
                width: "100%", background: T.pillBg, border: `2px solid rgba(56,189,126,0.3)`, borderRadius: 14,
                padding: "14px 18px", fontSize: 18, fontWeight: 600, color: T.text, textAlign: "center",
                outline: "none", boxSizing: "border-box", marginBottom: 12,
              }}
            />
            <button
              onClick={ppSaveHometown}
              disabled={!ppHometownInput.trim()}
              style={{
                width: "100%", padding: "14px", borderRadius: 14, border: "none", fontSize: 15, fontWeight: 700,
                background: ppHometownInput.trim() ? "linear-gradient(135deg,#38bd7e,#2d9d68)" : T.pillBg,
                color: ppHometownInput.trim() ? "#fff" : T.textTertiary,
                cursor: ppHometownInput.trim() ? "pointer" : "not-allowed",
                transition: "all 0.2s", letterSpacing: 0.5, marginBottom: 8,
              }}
            >
              Set Hometown
            </button>
            {ppHometown && (
              <button
                onClick={() => setPpShowHometownSetup(false)}
                style={{ background: "none", border: "none", color: T.textTertiary, fontSize: 13, cursor: "pointer", padding: "8px" }}
              >
                Cancel
              </button>
            )}
            {!ppHometown && (
              <button
                onClick={() => { setPpShowHometownSetup(false); }}
                style={{ background: "none", border: "none", color: T.textTertiary, fontSize: 12, cursor: "pointer", padding: "8px", marginTop: 4 }}
              >
                Skip — use sample data
              </button>
            )}
          </div>
        </div>
      )}

      {/* Weekly Challenge */}
      {ppView === "cards" && !ppLoading && PP_SOLD_SOURCE.length >= 5 && (
        <div style={{ padding: "0 18px 8px" }}>
          <button onClick={() => { setPpWeeklyMode(!ppWeeklyMode); if (!ppWeeklyMode) setPpSoldMode(true); }}
            style={{
              width: "100%", padding: ppWeeklyMode ? "12px 14px" : "8px 14px", borderRadius: 12,
              border: `1px solid ${ppWeeklyMode ? "rgba(232,200,77,0.4)" : T.cardBorder}`,
              background: ppWeeklyMode ? "linear-gradient(135deg, rgba(232,200,77,0.12), rgba(232,200,77,0.04))" : T.pillBg,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer", transition: "all 0.3s",
            }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: ppWeeklyMode ? "#e8c84d" : T.textTertiary }}>Weekly Challenge {ppWeeklyMode ? `— ${ppWeeklyRemaining.length} of 5 left` : ""}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: ppWeeklyMode ? "#e8c84d" : T.textTertiary }}>{ppWeeklyMode ? "Exit" : "Play →"}</span>
          </button>
        </div>
      )}

      {/* Mode Toggle */}
      {ppView === "cards" && !ppLoading && !ppWeeklyMode && ppGuesses.length >= 5 && (
        <div style={{ padding: "0 18px 8px" }}>
          <div style={{ display: "flex", background: T.pillBg, borderRadius: 12, padding: 3 }}>
            <button onClick={() => setPpSoldMode(true)} style={{
              flex: 1, padding: "8px 0", borderRadius: 10, border: "none", fontSize: 12, fontWeight: 600,
              background: ppSoldMode ? "linear-gradient(135deg,#e8c84d,#d4a843)" : "transparent",
              color: ppSoldMode ? "#1a1a1a" : T.textTertiary,
              cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap",
            }}>Recently Sold</button>
            <button onClick={() => setPpSoldMode(false)} style={{
              flex: 1, padding: "8px 0", borderRadius: 10, border: "none", fontSize: 12, fontWeight: 600,
              background: !ppSoldMode ? "linear-gradient(135deg,#38bd7e,#2d9d68)" : "transparent",
              color: !ppSoldMode ? "#fff" : T.textTertiary,
              cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap",
            }}>On Market</button>
          </div>
        </div>
      )}

      <div style={{ padding: "0 18px", paddingBottom: isDesktop ? 20 : 90, overflow: "hidden" }} onTouchStart={ppHandleTouchStart} onTouchEnd={ppHandleTouchEnd}>

        {/* Cards View */}
        {ppView === "cards" && !ppLoading && (
          ppCurrentListing ? (
            <>
            <div className={ppCardAnim} style={{ animation: ppCardAnim ? undefined : "ppSlideUp 0.4s ease-out" }}>
              <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 22, overflow: "hidden" }}>
                {/* Photo Section */}
                <div style={{ position: "relative" }}>
                  {(() => {
                    const det = ppPropertyDetails[ppCurrentListing.zpid];
                    const hasPhotos = det?.photos?.length > 1;
                    const photos = hasPhotos ? det.photos : [ppCurrentListing.photo];
                    const idx = Math.min(ppPhotoIdx, photos.length - 1);
                    return (
                      <div style={{ position: "relative" }}
                        onTouchStart={e => { ppPhotoTouchRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY }; }}
                        onTouchEnd={e => {
                          const dx = e.changedTouches[0].clientX - ppPhotoTouchRef.current.startX;
                          const dy = e.changedTouches[0].clientY - ppPhotoTouchRef.current.startY;
                          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                            e.stopPropagation();
                            if (dx < 0) setPpPhotoIdx(idx < photos.length - 1 ? idx + 1 : 0);
                            if (dx > 0) setPpPhotoIdx(idx > 0 ? idx - 1 : photos.length - 1);
                          }
                        }}>
                        <img src={photos[idx]} alt="" referrerPolicy="no-referrer" style={{ width:"100%", height: isDesktop ? 380 : 260, objectFit:"cover", display:"block" }}
                          onError={e => { if (!e.target.dataset.retried) { e.target.dataset.retried = "1"; e.target.src = photos[idx] + (photos[idx].includes("?") ? "&" : "?") + "t=" + Date.now(); } else { e.target.src = "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80"; }}} />
                        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:120, background:"linear-gradient(transparent, rgba(0,0,0,0.75))", pointerEvents:"none" }} />
                        <div style={{ position:"absolute", bottom:12, left:14, right:14 }}>
                          <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", textShadow:"0 1px 3px rgba(0,0,0,0.5)" }}>{ppCurrentListing.address}</div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>{ppCurrentListing.neighborhood} · {ppCurrentListing.city}</div>
                          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                            {[[ppCurrentListing.beds,"bd"],[ppCurrentListing.baths,"ba"],[(ppCurrentListing.sqft||0).toLocaleString(),"sf"],[ppCurrentListing.yearBuilt,"yr"]].map(([v,l],i) => (
                              <span key={i} style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{v} <span style={{ color:"rgba(255,255,255,0.5)", fontSize:10 }}>{l}</span></span>
                            ))}
                          </div>
                        </div>
                        {hasPhotos && (
                          <div style={{ position:"absolute", top:12, right:12, background:"rgba(0,0,0,0.5)", borderRadius:8, padding:"3px 8px", fontSize:10, color:"#fff", fontWeight:600 }}>{idx+1}/{photos.length}</div>
                        )}
                        {hasPhotos && (
                          <div onClick={(e) => { e.stopPropagation(); setPpPhotoIdx(idx > 0 ? idx - 1 : photos.length - 1); }}
                            style={{ position:"absolute", left:6, top:"45%", transform:"translateY(-50%)", width:28, height:28, borderRadius:14, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:14, color:"#fff" }}>‹</div>
                        )}
                        {hasPhotos && (
                          <div onClick={(e) => { e.stopPropagation(); setPpPhotoIdx(idx < photos.length - 1 ? idx + 1 : 0); }}
                            style={{ position:"absolute", right:6, top:"45%", transform:"translateY(-50%)", width:28, height:28, borderRadius:14, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:14, color:"#fff" }}>›</div>
                        )}
                        {ppSoldMode && <div style={{ position:"absolute", top:12, left:12, background:"rgba(232,200,77,0.9)", backdropFilter:"blur(6px)", borderRadius:8, padding:"4px 10px", fontSize:11, fontWeight:800, color:"#1a1a2e", letterSpacing:1, textTransform:"uppercase" }}>Sold</div>}
                        {/* Market Preview Badge — shows when this listing has an active prediction market */}
                        {!ppSoldMode && (() => {
                          const market = liveMarkets.find(m => m.propertyId === ppCurrentListing.zpid || m.propertyId === ppCurrentListing.id);
                          if (!market) return null;
                          const topBucket = [...market.buckets].sort((a, b) => b.odds - a.odds)[0];
                          return (
                            <div
                              onClick={(e) => { e.stopPropagation(); onOpenMarkets?.(); }}
                              title="Open prediction market for this property"
                              style={{
                              position:"absolute", top: 12, left: 12,
                              background:"rgba(99,102,241,0.92)", backdropFilter:"blur(6px)",
                              borderRadius: 10, padding:"6px 12px",
                              display:"flex", alignItems:"center", gap: 8,
                              cursor:"pointer", transition:"all 0.2s",
                              boxShadow: "0 2px 12px rgba(99,102,241,0.35)",
                            }}>
                              <div>
                                <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: FONT }}>Market Open</div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginTop: 1, fontFamily: FONT }}>
                                  {topBucket ? `${(topBucket.odds * 100).toFixed(0)}% ${topBucket.label}` : "Trade Now"}
                                </div>
                              </div>
                              <div style={{ width: 28, height: 28, borderRadius: 14, background: "rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                                <Icon name="trending-up" size={14} style={{ color: "#fff" }} />
                              </div>
                            </div>
                          );
                        })()}
                        {det?.loading && (
                          <div style={{ position:"absolute", top:12, right:12, background:"rgba(0,0,0,0.5)", borderRadius:8, padding:"4px 8px", fontSize:10, color:"#fff" }}>Loading...</div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Info Strip — fixed height so guess bar doesn't shift */}
                <div style={{ padding: "12px 14px", maxHeight: isDesktop ? 200 : 160, overflowY: "auto", overflowX: "hidden" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    {ppCurrentListing.listPrice ? (
                      <div style={{ flex: 1, minWidth: 80, background: "rgba(56,189,126,0.06)", borderRadius: 10, padding: "8px 12px", border:"1px solid rgba(56,189,126,0.12)" }}>
                        <div style={{ fontSize: 9, color: "#38bd7e", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Listed</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#38bd7e", marginTop: 1, letterSpacing: "-0.01em" }}>{ppFmt(ppCurrentListing.listPrice)}</div>
                      </div>
                    ) : null}
                    {/* Zestimate — hide on sold mode (often matches sold price, giving away the answer) */}
                    {!ppSoldMode && ppCurrentListing.zestimate ? (
                      <div style={{ flex: 1, minWidth: 80, background: T.pillBg, borderRadius: 10, padding: "8px 12px" }}>
                        <div style={{ fontSize: 9, color: T.textTertiary, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>Zestimate</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: T.blue, marginTop: 1 }}>{ppFmt(ppCurrentListing.zestimate)}</div>
                      </div>
                    ) : null}
                    {ppSoldMode && ppCurrentListing.soldDate ? (
                      <div style={{ flex: 0, minWidth: 65, background: T.pillBg, borderRadius: 10, padding: "8px 12px", textAlign:"center" }}>
                        <div style={{ fontSize: 9, color: T.textTertiary, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Sold</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#e8c84d", marginTop: 3 }}>{new Date(ppCurrentListing.soldDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</div>
                      </div>
                    ) : null}
                    {!ppSoldMode && ppCurrentListing.daysOnMarket ? (
                      <div style={{ flex: 0, minWidth: 50, background: T.pillBg, borderRadius: 10, padding: "8px 12px", textAlign:"center" }}>
                        <div style={{ fontSize: 9, color: T.textTertiary, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>DOM</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#38bd7e", marginTop: 3 }}>{ppCurrentListing.daysOnMarket}</div>
                      </div>
                    ) : null}
                  </div>
                  {(() => {
                    const det = ppPropertyDetails[ppCurrentListing.zpid];
                    const desc = det?.description;
                    if (!desc) return null;
                    const cleanDesc = desc.replace(/\$[\d,]+(?:\.\d{2})?/g, "$***").replace(/(?:priced?|offered?|asking|listed?|sold?)\s+(?:at|for)\s+\$?[\d,]+/gi, "").trim();
                    const shown = !ppDescExpanded ? cleanDesc.slice(0, 100).replace(/\s+\S*$/, "...") : cleanDesc;
                    return (
                      <button onClick={() => setPpDescExpanded(!ppDescExpanded)} style={{ width:"100%", background: T.pillBg, border:"none", borderRadius: 10, padding: "8px 12px", cursor:"pointer", textAlign:"left", marginBottom:8 }}>
                        <div style={{ fontSize: 11, lineHeight: 1.4, color: T.textSecondary }}>{shown}</div>
                        <div style={{ fontSize:10, color:T.blue, fontWeight:600, marginTop:3 }}>{ppDescExpanded ? "Show less" : "Read more"}</div>
                      </button>
                    );
                  })()}
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <button onClick={() => {
                      const price = ppCurrentListing.soldPrice || ppCurrentListing.listPrice || ppCurrentListing.zestimate;
                      if (price && onRunNumbers) {
                        onRunNumbers({
                          price,
                          state: ppCurrentListing.state,
                          city: ppCurrentListing.city,
                          zip: ppCurrentListing.zip,
                        });
                      }
                    }} style={{ padding: "6px 12px", borderRadius: 10, border: `1px solid ${T.blue}30`, fontSize: 11, fontWeight: 600, background: `${T.blue}08`, color: T.blue, cursor: "pointer", fontFamily: FONT }}>Run Numbers</button>
                    {ppCurrentListing.detailUrl && (
                      <button onClick={() => window.open(ppCurrentListing.detailUrl, "_blank")} style={{ padding: "6px 12px", borderRadius: 10, border: `1px solid ${T.cardBorder}`, fontSize: 11, fontWeight: 600, background: T.pillBg, color: T.textTertiary, cursor: "pointer", fontFamily: FONT }}>Zillow ↗</button>
                    )}
                    <span style={{ marginLeft:"auto", fontSize:11, color:T.textTertiary }}>{ppActiveListings.length - 1} more</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Guess Bar */}
            <div className={isDesktop ? "" : "pp-sticky-guess"} style={isDesktop ? { marginTop: 12 } : {}}>
              <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 18, padding: "12px 14px" }}>
                {(() => {
                  const lp = ppCurrentListing.listPrice;
                  const ze = !ppSoldMode ? ppCurrentListing.zestimate : null; // hide Zestimate on sold
                  const pills = [];
                  if (lp) pills.push({ label: "List", val: lp });
                  if (ze) pills.push({ label: "Zest", val: ze });
                  if (lp && ze) pills.push({ label: "Mid", val: Math.round((lp + ze) / 2) });
                  if (pills.length === 0) return null;
                  return (
                    <div style={{ display: "flex", gap: 5, marginBottom: 8, justifyContent: "center" }}>
                      {pills.map((p, i) => (
                        <button key={i} onClick={() => setPpGuessInput("$" + p.val.toLocaleString())}
                          style={{ padding: "3px 8px", borderRadius: 8, border: `1px solid ${T.cardBorder}`, background: T.pillBg, fontSize: 10, fontWeight: 600, color: T.textTertiary, cursor: "pointer", fontFamily: FONT }}>
                          {p.label} {ppFmt(p.val)}
                        </button>
                      ))}
                    </div>
                  );
                })()}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={ppSkipListing} style={{
                    padding: "12px 14px", borderRadius: 14, border: `1px solid ${T.cardBorder}`, fontSize: 13, fontWeight: 600,
                    background: T.pillBg, color: T.textTertiary, cursor: "pointer",
                  }}>Skip</button>
                  <input value={ppGuessInput} onChange={ppHandleInput} onKeyDown={e => e.key === "Enter" && ppHandleGuess()}
                    placeholder={ppSoldMode ? "What did it sell for?" : "What will it sell for?"}
                    style={{ flex:1, background: T.pillBg, border: `2px solid rgba(56,189,126,0.25)`, borderRadius: 14, padding: "12px 14px", fontSize: 20, fontWeight: 800, color: T.text, textAlign: "center", outline: "none", boxSizing: "border-box", minWidth:0 }} />
                  <button onClick={ppHandleGuess} disabled={!ppGuessInput} style={{
                    padding: "12px 16px", borderRadius: 14, border: "none", fontSize: 14, fontWeight: 700,
                    background: ppGuessInput ? "linear-gradient(135deg,#38bd7e,#2d9d68)" : T.pillBg,
                    color: ppGuessInput ? "#fff" : T.textTertiary, cursor: ppGuessInput ? "pointer" : "not-allowed",
                    letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap",
                  }}><Icon name="target" size={18} /></button>
                </div>
                {ppGuessInput && (() => {
                  const v = parseInt(ppGuessInput.replace(/[^0-9]/g,""));
                  if (!v) return null;
                  const pp = ppCurrentListing.sqft ? Math.round(v/ppCurrentListing.sqft) : null;
                  const comparePrice = ppCurrentListing.listPrice || ppCurrentListing.zestimate;
                  const compareLabel = ppCurrentListing.listPrice ? "list" : "Zestimate";
                  const d = comparePrice ? ((v - comparePrice)/comparePrice*100).toFixed(1) : null;
                  return <div style={{ textAlign:"center", fontSize:11, color:T.textTertiary, marginTop:6 }}>
                    {d !== null ? <>{d > 0 ? "+" : ""}{d}% vs {compareLabel}</> : null}{pp ? `${d !== null ? " · " : ""}$${pp}/SF` : ""}
                  </div>;
                })()}
              </div>
            </div>
            </>
          ) : (
            <div style={{ textAlign:"center", padding:"60px 20px" }}>
              <div style={{ marginBottom:16, display:"flex", justifyContent:"center", color: T.textSecondary }}><Icon name={ppSoldMode ? "trophy" : "home"} size={48} /></div>
              <div style={{ fontSize:20, fontWeight:700, color:T.text, marginBottom:8 }}>All caught up!</div>
              <div style={{ fontSize:14, color:T.textTertiary, marginBottom:20 }}>You guessed on all {ppTotalListings} {ppSoldMode ? "sold" : ""} listings.</div>
              <button onClick={() => setPpSoldMode(!ppSoldMode)} style={{ padding:"12px 24px", borderRadius:14, border:"none", background:"linear-gradient(135deg,#38bd7e,#2d9d68)", color:"#fff", fontSize:14, fontWeight:600, cursor:"pointer", marginBottom:10 }}>
                Try {ppSoldMode ? "Currently On Market" : "Recently Sold"} →
              </button>
              <div style={{ marginTop:8 }}>
                <button onClick={ppResetAll} style={{ padding:"10px 20px", borderRadius:14, border:`1px solid ${T.cardBorder}`, background:T.pillBg, color:T.textSecondary, fontSize:13, fontWeight:600, cursor:"pointer" }}>Reset All</button>
              </div>
            </div>
          )
        )}

        {/* Results View */}
        {ppView === "results" && (
          <div style={{ animation: "ppFadeIn 0.3s ease" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 4 }}>Guess History</div>
            <div style={{ fontSize: 12, color: T.textTertiary, marginBottom: 10 }}>{ppGuesses.length} total guesses · {ppRevealed.length} revealed</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {[["all","All"],["within5","≤ 5%"],["over","Over"],["under","Under"]].map(([k,l]) => (
                <button key={k} onClick={() => setPpHistoryFilter(k)} style={{
                  padding: "6px 14px", borderRadius: 10, border: "none", fontSize: 12, fontWeight: 600,
                  background: ppHistoryFilter === k ? "linear-gradient(135deg,#38bd7e,#2d9d68)" : T.pillBg,
                  color: ppHistoryFilter === k ? "#fff" : T.textTertiary, cursor: "pointer", transition: "all 0.2s",
                }}>{l}</button>
              ))}
            </div>
            {(() => {
              const filtered = [...ppGuesses].reverse().filter(g => {
                const rp = ppGetRevealPrice(g);
                if (!rp || !g.revealed) return ppHistoryFilter === "all";
                const pct = (g.guess - rp) / rp * 100;
                if (ppHistoryFilter === "within5") return Math.abs(pct) <= 5;
                if (ppHistoryFilter === "over") return pct > 0;
                if (ppHistoryFilter === "under") return pct < 0;
                return true;
              });
              return filtered.length === 0 ? (
                <div style={{ textAlign:"center", padding:"40px", color:T.textTertiary }}>{ppGuesses.length === 0 ? "No guesses yet — go make some!" : "No guesses match this filter"}</div>
              ) : <div style={{ display: isDesktop ? "grid" : "block", gridTemplateColumns: isDesktop ? "1fr 1fr" : undefined, gap: isDesktop ? 8 : 0 }}>{filtered.map((g, i) => {
                const realIdx = ppGuesses.indexOf(g);
                return (
                  <div key={realIdx} onClick={() => ppSimulateSold(realIdx)}
                    style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderRadius:14, cursor:"pointer", background:T.card, border:`1px solid ${T.cardBorder}`, transition:"all 0.2s", marginBottom:8 }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{g.address}</div>
                      <div style={{ fontSize:11, color:T.textTertiary, marginTop:1 }}>{g.neighborhood} · {g.propertyType}{g.isSoldMode ? <span style={{ marginLeft:6, fontSize:9, padding:"1px 5px", borderRadius:4, background:"rgba(232,200,77,0.15)", color:"#e8c84d", fontWeight:700 }}>PRACTICE</span> : ""}</div>
                      <div style={{ display:"flex", gap:12, marginTop:4, fontSize:12 }}>
                        <span><span style={{ color:T.textTertiary }}>List:</span> <span style={{ color:T.textSecondary }}>{ppFmt(g.listPrice)}</span></span>
                        <span><span style={{ color:T.textTertiary }}>You:</span> <span style={{ color:"#38bd7e", fontWeight:700 }}>{ppFmt(g.guess)}</span></span>
                      </div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0, marginLeft:8 }}>
                      {g.revealed && ppGetRevealPrice(g) ? (
                        <>
                          <div style={{ fontSize:12, color:T.textTertiary }}>{g.isSoldMode ? "Sold" : "List"} {ppFmt(ppGetRevealPrice(g))}</div>
                          <div style={{ fontSize:18, fontWeight:800, color:parseFloat(ppAbsPct(g.guess,ppGetRevealPrice(g)))<=3?"#38bd7e":parseFloat(ppAbsPct(g.guess,ppGetRevealPrice(g)))<=7?"#e8c84d":"#e85d5d" }}>
                            {g.guess>=ppGetRevealPrice(g)?"+":""}{ppPct(g.guess,ppGetRevealPrice(g))}%
                          </div>
                        </>
                      ) : (
                        <span style={{ display:"inline-block", padding:"4px 10px", borderRadius:8, fontSize:10, fontWeight:700, background:"rgba(56,189,126,0.1)", color:"#38bd7e", border:"1px solid rgba(56,189,126,0.2)" }}>● Pending</span>
                      )}
                    </div>
                  </div>
                );
              })}</div>;
            })()}
          </div>
        )}

        {/* Leaderboard View */}
        {ppView === "leaderboard" && (
          <div style={{ animation: "ppFadeIn 0.3s ease" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 2 }}>
              {ppHometown ? `${ppHometown.label} Leaderboard` : ppLocationLabel ? `${ppLocationLabel} Leaderboard` : "Leaderboard"}
            </div>
            <div style={{ fontSize: 12, color: T.textTertiary, marginBottom: 14 }}>
              {ppHometown ? "Your City Rankings · Practice excluded" : "Live listings only · Practice excluded"}
            </div>

            <div style={{ display: "flex", background: T.pillBg, borderRadius: 12, padding: 3, marginBottom: 14 }}>
              {[["all","All"],["agents","Realtors"],["buyers","Buyers"]].map(([k,l]) => (
                <button key={k} onClick={() => setPpLeaderboardFilter(k)} style={{
                  flex: 1, padding: "8px 0", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600,
                  background: ppLeaderboardFilter === k ? "linear-gradient(135deg,#38bd7e,#2d9d68)" : "transparent",
                  color: ppLeaderboardFilter === k ? "#fff" : T.textTertiary,
                  cursor: "pointer", transition: "all 0.2s",
                }}>{l}</button>
              ))}
            </div>

            <div style={{ display: isDesktop ? "grid" : "block", gridTemplateColumns: isDesktop ? "1fr 1fr" : undefined, gap: isDesktop ? 8 : 0 }}>
              {PP_LEADERBOARD.map((p,i) => (
                <div key={i} style={{
                  display:"flex", alignItems:"center", padding:"14px 16px", borderRadius:14,
                  background: p.isYou ? "rgba(56,189,126,0.06)" : T.card,
                  border: `1px solid ${p.isYou ? "rgba(56,189,126,0.2)" : T.cardBorder}`,
                  marginBottom:8,
                }}>
                  <div style={{
                    width:32, height:32, borderRadius:10,
                    background: i<3 ? ["linear-gradient(135deg,#38bd7e,#2d9d68)","linear-gradient(135deg,#a8b4c0,#c8d0d8)","linear-gradient(135deg,#c9904a,#e0b070)"][i] : T.pillBg,
                    display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:13,
                    color: i<3 ? "#fff" : T.textTertiary, marginRight:12, flexShrink:0,
                  }}>{i+1}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600, color: p.isYou ? "#38bd7e" : T.text }}>{p.name} {p.badge}</div>
                    <div style={{ fontSize:11, color:T.textTertiary }}>{p.role} · {p.guesses} guesses · {p.streak}</div>
                  </div>
                  <div style={{ fontSize:20, fontWeight:800, color: p.isYou ? "#38bd7e" : T.text }}>
                    {p.avgDiff === 99 ? "—" : p.avgDiff + "%"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats View */}
        {ppView === "stats" && (
          <div style={{ animation: "ppFadeIn 0.3s ease" }}>
            {/* Home Progression */}
            <div style={{ background: "linear-gradient(135deg, #1a2a1f, #162030)", border: "1px solid rgba(56,189,126,0.2)", borderRadius: 22, padding: "20px 18px", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "#38bd7e", textTransform: "uppercase" }}>MY HOME</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}><Icon name={ppCurrentHome.icon} size={20} /> {ppCurrentHome.name}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#38bd7e" }}>Lv.{ppLevel}</div>
                  <div style={{ fontSize: 11, color: T.textTertiary }}>{ppXP} XP</div>
                </div>
              </div>
              {ppNextHome && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.textTertiary, marginBottom: 4 }}>
                    <span>{ppCurrentHome.name}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 3, color: T.textTertiary }}><Icon name={ppNextHome.icon} size={10} /> {ppNextHome.name} — {ppXPtoNext} XP to go</span>
                  </div>
                  <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(ppLevelProgress * 100, 2)}%`, background: "linear-gradient(90deg, #38bd7e, #2d9d68)", borderRadius: 4, transition: "width 0.5s ease" }} />
                  </div>
                </div>
              )}
              {!ppNextHome && (
                <div style={{ fontSize: 13, color: "#38bd7e", fontWeight: 600, textAlign: "center", padding: "8px 0" }}>MAX LEVEL — You own the Mega Mansion!</div>
              )}
            </div>

            {/* XP Info */}
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textTertiary, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>How You Earn XP</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {[["Any guess","+10 XP","#888"],["Within 10%","+15 bonus","#aaa"],["Within 5%","+25 bonus",T.blue],["Within 2%","+40 bonus","#38bd7e"],["Bullseye (1%)","+50 bonus","#e8c84d"],["Best streak","×5 per",T.orange]].map(([l,v,c],i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "4px 0" }}>
                    <span style={{ color: T.textTertiary }}>{l}</span>
                    <span style={{ color: c, fontWeight: 700 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Badges */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span>Badges</span>
                <span style={{ fontSize: 10, color: T.textTertiary, fontWeight: 500 }}>{ppBadges.length} earned</span>
              </div>
              {ppBadges.length === 0 ? (
                <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "20px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 6 }}></div>
                  <div style={{ fontSize: 13, color: T.textTertiary }}>Make your first guess to earn badges!</div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {ppBadges.map(b => (
                    <div key={b.id} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: "14px 8px", textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", color: T.blue }}><Icon name={b.icon} size={26} /></div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.text, marginTop: 4 }}>{b.name}</div>
                      <div style={{ fontSize: 9, color: T.textTertiary, marginTop: 2 }}>{b.desc}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Public Profile */}
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Public Profile</div>
                  <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 2 }}>{ppPublicProfile ? "Your name & stats visible on leaderboard" : "Showing as Anonymous on leaderboard"}</div>
                </div>
                <div onClick={() => setPpPublicProfile(!ppPublicProfile)} style={{ width: 48, height: 28, borderRadius: 14, background: ppPublicProfile ? "#38bd7e" : T.inputBg, cursor: "pointer", padding: 2, transition: "all 0.3s", flexShrink: 0 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 12, background: "#fff", transform: ppPublicProfile ? "translateX(20px)" : "translateX(0)", transition: "transform 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                </div>
              </div>
            </div>

            {/* Live Stats */}
            <div style={{ fontSize: 13, fontWeight: 700, color: "#38bd7e", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span>Live</span>
              <span style={{ fontSize: 10, color: T.textTertiary, fontWeight: 500 }}>counts toward leaderboard</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {[["Avg Accuracy",ppCompAvgDiff==="—"?"—":ppCompAvgDiff+"%","#38bd7e"],["Streak",""+ppCompCurStreak,"#38bd7e"],["Best",""+ppCompBestStreak,T.text],["Guesses",ppCompGuesses.length,T.text],["Revealed",ppCompRevealed.length,T.text],["Pending",ppCompGuesses.length-ppCompRevealed.length,"#e8c84d"]].map(([l,v,c],i) => (
                <div key={i} style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:16, padding:20 }}>
                  <div style={{ fontSize:10, color:T.textTertiary, fontWeight:600, letterSpacing:1, textTransform:"uppercase" }}>{l}</div>
                  <div style={{ fontSize:24, fontWeight:800, color:c, marginTop:4 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Live Bias */}
            {ppCompRevealed.length > 0 && (
              <div style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:16, padding:20, marginBottom:18 }}>
                <div style={{ fontSize:10, color:T.textTertiary, fontWeight:600, letterSpacing:1, textTransform:"uppercase", marginBottom:12 }}>Live Mode Bias</div>
                <div style={{ display:"flex", height:34, borderRadius:10, overflow:"hidden", marginBottom:8 }}>
                  {ppCompOverCount > 0 && <div style={{ width:`${(ppCompOverCount/ppCompRevealed.length)*100}%`, background:"linear-gradient(90deg,#e85d5d,#d94040)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff", minWidth:32 }}>{ppCompOverCount}</div>}
                  {ppCompUnderCount > 0 && <div style={{ width:`${(ppCompUnderCount/ppCompRevealed.length)*100}%`, background:`linear-gradient(90deg,${T.blue},#3a8aaa)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff", minWidth:32 }}>{ppCompUnderCount}</div>}
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:T.textTertiary }}>
                  <span><span style={{ color:"#e85d5d" }}>●</span> Over ({ppCompOverCount})</span>
                  <span><span style={{ color:T.blue }}>●</span> Under ({ppCompUnderCount})</span>
                </div>
              </div>
            )}

            {/* Practice Stats */}
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e8c84d", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span>Practice</span>
              <span style={{ fontSize: 10, color: T.textTertiary, fontWeight: 500 }}>sold homes · not ranked</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
              {[["Avg Accuracy",ppPracticeAvgDiff==="—"?"—":ppPracticeAvgDiff+"%","#e8c84d"],["Streak",""+ppPracticeCurStreak,"#e8c84d"],["Total",ppPracticeGuesses.length,T.text]].map(([l,v,c],i) => (
                <div key={i} style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:16, padding:16 }}>
                  <div style={{ fontSize:10, color:T.textTertiary, fontWeight:600, letterSpacing:1, textTransform:"uppercase" }}>{l}</div>
                  <div style={{ fontSize:20, fontWeight:800, color:c, marginTop:4 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Practice Bias */}
            {ppPracticeRevealed.length > 0 && (
              <div style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:16, padding:20, marginBottom:10 }}>
                <div style={{ fontSize:10, color:T.textTertiary, fontWeight:600, letterSpacing:1, textTransform:"uppercase", marginBottom:12 }}>Practice Bias</div>
                <div style={{ display:"flex", height:34, borderRadius:10, overflow:"hidden", marginBottom:8 }}>
                  {ppPracticeOverCount > 0 && <div style={{ width:`${(ppPracticeOverCount/ppPracticeRevealed.length)*100}%`, background:"linear-gradient(90deg,#e85d5d,#d94040)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff", minWidth:32 }}>{ppPracticeOverCount}</div>}
                  {ppPracticeUnderCount > 0 && <div style={{ width:`${(ppPracticeUnderCount/ppPracticeRevealed.length)*100}%`, background:`linear-gradient(90deg,${T.blue},#3a8aaa)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff", minWidth:32 }}>{ppPracticeUnderCount}</div>}
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:T.textTertiary }}>
                  <span><span style={{ color:"#e85d5d" }}>●</span> Over ({ppPracticeOverCount})</span>
                  <span><span style={{ color:T.blue }}>●</span> Under ({ppPracticeUnderCount})</span>
                </div>
              </div>
            )}

            {/* Roadmap */}
            <div style={{ marginTop: 4, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 10 }}>Home Roadmap</div>
              <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "12px 14px" }}>
                {PP_HOMES.map((h, i) => {
                  const unlocked = ppXP >= h.req;
                  const isCurrent = h.level === ppLevel;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < PP_HOMES.length - 1 ? `1px solid ${T.separator}` : "none", opacity: unlocked ? 1 : 0.35 }}>
                      <div style={{ width: 32, display: "flex", justifyContent: "center", alignItems: "center", color: isCurrent ? "#38bd7e" : unlocked ? T.text : T.textTertiary }}><Icon name={h.icon} size={22} /></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: isCurrent ? 800 : 600, color: isCurrent ? "#38bd7e" : unlocked ? T.text : T.textTertiary }}>
                          {h.name} {isCurrent && <span style={{ fontSize: 10, background: "rgba(56,189,126,0.15)", color: "#38bd7e", borderRadius: 6, padding: "1px 6px", marginLeft: 4 }}>YOU</span>}
                        </div>
                        <div style={{ fontSize: 10, color: T.textTertiary }}>Level {h.level} · {h.req} XP</div>
                      </div>
                      {unlocked && <div style={{ fontSize: 14, color: "#38bd7e" }}>✓</div>}
                      {!unlocked && <div style={{ fontSize: 10, color: T.textTertiary }}></div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {ppGuesses.length > 0 && (
              <button onClick={ppResetAll} style={{ width:"100%", padding:14, borderRadius:14, border:`1px solid rgba(232,93,93,0.2)`, background:"rgba(232,93,93,0.08)", color:"#e85d5d", fontSize:14, fontWeight:600, cursor:"pointer", marginTop:10 }}>Reset All Data</button>
            )}
          </div>
        )}
      </div>

      {/* Reveal Modal */}
      {ppShowReveal && (ppShowReveal.soldPrice || ppShowReveal.revealPrice || ppShowReveal.listPrice) && (
        <div className={`pp-rvl-ov ${ppRevealAnim ? "vis" : ""}`} onClick={ppCloseReveal}>
          <div className="pp-rvl-cd" onClick={e => e.stopPropagation()}>
            {ppConfetti.map(p => (
              <div key={p.id} style={{ position:"absolute", top:-10, left:`${p.x}%`, width:8, height:8, borderRadius:2, background:p.color, animation:`ppConfettiFall ${p.speed}s ease-in ${p.delay}s forwards`, transform:`rotate(${p.rotation}deg)`, opacity:0.9, zIndex:10 }} />
            ))}
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:12, color:T.textTertiary, fontWeight:700, letterSpacing:3, textTransform:"uppercase", marginBottom:6 }}>{ppShowReveal.isSoldMode ? "RECENTLY SOLD" : "SOLD"}</div>
              <div style={{ fontSize:16, fontWeight:700, color:T.text }}>{ppShowReveal.address}</div>
              <div style={{ fontSize:12, color:T.textTertiary, marginTop:2, marginBottom:20 }}>{ppShowReveal.neighborhood} · {ppShowReveal.city}</div>
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:10, color:T.textTertiary, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>Sold Price</div>
                <div style={{
                  fontSize:40, fontWeight:900, letterSpacing:"-0.02em",
                  color: ppRevealDone ? "#38bd7e" : T.text,
                  animation: ppRevealDone ? "ppCounterPop 0.3s ease" : "none",
                  transition: "color 0.3s",
                }}>
                  {ppRevealCounter !== null ? ppFmt(ppRevealCounter) : ppFmt(ppShowReveal.guess)}
                </div>
                {ppShowReveal.sqft && ppRevealDone && <div style={{ fontSize:12, color:T.textTertiary, marginTop:2 }}>${Math.round((ppShowReveal.soldPrice || ppShowReveal.revealPrice)/ppShowReveal.sqft)}/SF</div>}
              </div>
              <div style={{ display:"flex", justifyContent:"center", gap:16, marginBottom:16, flexWrap:"wrap" }}>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:9, color:T.textTertiary, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase" }}>Your Guess</div>
                  <div style={{ fontSize:20, fontWeight:800, color:T.text, marginTop:2 }}>{ppFmt(ppShowReveal.guess)}</div>
                </div>
                {ppShowReveal.listPrice ? (
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:9, color:T.textTertiary, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase" }}>List</div>
                    <div style={{ fontSize:20, fontWeight:700, color:T.textSecondary, marginTop:2 }}>{ppFmt(ppShowReveal.listPrice)}</div>
                  </div>
                ) : null}
              </div>
              {ppRevealDone && (() => {
                const rp = ppShowReveal.revealPrice || ppShowReveal.soldPrice || ppShowReveal.listPrice;
                const diff = parseFloat(ppAbsPct(ppShowReveal.guess, rp));
                const over = ppShowReveal.guess > rp;
                const great = diff <= 3, good = diff <= 7;
                return (
                  <div style={{
                    background: great ? "rgba(56,189,126,0.08)" : good ? "rgba(232,200,77,0.08)" : "rgba(232,93,93,0.08)",
                    border: `1px solid ${great ? "rgba(56,189,126,0.25)" : good ? "rgba(232,200,77,0.25)" : "rgba(232,93,93,0.25)"}`,
                    borderRadius:16, padding:"16px 20px", animation: "ppSlideUp 0.4s ease-out",
                  }}>
                    <div style={{ fontSize:36, fontWeight:900, color: great ? "#38bd7e" : good ? "#e8c84d" : "#e85d5d" }}>{over?"+":"-"}{diff.toFixed(1)}%</div>
                    <div style={{ fontSize:14, color:T.textSecondary, marginTop:4, fontWeight:600 }}>{great?"Sniper accuracy!":good?"Strong market read!":over?"Bit optimistic":"Undervalued this one"}</div>
                    <div style={{ fontSize:12, color:T.textTertiary, marginTop:4 }}>{over?"Over":"Under"} by {ppFmt(Math.abs(ppShowReveal.guess-rp))}</div>
                  </div>
                );
              })()}
              {ppRevealDone && (
                <div style={{ marginTop:16 }}>
                  <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                    <button onClick={() => {
                      const price = ppShowReveal.revealPrice || ppShowReveal.soldPrice || ppShowReveal.listPrice || ppShowReveal.zestimate;
                      if (price && onRunNumbers) {
                        onRunNumbers({
                          price,
                          state: ppShowReveal.state,
                          city: ppShowReveal.city,
                          zip: ppShowReveal.zip,
                        });
                        ppCloseReveal();
                      }
                    }} style={{ flex:1, padding:12, borderRadius:14, border:`1px solid ${T.blue}40`, fontSize:13, fontWeight:700, background:`${T.blue}12`, color:T.blue, cursor:"pointer", fontFamily:FONT }}>Run Numbers</button>
                    <button onClick={ppCloseReveal} style={{ flex:1, padding:12, borderRadius:14, border:"none", fontSize:14, fontWeight:700, background:"linear-gradient(135deg,#38bd7e,#2d9d68)", color:"#fff", cursor:"pointer", letterSpacing:0.5, textTransform:"uppercase" }}>Next</button>
                  </div>
                  <button onClick={() => {
                    const rp = ppShowReveal.revealPrice || ppShowReveal.soldPrice;
                    const diff = rp ? parseFloat(ppAbsPct(ppShowReveal.guess, rp)) : null;
                    const over = rp ? ppShowReveal.guess > rp : false;
                    // Clean text format — no emojis that render weirdly on iOS share sheet
                    const rating = diff !== null ? (diff <= 1 ? "BULLSEYE" : diff <= 3 ? "SNIPER" : diff <= 5 ? "SHARP" : diff <= 10 ? "CLOSE" : "MISS") : "";
                    const bar = diff !== null ? (diff <= 1 ? "|||||" : diff <= 3 ? "||||." : diff <= 5 ? "|||.." : diff <= 10 ? "||..." : "|....") : "";
                    const text = `PricePoint - ${ppShowReveal.city}\n[${bar}] ${rating}\n${ppShowReveal.address}\nGuess: ${ppFmt(ppShowReveal.guess)} ${diff !== null ? `(${over?"+":"-"}${diff.toFixed(1)}%)` : ""}\n\nmortgageblueprint.app/pricepoint`;
                    if (navigator.share) { navigator.share({ text }); } else { navigator.clipboard.writeText(text); setPpNotif("Copied to clipboard!"); setTimeout(() => setPpNotif(null), 2000); }
                  }} style={{ width:"100%", padding:10, borderRadius:12, border:`1px solid ${T.cardBorder}`, background:T.pillBg, fontSize:12, fontWeight:600, color:T.textSecondary, cursor:"pointer", fontFamily:FONT, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                    Share Result
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
