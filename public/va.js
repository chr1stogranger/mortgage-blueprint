// Vercel Web Analytics loader, shared by the app (index.html) and the static
// SEO pages (scripts/seo-data/render.js). Cookieless page-view counts; see
// public/privacy.html section 6. Loads only on our real domains, so local dev,
// previews and the native app (capacitor://localhost) send nothing.
//
// window.va queues custom events until the Vercel script arrives; the
// calculators call it with va("event", { name, data }) for picks and clicks.
(function () {
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  if (!/(^|\.)realstack\.app$/.test(location.hostname)) return;
  var s = document.createElement("script");
  s.defer = true;
  s.src = "/_vercel/insights/script.js";
  document.head.appendChild(s);
})();
