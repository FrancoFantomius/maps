// maps GPS Controller - js/GPSController.js

import { MapService } from './MapService.js';

export const GPSController = {
    gpsMarker: null,
    gpsCoords: null,
    gpsAccuracy: null,
    watchId: null,
    isFollowing: false,
    isLocating: false,
    eventsBound: false,

    locateUser() {
        if (!navigator.geolocation) {
            console.warn("Geolocation not supported by this browser.");
            return;
        }

        if (this.watchId === null) {
            // State 1: Start tracking
            this.startTracking();
        } else if (this.isFollowing) {
            // State 2: Active & following -> stop tracking entirely
            this.stopTracking();
        } else {
            // State 3: Active but not following -> re-enable following and fly to last coords
            this.isFollowing = true;
            this.updateUI();
            if (this.gpsCoords) {
                MapService.flyTo([this.gpsCoords.lng, this.gpsCoords.lat], 15);
            }
        }
    },

    startTracking() {
        this.isFollowing = true;
        this.isLocating = true;
        this.updateUI();

        // Bind user interaction events once to disable follow-mode when panning
        if (!this.eventsBound) {
            this.eventsBound = true;
            const interactionEvents = ['dragstart', 'zoomstart', 'rotatestart', 'pitchstart'];
            interactionEvents.forEach(evt => {
                MapService.on(evt, () => {
                    if (this.watchId !== null && this.isFollowing) {
                        this.isFollowing = false;
                        this.updateUI();
                    }
                });
            });
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.isLocating = false;
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy;

                const firstLocation = !this.gpsCoords;
                this.gpsCoords = { lat, lng };
                this.gpsAccuracy = accuracy;

                // Center the map
                if (this.isFollowing) {
                    if (firstLocation) {
                        MapService.flyTo([lng, lat], 15);
                    } else {
                        MapService.panTo([lng, lat]);
                    }
                }

                // Update marker & accuracy circle
                this.updateMarkerAndCircle(lng, lat, accuracy);
                this.updateUI();
            },
            (error) => {
                console.error("GPS watchPosition failed", error);
                this.isLocating = false;
                if (error.code === 1) { // Permission Denied
                    this.stopTracking();
                } else {
                    this.updateUI();
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    },

    stopTracking() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.isLocating = false;
        this.isFollowing = false;
        this.gpsCoords = null;
        this.gpsAccuracy = null;

        if (this.gpsMarker) {
            this.gpsMarker.remove();
            this.gpsMarker = null;
        }

        // Clear GPS source on map
        MapService.updateSourceData('gps-source', {
            type: 'FeatureCollection',
            features: []
        });

        this.updateUI();
    },

    updateMarkerAndCircle(lng, lat, accuracy) {
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

        if (this.gpsMarker) {
            this.gpsMarker.setLngLat([lng, lat]);
        } else {
            const el = document.createElement('div');
            el.className = 'gps-pulse-marker';
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
        }
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
    },

    updateUI() {
        const btn = document.getElementById('btn-gps');
        if (!btn) return;

        const iconSpan = btn.querySelector('.gps-icon-main') || btn.querySelector('.material-symbols-outlined') || btn.querySelector('.material-icons-outlined');
        const isLocating = this.isLocating || (this.watchId !== null && !this.gpsCoords);

        if (this.watchId === null && !this.isLocating) {
            // State 1: Inactive (not tracking)
            btn.className = 'map-control-fab text-emerald-600';
            if (iconSpan) iconSpan.textContent = 'my_location';
        } else if (isLocating) {
            // State 2: Locating (acquiring initial location fix)
            btn.className = 'map-control-fab text-emerald-600 is-locating';
            if (iconSpan) iconSpan.textContent = 'location_searching';
        } else if (this.isFollowing) {
            // State 3: Position found & following
            btn.className = 'map-control-fab is-active bg-emerald-600 text-white';
            if (iconSpan) iconSpan.textContent = 'gps_fixed';
        } else {
            // State 4: Position found, tracking but not following
            btn.className = 'map-control-fab is-active text-emerald-600';
            if (iconSpan) iconSpan.textContent = 'my_location';
        }
    }
};

