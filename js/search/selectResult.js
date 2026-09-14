// maps Search - js/search/selectResult.js

import { MapService } from '../map/index.js';
import { MarkerController } from '../markers/index.js';
import { HUDController } from '../hud/index.js';
import { fetchDetailsForPlace } from './fetchDetailsForPlace.js';

export function selectResult(item) {
    const searchBar = document.getElementById('search-bar');
    const searchInput = document.getElementById('search-input');
    const shortName = (item.display_name || '').split(',')[0];
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);

    if (MapService.flyTo && !isNaN(lat) && !isNaN(lon)) {
        MapService.flyTo([lon, lat], 14);
    }
    if (searchBar) {
        searchBar.value = shortName;
    }
    if (searchInput) {
        searchInput.value = shortName;
    }

    if (MarkerController.setTempMarker && !isNaN(lat) && !isNaN(lon)) {
        MarkerController.setTempMarker(lat, lon);
    }

    let initialShopInfo = null;
    if (item.extratags || item.class === 'shop' || item.class === 'amenity') {
        const ext = item.extratags || {};
        initialShopInfo = {
            name: shortName,
            type: ext.shop || ext.amenity || item.type || item.class,
            openingHours: ext.opening_hours || null,
            website: ext.website || ext['contact:website'] || null,
            phone: ext.phone || ext['contact:phone'] || null,
            cuisine: ext.cuisine || null,
            brand: ext.brand || null
        };
    }

    if (HUDController.setState) {
        HUDController.setState('place-details', {
            isTemp: true,
            lat: lat,
            lng: lon,
            name: shortName,
            address: item.display_name,
            wikiSummary: '',
            shopInfo: initialShopInfo,
            streetName: ''
        });
    }

    if (!isNaN(lat) && !isNaN(lon)) {
        const fetchDetails = (this && typeof this.fetchDetailsForPlace === 'function') ? this.fetchDetailsForPlace.bind(this) : fetchDetailsForPlace;
        fetchDetails(lat, lon, shortName, item.display_name, initialShopInfo);
    }
}

