// maps Measure Module

import { state } from './state.js';
import { setHUDState } from './hud.js';
import { exitRoutingMode } from './routing.js';

export function getDistance(pt1, pt2) {
    const R = 6371000; // Earth radius in meters
    const phi1 = pt1.lat * Math.PI / 180;
    const phi2 = pt2.lat * Math.PI / 180;
    const deltaPhi = (pt2.lat - pt1.lat) * Math.PI / 180;
    const deltaLambda = (pt2.lng - pt1.lng) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
}

export function enterMeasureMode() {
    exitRoutingMode();
    exitMeasureMode();
    state.isMeasureMode = true;
    if (state.map) {
        state.map.getContainer().style.cursor = 'crosshair';
    }
    setHUDState('measure');
}

export function exitMeasureMode() {
    state.isMeasureMode = false;
    if (state.map) {
        state.map.getContainer().style.cursor = '';
    }
    if (state.currentHUDState === 'measure') {
        setHUDState('places');
    }
    state.measurePoints = [];
    updateMeasureLine();

    state.measureMarkers.forEach(m => m.remove());
    state.measureMarkers = [];
    
    const measureOutput = document.getElementById('measure-output');
    if (measureOutput) {
        measureOutput.innerText = 'Total Distance: 0.00 km';
    }
}

export function updateMeasureDistance() {
    const measureOutput = document.getElementById('measure-output');
    let totalDist = 0;
    for (let i = 1; i < state.measurePoints.length; i++) {
        totalDist += getDistance(state.measurePoints[i - 1], state.measurePoints[i]);
    }
    if (measureOutput) {
        measureOutput.innerText = `Total Distance: ${(totalDist / 1000).toFixed(2)} km`;
    }
}

function updateMeasureLine() {
    if (!state.map) return;
    const source = state.map.getSource('measure-source');
    if (source) {
        source.setData({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: state.measurePoints.map(p => [p.lng, p.lat])
            }
        });
    }
}

export function handleMeasureClick(latlng) {
    state.measurePoints.push(latlng);
    
    const el = document.createElement('div');
    el.className = 'measure-node-marker';
    el.style.width = '12px';
    el.style.height = '12px';
    el.style.borderRadius = '50%';
    el.style.border = '2.5px solid #14b8a6';
    el.style.backgroundColor = '#ffffff';
    el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
    el.style.cursor = 'pointer';

    const nodeMarker = new maplibregl.Marker({
        element: el,
        draggable: true
    })
    .setLngLat([latlng.lng, latlng.lat])
    .addTo(state.map);

    el.addEventListener('click', (e) => e.stopPropagation());
    el.addEventListener('mousedown', (e) => e.stopPropagation());

    nodeMarker.on('drag', () => {
        const lngLat = nodeMarker.getLngLat();
        const index = state.measureMarkers.indexOf(nodeMarker);
        if (index > -1) {
            state.measurePoints[index] = { lat: lngLat.lat, lng: lngLat.lng };
            updateMeasureLine();
            updateMeasureDistance();
        }
    });

    state.measureMarkers.push(nodeMarker);
    updateMeasureLine();
    updateMeasureDistance();
}
