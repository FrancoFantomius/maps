import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import handlebars from 'vite-plugin-handlebars';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

const languagesPlugin = () => ({
  name: 'serve-and-bundle-languages',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url && req.url.startsWith('/languages/')) {
        const relativePath = req.url.replace('/languages/', '').split('?')[0];
        const filePath = path.join(__dirname, 'languages', relativePath);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.setHeader('Content-Type', 'application/json');
          return fs.createReadStream(filePath).pipe(res);
        }
      }
      next();
    });
  },
  generateBundle() {
    const langDir = path.resolve(__dirname, 'languages');
    if (fs.existsSync(langDir)) {
      const files = fs.readdirSync(langDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          this.emitFile({
            type: 'asset',
            fileName: `languages/${file}`,
            source: fs.readFileSync(path.join(langDir, file))
          });
        }
      }
    }
  }
});

export default defineConfig({
  resolve: {
    alias: {
      'fs-extra': path.resolve(__dirname, 'js/mocks/fs-extra.js'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
    globals: true,
  },
  server: {
    watch: {
      usePolling: true,
      ignored: ['**/node_modules/**', '**/dist/**', '**/public/**'],
    },
  },
  plugins: [
    languagesPlugin(),
    handlebars({
      partialDirectory: path.resolve(__dirname, 'templates'),
    }),
    tailwindcss(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,png,svg,woff,woff2,json,ico}'],
        maximumFileSizeToCacheInBytes: 5000000,
        runtimeCaching: [
          {
            // Satellite imagery MUST NEVER be cached
            urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*$/i,
            handler: 'NetworkOnly',
          },
          {
            // OpenFreeMap Vector tiles & style specs
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openfreemap-tiles',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // OpenStreetMap raster tiles
            urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // WaymarkedTrails bike path tiles
            urlPattern: /^https:\/\/tile\.waymarkedtrails\.org\/.*$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'bike-tiles',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // 3D Terrain DEM elevation tiles
            urlPattern: /^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\/.*$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'terrain-dem-tiles',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Maps',
        short_name: 'Maps',
        description: 'Explore and customize maps with privacy. Have acces to bike trails, routes and other points of interest.',
        version: pkg.version,
        theme_color: '#F8F4F0',
        background_color: '#F8F4F0',
        display: 'standalone',
        start_url: '/',
        orientation: 'any',
        icons: [
          {
            src: 'img/icons/maps_x48.png',
            sizes: '48x48',
            type: 'image/png'
          },
          {
            src: 'img/icons/maps_x72.png',
            sizes: '72x72',
            type: 'image/png'
          },
          {
            src: 'img/icons/maps_x96.png',
            sizes: '96x96',
            type: 'image/png'
          },
          {
            src: 'img/icons/maps_x128.png',
            sizes: '128x128',
            type: 'image/png'
          },
          {
            src: 'img/icons/maps_x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'img/icons/maps_x384.png',
            sizes: '384x384',
            type: 'image/png'
          },
          {
            src: 'img/icons/maps_x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        privacy: path.resolve(__dirname, 'privacy.html'),
        terms: path.resolve(__dirname, 'terms.html'),
      },
    },
  },
});
