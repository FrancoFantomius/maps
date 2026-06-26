// maps Measurement Controller - js/MeasurementController.js

import { MapService } from './MapService.js';
import { HUDController } from './HUDController.js';
import { RoutingController } from './RoutingController.js';

export const MeasurementController = {
    isMeasureMode: false,
    measurePoints: [],
    measureMarkers: [],

    getDistance(pt1, pt2) {
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
    },

    enter() {
        RoutingController.exit();
        this.exit();
        this.isMeasureMode = true;
        const container = MapService.getContainer();
        if (container) {
            container.style.cursor = 'crosshair';
        }
        HUDController.setState('measure');
    },

    exit() {
        this.isMeasureMode = false;
        const container = MapService.getContainer();
        if (container) {
            container.style.cursor = '';
        }
        if (HUDController.currentState === 'measure') {
            HUDController.setState('places');
        }
        this.measurePoints = [];
        this.updateLine();

        this.measureMarkers.forEach(m => m.remove());
        this.measureMarkers = [];
        
        const measureOutput = document.getElementById('measure-output');
        if (measureOutput) {
            measureOutput.innerText = 'Total Distance: 0.00 km';
        }
    },

    updateDistance() {
        const measureOutput = document.getElementById('measure-output');
        let totalDist = 0;
        for (let i = 1; i < this.measurePoints.length; i++) {
            totalDist += this.getDistance(this.measurePoints[i - 1], this.measurePoints[i]);
        }
        if (measureOutput) {
            measureOutput.innerText = `Total Distance: ${(totalDist / 1000).toFixed(2)} km`;
        }
    },

    updateLine() {
        MapService.updateSourceData('measure-source', {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: this.measurePoints.map(p => [p.lng, p.lat])
            }
        });
    },

    handleClick(latlng) {
        this.measurePoints.push(latlng);
        
        const el = document.createElement('div');
        el.className = 'measure-node-marker';
        el.style.width = '12px';
        el.style.height = '12px';
        el.style.borderRadius = '50%';
        el.style.border = '2.5px solid #14b8a6';
        el.style.backgroundColor = '#ffffff';
        el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
        el.style.cursor = 'pointer';

        const nodeMarker = MapService.createMarker(el, true)
            .setLngLat([latlng.lng, latlng.lat])
            .addTo(MapService.map);

        el.addEventListener('click', (e) => e.stopPropagation());
        el.addEventListener('mousedown', (e) => e.stopPropagation());

        nodeMarker.on('drag', () => {
            const lngLat = nodeMarker.getLngLat();
            const index = this.measureMarkers.indexOf(nodeMarker);
            if (index > -1) {
                this.measurePoints[index] = { lat: lngLat.lat, lng: lngLat.lng };
                this.updateLine();
                this.updateDistance();
            }
        });

        this.measureMarkers.push(nodeMarker);
        this.updateLine();
        this.updateDistance();
    }
};
