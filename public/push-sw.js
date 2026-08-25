// Web-push handlers, importScripts'd into the generated Workbox service worker
// (vite.config.js → workbox.importScripts). Payload shape is set by
// api/cron-deliver.js deliverWebPush(): { title, body, data: { type, url } }.
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { /* text push */ }
  const title = payload.title || 'PricePoint';
  const body = payload.body || (event.data ? event.data.text() : '');
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data || {},
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/?v=pricepoint';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) { w.navigate(url); return w.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
