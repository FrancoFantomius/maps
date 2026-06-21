// maps GPS Module

import { state } from './state.js';


let gpsCircle = null;

export function locateUser() {

    state.map.locate({ setView: true, maxZoom: 15 });
    state.map.once('locationfound', (e) => {
        if (gpsCircle) state.map.removeLayer(gpsCircle);
        gpsCircle = L.circle(e.latlng, e.accuracy, { color: '#10b981', fillOpacity: 0.15, opacity: 0.4 }).addTo(state.map);

    });
    state.map.once('locationerror', () => {

    });
}
