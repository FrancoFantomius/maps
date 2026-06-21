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
                const latlng = L.latLng(place.lat, place.lng);
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
        // Delay to allow autocomplete click
        setTimeout(() => {
            if (state.navFocusedInput === type) {
                state.navFocusedInput = null;
            }
        }, 200);
    });

    // Close autocomplete on Escape
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            dropdownEl.innerHTML = '';
            dropdownEl.classList.add('hidden');
            inputEl.blur();
        }
    });
}

// Close autocomplete dropdowns when clicking outside
export function closeAllAutocomplete() {
    document.querySelectorAll('.nav-autocomplete').forEach(el => {
        el.innerHTML = '';
        el.classList.add('hidden');
    });
}

// ─── Marker creation (Google Maps style) ───
function createNavMarker(latlng, type) {
    let icon;
    if (type === 'origin') {
        icon = L.divIcon({
            className: 'nav-origin-marker',
            html: `<div style="width:18px;height:18px;border-radius:50%;border:3px solid #4285F4;background:white;box-shadow:0 2px 6px rgba(66,133,244,0.5);"></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });
    } else {
        icon = L.divIcon({
            className: 'nav-dest-marker',
            html: `<div style="position:relative;width:28px;height:36px;">
                <svg viewBox="0 0 28 36" width="28" height="36">
                    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" fill="#EA4335"/>
                    <circle cx="14" cy="14" r="5" fill="white"/>
                </svg>
            </div>`,
            iconSize: [28, 36],
            iconAnchor: [14, 36]
        });
    }

    const marker = L.marker(latlng, { draggable: true, icon });

    marker.on('click', (e) => {
        if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
    });

    marker.on('mousedown', (e) => {
        if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
    });

    marker.on('dragend', async (e) => {
        const newLatLng = e.target.getLatLng();
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

    // Update marker
    if (state.routeStartMarker) state.map.removeLayer(state.routeStartMarker);
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

    // Update marker
    if (state.routeEndMarker) state.map.removeLayer(state.routeEndMarker);
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

    // Swap state
    state.routeStart = state.routeEnd;
    state.routeStartName = state.routeEndName;
    state.routeEnd = tempCoord;
    state.routeEndName = tempName;

    // Swap input values
    if (originInput) originInput.value = state.routeStartName || (state.routeStart ? `${state.routeStart.lat.toFixed(4)}, ${state.routeStart.lng.toFixed(4)}` : '');
    if (destInput) destInput.value = state.routeEndName || (state.routeEnd ? `${state.routeEnd.lat.toFixed(4)}, ${state.routeEnd.lng.toFixed(4)}` : '');

    // Swap markers
    if (state.routeStartMarker) state.map.removeLayer(state.routeStartMarker);
    if (state.routeEndMarker) state.map.removeLayer(state.routeEndMarker);
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
            const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
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

    // Focus origin input
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
    if (state.routeLineInstance) state.map.removeLayer(state.routeLineInstance);
    if (state.routeOutlineInstance) state.map.removeLayer(state.routeOutlineInstance);
    state.routeLineInstance = null;
    state.routeOutlineInstance = null;

    // Clear alternatives
    state.routeAlternatives.forEach(layer => {
        if (layer) state.map.removeLayer(layer);
    });
    state.routeAlternatives = [];
    state.routeSteps = [];
    state.activeRouteIndex = 0;

    // Reset summary & steps UI
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
    if (state.routeStartMarker) state.map.removeLayer(state.routeStartMarker);
    if (state.routeEndMarker) state.map.removeLayer(state.routeEndMarker);
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
    // Update button styles
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

// ─── Map click handler (sets origin or destination) ───
export function handleRoutingClick(latlng) {
    if (state.navFocusedInput === 'destination' || state.routeStart) {
        // Set destination
        reverseGeocode(latlng).then(name => {
            const input = document.getElementById('nav-dest-input');
            if (input) input.value = name;
            setDestination(latlng, name, true);
        });
    } else {
        // Set origin
        reverseGeocode(latlng).then(name => {
            const input = document.getElementById('nav-origin-input');
            if (input) input.value = name;
            setOrigin(latlng, name, true);
        });
    }
    closeAllAutocomplete();
}

// ─── Route calculation ───
export async function calculateRoute() {
    if (!state.routeStart || !state.routeEnd) return;

    let profileSlug = 'driving';
    if (state.routingProfile === 'cycling') profileSlug = 'bike';
    if (state.routingProfile === 'foot') profileSlug = 'foot';

    const url = `https://router.project-osrm.org/route/v1/${profileSlug}/${state.routeStart.lng},${state.routeStart.lat};${state.routeEnd.lng},${state.routeEnd.lat}?geometries=geojson&overview=full&steps=true&alternatives=true`;

    // Show loading state in steps
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

        // Clear previous route display
        clearRouteDisplay();

        // Draw alternative routes first (so they're behind the main route)
        if (data.routes.length > 1) {
            for (let i = 1; i < data.routes.length; i++) {
                const altCoords = data.routes[i].geometry.coordinates.map(c => [c[1], c[0]]);
                const altLine = L.polyline(altCoords, {
                    color: ALT_ROUTE_COLOR,
                    weight: 5,
                    opacity: 0.5,
                    lineCap: 'round',
                    lineJoin: 'round'
                }).addTo(state.map);

                // Click to promote alternative
                const routeIndex = i;
                altLine.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    promoteAlternativeRoute(data, routeIndex);
                });

                state.routeAlternatives.push(altLine);
            }
        }

        // Draw main route
        drawMainRoute(data.routes[0]);
        state.activeRouteIndex = 0;

        // Fit bounds
        if (state.routeLineInstance) {
            state.map.fitBounds(state.routeLineInstance.getBounds(), { padding: [60, 60] });
        }

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
    const coordinates = route.geometry.coordinates.map(c => [c[1], c[0]]);

    // Outline (darker, wider)
    state.routeOutlineInstance = L.polyline(coordinates, {
        color: ROUTE_OUTLINE_COLOR,
        weight: ROUTE_OUTLINE_WEIGHT,
        opacity: 0.4,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(state.map);

    // Main line
    state.routeLineInstance = L.polyline(coordinates, {
        color: ROUTE_COLOR,
        weight: ROUTE_WEIGHT,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(state.map);
}

function promoteAlternativeRoute(data, newIndex) {
    // Clear current display
    if (state.routeLineInstance) state.map.removeLayer(state.routeLineInstance);
    if (state.routeOutlineInstance) state.map.removeLayer(state.routeOutlineInstance);
    state.routeAlternatives.forEach(l => { if (l) state.map.removeLayer(l); });
    state.routeAlternatives = [];

    // Redraw alternatives (all except the new main)
    for (let i = 0; i < data.routes.length; i++) {
        if (i === newIndex) continue;
        const altCoords = data.routes[i].geometry.coordinates.map(c => [c[1], c[0]]);
        const altLine = L.polyline(altCoords, {
            color: ALT_ROUTE_COLOR,
            weight: 5,
            opacity: 0.5,
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(state.map);

        const idx = i;
        altLine.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            promoteAlternativeRoute(data, idx);
        });
        state.routeAlternatives.push(altLine);
    }

    // Draw new main route
    drawMainRoute(data.routes[newIndex]);
    state.activeRouteIndex = newIndex;

    // Update summary & steps
    renderRouteSummary(data.routes[newIndex]);
    renderRouteSteps(data.routes[newIndex]);
}

// ─── Render route summary ───
function renderRouteSummary(route) {
    const summary = document.getElementById('nav-route-summary');
    const timeEl = document.getElementById('nav-route-time');
    const distEl = document.getElementById('nav-route-dist');
    const viaEl = document.getElementById('nav-route-via');

    if (!summary) return;

    let seconds = route.duration;
    // Apply correction for foot profile
    if (state.routingProfile === 'foot') seconds *= 1.2;

    if (timeEl) timeEl.innerText = formatDuration(seconds);
    if (distEl) distEl.innerText = formatDistance(route.distance);

    // Try to extract "via" road name from the longest step
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

        // Click step to pan map to that maneuver point
        stepEl.addEventListener('click', () => {
            const loc = step.maneuver.location;
            if (loc) {
                state.map.flyTo([loc[1], loc[0]], Math.max(state.map.getZoom(), 16), { duration: 0.5 });
            }
        });

        stepsList.appendChild(stepEl);
    });
}
