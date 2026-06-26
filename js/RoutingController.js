// maps Routing Controller - js/RoutingController.js

import { MapService } from './MapService.js';
import { HUDController } from './HUDController.js';
import { MeasurementController } from './MeasurementController.js';
import { ApiService } from './ApiService.js';

const ROUTE_COLOR = '#4285F4';
const ROUTE_OUTLINE_COLOR = '#1a5cc8';
const ALT_ROUTE_COLOR = '#9AA0A6';
const ROUTE_WEIGHT = 6;
const ROUTE_OUTLINE_WEIGHT = 9;
const AUTOCOMPLETE_DEBOUNCE_MS = 350;

export const RoutingController = {
    isRouteMode: false,
    routingProfile: 'driving',
    routeStart: null,
    routeEnd: null,
    routeStartName: '',
    routeEndName: '',
    routeStartMarker: null,
    routeEndMarker: null,
    routeLineInstance: null,
    routeOutlineInstance: null,
    routeAlternatives: [],
    routeSteps: [],
    activeRouteIndex: 0,
    navAutocompleteTimeout: null,
    navFocusedInput: null,
    lastRoutingData: null,
    currentRouteGeoJSON: null,
    currentAlternativesGeoJSON: null,

    getManeuverIcon(type, modifier) {
        if (type === 'depart') return 'trip_origin';
        if (type === 'arrive') return 'flag';
        if (type === 'roundabout' || type === 'rotary') return 'rotate_right';
        if (type === 'merge') return 'merge';
        if (type === 'fork') {
            if (modifier && modifier.includes('left')) return 'fork_left';
            return 'fork_right';
        }
        if (type === 'turn' || type === 'end of road' || type === 'new name') {
            if (!modifier) return 'straight';
            if (modifier === 'left') return 'turn_left';
            if (modifier === 'right') return 'turn_right';
            if (modifier === 'slight left') return 'turn_slight_left';
            if (modifier === 'slight right') return 'turn_slight_right';
            if (modifier === 'sharp left') return 'turn_sharp_left';
            if (modifier === 'sharp right') return 'turn_sharp_right';
            if (modifier === 'uturn') return 'u_turn_left';
            return 'straight';
        }
        if (type === 'continue') return 'straight';
        if (type === 'ramp') {
            if (modifier && modifier.includes('left')) return 'ramp_left';
            return 'ramp_right';
        }
        return 'straight';
    },

    formatDuration(seconds) {
        const minutes = Math.round(seconds / 60);
        if (minutes < 1) return '< 1 min';
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const remainingMins = minutes % 60;
        if (remainingMins === 0) return `${hours} hr`;
        return `${hours} hr ${remainingMins} min`;
    },

    formatDistance(meters) {
        if (meters < 1000) return `${Math.round(meters)} m`;
        return `${(meters / 1000).toFixed(1)} km`;
    },

    formatStepDistance(meters) {
        if (meters < 100) return `${Math.round(meters)} m`;
        if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
        return `${(meters / 1000).toFixed(1)} km`;
    },

    renderAutocomplete(results, dropdownEl, onSelect) {
        dropdownEl.innerHTML = '';
        if (!results || results.length === 0) {
            dropdownEl.classList.add('hidden');
            return;
        }
        results.forEach(item => {
            const template = document.getElementById('template-autocomplete-item');
            const clone = template.content.cloneNode(true);
            const shortName = item.display_name.split(',')[0];
            
            clone.querySelector('.item-name').textContent = shortName;
            clone.querySelector('.item-address').textContent = item.display_name;

            clone.querySelector('.nav-autocomplete-item').addEventListener('click', () => {
                onSelect({
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon),
                    name: shortName,
                    fullName: item.display_name
                });
                dropdownEl.innerHTML = '';
                dropdownEl.classList.add('hidden');
            });

            dropdownEl.appendChild(clone);
        });
        dropdownEl.classList.remove('hidden');
    },

    setupAutocomplete(inputEl, dropdownEl, type) {
        inputEl.addEventListener('input', () => {
            clearTimeout(this.navAutocompleteTimeout);
            const query = inputEl.value.trim();
            if (query.length < 2) {
                dropdownEl.innerHTML = '';
                dropdownEl.classList.add('hidden');
                return;
            }
            this.navAutocompleteTimeout = setTimeout(async () => {
                try {
                    const results = await ApiService.searchGeocode(query, 5);
                    this.renderAutocomplete(results, dropdownEl, (place) => {
                        inputEl.value = place.name;
                        const latlng = { lat: place.lat, lng: place.lng };
                        if (type === 'origin') {
                            this.setOrigin(latlng, place.name);
                        } else {
                            this.setDestination(latlng, place.name);
                        }
                    });
                } catch (e) {
                    console.error("Autocomplete search failed", e);
                }
            }, AUTOCOMPLETE_DEBOUNCE_MS);
        });

        inputEl.addEventListener('focus', () => {
            this.navFocusedInput = type;
        });

        inputEl.addEventListener('blur', () => {
            setTimeout(() => {
                if (this.navFocusedInput === type) {
                    this.navFocusedInput = null;
                }
            }, 200);
        });

        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dropdownEl.innerHTML = '';
                dropdownEl.classList.add('hidden');
                inputEl.blur();
            }
        });
    },

    closeAllAutocomplete() {
        document.querySelectorAll('.nav-autocomplete').forEach(el => {
            el.innerHTML = '';
            el.classList.add('hidden');
        });
    },

    createNavMarker(latlng, type) {
        const el = document.createElement('div');
        if (type === 'origin') {
            el.className = 'nav-origin-marker';
            el.innerHTML = `<div style="width:18px;height:18px;border-radius:50%;border:3px solid #4285F4;background:white;box-shadow:0 2px 6px rgba(66,133,244,0.5);cursor:pointer;"></div>`;
        } else {
            el.className = 'nav-dest-marker';
            el.innerHTML = `<div style="position:relative;width:28px;height:36px;cursor:pointer;">
                <svg viewBox="0 0 28 36" width="28" height="36">
                    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" fill="#EA4335"/>
                    <circle cx="14" cy="14" r="5" fill="white"/>
                </svg>
            </div>`;
        }

        const marker = MapService.createMarker(el, true, type === 'origin' ? 'center' : 'bottom')
            .setLngLat([latlng.lng, latlng.lat]);

        el.addEventListener('click', (e) => e.stopPropagation());
        el.addEventListener('mousedown', (e) => e.stopPropagation());

        marker.on('dragend', async () => {
            const lngLat = marker.getLngLat();
            const newLatLng = { lat: lngLat.lat, lng: lngLat.lng };
            try {
                const res = await ApiService.reverseGeocode(newLatLng.lat, newLatLng.lng);
                let name = `${newLatLng.lat.toFixed(4)}, ${newLatLng.lng.toFixed(4)}`;
                if (res && res.display_name) {
                    name = res.display_name.split(',').slice(0, 2).join(',').trim();
                }
                if (type === 'origin') {
                    this.setOrigin(newLatLng, name, true);
                } else {
                    this.setDestination(newLatLng, name, true);
                }
            } catch (err) {
                console.error("Reverse geocoding after drag failed", err);
            }
        });

        return marker;
    },

    setOrigin(latlng, name, skipInputUpdate = false) {
        this.routeStart = latlng;
        this.routeStartName = name || '';

        if (!skipInputUpdate) {
            const input = document.getElementById('nav-origin-input');
            if (input) input.value = name || `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
        }

        if (this.routeStartMarker) this.routeStartMarker.remove();
        this.routeStartMarker = this.createNavMarker(latlng, 'origin').addTo(MapService.map);

        this.tryCalculateRoute();
    },

    setDestination(latlng, name, skipInputUpdate = false) {
        this.routeEnd = latlng;
        this.routeEndName = name || '';

        if (!skipInputUpdate) {
            const input = document.getElementById('nav-dest-input');
            if (input) input.value = name || `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
        }

        if (this.routeEndMarker) this.routeEndMarker.remove();
        this.routeEndMarker = this.createNavMarker(latlng, 'destination').addTo(MapService.map);

        this.tryCalculateRoute();
    },

    tryCalculateRoute() {
        if (this.routeStart && this.routeEnd) {
            this.calculateRoute();
        }
    },

    swapWaypoints() {
        const tempCoord = this.routeStart;
        const tempName = this.routeStartName;

        const originInput = document.getElementById('nav-origin-input');
        const destInput = document.getElementById('nav-dest-input');

        this.routeStart = this.routeEnd;
        this.routeStartName = this.routeEndName;
        this.routeEnd = tempCoord;
        this.routeEndName = tempName;

        if (originInput) originInput.value = this.routeStartName || (this.routeStart ? `${this.routeStart.lat.toFixed(4)}, ${this.routeStart.lng.toFixed(4)}` : '');
        if (destInput) destInput.value = this.routeEndName || (this.routeEnd ? `${this.routeEnd.lat.toFixed(4)}, ${this.routeEnd.lng.toFixed(4)}` : '');

        if (this.routeStartMarker) this.routeStartMarker.remove();
        if (this.routeEndMarker) this.routeEndMarker.remove();
        this.routeStartMarker = null;
        this.routeEndMarker = null;

        if (this.routeStart) {
            this.routeStartMarker = this.createNavMarker(this.routeStart, 'origin').addTo(MapService.map);
        }
        if (this.routeEnd) {
            this.routeEndMarker = this.createNavMarker(this.routeEnd, 'destination').addTo(MapService.map);
        }

        this.tryCalculateRoute();
    },

    useMyLocation() {
        if (!navigator.geolocation) return;
        const originInput = document.getElementById('nav-origin-input');
        if (originInput) originInput.value = 'Locating...';

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                try {
                    const res = await ApiService.reverseGeocode(latlng.lat, latlng.lng);
                    let name = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
                    if (res && res.display_name) {
                        name = res.display_name.split(',').slice(0, 2).join(',').trim();
                    }
                    if (originInput) originInput.value = name;
                    this.setOrigin(latlng, name, true);
                } catch (err) {
                    console.error("Reverse geocoding my location failed", err);
                    if (originInput) originInput.value = '';
                }
            },
            () => {
                if (originInput) originInput.value = '';
            },
            { timeout: 8000 }
        );
    },

    enter() {
        MeasurementController.exit();
        this.exit();
        this.isRouteMode = true;
        HUDController.setState('route');

        setTimeout(() => {
            const input = document.getElementById('nav-origin-input');
            if (input) input.focus();
        }, 100);
    },

    exit() {
        this.isRouteMode = false;
        if (HUDController.currentState === 'route') {
            HUDController.setState('places');
        }
        this.clearRouteDisplay();
        this.clearWaypoints();
    },

    clearRouteDisplay() {
        this.currentRouteGeoJSON = null;
        this.currentAlternativesGeoJSON = null;
        this.lastRoutingData = null;

        MapService.updateSourceData('route-source', { type: 'FeatureCollection', features: [] });
        MapService.updateSourceData('alternative-routes-source', { type: 'FeatureCollection', features: [] });

        this.routeLineInstance = null;
        this.routeOutlineInstance = null;
        this.routeAlternatives = [];
        this.routeSteps = [];
        this.activeRouteIndex = 0;

        const summary = document.getElementById('nav-route-summary');
        const stepsList = document.getElementById('nav-steps-list');
        if (summary) summary.classList.add('hidden');
        if (stepsList) {
            stepsList.innerHTML = `
                <div class="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                    <span class="material-icons-outlined text-3xl mb-2 block opacity-40">alt_route</span>
                    Set origin and destination to see route directions
                </div>
            `;
        }
    },

    clearWaypoints() {
        if (this.routeStartMarker) this.routeStartMarker.remove();
        if (this.routeEndMarker) this.routeEndMarker.remove();
        this.routeStart = null;
        this.routeEnd = null;
        this.routeStartName = '';
        this.routeEndName = '';
        this.routeStartMarker = null;
        this.routeEndMarker = null;

        const originInput = document.getElementById('nav-origin-input');
        const destInput = document.getElementById('nav-dest-input');
        if (originInput) originInput.value = '';
        if (destInput) destInput.value = '';
    },

    setProfile(profile) {
        document.querySelectorAll('.nav-mode-btn').forEach(btn => {
            const mode = btn.getAttribute('data-nav-mode');
            if (mode === profile) {
                btn.className = 'nav-mode-btn flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-bold rounded-lg transition-all bg-blue-600 text-white shadow-sm';
            } else {
                btn.className = 'nav-mode-btn flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-semibold rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all';
            }
        });

        this.routingProfile = profile;
        this.tryCalculateRoute();
    },

    handleClick(latlng) {
        if (this.navFocusedInput === 'destination' || this.routeStart) {
            ApiService.reverseGeocode(latlng.lat, latlng.lng).then(res => {
                let name = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
                if (res && res.display_name) {
                    name = res.display_name.split(',').slice(0, 2).join(',').trim();
                }
                const input = document.getElementById('nav-dest-input');
                if (input) input.value = name;
                this.setDestination(latlng, name, true);
            }).catch(err => {
                console.error("Reverse geocoding click destination failed", err);
            });
        } else {
            ApiService.reverseGeocode(latlng.lat, latlng.lng).then(res => {
                let name = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
                if (res && res.display_name) {
                    name = res.display_name.split(',').slice(0, 2).join(',').trim();
                }
                const input = document.getElementById('nav-origin-input');
                if (input) input.value = name;
                this.setOrigin(latlng, name, true);
            }).catch(err => {
                console.error("Reverse geocoding click origin failed", err);
            });
        }
        this.closeAllAutocomplete();
    },

    fitRouteBounds(geometry) {
        if (!geometry || !geometry.coordinates) return;
        const coords = geometry.coordinates;
        if (coords.length === 0) return;

        let minLng = Infinity, maxLng = -Infinity;
        let minLat = Infinity, maxLat = -Infinity;

        coords.forEach(c => {
            const lng = c[0], lat = c[1];
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        });

        MapService.fitBounds([
            [minLng, minLat],
            [maxLng, maxLat]
        ], 60);
    },

    async calculateRoute() {
        if (!this.routeStart || !this.routeEnd) return;

        const stepsList = document.getElementById('nav-steps-list');
        if (stepsList) {
            stepsList.innerHTML = `
                <div class="text-center py-8 text-slate-400 dark:text-slate-500 text-xs animate-pulse">
                    <span class="material-icons-outlined text-3xl mb-2 block">route</span>
                    Calculating route...
                </div>
            `;
        }

        try {
            const data = await ApiService.calculateRoute(this.routeStart, this.routeEnd, this.routingProfile);

            if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
                if (stepsList) {
                    stepsList.innerHTML = `
                        <div class="text-center py-8 text-red-400 dark:text-red-500 text-xs">
                            <span class="material-icons-outlined text-3xl mb-2 block">error_outline</span>
                            Could not find a route between these points
                        </div>
                    `;
                }
                return;
            }

            this.clearRouteDisplay();
            this.lastRoutingData = data;

            // Draw alternatives
            this.drawAlternativeRoutes(data.routes);

            // Draw main route
            this.drawMainRoute(data.routes[0]);
            this.activeRouteIndex = 0;

            // Fit bounds
            this.fitRouteBounds(data.routes[0].geometry);

            // Render summary & steps
            this.renderRouteSummary(data.routes[0]);
            this.renderRouteSteps(data.routes[0]);

        } catch (err) {
            console.error('Route calculation failed:', err);
            if (stepsList) {
                stepsList.innerHTML = `
                    <div class="text-center py-8 text-red-400 dark:text-red-500 text-xs">
                        <span class="material-icons-outlined text-3xl mb-2 block">wifi_off</span>
                        Network error — check your connection
                    </div>
                `;
            }
        }
    },

    drawMainRoute(route) {
        this.currentRouteGeoJSON = {
            type: 'Feature',
            geometry: route.geometry
        };
        MapService.updateSourceData('route-source', this.currentRouteGeoJSON);
        this.routeLineInstance = true;
    },

    drawAlternativeRoutes(routes) {
        const features = [];
        for (let i = 1; i < routes.length; i++) {
            features.push({
                type: 'Feature',
                properties: { routeIndex: i },
                geometry: routes[i].geometry
            });
        }
        this.currentAlternativesGeoJSON = {
            type: 'FeatureCollection',
            features: features
        };
        MapService.updateSourceData('alternative-routes-source', this.currentAlternativesGeoJSON);
    },

    promoteAlternativeRoute(data, newIndex) {
        const routesCopy = [...data.routes];
        const promoted = routesCopy.splice(newIndex, 1)[0];
        routesCopy.unshift(promoted);

        this.drawMainRoute(routesCopy[0]);
        this.drawAlternativeRoutes(routesCopy);
        this.activeRouteIndex = newIndex;
        this.lastRoutingData = { ...data, routes: routesCopy };

        this.renderRouteSummary(routesCopy[0]);
        this.renderRouteSteps(routesCopy[0]);
    },

    renderRouteSummary(route) {
        const summary = document.getElementById('nav-route-summary');
        const timeEl = document.getElementById('nav-route-time');
        const distEl = document.getElementById('nav-route-dist');
        const viaEl = document.getElementById('nav-route-via');

        if (!summary) return;

        let seconds = route.duration;
        if (this.routingProfile === 'foot') seconds *= 1.2;

        if (timeEl) timeEl.innerText = this.formatDuration(seconds);
        if (distEl) distEl.innerText = this.formatDistance(route.distance);

        if (viaEl) {
            let viaRoad = 'Fastest route';
            if (route.legs && route.legs[0] && route.legs[0].steps) {
                const steps = route.legs[0].steps;
                let longestStep = steps[0];
                steps.forEach(s => {
                    if (s.distance > longestStep.distance) longestStep = s;
                });
                if (longestStep.name && longestStep.name.trim()) {
                    viaRoad = `via ${longestStep.name}`;
                }
            }
            viaEl.innerText = viaRoad;
        }

        summary.classList.remove('hidden');
    },

    renderRouteSteps(route) {
        const stepsList = document.getElementById('nav-steps-list');
        if (!stepsList) return;

        stepsList.innerHTML = '';

        if (!route.legs || route.legs.length === 0) return;

        const steps = route.legs[0].steps;
        this.routeSteps = steps;

        steps.forEach((step, idx) => {
            const icon = this.getManeuverIcon(step.maneuver.type, step.maneuver.modifier);
            const instruction = step.name ? step.name : (step.maneuver.type === 'depart' ? 'Start' : step.maneuver.type === 'arrive' ? 'Arrive at destination' : 'Continue');
            const dist = this.formatStepDistance(step.distance);
            const isFirst = idx === 0;
            const isLast = idx === steps.length - 1;

            const template = document.getElementById('template-routing-step-item');
            const clone = template.content.cloneNode(true);
            const stepItem = clone.querySelector('.nav-step-item');
            
            if (isFirst) stepItem.classList.add('pt-1');
            if (isLast) stepItem.classList.add('pb-1');

            const iconContainer = clone.querySelector('.step-icon-container');
            if (isLast) {
                iconContainer.classList.add('bg-red-50', 'dark:bg-red-950/30', 'text-red-500');
            } else {
                iconContainer.classList.add('bg-blue-50', 'dark:bg-blue-950/30', 'text-blue-500');
            }

            clone.querySelector('.step-icon').textContent = icon;
            
            if (isLast) {
                clone.querySelector('.step-line').remove();
            }

            const instructionEl = clone.querySelector('.step-instruction');
            instructionEl.textContent = `${isFirst ? 'Head ' + (step.maneuver.modifier || '') + ' on ' : isLast ? '' : ''}${instruction}`;

            const distEl = clone.querySelector('.step-distance');
            if (!isLast) {
                distEl.textContent = dist;
            } else {
                distEl.remove();
            }

            stepItem.addEventListener('click', () => {
                const loc = step.maneuver.location;
                if (loc) {
                    MapService.flyTo([loc[0], loc[1]], Math.max(MapService.getZoom(), 16), 0.5);
                }
            });

            stepsList.appendChild(clone);
        });
    }
};
