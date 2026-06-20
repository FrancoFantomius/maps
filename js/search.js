// maps Search Module

import { state } from './state.js';
import { createCustomPin } from './markers.js';
import { setHUDState } from './hud.js';

export function renderSearchResults(results) {
    const searchResults = document.getElementById('search-results');
    const searchInput = document.getElementById('search-input');
    
    searchResults.innerHTML = '';
    searchResults.classList.remove('hidden');
    results.forEach(item => {
        const rDiv = document.createElement('div');
        rDiv.className = 'p-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer transition-colors text-slate-700 dark:text-slate-300';
        rDiv.innerHTML = `<div class="font-bold truncate text-slate-800 dark:text-slate-100 text-xs">${item.display_name.split(',')[0]}</div><div class="text-slate-400 dark:text-slate-500 truncate text-[10px] mt-0.5">${item.display_name}</div>`;
        rDiv.addEventListener('click', () => {
            const lat = parseFloat(item.lat), lon = parseFloat(item.lon);
            state.map.setView([lat, lon], 14);
            searchInput.value = item.display_name.split(',')[0];
            
            if (state.tempMarker) state.map.removeLayer(state.tempMarker);
            state.tempMarker = L.marker([lat, lon], { icon: createCustomPin('poi', '#94a3b8') }).addTo(state.map);

            setHUDState('place-details', {
                isTemp: true,
                lat: lat,
                lng: lon
            });
        });
        searchResults.appendChild(rDiv);
    });
}
