// api/_agent.js — listing agent + "local or out of town" for PricePoint's
// RealTalk block (Christo 2026-10-09). Not a route (underscore file).
//
// Zillow's attributionInfo gives the agent's name, brokerage, phone and DRE
// license — but no office address. For California licenses the DRE public
// lookup lists the licensee's address (their office, not the brokerage HQ),
// which the free Census geocoder turns into a point. Rule: LOCAL when that
// office is in the listing's city or within 5 miles of the home.
// Outside California (no DRE), or when a lookup fails, `local` is null and
// the card just names the agent — it never guesses.

const LOCAL_MILES = 5;
const officeCache = new Map(); // license digits → { city, state, zip, lat, lng } | null

const milesBetween = (a, b) => {
  const R = 3958.8, toRad = (x) => x * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const titleCase = (s) => String(s || "").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

async function fetchText(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 (PricePoint listing-agent lookup)" } });
    return r.ok ? await r.text() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

async function dreOffice(licenseDigits) {
  if (officeCache.has(licenseDigits)) return officeCache.get(licenseDigits);
  let office = null;
  const html = await fetchText(`https://www2.dre.ca.gov/PublicASP/pplinfo.asp?License_id=${licenseDigits}`, 6000);
  if (html) {
    const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
    const m = text.match(/Mailing Address:\s*(.+?)\s+License ID:/i);
    const addr = m ? m[1].trim() : null;
    // DRE runs street and city together ("117 GREENWICH STREET SAN FRANCISCO,
    // CA 94111"), so the city comes from the geocoder's matched address
    // ("117 GREENWICH ST, SAN FRANCISCO, CA, 94111").
    const tail = addr && addr.match(/,\s*([A-Z]{2})\s+(\d{5})/);
    if (tail) {
      office = { city: null, state: tail[1], zip: tail[2], lat: null, lng: null };
      const geo = await fetchText(`https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(addr)}&benchmark=Public_AR_Current&format=json`, 6000);
      try {
        const m0 = JSON.parse(geo || "{}")?.result?.addressMatches?.[0];
        const c = m0?.coordinates;
        if (c && Number.isFinite(c.y) && Number.isFinite(c.x)) { office.lat = c.y; office.lng = c.x; }
        const city = String(m0?.matchedAddress || "").split(",")[1];
        if (city && city.trim()) office.city = titleCase(city.trim());
      } catch { /* no geocode → no city, no distance */ }
    }
  }
  if (officeCache.size > 500) officeCache.clear();
  officeCache.set(licenseDigits, office);
  return office;
}

/**
 * @param d  raw provider property object (Zillow shape)
 * @param home { lat, lng, city, state } of the listing
 * @returns { name, brokerage, phone, license, office: {city,state}|null, miles, local } | null
 */
export async function listingAgent(d, home) {
  const ai = d?.attributionInfo || {};
  const la = Array.isArray(ai.listingAgents) ? ai.listingAgents[0] : null;
  const name = ai.agentName || la?.memberFullName || null;
  const brokerage = ai.brokerName || d?.brokerageName || null;
  if (!name && !brokerage) return null;
  const license = ai.agentLicenseNumber || la?.memberStateLicense || null;
  const agent = { name, brokerage, phone: ai.agentPhoneNumber || null, license, office: null, miles: null, local: null };

  const digits = String(license || "").replace(/\D/g, "");
  const isCA = String(home?.state || "").toUpperCase() === "CA" || /DRE/i.test(String(license || ""));
  if (!digits || !isCA) return agent;
  const office = await dreOffice(digits.padStart(8, "0"));
  if (!office || (!office.city && office.lat == null)) return agent;
  agent.office = office.city ? { city: office.city, state: office.state } : null;
  if (office.lat != null && Number.isFinite(+home?.lat) && Number.isFinite(+home?.lng)) {
    agent.miles = Math.round(milesBetween({ lat: +home.lat, lng: +home.lng }, office) * 10) / 10;
  }
  const sameCity = !!home?.city && !!office.city && office.city.toLowerCase() === String(home.city).toLowerCase();
  agent.local = sameCity || (agent.miles != null && agent.miles <= LOCAL_MILES)
    ? true
    : (agent.miles != null ? false : null);
  return agent;
}
