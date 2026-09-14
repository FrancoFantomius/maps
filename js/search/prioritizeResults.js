// maps Search - js/search/prioritizeResults.js

import { getUserLocation } from './getUserLocation.js';
import { calculateDistance } from './calculateDistance.js';

export function prioritizeResults(results, referenceLocation = null) {
    if (!Array.isArray(results) || results.length <= 1) {
        return results || [];
    }

    const userLoc = referenceLocation || (this && typeof this.getUserLocation === 'function' ? this.getUserLocation() : getUserLocation());
    if (!userLoc || typeof userLoc.lat !== 'number' || typeof userLoc.lng !== 'number') {
        return [...results];
    }

    const calcDist = (this && typeof this.calculateDistance === 'function') ? this.calculateDistance.bind(this) : calculateDistance;

    return [...results].map(item => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        let distance = Infinity;
        if (!isNaN(lat) && !isNaN(lon)) {
            distance = calcDist(userLoc.lat, userLoc.lng, lat, lon);
        }
        return { ...item, _distance: distance };
    }).sort((a, b) => a._distance - b._distance);
}

