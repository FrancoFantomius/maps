// maps Map Engine Module

import { state, DEFAULT_LAT, DEFAULT_LNG, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from './state.js';

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

    state.map = L.map('map', {
        center: [initialLat, initialLng],
        zoom: DEFAULT_ZOOM,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        layers: [state.baseLayers.street],
        zoomControl: false
    });

    L.control.zoom({ position: 'bottomleft' }).addTo(state.map);

    // Update previews dynamically when map finishes moving
    state.map.on('moveend', updateMapPreviews);

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

    // Recalculate size to avoid grey areas and update previews
    setTimeout(() => {
        state.map.invalidateSize();
        updateMapPreviews();
    }, 250);
}

export function updateMapPreviews() {
    if (!state.map) return;
    const center = state.map.getCenter();
    const zoom = Math.min(state.map.getZoom(), 15); // Cap preview zoom at 15 to ensure stable tile loading
    const lat = center.lat;
    const lng = center.lng;

    const n = Math.pow(2, zoom);
    const x = Math.max(0, Math.min(n - 1, Math.floor(((lng + 180) / 360) * n)));
    const latRad = (lat * Math.PI) / 180;
    const y = Math.max(0, Math.min(n - 1, Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)));

    const streetImg = document.getElementById('preview-img-street');
    const satelliteImg = document.getElementById('preview-img-satellite');

    if (streetImg) streetImg.src = `https://a.tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
    if (satelliteImg) satelliteImg.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
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
}

export function setBaseLayer(layerKey) {
    if (state.activeLayerKey === layerKey) return;
    state.map.removeLayer(state.baseLayers[state.activeLayerKey]);
    state.map.addLayer(state.baseLayers[layerKey]);

    // Redraw settings selector highlights
    document.querySelectorAll('[data-layer-btn]').forEach(btn => {
        const btnKey = btn.getAttribute('data-layer-btn');
        const indicator = btn.querySelector('.layer-indicator');
        const text = btn.querySelector('span');
        if (btnKey === layerKey) {
            btn.classList.add('active-layer');
            if (indicator) indicator.classList.remove('hidden');
            if (text) {
                text.className = 'text-[10px] font-bold text-indigo-600 dark:text-indigo-400';
            }
        } else {
            btn.classList.remove('active-layer');
            if (indicator) indicator.classList.add('hidden');
            if (text) {
                text.className = 'text-[10px] font-semibold text-slate-655 dark:text-slate-355';
            }
        }
    });

    state.activeLayerKey = layerKey;
}

export function toggleOverlay(key, show) {
    state.activeOverlays[key] = show;
    if (show) {
        state.map.addLayer(state.overlayLayers[key]);
    } else {
        state.map.removeLayer(state.overlayLayers[key]);
    }
}
