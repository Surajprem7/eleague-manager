const CACHE = 'eleague-v6';
const ASSETS = [
  './',
  './index.html',
  './admin.html',
  './css/style.css',
  './css/admin.css',
  './js/firebase.js',
  './js/auth.js',
  './js/app.js',
  './js/admin.js',
  './js/tournament.js',
  './js/matches.js',
  './js/notify.js',
  './js/realtime.js',
  './js/stats.js',
  './js/activitylog.js',
  './bracket.html',
  './js/dispute.js',
  './stats.html',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/banner.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network first for Firebase requests
  if (
    e.request.url.includes('firestore.googleapis.com') ||
    e.request.url.includes('identitytoolkit') ||
    e.request.url.includes('securetoken') ||
    e.request.url.includes('firebaseapp.com')
  ) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache first for all other assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});
