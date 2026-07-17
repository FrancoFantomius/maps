# maps — Interactive Map Platform
**Beta**: This project is currently in beta and may contain bugs or incomplete features.

A modern, high-performance, and feature-rich interactive map application built with **MapLibre GL JS**, **Tailwind CSS**, and vanilla ES modules. The platform delivers a premium, responsive user interface with support for multiple map styles, saved places, routing engine, distance measurements, dark mode, and real-time POI information retrieval.

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

## File Architecture & Component Documentation

The application is modularly structured into ES modules, separating concerns between user interface controls, map services, APIs, and functional utilities:

### Core Files
- **[`index.html`](file:///c:/Users/franc/OneDrive/Programmazione/maps/index.html)**: The single-page application entry point. Houses the map container, imports UI scripts and styles, and declares HTML/Tailwind templates used dynamically for autocomplete lists, search items, place details, and navigation step listings.
- **[`css/style.css`](./css/style.css)**: Custom stylesheets detailing variables, glassmorphism layouts, custom SVG map pin scaling/placements, custom marker popups, and the GPS pulse animation.
- **[`js/app.js`](./js/app.js)**: The core JavaScript orchestrator. Boots components, binds DOM events, and coordinates parallel queries for Nominatim address lookup, Overpass API local features, and Wikipedia article details.

### Service Modules
- **[`js/MapService.js`](./js/MapService.js)**: The primary facade wrapper for MapLibre GL JS. Sets up vector layer styles (Liberty/Dark via OpenFreeMap), Esri Satellite base raster tiles, cycling path overlays, 3D building extrusions, and 3D terrain integration.
- **[`js/ApiService.js`](./js/ApiService.js)**: Aggregates external API queries, including geocoding (Nominatim), Wikipedia query summaries, Overpass API queries, and routing (OSRM).

### Controller Modules
- **[`js/HUDController.js`](./js/HUDController.js)**: Manages visibility and dynamic DOM rendering of the main Head-Up Display panel views (Saved Places, Search Results, Distance Measurements, OSRM Navigation, and Place details templates).
- **[`js/MarkerController.js`](./js/MarkerController.js)**: Coordinates custom-created map markers ("My Places"). Supports custom categories (POI, Food, Lodging, Nature), manages `localStorage` persistence, and binds details page actions (save, edit, delete).
- **[`js/RoutingController.js`](./js/RoutingController.js)**: Integrates OSRM-based navigation. Handles profile selection (driving, cycling, walking), geocoded waypoint search autocomplete, waypoint swapping, dragging of endpoints, alternative routes, and turn-by-turn directions.
- **[`js/MeasurementController.js`](./js/MeasurementController.js)**: Operates the linear path distance tool. Draws path lines between interactive, draggable nodes and computes geodesic distance totals.
- **[`js/SearchController.js`](./js/SearchController.js)**: Performs query geocoding searches and manages mapping of selected search items into active temporary pins.
- **[`js/ThemeController.js`](./js/ThemeController.js)**: Updates class preferences (Light, Dark, and System Default) and triggers corresponding tile style updates (Liberty/Dark vector tiles).
- **[`js/GPSController.js`](./js/GPSController.js)**: Connects to the browser's Geolocation API to pan map location, draw accuracy circles, and place custom animated user markers.

---

## License & Attributions

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for the full text.

### Third-Party Software & Data Attributions
- **MapLibre GL JS:** BSD 3-Clause License © MapLibre contributors
- **Map Data:** © OpenStreetMap contributors (ODbL)
- **Map Styles:** CartoDB (Carto Light/Dark) & Esri World Imagery
- **Routing Services:** Project OSRM API
- **Data APIs:** Overpass API (OSM Data queries) & Wikimedia/Wikipedia API
