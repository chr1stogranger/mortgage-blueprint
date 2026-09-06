import { FONT, MONO } from "./lib/fonts.js";
import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import Icon from './Icon';
import AddressAutocomplete from './components/AddressAutocomplete.jsx';
import { DARK } from './lib/theme.js';
import { apiUrl, API_BASE } from './apiBase';
import { Capacitor } from '@capacitor/core';
import {
  getOrCreatePlayer, getDeviceId,
  submitGuess, flushPendingGuesses, fetchPropertyCalls, syncPlayer,
  fetchDaily, getExistingDailyGuess, getLeaderboard,
  updateDisplayName, getPlayer,
  fetchNotifications, markNotificationsRead,
  getNotificationPreferences, updateNotificationPreferences,
  getServerH2H, saveServerH2H,
} from './lib/pricePointDB';
import { onAuthStateChange } from './lib/supabaseClient';
import { pushSupported, enablePush, disablePush } from './lib/pushNotifications';

// ── Map view (A4) — lazy-loaded so mapbox-gl (~1.5 MB) ships in its own
// chunk, fetched only the first time a player opens the List | Map toggle.
const PPMapView = lazy(() => import('./components/PPMapView.jsx'));
// No token → no map toggle at all (guard, not a broken map).
const MAP_ENABLED = !!import.meta.env.VITE_MAPBOX_TOKEN;

// Self-contained placeholder shown when a property has no usable photo, or
// when a photo URL fails to load. Inline SVG data-URI — never 404s, works in
// both light/dark cards. (Replaces the old images.unsplash.com fallback, which
// stopped loading and left blank image boxes on Free Play cards.)
const NO_PHOTO = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='800'%20height='440'%20viewBox='0%200%20800%20440'%3E%3Crect%20width='800'%20height='440'%20fill='%23EEF0F4'/%3E%3Cg%20fill='none'%20stroke='%233b6bf5'%20stroke-width='12'%20stroke-linejoin='round'%20stroke-linecap='round'%20opacity='0.45'%3E%3Cpath%20d='M250%20232%20L400%20132%20L550%20232'/%3E%3Cpath%20d='M292%20216%20L292%20322%20L508%20322%20L508%20216'/%3E%3Crect%20x='372'%20y='262'%20width='56'%20height='60'/%3E%3C/g%3E%3Ctext%20x='400'%20y='388'%20font-family='Inter,Arial,sans-serif'%20font-size='25'%20fill='%23999999'%20text-anchor='middle'%3EPhoto%20unavailable%3C/text%3E%3C/svg%3E";

// onError handler: swap to the placeholder once, and clear the handler so a
// failing placeholder can never loop.
const onPhotoError = (e) => { e.target.onerror = null; e.target.src = NO_PHOTO; };

// ── App Store upsell (challenge recipients) ──
// Shown only to iOS visitors on the WEB app: native users already have the
// app, Android has no app yet, and desktop can't install it. Newer iPads
// report "Macintosh" in the UA, so also treat touch-Macs as iPads.
const APP_STORE_URL = "https://apps.apple.com/app/id6773117288";
const isIOSWebVisitor = (() => {
  try {
    if (Capacitor.isNativePlatform()) return false;
    const ua = navigator.userAgent || "";
    return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  } catch { return false; }
})();

// ═══════════════════════════════════════════════════════════════
// PRICEPOINT — Daily Real Estate Price Challenge
// "How well do you know your market?"
// ═══════════════════════════════════════════════════════════════
// 1 sold property/day, same for everyone in a market.
// List price shown — you predict the sold price.
// Address hidden until after guess.
// Spoiler-free sharing. Emotional feedback (never "wrong").
// ═══════════════════════════════════════════════════════════════


// ── Challenge Token Encode/Decode (stateless, URL-safe) ──
const encodeChallenge = ({ listing, result, mode, dailyNumber, locationLabel }) => {
  const payload = {
    a: listing.address, h: listing.neighborhood, c: listing.city, s: listing.state, z: listing.zip,
    b: listing.beds, ba: listing.baths, sf: listing.sqft, yb: listing.yearBuilt, pt: listing.propertyType,
    lp: listing.listPrice, sp: listing.soldPrice, dm: listing.daysOnMarket, ph: listing.photo, zp: listing.zpid,
    g: result.guess, ac: result.pctOff != null ? parseFloat((100 - result.pctOff).toFixed(1)) : 0,
    m: mode === 'daily' ? 'd' : mode === 'live' ? 'l' : 'f', dn: dailyNumber || 0, lb: locationLabel || '',
    t: Math.floor(Date.now() / 1000),
  };
  const json = JSON.stringify(payload);
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const decodeChallenge = (token) => {
  try {
    const padded = token.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    const d = JSON.parse(json);
    return {
      listing: {
        address: d.a, neighborhood: d.h, city: d.c, state: d.s, zip: d.z,
        beds: d.b, baths: d.ba, sqft: d.sf, yearBuilt: d.yb, propertyType: d.pt,
        listPrice: d.lp, soldPrice: d.sp, daysOnMarket: d.dm, photo: d.ph, zpid: d.zp,
      },
      challengerGuess: d.g, challengerAccuracy: d.ac,
      mode: d.m === 'd' ? 'daily' : d.m === 'l' ? 'live' : 'freeplay', dailyNumber: d.dn,
      locationLabel: d.lb, timestamp: d.t,
    };
  } catch (e) { console.error('Failed to decode challenge:', e); return null; }
};

const buildChallengeUrl = (token) => {
  // In the native app window.location.origin is https://localhost, which would
  // produce an unopenable share link — fall back to the production origin there.
  const origin = API_BASE || (typeof window !== 'undefined' ? window.location.origin : 'https://blueprint.realstack.app');
  return `${origin}/api/challenge?c=${token}`;
};

// ── Head-to-Head record (per device, localStorage) ──
// Sold challenges settle instantly (winner known at guess time). For Sale
// challenges settle when the home closes: we stash the pair {my guess, their
// guess} as "pending" and score it later when the resolution notification
// arrives carrying the sold price. No schema/migration needed.
const H2H_KEY = 'pp_h2h_v1';
const emptyH2H = () => ({ wins: 0, losses: 0, ties: 0, pending: [] });
const readH2H = () => {
  try { return { ...emptyH2H(), ...(JSON.parse(localStorage.getItem(H2H_KEY)) || {}) }; }
  catch { return emptyH2H(); }
};
const writeH2H = (h) => { try { localStorage.setItem(H2H_KEY, JSON.stringify(h)); } catch { /* ignore */ } };
// outcome: 'win' | 'loss' | 'tie'
const recordH2H = (outcome) => {
  const h = readH2H();
  if (outcome === 'win') h.wins++; else if (outcome === 'loss') h.losses++; else h.ties++;
  writeH2H(h); return h;
};
// Stash a For Sale challenge to settle later (keyed by zpid).
const addPendingH2H = (zpid, myGuess, challengerGuess) => {
  const z = String(zpid || '');
  if (!z || !myGuess || !challengerGuess) return readH2H();
  const h = readH2H();
  h.pending = (h.pending || []).filter(p => p.zpid !== z);
  h.pending.push({ zpid: z, myGuess, challengerGuess });
  writeH2H(h); return h;
};
// When resolution notifications land (payload carries {zpid, sold_price}),
// settle any matching pending For Sale challenges: closer guess wins.
const settlePendingH2H = (notifications) => {
  const h = readH2H();
  if (!h.pending?.length || !Array.isArray(notifications)) return null;
  const stillPending = [];
  let changed = false;
  for (const p of h.pending) {
    const n = notifications.find(x => x?.type === 'prediction_resolved' && String(x?.payload?.zpid) === p.zpid && x?.payload?.sold_price);
    if (!n) { stillPending.push(p); continue; }
    const sold = Number(n.payload.sold_price);
    const myOff = Math.abs(p.myGuess - sold), theirOff = Math.abs(p.challengerGuess - sold);
    if (myOff < theirOff) h.wins++; else if (myOff > theirOff) h.losses++; else h.ties++;
    changed = true;
  }
  if (!changed) return null;
  h.pending = stillPending; writeH2H(h); return h;
};

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
      "Not bad at all. You've got a feel for it.",
    ],
    colorKey: "cyan",
    label: "SOLID",
  },
  tricky: {
    messages: [
      "This one was tricky. You're not alone.",
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
      "Wild card property: hard to predict.",
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
  // Guard: if listPrice is null/0, OR equals soldPrice (RentCast county rows
  // have no real list price — it's backfilled with the sold price), skip
  // list-vs-sold insights.
  if (!listing.listPrice || listing.listPrice === listing.soldPrice) {
    if (listing.daysOnMarket > 30) {
      return `${listing.daysOnMarket} days on market tends to mean price reductions. Good to know for next time.`;
    }
    if (listing.daysOnMarket && listing.daysOnMarket <= 7) {
      return `Only ${listing.daysOnMarket} days on market: fast sales often signal competitive offers above asking.`;
    }
    return `${resolveNeighborhood(listing)} is a market worth watching. This one was tricky to read.`;
  }
  const overUnder = listing.soldPrice > listing.listPrice ? "over" : "under";
  const listVsSold = Math.abs(((listing.soldPrice - listing.listPrice) / listing.listPrice) * 100).toFixed(0);

  if (listing.soldPrice > listing.listPrice && !guessedHigher) {
    return `This home went ${listVsSold}% over asking: competitive market in ${resolveNeighborhood(listing)}.`;
  }
  if (listing.soldPrice < listing.listPrice && guessedHigher) {
    return `This one sold ${listVsSold}% under list: sat on the market ${listing.daysOnMarket} days.`;
  }
  if (listing.daysOnMarket > 30) {
    return `${listing.daysOnMarket} days on market tends to mean price reductions. Good to know for next time.`;
  }
  if (listing.daysOnMarket <= 7) {
    return `Only ${listing.daysOnMarket} days on market: fast sales often signal competitive offers above asking.`;
  }
  return `${resolveNeighborhood(listing)} is shifting. This ${overUnder}-asking result is worth noting.`;
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
// Compact layout on phones — the guess card must fit one screen without
// scrolling (photo -> description -> specs -> price entry -> Final Answer).
const IS_MOBILE = typeof window !== "undefined" && window.innerWidth <= 480;

// MLS remarks arrive with HTML entities from some feeds ("Elegant &amp; Welcoming!",
// "Alameda&rsquo;s Gold Coast", "2&frac12; bathrooms"). The old shortlist missed the
// curly quotes and fractions agents actually type, so they rendered literally.
//
// This is also the single choke point feeding extractValueSignals/renderHighlightedDesc:
// an undecoded &rsquo; made the "chef's kitchen" highlight pattern silently never match.
const HTML_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  lsquo: "\u2018", rsquo: "\u2019", sbquo: "\u201a",
  ldquo: "\u201c", rdquo: "\u201d", bdquo: "\u201e",
  mdash: "\u2014", ndash: "\u2013", hellip: "\u2026",
  frac12: "\u00bd", frac14: "\u00bc", frac34: "\u00be",
  deg: "\u00b0", plusmn: "\u00b1", times: "\u00d7", divide: "\u00f7",
  bull: "\u2022", middot: "\u00b7", dagger: "\u2020",
  copy: "\u00a9", reg: "\u00ae", trade: "\u2122",
  cent: "\u00a2", pound: "\u00a3", euro: "\u20ac",
  laquo: "\u00ab", raquo: "\u00bb", sect: "\u00a7", para: "\u00b6",
  eacute: "\u00e9", egrave: "\u00e8", ccedil: "\u00e7", ntilde: "\u00f1",
  aacute: "\u00e1", iacute: "\u00ed", oacute: "\u00f3", uacute: "\u00fa",
  auml: "\u00e4", ouml: "\u00f6", uuml: "\u00fc",
  aring: "\u00e5", oslash: "\u00f8", aelig: "\u00e6", szlig: "\u00df",
};

// Out-of-range/invalid code points pass through as the original text rather than
// throwing or emitting U+FFFD.
const safeCodePoint = (n, raw) => {
  if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff) return raw;
  try { return String.fromCodePoint(n); } catch { return raw; }
};

// Single pass, numeric first: decoding &amp; last means "&amp;rsquo;" stays literal
// instead of being double-decoded into a quote.
const decodeEntities = (str) => String(str || "")
  .replace(/&#(\d+);/g, (m, n) => safeCodePoint(Number(n), m))
  .replace(/&#x([0-9a-f]+);/gi, (m, h) => safeCodePoint(parseInt(h, 16), m))
  .replace(/&([a-z][a-z0-9]*);/gi, (m, name) => {
    const hit = HTML_ENTITIES[name.toLowerCase()];
    return hit === undefined ? m : hit; // unknown entity \u2192 leave as typed
  })
  .trim();

// Free Play property-type filter options. Empty selection = all types.
// 'Manufactured' plays under Single Family.
const FP_TYPE_OPTIONS = ["Single Family", "Condo", "Townhouse", "Multi-Family"];
// The pipeline emits BOTH spellings of the duplex type: "Multi Family" from the
// Zillow-shaped routes (pricepoint, pp-daily, _address, sold-comps' Zillow
// branch) and "Multi-Family" from listings.js / propertydetails / the Redfin
// branch. A literal compare against the "Multi-Family" chip silently dropped
// every space-spelled listing, so that filter looked like it returned nothing.
// Canonicalize both sides: letters only, lowercased.
const canonPropType = (t) => {
  const s = String(t || "").toLowerCase().replace(/[^a-z]/g, "");
  return s === "manufactured" ? "singlefamily" : (s || "singlefamily");
};
const fpTypeMatch = (sel, pt) => {
  if (!sel || sel.length === 0) return true;
  const t = canonPropType(pt);
  return sel.some(s => canonPropType(s) === t);
};

// ── Value signals (Free Play / Live only) ──
// Keyword lexicon over the MLS description. Intentionally conservative —
// agent-spam phrases that slip through a regex are acceptable noise; missing
// a real pool is worse than flagging a fake one is not.
const PREMIUM_SIGNALS = [
  { key: "pool",      re: /\b(pool|spa|jacuzzi)\b/i,                    label: "Pool / Spa" },
  { key: "view",      re: /\b(view|views|panoramic|city lights|ocean)\b/i, label: "View" },
  { key: "remodel",   re: /\b(remodel(ed)?|renovated|updated kitchen|new (roof|hvac|windows))\b/i, label: "Updated" },
  { key: "adu",       re: /\b(adu|guest house|in-law|casita)\b/i,       label: "ADU / Guest" },
  { key: "lot",       re: /\b(corner lot|cul[- ]de[- ]sac|oversized lot|rv (parking|access))\b/i, label: "Lot premium" },
  { key: "solar",     re: /\b(owned solar|paid[- ]off solar)\b/i,       label: "Owned solar" },
];
const DISCOUNT_SIGNALS = [
  { key: "fixer",     re: /\b(fixer|tlc|as[- ]is|handyman|investor special|needs work)\b/i, label: "Needs work" },
  { key: "busy",      re: /\b(busy (street|road)|main (street|road))\b/i, label: "Busy street" },
  { key: "leasedsolar", re: /\b(leased solar|solar lease)\b/i,          label: "Leased solar" },
  { key: "probate",   re: /\b(probate|trust sale|estate sale)\b/i,      label: "Estate/probate" },
];

// Match the lexicon against a (decoded) description. Matching only — the
// description itself is never rendered here.
const extractValueSignals = (desc) => {
  const text = String(desc || "");
  if (!text) return { premium: [], discount: [] };
  return {
    premium: PREMIUM_SIGNALS.filter(s => s.re.test(text)),
    discount: DISCOUNT_SIGNALS.filter(s => s.re.test(text)),
  };
};

// ── Agent-speak decoder ──
// Listing copy is a euphemism dialect: "original charm" is how you say "not
// updated" without saying it. This lexicon translates the classic tells into
// plain English and scores each one — the translation IS the payload, so unlike
// the terse chips above these carry a `means` string. tone:
//   bad     → red    — price risk, hidden cost, or "not what it sounds like"
//   neutral → amber  — heads-up; depends, or a soft tell / buyer leverage
//   good    → green  — a genuine plus (the honest ones say it plainly)
// Curated toward strong, low-ambiguity phrases: over-flagging a nice home reads
// as cynical, so common words (e.g. "beautiful") stay out; only realtor code does.
const AGENT_SPEAK = [
  // "We can't say old / not updated"
  { key: "charm",     re: /\b(?:original charm|olde?[ -]world charm|vintage charm|period charm|full of (?:charm|character)|lots of character|loaded with character|tons of character|characterful|old[ -]world|yesteryear)\b/i, means: "usually older & not updated", tone: "bad" },
  { key: "charming",  re: /\bcharming\b/i, means: "often code for small or dated", tone: "neutral" },
  { key: "vintage",   re: /\b(?:time capsule|original condition|mostly original|well[ -]loved|lovingly (?:maintained|cared for)|estate condition)\b/i, means: "not updated in a long time", tone: "bad" },
  { key: "dated",     re: /\b(?:dated|needs? updating|update to taste|bring your (?:contractor|imagination|vision|tools|designer)|make it your own|sweat equity|some updating|a little (?:tlc|love)|needs? (?:some )?love)\b/i, means: "budget to renovate", tone: "bad" },
  { key: "cosmetic",  re: /\bcosmetic(?:s|ally)?\b/i, means: "“just cosmetic” rarely is. Get quotes", tone: "neutral" },
  // "Small"
  { key: "cozy",      re: /\b(?:cozy|quaint|snug|intimate)\b/i, means: "small", tone: "bad" },
  { key: "efficient", re: /\b(?:efficient (?:layout|floor ?plan|use of space)|space[ -]efficient)\b/i, means: "small / compact", tone: "neutral" },
  // "Needs work — that's the pitch"
  { key: "potential", re: /\b(?:tons of potential|lots of potential|great potential|full of potential|endless (?:potential|possibilities)|diamond in the rough|opportunity knocks|investor'?s dream|priced accordingly)\b/i, means: "needs work: that's the “potential”", tone: "bad" },
  { key: "bones",     re: /\b(?:good bones|great bones|solid bones)\b/i, means: "sound structure, but plan to renovate", tone: "neutral" },
  { key: "canvas",    re: /\b(?:blank (?:canvas|slate)|clean slate)\b/i, means: "unfinished: you finish it", tone: "neutral" },
  // Money / financing red flags
  { key: "cash",      re: /\b(?:cash (?:only|buyers? only|offers? only)|no financing|not financeable)\b/i, means: "likely won't pass a loan appraisal", tone: "bad" },
  { key: "permit",    re: /\b(?:unpermitted|without permits|no permits|permits? unknown|buyer to verify permits?|not permitted)\b/i, means: "unpermitted work: appraisal & resale risk", tone: "bad" },
  { key: "mello",     re: /\b(?:mello[ -]roos|special assessment|special tax|cfd fee)\b/i, means: "extra tax on top of the mortgage", tone: "bad" },
  // "Not a real bedroom"
  { key: "bedroom",   re: /\b(?:non[ -]conforming|junior (?:bed|bedroom|suite)|possible (?:3rd|4th|5th|third|fourth|fifth) (?:bed|bedroom)|optional bedroom|bonus room)\b/i, means: "a room that may not count as a legal bed", tone: "neutral" },
  // Layout / location
  { key: "layout",    re: /\b(?:unique (?:layout|floor ?plan)|quirky|one[ -]of[ -]a[ -]kind (?:layout|floor ?plan)|unconventional (?:layout|floor ?plan)|flexible floor ?plan)\b/i, means: "unusual / awkward floor plan", tone: "neutral" },
  { key: "upcoming",  re: /\b(?:up[ -]and[ -]coming|up[ -]&[ -]coming|emerging (?:neighborhood|area)|transitional (?:neighborhood|area)|developing (?:neighborhood|area)|gentrif(?:ying|ication))\b/i, means: "neighborhood not established yet", tone: "neutral" },
  { key: "freeway",   re: /\b(?:easy (?:freeway|highway) access|close to (?:the )?(?:freeway|highway)|near (?:the )?(?:freeway|highway)|convenient to (?:freeway|highway)|steps to transit)\b/i, means: "traffic / noise likely nearby", tone: "neutral" },
  // Seller pressure (buyer leverage)
  { key: "motivated", re: /\b(?:motivated seller|must sell|bring all offers|all offers (?:considered|welcome)|priced to sell|won'?t last|seller says sell)\b/i, means: "seller's under pressure: negotiate", tone: "neutral" },
  // Genuine positives (the honest listings just say it)
  { key: "turnkey",   re: /\b(?:turn[ -]?key|move[ -]in ready|nothing to do but move in|shows? like a (?:model|dream)|model[ -]perfect)\b/i, means: "genuinely updated & ready", tone: "good" },
  { key: "pride",     re: /\b(?:pride of ownership|meticulously (?:maintained|kept)|impeccably maintained|no expense spared|no detail (?:overlooked|spared))\b/i, means: "well cared for", tone: "good" },
];

// Decode a (decoded-entity) description into matched euphemisms. Returns the
// ACTUAL matched text (so the card quotes the listing's own words) plus the
// translation and tone. Warnings sort first — they're the reason this exists.
// Capped so a flowery listing can't bury the card in translations.
const AGENT_SPEAK_RANK = { bad: 0, neutral: 1, good: 2 };
const extractAgentSpeak = (desc) => {
  const text = String(desc || "");
  if (!text) return [];
  const hits = [];
  const seen = new Set();
  for (const s of AGENT_SPEAK) {
    const m = s.re.exec(text);
    if (m && !seen.has(s.key)) {
      seen.add(s.key);
      hits.push({ key: s.key, matched: m[0].toLowerCase(), means: s.means, tone: s.tone });
    }
  }
  // "charming" is the soft echo of "charm" — drop it when the strong one fired.
  let out = seen.has("charm") ? hits.filter(h => h.key !== "charming") : hits;
  out.sort((a, b) => AGENT_SPEAK_RANK[a.tone] - AGENT_SPEAK_RANK[b.tone]);
  return out.slice(0, 6);
};

// ── Inline value highlighting (Redfin-style) ──
// The chips above say WHICH signals fired; this marks WHERE in the remarks they
// fired, so the eye lands on the price movers instead of agent filler. Kept
// deliberately sparse — highlighting everything highlights nothing. Ordered
// longest-phrase-first: JS alternation is first-match-wins at a position, so
// "fully remodeled" must precede "remodeled" or the qualifier is lost.
const HIGHLIGHT_PREMIUM = new RegExp(
  "\\b(" + [
    "fully (?:remodeled|renovated|updated)", "newly (?:remodeled|renovated|built)",
    "remodeled", "renovated", "updated",
    "new (?:roof|hvac|furnace|windows|flooring|floors|kitchen|lighting|deck|siding|water heater|plumbing|electrical|foundation|island|cabinetry|garage|appliances)",
    "renewed kitchen", "chef'?s kitchen",
    "ev charger", "owned solar", "solar (?:panels )?owned",
    "hardwood floors?", "primary suite", "en[- ]suite",
    "(?:panoramic|ocean|bay|city|golden gate|water|unobstructed) views?", "views?",
    "pool", "spa", "jacuzzi",
    "adu", "guest house", "in[- ]law", "casita",
    "corner lot", "cul[- ]de[- ]sac", "oversized lot", "rv (?:parking|access)",
    "(?:two|2)[- ]car garage", "deeded parking",
  ].join("|") + ")\\b",
  "gi"
);
const HIGHLIGHT_DISCOUNT = new RegExp(
  "\\b(" + [
    "fixer(?:[- ]upper)?", "needs? (?:work|tlc|updating|repair)", "tlc",
    "as[- ]is", "handyman special", "investor special",
    "busy (?:street|road)", "leased solar", "solar lease",
    "probate", "trust sale", "estate sale", "tenant occupied", "short sale",
  ].join("|") + ")\\b",
  "gi"
);

// Non-overlapping match list across both lexicons, in document order.
const collectHighlights = (text) => {
  const hits = [];
  const scan = (re, kind) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      hits.push({ start: m.index, end: m.index + m[0].length, kind });
      if (m.index === re.lastIndex) re.lastIndex++; // zero-width guard
    }
  };
  scan(HIGHLIGHT_PREMIUM, "premium");
  scan(HIGHLIGHT_DISCOUNT, "discount");
  // Earliest start wins; on a tie the longer phrase wins.
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start >= cursor) { out.push(h); cursor = h.end; }
  }
  return out;
};

// desc string -> array of strings + <mark> nodes. Returns the raw string when
// nothing matched so the common case allocates nothing.
const renderHighlightedDesc = (text, T) => {
  const hits = collectHighlights(text);
  if (!hits.length) return text;
  const nodes = [];
  let i = 0;
  hits.forEach((h, n) => {
    if (h.start > i) nodes.push(text.slice(i, h.start));
    const c = h.kind === "premium" ? (T.accent || "#3B6BF5") : (T.orange || "#e5942a");
    nodes.push(
      <mark key={n} style={{
        background: `${c}30`, color: T.text, fontWeight: 700,
        borderRadius: 3, padding: "0 3px",
        boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone",
      }}>{text.slice(h.start, h.end)}</mark>
    );
    i = h.end;
  });
  if (i < text.length) nodes.push(text.slice(i));
  return nodes;
};

// List price safe to show pre-guess. rc_/rf_ rows fall back to the SOLD
// price in their raw listPrice — using it would leak the answer, so those
// rows only count when an enriched real list price is supplied.
const safeListPrice = (l) => {
  const zid = String(l?.zpid || "");
  if (zid.startsWith("rc_") || zid.startsWith("rf_")) return null;
  const lp = Number(l?.listPrice);
  return lp > 0 ? lp : null;
};

const ppMedian = (nums) => {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Quantitative context vs. the current mode's pool (fpListings/liveListings).
// LIST prices only — never sold. Every stat is guarded: missing/zero inputs
// simply drop that stat, and median comparisons need >= 5 usable comps of the
// same property type (fewer is too noisy to be a signal).
// `enrichedListPrice` lets rc_/rf_ subjects use the details-API list price.
const computeValueContext = (listing, pool, enrichedListPrice) => {
  const out = { ppsf: null, medianPpsf: null, ppsfDeltaPct: null, domVsMedian: null, lotVsMedian: null };
  if (!listing) return out;

  const sqft = Number(listing.sqft) || 0;
  const lp = Number(enrichedListPrice) > 0 ? Number(enrichedListPrice) : safeListPrice(listing);
  if (lp && sqft > 0) out.ppsf = lp / sqft;

  const subjectType = listing.propertyType === "Manufactured" ? "Single Family" : (listing.propertyType || "Single Family");
  const comps = (Array.isArray(pool) ? pool : []).filter(l =>
    l && l !== listing && l.zpid !== listing.zpid && fpTypeMatch([subjectType], l.propertyType)
  );
  const MIN_COMPS = 5;

  if (out.ppsf) {
    const compPpsf = comps
      .map(l => { const clp = safeListPrice(l); const s = Number(l.sqft) || 0; return clp && s > 0 ? clp / s : null; })
      .filter(v => v !== null);
    if (compPpsf.length >= MIN_COMPS) {
      out.medianPpsf = ppMedian(compPpsf);
      out.ppsfDeltaPct = ((out.ppsf - out.medianPpsf) / out.medianPpsf) * 100;
    }
  }

  const dom = Number(listing.daysOnMarket) || 0;
  if (dom > 0) {
    const compDom = comps.map(l => Number(l.daysOnMarket)).filter(v => v > 0);
    if (compDom.length >= MIN_COMPS) out.domVsMedian = { value: dom, median: ppMedian(compDom) };
  }

  const lot = Number(listing.lotSqft) || 0;
  if (lot > 0) {
    const compLot = comps.map(l => Number(l.lotSqft)).filter(v => v > 0);
    if (compLot.length >= MIN_COMPS) out.lotVsMedian = { value: lot, median: ppMedian(compLot) };
  }

  return out;
};

// ── Price Read: teaser ↔ transparent ↔ ambitious ──
// Two inputs decide the read:
//   d = where it's LISTED   — list $/sqft vs area median (vc.ppsfDeltaPct, %)
//   q = where it SHOULD sit — quality premium implied by the value signals
//       (green pushes up, red/amber down), capped so a chip-spam listing can't
//       run the needle to the rail.
// The gap (d − q) is the read: listed well under its deserved value = teaser
// (underpriced, bidding war); listed at it = transparent; listed over it =
// ambitious (may sit or cut). This is why a *fixer* listed cheap reads
// transparent, not teaser — its low q justifies the low d.
// Needs a real area median (>= MIN_COMPS) — returns null otherwise, so the
// gauge simply hides rather than inventing a read from nothing.
const PRICE_READ_PER_SIGNAL = 4;   // % of value credited per net signal
const PRICE_READ_CAP = 18;         // max quality swing we'll credit, ± %
const priceReadSentiment = (premium, discount, decoded) => {
  let s = (premium?.length || 0) - (discount?.length || 0);
  for (const d of (decoded || [])) s += d.tone === "good" ? 1 : d.tone === "bad" ? -1 : -0.5;
  return s;
};
const computePriceRead = (vc, premium, discount, decoded) => {
  if (!vc || vc.ppsfDeltaPct == null || vc.medianPpsf == null) return null;
  const d = vc.ppsfDeltaPct;
  const s = priceReadSentiment(premium, discount, decoded);
  const q = Math.max(-PRICE_READ_CAP, Math.min(PRICE_READ_CAP, s * PRICE_READ_PER_SIGNAL));
  const gap = d - q;                                       // <0 teaser · ~0 transparent · >0 ambitious
  const position = Math.max(8, Math.min(92, 50 + gap * 2)); // 0..100 left→right (inset to clear the end labels)
  const zone = gap <= -6 ? "teaser" : gap >= 8 ? "ambitious" : "transparent";
  return { d, s, q, gap, position, zone };
};

// Compute + render the Price Read gauge for a listing, or null when there's no
// area median to read against. Self-contained (re-derives desc/signals) so the
// SAME card can appear pre-guess (For Sale) or post-guess (Sold reveal) without
// threading state through PropertyCard/RevealCard.
const renderPriceRead = (listing, valuePool, details, T) => {
  if (!listing || !valuePool) return null;
  const zid = String(listing.zpid || "");
  const enrichedLp = (zid.startsWith("rc_") || zid.startsWith("rf_"))
    ? (details?.listPrice && details.listPrice !== listing.soldPrice ? details.listPrice : null)
    : null;
  const vc = computeValueContext(listing, valuePool, enrichedLp);
  const desc = decodeEntities(details?.description || listing.description);
  const sigs = extractValueSignals(desc);
  const decoded = extractAgentSpeak(desc);
  const pr = computePriceRead(vc, sigs.premium, sigs.discount, decoded);
  if (!pr) return null;
  const zoneColor = pr.zone === "transparent" ? T.green : T.orange;
  const zoneLabel = pr.zone === "teaser" ? "Likely a teaser" : pr.zone === "ambitious" ? "Ambitious ask" : "Priced near value";
  const absd = Math.round(Math.abs(pr.d));
  const listPart = Math.abs(pr.d) < 2 ? "Listed about at the area’s $/sqft"
    : pr.d < 0 ? `Listed ${absd}% under the area’s $/sqft`
    : `Listed ${absd}% over the area’s $/sqft`;
  const sigPart = pr.s >= 2 ? "strong upside in the signals"
    : pr.s > 0 ? "mildly positive signals"
    : pr.s <= -2 ? "several red flags"
    : pr.s < 0 ? "some red flags"
    : "no strong signals either way";
  const tail = pr.zone === "teaser" ? "reads like bait pricing; expect offers over ask"
    : pr.zone === "ambitious" ? "priced above where the signals land; may sit or cut"
    : "looks priced near what it’s worth";
  const tick = (z, label) => (
    <span style={{ fontSize: 8.5, letterSpacing: 1, fontFamily: MONO, color: pr.zone === z ? zoneColor : T.textTertiary, fontWeight: pr.zone === z ? 700 : 400 }}>{label}</span>
  );
  return (
    <div style={{ marginTop: IS_MOBILE ? 6 : 10, background: T.inputBg, borderRadius: 10, padding: IS_MOBILE ? "8px 12px" : "10px 14px", border: `1px solid ${T.cardBorder}` }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 9 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary }}>Price Read</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: FONT, color: zoneColor }}>{zoneLabel}</span>
      </div>
      <div style={{ position: "relative", height: 8, borderRadius: 9999, background: `linear-gradient(90deg, ${T.orange}, ${T.green} 50%, ${T.orange})`, opacity: 0.9 }} />
      <div style={{ position: "relative", height: 0 }}>
        <div style={{ position: "absolute", left: `${pr.position}%`, top: -14, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: 2, height: 16, background: T.text }} />
          <div style={{ width: 11, height: 11, borderRadius: 9999, background: T.text, border: `2px solid ${T.inputBg}`, marginTop: -3 }} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        {tick("teaser", "TEASER")}{tick("transparent", "TRANSPARENT")}{tick("ambitious", "AMBITIOUS")}
      </div>
      <div style={{ fontSize: 11.5, color: T.textSecondary, fontFamily: FONT, lineHeight: 1.5, marginTop: 8 }}>
        {listPart}, with {sigPart}: {tail}.
      </div>
    </div>
  );
};

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

