const CACHE = 'recovery-ledger-v1';
const SHELL = ['/', '/demo', '/app', '/privacy', '/terms', '/favicon.svg', '/apple-touch-icon.png', '/assets/hero-ledger-600.webp'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    const html = await fetch('/').then(response => response.text());
    const builtAssets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]);
    await cache.addAll(builtAssets);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => {
    const update = fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
      return response;
    });
    return cached || update.catch(() => event.request.mode === 'navigate' ? caches.match('/demo') : Response.error());
  }));
});
