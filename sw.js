// Service worker: salva l'app sul telefono per usarla offline
const VERSION = 16;
const CACHE = 'palestra-v' + VERSION;
const FILES = ['./', './index.html', './modello3d.js', './esercizi3d.js', './vendor/three-lite.js', './models/atleta.glb', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  // cache: 'reload' = scarica sempre la versione nuova dal server, mai una copia vecchia del browser
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then(list => list.forEach(c => c.postMessage({ type: 'updated', version: VERSION }))));
});

// Prima la copia salvata (funziona offline)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const r = await fetch(e.request);
      if (r && (r.ok || r.type === 'opaque')) cache.put(e.request, r.clone());
      return r;
    } catch (err) {
      if (e.request.mode === 'navigate') return cache.match('./index.html');
      return new Response('', { status: 504 });
    }
  }));
});
