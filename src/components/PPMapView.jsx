// ── PPMapView (A4) — map view for PricePoint Free Play / Live pools ──
// Lazy-loaded (React.lazy in PricePoint.jsx) so mapbox-gl (~1.5 MB) lands in
// its own chunk and never touches the core game bundle. Mounted ONLY while the
// map toggle is open.
//
// Guessing-game rule: NO PRICES anywhere on this map — pins and popups show
// address + beds/baths/sqft + thumbnail only. soldPrice/listPrice must never
// render here, even though freeplay listings carry soldPrice in memory.
import React, { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { FONT } from "../lib/fonts.js";

const DARK_STYLE = "mapbox://styles/mapbox/dark-v11";
const LIGHT_STYLE = "mapbox://styles/mapbox/light-v11";

export default function PPMapView({ listings, T, darkMode, onSelect, activeIdx, onUnsupported, isDesktop }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  // Keep callbacks fresh without re-initializing the map.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onUnsupportedRef = useRef(onUnsupported);
  onUnsupportedRef.current = onUnsupported;

  // Listings with usable coordinates, PAIRED with their index in the ORIGINAL
  // array — onSelect(idx) must land on the same card fpIdx/liveIdx point at,
  // so we never renumber, we only skip un-mappable entries (no NaN into Mapbox).
  const mappable = useMemo(
    () =>
      (listings || [])
        .map((l, i) => ({ l, i, lat: Number(l?.latitude), lng: Number(l?.longitude) }))
        .filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng)),
    [listings]
  );

  // ── Map init (once per mount) ──
  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token || !containerRef.current) return undefined;
    mapboxgl.accessToken = token;
    let map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: darkMode ? DARK_STYLE : LIGHT_STYLE,
        center: [-122.4376, 37.7577],
        zoom: 10,
        attributionControl: false,
      });
    } catch (e) {
      // Old devices without WebGL: quiet warn, hand control back to the list.
      console.warn("[PPMapView] Map init failed (WebGL unavailable?) — falling back to list.", e);
      if (onUnsupportedRef.current) onUnsupportedRef.current();
      return undefined;
    }
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    mapRef.current = map;
    // Spec: keep the canvas in sync with its container (sidebar/keyboard resizes).
    const ro = new ResizeObserver(() => { try { map.resize(); } catch { /* mid-teardown */ } });
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Theme flips restyle in place ──
  useEffect(() => {
    if (mapRef.current) mapRef.current.setStyle(darkMode ? DARK_STYLE : LIGHT_STYLE);
  }, [darkMode]);

  // ── Markers (rebuilt when pool / active card / theme changes) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    const accent = T.accent || "#3B6BF5";
    const ring = T.cyan || "#38c6c6";

    mappable.forEach(({ l, i, lat, lng }) => {
      const active = i === activeIdx;
      const size = active ? 26 : 18;
      const el = document.createElement("div");
      el.style.cssText = [
        `width:${size}px`, `height:${size}px`, "border-radius:9999px",
        `background:${accent}`, "border:2px solid #fff",
        `box-shadow:0 1px 6px rgba(0,0,0,0.35)${active ? `,0 0 0 4px ${ring}` : ""}`,
        "cursor:pointer", "display:flex", "align-items:center", "justify-content:center",
        "box-sizing:border-box",
      ].join(";");
      const dot = document.createElement("div");
      dot.style.cssText = `width:${active ? 7 : 5}px;height:${active ? 7 : 5}px;border-radius:9999px;background:#fff;`;
      el.appendChild(dot);

      // Popup — spoiler-free: address + specs + thumbnail. NO prices.
      const pop = document.createElement("div");
      pop.style.cssText = `font-family:${FONT};max-width:210px;`;
      if (l.photo) {
        const img = document.createElement("img");
        img.src = l.photo;
        img.alt = "";
        img.loading = "lazy";
        img.style.cssText = "width:100%;height:92px;object-fit:cover;border-radius:8px;display:block;margin-bottom:8px;";
        img.onerror = () => img.remove();
        pop.appendChild(img);
      }
      const addr = document.createElement("div");
      addr.textContent = l.address || l.neighborhood || l.city || "Address unavailable";
      addr.style.cssText = `font-size:13px;font-weight:600;color:${T.text};line-height:1.3;margin-bottom:3px;`;
      pop.appendChild(addr);
      const specs = document.createElement("div");
      const bits = [];
      if (l.beds != null) bits.push(`${l.beds}BR`);
      if (l.baths != null) bits.push(`${l.baths}BA`);
      if (l.sqft) bits.push(`${Number(l.sqft).toLocaleString()} sf`);
      specs.textContent = bits.join(" · ");
      specs.style.cssText = `font-size:12px;color:${T.textSecondary};margin-bottom:9px;`;
      pop.appendChild(specs);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Guess this one";
      btn.style.cssText = [
        "width:100%", "border:none", "border-radius:9999px", "padding:8px 14px",
        `background:${accent}`, "color:#fff", "font-size:12px", "font-weight:700",
        `font-family:${FONT}`, "cursor:pointer",
      ].join(";");
      btn.addEventListener("click", () => { if (onSelectRef.current) onSelectRef.current(i); });
      pop.appendChild(btn);

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup({ offset: 16, maxWidth: "230px" }).setDOMContent(pop))
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [mappable, activeIdx, T, darkMode]);

  // ── Frame the pool: fitBounds for many, flyTo for one ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mappable.length === 0) return;
    if (mappable.length === 1) {
      map.flyTo({ center: [mappable[0].lng, mappable[0].lat], zoom: 14, duration: 600 });
    } else {
      const bounds = new mapboxgl.LngLatBounds();
      mappable.forEach(({ lat, lng }) => bounds.extend([lng, lat]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 600 });
    }
  }, [mappable]);

  return (
    <div className="pp-map-wrap" style={{ position: "relative", borderRadius: 16, overflow: "hidden", border: `1px solid ${T.cardBorder}` }}>
      {/* Theme the Mapbox popup chrome to match T (scoped to this wrapper). */}
      <style>{`
        .pp-map-wrap .mapboxgl-popup-content { background: ${T.card}; color: ${T.text}; border-radius: 12px; padding: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
        .pp-map-wrap .mapboxgl-popup-anchor-top .mapboxgl-popup-tip,
        .pp-map-wrap .mapboxgl-popup-anchor-top-left .mapboxgl-popup-tip,
        .pp-map-wrap .mapboxgl-popup-anchor-top-right .mapboxgl-popup-tip { border-bottom-color: ${T.card}; }
        .pp-map-wrap .mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip,
        .pp-map-wrap .mapboxgl-popup-anchor-bottom-left .mapboxgl-popup-tip,
        .pp-map-wrap .mapboxgl-popup-anchor-bottom-right .mapboxgl-popup-tip { border-top-color: ${T.card}; }
        .pp-map-wrap .mapboxgl-popup-anchor-left .mapboxgl-popup-tip { border-right-color: ${T.card}; }
        .pp-map-wrap .mapboxgl-popup-anchor-right .mapboxgl-popup-tip { border-left-color: ${T.card}; }
        .pp-map-wrap .mapboxgl-popup-close-button { color: ${T.textSecondary}; font-size: 16px; right: 4px; top: 2px; }
      `}</style>
      <div ref={containerRef} style={{ width: "100%", height: isDesktop ? "min(68vh, 640px)" : "min(62vh, 520px)", minHeight: 320 }} />
      {mappable.length === 0 && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: T.card, color: T.textSecondary, fontFamily: FONT, fontSize: 14, textAlign: "center", padding: 20,
        }}>
          No mappable listings in this pool — switch back to the list.
        </div>
      )}
    </div>
  );
}
