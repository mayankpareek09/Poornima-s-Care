const CACHE = 'pc-v18';
const STATIC = ['/index.html','/css/style.css','/js/api.js','/clubs.html'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC))));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return; // never cache API
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
