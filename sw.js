const CACHE_NAME = 'airdrop-v1.0-beta';
const STATIC_CACHE_URLS = [
    './',
    './index.html',
    './styles.css',
    './script.js',
    './manifest.json',
    'https://ineqe.com/wp-content/uploads/2022/11/Airdrop_Logo2022.png'
];

const DYNAMIC_CACHE_NAME = 'airdrop-dynamic-v1.0';

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('ServiceWorker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_CACHE_URLS);
            })
            .then(() => {
                console.log('ServiceWorker installed successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('ServiceWorker installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('ServiceWorker activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('ServiceWorker activated');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Handle same-origin requests
    if (url.origin === location.origin) {
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    return fetch(request)
                        .then((response) => {
                            // Don't cache non-successful responses
                            if (!response || response.status !== 200 || response.type !== 'basic') {
                                return response;
                            }

                            // Clone the response for caching
                            const responseToCache = response.clone();

                            caches.open(DYNAMIC_CACHE_NAME)
                                .then((cache) => {
                                    cache.put(request, responseToCache);
                                });

                            return response;
                        })
                        .catch(() => {
                            // Return offline page or basic response for navigation requests
                            if (request.mode === 'navigate') {
                                return caches.match('./index.html');
                            }
                        });
                })
        );
    } else {
        // Handle external requests (like QR code API)
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    return cachedResponse || fetch(request)
                        .then((response) => {
                            // Cache external resources
                            if (response.status === 200) {
                                const responseToCache = response.clone();
                                caches.open(DYNAMIC_CACHE_NAME)
                                    .then((cache) => {
                                        cache.put(request, responseToCache);
                                    });
                            }
                            return response;
                        })
                        .catch(() => {
                            // Return a fallback for failed external requests
                            console.log('External request failed:', request.url);
                        });
                })
        );
    }
});

// Handle background sync (for future enhancement)
self.addEventListener('sync', (event) => {
    if (event.tag === 'upload-sync') {
        event.waitUntil(handleBackgroundSync());
    }
});

async function handleBackgroundSync() {
    console.log('Background sync triggered');
    // Future: Handle pending uploads when connection is restored
}

// Handle push notifications (for future enhancement)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: 'https://ineqe.com/wp-content/uploads/2022/11/Airdrop_Logo2022.png',
            badge: 'https://ineqe.com/wp-content/uploads/2022/11/Airdrop_Logo2022.png',
            vibrate: [200, 100, 200],
            data: data.data,
            actions: [
                {
                    action: 'view',
                    title: 'View',
                    icon: 'https://ineqe.com/wp-content/uploads/2022/11/Airdrop_Logo2022.png'
                },
                {
                    action: 'close',
                    title: 'Close',
                    icon: 'https://ineqe.com/wp-content/uploads/2022/11/Airdrop_Logo2022.png'
                }
            ]
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Message handling for communication with main app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
