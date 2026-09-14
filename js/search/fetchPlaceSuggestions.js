// maps - Search Place Suggestions Fetcher - js/search/fetchPlaceSuggestions.js

import { ApiService } from '../api/index.js';
import { prioritizeResults } from './prioritizeResults.js';

export function getPlaceIcon(item) {
    if (!item) return 'location_on';
    const type = (item.type || '').toLowerCase();
    const category = (item.class || '').toLowerCase();

    if (category === 'amenity') {
        if (['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'bistrot', 'food_court'].includes(type)) return 'restaurant';
        if (['hospital', 'clinic', 'pharmacy', 'doctors'].includes(type)) return 'local_hospital';
        if (['school', 'university', 'college', 'kindergarten'].includes(type)) return 'school';
        if (['bank', 'atm'].includes(type)) return 'account_balance';
        if (['fuel', 'charging_station'].includes(type)) return 'local_gas_station';
        if (['parking', 'parking_space'].includes(type)) return 'local_parking';
        if (['place_of_worship', 'church', 'mosque', 'synagogue'].includes(type)) return 'church';
        if (['theatre', 'cinema'].includes(type)) return 'theaters';
    }
    if (category === 'tourism') {
        if (['hotel', 'motel', 'hostel', 'guest_house', 'apartment'].includes(type)) return 'hotel';
        if (['museum', 'gallery', 'artwork'].includes(type)) return 'museum';
        if (['attraction', 'viewpoint', 'theme_park'].includes(type)) return 'attractions';
    }
    if (category === 'shop') return 'storefront';
    if (category === 'leisure') {
        if (['park', 'garden', 'nature_reserve'].includes(type)) return 'park';
        if (['stadium', 'sports_centre', 'fitness_centre'].includes(type)) return 'sports_soccer';
    }
    if (['aeroway', 'airport'].includes(category) || type === 'aerodrome' || type === 'airport') return 'flight';
    if (['railway', 'station'].includes(category) || ['station', 'subway', 'halt', 'tram_stop'].includes(type)) return 'directions_transit';
    if (category === 'highway' || type === 'bus_stop') return 'directions_bus';

    return 'location_on';
}

export async function fetchPlaceSuggestions(query, options = {}, limit = 5) {
    const q = (query || '').trim();
    if (!q || q.length < 2) return [];

    try {
        const results = await ApiService.searchGeocode(q, limit, options);
        if (!Array.isArray(results) || results.length === 0) return [];

        const prioritized = prioritizeResults(results);
        return prioritized.map(item => {
            const shortName = (item.display_name || '').split(',')[0].trim();
            const addressParts = (item.display_name || '').split(',').slice(1);
            const address = addressParts.join(',').trim();

            return {
                id: item.place_id ? String(item.place_id) : undefined,
                name: shortName || item.display_name,
                address: address || shortName,
                lat: parseFloat(item.lat),
                lon: parseFloat(item.lon),
                icon: getPlaceIcon(item),
                raw: item
            };
        });
    } catch (err) {
        console.error("fetchPlaceSuggestions error", err);
        return [];
    }
}

