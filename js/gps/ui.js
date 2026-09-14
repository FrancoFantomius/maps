import '@francofantomius/material-components/snackbar';
import { MapService } from '../map/index.js';
import { GPSController } from './gps-controller.js';

export function showGPSSnackbar(message = 'Geolocation not supported by this browser.') {
    let snackbar = document.getElementById('gps-snackbar');
    if (!snackbar) {
        snackbar = document.createElement('md-snackbar');
        snackbar.id = 'gps-snackbar';
        snackbar.setAttribute('closeable', '');
        document.body.appendChild(snackbar);
    }
    snackbar.message = message;
    if (typeof snackbar.show === 'function') {
        snackbar.show();
    } else {
        snackbar.open = true;
    }
    return snackbar;
}

export const showSnackbar = showGPSSnackbar;

export function updateMarkerAndCircle(controller, lng, lat, accuracy) {
    if (typeof controller === 'number') {
        accuracy = lat;
        lat = lng;
        lng = controller;
        controller = GPSController;
    } else if (!controller) {
        controller = GPSController;
    }

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

    if (controller.gpsMarker) {
        controller.gpsMarker.setLngLat([lng, lat]);
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

        controller.gpsMarker = MapService.createMarker(el, false, 'center')
            .setLngLat([lng, lat])
            .addTo(MapService.map);
    }
}

export function updateUI(controller = GPSController) {
    const btn = document.getElementById('btn-gps');
    if (!btn || !controller) return;

    const iconSpan = btn.querySelector('.gps-icon-main') || btn.querySelector('.material-symbols-outlined') || btn.querySelector('.material-icons-outlined');
    const isLocating = controller.isLocating || (controller.watchId !== null && !controller.gpsCoords);

    if (controller.watchId === null && !controller.isLocating) {
        // State 1: Inactive (not tracking)
        btn.className = 'map-control-fab text-emerald-600';
        if (iconSpan) iconSpan.textContent = 'my_location';
    } else if (isLocating) {
        // State 2: Locating (acquiring initial location fix)
        btn.className = 'map-control-fab text-emerald-600 is-locating';
        if (iconSpan) iconSpan.textContent = 'location_searching';
    } else if (controller.isFollowing) {
        // State 3: Position found & following
        btn.className = 'map-control-fab is-active bg-emerald-600 text-white';
        if (iconSpan) iconSpan.textContent = 'gps_fixed';
    } else {
        // State 4: Position found, tracking but not following
        btn.className = 'map-control-fab is-active text-emerald-600';
        if (iconSpan) iconSpan.textContent = 'my_location';
    }
}

export function setupGPSUI(GPSController, MapService) {
    const gpsBtn = document.getElementById('btn-gps');
    if (gpsBtn) {
        gpsBtn.addEventListener('click', () => {
            GPSController.locateUser();
        });
    }

    if (MapService && typeof MapService.on === 'function') {
        MapService.on('zoom', () => {
            GPSController.updateAccuracyCircle();
        });
    }
}

