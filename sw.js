const CACHE_NAME = 'due-guardian-cache-v3'; // Bump version to trigger update
const PRECACHE_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'icon-192x192.svg',
  'icon-512x512.svg',
  // Local TS/TSX Files
  'index.tsx',
  'App.tsx',
  'types.ts',
  'hooks/useLocalStorage.ts',
  'components/Dashboard.tsx',
  'components/Modal.tsx',
  'components/icons.tsx',
  'components/AddToHomeScreenPrompt.tsx',
  // External CDN Dependencies
  'https://cdn.tailwindcss.com',
  'https://aistudiocdn.com/react@^19.2.0',
  'https://aistudiocdn.com/react-dom@^19.2.0/client',
  'https://aistudiocdn.com/react@^19.2.0/jsx-runtime'
];

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
                // A response is a stream and can only be consumed once.
                // We need to clone it to put one copy in the cache and send one to the browser.
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
                // This is where you could return a fallback page if you had one.
                console.error('Service Worker: Fetch failed:', error);
                // For now, just re-throw the error
                throw error;
            });
        })
    );
});