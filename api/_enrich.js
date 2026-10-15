// api/_enrich.js — shared pool-enrichment core (underscore = not a Vercel route).
//
// enrichPoolRow(supabase, row, opts) resolves a pool row to a Zillow zpid, fetches
// photos / description / list price from RapidAPI, and persists them back into
// pp_property_pool so a county (RentCast) row that shipped with no photo gets a
// real one. Called on-demand today by propertydetails.js (unchanged) and nightly
// in bulk by cron-enrich.js — this module is the single place that talks to the
// property-details endpoint for backfill.
//
// The small pure helpers below mirror the ones in propertydetails.js on purpose:
// keeping them local means the working on-demand endpoint is never touched by the
// cron path (zero regression risk). If they ever diverge, reconcile both copies.

// Zillow sometimes serves Google Street View as imgSrc — those 403 when hotlinked.
export function isUsablePhoto(u) {
  return !!u && typeof u === 'string' && !u.includes('maps.googleapis.com') && !u.includes('streetview');
}

// A sold home's CURRENT Zillow page can be a re-rental — its lease text/price must
// never leak into the sold-price game.
export function isRentalText(text) {
  return !!text && /lease type|rent due|notice period|security deposit|monthly rent|per month|application fee|pet deposit/i.test(text);
}

// A believable SALE list price: real, >= $50k, within a plausible band of sold,
// and not exactly equal to sold (that would leak the answer).
export function saneListPrice(lp, soldPrice) {
  if (!lp || lp < 50000) return null;
  if (soldPrice && (lp < soldPrice * 0.2 || lp > soldPrice * 5)) return null;
  if (soldPrice && lp === soldPrice) return null;
  return lp;
}

// Every listing photo, not the first 24 (Christo 2026-10-08): floor plans and
// layout sheets sit at the END of the set, so the old cap cut exactly the shots
// buyers want. Same single property-details response — zero extra API calls.
export const MAX_PHOTOS = 100;

// ── Floor plans right after the hero (Christo 2026-10-08) ──
// Listing feeds don't tag floor plans, so detect them by look: a floor plan is
// mostly white/near-gray paper with a little dark linework. Scored on Zillow's
// 192px thumbnail of each photo (a few KB apiece, fetched in parallel, no
// RapidAPI call). Non-Zillow URLs, or anything slow/failing, keep their order.
const ZILLOW_SIZED = /-cc_ft_\d+\.(jpg|webp)$/;
const REDFIN_BIG = /\/bigphoto\/(\d+)\/(\d+_[\d_]+\.jpg)$/;
// Small, cheap thumbnail for scoring: Zillow's 192px rendition, or Redfin's
// ~19KB "islphoto" copy of a bigphoto. null = can't score this URL.
const thumbFor = (url) => (ZILLOW_SIZED.test(url) ? url.replace(ZILLOW_SIZED, '-cc_ft_192.jpg')
  : REDFIN_BIG.test(url) ? url.replace(REDFIN_BIG, '/islphoto/$1/genIslnoResize.$2') : null);

// Redfin listing photos from the search payload's photo range:
// "<dataSourceId>.<mlsId>.<start>.<end>.<version>" → bigphoto URLs
// (index 0 = <mls>_0.jpg, N ≥ 1 = <mls>_N_<version>.jpg; verified on
// 1775 48th Ave, 58 photos).
export function redfinPhotosFromSpec(spec) {
  const m = String(spec || '').match(/^(\d{1,4})\.(\d{4,14})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return [];
  const [, ds, mls, a, b, v] = m;
  const start = Number(a), end = Math.min(Number(b), Number(a) + MAX_PHOTOS - 1);
  const base = `https://ssl.cdn-redfin.com/photo/${ds}/bigphoto/${mls.slice(-3)}`;
  const out = [];
  for (let i = start; i <= end; i++) out.push(i === 0 ? `${base}/${mls}_0.jpg` : `${base}/${mls}_${i}_${v}.jpg`);
  return out;
}
function looksLikeFloorPlan(rgba) {
  let white = 0, dark = 0, colorful = 0;
  const n = rgba.length / 4;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mn > 225 && mx - mn < 25) white++;
    else if (mx < 90) dark++;
    if (mx - mn > 60) colorful++;
  }
  return white / n > 0.45 && dark / n > 0.003 && dark / n < 0.25 && colorful / n < 0.15;
}
export async function floorPlansFirst(photos, { timeoutMs = 3500 } = {}) {
  if (!Array.isArray(photos) || photos.length < 3) return photos;
  let decode;
  try { decode = (await import('jpeg-js')).default.decode; } catch { return photos; }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const flags = await Promise.all(photos.map(async (url, i) => {
      const thumb = i === 0 ? null : thumbFor(url);
      if (!thumb) return false;
      try {
        const r = await fetch(thumb, { signal: controller.signal });
        if (!r.ok) return false;
        const img = decode(new Uint8Array(await r.arrayBuffer()), { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 1 });
        return looksLikeFloorPlan(img.data);
      } catch { return false; }
    }));
    if (!flags.some(Boolean)) return photos;
    return [photos[0], ...photos.filter((_, i) => flags[i]), ...photos.filter((_, i) => i > 0 && !flags[i])];
  } finally {
    clearTimeout(timer);
  }
}

