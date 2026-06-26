// maps Markers Module

import { state, colorPalette } from './state.js';
import { setHUDState } from './hud.js';

export function createCustomPin(category = 'poi', colorOverride = null) {
    const config = colorPalette[category] || colorPalette.poi;
    const el = document.createElement('div');
    el.className = 'custom-map-pin-div';
    el.style.cursor = 'pointer';
    el.innerHTML = `<svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 0C7.61 0 0 7.61 0 17C0 26.5 17 42 17 42C17 42 34 26.5 34 17C34 7.61 26.39 0 17 0Z" fill="${colorOverride || config.main}"/>
        <circle cx="17" cy="17" r="11" fill="white"/>
        <g transform="translate(10, 10) scale(0.6)">
            <path d="${config.svg}" fill="${colorOverride || config.main}"/>
        </g>
    </svg>`;
    return el;
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
        state.tempMarker.remove();
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
    
    const markerModal = document.getElementById('marker-modal');
    markerModal.classList.add('hidden');
    
    if (state.tempMarker) {
        state.tempMarker.remove();
        state.tempMarker = null;
    }

    setHUDState('place-details', data);
    state.map.flyTo({ center: [lng, lat], zoom: 15 });
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

    if (state.markerInstances) {
        state.markerInstances.forEach(m => m.remove());
    }
    state.markerInstances = [];
    savedMarkersList.innerHTML = '';
    markersCount.innerText = state.customMarkers.length;

    if (state.customMarkers.length === 0) {
        savedMarkersList.innerHTML = `<div class="text-center py-6 text-slate-400 dark:text-slate-500">No custom places saved yet.</div>`;
        return;
    }

    state.customMarkers.forEach((m, idx) => {
        const el = createCustomPin(m.category);
        
        const popup = new maplibregl.Popup({
            offset: [0, -35],
            closeButton: false,
            closeOnClick: false,
            className: 'custom-marker-popup'
        }).setHTML(`<div class="font-semibold text-xs text-slate-800 dark:text-slate-100">${m.name}</div>`);

        const pin = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([m.lng, m.lat])
            .setPopup(popup)
            .addTo(state.map);
        
        el.addEventListener('mouseenter', () => popup.addTo(state.map));
        el.addEventListener('mouseleave', () => popup.remove());

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (state.isMeasureMode || state.isRouteMode) {
                return;
            }
            setHUDState('place-details', m);
            state.map.flyTo({ center: [m.lng, m.lat], zoom: 15 });
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
    state.map.flyTo({ center: [lng, lat], zoom: 15 });
    setTimeout(() => {
        if (state.markerInstances[idx]) {
            const m = state.customMarkers[idx];
            if (m) {
                setHUDState('place-details', m);
            }
        }
    }, 250);
}

export function deleteSavedMarker(id) {
    state.customMarkers = state.customMarkers.filter(x => x.id !== id);
    saveMarkersToStorage();
    renderAllMarkers();
    setHUDState('places');
}
