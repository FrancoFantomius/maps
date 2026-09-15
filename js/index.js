// maps - Interactive Map Platform
// Central Application Entry Point - js/index.js

import '../css/style.css';
import '@francofantomius/material-components/button';
import '@francofantomius/material-components/button-group';
import '@francofantomius/material-components/icon-button';
import '@francofantomius/material-components/text-field';
import '@francofantomius/material-components/fab';
import '@francofantomius/material-components/tooltip';
import '@francofantomius/material-components/icon';
import '@francofantomius/material-components/app-drawer';
import '@francofantomius/material-components/account-menu';
import '@francofantomius/material-components/search-bar';
import '@francofantomius/material-components/chip';
import '@francofantomius/material-components/snackbar';
import '@francofantomius/material-components/side-sheet';
import '@francofantomius/material-components/bottom-sheet';
import '@francofantomius/material-components/switch';
import '@francofantomius/material-components/dialog';
import '@francofantomius/material-components/radio';
import { css } from 'lit';

// Add breathing space between md-tooltip and anchor buttons
const tooltipClass = customElements.get('md-tooltip');
if (tooltipClass && !tooltipClass.prototype._spacingPatched) {
    tooltipClass.prototype._spacingPatched = true;
    const originalUpdatePosition = tooltipClass.prototype.updatePosition;
    tooltipClass.prototype.updatePosition = function() {
        originalUpdatePosition.call(this);
        if (!this.tooltipPanel) return;
        const extraGap = 10; // Extra spacing (10px + 4px default = 14px total spacing)
        if (this.position === 'left') {
            const currentLeft = parseFloat(this.tooltipPanel.style.left) || 0;
            this.tooltipPanel.style.left = `${currentLeft - extraGap}px`;
        } else if (this.position === 'right') {
            const currentLeft = parseFloat(this.tooltipPanel.style.left) || 0;
            this.tooltipPanel.style.left = `${currentLeft + extraGap}px`;
        } else if (this.position === 'top') {
            const currentTop = parseFloat(this.tooltipPanel.style.top) || 0;
            this.tooltipPanel.style.top = `${currentTop - extraGap}px`;
        } else if (this.position === 'bottom') {
            const currentTop = parseFloat(this.tooltipPanel.style.top) || 0;
            this.tooltipPanel.style.top = `${currentTop + extraGap}px`;
        }
    };
}

// Remove duplicate horizontal line above footer in md-account-menu
const accountMenuClass = customElements.get('md-account-menu');
if (accountMenuClass && accountMenuClass.elementStyles && !accountMenuClass._borderPatched) {
    accountMenuClass._borderPatched = true;
    accountMenuClass.elementStyles.push(css`
        .popover-footer {
            border-top: none !important;
        }
    `);
}

// Disable fixed fullscreen scrim in md-search-bar so map clicks are not intercepted
const searchBarClass = customElements.get('md-search-bar');
if (searchBarClass && searchBarClass.elementStyles && !searchBarClass._scrimPatched) {
    searchBarClass._scrimPatched = true;
    searchBarClass.elementStyles.push(css`
        .scrim {
            display: none !important;
            pointer-events: none !important;
        }
    `);
}

// Disable fullscreen scrim in md-side-sheet so map clicks and gestures are not intercepted
const sideSheetClass = customElements.get('md-side-sheet');
if (sideSheetClass && sideSheetClass.elementStyles && !sideSheetClass._scrimPatched) {
    sideSheetClass._scrimPatched = true;
    sideSheetClass.elementStyles.push(css`
        .scrim {
            display: none !important;
            pointer-events: none !important;
        }
    `);
}

// Disable fullscreen scrim in md-bottom-sheet so map clicks and gestures are not intercepted
const bottomSheetClass = customElements.get('md-bottom-sheet');
if (bottomSheetClass && !bottomSheetClass._scrimPatched) {
    bottomSheetClass._scrimPatched = true;
    const scrimDisableRule = css`
        .scrim {
            display: none !important;
            pointer-events: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
        }
    `;
    if (bottomSheetClass.styles) {
        if (Array.isArray(bottomSheetClass.styles)) {
            bottomSheetClass.styles.push(scrimDisableRule);
        } else {
            bottomSheetClass.styles = [bottomSheetClass.styles, scrimDisableRule];
        }
    }
    if (bottomSheetClass.elementStyles) {
        bottomSheetClass.elementStyles.push(scrimDisableRule);
    }
}

// Feature Module Imports
import { MapService, DarkMapStyle, setupMapControlsUI, TransitOverlay } from './map/index.js';
import { ApiService } from './api/index.js';
import { HUDController, setupHUDUI } from './hud/index.js';
import { MarkerController, setupMarkerModalUI, setupHomeAddressUI } from './markers/index.js';
import { MeasurementController, setupMeasurementUI } from './measurement/index.js';
import { RoutingController, setupRoutingUI } from './routing/index.js';
import { SearchController, setupSearchUI, setupPlaceDetailsSheet } from './search/index.js';
import { GPSController, setupGPSUI } from './gps/index.js';
import { ThemeController } from './theme/index.js';
import { AccountController, LoginController, setupAccountUI } from './account/index.js';
import { TranslationController } from './translation/index.js';
import { setupSettingsUI } from './settings/index.js';
import { initPWA } from './pwa/index.js';
import * as db from './db/index.js';

// Re-export all major features from index.js
export {
    MapService,
    DarkMapStyle,
    TransitOverlay,
    ApiService,
    HUDController,
    MarkerController,
    MeasurementController,
    RoutingController,
    SearchController,
    GPSController,
    ThemeController,
    AccountController,
    LoginController,
    TranslationController,
    initPWA,
    db
};

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
    const searchBar = document.getElementById('search-bar');
    if (searchBar && !SearchController.isShowingSearchResults) {
        if (typeof searchBar.close === 'function') {
            searchBar.close();
        } else {
            searchBar.active = false;
        }
        if (searchBar.inputElement && typeof searchBar.inputElement.blur === 'function') {
            searchBar.inputElement.blur();
        }
    }

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

export function initApp() {
    initPWA();
    TranslationController.init();
    MapService.init();
    MapService.initOverlays();
    ThemeController.init();
    MarkerController.loadFromStorage();
    LoginController.init();
    setupAccountUI(AccountController);

    // Setup UI components
    MapService.on('click', onMapClick);
    setupSettingsUI(MapService);
    setupMapControlsUI(MapService);
    setupHUDUI(HUDController, SearchController, MarkerController);
    setupMarkerModalUI(MarkerController);
    setupHomeAddressUI(MapService, MarkerController);
    setupGPSUI(GPSController, MapService);
    setupMeasurementUI(MeasurementController);
    setupRoutingUI(RoutingController, MapService);
    setupSearchUI(SearchController, HUDController, MarkerController, ApiService);
    setupPlaceDetailsSheet(SearchController, HUDController, MarkerController, RoutingController);
}

// Auto-initialize when window loads in browser
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        initApp();
    });
}

