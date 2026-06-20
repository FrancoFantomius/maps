// maps Routing Module

import { state } from './state.js';
import { showToast } from './toast.js';
import { setHUDState } from './hud.js';

export function enterRoutingMode() {
    import('./measure.js').then(m => m.exitMeasureMode());
    exitRoutingMode();
    state.isRouteMode = true;
    setHUDState('route');
    showToast("Routing Mode Active. Click to drop Start and End positions.", "info");
}

export function exitRoutingMode() {
    state.isRouteMode = false;
    if (state.currentHUDState === 'route') {
        setHUDState('places');
    }
    if (state.routeStartMarker) state.map.removeLayer(state.routeStartMarker);
    if (state.routeEndMarker) state.map.removeLayer(state.routeEndMarker);
    if (state.routeLineInstance) state.map.removeLayer(state.routeLineInstance);
    state.routeStart = null;
    state.routeEnd = null;
    state.routeStartMarker = null;
    state.routeEndMarker = null;
    state.routeLineInstance = null;
    
    const startTxt = document.getElementById('route-start-txt');
    const endTxt = document.getElementById('route-end-txt');
    const routeMeta = document.getElementById('route-meta');
    
    if (startTxt) startTxt.innerText = "Click map to set Start";
    if (endTxt) endTxt.innerText = "Click map to set End";
    if (routeMeta) routeMeta.classList.add('hidden');
}

export function setRoutingMode(profile) {
    const prevBtn = document.getElementById(`mode-${state.routingProfile}`);
    if (prevBtn) {
        prevBtn.className = 'py-1.5 text-xs font-semibold rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all';
    }
    state.routingProfile = profile;
    const newBtn = document.getElementById(`mode-${profile}`);
    if (newBtn) {
        newBtn.className = 'py-1.5 text-xs font-bold rounded-lg transition-all bg-amber-600 text-white shadow-sm';
    }
    if (state.routeStart && state.routeEnd) {
        calculateRoute();
    }
}

export async function calculateRoute() {
    let profileSlug = 'driving';
    if (state.routingProfile === 'cycling') profileSlug = 'bike';
    if (state.routingProfile === 'foot') profileSlug = 'foot';

    const url = `https://router.project-osrm.org/route/v1/${profileSlug}/${state.routeStart.lng},${state.routeStart.lat};${state.routeEnd.lng},${state.routeEnd.lat}?geometries=geojson`;

    showToast("Computing optimal vector geometry...", "info");
    try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            showToast("No track found connecting nodes.", "error");
            return;
        }

        if (state.routeLineInstance) state.map.removeLayer(state.routeLineInstance);

        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);

        state.routeLineInstance = L.polyline(coordinates, { color: '#d97706', weight: 5, opacity: 0.85 }).addTo(state.map);
        state.map.fitBounds(state.routeLineInstance.getBounds(), { padding: [40, 40] });

        const routeDist = document.getElementById('route-dist');
        const routeTime = document.getElementById('route-time');
        const routeMeta = document.getElementById('route-meta');

        if (routeDist) routeDist.innerText = `${(route.distance / 1000).toFixed(2)} km`;

        let seconds = route.duration;
        if (profileSlug === 'foot') seconds *= 1.2;
        const minutes = Math.round(seconds / 60);
        
        if (routeTime) {
            routeTime.innerText = minutes > 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} mins`;
        }
        if (routeMeta) routeMeta.classList.remove('hidden');

    } catch (err) {
        showToast("Routing computation engine timed out.", "error");
    }
}

function createRoutingMarker(latlng, color, type) {
    const marker = L.marker(latlng, {
        draggable: true,
        icon: L.divIcon({
            className: `route-${type}-marker`,
            html: `<div style="width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid #ffffff; background-color: ${color}; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        })
    });

    marker.on('click', (e) => {
        if (e.originalEvent) {
            L.DomEvent.stopPropagation(e.originalEvent);
        }
    });

    marker.on('mousedown', (e) => {
        if (e.originalEvent) {
            L.DomEvent.stopPropagation(e.originalEvent);
        }
    });

    marker.on('dragend', (e) => {
        const newLatLng = e.target.getLatLng();
        const startTxt = document.getElementById('route-start-txt');
        const endTxt = document.getElementById('route-end-txt');
        
        if (type === 'start') {
            state.routeStart = newLatLng;
            if (startTxt) startTxt.innerText = `${newLatLng.lat.toFixed(4)}, ${newLatLng.lng.toFixed(4)}`;
        } else {
            state.routeEnd = newLatLng;
            if (endTxt) endTxt.innerText = `${newLatLng.lat.toFixed(4)}, ${newLatLng.lng.toFixed(4)}`;
        }
        
        if (state.routeStart && state.routeEnd) {
            calculateRoute();
        }
    });

    return marker;
}

export function handleRoutingClick(latlng) {
    const startTxt = document.getElementById('route-start-txt');
    const endTxt = document.getElementById('route-end-txt');
    const routeMeta = document.getElementById('route-meta');

    if (!state.routeStart) {
        state.routeStart = latlng;
        if (startTxt) startTxt.innerText = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
        state.routeStartMarker = createRoutingMarker(latlng, '#10b981', 'start').addTo(state.map);
    } else if (!state.routeEnd) {
        state.routeEnd = latlng;
        if (endTxt) endTxt.innerText = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
        state.routeEndMarker = createRoutingMarker(latlng, '#ef4444', 'end').addTo(state.map);
        calculateRoute();
    } else {
        if (state.routeStartMarker) state.map.removeLayer(state.routeStartMarker);
        if (state.routeEndMarker) state.map.removeLayer(state.routeEndMarker);
        if (state.routeLineInstance) state.map.removeLayer(state.routeLineInstance);
        state.routeEnd = null;
        state.routeEndMarker = null;
        state.routeLineInstance = null;
        state.routeStart = latlng;
        if (startTxt) startTxt.innerText = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
        if (endTxt) endTxt.innerText = "Click map to set End";
        state.routeStartMarker = createRoutingMarker(latlng, '#10b981', 'start').addTo(state.map);
        if (routeMeta) routeMeta.classList.add('hidden');
    }
}
