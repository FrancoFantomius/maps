// maps HUD Controller - js/HUDController.js

import { MapService } from './MapService.js';
import { MarkerController } from './MarkerController.js';
import { RoutingController } from './RoutingController.js';

export const HUDController = {
    currentState: 'places',
    isOpen: false,
    isExpanded: false,

    open(expand = false) {
        const hudPanel = document.getElementById('hud-panel');
        if (!hudPanel) return;

        this.isOpen = true;
        this.isExpanded = expand;

        hudPanel.classList.remove('hud-closed');

        if (window.innerWidth < 768) {
            if (expand) {
                hudPanel.classList.remove('hud-open-default');
                hudPanel.classList.add('hud-open-expanded');
            } else {
                hudPanel.classList.remove('hud-open-expanded');
                hudPanel.classList.add('hud-open-default');
            }
            hudPanel.classList.remove('hud-open');
        } else {
            hudPanel.classList.add('hud-open');
            hudPanel.classList.remove('hud-open-default', 'hud-open-expanded');
        }
    },

    close() {
        const hudPanel = document.getElementById('hud-panel');
        if (!hudPanel) return;

        this.isOpen = false;
        this.isExpanded = false;

        hudPanel.classList.add('hud-closed');
        hudPanel.classList.remove('hud-open', 'hud-open-default', 'hud-open-expanded');
    },

    expand() {
        this.open(true);
    },

    collapse() {
        this.open(false);
    },

    setState(hudState, data = null) {
        this.currentState = hudState;

        if (hudState !== 'place-details') {
            MarkerController.removeTempMarker();
            this.clearHighlightedPath();
        }

        const panelPlaces = document.getElementById('panel-places');
        const panelSearch = document.getElementById('panel-search');
        const panelDetails = document.getElementById('panel-details');
        const measurePanel = document.getElementById('measure-panel');
        const navPanel = document.getElementById('nav-panel');
        const drawBtn = document.getElementById('btn-draw');
        const routeBtn = document.getElementById('btn-route');

        if (panelPlaces) panelPlaces.classList.add('hidden');
        if (panelSearch) panelSearch.classList.add('hidden');
        if (measurePanel) measurePanel.classList.add('hidden');
        if (navPanel) navPanel.classList.add('hidden');
        if (panelDetails) panelDetails.classList.add('hidden');

        if (drawBtn) drawBtn.className = 'group flex items-center justify-center w-12 h-12 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-full shadow-lg hover:shadow-xl text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30 transition-all duration-300 relative';
        if (routeBtn) routeBtn.className = 'group flex items-center justify-center w-12 h-12 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-full shadow-lg hover:shadow-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all duration-300 relative';

        if (hudState === 'places') {
            this.close();
        } else if (hudState === 'saved-places') {
            this.open();
            if (panelPlaces) panelPlaces.classList.remove('hidden');
        } else if (hudState === 'search-results') {
            this.open();
            if (panelSearch) panelSearch.classList.remove('hidden');
        } else if (hudState === 'measure') {
            this.open();
            if (measurePanel) measurePanel.classList.remove('hidden');
            if (drawBtn) drawBtn.className = 'group flex items-center justify-center w-12 h-12 bg-teal-600 text-white rounded-full shadow-lg hover:shadow-xl hover:bg-teal-500 transition-all duration-300 relative border border-teal-500';
        } else if (hudState === 'route') {
            this.open();
            if (navPanel) navPanel.classList.remove('hidden');
            if (routeBtn) routeBtn.className = 'group flex items-center justify-center w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:shadow-xl hover:bg-blue-500 transition-all duration-300 relative border border-blue-500';
        } else if (hudState === 'place-details') {
            this.open();
            if (panelDetails) panelDetails.classList.remove('hidden');
            this.renderPlaceDetails(data);
        }
    },

    clearHighlightedPath() {
        if (MapService.highlightedPathCoords) {
            MapService.highlightedPathCoords = null;
            MapService.updateSourceData('highlight-path-source', {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: []
                }
            });
        }
    },

    renderPlaceDetails(data) {
        const panelDetails = document.getElementById('panel-details');
        if (!data) return;

        panelDetails.innerHTML = '';

        if (data.isLoading) {
            const template = document.getElementById('template-place-details-loading');
            const clone = template.content.cloneNode(true);
            clone.querySelector('.btn-close').addEventListener('click', () => this.setState('places'));
            panelDetails.appendChild(clone);
            return;
        }

        if (data.isTemp) {
            const template = document.getElementById('template-place-details-temp');
            const clone = template.content.cloneNode(true);

            clone.querySelector('.place-name').textContent = data.name || "Dropped Pin";
            clone.querySelector('.place-coords').textContent = `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`;
            clone.querySelector('.btn-close').addEventListener('click', () => this.setState('places'));

            const img = clone.querySelector('.wiki-image');
            if (data.wikiImage) {
                img.src = data.wikiImage;
                img.classList.remove('hidden');
            } else {
                img.classList.add('hidden');
            }

            if (data.streetName) {
                const highlightContainer = clone.querySelector('.street-highlight-container');
                highlightContainer.classList.remove('hidden');
                highlightContainer.querySelector('.street-name').textContent = `Highlighting: ${data.streetName}`;
            }

            if (data.wikiSummary) {
                const wikiContainer = clone.querySelector('.wiki-summary-container');
                wikiContainer.classList.remove('hidden');
                wikiContainer.textContent = data.wikiSummary;
            } else if (data.address) {
                const addressEl = clone.querySelector('.place-address');
                addressEl.classList.remove('hidden');
                addressEl.textContent = data.address;
            } else {
                clone.querySelector('.place-default-prompt').classList.remove('hidden');
            }

            if (data.shopInfo) {
                const shopContainer = clone.querySelector('.shop-info-container');
                shopContainer.classList.remove('hidden');

                if (data.shopInfo.type) {
                    const el = shopContainer.querySelector('.shop-type');
                    el.classList.remove('hidden');
                    el.querySelector('.shop-type-val').textContent = data.shopInfo.type.replace('_', ' ');
                }
                if (data.shopInfo.brand) {
                    const el = shopContainer.querySelector('.shop-brand');
                    el.classList.remove('hidden');
                    el.querySelector('.shop-brand-val').textContent = data.shopInfo.brand;
                }
                if (data.shopInfo.openingHours) {
                    const el = shopContainer.querySelector('.shop-hours');
                    el.classList.remove('hidden');
                    el.querySelector('.shop-hours-val').textContent = data.shopInfo.openingHours;
                }
                if (data.shopInfo.cuisine) {
                    const el = shopContainer.querySelector('.shop-cuisine');
                    el.classList.remove('hidden');
                    el.querySelector('.shop-cuisine-val').textContent = data.shopInfo.cuisine;
                }
                if (data.shopInfo.website) {
                    const el = shopContainer.querySelector('.shop-web');
                    el.classList.remove('hidden');
                    const link = el.querySelector('.shop-web-link');
                    link.href = data.shopInfo.website;
                    link.textContent = data.shopInfo.website;
                }
                if (data.shopInfo.phone) {
                    const el = shopContainer.querySelector('.shop-phone');
                    el.classList.remove('hidden');
                    el.querySelector('.shop-phone-val').textContent = data.shopInfo.phone;
                }
            }

            clone.querySelector('.btn-save').addEventListener('click', () => {
                MarkerController.openModal(data.lat, data.lng, null, data);
            });
            const btnDirections = clone.querySelector('.btn-directions');
            if (btnDirections) {
                btnDirections.addEventListener('click', () => {
                    RoutingController.enter();
                    RoutingController.setDestination({ lat: data.lat, lng: data.lng }, data.name || "Selected Destination");
                });
            }

            if (data.wikiUrl) {
                const wikiCredits = clone.querySelectorAll('.wiki-credit');
                wikiCredits.forEach(el => el.classList.remove('hidden'));
                const wikiLink = clone.querySelector('.wiki-link');
                if (wikiLink) {
                    wikiLink.href = data.wikiUrl;
                }
            }

            panelDetails.appendChild(clone);
        } else {
            const template = document.getElementById('template-place-details-saved');
            const clone = template.content.cloneNode(true);
            const colorPalette = MarkerController.colorPalette;
            const config = colorPalette[data.category] || colorPalette.poi;
            const categoryLabels = {
                poi: '🎯 Point of Interest',
                food: '🍕 Food & Drink',
                lodging: '🏨 Lodging',
                nature: '🌿 Nature / Scenic'
            };

            const badge = clone.querySelector('.place-badge');
            badge.textContent = categoryLabels[data.category] || 'Place';
            badge.style.borderColor = `${config.main}30`;
            badge.style.backgroundColor = `${config.main}15`;
            badge.style.color = config.main;

            clone.querySelector('.place-name').textContent = data.name;
            clone.querySelector('.place-coords').textContent = `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`;
            clone.querySelector('.btn-close').addEventListener('click', () => this.setState('places'));

            const img = clone.querySelector('.wiki-image');
            if (data.wikiImage) {
                img.src = data.wikiImage;
                img.classList.remove('hidden');
            } else {
                img.classList.add('hidden');
            }

            const descText = clone.querySelector('.place-desc-text');
            if (data.desc) {
                descText.textContent = data.desc;
            } else {
                descText.textContent = "No notes or description saved.";
                descText.className = "place-desc-text text-xs text-slate-400 dark:text-slate-600 italic";
            }

            if (data.wikiUrl) {
                const wikiCredits = clone.querySelectorAll('.wiki-credit');
                wikiCredits.forEach(el => el.classList.remove('hidden'));
                const wikiLink = clone.querySelector('.wiki-link');
                if (wikiLink) {
                    wikiLink.href = data.wikiUrl;
                }
            }

            clone.querySelector('.btn-edit').addEventListener('click', () => {
                MarkerController.openModal(data.lat, data.lng, data.id);
            });
            clone.querySelector('.btn-delete').addEventListener('click', () => {
                MarkerController.delete(data.id);
            });
            const btnDirections = clone.querySelector('.btn-directions');
            if (btnDirections) {
                btnDirections.addEventListener('click', () => {
                    RoutingController.enter();
                    RoutingController.setDestination({ lat: data.lat, lng: data.lng }, data.name || "Selected Destination");
                });
            }

            panelDetails.appendChild(clone);
        }
    }
};
