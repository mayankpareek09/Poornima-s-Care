const CACHE = 'pc-v1';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/main.css',
  '/js/api.js',
  '/js/features.js',
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
  if (e.request.url.includes('/api/')) {
    // Network first for API calls
    e.respondWith(
      fetch(e.request).catch(() => new Response(JSON.stringify({success:false,offline:true}), {headers:{'Content-Type':'application/json'}}))
    );
    return;
  }
  // Cache first for static assets
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      if (resp && resp.status === 200) {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return resp;
    })).catch(() => caches.match('/index.html'))
  );
});