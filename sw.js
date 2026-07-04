importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD8MBfHSwlrk642rs6FWZWeknWc5V5Z4Uc",
  authDomain: "eleague-manager.firebaseapp.com",
  projectId: "eleague-manager",
  storageBucket: "eleague-manager.firebasestorage.app",
  messagingSenderId: "474066590801",
  appId: "1:474066590801:web:25d29be98362b64c212c70"
});

const messaging = firebase.messaging.isSupported() ? firebase.messaging() : null;
if (messaging) {
  messaging.onBackgroundMessage(payload => {
    const { title, body } = payload.notification || {};
    if (!title) return;
    self.registration.showNotification(title, {
      body,
      icon: './assets/icon-192.png',
      badge: './assets/icon-192.png'
    });
  });
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow('./'));
});

const CACHE = 'eleague-v76';
// Large files (videos) excluded — they cache on first use so they
// don't block SW installation and cause silent update failures.
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
  './js/push.js',
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
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => clients.forEach(client => client.navigate(client.url)))
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Network first for Firebase requests
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit') ||
    url.includes('securetoken') ||
    url.includes('firebaseapp.com')
  ) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // Network first for HTML pages — always get the latest markup, fall back to cache offline
  if (e.request.mode === 'navigate' || url.endsWith('.html') || url.endsWith('/')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache first for JS, CSS, images, fonts, and other static assets
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
