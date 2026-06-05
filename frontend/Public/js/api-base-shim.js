/**
 * API base URL shim
 * -----------------
 * Rewrites any hardcoded http://localhost:3000 / http://127.0.0.1:3000
 * URLs in fetch() and XMLHttpRequest to the current page's origin.
 *
 * Why: many files across the frontend hardcode the local backend URL.
 * When the site is served via ngrok / cloudflare tunnel, those calls
 * would otherwise hit the visitor's own machine. This shim rewrites
 * them transparently. Local development on localhost / 127.0.0.1 should
 * stay pointed at the real backend on :3000 even when the static frontend
 * is served from another local port such as :5050.
 */
(function () {
  if (typeof window === 'undefined') return;
  if (window.__API_BASE_SHIMMED__) return;
  window.__API_BASE_SHIMMED__ = true;

  const ORIGIN = window.location.origin;
  // Only rewrite for non-local origins such as ngrok / deployed domains.
  // When the page is served from localhost or 127.0.0.1 on any port
  // (for example live-server on :5050), keep API calls pointed at the
  // actual backend on :3000 instead of rewriting them to the static host.
  const IS_LOCAL_ORIGIN = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(ORIGIN);
  const NEED_REWRITE = !IS_LOCAL_ORIGIN;

  function rewrite(url) {
    if (typeof url !== 'string' || !NEED_REWRITE) return url;
    return url
      .replace(/^https?:\/\/127\.0\.0\.1:3000/i, ORIGIN)
      .replace(/^https?:\/\/localhost:3000/i,    ORIGIN);
  }

  // ─── Stale-token auto-logout ────────────────────────────────
  // If the backend's JWT_SECRET changes (e.g. switching between local and
  // Docker), every existing token in localStorage becomes invalid. Without
  // this guard the user just sees broken pages until they manually log out.
  // Here we listen for any /api/* response with status 401 (or 403 paired
  // with an "invalid signature" / "expired" message) and silently force a
  // logout + redirect to the login page.
  let __redirectingToLogin = false;
  function isAuthApiUrl(url) {
    if (typeof url !== 'string') return false;
    return /\/api\//.test(url);
  }
  function isAuthPage() {
    return /\/auth\//.test(window.location.pathname);
  }
  function clearAuthAndRedirect() {
    if (__redirectingToLogin || isAuthPage()) return;
    __redirectingToLogin = true;
    try {
      ['token', 'authToken', 'eventhub_token', 'auth_token',
       'user', 'auth_user', 'authUser']
        .forEach(k => localStorage.removeItem(k));
      try {
        if (window.CONFIG && CONFIG.STORAGE) {
          localStorage.removeItem(CONFIG.STORAGE.TOKEN);
          localStorage.removeItem(CONFIG.STORAGE.USER);
        }
      } catch (_) {}
    } catch (_) {}
    // Use a tiny delay so the original caller can finish handling the response.
    setTimeout(() => {
      window.location.href = '/Public/auth/pages/login.html?reason=session-expired';
    }, 50);
  }

  // Tight match for the EXACT JWT-failure phrases the backend emits, so we
  // don't false-positive on unrelated 403s (role-permission errors, the AI
  // service being offline, etc.). Only these mean "your token is bad — log out":
  //
  //   • "Invalid or expired token."        ← JsonWebTokenError (wrong secret / tampered)
  //   • "Session expired. Please login..." ← TokenExpiredError
  //   • "jwt expired" / "jwt malformed"    ← raw jsonwebtoken error names
  //
  // Anything else (e.g. "You do not have permission") is left alone — it's a
  // real authorization failure, not a stale-token issue, and shouldn't kick
  // the user out.
  const JWT_FAIL_RX = /Invalid or expired token|Session expired|jwt (expired|malformed|signature)|JsonWebTokenError|TokenExpiredError/i;
  // Per-page-load grace: don't auto-logout in the first 5 seconds of any page.
  // This single guard handles every "just logged in" case (because login.js
  // navigates to a new page so PAGE_LOAD_TIME resets) AND prevents redirect
  // loops when a dashboard fires multiple parallel calls on first load.
  // Using sessionStorage here would NOT work because the `storage` event
  // doesn't fire on the same tab that wrote the value.
  const PAGE_LOAD_TIME = Date.now();
  const POST_LOAD_GRACE_MS = 5000;

  async function maybeHandleUnauthorized(response, url) {
    if (!response || !isAuthApiUrl(url)) return;
    if (response.status !== 401 && response.status !== 403) return;
    // Only act if we actually had a token (i.e. user thought they were logged in).
    const hadToken = !!(localStorage.getItem('token') ||
                       localStorage.getItem('authToken') ||
                       localStorage.getItem('eventhub_token') ||
                       localStorage.getItem('auth_token'));
    if (!hadToken) return;
    // Grace window: ignore 401s during page-load + ~5s of settling time.
    if ((Date.now() - PAGE_LOAD_TIME) < POST_LOAD_GRACE_MS) return;
    // Clone so we don't drain the original body — caller still needs it.
    try {
      const clone = response.clone();
      const txt   = await clone.text();
      if (JWT_FAIL_RX.test(txt)) {
        console.warn('[api-shim] Auto-logout: JWT failure on', url, '→', txt.slice(0, 200));
        clearAuthAndRedirect();
      }
    } catch (_) { /* if we can't peek the body, do nothing — don't break the page */ }
  }

  // Patch fetch
  if (typeof window.fetch === 'function') {
    const origFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      let urlForCheck = '';
      try {
        if (typeof input === 'string') {
          input = rewrite(input);
          urlForCheck = input;
        } else if (input && typeof input === 'object' && 'url' in input) {
          urlForCheck = input.url;
          const u = rewrite(input.url);
          if (u !== input.url) input = new Request(u, input);
        }
      } catch (_) { /* ignore */ }
      const p = origFetch(input, init);
      p.then(res => maybeHandleUnauthorized(res, urlForCheck)).catch(() => {});
      return p;
    };
  }

  // Patch XHR
  if (typeof window.XMLHttpRequest === 'function') {
    const origOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function (method, url) {
      const args = Array.prototype.slice.call(arguments);
      try { args[1] = rewrite(url); } catch (_) { /* ignore */ }
      return origOpen.apply(this, args);
    };
  }

  // Also rewrite the CONFIG.API.BASE_URL if it loads after this shim.
  Object.defineProperty(window, 'CONFIG', {
    configurable: true,
    set(v) {
      try {
        if (v && v.API && typeof v.API.BASE_URL === 'string') {
          v.API.BASE_URL = rewrite(v.API.BASE_URL);
        }
      } catch (_) { /* ignore */ }
      Object.defineProperty(window, 'CONFIG', { value: v, writable: true, configurable: true, enumerable: true });
    },
    get() { return undefined; }
  });
})();

/* ── PWA bootstrap loader ───────────────────────────────────────────
   This shim is included on every page, so we use it to load the PWA
   bootstrap (installable app + offline + push) site-wide without editing
   each HTML file. Fully isolated from the API shim above. */
(function () {
  try {
    var s = document.createElement('script');
    s.src = '/Public/js/pwa.js';
    s.defer = true;
    (document.head || document.documentElement).appendChild(s);
  } catch (_) { /* never let PWA setup break the page */ }
})();