export function extractPhotos(d) {
  const urls = [];
  if (d.photos && Array.isArray(d.photos)) {
    for (let i = 0; i < d.photos.length && urls.length < MAX_PHOTOS; i++) {
      const jpegs = d.photos[i]?.mixedSources?.jpeg || [];
      if (jpegs.length > 0) urls.push(jpegs[jpegs.length - 1].url);
    }
    if (urls.length > 0) return urls;
  }
  if (d.carouselPhotos && Array.isArray(d.carouselPhotos)) {
    for (let j = 0; j < d.carouselPhotos.length && urls.length < MAX_PHOTOS; j++) {
      if (d.carouselPhotos[j].url) urls.push(d.carouselPhotos[j].url);
    }
    if (urls.length > 0) return urls;
  }
  if (d.responsivePhotos && Array.isArray(d.responsivePhotos)) {
    for (let k = 0; k < d.responsivePhotos.length && urls.length < MAX_PHOTOS; k++) {
      const srcs = d.responsivePhotos[k]?.mixedSources?.jpeg || [];
      if (srcs.length > 0) urls.push(srcs[srcs.length - 1].url);
    }
    if (urls.length > 0) return urls;
  }
  if (d.imgSrc) return [d.imgSrc];
  return [];
}

async function resolveZpid(row, apiKey, apiHost) {
  // Numeric zpid already — no resolution needed.
  if (row.zpid && /^\d+$/.test(String(row.zpid))) return String(row.zpid);
  // RentCast (rc_) row: resolve the address to a Zillow zpid via /search.
  const addr = [row.address, row.city, `${row.state || 'CA'}`, row.zip].filter(Boolean).join(', ');
  if (!row.address) return null;
  try {
    const sResp = await fetch(`https://${apiHost}/search?location=${encodeURIComponent(addr)}`, {
      headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost },
    });
    const sRaw = await sResp.json().catch(() => null);
    const list = (sRaw && (Array.isArray(sRaw.data) ? sRaw.data : sRaw.data?.results)) || [];
    const streetNum = String(row.address).trim().split(/\s+/)[0];
    let match = null;
    if (list.length === 1) match = list[0];
    else if (list.length > 1) {
      match = list.find(r => String(r?.streetAddress || r?.address || '').trim().startsWith(streetNum)) || null;
    }
    return match?.zpid ? String(match.zpid) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Enrich one pp_property_pool row in place. Always bumps enrich_attempts so an
 * unmatchable row isn't retried forever (cron-enrich skips rows at >= 3 attempts).
 * Returns { enriched, photoCount, reason }.
 */
export async function enrichPoolRow(supabase, row, opts = {}) {
  const apiKey = opts.apiKey || process.env.RAPIDAPI_KEY;
  const apiHost = opts.apiHost || process.env.RAPIDAPI_HOST || 'real-time-real-estate-data.p.rapidapi.com';
  const attempts = (row.enrich_attempts || 0) + 1;
  const bump = async (extra = {}) => {
    try { await supabase.from('pp_property_pool').update({ enrich_attempts: attempts, ...extra }).eq('id', row.id); } catch (e) { /* ignore */ }
  };

  if (!apiKey) return { enriched: false, reason: 'no_api_key' };

  const zpid = await resolveZpid(row, apiKey, apiHost);
  if (!zpid) { await bump(); return { enriched: false, reason: 'unresolved' }; }

  try {
    const resp = await fetch(`https://${apiHost}/property-details?zpid=${zpid}`, {
      headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost },
    });
    if (!resp.ok) { await bump(); return { enriched: false, reason: `http_${resp.status}` }; }
    const raw = await resp.json();
    const d = raw.data || raw;

    const photos = extractPhotos(d).filter(isUsablePhoto);
    const rawDesc = d.description || d.homeDescription || '';
    const description = isRentalText(rawDesc) ? '' : rawDesc;

    // List price: prefer the "Listed for sale" event, sanity-checked vs sold.
    let listPrice = null;
    for (const evt of (d.priceHistory || [])) {
      const ev = String(evt?.event || '');
      if (/rent/i.test(ev)) continue;
      if (ev === 'Listed for sale' || /list/i.test(ev)) { listPrice = evt.price || null; break; }
    }
    listPrice = saneListPrice(listPrice, row.sold_price);

    if (photos.length === 0 && !description) { await bump(); return { enriched: false, reason: 'no_content' }; }

    const upd = { enrich_attempts: attempts };
    if (photos.length > 0) { upd.photos = photos.slice(0, MAX_PHOTOS); upd.photo = photos[0]; }
    if (description) upd.description = description;
    if (listPrice) upd.list_price = listPrice;
    if (d.yearBuilt && !row.year_built) upd.year_built = d.yearBuilt;

    await supabase.from('pp_property_pool').update(upd).eq('id', row.id);
    return { enriched: true, photoCount: photos.length, reason: 'ok' };
  } catch (e) {
    await bump();
    return { enriched: false, reason: e.message || 'error' };
  }
}
