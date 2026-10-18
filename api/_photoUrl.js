// Listing photo URLs are client-supplied on a guess and later embedded as
// <img src> in other players' result emails and boards. Only https URLs on the
// listing photo CDNs we actually source from are kept; anything else becomes ''.
const ALLOWED_SUFFIXES = [
  'zillowstatic.com',
  'cdn-redfin.com',
  'redfin.com',
  'cloudfront.net',
  'unsplash.com',
  'rdcpix.com',
];

export function safePhotoUrl(u) {
  if (typeof u !== 'string' || !u || u.length > 2000) return '';
  let url;
  try { url = new URL(u); } catch { return ''; }
  if (url.protocol !== 'https:') return '';
  const host = url.hostname.toLowerCase();
  return ALLOWED_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`)) ? u : '';
}
