// maps - Interactive Map Platform
// Core JavaScript Orchestrator (ES Module) - js/app.js

import '../css/style.css';
import { MapService } from './MapService.js';
import { ApiService } from './ApiService.js';
import { HUDController } from './HUDController.js';
import { MarkerController } from './MarkerController.js';
import { MeasurementController } from './MeasurementController.js';
import { RoutingController } from './RoutingController.js';
import { SearchController } from './SearchController.js';
import { GPSController } from './GPSController.js';
import { ThemeController } from './ThemeController.js';
import { AccountController } from './AccountController.js';

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
const toggleOverlayPerspective = document.getElementById('toggle-overlay-perspective');
const btnPerspective = document.getElementById('btn-perspective');

// Initialize Application
window.addEventListener('load', () => {
    MapService.init();
    MapService.initOverlays();
    ThemeController.init();
    MarkerController.loadFromStorage();
    AccountController.init();
    setupEventListeners();
});

function getRenderedLabelName(point) {
    const renderedFeatures = MapService.queryRenderedFeatures(point) || [];
    const labelFeature = renderedFeatures.find(feature => {
        if (!feature || !feature.layer || feature.layer.type !== 'symbol' || !feature.properties) return false;
        return feature.properties.name || feature.properties['name:en'] || feature.properties['name:latin'] || feature.properties['name_int'];
    });

    if (!labelFeature) return '';

    const properties = labelFeature.properties;
    return properties['name:en'] || properties.name || properties['name:latin'] || properties.name_int || '';
}

