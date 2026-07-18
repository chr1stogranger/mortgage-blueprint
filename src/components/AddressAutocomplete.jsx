// src/components/AddressAutocomplete.jsx — Google Places address typeahead.
//
// Extracted from MortgageBlueprint.jsx (feature A3) so PricePoint's Live-mode
// "search any address" can reuse it. Blueprint and PricePoint render inside
// the same shell, so if the Google Maps/Places script is present it is present
// for both. IMPORTANT REALITY CHECK: as of 2026-07-17 the app does NOT load
// the Maps script anywhere (window.__GOOGLE_PLACES_KEY__ is "" in main.jsx),
// so the Places enhancement never activates and this renders as a plain text
// input. That is why `onSubmit` exists: pressing Enter (or tapping the icon)
// submits the raw typed text, so callers that can resolve a free-text address
// server-side (PricePoint's /api/pp-address) work with or without Places.
//
// Props:
//   onSelect({ address, city, state, zip, county })
//       fired when the user picks a Places suggestion (needs the Maps script)
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

import React, { useRef, useEffect, useState } from "react";
import { FONT } from "../lib/fonts.js";
import Icon from "../Icon";

const STATE_MAP = { "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "DC": "District of Columbia", "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland", "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming" };

export default function AddressAutocomplete({ onSelect, onSubmit, value, onChange, placeholder, T, label = null, inputStyle = null, containerStyle = null, stateFormat = "full" }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [ready, setReady] = useState(false);

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

  const submit = () => {
    const text = typeof value === "string" ? value.trim() : "";
    if (onSubmit && text) onSubmit(text);
  };

  return (
    <div style={containerStyle || { marginBottom: 14 }}>
      {label}
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
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
      </div>
      {!ready && window.__GOOGLE_PLACES_KEY__ && (
        <div style={{ fontSize: 10, color: T.textTertiary, marginTop: 4, fontFamily: FONT }}>Loading address suggestions...</div>
      )}
    </div>
  );
}
