// maps Search - js/search/getViewbox.js

import { MapService } from '../map/index.js';
import { getUserLocation } from './getUserLocation.js';

export function getViewbox() {
    if (MapService.getBounds && typeof MapService.getBounds === 'function') {
        const bounds = MapService.getBounds();
        if (bounds && typeof bounds.getWest === 'function') {
            return `${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()},${bounds.getSouth()}`;
        }
    }
    if (MapService.map && typeof MapService.map.getBounds === 'function') {
        const bounds = MapService.map.getBounds();
        if (bounds && typeof bounds.getWest === 'function') {
            return `${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()},${bounds.getSouth()}`;
        }
    }

    const userLoc = (this && typeof this.getUserLocation === 'function') ? this.getUserLocation() : getUserLocation();
    if (userLoc) {
        const delta = 0.5;
        return `${userLoc.lng - delta},${userLoc.lat + delta},${userLoc.lng + delta},${userLoc.lat - delta}`;
    }

    return null;
}

