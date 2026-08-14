// maps Search Controller - js/SearchController.js

import { MapService } from './MapService.js';
import { MarkerController } from './MarkerController.js';
import { HUDController } from './HUDController.js';
import { ApiService } from './ApiService.js';
import { GPSController } from './GPSController.js';

export const SearchController = {
    searchMarkers: [],
    searchResults: [],

    getUserLocation() {
        // Priority 1: Current view
        if (MapService.getCenter && typeof MapService.getCenter === 'function') {
            const center = MapService.getCenter();
            if (center && typeof center.lat === 'number' && typeof center.lng === 'number' && !isNaN(center.lat) && !isNaN(center.lng)) {
                return { lat: center.lat, lng: center.lng, source: 'view' };
            }
        }
        if (MapService.map && typeof MapService.map.getCenter === 'function') {
            const center = MapService.map.getCenter();
            if (center && typeof center.lat === 'number' && typeof center.lng === 'number' && !isNaN(center.lat) && !isNaN(center.lng)) {
                return { lat: center.lat, lng: center.lng, source: 'view' };
            }
        }

        // Priority 2: GPS
        if (GPSController && GPSController.gpsCoords) {
            const { lat, lng } = GPSController.gpsCoords;
            if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
                return { lat, lng, source: 'gps' };
            }
        }

        // Priority 3: Home address
        if (MapService.getHomeAddress && typeof MapService.getHomeAddress === 'function') {
            const home = MapService.getHomeAddress();
            if (home && typeof home.lat === 'number' && typeof home.lng === 'number' && !isNaN(home.lat) && !isNaN(home.lng)) {
                return { lat: home.lat, lng: home.lng, source: 'home' };
            }
        }

        return null;
    },

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth radius in meters
        const phi1 = lat1 * Math.PI / 180;
        const phi2 = lat2 * Math.PI / 180;
        const deltaPhi = (lat2 - lat1) * Math.PI / 180;
        const deltaLambda = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                  Math.cos(phi1) * Math.cos(phi2) *
                  Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // meters
    },

    prioritizeResults(results, referenceLocation = null) {
        if (!Array.isArray(results) || results.length <= 1) {
            return results || [];
        }

        const userLoc = referenceLocation || this.getUserLocation();
        if (!userLoc || typeof userLoc.lat !== 'number' || typeof userLoc.lng !== 'number') {
            return [...results];
        }

        return [...results].map(item => {
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            let distance = Infinity;
            if (!isNaN(lat) && !isNaN(lon)) {
                distance = this.calculateDistance(userLoc.lat, userLoc.lng, lat, lon);
            }
            return { ...item, _distance: distance };
        }).sort((a, b) => a._distance - b._distance);
    },

    getViewbox() {
        if (MapService.getBounds && typeof MapService.getBounds === 'function') {
            const bounds = MapService.getBounds();
            if (bounds && typeof bounds.getWest === 'function') {
                return `${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()},${bounds.getSouth()}`;
            }
        }
        if (MapService.map && typeof MapService.map.getBounds === 'function') {
            const bounds = MapService.map.getBounds();
            if (bounds && typeof bounds.getWest === 'function') {
                return `${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()},${bounds.getSouth()}`;
            }
        }

        const userLoc = this.getUserLocation();
        if (userLoc) {
            const delta = 0.5;
            return `${userLoc.lng - delta},${userLoc.lat + delta},${userLoc.lng + delta},${userLoc.lat - delta}`;
        }

        return null;
    },

    clearSearchMarkers() {
        if (this.searchMarkers && this.searchMarkers.length > 0) {
            this.searchMarkers.forEach(m => {
                if (m && typeof m.remove === 'function') {
                    m.remove();
                }
            });
        }
        this.searchMarkers = [];
    },

    createSearchPin(item, index) {
        const pinNumber = index + 1;
        const shortName = (item.display_name || '').split(',')[0];
        const el = MarkerController.createPin('poi', '#ef4444', pinNumber);
        el.classList.add('search-result-pin-div');

        let popup = null;
        if (MapService.createPopup) {
            popup = MapService.createPopup({
                offset: [0, -35],
                closeButton: false,
                closeOnClick: false,
                className: 'custom-marker-popup'
            }).setHTML(`<div class="font-semibold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5"><span class="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">${pinNumber}</span> <span>${shortName}</span></div>`);

            el.addEventListener('mouseenter', () => {
                if (MapService.map && popup) popup.addTo(MapService.map);
            });
            el.addEventListener('mouseleave', () => {
                if (popup) popup.remove();
            });
        }

        el.addEventListener('click', (e) => {
            if (e && typeof e.stopPropagation === 'function') {
                e.stopPropagation();
            }
            this.selectResult(item);
        });

        return { el, popup };
    },

    async fetchDetailsForPlace(lat, lng, shortName, address, initialShopInfo = null) {
        try {
            const [wikiRes, ovRes] = await Promise.allSettled([
                ApiService.fetchWikipediaSummary ? ApiService.fetchWikipediaSummary(shortName) : null,
                ApiService.fetchOverpassFeatures ? ApiService.fetchOverpassFeatures(lat, lng) : null
            ]);

            let wikiSummary = '';
            let wikiImage = '';
            let wikiUrl = '';
            let shopInfo = initialShopInfo;

            if (wikiRes.status === 'fulfilled' && wikiRes.value && wikiRes.value.extract) {
                wikiSummary = wikiRes.value.extract;
                wikiImage = wikiRes.value.thumbnail?.source || wikiRes.value.originalimage?.source || '';
                wikiUrl = wikiRes.value.content_urls?.desktop?.page || '';
            }

            if (ovRes.status === 'fulfilled' && ovRes.value && ovRes.value.elements) {
                const elements = ovRes.value.elements;
                const nodes = elements.filter(el => el.type === 'node' && el.tags && (el.tags.shop || el.tags.amenity));
                let closestNode = null;
                let nodeMinDist = Infinity;
                nodes.forEach(node => {
                    const dLat = (node.lat - lat);
                    const dLng = (node.lon - lng);
                    const dist = Math.sqrt(dLat * dLat + dLng * dLng) * 111000;
                    if (dist < nodeMinDist) {
                        nodeMinDist = dist;
                        closestNode = node;
                    }
                });

                if (closestNode && nodeMinDist <= 100) {
                    const tags = closestNode.tags;
                    shopInfo = {
                        name: tags.name || (tags.shop ? `Shop (${tags.shop})` : tags.amenity) || (shopInfo?.name) || shortName,
                        type: tags.shop || tags.amenity || (shopInfo?.type),
                        openingHours: tags.opening_hours || (shopInfo?.openingHours) || null,
                        website: tags.website || (shopInfo?.website) || null,
                        phone: tags.phone || (shopInfo?.phone) || null,
                        cuisine: tags.cuisine || (shopInfo?.cuisine) || null,
                        brand: tags.brand || (shopInfo?.brand) || null
                    };
                }
            }

            if (HUDController.currentState === 'place-details') {
                HUDController.setState('place-details', {
                    isTemp: true,
                    lat: lat,
                    lng: lng,
                    name: (shopInfo && shopInfo.name) || shortName,
                    address: address,
                    wikiSummary: wikiSummary,
                    wikiImage: wikiImage,
                    wikiUrl: wikiUrl,
                    shopInfo: shopInfo,
                    streetName: ''
                });
            }
        } catch (e) {
            console.warn("Could not enrich search result details", e);
        }
    },

    selectResult(item) {
        const searchInput = document.getElementById('search-input');
        const shortName = (item.display_name || '').split(',')[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);

        if (MapService.flyTo && !isNaN(lat) && !isNaN(lon)) {
            MapService.flyTo([lon, lat], 14);
        }
        if (searchInput) {
            searchInput.value = shortName;
        }

        if (MarkerController.setTempMarker && !isNaN(lat) && !isNaN(lon)) {
            MarkerController.setTempMarker(lat, lon);
        }

        let initialShopInfo = null;
        if (item.extratags || item.class === 'shop' || item.class === 'amenity') {
            const ext = item.extratags || {};
            initialShopInfo = {
                name: shortName,
                type: ext.shop || ext.amenity || item.type || item.class,
                openingHours: ext.opening_hours || null,
                website: ext.website || ext['contact:website'] || null,
                phone: ext.phone || ext['contact:phone'] || null,
                cuisine: ext.cuisine || null,
                brand: ext.brand || null
            };
        }

        if (HUDController.setState) {
            HUDController.setState('place-details', {
                isTemp: true,
                lat: lat,
                lng: lon,
                name: shortName,
                address: item.display_name,
                wikiSummary: '',
                shopInfo: initialShopInfo,
                streetName: ''
            });
        }

        if (!isNaN(lat) && !isNaN(lon)) {
            this.fetchDetailsForPlace(lat, lon, shortName, item.display_name, initialShopInfo);
        }
    },

    renderResults(results) {
        const searchResults = document.getElementById('search-results');
        
        if (searchResults) {
            searchResults.innerHTML = '';
            searchResults.classList.remove('hidden');
        }

        this.clearSearchMarkers();

        if (!Array.isArray(results) || results.length === 0) {
            this.searchResults = [];
            return;
        }

        const prioritized = this.prioritizeResults(results);
        this.searchResults = prioritized;

        const validCoords = [];

        prioritized.forEach((item, index) => {
            const shortName = (item.display_name || '').split(',')[0];
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            const isValidCoord = !isNaN(lat) && !isNaN(lon);

            // 1. Render HUD search result item
            if (searchResults) {
                const template = document.getElementById('template-search-result-item');
                if (template) {
                    const clone = template.content.cloneNode(true);
                    const nameEl = clone.querySelector('.result-name');
                    const addressEl = clone.querySelector('.result-address');
                    if (nameEl) nameEl.textContent = shortName;
                    if (addressEl) addressEl.textContent = item.display_name;

                    const itemDiv = clone.querySelector('.search-result-item');
                    if (itemDiv) {
                        itemDiv.addEventListener('click', () => {
                            this.selectResult(item);
                        });
                    }

                    searchResults.appendChild(clone);
                }
            }

            // 2. Create and attach map pin
            if (isValidCoord && MapService.createMarker && MapService.map) {
                const { el, popup } = this.createSearchPin(item, index);
                const markerInstance = MapService.createMarker(el, false, 'bottom')
                    .setLngLat([lon, lat]);

                if (popup) {
                    markerInstance.setPopup(popup);
                }

                markerInstance.addTo(MapService.map);
                this.searchMarkers.push(markerInstance);
                validCoords.push([lon, lat]);
            }
        });

        // Fit map bounds if multiple coordinates found
        if (validCoords.length > 1 && MapService.fitBounds && MapService.map) {
            let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
            validCoords.forEach(([cLon, cLat]) => {
                if (cLon < minLon) minLon = cLon;
                if (cLat < minLat) minLat = cLat;
                if (cLon > maxLon) maxLon = cLon;
                if (cLat > maxLat) maxLat = cLat;
            });
            MapService.fitBounds([[minLon, minLat], [maxLon, maxLat]], 80);
        }
    }
};

