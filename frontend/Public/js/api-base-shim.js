/**
 * API base URL shim
 * -----------------
 * Rewrites any hardcoded http://localhost:3000 / http://127.0.0.1:3000
 * URLs in fetch() and XMLHttpRequest to the current page's origin.
 *
 * Why: many files across the frontend hardcode the local backend URL.
 * When the site is served via ngrok / cloudflare tunnel, those calls
 * would otherwise hit the visitor's own machine. This shim rewrites
 * them transparently — local dev (when served from :3000) is a no-op
 * because the origin is the same.
 */
(function () {
  if (typeof window === 'undefined') return;
  if (window.__API_BASE_SHIMMED__) return;
  window.__API_BASE_SHIMMED__ = true;

  const ORIGIN = window.location.origin;
  // Only rewrite when we're not actually served from one of the local backends.
  const NEED_REWRITE = !/^https?:\/\/(127\.0\.0\.1|localhost):3000$/i.test(ORIGIN);

  function rewrite(url) {
    if (typeof url !== 'string' || !NEED_REWRITE) return url;
    return url
      .replace(/^https?:\/\/127\.0\.0\.1:3000/i, ORIGIN)
      .replace(/^https?:\/\/localhost:3000/i,    ORIGIN);
  }

  // Patch fetch
  if (typeof window.fetch === 'function') {
    const origFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      try {
        if (typeof input === 'string') {
          input = rewrite(input);
        } else if (input && typeof input === 'object' && 'url' in input) {
          const u = rewrite(input.url);
          if (u !== input.url) input = new Request(u, input);
        }
      } catch (_) { /* ignore */ }
      return origFetch(input, init);
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
