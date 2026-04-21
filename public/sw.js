const CACHE_NAME = 'ecofin-cache-v3';
const STATIC_ASSETS = ['/logo.png'];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
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
    if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) {
        return;
    }

    const url = new URL(e.request.url);
    const isHTML = e.request.headers.get('Accept')?.includes('text/html') ||
        url.pathname === '/' || url.pathname === '/index.html';

    if (isHTML) {
        // Network-first for HTML: always get the latest index.html
        e.respondWith(
            fetch(e.request)
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    // Cache-first for hashed static assets (JS, CSS, images)
    e.respondWith(
        caches.match(e.request).then((cached) => {
            if (cached) return cached;
            return fetch(e.request).then((response) => {
                if (response.ok && url.pathname.startsWith('/assets/')) {
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, response.clone()));
                }
                return response;
            });
        }).catch(() => caches.match('/index.html'))
    );
});
