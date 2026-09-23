// App-shell cache. Bump VERSION *and* the ?v= numbers in index.html when you deploy changes.
const VERSION = 'system-v4';
const SHELL = ['./', 'index.html', 'style.css?v=4', 'app.js?v=4', 'config.js?v=4', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-180.png'];

self.addEventListener('install', e => {
  // cache: 'reload' skips the browser HTTP cache, so a deploy is never stored stale
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => { })))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // never touch Google/Anthropic calls
  // network-first, revalidated against the server so a new deploy always wins; cache is the offline fallback
  e.respondWith(
    fetch(new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }))
      .then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
