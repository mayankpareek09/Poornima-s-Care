const CACHE = 'pc-v5';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/api.js',
  '/js/features.js',
  '/js/embed-helper.js',
  '/pages/student.html',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(OFFLINE_ASSETS)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // API calls — always go to network, never cache
  if (e.request.url.includes('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response(JSON.stringify({success:false,offline:true}), {headers:{'Content-Type':'application/json'}}))
    );
    return;
  }

  // HTML pages — always fetch fresh from network first, fall back to cache only if offline
  if (e.request.mode === 'navigate' || e.request.url.endsWith('.html') || e.request.url.endsWith('/')) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match(e.request).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  // CSS/JS/images — stale-while-revalidate: serve cached copy instantly for
  // speed, but always fetch a fresh copy in the background and update the
  // cache, so the next load already has the latest deployed version instead
  // of being stuck on an old cached file until the cache name is bumped.
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const fetchPromise = fetch(e.request).then(resp => {
          if (resp && resp.status === 200) cache.put(e.request, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    )
  );
});