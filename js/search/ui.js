// maps Search UI - js/search/ui.js

import { MapService } from '../map/index.js';
import { MarkerController } from '../markers/index.js';
import { HUDController } from '../hud/index.js';
import { selectResult } from './selectResult.js';
import { prioritizeResults } from './prioritizeResults.js';
import { getRecentSearches, removeRecentSearch, clearRecentSearches } from './recentSearches.js';

export const uiState = {
    searchMarkers: [],
    searchResults: []
};

export function clearSearchMarkers() {
    const markers = (this && this.searchMarkers) || uiState.searchMarkers;
    if (markers && markers.length > 0) {
        markers.forEach(m => {
            if (m && typeof m.remove === 'function') {
                m.remove();
            }
        });
    }
    uiState.searchMarkers = [];
    if (this && this !== uiState) {
        this.searchMarkers = [];
    }
}

export function createSearchPin(item, index) {
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
        const select = (this && typeof this.selectResult === 'function') ? this.selectResult.bind(this) : selectResult;
        select(item);
    });

    return { el, popup };
}

export function renderResults(results) {
    const searchResults = document.getElementById('search-results');
    
    if (searchResults) {
        searchResults.innerHTML = '';
        searchResults.classList.remove('hidden');
    }

    const clearMarkers = (this && typeof this.clearSearchMarkers === 'function') ? this.clearSearchMarkers.bind(this) : clearSearchMarkers;
    clearMarkers();

    if (!Array.isArray(results) || results.length === 0) {
        uiState.searchResults = [];
        if (this && this !== uiState) {
            this.searchResults = uiState.searchResults;
        }
        return;
    }

    const prioritize = (this && typeof this.prioritizeResults === 'function') ? this.prioritizeResults.bind(this) : prioritizeResults;
    const prioritized = prioritize(results);
    uiState.searchResults = prioritized;
    if (this && this !== uiState) {
        this.searchResults = prioritized;
    }

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
                        const select = (this && typeof this.selectResult === 'function') ? this.selectResult.bind(this) : selectResult;
                        select(item);
                    });
                }

                searchResults.appendChild(clone);
            }
        }

        // 2. Create and attach map pin
        if (isValidCoord && MapService.createMarker && MapService.map) {
            const createPin = (this && typeof this.createSearchPin === 'function') ? this.createSearchPin.bind(this) : createSearchPin;
            const { el, popup } = createPin(item, index);
            const markerInstance = MapService.createMarker(el, false, 'bottom')
                .setLngLat([lon, lat]);

            if (popup) {
                markerInstance.setPopup(popup);
            }

            markerInstance.addTo(MapService.map);
            uiState.searchMarkers.push(markerInstance);
            if (this && this !== uiState && Array.isArray(this.searchMarkers) && this.searchMarkers !== uiState.searchMarkers) {
                this.searchMarkers.push(markerInstance);
            }
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

export function renderSuggestions(filterQuery = '') {
    const container = document.getElementById('search-suggestions-container');
    if (!container) return;

    const pillsSection = document.getElementById('search-pills-section');
    const chipSet = document.getElementById('search-pills-chips');
    const divider = document.getElementById('search-suggestions-divider');
    const historySection = document.getElementById('search-history-section');
    const historyList = document.getElementById('search-history-list');
    const clearHistoryBtn = document.getElementById('btn-clear-search-history');
    const searchBar = document.getElementById('search-bar');

    const q = (filterQuery || '').trim().toLowerCase();

    // 1. Base suggestions: Home Address & Saved Places as Pills
    let pillCount = 0;
    if (chipSet) {
        chipSet.innerHTML = '';

        // Home Address Pill
        let home = MapService.getHomeAddress ? MapService.getHomeAddress() : null;
        if (!home && MarkerController && MarkerController.customMarkers) {
            const homeMarker = MarkerController.customMarkers.find(m => m.category === 'home');
            if (homeMarker) {
                home = {
                    address: homeMarker.title,
                    lat: homeMarker.lat,
                    lng: homeMarker.lng
                };
            }
        }

        if (home && typeof home.lat === 'number' && typeof home.lng === 'number') {
            const shortAddr = home.address ? home.address.split(',')[0].trim() : '';
            const homeLabel = shortAddr ? `Home: ${shortAddr}` : 'Home';
            const matchesHome = !q || 'home'.includes(q) || (home.address || '').toLowerCase().includes(q);
            if (matchesHome) {
                const chip = document.createElement('md-chip');
                chip.setAttribute('variant', 'assist');
                chip.setAttribute('icon', 'home');
                chip.setAttribute('label', homeLabel);
                chip.title = home.address || 'Home';
                chip.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (searchBar) {
                        searchBar.value = home.address || 'Home';
                        if (typeof searchBar.close === 'function') searchBar.close();
                    }
                    if (MapService.flyTo) {
                        MapService.flyTo([home.lng, home.lat], 15);
                    }
                    if (MarkerController && MarkerController.setTempMarker) {
                        MarkerController.setTempMarker(home.lat, home.lng);
                    }
                    if (HUDController && HUDController.setState) {
                        HUDController.setState('place-details', {
                            isTemp: true,
                            lat: home.lat,
                            lng: home.lng,
                            name: 'Home',
                            address: home.address || ''
                        });
                    }
                });
                chipSet.appendChild(chip);
                pillCount++;
            }
        }

        // Other Saved Places Pills
        const markers = (MarkerController && MarkerController.customMarkers) ? MarkerController.customMarkers : [];
        markers.forEach(marker => {
            if (home && marker.lat === home.lat && marker.lng === home.lng) return;

            const title = marker.title || 'Saved Place';
            const matches = !q || title.toLowerCase().includes(q) || (marker.description || '').toLowerCase().includes(q);
            if (matches) {
                const chip = document.createElement('md-chip');
                chip.setAttribute('variant', 'assist');
                chip.setAttribute('icon', marker.category === 'home' ? 'home' : 'bookmark');
                chip.setAttribute('label', title);
                if (marker.description) chip.title = marker.description;
                chip.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (searchBar) {
                        searchBar.value = title;
                        if (typeof searchBar.close === 'function') searchBar.close();
                    }
                    if (MapService.flyTo && !isNaN(marker.lng) && !isNaN(marker.lat)) {
                        MapService.flyTo([marker.lng, marker.lat], 15);
                    }
                    if (HUDController && HUDController.setState) {
                        HUDController.setState('place-details', marker);
                    }
                });
                chipSet.appendChild(chip);
                pillCount++;
            }
        });
    }

    if (pillsSection) {
        pillsSection.style.display = pillCount > 0 ? 'flex' : 'none';
    }

    // 2. Previous Searches Underneath
    const getRecent = (this && typeof this.getRecentSearches === 'function') ? this.getRecentSearches.bind(this) : getRecentSearches;
    const recentSearches = getRecent();
    const filteredSearches = q ? recentSearches.filter(s => s.toLowerCase().includes(q)) : recentSearches;

    const removeRecent = (this && typeof this.removeRecentSearch === 'function') ? this.removeRecentSearch.bind(this) : removeRecentSearch;
    const clearRecent = (this && typeof this.clearRecentSearches === 'function') ? this.clearRecentSearches.bind(this) : clearRecentSearches;
    const renderSugg = (this && typeof this.renderSuggestions === 'function') ? this.renderSuggestions.bind(this) : renderSuggestions;

    if (historyList) {
        historyList.innerHTML = '';
        filteredSearches.forEach(searchQuery => {
            const item = document.createElement('div');
            item.className = 'search-history-item';
            item.setAttribute('role', 'option');

            const icon = document.createElement('md-icon');
            icon.setAttribute('name', 'history');
            icon.className = 'search-history-icon';

            const text = document.createElement('span');
            text.className = 'search-history-text';
            text.textContent = searchQuery;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'search-history-remove-btn';
            removeBtn.title = 'Remove';
            removeBtn.setAttribute('aria-label', 'Remove search');

            const removeIcon = document.createElement('md-icon');
            removeIcon.setAttribute('name', 'close');
            removeBtn.appendChild(removeIcon);

            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeRecent(searchQuery);
                renderSugg(searchBar ? searchBar.value : '');
            });

            item.appendChild(icon);
            item.appendChild(text);
            item.appendChild(removeBtn);

            item.addEventListener('click', () => {
                if (searchBar) {
                    searchBar.value = searchQuery;
                    if (typeof searchBar.close === 'function') searchBar.close();
                    searchBar.dispatchEvent(new CustomEvent('search', { detail: { value: searchQuery } }));
                }
            });

            historyList.appendChild(item);
        });
    }

    if (historySection) {
        historySection.style.display = filteredSearches.length > 0 ? 'flex' : 'none';
    }

    if (clearHistoryBtn && !clearHistoryBtn._bound) {
        clearHistoryBtn._bound = true;
        clearHistoryBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearRecent();
            renderSugg(searchBar ? searchBar.value : '');
        });
    }

    if (divider) {
        divider.style.display = (pillCount > 0 && filteredSearches.length > 0) ? 'block' : 'none';
    }
}

