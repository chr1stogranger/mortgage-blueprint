// Challenge Landing Page — serves OG meta tags for rich link previews
// then redirects to the main app with the challenge token
//
// Also doubles as the PricePoint home OG page: vercel.json redirects social
// crawlers (bot user-agents) hitting pricepoint.realstack.app/ here with no
// token, and the no-token branch serves the generic PricePoint card instead
// of the Blueprint tags baked into the static index.html.
// The token is attacker-controllable (base64 in the URL), and its values are
// interpolated into <title>/<meta content="..."> below. Escape every string
// field so a token like h='"><script>...' can't break out of the attribute
// and execute (CIO re-audit H-1, reflected XSS).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export default function handler(req, res) {
  const { c } = req.query;

  if (!c) {
    return sendOgPage(res, {
      title: 'RealStack PricePoint — The Home Price Guessing Game',
      description: 'Guess what real homes sold for. Daily challenges, streaks, and leaderboards on real sold listings.',
      canonicalUrl: 'https://pricepoint.realstack.app/',
      redirectTo: '/',
    });
  }

  // Decode token to extract display data for OG tags
  let data = {};
  try {
    const padded = c.replace(/-/g, '+').replace(/_/g, '/');
    data = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return res.redirect(302, '/');
  }

  const accuracy = parseFloat(data.ac || 0).toFixed(1);          // numeric — coerced
  const hood = esc(data.h || 'Unknown');
  const beds = Number(data.b) || 0;                              // numeric — coerced
  const baths = Number(data.ba) || 0;                            // numeric — coerced
  const sqft = Number(data.sf) || 0;                             // numeric — coerced
  const mode = data.m === 'd' ? `Daily #${Number(data.dn) || 0}` : 'Free Play';
  const label = esc(data.lb || '');
  const isLive = data.m === 'l'; // FOR SALE challenge — no sold price / accuracy yet

  // The property photo makes the unfurl — https URLs only (the token is
  // attacker-controllable; esc() handles attribute context, the scheme check
  // blocks anything that isn't a plain web image URL).
  const photo = (typeof data.ph === 'string' && /^https:\/\//i.test(data.ph)) ? data.ph : null;
  // Address goes in the card ONLY for a FOR SALE challenge (it's an active,
  // publicly listed home). Sold challenges keep neighborhood-only titles —
  // an address would let recipients look up the sold price and cheat.
  const address = esc(data.a || '');

  // For a FOR SALE challenge the friend's number is deliberately NOT revealed
  // (it would anchor the recipient's guess — both numbers appear together only
  // after they've locked their own prediction).
  const title = isLive
    ? (address ? `PricePoint Challenge — ${address}` : `PricePoint Challenge — call this ${hood} listing`)
    : `PricePoint Challenge — ${accuracy}% on ${hood}`;
  const description = isLive
    ? `A friend called this active ${hood} listing (${beds}BR/${baths}BA, ${Number(sqft).toLocaleString()}sf). Lock in your own price — closest to what it sells for wins.`
    : `Someone scored ${accuracy}% accuracy on a ${hood} home (${beds}BR/${baths}BA, ${Number(sqft).toLocaleString()}sf). Think you can beat them?`;
  return sendOgPage(res, {
    title,
    description,
    canonicalUrl: `https://blueprint.realstack.app/?c=${encodeURIComponent(c)}`,
    redirectTo: `/?c=${encodeURIComponent(c)}`,
    image: photo, // property photo when the token has one; branded card otherwise
  });
}

// Serve HTML with OG tags, then JS redirect to the SPA.
function sendOgPage(res, { title, description, canonicalUrl, redirectTo, image }) {
  // Static branded fallback (dynamic @vercel/og not supported in Vite Edge functions)
  const ogImageUrl = image || `https://pricepoint.realstack.app/og-pricepoint.png`;
  const isBrandCard = !image; // only the static card is a known 1200x630
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${esc(ogImageUrl)}" />
  ${isBrandCard ? '<meta property="og:image:width" content="1200" />\n  <meta property="og:image:height" content="630" />' : ''}
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="RealStack PricePoint" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${esc(ogImageUrl)}" />

  <!-- iMessage / Apple -->
  <meta name="apple-mobile-web-app-title" content="PricePoint" />

  <style>
    body { margin: 0; background: #0a1120; color: #EDEDED; font-family: Inter, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .loader { text-align: center; }
    .loader h2 { font-size: 14px; letter-spacing: 3px; text-transform: uppercase; color: #3B6BF5; margin-bottom: 8px; }
    .loader p { color: #A1A1A1; font-size: 15px; }
  </style>
</head>
<body>
  <div class="loader">
    <h2>PRICEPOINT</h2>
    <p>Loading...</p>
  </div>
  <script>
    // Redirect to the SPA (with the challenge token when present)
    window.location.replace(${JSON.stringify(redirectTo).replace(/</g, '\\u003c')});
  </script>
</body>
</html>`);
}