const isRecentSale = (l) => {
  if (!l.soldDate) return true; // no date = assume recent
  const saleDate = new Date(l.soldDate);
  const cutoff = new Date();
  // 12-month window. The server runs a tiered pool: 0-6mo entries are
  // preferred, 6-12mo entries fill in when the fresh bucket is thin. Keeping
  // the client window at 6mo would reject the older-tier fallback entries
  // and re-empty the pool. Server is the source of truth on freshness.
  cutoff.setMonth(cutoff.getMonth() - 12);
  return saleDate >= cutoff;
};

// Order listings recent-first: bucket by sold-date age, shuffle within each
// bucket so repeat sessions still vary, then concatenate.
//   prime: sold within 3 months          -> always first
//   fresh: 3-6 months                    -> next
//   older: 6-12 months OR no soldDate    -> last-resort filler
// Note: unlike isRecentSale ("no date = assume recent", which KEEPS a listing
// in the pool), ordering sends unknown dates to the back — never lead with a
// sale we can't date.
const orderByRecency = (listings) => {
  const now = new Date();
  const cut3 = new Date(now); cut3.setMonth(cut3.getMonth() - 3);
  const cut6 = new Date(now); cut6.setMonth(cut6.getMonth() - 6);
  const prime = [], fresh = [], older = [];
  for (const l of listings) {
    const d = l.soldDate ? new Date(l.soldDate) : null;
    if (d && !isNaN(d) && d >= cut3) prime.push(l);
    else if (d && !isNaN(d) && d >= cut6) fresh.push(l);
    else older.push(l);
  }
  const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
  // Prime is strictly newest-first — a home that sold yesterday IS the first
  // card. Session variety comes from guessed-card exclusion and the pool
  // refreshing daily, not from shuffling the freshest sales out of order.
  const newestFirst = (a) => [...a].sort((x, y) => new Date(y.soldDate) - new Date(x.soldDate));
  return [...newestFirst(prime), ...shuffle(fresh), ...shuffle(older)];
};

// Format a sold date (ISO "2025-12-15") → "SOLD DEC '25" for the photo pill.
// Uses UTC getters so a date-only string isn't shifted a day by local tz.
// "JUL '26" — three-letter month + two-digit year (Christo's format).
const fmtMonthYear = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const mo = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][d.getUTCMonth()];
  return `${mo} '${String(d.getUTCFullYear()).slice(2)}`;
};
const fmtSoldPill = (iso) => { const s = fmtMonthYear(iso); return s ? `SOLD ${s}` : null; };
// For Sale cards render the prior sale as a Value Signals row, not a photo pill,
// so there's no fmtLastSoldPill — fmtMonthYear is used directly there.

