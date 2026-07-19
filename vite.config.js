import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      'fs-extra': path.resolve(__dirname, 'js/mocks/fs-extra.js'),
    },
  },
  server: {
    watch: {
      usePolling: true,
      ignored: ['**/node_modules/**', '**/dist/**', '**/public/**'],
    },
  },
  plugins: [
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
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3000000, // accommodate larger files if needed
      },
      manifest: {
        name: 'Maps',
        short_name: 'Maps',
        description: 'Explore and customize maps with privacy. Have acces to bike trails, routes and other points of interest.',
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
