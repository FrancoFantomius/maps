// maps Marker Controller - js/MarkerController.js

import { MapService } from './MapService.js';
import { HUDController } from './HUDController.js';
import { MeasurementController } from './MeasurementController.js';
import { RoutingController } from './RoutingController.js';
import { savePlace, deletePlaceFromDB, loadAllPlaces } from './db.js';

export const MarkerController = {
    customMarkers: [],
    markerInstances: [],
    tempMarker: null,

    colorPalette: {
        poi: { main: '#6366f1', fill: '#818cf8', emoji: '🎯', svg: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' },
        food: { main: '#ef4444', fill: '#f87171', emoji: '🍕', svg: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm4-3h2v16h2V2h-4c0 2.21 1.79 4 4 4z' },
        lodging: { main: '#a855f7', fill: '#c084fc', emoji: '🏨', svg: 'M7 14c1.66 0 3-1.34 3-3S8.66 8 7 8s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z' },
        nature: { main: '#10b981', fill: '#34d399', emoji: '🌿', svg: 'M2 22h20v-2h-3l-3.23-6.46L19 12h-3l-3.32-6.64L15 4H9l2.32 4.64L8 10H5l3.23 6.46L5 18H2v4z' }
    },

    createPin(category = 'poi', colorOverride = null) {
        const config = this.colorPalette[category] || this.colorPalette.poi;
        const el = document.createElement('div');
        el.className = 'custom-map-pin-div';
        el.style.cursor = 'pointer';
        el.style.position = 'relative';
        el.style.width = '34px';
        el.style.height = '42px';
        el.innerHTML = `<svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 0C7.61 0 0 7.61 0 17C0 26.5 17 42 17 42C17 42 34 26.5 34 17C34 7.61 26.39 0 17 0Z" fill="${colorOverride || config.main}"/>
            <circle cx="17" cy="17" r="11" fill="white"/>
        </svg>
        <span style="position:absolute;top:7px;left:0;width:34px;height:22px;display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1;pointer-events:none;">${config.emoji}</span>`;
        return el;
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

    currentTempDetails: null,

    openModal(lat, lng, id = null, tempDetails = null) {
        const modalLat = document.getElementById('modal-lat');
        const modalLng = document.getElementById('modal-lng');
        const modalId = document.getElementById('modal-id');
        const modalName = document.getElementById('modal-name');
        const modalCategory = document.getElementById('modal-category');
        const modalDesc = document.getElementById('modal-desc');
        const modalTitle = document.getElementById('modal-title');
        const markerModal = document.getElementById('marker-modal');

        this.currentTempDetails = tempDetails;

        modalLat.value = lat;
        modalLng.value = lng;
        if (id) {
            const m = this.customMarkers.find(x => x.id === id);
            if (m) {
                modalId.value = m.id;
                modalName.value = m.name;
                modalCategory.value = m.category;
                modalDesc.value = m.desc;
                modalTitle.innerText = "Edit Marker";
            }
        } else {
            modalId.value = '';
            modalName.value = tempDetails ? tempDetails.name : '';
            modalCategory.value = 'poi';
            modalDesc.value = '';
            modalTitle.innerText = "Save Location";
        }
        markerModal.classList.remove('hidden');
    },

    closeModal() {
        const markerModal = document.getElementById('marker-modal');
        markerModal.classList.add('hidden');
        this.removeTempMarker();
        HUDController.setState('places');
    },

    async saveFromForm() {
        const modalId = document.getElementById('modal-id');
        const modalLat = document.getElementById('modal-lat');
        const modalLng = document.getElementById('modal-lng');
        const modalName = document.getElementById('modal-name');
        const modalCategory = document.getElementById('modal-category');
        const modalDesc = document.getElementById('modal-desc');

        const id = modalId.value || 'place_' + Date.now();
        const lat = parseFloat(modalLat.value);
        const lng = parseFloat(modalLng.value);
        const data = {
            id,
            lat,
            lng,
            name: modalName.value.trim(),
            category: modalCategory.value,
            desc: modalDesc.value.trim(),
            updatedAt: Date.now()
        };

        if (!modalId.value && this.currentTempDetails) {
            data.wikiImage = this.currentTempDetails.wikiImage || '';
            data.wikiSummary = this.currentTempDetails.wikiSummary || '';
            data.wikiUrl = this.currentTempDetails.wikiUrl || '';
            data.country = this.currentTempDetails.country || '';
        } else if (modalId.value) {
            const existing = this.customMarkers.find(x => x.id === modalId.value);
            if (existing) {
                data.wikiImage = existing.wikiImage || '';
                data.wikiSummary = existing.wikiSummary || '';
                data.wikiUrl = existing.wikiUrl || '';
                data.country = existing.country || '';
            }
        }
        
        try {
            await savePlace(id, data);
            this.customMarkers = await loadAllPlaces();
            this.renderAll();
            
            const markerModal = document.getElementById('marker-modal');
            markerModal.classList.add('hidden');
            
            this.removeTempMarker();

            HUDController.setState('place-details', data);
            MapService.flyTo([lng, lat], 15);
        } catch (err) {
            console.error("Failed to save place:", err);
        }
    },

    async loadFromStorage() {
        try {
            this.customMarkers = await loadAllPlaces();
            this.renderAll();
        } catch (e) {
            console.error("Marker database load failed", e);
        }
    },

    saveToStorage() {
        // No-op since we write directly via PouchDB
    },

    renderAll() {
        const savedMarkersList = document.getElementById('saved-markers-list');
        const markersCount = document.getElementById('markers-count');

        if (this.markerInstances) {
            this.markerInstances.forEach(m => m.remove());
        }
        this.markerInstances = [];
        savedMarkersList.innerHTML = '';
        markersCount.innerText = this.customMarkers.length;

        if (this.customMarkers.length === 0) {
            savedMarkersList.innerHTML = `<div class="text-center py-6 text-slate-400 dark:text-slate-500">No custom places saved yet.</div>`;
            return;
        }

        this.customMarkers.forEach((m, idx) => {
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

            const template = document.getElementById('template-marker-list-item');
            const clone = template.content.cloneNode(true);
            
            const dot = clone.querySelector('.marker-color-dot');
            dot.style.backgroundColor = this.colorPalette[m.category].main;

            const nameEl = clone.querySelector('.marker-name');
            nameEl.textContent = m.name;

            clone.querySelector('.marker-focus').addEventListener('click', (e) => {
                e.stopPropagation();
                this.focus(m.lat, m.lng, idx);
            });

            clone.querySelector('.btn-delete-marker').addEventListener('click', (e) => {
                e.stopPropagation();
                this.delete(m.id);
            });

            clone.querySelector('.marker-item').addEventListener('click', () => {
                HUDController.setState('place-details', m);
            });

            savedMarkersList.appendChild(clone);
        });
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
            await deletePlaceFromDB(id);
            this.customMarkers = await loadAllPlaces();
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
});;
