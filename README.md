# Maps

[![Version](https://img.shields.io/badge/version-1.3.1-blue.svg)](CHANGELOG.md)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

A modern, privacy-focused, local-first web mapping application powered by MapLibre GL JS, OpenStreetMap, and Tailwind CSS. Built as a Progressive Web App (PWA) with cloud synchronization capabilities.

![Maps App Icon](img/icons/maps_x192.png)

---

## Features

- **Interactive Vector & Raster Maps**: Smooth rendering powered by MapLibre GL JS with custom style support (streets, outdoors, bike trails, satellite, hillshading).
- **Search & Geocoding**: Instant search for places, addresses, and points of interest.
- **Routing & Directions**:
  - Route planning for Driving, Cycling, and Walking modes.
  - Custom ETA calculations tailored to personalized walking and biking speeds.
  - Step-by-step turn directions.
- **Heads-Up Display (HUD) / Navigation Mode**: Real-time speed monitor, compass heading, and live location tracking.
- **Smart Initial Location Chain**: Automatic location resolution sequence: GPS position → last saved position → home address → IP-based fallback.
- **Custom Markers & Collections**: Save favorite locations, home address, and custom pins organized with PouchDB for local-first reliability.
- **Cloud Sync**: Optional zero-knowledge / end-to-end cloud synchronization via **Filen** integration (`@filen/sdk`).
- **Distance & Area Measurement**: On-map interactive tools to measure lines and multi-point paths.
- **Multi-Language Support**: Full internationalization with 60+ language localizations, automatic system language detection, English fallback, dynamic language switching without page reloads, and RTL language support.
- **Offline & PWA Ready**: Installable Progressive Web App (PWA) powered by a custom Vanilla Service Worker (`sw.js`) with dynamic versioning, app-shell precaching, and LRU-evicted tile caching (OpenFreeMap, OpenStreetMap, WaymarkedTrails, Elevation DEM).

---

## Project Structure

```text
maps/
├── css/
│   ├── HUD.css            # Navigation and HUD overlay styles
│   ├── account.css        # Settings, account, and cloud sync modal styles
│   └── style.css          # Core design system and Tailwind imports
├── js/
│   ├── AccountController.js    # User settings and Filen cloud sync integration
│   ├── ApiService.js           # External API calls (geocoding, routing)
│   ├── GPSController.js        # Geolocation tracking and heading updates
│   ├── HUDController.js        # Navigation HUD state and speed calculations
│   ├── MapService.js           # MapLibre initialization, layer control, and camera management
│   ├── MarkerController.js     # Saved places, custom pins, and marker interactions
│   ├── MeasurementController.js# Distance measurement tools
│   ├── RoutingController.js    # Route calculation, profiles, and path display
│   ├── SearchController.js     # Geocoding UI and search result handling
│   ├── ThemeController.js      # Dark/light theme switcher
│   ├── TranslationController.js# Dynamic i18n controller, language switcher, and fallback chains
│   ├── app.js                  # Main application orchestrator & initialization
│   ├── db.js                   # Local database storage wrapper (PouchDB)
│   └── pwa.js                  # Service Worker lifecycle registration and update reloader
├── languages/                  # i18n translation JSON files (60+ languages)
├── templates/                  # Modular Handlebars HTML partial templates
├── img/                        # App icons and static images
├── index.html                  # Main application HTML entry point
├── privacy.html                # Privacy policy page
├── terms.html                  # Terms of service page
├── manifest.json               # Web App Manifest configuration
├── sw.js                       # Vanilla Service Worker (precaching, asset & tile caching strategies)
├── package.json                # Project dependencies and npm scripts
└── vite.config.js              # Vite build setup, SW version injection, and Handlebars plugin
```

---

## How to Self Host

### Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** (comes bundled with Node.js)

### 1. Clone & Install Dependencies

Clone the repository to your server or local machine:

```bash
git clone https://github.com/your-username/maps.git
cd maps
npm install
```

### 2. Development Server

To run the application locally in development mode with live reload:

```bash
npm run dev
```

The application will be accessible at `http://localhost:5173`.

### 3. Build for Production

To create a static production build:

```bash
npm run build
```

This compiles optimized assets into the `dist/` directory.

To test the production build locally:

```bash
npm run preview
```

### 4. Deploying Static Files

Since **Maps** is a client-side application, you can host the generated `dist/` folder using any static web server:

#### **Nginx**

Example server block:

```nginx
server {
    listen 80;
    server_name maps.example.com;

    root /var/www/maps/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }
}
```

#### **Caddy**

Simple Caddyfile setup:

```caddy
maps.example.com {
    root * /var/www/maps/dist
    file_server
    try_files {path} /index.html
}
```

#### **Docker (Static Nginx Server)**

You can also host using Docker. Create a `Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run the container:

```bash
docker build -t maps-app .
docker run -d -p 8080:80 --name maps-app maps-app
```

---

## License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.
