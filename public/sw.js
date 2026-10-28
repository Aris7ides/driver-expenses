// Minimal PWA service worker: no private API responses or HTML are cached.
const CACHE = 'miruta-static-v1'
const STATIC = ['/icon.svg', '/icon-192.png', '/icon-512.png']
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC))); self.skipWaiting() })
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim() })
self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin || request.mode === 'navigate') return
  if (!STATIC.includes(new URL(request.url).pathname)) return
  event.respondWith(caches.match(request).then(cached => cached || fetch(request)))
})
