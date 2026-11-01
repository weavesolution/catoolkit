/* CA Financial Toolkit — service worker (offline-first) */
const VERSION = 'catk-v1.1.1';
const ASSETS = [
  './', './index.html', './privacy.html', './styles.css', './calcs.js', './export.js', './app.js', './manifest.json',
  './images/icon-192.png', './images/icon-512.png', './images/maskable-512.png', './images/apple-touch-icon.png', './images/favicon-32.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // Serve the cached page for this URL (index or privacy); fall back to network, then to the app shell
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req)).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  })));
});
