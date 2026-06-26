// maps Navigation Module — Google Maps-style routing

import { state } from './state.js';
import { setHUDState } from './hud.js';
import { exitMeasureMode } from './measure.js';

// ─── Constants ───
const ROUTE_COLOR = '#4285F4';
const ROUTE_OUTLINE_COLOR = '#1a5cc8';
const ALT_ROUTE_COLOR = '#9AA0A6';
const ROUTE_WEIGHT = 6;
const ROUTE_OUTLINE_WEIGHT = 9;
const AUTOCOMPLETE_DEBOUNCE_MS = 350;

// ─── Maneuver icon mapping ───
function getManeuverIcon(type, modifier) {
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
}

// ─── Format helpers ───
function formatDuration(seconds) {
    const minutes = Math.round(seconds / 60);
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    if (remainingMins === 0) return `${hours} hr`;
    return `${hours} hr ${remainingMins} min`;
}

function formatDistance(meters) {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

function formatStepDistance(meters) {
    if (meters < 100) return `${Math.round(meters)} m`;
    if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

// ─── Geocoding ───
async function geocodeSearch(query) {
    if (!query || query.trim().length < 2) return [];
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`);
        return await res.json();
    } catch {
        return [];
    }
}

async function reverseGeocode(latlng) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&zoom=18`);
        const data = await res.json();
        if (data && data.display_name) {
            return data.display_name.split(',').slice(0, 2).join(',').trim();
        }
    } catch { /* ignore */ }
    return `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
}

// ─── Autocomplete rendering ───
function renderAutocomplete(results, dropdownEl, onSelect) {
    dropdownEl.innerHTML = '';
    if (!results || results.length === 0) {
        dropdownEl.classList.add('hidden');
        return;
    }
    results.forEach(item => {
        const div = document.createElement('div');
        div.className = 'nav-autocomplete-item px-3 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors border-b border-slate-100 dark:border-slate-800/50 last:border-b-0';
        const shortName = item.display_name.split(',')[0];
        const fullAddr = item.display_name;
        div.innerHTML = `
            <div class="flex items-start gap-2">
                <span class="material-icons-outlined text-sm text-slate-400 mt-0.5 flex-shrink-0">location_on</span>
                <div class="min-w-0">
                    <div class="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">${shortName}</div>
                    <div class="text-[10px] text-slate-400 dark:text-slate-500 truncate">${fullAddr}</div>
                </div>
            </div>
        `;
        div.addEventListener('click', () => {
            onSelect({
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                name: shortName,
                fullName: fullAddr
            });
            dropdownEl.innerHTML = '';
            dropdownEl.classList.add('hidden');
        });
        dropdownEl.appendChild(div);
    });
    dropdownEl.classList.remove('hidden');
}

// ─── Input autocomplete wiring ───
export function setupAutocomplete(inputEl, dropdownEl, type) {
    inputEl.addEventListener('input', () => {
        clearTimeout(state.navAutocompleteTimeout);
        const query = inputEl.value.trim();
        if (query.length < 2) {
            dropdownEl.innerHTML = '';
            dropdownEl.classList.add('hidden');
            return;
        }
        state.navAutocompleteTimeout = setTimeout(async () => {
            const results = await geocodeSearch(query);
            renderAutocomplete(results, dropdownEl, (place) => {
                inputEl.value = place.name;
                const latlng = { lat: place.lat, lng: place.lng };
                if (type === 'origin') {
                    setOrigin(latlng, place.name);
                } else {
                    setDestination(latlng, place.name);
                }
            });
        }, AUTOCOMPLETE_DEBOUNCE_MS);
    });

    inputEl.addEventListener('focus', () => {
        state.navFocusedInput = type;
    });

    inputEl.addEventListener('blur', () => {
        setTimeout(() => {
            if (state.navFocusedInput === type) {
                state.navFocusedInput = null;
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
}

export function closeAllAutocomplete() {
    document.querySelectorAll('.nav-autocomplete').forEach(el => {
        el.innerHTML = '';
        el.classList.add('hidden');
    });
}

// ─── Marker creation (Google Maps style) ───
function createNavMarker(latlng, type) {
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

    const marker = new maplibregl.Marker({
        element: el,
        draggable: true,
        anchor: type === 'origin' ? 'center' : 'bottom'
    })
    .setLngLat([latlng.lng, latlng.lat]);

    el.addEventListener('click', (e) => e.stopPropagation());
    el.addEventListener('mousedown', (e) => e.stopPropagation());

    marker.on('dragend', async () => {
        const lngLat = marker.getLngLat();
        const newLatLng = { lat: lngLat.lat, lng: lngLat.lng };
        const name = await reverseGeocode(newLatLng);
        if (type === 'origin') {
            setOrigin(newLatLng, name, true);
        } else {
            setDestination(newLatLng, name, true);
        }
    });

    return marker;
}

// ─── Set Origin / Destination ───
function setOrigin(latlng, name, skipInputUpdate = false) {
    state.routeStart = latlng;
    state.routeStartName = name || '';

    if (!skipInputUpdate) {
        const input = document.getElementById('nav-origin-input');
        if (input) input.value = name || `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
    }

    if (state.routeStartMarker) state.routeStartMarker.remove();
    state.routeStartMarker = createNavMarker(latlng, 'origin').addTo(state.map);

    tryCalculateRoute();
}

