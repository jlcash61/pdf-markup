const CACHE_NAME = "markup-app-v5";
const RUNTIME_CACHE_NAME = "markup-runtime-v5";

const APP_SHELL = [
    "./",
    "./index.html",
    "./style.css",
    "./js/app.js",
    "./manifest.webmanifest",
    "./icons/favicon.ico",
    "./icons/favicon-16x16.png",
    "./icons/favicon-32x32.png",
    "./icons/apple-touch-icon.png",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/maskable-icon-512.png"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames
                    .filter(cacheName =>
                        cacheName !== CACHE_NAME &&
                        cacheName !== RUNTIME_CACHE_NAME
                    )
                    .map(cacheName => caches.delete(cacheName))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    if (
        event.request.method !== "GET"
    ) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (
                    cachedResponse
                ) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then(networkResponse => {
                        const responseCopy =
                            networkResponse.clone();

                        caches.open(RUNTIME_CACHE_NAME)
                            .then(cache => cache.put(event.request, responseCopy))
                            .catch(() => {});

                        return networkResponse;
                    });
            })
    );
});
