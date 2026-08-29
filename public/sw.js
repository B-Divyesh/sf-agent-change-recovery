const CACHE = 'recovery-ledger-v6';
// Every item is a required, shipped first-party URL. Keep this list independent
// of optional browser chrome assets so one missing icon can never prevent the
// demo shell from installing offline.
const SHELL = ['/', '/demo', '/app', '/privacy', '/terms', '/assets/hero-ledger-600.webp'];
const BUILD_ASSETS = [];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([...SHELL, ...BUILD_ASSETS]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(async cached => {
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) (await caches.open(CACHE)).put(event.request, response.clone());
      return response;
    } catch {
      if (event.request.mode === 'navigate') return (await caches.match('/demo')) ?? Response.error();
      return Response.error();
    }
  }));
});
