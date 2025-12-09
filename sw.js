
const CACHE_NAME = 'due-guardian-cache-v4'; // Bump version to trigger update
const PRECACHE_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'icon-192x192.svg',
  'icon-512x512.svg',
  // Dependencies
  'https://cdn.tailwindcss.com',
  'https://aistudiocdn.com/react@^19.2.0',
  'https://aistudiocdn.com/react-dom@^19.2.0/client',
  'https://aistudiocdn.com/react@^19.2.0/jsx-runtime'
];

// NOTE: We do NOT precache .tsx/.ts files here. 
// We let the browser request them, and the fetch listener below will cache 
// the *compiled* response dynamically. This prevents caching raw TSX which fails in PWA.

// Install event: precache the app shell
self.addEventListener('install', (event) => {
  console.log('Service Worker: Install event in progress.');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching core assets.');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
        console.log('Service Worker: Core assets cached successfully.');
        self.skipWaiting(); // Force the new service worker to activate immediately
    }).catch(error => {
        console.error('Service Worker: Pre-caching failed:', error);
    })
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activate event in progress.');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('Service Worker: Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
        // Take control of all clients as soon as the new service worker is activated.
        return self.clients.claim();
    })
  );
});

// Fetch event: serve from cache, fall back to network, and then cache the new resource
self.addEventListener('fetch', (event) => {
    // Only apply this logic to GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // If the resource is in the cache, return it
            if (cachedResponse) {
                return cachedResponse;
            }

            // If the resource is not in the cache, fetch it from the network
            return fetch(event.request).then((networkResponse) => {
                // Check if we received a valid response
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    // We can return opaque responses (like from CDNs) but maybe not cache them if strict
                    // For this app, we cache everything successful to ensure offline availability
                }

                // Clone the response
                const responseToCache = networkResponse.clone();
                
                caches.open(CACHE_NAME).then((cache) => {
                    // We don't want to cache error responses
                    if (networkResponse.status < 400) {
                        cache.put(event.request, responseToCache);
                    }
                });

                // Return the network response
                return networkResponse;
            }).catch(error => {
                console.error('Service Worker: Fetch failed:', error);
                throw error;
            });
        })
    );
});
