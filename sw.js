// maps - Vanilla Service Worker
// The __APP_VERSION__ placeholder is replaced at build time by the Vite serviceWorkerPlugin
// with the version from package.json. This ensures the precache is busted on every release.

const APP_VERSION = '__APP_VERSION__';
const PRECACHE_NAME = `maps-precache-v${APP_VERSION}`;

// Runtime tile cache names (not version-keyed — tiles are long-lived and shared across versions)
const TILE_CACHES = {
  openfreemap: 'openfreemap-tiles',
  osm: 'osm-tiles',
  bike: 'bike-tiles',
  terrain: 'terrain-dem-tiles',
};

// App-shell URLs to precache on install.
// Vite-hashed assets (JS/CSS) are fetched via index.html and cached at runtime on first load.
// __PRECACHE_FONTS__ is replaced at build time by serviceWorkerPlugin with font assets.
const DYNAMIC_FONT_PRECACHES = typeof __PRECACHE_FONTS__ !== 'undefined' ? __PRECACHE_FONTS__ : [];

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/img/icons/maps_x192.png',
  '/img/icons/maps_x512.png',
  ...(Array.isArray(DYNAMIC_FONT_PRECACHES) ? DYNAMIC_FONT_PRECACHES : []),
];

// ─── Tile URL matchers ────────────────────────────────────────────────────────

const TILE_ROUTES = [
  {
    pattern: /^https:\/\/server\.arcgisonline\.com\//i,
    handler: 'network-only',
  },
  {
    pattern: /^https:\/\/tiles\.openfreemap\.org\//i,
    handler: 'cache-first',
    cacheName: TILE_CACHES.openfreemap,
    maxEntries: 1000,
    maxAgeSec: 30 * 24 * 60 * 60,
  },
  {
    pattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\//i,
    handler: 'cache-first',
    cacheName: TILE_CACHES.osm,
    maxEntries: 1000,
    maxAgeSec: 30 * 24 * 60 * 60,
  },
  {
    pattern: /^https:\/\/tile\.waymarkedtrails\.org\//i,
    handler: 'cache-first',
    cacheName: TILE_CACHES.bike,
    maxEntries: 500,
    maxAgeSec: 30 * 24 * 60 * 60,
  },
  {
    pattern: /^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\//i,
    handler: 'cache-first',
    cacheName: TILE_CACHES.terrain,
    maxEntries: 500,
    maxAgeSec: 30 * 24 * 60 * 60,
  },
];

// File extensions for fonts (Cache-First strategy for instant loading of Material Icons, Inter, Outfit)
const FONT_EXTENSIONS = /\.(woff|woff2|ttf|otf|eot)(\?.*)?$/i;

// File extensions to cache at runtime via network-first
const CACHEABLE_EXTENSIONS = /\.(js|mjs|css|html|png|svg|json|ico)(\?.*)?$/i;

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE_NAME).then(async (cache) => {
      // Safely cache app-shell items without allowing a single 404 to break installation
      await Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[PWA SW] Precache skipped for ${url}:`, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// ─── Activate — purge old precaches ───────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('maps-precache-v') && key !== PRECACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Check tile routes first
  for (const route of TILE_ROUTES) {
    if (route.pattern.test(request.url)) {
      if (route.handler === 'network-only') {
        event.respondWith(fetch(request));
        return;
      }
      if (route.handler === 'cache-first') {
        event.respondWith(tilesCacheFirst(request, route));
        return;
      }
    }
  }

  const url = new URL(request.url);

  // For same-origin font assets (Material Icons, web fonts): cache-first for instant 0ms load
  if (url.origin === self.location.origin && (FONT_EXTENSIONS.test(url.pathname) || request.destination === 'font')) {
    event.respondWith(appCacheFirst(request));
    return;
  }

  // For same-origin cacheable assets: network-first with precache fallback
  if (url.origin === self.location.origin && CACHEABLE_EXTENSIONS.test(url.pathname)) {
    event.respondWith(appNetworkFirst(request));
    return;
  }
});

// ─── Strategies ───────────────────────────────────────────────────────────────

/**
 * Cache-first for tile requests with LRU-style eviction and robust error handling.
 */
async function tilesCacheFirst(request, route) {
  try {
    const cache = await caches.open(route.cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response && (response.ok || response.status === 0)) {
      try {
        const clone = response.clone();
        cache.put(request, clone)
          .then(() => evictOldEntries(route.cacheName, route.maxEntries))
          .catch(() => {});
      } catch {
        // Ignore clone/put issues for non-cloneable streams
      }
    }
    return response;
  } catch (err) {
    // If cache lookup or fetch failed, fallback directly to raw network fetch
    return fetch(request).catch(() => new Response('', { status: 408, statusText: 'Request Timeout' }));
  }
}

/**
 * Cache-first for font assets (Material Icons, Inter, Outfit).
 * Serves cached font files immediately. If missing, fetches over network and caches for future visits.
 */
async function appCacheFirst(request) {
  const cache = await caches.open(PRECACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Network-first for app assets.
 * If the network succeeds, update the precache bucket.
 * If the network fails, fall back to the precache.
 */
async function appNetworkFirst(request) {
  const cache = await caches.open(PRECACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Simple LRU eviction: if the cache exceeds maxEntries, delete the oldest.
 */
async function evictOldEntries(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    // Delete oldest entries (first in the keys list)
    const excess = keys.length - maxEntries;
    for (let i = 0; i < excess; i++) {
      await cache.delete(keys[i]);
    }
  }
}
