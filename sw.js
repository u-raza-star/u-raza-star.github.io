const CACHE = 'fillpop-v3';
const PRECACHE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const PAGE = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req, key) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done && r) { done = true; resolve(r); } };
    const fromCache = () => caches.match(key).then((r) => r);
    const timer = setTimeout(() => fromCache().then(finish), 4000);
    fetch(req, { cache: 'no-store' })
      .then((r) => {
        clearTimeout(timer);
        if (r && r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(key, copy));
          finish(r);
        } else {
          fromCache().then((c) => finish(c || r));
        }
      })
      .catch(() => {
        clearTimeout(timer);
        fromCache().then((c) => finish(c || Response.error()));
      });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.href === new URL('./', self.registration.scope).href;
  if (isPage) {
    e.respondWith(networkFirst(req, PAGE));
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return r;
    }))
  );
});
