// maps Map Engine Module (Facade Pattern) - js/MapService.js

import maplibregl from 'maplibre-gl';
import { MarkerController } from './MarkerController.js';
import { MeasurementController } from './MeasurementController.js';
import { RoutingController } from './RoutingController.js';
import { GPSController } from './GPSController.js';
import { ApiService } from './ApiService.js';
import { DarkMapStyle } from './DarkMapStyle.js';

const STORAGE_KEY_LAYER = 'maps_active_layer';
const STORAGE_KEY_LABELS = 'maps_labels_enabled';

export const MapService = {
    map: null,
    activeLayerKey: 'street',
    activeOverlays: { labels: false, bike: false, perspective: false },
    highlightedPathCoords: null,

    init() {
        let initialLat = 45.4064; // DEFAULT_LAT
        let initialLng = 11.8768; // DEFAULT_LNG
        let initialZoom = 13;
        const DEFAULT_ZOOM = 13;
        const MIN_ZOOM = 3;
        const MAX_ZOOM = 18;

        // Synchronously check Step 2 (last position) and Step 3 (home address) for initial map creation
        const lastPos = this.getLastPosition();
        const savedHome = this.getHomeAddress();

        if (lastPos) {
            initialLat = lastPos.lat;
            initialLng = lastPos.lng;
            if (typeof lastPos.zoom === 'number') {
                initialZoom = lastPos.zoom;
            }
        } else if (savedHome) {
            initialLat = savedHome.lat;
            initialLng = savedHome.lng;
        }

        const savedLayer = localStorage.getItem(STORAGE_KEY_LAYER);
        this.activeLayerKey = (savedLayer === 'satellite') ? 'satellite' : 'street';

        const savedPerspective = localStorage.getItem('maps_perspective_enabled') === 'true';
        this.activeOverlays.perspective = savedPerspective;
        const initialPitch = savedPerspective ? 45 : 0;

        const savedBearing = localStorage.getItem('maps_bearing');
        const initialBearing = savedBearing ? parseFloat(savedBearing) : 0;

        const isDark = document.documentElement.classList.contains('dark');
        const initialStyle = isDark ? DarkMapStyle : 'https://tiles.openfreemap.org/styles/liberty';
        this.currentStyleUrl = initialStyle;

        this.map = new maplibregl.Map({
            container: 'map',
            style: initialStyle,
            center: [initialLng, initialLat],
            zoom: initialZoom,
            minZoom: MIN_ZOOM,
            maxZoom: MAX_ZOOM,
            pitch: initialPitch,
            bearing: initialBearing,
            antialias: true
        });

        this.map.addControl(new maplibregl.NavigationControl({ showCompass: false, showZoom: true }), 'bottom-left');

        this.map.on('load', () => {
            this.setupMapLayersAndSources();
        });

        this.map.on('style.load', () => {
            this.setupMapLayersAndSources();
        });

        this.map.on('rotate', () => {
            const bearing = this.getBearing();
            const compassNeedle = document.getElementById('compass-needle');
            if (compassNeedle) {
                compassNeedle.style.transform = `rotate(${-bearing}deg)`;
            }

            const btnCompass = document.getElementById('btn-compass');
            if (btnCompass) {
                if (Math.round(bearing) !== 0) {
                    btnCompass.classList.add('border-indigo-500', 'text-indigo-600', 'dark:text-indigo-400');
                    btnCompass.classList.remove('border-slate-200/50', 'dark:border-slate-800/50', 'text-slate-700', 'dark:text-slate-350');
                } else {
                    btnCompass.classList.remove('border-indigo-500', 'text-indigo-600', 'dark:text-indigo-400');
                    btnCompass.classList.add('border-slate-200/50', 'dark:border-slate-800/50', 'text-slate-700', 'dark:text-slate-350');
                }
            }

            const bearingValue = document.getElementById('bearing-value');
            if (bearingValue) {
                bearingValue.textContent = `${Math.round(bearing)}°`;
            }

            const bearingSlider = document.getElementById('bearing-slider');
            if (bearingSlider) {
                bearingSlider.value = Math.round(bearing);
            }

            localStorage.setItem('maps_bearing', bearing);
        });

        this.map.on('pitch', () => {
            const pitch = this.getPitch();
            const pitchValue = document.getElementById('pitch-value');
            if (pitchValue) {
                pitchValue.textContent = `${Math.round(pitch)}°`;
            }
            const pitchSlider = document.getElementById('pitch-slider');
            if (pitchSlider) {
                pitchSlider.value = Math.round(pitch);
            }
        });

        this.map.on('moveend', () => {
            this.updateLayerSwitcherPreview();
            this.saveLastPosition();
        });

        // Determine main startup view using priority chain:
        // 1. Current position -> 2. Previous last position -> 3. Home address -> 4. IP position
        this.determineStartupView(lastPos, savedHome, DEFAULT_ZOOM);

        this.syncLayerSwitcherUI();
    },

    getLastPosition() {
        try {
            const saved = localStorage.getItem('maps_last_position');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn("Failed to parse last position from localStorage", e);
        }
        return null;
    },

    saveLastPosition() {
        if (!this.map) return;
        try {
            const center = this.map.getCenter();
            const zoom = this.map.getZoom();
            const pos = {
                lat: center.lat,
                lng: center.lng,
                zoom: zoom
            };
            localStorage.setItem('maps_last_position', JSON.stringify(pos));
        } catch (e) {
            console.warn("Failed to save last position to localStorage", e);
        }
    },

    getLocalCountryLocation() {
        const timeZone = (typeof Intl !== 'undefined' && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
        const lang = (navigator.language || (navigator.languages && navigator.languages[0]) || '').toLowerCase();

        const tzMap = {
            'Europe/Rome': { lat: 41.8719, lng: 12.5674, zoom: 6, country: 'Italy' },
            'Europe/San_Marino': { lat: 43.9424, lng: 12.4578, zoom: 10, country: 'San Marino' },
            'Europe/Vatican': { lat: 41.9029, lng: 12.4534, zoom: 12, country: 'Vatican City' },
            'Europe/Paris': { lat: 46.2276, lng: 2.2137, zoom: 6, country: 'France' },
            'Europe/Berlin': { lat: 51.1657, lng: 10.4515, zoom: 6, country: 'Germany' },
            'Europe/London': { lat: 55.3781, lng: -3.4360, zoom: 6, country: 'United Kingdom' },
            'Europe/Madrid': { lat: 40.4637, lng: -3.7492, zoom: 6, country: 'Spain' },
            'Europe/Vienna': { lat: 47.5162, lng: 14.5501, zoom: 7, country: 'Austria' },
            'Europe/Zurich': { lat: 46.8182, lng: 8.2275, zoom: 8, country: 'Switzerland' },
            'Europe/Amsterdam': { lat: 52.1326, lng: 5.2913, zoom: 7, country: 'Netherlands' },
            'Europe/Brussels': { lat: 50.5039, lng: 4.4699, zoom: 8, country: 'Belgium' },
            'Europe/Lisbon': { lat: 39.3999, lng: -8.2245, zoom: 7, country: 'Portugal' },
            'Europe/Athens': { lat: 39.0742, lng: 21.8243, zoom: 6, country: 'Greece' },
            'Europe/Warsaw': { lat: 51.9194, lng: 19.1451, zoom: 6, country: 'Poland' },
            'Europe/Prague': { lat: 49.8175, lng: 15.4730, zoom: 7, country: 'Czech Republic' },
            'Europe/Budapest': { lat: 47.1625, lng: 19.5033, zoom: 7, country: 'Hungary' },
            'Europe/Stockholm': { lat: 60.1282, lng: 18.6435, zoom: 5, country: 'Sweden' },
            'Europe/Oslo': { lat: 60.4720, lng: 8.4689, zoom: 5, country: 'Norway' },
            'Europe/Copenhagen': { lat: 56.2639, lng: 9.5018, zoom: 7, country: 'Denmark' },
            'Europe/Helsinki': { lat: 61.9241, lng: 25.7482, zoom: 5, country: 'Finland' },
            'Europe/Dublin': { lat: 53.4129, lng: -8.2439, zoom: 7, country: 'Ireland' },
            'Europe/Bucharest': { lat: 45.9432, lng: 24.9668, zoom: 6, country: 'Romania' },
            'Europe/Sofia': { lat: 42.7339, lng: 25.4858, zoom: 7, country: 'Bulgaria' },
            'Europe/Zagreb': { lat: 45.1000, lng: 15.2000, zoom: 7, country: 'Croatia' },
            'Europe/Ljubljana': { lat: 46.1512, lng: 14.9955, zoom: 8, country: 'Slovenia' },
            'Europe/Bratislava': { lat: 48.6690, lng: 19.6990, zoom: 8, country: 'Slovakia' },
            'America/New_York': { lat: 40.7128, lng: -74.0060, zoom: 5, country: 'United States' },
            'America/Chicago': { lat: 41.8781, lng: -87.6298, zoom: 5, country: 'United States' },
            'America/Denver': { lat: 39.7392, lng: -104.9903, zoom: 5, country: 'United States' },
            'America/Los_Angeles': { lat: 34.0522, lng: -118.2437, zoom: 5, country: 'United States' },
            'America/Toronto': { lat: 43.6532, lng: -79.3832, zoom: 5, country: 'Canada' },
            'America/Vancouver': { lat: 49.2827, lng: -123.1207, zoom: 5, country: 'Canada' },
            'America/Mexico_City': { lat: 19.4326, lng: -99.1332, zoom: 5, country: 'Mexico' },
            'America/Sao_Paulo': { lat: -23.5505, lng: -46.6333, zoom: 5, country: 'Brazil' },
            'America/Buenos_Aires': { lat: -34.6037, lng: -58.3816, zoom: 5, country: 'Argentina' },
            'Asia/Tokyo': { lat: 36.2048, lng: 138.2529, zoom: 5, country: 'Japan' },
            'Asia/Seoul': { lat: 35.9078, lng: 127.7669, zoom: 7, country: 'South Korea' },
            'Asia/Shanghai': { lat: 35.8617, lng: 104.1954, zoom: 4, country: 'China' },
            'Asia/Singapore': { lat: 1.3521, lng: 103.8198, zoom: 11, country: 'Singapore' },
            'Asia/Kolkata': { lat: 20.5937, lng: 78.9629, zoom: 4, country: 'India' },
            'Asia/Dubai': { lat: 23.4241, lng: 53.8478, zoom: 7, country: 'United Arab Emirates' },
            'Australia/Sydney': { lat: -25.2744, lng: 133.7751, zoom: 4, country: 'Australia' }
        };

        if (timeZone && tzMap[timeZone]) {
            return tzMap[timeZone];
        }

        if (timeZone.startsWith('Europe/')) return { lat: 54.5260, lng: 15.2551, zoom: 4, country: 'Europe' };
        if (timeZone.startsWith('America/')) return { lat: 37.0902, lng: -95.7129, zoom: 4, country: 'North America' };
        if (timeZone.startsWith('Asia/')) return { lat: 34.0479, lng: 100.6197, zoom: 3, country: 'Asia' };

        if (lang.startsWith('it')) return { lat: 41.8719, lng: 12.5674, zoom: 6, country: 'Italy' };
        if (lang.startsWith('fr')) return { lat: 46.2276, lng: 2.2137, zoom: 6, country: 'France' };
        if (lang.startsWith('de')) return { lat: 51.1657, lng: 10.4515, zoom: 6, country: 'Germany' };
        if (lang.startsWith('es')) return { lat: 40.4637, lng: -3.7492, zoom: 6, country: 'Spain' };

        return { lat: 45.4064, lng: 11.8768, zoom: 6, country: 'Default Region' };
    },

    async determineStartupView(lastPos, savedHome, defaultZoom = 13) {
        // Step 1: Current position
        if (navigator.geolocation) {
            try {
                const currentPos = await new Promise((resolve) => {
                    let done = false;
                    const timer = setTimeout(() => {
                        if (!done) {
                            done = true;
                            resolve(null);
                        }
                    }, 4000);

                    navigator.geolocation.getCurrentPosition(
                        (p) => {
                            if (!done) {
                                done = true;
                                clearTimeout(timer);
                                resolve({ lat: p.coords.latitude, lng: p.coords.longitude });
                            }
                        },
                        (err) => {
                            if (!done) {
                                done = true;
                                clearTimeout(timer);
                                resolve(null);
                            }
                        },
                        { timeout: 4000, enableHighAccuracy: false }
                    );
                });

                if (currentPos) {
                    this.flyTo([currentPos.lng, currentPos.lat], defaultZoom);
                    return;
                }
            } catch (e) {
                console.warn("Geolocation startup check failed", e);
            }
        }

        // Step 2: Previous last position (already initialized if present)
        if (lastPos) {
            return;
        }

        // Step 3: Home address (already initialized if present)
        if (savedHome) {
            return;
        }

        // Step 4: Position determined by country/locale without calling external services
        const countryLoc = this.getLocalCountryLocation();
        if (countryLoc) {
            this.flyTo([countryLoc.lng, countryLoc.lat], countryLoc.zoom || 6);
        }
    },

    ensureTerrainSource() {
        if (!this.map) return;
        if (!this.map.getSource('terrain-source')) {
            this.map.addSource('terrain-source', {
                type: 'raster-dem',
                tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
                tileSize: 256,
                encoding: 'terrarium'
            });
        }
    },

    setupMapLayersAndSources() {
        if (!this.map) return;

        // 1. Add satellite source and layer
        if (!this.map.getSource('satellite-source')) {
            this.map.addSource('satellite-source', {
                type: 'raster',
                tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                attribution: 'Tiles &copy; Esri'
            });
        }

        const layers = this.map.getStyle().layers;
        let firstLayerId = null;
        if (layers) {
            for (const layer of layers) {
                if (layer.type !== 'background') {
                    firstLayerId = layer.id;
                    break;
                }
            }
        }

        if (!this.map.getLayer('satellite-layer')) {
            this.map.addLayer({
                id: 'satellite-layer',
                type: 'raster',
                source: 'satellite-source',
                layout: {
                    visibility: this.activeLayerKey === 'satellite' ? 'visible' : 'none'
                }
            }, firstLayerId);
        }

        // 2. Add bike paths overlay
        if (!this.map.getSource('bike-source')) {
            this.map.addSource('bike-source', {
                type: 'raster',
                tiles: ['https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: 'Bike paths &copy; Waymarked Trails'
            });
        }
        if (!this.map.getLayer('bike-layer')) {
            this.map.addLayer({
                id: 'bike-layer',
                type: 'raster',
                source: 'bike-source',
                layout: {
                    visibility: this.activeOverlays.bike ? 'visible' : 'none'
                },
                paint: {
                    'raster-opacity': 0.75
                }
            });
        }

        // 3. Add 3D buildings layer
        if (!this.map.getLayer('3d-buildings')) {
            const isDark = document.documentElement.classList.contains('dark');
            this.map.addLayer({
                id: '3d-buildings',
                source: 'openmaptiles',
                'source-layer': 'building',
                type: 'fill-extrusion',
                minzoom: 15,
                layout: {
                    visibility: this.activeOverlays.perspective ? 'visible' : 'none'
                },
                paint: {
                    'fill-extrusion-color': [
                        'interpolate',
                        ['linear'],
                        ['coalesce', ['get', 'render_height'], ['get', 'height'], 15],
                        0, isDark ? '#1e293b' : '#f1f5f9',
                        30, isDark ? '#2e3f56' : '#cbd5e1',
                        100, isDark ? '#3d526e' : '#94a3b8',
                        300, isDark ? '#4f688a' : '#64748b'
                    ],
                    'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 0],
                    'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
                    'fill-extrusion-opacity': 0.85,
                    'fill-extrusion-vertical-gradient': true
                }
            });

            this.map.setLight({
                anchor: 'viewport',
                color: '#ffffff',
                intensity: 0.45,
                position: [1.5, 210, 30]
            });
        }

        // 4. Add 3D Terrain
        this.ensureTerrainSource();
        if (this.activeOverlays.perspective && this.map.getSource('terrain-source')) {
            this.map.setTerrain({ source: 'terrain-source', exaggeration: 1.2 });
        } else {
            this.map.setTerrain(null);
        }

        this.setAllExtrusionsVisibility(this.activeOverlays.perspective);

        // 5. Add route layers and sources
        if (!this.map.getSource('route-source')) {
            this.map.addSource('route-source', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }
        if (!this.map.getLayer('route-outline')) {
            this.map.addLayer({
                id: 'route-outline',
                source: 'route-source',
                type: 'line',
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': '#1a5cc8',
                    'line-width': 9,
                    'line-opacity': 0.4
                }
            });
        }
        if (!this.map.getLayer('route-main')) {
            this.map.addLayer({
                id: 'route-main',
                source: 'route-source',
                type: 'line',
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': '#4285F4',
                    'line-width': 6,
                    'line-opacity': 0.9
                }
            });
        }

        if (!this.map.getSource('alternative-routes-source')) {
            this.map.addSource('alternative-routes-source', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }
        if (!this.map.getLayer('alternative-routes-layer')) {
            this.map.addLayer({
                id: 'alternative-routes-layer',
                source: 'alternative-routes-source',
                type: 'line',
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': '#9AA0A6',
                    'line-width': 5,
                    'line-opacity': 0.5
                }
            });
        }

        // 6. Add measurement line layers and sources
        if (!this.map.getSource('measure-source')) {
            this.map.addSource('measure-source', {
                type: 'geojson',
                data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }
            });
        }
        if (!this.map.getLayer('measure-line-layer')) {
            this.map.addLayer({
                id: 'measure-line-layer',
                source: 'measure-source',
                type: 'line',
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': '#14b8a6',
                    'line-width': 4,
                    'line-dasharray': [2, 2]
                }
            });
        }

        // 7. Add street highlighting path layer
        if (!this.map.getSource('highlight-path-source')) {
            this.map.addSource('highlight-path-source', {
                type: 'geojson',
                data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }
            });
        }
        if (!this.map.getLayer('highlight-path-bg')) {
            this.map.addLayer({
                id: 'highlight-path-bg',
                source: 'highlight-path-source',
                type: 'line',
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': '#6366f1',
                    'line-width': 10,
                    'line-opacity': 0.4
                }
            });
        }
        if (!this.map.getLayer('highlight-path-fg')) {
            this.map.addLayer({
                id: 'highlight-path-fg',
                source: 'highlight-path-source',
                type: 'line',
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': '#4f46e5',
                    'line-width': 3,
                    'line-opacity': 0.9
                }
            });
        }

        // 8. Add GPS source & pulsing indicator layer
        if (!this.map.getSource('gps-source')) {
            this.map.addSource('gps-source', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }
        if (!this.map.getLayer('gps-accuracy-layer')) {
            this.map.addLayer({
                id: 'gps-accuracy-layer',
                source: 'gps-source',
                type: 'circle',
                paint: {
                    'circle-radius': ['get', 'accuracy_pixels'],
                    'circle-color': '#10b981',
                    'circle-opacity': 0.15,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#10b981',
                    'circle-stroke-opacity': 0.4
                }
            });
        }

        this.setLabelsVisibility(this.activeOverlays.labels);
        this.updateStyleLayersVisibility();
        this.restoreActiveLayerData();
    },

    restoreActiveLayerData() {
        if (!this.map) return;

        // Restore linear distance measurement
        if (MeasurementController.measurePoints && MeasurementController.measurePoints.length > 0) {
            this.updateSourceData('measure-source', {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: MeasurementController.measurePoints.map(p => [p.lng, p.lat])
                }
            });
        }

        // Restore routing path
        if (RoutingController.currentRouteGeoJSON) {
            this.updateSourceData('route-source', RoutingController.currentRouteGeoJSON);
        }
        if (RoutingController.currentAlternativesGeoJSON) {
            this.updateSourceData('alternative-routes-source', RoutingController.currentAlternativesGeoJSON);
        }

        // Restore street highlighted path
        if (this.highlightedPathCoords) {
            this.updateSourceData('highlight-path-source', {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: this.highlightedPathCoords
                }
            });
        }

        // Restore GPS Position indicator
        if (GPSController.gpsCoords && GPSController.gpsAccuracy !== undefined) {
            const pixels = this.metersToPixels(GPSController.gpsAccuracy, GPSController.gpsCoords.lat, this.getZoom());
            this.updateSourceData('gps-source', {
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    properties: { accuracy_pixels: pixels },
                    geometry: {
                        type: 'Point',
                        coordinates: [GPSController.gpsCoords.lng, GPSController.gpsCoords.lat]
                    }
                }]
            });
        }
    },

    metersToPixels(meters, latitude, zoom) {
        const earthCircumference = 40075017;
        const latitudeRad = latitude * Math.PI / 180;
        const metersPerPixel = (earthCircumference * Math.cos(latitudeRad)) / Math.pow(2, zoom + 8);
        return meters / metersPerPixel;
    },

    getTileUrl(layerKey, zoom, lat, lng) {
        const n = Math.pow(2, zoom);
        const x = Math.max(0, Math.min(n - 1, Math.floor(((lng + 180) / 360) * n)));
        const latRad = (lat * Math.PI) / 180;
        const y = Math.max(0, Math.min(n - 1, Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)));

        if (layerKey === 'satellite') {
            return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
        }
        return `https://a.tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
    },

    updateLayerSwitcherPreview() {
        if (!this.map) return;
        const center = this.map.getCenter();
        const zoom = Math.min(Math.floor(this.map.getZoom()), 15);
        const lat = center.lat;
        const lng = center.lng;

        const previewImg = document.getElementById('layer-toggle-preview');
        if (!previewImg) return;

        const otherLayer = this.activeLayerKey === 'street' ? 'satellite' : 'street';
        previewImg.src = this.getTileUrl(otherLayer, zoom, lat, lng);
    },

    syncLayerSwitcherUI() {
        const label = document.getElementById('layer-toggle-label');
        const labelsBtn = document.getElementById('layer-labels-btn');

        if (label) {
            label.textContent = this.activeLayerKey === 'street' ? 'Satellite' : 'Map';
        }

        if (labelsBtn) {
            if (this.activeLayerKey === 'satellite') {
                labelsBtn.classList.remove('hidden');
            } else {
                labelsBtn.classList.add('hidden');
            }
        }

        this.syncLabelsButtonState();
    },

    syncLabelsButtonState() {
        const labelsBtn = document.getElementById('layer-labels-btn');
        const overlayToggle = document.getElementById('toggle-overlay-labels');
        if (!labelsBtn) return;

        if (this.activeOverlays.labels) {
            labelsBtn.classList.add('active');
        } else {
            labelsBtn.classList.remove('active');
        }

        if (overlayToggle) {
            overlayToggle.checked = this.activeOverlays.labels;
        }
    },

    syncPerspectiveButtonState() {
        const btn = document.getElementById('btn-perspective');
        if (!btn) return;
        const isActive = this.activeOverlays.perspective;
        if (isActive) {
            btn.className = 'group flex items-center justify-center w-12 h-12 bg-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl hover:bg-indigo-500 transition-all duration-300 relative border border-indigo-500';
        } else {
            btn.className = 'group flex items-center justify-center w-12 h-12 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-full shadow-lg hover:shadow-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all duration-300 relative';
        }
    },

    initOverlays() {
        const savedLabels = localStorage.getItem(STORAGE_KEY_LABELS);
        this.activeOverlays.labels = (savedLabels === 'true' || savedLabels === null);
        this.setLabelsVisibility(this.activeOverlays.labels);
        this.syncLabelsButtonState();

        const overlayTogglePerspective = document.getElementById('toggle-overlay-perspective');
        if (overlayTogglePerspective) {
            overlayTogglePerspective.checked = this.activeOverlays.perspective;
        }

        this.syncPerspectiveButtonState();
    },

    setBaseLayer(layerKey) {
        if (this.activeLayerKey === layerKey) return;
        this.activeLayerKey = layerKey;

        localStorage.setItem(STORAGE_KEY_LAYER, layerKey);

        this.updateStyleLayersVisibility();
        this.syncLayerSwitcherUI();
        this.updateLayerSwitcherPreview();
    },

    updateStyleLayersVisibility() {
        if (!this.map) return;
        const style = this.map.getStyle();
        if (!style || !style.layers) return;

        const isSatellite = this.activeLayerKey === 'satellite';

        style.layers.forEach(layer => {
            if (layer.id === 'satellite-layer') {
                this.map.setLayoutProperty(layer.id, 'visibility', isSatellite ? 'visible' : 'none');
                return;
            }

            if (layer.type === 'fill' && layer.id !== 'satellite-layer') {
                this.map.setLayoutProperty(layer.id, 'visibility', isSatellite ? 'none' : 'visible');
            }
        });
    },

    toggleOverlay(key, show) {
        this.activeOverlays[key] = show;

        if (key === 'labels') {
            this.setLabelsVisibility(show);
            localStorage.setItem(STORAGE_KEY_LABELS, show ? 'true' : 'false');
            this.syncLabelsButtonState();
        } else if (key === 'bike') {
            if (this.map && this.map.getLayer('bike-layer')) {
                this.map.setLayoutProperty('bike-layer', 'visibility', show ? 'visible' : 'none');
            }
            const overlayToggleBike = document.getElementById('toggle-overlay-bike');
            if (overlayToggleBike) {
                overlayToggleBike.checked = show;
            }
        } else if (key === 'perspective') {
            if (this.map) {
                this.setAllExtrusionsVisibility(show);
                if (show) {
                    this.ensureTerrainSource();
                    if (this.map.getSource('terrain-source')) {
                        this.map.setTerrain({ source: 'terrain-source', exaggeration: 1.2 });
                    }
                } else {
                    this.map.setTerrain(null);
                }
            }
            localStorage.setItem('maps_perspective_enabled', show ? 'true' : 'false');
            const overlayTogglePerspective = document.getElementById('toggle-overlay-perspective');
            if (overlayTogglePerspective) {
                overlayTogglePerspective.checked = show;
            }
            this.syncPerspectiveButtonState();
        }
    },

    setLabelsVisibility(show) {
        if (!this.map) return;
        const style = this.map.getStyle();
        if (!style || !style.layers) return;
        style.layers.forEach(layer => {
            if (layer.type === 'symbol') {
                this.map.setLayoutProperty(layer.id, 'visibility', show ? 'visible' : 'none');
            }
        });
    },

    setAllExtrusionsVisibility(show) {
        if (!this.map) return;
        const style = this.map.getStyle();
        if (!style || !style.layers) return;
        style.layers.forEach(layer => {
            if (layer.type === 'fill-extrusion') {
                this.map.setLayoutProperty(layer.id, 'visibility', show ? 'visible' : 'none');
            }
        });
    },

    setStyle(styleUrl) {
        let targetStyle = styleUrl;
        if (styleUrl === 'https://tiles.openfreemap.org/styles/dark') {
            targetStyle = DarkMapStyle;
        }
        if (this.map && this.currentStyleUrl !== targetStyle) {
            this.currentStyleUrl = targetStyle;
            this.map.setStyle(targetStyle);
        }
    },

    flyTo(center, zoom, duration) {
        if (this.map) {
            const config = { center };
            if (zoom !== undefined) config.zoom = zoom;
            if (duration !== undefined) config.duration = duration;
            this.map.flyTo(config);
        }
    },

    easeTo(bearing, pitch, duration) {
        if (this.map) {
            const config = {};
            if (bearing !== undefined) config.bearing = bearing;
            if (pitch !== undefined) config.pitch = pitch;
            if (duration !== undefined) config.duration = duration;
            this.map.easeTo(config);
        }
    },

    panTo(center) {
        if (this.map) this.map.panTo(center);
    },

    getBearing() {
        return this.map ? this.map.getBearing() : 0;
    },

    setBearing(bearing) {
        if (this.map) this.map.setBearing(bearing);
    },

    getPitch() {
        return this.map ? this.map.getPitch() : 0;
    },

    setPitch(pitch) {
        if (this.map) this.map.setPitch(pitch);
    },

    getZoom() {
        return this.map ? this.map.getZoom() : 0;
    },

    getContainer() {
        return this.map ? this.map.getContainer() : null;
    },

    updateSourceData(id, data) {
        if (this.map) {
            const source = this.map.getSource(id);
            if (source) {
                source.setData(data);
                return true;
            }
        }
        return false;
    },

    fitBounds(bounds, padding = 60) {
        if (this.map) {
            this.map.fitBounds(bounds, { padding });
        }
    },

    createMarker(element, draggable = false, anchor = 'center') {
        return new maplibregl.Marker({ element, draggable, anchor });
    },

    createPopup(options = {}) {
        return new maplibregl.Popup(options);
    },

    on(event, layerIdOrHandler, handler) {
        if (!this.map) return;
        if (typeof layerIdOrHandler === 'string') {
            this.map.on(event, layerIdOrHandler, handler);
        } else {
            this.map.on(event, layerIdOrHandler);
        }
    },

    queryRenderedFeatures(point, options) {
        return this.map ? this.map.queryRenderedFeatures(point, options) : [];
    },

    getHomeAddress() {
        const savedHomeAddress = localStorage.getItem('maps_home_address');
        if (savedHomeAddress) {
            try {
                const parsed = JSON.parse(savedHomeAddress);
                if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
                    return parsed;
                }
            } catch (e) {
                console.error("Failed to parse saved home address", e);
            }
        }
        return null;
    },

    setHomeAddress(data) {
        if (!data || typeof data.lat !== 'number' || typeof data.lng !== 'number') return null;
        const homeObj = {
            address: data.address || data.fullName || data.name || `${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}`,
            lat: data.lat,
            lng: data.lng,
            updatedAt: Date.now()
        };
        localStorage.setItem('maps_home_address', JSON.stringify(homeObj));
        return homeObj;
    },

    clearHomeAddress() {
        localStorage.removeItem('maps_home_address');
    },

    flyToHome() {
        const home = this.getHomeAddress();
        if (home) {
            this.flyTo([home.lng, home.lat], 15);
        }
    }
};
