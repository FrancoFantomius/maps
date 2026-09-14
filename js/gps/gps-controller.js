import { MapService } from '../map/index.js';
import { updateMarkerAndCircle, updateUI, showGPSSnackbar } from './ui.js';

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
            showGPSSnackbar("Geolocation not supported by this browser.");
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
        updateMarkerAndCircle(this, lng, lat, accuracy);
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
        updateUI(this);
    },

    showSnackbar(message) {
        return showGPSSnackbar(message);
    }
};

export default GPSController;

