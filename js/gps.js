// maps GPS Module

import { state } from './state.js';
import { showToast } from './toast.js';

export function locateUser() {
    showToast("Geolocating browser node coordinates...", "info");
    state.map.locate({ setView: true, maxZoom: 15 });
    state.map.once('locationfound', (e) => {
        L.circle(e.latlng, e.accuracy, { color: '#10b981', fillOpacity: 0.15, opacity: 0.4 }).addTo(state.map);
        showToast("Location updated successfully.", "info");
    });
    state.map.once('locationerror', () => {
        showToast("Geolocation access denied or timed out.", "error");
    });
}
