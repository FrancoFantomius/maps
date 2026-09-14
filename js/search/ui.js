// maps Search UI - js/search/ui.js

import { MapService } from '../map/index.js';
import { MarkerController } from '../markers/index.js';
import { HUDController } from '../hud/index.js';
import { selectResult } from './selectResult.js';
import { prioritizeResults } from './prioritizeResults.js';
import { getRecentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } from './recentSearches.js';
import { getViewbox } from './getViewbox.js';
import { fetchPlaceSuggestions, getPlaceIcon } from './fetchPlaceSuggestions.js';

export const uiState = {
    searchMarkers: [],
    searchResults: [],
    isShowingSearchResults: false
};

let liveSearchTimeout = null;
let currentSearchRequestId = 0;

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
    uiState.isShowingSearchResults = false;
    if (this && this !== uiState) {
        this.searchMarkers = [];
        this.isShowingSearchResults = false;
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
    const placesSection = document.getElementById('search-places-section');
    const placesList = document.getElementById('search-places-list');
    const placesTitle = document.getElementById('search-places-header-title');
    const pillsSection = document.getElementById('search-pills-section');
    const historySection = document.getElementById('search-history-section');
    const divider = document.getElementById('search-suggestions-divider');
    const divider2 = document.getElementById('search-suggestions-divider-2');
    const emptySection = document.getElementById('search-empty-section');
    const searchBar = document.getElementById('search-bar');
    
    if (searchResults) {
        searchResults.innerHTML = '';
        searchResults.classList.remove('hidden');
    }

    clearTimeout(liveSearchTimeout);
    currentSearchRequestId++;

    const clearMarkers = (this && typeof this.clearSearchMarkers === 'function') ? this.clearSearchMarkers.bind(this) : clearSearchMarkers;
    clearMarkers();

    if (!Array.isArray(results) || results.length === 0) {
        uiState.searchResults = [];
        uiState.isShowingSearchResults = false;
        if (this && this !== uiState) {
            this.searchResults = uiState.searchResults;
            this.isShowingSearchResults = false;
        }
        if (placesList) placesList.innerHTML = '';
        if (placesSection) placesSection.style.display = 'none';
        if (pillsSection) pillsSection.style.display = 'none';
        if (historySection) historySection.style.display = 'none';
        if (divider) divider.style.display = 'none';
        if (divider2) divider2.style.display = 'none';
        if (emptySection) {
            emptySection.style.display = 'flex';
            const emptySpan = emptySection.querySelector('span');
            if (emptySpan) emptySpan.textContent = 'No results found';
        }
        return;
    }

    const prioritize = (this && typeof this.prioritizeResults === 'function') ? this.prioritizeResults.bind(this) : prioritizeResults;
    const prioritized = prioritize(results);
    uiState.searchResults = prioritized;
    uiState.isShowingSearchResults = true;
    if (this && this !== uiState) {
        this.searchResults = prioritized;
        this.isShowingSearchResults = true;
    }

    // Defocus search text input when search results are showing
    const blurInput = () => {
        if (searchBar) {
            if (searchBar.inputElement && typeof searchBar.inputElement.blur === 'function') {
                searchBar.inputElement.blur();
            }
            if (searchBar.shadowRoot) {
                const inp = searchBar.shadowRoot.querySelector('input');
                if (inp && typeof inp.blur === 'function') inp.blur();
            }
            if (typeof searchBar.blur === 'function') {
                searchBar.blur();
            }
        }
        const searchInput = document.getElementById('search-input');
        if (searchInput && typeof searchInput.blur === 'function') {
            searchInput.blur();
        }
    };
    blurInput();
    if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(blurInput);
    }

    if (placesList && placesSection) {
        placesList.innerHTML = '';
        if (placesTitle) placesTitle.textContent = 'Search Results';
        if (pillsSection) pillsSection.style.display = 'none';
        if (historySection) historySection.style.display = 'none';
        if (divider) divider.style.display = 'none';
        if (divider2) divider2.style.display = 'none';
        if (emptySection) emptySection.style.display = 'none';
    }

    const validCoords = [];

    prioritized.forEach((item, index) => {
        const pinNumber = index + 1;
        const shortName = (item.display_name || '').split(',')[0];
        const addressParts = (item.display_name || '').split(',').slice(1);
        const address = addressParts.join(',').trim();
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        const isValidCoord = !isNaN(lat) && !isNaN(lon);

        // 1. Render HUD search result item (backward compatibility with HUD and tests)
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
        let pinPopup = null;
        if (isValidCoord && MapService.createMarker && MapService.map) {
            const createPin = (this && typeof this.createSearchPin === 'function') ? this.createSearchPin.bind(this) : createSearchPin;
            const { el, popup } = createPin(item, index);
            pinPopup = popup;
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

        // 3. Render into search suggestions box with pin number badge
        if (placesList && placesSection) {
            const itemEl = document.createElement('div');
            itemEl.className = 'search-place-item';
            itemEl.setAttribute('role', 'option');

            const iconEl = document.createElement('md-icon');
            const getIcon = (this && typeof this.getPlaceIcon === 'function') ? this.getPlaceIcon.bind(this) : getPlaceIcon;
            iconEl.setAttribute('name', getIcon(item));
            iconEl.className = 'search-place-icon';

            const detailsEl = document.createElement('div');
            detailsEl.className = 'search-place-details';

            const nameEl = document.createElement('span');
            nameEl.className = 'search-place-name';
            nameEl.textContent = shortName;

            const addrEl = document.createElement('span');
            addrEl.className = 'search-place-address';
            addrEl.textContent = address || item.display_name;

            detailsEl.appendChild(nameEl);
            detailsEl.appendChild(addrEl);

            const badgeEl = document.createElement('span');
            badgeEl.className = 'search-place-pin-badge';
            badgeEl.textContent = String(pinNumber);

            itemEl.appendChild(iconEl);
            itemEl.appendChild(detailsEl);
            itemEl.appendChild(badgeEl);

            if (pinPopup) {
                itemEl.addEventListener('mouseenter', () => {
                    if (MapService.map && pinPopup) pinPopup.addTo(MapService.map);
                });
                itemEl.addEventListener('mouseleave', () => {
                    if (pinPopup) pinPopup.remove();
                });
            }

            itemEl.addEventListener('click', () => {
                uiState.isShowingSearchResults = false;
                if (this && this !== uiState) {
                    this.isShowingSearchResults = false;
                }
                const select = (this && typeof this.selectResult === 'function') ? this.selectResult.bind(this) : selectResult;
                select(item);
                if (searchBar) {
                    searchBar.value = shortName;
                    if (typeof searchBar.close === 'function') searchBar.close();
                }
            });

            placesList.appendChild(itemEl);
        }
    });

    if (placesSection && prioritized.length > 0) {
        placesSection.style.display = 'flex';
    }

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
    const placesSection = document.getElementById('search-places-section');
    const placesList = document.getElementById('search-places-list');
    const divider = document.getElementById('search-suggestions-divider');
    const divider2 = document.getElementById('search-suggestions-divider-2');
    const historySection = document.getElementById('search-history-section');
    const historyList = document.getElementById('search-history-list');
    const clearHistoryBtn = document.getElementById('btn-clear-search-history');
    const emptySection = document.getElementById('search-empty-section');
    const searchBar = document.getElementById('search-bar');

    const q = (filterQuery || '').trim().toLowerCase();

    uiState.isShowingSearchResults = false;
    if (this && this !== uiState) {
        this.isShowingSearchResults = false;
    }

    const placesTitle = document.getElementById('search-places-header-title');
    if (placesTitle) {
        placesTitle.textContent = 'Places';
    }

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
            const matchesHome = !q || 'home'.includes(q) || (home.address || '').toLowerCase().includes(q);
            if (matchesHome) {
                const chip = document.createElement('md-chip');
                chip.setAttribute('variant', 'assist');
                chip.setAttribute('icon', 'home');
                chip.setAttribute('label', 'Home');
                chip.title = home.address || 'Home';
                chip.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (searchBar) {
                        searchBar.value = 'Home';
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

    const hasPills = pillCount > 0;
    const hasHistory = filteredSearches.length > 0;

    const updateVisibility = (hasPlaces) => {
        if (divider) {
            divider.style.display = (hasPills && (hasPlaces || hasHistory)) ? 'block' : 'none';
        }
        if (divider2) {
            divider2.style.display = (hasPlaces && hasHistory) ? 'block' : 'none';
        }
        if (emptySection) {
            emptySection.style.display = (q && !hasPills && !hasPlaces && !hasHistory) ? 'flex' : 'none';
        }
    };

    if (q.length < 2) {
        clearTimeout(liveSearchTimeout);
        currentSearchRequestId++;
        if (placesList) placesList.innerHTML = '';
        if (placesSection) placesSection.style.display = 'none';
        updateVisibility(false);
        return;
    }

    // When query is >= 2 characters, initially update with current places state (or false if none)
    const hasCurrentPlaces = Boolean(placesSection && placesSection.style.display !== 'none' && placesList && placesList.children.length > 0);
    updateVisibility(hasCurrentPlaces);

    // Debounce live suggestions fetch (300ms)
    clearTimeout(liveSearchTimeout);
    const requestId = ++currentSearchRequestId;
    liveSearchTimeout = setTimeout(async () => {
        const getBox = (this && typeof this.getViewbox === 'function') ? this.getViewbox.bind(this) : getViewbox;
        const viewbox = getBox ? getBox() : null;
        const options = viewbox ? { viewbox } : {};
        const fetchSugg = (this && typeof this.fetchPlaceSuggestions === 'function') ? this.fetchPlaceSuggestions.bind(this) : fetchPlaceSuggestions;
        const places = await fetchSugg(filterQuery, options);

        if (requestId !== currentSearchRequestId || uiState.isShowingSearchResults) return;
        if (searchBar && typeof searchBar.value === 'string' && searchBar.value.trim()) {
            const barVal = searchBar.value.trim().toLowerCase();
            if (barVal !== q) return;
        }

        if (placesList && placesSection) {
            placesList.innerHTML = '';
            if (places.length > 0) {
                places.forEach(place => {
                    const item = document.createElement('div');
                    item.className = 'search-place-item';
                    item.setAttribute('role', 'option');

                    const iconEl = document.createElement('md-icon');
                    iconEl.setAttribute('name', place.icon || 'location_on');
                    iconEl.className = 'search-place-icon';

                    const details = document.createElement('div');
                    details.className = 'search-place-details';

                    const nameEl = document.createElement('span');
                    nameEl.className = 'search-place-name';
                    nameEl.textContent = place.name;

                    const addrEl = document.createElement('span');
                    addrEl.className = 'search-place-address';
                    addrEl.textContent = place.address;

                    details.appendChild(nameEl);
                    details.appendChild(addrEl);

                    item.appendChild(iconEl);
                    item.appendChild(details);

                    item.addEventListener('click', () => {
                        const addRecent = (this && typeof this.addRecentSearch === 'function') ? this.addRecentSearch.bind(this) : addRecentSearch;
                        addRecent(place.name);

                        if (searchBar) {
                            searchBar.value = place.name;
                            if (typeof searchBar.close === 'function') searchBar.close();
                        }

                        const select = (this && typeof this.selectResult === 'function') ? this.selectResult.bind(this) : selectResult;
                        select(place.raw);
                    });

                    placesList.appendChild(item);
                });
                placesSection.style.display = 'flex';
            } else {
                placesSection.style.display = 'none';
            }
        }

        const hasPlacesNow = Boolean(places && places.length > 0);
        updateVisibility(hasPlacesNow);
    }, 300);
}

export function setupSearchUI(SearchController, HUDController, MarkerController, ApiService) {
    const searchBar = document.getElementById('search-bar');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const btnClearSearch = document.getElementById('btn-clear-search');

    const handleSearch = async (query) => {
        query = (query || '').trim();
        if (!query) return;

        clearTimeout(liveSearchTimeout);
        currentSearchRequestId++;

        SearchController.addRecentSearch(query);
        try {
            const viewbox = SearchController.getViewbox ? SearchController.getViewbox() : null;
            const data = await ApiService.searchGeocode(query, null, viewbox ? { viewbox } : {});

            clearTimeout(liveSearchTimeout);
            currentSearchRequestId++;

            const render = (SearchController && typeof SearchController.renderResults === 'function') ? SearchController.renderResults.bind(SearchController) : renderResults;
            if (data && data.length > 0) {
                render(data);
            } else {
                render([]);
            }
            if (searchBar) {
                if (typeof searchBar.show === 'function' && !searchBar.active) {
                    searchBar.show();
                } else if (!searchBar.active) {
                    searchBar.active = true;
                }
                if (searchBar.updateComplete) {
                    searchBar.updateComplete.then(() => {
                        const inp = searchBar.inputElement || searchBar.shadowRoot?.querySelector('input');
                        inp?.blur();
                    });
                }
            }
        } catch (err) {
            console.error("Search failed", err);
        }
    };

    if (searchBar) {
        const disableScrim = () => {
            if (!searchBar.shadowRoot) return;
            if (!searchBar.shadowRoot.querySelector('#disable-scrim-style')) {
                const style = document.createElement('style');
                style.id = 'disable-scrim-style';
                style.textContent = '.scrim { display: none !important; pointer-events: none !important; }';
                searchBar.shadowRoot.appendChild(style);
            }
            const scrim = searchBar.shadowRoot.querySelector('.scrim');
            if (scrim) {
                scrim.style.setProperty('display', 'none', 'important');
                scrim.style.setProperty('pointer-events', 'none', 'important');
            }
        };

        const attachClearTooltip = () => {
            const clearBtn = searchBar.shadowRoot?.querySelector('.clear-btn');
            const clearTooltip = document.getElementById('search-clear-tooltip');
            if (clearBtn && clearTooltip && clearTooltip.anchor !== clearBtn) {
                clearTooltip.anchor = clearBtn;
            }
        };

        disableScrim();
        attachClearTooltip();
        if (searchBar.updateComplete) {
            searchBar.updateComplete.then(() => {
                disableScrim();
                attachClearTooltip();
            });
        }
        if (searchBar.shadowRoot && typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver(() => {
                disableScrim();
                attachClearTooltip();
            });
            observer.observe(searchBar.shadowRoot, { childList: true, subtree: true });
        }

        if (!searchBar.suggestions || searchBar.suggestions.length === 0) {
            searchBar.suggestions = [{ label: '' }];
        }

        searchBar.addEventListener('active-change', (e) => {
            disableScrim();
            attachClearTooltip();
            if (e.detail?.active && !uiState.isShowingSearchResults) {
                SearchController.renderSuggestions(searchBar.value);
            }
        });

        searchBar.addEventListener('input', (e) => {
            uiState.isShowingSearchResults = false;
            if (SearchController) {
                SearchController.isShowingSearchResults = false;
            }
            attachClearTooltip();
            SearchController.renderSuggestions(e.detail?.value ?? searchBar.value);
        });

        searchBar.addEventListener('click', (e) => {
            const path = e.composedPath ? e.composedPath() : [];
            if (path.some(el => el.classList?.contains('scrim'))) {
                if (typeof searchBar.close === 'function') {
                    searchBar.close();
                } else {
                    searchBar.active = false;
                }
                if (searchBar.inputElement && typeof searchBar.inputElement.blur === 'function') {
                    searchBar.inputElement.blur();
                }
                return;
            }
            if (e.target?.closest?.('md-icon-button') || e.target?.closest?.('.icon-btn') || e.target?.closest?.('.leading-btn') || e.target?.closest?.('.trailing-btn')) {
                return;
            }
            if (typeof searchBar.show === 'function' && !searchBar.active) {
                searchBar.show();
            } else if (!searchBar.active) {
                searchBar.active = true;
            }
            if (!uiState.isShowingSearchResults) {
                SearchController.renderSuggestions(searchBar.value);
            }
        });

        // Close search bar when clicking outside on map or document
        const closeSearchBarIfOutside = (e) => {
            if (searchBar && searchBar.active) {
                const path = e.composedPath ? e.composedPath() : [];
                const isInsideSearchBar = (path.includes(searchBar) || searchBar.contains(e.target)) && !path.some(el => el.classList?.contains('scrim'));
                if (!isInsideSearchBar) {
                    if (uiState.isShowingSearchResults) {
                        const isMapInteraction = (e.target && (e.target.id === 'map' || (typeof e.target.closest === 'function' && (e.target.closest('#map') || e.target.closest('.search-result-pin-div') || e.target.closest('.custom-marker-popup') || e.target.closest('.map-control-btn') || e.target.closest('#map-controls-stack') || e.target.closest('.map-control-item') || e.target.closest('.map-control-fab'))))) || path.some(el => el.id === 'map' || el.classList?.contains('maplibregl-canvas') || el.classList?.contains('mapboxgl-canvas') || el.classList?.contains('maplibregl-ctrl') || el.classList?.contains('map-control-btn') || el.classList?.contains('search-result-pin-div') || el.classList?.contains('custom-marker-popup') || el.id === 'map-controls-stack' || el.classList?.contains('map-control-item') || el.classList?.contains('map-control-fab'));
                        if (isMapInteraction) {
                            return;
                        }
                    }
                    if (typeof searchBar.close === 'function') {
                        searchBar.close();
                    } else {
                        searchBar.active = false;
                    }
                    if (searchBar.inputElement && typeof searchBar.inputElement.blur === 'function') {
                        searchBar.inputElement.blur();
                    }
                }
            }
        };

        document.addEventListener('pointerdown', closeSearchBarIfOutside, true);
        document.addEventListener('click', closeSearchBarIfOutside, true);

        if (MapService && typeof MapService.on === 'function') {
            const onMapEvent = () => {
                if (uiState.isShowingSearchResults) {
                    return;
                }
                if (searchBar && searchBar.active) {
                    if (typeof searchBar.close === 'function') {
                        searchBar.close();
                    } else {
                        searchBar.active = false;
                    }
                    if (searchBar.inputElement && typeof searchBar.inputElement.blur === 'function') {
                        searchBar.inputElement.blur();
                    }
                }
            };
            MapService.on('click', onMapEvent);
            MapService.on('movestart', onMapEvent);
        }

        const btnSearchMenu = document.getElementById('btn-search-menu');
        if (btnSearchMenu && !btnSearchMenu._bound) {
            btnSearchMenu._bound = true;
            btnSearchMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                if (HUDController.currentState === 'saved-places') {
                    HUDController.setState('places');
                } else {
                    HUDController.setState('saved-places');
                }
            });
        }

        const btnSearchSubmit = document.getElementById('btn-search-submit');
        if (btnSearchSubmit && !btnSearchSubmit._bound) {
            btnSearchSubmit._bound = true;
            btnSearchSubmit.addEventListener('click', (e) => {
                e.stopPropagation();
                const query = (searchBar ? searchBar.value : '').trim();
                handleSearch(query);
            });
        }

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
            const clearTooltip = document.getElementById('search-clear-tooltip');
            if (clearTooltip && typeof clearTooltip.hide === 'function') {
                clearTooltip.hide();
            }
            uiState.isShowingSearchResults = false;
            uiState.searchResults = [];
            HUDController.setState('places');
            if (MarkerController && typeof MarkerController.removeTempMarker === 'function') {
                MarkerController.removeTempMarker();
            }
            SearchController.clearSearchMarkers();
            SearchController.renderSuggestions('');
        });

        SearchController.renderSuggestions('');

        window.addEventListener('maps-home-updated', () => {
            if (!uiState.isShowingSearchResults) {
                SearchController.renderSuggestions(searchBar.value);
            }
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


