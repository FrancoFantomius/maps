// maps Search - js/search/getUserLocation.js

import { MapService } from '../map/index.js';
import { GPSController } from '../gps/index.js';

export function getUserLocation() {
    // Priority 1: Current view
    if (MapService.getCenter && typeof MapService.getCenter === 'function') {
        const center = MapService.getCenter();
        if (center && typeof center.lat === 'number' && typeof center.lng === 'number' && !isNaN(center.lat) && !isNaN(center.lng)) {
            return { lat: center.lat, lng: center.lng, source: 'view' };
        }
    }
    if (MapService.map && typeof MapService.map.getCenter === 'function') {
        const center = MapService.map.getCenter();
        if (center && typeof center.lat === 'number' && typeof center.lng === 'number' && !isNaN(center.lat) && !isNaN(center.lng)) {
            return { lat: center.lat, lng: center.lng, source: 'view' };
        }
    }

    // Priority 2: GPS
    if (GPSController && GPSController.gpsCoords) {
        const { lat, lng } = GPSController.gpsCoords;
        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
            return { lat, lng, source: 'gps' };
        }
    }

    // Priority 3: Home address
    if (MapService.getHomeAddress && typeof MapService.getHomeAddress === 'function') {
        const home = MapService.getHomeAddress();
        if (home && typeof home.lat === 'number' && typeof home.lng === 'number' && !isNaN(home.lat) && !isNaN(home.lng)) {
            return { lat: home.lat, lng: home.lng, source: 'home' };
        }
    }

    return null;
}

