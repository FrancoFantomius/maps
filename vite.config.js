import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
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

const serviceWorkerPlugin = () => ({
  name: 'inject-sw-version',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/sw.js') {
        const src = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf-8');
        res.setHeader('Content-Type', 'application/javascript');
        res.end(src.replace(/__APP_VERSION__/g, pkg.version));
        return;
      }
      next();
    });
  },
  generateBundle() {
    const src = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf-8');
    this.emitFile({
      type: 'asset',
      fileName: 'sw.js',
      source: src.replace(/__APP_VERSION__/g, pkg.version),
    });
  },
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
    serviceWorkerPlugin(),
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
