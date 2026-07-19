// Challenge Landing Page — serves OG meta tags for rich link previews
// then redirects to the main app with the challenge token
export default function handler(req, res) {
  const { c } = req.query;

  if (!c) {
    return res.redirect(302, '/');
  }

  // Decode token to extract display data for OG tags
  let data = {};
  try {
    const padded = c.replace(/-/g, '+').replace(/_/g, '/');
    data = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return res.redirect(302, '/');
  }

  // The token is attacker-controllable (base64 in the URL), and these values
  // are interpolated into <title>/<meta content="..."> below. Escape every
  // string field so a token like h='"><script>...' can't break out of the
  // attribute and execute (CIO re-audit H-1, reflected XSS).
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const accuracy = parseFloat(data.ac || 0).toFixed(1);          // numeric — coerced
  const hood = esc(data.h || 'Unknown');
  const beds = Number(data.b) || 0;                              // numeric — coerced
  const baths = Number(data.ba) || 0;                            // numeric — coerced
  const sqft = Number(data.sf) || 0;                             // numeric — coerced
  const mode = data.m === 'd' ? `Daily #${Number(data.dn) || 0}` : 'Free Play';
  const label = esc(data.lb || '');

  const title = `PricePoint Challenge — ${accuracy}% on ${hood}`;
  const description = `Someone scored ${accuracy}% accuracy on a ${hood} home (${beds}BR/${baths}BA, ${Number(sqft).toLocaleString()}sf). Think you can beat them?`;
  // Static OG image fallback (dynamic @vercel/og not supported in Vite Edge functions)
  const ogImageUrl = `https://blueprint.realstack.app/og-pricepoint.png`;
  const canonicalUrl = `https://blueprint.realstack.app/?c=${encodeURIComponent(c)}`;

  // Serve HTML with OG tags, then JS redirect to the SPA
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
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="RealStack PricePoint" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${ogImageUrl}" />

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
    <p>Loading challenge...</p>
  </div>
  <script>
    // Redirect to SPA with challenge token
    window.location.replace('/?c=' + ${JSON.stringify(encodeURIComponent(c)).replace(/</g, '\\u003c')});
  </script>
</body>
</html>`);
}
