// maps GPS Module

import { state } from './state.js';
import { metersToPixels } from './map.js';

let gpsMarker = null;

export function locateUser() {
    if (!navigator.geolocation) {
        console.warn("Geolocation not supported by this browser.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;

            // Save in state so setupMapLayersAndSources can restore it
            state.gpsCoords = { lat, lng };
            state.gpsAccuracy = accuracy;

            // Center map
            if (state.map) {
                state.map.flyTo({
                    center: [lng, lat],
                    zoom: 15
                });

                // Draw/Update accuracy circle via source
                const source = state.map.getSource('gps-source');
                if (source) {
                    const pixels = metersToPixels(accuracy, lat, state.map.getZoom());
                    source.setData({
                        type: 'FeatureCollection',
                        features: [{
                            type: 'Feature',
                            properties: { accuracy_pixels: pixels },
                            geometry: {
                                type: 'Point',
                                coordinates: [lng, lat]
                            }
                        }]
                    });
                }

                // Draw/Update pulsing GPS dot marker
                if (gpsMarker) gpsMarker.remove();

                const el = document.createElement('div');
                el.className = 'gps-pulse-marker';
                el.style.position = 'relative';
                el.style.width = '18px';
                el.style.height = '18px';
                el.style.borderRadius = '50%';
                el.style.backgroundColor = '#10b981';
                el.style.border = '3px solid #ffffff';
                el.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.6)';

                // Pulsing animation div
                const pulse = document.createElement('div');
                pulse.style.position = 'absolute';
                pulse.style.top = '-9px';
                pulse.style.left = '-9px';
                pulse.style.width = '30px';
                pulse.style.height = '30px';
                pulse.style.borderRadius = '50%';
                pulse.style.backgroundColor = '#10b981';
                pulse.style.opacity = '0.4';
                pulse.style.animation = 'gpsPulse 2s infinite ease-out';
                el.appendChild(pulse);

                // Add CSS animation keyframes to document head if not exists
                if (!document.getElementById('gps-pulse-style')) {
                    const style = document.createElement('style');
                    style.id = 'gps-pulse-style';
                    style.innerHTML = `
                        @keyframes gpsPulse {
                            0% { transform: scale(0.5); opacity: 0.8; }
                            100% { transform: scale(2.2); opacity: 0; }
                        }
                    `;
                    document.head.appendChild(style);
                }

                gpsMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
                    .setLngLat([lng, lat])
                    .addTo(state.map);
            }
        },
        (error) => {
            console.error("GPS user location failed or denied", error);
        },
        { timeout: 8000, enableHighAccuracy: true }
    );
}
