import { FONT, MONO } from "../lib/fonts.js";
import React, { useEffect, useRef, useState } from "react";
import { apiUrl } from "../apiBase.js";

/**
 * PricePointTeaser — a real for-sale home in the Blueprint's own ZIP, pitched
 * as a PricePoint guess (Christo 2026-10-01: "add a card for a current home in
 * the zip code the user plugged in"). Price is never shown; that's the game.
 *
 * Cost control: /api/pricepoint is cached server-side (L1 + pp_city_cache +
 * 10-min edge), and this card keeps the listings per ZIP in localStorage for
 * 24h, so it's at most one request per ZIP per device per day. One home a day
 * per ZIP (picked by date), so the card doesn't reshuffle on every render.
 *
 * Swipe it sideways (or tap ×) to hide it for the rest of the day.
 */
const DAY = new Date().toISOString().slice(0, 10);
const CACHE_KEY = (zip) => `bp_pp_teaser_${zip}`;
const HIDE_KEY = "bp_pp_teaser_hidden";

function readCache(zip) {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY(zip)) || "null");
    if (raw && Date.now() - raw.at < 24 * 3600 * 1000 && Array.isArray(raw.listings)) return raw.listings;
  } catch { /* ignore */ }
  return null;
}

export default function PricePointTeaser({ T, zip, city, onPlay, style }) {
  const [home, setHome] = useState(null);
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(HIDE_KEY) === DAY; } catch { return false; } });
  const [dx, setDx] = useState(0);
  const startX = useRef(null);

  useEffect(() => {
    if (hidden || !/^\d{5}$/.test(zip || "")) { setHome(null); return; }
    let cancelled = false;
    const pick = (listings) => {
      const withPhoto = listings.filter(l => l && l.photo && l.zpid);
      if (!withPhoto.length) return null;
      const seed = [...(DAY + zip)].reduce((a, c) => a + c.charCodeAt(0), 0);
      return withPhoto[seed % withPhoto.length];
    };
    const cached = readCache(zip);
    if (cached) { setHome(pick(cached)); return; }
    // Defer so the card never competes with the Blueprint's first paint.
    const t = setTimeout(() => {
      fetch(apiUrl(`/api/pricepoint?zip=${zip}${city ? `&city=${encodeURIComponent(city)}` : ""}`))
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (cancelled || !d) return;
          const listings = (d.activeListings || []).slice(0, 40).map(l => ({ zpid: l.zpid, photo: l.photo, beds: l.beds, baths: l.baths, sqft: l.sqft, neighborhood: l.neighborhood, city: l.city }));
          try { localStorage.setItem(CACHE_KEY(zip), JSON.stringify({ at: Date.now(), listings })); } catch { /* quota */ }
          setHome(pick(listings));
        })
        .catch(() => {});
    }, 1500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [zip, city, hidden]);

  if (hidden || !home) return null;
  const hide = () => { try { localStorage.setItem(HIDE_KEY, DAY); } catch { /* ignore */ } setHidden(true); };
  const where = home.neighborhood || home.city || city || zip;
  const spec = [home.beds ? `${home.beds} bd` : null, home.baths ? `${home.baths} ba` : null, home.sqft ? `${Number(home.sqft).toLocaleString("en-US")} sq ft` : null].filter(Boolean).join(" · ");
  const accent = T.purple || "#7c4dff";

  return (
    <div
      onPointerDown={(e) => { if (e.target.closest("button")) return; startX.current = e.clientX; e.currentTarget.setPointerCapture?.(e.pointerId); }}
      onPointerMove={(e) => { if (startX.current !== null) setDx(e.clientX - startX.current); }}
      onPointerUp={() => { if (startX.current === null) return; startX.current = null; if (Math.abs(dx) > 80) hide(); else setDx(0); }}
      onPointerCancel={() => { startX.current = null; setDx(0); }}
      title="Swipe to dismiss"
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 16,
        background: `linear-gradient(135deg, ${accent}, ${T.blue})`, color: "#fff", fontFamily: FONT,
        boxShadow: T.cardShadow, touchAction: "pan-y", userSelect: "none",
        transform: `translateX(${dx}px)`, opacity: Math.max(0.3, 1 - Math.abs(dx) / 240),
        transition: startX.current !== null ? "none" : "transform 0.18s ease, opacity 0.18s ease", ...style,
      }}>
      <img src={home.photo} alt="" loading="lazy" draggable={false}
        style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover", flexShrink: 0, background: "rgba(255,255,255,0.2)" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.15em", textTransform: "uppercase", opacity: 0.85 }}>PricePoint · for sale near you</div>
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.25, marginTop: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>Guess this home in {where}</div>
        {spec && <div style={{ fontSize: 11.5, opacity: 0.9, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{spec}</div>}
      </div>
      <button type="button" onClick={onPlay}
        style={{ flexShrink: 0, background: "#fff", color: T.blue, border: "none", borderRadius: 9999, padding: "7px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>Guess</button>
      <button type="button" onClick={hide} aria-label="Hide for today"
        style={{ flexShrink: 0, alignSelf: "flex-start", background: "none", border: "none", color: "rgba(255,255,255,0.8)", fontSize: 15, lineHeight: 1, cursor: "pointer", padding: "0 2px" }}>×</button>
    </div>
  );
}
