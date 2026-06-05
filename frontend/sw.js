/* ──────────────────────────────────────────────────────────────────
   EventHub service worker
   ------------------------------------------------------------------
   DEV-SAFE BY DESIGN: HTML / CSS / JS are served NETWORK-ONLY so your
   code edits ALWAYS show on refresh — this worker never serves a stale
   page or stylesheet. It only:
     • provides an offline fallback page for navigations
     • caches images / fonts / icons (stale-while-revalidate) for speed
     • handles Web Push notifications (Phase 2 wires the server + VAPID)
   Bump CACHE_VERSION to force-flush the asset cache.
   ────────────────────────────────────────────────────────────────── */
const CACHE_VERSION = 'eventhub-assets-v1';
const OFFLINE_URL   = '/Public/offline.html';
const PRECACHE      = [OFFLINE_URL, '/Public/favicon.svg'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(PRECACHE)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;          // leave cross-origin alone

  // Never intercept the API or uploaded media — always hit the network.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;

  // Page navigations: network-first, ALWAYS bypassing the HTTP cache so a
  // page is never served stale, fall back to the offline page when down.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(req, { cache: 'no-store' });
      } catch (_) {
        const cache = await caches.open(CACHE_VERSION);
        return (await cache.match(OFFLINE_URL)) || new Response(
          '<h1>Offline</h1><p>You appear to be offline.</p>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      }
    })());
    return;
  }

  // HTML / CSS / JS: NETWORK-ONLY (no caching) so edits always show.
  if (/\.(?:css|js|html?)$/i.test(url.pathname)) return;

  // Images / fonts / icons: stale-while-revalidate for snappy loads.
  if (/\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?)$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cache  = await caches.open(CACHE_VERSION);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    })());
  }
});

/* ── Web Push (client side ready; server/VAPID delivered in Phase 2) ── */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (_) { data = { body: event.data && event.data.text() }; }

  const title = data.title || 'EventHub';
  const options = {
    body:  data.body  || 'You have a new update.',
    icon:  data.icon  || '/Public/favicon.svg',
    badge: '/Public/favicon.svg',
    tag:   data.tag   || 'eventhub',
    data:  { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) { try { await c.navigate(target); } catch (_) {} return c.focus(); }
    }
    return clients.openWindow(target);
  })());
});
