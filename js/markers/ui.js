// maps Markers & Home Address UI - js/markers/ui.js

import { ApiService } from '../api/index.js';

export function updateHomeAddressUI(MapService, MarkerController) {
    const homeAddressCard = document.getElementById('home-address-card');
    const homeAddressText = document.getElementById('home-address-text');
    const homeAddressInput = document.getElementById('home-address-input');

    const home = MapService.getHomeAddress();
    if (home) {
        if (homeAddressCard) homeAddressCard.classList.remove('hidden');
        if (homeAddressText) homeAddressText.textContent = home.address;
        if (homeAddressInput && document.activeElement !== homeAddressInput) {
            homeAddressInput.value = home.address;
        }
    } else {
        if (homeAddressCard) homeAddressCard.classList.add('hidden');
        if (homeAddressText) homeAddressText.textContent = '';
        if (homeAddressInput && document.activeElement !== homeAddressInput) {
            homeAddressInput.value = '';
        }
    }
    if (MarkerController && typeof MarkerController.renderHomeMarker === 'function') {
        MarkerController.renderHomeMarker();
    }
}

export function setupHomeAddressUI(MapService, MarkerController) {
    const homeAddressInput = document.getElementById('home-address-input');
    const homeAddressAutocomplete = document.getElementById('home-address-autocomplete');
    const btnSaveHomeInput = document.getElementById('btn-save-home-input');
    const btnFlyHome = document.getElementById('btn-fly-home');
    const btnClearHome = document.getElementById('btn-clear-home');

    const updateUI = () => updateHomeAddressUI(MapService, MarkerController);
    updateUI();

    window.addEventListener('maps-home-updated', () => updateUI());
    window.addEventListener('maps-places-updated', () => updateUI());

    let homeAutocompleteTimeout = null;
    if (homeAddressInput && homeAddressAutocomplete) {
        homeAddressInput.addEventListener('input', () => {
            clearTimeout(homeAutocompleteTimeout);
            const query = homeAddressInput.value.trim();
            if (query.length < 2) {
                homeAddressAutocomplete.innerHTML = '';
                homeAddressAutocomplete.classList.add('hidden');
                return;
            }
            homeAutocompleteTimeout = setTimeout(async () => {
                try {
                    const results = await ApiService.searchGeocode(query, 5);
                    homeAddressAutocomplete.innerHTML = '';
                    if (!results || results.length === 0) {
                        homeAddressAutocomplete.classList.add('hidden');
                        return;
                    }
                    results.forEach(item => {
                        const template = document.getElementById('template-autocomplete-item');
                        if (!template) return;
                        const clone = template.content.cloneNode(true);
                        const shortName = item.display_name.split(',')[0];
                        clone.querySelector('.item-name').textContent = shortName;
                        clone.querySelector('.item-address').textContent = item.display_name;

                        clone.querySelector('.nav-autocomplete-item').addEventListener('click', () => {
                            MapService.setHomeAddress({
                                address: item.display_name,
                                lat: parseFloat(item.lat),
                                lng: parseFloat(item.lon)
                            });
                            updateUI();
                            homeAddressAutocomplete.innerHTML = '';
                            homeAddressAutocomplete.classList.add('hidden');
                        });
                        homeAddressAutocomplete.appendChild(clone);
                    });
                    homeAddressAutocomplete.classList.remove('hidden');
                } catch (err) {
                    console.error("Home address geocoding search failed", err);
                }
            }, 350);
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#home-address-input') && !e.target.closest('#home-address-autocomplete')) {
                if (homeAddressAutocomplete) {
                    homeAddressAutocomplete.innerHTML = '';
                    homeAddressAutocomplete.classList.add('hidden');
                }
            }
        });
    }

    if (btnSaveHomeInput) {
        btnSaveHomeInput.addEventListener('click', async () => {
            const query = homeAddressInput.value.trim();
            if (!query) return;
            try {
                const results = await ApiService.searchGeocode(query, 1);
                if (results && results.length > 0) {
                    const item = results[0];
                    MapService.setHomeAddress({
                        address: item.display_name,
                        lat: parseFloat(item.lat),
                        lng: parseFloat(item.lon)
                    });
                    updateUI();
                    if (homeAddressAutocomplete) {
                        homeAddressAutocomplete.innerHTML = '';
                        homeAddressAutocomplete.classList.add('hidden');
                    }
                }
            } catch (err) {
                console.error("Failed to save home address from input", err);
            }
        });
    }

    if (btnFlyHome) {
        btnFlyHome.addEventListener('click', () => {
            MapService.flyToHome();
        });
    }

    if (btnClearHome) {
        btnClearHome.addEventListener('click', () => {
            MapService.clearHomeAddress();
            updateUI();
        });
    }
}

