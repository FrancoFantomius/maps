// maps Map Engine Module

import { state, DEFAULT_LAT, DEFAULT_LNG, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from './state.js';

const STORAGE_KEY_LAYER = 'maps_active_layer';
const STORAGE_KEY_LABELS = 'maps_labels_enabled';

export function initMap() {
    state.baseLayers.street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM contributors' });
    state.baseLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });

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

    state.map = L.map('map', {
        center: [initialLat, initialLng],
        zoom: DEFAULT_ZOOM,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        layers: [state.baseLayers[initialLayer]],
        zoomControl: false
    });

    L.control.zoom({ position: 'bottomleft' }).addTo(state.map);

    // Update layer switcher preview dynamically when map finishes moving
    state.map.on('moveend', updateLayerSwitcherPreview);

    // If there is no saved home location, attempt to geolocate on load
    if (!savedHome && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (state.map) {
                    state.map.setView([position.coords.latitude, position.coords.longitude], DEFAULT_ZOOM);
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

    // Recalculate size to avoid grey areas and update previews
    setTimeout(() => {
        state.map.invalidateSize();
        updateLayerSwitcherPreview();
    }, 250);
}

/**
 * Compute the tile URL for a given layer at the current map center.
 */
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

/**
 * Updates the small tile preview in the layer switcher to show the *other* layer.
 */
export function updateLayerSwitcherPreview() {
    if (!state.map) return;
    const center = state.map.getCenter();
    const zoom = Math.min(state.map.getZoom(), 15);
    const lat = center.lat;
    const lng = center.lng;

    const previewImg = document.getElementById('layer-toggle-preview');
    if (!previewImg) return;

    // Preview shows the OPPOSITE layer (what you'd switch TO)
    const otherLayer = state.activeLayerKey === 'street' ? 'satellite' : 'street';
    previewImg.src = getTileUrl(otherLayer, zoom, lat, lng);
}

/**
 * Synchronize the layer switcher UI elements to match current state.
 */
function syncLayerSwitcherUI() {
    const label = document.getElementById('layer-toggle-label');
    const labelsBtn = document.getElementById('layer-labels-btn');

    if (label) {
        label.textContent = state.activeLayerKey === 'street' ? 'Satellite' : 'Map';
    }

    // Show labels button only in satellite mode
    if (labelsBtn) {
        if (state.activeLayerKey === 'satellite') {
            labelsBtn.classList.remove('hidden');
        } else {
            labelsBtn.classList.add('hidden');
        }
    }

    // Sync labels button active state
    syncLabelsButtonState();
}

/**
 * Sync the labels button visual state with the actual overlay state.
 */
function syncLabelsButtonState() {
    const labelsBtn = document.getElementById('layer-labels-btn');
    const overlayToggle = document.getElementById('toggle-overlay-labels');
    if (!labelsBtn) return;

    if (state.activeOverlays.labels) {
        labelsBtn.classList.add('active');
    } else {
        labelsBtn.classList.remove('active');
    }

    // Also sync the settings panel checkbox
    if (overlayToggle) {
        overlayToggle.checked = state.activeOverlays.labels;
    }
}

export function initOverlays() {
    state.overlayLayers.labels = L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { attribution: 'Labels &copy; Esri', maxZoom: MAX_ZOOM }),
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { attribution: 'Roads &copy; Esri', maxZoom: MAX_ZOOM })
    ]);
    state.overlayLayers.bike = L.tileLayer('https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png', {
        attribution: 'Bike paths &copy; Waymarked Trails',
        maxZoom: MAX_ZOOM,
        opacity: 0.75
    });

    // Restore persisted labels preference
    const savedLabels = localStorage.getItem(STORAGE_KEY_LABELS);
    if (savedLabels === 'true') {
        state.activeOverlays.labels = true;
        state.map.addLayer(state.overlayLayers.labels);
        syncLabelsButtonState();
    }
}

/**
 * Switch the base layer (street ↔ satellite).
 * Persists the choice to localStorage and updates the switcher UI.
 */
export function setBaseLayer(layerKey) {
    if (state.activeLayerKey === layerKey) return;
    state.map.removeLayer(state.baseLayers[state.activeLayerKey]);
    state.map.addLayer(state.baseLayers[layerKey]);

    state.activeLayerKey = layerKey;

    // Persist layer choice
    localStorage.setItem(STORAGE_KEY_LAYER, layerKey);

    // Update the layer switcher UI
    syncLayerSwitcherUI();
    updateLayerSwitcherPreview();
}

/**
 * Toggle a map overlay on or off.
 * Persists labels state to localStorage.
 */
export function toggleOverlay(key, show) {
    state.activeOverlays[key] = show;
    if (show) {
        state.map.addLayer(state.overlayLayers[key]);
    } else {
        state.map.removeLayer(state.overlayLayers[key]);
    }

    // Persist labels state
    if (key === 'labels') {
        localStorage.setItem(STORAGE_KEY_LABELS, show ? 'true' : 'false');
        syncLabelsButtonState();
    }
}
