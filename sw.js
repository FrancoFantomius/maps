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
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
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

// File extensions to cache at runtime (mirrors the old Workbox globPatterns)
const CACHEABLE_EXTENSIONS = /\.(js|css|html|png|svg|woff|woff2|json|ico)(\?.*)?$/i;

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
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

  // For same-origin cacheable assets: network-first with precache fallback
  const url = new URL(request.url);
  if (url.origin === self.location.origin && CACHEABLE_EXTENSIONS.test(url.pathname)) {
    event.respondWith(appNetworkFirst(request));
    return;
  }
});

// ─── Strategies ───────────────────────────────────────────────────────────────

/**
 * Cache-first for tile requests with LRU-style eviction.
 */
async function tilesCacheFirst(request, route) {
  const cache = await caches.open(route.cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok || response.status === 0) {
    const clone = response.clone();
    // Fire-and-forget: put + evict in background
    cache.put(request, clone).then(() => evictOldEntries(route.cacheName, route.maxEntries));
  }
  return response;
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
