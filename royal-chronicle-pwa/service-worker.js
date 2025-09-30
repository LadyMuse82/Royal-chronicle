
const CACHE_NAME = 'royal-chronicle-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './images/map.svg',
  './data/quests.json',
  './data/bosses.json',
  './data/artifacts.json',
  './data/monarch_cards.json',
  './data/question_bank.json',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k))))
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  } else {
    e.respondWith(fetch(e.request));
  }
});
