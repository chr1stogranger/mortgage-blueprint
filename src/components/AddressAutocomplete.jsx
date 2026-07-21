// src/components/AddressAutocomplete.jsx — address typeahead.
//
// Extracted from MortgageBlueprint.jsx (feature A3) so PricePoint's Live-mode
// "search any address" can reuse it. Three suggestion sources, in priority
// order — the first one available wins:
//
//   1. Google Places, IF window.google.maps.places is present. As of
//      2026-07-21 the app still never loads the Maps script
//      (window.__GOOGLE_PLACES_KEY__ is "" in main.jsx), so this branch is
//      dormant; it stays because the wiring is free and correct.
//   2. Mapbox Geocoding v6 (VITE_MAPBOX_TOKEN — the same public token
//      PPMapView already uses), rendered as our OWN dropdown. This is the
//      path that actually runs in production (added 2026-07-21). Debounced
//      250ms, min 4 chars, per-session query cache, aborts in-flight
//      requests — a typed address costs ~3–4 geocoding calls.
//   3. `localSuggestions` — caller-supplied rows already in memory (PricePoint
//      passes its loaded LIVE listings). Zero network, always ranked first,
//      and picking one skips the /api/propertydetails round-trip entirely
//      because the caller already holds the full listing.
//
// If none are available this renders as a plain text input and `onSubmit`
// (Enter / icon tap) submits the raw typed text — the free-text path that
// PricePoint's /api/propertydetails?address= resolves server-side.
//
// Props:
//   onSelect({ address, city, state, zip, county })
//       fired when the user picks a Places/Mapbox suggestion
//   onSubmit(text)
//       optional — fired on Enter / icon tap with the raw input text
//   value / onChange — controlled input text
//   T          — caller's theme token object (Blueprint's `T` or PricePoint's
//                `T` prop — both share the token names from src/lib/theme.js)
//   label      — optional node rendered above the input (Blueprint passes its
//                FieldLabel; PricePoint passes nothing)
//   inputStyle / containerStyle — style overrides (PricePoint: pill search)
//   stateFormat — "full" (default, Blueprint behavior: "CA" → "California")
//                 or "short" (keep the 2-letter code — what APIs want)
//   localSuggestions — optional [{ address, city, state, zip, ... }] matched
//                 client-side and shown above the geocoder results
//   onSelectLocal(item) — fired when one of those is picked (falls back to
//                 onSelect when omitted)
//   localBadge — short tag rendered on local rows (e.g. "FOR SALE")
//   proximity  — optional { lat, lng } to bias geocoder results to the market

import React, { useRef, useEffect, useState, useCallback } from "react";
import { FONT } from "../lib/fonts.js";
import Icon from "../Icon";

// ─── Mapbox geocoder (source 2) ───
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";
const MIN_QUERY = 4;      // "12 A" — below this every query is noise
const DEBOUNCE_MS = 250;
// Per-session query→results cache. Backspacing through an address re-issues
// queries we already paid for; this makes those free.
const geoCache = new Map();

// Mapbox v6 feature → the same {address, city, state, zip, county} shape the
// Places branch produces, plus display strings.
function featureToSuggestion(f) {
  const p = f?.properties || {};
  const c = p.context || {};
  const street = c.address?.name
    || [c.address?.address_number, c.street?.name].filter(Boolean).join(" ").trim()
    || p.name || "";
  return {
    id: p.mapbox_id || f?.id || `${street}|${p.place_formatted || ""}`,
    address: street,
    city: c.place?.name || c.locality?.name || "",
    state: c.region?.region_code || "",
    zip: c.postcode?.name || "",
    county: (c.district?.name || "").replace(/ County$/i, ""),
    primary: p.name || street,
    secondary: p.place_formatted || "",
  };
}

// "123 Main St, San Francisco, CA 94110" — what both the geocoder path and the
// local-listing path put into the input, and what the server resolver wants.
export function formatFullAddress(s) {
  return [s.address, s.city, [s.state, s.zip].filter(Boolean).join(" ").trim()]
    .filter(Boolean).join(", ");
}

