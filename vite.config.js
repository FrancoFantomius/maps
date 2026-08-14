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
        res.end(src.replace(/__APP_VERSION__/g, pkg.version).replace(/__PRECACHE_FONTS__/g, '[]'));
        return;
      }
      next();
    });
  },
  generateBundle(options, bundle) {
    const fontAssets = [];
    for (const fileName of Object.keys(bundle)) {
      if (/\.(woff|woff2|ttf|otf|eot)$/i.test(fileName)) {
        fontAssets.push(`/${fileName}`);
      }
    }

    const src = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf-8');
    const injectedSrc = src
      .replace(/__APP_VERSION__/g, pkg.version)
      .replace(/__PRECACHE_FONTS__/g, JSON.stringify(fontAssets));

    this.emitFile({
      type: 'asset',
      fileName: 'sw.js',
      source: injectedSrc,
    });
  },
});

const manifestPlugin = () => ({
  name: 'serve-and-bundle',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const rawUrl = req.url ? req.url.split('?')[0] : '';
      if (rawUrl === '/manifest.json') {
        const manifestPath = path.join(__dirname, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          res.setHeader('Content-Type', 'application/manifest+json');
          return fs.createReadStream(manifestPath).pipe(res);
        }
      }
      if (rawUrl.startsWith('/img/icons/') || rawUrl.startsWith('/assets/img/icons/')) {
        const fileName = path.basename(rawUrl);
        const iconPath = path.join(__dirname, 'img', 'icons', fileName);
        if (fs.existsSync(iconPath) && fs.statSync(iconPath).isFile()) {
          res.setHeader('Content-Type', 'image/png');
          return fs.createReadStream(iconPath).pipe(res);
        }
      }
      next();
    });
  },
  generateBundle() {
    const manifestPath = path.join(__dirname, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: fs.readFileSync(manifestPath),
      });
    }

    const iconsDir = path.join(__dirname, 'img', 'icons');
    if (fs.existsSync(iconsDir)) {
      const files = fs.readdirSync(iconsDir);
      for (const file of files) {
        const filePath = path.join(iconsDir, file);
        if (fs.statSync(filePath).isFile()) {
          const content = fs.readFileSync(filePath);
          this.emitFile({
            type: 'asset',
            fileName: `img/icons/${file}`,
            source: content,
          });
          this.emitFile({
            type: 'asset',
            fileName: `assets/img/icons/${file}`,
            source: content,
          });
        }
      }
    }
  },
});

// Sync to public directory for standard Vite public static serving
try {
  const publicDir = path.join(__dirname, 'public');
  const publicImgIcons = path.join(publicDir, 'img', 'icons');
  const publicAssetsImgIcons = path.join(publicDir, 'assets', 'img', 'icons');

  fs.mkdirSync(publicImgIcons, { recursive: true });
  fs.mkdirSync(publicAssetsImgIcons, { recursive: true });

  const manifestPath = path.join(__dirname, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    fs.copyFileSync(manifestPath, path.join(publicDir, 'manifest.json'));
  }

  const iconsDir = path.join(__dirname, 'img', 'icons');
  if (fs.existsSync(iconsDir)) {
    const files = fs.readdirSync(iconsDir);
    for (const file of files) {
      const srcFile = path.join(iconsDir, file);
      if (fs.statSync(srcFile).isFile()) {
        fs.copyFileSync(srcFile, path.join(publicImgIcons, file));
        fs.copyFileSync(srcFile, path.join(publicAssetsImgIcons, file));
      }
    }
  }
} catch {
  // Ignore sync errors if filesystem permission restricts public creation
}

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
  optimizeDeps: {
    exclude: ['maplibre-gl'],
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
    manifestPlugin(),
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
