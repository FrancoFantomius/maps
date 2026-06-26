// maps Map Engine Module using MapLibre GL JS

import { state, DEFAULT_LAT, DEFAULT_LNG, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from './state.js';

const STORAGE_KEY_LAYER = 'maps_active_layer';
const STORAGE_KEY_LABELS = 'maps_labels_enabled';

export function initMap() {
    let initialLat = DEFAULT_LAT;
    let initialLng = DEFAULT_LNG;

    const savedHome = localStorage.getItem('maps_home_coords');
    if (savedHome) {
        try {
            const parsed = JSON.parse(savedHome);
            if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
                initialLat = parsed.lat;
                initialLng = parsed.lng;
            }
        } catch (e) {
            console.error("Failed to parse saved home location", e);
        }
    }

    // Restore persisted layer preference (default: 'street')
    const savedLayer = localStorage.getItem(STORAGE_KEY_LAYER);
    const initialLayer = (savedLayer === 'satellite') ? 'satellite' : 'street';
    state.activeLayerKey = initialLayer;

    // Restore persisted perspective/pitch preference
    const savedPerspective = localStorage.getItem('maps_perspective_enabled') === 'true';
    state.activeOverlays.perspective = savedPerspective;
    const initialPitch = savedPerspective ? 45 : 0;

    // Restore persisted bearing preference (default: 0)
    const savedBearing = localStorage.getItem('maps_bearing');
    const initialBearing = savedBearing ? parseFloat(savedBearing) : 0;

    const isDark = document.documentElement.classList.contains('dark');
    const initialStyle = isDark ? 'https://tiles.openfreemap.org/styles/darkmatter' : 'https://tiles.openfreemap.org/styles/liberty';

    state.map = new maplibregl.Map({
        container: 'map',
        style: initialStyle,
        center: [initialLng, initialLat], // Note MapLibre uses [lng, lat]
        zoom: DEFAULT_ZOOM,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        pitch: initialPitch, // tilt for 3D structures and terrain
        bearing: initialBearing,
        antialias: true
    });

    // Add navigation control (zoom buttons)
    state.map.addControl(new maplibregl.NavigationControl({ showCompass: false, showZoom: true }), 'bottom-left');

    state.map.on('load', () => {
        setupMapLayersAndSources();
    });

    state.map.on('style.load', () => {
        setupMapLayersAndSources();
    });

    // Setup rotation state synchronization
    state.map.on('rotate', () => {
        const bearing = state.map.getBearing();
        
        // Update compass needle rotation (rotate opposite to match geo-North)
        const compassNeedle = document.getElementById('compass-needle');
        if (compassNeedle) {
            compassNeedle.style.transform = `rotate(${-bearing}deg)`;
        }

        // Highlight compass button when rotated
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

        // Update settings panel controls
        const bearingValue = document.getElementById('bearing-value');
        if (bearingValue) {
            bearingValue.textContent = `${Math.round(bearing)}°`;
        }

        const bearingSlider = document.getElementById('bearing-slider');
        if (bearingSlider) {
            bearingSlider.value = Math.round(bearing);
        }

        // Persist bearing choice
        localStorage.setItem('maps_bearing', bearing);
    });

    // Setup pitch/tilt state synchronization
    state.map.on('pitch', () => {
        const pitch = state.map.getPitch();
        const pitchValue = document.getElementById('pitch-value');
        if (pitchValue) {
            pitchValue.textContent = `${Math.round(pitch)}°`;
        }
        const pitchSlider = document.getElementById('pitch-slider');
        if (pitchSlider) {
            pitchSlider.value = Math.round(pitch);
        }

        // Auto-sync perspective toggle based on pitch
        const hasPerspective = pitch > 0;
        if (state.activeOverlays.perspective !== hasPerspective) {
            state.activeOverlays.perspective = hasPerspective;
            localStorage.setItem('maps_perspective_enabled', hasPerspective ? 'true' : 'false');
            
            if (state.map.getLayer('3d-buildings')) {
                state.map.setLayoutProperty('3d-buildings', 'visibility', hasPerspective ? 'visible' : 'none');
            }
            if (hasPerspective) {
                state.map.setTerrain({ source: 'terrain-source', exaggeration: 1.2 });
            } else {
                state.map.setTerrain(null);
            }

            const overlayTogglePerspective = document.getElementById('toggle-overlay-perspective');
            if (overlayTogglePerspective) {
                overlayTogglePerspective.checked = hasPerspective;
            }
        }
    });

    // Update layer switcher preview dynamically when map finishes moving
    state.map.on('moveend', updateLayerSwitcherPreview);

    // If there is no saved home location, attempt to geolocate on load
    if (!savedHome && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (state.map) {
                    state.map.flyTo({
                        center: [position.coords.longitude, position.coords.latitude],
                        zoom: DEFAULT_ZOOM
                    });
                }
            },
            (error) => {
                console.warn("Geolocation on startup failed or denied. Using default center.", error);
            },
            { timeout: 5000 }
        );
    }

    // Initialize the layer switcher UI to match the restored state
    syncLayerSwitcherUI();
}

