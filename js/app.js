// maps - Interactive Map Platform
// Core JavaScript Orchestrator (ES Module)

import { state } from './state.js';
import { showToast } from './toast.js';
import { initTheme } from './theme.js';
import { initMap, initOverlays, setBaseLayer, toggleOverlay } from './map.js';
import { setHUDState } from './hud.js';
import {
    createCustomPin,
    openMarkerModal,
    closeMarkerModal,
    saveMarkerFromForm,
    loadMarkersFromStorage,
    mapFocusMarker,
    deleteSavedMarker
} from './markers.js';
import { enterMeasureMode, exitMeasureMode, handleMeasureClick } from './measure.js';
import { enterRoutingMode, exitRoutingMode, setRoutingMode, handleRoutingClick } from './routing.js';
import { renderSearchResults } from './search.js';
import { locateUser } from './gps.js';

// DOM Elements
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const btnClearSearch = document.getElementById('btn-clear-search');
const drawBtn = document.getElementById('btn-draw');
const routeBtn = document.getElementById('btn-route');
const gpsBtn = document.getElementById('btn-gps');
const markerForm = document.getElementById('marker-form');
const btnSettingsToggle = document.getElementById('btn-settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const toggleOverlayLabels = document.getElementById('toggle-overlay-labels');
const toggleOverlayBike = document.getElementById('toggle-overlay-bike');

// Initialize Application
window.addEventListener('load', () => {
    initMap();
    initOverlays();
    initTheme();
    loadMarkersFromStorage();
    setupEventListeners();
});

async function loadPoiAndPathDetails(latlng) {
    const lat = latlng.lat;
    const lng = latlng.lng;

    // Show loading HUD
    setHUDState('place-details', { isLoading: true });

    // 1. Prepare fetches
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const wikipediaUrl = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gsradius=100&gscoord=${lat}|${lng}&format=json&origin=*`;
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];(way(around:20,${lat},${lng})[highway];node(around:50,${lat},${lng})[shop];node(around:50,${lat},${lng})[amenity];);out geom;`;

    let placeName = "Dropped Pin";
    let wikiSummary = "";
    let addressLine = "";
    let shopInfo = null;
    let streetName = "";

    try {
        // Run fetches in parallel
        const [nomRes, wikiRes, ovRes] = await Promise.allSettled([
            fetch(nominatimUrl).then(r => r.json()),
            fetch(wikipediaUrl).then(r => r.json()),
            fetch(overpassUrl).then(r => r.json())
        ]);

        // Process Nominatim
        if (nomRes.status === 'fulfilled' && nomRes.value) {
            const val = nomRes.value;
            addressLine = val.display_name || "";
            if (val.name) {
                placeName = val.name;
            } else if (val.address) {
                const addr = val.address;
                placeName = addr.shop || addr.amenity || addr.building || addr.tourism || addr.historic || addr.road || "Dropped Pin";
            }
        }

        // Process Wikipedia
        if (wikiRes.status === 'fulfilled' && wikiRes.value && wikiRes.value.query && wikiRes.value.query.geosearch) {
            const geosearch = wikiRes.value.query.geosearch;
            if (geosearch.length > 0) {
                const nearestPage = geosearch[0];
                try {
                    const sumRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(nearestPage.title)}`);
                    const summaryData = await sumRes.json();
                    if (summaryData && summaryData.extract) {
                        wikiSummary = summaryData.extract;
                        if (placeName === "Dropped Pin" || !placeName) {
                            placeName = nearestPage.title;
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch Wikipedia page summary", e);
                }
            }
        }

        // Process Overpass results for path highlighting and shop details
        if (ovRes.status === 'fulfilled' && ovRes.value && ovRes.value.elements) {
            const elements = ovRes.value.elements;
            
            // Filter elements to find closest highway way
            const ways = elements.filter(el => el.type === 'way' && el.tags && el.tags.highway);
            let closestWay = null;
            let minDistance = Infinity;

            ways.forEach(way => {
                if (way.geometry) {
                    way.geometry.forEach(pt => {
                        const dist = L.latLng(pt.lat, pt.lon).distanceTo(latlng);
                        if (dist < minDistance) {
                            minDistance = dist;
                            closestWay = way;
                        }
                    });
                }
            });

            // Highlight street/trail if within 20 meters
            if (closestWay && minDistance <= 20) {
                streetName = closestWay.tags.name || closestWay.tags.highway.replace(/_/g, ' ');
                const coords = closestWay.geometry.map(pt => [pt.lat, pt.lon]);
                if (state.highlightedPath) {
                    state.map.removeLayer(state.highlightedPath);
                }
                
                const glowBg = L.polyline(coords, {
                    color: '#6366f1',
                    weight: 10,
                    opacity: 0.4,
                    lineCap: 'round',
                    lineJoin: 'round'
                });
                const glowFg = L.polyline(coords, {
                    color: '#4f46e5',
                    weight: 3,
                    opacity: 0.9,
                    lineCap: 'round',
                    lineJoin: 'round'
                });

                state.highlightedPath = L.layerGroup([glowBg, glowFg]).addTo(state.map);
            }

            // Find closest shop or amenity node to display specific info
            const nodes = elements.filter(el => el.type === 'node' && el.tags && (el.tags.shop || el.tags.amenity));
            let closestNode = null;
            let nodeMinDist = Infinity;
            nodes.forEach(node => {
                const dist = L.latLng(node.lat, node.lon).distanceTo(latlng);
                if (dist < nodeMinDist) {
                    nodeMinDist = dist;
                    closestNode = node;
                }
            });

            if (closestNode && nodeMinDist <= 50) {
                const tags = closestNode.tags;
                shopInfo = {
                    name: tags.name || (tags.shop ? `Shop (${tags.shop})` : tags.amenity),
                    type: tags.shop || tags.amenity,
                    openingHours: tags.opening_hours || null,
                    website: tags.website || null,
                    phone: tags.phone || null,
                    cuisine: tags.cuisine || null,
                    brand: tags.brand || null
                };
                if (placeName === "Dropped Pin") {
                    placeName = shopInfo.name;
                }
            }
        }

    } catch (err) {
        console.error("POI or geometry retrieval failed", err);
    }

    // Update HUD with loaded details
    setHUDState('place-details', {
        isTemp: true,
        lat: lat,
        lng: lng,
        name: placeName,
        wikiSummary: wikiSummary,
        address: addressLine,
        shopInfo: shopInfo,
        streetName: streetName
    });
}

function onMapClick(e) {
    const latlng = e.latlng;

    if (state.isRouteMode) {
        handleRoutingClick(latlng);
        return;
    }

    if (state.isMeasureMode) {
        handleMeasureClick(latlng);
        return;
    }

    if (state.highlightedPath) {
        state.map.removeLayer(state.highlightedPath);
        state.highlightedPath = null;
    }

    if (state.tempMarker) state.map.removeLayer(state.tempMarker);
    state.tempMarker = L.marker([latlng.lat, latlng.lng], { icon: createCustomPin('poi', '#94a3b8') }).addTo(state.map);
    
    state.map.panTo(latlng);
    loadPoiAndPathDetails(latlng);
}

function setupEventListeners() {
    state.map.on('click', onMapClick);

    // Settings Dropdown Popover Toggles
    btnSettingsToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = settingsPanel.classList.contains('hidden');
        if (isHidden) {
            settingsPanel.classList.remove('hidden');
            setTimeout(() => {
                settingsPanel.classList.remove('opacity-0', 'scale-95');
                settingsPanel.classList.add('opacity-100', 'scale-100');
            }, 20);
        } else {
            settingsPanel.classList.remove('opacity-100', 'scale-100');
            settingsPanel.classList.add('opacity-0', 'scale-95');
            setTimeout(() => {
                settingsPanel.classList.add('hidden');
            }, 200);
        }
    });

    document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && !btnSettingsToggle.contains(e.target)) {
            if (!settingsPanel.classList.contains('hidden')) {
                settingsPanel.classList.remove('opacity-100', 'scale-100');
                settingsPanel.classList.add('opacity-0', 'scale-95');
                setTimeout(() => { settingsPanel.classList.add('hidden'); }, 200);
            }
        }
    });

    // Layer Overlay Checks
    toggleOverlayLabels.addEventListener('change', (e) => {
        toggleOverlay('labels', e.target.checked);
    });

    toggleOverlayBike.addEventListener('change', (e) => {
        toggleOverlay('bike', e.target.checked);
    });

    // Search Box Form Handler
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (!query) return;
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data && data.length > 0) {
                renderSearchResults(data);
                setHUDState('search-results');
            } else {
                showToast("No locations match query.", "error");
            }
        } catch (err) {
            showToast("Network search failed.", "error");
        }
    });

    searchInput.addEventListener('input', () => {
        if (searchInput.value.trim()) {
            btnClearSearch.classList.remove('hidden');
        } else {
            btnClearSearch.classList.add('hidden');
        }
    });

    btnClearSearch.addEventListener('click', () => {
        searchInput.value = '';
        btnClearSearch.classList.add('hidden');
        setHUDState('places');
        if (state.tempMarker) {
            state.map.removeLayer(state.tempMarker);
            state.tempMarker = null;
        }
    });

    document.getElementById('btn-close-search').addEventListener('click', () => {
        searchInput.value = '';
        btnClearSearch.classList.add('hidden');
        setHUDState('places');
        if (state.tempMarker) {
            state.map.removeLayer(state.tempMarker);
            state.tempMarker = null;
        }
    });

    // Toolbar triggers toggling
    gpsBtn.addEventListener('click', locateUser);

    drawBtn.addEventListener('click', () => {
        if (state.isMeasureMode) exitMeasureMode();
        else enterMeasureMode();
    });

    routeBtn.addEventListener('click', () => {
        if (state.isRouteMode) exitRoutingMode();
        else enterRoutingMode();
    });

    markerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveMarkerFromForm();
    });

    // Mode Selector controls
    document.querySelectorAll('[data-layer-btn]').forEach(btn => {
        btn.addEventListener('click', () => {
            const layerKey = btn.getAttribute('data-layer-btn');
            setBaseLayer(layerKey);
        });
    });

    // Measure & Routing Panels Controls
    document.getElementById('btn-exit-measure').addEventListener('click', exitMeasureMode);
    document.getElementById('btn-exit-routing').addEventListener('click', exitRoutingMode);
    document.getElementById('mode-driving-car').addEventListener('click', () => setRoutingMode('driving-car'));
    document.getElementById('mode-cycling').addEventListener('click', () => setRoutingMode('cycling'));
    document.getElementById('mode-foot').addEventListener('click', () => setRoutingMode('foot'));

    // Modal Control Buttons
    document.getElementById('btn-close-marker-modal').addEventListener('click', closeMarkerModal);

    // Home Location Controls
    const btnSetHome = document.getElementById('btn-set-home');
    const btnClearHome = document.getElementById('btn-clear-home');

    function updateHomeButtonsVisibility() {
        const savedHome = localStorage.getItem('maps_home_coords');
        if (savedHome) {
            btnClearHome.classList.remove('hidden');
        } else {
            btnClearHome.classList.add('hidden');
        }
    }

    updateHomeButtonsVisibility();

    btnSetHome.addEventListener('click', () => {
        if (!state.map) return;
        const center = state.map.getCenter();
        const homeCoords = { lat: center.lat, lng: center.lng };
        localStorage.setItem('maps_home_coords', JSON.stringify(homeCoords));
        showToast("Home location saved to this view center.", "info");
        updateHomeButtonsVisibility();
    });

    btnClearHome.addEventListener('click', () => {
        localStorage.removeItem('maps_home_coords');
        showToast("Home location cleared. Will use GPS next load.", "info");
        updateHomeButtonsVisibility();
    });
}

// Expose handlers globally for HTML elements
window.openMarkerModal = openMarkerModal;
window.deleteSavedMarker = deleteSavedMarker;
window.mapFocusMarker = mapFocusMarker;
window.setHUDState = setHUDState;
