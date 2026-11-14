const CACHE = 'shadow-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.delete('shadow-v1').then(() => self.clients.claim())
));

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
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