// Local rows (PricePoint's loaded live listings) matched on the street line.
// Token-based so "main st 94110" and "123 main" both hit.
function matchLocal(items, query) {
  const q = query.trim().toLowerCase();
  if (!q || !Array.isArray(items)) return [];
  const tokens = q.split(/[\s,]+/).filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const it of items) {
    if (!it || !it.address) continue;
    const hay = [it.address, it.city, it.state, it.zip].filter(Boolean).join(" ").toLowerCase();
    if (!tokens.every(t => hay.includes(t))) continue;
    const key = `${it.zpid || ""}|${it.address}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
    if (out.length >= 3) break;
  }
  return out;
}

const STATE_MAP = { "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "DC": "District of Columbia", "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland", "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming" };

export default function AddressAutocomplete({ onSelect, onSubmit, value, onChange, placeholder, T, label = null, inputStyle = null, containerStyle = null, stateFormat = "full", localSuggestions = null, onSelectLocal = null, localBadge = null, proximity = null }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [ready, setReady] = useState(false);
  // Our own dropdown (Mapbox + local rows). Unused when Places is `ready` —
  // Google renders its own attached listbox and we must not double up.
  const [geoSugs, setGeoSugs] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const abortRef = useRef(null);
  // Set when WE wrote the input value (a pick). Stops the debounce effect from
  // immediately re-querying the address the user just chose.
  const skipNextRef = useRef(false);

  // Wait for the Google Maps script, then attach Autocomplete. If the script
  // never loads (the current production state), give up quietly after 20s —
  // the plain input + onSubmit path keeps working.
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40; // 40 × 500ms = 20s
    function tryInit() {
      if (cancelled) return;
      if (window.google && window.google.maps && window.google.maps.places) {
        if (inputRef.current && !autocompleteRef.current) {
          const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
            types: ["address"],
            componentRestrictions: { country: "us" },
            fields: ["address_components", "formatted_address"],
          });
          ac.addListener("place_changed", () => {
            const place = ac.getPlace();
            if (!place || !place.address_components) return;
            const get = (type) => {
              const comp = place.address_components.find(c => c.types.includes(type));
              return comp ? comp.long_name : "";
            };
            const getShort = (type) => {
              const comp = place.address_components.find(c => c.types.includes(type));
              return comp ? comp.short_name : "";
            };
            // Build full street address from components
            const streetNum = get("street_number");
            const route = get("route");
            const street = [streetNum, route].filter(Boolean).join(" ");
            const result = {
              address: street || place.formatted_address || "",
              city: get("locality") || get("sublocality_level_1") || get("administrative_area_level_3") || "",
              state: stateFormat === "short"
                ? (getShort("administrative_area_level_1") || "")
                : (get("administrative_area_level_1") || ""),
              zip: get("postal_code") || "",
              county: (get("administrative_area_level_2") || "").replace(/ County$/i, ""),
            };
            // Blueprint mode: convert a 2-letter abbreviation to the full name
            if (stateFormat === "full" && result.state.length === 2) result.state = STATE_MAP[result.state] || result.state;
            onSelect && onSelect(result);
          });
          autocompleteRef.current = ac;
          setReady(true);
        }
        return;
      }
      attempts++;
      if (attempts < maxAttempts) setTimeout(tryInit, 500);
    }
    tryInit();
    return () => {
      cancelled = true;
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const text = typeof value === "string" ? value : "";
  const localMatches = ready ? [] : matchLocal(localSuggestions, text);
  const rows = ready ? [] : [
    ...localMatches.map(item => ({ kind: "local", item })),
    ...geoSugs.map(s => ({ kind: "geo", item: s })),
  ];

  // ─── Mapbox suggestions: debounced, cached, abortable ───
  useEffect(() => {
    if (ready || !MAPBOX_TOKEN) return;            // Places wins; no token → plain input
    const q = text.trim();
    if (skipNextRef.current) { skipNextRef.current = false; return; }
    if (q.length < MIN_QUERY) { setGeoSugs([]); return; }

    const cached = geoCache.get(q.toLowerCase());
    if (cached) { setGeoSugs(cached); setHighlight(-1); return; }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const params = new URLSearchParams({
          q, access_token: MAPBOX_TOKEN, autocomplete: "true",
          country: "us", types: "address", limit: "5", language: "en",
        });
        if (proximity?.lat && proximity?.lng) params.set("proximity", `${proximity.lng},${proximity.lat}`);
        const resp = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`, { signal: ctrl.signal });
        if (!resp.ok) return;
        const data = await resp.json();
        const sugs = (data?.features || []).map(featureToSuggestion).filter(s => s.address);
        geoCache.set(q.toLowerCase(), sugs);
        if (geoCache.size > 120) geoCache.delete(geoCache.keys().next().value);
        setGeoSugs(sugs);
        setHighlight(-1);
      } catch {
        /* aborted or offline — keep whatever is on screen */
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, ready, proximity?.lat, proximity?.lng]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const closeList = useCallback(() => { setOpen(false); setHighlight(-1); }, []);

  const pick = (row) => {
    skipNextRef.current = true;
    closeList();
    setGeoSugs([]);
    if (row.kind === "local") {
      onChange(formatFullAddress(row.item));
      if (onSelectLocal) onSelectLocal(row.item);
      else if (onSelect) onSelect(row.item);
      return;
    }
    const sel = { ...row.item };
    if (stateFormat === "full" && sel.state.length === 2) sel.state = STATE_MAP[sel.state] || sel.state;
    onChange(formatFullAddress(sel));
    onSelect && onSelect(sel);
  };

  const submit = () => {
    const t = text.trim();
    if (onSubmit && t) onSubmit(t);
  };

  const onKeyDown = (e) => {
    const listOpen = open && rows.length > 0;
    if (e.key === "ArrowDown" && listOpen) {
      e.preventDefault();
      setHighlight(h => (h + 1) % rows.length);
    } else if (e.key === "ArrowUp" && listOpen) {
      e.preventDefault();
      setHighlight(h => (h <= 0 ? rows.length - 1 : h - 1));
    } else if (e.key === "Escape") {
      closeList();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (listOpen && highlight >= 0) pick(rows[highlight]);
      else { closeList(); submit(); }
    }
  };

  return (
    <div style={containerStyle || { marginBottom: 14 }}>
      {label}
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          // Delay so a mousedown on a row still lands before the list unmounts
          // (touch devices fire blur first).
          onBlur={() => setTimeout(closeList, 150)}
          role="combobox"
          aria-expanded={open && rows.length > 0}
          aria-autocomplete="list"
          enterKeyHint={onSubmit ? "search" : undefined}
          placeholder={placeholder || "Start typing an address..."}
          autoComplete="off"
          style={inputStyle || { width: "100%", boxSizing: "border-box", background: T.inputBg, borderRadius: 12, border: `1px solid ${T.inputBorder || T.cardBorder}`, padding: "12px 14px", paddingRight: 36, color: T.text, fontSize: 15, outline: "none", fontFamily: FONT, WebkitAppearance: "none" }}
        />
        <span
          onClick={onSubmit ? submit : undefined}
          style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", display: "inline-flex", alignItems: "center", color: T.textSecondary, opacity: 0.55, pointerEvents: onSubmit ? "auto" : "none", cursor: onSubmit ? "pointer" : "default" }}
        >
          <Icon name={ready ? "map-pin" : "search"} size={16} />
        </span>

        {/* ── Suggestion dropdown (local listings first, then geocoder) ── */}
        {open && rows.length > 0 && (
          <div
            role="listbox"
            style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 60,
              background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14,
              overflow: "hidden", boxShadow: "0 12px 32px rgba(0,0,0,0.28)",
            }}
          >
            {rows.map((row, i) => {
              const isLocal = row.kind === "local";
              const primary = isLocal ? row.item.address : row.item.primary;
              const secondary = isLocal
                ? [row.item.city, [row.item.state, row.item.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")
                : row.item.secondary;
              return (
                <div
                  key={`${row.kind}-${isLocal ? (row.item.zpid || row.item.address) : row.item.id}`}
                  role="option"
                  aria-selected={highlight === i}
                  onMouseDown={e => { e.preventDefault(); pick(row); }}
                  onMouseEnter={() => setHighlight(i)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                    cursor: "pointer", background: highlight === i ? T.inputBg : "transparent",
                    borderTop: i === 0 ? "none" : `1px solid ${T.cardBorder}`,
                  }}
                >
                  <Icon name={isLocal ? "home" : "map-pin"} size={14} style={{ color: isLocal ? (T.red || T.accent) : T.textTertiary, flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{primary}</div>
                    {secondary && (
                      <div style={{ fontSize: 11, color: T.textSecondary, fontFamily: FONT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{secondary}</div>
                    )}
                  </div>
                  {isLocal && localBadge && (
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", fontFamily: FONT, color: T.red || T.accent, background: `${T.red || T.accent}14`, border: `1px solid ${T.red || T.accent}30`, borderRadius: 9999, padding: "2px 7px", flexShrink: 0 }}>{localBadge}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {!ready && window.__GOOGLE_PLACES_KEY__ && (
        <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 4, fontFamily: FONT }}>Loading address suggestions...</div>
      )}
    </div>
  );
}
