// maps Search Controller - js/SearchController.js

import { MapService } from './MapService.js';
import { MarkerController } from './MarkerController.js';
import { HUDController } from './HUDController.js';

export const SearchController = {
    searchMarkers: [],

    clearSearchMarkers() {
        if (this.searchMarkers && this.searchMarkers.length > 0) {
            this.searchMarkers.forEach(marker => {
                if (marker && typeof marker.remove === 'function') {
                    marker.remove();
                }
            });
        }
        this.searchMarkers = [];
    },

    selectResult(item) {
        const lat = parseFloat(item.lat), lon = parseFloat(item.lon);
        const searchInput = document.getElementById('search-input');
        const shortName = item.display_name.split(',')[0];

        MapService.flyTo([lon, lat], 14);
        if (searchInput) searchInput.value = shortName;

        MarkerController.setTempMarker(lat, lon);

        HUDController.setState('place-details', {
            isTemp: true,
            lat: lat,
            lng: lon,
            name: shortName,
            address: item.display_name,
            wikiSummary: '',
            shopInfo: null,
            streetName: ''
        });
    },

    createSearchPinElement(index) {
        const el = document.createElement('div');
        el.className = 'custom-map-pin-div search-result-map-pin-div';
        el.style.cursor = 'pointer';
        el.style.width = '34px';
        el.style.height = '42px';
        el.innerHTML = `<svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 0C7.61 0 0 7.61 0 17C0 26.5 17 42 17 42C17 42 34 26.5 34 17C34 7.61 26.39 0 17 0Z" fill="#3b82f6"/>
            <circle cx="17" cy="17" r="11" fill="white"/>
        </svg>
        <span style="position:absolute;top:6px;left:0;width:34px;height:22px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#2563eb;pointer-events:none;">${index + 1}</span>`;
        return el;
    },

    renderResults(results) {
        const searchResults = document.getElementById('search-results');
        this.clearSearchMarkers();

        if (searchResults) {
            searchResults.innerHTML = '';
            searchResults.classList.remove('hidden');
        }

        if (!results || !Array.isArray(results)) return;

        let minLat = Infinity, maxLat = -Infinity;
        let minLng = Infinity, maxLng = -Infinity;
        let validCount = 0;

        results.forEach((item, idx) => {
            const shortName = item.display_name ? item.display_name.split(',')[0] : 'Location';
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);

            // Render list item in HUD
            if (searchResults) {
                const template = document.getElementById('template-search-result-item');
                if (template) {
                    const clone = template.content.cloneNode(true);
                    const nameEl = clone.querySelector('.result-name');
                    const addrEl = clone.querySelector('.result-address');
                    if (nameEl) nameEl.textContent = shortName;
                    if (addrEl) addrEl.textContent = item.display_name;

                    const itemEl = clone.querySelector('.search-result-item');
                    if (itemEl) {
                        itemEl.addEventListener('click', () => {
                            this.selectResult(item);
                        });
                    }
                    searchResults.appendChild(clone);
                }
            }

            // Create map pin if coordinates are valid
            if (!isNaN(lat) && !isNaN(lon)) {
                minLat = Math.min(minLat, lat);
                maxLat = Math.max(maxLat, lat);
                minLng = Math.min(minLng, lon);
                maxLng = Math.max(maxLng, lon);
                validCount++;

                if (MapService.map && typeof MapService.createMarker === 'function') {
                    const pinEl = this.createSearchPinElement(idx);

                    let popup = null;
                    if (typeof MapService.createPopup === 'function') {
                        popup = MapService.createPopup({
                            offset: [0, -35],
                            closeButton: false,
                            closeOnClick: false,
                            className: 'custom-marker-popup'
                        }).setHTML(`<div class="font-semibold text-xs text-slate-800 dark:text-slate-100">${shortName}</div>`);

                        pinEl.addEventListener('mouseenter', () => popup.addTo(MapService.map));
                        pinEl.addEventListener('mouseleave', () => popup.remove());
                    }

                    const marker = MapService.createMarker(pinEl, false, 'bottom')
                        .setLngLat([lon, lat]);

                    if (popup) {
                        marker.setPopup(popup);
                    }

                    marker.addTo(MapService.map);

                    pinEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.selectResult(item);
                    });

                    this.searchMarkers.push(marker);
                }
            }
        });

        // Fit map bounds to show all search result pins
        if (validCount === 1) {
            MapService.flyTo([minLng, minLat], 14);
        } else if (validCount > 1) {
            if (minLat === maxLat && minLng === maxLng) {
                MapService.flyTo([minLng, minLat], 14);
            } else if (typeof MapService.fitBounds === 'function') {
                MapService.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 80, maxZoom: 15 });
            }
        }
    }
};

window.addEventListener('maps-hud-state-changed', (e) => {
    const state = e.detail && e.detail.state;
    if (state && state !== 'place-details' && state !== 'search-results') {
        SearchController.clearSearchMarkers();
    }
});

