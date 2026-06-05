/* ──────────────────────────────────────────────────────────────────
   EventHub PWA bootstrap
   ------------------------------------------------------------------
   Loaded on every page (via api-base-shim.js). It:
     1. injects the manifest link + PWA meta tags (no per-page HTML edits)
     2. registers the service worker (scope '/')
     3. shows a tasteful "Install app" button when the browser allows it
     4. exposes window.EventHubPush.subscribe() for Phase-2 push opt-in
   Purely additive — touches nothing else on the page.
   ────────────────────────────────────────────────────────────────── */
(function () {
  if (typeof window === 'undefined' || window.__EVENTHUB_PWA__) return;
  window.__EVENTHUB_PWA__ = true;

  // ── 1) Inject manifest + PWA meta tags if missing ──────────────────
  function head() { return document.head || document.getElementsByTagName('head')[0] || document.documentElement; }
  function addOnce(selector, make) { if (!document.querySelector(selector)) head().appendChild(make()); }

  addOnce('link[rel="manifest"]', () => {
    const l = document.createElement('link'); l.rel = 'manifest'; l.href = '/manifest.json'; return l;
  });
  addOnce('meta[name="theme-color"]', () => {
    const m = document.createElement('meta'); m.name = 'theme-color'; m.content = '#6366f1'; return m;
  });
  addOnce('link[rel="apple-touch-icon"]', () => {
    const a = document.createElement('link'); a.rel = 'apple-touch-icon'; a.href = '/Public/favicon.svg'; return a;
  });
  addOnce('meta[name="apple-mobile-web-app-capable"]', () => {
    const m = document.createElement('meta'); m.name = 'apple-mobile-web-app-capable'; m.content = 'yes'; return m;
  });
  addOnce('meta[name="apple-mobile-web-app-status-bar-style"]', () => {
    const m = document.createElement('meta'); m.name = 'apple-mobile-web-app-status-bar-style'; m.content = 'black-translucent'; return m;
  });
  addOnce('meta[name="apple-mobile-web-app-title"]', () => {
    const m = document.createElement('meta'); m.name = 'apple-mobile-web-app-title'; m.content = 'EventHub'; return m;
  });

  // ── 2) Service worker: DISABLED ────────────────────────────────────
  // A service worker caused stale page/CSS caching in this setup, so we do NOT
  // register one. We also proactively UNREGISTER any worker a previous version
  // installed and wipe its caches, so the browser always loads fresh from the
  // server. The app stays installable via the manifest above (no offline mode).
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(function (regs) { regs.forEach(function (r) { r.unregister(); }); })
      .catch(function () {});
  }
  if (window.caches && caches.keys) {
    caches.keys().then(function (keys) { keys.forEach(function (k) { caches.delete(k); }); }).catch(function () {});
  }

  // ── 3) Install prompt ──────────────────────────────────────────────
  // No custom on-page install button — installation is left entirely to the
  // browser's native UI (the install icon in the address bar / browser menu),
  // so the app's page UI is never altered. We just keep the prompt from being
  // suppressed so the browser can still offer native install.
  window.addEventListener('beforeinstallprompt', function () { /* allow native UI */ });

  // ── 4) Push opt-in helper (server delivery arrives in Phase 2) ─────
  // Usage later: EventHubPush.subscribe('<VAPID_PUBLIC_KEY>')
  window.EventHubPush = {
    async subscribe(vapidPublicKey) {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('[pwa] Push not supported in this browser'); return null;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return null;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
      return sub; // POST this to the backend in Phase 2
    }
  };

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }
})();
