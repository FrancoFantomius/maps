// maps GPS Controller - js/GPSController.js

import { MapService } from './MapService.js';

export const GPSController = {
    gpsMarker: null,
    gpsCoords: null,
    gpsAccuracy: null,

    locateUser() {
        if (!navigator.geolocation) {
            console.warn("Geolocation not supported by this browser.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy;

                this.gpsCoords = { lat, lng };
                this.gpsAccuracy = accuracy;

                MapService.flyTo([lng, lat], 15);

                const pixels = MapService.metersToPixels(accuracy, lat, MapService.getZoom());
                MapService.updateSourceData('gps-source', {
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

                if (this.gpsMarker) this.gpsMarker.remove();

                const el = document.createElement('div');
                el.className = 'gps-pulse-marker';
                el.style.position = 'relative';
                el.style.width = '18px';
                el.style.height = '18px';
                el.style.borderRadius = '50%';
                el.style.backgroundColor = '#10b981';
                el.style.border = '3px solid #ffffff';
                el.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.6)';

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

                this.gpsMarker = MapService.createMarker(el, false, 'center')
                    .setLngLat([lng, lat])
                    .addTo(MapService.map);
            },
            (error) => {
                console.error("GPS user location failed or denied", error);
            },
            { timeout: 8000, enableHighAccuracy: true }
        );
    },

    updateAccuracyCircle() {
        if (this.gpsCoords && this.gpsAccuracy) {
            const pixels = MapService.metersToPixels(this.gpsAccuracy, this.gpsCoords.lat, MapService.getZoom());
            MapService.updateSourceData('gps-source', {
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    properties: { accuracy_pixels: pixels },
                    geometry: {
                        type: 'Point',
                        coordinates: [this.gpsCoords.lng, this.gpsCoords.lat]
                    }
                }]
            });
        }
    }
};
