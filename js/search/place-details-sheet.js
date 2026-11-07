// maps Search - js/search/place-details-sheet.js

import { ApiService } from '../api/index.js';
import { MapService } from '../map/index.js';

let currentPlaceData = null;
let isBound = false;

export function getCurrentPlaceData() {
    return currentPlaceData;
}

export function openPlaceDetails(data) {
    if (!data) return;
    currentPlaceData = data;

    const sheet = document.getElementById('place-details-sheet');
    if (!sheet) return;

    const isLoading = Boolean(data.isLoading);

    // 0. Loading state indicator
    const loadingSec = document.getElementById('sheet-loading-section');
    if (loadingSec) {
        loadingSec.classList.toggle('hidden', !isLoading);
    }

    // 1. Search bar text update & retraction
    const searchBar = document.getElementById('search-bar');
    const searchInput = document.getElementById('search-input');
    const shortName = isLoading ? "Loading details..." : (data.name || "Selected Location");
    if (searchBar) {
        searchBar.value = shortName;
        searchBar.active = false;
        if (typeof searchBar.close === 'function') {
            searchBar.close();
        }
        if (typeof searchBar.blur === 'function') {
            searchBar.blur();
        }
        if (searchBar.inputElement && typeof searchBar.inputElement.blur === 'function') {
            searchBar.inputElement.blur();
        }
        if (searchBar.shadowRoot) {
            const inp = searchBar.shadowRoot.querySelector('input');
            if (inp && typeof inp.blur === 'function') inp.blur();
        }
    }
    if (searchInput) {
        searchInput.value = shortName;
        if (typeof searchInput.blur === 'function') searchInput.blur();
    }

    // If still loading, open sheet and exit early
    if (isLoading) {
        const imageContainer = document.getElementById('sheet-image-container');
        if (imageContainer) imageContainer.classList.add('hidden');
        const transitSec = document.getElementById('sheet-transit-section');
        if (transitSec) transitSec.classList.add('hidden');
        const shopSec = document.getElementById('sheet-shop-section');
        if (shopSec) shopSec.classList.add('hidden');
        const wikiSec = document.getElementById('sheet-wiki-section');
        if (wikiSec) wikiSec.classList.add('hidden');
        const addressSec = document.getElementById('sheet-address-section');
        if (addressSec) addressSec.classList.add('hidden');

        if (typeof sheet.show === 'function') {
            sheet.show();
        } else {
            sheet.open = true;
        }
        return;
    }

    // 2. Cover image banner
    const imageContainer = document.getElementById('sheet-image-container');
    const imageEl = document.getElementById('sheet-image');
    if (imageContainer && imageEl) {
        if (data.wikiImage) {
            imageEl.src = data.wikiImage;
            imageContainer.classList.remove('hidden');
        } else {
            imageContainer.classList.add('hidden');
            imageEl.src = '';
        }
    }

    // 3. Coordinates & Category chips
    const coordsChip = document.getElementById('sheet-coords-chip');
    if (coordsChip) {
        if (!isNaN(data.lat) && !isNaN(data.lng)) {
            coordsChip.setAttribute('label', `${Number(data.lat).toFixed(5)}, ${Number(data.lng).toFixed(5)}`);
            coordsChip.parentElement?.classList.remove('hidden');
        } else {
            coordsChip.parentElement?.classList.add('hidden');
        }
    }

    const categoryChip = document.getElementById('sheet-category-chip');
    if (categoryChip) {
        if (data.category) {
            const categoryLabels = {
                poi: 'Point of Interest',
                home: 'Home',
                food: 'Food & Drink',
                lodging: 'Lodging',
                nature: 'Nature / Scenic'
            };
            const categoryIcons = {
                poi: 'place',
                home: 'home',
                food: 'restaurant',
                lodging: 'hotel',
                nature: 'park'
            };
            categoryChip.setAttribute('label', categoryLabels[data.category] || data.category);
            categoryChip.setAttribute('icon', categoryIcons[data.category] || 'bookmark');
            categoryChip.classList.remove('hidden');
        } else {
            categoryChip.classList.add('hidden');
        }
    }

    // 4. Saved notes section
    const notesSec = document.getElementById('sheet-notes-section');
    const notesText = document.getElementById('sheet-notes-text');
    if (notesSec && notesText) {
        if (data.desc) {
            notesText.textContent = data.desc;
            notesSec.classList.remove('hidden');
        } else {
            notesSec.classList.add('hidden');
        }
    }

    // 5. Save & Delete buttons state for saved places
    const btnSaveEl = document.getElementById('sheet-btn-save');
    const btnDeleteEl = document.getElementById('sheet-btn-delete');
    const isSavedPlace = Boolean(data.id);
    if (btnSaveEl) {
        if (isSavedPlace) {
            btnSaveEl.setAttribute('icon', 'edit');
            const span = btnSaveEl.querySelector('span');
            if (span) span.textContent = 'Edit Place';
        } else {
            btnSaveEl.setAttribute('icon', 'bookmark_add');
            const span = btnSaveEl.querySelector('span');
            if (span) span.textContent = 'Save Place';
        }
    }
    if (btnDeleteEl) {
        if (isSavedPlace) {
            btnDeleteEl.classList.remove('hidden');
        } else {
            btnDeleteEl.classList.add('hidden');
        }
    }

    // 6. Address section
    const addressSec = document.getElementById('sheet-address-section');
    const addressText = document.getElementById('sheet-address-text');
    if (addressSec && addressText) {
        if (data.address) {
            addressText.textContent = data.address;
            addressSec.classList.remove('hidden');
        } else {
            addressSec.classList.add('hidden');
        }

        const isIncomplete = !data.address || (data.name && data.address.trim() === data.name.trim()) || !data.address.includes(',');
        if (isIncomplete && !isNaN(data.lat) && !isNaN(data.lng) && ApiService && typeof ApiService.reverseGeocode === 'function') {
            const placeRef = data;
            ApiService.reverseGeocode(data.lat, data.lng)
                .then(res => {
                    if (res && res.display_name && currentPlaceData === placeRef) {
                        placeRef.address = res.display_name;
                        addressText.textContent = res.display_name;
                        addressSec.classList.remove('hidden');
                    }
                })
                .catch(err => {
                    console.warn("Reverse geocoding address enrichment failed", err);
                });
        }
    }

    // 5. Street highlight section
    const streetSec = document.getElementById('sheet-street-section');
    const streetText = document.getElementById('sheet-street-text');
    if (streetSec && streetText) {
        if (data.streetName) {
            streetText.textContent = `Highlighting: ${data.streetName}`;
            streetSec.classList.remove('hidden');
        } else {
            streetSec.classList.add('hidden');
        }
    }

    // 5b. Public Transit route & stops section
    const transitSec = document.getElementById('sheet-transit-section');
    if (transitSec) {
        if (data.transitInfo) {
            transitSec.classList.remove('hidden');
            const t = data.transitInfo;

            const modeIconEl = document.getElementById('sheet-transit-mode-icon');
            if (modeIconEl) {
                const iconName = t.route === 'tram' ? 'tram'
                    : (t.route === 'subway' ? 'subway'
                    : (t.route === 'train' ? 'train'
                    : (t.route === 'ferry' ? 'directions_boat' : 'directions_bus')));
                modeIconEl.setAttribute('name', iconName);
            }

            const badgeEl = document.getElementById('sheet-transit-ref-badge');
            if (badgeEl) {
                if (t.ref) {
                    badgeEl.textContent = t.ref;
                    badgeEl.style.backgroundColor = t.colour || '#2563eb';
                    badgeEl.style.color = '#ffffff';
                    badgeEl.classList.remove('hidden');
                } else {
                    badgeEl.classList.add('hidden');
                }
            }

            const nameEl = document.getElementById('sheet-transit-name');
            if (nameEl) {
                nameEl.textContent = t.name || (t.ref ? `Line ${t.ref}` : 'Transit Line');
            }

            const destRow = document.getElementById('sheet-transit-dest-row');
            const destEl = document.getElementById('sheet-transit-dest');
            if (destRow && destEl) {
                if (t.from || t.to) {
                    destEl.textContent = (t.from && t.to) ? `${t.from} → ${t.to}` : (t.to || t.from);
                    destRow.classList.remove('hidden');
                } else {
                    destRow.classList.add('hidden');
                }
            }

            const opRow = document.getElementById('sheet-transit-operator-row');
            const opEl = document.getElementById('sheet-transit-operator');
            if (opRow && opEl) {
                if (t.operator) {
                    opEl.textContent = t.operator;
                    opRow.classList.remove('hidden');
                } else {
                    opRow.classList.add('hidden');
                }
            }

            // Overview action button
            const btnOverview = document.getElementById('sheet-btn-transit-overview');
            if (btnOverview) {
                btnOverview.onclick = (e) => {
                    e.stopPropagation();
                    if (t.lineCoords && t.lineCoords.length > 0 && MapService) {
                        MapService.highlightTransitRoute(t.lineCoords, t.colour || '#2563eb');
                        MapService.fitCoordinates(t.lineCoords);
                    }
                };
            }

            // Populate stops list
            const stopsContainer = document.getElementById('sheet-transit-stops-container');
            const countEl = document.getElementById('sheet-transit-stops-count');
            const stops = Array.isArray(t.stops) ? t.stops : [];
            if (countEl) {
                countEl.textContent = `${stops.length} stop${stops.length !== 1 ? 's' : ''}`;
            }

            if (stopsContainer) {
                stopsContainer.innerHTML = '';
                if (stops.length === 0) {
                    const empty = document.createElement('div');
                    empty.className = 'text-muted text-xs p-2 text-center';
                    empty.textContent = 'No detailed stop list available';
                    stopsContainer.appendChild(empty);
                } else {
                    stops.forEach((stop, idx) => {
                        const item = document.createElement('div');
                        item.className = 'transit-stop-item';
                        item.setAttribute('role', 'button');
                        item.setAttribute('tabindex', '0');

                        const indexBadge = document.createElement('span');
                        indexBadge.className = 'transit-stop-index';
                        indexBadge.textContent = String(idx + 1);

                        const info = document.createElement('div');
                        info.className = 'transit-stop-info';

                        const stopName = document.createElement('span');
                        stopName.className = 'transit-stop-name';
                        stopName.textContent = stop.name || `Stop #${idx + 1}`;

                        info.appendChild(stopName);
                        if (stop.ref) {
                            const stopRef = document.createElement('span');
                            stopRef.className = 'transit-stop-ref';
                            stopRef.textContent = `Ref: ${stop.ref}`;
                            info.appendChild(stopRef);
                        }

                        const pinIcon = document.createElement('md-icon');
                        pinIcon.setAttribute('name', 'pin_drop');
                        pinIcon.className = 'transit-stop-action-icon';

                        item.appendChild(indexBadge);
                        item.appendChild(info);
                        item.appendChild(pinIcon);

                        item.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (stop.lat && (stop.lon || stop.lng) && MapService) {
                                const lat = Number(stop.lat);
                                const lng = Number(stop.lon || stop.lng);
                                if (!isNaN(lat) && !isNaN(lng)) {
                                    if (typeof MapService.flyTo === 'function') {
                                        MapService.flyTo({ center: [lng, lat], zoom: 16 });
                                    } else if (typeof MapService.panTo === 'function') {
                                        MapService.panTo([lng, lat]);
                                    }
                                }
                            }
                        });

                        stopsContainer.appendChild(item);
                    });
                }
            }
        } else {
            transitSec.classList.add('hidden');
        }
    }

    // 6. Shop / POI details section
    const shopSec = document.getElementById('sheet-shop-section');
    if (shopSec) {
        if (data.shopInfo) {
            shopSec.classList.remove('hidden');
            const info = data.shopInfo;

            const setField = (rowId, valId, value, formatter) => {
                const row = document.getElementById(rowId);
                const val = document.getElementById(valId);
                if (row && val) {
                    if (value) {
                        val.textContent = formatter ? formatter(value) : value;
                        row.classList.remove('hidden');
                    } else {
                        row.classList.add('hidden');
                    }
                }
            };

            setField('sheet-shop-type', 'sheet-shop-type-val', info.type, v => String(v).replace(/_/g, ' '));
            setField('sheet-shop-brand', 'sheet-shop-brand-val', info.brand);
            setField('sheet-shop-hours', 'sheet-shop-hours-val', info.openingHours);
            setField('sheet-shop-cuisine', 'sheet-shop-cuisine-val', info.cuisine);

            const phoneRow = document.getElementById('sheet-shop-phone');
            const phoneLink = document.getElementById('sheet-shop-phone-link');
            if (phoneRow && phoneLink) {
                if (info.phone) {
                    phoneLink.textContent = info.phone;
                    phoneLink.href = `tel:${info.phone}`;
                    phoneRow.classList.remove('hidden');
                } else {
                    phoneRow.classList.add('hidden');
                }
            }

            const webRow = document.getElementById('sheet-shop-web');
            const webLink = document.getElementById('sheet-shop-web-link');
            if (webRow && webLink) {
                if (info.website) {
                    webLink.textContent = info.website;
                    webLink.href = info.website;
                    webRow.classList.remove('hidden');
                } else {
                    webRow.classList.add('hidden');
                }
            }
        } else {
            shopSec.classList.add('hidden');
        }
    }

    // 7. Wikipedia summary section
    const wikiSec = document.getElementById('sheet-wiki-section');
    const wikiText = document.getElementById('sheet-wiki-text');
    const wikiLink = document.getElementById('sheet-wiki-link');
    if (wikiSec && wikiText) {
        if (data.wikiSummary) {
            wikiText.textContent = data.wikiSummary;
            if (wikiLink) {
                if (data.wikiUrl) {
                    wikiLink.href = data.wikiUrl;
                    wikiLink.classList.remove('hidden');
                } else {
                    wikiLink.classList.add('hidden');
                }
            }
            wikiSec.classList.remove('hidden');
        } else {
            wikiSec.classList.add('hidden');
        }
    }

    // 8. Credits
    const wikiCreditDot = document.getElementById('sheet-wiki-credit-dot');
    const wikiCreditLink = document.getElementById('sheet-wiki-credit-link');
    if (wikiCreditDot && wikiCreditLink) {
        if (data.wikiUrl) {
            wikiCreditLink.href = data.wikiUrl;
            wikiCreditDot.classList.remove('hidden');
            wikiCreditLink.classList.remove('hidden');
        } else {
            wikiCreditDot.classList.add('hidden');
            wikiCreditLink.classList.add('hidden');
        }
    }

    // 9. Open the side-sheet
    if (typeof sheet.show === 'function') {
        sheet.show();
    } else {
        sheet.open = true;
    }

    // 10. Ensure HUD panel and saved-places-sheet are closed
    const savedSheet = document.getElementById('saved-places-sheet');
    if (savedSheet) {
        if (typeof savedSheet.close === 'function') {
            savedSheet.close();
        } else {
            savedSheet.open = false;
        }
    }
    const hudPanel = document.getElementById('hud-panel');
    if (hudPanel) {
        hudPanel.classList.add('hud-closed');
        hudPanel.classList.remove('hud-open', 'hud-open-default', 'hud-open-expanded');
    }
}

