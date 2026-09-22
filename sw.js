// தாஸ் பொது சேவை மையம் - Service Worker
// இது app-ஐ மொபைலில் "Install" செய்ய முடியும் வகையில் ஆக்குகிறது,
// மற்றும் app shell-ஐ (HTML/icons) cache செய்து offline-லும் திறக்க உதவுகிறது.
//
// முக்கியம்: Google Apps Script (script.google.com) க்கான தரவு கோரிக்கைகள்
// (getAllRequests/newRequest/etc.) இங்கு cache செய்யப்படுவதில்லை - அவை எப்போதும்
// நேரடியாக சேவையகத்திற்கே செல்லும், இதனால் தரவு எப்போதும் புதியதாகவே இருக்கும்.

const CACHE_VERSION = 'dhass-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // GET அல்லாத requests (POST - GAS API calls) மற்றும் வேறு தளத்திற்கான
  // requests (script.google.com) ஆகியவற்றை Service Worker தொடாது - நேரடியாக
  // நெட்வொர்க்-க்கே செல்லட்டும்.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // Page navigation (index.html ஏற்றுதல்): முதலில் நெட்வொர்க் முயற்சி,
  // கிடைக்காவிட்டால் (offline) cache-இலிருந்து காட்டும்.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // மற்ற static assets (icons/manifest): cache-first, பின்னணியில் புதுப்பிக்கும்.
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
