// maps Marker Modal - js/markers/marker-modal.js

import { savePlace, loadAllPlaces } from '../db/index.js';

export function openMarkerModal(lat, lng, id, tempDetails, customMarkers, callback) {
    const modalLat = document.getElementById('modal-lat');
    const modalLng = document.getElementById('modal-lng');
    const modalId = document.getElementById('modal-id');
    const modalName = document.getElementById('modal-name');
    const modalCategory = document.getElementById('modal-category');
    const modalDesc = document.getElementById('modal-desc');
    const modalTitle = document.getElementById('modal-title');
    const markerModal = document.getElementById('marker-modal');

    if (modalLat) modalLat.value = lat;
    if (modalLng) modalLng.value = lng;

    if (id) {
        const m = (customMarkers || []).find(x => x.id === id);
        if (m) {
            if (modalId) modalId.value = m.id;
            if (modalName) modalName.value = m.name;
            if (modalCategory) modalCategory.value = m.category;
            if (modalDesc) modalDesc.value = m.desc || '';
            if (modalTitle) modalTitle.innerText = "Edit Marker";
            if (markerModal) {
                markerModal.headline = "Edit Marker";
                if (typeof markerModal.setAttribute === 'function') {
                    markerModal.setAttribute('headline', "Edit Marker");
                }
            }
        }
    } else {
        if (modalId) modalId.value = '';
        if (modalName) modalName.value = tempDetails ? tempDetails.name : '';
        if (modalCategory) modalCategory.value = 'poi';
        if (modalDesc) modalDesc.value = '';
        if (modalTitle) modalTitle.innerText = "Save Location";
        if (markerModal) {
            markerModal.headline = "Save Location";
            if (typeof markerModal.setAttribute === 'function') {
                markerModal.setAttribute('headline', "Save Location");
            }
        }
    }

    if (markerModal) {
        markerModal.classList.remove('hidden');
        if (typeof markerModal.showModal === 'function') {
            markerModal.showModal();
        } else if (typeof markerModal.show === 'function') {
            markerModal.show();
        } else {
            markerModal.open = true;
        }
    }
}

export function closeMarkerModal(onClose) {
    const markerModal = document.getElementById('marker-modal');
    if (markerModal) {
        markerModal.classList.add('hidden');
        if (typeof markerModal.close === 'function') {
            markerModal.close();
        } else {
            markerModal.open = false;
        }
    }
    if (typeof onClose === 'function') onClose();
}

export async function saveMarkerFromForm(tempDetails, customMarkers, MapService, onSaved) {
    const modalId = document.getElementById('modal-id');
    const modalLat = document.getElementById('modal-lat');
    const modalLng = document.getElementById('modal-lng');
    const modalName = document.getElementById('modal-name');
    const modalCategory = document.getElementById('modal-category');
    const modalDesc = document.getElementById('modal-desc');

    const id = (modalId && modalId.value) || 'place_' + Date.now();
    const lat = modalLat ? parseFloat(modalLat.value) : 0;
    const lng = modalLng ? parseFloat(modalLng.value) : 0;
    const data = {
        id,
        lat,
        lng,
        name: modalName ? (modalName.value || '').trim() : '',
        category: modalCategory ? modalCategory.value : 'poi',
        desc: modalDesc ? (modalDesc.value || '').trim() : '',
        updatedAt: Date.now()
    };

    if (modalId && !modalId.value && tempDetails) {
        data.wikiImage = tempDetails.wikiImage || '';
        data.wikiSummary = tempDetails.wikiSummary || '';
        data.wikiUrl = tempDetails.wikiUrl || '';
        data.country = tempDetails.country || '';
    } else if (modalId && modalId.value) {
        const existing = (customMarkers || []).find(x => x.id === modalId.value);
        if (existing) {
            data.wikiImage = existing.wikiImage || '';
            data.wikiSummary = existing.wikiSummary || '';
            data.wikiUrl = existing.wikiUrl || '';
            data.country = existing.country || '';
        }
    }

    try {
        await savePlace(id, data);
        if (data.category === 'home' && MapService && typeof MapService.setHomeAddress === 'function') {
            MapService.setHomeAddress({
                address: data.name || `${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}`,
                lat: data.lat,
                lng: data.lng
            });
        }
        const updatedMarkers = await loadAllPlaces();
        closeMarkerModal();

        if (typeof onSaved === 'function') {
            onSaved(data, updatedMarkers);
        }
        return data;
    } catch (err) {
        console.error("Failed to save place:", err);
        throw err;
    }
}

export function setupMarkerModalUI(MarkerController) {
    const markerForm = document.getElementById('marker-form');
    if (markerForm) {
        markerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            MarkerController.saveFromForm();
        });
    }

    const btnCloseMarkerModal = document.getElementById('btn-close-marker-modal');
    if (btnCloseMarkerModal) {
        btnCloseMarkerModal.addEventListener('click', () => {
            MarkerController.closeModal();
        });
    }

    const btnSaveMarkerModal = document.getElementById('btn-save-marker-modal');
    if (btnSaveMarkerModal) {
        btnSaveMarkerModal.addEventListener('click', (e) => {
            e.preventDefault();
            MarkerController.saveFromForm();
        });
    }

    const markerModal = document.getElementById('marker-modal');
    if (markerModal && !markerModal._boundClose) {
        markerModal._boundClose = true;
        markerModal.addEventListener('close', () => {
            MarkerController.closeModal();
        });
        markerModal.addEventListener('cancel', () => {
            MarkerController.closeModal();
        });
    }
}