function setDestination(latlng, name, skipInputUpdate = false) {
    state.routeEnd = latlng;
    state.routeEndName = name || '';

    if (!skipInputUpdate) {
        const input = document.getElementById('nav-dest-input');
        if (input) input.value = name || `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
    }

    if (state.routeEndMarker) state.routeEndMarker.remove();
    state.routeEndMarker = createNavMarker(latlng, 'destination').addTo(state.map);

    tryCalculateRoute();
}

function tryCalculateRoute() {
    if (state.routeStart && state.routeEnd) {
        calculateRoute();
    }
}

// ─── Swap waypoints ───
export function swapWaypoints() {
    const tempCoord = state.routeStart;
    const tempName = state.routeStartName;

    const originInput = document.getElementById('nav-origin-input');
    const destInput = document.getElementById('nav-dest-input');

    state.routeStart = state.routeEnd;
    state.routeStartName = state.routeEndName;
    state.routeEnd = tempCoord;
    state.routeEndName = tempName;

    if (originInput) originInput.value = state.routeStartName || (state.routeStart ? `${state.routeStart.lat.toFixed(4)}, ${state.routeStart.lng.toFixed(4)}` : '');
    if (destInput) destInput.value = state.routeEndName || (state.routeEnd ? `${state.routeEnd.lat.toFixed(4)}, ${state.routeEnd.lng.toFixed(4)}` : '');

    if (state.routeStartMarker) state.routeStartMarker.remove();
    if (state.routeEndMarker) state.routeEndMarker.remove();
    state.routeStartMarker = null;
    state.routeEndMarker = null;

    if (state.routeStart) {
        state.routeStartMarker = createNavMarker(state.routeStart, 'origin').addTo(state.map);
    }
    if (state.routeEnd) {
        state.routeEndMarker = createNavMarker(state.routeEnd, 'destination').addTo(state.map);
    }

    tryCalculateRoute();
}

// ─── Use my location ───
export function useMyLocation() {
    if (!navigator.geolocation) return;
    const originInput = document.getElementById('nav-origin-input');
    if (originInput) originInput.value = 'Locating...';

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            const name = await reverseGeocode(latlng);
            if (originInput) originInput.value = name;
            setOrigin(latlng, name, true);
        },
        () => {
            if (originInput) originInput.value = '';
        },
        { timeout: 8000 }
    );
}

// ─── Mode switching ───
export function enterRoutingMode() {
    exitMeasureMode();
    exitRoutingMode();
    state.isRouteMode = true;
    setHUDState('route');

    setTimeout(() => {
        const input = document.getElementById('nav-origin-input');
        if (input) input.focus();
    }, 100);
}

export function exitRoutingMode() {
    state.isRouteMode = false;
    if (state.currentHUDState === 'route') {
        setHUDState('places');
    }
    clearRouteDisplay();
    clearWaypoints();
}

function clearRouteDisplay() {
    state.currentRouteGeoJSON = null;
    state.currentAlternativesGeoJSON = null;
    state.lastRoutingData = null;

    if (state.map) {
        const rSource = state.map.getSource('route-source');
        if (rSource) {
            rSource.setData({ type: 'FeatureCollection', features: [] });
        }
        const aSource = state.map.getSource('alternative-routes-source');
        if (aSource) {
            aSource.setData({ type: 'FeatureCollection', features: [] });
        }
    }

    state.routeLineInstance = null;
    state.routeOutlineInstance = null;
    state.routeAlternatives = [];
    state.routeSteps = [];
    state.activeRouteIndex = 0;

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
}

function clearWaypoints() {
    if (state.routeStartMarker) state.routeStartMarker.remove();
    if (state.routeEndMarker) state.routeEndMarker.remove();
    state.routeStart = null;
    state.routeEnd = null;
    state.routeStartName = '';
    state.routeEndName = '';
    state.routeStartMarker = null;
    state.routeEndMarker = null;

    const originInput = document.getElementById('nav-origin-input');
    const destInput = document.getElementById('nav-dest-input');
    if (originInput) originInput.value = '';
    if (destInput) destInput.value = '';
}

export function setRoutingProfile(profile) {
    document.querySelectorAll('.nav-mode-btn').forEach(btn => {
        const mode = btn.getAttribute('data-nav-mode');
        if (mode === profile) {
            btn.className = 'nav-mode-btn flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-bold rounded-lg transition-all bg-blue-600 text-white shadow-sm';
        } else {
            btn.className = 'nav-mode-btn flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-semibold rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all';
        }
    });

    state.routingProfile = profile;
    tryCalculateRoute();
}

export function handleRoutingClick(latlng) {
    if (state.navFocusedInput === 'destination' || state.routeStart) {
        reverseGeocode(latlng).then(name => {
            const input = document.getElementById('nav-dest-input');
            if (input) input.value = name;
            setDestination(latlng, name, true);
        });
    } else {
        reverseGeocode(latlng).then(name => {
            const input = document.getElementById('nav-origin-input');
            if (input) input.value = name;
            setOrigin(latlng, name, true);
        });
    }
    closeAllAutocomplete();
}

function fitRouteBounds(geometry) {
    if (!state.map || !geometry || !geometry.coordinates) return;
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

    state.map.fitBounds([
        [minLng, minLat],
        [maxLng, maxLat]
    ], { padding: 60 });
}

// ─── Route calculation ───
export async function calculateRoute() {
    if (!state.routeStart || !state.routeEnd) return;

    let profileSlug = 'driving';
    if (state.routingProfile === 'cycling') profileSlug = 'bike';
    if (state.routingProfile === 'foot') profileSlug = 'foot';

    const url = `https://router.project-osrm.org/route/v1/${profileSlug}/${state.routeStart.lng},${state.routeStart.lat};${state.routeEnd.lng},${state.routeEnd.lat}?geometries=geojson&overview=full&steps=true&alternatives=true`;

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
        const res = await fetch(url);
        const data = await res.json();

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

        clearRouteDisplay();

        state.lastRoutingData = data;

        // Draw alternatives
        drawAlternativeRoutes(data.routes);

        // Draw main route
        drawMainRoute(data.routes[0]);
        state.activeRouteIndex = 0;

        // Fit bounds
        fitRouteBounds(data.routes[0].geometry);

        // Render summary & steps
        renderRouteSummary(data.routes[0]);
        renderRouteSteps(data.routes[0]);

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
}

function drawMainRoute(route) {
    state.currentRouteGeoJSON = {
        type: 'Feature',
        geometry: route.geometry
    };
    if (state.map && state.map.getSource('route-source')) {
        state.map.getSource('route-source').setData(state.currentRouteGeoJSON);
    }
    state.routeLineInstance = true; // flag to signify active route exists
}

function drawAlternativeRoutes(routes) {
    const features = [];
    for (let i = 1; i < routes.length; i++) {
        features.push({
            type: 'Feature',
            properties: { routeIndex: i },
            geometry: routes[i].geometry
        });
    }
    state.currentAlternativesGeoJSON = {
        type: 'FeatureCollection',
        features: features
    };
    if (state.map && state.map.getSource('alternative-routes-source')) {
        state.map.getSource('alternative-routes-source').setData(state.currentAlternativesGeoJSON);
    }
}

export function promoteAlternativeRoute(data, newIndex) {
    const routesCopy = [...data.routes];
    const promoted = routesCopy.splice(newIndex, 1)[0];
    routesCopy.unshift(promoted);

    // Redraw
    drawMainRoute(routesCopy[0]);
    drawAlternativeRoutes(routesCopy);
    state.activeRouteIndex = newIndex;

    // Update state.lastRoutingData with rearranged list
    state.lastRoutingData = { ...data, routes: routesCopy };

    // Update summary & steps
    renderRouteSummary(routesCopy[0]);
    renderRouteSteps(routesCopy[0]);
}

// ─── Render route summary ───
function renderRouteSummary(route) {
    const summary = document.getElementById('nav-route-summary');
    const timeEl = document.getElementById('nav-route-time');
    const distEl = document.getElementById('nav-route-dist');
    const viaEl = document.getElementById('nav-route-via');

    if (!summary) return;

    let seconds = route.duration;
    if (state.routingProfile === 'foot') seconds *= 1.2;

    if (timeEl) timeEl.innerText = formatDuration(seconds);
    if (distEl) distEl.innerText = formatDistance(route.distance);

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
}

// ─── Render turn-by-turn steps ───
function renderRouteSteps(route) {
    const stepsList = document.getElementById('nav-steps-list');
    if (!stepsList) return;

    stepsList.innerHTML = '';

    if (!route.legs || route.legs.length === 0) return;

    const steps = route.legs[0].steps;
    state.routeSteps = steps;

    steps.forEach((step, idx) => {
        const icon = getManeuverIcon(step.maneuver.type, step.maneuver.modifier);
        const instruction = step.name ? step.name : (step.maneuver.type === 'depart' ? 'Start' : step.maneuver.type === 'arrive' ? 'Arrive at destination' : 'Continue');
        const dist = formatStepDistance(step.distance);
        const isFirst = idx === 0;
        const isLast = idx === steps.length - 1;

        const stepEl = document.createElement('div');
        stepEl.className = `nav-step-item flex items-start gap-3 px-2 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-lg group ${isFirst ? 'pt-1' : ''} ${isLast ? 'pb-1' : ''}`;

        stepEl.innerHTML = `
            <div class="flex flex-col items-center flex-shrink-0 w-8">
                <div class="w-8 h-8 rounded-full flex items-center justify-center ${isLast ? 'bg-red-50 dark:bg-red-950/30 text-red-500' : 'bg-blue-50 dark:bg-blue-950/30 text-blue-500'} group-hover:scale-110 transition-transform">
                    <span class="material-icons-outlined text-base">${icon}</span>
                </div>
                ${!isLast ? '<div class="w-0.5 flex-1 bg-slate-200 dark:bg-slate-700 mt-1 min-h-[8px]"></div>' : ''}
            </div>
            <div class="flex-1 min-w-0 pt-1">
                <div class="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                    ${isFirst ? 'Head ' + (step.maneuver.modifier || '') + ' on ' : isLast ? '' : ''}${instruction}
                </div>
                ${!isLast ? `<div class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">${dist}</div>` : ''}
            </div>
        `;

        stepEl.addEventListener('click', () => {
            const loc = step.maneuver.location;
            if (loc && state.map) {
                state.map.flyTo({
                    center: [loc[0], loc[1]],
                    zoom: Math.max(state.map.getZoom(), 16),
                    duration: 0.5
                });
            }
        });

        stepsList.appendChild(stepEl);
    });
}
