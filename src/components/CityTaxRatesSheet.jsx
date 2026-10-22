import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FONT, MONO } from "../lib/fonts.js";
import Icon from "../Icon";
import BottomSheet from "../BottomSheet";
import { CA_TAX_COUNTIES, CA_TAX_CURRENT_FY, CA_TAX_STALE_COUNTIES, BAY_AREA_COUNTIES, CA_CITY_TAX_INFO } from "../data/caTaxRates.js";
import { CA_TAX_BILL_LOOKUP } from "../data/caTaxBillLookup.js";
import { caCityTaxUrl, caCountyTaxUrl, CA_TAX_HUB_URL } from "../lib/seoPaths.js";

// ── All cities' rates (Christo 2026-10-22) ──
// Opened from "Base Rate (City)" in the Tax breakdown. Lists every sourced
// California city rate by county, Bay Area first, so a borrower can see how
// their city stacks up. Each county carries its own fiscal year: mid-refresh
// some are still on last year's book, and those rows say so.

const BAY = new Set(BAY_AREA_COUNTIES);
const ALL = CA_TAX_COUNTIES.flatMap((c) =>
 Object.entries(c.rates).map(([city, pct]) => ({ city, pct, county: c.county, fy: c.fy })),
);
const LO = Math.min(...ALL.map((x) => x.pct));
const HI = Math.max(...ALL.map((x) => x.pct));
// Bars start at the 1% Prop 13 floor, so their length is the voter-approved part.
const FLOOR = Math.min(1, LO);
const countyLabel = (county) => (county === "San Francisco" ? "San Francisco" : `${county} County`);
const fmtPct = (pct) => `${pct.toFixed(4)}%`;
const median = (xs) => {
 const s = [...xs].sort((a, b) => a - b);
 const m = Math.floor(s.length / 2);
 return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Links out to the public SEO pages (Christo 2026-10-22). Absolute production
// URLs, opened in a new tab / the system browser like the tax-bill links.
const outLink = (T, href, children, style) => (
 <a href={href} target="_blank" rel="noopener noreferrer"
  style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, fontFamily: FONT, color: T.blue, textDecoration: "none", ...style }}>
  {children} <Icon name="external-link" size={11} />
 </a>
);

const SORTS = [["county", "By county"], ["low", "Lowest first"], ["high", "Highest first"]];

function FyChip({ fy, T }) {
 const stale = fy !== CA_TAX_CURRENT_FY;
 return (
  <span title={stale ? `The county hasn't published FY ${CA_TAX_CURRENT_FY} rates yet` : undefined}
   style={{ fontSize: 9, fontWeight: 600, fontFamily: MONO, letterSpacing: "0.06em", whiteSpace: "nowrap",
    color: stale ? T.orange : T.textTertiary, border: `1px solid ${stale ? `${T.orange}66` : T.separator}`,
    borderRadius: 9999, padding: "1px 6px", lineHeight: "14px" }}>
   FY {fy}
  </span>
 );
}

function RateRow({ x, T, mine, showCounty, rowRef }) {
 const w = Math.max(2, ((x.pct - FLOOR) / (HI - FLOOR)) * 100);
 return (
  <div ref={rowRef} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", margin: "0 -8px", borderRadius: 10,
   background: mine ? `${T.blue}1f` : "transparent" }}>
   <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ fontSize: 13, fontWeight: mine ? 700 : 500, color: mine ? T.blue : T.text, fontFamily: FONT,
     overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
     {x.city}{mine && <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", marginLeft: 6 }}>YOU</span>}
    </div>
    {showCounty && (
     <div style={{ fontSize: 10, color: T.textTertiary, fontFamily: FONT, display: "flex", gap: 6, alignItems: "center", marginTop: 1 }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{countyLabel(x.county)}</span>
      {x.fy !== CA_TAX_CURRENT_FY && <FyChip fy={x.fy} T={T} />}
     </div>
    )}
   </div>
   <div aria-hidden style={{ width: 72, height: 6, borderRadius: 3, background: T.ringTrack, flexShrink: 0, overflow: "hidden" }}>
    <div style={{ width: `${w}%`, height: "100%", borderRadius: 3, background: T.blue, opacity: mine ? 1 : 0.45 }} />
   </div>
   <span style={{ width: 66, textAlign: "right", fontSize: 13, fontWeight: 600, fontFamily: FONT, color: mine ? T.blue : T.text, flexShrink: 0 }}>
    {fmtPct(x.pct)}
   </span>
  </div>
 );
}

