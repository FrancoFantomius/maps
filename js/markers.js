// maps Markers Module

import { state, colorPalette } from './state.js';

import { setHUDState } from './hud.js';

export function createCustomPin(category = 'poi', colorOverride = null) {
    const config = colorPalette[category] || colorPalette.poi;
    return L.divIcon({ html: `<svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 0C7.61 0 0 7.61 0 17C0 26.5 17 42 17 42C17 42 34 26.5 34 17C34 7.61 26.39 0 17 0Z" fill="${colorOverride || config.main}"/><circle cx="17" cy="17" r="11" fill="white"/><g transform="translate(10, 10) scale(0.6)"><path d="${config.svg}" fill="${colorOverride || config.main}"/></g></svg>`, iconSize: [34, 42], iconAnchor: [17, 42], popupAnchor: [0, -38], className: 'custom-map-pin-div' });
}

export function openMarkerModal(lat, lng, id = null) {
    const modalLat = document.getElementById('modal-lat');
    const modalLng = document.getElementById('modal-lng');
    const modalId = document.getElementById('modal-id');
    const modalName = document.getElementById('modal-name');
    const modalCategory = document.getElementById('modal-category');
    const modalDesc = document.getElementById('modal-desc');
    const modalTitle = document.getElementById('modal-title');
    const markerModal = document.getElementById('marker-modal');

    modalLat.value = lat;
    modalLng.value = lng;
    if (id) {
        const m = state.customMarkers.find(x => x.id === id);
        if (m) {
            modalId.value = m.id;
            modalName.value = m.name;
            modalCategory.value = m.category;
            modalDesc.value = m.desc;
            modalTitle.innerText = "Edit Marker";
        }
    } else {
        modalId.value = '';
        modalName.value = '';
        modalCategory.value = 'poi';
        modalDesc.value = '';
        modalTitle.innerText = "Save Location";
    }
    markerModal.classList.remove('hidden');
}

export function closeMarkerModal() {
    const markerModal = document.getElementById('marker-modal');
    markerModal.classList.add('hidden');
    if (state.tempMarker) {
        state.map.removeLayer(state.tempMarker);
        state.tempMarker = null;
    }
    setHUDState('places');
}

export function saveMarkerFromForm() {
    const modalId = document.getElementById('modal-id');
    const modalLat = document.getElementById('modal-lat');
    const modalLng = document.getElementById('modal-lng');
    const modalName = document.getElementById('modal-name');
    const modalCategory = document.getElementById('modal-category');
    const modalDesc = document.getElementById('modal-desc');
    const markerModal = document.getElementById('marker-modal');

    const id = modalId.value || 'id_' + Date.now();
    const lat = parseFloat(modalLat.value);
    const lng = parseFloat(modalLng.value);
    const data = {
        id,
        lat,
        lng,
        name: modalName.value.trim(),
        category: modalCategory.value,
        desc: modalDesc.value.trim()
    };
    
    const idx = state.customMarkers.findIndex(x => x.id === id);
    if (idx > -1) {
        state.customMarkers[idx] = data;
    } else {
        state.customMarkers.push(data);
    }
    
    saveMarkersToStorage();
    renderAllMarkers();
    markerModal.classList.add('hidden');
    
    if (state.tempMarker) {
        state.map.removeLayer(state.tempMarker);
        state.tempMarker = null;
    }

    setHUDState('place-details', data);
    state.map.setView([lat, lng], 15);
}

export function loadMarkersFromStorage() {
    try {
        const d = localStorage.getItem('maps_markers');
        if (d) {
            state.customMarkers = JSON.parse(d);
            renderAllMarkers();
        }
    } catch (e) {
        console.error("Marker database load failed", e);
    }
}

export function saveMarkersToStorage() {
    localStorage.setItem('maps_markers', JSON.stringify(state.customMarkers));
}

export function renderAllMarkers() {
    const savedMarkersList = document.getElementById('saved-markers-list');
    const markersCount = document.getElementById('markers-count');

    state.markerInstances.forEach(m => state.map.removeLayer(m));
    state.markerInstances = [];
    savedMarkersList.innerHTML = '';
    markersCount.innerText = state.customMarkers.length;

    if (state.customMarkers.length === 0) {
        savedMarkersList.innerHTML = `<div class="text-center py-6 text-slate-400 dark:text-slate-500">No custom places saved yet.</div>`;
        return;
    }

    state.customMarkers.forEach((m, idx) => {
        const pin = L.marker([m.lat, m.lng], { icon: createCustomPin(m.category) }).addTo(state.map);
        
        pin.bindTooltip(m.name, {
            direction: 'top',
            offset: [0, -35],
            className: 'font-semibold text-xs border-none shadow-md rounded-md bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-2 py-1'
        });

        pin.on('click', (e) => {
            if (state.isMeasureMode || state.isRouteMode) {
                if (e.originalEvent) {
                    L.DomEvent.stopPropagation(e.originalEvent);
                }
                return;
            }
            setHUDState('place-details', m);
            state.map.setView([m.lat, m.lng], 15);
        });

        state.markerInstances.push(pin);

        const d = document.createElement('div');
        d.className = 'p-3 bg-white dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/40 rounded-xl flex items-center justify-between hover:border-indigo-500/50 dark:hover:border-indigo-400/50 cursor-pointer text-xs transition-all';
        d.innerHTML = `
            <div class="flex items-center gap-2.5 overflow-hidden flex-1" onclick="window.mapFocusMarker(${m.lat}, ${m.lng}, ${idx})">
                <span class="w-3 h-3 rounded-full flex-shrink-0 border border-white dark:border-slate-800 shadow-sm" style="background:${colorPalette[m.category].main}"></span>
                <div class="truncate font-semibold text-slate-800 dark:text-slate-200">${m.name}</div>
            </div>
            <button onclick="event.stopPropagation(); window.deleteSavedMarker('${m.id}')" class="text-slate-400 hover:text-red-500 ml-2 text-sm leading-none">✕</button>
        `;
        
        d.addEventListener('click', () => {
            setHUDState('place-details', m);
        });

        savedMarkersList.appendChild(d);
    });
}

export function mapFocusMarker(lat, lng, idx) {
    state.map.setView([lat, lng], 15);
    setTimeout(() => {
        if (state.markerInstances[idx]) {
            state.markerInstances[idx].fire('click');
        }
    }, 250);
}

export function deleteSavedMarker(id) {
    state.customMarkers = state.customMarkers.filter(x => x.id !== id);
    saveMarkersToStorage();
    renderAllMarkers();
    setHUDState('places');

}
