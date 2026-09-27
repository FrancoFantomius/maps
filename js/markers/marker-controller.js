// maps Marker Controller - js/markers/marker-controller.js

import { MapService } from '../map/index.js';
import { HUDController } from '../hud/index.js';
import { MeasurementController } from '../measurement/index.js';
import { RoutingController } from '../routing/index.js';
import { deletePlaceFromDB, loadAllPlaces } from '../db/index.js';
import { colorPalette, createPin } from './pin.js';
import { openMarkerModal, closeMarkerModal, saveMarkerFromForm } from './marker-modal.js';

export const MarkerController = {
    customMarkers: [],
    markerInstances: [],
    tempMarker: null,
    homeMarkerInstance: null,
    currentTempDetails: null,

    visibleLimit: 3,

    get colorPalette() {
        return colorPalette;
    },

    createPin(category = 'poi', colorOverride = null, content = null) {
        return createPin(category, colorOverride, content);
    },

    setTempMarker(lat, lng) {
        this.removeTempMarker();
        const el = this.createPin('poi', '#94a3b8');
        this.tempMarker = MapService.createMarker(el, false, 'bottom')
            .setLngLat([lng, lat])
            .addTo(MapService.map);
    },

    removeTempMarker() {
        if (this.tempMarker) {
            this.tempMarker.remove();
            this.tempMarker = null;
        }
    },

    openModal(lat, lng, id = null, tempDetails = null) {
        this.currentTempDetails = tempDetails;
        openMarkerModal(lat, lng, id, tempDetails, this.customMarkers);
    },

    closeModal() {
        closeMarkerModal(() => {
            this.removeTempMarker();
            HUDController.setState('places');
        });
    },

    async saveFromForm() {
        return saveMarkerFromForm(
            this.currentTempDetails,
            this.customMarkers,
            MapService,
            (data, updatedMarkers) => {
                this.customMarkers = updatedMarkers;
                this.renderAll();
                this.removeTempMarker();
                HUDController.setState('place-details', data);
                if (MapService && typeof MapService.flyTo === 'function') {
                    MapService.flyTo([data.lng, data.lat], 15);
                }
            }
        );
    },

    async loadFromStorage() {
        try {
            this.visibleLimit = 3;
            this.customMarkers = await loadAllPlaces();
            this.renderAll();
        } catch (e) {
            console.error("Marker database load failed", e);
        }
    },

    renderHomeMarker() {
        if (this.homeMarkerInstance) {
            this.homeMarkerInstance.remove();
            this.homeMarkerInstance = null;
        }

        const home = MapService.getHomeAddress();
        if (!home || !MapService.map) return;

        const el = this.createPin('home', '#4f46e5');

        const popup = MapService.createPopup({
            offset: [0, -35],
            closeButton: false,
            closeOnClick: false,
            className: 'custom-marker-popup'
        }).setHTML(`<div class="font-semibold text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1"><span>🏠</span> <span>Home Address</span></div><div class="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">${home.address}</div>`);

        this.homeMarkerInstance = MapService.createMarker(el, false, 'bottom')
            .setLngLat([home.lng, home.lat])
            .setPopup(popup)
            .addTo(MapService.map);

        el.addEventListener('mouseenter', () => popup.addTo(MapService.map));
        el.addEventListener('mouseleave', () => popup.remove());

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (MeasurementController.isMeasureMode || RoutingController.isRouteMode) {
                return;
            }
            HUDController.setState('place-details', {
                isTemp: true,
                lat: home.lat,
                lng: home.lng,
                name: 'Home Address',
                address: home.address
            });
            MapService.flyTo([home.lng, home.lat], 15);
        });
    },

    renderAll() {
        const savedMarkersList = document.getElementById('saved-markers-list');
        const markersCount = document.getElementById('place-count-badge') || document.getElementById('markers-count');
        const expandContainer = document.getElementById('saved-places-expand-container');

        if (this.markerInstances) {
            this.markerInstances.forEach(m => m.remove());
        }
        this.markerInstances = [];
        if (savedMarkersList) {
            savedMarkersList.innerHTML = '';
        }
        if (markersCount) {
            markersCount.innerText = String(this.customMarkers.length);
        }

        this.renderHomeMarker();

        if (this.customMarkers.length === 0) {
            if (expandContainer) {
                expandContainer.classList.add('hidden');
            }
            if (savedMarkersList) {
                savedMarkersList.innerHTML = `
                    <div class="markers-empty-state">
                        <md-icon name="bookmark_border" class="markers-empty-icon"></md-icon>
                        <h4 class="markers-empty-title">No saved places yet</h4>
                        <p class="markers-empty-desc">Click on the map or search for places to save your favorite locations.</p>
                    </div>
                `;
            }
            return;
        }

        let home = MapService.getHomeAddress();

        this.customMarkers.forEach((m) => {
            let isHomeMarker = (m.category === 'home') || (home && Math.abs(m.lat - home.lat) < 0.0001 && Math.abs(m.lng - home.lng) < 0.0001);

            if (m.category === 'home' && !home) {
                home = MapService.setHomeAddress({
                    address: m.name || `${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}`,
                    lat: m.lat,
                    lng: m.lng,
                    updatedAt: m.updatedAt || Date.now()
                });
                isHomeMarker = true;
                this.renderHomeMarker();
            }

            if (!isHomeMarker) {
                const el = this.createPin(m.category);
                
                const popup = MapService.createPopup({
                    offset: [0, -35],
                    closeButton: false,
                    closeOnClick: false,
                    className: 'custom-marker-popup'
                }).setHTML(`<div class="font-semibold text-xs text-slate-800 dark:text-slate-100">${m.name}</div>`);

                const pin = MapService.createMarker(el, false, 'bottom')
                    .setLngLat([m.lng, m.lat])
                    .setPopup(popup)
                    .addTo(MapService.map);
                
                el.addEventListener('mouseenter', () => popup.addTo(MapService.map));
                el.addEventListener('mouseleave', () => popup.remove());

                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (MeasurementController.isMeasureMode || RoutingController.isRouteMode) {
                        return;
                    }
                    HUDController.setState('place-details', m);
                    MapService.flyTo([m.lng, m.lat], 15);
                });

                this.markerInstances.push(pin);
            }
        });

        if (!this.visibleLimit || this.visibleLimit < 3) {
            this.visibleLimit = 3;
        }

        const visibleMarkers = this.customMarkers.slice(0, this.visibleLimit);
        visibleMarkers.forEach((m) => {
            this.renderListItem(m, savedMarkersList);
        });

        if (expandContainer) {
            if (this.customMarkers.length > this.visibleLimit) {
                expandContainer.classList.remove('hidden');
            } else {
                expandContainer.classList.add('hidden');
            }
        }

        this.setupListListeners(savedMarkersList);
    },

    resetPagination() {
        this.visibleLimit = 3;
        const savedMarkersList = document.getElementById('saved-markers-list');
        const expandContainer = document.getElementById('saved-places-expand-container');
        const scrollContainer = document.querySelector('.saved-places-body') || savedMarkersList;

        if (scrollContainer) {
            scrollContainer.scrollTop = 0;
        }

        if (savedMarkersList) {
            savedMarkersList.innerHTML = '';
            if (this.customMarkers.length === 0) {
                if (expandContainer) expandContainer.classList.add('hidden');
                savedMarkersList.innerHTML = `
                    <div class="markers-empty-state">
                        <md-icon name="bookmark_border" class="markers-empty-icon"></md-icon>
                        <h4 class="markers-empty-title">No saved places yet</h4>
                        <p class="markers-empty-desc">Click on the map or search for places to save your favorite locations.</p>
                    </div>
                `;
                return;
            }

            const visibleMarkers = this.customMarkers.slice(0, this.visibleLimit);
            visibleMarkers.forEach((m) => {
                this.renderListItem(m, savedMarkersList);
            });

            if (expandContainer) {
                if (this.customMarkers.length > this.visibleLimit) {
                    expandContainer.classList.remove('hidden');
                } else {
                    expandContainer.classList.add('hidden');
                }
            }
        }
    },

    loadMore() {
        if (this.visibleLimit >= this.customMarkers.length) return;
        const previousLimit = this.visibleLimit;
        this.visibleLimit += 10;
        const savedMarkersList = document.getElementById('saved-markers-list');
        const expandContainer = document.getElementById('saved-places-expand-container');

        if (savedMarkersList) {
            const nextBatch = this.customMarkers.slice(previousLimit, this.visibleLimit);
            nextBatch.forEach(m => {
                this.renderListItem(m, savedMarkersList);
            });
        }

        if (expandContainer) {
            if (this.customMarkers.length > this.visibleLimit) {
                expandContainer.classList.remove('hidden');
            } else {
                expandContainer.classList.add('hidden');
            }
        }
    },

    setupListListeners(savedMarkersList) {
        const expandBtn = document.getElementById('btn-expand-saved-places');
        if (expandBtn && !expandBtn._bound) {
            expandBtn._bound = true;
            expandBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.loadMore();
            });
        }

        const scrollContainer = document.querySelector('.saved-places-body') || savedMarkersList;
        if (scrollContainer && !scrollContainer._scrollBound) {
            scrollContainer._scrollBound = true;
            scrollContainer.addEventListener('scroll', () => {
                const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
                if (scrollTop + clientHeight >= scrollHeight - 30) {
                    if (this.visibleLimit < this.customMarkers.length) {
                        this.loadMore();
                    }
                }
            });
        }
    },

    renderListItem(m, container) {
        if (!container) return;
        const template = document.getElementById('template-marker-list-item');
        if (!template) return;
        const clone = template.content.cloneNode(true);
        const config = this.colorPalette[m.category] || this.colorPalette.poi;
        const categoryLabels = {
            poi: 'Point of Interest',
            home: 'Home',
            food: 'Food & Drink',
            lodging: 'Lodging',
            nature: 'Nature / Scenic'
        };

        const itemEl = clone.querySelector('.marker-item') || clone.querySelector('md-list-item');
        const headlineText = m.name || categoryLabels[m.category] || 'Custom pin';
        const supportingText = m.desc || categoryLabels[m.category] || 'Custom pin';

        if (itemEl) {
            itemEl.setAttribute('headline', headlineText);
            itemEl.setAttribute('supporting-text', supportingText);
            itemEl.headline = headlineText;
            itemEl.supportingText = supportingText;
        }

        const dot = clone.querySelector('.marker-color-dot');
        if (dot) dot.style.backgroundColor = config.main;

        const emojiEl = clone.querySelector('.marker-category-emoji');
        if (emojiEl) emojiEl.textContent = config.emoji || '📍';

        const nameEl = clone.querySelector('.marker-name');
        if (nameEl) nameEl.textContent = headlineText;

        const subtextEl = clone.querySelector('.marker-subtext');
        if (subtextEl) subtextEl.textContent = supportingText;

        const focusEl = clone.querySelector('.marker-focus');
        if (focusEl) {
            focusEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (MapService && typeof MapService.flyTo === 'function') {
                    MapService.flyTo([m.lng, m.lat], 15);
                }
                HUDController.setState('place-details', m);
            });
        }

        const deleteBtn = clone.querySelector('.btn-delete-marker');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.delete(m.id);
            });
        }

        if (itemEl) {
            itemEl.addEventListener('click', () => {
                if (MapService && typeof MapService.flyTo === 'function') {
                    MapService.flyTo([m.lng, m.lat], 15);
                }
                HUDController.setState('place-details', m);
            });
        }

        container.appendChild(clone);
    },

    focus(lat, lng, idx) {
        MapService.flyTo([lng, lat], 15);
        setTimeout(() => {
            if (this.markerInstances[idx]) {
                const m = this.customMarkers[idx];
                if (m) {
                    HUDController.setState('place-details', m);
                }
            }
        }, 250);
    },

    async delete(id) {
        try {
            const target = this.customMarkers.find(x => x.id === id);
            await deletePlaceFromDB(id);
            this.customMarkers = await loadAllPlaces();

            if (target && target.category === 'home') {
                const hasOtherHome = this.customMarkers.some(x => x.category === 'home');
                if (!hasOtherHome) {
                    MapService.clearHomeAddress();
                }
            }

            this.renderAll();
            if (HUDController.currentState === 'saved-places') {
                HUDController.setState('saved-places');
            } else {
                HUDController.setState('places');
            }
        } catch (err) {
            console.error("Failed to delete place:", err);
        }
    }
};

window.addEventListener('maps-places-updated', async () => {
    try {
        MarkerController.customMarkers = await loadAllPlaces();
        MarkerController.renderAll();
    } catch (e) {
        console.error("[Sync UI] Error re-rendering markers:", e);
    }
});

window.addEventListener('maps-home-updated', () => {
    MarkerController.renderHomeMarker();
});

export default MarkerController;