const getDailyProperty = (soldListings, market) => {
  if (!soldListings || soldListings.length === 0) return null;
  // Prefer real, recent sold data over SAMPLE_SOLD
  const realSold = soldListings.filter(l => l._source !== "sample" && l.soldPrice && isRecentSale(l));
  const pool = realSold.length > 0 ? realSold : soldListings.filter(l => l.soldPrice && isRecentSale(l));
  if (pool.length === 0) {
    // Last resort: any listing with a sold price (even sample)
    const fallback = soldListings.filter(l => l.soldPrice);
    if (fallback.length === 0) return null;
    const dayNum = getDailyNumber();
    const hash = hashDayAndMarket(dayNum, market);
    return { ...fallback[Math.abs(hash) % fallback.length], dailyNumber: dayNum };
  }
  const dayNum = getDailyNumber();
  const hash = hashDayAndMarket(dayNum, market);
  const idx = Math.abs(hash) % pool.length;
  return { ...pool[idx], dailyNumber: dayNum };
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

// ── No sample data — real data or nothing. Sentinel for "no data loaded yet". ──
const SAMPLE_SOLD = [];

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
// Extended zip mapping: some neighborhoods span multiple zips not in LAUNCH_MARKETS.neighborhoods
// This ensures resolveNeighborhood works for properties returned by the API.
const EXTENDED_ZIP_HOOD = {
  "94116": "Sunset",   // Parkside/Sunset — same neighborhood area as 94122
  "94121": "Richmond",  // Outer Richmond
  "94117": "Haight",
  "94127": "St. Francis Wood",
  "94129": "Presidio",
  "94130": "Treasure Island",
  "94132": "Lake Merced",
  "94133": "North Beach",
  "94134": "Visitacion Valley",
  "94158": "Mission Bay",
};
Object.entries(EXTENDED_ZIP_HOOD).forEach(([zip, name]) => {
  if (!ZIP_TO_HOOD[zip]) ZIP_TO_HOOD[zip] = name;
});

// Forward lookup: neighborhood name → all zip codes in that area (for Free Play filtering)
// A neighborhood picker sends a single zip, but the actual data may come from sibling zips.
const HOOD_ZIP_GROUPS = {};
Object.entries(ZIP_TO_HOOD).forEach(([zip, name]) => {
  const key = name.toLowerCase();
  if (!HOOD_ZIP_GROUPS[key]) HOOD_ZIP_GROUPS[key] = new Set();
  HOOD_ZIP_GROUPS[key].add(zip);
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
// v4: real sold comps from property-details priceHistory (search API returns fake sold data)
// v5: fix — don't merge fake search API sold data with real sold-comps
// v7: SAMPLE_SOLD tagged as "sample" source, getDailyProperty filters out samples,
// Free Play/Live tabs no longer gated behind daily completion
// v8: Fix neighborhood mismatch (no more city-wide fallback), fix photos (use listing.photos from sold-comps)
// v9: Load More button in Free Play — zip-specific sold-comps fetch + auto-discovery via nearbyHomes
// v10: Remove SAMPLE_SOLD fake data, fix neighborhood zip groups (Sunset = 94122+94116),
//      fix photos (extractPhotos loop), fix neighborhood labels (zip-to-hood server-side)
// v11: Strict neighborhood filtering (no city-wide fallback), cross-neighborhood dedup,
//      validate search-API sold data (require soldDate, soldPrice != listPrice),
//      Zillow link in Free Play + RevealCard
const PP_DATA_VERSION = 11;
function migrateLocalStorage() {
  try {
    const stored = parseInt(localStorage.getItem("pp-data-version") || "0", 10);
    if (stored < PP_DATA_VERSION) {
      // Clear stale listing data (keep player ID, display name, market selection)
      localStorage.removeItem("pp-sold-listings");
      localStorage.removeItem("pp-active-listings");
      localStorage.removeItem("pp-all-results");
      localStorage.removeItem("pp-daily-result");
      localStorage.removeItem("pp-predictions");
      localStorage.removeItem("pp-fp-guessed-zpids");
      localStorage.setItem("pp-data-version", String(PP_DATA_VERSION));
      if (import.meta.env.DEV) console.log(`[PricePoint] Data version upgraded ${stored} → ${PP_DATA_VERSION}, cleared stale listings`);
      return true; // signal: need fresh fetch
    }
  } catch {}
  return false;
}

// ── Static map URL builder (Mapbox) ──
const getStaticMapUrl = (lat, lng) => {
  if (!lat || !lng) return null;
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!token) return null;
  // Mapbox Static Images API — dark style, indigo marker, retina (@2x)
  const marker = `pin-s+3b6bf5(${lng},${lat})`;
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${marker}/${lng},${lat},14.5,0/800x520@2x?access_token=${token}&attribution=false&logo=false`;
};

// ── Photo Carousel ──
// MODULE SCOPE ON PURPOSE (2026-07-19). This used to be declared inside
// PricePoint, which gave it a new function identity on every parent render —
// React saw a different component type, unmounted it, and reset `idx` to 0.
// Typing a guess re-renders the parent on each keystroke, so the carousel
// silently snapped back to photo 1 mid-typing. Hoisting it out keeps carousel
// AND lightbox state alive; `isDesktop` now arrives as a prop.
const PhotoCarouselBase = ({ photos, fallbackPhoto, badge, badgeColor, accent, pType, showExtras, datePill, listing, FONT, isDesktop, hideHoodPill, isLoadingDetails }) => {
  const [idx, setIdx] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const touchStartX = useRef(null);
  const zoomTouchStartX = useRef(null);
  const mapUrl = getStaticMapUrl(listing?.latitude, listing?.longitude);
  // Real photos first; else the single fallback photo; else let the map be
  // the hero (licensed sources like RentCast carry no photos); placeholder
  // only when there's nothing else to show. De-dupe by URL — some feeds repeat
  // the hero shot, which otherwise rendered as "photo 2 = a copy of photo 1".
  const basePhotos = photos && photos.length > 0 ? [...new Set(photos)] : (fallbackPhoto ? [fallbackPhoto] : (mapUrl ? [] : [NO_PHOTO]));
  // Append the location map as the last slide when lat/lng exist. It's counted
  // as a real slide (e.g. a lone photo + map reads "1 / 2" → "2 / 2") so people
  // discover there's a location to swipe to; the LOCATION label + blue dot mark
  // which slide it is.
  const allPhotos = mapUrl ? [...basePhotos, mapUrl] : basePhotos;
  const count = allPhotos.length;
  const isMapSlide = mapUrl && idx === count - 1;
  const go = (dir) => setIdx(i => dir === "next" ? (i + 1) % count : (i - 1 + count) % count);
  const showHood = !hideHoodPill && !isMapSlide && listing && resolveNeighborhood(listing) !== "Unknown Area";

  // Esc closes the lightbox; arrows page it. Bound only while open.
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e) => {
      if (e.key === "Escape") setZoomed(false);
      else if (e.key === "ArrowRight") go("next");
      else if (e.key === "ArrowLeft") go("prev");
    };
    window.addEventListener("keydown", onKey);
    // Don't let the page scroll behind the overlay.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [zoomed, count]);

  return (
    <div style={{ position: "relative", touchAction: "pan-y", ...(isDesktop ? { height: "100%" } : {}) }}
      onTouchStart={e => { e.stopPropagation(); touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        // Keep photo swipes local — don't let them bubble up and switch apps.
        e.stopPropagation();
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(dx) > 40) go(dx < 0 ? "next" : "prev");
      }}>
      <img src={allPhotos[idx] || NO_PHOTO} alt={isMapSlide ? "Property location map" : ""} loading={idx === 0 ? "eager" : "lazy"} decoding="async"
        onClick={() => setZoomed(true)}
        style={{ width: "100%", height: IS_MOBILE ? "clamp(160px, calc(100vh - 625px), 400px)" : (isDesktop ? "100%" : 260), objectFit: "cover", display: "block", transition: "opacity 0.25s", cursor: "zoom-in" }}
        onError={onPhotoError} />
      {/* Map slide "Location" label — top left on map, replaces badges */}
      {isMapSlide ? (
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
          <div style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "5px 12px", display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: FONT, letterSpacing: 1, textTransform: "uppercase" }}>
            <Icon name="map-pin" size={12} /> LOCATION
          </div>
        </div>
      ) : (
        /* Top badges — photos only */
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
          {badge && (
            <div style={{ background: `${badgeColor || accent}E6`, backdropFilter: "blur(8px)", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: FONT, letterSpacing: 1, textTransform: "uppercase" }}>{badge}</div>
          )}
          {showExtras && pType && (
            <div style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: "#fff", fontFamily: FONT, letterSpacing: 1, textTransform: "uppercase" }}>{pType}</div>
          )}
        </div>
      )}
      {/* Photo count pill + expand affordance — top right. "1/3", or "MAP". */}
      <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 6, alignItems: "center" }}>
        {isLoadingDetails && (
          <div style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "#fff", fontFamily: FONT, animation: "ppPulse 1.2s ease infinite" }}>Loading photos...</div>
        )}
        {count > 1 && (
          <div style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "#fff", fontFamily: FONT }}>
            {`${idx + 1} / ${count}`}
          </div>
        )}
        {/* Tapping the photo also opens this — the button is the discoverability cue. */}
        <button onClick={(e) => { e.stopPropagation(); setZoomed(true); }} aria-label="Expand photo"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", border: "none", borderRadius: 8, padding: "5px 8px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <Icon name="maximize" size={13} />
        </button>
      </div>
      {/* Prev / Next arrows */}
      {count > 1 && (
        <>
          <button aria-label="Previous photo" onClick={() => go("prev")} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.45)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}><Icon name="chevron-left" size={16} /></button>
          <button aria-label="Next photo" onClick={() => go("next")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.45)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}><Icon name="chevron-right" size={16} /></button>
        </>
      )}
      {/* Dot indicators */}
      {count > 1 && count <= 12 && (
        <div style={{ position: "absolute", bottom: showHood || datePill ? 48 : 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5 }}>
          {allPhotos.map((_, i) => {
            const isMap = mapUrl && i === count - 1;
            return (
              <div key={i} onClick={() => setIdx(i)} style={{ width: i === idx ? (isMap ? 20 : 16) : 6, height: 6, borderRadius: 3, background: i === idx ? "#fff" : isMap ? "rgba(59,107,245,0.6)" : "rgba(255,255,255,0.5)", cursor: "pointer", transition: "all 0.2s" }} />
            );
          })}
        </div>
      )}
      {/* Bottom row: neighborhood (left, photos only) + sold date (right, every slide
          incl. map — sold date is orthogonal to location, and RentCast Free Play
          listings are often map-only, where it's most useful) */}
      {listing && (showHood || datePill) && (
        <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, display: "flex", alignItems: "center", gap: 6 }}>
          {showHood && (
            <div style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderRadius: 10, padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="map-pin" size={13} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: FONT }}>{resolveNeighborhood(listing)}</span>
            </div>
          )}
          {datePill && (
            <div style={{ marginLeft: "auto", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderRadius: 10, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Icon name="calendar" size={13} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: FONT }}>{datePill}</span>
            </div>
          )}
        </div>
      )}

      {/* ═══ LIGHTBOX ═══ full-bleed photo; objectFit contain so nothing crops */}
      {zoomed && (
        <div onClick={() => setZoomed(false)}
          style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.94)", display: "flex", alignItems: "center", justifyContent: "center", animation: "ppFadeIn 0.2s ease", touchAction: "pan-y" }}
          onTouchStart={e => { e.stopPropagation(); zoomTouchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            e.stopPropagation();
            if (zoomTouchStartX.current === null) return;
            const dx = e.changedTouches[0].clientX - zoomTouchStartX.current;
            zoomTouchStartX.current = null;
            if (Math.abs(dx) > 40) go(dx < 0 ? "next" : "prev");
          }}>
          <img src={allPhotos[idx] || NO_PHOTO} alt="" onClick={e => e.stopPropagation()} onError={onPhotoError}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
          <button onClick={(e) => { e.stopPropagation(); setZoomed(false); }} aria-label="Close"
            style={{ position: "absolute", top: "max(16px, env(safe-area-inset-top))", right: 16, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.14)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
            <Icon name="x" size={20} />
          </button>
          {count > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); go("prev"); }} aria-label="Previous photo"
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.14)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}><Icon name="chevron-left" size={22} /></button>
              <button onClick={(e) => { e.stopPropagation(); go("next"); }} aria-label="Next photo"
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.14)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}><Icon name="chevron-right" size={22} /></button>
              <div style={{ position: "absolute", bottom: "max(20px, env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)", background: "rgba(255,255,255,0.14)", backdropFilter: "blur(8px)", borderRadius: 9999, padding: "6px 14px", fontSize: 12, fontWeight: 600, color: "#fff", fontFamily: FONT }}>
                {`${idx + 1} / ${count}`}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

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

  // ── Map view (A4) — shared List | Map toggle for freeplay + live ──
  const [showMap, setShowMap] = useState(false);
  // Reset the toggle whenever the view changes (leaving freeplay/live must
  // never leave a stale map open on return).
  useEffect(() => { setShowMap(false); }, [view]);

  // ── Free Play State ──
  const [fpListings, setFpListings] = useState([]);
  const [fpIdx, setFpIdx] = useState(0);
  const [fpGuessInput, setFpGuessInput] = useState("");
  const [fpResult, setFpResult] = useState(null);
  const [mlsExpanded, setMlsExpanded] = useState(false);
  const [valueSignalsOpen, setValueSignalsOpen] = useState(false); // "Value signals" section (freeplay/live PropertyCard)
  const [fpSelectedNeighborhood, setFpSelectedNeighborhood] = useState(null);
  const [fpLoadingMore, setFpLoadingMore] = useState(false);
  const [fpHasMore, setFpHasMore] = useState(true); // assume more available until proven otherwise
  const fpZipRef = useRef(null); // ARRAY of selected zips (or null = all) for Load More
  // Multi-select filters (picker screen). Types persist; hoods are per-visit.
  const [fpHoodSel, setFpHoodSel] = useState([]); // hood names; [] = all
  const [fpTypeSel, setFpTypeSel] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem("pp-fp-types") || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
  });
  const toggleFpType = (t) => setFpTypeSel(prev => {
    const next = prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t];
    try { localStorage.setItem("pp-fp-types", JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  // Live (For Sale) keeps its OWN type filter — the two modes are browsed
  // independently, and inheriting a Sold-side "Condo only" into For Sale
  // would silently shrink the active pool with no visible cause.
  const [liveTypeSel, setLiveTypeSel] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem("pp-live-types") || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
  });
  const toggleLiveType = (t) => setLiveTypeSel(prev => {
    const next = prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t];
    try { localStorage.setItem("pp-live-types", JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  // ── Challenge Mode State ──
  const [challengeData, setChallengeData] = useState(null);
  const [challengeGuess, setChallengeGuess] = useState("");
  const [challengeResult, setChallengeResult] = useState(null);
  const [h2h, setH2h] = useState(() => readH2H()); // head-to-head W/L record

  // ── Notification State ──
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({ push_enabled: false, email_enabled: false, sms_enabled: false, email: '', phone: '' });
  const [notifPrefsLoading, setNotifPrefsLoading] = useState(false);
  const [notifEmailInput, setNotifEmailInput] = useState('');
  const [notifPhoneInput, setNotifPhoneInput] = useState('');
  // Payoff-loop capture card (live/H2H reveals): email input + save state.
  const [captureEmail, setCaptureEmail] = useState('');
  const [captureState, setCaptureState] = useState('idle'); // idle | saving | saved | denied
  // ── Admin: "Run resolve now" (hidden from normal users) ──
  // Sticky per-browser: visit .../pricepoint?admin=1 once and the admin tools
  // stay visible on this device. Regular visitors never set the flag.
  const [isAdmin] = useState(() => {
    try {
      if (new URLSearchParams(window.location.search).get('admin') === '1') {
        localStorage.setItem('pp_admin', '1'); return true;
      }
      return localStorage.getItem('pp_admin') === '1';
    } catch { return false; }
  });
  const [resolveMsg, setResolveMsg] = useState(null);
  // Fires /api/cron-resolve with the CRON_SECRET. The secret is NEVER in the
  // app bundle — the admin types it once and it's held only for this tab.
  const runResolveNow = async () => {
    let secret = '';
    try { secret = sessionStorage.getItem('pp_cron_secret') || ''; } catch {}
    if (!secret) {
      secret = window.prompt('Enter CRON_SECRET (Vercel → Settings → Environment Variables). Stays only in this browser tab.') || '';
      if (!secret.trim()) return;
      secret = secret.trim();
      try { sessionStorage.setItem('pp_cron_secret', secret); } catch {}
    }
    setResolveMsg('Checking…');
    try {
      // Fast schema smoke test — NOT the full resolve (that also backfills photos
      // + pulls fresh listings and can exceed the gateway timeout → 504).
      // Secret travels in the Authorization header, never the URL (URLs land in logs).
      const r = await fetch(apiUrl('/api/cron-resolve?check=1'), { headers: { Authorization: `Bearer ${secret}` } });
      const j = await r.json().catch(() => null);
      if (r.status === 401) {
        try { sessionStorage.removeItem('pp_cron_secret'); } catch {}
        setResolveMsg('✕ Wrong secret: cleared it. Tap the button again to re-enter.');
        return;
      }
      if (!r.ok) { setResolveMsg(`✕ ${j?.error || `HTTP ${r.status}`}`); return; }
      // Guard against a non-JSON 200 (e.g. an HTML fallback) reading as "clean".
      if (!j || (j.errors === undefined && j.ok === undefined)) {
        setResolveMsg(`Unexpected response (HTTP ${r.status}). Is the endpoint deployed?`);
        return;
      }
      const errs = Array.isArray(j.errors) ? j.errors.length : 0;
      const waiting = j.unresolved != null ? ` ${j.unresolved} prediction(s) waiting to resolve.` : '';
      setResolveMsg(errs === 0
        ? `✓ Pipeline healthy: every table/column present, 0 errors.${waiting}`
        : `✕ ${errs} issue(s): ${JSON.stringify(j.errors).slice(0, 220)}`);
    } catch (e) {
      setResolveMsg(`✕ ${e?.message || 'request failed'}`);
    }
  };

  // ── Active Listings (for Live Mode) — persisted to localStorage ──
  const [activeListings, setActiveListings] = useState(() => {
    try {
      const cached = localStorage.getItem("pp-active-listings");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (import.meta.env.DEV) console.log(`[PricePoint] Loaded ${parsed.length} active listings from cache`);
          return parsed;
        }
      }
    } catch {}
    return [];
  });

  // ── Live Mode State ──
  const [liveListings, setLiveListings] = useState([]);
  const [liveIdx, setLiveIdx] = useState(0);
  const [liveGuessInput, setLiveGuessInput] = useState("");
  const [liveHoodFilter, setLiveHoodFilter] = useState(null); // null = all, or zip string
  const [liveHoodName, setLiveHoodName] = useState(null); // display name of selected neighborhood
  const [livePrediction, setLivePrediction] = useState(null);
  // ── Group scoreboard: every player's locked call on the current property ──
  // Fetched AFTER a guess is locked (own reveal or challenge reveal), so it can
  // never anchor anyone. Re-fetched once after a short delay so the caller's
  // own just-POSTed prediction shows up without a manual refresh.
  const [propCalls, setPropCalls] = useState(null);
  // A past prediction opened from Stats — shows that property's board.
  // Same board as the live/challenge reveals: all paths key on the zpid.
  const [boardProp, setBoardProp] = useState(null);
  useEffect(() => {
    const zpid =
      boardProp?.zpid ||
      (view === "challenge" && challengeResult?.isLive && challengeData?.listing?.zpid) ||
      (view === "live" && livePrediction?.zpid) || null;
    if (!zpid) { setPropCalls(null); return; }
    let dead = false;
    const load = () => fetchPropertyCalls(zpid).then(d => { if (!dead && d) setPropCalls(d); });
    load();
    const t = setTimeout(load, 2000); // catch our own just-POSTed row
    return () => { dead = true; clearTimeout(t); };
  }, [view, livePrediction, challengeResult, challengeData, boardProp]);

  // Open a past prediction's board. Predictions saved before 2026-07-24 have
  // no zpid (the field wasn't persisted) — try to recover it by matching the
  // address against the zip's active listings, and patch the stored row so
  // the lookup only ever runs once.
  const openPredictionBoard = (pred) => {
    setPropCalls(null);
    setBoardProp(pred);
    if (pred.zpid || !pred.address || !pred.zip) return;
    const cityName = pred.city || market?.city || "San Francisco";
    const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    fetch(apiUrl(`/api/pricepoint?city=${encodeURIComponent(cityName)}&zip=${pred.zip}`))
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const ls = d?.listings || d?.activeListings || d?.results || [];
        const hit = ls.find(l => l?.zpid && norm(l.address) === norm(pred.address));
        if (!hit) return;
        setAllPredictions(prev => prev.map(x =>
          (x.timestamp === pred.timestamp && x.address === pred.address) ? { ...x, zpid: String(hit.zpid) } : x));
        setBoardProp(prev =>
          (prev && prev.timestamp === pred.timestamp) ? { ...prev, zpid: String(hit.zpid) } : prev);
      })
      .catch(() => {});
  };

  // Scoreboard rows for the current property — rendered only post-lock.
  const renderCallsBoard = (listPrice) => {
    const calls = propCalls?.calls || [];
    if (calls.length === 0) return null;
    const vs = (g) => (listPrice ? ((g - listPrice) / listPrice) * 100 : null);
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary, marginBottom: 8 }}>
          The Field · {calls.length} {calls.length === 1 ? "call" : "calls"}
        </div>
        {calls.map((c, i) => {
          const v = vs(c.guess);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 10, background: c.you ? `${T.accent}14` : T.inputBg, border: `1px solid ${c.you ? `${T.accent}55` : T.cardBorder}`, marginBottom: 6 }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, fontFamily: FONT, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.you ? "You" : (c.name || "Player")}
              </div>
              {v != null && (
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: FONT, color: v >= 0 ? T.orange : T.green }}>
                  {v >= 0 ? "+" : ""}{v.toFixed(1)}% vs list
                </div>
              )}
              <div style={{ fontSize: 14, fontWeight: 800, fontFamily: FONT, color: T.text, fontVariantNumeric: "tabular-nums" }}>{fmt(c.guess)}</div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Payoff-loop capture ──
  // A live call's payoff arrives AFTER the player leaves — when the home
  // closes. Link-invited friends default to every channel off, so "we'll tell
  // you who won" is only true if they happen to come back. Shown on the
  // live/H2H reveals and the pending-sale board until a channel is on.
  const renderNotifyCapture = () => {
    if (!playerId) return null;
    if (captureState === 'saved') return (
      <div style={{ padding: "12px 14px", background: `${T.green}12`, border: `1px solid ${T.green}30`, borderRadius: 14, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="bell" size={14} style={{ color: T.green, flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: T.text, fontFamily: FONT }}>You're set: we'll ping you the moment it closes.</div>
      </div>
    );
    if (notifPrefs.push_enabled || notifPrefs.email_enabled || notifPrefs.sms_enabled) return null;
    const saveEmail = async () => {
      const em = captureEmail.trim();
      if (!em || !em.includes('@') || captureState === 'saving') return;
      setCaptureState('saving');
      const r = await updateNotificationPreferences(playerId, { email_enabled: true, email: em });
      if (r) {
        setNotifPrefs(p => ({ ...p, email_enabled: true, email: em }));
        setNotifEmailInput(em);
        setCaptureState('saved');
      } else setCaptureState('idle');
    };
    return (
      <div style={{ padding: 14, background: T.inputBg, border: `1px solid ${T.cardBorder}`, borderRadius: 14, marginBottom: 14, textAlign: "left" }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.accent, marginBottom: 4 }}>Get the result</div>
        <div style={{ fontSize: 12, color: T.textSecondary, fontFamily: FONT, lineHeight: 1.45, marginBottom: 10 }}>
          {captureState === 'denied'
            ? "Notifications are blocked for this site. Leave an email instead and we'll send the result."
            : "This settles when the sale closes. We'll tell you how your call did."}
        </div>
        {pushSupported() && captureState !== 'denied' && (
          <button onClick={async () => {
            const r = await enablePush(playerId);
            if (r.ok) { setNotifPrefs(p => ({ ...p, push_enabled: true })); setCaptureState('saved'); }
            else if (r.reason === 'denied') setCaptureState('denied');
          }} style={{ width: "100%", padding: 11, borderRadius: 9999, border: "none", background: "linear-gradient(135deg, #3B6BF5, #2B4FCE)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Icon name="bell" size={14} /> Notify me when it sells
          </button>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="email" placeholder="your@email.com" value={captureEmail}
            onChange={e => setCaptureEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveEmail(); }}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.cardBorder}
            style={{ flex: 1, minWidth: 0, padding: "10px 14px", fontSize: 13, fontFamily: FONT, background: T.card, color: T.text, border: `1px solid ${T.cardBorder}`, borderRadius: 9999, outline: "none" }}
          />
          <button onClick={saveEmail} disabled={captureState === 'saving'} style={{ padding: "10px 18px", borderRadius: 9999, border: `1px solid ${T.accent}55`, background: `${T.accent}18`, color: T.accent, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT, flexShrink: 0 }}>
            {captureState === 'saving' ? "Saving…" : "Email me"}
          </button>
        </div>
      </div>
    );
  };
  // Zpids predicted THIS session — the pool keeps them (so the map can show
  // "already predicted" pins), but the card cursor skips them. Reset on every
  // enterLiveMode; the durable exclusion lives in liveGuessedZpidsRef below.
  const [liveGuessedZpids, setLiveGuessedZpids] = useState(() => new Set());
  // ── Live address search (A3) — guess ANY property, not just the pool ──
  const [liveSearchAddr, setLiveSearchAddr] = useState("");        // input text
  const [liveSearchLoading, setLiveSearchLoading] = useState(false);
  const [liveSearchListing, setLiveSearchListing] = useState(null); // object|null
  const [liveSearchError, setLiveSearchError] = useState(null);     // string|null
  const [liveSearchGuessInput, setLiveSearchGuessInput] = useState("");
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
  const [dailySubmitting, setDailySubmitting] = useState(false); // awaiting server daily score
  const [serverXp, setServerXp] = useState(null); // authoritative XP from pp-guess responses
  const [syncToast, setSyncToast] = useState(null); // "saved offline / will sync" banner

  // ── Property Details (lazy-fetched for Live mode: photos + description) ──
  const [propertyDetails, setPropertyDetails] = useState({}); // keyed by zpid

  // Resolve the REAL original asking price for a listing.
  //
  // The sold pool's raw listPrice is usually a placeholder equal to soldPrice —
  // ~90% of rf_/rc_ rows (measured Alameda 2026-07-19: 24 of 250 carried a
  // genuine one). The enriched /api/propertydetails fetch DOES carry the true
  // asking price; PropertyCard already prefers it, but the reveal was reading
  // listing.listPrice directly, so "Listed for" almost never appeared even
  // though the data was sitting in propertyDetails. Costs no extra API call —
  // the details are already fetched for the card.
  //
  // Same test as the card: a list price equal to the sold price is not an
  // anchor, it's the answer, so it never renders.
  const trueListPrice = (lst) => {
    if (!lst) return null;
    const det = propertyDetails[lst.zpid];
    const raw = lst.listPrice && lst.listPrice !== lst.soldPrice ? lst.listPrice : null;
    const enriched = det?.listPrice && det.listPrice !== lst.soldPrice ? det.listPrice : null;
    return raw || enriched;
  };
  const [detailsLoading, setDetailsLoading] = useState(null); // zpid currently loading
  const detailsCacheRef = useRef({}); // persist across re-renders

  const fetchingRef = useRef({}); // track in-flight fetches to avoid duplicates
  // Accepts either a zpid string (Zillow rows) or a full listing object.
  // RentCast rows (rc_ ids) NEED the listing object — their photos/description
  // are looked up by street address and persisted server-side on first view.
  const fetchPropertyDetails = useCallback(async (listingOrZpid) => {
    const lst = listingOrZpid && typeof listingOrZpid === "object" ? listingOrZpid : null;
    const zpid = lst ? lst.zpid : listingOrZpid;
    if (!zpid) return;
    // rc_ (RentCast) and rf_ (Redfin) rows both enrich via the rcid route —
    // the server branches on the prefix (rf_ uses Redfin detail-by-url).
    const isRc = String(zpid).startsWith('rc_') || String(zpid).startsWith('rf_');
    if (isRc && (!lst || !lst.address || !lst.city)) return; // can't resolve without an address
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
      const reqUrl = isRc
        ? apiUrl(`/api/propertydetails?rcid=${encodeURIComponent(zpid)}&address=${encodeURIComponent(`${lst.address}, ${lst.city}, ${lst.state || "CA"} ${lst.zip || ""}`.trim())}`)
        : apiUrl(`/api/propertydetails?zpid=${zpid}`);
      const res = await fetch(reqUrl);
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

  // ── Fetch MORE sold comps for current Free Play zip (Load More button) ──
  const fetchMoreSoldComps = useCallback(async (zipOrZips) => {
    const zips = (Array.isArray(zipOrZips) ? zipOrZips : [zipOrZips]).filter(Boolean);
    if (zips.length === 0 || fpLoadingMore) return;
    setFpLoadingMore(true);
    try {
      const cityName = market?.city || market?.label?.split(",")[0] || "San Francisco";
      // Collect all zpids we already have
      const existingZpids = fpListings.map(l => l.zpid).filter(Boolean);
      const excludeParam = existingZpids.length > 0 ? `&exclude=${existingZpids.join(",")}` : "";
      // Multi-neighborhood: fetch every selected zip in parallel and merge.
      const results = await Promise.allSettled(zips.map(z =>
        fetch(apiUrl(`/api/sold-comps?city=${encodeURIComponent(cityName)}&zip=${z}&more=1${excludeParam}`))
          .then(r => (r.ok ? r.json() : null))
      ));
      const merged = [];
      let anyMore = false;
      for (const r of results) {
        if (r.status !== "fulfilled" || !r.value) continue;
        if (Array.isArray(r.value.soldListings)) merged.push(...r.value.soldListings);
        if (r.value.hasMore !== false) anyMore = true;
      }
      const data = { soldListings: merged, hasMore: anyMore };
      if (data.soldListings?.length > 0) {
        // Filter out any duplicates by zpid (and to the selected types)
        const existingSet = new Set(existingZpids);
        const seenNew = new Set();
        const newListings = data.soldListings
          .filter(l => l.zpid && !existingSet.has(l.zpid) && l.soldPrice)
          .filter(l => { if (seenNew.has(l.zpid)) return false; seenNew.add(l.zpid); return true; })
          .filter(l => fpTypeMatch(fpTypeSel, l.propertyType))
          .map(l => ({ ...l, _source: l._source || "sold_comps" }));
        if (newListings.length > 0) {
          // Shuffle new listings and append after current position
          const shuffled = orderByRecency(newListings);
          setFpListings(prev => [...prev, ...shuffled]);
          // Also merge into main soldListings so enterFreePlay can see them later
          setSoldListings(prev => {
            const prevZpids = new Set(prev.map(l => l.zpid));
            const unique = shuffled.filter(l => !prevZpids.has(l.zpid));
            return unique.length > 0 ? [...prev, ...unique] : prev;
          });
          if (import.meta.env.DEV) console.log(`[PricePoint] Load More: added ${newListings.length} new properties`);
          // Prefetch details for first 3 new ones
          setTimeout(() => {
            const targets = shuffled.slice(0, 3).filter(l => l && l.zpid);
            if (targets.length) Promise.all(targets.map(t => fetchPropertyDetails(t)));
          }, 100);
        }
        setFpHasMore(data.hasMore !== false);
      } else {
        setFpHasMore(false);
        if (import.meta.env.DEV) console.log("[PricePoint] Load More: no more properties available");
      }
    } catch (err) {
      console.error("[PricePoint] Load More failed:", err);
      // Don't set fpHasMore to false on error — could be transient
    } finally {
      setFpLoadingMore(false);
    }
  }, [fpListings, fpLoadingMore, market, fetchPropertyDetails, fpTypeSel]);

  // Auto-fetch details when live listing changes — prefetch current + next 3 in PARALLEL
  useEffect(() => {
    if (view === "live" && liveListings.length > 0) {
      const targets = liveListings.slice(liveIdx, liveIdx + 4).filter(l => l && l.zpid);
      if (targets.length) Promise.all(targets.map(t => fetchPropertyDetails(t)));
    }
  }, [view, liveIdx, liveListings, fetchPropertyDetails]);

  // Auto-fetch details for Free Play — prefetch current + next 2 in PARALLEL
  useEffect(() => {
    if (view === "freeplay" && fpListings.length > 0) {
      const targets = fpListings.slice(fpIdx, fpIdx + 3).filter(l => l && l.zpid);
      if (targets.length) Promise.all(targets.map(t => fetchPropertyDetails(t)));
    }
  }, [view, fpIdx, fpListings, fetchPropertyDetails]);

  // Auto-fetch details for an open CHALLENGE — the token only carries one
  // photo + headline stats, so the recipient's card was a husk of the real
  // For Sale experience (no carousel, no MLS remarks, no value signals).
  useEffect(() => {
    if (view === "challenge" && challengeData?.listing?.zpid) {
      fetchPropertyDetails(challengeData.listing);
    }
  }, [view, challengeData, fetchPropertyDetails]);

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
  // Display-only counter. The server numbers dailies from the 2026-03-25
  // launch (+1); the client counter above counts from 2026-01-01 and keys
  // local routing/state, so it stays as is. Show the server's number when
  // we have it so the header, share text, and cron logs all agree.
  const displayDailyNumber = supabaseDaily?.dailyNumber ?? dailyNumber;
  // Canonical daily: prefer the server's challenge (same property for every device
  // in this market) and fall back to the client-hash pick only if the API failed.
  // The server response already uses the client listing shape (yearBuilt, listPrice,
  // propertyType, photo…), so no card fork is needed. soldPrice is intentionally
  // absent until reveal — handleDailyGuess gets it from the /api/pp-guess response.
  const dailyPropertyServer = useMemo(() => {
    if (!supabaseDaily || !supabaseDaily.address) return null;
    return { ...supabaseDaily, _source: 'server' };
  }, [supabaseDaily]);
  const dailyPropertyLocal = useMemo(() => getDailyProperty(soldListings, market?.label || ""), [soldListings, market]);
  const dailyProperty = dailyPropertyServer || dailyPropertyLocal;
  const dailyIsServer = !!dailyPropertyServer;
  // Auto-fetch details for the Daily — same enrichment path as Free Play/Live,
  // bringing in the MLS description (+ any extra photos). Puzzle-safe: the
  // LIST PRICE pill and vs-list feedback read listing.listPrice (not details)
  // for zpid rows, and value signals require a valuePool the daily never gets.
  useEffect(() => {
    if ((view === "daily" || view === "postDaily") && dailyProperty?.zpid) {
      fetchPropertyDetails(dailyProperty);
    }
  }, [view, dailyProperty, fetchPropertyDetails]);
  // Local XP is instant feedback; when a pp-guess response reports a higher
  // server total (XP earned on other devices), show the authoritative number.
  const localXp = useMemo(() => calcXP(allResults), [allResults]);
  const xp = serverXp != null ? Math.max(localXp, serverXp) : localXp;
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
        if (activeListings.length > 0) localStorage.setItem("pp-active-listings", JSON.stringify(activeListings));
        localStorage.setItem("pp-predictions", JSON.stringify(allPredictions));
      } catch {}
    }, 500);
    return () => { if (persistTimerRef.current) clearTimeout(persistTimerRef.current); };
  }, [market, locationLabel, allResults, dailyResult, soldListings, activeListings, allPredictions]);

  // ── Initialize view ──
  useEffect(() => {
    // Check for challenge param in URL FIRST
    const params = new URLSearchParams(window.location.search);
    const challengeToken = params.get('c');
    if (challengeToken) {
      const decoded = decodeChallenge(challengeToken);
      if (decoded) {
        setChallengeData(decoded);
        setView("challenge");
        window.history.replaceState({}, '', window.location.pathname + window.location.search.replace(/[?&]c=[^&]+/, '').replace(/^\?$/, ''));
        return;
      }
    }
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
          // Already guessed today? Reconstruct the result from the server row and
          // lock the daily to post-daily state. This makes the server the source of
          // truth — clearing localStorage no longer lets you replay the daily.
          if (pid && daily.id && !dailyResult) {
            const existing = await getExistingDailyGuess(pid, daily.id);
            if (existing && existing.sold_price) {
              const sp = existing.sold_price;
              const pctOffRound = existing.pct_off != null
                ? existing.pct_off
                : parseFloat((Math.abs((existing.guess - sp) / sp) * 100).toFixed(1));
              const fb = getFeedback(pctOffRound);
              const restored = {
                guess: existing.guess, soldPrice: sp, listPrice: existing.list_price ?? daily.listPrice,
                address: existing.address || daily.address,
                neighborhood: existing.neighborhood || daily.neighborhood,
                city: existing.city || daily.city, state: daily.state, zip: existing.zip || daily.zip,
                beds: existing.beds ?? daily.beds, baths: existing.baths ?? daily.baths,
                sqft: existing.sqft ?? daily.sqft, photo: existing.photo || daily.photo,
                pctOff: pctOffRound, feedback: fb, feedbackMessage: getRandomMessage(fb),
                insight: getInsight({ ...daily, soldPrice: sp, listPrice: existing.list_price ?? daily.listPrice }, pctOffRound, existing.guess > sp),
                dailyNumber, timestamp: Date.now(), revealed: true, isDaily: true,
                guessId: existing.id,
              };
              setDailyResult(restored);
              setAllResults(prev => prev.some(r => r.guessId === existing.id) ? prev : [...prev, restored]);
            }
          }
        }
      } catch (err) {
        console.warn('[PricePoint] Supabase init failed (offline mode):', err.message);
      }
    };
    if (market) initSupabase();
  }, [market?.id]);

  // ── Fetch leaderboard (pp_leaderboard_v2 with own-row/rank) ──
  const refetchLeaderboard = useCallback(async () => {
    if (!market?.id) return;
    setLbLoading(true);
    try {
      const periodMap = { today: 'today', weekly: 'week', alltime: 'all' };
      const modeMap = { daily: 'daily', free: 'freeplay', live: 'live' };
      const rows = await getLeaderboard(
        market.id,
        modeMap[leaderboardMode] || 'daily',
        periodMap[leaderboardTab] || 'all',
        20,
        playerId,
      );
      setLbData(rows || []);
    } catch (err) {
      console.warn('[PricePoint] Leaderboard fetch failed:', err.message);
      setLbData([]);
    }
    setLbLoading(false);
  }, [market?.id, leaderboardMode, leaderboardTab, playerId]);

  // Refetch when market/mode/tab/player changes.
  useEffect(() => { refetchLeaderboard(); }, [refetchLeaderboard]);

  // ── Drain any offline-queued guesses on mount and when the network returns ──
  // (Declared after refetchLeaderboard so it's initialized before this deps array.)
  useEffect(() => {
    flushPendingGuesses().then(() => refetchLeaderboard());
    const onOnline = () => flushPendingGuesses().then(() => refetchLeaderboard());
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [refetchLeaderboard]);

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
    // Check if sold data is sample/missing (works even after localStorage reload)
    const isSampleData = soldListings === SAMPLE_SOLD || soldListings.length === 0 || soldListings.every(l => l._source === "sample");
    // Check if data is stale (older than 6 hours)
    const lastFetch = parseInt(localStorage.getItem("pp-last-fetch") || "0", 10);
    const isStale = Date.now() - lastFetch > 6 * 60 * 60 * 1000;
    // Check if cached listings belong to a different market than currently selected
    // (e.g. user switched SF → Alameda before today's clear-on-switch fix landed,
    // so localStorage still holds SF properties under the Alameda market). Without
    // this self-heal, those users see the wrong city's data forever until they
    // manually reselect the market from the picker.
    const marketCityLc = (market.city || "").toLowerCase().trim();
    const cityMismatch = marketCityLc && soldListings.length > 0 &&
      soldListings.some(l => l.city && l.city.toLowerCase().trim() !== marketCityLc);
    const needsData = isSampleData || activeListings.length === 0 || needsFreshFetch || isStale || cityMismatch;
    if (needsData && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      if (cityMismatch) {
        // Stale-from-other-market state — wipe before fetching so we don't render
        // the wrong city's properties for a frame.
        setSoldListings([]);
        setActiveListings([]);
        try {
          localStorage.removeItem("pp-sold-listings");
          localStorage.removeItem("pp-active-listings");
        } catch {}
      }
      // ALWAYS fetch by city name — zip-level queries only return listings for that
      // one zip, not the whole market. City-wide gives us all neighborhoods.
      // NOTE: plain staleness (>6h) no longer passes fresh=1 — the server cache
      // (CDN + Supabase, 24h TTL, cron-refreshed daily at 6am) answers in <1s.
      // fresh=1 forces a full ~16-call RapidAPI re-fetch and is reserved for
      // version migrations (needsFreshFetch) and wrong-city data (cityMismatch).
      fetchListings(market.city || market.label, needsFreshFetch || cityMismatch);
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

      // ── DECOUPLED fetches: apply each result the moment it lands ──
      // sold-comps (Supabase pool) answers in ~1s and is all the Daily card
      // needs. pricepoint (full inventory) can take 20s+ on a cold cache miss.
      // The old Promise.allSettled applied BOTH only after BOTH finished, so
      // fast sold data sat unused while the slow call ran. Now each .then()
      // applies its own state update independently.
      const cityName = isZip ? null : searchValue.trim();
      let gotRealSold = false; // set by sold-comps; blocks the less-trusted fallback

      const compsPromise = cityName ? Promise.race([
        fetch(apiUrl(`/api/sold-comps?city=${encodeURIComponent(cityName)}${bypassCache ? "&fresh=1" : ""}`)).then(r => r.ok ? r.json() : null).catch(() => null),
        new Promise(resolve => setTimeout(() => resolve(null), 5000)), // 5s timeout
      ]).then(compsData => {
        // ── Sold listings: real sold-comps are ALWAYS preferred ──
        // (the search API's recentlySold returns active listings relabeled as sold)
        if (compsData?.soldListings?.length > 0) {
          gotRealSold = true;
          const realSold = compsData.soldListings.map(l => ({ ...l, _source: "sold_comps" }));
          if (import.meta.env.DEV) console.log(`[PricePoint] Got ${realSold.length} real sold comps: replacing all sold data`);
          setSoldListings(realSold); // applied immediately → Daily card renders now
        }
        return compsData;
      }) : Promise.resolve(null);

      const ppPromise = fetch(apiUrl(`/api/pricepoint?${params}`))
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(data => {
          if (data?.error) throw new Error(data.error);
          // Active listings (_source: "active_api") → Live mode pool
          if (data?.activeListings?.length > 0) {
            setActiveListings(data.activeListings);
            // Persist immediately so Live mode works on next page load
            try { localStorage.setItem("pp-active-listings", JSON.stringify(data.activeListings)); } catch {}
            if (import.meta.env.DEV) console.log(`[PricePoint] Cached ${data.activeListings.length} active listings`);
          }
          // Fallback sold data — ONLY if sold-comps hasn't already delivered.
          // Tag as "sold_search" (less trusted than sold_comps). Validation:
          // require soldDate AND soldPrice differing from listPrice (filters
          // active listings relabeled as "sold" by RapidAPI).
          if (!gotRealSold && data?.soldListings?.length > 0) {
            const validated = data.soldListings
              .filter(l => l.soldDate && l.soldPrice && (l.soldPrice !== l.listPrice || !l.listPrice))
              .map(l => ({ ...l, _source: "sold_search" }));
            if (validated.length > 0) {
              if (import.meta.env.DEV) console.log(`[PricePoint] Using ${validated.length} validated search-API sold (of ${data.soldListings.length} raw)`);
              setSoldListings(validated);
            }
          }
          return data;
        });

      const [ppResp, compsResp] = await Promise.allSettled([ppPromise, compsPromise]);

      const data = ppResp.status === "fulfilled" ? ppResp.value : null;
      const compsData = compsResp.status === "fulfilled" ? compsResp.value : null;

      if (!data && !compsData) throw new Error("Both APIs failed");

      const label = data?.location || searchValue;
      setLocationLabel(label);
      // Record fetch timestamp for staleness check
      try { localStorage.setItem("pp-last-fetch", String(Date.now())); } catch {}
      return { success: true, label };
    } catch (err) {
      console.error("PricePoint fetch error:", err);
      setError("Could not load live data. Using sample data.");
      hasFetchedRef.current = false; // Allow retry on next attempt
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
    // Clear stale listings from the previous market BEFORE fetching the new
    // ones. fetchListings only calls setSoldListings/setActiveListings when the
    // new response is non-empty, so without this clear, switching SF → Alameda
    // while Alameda returns 0 leaves SF properties leaking into Alameda's view
    // (the "All of [City]" path doesn't have a zip filter to exclude them).
    // Also persist the cleared state to localStorage so a page reload doesn't
    // rehydrate the previous market's stale data.
    setSoldListings([]);
    setActiveListings([]);
    try {
      localStorage.removeItem("pp-sold-listings");
      localStorage.removeItem("pp-active-listings");
    } catch {}
    try { localStorage.setItem("pp-market", JSON.stringify(mkt)); localStorage.setItem("pp-location-label", mkt.label); } catch {}
    // Switch view IMMEDIATELY — the daily view shows a skeleton until sold
    // data lands. The old `await fetchListings(...)` here kept the user
    // staring at the city picker for the full fetch (~20s on a cache miss).
    if (dailyResult && dailyResult.dailyNumber === dailyNumber) setView("postDaily");
    else if (view === "onboarding") setView("daily");
    // Mark fetched so the [market] auto-fetch effect doesn't double-fire the
    // same request. fetchListings resets this on failure, so retry still works.
    hasFetchedRef.current = true;
    fetchListings(launchMarket.name); // intentionally not awaited
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

  // ── Challenge Mode Handlers ──
  // Store RAW digits (like the Daily/Sold/Live inputs) — the shared display does
  // `parseInt(guess)`, and parseInt stops at the first comma, so a formatted
  // "3,500,000" here rendered as "$3" the moment a comma appeared (the input
  // looked like it cleared on the 4th digit). Keep it unformatted.
  const handleChallengeGuessInput = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setChallengeGuess(raw);
  };

  const handleChallengeGuess = () => {
    if (!challengeData) return;
    const val = parseInt(challengeGuess.replace(/[^0-9]/g, ""));
    const listing = challengeData.listing;
    if (!val || !listing) return;
    // FOR SALE challenge: the listing hasn't sold, so there's no answer to score
    // against. Reveal both predictions side by side vs. the list price; the
    // market settles who was right when it closes. Recipient's prediction is
    // persisted as a normal 'live' row so it can resolve later.
    if (challengeData.mode === 'live') {
      const lp = Number(listing.listPrice) || 0;
      const vsList = (g) => lp ? parseFloat((((g - lp) / lp) * 100).toFixed(1)) : null;
      setChallengeResult({
        isLive: true, guess: val, listPrice: lp,
        address: listing.address, neighborhood: listing.neighborhood,
        city: listing.city, state: listing.state, zip: listing.zip,
        beds: listing.beds, baths: listing.baths, sqft: listing.sqft, photo: listing.photo,
        myVsList: vsList(val), theirVsList: vsList(challengeData.challengerGuess),
        challengerGuess: challengeData.challengerGuess,
        timestamp: Date.now(), revealed: true,
      });
      setView("challenge");
      // For Sale H2H settles later — stash the pair to score when it closes.
      setH2h(addPendingH2H(listing.zpid, val, challengeData.challengerGuess));
      setAllPredictions(prev => [...prev, {
        guess: val, zpid: listing.zpid || null, listPrice: lp, address: listing.address, neighborhood: listing.neighborhood,
        city: listing.city, state: listing.state, zip: listing.zip, beds: listing.beds, baths: listing.baths,
        sqft: listing.sqft, photo: listing.photo, propertyType: listing.propertyType,
        status: listing.status || 'active', vsListPct: vsList(val), timestamp: Date.now(), resolved: false, soldPrice: null,
      }]);
      submitGuess({
        marketId: market?.id || 'sf', mode: 'live', zpid: listing.zpid || null,
        address: listing.address, neighborhood: listing.neighborhood, city: listing.city, zip: listing.zip,
        propertyType: listing.propertyType || '', beds: listing.beds, baths: listing.baths, sqft: listing.sqft,
        listPrice: lp, photo: listing.photo, guess: val,
      }).then(resp => {
        if (resp && resp.totalXp != null) setServerXp(resp.totalXp);
        refetchLeaderboard();
      }).catch(e => console.warn('[PricePoint] live challenge guess failed:', e));
      return;
    }
    const pctOff = Math.abs((val - listing.soldPrice) / listing.soldPrice) * 100;
    const feedback = getFeedback(pctOff);
    const insight = getInsight(listing, pctOff, val > listing.soldPrice);
    const myAccuracy = parseFloat((100 - pctOff).toFixed(1));
    setChallengeResult({
      guess: val, soldPrice: listing.soldPrice, listPrice: trueListPrice(listing),
      address: listing.address, neighborhood: listing.neighborhood,
      city: listing.city, state: listing.state, zip: listing.zip,
      beds: listing.beds, baths: listing.baths, sqft: listing.sqft,
      photo: listing.photo, pctOff: parseFloat(pctOff.toFixed(1)),
      feedback, feedbackMessage: getRandomMessage(feedback), insight,
      myAccuracy, challengerAccuracy: challengeData.challengerAccuracy,
      challengerGuess: challengeData.challengerGuess,
      iWon: myAccuracy >= challengeData.challengerAccuracy,
      dailyNumber: challengeData.dailyNumber, timestamp: Date.now(), revealed: true, isDaily: false,
    });
    // Sold H2H settles instantly — closer accuracy wins.
    const h2hRec = recordH2H(myAccuracy > challengeData.challengerAccuracy ? 'win' : myAccuracy < challengeData.challengerAccuracy ? 'loss' : 'tie');
    setH2h(h2hRec); saveServerH2H(playerId, h2hRec);
    setView("challenge"); // stay in challenge view to show result
    setAllResults(prev => [...prev, { guess: val, soldPrice: listing.soldPrice, pctOff: parseFloat(pctOff.toFixed(1)), revealed: true, isDaily: false, dailyNumber: null, timestamp: Date.now() }]);

    // ── Persist the challenge guess (mode 'challenge') so recipients' guesses
    // land in pp_guesses too. The sold price comes from the shared listing. ──
    submitGuess({
      marketId: market?.id || 'sf', mode: 'challenge',
      zpid: listing.zpid || null,
      address: listing.address, neighborhood: listing.neighborhood,
      city: listing.city, zip: listing.zip,
      propertyType: listing.propertyType || '',
      beds: listing.beds, baths: listing.baths, sqft: listing.sqft,
      listPrice: listing.listPrice, photo: listing.photo,
      guess: val, clientSoldPrice: listing.soldPrice,
    }).then(resp => {
      if (resp && resp.totalXp != null) setServerXp(resp.totalXp);
      refetchLeaderboard();
    }).catch(e => console.warn('[PricePoint] challenge guess failed:', e));
  };

  // ── Share as Challenge (Web Share API + clipboard fallback) ──
  const shareChallenge = (result, listing, isDaily) => {
    const token = encodeChallenge({
      listing, result,
      mode: isDaily ? 'daily' : 'freeplay',
      dailyNumber: isDaily ? displayDailyNumber : 0,
      locationLabel: locationLabel || market?.label || '',
    });
    const url = buildChallengeUrl(token);
    const accuracy = (100 - result.pctOff).toFixed(1);
    const text = `I scored ${accuracy}% accuracy on a ${result.neighborhood || result.city} home: think you can beat me?`;
    // URL folded INTO text (no separate url field): iOS Messages drops the
    // text bubble when both are passed, delivering a bare link. The trailing
    // URL still unfurls into the rich preview.
    if (navigator.share) {
      navigator.share({ title: 'PricePoint Challenge', text: `${text}\n${url}` }).catch(() => {
        navigator.clipboard.writeText(`${text}\n${url}`);
        setShareToast(true); setTimeout(() => setShareToast(false), 2500);
      });
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`);
      setShareToast(true); setTimeout(() => setShareToast(false), 2500);
    }
  };

  // ── Share a FOR SALE prediction as a challenge. No sold price yet, so the
  // brag is the prediction itself — the friend calls the same active listing
  // and both see their numbers side by side (settled by the market later). ──
  const shareLiveChallenge = (prediction, fullListing) => {
    const listing = (fullListing && fullListing.address === prediction.address) ? fullListing : prediction;
    const token = encodeChallenge({
      listing, result: prediction, mode: 'live',
      dailyNumber: 0, locationLabel: locationLabel || market?.label || '',
    });
    const url = buildChallengeUrl(token);
    const place = prediction.neighborhood || prediction.city || 'this';
    // No dollar amount in the message: the sender's number would anchor every
    // guess in the thread (and the in-app reveal already keeps it hidden until
    // the friend locks their own). Phrased for group texts — every recipient
    // can tap the same link and lock an independent call.
    const text = `I locked in my call on this ${place} listing. Lock in yours: closest to the sold price wins. My number stays hidden until you guess.`;
    // URL folded INTO text — see shareChallenge; a separate url field makes
    // iOS Messages drop the text bubble entirely.
    if (navigator.share) {
      navigator.share({ title: 'PricePoint Challenge', text: `${text}\n${url}` }).catch(() => {
        navigator.clipboard.writeText(`${text}\n${url}`);
        setShareToast(true); setTimeout(() => setShareToast(false), 2500);
      });
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`);
      setShareToast(true); setTimeout(() => setShareToast(false), 2500);
    }
  };

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
  // Build the reveal result once we know the sold price (from the server for the
  // canonical daily, or locally for the hash-fallback daily) and record + refetch.
  const finishDaily = (val, soldPrice, pctOffRound, serverResp) => {
    const feedback = getFeedback(pctOffRound);
    const propForInsight = { ...dailyProperty, soldPrice };
    const insight = getInsight(propForInsight, pctOffRound, val > soldPrice);
    const result = {
      guess: val, soldPrice, listPrice: trueListPrice({ ...dailyProperty, soldPrice }),
      address: dailyProperty.address, neighborhood: dailyProperty.neighborhood,
      city: dailyProperty.city, state: dailyProperty.state, zip: dailyProperty.zip,
      beds: dailyProperty.beds, baths: dailyProperty.baths, sqft: dailyProperty.sqft,
      photo: dailyProperty.photo, pctOff: pctOffRound,
      feedback, feedbackMessage: getRandomMessage(feedback), insight,
      dailyNumber, timestamp: Date.now(), // client day counter — postDaily routing keys on this
      revealed: true, isDaily: true,
      guessId: serverResp?.guessId || null,
    };
    setDailyResult(result);
    // Guard against double-count if a queued retry already recorded this guessId.
    setAllResults(prev =>
      (serverResp?.guessId && prev.some(r => r.guessId === serverResp.guessId))
        ? prev : [...prev, result]);
    startReveal();
    if (serverResp?.totalXp != null) setServerXp(serverResp.totalXp);
    refetchLeaderboard();
  };

  const handleDailyGuess = async () => {
    const val = parseInt(guessInput.replace(/[^0-9]/g, ""));
    if (!val || !dailyProperty || dailySubmitting) return;

    const payload = {
      marketId: market?.id || 'sf', mode: 'daily',
      dailyId: dailyIsServer ? supabaseDaily.id : null,
      zpid: dailyProperty.zpid || null,
      address: dailyProperty.address, neighborhood: dailyProperty.neighborhood,
      city: dailyProperty.city, zip: dailyProperty.zip,
      propertyType: dailyProperty.propertyType || '',
      beds: dailyProperty.beds, baths: dailyProperty.baths, sqft: dailyProperty.sqft,
      listPrice: dailyProperty.listPrice, photo: dailyProperty.photo,
      guess: val,
    };

    if (dailyIsServer) {
      // The server holds the sold price for the canonical daily — await the score.
      setDailySubmitting(true);
      let resp = null;
      try { resp = await submitGuess({ ...payload, clientSoldPrice: null }); }
      catch (e) { console.warn('[PricePoint] daily submit failed:', e); }
      setDailySubmitting(false);
      if (resp && resp.ok && resp.soldPrice) {
        finishDaily(val, resp.soldPrice, resp.pctOff ?? parseFloat((Math.abs((val - resp.soldPrice) / resp.soldPrice) * 100).toFixed(1)), resp);
      } else {
        // Offline (queued) or unscored — we can't reveal a price the server holds.
        setSyncToast('Saved: reconnect to see today’s result');
        setTimeout(() => setSyncToast(null), 3500);
      }
      return;
    }

    // Fallback (client-hash daily): score locally, still persist via the endpoint
    // (server routes it as freeplay-style scoring with clientSoldPrice).
    const pctOff = Math.abs((val - dailyProperty.soldPrice) / dailyProperty.soldPrice) * 100;
    const resp = await submitGuess({ ...payload, soldPrice: dailyProperty.soldPrice })
      .catch(e => { console.warn('[PricePoint] daily persist failed:', e); return null; });
    finishDaily(val, dailyProperty.soldPrice, parseFloat(pctOff.toFixed(1)), resp && resp.ok ? resp : null);
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
      `PricePoint Daily #${result.dailyNumber === dailyNumber ? displayDailyNumber : result.dailyNumber} · ${locationLabel || result.city}`,
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
    // Track this zpid as guessed (cross-neighborhood dedup)
    if (listing.zpid) {
      fpGuessedZpidsRef.current.add(listing.zpid);
      try { localStorage.setItem("pp-fp-guessed-zpids", JSON.stringify([...fpGuessedZpidsRef.current])); } catch {}
    }
    const pctOff = Math.abs((val - listing.soldPrice) / listing.soldPrice) * 100;
    const feedback = getFeedback(pctOff);
    const insight = getInsight(listing, pctOff, val > listing.soldPrice);
    const pctOffRound = parseFloat(pctOff.toFixed(1));
    setFpResult({
      guess: val, soldPrice: listing.soldPrice, listPrice: trueListPrice(listing),
      address: listing.address, neighborhood: listing.neighborhood,
      city: listing.city, state: listing.state, beds: listing.beds, baths: listing.baths,
      sqft: listing.sqft, photo: listing.photo, pctOff: pctOffRound,
      zpid: listing.zpid, detailUrl: listing.detailUrl,
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

    // ── Persist via the server-scored endpoint (guaranteed insert + retry queue) ──
    // Free Play knows the sold price client-side, so the reveal above is instant;
    // the server re-scores and increments XP. No playerId gate — the endpoint
    // resolves the player from the device id, so even unregistered clients land.
    submitGuess({
      marketId: market?.id || 'sf', mode: 'freeplay',
      zpid: listing.zpid || null,
      address: listing.address, neighborhood: listing.neighborhood,
      city: listing.city, zip: listing.zip,
      propertyType: listing.propertyType || '',
      beds: listing.beds, baths: listing.baths, sqft: listing.sqft,
      listPrice: listing.listPrice, photo: listing.photo,
      guess: val, soldPrice: listing.soldPrice,
    }).then(resp => {
      if (resp && resp.queued) {
        setSyncToast('Saved on this device. Will sync when you’re online');
        setTimeout(() => setSyncToast(null), 3500);
      }
      if (resp && resp.totalXp != null) setServerXp(resp.totalXp);
      refetchLeaderboard();
    }).catch(e => console.warn('[PricePoint] freeplay guess failed:', e));
  };
  const fpNextProperty = () => {
    setFpResult(null); setFpGuessInput(""); setMlsExpanded(false);
    setFpIdx(prev => {
      const nextIdx = prev + 1;
      // Auto-fetch more when 3 properties left
      if (fpZipRef.current && fpHasMore && !fpLoadingMore && (fpListings.length - nextIdx) <= 3) {
        fetchMoreSoldComps(fpZipRef.current);
      }
      return nextIdx;
    });
  };

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

  // Trusted sold = came from a real sold-data endpoint AND has a real soldPrice + soldDate
  // "sold_comps" = from property-details priceHistory (most trusted)
  // "sold_search" = from search API recentlySold (less trusted, validated on ingest)
  // "sold_api" = legacy tag, treat as trusted
  const TRUSTED_SOLD_SOURCES = new Set(["sold_api", "sold_comps", "sold_search"]);
  const isTrueSold = (l) => TRUSTED_SOLD_SOURCES.has(l._source) && l.soldPrice && isRecentSale(l);
  // Trusted active = came from the forSale API endpoint (active or pending)
  const isTrueActive = (l) => l._source === "active_api";

  // Track guessed zpids across all Free Play sessions (so switching neighborhoods won't re-show them)
  const fpGuessedZpidsRef = useRef(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("pp-fp-guessed-zpids") || "[]");
      return new Set(stored);
    } catch { return new Set(); }
  });
  // Lazy init
  if (typeof fpGuessedZpidsRef.current === "function") fpGuessedZpidsRef.current = fpGuessedZpidsRef.current();

  // Same idea for Live: a prediction is a one-shot commitment, so a listing you
  // already predicted must never come back into a future pool (across sessions,
  // neighborhoods, and reloads).
  const liveGuessedZpidsRef = useRef(null);
  if (liveGuessedZpidsRef.current === null) {
    try {
      liveGuessedZpidsRef.current = new Set(JSON.parse(localStorage.getItem("pp-live-guessed-zpids") || "[]"));
    } catch { liveGuessedZpidsRef.current = new Set(); }
  }
  const rememberLiveGuess = (zpid) => {
    if (!zpid) return;
    const id = String(zpid);
    liveGuessedZpidsRef.current.add(id);
    try { localStorage.setItem("pp-live-guessed-zpids", JSON.stringify([...liveGuessedZpidsRef.current])); } catch {}
    setLiveGuessedZpids(prev => { const next = new Set(prev); next.add(id); return next; });
  };

  // ── Cross-device account sync ──────────────────────────────────────────
  // Signed-in users get ONE player across devices: /api/pp-player links this
  // device to the account (merging any anonymous local history server-side)
  // and returns the account's XP + every zpid it has called, which hydrates
  // the local exclusion sets — a home guessed on the phone won't re-serve on
  // the laptop. Runs on mount and again on every sign-in.
  useEffect(() => {
    let dead = false;
    const runSync = async () => {
      const s = await syncPlayer();
      if (dead || !s) return;
      if (s.playerId) {
        setPlayerId(s.playerId);
        try { localStorage.setItem('pp-player-id', s.playerId); } catch {}
      }
      if (s.totalXp != null) setServerXp(s.totalXp);
      if (s.displayName) {
        setDisplayName(prev => {
          if (prev) return prev;
          try { localStorage.setItem('pp-display-name', s.displayName); } catch {}
          return s.displayName;
        });
      }
      if (Array.isArray(s.liveZpids) && s.liveZpids.length) {
        s.liveZpids.forEach(z => liveGuessedZpidsRef.current.add(String(z)));
        try { localStorage.setItem('pp-live-guessed-zpids', JSON.stringify([...liveGuessedZpidsRef.current])); } catch {}
        setLiveGuessedZpids(prev => { const next = new Set(prev); s.liveZpids.forEach(z => next.add(String(z))); return next; });
      }
      if (Array.isArray(s.guessedZpids) && s.guessedZpids.length) {
        s.guessedZpids.forEach(z => fpGuessedZpidsRef.current.add(String(z)));
        try { localStorage.setItem('pp-fp-guessed-zpids', JSON.stringify([...fpGuessedZpidsRef.current])); } catch {}
      }
    };
    runSync();
    const sub = onAuthStateChange((session) => { if (session) runSync(); });
    return () => { dead = true; try { sub.unsubscribe(); } catch { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterFreePlay = (hoods) => { // hoods: array of {zip, name}; empty/null = all of the city
    // Step 1: Filter to trusted sold listings only, AND only listings whose
    // city matches the current market. The city guard is a defensive belt-and-
    // suspenders against any code path (cache hydration, race condition, stale
    // localStorage) that could leave a previous market's listings in state.
    // Without it, "All of Alameda" would show SF properties if soldListings
    // wasn't cleared during the market switch.
    const marketCityLc = (market?.city || "").toLowerCase().trim();
    let trueSold = soldListings.filter(l => {
      if (!isTrueSold(l)) return false;
      if (marketCityLc && l.city && l.city.toLowerCase().trim() !== marketCityLc) return false;
      return true;
    });

    // Step 2: Exclude daily spoilers AND previously guessed properties.
    // Scale the exclusion window with pool size so we always keep ~80% of the
    // pool playable. With 31 entries: excludes ~6 → pool = 25 playable. With
    // 100 entries: excludes ~20 → pool = 80 playable. With 200+: hits the
    // 30-day cap → pool = 170+ playable.
    //
    // The previous formula (len - 3) was designed for tiny pools where any
    // exclusion zeroed it out — that's solved at the server now. The new
    // bottleneck was the opposite: aggressive exclusion shrinking a 31-pool
    // down to 6. Proportional scaling fixes both extremes.
    // Exclude only TODAY's daily (canonical server pick + today's legacy-hash
    // fallback) — not 30 days of future hash indices. The pool is served
    // newest-first now, so index-based future exclusion was permanently hiding
    // the newest sales: index 0 IS the newest comp, exactly the card Free
    // Play should lead with. The canonical daily is server-side (pp-daily);
    // future legacy-fallback picks aren't worth burying fresh comps for.
    const excludedIndices = getDailyIndices(trueSold, market?.label || "", 0);
    const dailyZpid = dailyProperty?.zpid ? String(dailyProperty.zpid) : null;
    const guessedZpids = fpGuessedZpidsRef.current;
    let pool = trueSold.filter((l, i) =>
      !excludedIndices.has(i) &&
      (!l.zpid || (!guessedZpids.has(l.zpid) && String(l.zpid) !== dailyZpid))
    );

    // Step 3: Filter to the UNION of the selected neighborhoods' zip groups
    // (multi-select — e.g. Sunset + Richmond). Empty selection = the whole
    // city. STRICT: never mix in unselected neighborhoods.
    const selHoods = (hoods || []).filter(h => h && h.zip);
    let zipGroup = null;
    if (selHoods.length > 0) {
      zipGroup = new Set();
      for (const h of selHoods) {
        const grp = HOOD_ZIP_GROUPS[(h.name || ZIP_TO_HOOD[h.zip] || "").toLowerCase()];
        if (grp) { for (const z of grp) zipGroup.add(z); } else { zipGroup.add(h.zip); }
      }
      pool = pool.filter(l => zipGroup.has(l.zip));
    }

    // Step 3b: Property-type filter (multi-select; empty = all types)
    pool = pool.filter(l => fpTypeMatch(fpTypeSel, l.propertyType));

    // Step 4: If pool is too small after the daily-spoiler cull, relax the daily exclusion.
    // Runs for both the zip-filtered case AND the no-zip "All of <city>" case — without
    // this, "All of SF" (zip=null) gets stuck at 0 available whenever the daily-exclusion
    // happens to cover every property in a small sold-comp pool.
    if (pool.length < 3) {
      pool = trueSold.filter(l => {
        if (zipGroup && !zipGroup.has(l.zip)) return false;
        if (l.zpid && guessedZpids.has(l.zpid)) return false;
        if (!fpTypeMatch(fpTypeSel, l.propertyType)) return false;
        return true;
      });
    }

    // Step 5: (removed — zip group already covers neighboring zips)

    // Step 6: If no data for this neighborhood — do NOT fall back to other neighborhoods.
    // Show empty state and trigger background fetch for this specific zip group.
    // Mixing neighborhoods (e.g., showing Richmond in Sunset) is a bug, not a feature.

    // Step 7: If still empty — no fake data. Show empty state and trigger background fetch.
    // NEVER fall back to SAMPLE_SOLD or other neighborhoods.

    // Recency-first: prime (0-3mo) leads, then fresh (3-6mo), older (6-12mo) last.
    const shuffled = orderByRecency(pool);
    setFpListings(shuffled);
    setFpSelectedNeighborhood(
      selHoods.length === 0 ? null
        : selHoods.length === 1 ? selHoods[0].name
        : `${selHoods[0].name} +${selHoods.length - 1}`
    );
    setFpHoodSel(selHoods.map(h => h.name)); // sync selection to what applied
    setFpIdx(0); setFpGuessInput(""); setFpResult(null); setView("freeplay");
    fpZipRef.current = selHoods.length > 0 ? selHoods.map(h => h.zip) : null;
    setFpHasMore(true); // reset — assume more available until proven otherwise
    setFpLoadingMore(false);

    // Prefetch property details for first 3 in PARALLEL
    setTimeout(() => {
      const zpids = shuffled.slice(0, 3).map(l => l?.zpid).filter(Boolean);
      if (zpids.length) Promise.all(zpids.map(z => fetchPropertyDetails(z)));
    }, 100);

    // Background: fetch zip-specific sold comps to top up the pool if we're light
    const zip = selHoods.length > 0 ? selHoods[0].zip : null;
    if (zip && pool.length < 15) {
      const cityName = market?.city || market?.label?.split(",")[0] || "San Francisco";
      const existingZpids = pool.map(l => l.zpid).filter(Boolean);
      const excludeParam = existingZpids.length > 0 ? `&exclude=${existingZpids.join(",")}` : "";
      fetch(apiUrl(`/api/sold-comps?city=${encodeURIComponent(cityName)}&zip=${zip}${excludeParam}`))
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.soldListings?.length > 0) {
            const existingSet = new Set(existingZpids);
            const newOnes = orderByRecency(
              data.soldListings
                .filter(l => l.zpid && !existingSet.has(l.zpid) && l.soldPrice)
                .filter(l => fpTypeMatch(fpTypeSel, l.propertyType))
                .map(l => ({ ...l, _source: l._source || "sold_comps" }))
            );
            if (newOnes.length > 0) {
              setFpListings(prev => [...prev, ...newOnes]);
              setSoldListings(prev => {
                const prevZpids = new Set(prev.map(l => l.zpid));
                const unique = newOnes.filter(l => !prevZpids.has(l.zpid));
                return unique.length > 0 ? [...prev, ...unique] : prev;
              });
              if (import.meta.env.DEV) console.log(`[PricePoint] Background zip fetch added ${newOnes.length} more for ${zip}`);
            }
            setFpHasMore(data.hasMore !== false);
          }
        })
        .catch(e => console.warn("[PricePoint] Background zip fetch failed:", e));
    }
  };

  // ── Live Mode — re-fetches if activeListings cache is empty ──
  // typeOverride: the picker passes the chips as they are AT TAP TIME, so a
  // toggle-then-tap in the same frame can't apply a stale selection.
  const enterLiveMode = async (zipFilter, hoodName, typeOverride) => {
    const typeSel = typeOverride || liveTypeSel;
    // Switch to the Live view IMMEDIATELY so the tap feels responsive. Previously
    // we awaited the (sometimes 30s) /api/pricepoint fetch BEFORE switching views,
    // leaving the user on the picker with no feedback — the tap looked dead.
    setLiveHoodFilter(zipFilter || null);
    setLiveHoodName(hoodName || null);
    setLiveIdx(0); setLiveGuessInput(""); setLivePrediction(null);
    // Seed the session guessed-set with the durable cross-session set: guessed
    // listings now STAY in the pool (the map draws them as done pins, tappable
    // → board) and the card cursor walks past them via isLiveGuessed.
    setLiveGuessedZpids(new Set(liveGuessedZpidsRef.current));
    setView("live");

    // Neighborhoods span more zips than the single one the picker button carries
    // (Sunset = 94122 + 94116, Richmond = 94118 + 94121, …). Filtering on that one
    // zip is what was hiding most of the inventory — half the Sunset was in 94116
    // and never reached the pool. Use the same zip-group union Free Play uses.
    const zipGroup = (() => {
      if (!zipFilter) return null;
      const grp = HOOD_ZIP_GROUPS[(hoodName || ZIP_TO_HOOD[zipFilter] || "").toLowerCase()];
      return grp && grp.size > 0 ? new Set(grp) : new Set([zipFilter]);
    })();

    const buildPool = (src) => {
      let pool = src.filter(isTrueActive);
      if (zipGroup) pool = pool.filter(l => zipGroup.has(l.zip) || (l.zipcode && zipGroup.has(l.zipcode)));
      // Property-type filter (multi-select; empty = all types)
      pool = pool.filter(l => fpTypeMatch(typeSel, l.propertyType));
      // NOTE: already-predicted listings are KEPT in the pool now — the map
      // shows every active/pending listing with done-state pins (tap → board).
      // The card cursor + liveRemaining skip them via isLiveGuessed instead.
      pool.sort(() => Math.random() - 0.5);
      return pool;
    };
    // Start the card cursor on the first listing you HAVEN'T called yet.
    const firstUnguessedIdx = (pool) => {
      const done = liveGuessedZpidsRef.current;
      const i = pool.findIndex(l => !l.zpid || !done.has(String(l.zpid)));
      return i >= 0 ? i : 0;
    };
    const prefetchFirst3 = (pool) => setTimeout(() => {
      const targets = pool.slice(0, 3).filter(l => l && l.zpid);
      if (targets.length) Promise.all(targets.map(t => fetchPropertyDetails(t)));
    }, 100);

    let listings = activeListings;

    // Fast path: cache already has active listings — render instantly, no fetch.
    if (listings.filter(isTrueActive).length > 0) {
      const pool = buildPool(listings);
      setLiveListings(pool);
      setLiveIdx(firstUnguessedIdx(pool));
      prefetchFirst3(pool);
      return;
    }

    // Slow path: cache empty — show the loading state in the Live view, then fetch.
    setLiveListings([]);
    if (market) {
      setLoading(true);
      try {
        const resp = await fetch(apiUrl(`/api/pricepoint?city=${encodeURIComponent(market.city || market.label)}&state=CA`));
        if (resp.ok) {
          const data = await resp.json();
          if (data?.activeListings?.length > 0) {
            listings = data.activeListings;
            setActiveListings(listings);
            try { localStorage.setItem("pp-active-listings", JSON.stringify(listings)); } catch {}
          }
        }
      } catch (e) {
        console.warn("[PricePoint] Live mode re-fetch failed:", e);
      } finally {
        setLoading(false);
      }
    }

    const pool = buildPool(listings);
    setLiveListings(pool);
    setLiveIdx(firstUnguessedIdx(pool));
    prefetchFirst3(pool);
  };

  // ── Live cursor helpers — the pool keeps predicted listings (the map needs to
  // draw them as "done"), so the card cursor walks past them instead. Wraps, so
  // jumping ahead via a map pin doesn't strand the ones you skipped. ──
  const isLiveGuessed = (l) => !!(l?.zpid && liveGuessedZpids.has(String(l.zpid)));

  // Bias the address typeahead toward the market the player is actually in —
  // the first pooled listing with coordinates is a good-enough centroid.
  // Memoized: a new object each render would re-fire the geocoder effect.
  const liveProximity = useMemo(() => {
    const withGeo = liveListings.find(l => l?.latitude && l?.longitude);
    return withGeo ? { lat: withGeo.latitude, lng: withGeo.longitude } : null;
  }, [liveListings]);
  const liveRemaining = liveListings.filter(l => !isLiveGuessed(l)).length;
  const nextUnguessedLiveIdx = (from) => {
    const n = liveListings.length;
    for (let step = 0; step < n; step++) {
      const i = (from + step) % n;
      if (!isLiveGuessed(liveListings[i])) return i;
    }
    return n; // nothing left → falls through to the "All caught up" state
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
      zpid: listing.zpid || null, // scoreboard fetch keys on this
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
    rememberLiveGuess(listing.zpid);
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

    // ── Persist via the server-scored endpoint. For mode 'live' the endpoint
    // ALSO inserts the pp_predictions row (moved server-side), so no separate
    // submitPrediction call. Live earns a flat 10 XP; accuracy resolves later. ──
    submitGuess({
      marketId: market?.id || 'sf', mode: 'live',
      zpid: listing.zpid || null,
      address: listing.address, neighborhood: listing.neighborhood,
      city: listing.city, zip: listing.zip,
      propertyType: listing.propertyType || '',
      beds: listing.beds, baths: listing.baths, sqft: listing.sqft,
      listPrice: listing.listPrice, photo: listing.photo,
      guess: val,
    }).then(resp => {
      if (resp && resp.queued) {
        setSyncToast('Saved on this device. Will sync when you’re online');
        setTimeout(() => setSyncToast(null), 3500);
      }
      if (resp && resp.totalXp != null) setServerXp(resp.totalXp);
      refetchLeaderboard();
    }).catch(e => console.warn('[PricePoint] live guess failed:', e));
  };

  const liveNextProperty = () => {
    // A search-result prediction clears the search instead of burning a pool card.
    const fromSearch = !!livePrediction?.fromSearch;
    setLivePrediction(null);
    setLiveGuessInput("");
    setMlsExpanded(false);
    if (fromSearch) {
      setLiveSearchListing(null);
      setLiveSearchAddr("");
      setLiveSearchGuessInput("");
      // The searched home is often IN the pool (the typeahead surfaces pool
      // listings first), and it may be the very card the cursor is parked on.
      // Re-seek from the current index — otherwise we land on a listing that
      // is now guessed and the card area falsely renders "All caught up!"
      // while the header still says N left.
      setLiveIdx(prev => nextUnguessedLiveIdx(prev));
    } else {
      setLiveIdx(prev => nextUnguessedLiveIdx(prev + 1));
    }
  };

  // ── Live address search (A3): free-text address → propertydetails?address= → card ──
  const runLiveAddressSearch = async (addressText) => {
    const q = String(addressText || "").trim();
    if (q.length < 5 || liveSearchLoading) return;
    setLiveSearchError(null);
    setLiveSearchListing(null);
    setLiveSearchGuessInput("");
    setLiveSearchLoading(true);
    try {
      const resp = await fetch(apiUrl(`/api/propertydetails?address=${encodeURIComponent(q)}&market=${encodeURIComponent(market?.id || "sf")}`));
      const data = await resp.json().catch(() => null);
      if (resp.ok && data?.listing) {
        setLiveSearchListing(data.listing);
      } else {
        setLiveSearchError(data?.message || "Couldn't find that address. Try adding city & zip");
      }
    } catch {
      setLiveSearchError("Couldn't find that address. Try adding city & zip");
    } finally {
      setLiveSearchLoading(false);
    }
  };

  // Geocoder suggestion picked (Mapbox, or Places if the Maps script ever
  // loads) — rebuild the full "street, city, ST zip" string and run the same
  // server lookup. The component has already written the input value.
  const handleLiveAddressSelect = (sel) => {
    const full = [sel.address, sel.city, [sel.state, sel.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    setLiveSearchAddr(full);
    runLiveAddressSearch(full);
  };

  // A suggestion that came from the ALREADY-LOADED live pool: we hold the full
  // listing, so render the card immediately — no /api/propertydetails call, no
  // RapidAPI quota, no "couldn't find that address" risk.
  const handleLiveListingSelect = (listing) => {
    setLiveSearchError(null);
    setLiveSearchGuessInput("");
    setLiveSearchLoading(false);
    setLiveSearchListing(listing);
    // Same enrichment the cursor card gets when it reaches this listing (full
    // photo set + description) — cached, so picking one the cursor already
    // prefetched costs nothing.
    if (listing?.zpid) fetchPropertyDetails(listing);
  };

  const handleLiveSearchGuessInput = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setLiveSearchGuessInput(raw.slice(0, 10));
  };

  // Same shape as handleLiveGuess — flat 10 XP prediction row via /api/pp-guess
  // (mode 'live'); the server's duplicate handling governs repeat guesses.
  const handleLiveSearchGuess = () => {
    const val = parseInt(liveSearchGuessInput.replace(/[^0-9]/g, ""));
    const listing = liveSearchListing;
    if (!val || !listing) return;

    const vsListPct = listing.listPrice ? ((val - listing.listPrice) / listing.listPrice * 100).toFixed(1) : null;

    const prediction = {
      guess: val,
      zpid: listing.zpid || null, // scoreboard fetch keys on this
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
      fromSearch: true,
    };

    setLivePrediction(prediction);
    setAllPredictions(prev => [...prev, prediction]);
    rememberLiveGuess(listing.zpid);
    const newResult = {
      guess: val, soldPrice: listing.listPrice || val, pctOff: Math.abs(parseFloat(vsListPct || 0)),
      revealed: true, isDaily: false, dailyNumber: null, timestamp: Date.now(),
      propertyType: listing.propertyType || null,
      neighborhood: listing.neighborhood || null,
      city: listing.city || null,
      isLive: true,
    };
    setAllResults(prev => [...prev, newResult]);

    submitGuess({
      marketId: market?.id || 'sf', mode: 'live',
      zpid: listing.zpid || null,
      address: listing.address, neighborhood: listing.neighborhood,
      city: listing.city, zip: listing.zip,
      propertyType: listing.propertyType || '',
      beds: listing.beds, baths: listing.baths, sqft: listing.sqft,
      listPrice: listing.listPrice, photo: listing.photo,
      guess: val,
    }).then(resp => {
      if (resp && resp.queued) {
        setSyncToast('Saved on this device. Will sync when you’re online');
        setTimeout(() => setSyncToast(null), 3500);
      }
      if (resp && resp.totalXp != null) setServerXp(resp.totalXp);
      refetchLeaderboard();
    }).catch(e => console.warn('[PricePoint] live search guess failed:', e));
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
      setView("fpPicker");
    } else if (tab === "live") {
      // If already in live flow, stay there
      if (view === "live" || view === "livePicker") return;
      setView("livePicker");
    } else if (tab === "stats") {
      setView("tomorrow");
    } else if (tab === "board") {
      setView("leaderboard");
    }
  };
  const showTabBar = view !== "onboarding" && view !== "reveal";

  // ── Notification polling ──
  useEffect(() => {
    if (!playerId) return;
    const poll = async () => {
      const result = await fetchNotifications(playerId, false);
      if (result) {
        setNotifications(result.notifications || []);
        setUnreadCount(result.unreadCount || 0);
        // Settle any For Sale challenges whose homes just closed.
        const upd = settlePendingH2H(result.notifications);
        if (upd) { setH2h(upd); saveServerH2H(playerId, upd); }
      }
    };
    poll();
    const interval = setInterval(poll, 60000); // poll every 60s
    return () => clearInterval(interval);
  }, [playerId]);

  // Load notification prefs up front (not just when Settings opens) — the
  // reveal-screen capture card needs to know whether a channel is already on.
  useEffect(() => {
    if (!playerId) return;
    getNotificationPreferences(playerId).then(prefs => {
      if (prefs) {
        setNotifPrefs(prefs);
        setNotifEmailInput(prefs.email || '');
        setNotifPhoneInput(prefs.phone || '');
      }
    });
  }, [playerId]);

  // ── Head-to-Head: pull the account record and reconcile with this device ──
  // The side with more decided games wins (so the count only grows); local
  // pending For Sale challenges are kept (they're device-local until settled).
  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    getServerH2H(playerId).then(server => {
      if (cancelled || !server) return;
      setH2h(local => {
        const localTotal = (local.wins || 0) + (local.losses || 0) + (local.ties || 0);
        const serverTotal = (server.wins || 0) + (server.losses || 0) + (server.ties || 0);
        if (serverTotal > localTotal) {
          const merged = { wins: server.wins || 0, losses: server.losses || 0, ties: server.ties || 0, pending: local.pending || [] };
          writeH2H(merged);
          return merged;
        }
        if (localTotal > serverTotal) saveServerH2H(playerId, local); // push this device up to the account
        return local;
      });
    });
    return () => { cancelled = true; };
  }, [playerId]);

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
      return <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: T.textTertiary, marginBottom: 4 }}>{children}</div>;
    }, [T.textTertiary]
  );

  const StatPill = useMemo(() =>
    function StatPill({ value, label, color }) {
      return <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: color || T.accent, background: `${color || T.accent}18`, padding: "4px 10px", borderRadius: 8, border: `1px solid ${color || T.accent}30` }}>
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
        background: disabled ? T.inputBg : tealAccent ? "linear-gradient(135deg, #38c6c6, #3B6BF5)" : accent ? "linear-gradient(135deg, #3B6BF5, #2B4FCE)" : secondary ? "transparent" : "linear-gradient(135deg, #3B6BF5, #2B4FCE)",
        color: disabled ? T.textTertiary : secondary ? T.textSecondary : "#fff",
        boxShadow: disabled || secondary ? "none" : accent ? "0 0 20px rgba(59,107,245,0.3)" : tealAccent ? "0 0 20px rgba(6,182,212,0.3)" : "0 0 20px rgba(59,107,245,0.3)",
        ...s,
      }}>{children}</button>;
    }, [T, FONT]
  );

  // ── A4: List | Map toggle + map-pin selection ──
  // T is always the DARK or LIGHT constant from lib/theme.js (stable refs),
  // so identity comparison is the reliable dark-mode signal here.
  const darkMode = T === DARK;
  const renderListMapToggle = (accent) => (
    <div style={{ display: "inline-flex", background: T.inputBg, border: `1px solid ${T.cardBorder}`, borderRadius: 9999, padding: 3, flexShrink: 0 }}>
      {["List", "Map"].map(label => {
        const isMapSeg = label === "Map";
        const active = isMapSeg === showMap;
        return (
          <button key={label} onClick={() => setShowMap(isMapSeg)} style={{
            border: "none", borderRadius: 9999, padding: "4px 12px", fontSize: 11, fontWeight: 700,
            fontFamily: FONT, cursor: "pointer", background: active ? accent : "transparent",
            color: active ? "#fff" : T.textSecondary, transition: "background 0.15s",
          }}>{label}</button>
        );
      })}
    </div>
  );
  // Pin → card: the map receives the SAME arrays the list views render
  // (fpListings/liveListings are pre-filtered pools — hood zips + type filters
  // are applied when the pool is built), so the pin's index IS fpIdx/liveIdx.
  const handleFpMapSelect = (i) => {
    setFpIdx(i); setFpResult(null); setFpGuessInput(""); setMlsExpanded(false);
    setShowMap(false);
  };
  const handleLiveMapSelect = (i) => {
    const l = liveListings[i];
    // Tapping a done pin opens that property's board (your call + The Field)
    // instead of the guess card — you can't call the same home twice.
    if (l && isLiveGuessed(l)) {
      const pred = allPredictions.find(p =>
        (p.zpid && String(p.zpid) === String(l.zpid)) ||
        (p.address && l.address && p.address === l.address && p.zip === l.zip));
      openPredictionBoard(pred || {
        zpid: String(l.zpid), address: l.address, neighborhood: l.neighborhood,
        city: l.city, state: l.state, zip: l.zip, beds: l.beds, baths: l.baths,
        sqft: l.sqft, photo: l.photo, listPrice: l.listPrice,
        guess: null, resolved: false, timestamp: 0,
      });
      return; // stay on the map — the board is an overlay
    }
    setLiveIdx(i); setLivePrediction(null); setLiveGuessInput(""); setMlsExpanded(false);
    setLiveSearchListing(null); setLiveSearchAddr(""); setLiveSearchGuessInput(""); setLiveSearchError(null);
    setShowMap(false);
  };
  const mapSuspenseFallback = (
    <div style={{ height: isDesktop ? "min(68vh, 640px)" : "min(62vh, 520px)", minHeight: 320, borderRadius: 16, border: `1px solid ${T.cardBorder}`, background: T.card, display: "flex", alignItems: "center", justifyContent: "center", color: T.textSecondary, fontFamily: FONT, fontSize: 13, animation: "ppPulse 1.2s ease infinite" }}>
      Loading map…
    </div>
  );

  // ── Property card (shared daily & free play) ──
  const PropertyCard = ({ listing, guess, onGuessChange, onGuess, badge, badgeColor, accentColor, showExtras, showPropertyType, showAddress, showZillowLink, showSoldDate, showLastSold, labelOverrides, details, isLoadingDetails, valuePool }) => {
    const accent = accentColor || T.accent;
    const pType = propTypeShort(listing.propertyType);
    const showType = showExtras || showPropertyType;
    // Merge photo sources: prefer details API photos, fall back to listing.photos from sold-comps (both capped at 24)
    const mergedPhotos = (details?.photos?.length > 0 ? details.photos : null) || (listing.photos?.length > 0 ? listing.photos : null) || null;
    const hasMultiplePhotos = mergedPhotos?.length > 1;
    const hasMap = !!(listing.latitude && listing.longitude);
    const desc = decodeEntities(details?.description || listing.description);
    const yearBuilt = listing.yearBuilt || details?.yearBuilt;
    // Photo date pill = the sale that already happened ("SOLD JUL '26"), on Sold
    // and Daily cards.
    //
    // For Sale cards do NOT get a photo pill: the home on screen hasn't sold, so
    // its PRIOR sale is guessing context, not a caption — it reads as the answer
    // sitting on the photo. It moves into Value Signals below (Christo 2026-07-19).
    const datePill = showSoldDate ? fmtSoldPill(listing.soldDate) : null;
    const lastSoldLabel = showLastSold
      ? fmtMonthYear(details?.lastSoldDate || listing.lastSoldDate)
      : null;
    return (
      // Desktop (≥900): two-column card — big photo carousel left (the photos
      // are the game), info/guess stack right. Mobile/tablet: unchanged stack.
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, overflow: "hidden", ...(isDesktop ? { display: "flex", alignItems: "stretch" } : {}) }}>
        <div style={isDesktop ? { flex: "0 0 58%", minWidth: 0, position: "relative", minHeight: 520 } : undefined}>
        {/* Desktop: absolute-fill so the photo always spans the full column
            height regardless of how tall the info rail runs. */}
        <div style={isDesktop ? { position: "absolute", inset: 0 } : undefined}>
        {/* One render path for every case. The carousel handles a single photo
            (no arrows/dots) and is the only place the lightbox lives, so the old
            plain-<img> fallback branch is gone — it duplicated the whole pill row
            and had no way to expand. */}
        <PhotoCarouselBase photos={mergedPhotos} fallbackPhoto={listing.photo} badge={badge} badgeColor={badgeColor} accent={accent} pType={pType} showExtras={showType} datePill={datePill} listing={listing} FONT={FONT} isDesktop={isDesktop} hideHoodPill={view === "live"} isLoadingDetails={isLoadingDetails} />
        </div>
        </div>
        <div style={{ padding: IS_MOBILE ? "10px 14px 12px" : (isDesktop ? "20px 24px" : "16px 18px 20px"), ...(isDesktop ? { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", borderLeft: `1px solid ${T.cardBorder}` } : {}) }}>
          {/* Address or Neighborhood heading */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: showAddress ? 17 : 20, fontWeight: 700, color: T.text, letterSpacing: "-0.02em", fontFamily: FONT }}>{showAddress ? listing.address : resolveNeighborhood(listing)}</div>
          </div>
          <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT }}>
            {showAddress ? `${resolveNeighborhood(listing)} · ${listing.city}, ${listing.state} ${listing.zip}` : `${listing.city}, ${listing.state} ${listing.zip}`}{(showExtras || showPropertyType) && listing.propertyType ? ` · ${listing.propertyType}` : ""}
          </div>
          {/* MLS Description — from details API or listing */}
          {showExtras && desc && (
            <div style={{ marginTop: IS_MOBILE ? 6 : 10, background: T.inputBg, borderRadius: 10, padding: IS_MOBILE ? "8px 12px" : "10px 14px", border: `1px solid ${T.cardBorder}` }}>
              {/* Expanded is CAPPED and scrolls internally — MLS remarks run
                  2,000+ chars, and an unbounded "none" stretched the desktop
                  card's photo column to match the rail (Christo 2026-07-18). */}
              <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.55, fontFamily: FONT, overflowY: mlsExpanded ? "auto" : "hidden", overflowX: "hidden", maxHeight: mlsExpanded ? (IS_MOBILE ? 180 : 240) : (IS_MOBILE ? 38 : 54), position: "relative", overscrollBehavior: "contain" }}>
                {renderHighlightedDesc(desc, T)}
                {!mlsExpanded && desc.length > 120 && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 28, background: `linear-gradient(transparent, ${T.inputBg})` }} />
                )}
              </div>
              {desc.length > 120 && (
                <button onClick={() => setMlsExpanded(!mlsExpanded)} style={{ background: "none", border: "none", color: accent, fontSize: 11, fontWeight: 600, fontFamily: FONT, letterSpacing: 1, cursor: "pointer", padding: IS_MOBILE ? "3px 0 0" : "6px 0 0", textTransform: "uppercase" }}>{mlsExpanded ? "Show less" : "Read more"}</button>
              )}
            </div>
          )}
          {/* Price Read gauge — For Sale shows it up front (a pricing-strategy
              read is the whole point pre-offer). On the Sold GAME it would
              telegraph the answer, so there it moves to the post-guess reveal
              (see RevealCard priceRead below). */}
          {view === "live" && valuePool && renderPriceRead(listing, valuePool, details, T)}
          {/* Value signals — Free Play / Live ONLY (never daily/challenge: no
              valuePool prop there and the view gate double-locks it). Lexicon
              chips over the MLS description + quant context vs. the current
              pool. LIST prices only — sold price never renders or leaks. */}
          {(view === "freeplay" || view === "live") && valuePool && (() => {
            // rc_/rf_ subjects: only the enriched details list price is safe
            // (raw listPrice falls back to the sold price — the answer).
            const zid = String(listing.zpid || "");
            const enrichedLp = (zid.startsWith("rc_") || zid.startsWith("rf_"))
              ? (details?.listPrice && details.listPrice !== listing.soldPrice ? details.listPrice : null)
              : null;
            const vc = computeValueContext(listing, valuePool, enrichedLp);
            const sigs = extractValueSignals(desc); // no description (RentCast rows) -> quant stats only
            const decoded = extractAgentSpeak(desc); // realtor euphemisms → plain English
            const toneColor = (tone) => tone === "bad" ? T.red : tone === "good" ? T.green : T.orange;
            const rows = [];
            // Prior sale leads the list — on a For Sale card it's the strongest
            // anchor for what the home is worth (and tells you if it's a flip).
            if (lastSoldLabel) rows.push(`· Last sold ${lastSoldLabel}`);
            if (vc.ppsf) {
              rows.push(vc.medianPpsf
                ? `· $${Math.round(vc.ppsf)}/sqft vs $${Math.round(vc.medianPpsf)} area median (${vc.ppsfDeltaPct >= 0 ? "+" : ""}${Math.round(vc.ppsfDeltaPct)}%)`
                : `· $${Math.round(vc.ppsf)}/sqft list price`);
            }
            if (vc.domVsMedian) rows.push(`· ${vc.domVsMedian.value} DOM vs ${Math.round(vc.domVsMedian.median)} median`);
            // How fast the market said yes. The pool's daysOnMarket is 0 on
            // EVERY sold row, so vc.domVsMedian above never fires on a Sold
            // card — this comes from the enrichment's priceHistory instead.
            // Prefer listed→pending; listed→sold is the same span plus escrow,
            // so it's labeled differently rather than passed off as pending.
            if (details?.daysToPending != null) {
              rows.push(`· Pending in ${details.daysToPending} ${details.daysToPending === 1 ? "day" : "days"}`);
            } else if (details?.daysToSold != null) {
              rows.push(`· ${details.daysToSold} ${details.daysToSold === 1 ? "day" : "days"} on market (list to close)`);
            }
            if (vc.lotVsMedian) rows.push(`· ${Math.round(vc.lotVsMedian.value).toLocaleString("en-US")} sqft lot vs ${Math.round(vc.lotVsMedian.median).toLocaleString("en-US")} median`);
            const chips = [
              ...sigs.premium.map(s => ({ ...s, color: T.green, bg: T.successBg, border: T.successBorder })),
              ...sigs.discount.map(s => ({ ...s, color: T.red, bg: T.errorBg, border: T.errorBorder })),
            ];
            if (chips.length === 0 && rows.length === 0 && decoded.length === 0) return null;
            return (
              <div style={{ marginTop: IS_MOBILE ? 6 : 10, background: T.inputBg, borderRadius: 10, padding: IS_MOBILE ? "8px 12px" : "10px 14px", border: `1px solid ${T.cardBorder}` }}>
                <button onClick={() => setValueSignalsOpen(!valueSignalsOpen)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary }}>Value Signals</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: T.textTertiary }}>
                    {!valueSignalsOpen && (
                      <span style={{ fontSize: 10, fontWeight: 600, fontFamily: FONT, color: T.textTertiary, background: T.pillBg, borderRadius: 9999, padding: "2px 8px" }}>{chips.length + decoded.length + rows.length}</span>
                    )}
                    <Icon name="chevron-down" size={13} style={{ transform: valueSignalsOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                  </span>
                </button>
                {valueSignalsOpen && (
                  <>
                    {chips.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {chips.map(c => (
                          <span key={c.key} style={{ fontSize: 11, fontWeight: 600, fontFamily: FONT, color: c.color, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 9999, padding: "3px 10px" }}>{c.label}</span>
                        ))}
                      </div>
                    )}
                    {decoded.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, fontFamily: FONT, color: T.text, letterSpacing: 0.2 }}>Real<span style={{ color: T.accent }}>Talk</span></span>
                          <span style={{ fontSize: 10, fontWeight: 500, fontFamily: FONT, color: T.textTertiary }}>reading between the lines</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {decoded.map(d => (
                            <div key={d.key} style={{ fontSize: 12, color: T.textSecondary, fontFamily: FONT, lineHeight: 1.5, display: "flex", gap: 7 }}>
                              <span aria-hidden style={{ flexShrink: 0, marginTop: 6, width: 6, height: 6, borderRadius: 9999, background: toneColor(d.tone) }} />
                              <span><span style={{ color: toneColor(d.tone), fontWeight: 700 }}>“{d.matched}”</span> {d.means}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {rows.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        {rows.map((r, i) => (
                          <div key={i} style={{ fontSize: 12, color: T.textSecondary, fontFamily: FONT, lineHeight: 1.6 }}>{r}</div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}
          {/* Specs */}
          <div style={{ display: "flex", gap: 6, margin: IS_MOBILE ? "8px 0" : "14px 0", flexWrap: "wrap" }}>
            {[[listing.beds, "Beds"], [listing.baths, "Baths"], [(listing.sqft || 0).toLocaleString(), "SqFt"], [yearBuilt, "Built"]].map(([v, l], i) => (
              <div key={i} style={{ background: T.inputBg, borderRadius: 10, padding: IS_MOBILE ? "5px 8px" : "8px 14px", textAlign: "center", flex: 1, minWidth: IS_MOBILE ? 52 : 60, border: `1px solid ${T.cardBorder}` }}>
                <div style={{ fontSize: IS_MOBILE ? 14 : 16, fontWeight: 700, color: T.text, fontFamily: FONT }}>{v}</div>
                <div style={{ fontSize: 9, color: T.textTertiary, marginTop: 2, fontFamily: FONT, letterSpacing: 1, textTransform: "uppercase" }}>{l}</div>
              </div>
            ))}
          </div>
          {/* View on Zillow link — Live mode only, shown before guess to enable informed predictions */}
          {showZillowLink && listing.detailUrl && (
            <a href={listing.detailUrl.startsWith("http") ? listing.detailUrl : `https://www.zillow.com${listing.detailUrl}`} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 16px", marginBottom: 14, borderRadius: 10, border: `1px solid ${T.cardBorder}`, background: T.inputBg, textDecoration: "none", color: T.textSecondary, fontSize: 12, fontWeight: 600, fontFamily: FONT, transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = T.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.cardBorder; e.currentTarget.style.color = T.textSecondary; }}>
              <Icon name="external-link" size={13} /> View Full Listing on {String(listing.detailUrl).includes("redfin.com") ? "Redfin" : "Zillow"}
            </a>
          )}
          {/* Guess label — desktop only; on mobile the question lives in the
              input placeholder to save a row */}
          {!IS_MOBILE && (
            <div style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, textAlign: "center", marginBottom: 4, fontFamily: FONT }}>{labelOverrides?.guessLabel || "What do you think it sold for?"}</div>
          )}
          {/* Price row: LIST PRICE pill + guess input side by side — kills the
              stacked row + label that pushed Final Answer below the fold.
              When there's no list price the input takes the full row. */}
          <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginBottom: 4, ...(isDesktop ? { flexDirection: "column" } : {}) }}>
            {(() => {
              {/* A listPrice EQUAL to soldPrice is a placeholder, not a real
                  asking price — rendering it puts the answer on screen under a
                  "LIST PRICE" label. The old guard only applied that test to
                  rc_/rf_ rows, so plain-zpid rows with the same placeholder
                  leaked (1 of 250 Alameda comps, verified 2026-07-19). The test
                  is now on the VALUE, not the id prefix, for every row. */}
              const enriched = details?.listPrice && details.listPrice !== listing.soldPrice ? details.listPrice : null;
              const raw = listing.listPrice && listing.listPrice !== listing.soldPrice ? listing.listPrice : null;
              const displayLp = raw || enriched;
              if (!displayLp) return null;
              return (
                <div style={{ flex: 1, minWidth: 0, background: T.inputBg, borderRadius: 12, padding: IS_MOBILE ? "8px 12px" : "14px 18px", border: `1px solid ${T.cardBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ minWidth: 0 }}>
                    <OverlineLabel>LIST PRICE</OverlineLabel>
                    <div style={{ fontSize: IS_MOBILE ? 18 : 26, fontWeight: 800, color: T.text, fontFamily: FONT, marginTop: 2, whiteSpace: "nowrap" }}>{fmt(displayLp)}</div>
                  </div>
                  {listing.daysOnMarket > 0 && !IS_MOBILE && (
                    <div style={{ textAlign: "right" }}>
                      <OverlineLabel>DAYS ON MKT</OverlineLabel>
                      <div style={{ fontSize: 22, fontWeight: 700, color: T.textSecondary, fontFamily: FONT, marginTop: 2 }}>{listing.daysOnMarket}</div>
                    </div>
                  )}
                </div>
              );
            })()}
            <div onClick={() => { const el = document.getElementById(`pp-guess-${badge || "d"}`); if (el) el.focus(); }}
              style={{ flex: 1.35, minWidth: 0, position: "relative", background: T.inputBg, border: `2px solid ${guess ? T.cardBorder : accent}`, boxShadow: guess ? "none" : `0 0 12px ${accent}33`, borderRadius: 14, padding: IS_MOBILE ? "10px 12px" : "16px 20px", cursor: "text", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color 0.2s" }}>
              <div style={{ fontSize: guess ? (IS_MOBILE ? 20 : 28) : (IS_MOBILE ? 14 : 18), fontWeight: guess ? 900 : 500, color: guess ? T.text : T.textTertiary, fontFamily: FONT, letterSpacing: guess ? "-0.02em" : 0, transition: "all 0.15s", whiteSpace: "nowrap" }}>
                {guess ? `$${parseInt(guess).toLocaleString("en-US")}` : (IS_MOBILE ? "Sold for?" : "Tap to enter price")}
              </div>
              <input id={`pp-guess-${badge || "d"}`} value={guess || ""} onChange={onGuessChange} onKeyDown={e => e.key === "Enter" && onGuess()} inputMode="numeric" autoComplete="off"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, fontSize: 18, border: "none", outline: "none", background: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.parentElement.style.borderColor = accent} onBlur={e => e.target.parentElement.style.borderColor = T.cardBorder} />
            </div>
          </div>
          {/* Live feedback — always render to keep DOM stable */}
          {(!IS_MOBILE || guess) && <div style={{ textAlign: "center", fontSize: 12, color: T.textSecondary, marginTop: IS_MOBILE ? 2 : 6, fontFamily: FONT, minHeight: IS_MOBILE ? 16 : 18, visibility: guess ? "visible" : "hidden" }}>{(() => {
            const v = parseInt(guess);
            if (!v) return "\u00A0";
            // rc_/rf_ rows: raw listPrice falls back to the SOLD price — comparing
            // against it would leak the answer. Only use the enriched real list.
            const zid = String(listing.zpid || "");
            const anchor = (zid.startsWith("rc_") || zid.startsWith("rf_"))
              ? (details?.listPrice && details.listPrice !== listing.soldPrice ? details.listPrice : null)
              : listing.listPrice;
            const parts = [];
            if (anchor) { const d = ((v - anchor) / anchor * 100).toFixed(1); parts.push(`${d > 0 ? "+" : ""}${d}% vs list`); }
            if (listing.sqft) parts.push(`$${Math.round(v / listing.sqft)}/sf`);
            return parts.length ? parts.join(" · ") : "\u00A0";
          })()}</div>}
          <div style={{ marginTop: IS_MOBILE ? 4 : 14 }}>
            <PillButton onClick={onGuess} disabled={!guess} accent={accent === T.accent} tealAccent={accent === T.cyan} style={IS_MOBILE ? { padding: "9px", fontSize: 14 } : undefined}>{labelOverrides?.buttonLabel || "Final Answer"}</PillButton>
          </div>
        </div>
      </div>
    );
  };

  // ── Reveal card ──
  const RevealCard = ({ result, onShare, onChallenge, onContinue, onRunNumbersClick, showPhases, comparison, priceRead }) => {
    const color = fbColor(result.feedback);
    return (
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 24, padding: "32px 24px", maxWidth: isDesktop ? 560 : 420, width: "100%", margin: isDesktop ? "0 auto" : undefined, animation: "ppScaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <OverlineLabel>SOLD FOR</OverlineLabel>
          <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-0.03em", fontFamily: FONT, color: showPhases && revealPhase >= 1 ? color : showPhases ? T.textTertiary : color, transition: "color 0.3s", animation: showPhases && revealPhase < 1 ? "ppPulse 0.3s ease infinite" : "none" }}>{fmt(result.soldPrice)}</div>
        </div>
        {(!showPhases || revealPhase >= 1) && (
          <div style={{ animation: "ppSlideUp 0.4s ease" }}>
            {/* Head-to-head comparison scoreboard (challenge mode) */}
            {comparison && (
              <div style={{ background: comparison.iWon ? `${T.green}12` : `${T.orange}12`, border: `1px solid ${comparison.iWon ? `${T.green}30` : `${T.orange}30`}`, borderRadius: 14, padding: "16px", marginBottom: 16, animation: "ppScaleIn 0.4s ease" }}>
                <div style={{ textAlign: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontFamily: FONT, letterSpacing: 2, color: comparison.iWon ? T.green : T.orange, fontWeight: 700, textTransform: "uppercase" }}>
                    {comparison.myAccuracy === comparison.challengerAccuracy ? "IT'S A TIE" : comparison.iWon ? "YOU WIN" : "THEY GOT YOU"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 10, background: `rgba(255,255,255,0.04)` }}>
                    <div style={{ fontSize: 9, fontFamily: FONT, letterSpacing: 2, color: T.textTertiary, textTransform: "uppercase" }}>YOU</div>
                    <div style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT, marginTop: 4, color: comparison.iWon ? T.green : T.textSecondary }}>{comparison.myAccuracy.toFixed(1)}%</div>
                    <div style={{ fontSize: 11, fontFamily: FONT, color: T.textTertiary, marginTop: 2 }}>{fmt(result.guess)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", fontSize: 14, fontWeight: 600, color: T.textTertiary, fontFamily: FONT }}>vs</div>
                  <div style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 10, background: `rgba(255,255,255,0.04)` }}>
                    <div style={{ fontSize: 9, fontFamily: FONT, letterSpacing: 2, color: T.textTertiary, textTransform: "uppercase" }}>THEM</div>
                    <div style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT, marginTop: 4, color: !comparison.iWon ? T.green : T.textSecondary }}>{comparison.challengerAccuracy.toFixed(1)}%</div>
                    <div style={{ fontSize: 11, fontFamily: FONT, color: T.textTertiary, marginTop: 2 }}>{fmt(comparison.challengerGuess)}</div>
                  </div>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 12, marginBottom: 20, background: T.inputBg, borderRadius: 14, padding: "14px 16px", border: `1px solid ${T.cardBorder}` }}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 9, fontFamily: FONT, letterSpacing: 2, color: T.textTertiary, textTransform: "uppercase" }}>YOUR GUESS</div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FONT, color: T.text, marginTop: 4 }}>{fmt(result.guess)}</div>
              </div>
              <div style={{ width: 1, background: T.cardBorder }} />
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 9, fontFamily: FONT, letterSpacing: 2, color: T.textTertiary, textTransform: "uppercase" }}>ACCURACY</div>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FONT, marginTop: 4, color }}>{(100 - result.pctOff).toFixed(1)}%</div>
              </div>
            </div>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 9999, fontSize: 11, fontWeight: 700, fontFamily: FONT, letterSpacing: 2, color, background: `${color}18`, border: `1px solid ${color}30`, marginBottom: 10 }}>{result.feedback.label}</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: T.textSecondary, lineHeight: 1.5, fontFamily: FONT }}>{result.feedbackMessage}</div>
            </div>
            {result.insight && (
              <div style={{ background: T.inputBg, borderRadius: 12, padding: "12px 16px", border: `1px solid ${T.cardBorder}`, marginBottom: 16, borderLeft: `3px solid ${T.blue}` }}>
                <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5, fontFamily: FONT }}>{result.insight}</div>
              </div>
            )}
            {/* What it ASKED vs what it GOT — the number that tells you whether
                the market bid it up. Only when a real list price exists (a
                listPrice equal to soldPrice is a placeholder, not an asking
                price). Reveal-only, so it can never hint at the answer. */}
            {(() => {
              const lp = result.listPrice;
              if (!lp || !result.soldPrice || lp === result.soldPrice) return null;
              const deltaPct = ((result.soldPrice - lp) / lp) * 100;
              const over = deltaPct > 0;
              const deltaColor = over ? T.green : T.orange;
              return (
                <div style={{ display: "flex", gap: 12, marginBottom: 20, background: T.inputBg, borderRadius: 14, padding: "14px 16px", border: `1px solid ${T.cardBorder}` }}>
                  <div style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ fontSize: 9, fontFamily: FONT, letterSpacing: 2, color: T.textTertiary, textTransform: "uppercase" }}>LISTED FOR</div>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FONT, color: T.text, marginTop: 4 }}>{fmt(lp)}</div>
                  </div>
                  <div style={{ width: 1, background: T.cardBorder }} />
                  <div style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ fontSize: 9, fontFamily: FONT, letterSpacing: 2, color: T.textTertiary, textTransform: "uppercase" }}>{over ? "OVER ASKING" : "UNDER ASKING"}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, fontFamily: FONT, marginTop: 4, color: deltaColor }}>
                      {over ? "+" : "−"}{Math.abs(deltaPct).toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })()}
            <div style={{ textAlign: "center", marginBottom: 20, padding: "10px 0", borderTop: `1px solid ${T.cardBorder}`, borderBottom: `1px solid ${T.cardBorder}` }}>
              <div style={{ fontSize: 10, fontFamily: FONT, letterSpacing: 2, color: T.textTertiary, textTransform: "uppercase", marginBottom: 4 }}>ADDRESS</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: FONT }}>{result.address}</div>
              <div style={{ fontSize: 12, color: T.textSecondary, fontFamily: FONT }}>{result.neighborhood} · {result.city}, {result.state}</div>
            </div>
            {/* Price Read — post-guess on the Sold game (passed only from the
                freeplay reveal, where a comp median exists). */}
            {priceRead}
          </div>
        )}
        {(!showPhases || revealPhase >= 2) && (
          <div style={{ animation: "ppSlideUp 0.3s ease" }}>
            {onChallenge && (
              <button onClick={() => onChallenge(result)} style={{ width: "100%", padding: 14, borderRadius: 9999, border: "none", background: "linear-gradient(135deg, #3B6BF5, #2B4FCE)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 0 20px rgba(59,107,245,0.3)", transition: "all 0.2s" }}>
                <Icon name="send" size={16} /> Challenge a Friend
              </button>
            )}
            {onShare && <PillButton onClick={() => onShare(result)} accent style={{ marginBottom: 10 }}>{onChallenge ? "Share" : "Share Your Result"}</PillButton>}
            {/* App Store upsell — the highest-converting moment: a challenge
                recipient who just played on the mobile web. iOS web only. */}
            {comparison && isIOSWebVisitor && (
              <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", width: "100%", boxSizing: "border-box", alignItems: "center", justifyContent: "center", gap: 8, padding: 13, marginBottom: 10, borderRadius: 9999, border: "none", background: "linear-gradient(135deg, #38c6c6, #3B6BF5)", textDecoration: "none", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: FONT, boxShadow: "0 0 20px rgba(6,182,212,0.3)" }}>
                <Icon name="smartphone" size={15} /> Get the RealStack App
              </a>
            )}
            {result.detailUrl && (
              <a href={result.detailUrl.startsWith("http") ? result.detailUrl : `https://www.zillow.com${result.detailUrl}`} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", width: "100%", boxSizing: "border-box", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, marginBottom: 10, borderRadius: 9999, border: `1px solid ${T.cardBorder}`, background: "transparent", textDecoration: "none", color: T.textSecondary, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT, transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = T.text; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.cardBorder; e.currentTarget.style.color = T.textSecondary; }}>
                <Icon name="external-link" size={14} /> View on Zillow
              </a>
            )}
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
  // ── Desktop canvas width per view (isDesktop = shell's ≥900px breakpoint).
  // Game views go wide for the two-column property card, pickers/stats get
  // grid room, the rest just breathe. Below 900px nothing changes (480 col).
  const DESKTOP_VIEW_WIDTH = {
    daily: 1060, freeplay: 1060, live: 1060, challenge: 1060, reveal: 1060,
    fpPicker: 900, livePicker: 900, tomorrow: 900, leaderboard: 800,
    postDaily: 700, onboarding: 700,
  };
  return (
    <div style={{ maxWidth: isDesktop ? (DESKTOP_VIEW_WIDTH[view] || 520) : 480, margin: "0 auto", width: "100%", minHeight: "100vh", fontFamily: FONT, color: T.text, boxSizing: "border-box", position: "relative" }}>
      <style>{`
        @keyframes ppSpin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
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
          0% { box-shadow: 0 0 0 0 rgba(59,107,245,0.6) }
          50% { box-shadow: 0 0 60px 30px rgba(59,107,245,0.3) }
          100% { box-shadow: 0 0 80px 40px rgba(59,107,245,0) }
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
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 999, padding: "12px 24px", borderRadius: 12, background: T.accent, color: "#fff", fontSize: 14, fontWeight: 600, animation: "ppSlideUp 0.3s ease", boxShadow: "0 8px 32px rgba(59,107,245,0.3)", fontFamily: FONT }}>
          Copied to clipboard
        </div>
      )}

      {/* Quiet "saved offline / will sync" banner — gameplay never blocks on network */}
      {syncToast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 999, maxWidth: "90%", textAlign: "center", padding: "12px 20px", borderRadius: 12, background: T.inputBg, color: T.textSecondary, fontSize: 13, fontWeight: 500, animation: "ppSlideUp 0.3s ease", boxShadow: "0 8px 32px rgba(0,0,0,0.3)", border: `1px solid ${T.cardBorder}`, fontFamily: FONT }}>
          {syncToast}
        </div>
      )}

      {/* ═══ LEVEL-UP CELEBRATION ═══ */}
      {levelUpData && (() => {
        const particles = Array.from({ length: 24 }, (_, i) => {
          const angle = (i / 24) * Math.PI * 2;
          const dist = 80 + Math.random() * 120;
          const colors = ["#3B6BF5", "#3B6BF5", "#38c6c6", "#12a150", "#d98a0b", "#EC4899", "#6E90FF", "#6E90FF"];
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
              border: "3px solid #3B6BF5", animation: "lvlRing 1.2s ease-out forwards",
              animationDelay: "0.4s", opacity: 0,
            }} />
            <div style={{
              position: "absolute", width: 200, height: 200, borderRadius: "50%",
              border: "3px solid #3B6BF5", animation: "lvlRing 1.2s ease-out forwards",
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
                  background: "linear-gradient(90deg, #3B6BF5, #2B4FCE, #38c6c6)",
                  animation: "lvlBarFill 1s ease-in-out forwards",
                }} />
              </div>
              <div style={{
                textAlign: "center", fontSize: 10, fontFamily: FONT, color: "rgba(255,255,255,0.5)",
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
                background: "linear-gradient(135deg, #3B6BF5, #2B4FCE, #38c6c6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 40px rgba(59,107,245,0.4)",
              }}>
                <Icon name={levelUpData.newLevel.icon} size={36} style={{ color: "#fff" }} />
              </div>

              {/* LEVEL UP text */}
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase",
                fontFamily: FONT, marginBottom: 8,
                background: "linear-gradient(90deg, #6E90FF, #3B6BF5, #2B4FCE, #38c6c6, #6E90FF)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                animation: "lvlShimmer 2s linear infinite",
              }}>LEVEL UP</div>

              {/* Level number + name */}
              <div style={{ fontSize: 48, fontWeight: 900, color: "#fff", fontFamily: FONT, letterSpacing: "-0.03em", lineHeight: 1 }}>
                {levelUpData.newLevel.level}
              </div>
              <div style={{
                fontSize: 20, fontWeight: 700, color: "#fff", fontFamily: FONT, marginTop: 8,
                textShadow: "0 0 20px rgba(59,107,245,0.5)",
              }}>
                {levelUpData.newLevel.name}
              </div>
            </div>

            {/* Achievement message */}
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
                <div style={{ fontSize: 11, fontFamily: FONT, letterSpacing: 2, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", marginBottom: 4 }}>ACHIEVEMENT</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", fontFamily: FONT }}>
                  {levelUpData.newLevel.level >= 10 ? "Market Expert Status" :
                   levelUpData.newLevel.level >= 7 ? "Sharpening Your Edge" :
                   levelUpData.newLevel.level >= 5 ? "Building Real Instincts" :
                   levelUpData.newLevel.level >= 3 ? "Getting Dialed In" :
                   "Keep Going!"}
                </div>
              </div>
            </div>

            {/* XP earned line */}
            <div style={{
              position: "relative", zIndex: 2, marginTop: 16,
              animation: "lvlUnlockSlide 0.6s ease forwards",
              animationDelay: "2.2s", opacity: 0,
              fontSize: 12, fontFamily: FONT, color: "rgba(255,255,255,0.4)", letterSpacing: 1,
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
                background: "linear-gradient(135deg, #3B6BF5, #2B4FCE)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon name={currentLevel.icon} size={28} style={{ color: "#fff" }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", fontFamily: FONT, color: T.accent, marginBottom: 4 }}>LEVEL UP</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: T.text, fontFamily: FONT }}>Level {currentLevel.level}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: T.textSecondary, fontFamily: FONT, marginTop: 2 }}>{currentLevel.name}</div>
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <div style={{ flex: 1, background: T.inputBg, borderRadius: 12, padding: "10px 12px", textAlign: "center", border: `1px solid ${T.cardBorder}` }}>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: FONT, color: T.text }}>{allResults.length}</div>
                <div style={{ fontSize: 9, fontFamily: FONT, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 2 }}>GUESSES</div>
              </div>
              <div style={{ flex: 1, background: T.inputBg, borderRadius: 12, padding: "10px 12px", textAlign: "center", border: `1px solid ${T.cardBorder}` }}>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: FONT, color: T.text }}>{xp}</div>
                <div style={{ fontSize: 9, fontFamily: FONT, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 2 }}>TOTAL XP</div>
              </div>
              <div style={{ flex: 1, background: T.inputBg, borderRadius: 12, padding: "10px 12px", textAlign: "center", border: `1px solid ${T.cardBorder}` }}>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: FONT, color: T.accent }}>{allResults.length > 0 ? (100 - (allResults.reduce((s, r) => s + (r.pctOff || 0), 0) / allResults.length)).toFixed(1) : "—"}%</div>
                <div style={{ fontSize: 9, fontFamily: FONT, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 2 }}>ACCURACY</div>
              </div>
            </div>

            {/* Share button */}
            <button onClick={() => {
              const avg = allResults.length > 0 ? (100 - (allResults.reduce((s, r) => s + (r.pctOff || 0), 0) / allResults.length)).toFixed(1) : "—";
              const text = `I just reached Level ${currentLevel.level}: ${currentLevel.name} on PricePoint!\n\n${allResults.length} guesses · ${avg}% accuracy · ${xp} XP\n\nThink you know real estate prices? Try it: blueprint.realstack.app`;
              if (navigator.share) {
                navigator.share({ text }).catch(() => {});
              } else {
                navigator.clipboard.writeText(text).then(() => { setShareToast(true); setTimeout(() => setShareToast(false), 2000); });
              }
            }} style={{
              width: "100%", padding: "14px", borderRadius: 9999,
              background: "linear-gradient(135deg, #3B6BF5, #2B4FCE)", color: "#fff",
              fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: FONT,
              boxShadow: "0 0 20px rgba(59,107,245,0.3)", marginBottom: 8,
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
          margin: IS_MOBILE ? "10px 12px 6px" : "16px 16px 12px", padding: IS_MOBILE ? "6px 12px" : "10px 16px", background: T.card,
          border: `1px solid ${T.cardBorder}`, borderRadius: 12,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: T.accent }}><Icon name={currentLevel.icon} size={16} /></span>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT }}>Lv.{currentLevel.level}</span>
          </div>
          <div style={{ flex: 1, height: 6, background: T.inputBg, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg, #3B6BF5, #2B4FCE)",
              width: nextLevel ? `${((xp - currentLevel.req) / (nextLevel.req - currentLevel.req)) * 100}%` : "100%",
              transition: "width 0.5s ease" }} />
          </div>
          <span style={{ fontSize: 11, fontFamily: FONT, color: T.textTertiary, whiteSpace: "nowrap" }}>{xp}{nextLevel ? `/${nextLevel.req}` : ""} XP</span>
        </div>
      )}

      {/* ═══ ONBOARDING — Market Picker ═══ */}
      {view === "onboarding" && (
        <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100vh", animation: "ppFadeIn 0.5s ease" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: T.accent, marginBottom: 16 }}>PRICEPOINT</div>
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
                <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, marginTop: 4, letterSpacing: 1 }}>
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

      {/* ═══ DAILY CHALLENGE — loading skeleton (listings still fetching) ═══ */}
      {view === "daily" && !dailyProperty && (
        <div style={{ padding: (IS_MOBILE ? "8px 12px 74px" : "16px 16px 100px"), animation: "ppFadeIn 0.3s ease" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: T.accent }}>DAILY CHALLENGE #{displayDailyNumber}</div>
            <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT }}>{locationLabel || market?.label || "Your Market"}</div>
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, overflow: "hidden", ...(isDesktop ? { maxWidth: 640, margin: "0 auto" } : {}) }}>
            <div style={{ height: isDesktop ? 320 : 220, background: T.inputBg, animation: "ppPulse 1.4s ease infinite" }} />
            <div style={{ padding: 16 }}>
              <div style={{ height: 18, width: "70%", background: T.inputBg, borderRadius: 6, marginBottom: 10, animation: "ppPulse 1.4s ease infinite" }} />
              <div style={{ height: 13, width: "45%", background: T.inputBg, borderRadius: 6, marginBottom: 18, animation: "ppPulse 1.4s ease infinite" }} />
              <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ height: 28, flex: 1, background: T.inputBg, borderRadius: 9999, animation: "ppPulse 1.4s ease infinite" }} />
                ))}
              </div>
              <div style={{ height: 44, background: T.inputBg, borderRadius: 9999, animation: "ppPulse 1.4s ease infinite" }} />
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: T.textSecondary, fontFamily: FONT, animation: "ppPulse 1.2s ease infinite" }}>
            {error ? error : "Pulling today's home..."}
          </div>
        </div>
      )}

      {/* ═══ DAILY CHALLENGE ═══ */}
      {view === "daily" && dailyProperty && (
        <div style={{ padding: (IS_MOBILE ? "8px 12px 74px" : "16px 16px 100px"), animation: "ppSlideUp 0.5s ease-out" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: T.accent }}>DAILY CHALLENGE #{displayDailyNumber}</div>
              <div onClick={() => setShowMarketSwitcher(true)} style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>{locationLabel || market?.label || "Your Market"} <Icon name="chevron-down" size={12} /></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {streak > 0 && <StatPill value={`${streak}d`} label="streak" color={T.orange} />}
              <StatPill value={`Lv.${currentLevel.level}`} color={T.accent} />
            </div>
          </div>
          {PropertyCard({ listing: dailyProperty, guess: guessInput, onGuessChange: handleGuessInput, onGuess: handleDailyGuess, badge: "DAILY", badgeColor: T.accent, accentColor: T.accent, showPropertyType: true, showExtras: true, showSoldDate: true, details: propertyDetails[dailyProperty.zpid] || null, isLoadingDetails: detailsLoading === dailyProperty.zpid })}
        </div>
      )}

      {/* ═══ REVEAL ═══ */}
      {view === "reveal" && dailyResult && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(5,5,5,0.95)", backdropFilter: "blur(20px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, animation: "ppFadeIn 0.3s ease", padding: 16 }}>
          {RevealCard({ result: dailyResult, showPhases: true, onShare: shareResult,
            onChallenge: dailyProperty ? (r) => shareChallenge(r, dailyProperty, true) : null,
            onContinue: () => setView("postDaily"),
            onRunNumbersClick: onRunNumbers ? (r) => { onRunNumbers({ price: r.soldPrice, state: r.state, city: r.city, zip: r.zip }); } : null })}
        </div>
      )}

      {/* ═══ POST-DAILY — Funnel into Free Play ═══ */}
      {view === "postDaily" && (
        <div style={{ padding: (IS_MOBILE ? "8px 12px 74px" : "16px 16px 100px"), animation: "ppSlideUp 0.5s ease-out" }}>
          {dailyResult && (
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <OverlineLabel>TODAY'S RESULT</OverlineLabel>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
                <img src={dailyResult.photo || NO_PHOTO} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover" }}
                  onError={onPhotoError} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.text, fontFamily: FONT }}>{resolveNeighborhood(dailyResult)}</div>
                  <div style={{ fontSize: 12, color: T.textSecondary, fontFamily: FONT }}>{dailyResult.beds}BR/{dailyResult.baths}BA · {(dailyResult.sqft || 0).toLocaleString()}sf</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FONT, color: fbColor(dailyResult.feedback) }}>{(100 - dailyResult.pctOff).toFixed(1)}%</div>
                  <div style={{ fontSize: 10, fontFamily: FONT, fontWeight: 600, letterSpacing: 1, color: fbColor(dailyResult.feedback) }}>{dailyResult.feedback.label}</div>
                </div>
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                {dailyProperty && <button onClick={() => shareChallenge(dailyResult, dailyProperty, true)} style={{ flex: 1, padding: 12, borderRadius: 9999, border: "none", background: "linear-gradient(135deg, #3B6BF5, #2B4FCE)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 0 20px rgba(59,107,245,0.3)" }}><Icon name="send" size={14} /> Challenge</button>}
                <PillButton onClick={() => shareResult(dailyResult)} accent style={{ flex: 1 }}>Share</PillButton>
              </div>
            </div>
          )}

          <div style={{ background: `linear-gradient(135deg, ${T.cyan}12, ${T.accent}12)`, border: `1px solid ${T.cyan}30`, borderRadius: 16, padding: "28px 20px", textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: T.cyan, marginBottom: 10 }}>KEEP GOING?</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text, fontFamily: FONT, lineHeight: 1.3, marginBottom: 6 }}>Your instincts are warmed up</div>
            <div style={{ fontSize: 14, color: T.textSecondary, fontFamily: FONT, lineHeight: 1.5, marginBottom: 20 }}>Jump into Sold homes for unlimited rounds.<br />Same market, no spoilers for future dailies.</div>
            <PillButton onClick={() => setView("fpPicker")} tealAccent>Play Sold</PillButton>
          </div>

          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "20px", textAlign: "center", marginBottom: 16 }}>
            <OverlineLabel>NEXT DAILY IN</OverlineLabel>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FONT, color: T.text, letterSpacing: "-0.02em", marginTop: 4 }}>{countdown}</div>
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
        <div style={{ padding: (IS_MOBILE ? "8px 12px 74px" : "16px 16px 100px"), animation: "ppFadeIn 0.4s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: T.accent }}>YOUR STATS</div>
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
            <button onClick={async () => {
              const result = await fetchNotifications(playerId, true);
              if (result) { setNotifications(result.notifications || []); setUnreadCount(result.unreadCount || 0); }
              setShowNotifDrawer(true);
            }} style={{
              position: "relative", width: 36, height: 36, borderRadius: 9999,
              background: `${T.accent}12`, border: `1px solid ${T.accent}30`, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Icon name="bell" size={16} style={{ color: T.accent }} />
              {unreadCount > 0 && (
                <div style={{
                  position: "absolute", top: -2, right: -2, minWidth: 16, height: 16,
                  borderRadius: 8, background: T.red || "#e5484d", color: "#fff",
                  fontSize: 9, fontWeight: 800, fontFamily: FONT,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 4px", border: `2px solid ${T.card}`,
                }}>{unreadCount > 9 ? "9+" : unreadCount}</div>
              )}
            </button>
          </div>

          {/* Admin-only: fire the prediction-resolution cron by hand. Hidden
              unless this browser has the admin flag (visit .../pricepoint?admin=1). */}
          {isAdmin && (
            <div style={{ marginBottom: 20, padding: "14px 16px", background: T.inputBg, borderRadius: 12, border: `1px dashed ${T.cardBorder}` }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary, marginBottom: 8 }}>Admin · Prediction resolver</div>
              <button onClick={runResolveNow} style={{
                width: "100%", padding: "12px", borderRadius: 10, background: T.card, color: T.text,
                fontSize: 14, fontWeight: 700, border: `1px solid ${T.cardBorder}`, cursor: "pointer", fontFamily: FONT,
              }}>Check resolver pipeline</button>
              {resolveMsg && (
                <div style={{ marginTop: 8, fontSize: 12, color: T.textSecondary, fontFamily: FONT, lineHeight: 1.5, wordBreak: "break-word" }}>{resolveMsg}</div>
              )}
            </div>
          )}

          {/* Head-to-Head record — spans both challenge types, so it sits above
              the per-mode tabs. Sold challenges score instantly; For Sale ones
              settle when the home closes (shown as "pending"). */}
          {(() => {
            const total = h2h.wins + h2h.losses + h2h.ties;
            const rate = total ? Math.round((h2h.wins / total) * 100) : 0;
            return (
              <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: "16px 18px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary, marginBottom: 6 }}>Head to Head</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 26, fontWeight: 900, fontFamily: FONT, letterSpacing: "-0.02em" }}>
                      <span style={{ color: T.green }}>{h2h.wins}</span><span style={{ color: T.textTertiary }}>–</span><span style={{ color: T.red }}>{h2h.losses}</span>
                    </span>
                    {h2h.ties > 0 && <span style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT }}>· {h2h.ties} tie{h2h.ties === 1 ? "" : "s"}</span>}
                  </div>
                </div>
                {total > 0 ? (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FONT, color: rate >= 50 ? T.green : T.orange }}>{rate}%</div>
                    <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary }}>win rate</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: T.textTertiary, fontFamily: FONT, maxWidth: 170, textAlign: "right", lineHeight: 1.4 }}>Challenge a friend to start your record</div>
                )}
                {h2h.pending?.length > 0 && (
                  <div style={{ flexBasis: "100%", fontSize: 11, color: T.textTertiary, fontFamily: FONT, borderTop: `1px solid ${T.cardBorder}`, paddingTop: 10 }}>{h2h.pending.length} For&nbsp;Sale challenge{h2h.pending.length === 1 ? "" : "s"} pending: settles when {h2h.pending.length === 1 ? "it sells" : "they sell"}.</div>
                )}
              </div>
            );
          })()}

          {/* Stats Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[{ id: "daily", label: "Daily" }, { id: "freeplay", label: "Sold" }, { id: "live", label: "For Sale" }].map(tab => (
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
              {/* Desktop: streak + tiles as one 3-up row. Mobile: streak spans
                  the row (same full-width card as before), tiles 2-up below —
                  rowGap 16 matches the old stacked margins exactly. */}
              <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr 1fr", columnGap: 12, rowGap: isDesktop ? 12 : 16, marginBottom: 16 }}>
                <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 20, gridColumn: isDesktop ? "auto" : "1 / -1" }}>
                  <OverlineLabel>YOUR STREAK</OverlineLabel>
                  <div style={{ fontSize: 56, fontWeight: 900, fontFamily: FONT, color: T.accent, marginTop: 8, textAlign: "center", marginBottom: 6 }}>{streak}</div>
                  <div style={{ fontSize: 14, color: T.textSecondary, textAlign: "center", fontFamily: FONT }}>consecutive days</div>
                </div>
                <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 16, textAlign: "center", ...(isDesktop ? { display: "flex", flexDirection: "column", justifyContent: "center" } : {}) }}>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FONT, color: T.text }}>{allResults.filter(r => r.isDaily).length}</div>
                  <div style={{ fontSize: 11, fontFamily: FONT, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Dailies Played</div>
                </div>
                <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 16, textAlign: "center", ...(isDesktop ? { display: "flex", flexDirection: "column", justifyContent: "center" } : {}) }}>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FONT, color: T.green }}>{avgAccuracy != null ? (100 - avgAccuracy).toFixed(1) : "—"}%</div>
                  <div style={{ fontSize: 11, fontFamily: FONT, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Avg Accuracy</div>
                </div>
              </div>

              {/* Desktop: distribution + level side by side */}
              <div style={isDesktop ? { display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 12, alignItems: "start" } : undefined}>
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
                          <div style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: FONT, textTransform: "uppercase" }}>{band.label}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: T.textTertiary, fontFamily: FONT }}>{count}</div>
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
                    <span style={{ color: T.accent }}><Icon name={currentLevel.icon} size={14} /></span> Lv.{currentLevel.level}: {currentLevel.name}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: FONT, color: T.textTertiary }}>{xp} XP{nextLevel ? ` / ${nextLevel.req}` : ""}</span>
                </div>
                <div style={{ height: 6, background: T.inputBg, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg, #3B6BF5, #2B4FCE)", width: nextLevel ? `${((xp - currentLevel.req) / (nextLevel.req - currentLevel.req)) * 100}%` : "100%", transition: "width 0.5s ease" }} />
                </div>
              </div>
              </div>

              {/* Next Daily Countdown */}
              <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "20px", textAlign: "center", marginBottom: 16 }}>
                <OverlineLabel>NEXT DAILY IN</OverlineLabel>
                <div style={{ fontSize: 32, fontWeight: 800, fontFamily: FONT, color: T.text, letterSpacing: "-0.02em", marginTop: 4 }}>{countdown}</div>
              </div>
            </>
          )}

          {/* ─── FREE PLAY STATS TAB ─── */}
          {statsTab === "freeplay" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FONT, color: T.cyan }}>{allResults.filter(r => !r.isDaily).length}</div>
                  <div style={{ fontSize: 11, fontFamily: FONT, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Sold Rounds</div>
                </div>
                <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FONT, color: T.cyan }}>
                    {(() => {
                      const fpResults = allResults.filter(r => !r.isDaily && r.revealed && r.soldPrice);
                      return fpResults.length > 0 ? (100 - fpResults.reduce((sum, r) => sum + Math.abs((r.guess - r.soldPrice) / r.soldPrice) * 100, 0) / fpResults.length).toFixed(1) : "—";
                    })()}%
                  </div>
                  <div style={{ fontSize: 11, fontFamily: FONT, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Avg Accuracy</div>
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
                        <div style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT, color: T.green }}>{(100 - best.pctOff).toFixed(1)}%</div>
                        <div style={{ fontSize: 11, fontFamily: FONT, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Accuracy</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: FONT }}>{best.propertyType ? propTypeShort(best.propertyType) : "—"}</div>
                        <div style={{ fontSize: 11, fontFamily: FONT, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Type</div>
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
                              <div style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: FONT }}>{type}</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: T.cyan, fontFamily: FONT }}>{accuracy.toFixed(1)}%</div>
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
                        <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FONT, color: T.red }}>{livePreds.length}</div>
                        <div style={{ fontSize: 11, fontFamily: FONT, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Predictions</div>
                      </div>
                      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: 16, textAlign: "center" }}>
                        <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FONT, color: T.red }}>
                          {avgVsList != null ? `${avgVsList > 0 ? "+" : ""}${avgVsList.toFixed(1)}%` : "—"}
                        </div>
                        <div style={{ fontSize: 11, fontFamily: FONT, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Avg vs List</div>
                      </div>
                    </div>

                    {/* Pending vs Resolved */}
                    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                      <OverlineLabel>PREDICTION STATUS</OverlineLabel>
                      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                        <div style={{ flex: 1, background: `${T.orange}12`, borderRadius: 12, padding: "14px 12px", textAlign: "center", border: `1px solid ${T.orange}20` }}>
                          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT, color: T.orange }}>{pendingCount}</div>
                          <div style={{ fontSize: 10, fontFamily: FONT, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Pending</div>
                        </div>
                        <div style={{ flex: 1, background: `${T.green}12`, borderRadius: 12, padding: "14px 12px", textAlign: "center", border: `1px solid ${T.green}20` }}>
                          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT, color: T.green }}>{resolvedCount}</div>
                          <div style={{ fontSize: 10, fontFamily: FONT, letterSpacing: 1, color: T.textTertiary, textTransform: "uppercase", marginTop: 4 }}>Resolved</div>
                        </div>
                      </div>
                    </div>

                    {/* Predictions — every locked call, tap to open that
                        property's board (your call + The Field) */}
                    {livePreds.length > 0 && (
                      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                        <OverlineLabel>YOUR PREDICTIONS</OverlineLabel>
                        <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, marginTop: 6 }}>Tap a property to see everyone's calls</div>
                        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                          {[...livePreds].reverse().map((pred, idx) => (
                            <button key={idx} onClick={() => openPredictionBoard(pred)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: T.inputBg, borderRadius: 10, border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}>
                              <img src={pred.photo || NO_PHOTO} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} onError={onPhotoError} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {pred.address || resolveNeighborhood(pred)}
                                </div>
                                <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT }}>
                                  {pred.address ? `${resolveNeighborhood(pred)} · ` : ""}{pred.beds}BR/{pred.baths}BA · {(pred.sqft || 0).toLocaleString()}sf
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: FONT, color: T.text }}>{fmt(pred.guess)}</div>
                                <div style={{ fontSize: 10, fontFamily: FONT, fontWeight: 600, color: pred.resolved ? T.green : T.orange }}>
                                  {pred.resolved ? "RESOLVED" : "PENDING"}
                                </div>
                              </div>
                              <Icon name="chevron-right" size={14} style={{ color: T.textTertiary, flexShrink: 0 }} />
                            </button>
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
                                  <div style={{ fontSize: 13, fontWeight: 700, color: T.red, fontFamily: FONT }}>{count} pred{count !== 1 ? "s" : ""}</div>
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
        <div style={{ padding: (IS_MOBILE ? "8px 12px 74px" : "16px 16px 100px"), animation: "ppSlideUp 0.4s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: T.red }}>FOR SALE</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <div onClick={() => setShowMarketSwitcher(true)} style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>{locationLabel || market?.label || "Your Market"} <Icon name="chevron-down" size={12} /></div>
                <span style={{ color: T.textTertiary, fontSize: 13 }}>·</span>
                {/* Surfaces the active type filter — it persists across sessions,
                    so a shrunken pool needs a visible cause. Tap → picker. */}
                <div onClick={() => setView("livePicker")} style={{ fontSize: 13, color: T.red, fontFamily: FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                  {liveHoodName || "All"}{liveTypeSel.length > 0 ? ` · ${liveTypeSel.length === 1 ? liveTypeSel[0] : `${liveTypeSel.length} types`}` : ""} <Icon name="chevron-right" size={12} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {MAP_ENABLED && liveListings.length > 0 && renderListMapToggle(T.red)}
              <StatPill value={`${liveRemaining}`} label="left" color={T.red} />
              <button onClick={async () => {
                const result = await fetchNotifications(playerId, true);
                if (result) { setNotifications(result.notifications || []); setUnreadCount(result.unreadCount || 0); }
                setShowNotifDrawer(true);
              }} style={{
                position: "relative", width: 36, height: 36, borderRadius: 9999,
                background: `${T.accent}12`, border: `1px solid ${T.accent}30`, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Icon name="bell" size={16} style={{ color: T.accent }} />
                {unreadCount > 0 && (
                  <div style={{
                    position: "absolute", top: -2, right: -2, minWidth: 16, height: 16,
                    borderRadius: 8, background: T.red || "#e5484d", color: "#fff",
                    fontSize: 9, fontWeight: 800, fontFamily: FONT,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 4px", border: `2px solid ${T.card}`,
                  }}>{unreadCount > 9 ? "9+" : unreadCount}</div>
                )}
              </button>
            </div>
          </div>
          {/* ── Address search (A3): predict ANY property, not just the pool.
              Rendered in BOTH list and map views (Christo 2026-07-24) — picking
              a result closes the map so the guess card is visible. ── */}
          {!livePrediction && (
            <div style={isDesktop ? { maxWidth: 640, margin: "0 auto 12px" } : { marginBottom: 12 }}>
              <AddressAutocomplete
                T={T}
                stateFormat="short"
                value={liveSearchAddr}
                onChange={(v) => { setLiveSearchAddr(v); if (liveSearchError) setLiveSearchError(null); }}
                onSelect={(v) => { setShowMap(false); handleLiveAddressSelect(v); }}
                onSubmit={(v) => { setShowMap(false); runLiveAddressSearch(v); }}
                localSuggestions={liveListings}
                onSelectLocal={(l) => { setShowMap(false); handleLiveListingSelect(l); }}
                localBadge="For sale"
                proximity={liveProximity}
                placeholder="Search any address…"
                containerStyle={{ marginBottom: 0 }}
                inputStyle={{ width: "100%", boxSizing: "border-box", background: T.inputBg, borderRadius: 9999, border: `1px solid ${T.cardBorder}`, padding: "11px 18px", paddingRight: 40, color: T.text, fontSize: 14, fontWeight: 500, outline: "none", fontFamily: FONT, WebkitAppearance: "none" }}
              />
              {liveSearchLoading && (
                <div style={{ fontSize: 12, color: T.textSecondary, fontFamily: FONT, marginTop: 6, paddingLeft: 4, animation: "ppPulse 1.2s ease infinite" }}>Looking up that property…</div>
              )}
              {liveSearchError && !liveSearchLoading && (
                <div style={{ fontSize: 12, color: T.red, fontFamily: FONT, marginTop: 6, paddingLeft: 4 }}>{liveSearchError}</div>
              )}
              {liveSearchListing && !liveSearchLoading && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingLeft: 4 }}>
                  <div style={{ fontSize: 12, color: T.textSecondary, fontFamily: FONT }}>Showing your search result</div>
                  <button onClick={() => { setLiveSearchListing(null); setLiveSearchAddr(""); setLiveSearchGuessInput(""); setLiveSearchError(null); }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, background: T.inputBg, border: `1px solid ${T.cardBorder}`, borderRadius: 9999, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: T.textSecondary, fontFamily: FONT, cursor: "pointer" }}>
                    <Icon name="x" size={12} /> Back to listings
                  </button>
                </div>
              )}
            </div>
          )}
          {showMap && MAP_ENABLED ? (
            /* ── A4: map of the live pool — pins only, spoiler-free ── */
            <Suspense fallback={mapSuspenseFallback}>
              <PPMapView listings={liveListings} T={T} darkMode={darkMode} activeIdx={liveIdx} onSelect={handleLiveMapSelect} onUnsupported={() => setShowMap(false)} isDesktop={isDesktop} guessedZpids={liveGuessedZpids} />
            </Suspense>
          ) : (<>
          {liveSearchListing && !livePrediction ? (
            <>
              {liveSearchListing.status !== "active" && liveSearchListing.status !== "pending" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: `${T.orange}12`, border: `1px solid ${T.orange}30`, borderRadius: 12, padding: "10px 14px", marginBottom: 10 }}>
                  <Icon name="info" size={14} style={{ color: T.orange, flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: T.text, fontFamily: FONT, lineHeight: 1.4 }}>Off-market: prediction resolves if/when it sells</div>
                </div>
              )}
              {PropertyCard({ listing: liveSearchListing, guess: liveSearchGuessInput, onGuessChange: handleLiveSearchGuessInput, onGuess: handleLiveSearchGuess, badge: "FOR SALE", badgeColor: T.red || "#e5484d", accentColor: T.red || "#e5484d", showExtras: true, showAddress: true, showZillowLink: true, showLastSold: true, labelOverrides: { guessLabel: "Your Prediction", buttonLabel: "Lock In Prediction" }, details: propertyDetails[liveSearchListing?.zpid] || null, isLoadingDetails: detailsLoading === liveSearchListing?.zpid, valuePool: liveListings })}
            </>
          ) : liveListings[liveIdx] && !isLiveGuessed(liveListings[liveIdx]) && !livePrediction ? (
            <>
              {PropertyCard({ listing: liveListings[liveIdx], guess: liveGuessInput, onGuessChange: handleLiveGuessInput, onGuess: handleLiveGuess, badge: "FOR SALE", badgeColor: T.red || "#e5484d", accentColor: T.red || "#e5484d", showExtras: true, showAddress: true, showZillowLink: true, showLastSold: true, labelOverrides: { guessLabel: "Your Prediction", buttonLabel: "Lock In Prediction" }, details: propertyDetails[liveListings[liveIdx]?.zpid] || null, isLoadingDetails: detailsLoading === liveListings[liveIdx]?.zpid, valuePool: liveListings })}
            </>
          ) : livePrediction ? (
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, overflow: "hidden", ...(isDesktop ? { maxWidth: 560, margin: "0 auto" } : {}) }}>
              <img src={livePrediction.photo || NO_PHOTO} alt="" style={{ width: "100%", height: isDesktop ? 240 : 160, objectFit: "cover", display: "block" }} onError={onPhotoError} />
              <div style={{ padding: "20px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: T.accent, marginBottom: 8 }}>PREDICTION LOCKED</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.text, fontFamily: FONT, marginBottom: 12 }}>
                  {livePrediction.beds}BR / {livePrediction.baths}BA · {(livePrediction.sqft || 0).toLocaleString()} sf
                </div>
                <div style={{ background: T.inputBg, padding: "12px 14px", borderRadius: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontFamily: FONT, color: T.textTertiary, marginBottom: 4 }}>Your Prediction</div>
                  <div style={{ fontSize: 24, fontWeight: 800, fontFamily: FONT, color: T.text }}>{fmt(livePrediction.guess)}</div>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1, background: T.inputBg, padding: "10px 12px", borderRadius: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontFamily: FONT, color: T.textTertiary }}>vs List</div>
                    <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FONT, color: livePrediction.vsListPct >= 0 ? T.orange : T.green, marginTop: 2 }}>
                      {livePrediction.vsListPct ? (livePrediction.vsListPct >= 0 ? "+" : "") + livePrediction.vsListPct.toFixed(1) + "%" : "—"}
                    </div>
                  </div>
                  <div style={{ flex: 1, background: T.inputBg, padding: "10px 12px", borderRadius: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontFamily: FONT, color: T.textTertiary }}>Status</div>
                    <div style={{ fontSize: 14, fontWeight: 800, fontFamily: FONT, color: livePrediction.status === "pending" ? T.orange : T.green, marginTop: 2 }}>{(livePrediction.status || "active").toUpperCase()}</div>
                  </div>
                </div>
                {/* Real group scoreboard (replaced a hardcoded fake "68% of players"
                    stat — no-pretend-UI). Solo call gets a group-text nudge instead. */}
                {propCalls && propCalls.count >= 2 && renderCallsBoard(livePrediction.listPrice)}
                <div style={{ padding: "12px", background: `${T.accent}12`, borderRadius: 10, marginBottom: 12, borderLeft: `3px solid ${T.accent}` }}>
                  <div style={{ fontSize: 12, color: T.text, fontFamily: FONT, lineHeight: 1.4 }}>
                    {propCalls && propCalls.count >= 2
                      ? `${propCalls.count} calls locked on this one. Closest to the sold price wins. We'll notify you when it closes.`
                      : "You're the first call on this one. Send it to friends. Closest to the sold price wins. We'll notify you when it closes."}
                  </div>
                </div>
                {renderNotifyCapture()}
                <button onClick={() => shareLiveChallenge(livePrediction, liveListings[liveIdx])} style={{ width: "100%", padding: 14, borderRadius: 9999, border: "none", background: "linear-gradient(135deg, #3B6BF5, #2B4FCE)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 0 20px rgba(59,107,245,0.3)" }}>
                  <Icon name="send" size={16} /> Challenge a Friend
                </button>
                <PillButton onClick={liveNextProperty} secondary>Next Property</PillButton>
              </div>
            </div>
          ) : loading ? (
            /* Fetching active listings — instant feedback so the tap never looks dead */
            <div style={{ textAlign: "center", padding: "48px 20px", ...(isDesktop ? { maxWidth: 480, margin: "0 auto" } : {}) }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: `${T.red}12`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: `1px solid ${T.red}20`, animation: "ppPulse 1.2s ease infinite" }}>
                <Icon name="radio" size={24} style={{ color: T.red }} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8, fontFamily: FONT }}>Finding active listings…</div>
              <div style={{ fontSize: 14, color: T.textSecondary, fontFamily: FONT, lineHeight: 1.5 }}>
                Pulling the latest {liveHoodName || ""} listings in {locationLabel || market?.label || "your market"}.
              </div>
            </div>
          ) : liveListings.length === 0 ? (
            /* No active listings available from the API */
            <div style={{ textAlign: "center", padding: "48px 20px", ...(isDesktop ? { maxWidth: 480, margin: "0 auto" } : {}) }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: `${T.red}12`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: `1px solid ${T.red}20` }}>
                <Icon name="radio" size={24} style={{ color: T.red }} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8, fontFamily: FONT }}>No active listings right now</div>
              <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 8, fontFamily: FONT, lineHeight: 1.5 }}>
                We couldn't find {liveTypeSel.length > 0 ? liveTypeSel.join(" or ").toLowerCase() + " " : ""}
                active or pending listings in {liveHoodName || locationLabel || market?.label || "your market"}.
              </div>
              <div style={{ fontSize: 13, color: T.textTertiary, marginBottom: 24, fontFamily: FONT, lineHeight: 1.5 }}>
                {liveTypeSel.length > 0 ? "The property-type filter may be too narrow." : "New listings drop daily. Check back soon."}
              </div>
              {/* The type filter persists across sessions, so an empty pool is
                  often a filter left on days ago — offer the one-tap escape. */}
              {liveTypeSel.length > 0 && (
                <PillButton onClick={() => { setLiveTypeSel([]); try { localStorage.setItem("pp-live-types", "[]"); } catch { /* ignore */ } enterLiveMode(liveHoodFilter, liveHoodName, []); }}
                  style={{ marginBottom: 10, background: T.red, color: "#fff" }}>Show All Property Types</PillButton>
              )}
              <PillButton onClick={() => setView("fpPicker")} tealAccent style={{ marginBottom: 10 }}>Play Sold Instead</PillButton>
              <PillButton onClick={() => handleTab("daily")} secondary>Back to Daily</PillButton>
            </div>
          ) : (
            /* Went through all available active listings */
            <div style={{ textAlign: "center", padding: "48px 20px", ...(isDesktop ? { maxWidth: 480, margin: "0 auto" } : {}) }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: `${T.green}12`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: `1px solid ${T.green}20` }}>
                <Icon name="check" size={24} style={{ color: T.green }} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8, fontFamily: FONT }}>All caught up!</div>
              <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 24, fontFamily: FONT, lineHeight: 1.5 }}>
                You've locked in predictions on every active listing in {liveHoodName || locationLabel || "this area"}. We'll let you know when they close.
              </div>
              <PillButton onClick={() => setView("livePicker")} style={{ marginBottom: 10, background: T.red, color: "#fff" }}>Try Another Neighborhood</PillButton>
              <PillButton onClick={() => setView("fpPicker")} tealAccent style={{ marginBottom: 10 }}>Play Sold</PillButton>
              <PillButton onClick={() => handleTab("daily")} secondary>Back to Daily</PillButton>
            </div>
          )}
          </>)}
        </div>
      )}

      {/* ═══ LIVE NEIGHBORHOOD PICKER ═══ */}
      {view === "livePicker" && (
        <div style={{ padding: (IS_MOBILE ? "8px 12px 74px" : "16px 16px 100px"), animation: "ppFadeIn 0.4s ease" }}>
          {/* Market switcher pill */}
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => setShowMarketSwitcher(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.inputBg, border: `1px solid ${T.cardBorder}`, borderRadius: 9999, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT, cursor: "pointer" }}>
              <Icon name="map-pin" size={14} /> {market?.label || "Select City"} <Icon name="chevron-down" size={12} />
            </button>
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: T.red, marginBottom: 2 }}>FOR SALE</div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FONT, color: T.text, lineHeight: 1.1 }}>Pick a Neighborhood</div>
            <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 8, fontFamily: FONT }}>Predict sale prices on active listings</div>
          </div>

          {/* Property type multi-select (empty = all types) — mirrors the Sold
              picker, in the For Sale accent. Tapping a neighborhood applies it. */}
          <div style={{ marginBottom: IS_MOBILE ? 14 : 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: T.textTertiary, marginBottom: 8 }}>Property Type</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {FP_TYPE_OPTIONS.map((t) => {
                const on = liveTypeSel.includes(t);
                return (
                  <button key={t} onClick={() => toggleLiveType(t)}
                    style={{ padding: "8px 14px", borderRadius: 9999, border: `1px solid ${on ? T.red : T.cardBorder}`, background: on ? `${T.red}1f` : T.card, color: on ? T.red : T.textSecondary, fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: "pointer", transition: "all 0.15s" }}>
                    {on ? "✓ " : ""}{t}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: T.textTertiary, marginBottom: 8 }}>Neighborhoods</div>
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr 1fr", gap: 12 }}>
            {(LAUNCH_MARKETS.find(m => m.id === market?.id)?.neighborhoods || SF_NEIGHBORHOODS).map((hood, idx) => (
              <button
                key={idx}
                onClick={() => { enterLiveMode(hood.zip, hood.name, liveTypeSel); }}
                style={{
                  padding: "16px", borderRadius: 12, border: `1px solid ${T.cardBorder}`, background: T.card,
                  fontSize: 14, fontWeight: 600, color: T.text, fontFamily: FONT,
                  cursor: "pointer", transition: "all 0.2s",
                  display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
                  minHeight: 56,
                  // "All of <city>" (zip === null) spans the full width across both columns.
                  gridColumn: hood.zip === null ? "1 / -1" : "auto",
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

      {/* ═══ CHALLENGE MODE — Incoming ═══ */}
      {view === "challenge" && challengeData && !challengeResult && (() => {
        // Themed accent: For Sale challenges read red (like the live cards),
        // Sold/Daily read purple. (`accent` from PropertyCard isn't in scope here.)
        const chAccent = challengeData.mode === 'live' ? (T.red || "#e5484d") : (T.purple || "#8b7bf0");
        return (
        <div style={{ padding: (IS_MOBILE ? "8px 12px 74px" : "16px 16px 100px"), animation: "ppSlideUp 0.5s ease-out" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: chAccent }}>CHALLENGE</div>
              <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT }}>
                {challengeData.locationLabel || `${challengeData.listing.city}, ${challengeData.listing.state}`}
                {challengeData.mode === 'daily' ? ` · Daily #${challengeData.dailyNumber}` : challengeData.mode === 'live' ? ' · For Sale' : ' · Sold'}
              </div>
            </div>
          </div>
          <div style={{ background: `linear-gradient(135deg, ${chAccent}12, ${T.purple || "#8b7bf0"}12)`, border: `1px solid ${chAccent}30`, borderRadius: 14, padding: "16px 18px", marginBottom: 16, textAlign: "center" }}>
            {challengeData.mode === 'live' ? (
              <>
                {/* Deliberately hide the friend's number — revealing it here would
                    anchor the guess. Both numbers appear together after you call it. */}
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: FONT, lineHeight: 1.5 }}>
                  A friend made their call on this <span style={{ color: chAccent, fontFamily: FONT, fontWeight: 800 }}>active listing</span>
                </div>
                <div style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT, marginTop: 4 }}>What's your prediction?</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: FONT, lineHeight: 1.5 }}>
                  Someone scored <span style={{ color: chAccent, fontFamily: FONT, fontWeight: 800 }}>{challengeData.challengerAccuracy.toFixed(1)}%</span> on this property
                </div>
                <div style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT, marginTop: 4 }}>Can you beat them?</div>
              </>
            )}
          </div>
          {/* FOR SALE challenges get the FULL live-card experience (photo
              carousel, MLS remarks, value signals, address, Zillow link) via
              lazy-fetched details — it's a public active listing. SOLD
              challenges stay on the token-only card: details/remarks could
              leak the address and let the recipient look up the answer. */}
          {PropertyCard({ listing: challengeData.listing, guess: challengeGuess, onGuessChange: handleChallengeGuessInput, onGuess: handleChallengeGuess, badge: challengeData.mode === 'live' ? "FOR SALE" : "CHALLENGE", badgeColor: challengeData.mode === 'live' ? (T.red || "#e5484d") : (T.purple || "#8b7bf0"), accentColor: challengeData.mode === 'live' ? (T.red || "#e5484d") : (T.purple || "#8b7bf0"), ...(challengeData.mode === 'live' ? { labelOverrides: { guessLabel: "What's your prediction?", buttonLabel: "Lock In Prediction" }, showExtras: true, showAddress: true, showZillowLink: true, showLastSold: true, details: propertyDetails[challengeData.listing.zpid] || null, isLoadingDetails: detailsLoading === challengeData.listing.zpid } : {}) })}
        </div>
        );
      })()}

      {/* ═══ PROPERTY BOARD — a past prediction, reopened from Stats/map ═══ */}
      {boardProp && (
        <div onClick={() => setBoardProp(null)} style={{ position: "fixed", inset: 0, background: "rgba(5,5,5,0.9)", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 210, animation: "ppFadeIn 0.25s ease", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 20, overflow: "hidden", maxWidth: isDesktop ? 520 : 420, width: "100%", maxHeight: "88vh", overflowY: "auto", animation: "ppScaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>
            {boardProp.photo && <img src={boardProp.photo} alt="" style={{ width: "100%", height: isDesktop ? 200 : 150, objectFit: "cover", display: "block" }} onError={onPhotoError} />}
            <div style={{ padding: "18px 20px 20px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: boardProp.resolved ? T.green : T.orange, marginBottom: 6 }}>
                {boardProp.resolved ? "RESOLVED" : "PENDING SALE"}
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, fontFamily: FONT, color: T.text }}>{boardProp.address || resolveNeighborhood(boardProp)}</div>
              <div style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT, marginTop: 3, marginBottom: 14 }}>
                {resolveNeighborhood(boardProp)} · {boardProp.beds}BR/{boardProp.baths}BA · {(boardProp.sqft || 0).toLocaleString()}sf
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <div style={{ flex: 1, background: T.inputBg, padding: "10px 12px", borderRadius: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary }}>List Price</div>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FONT, color: T.text, marginTop: 2 }}>{fmt(boardProp.listPrice)}</div>
                </div>
                {/* guess is null when the pin was guessed on another device and
                    the local prediction record doesn't exist — the board list
                    below still shows your call via the server's `you` flag */}
                {boardProp.guess ? (
                  <div style={{ flex: 1, background: `${T.accent}12`, padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.accent}30` }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontFamily: MONO, color: T.accent }}>Your Call</div>
                    <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FONT, color: T.text, marginTop: 2 }}>{fmt(boardProp.guess)}</div>
                  </div>
                ) : null}
                {boardProp.resolved && boardProp.soldPrice ? (
                  <div style={{ flex: 1, background: `${T.green}12`, padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.green}30` }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontFamily: MONO, color: T.green }}>Sold</div>
                    <div style={{ fontSize: 16, fontWeight: 800, fontFamily: FONT, color: T.text, marginTop: 2 }}>{fmt(boardProp.soldPrice)}</div>
                  </div>
                ) : null}
              </div>
              {boardProp.zpid
                ? (renderCallsBoard(boardProp.listPrice) || (
                    <div style={{ fontSize: 12, color: T.textTertiary, fontFamily: FONT, marginBottom: 14 }}>
                      {propCalls ? "Just your call on this one so far. Send the link to friends." : "Loading the field…"}
                    </div>
                  ))
                : (
                  <div style={{ fontSize: 12, color: T.textTertiary, fontFamily: FONT, marginBottom: 14 }}>
                    This call was made before group scoreboards. The field can't be looked up for it.
                  </div>
                )}
              {!boardProp.resolved && renderNotifyCapture()}
              {!boardProp.resolved && (
                <button onClick={() => shareLiveChallenge(boardProp, boardProp)} style={{ width: "100%", padding: 13, borderRadius: 9999, border: "none", background: "linear-gradient(135deg, #3B6BF5, #2B4FCE)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Icon name="send" size={15} /> Challenge more friends
                </button>
              )}
              <PillButton onClick={() => setBoardProp(null)} secondary>Close</PillButton>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CHALLENGE RESULT ═══ */}
      {view === "challenge" && challengeResult && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(5,5,5,0.95)", backdropFilter: "blur(20px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, animation: "ppFadeIn 0.3s ease", padding: 16 }}>
          {challengeResult.isLive ? (() => {
            // FOR SALE head-to-head: no sold price yet, so we show both calls
            // side by side vs. the list price. Winner is decided by the market.
            const r = challengeResult;
            const accent = T.accent; // "You" tile highlight
            const same = Math.abs((r.guess || 0) - (r.challengerGuess || 0)) < 1;
            const higher = (r.guess || 0) >= (r.challengerGuess || 0);
            const vsStyle = (v) => ({ fontSize: 12, fontWeight: 700, fontFamily: FONT, color: v == null ? T.textTertiary : v >= 0 ? T.orange : T.green, marginTop: 4 });
            const vsText = (v) => v == null ? "—" : `${v >= 0 ? "+" : ""}${v}% vs list`;
            const resetTo = () => { setChallengeData(null); setChallengeResult(null); setChallengeGuess(""); if (market) { if (dailyResult && dailyResult.dailyNumber === dailyNumber) setView("postDaily"); else setView("daily"); } else setView("onboarding"); };
            return (
              <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 24, padding: "28px 22px", maxWidth: isDesktop ? 560 : 420, width: "100%", animation: "ppScaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}>
                <div style={{ textAlign: "center", marginBottom: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary }}>Head to Head</div>
                </div>
                <div style={{ textAlign: "center", fontSize: 13, color: T.textSecondary, fontFamily: FONT, marginBottom: 18 }}>{r.neighborhood ? `${r.neighborhood} · ` : ""}{r.city}{r.state ? `, ${r.state}` : ""}</div>
                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1, background: T.inputBg, border: `1px solid ${accent}55`, borderRadius: 14, padding: "16px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontFamily: MONO, color: accent, marginBottom: 6 }}>You</div>
                    <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FONT, color: T.text }}>{fmt(r.guess)}</div>
                    <div style={vsStyle(r.myVsList)}>{vsText(r.myVsList)}</div>
                  </div>
                  <div style={{ flex: 1, background: T.inputBg, border: `1px solid ${T.cardBorder}`, borderRadius: 14, padding: "16px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary, marginBottom: 6 }}>Your Friend</div>
                    <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FONT, color: T.text }}>{fmt(r.challengerGuess)}</div>
                    <div style={vsStyle(r.theirVsList)}>{vsText(r.theirVsList)}</div>
                  </div>
                </div>
                <div style={{ textAlign: "center", padding: "10px 0", borderTop: `1px solid ${T.cardBorder}`, borderBottom: `1px solid ${T.cardBorder}`, marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary, marginBottom: 3 }}>List Price</div>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: FONT, color: T.text }}>{fmt(r.listPrice)}</div>
                </div>
                {propCalls && propCalls.count > 2 && renderCallsBoard(r.listPrice)}
                <div style={{ textAlign: "center", fontSize: 13, color: T.textSecondary, fontFamily: FONT, lineHeight: 1.5, marginBottom: 18 }}>
                  {same ? "You both made the same call! " : <>You went <b style={{ color: T.text }}>{higher ? "higher" : "lower"}</b> than your friend. </>}We'll tell you who won when it sells, and anyone else with the link can still jump in.
                </div>
                {renderNotifyCapture()}
                {(h2h.wins + h2h.losses + h2h.ties) > 0 && (
                  <div style={{ textAlign: "center", fontSize: 12, fontFamily: FONT, color: T.textTertiary, marginBottom: 14 }}>
                    Your record: <b><span style={{ color: T.green }}>{h2h.wins}</span><span style={{ color: T.textTertiary }}>–</span><span style={{ color: T.red }}>{h2h.losses}</span></b>{h2h.ties > 0 ? ` · ${h2h.ties} tie${h2h.ties === 1 ? "" : "s"}` : ""}
                  </div>
                )}
                <button onClick={() => shareLiveChallenge(r, challengeData.listing)} style={{ width: "100%", padding: 14, borderRadius: 9999, border: "none", background: "linear-gradient(135deg, #3B6BF5, #2B4FCE)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 0 20px rgba(59,107,245,0.3)" }}>
                  <Icon name="send" size={16} /> Challenge another friend
                </button>
                <PillButton onClick={resetTo} secondary>Continue</PillButton>
              </div>
            );
          })() : RevealCard({
            result: challengeResult,
            comparison: { myAccuracy: challengeResult.myAccuracy, challengerAccuracy: challengeResult.challengerAccuracy, challengerGuess: challengeResult.challengerGuess, iWon: challengeResult.iWon },
            onChallenge: (r) => shareChallenge(r, challengeData.listing, challengeData.mode === 'daily'),
            onShare: (r) => shareChallenge(r, challengeData.listing, challengeData.mode === 'daily'),
            onContinue: () => {
              setChallengeData(null); setChallengeResult(null); setChallengeGuess("");
              if (market) { if (dailyResult && dailyResult.dailyNumber === dailyNumber) setView("postDaily"); else setView("daily"); }
              else setView("onboarding");
            },
            onRunNumbersClick: onRunNumbers ? (r) => { onRunNumbers({ price: r.soldPrice, state: r.state, city: r.city, zip: r.zip }); } : null,
          })}
        </div>
      )}

      {/* ═══ FREE PLAY NEIGHBORHOOD PICKER ═══ */}
      {view === "fpPicker" && (
        <div style={{ padding: (IS_MOBILE ? "8px 12px 74px" : "16px 16px 100px"), animation: "ppFadeIn 0.4s ease" }}>
          {/* Market switcher pill */}
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => setShowMarketSwitcher(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.inputBg, border: `1px solid ${T.cardBorder}`, borderRadius: 9999, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT, cursor: "pointer" }}>
              <Icon name="map-pin" size={14} /> {market?.label || "Select City"} <Icon name="chevron-down" size={12} />
            </button>
          </div>
          <div style={{ marginBottom: IS_MOBILE ? 14 : 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: T.cyan, marginBottom: 2 }}>SOLD</div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FONT, color: T.text, lineHeight: 1.1 }}>Pick Your Comps</div>
            <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 8, fontFamily: FONT }}>Select one or more neighborhoods and property types, then hit Play</div>
          </div>

          {/* Property type multi-select (empty = all types) */}
          <div style={{ marginBottom: IS_MOBILE ? 14 : 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: T.textTertiary, marginBottom: 8 }}>Property Type</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {FP_TYPE_OPTIONS.map((t) => {
                const on = fpTypeSel.includes(t);
                return (
                  <button key={t} onClick={() => toggleFpType(t)}
                    style={{ padding: "8px 14px", borderRadius: 9999, border: `1px solid ${on ? T.cyan : T.cardBorder}`, background: on ? "rgba(6,182,212,0.12)" : T.card, color: on ? T.cyan : T.textSecondary, fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: "pointer", transition: "all 0.15s" }}>
                    {on ? "\u2713 " : ""}{t}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: T.textTertiary, marginBottom: 8 }}>Neighborhoods</div>
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr 1fr", gap: IS_MOBILE ? 8 : 12 }}>
            {(LAUNCH_MARKETS.find(m => m.id === market?.id)?.neighborhoods || SF_NEIGHBORHOODS).map((hood, idx) => {
              // "All of <city>" clears the selection and plays immediately.
              if (hood.zip === null) return (
                <button key={idx} onClick={() => { setFpHoodSel([]); enterFreePlay([]); }}
                  style={{ padding: IS_MOBILE ? "12px" : "16px", borderRadius: 12, border: `1px solid ${T.cardBorder}`, background: T.card, fontSize: 14, fontWeight: 600, color: T.text, fontFamily: FONT, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: IS_MOBILE ? 46 : 56, gridColumn: "1 / -1" }}
                  onMouseEnter={(e) => { e.target.style.background = T.inputBg; e.target.style.borderColor = T.accent; }}
                  onMouseLeave={(e) => { e.target.style.background = T.card; e.target.style.borderColor = T.cardBorder; }}>
                  {hood.name}
                </button>
              );
              const on = fpHoodSel.includes(hood.name);
              return (
                <button key={idx}
                  onClick={() => setFpHoodSel(prev => on ? prev.filter(n => n !== hood.name) : [...prev, hood.name])}
                  style={{ padding: IS_MOBILE ? "12px" : "16px", borderRadius: 12, border: `1px solid ${on ? T.cyan : T.cardBorder}`, background: on ? "rgba(6,182,212,0.12)" : T.card, fontSize: 14, fontWeight: 600, color: on ? T.cyan : T.text, fontFamily: FONT, cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: IS_MOBILE ? 46 : 56 }}>
                  {on ? "\u2713 " : ""}{hood.name}
                </button>
              );
            })}
          </div>

          {/* Play with the current selection */}
          <div style={{ marginTop: 16 }}>
            <PillButton tealAccent onClick={() => {
              const list = LAUNCH_MARKETS.find(m => m.id === market?.id)?.neighborhoods || SF_NEIGHBORHOODS;
              const hoods = list.filter(h => h.zip !== null && fpHoodSel.includes(h.name));
              enterFreePlay(hoods);
            }}>
              {fpHoodSel.length === 0 ? `Play All of ${market?.city || "the City"}`
                : fpHoodSel.length === 1 ? `Play ${fpHoodSel[0]}`
                : `Play ${fpHoodSel.length} Neighborhoods`}
            </PillButton>
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
        <div style={{ padding: (IS_MOBILE ? "8px 12px 74px" : "16px 16px 100px"), animation: "ppSlideUp 0.4s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: T.cyan }}>SOLD</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <div onClick={() => setShowMarketSwitcher(true)} style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>{locationLabel || market?.label || "Your Market"} <Icon name="chevron-down" size={12} /></div>
                <span style={{ color: T.textTertiary, fontSize: 13 }}>·</span>
                <div onClick={() => setView("fpPicker")} style={{ fontSize: 13, color: T.cyan, fontFamily: FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}>{fpSelectedNeighborhood || "All"} <Icon name="chevron-right" size={12} /></div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {MAP_ENABLED && fpListings.length > 0 && renderListMapToggle(T.cyan)}
              <StatPill value={`${Math.max(0, fpListings.length - fpIdx - 1)}${fpHasMore && fpZipRef.current ? "+" : ""}`} label="left" color={T.cyan} />
            </div>
          </div>
          {showMap && MAP_ENABLED ? (
            /* ── A4: map of the freeplay pool — pins only, soldPrice never rendered ── */
            <Suspense fallback={mapSuspenseFallback}>
              <PPMapView listings={fpListings} T={T} darkMode={darkMode} activeIdx={fpIdx} onSelect={handleFpMapSelect} onUnsupported={() => setShowMap(false)} isDesktop={isDesktop} />
            </Suspense>
          ) : fpListings[fpIdx] && !fpResult ? (
            <>
              {PropertyCard({ listing: fpListings[fpIdx], guess: fpGuessInput, onGuessChange: handleFpGuessInput, onGuess: handleFpGuess, badge: "SOLD", badgeColor: T.cyan, accentColor: T.cyan, showExtras: true, showAddress: true, showSoldDate: true, details: propertyDetails[fpListings[fpIdx]?.zpid] || null, isLoadingDetails: detailsLoading === fpListings[fpIdx]?.zpid, valuePool: fpListings })}
            </>
          ) : fpResult ? (
            RevealCard({ result: fpResult, onContinue: fpNextProperty,
              onChallenge: (r) => shareChallenge(r, fpListings[fpIdx], false),
              priceRead: renderPriceRead(fpListings[fpIdx], fpListings, propertyDetails[fpListings[fpIdx]?.zpid] || null, T),
              onRunNumbersClick: onRunNumbers ? (r) => { onRunNumbers({ price: r.soldPrice, state: r.state, city: r.city, zip: r.zip }); } : null })
          ) : (
            <div style={{ textAlign: "center", padding: "60px 20px", ...(isDesktop ? { maxWidth: 480, margin: "0 auto" } : {}) }}>
              {fpHasMore && fpZipRef.current ? (
                <>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: `${T.cyan}12`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: `1px solid ${T.cyan}20` }}>
                    <Icon name="plus" size={24} style={{ color: T.cyan }} />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8, fontFamily: FONT }}>
                    {fpListings.length > 0 ? "Nice run!" : "Loading properties..."}
                  </div>
                  <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 24, fontFamily: FONT, lineHeight: 1.5 }}>
                    {fpListings.length > 0
                      ? `You've guessed ${fpListings.length} properties. Load more for ${fpSelectedNeighborhood || "this area"}.`
                      : `Finding properties in ${fpSelectedNeighborhood || "this area"}...`}
                  </div>
                  <PillButton
                    onClick={() => fetchMoreSoldComps(fpZipRef.current)}
                    accent
                    style={{ marginBottom: 12 }}
                  >
                    {fpLoadingMore ? "Loading..." : "Load More Properties"}
                  </PillButton>
                  <div style={{ marginTop: 12 }}>
                    <button onClick={() => setView("fpPicker")} style={{ background: "none", border: "none", color: T.textTertiary, fontSize: 12, cursor: "pointer", fontFamily: FONT, padding: "8px 16px" }}>
                      Pick Another Neighborhood
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: `${T.green}12`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: `1px solid ${T.green}20` }}>
                    <Icon name="check" size={24} style={{ color: T.green }} />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8, fontFamily: FONT }}>All caught up!</div>
                  <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 24, fontFamily: FONT, lineHeight: 1.5 }}>
                    You've guessed all {fpListings.length} available properties{fpSelectedNeighborhood ? ` in ${fpSelectedNeighborhood}` : ""}.
                  </div>
                  <PillButton onClick={() => setView("fpPicker")} accent>Try Another Neighborhood</PillButton>
                  <div style={{ marginTop: 12 }}>
                    <button onClick={() => setView("postDaily")} style={{ background: "none", border: "none", color: T.textTertiary, fontSize: 12, cursor: "pointer", fontFamily: FONT, padding: "8px 16px" }}>
                      Back to Home
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ LEADERBOARD (with mode + time tabs) ═══ */}
      {view === "leaderboard" && (
        <div style={{ padding: (IS_MOBILE ? "8px 12px 74px" : "16px 16px 100px"), animation: "ppFadeIn 0.3s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: T.accent }}>LEADERBOARD</div>
              <div onClick={() => setShowMarketSwitcher(true)} style={{ fontSize: 13, color: T.textSecondary, marginTop: 2, fontFamily: FONT, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>{locationLabel || market?.label || "Your Market"} <Icon name="chevron-down" size={12} /></div>
            </div>
          </div>

          {/* Mode Toggle: Daily / Free / Live */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[
              { id: "daily", label: "Daily", color: T.accent },
              { id: "free", label: "Sold", color: T.cyan },
              { id: "live", label: "For Sale", color: T.red },
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
                flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, fontFamily: FONT,
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

            // Build from pp_leaderboard_v2 rows, which carry a true `rank` and
            // already include our own row (via p_player_id) even outside the top 20.
            const serverEntries = (lbData || []).map(row => ({
              rank: row.rank != null ? Number(row.rank) : null,
              name: row.player_id === playerId ? "You" : (row.display_name || `Player ${(row.player_id || '').slice(0, 4)}`),
              role: "",
              accuracy: row.avg_pct_off != null ? parseFloat((100 - row.avg_pct_off).toFixed(1)) : 0,
              count: row.guess_count || 0,
              isYou: row.player_id === playerId,
            }));
            const youInServer = serverEntries.some(e => e.isYou);

            // Local "You" fallback: we've guessed but haven't hit the period minimum
            // to rank yet — show ourselves (rankless) so the board is never just empty.
            const entries = [...serverEntries];
            if (!youInServer && userCount > 0) {
              entries.push({ rank: null, name: "You", role: "", accuracy: userAccuracy, count: userCount, isYou: true });
            }
            const sorted = [...entries].sort((a, b) => {
              if (a.rank != null && b.rank != null) return a.rank - b.rank;
              if (a.rank != null) return -1;
              if (b.rank != null) return 1;
              return b.accuracy - a.accuracy;
            });

            if (lbLoading) {
              return (
                <div style={{ textAlign: "center", padding: 40, color: T.textTertiary, fontFamily: FONT, fontSize: 13 }}>
                  Loading leaderboard...
                </div>
              );
            }

            // Empty-state CTA — never show a bare "nobody here" board (CMO).
            if (sorted.length === 0) {
              const cta = leaderboardMode === "free" ? { label: "Play Sold", view: "fpPicker" }
                : leaderboardMode === "live" ? { label: "Make a prediction", view: "livePicker" }
                : { label: "Play today’s daily", view: "daily" };
              return (
                <div style={{ textAlign: "center", padding: "36px 24px", color: T.textTertiary, fontFamily: FONT, background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16 }}>
                  <div style={{ marginBottom: 12, color: modeColor }}><Icon name="award" size={32} /></div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>
                    No rankings yet{leaderboardTab === "today" ? " today" : ""}
                  </div>
                  <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 18 }}>Make a guess to claim the top spot.</div>
                  <button onClick={() => setView(cta.view)} style={{ padding: "12px 24px", borderRadius: 9999, border: "none", background: "linear-gradient(135deg, #3B6BF5, #2B4FCE)", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: FONT, cursor: "pointer", boxShadow: "0 0 20px rgba(59,107,245,0.3)" }}>
                    {cta.label}
                  </button>
                </div>
              );
            }

            return (
              <>
                {sorted.map((entry, i) => {
                  const displayRank = entry.rank != null ? entry.rank : i + 1;
                  const medalIdx = (entry.rank != null ? entry.rank : i + 1) - 1; // 0-based, for medals
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: entry.isYou ? `${modeColor}12` : T.card, border: `1px solid ${entry.isYou ? `${modeColor}30` : T.cardBorder}`, borderRadius: 14, marginBottom: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, fontFamily: FONT,
                        background: medalIdx === 0 ? "linear-gradient(135deg, #d98a0b, #D97706)" : medalIdx === 1 ? "linear-gradient(135deg, #A1A1A1, #737373)" : medalIdx === 2 ? "linear-gradient(135deg, #D97706, #92400E)" : T.inputBg,
                        color: medalIdx < 3 ? "#fff" : T.textSecondary }}>{displayRank}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: entry.isYou ? modeColor : T.text, fontFamily: FONT }}>{entry.name}</div>
                        {entry.role && <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT }}>{entry.role}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: FONT, color: entry.isYou ? modeColor : T.green }}>{entry.accuracy}%</div>
                        <div style={{ fontSize: 10, fontFamily: FONT, color: T.textTertiary }}>{entry.count} {modeLabel}</div>
                      </div>
                    </div>
                  );
                })}
              </>
            );
          })()}

          <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: T.textTertiary, padding: 16, background: T.card, borderRadius: 14, border: `1px solid ${T.cardBorder}`, fontFamily: FONT }}>
            {leaderboardMode === "daily" ? "Leaderboard updates daily at midnight. Play more dailies to climb."
              : leaderboardMode === "free" ? "Sold rankings based on accuracy across all rounds."
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
              { id: "free", label: "Sold", icon: "play" },
              { id: "live", label: "For Sale", icon: "radio" },
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
                  <span style={{ fontSize: 10, fontWeight: 600, fontFamily: FONT, letterSpacing: 0.5 }}>{tab.label}</span>
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
            <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, marginTop: 6 }}>
              {nicknameInput.length}/20
            </div>
            <button
              onClick={handleSaveNickname}
              disabled={nicknameInput.trim().length < 2 || nicknameSaving}
              style={{
                width: "100%", padding: "12px 0", marginTop: 16, fontSize: 15, fontWeight: 700,
                fontFamily: FONT, borderRadius: 9999, border: "none", cursor: "pointer",
                background: nicknameInput.trim().length >= 2 ? "linear-gradient(135deg, #3B6BF5, #2B4FCE)" : T.inputBg,
                color: nicknameInput.trim().length >= 2 ? "#fff" : T.textTertiary,
                opacity: nicknameSaving ? 0.6 : 1,
                boxShadow: nicknameInput.trim().length >= 2 ? "0 0 20px rgba(59,107,245,0.3)" : "none",
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

      {/* ═══ NOTIFICATION DRAWER ═══ */}
      {showNotifDrawer && (
        <div onClick={() => setShowNotifDrawer(false)} style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 300,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: isDesktop ? "center" : "flex-end", justifyContent: "center",
          padding: isDesktop ? 20 : 0, boxSizing: "border-box",
          animation: "ppFadeIn 0.2s ease",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: isDesktop ? 20 : "20px 20px 0 0", padding: "24px 20px 32px",
            maxWidth: 420, width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column",
            border: `1px solid ${T.cardBorder}`, borderBottom: isDesktop ? `1px solid ${T.cardBorder}` : "none",
            animation: isDesktop ? "ppScaleIn 0.3s ease" : "ppSlideUp 0.3s ease",
          }}>
            {!isDesktop && <div style={{ width: 40, height: 4, borderRadius: 2, background: T.cardBorder, margin: "0 auto 20px", flexShrink: 0 }} />}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: T.accent }}>NOTIFICATIONS</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {unreadCount > 0 && (
                  <button onClick={async () => {
                    await markNotificationsRead(playerId);
                    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                    setUnreadCount(0);
                  }} style={{
                    fontSize: 11, fontWeight: 600, color: T.accent, background: `${T.accent}12`,
                    border: `1px solid ${T.accent}30`, borderRadius: 8, padding: "4px 10px",
                    cursor: "pointer", fontFamily: FONT,
                  }}>Mark all read</button>
                )}
                <button aria-label="Notification settings" onClick={async () => {
                  setShowNotifDrawer(false);
                  const prefs = await getNotificationPreferences(playerId);
                  if (prefs) { setNotifPrefs(prefs); setNotifEmailInput(prefs.email || ''); setNotifPhoneInput(prefs.phone || ''); }
                  setShowNotifSettings(true);
                }} style={{
                  fontSize: 11, fontWeight: 600, color: T.textSecondary, background: T.inputBg,
                  border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: "4px 10px",
                  cursor: "pointer", fontFamily: FONT,
                }}>
                  <Icon name="settings" size={12} />
                </button>
              </div>
            </div>
            <div style={{ overflowY: "auto", WebkitOverflowScrolling: "touch", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {notifications.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <Icon name="bell-off" size={32} style={{ color: T.textTertiary, marginBottom: 12 }} />
                  <div style={{ fontSize: 14, color: T.textSecondary, fontFamily: FONT }}>No notifications yet</div>
                  <div style={{ fontSize: 12, color: T.textTertiary, fontFamily: FONT, marginTop: 4 }}>
                    When your Live predictions resolve, you'll see them here.
                  </div>
                </div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} onClick={async () => {
                    if (!n.read) {
                      await markNotificationsRead(playerId, [n.id]);
                      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                      setUnreadCount(prev => Math.max(0, prev - 1));
                    }
                  }} style={{
                    padding: "12px 14px", borderRadius: 12,
                    background: n.read ? T.inputBg : `${T.accent}08`,
                    border: `1px solid ${n.read ? T.cardBorder : `${T.accent}20`}`,
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT, marginBottom: 4 }}>{n.title}</div>
                        <div style={{ fontSize: 12, color: T.textSecondary, fontFamily: FONT, lineHeight: 1.5 }}>{n.body}</div>
                        <div style={{ fontSize: 10, color: T.textTertiary, fontFamily: FONT, marginTop: 6, letterSpacing: 1 }}>
                          {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                      </div>
                      {!n.read && (
                        <div style={{ width: 8, height: 8, borderRadius: 4, background: T.accent, flexShrink: 0, marginTop: 4 }} />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ NOTIFICATION SETTINGS ═══ */}
      {showNotifSettings && (
        <div onClick={() => setShowNotifSettings(false)} style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 300,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20, animation: "ppFadeIn 0.2s ease",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 380,
            border: `1px solid ${T.cardBorder}`, animation: "ppScaleIn 0.3s ease",
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: T.accent, marginBottom: 4 }}>NOTIFICATION SETTINGS</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: FONT, marginBottom: 20 }}>How do you want to be notified?</div>

            {/* Toggle: In-App (always on) */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${T.cardBorder}` }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: T.text, fontFamily: FONT }}>In-App Alerts</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.green || "#12a150", fontFamily: FONT }}>ALWAYS ON</div>
            </div>

            {/* Toggle: Email */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${T.cardBorder}` }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: T.text, fontFamily: FONT }}>Email</div>
              <button onClick={async () => {
                const newVal = !notifPrefs.email_enabled;
                setNotifPrefs(p => ({ ...p, email_enabled: newVal }));
                await updateNotificationPreferences(playerId, { email_enabled: newVal });
              }} style={{
                width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                background: notifPrefs.email_enabled ? (T.green || "#12a150") : T.inputBg,
                position: "relative", transition: "background 0.2s",
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 9, background: "#fff",
                  position: "absolute", top: 3,
                  left: notifPrefs.email_enabled ? 23 : 3,
                  transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </button>
            </div>
            {notifPrefs.email_enabled && (
              <div style={{ padding: "8px 0 12px" }}>
                <input
                  type="email" placeholder="your@email.com"
                  value={notifEmailInput}
                  onChange={e => setNotifEmailInput(e.target.value)}
                  onBlur={async () => {
                    if (notifEmailInput && notifEmailInput.includes('@')) {
                      await updateNotificationPreferences(playerId, { email: notifEmailInput });
                      setNotifPrefs(p => ({ ...p, email: notifEmailInput }));
                    }
                  }}
                  style={{
                    width: "100%", padding: "10px 14px", fontSize: 14, fontFamily: FONT,
                    background: T.inputBg, color: T.text, border: `1px solid ${T.cardBorder}`,
                    borderRadius: 10, outline: "none", boxSizing: "border-box",
                  }}
                  onFocus={e => e.target.style.borderColor = T.accent}
                />
              </div>
            )}

            {/* Toggle: SMS */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${T.cardBorder}` }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: T.text, fontFamily: FONT }}>SMS</div>
              <button onClick={async () => {
                const newVal = !notifPrefs.sms_enabled;
                setNotifPrefs(p => ({ ...p, sms_enabled: newVal }));
                await updateNotificationPreferences(playerId, { sms_enabled: newVal });
              }} style={{
                width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                background: notifPrefs.sms_enabled ? (T.green || "#12a150") : T.inputBg,
                position: "relative", transition: "background 0.2s",
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 9, background: "#fff",
                  position: "absolute", top: 3,
                  left: notifPrefs.sms_enabled ? 23 : 3,
                  transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </button>
            </div>
            {notifPrefs.sms_enabled && (
              <div style={{ padding: "8px 0 12px" }}>
                <input
                  type="tel" placeholder="+1 (555) 123-4567"
                  value={notifPhoneInput}
                  onChange={e => setNotifPhoneInput(e.target.value)}
                  onBlur={async () => {
                    if (notifPhoneInput && notifPhoneInput.length >= 10) {
                      await updateNotificationPreferences(playerId, { phone: notifPhoneInput });
                      setNotifPrefs(p => ({ ...p, phone: notifPhoneInput }));
                    }
                  }}
                  style={{
                    width: "100%", padding: "10px 14px", fontSize: 14, fontFamily: FONT,
                    background: T.inputBg, color: T.text, border: `1px solid ${T.cardBorder}`,
                    borderRadius: 10, outline: "none", boxSizing: "border-box",
                  }}
                  onFocus={e => e.target.style.borderColor = T.accent}
                />
              </div>
            )}

            {/* Toggle: Push (web push — iOS Safari needs the installed PWA) */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: pushSupported() ? T.text : T.textTertiary, fontFamily: FONT }}>Push Notifications</div>
                {!pushSupported() && (
                  <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, marginTop: 2 }}>On iPhone: add Blueprint to your Home Screen first</div>
                )}
              </div>
              {pushSupported() ? (
                <button onClick={async () => {
                  if (notifPrefs.push_enabled) {
                    setNotifPrefs(p => ({ ...p, push_enabled: false }));
                    await disablePush(playerId);
                    await updateNotificationPreferences(playerId, { push_enabled: false });
                  } else {
                    const r = await enablePush(playerId); // registers token; server flips push_enabled
                    if (r.ok) setNotifPrefs(p => ({ ...p, push_enabled: true }));
                  }
                }} style={{
                  width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                  background: notifPrefs.push_enabled ? (T.green || "#12a150") : T.inputBg,
                  position: "relative", transition: "background 0.2s",
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 9, background: "#fff",
                    position: "absolute", top: 3,
                    left: notifPrefs.push_enabled ? 23 : 3,
                    transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </button>
              ) : (
                <div style={{ width: 44, height: 24, borderRadius: 12, background: T.inputBg, opacity: 0.5 }} />
              )}
            </div>

            <button onClick={() => setShowNotifSettings(false)} style={{
              width: "100%", marginTop: 16, padding: "14px", borderRadius: 9999,
              background: "linear-gradient(135deg, #3B6BF5, #2B4FCE)", color: "#fff",
              fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: FONT,
            }}>Done</button>
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
            maxWidth: 420, width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column",
            border: `1px solid ${T.cardBorder}`, borderBottom: "none",
            animation: "ppSlideUp 0.3s ease",
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: T.cardBorder, margin: "0 auto 20px", flexShrink: 0 }} />
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", fontFamily: FONT, color: T.accent, marginBottom: 4, flexShrink: 0 }}>SWITCH MARKET</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: FONT, marginBottom: 20, flexShrink: 0 }}>Choose your city</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", WebkitOverflowScrolling: "touch", flex: 1, minHeight: 0, paddingBottom: 8 }}>
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
                      background: isActive ? "linear-gradient(135deg, #3B6BF5, #2B4FCE)" : T.inputBg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: isActive ? "#fff" : T.textTertiary,
                      border: isActive ? "none" : `1px solid ${T.cardBorder}`,
                    }}>
                      <Icon name={m.icon} size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: isActive ? T.text : T.textSecondary, fontFamily: FONT }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT, letterSpacing: 1, marginTop: 1 }}>{m.neighborhoods.length - 1} neighborhoods</div>
                    </div>
                    {isActive && (
                      <div style={{ fontSize: 10, fontWeight: 700, fontFamily: FONT, color: T.accent, background: `${T.accent}18`, padding: "3px 8px", borderRadius: 6, letterSpacing: 1 }}>ACTIVE</div>
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
              fontFamily: FONT, color: T.accent, marginBottom: 4 }}>LEVEL ROADMAP</div>
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
                    background: unlocked ? "linear-gradient(135deg, #3B6BF5, #2B4FCE)" : T.inputBg,
                    color: unlocked ? "#fff" : T.textTertiary,
                  }}>
                    <Icon name={lvl.icon} size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: unlocked ? T.text : T.textTertiary, fontFamily: FONT }}>
                      Lv.{lvl.level}: {lvl.name}
                    </div>
                    <div style={{ fontSize: 11, color: T.textTertiary, fontFamily: FONT }}>{lvl.req} XP required</div>
                  </div>
                  {isCurrent && (
                    <div style={{ fontSize: 10, fontWeight: 700, fontFamily: FONT, color: T.accent,
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
              background: "linear-gradient(135deg, #3B6BF5, #2B4FCE)", color: "#fff",
              fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: FONT,
            }}>Got It</button>
          </div>
        </div>
      )}
    </div>
  );
}
