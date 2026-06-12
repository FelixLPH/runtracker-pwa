// ============================================================
// RunTracker — Service Worker
// Cache-first strategy for app shell, network-first for data
// ============================================================

const CACHE_NAME = 'runtracker-v11';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/index.css',
  './css/components.css',
  './css/pages.css',
  './css/onboarding.css',
  './js/stats.js',
  './js/timer.js',
  './js/db.js',
  './js/cloud.js',
  './js/gps.js',
  './js/map.js',
  './js/ui.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// External assets to cache (fonts + leaflet)
const EXTERNAL_ASSETS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// ===== INSTALL: Pre-cache static assets =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Cache local assets
        const localCache = cache.addAll(STATIC_ASSETS).catch(err => {
          console.warn('Failed to cache some local assets:', err);
        });
        // Cache external assets (best effort)
        const externalCache = Promise.allSettled(
          EXTERNAL_ASSETS.map(url => cache.add(url).catch(() => {}))
        );
        return Promise.all([localCache, externalCache]);
      })
  );
  self.skipWaiting();
});

// ===== ACTIVATE: Clean old caches =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ===== FETCH: Cache-first for assets, skip map tiles =====
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Don't cache map tiles — they're dynamic and too large
  if (url.hostname.includes('basemaps.cartocdn.com') ||
      url.hostname.includes('tile.openstreetmap.org')) {
    return;
  }

  // Don't cache Google Fonts API responses (they handle their own caching)
  if (url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          // Cache font files for offline use
          if (response.ok && url.hostname === 'fonts.gstatic.com') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Cache-first strategy for all other requests
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        // Only cache successful responses
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Fallback for navigation requests
      if (event.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
