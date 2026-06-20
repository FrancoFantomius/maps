# maps — Interactive Map Platform
**Beta**: This project is currently in beta and may contain bugs or incomplete features.

A modern, high-performance, and feature-rich interactive map application built with **Leaflet.js**, **Tailwind CSS**, and vanilla ES modules. The platform delivers a premium, responsive user interface with support for multiple map styles, saved places, routing engine, distance measurements, dark mode, and real-time POI information retrieval.

---

## Features

- **Multiple Map Modes**
  - **Street Map:** Clean, high-performance vector-like layout powered by OpenStreetMap & CartoDB.
  - **Satellite View:** High-resolution global satellite imagery powered by Esri.
  - **Detailed Overlays:** Easily toggle Street Names and Bike Paths on top of your base map.

- **Custom Markers (My Places)**
  - Click anywhere on the map to place a pin.
  - Save custom spots with a name, description, and custom categories (Point of Interest, Food & Drink, Lodging, Nature / Scenic).
  - Saved locations are persistent across reloads via browser `localStorage`.

- **Location Search & Geocoding**
  - Full-text search for addresses, cities, landmarks, and coordinates powered by Nominatim OpenStreetMap API.
  - Beautiful visual presentation of search results inside the dynamic HUD.

- **OSRM Routing Engine**
  - Compute routes between start and end waypoints clicked on the map.
  - Multi-profile support: **Driving (Car)**, **Cycling (Bike)**, and **Walking (Foot)**.
  - Displays real-time estimated distance and travel duration.

- **Distance Measurement Tool**
  - Place sequential markers on the map to measure linear distances.
  - Dynamically calculates and displays cumulative distance path in kilometers.

- **Real-Time POI & Path Details**
  - Click any point to fetch live address geocoding, nearby Wikipedia articles, and neighborhood shop details via Overpass API.
  - Automatic trail/street path highlight glows when clicking near roads or hiking paths.

- **Modern Dark Mode & Themes**
  - Integrated theme switcher supporting **Light**, **Dark**, and **System** themes.
  - Fully animated, modern floating Glassmorphism HUD styling.

- **GPS & Home Location**
  - One-click geo-location centering using the browser's Geolocation API.
  - Configure a custom "Home View" coordinates center, saved securely in your browser settings.

---

## Architecture & Modules

The application is structured cleanly using HTML5, modern Tailwind CSS, and modular ES6 JavaScript:

```
maps/
├── css/
│   └── style.css            # Custom CSS animations & Leaflet style overrides
├── img/
│   ├── icon.svg             # Application squircle vector favicon
│   └── search_icon.svg      # Search bar brand visual
├── js/
│   ├── app.js               # Main orchestrator & click/event listeners
│   ├── state.js             # Global reactive state management
│   ├── map.js               # Leaflet initialization, layer toggles, and base layers
│   ├── markers.js           # Pins generation, editing, storage, and rendering
│   ├── measure.js           # Polyline drawing & distance calculations
│   ├── routing.js           # Route calculations using OSRM API & polyline rendering
│   ├── search.js            # Search response parsing and list injection
│   ├── gps.js               # Geolocation triggers and centering
│   ├── hud.js               # HUD layout state machine (Details, Search, Routing, Places)
│   ├── theme.js             # System & user-defined theme sync
│   └── toast.js             # Bottom popup notifier helper
├── index.html               # Main application layout and Tailwind settings
├── LICENSE                  # MIT License & Third-Party Attributions
└── README.md                # Project documentation
```

---

## Getting Started

### Prerequisites

Since the project is built using native **ES Modules**, you need to run it through a local development server to bypass CORS restrictions for module imports.

### Running Locally

1. Clone or download this repository.
2. Open your terminal in the project directory.
3. Start a local development server (e.g., using Python, Node.js, or VS Code's Live Server):
   
   **Using Python 3:**
   ```bash
   python -m http.server 8000
   ```
   **Using Node.js (`npx`):**
   ```bash
   npx serve .
   ```
4. Open your browser and navigate to `http://localhost:8000` (or the port specified by your server).

---

## License & Attributions

This project is licensed under the **MIT License** — see the [LICENSE](file:///c:/Users/franc/OneDrive/Programmazione/2026/maps/LICENSE) file for the full text.

### Third-Party Software & Data Attributions
- **Leaflet.js:** BSD 2-Clause License © Volodymyr Agafonkin
- **Map Data:** © OpenStreetMap contributors (ODbL)
- **Map Styles:** CartoDB (Carto Light/Dark) & Esri World Imagery
- **Routing Services:** Project OSRM API
- **Data APIs:** Overpass API (OSM Data queries) & Wikimedia/Wikipedia API