export default function CityTaxRatesSheet({ T, isOpen, onClose, city, county }) {
 const info = CA_CITY_TAX_INFO[city] || null;
 const myCounty = info?.county || (county || "").replace(/ County$/, "");
 const [sort, setSort] = useState("county");
 const [query, setQuery] = useState("");
 const [open, setOpen] = useState({});
 const myRowRef = useRef(null);

 useEffect(() => {
  if (!isOpen) return;
  setQuery("");
  setSort("county");
  setOpen({});
  const t = setTimeout(() => myRowRef.current?.scrollIntoView({ block: "nearest" }), 320);
  return () => clearTimeout(t);
 }, [isOpen]);

 const q = query.trim().toLowerCase();
 const matches = (x) => !q || x.city.toLowerCase().includes(q) || x.county.toLowerCase().includes(q);

 const rank = useMemo(() => {
  if (!info) return null;
  const lower = ALL.filter((x) => x.pct < info.pct).length;
  return { lower, higher: ALL.filter((x) => x.pct > info.pct).length };
 }, [info]);

 const isOpenCounty = (c) => (q ? true : open[c] ?? (BAY.has(c) || c === myCounty));
 const toggle = (c) => setOpen((o) => ({ ...o, [c]: !isOpenCounty(c) }));

 const groupHead = (label) => (
  <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: T.textTertiary, margin: "18px 0 6px" }}>{label}</div>
 );

 const countyBlock = (c) => {
  const rows = Object.entries(c.rates).map(([cityName, pct]) => ({ city: cityName, pct, county: c.county, fy: c.fy })).filter(matches)
   .sort((a, b) => a.city.localeCompare(b.city));
  if (!rows.length) return null;
  const pcts = rows.map((r) => r.pct);
  const mineCounty = c.county === myCounty;
  const expanded = isOpenCounty(c.county);
  return (
   <div key={c.county} style={{ borderRadius: 14, border: `1px solid ${mineCounty ? `${T.blue}66` : T.separator}`, background: T.card, marginBottom: 8, overflow: "hidden" }}>
    <button type="button" onClick={() => toggle(c.county)} aria-expanded={expanded}
     style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: FONT }}>
     <Icon name={expanded ? "chevron-down" : "chevron-right"} size={14} style={{ color: T.textTertiary, flexShrink: 0 }} />
     <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{countyLabel(c.county)}</span>
      <FyChip fy={c.fy} T={T} />
      {mineCounty && <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", color: T.blue }}>YOUR COUNTY</span>}
     </span>
     <span style={{ fontSize: 11, color: T.textTertiary, whiteSpace: "nowrap", flexShrink: 0 }}>
      {rows.length === 1 ? fmtPct(rows[0].pct) : `${Math.min(...pcts).toFixed(2)}–${Math.max(...pcts).toFixed(2)}%`}
     </span>
    </button>
    {expanded && (
     <div style={{ padding: "0 12px 8px" }}>
      {rows.map((x) => {
       const mine = x.city === city && !!info;
       return <RateRow key={x.city} x={x} T={T} mine={mine} rowRef={mine ? myRowRef : undefined} />;
      })}
      {caCountyTaxUrl(c.county) && <div style={{ marginTop: 6 }}>{outLink(T, caCountyTaxUrl(c.county), `${countyLabel(c.county)} rates and due dates`)}</div>}
      {CA_TAX_BILL_LOOKUP[c.county]?.url && (
       <a href={CA_TAX_BILL_LOOKUP[c.county].url} target="_blank" rel="noopener noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: T.blue, marginTop: 6, textDecoration: "none" }}>
        Look up your {countyLabel(c.county)} tax bill <Icon name="external-link" size={11} />
       </a>
      )}
      {c.url && (
       <a href={c.url} target="_blank" rel="noopener noreferrer"
        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: T.textTertiary, marginTop: 6, textDecoration: "none" }}>
        Source: {c.source} <Icon name="external-link" size={10} />
       </a>
      )}
     </div>
    )}
   </div>
  );
 };

 const flat = sort === "county" ? null : ALL.filter(matches).sort((a, b) => (sort === "low" ? a.pct - b.pct : b.pct - a.pct) || a.city.localeCompare(b.city));
 const bay = CA_TAX_COUNTIES.filter((c) => BAY.has(c.county)).sort((a, b) => BAY_AREA_COUNTIES.indexOf(a.county) - BAY_AREA_COUNTIES.indexOf(b.county));
 const rest = CA_TAX_COUNTIES.filter((c) => !BAY.has(c.county)).sort((a, b) => a.county.localeCompare(b.county));
 const bayBlocks = bay.map(countyBlock).filter(Boolean);
 const restBlocks = rest.map(countyBlock).filter(Boolean);

 const sheet = (
  <BottomSheet isOpen={isOpen} onClose={onClose} title="Property tax by city" T={T} height="88vh">
   <div style={{ fontFamily: FONT }}>
    <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5 }}>
     Base rate for each city's main tax area: the 1% Prop 13 levy plus voter-approved bonds. Mello-Roos and parcel taxes are extra.
    </div>

    {info ? (
     <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, border: `1px solid ${T.blue}66`, background: T.card }}>
      <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: T.blue }}>YOUR CITY</div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
       <span style={{ fontSize: 17, fontWeight: 700, color: T.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{city}</span>
       <span style={{ fontSize: 17, fontWeight: 700, color: T.blue }}>{fmtPct(info.pct)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4, fontSize: 11, color: T.textSecondary }}>
       <span>{countyLabel(info.county)}</span><FyChip fy={info.fy} T={T} />
      </div>
      <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 8, lineHeight: 1.5 }}>
       {rank.higher >= rank.lower
        ? <>Lower than <b style={{ color: T.text }}>{rank.higher}</b> of the {ALL.length} cities listed.</>
        : <>Higher than <b style={{ color: T.text }}>{rank.lower}</b> of the {ALL.length} cities listed.</>}
       {" "}Median: {fmtPct(median(ALL.map((x) => x.pct)))}.
      </div>
      {caCityTaxUrl(city) && <div style={{ marginTop: 8 }}>{outLink(T, caCityTaxUrl(city), `${city} property tax page`)}</div>}
     </div>
    ) : city ? (
     <div style={{ marginTop: 12, fontSize: 12, color: T.textSecondary, lineHeight: 1.5 }}>
      {city} isn't in the county rate books listed here, so its Base Rate is an estimate. Unlock the rate to enter the one on the tax bill.
     </div>
    ) : null}

    <div style={{ position: "relative", marginTop: 14 }}>
     <Icon name="search" size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textTertiary, pointerEvents: "none" }} />
     <input className="mkt-filter-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a city or county" aria-label="Find a city or county"
      style={{ "--mkt-ph": T.textTertiary, width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 32px", borderRadius: 9999, border: `1px solid ${T.inputBorder}`,
       background: T.inputBg, color: T.text, fontSize: 14, fontFamily: FONT, outline: "none" }} />
    </div>

    <div role="radiogroup" aria-label="Sort" style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
     {SORTS.map(([k, label]) => (
      <button key={k} type="button" role="radio" aria-checked={sort === k} onClick={() => setSort(k)}
       style={{ padding: "5px 12px", borderRadius: 9999, fontSize: 11, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
        background: sort === k ? `${T.blue}22` : T.inputBg, border: sort === k ? `1px solid ${T.blue}` : `1px solid ${T.separator}`,
        color: sort === k ? T.blue : T.textSecondary }}>
       {label}
      </button>
     ))}
    </div>

    {CA_TAX_STALE_COUNTIES.length > 0 && (
     <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 10, lineHeight: 1.5 }}>
      Rates are FY {CA_TAX_CURRENT_FY} where the county has published them. Counties with an <span style={{ color: T.orange }}>orange year</span> haven't yet ({CA_TAX_STALE_COUNTIES.length} of {CA_TAX_COUNTIES.length}); they update as they publish.
     </div>
    )}

    {flat ? (
     <div style={{ marginTop: 12 }}>
      {flat.map((x) => {
       const mine = x.city === city && !!info;
       return <RateRow key={x.city} x={x} T={T} mine={mine} showCounty rowRef={mine ? myRowRef : undefined} />;
      })}
      {!flat.length && <div style={{ fontSize: 12, color: T.textTertiary, padding: "16px 0" }}>No city matches "{query}".</div>}
     </div>
    ) : (
     <>
      {bayBlocks.length > 0 && <>{groupHead("BAY AREA")}{bayBlocks}</>}
      {restBlocks.length > 0 && <>{groupHead("REST OF CALIFORNIA")}{restBlocks}</>}
      {!bayBlocks.length && !restBlocks.length && <div style={{ fontSize: 12, color: T.textTertiary, padding: "16px 0" }}>No city matches "{query}".</div>}
     </>
    )}

    <div style={{ marginTop: 14 }}>{outLink(T, CA_TAX_HUB_URL, "Every California city's rate, with sources", { fontSize: 12 })}</div>

    <div style={{ fontSize: 10, color: T.textTertiary, lineHeight: 1.5, marginTop: 10 }}>
     Source: each county's published tax rate book (San Francisco: the Treasurer's secured rate). Other tax areas in the same city can differ; the property's tax bill is the final word.
    </div>
   </div>
  </BottomSheet>
 );
 return typeof document !== "undefined" ? createPortal(sheet, document.body) : sheet;
}
