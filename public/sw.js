const CACHE = 'kazzohar-shell-v3';
const CACHE_PREFIX = 'kazzohar-';
// Resolve the app base from the worker's own URL so the shell works under any deploy path.
const BASE = new URL('./', self.location.href).pathname;
const SHELL = [BASE, `${BASE}index.html`, `${BASE}manifest.webmanifest`];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}));
    }
    return response;
  }).catch(() => caches.match(request).then(response => {
    if (response) return response;
    // Only navigations fall back to the shell; a missing script/JSON must fail rather than receive HTML.
    if (request.mode === 'navigate') return caches.match(`${BASE}index.html`);
    return Response.error();
  })));
});