# CHANGELOG

All notable changes to this project will be documented in this file.

## [1.4.0] - 2026-08-14

### Added
- **Structured Sync Error Diagnostics & Codes**: Introduced `SYNC_ERROR_CODES` enum (`NO_SESSION`, `LOGIN_FAILED`, `INIT_FAILED`, `DIR_NOT_FOUND`, `REMOTE_READ`, `UPLOAD`, `DOWNLOAD`, `RECONCILE`, `PROFILE`) along with error construction and formatted logging helpers for clear diagnostics during cloud synchronization failures.
- **Filen Directory & File Path Constants**: Exported `FILEN_SYNC_DIR` and `FILEN_SYNC_FILE` constants with dedicated test coverage to enforce the `/Apps/maps` storage convention.

### Changed
- **Standardized Cloud Sync App Folder (`/Apps/maps`)**: Migrated remote Filen synchronization storage directory from `/maps` to `/Apps/maps/places.json`.
- **Privacy Policy & Localization Alignment**: Updated privacy documentation and localized strings (`privacy.html` and all `languages/*.json` files) to document the `/Apps/maps` cloud storage location.
- **Service Worker Module Caching**: Added `.mjs` support to `CACHEABLE_EXTENSIONS` in `sw.js` for proper offline caching of JavaScript ES module assets.
- **Vite Build & Asset Pipeline Cleanup**: Streamlined `vite.config.js` by removing redundant icon file emissions into `assets/img/icons/` and legacy static directory synchronization routines.

### Fixed
- **MapLibre Web Worker Asset Resolution**: Fixed blank map rendering in production builds by explicitly setting `maplibregl.setWorkerUrl()` with Vite's URL asset resolver for `maplibre-gl-worker.mjs`.
- **Sync Polling Log Redundancy**: Reduced console noise during routine 30-second sync polling intervals by only logging actionable state changes and deduplicated error transitions.

## [1.3.3] - 2026-08-14

### Added
- **Interactive Search Pins & Preview**: Introduced interactive pin dropping on search results with automatic map centering, zoom adjustments, location markers, and synced result list selection.
- **Language Parity Automated Test Suite**: Added `tests/languages_parity.test.js` to continuously verify key completeness, structural equality across language files, and `data-i18n` template attribute integrity.

### Changed
- **Optimized Language Pack (11 Main Languages)**: Streamlined i18n coverage to 11 fully validated tier-1 languages (`en`, `it`, `es`, `fr`, `de`, `zh`, `ja`, `ar`, `ru`, `pt`, `hi`), pruning unmaintained language files for improved maintenance and smaller bundle size.
- **Self-Hosted Material Icons & Precache Pipeline**: Migrated Material Icons Outlined font loading to self-hosted `@fontsource` packages, fixing offline font caching in `sw.js` Service Worker.
- **Dependencies Upgrade**: Upgraded core framework dependencies including Tailwind CSS (`v4.3.3`), MapLibre GL JS (`v6.3.0`), Vite (`v8.2.1`), Vitest (`v4.1.10`), and JS-DOM (`v30.0.1`).
- **UI & Layout Refinements**: Refined search header, HUD panel layout, layer switcher, marker modal dialogs, and image alignments on legal documents (`privacy.html`, `terms.html`).

### Fixed
- **Test Database Lock Isolation**: Configured `PouchDBAdapterMemory` in test environments to eliminate `maps_db/LOCK` concurrency collisions during Vitest test execution.
- **Service Worker Controllerchange Handler**: Updated PWA lifecycle event listeners in tests to verify service worker reloads and controller updates.

## [1.3.2] - 2026-08-01
### Changed
- **Map Style**: Changed the map style to a custom dark theme.
- **GPS Button Animation**: when the GPS is locating, the button will have a pulsing animation.
### Fixed
- **Images**: Fixed images not loading.
- **Pin**: The position of the pins updates with the map view.
- **Home Adress**: The home address is now saved and loaded correctly when signing in.

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
