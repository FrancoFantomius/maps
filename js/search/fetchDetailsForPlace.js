// maps Search - js/search/fetchDetailsForPlace.js

import { ApiService } from '../api/index.js';
import { HUDController } from '../hud/index.js';
import { openPlaceDetails } from './place-details-sheet.js';

export async function fetchDetailsForPlace(lat, lng, shortName, address, initialShopInfo = null) {
    try {
        const [wikiRes, ovRes] = await Promise.allSettled([
            ApiService.fetchWikipediaSummary ? ApiService.fetchWikipediaSummary(shortName) : null,
            ApiService.fetchOverpassFeatures ? ApiService.fetchOverpassFeatures(lat, lng) : null
        ]);

        let wikiSummary = '';
        let wikiImage = '';
        let wikiUrl = '';
        let shopInfo = initialShopInfo;

        if (wikiRes.status === 'fulfilled' && wikiRes.value && wikiRes.value.extract) {
            wikiSummary = wikiRes.value.extract;
            wikiImage = wikiRes.value.thumbnail?.source || wikiRes.value.originalimage?.source || '';
            wikiUrl = wikiRes.value.content_urls?.desktop?.page || '';
        }

        if (ovRes.status === 'fulfilled' && ovRes.value && ovRes.value.elements) {
            const elements = ovRes.value.elements;
            const nodes = elements.filter(el => el.type === 'node' && el.tags && (el.tags.shop || el.tags.amenity));
            let closestNode = null;
            let nodeMinDist = Infinity;
            nodes.forEach(node => {
                const dLat = (node.lat - lat);
                const dLng = (node.lon - lng);
                const dist = Math.sqrt(dLat * dLat + dLng * dLng) * 111000;
                if (dist < nodeMinDist) {
                    nodeMinDist = dist;
                    closestNode = node;
                }
            });

            if (closestNode && nodeMinDist <= 100) {
                const tags = closestNode.tags;
                shopInfo = {
                    name: tags.name || (tags.shop ? `Shop (${tags.shop})` : tags.amenity) || (shopInfo?.name) || shortName,
                    type: tags.shop || tags.amenity || (shopInfo?.type),
                    openingHours: tags.opening_hours || (shopInfo?.openingHours) || null,
                    website: tags.website || (shopInfo?.website) || null,
                    phone: tags.phone || (shopInfo?.phone) || null,
                    cuisine: tags.cuisine || (shopInfo?.cuisine) || null,
                    brand: tags.brand || (shopInfo?.brand) || null
                };
            }
        }

        const updatedData = {
            isTemp: true,
            lat: lat,
            lng: lng,
            name: (shopInfo && shopInfo.name) || shortName,
            address: address,
            wikiSummary: wikiSummary,
            wikiImage: wikiImage,
            wikiUrl: wikiUrl,
            shopInfo: shopInfo,
            streetName: ''
        };

        if (HUDController.currentState === 'place-details') {
            HUDController.setState('place-details', updatedData);
        }
        openPlaceDetails(updatedData);
    } catch (e) {
        console.warn("Could not enrich search result details", e);
    }
}

