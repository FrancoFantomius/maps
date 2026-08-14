// maps Search Controller - js/SearchController.js

import { MapService } from './MapService.js';
import { MarkerController } from './MarkerController.js';
import { HUDController } from './HUDController.js';

export const SearchController = {
    renderResults(results) {
        const searchResults = document.getElementById('search-results');
        const searchInput = document.getElementById('search-input');
        
        searchResults.innerHTML = '';
        searchResults.classList.remove('hidden');
        
        results.forEach(item => {
            const template = document.getElementById('template-search-result-item');
            const clone = template.content.cloneNode(true);
            
            const shortName = item.display_name.split(',')[0];
            clone.querySelector('.result-name').textContent = shortName;
            clone.querySelector('.result-address').textContent = item.display_name;
            
            clone.querySelector('.search-result-item').addEventListener('click', () => {
                const lat = parseFloat(item.lat), lon = parseFloat(item.lon);
                MapService.flyTo([lon, lat], 14);
                searchInput.value = shortName;
                
                MarkerController.setTempMarker(lat, lon);

                HUDController.setState('place-details', {
                    isTemp: true,
                    lat: lat,
                    lng: lon,
                    name: shortName,
                    address: item.display_name,
                    wikiSummary: '',
                    shopInfo: null,
                    streetName: ''
                });
            });
            
            searchResults.appendChild(clone);
        });
    }
};