export function closePlaceDetails() {
    const sheet = document.getElementById('place-details-sheet');
    if (sheet) {
        if (typeof sheet.close === 'function') {
            sheet.close();
        } else {
            sheet.open = false;
        }
    }
}

export function setupPlaceDetailsSheet(SearchController, HUDController, MarkerController, RoutingController) {
    const sheet = document.getElementById('place-details-sheet');
    const btnClose = document.getElementById('sheet-btn-close');
    const btnDirections = document.getElementById('sheet-btn-directions');
    const btnSave = document.getElementById('sheet-btn-save');

    const handleDismiss = () => {
        closePlaceDetails();
        if (HUDController && typeof HUDController.setState === 'function') {
            HUDController.setState('places');
        }
        if (MarkerController && typeof MarkerController.removeTempMarker === 'function') {
            MarkerController.removeTempMarker();
        }
        if (HUDController && typeof HUDController.clearHighlightedPath === 'function') {
            HUDController.clearHighlightedPath();
        }
    };

    // Close side-sheet when searchbar is cleared or emptied
    const searchBar = document.getElementById('search-bar');
    if (searchBar && !searchBar._placeDetailsBound) {
        searchBar._placeDetailsBound = true;
        searchBar.addEventListener('clear', () => {
            handleDismiss();
        });
        searchBar.addEventListener('input', (e) => {
            const val = (e.detail?.value ?? searchBar.value ?? '').trim();
            if (!val && HUDController && HUDController.currentState === 'place-details') {
                handleDismiss();
            }
        });
    }

    const searchInput = document.getElementById('search-input');
    if (searchInput && !searchInput._placeDetailsBound) {
        searchInput._placeDetailsBound = true;
        searchInput.addEventListener('input', () => {
            if (!searchInput.value.trim() && HUDController && HUDController.currentState === 'place-details') {
                handleDismiss();
            }
        });
    }

    if (btnClose && !btnClose._bound) {
        btnClose._bound = true;
        btnClose.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDismiss();
        });
    }

    if (sheet && !sheet._bound) {
        sheet._bound = true;
        sheet.addEventListener('close', (e) => {
            if (e.target && e.target !== sheet) return;
            if (HUDController && HUDController.currentState === 'place-details') {
                handleDismiss();
            }
        });
        sheet.addEventListener('close-click', (e) => {
            if (e.target && e.target !== sheet) return;
            handleDismiss();
        });
    }

    if (btnDirections && !btnDirections._bound) {
        btnDirections._bound = true;
        btnDirections.addEventListener('click', (e) => {
            e.stopPropagation();
            const placeData = getCurrentPlaceData();
            if (!placeData) return;
            if (RoutingController && typeof RoutingController.enter === 'function') {
                RoutingController.enter();
                RoutingController.setDestination(
                    { lat: placeData.lat, lng: placeData.lng },
                    placeData.name || "Selected Destination"
                );
            }
        });
    }

    if (btnSave && !btnSave._bound) {
        btnSave._bound = true;
        btnSave.addEventListener('click', (e) => {
            e.stopPropagation();
            const placeData = getCurrentPlaceData();
            if (!placeData) return;
            if (MarkerController && typeof MarkerController.openModal === 'function') {
                MarkerController.openModal(
                    placeData.lat,
                    placeData.lng,
                    placeData.id || null,
                    placeData
                );
            }
        });
    }

    const btnDelete = document.getElementById('sheet-btn-delete');
    if (btnDelete && !btnDelete._bound) {
        btnDelete._bound = true;
        btnDelete.addEventListener('click', (e) => {
            e.stopPropagation();
            const placeData = getCurrentPlaceData();
            if (!placeData || !placeData.id) return;
            if (MarkerController && typeof MarkerController.delete === 'function') {
                MarkerController.delete(placeData.id);
            }
            handleDismiss();
        });
    }
}