export function setupSearchUI(SearchController, HUDController, MarkerController, ApiService) {
    const searchBar = document.getElementById('search-bar');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const btnClearSearch = document.getElementById('btn-clear-search');

    const handleSearch = async (query) => {
        query = (query || '').trim();
        if (!query) return;
        SearchController.addRecentSearch(query);
        try {
            const viewbox = SearchController.getViewbox ? SearchController.getViewbox() : null;
            const data = await ApiService.searchGeocode(query, null, viewbox ? { viewbox } : {});
            if (data && data.length > 0) {
                SearchController.renderResults(data);
                HUDController.setState('search-results');
            }
        } catch (err) {
            console.error("Search failed", err);
        }
    };

    if (searchBar) {
        searchBar.addEventListener('active-change', (e) => {
            if (e.detail?.active) {
                SearchController.renderSuggestions(searchBar.value);
            }
        });

        searchBar.addEventListener('input', (e) => {
            SearchController.renderSuggestions(e.detail?.value ?? searchBar.value);
        });

        searchBar.addEventListener('click', () => {
            SearchController.renderSuggestions(searchBar.value);
        });

        searchBar.addEventListener('leading-icon-click', (e) => {
            e.stopPropagation();
            if (HUDController.currentState === 'saved-places') {
                HUDController.setState('places');
            } else {
                HUDController.setState('saved-places');
            }
        });

        searchBar.addEventListener('search', (e) => {
            handleSearch(e.detail?.value ?? searchBar.value);
        });

        searchBar.addEventListener('clear', () => {
            HUDController.setState('places');
            if (MarkerController && typeof MarkerController.removeTempMarker === 'function') {
                MarkerController.removeTempMarker();
            }
            SearchController.clearSearchMarkers();
            SearchController.renderSuggestions('');
        });

        SearchController.renderSuggestions('');

        window.addEventListener('maps-home-updated', () => {
            SearchController.renderSuggestions(searchBar.value);
        });
    }

    if (searchForm) {
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const query = (searchInput ? searchInput.value : (searchBar ? searchBar.value : '')).trim();
            handleSearch(query);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (btnClearSearch) {
                if (searchInput.value.trim()) {
                    btnClearSearch.classList.remove('hidden');
                } else {
                    btnClearSearch.classList.add('hidden');
                }
            }
        });
    }

    if (btnClearSearch) {
        btnClearSearch.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            btnClearSearch.classList.add('hidden');
            HUDController.setState('places');
            if (MarkerController && typeof MarkerController.removeTempMarker === 'function') {
                MarkerController.removeTempMarker();
            }
            SearchController.clearSearchMarkers();
        });
    }
}


