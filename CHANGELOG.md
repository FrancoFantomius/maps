# CHANGELOG

All notable changes to this project will be documented in this file.


## [1.3.1] - 2026-08-01

### Added
- **Vanilla Service Worker (`sw.js`)**: Implemented a lightweight, dependency-free Service Worker providing app-shell precaching, network-first caching for static assets, and custom tile caching with automatic LRU eviction.
- **Dynamic SW Version Injection Plugin**: Added `serviceWorkerPlugin` in `vite.config.js` to dynamically inject the app version from `package.json` into `sw.js` during dev server requests and production builds for reliable precache cache-busting.
- **Language Assets Plugin**: Integrated `languagesPlugin` in `vite.config.js` for seamless serving and bundling of localized JSON files from `/languages/`.

### Changed
- **Replaced `vite-plugin-pwa`**: Migrated away from `vite-plugin-pwa` to a fully customized vanilla Service Worker and Vite build pipeline for greater control and transparency.
- **PWA Auto-Reload on Update**: Simplified `js/pwa.js` to listen for Service Worker `controllerchange` events and automatically refresh the client application when new versions take control.
- **Refined PWA Web App Manifest**: Updated `manifest.json` with app `id`, `orientation`, aligned background theme colors, and enhanced app categories (`navigation`, `travel`, `utilities`).


## [1.3.0] - 2026-07-26

### Added
- **Comprehensive Multi-Language & i18n Support**: Added full internationalization (i18n) support across the UI with localization coverage for 60+ languages (including RTL language support).
- **Dynamic Translation Controller (`TranslationController.js`)**: Implemented a standalone translation manager supporting system language detection, fallback chains (English base fallback), and dynamic language switching without requiring page reloads.
- **Offline Translation Caching**: Integrated dynamic translation file fetching and caching in Cache API (`maps-translations-v1`) for complete offline availability.
- **Language Preference UI**: Added a language selection dropdown to the settings panel allowing users to choose between system default and explicit language selection.
- **Translation Unit Test Suite**: Added [TranslationController.test.js](file:///c:/Users/franc/Programmazione/maps/tests/TranslationController.test.js) to test language resolution, fallback handling, DOM translation application, and preference persistence.
- **Full Progressive Web App (PWA) Support**: Integrated `vite-plugin-pwa` with service worker auto-updates, standalone display mode, and web app manifest synchronization.
- **Offline Map Tile Caching**: Implemented Workbox runtime caching strategies for vector tiles (OpenFreeMap), raster tiles (OpenStreetMap), cycle path overlays (WaymarkedTrails), and 3D Terrain DEM elevation data.
- **PWA Icons & Assets**: Added comprehensive app icon sets (`48x48` through `512x512` and maskable variants) for PWA installation on desktop and mobile devices.
- **HTML Templating & Component Modularization**: Integrated `vite-plugin-handlebars` to decompose monolithic HTML files (`index.html`, `privacy.html`, `terms.html`) into modular partial templates (`templates/`).
- **PWA Lifecycle Management**: Created `js/pwa.js` to manage service worker registrations, offline connectivity indicators, and app update toasts.
- **PWA Unit Test Suite**: Added `tests/pwa.test.js` to test PWA registration, update flows, and prompt event handlers.

### Changed
- **Optimized Caching Policies**: Set satellite imagery layer requests to `NetworkOnly` to prevent excessive storage usage and enforce live tile fetching.
- **Cleaned Up HTML Pages**: Replaced duplicated meta headers, styles, headers, footers, and HUD layouts across all pages with clean Handlebars partial references.

## [1.2.0] - 2026-07-25

### Added
- **Saved Home Location**: You can now set and store a dedicated home address for fast navigation and routing.
- **Smart Initial Map View Sequence**: When opening the app, location resolution intelligently follows a fallback chain: active GPS position → last saved location → home address → IP-based location fallback.
- **Comprehensive Unit & Integration Test Suite**: Added a robust Vitest testing suite covering `MapService`, routing controllers, search logic, and database controllers.

### Changed
- **Accurate Walk & Bike ETA Calculations**: Overhauled walking and cycling route ETA estimations to reflect realistic speed profiles and personalized pace adjustments.
- **Self-Hosted Typography & Icons**: Replaced external Google CDN font links with local `@fontsource` npm packages (`Inter`, `Outfit`, `Material Icons Outlined`) for faster loading times, enhanced privacy, and offline support.
- **Cleaned UI Controls**: Removed redundant "Set current view as home" button to streamline the map interface and simplify view management.
- **Code Refactoring & Performance**: Refactored core controllers for cleaner state isolation, better memory usage, and improved maintainability.