async function loadPoiAndPathDetails(latlng, labelName = '') {
    const lat = latlng.lat;
    const lng = latlng.lng;

    // Show loading HUD
    HUDController.setState('place-details', { isLoading: true });

    let placeName = labelName || "Dropped Pin";
    let wikiSummary = "";
    let wikiImage = "";
    let wikiUrl = "";
    let countryName = "";
    let addressLine = "";
    let shopInfo = null;
    let streetName = "";

    try {
        // Run fetches in parallel via centralized ApiService
        const [nomRes, wikiRes, ovRes] = await Promise.allSettled([
            ApiService.reverseGeocode(lat, lng),
            ApiService.fetchWikipediaNearby(lat, lng),
            ApiService.fetchOverpassFeatures(lat, lng)
        ]);

        // Process Nominatim
        if (nomRes.status === 'fulfilled' && nomRes.value) {
            const val = nomRes.value;
            addressLine = val.display_name || "";
            if (val.address && val.address.country) {
                countryName = val.address.country;
            } else if (val.display_name) {
                const parts = val.display_name.split(',');
                countryName = parts[parts.length - 1].trim();
            }
            if (!labelName && val.name) {
                placeName = val.name;
            } else if (!labelName && val.address) {
                const addr = val.address;
                placeName = addr.shop || addr.amenity || addr.building || addr.tourism || addr.historic || addr.road || "Dropped Pin";
            }
        }

        // Process Wikipedia. Prefer the clicked label text, then fall back to nearby pages.
        if (labelName) {
            try {
                const summaryData = await ApiService.fetchWikipediaSummary(labelName);
                if (summaryData && summaryData.extract) {
                    wikiSummary = summaryData.extract;
                    wikiImage = summaryData.thumbnail?.source || summaryData.originalimage?.source || '';
                    wikiUrl = summaryData.content_urls?.desktop?.page || '';
                    placeName = summaryData.title || labelName;
                }
            } catch (e) {
                console.warn("Could not fetch Wikipedia summary for label; trying nearby pages", e);
            }
        }

        if (!wikiSummary && wikiRes.status === 'fulfilled' && wikiRes.value && wikiRes.value.query && wikiRes.value.query.geosearch) {
            const geosearch = wikiRes.value.query.geosearch;
            if (geosearch.length > 0) {
                const nearestPage = geosearch[0];
                try {
                    const summaryData = await ApiService.fetchWikipediaSummary(nearestPage.title);
                    if (summaryData && summaryData.extract) {
                        wikiSummary = summaryData.extract;
                        wikiImage = summaryData.thumbnail?.source || summaryData.originalimage?.source || '';
                        wikiUrl = summaryData.content_urls?.desktop?.page || '';
                        if (placeName === "Dropped Pin" || !placeName) {
                            placeName = nearestPage.title;
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch Wikipedia page summary", e);
                }
            }
        }

        // Wikimedia Commons fallback: fetch a nearby geotagged photo if Wikipedia didn't provide one
        if (!wikiImage) {
            try {
                const commonsImage = await ApiService.fetchWikimediaImage(lat, lng);
                if (commonsImage) {
                    wikiImage = commonsImage;
                }
            } catch (e) {
                console.warn("Wikimedia Commons image fallback failed", e);
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
                        const dist = MeasurementController.getDistance({ lat: pt.lat, lng: pt.lon }, latlng);
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
                const coords = closestWay.geometry.map(pt => [pt.lon, pt.lat]); // MapLibre uses [lng, lat]
                MapService.highlightedPathCoords = coords;
                MapService.updateSourceData('highlight-path-source', {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: coords
                    }
                });
            }

            // Find closest shop or amenity node to display specific info
            const nodes = elements.filter(el => el.type === 'node' && el.tags && (el.tags.shop || el.tags.amenity));
            let closestNode = null;
            let nodeMinDist = Infinity;
            nodes.forEach(node => {
                const dist = MeasurementController.getDistance({ lat: node.lat, lng: node.lon }, latlng);
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
    HUDController.setState('place-details', {
        isTemp: true,
        lat: lat,
        lng: lng,
        name: placeName,
        wikiSummary: wikiSummary,
        wikiImage: wikiImage,
        wikiUrl: wikiUrl,
        country: countryName,
        address: addressLine,
        shopInfo: shopInfo,
        streetName: streetName
    });
}

function onMapClick(e) {
    const latlng = { lat: e.lngLat.lat, lng: e.lngLat.lng };

    if (RoutingController.isRouteMode) {
        RoutingController.handleClick(latlng);
        return;
    }

    if (MeasurementController.isMeasureMode) {
        MeasurementController.handleClick(latlng);
        return;
    }

    HUDController.clearHighlightedPath();
    MarkerController.removeTempMarker();
    
    MarkerController.setTempMarker(latlng.lat, latlng.lng);
    MapService.panTo([latlng.lng, latlng.lat]);

    // Query rendered label under click point for high precision Wikipedia lookup
    const labelName = getRenderedLabelName(e.point);
    loadPoiAndPathDetails(latlng, labelName);
}

function setupEventListeners() {
    MapService.on('click', onMapClick);

    // Zoom listener for GPS accuracy circle updates
    MapService.on('zoom', () => {
        GPSController.updateAccuracyCircle();
    });

    // Handle clicks on alternative routing paths
    MapService.on('click', 'alternative-routes-layer', (e) => {
        if (e.features && e.features.length > 0) {
            const routeIndex = e.features[0].properties.routeIndex;
            if (RoutingController.lastRoutingData) {
                RoutingController.promoteAlternativeRoute(RoutingController.lastRoutingData, routeIndex);
            }
        }
    });

    // Settings Bottom Sheet Toggles
    const btnSettingsClose = document.getElementById('btn-settings-close');

    function openSettingsPanel() {
        settingsPanel.classList.add('settings-open');
        settingsPanel.classList.remove('translate-y-full');
        btnSettingsToggle.querySelector('.material-icons-outlined').textContent = 'keyboard_double_arrow_down';
        requestAnimationFrame(() => {
            const panelHeight = settingsPanel.offsetHeight;
            document.documentElement.style.setProperty('--settings-panel-height', panelHeight + 'px');
            document.querySelectorAll('.bottom-ui-element').forEach(el => {
                el.style.transform = `translateY(-${panelHeight}px)`;
            });
            const mapControls = document.querySelector('.maplibregl-ctrl-bottom-left');
            if (mapControls) mapControls.style.transform = `translateY(-${panelHeight}px)`;
        });
    }

    function closeSettingsPanel() {
        settingsPanel.classList.remove('settings-open');
        settingsPanel.classList.add('translate-y-full');
        btnSettingsToggle.querySelector('.material-icons-outlined').textContent = 'keyboard_double_arrow_up';
        document.querySelectorAll('.bottom-ui-element').forEach(el => {
            el.style.transform = '';
        });
        const mapControls = document.querySelector('.maplibregl-ctrl-bottom-left');
        if (mapControls) mapControls.style.transform = '';
    }

    btnSettingsToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = settingsPanel.classList.contains('settings-open');
        if (isOpen) closeSettingsPanel();
        else openSettingsPanel();
    });

    btnSettingsClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeSettingsPanel();
    });

    document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && !btnSettingsToggle.contains(e.target)) {
            if (settingsPanel.classList.contains('settings-open')) {
                closeSettingsPanel();
            }
        }
    });

    // Layer Overlay Checks
    toggleOverlayLabels.addEventListener('change', (e) => {
        MapService.toggleOverlay('labels', e.target.checked);
    });

    toggleOverlayBike.addEventListener('change', (e) => {
        MapService.toggleOverlay('bike', e.target.checked);
    });

    if (toggleOverlayPerspective) {
        toggleOverlayPerspective.addEventListener('change', (e) => {
            MapService.toggleOverlay('perspective', e.target.checked);
        });
    }

    // Search Box Form Handler
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (!query) return;
        try {
            const data = await ApiService.searchGeocode(query);
            if (data && data.length > 0) {
                SearchController.renderResults(data);
                HUDController.setState('search-results');
            }
        } catch (err) {
            console.error("Search failed", err);
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
        HUDController.setState('places');
        MarkerController.removeTempMarker();
    });

    document.getElementById('btn-close-search').addEventListener('click', () => {
        searchInput.value = '';
        btnClearSearch.classList.add('hidden');
        HUDController.setState('places');
        MarkerController.removeTempMarker();
    });

    // Toggle Saved Places (My Places) list
    const btnTogglePlaces = document.getElementById('btn-toggle-places');
    if (btnTogglePlaces) {
        btnTogglePlaces.addEventListener('click', (e) => {
            e.stopPropagation();
            if (HUDController.currentState === 'saved-places') {
                HUDController.setState('places');
            } else {
                HUDController.setState('saved-places');
            }
        });
    }

    // Close button inside Saved Places list
    const btnClosePlaces = document.getElementById('btn-close-places');
    if (btnClosePlaces) {
        btnClosePlaces.addEventListener('click', (e) => {
            e.stopPropagation();
            HUDController.setState('places');
        });
    }

    // Mobile drag handle expansion/collapse/swipe closing
    const dragHandle = document.getElementById('hud-drag-handle');
    const hudPanel = document.getElementById('hud-panel');
    if (dragHandle && hudPanel) {
        let touchStartY = 0;
        let initialHudHeight = 0;
        let isDragging = false;

        // Support clicking to toggle default/expanded height
        dragHandle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isDragging) return; // Ignore clicks if dragging was active

            if (window.innerWidth < 768) {
                if (HUDController.isExpanded) {
                    HUDController.collapse();
                } else {
                    HUDController.expand();
                }
            }
        });

        dragHandle.addEventListener('touchstart', (e) => {
            if (window.innerWidth >= 768) return;
            touchStartY = e.touches[0].clientY;
            initialHudHeight = hudPanel.offsetHeight;
            isDragging = true;

            // Temporarily disable transitions during drag for raw follow-finger response
            hudPanel.style.transition = 'none';
        }, { passive: true });

        dragHandle.addEventListener('touchmove', (e) => {
            if (!isDragging || window.innerWidth >= 768) return;
            const touchCurrentY = e.touches[0].clientY;
            const dy = touchStartY - touchCurrentY; // Positive = drag up, Negative = drag down
            const newHeight = initialHudHeight + dy;

            // Constrain between 0 and 90% of screen height
            const constrainedHeight = Math.max(0, Math.min(newHeight, window.innerHeight * 0.88));
            hudPanel.style.height = `${constrainedHeight}px`;
        }, { passive: true });

        dragHandle.addEventListener('touchend', (e) => {
            if (!isDragging || window.innerWidth >= 768) return;
            isDragging = false;

            // Re-enable CSS transitions
            hudPanel.style.transition = '';

            const finalHeight = hudPanel.offsetHeight;
            const hScreen = window.innerHeight;

            // Determine closest state to snap to
            if (finalHeight < hScreen * 0.22) {
                // Closer to closed -> slide out
                HUDController.setState('places');
                // Clear inline style after transition to let CSS class take over
                setTimeout(() => {
                    if (HUDController.currentState === 'places') {
                        hudPanel.style.height = '';
                    }
                }, 400);
            } else if (finalHeight < hScreen * 0.62) {
                // Closer to 3/7 medium height
                HUDController.collapse();
                // Clear inline style so responsive CSS (42.85vh) takes over
                setTimeout(() => {
                    if (HUDController.currentState !== 'places' && !HUDController.isExpanded) {
                        hudPanel.style.height = '';
                    }
                }, 400);
            } else {
                // Closer to 6/7 expanded height
                HUDController.expand();
                // Clear inline style so responsive CSS (85.71vh) takes over
                setTimeout(() => {
                    if (HUDController.currentState !== 'places' && HUDController.isExpanded) {
                        hudPanel.style.height = '';
                    }
                }, 400);
            }
        }, { passive: true });
    }

    // Toolbar triggers toggling
    gpsBtn.addEventListener('click', () => {
        GPSController.locateUser();
    });

    drawBtn.addEventListener('click', () => {
        if (MeasurementController.isMeasureMode) MeasurementController.exit();
        else MeasurementController.enter();
    });

    routeBtn.addEventListener('click', () => {
        if (RoutingController.isRouteMode) RoutingController.exit();
        else RoutingController.enter();
    });

    if (btnPerspective) {
        btnPerspective.addEventListener('click', () => {
            MapService.toggleOverlay('perspective', !MapService.activeOverlays.perspective);
        });
    }

    markerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        MarkerController.saveFromForm();
    });

    // Layer Switcher - Toggle button
    const layerToggleBtn = document.getElementById('layer-toggle-btn');
    if (layerToggleBtn) {
        layerToggleBtn.addEventListener('click', () => {
            const nextLayer = MapService.activeLayerKey === 'street' ? 'satellite' : 'street';
            MapService.setBaseLayer(nextLayer);
        });
    }

    // Layer Switcher - Labels button
    const layerLabelsBtn = document.getElementById('layer-labels-btn');
    if (layerLabelsBtn) {
        layerLabelsBtn.addEventListener('click', () => {
            const isActive = MapService.activeOverlays.labels;
            MapService.toggleOverlay('labels', !isActive);
        });
    }

    // Measure Panel Controls
    document.getElementById('btn-exit-measure').addEventListener('click', () => {
        MeasurementController.exit();
    });

    // Navigation Panel Controls
    document.getElementById('btn-exit-nav').addEventListener('click', () => {
        RoutingController.exit();
    });

    // Transport mode buttons
    document.querySelectorAll('.nav-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-nav-mode');
            if (mode) RoutingController.setProfile(mode);
        });
    });

    // Autocomplete for origin & destination inputs
    const originInput = document.getElementById('nav-origin-input');
    const destInput = document.getElementById('nav-dest-input');
    const originDropdown = document.getElementById('nav-origin-autocomplete');
    const destDropdown = document.getElementById('nav-dest-autocomplete');

    if (originInput && originDropdown) RoutingController.setupAutocomplete(originInput, originDropdown, 'origin');
    if (destInput && destDropdown) RoutingController.setupAutocomplete(destInput, destDropdown, 'destination');

    // Swap waypoints button
    document.getElementById('nav-swap-btn').addEventListener('click', () => {
        RoutingController.swapWaypoints();
    });

    // Use my location button
    document.getElementById('nav-use-location').addEventListener('click', () => {
        RoutingController.useMyLocation();
    });

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-autocomplete') && !e.target.closest('#nav-origin-input') && !e.target.closest('#nav-dest-input')) {
            RoutingController.closeAllAutocomplete();
        }
    });

    // Modal Control Buttons
    document.getElementById('btn-close-marker-modal').addEventListener('click', () => {
        MarkerController.closeModal();
    });

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
        if (!MapService.map) return;
        const center = MapService.map.getCenter();
        const homeCoords = { lat: center.lat, lng: center.lng };
        localStorage.setItem('maps_home_coords', JSON.stringify(homeCoords));
        updateHomeButtonsVisibility();
    });

    btnClearHome.addEventListener('click', () => {
        localStorage.removeItem('maps_home_coords');
        updateHomeButtonsVisibility();
    });

    // Map Rotation Controls
    const btnCompass = document.getElementById('btn-compass');
    const btnRotateCcw = document.getElementById('btn-rotate-ccw');
    const btnRotateCw = document.getElementById('btn-rotate-cw');
    const btnRotateLeft = document.getElementById('btn-rotate-left');
    const btnRotateRight = document.getElementById('btn-rotate-right');
    const bearingSlider = document.getElementById('bearing-slider');
    const pitchSlider = document.getElementById('pitch-slider');

    if (btnCompass) {
        btnCompass.addEventListener('click', () => {
            MapService.easeTo(0, 0, 400);
        });
    }

    if (btnRotateCcw) {
        btnRotateCcw.addEventListener('click', () => {
            const current = MapService.getBearing();
            const target = (Math.round(current / 90) * 90 - 90);
            MapService.easeTo(target, undefined, 300);
        });
    }

    if (btnRotateCw) {
        btnRotateCw.addEventListener('click', () => {
            const current = MapService.getBearing();
            const target = (Math.round(current / 90) * 90 + 90);
            MapService.easeTo(target, undefined, 300);
        });
    }

    if (btnRotateLeft) {
        btnRotateLeft.addEventListener('click', () => {
            const current = MapService.getBearing();
            MapService.easeTo(current - 15, undefined, 200);
        });
    }

    if (btnRotateRight) {
        btnRotateRight.addEventListener('click', () => {
            const current = MapService.getBearing();
            MapService.easeTo(current + 15, undefined, 200);
        });
    }

    if (bearingSlider) {
        bearingSlider.addEventListener('input', (e) => {
            MapService.setBearing(parseFloat(e.target.value));
        });
    }

    if (pitchSlider) {
        pitchSlider.addEventListener('input', (e) => {
            MapService.setPitch(parseFloat(e.target.value));
        });
    }

    // Responsive resize support for HUD layout updates
    window.addEventListener('resize', () => {
        if (HUDController.isOpen) {
            HUDController.open(HUDController.isExpanded);
        }
    });
}
