// maps Measure Module

import { state } from './state.js';

import { setHUDState } from './hud.js';
import { exitRoutingMode } from './routing.js';

export function enterMeasureMode() {
    exitRoutingMode();
    exitMeasureMode();
    state.isMeasureMode = true;
    state.map.getContainer().style.cursor = 'crosshair';
    setHUDState('measure');

}

export function exitMeasureMode() {
    state.isMeasureMode = false;
    state.map.getContainer().style.cursor = '';
    if (state.currentHUDState === 'measure') {
        setHUDState('places');
    }
    if (state.measureLine) state.map.removeLayer(state.measureLine);
    state.measureLine = null;
    state.measurePoints = [];
    state.measureMarkers.forEach(m => state.map.removeLayer(m));
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
        totalDist += state.measurePoints[i - 1].distanceTo(state.measurePoints[i]);
    }
    if (measureOutput) {
        measureOutput.innerText = `Total Distance: ${(totalDist / 1000).toFixed(2)} km`;
    }
}

export function handleMeasureClick(latlng) {
    state.measurePoints.push(latlng);
    
    const nodeMarker = L.marker(latlng, {
        draggable: true,
        icon: L.divIcon({
            className: 'measure-node-marker',
            html: '<div style="width: 12px; height: 12px; border-radius: 50%; border: 2.5px solid #14b8a6; background-color: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>',
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        })
    }).addTo(state.map);

    nodeMarker.on('click', (e) => {
        if (e.originalEvent) {
            L.DomEvent.stopPropagation(e.originalEvent);
        }
    });

    nodeMarker.on('mousedown', (e) => {
        if (e.originalEvent) {
            L.DomEvent.stopPropagation(e.originalEvent);
        }
    });

    nodeMarker.on('drag', (e) => {
        const newLatLng = e.target.getLatLng();
        const index = state.measureMarkers.indexOf(e.target);
        if (index > -1) {
            state.measurePoints[index] = newLatLng;
            state.measureLine.setLatLngs(state.measurePoints);
            updateMeasureDistance();
        }
    });

    state.measureMarkers.push(nodeMarker);

    if (!state.measureLine) {
        state.measureLine = L.polyline(state.measurePoints, { color: '#14b8a6', weight: 4, dashArray: '5, 8' }).addTo(state.map);
    } else {
        state.measureLine.setLatLngs(state.measurePoints);
    }
    
    updateMeasureDistance();
}
