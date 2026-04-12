const CACHE_NAME = 'ecofin-cache-v1';

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll([
            '/',
            '/index.html',
            '/logo.png'
        ]))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((names) =>
            Promise.all(
                names.map((name) => name !== CACHE_NAME ? caches.delete(name) : undefined)
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // Skip cross-origin and problematic requests
    if (e.request.method !== 'GET' || !e.request.url.includes(self.location.origin)) {
        return;
    }

    e.respondWith(
        caches.match(e.request)
            .then((response) => response || fetch(e.request))
            .catch(() => caches.match('/index.html'))
    );
});
