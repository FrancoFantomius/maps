# CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
