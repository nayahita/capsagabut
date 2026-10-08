// Offline support. Game files are fetched fresh when online (so updates show up right away)
// and served from the cache when offline.
const CACHE = 'capsa-v12';
const CORE = [
  './', './index.html', './manifest.json',
  './icon-192.png', './icon-512.png', './icon-maskable.png', './apple-touch-icon.png',
  './src/reactions.config.js', './src/events.js', './src/stats.js', './src/lore.js', './src/reactions.js',
  './src/comedy/config.js', './src/audio/director.js', './src/comedy/director.js', './src/comedy/memory.js', './src/comedy/bits.js', './src/comedy/stage.js', './src/chat.js', './src/showhand.js',
  './audio/win.wav', './audio/lose.wav', './audio/bad-beat.wav', './audio/comeback.wav', './audio/win-streak.wav',
  './audio/loss-streak.wav', './audio/upset.wav', './audio/perfect.wav', './audio/revenge.wav',
  './audio/comedy/notify.wav', './audio/comedy/tape-stop.wav', './audio/comedy/typing.wav', './audio/comedy/drumroll.wav', './audio/comedy/stamp.wav', './audio/comedy/glitch.wav', './audio/comedy/kazoo.wav', './audio/comedy/deflate.wav', './audio/comedy/heartbeat.wav', './audio/comedy/register.wav', './audio/comedy/gavel.wav', './audio/comedy/error.wav', './audio/comedy/whoosh.wav', './audio/comedy/memorial.wav', './audio/comedy/cctv-hum.wav', './audio/comedy/credits.wav',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Our own files: network first, cache as fallback.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req.mode === 'navigate' ? './index.html' : req, copy)); }
          return res;
        })
        .catch(() => caches.match(req.mode === 'navigate' ? './index.html' : req).then((hit) => hit || caches.match(req, { ignoreSearch: true })))
    );
    return;
  }

  // Fonts: cache first.
  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res;
      }))
    );
  }
  // Everything else (Firebase, CDN) goes straight to the network.
});
