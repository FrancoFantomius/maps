// maps HUD Controller - js/HUDController.js

import { MapService } from './MapService.js';
import { MarkerController } from './MarkerController.js';
import { RoutingController } from './RoutingController.js';
import { SearchController } from './SearchController.js';

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

        if (hudState !== 'place-details' && hudState !== 'search-results') {
            if (SearchController && typeof SearchController.clearSearchMarkers === 'function') {
                SearchController.clearSearchMarkers();
            }
        }

        const panels = ['panel-places', 'panel-search', 'panel-details', 'measure-panel', 'nav-panel'];
        panels.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        const panelMap = {
            'saved-places': 'panel-places',
            'search-results': 'panel-search',
            'measure': 'measure-panel',
            'route': 'nav-panel',
            'place-details': 'panel-details'
        };

        const drawBtn = document.getElementById('btn-draw');
        const routeBtn = document.getElementById('btn-route');

        if (drawBtn) drawBtn.className = 'group flex items-center justify-center w-12 h-12 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-full shadow-lg hover:shadow-xl text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30 transition-all duration-300 relative';
        if (routeBtn) routeBtn.className = 'group flex items-center justify-center w-12 h-12 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-full shadow-lg hover:shadow-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all duration-300 relative';

        if (hudState === 'places') {
            this.close();
        } else {
            this.open();
            const activeId = panelMap[hudState];
            if (activeId) {
                const activePanel = document.getElementById(activeId);
                if (activePanel) activePanel.classList.remove('hidden');
            }
            if (hudState === 'measure' && drawBtn) {
                drawBtn.className = 'group flex items-center justify-center w-12 h-12 bg-teal-600 text-white rounded-full shadow-lg hover:shadow-xl hover:bg-teal-500 transition-all duration-300 relative border border-teal-500';
            } else if (hudState === 'route' && routeBtn) {
                routeBtn.className = 'group flex items-center justify-center w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:shadow-xl hover:bg-blue-500 transition-all duration-300 relative border border-blue-500';
            } else if (hudState === 'place-details') {
                this.renderPlaceDetails(data);
            }
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

                const shopFields = [
                    { key: 'type', selector: '.shop-type', valSelector: '.shop-type-val', format: v => v.replace('_', ' ') },
                    { key: 'brand', selector: '.shop-brand', valSelector: '.shop-brand-val' },
                    { key: 'openingHours', selector: '.shop-hours', valSelector: '.shop-hours-val' },
                    { key: 'cuisine', selector: '.shop-cuisine', valSelector: '.shop-cuisine-val' },
                    { key: 'phone', selector: '.shop-phone', valSelector: '.shop-phone-val' }
                ];

                shopFields.forEach(field => {
                    const val = data.shopInfo[field.key];
                    if (val) {
                        const el = shopContainer.querySelector(field.selector);
                        if (el) {
                            el.classList.remove('hidden');
                            const valEl = el.querySelector(field.valSelector);
                            if (valEl) valEl.textContent = field.format ? field.format(val) : val;
                        }
                    }
                });

                if (data.shopInfo.website) {
                    const el = shopContainer.querySelector('.shop-web');
                    if (el) {
                        el.classList.remove('hidden');
                        const link = el.querySelector('.shop-web-link');
                        if (link) {
                            link.href = data.shopInfo.website;
                            link.textContent = data.shopInfo.website;
                        }
                    }
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
                home: '🏠 Home',
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