export function setupMapLayersAndSources() {
    if (!state.map) return;

    // 1. Add satellite source and layer
    if (!state.map.getSource('satellite-source')) {
        state.map.addSource('satellite-source', {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Tiles &copy; Esri'
        });
    }

    // Find the first non-background layer to place the satellite imagery below vector labels and roads
    const layers = state.map.getStyle().layers;
    let firstLayerId = null;
    if (layers) {
        for (const layer of layers) {
            if (layer.type !== 'background') {
                firstLayerId = layer.id;
                break;
            }
        }
    }

    if (!state.map.getLayer('satellite-layer')) {
        state.map.addLayer({
            id: 'satellite-layer',
            type: 'raster',
            source: 'satellite-source',
            layout: {
                visibility: state.activeLayerKey === 'satellite' ? 'visible' : 'none'
            }
        }, firstLayerId);
    }

    // 2. Add bike paths overlay
    if (!state.map.getSource('bike-source')) {
        state.map.addSource('bike-source', {
            type: 'raster',
            tiles: ['https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: 'Bike paths &copy; Waymarked Trails'
        });
    }
    if (!state.map.getLayer('bike-layer')) {
        state.map.addLayer({
            id: 'bike-layer',
            type: 'raster',
            source: 'bike-source',
            layout: {
                visibility: state.activeOverlays.bike ? 'visible' : 'none'
            },
            paint: {
                'raster-opacity': 0.75
            }
        });
    }

    // 3. Add 3D buildings layer (fill-extrusion)
    if (!state.map.getLayer('3d-buildings')) {
        const isDark = document.documentElement.classList.contains('dark');
        state.map.addLayer({
            id: '3d-buildings',
            source: 'openmaptiles',
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 15,
            layout: {
                visibility: state.activeOverlays.perspective ? 'visible' : 'none'
            },
            paint: {
                // Premium realistic height-based shading
                'fill-extrusion-color': [
                    'interpolate',
                    ['linear'],
                    ['coalesce', ['get', 'render_height'], ['get', 'height'], 15],
                    0, isDark ? '#1e293b' : '#f1f5f9',    // small houses: warm light concrete / dark slate
                    30, isDark ? '#2e3f56' : '#cbd5e1',   // medium buildings: slate blue / mid-grey
                    100, isDark ? '#3d526e' : '#94a3b8',  // tall buildings: glass blue-grey
                    300, isDark ? '#4f688a' : '#64748b'   // skyscrapers: reflective light blue
                ],
                'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 0],
                'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
                'fill-extrusion-opacity': 0.85,
                'fill-extrusion-vertical-gradient': true // adds vertical shadow shading on building walls
            }
        });

        // Set global light source for realistic 3D shadow face shading
        state.map.setLight({
            anchor: 'viewport',
            color: '#ffffff',
            intensity: 0.45,
            position: [1.5, 210, 30] // Azimuthal angle and altitude to cast premium shading on facades
        });
    }

    // 4. Add 3D Terrain
    if (!state.map.getSource('terrain-source')) {
        state.map.addSource('terrain-source', {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            tileSize: 256,
            encoding: 'terrarium'
        });
    }
    if (state.activeOverlays.perspective) {
        state.map.setTerrain({ source: 'terrain-source', exaggeration: 1.2 });
    } else {
        state.map.setTerrain(null);
    }

    // 5. Add route layers and sources
    if (!state.map.getSource('route-source')) {
        state.map.addSource('route-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
    }
    if (!state.map.getLayer('route-outline')) {
        state.map.addLayer({
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
    if (!state.map.getLayer('route-main')) {
        state.map.addLayer({
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

    if (!state.map.getSource('alternative-routes-source')) {
        state.map.addSource('alternative-routes-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
    }
    if (!state.map.getLayer('alternative-routes-layer')) {
        state.map.addLayer({
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
    if (!state.map.getSource('measure-source')) {
        state.map.addSource('measure-source', {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }
        });
    }
    if (!state.map.getLayer('measure-line-layer')) {
        state.map.addLayer({
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
    if (!state.map.getSource('highlight-path-source')) {
        state.map.addSource('highlight-path-source', {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }
        });
    }
    if (!state.map.getLayer('highlight-path-bg')) {
        state.map.addLayer({
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
    if (!state.map.getLayer('highlight-path-fg')) {
        state.map.addLayer({
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
    if (!state.map.getSource('gps-source')) {
        state.map.addSource('gps-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
    }
    if (!state.map.getLayer('gps-accuracy-layer')) {
        state.map.addLayer({
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

    // Apply active overlay controls
    setLabelsVisibility(state.activeOverlays.labels);

    updateStyleLayersVisibility();

    restoreActiveLayerData();
}

function restoreActiveLayerData() {
    if (!state.map) return;

    // Restore linear distance measurement
    if (state.measurePoints && state.measurePoints.length > 0) {
        const source = state.map.getSource('measure-source');
        if (source) {
            source.setData({
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: state.measurePoints.map(p => [p.lng, p.lat])
                }
            });
        }
    }

    // Restore routing path
    if (state.currentRouteGeoJSON) {
        const source = state.map.getSource('route-source');
        if (source) source.setData(state.currentRouteGeoJSON);
    }
    if (state.currentAlternativesGeoJSON) {
        const source = state.map.getSource('alternative-routes-source');
        if (source) source.setData(state.currentAlternativesGeoJSON);
    }

    // Restore street highlighted path
    if (state.highlightedPathCoords) {
        const source = state.map.getSource('highlight-path-source');
        if (source) {
            source.setData({
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: state.highlightedPathCoords
                }
            });
        }
    }

    // Restore GPS Position indicator
    if (state.gpsCoords && state.gpsAccuracy !== undefined) {
        // Calculate dynamic circle radius in pixels based on accuracy in meters at current zoom level
        const pixels = metersToPixels(state.gpsAccuracy, state.gpsCoords.lat, state.map.getZoom());
        const source = state.map.getSource('gps-source');
        if (source) {
            source.setData({
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    properties: { accuracy_pixels: pixels },
                    geometry: {
                        type: 'Point',
                        coordinates: [state.gpsCoords.lng, state.gpsCoords.lat]
                    }
                }]
            });
        }
    }
}

// Convert meters to pixel radius at a specific zoom and latitude (approximate helper)
export function metersToPixels(meters, latitude, zoom) {
    const earthCircumference = 40075017;
    const latitudeRad = latitude * Math.PI / 180;
    const metersPerPixel = (earthCircumference * Math.cos(latitudeRad)) / Math.pow(2, zoom + 8);
    return meters / metersPerPixel;
}

function getTileUrl(layerKey, zoom, lat, lng) {
    const n = Math.pow(2, zoom);
    const x = Math.max(0, Math.min(n - 1, Math.floor(((lng + 180) / 360) * n)));
    const latRad = (lat * Math.PI) / 180;
    const y = Math.max(0, Math.min(n - 1, Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)));

    if (layerKey === 'satellite') {
        return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
    }
    return `https://a.tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

export function updateLayerSwitcherPreview() {
    if (!state.map) return;
    const center = state.map.getCenter();
    const zoom = Math.min(Math.floor(state.map.getZoom()), 15);
    const lat = center.lat;
    const lng = center.lng;

    const previewImg = document.getElementById('layer-toggle-preview');
    if (!previewImg) return;

    const otherLayer = state.activeLayerKey === 'street' ? 'satellite' : 'street';
    previewImg.src = getTileUrl(otherLayer, zoom, lat, lng);
}

function syncLayerSwitcherUI() {
    const label = document.getElementById('layer-toggle-label');
    const labelsBtn = document.getElementById('layer-labels-btn');

    if (label) {
        label.textContent = state.activeLayerKey === 'street' ? 'Satellite' : 'Map';
    }

    if (labelsBtn) {
        if (state.activeLayerKey === 'satellite') {
            labelsBtn.classList.remove('hidden');
        } else {
            labelsBtn.classList.add('hidden');
        }
    }

    syncLabelsButtonState();
}

function syncLabelsButtonState() {
    const labelsBtn = document.getElementById('layer-labels-btn');
    const overlayToggle = document.getElementById('toggle-overlay-labels');
    if (!labelsBtn) return;

    if (state.activeOverlays.labels) {
        labelsBtn.classList.add('active');
    } else {
        labelsBtn.classList.remove('active');
    }

    if (overlayToggle) {
        overlayToggle.checked = state.activeOverlays.labels;
    }
}

export function initOverlays() {
    // Restore persisted labels preference
    const savedLabels = localStorage.getItem(STORAGE_KEY_LABELS);
    state.activeOverlays.labels = (savedLabels === 'true' || savedLabels === null); // default labels to true or saved state
    setLabelsVisibility(state.activeOverlays.labels);
    syncLabelsButtonState();

    // Sync perspective checkbox state
    const overlayTogglePerspective = document.getElementById('toggle-overlay-perspective');
    if (overlayTogglePerspective) {
        overlayTogglePerspective.checked = state.activeOverlays.perspective;
    }
}

export function setBaseLayer(layerKey) {
    if (state.activeLayerKey === layerKey) return;
    state.activeLayerKey = layerKey;

    localStorage.setItem(STORAGE_KEY_LAYER, layerKey);

    updateStyleLayersVisibility();

    syncLayerSwitcherUI();
    updateLayerSwitcherPreview();
}

export function updateStyleLayersVisibility() {
    if (!state.map) return;
    const style = state.map.getStyle();
    if (!style || !style.layers) return;

    const isSatellite = state.activeLayerKey === 'satellite';

    style.layers.forEach(layer => {
        // Toggle satellite layer visibility
        if (layer.id === 'satellite-layer') {
            state.map.setLayoutProperty(layer.id, 'visibility', isSatellite ? 'visible' : 'none');
            return;
        }

        // Hide vector fill/landuse/water layers in satellite mode to reveal satellite imagery underneath
        if (layer.type === 'fill' && layer.id !== 'satellite-layer') {
            state.map.setLayoutProperty(layer.id, 'visibility', isSatellite ? 'none' : 'visible');
        }
    });
}

export function toggleOverlay(key, show) {
    state.activeOverlays[key] = show;
    
    if (key === 'labels') {
        setLabelsVisibility(show);
        localStorage.setItem(STORAGE_KEY_LABELS, show ? 'true' : 'false');
        syncLabelsButtonState();
    } else if (key === 'bike') {
        if (state.map && state.map.getLayer('bike-layer')) {
            state.map.setLayoutProperty('bike-layer', 'visibility', show ? 'visible' : 'none');
        }
        const overlayToggleBike = document.getElementById('toggle-overlay-bike');
        if (overlayToggleBike) {
            overlayToggleBike.checked = show;
        }
    } else if (key === 'perspective') {
        if (state.map) {
            if (state.map.getLayer('3d-buildings')) {
                state.map.setLayoutProperty('3d-buildings', 'visibility', show ? 'visible' : 'none');
            }
            if (show) {
                state.map.setTerrain({ source: 'terrain-source', exaggeration: 1.2 });
                if (state.map.getPitch() === 0) {
                    state.map.easeTo({ pitch: 45, duration: 300 });
                }
            } else {
                state.map.setTerrain(null);
                if (state.map.getPitch() !== 0) {
                    state.map.easeTo({ pitch: 0, duration: 300 });
                }
            }
        }
        localStorage.setItem('maps_perspective_enabled', show ? 'true' : 'false');
        const overlayTogglePerspective = document.getElementById('toggle-overlay-perspective');
        if (overlayTogglePerspective) {
            overlayTogglePerspective.checked = show;
        }
    }
}

export function setLabelsVisibility(show) {
    if (!state.map) return;
    const style = state.map.getStyle();
    if (!style || !style.layers) return;
    style.layers.forEach(layer => {
        if (layer.type === 'symbol') {
            state.map.setLayoutProperty(layer.id, 'visibility', show ? 'visible' : 'none');
        }
    });
}
