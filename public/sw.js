const CACHE = 'shadow-v3';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  Promise.all(['shadow-v1', 'shadow-v2'].map((cache) => caches.delete(cache))).then(() => self.clients.claim())
));

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  const url = new URL(e.request.url);
  if (url.searchParams.has('code') || url.searchParams.has('error')) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          return caches.open(CACHE).then((c) => c.put(e.request, copy))
            .catch((error) => console.error('Could not cache offline resource:', error))
            .then(() => res);
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
