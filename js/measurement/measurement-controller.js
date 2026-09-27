// maps Measurement Controller - js/measurement/measurement-controller.js

import { MapService } from '../map/index.js';
import { HUDController } from '../hud/index.js';
import { RoutingController } from '../routing/index.js';
import { ApiService } from '../api/index.js';
import { getDistance, formatDistance, calculatePolylineDistances } from './measurement.js';
import { calculateArea, formatArea } from './area.js';
import { formatDuration, calculateTravelTimes } from './time.js';
import { exportGPX } from './gpx.js';

export const MeasurementController = {
    isMeasureMode: false,
    mode: 'distance', // 'distance' | 'path' | 'area'
    measurePoints: [],
    nextPointNumber: 1,
    measureMarkers: new Map(), // Map<pointNumber, markerInstance>
    routedGeometry: null,
    segmentDistances: [],
    totalDist: 0,
    totalArea: 0,
    routedDuration: 0,
    isCalculatingRoute: false,
    activeRoutingRequestId: 0,

    getDistance,
    calculateArea,
    formatDuration,
    formatDistance,
    formatArea,

    setMode(mode) {
        if (this.mode === mode) return;
        this.mode = mode;
        this.updateModeButtonsUI();
        if (this.mode === 'distance' || this.mode === 'area') {
            this.routedGeometry = null;
            this.updateLine();
            this.updateDistance();
        } else {
            this.updateLine();
            this.updateDistance();
        }
    },

    updateModeButtonsUI() {
        const btnDist = document.getElementById('measure-mode-distance');
        const btnPath = document.getElementById('measure-mode-path');
        const btnArea = document.getElementById('measure-mode-area');

        if (btnDist) btnDist.setAttribute('variant', this.mode === 'distance' ? 'filled' : 'outlined');
        if (btnPath) btnPath.setAttribute('variant', this.mode === 'path' ? 'filled' : 'outlined');
        if (btnArea) btnArea.setAttribute('variant', this.mode === 'area' ? 'filled' : 'outlined');
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
        this.updateModeButtonsUI();
        this.renderBreakdown();
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
        if (MapService && typeof MapService.setMeasureFillVisibility === 'function') {
            MapService.setMeasureFillVisibility(false);
        }
        this.clearPoints();
    },

    clearPoints() {
        this.measurePoints = [];
        this.nextPointNumber = 1;
        this.routedGeometry = null;
        this.segmentDistances = [];
        this.totalDist = 0;
        this.totalArea = 0;
        this.routedDuration = 0;
        this.measureMarkers.forEach(m => {
            if (m && typeof m.remove === 'function') m.remove();
        });
        this.measureMarkers.clear();
        if (MapService && typeof MapService.setMeasureFillVisibility === 'function') {
            MapService.setMeasureFillVisibility(false);
        }
        this.updateLine();
        this.renderBreakdown();
    },

    createMarkerForPoint(latlng, pointNumber) {
        if (this.measureMarkers.has(pointNumber)) {
            return this.measureMarkers.get(pointNumber);
        }

        const el = document.createElement('div');
        el.className = 'measure-node-marker';
        el.style.width = '22px';
        el.style.height = '22px';
        el.style.borderRadius = '50%';
        el.style.border = '2.5px solid #ffffff';
        el.style.backgroundColor = '#14b8a6';
        el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.35)';
        el.style.cursor = 'pointer';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.color = '#ffffff';
        el.style.fontSize = '11px';
        el.style.fontWeight = 'bold';
        el.style.userSelect = 'none';
        el.textContent = `${pointNumber}`;
        el.title = `Point ${pointNumber} (click to add again to path)`;

        const nodeMarker = MapService.createMarker(el, true)
            .setLngLat([latlng.lng, latlng.lat])
            .addTo(MapService.map);

        let isDragging = false;
        nodeMarker.on('dragstart', () => {
            isDragging = true;
        });
        nodeMarker.on('dragend', () => {
            setTimeout(() => { isDragging = false; }, 50);
            const lngLat = nodeMarker.getLngLat();
            this.measurePoints.forEach(p => {
                if (p.pointNumber === pointNumber) {
                    p.lat = lngLat.lat;
                    p.lng = lngLat.lng;
                }
            });
            this.updateLine();
            this.updateDistance();
        });

        nodeMarker.on('drag', () => {
            const lngLat = nodeMarker.getLngLat();
            this.measurePoints.forEach(p => {
                if (p.pointNumber === pointNumber) {
                    p.lat = lngLat.lat;
                    p.lng = lngLat.lng;
                }
            });
            this.updateLine();
            this.updateDistance();
        });

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isDragging) {
                const lngLat = nodeMarker.getLngLat();
                this.addExistingPoint({ lat: lngLat.lat, lng: lngLat.lng, pointNumber });
            }
        });

        this.measureMarkers.set(pointNumber, nodeMarker);
        return nodeMarker;
    },

    rebuildMarkers() {
        const activePointNumbers = new Set(this.measurePoints.map(p => p.pointNumber));

        // Remove markers that are no longer in active points
        for (const [pNum, marker] of this.measureMarkers.entries()) {
            if (!activePointNumbers.has(pNum)) {
                if (marker && typeof marker.remove === 'function') marker.remove();
                this.measureMarkers.delete(pNum);
            }
        }

        // Ensure markers exist for all active point numbers
        this.measurePoints.forEach(pt => {
            if (!this.measureMarkers.has(pt.pointNumber)) {
                this.createMarkerForPoint(pt, pt.pointNumber);
            }
        });
    },

    removePoint(index) {
        if (index < 0 || index >= this.measurePoints.length) return;
        this.measurePoints.splice(index, 1);
        this.rebuildMarkers();
        this.updateLine();
        this.updateDistance();
    },

    handleClick(latlng) {
        const pointNumber = latlng.pointNumber || this.nextPointNumber++;
        const newPoint = { lat: latlng.lat, lng: latlng.lng, pointNumber };
        this.measurePoints.push(newPoint);
        this.createMarkerForPoint(newPoint, pointNumber);
        this.updateLine();
        this.updateDistance();
    },

    addExistingPoint(pt) {
        if (!pt) return;
        const newPoint = { lat: pt.lat, lng: pt.lng, pointNumber: pt.pointNumber };
        this.measurePoints.push(newPoint);
        this.updateLine();
        this.updateDistance();
    },

    updateLine() {
        const isAreaFillVisible = this.isMeasureMode && this.mode === 'area' && this.measurePoints.length >= 3;
        if (MapService && typeof MapService.setMeasureFillVisibility === 'function') {
            MapService.setMeasureFillVisibility(isAreaFillVisible);
        }

        if (this.mode === 'area') {
            if (this.measurePoints.length >= 3) {
                const closedCoords = this.measurePoints.map(p => [p.lng, p.lat]);
                closedCoords.push([this.measurePoints[0].lng, this.measurePoints[0].lat]);
                MapService.updateSourceData('measure-source', {
                    type: 'Feature',
                    geometry: {
                        type: 'Polygon',
                        coordinates: [closedCoords]
                    }
                });
            } else {
                MapService.updateSourceData('measure-source', {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: this.measurePoints.map(p => [p.lng, p.lat])
                    }
                });
            }
        } else if (this.mode === 'path' && this.routedGeometry) {
            MapService.updateSourceData('measure-source', {
                type: 'Feature',
                geometry: this.routedGeometry
            });
        } else {
            MapService.updateSourceData('measure-source', {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: this.measurePoints.map(p => [p.lng, p.lat])
                }
            });
        }
    },

    async updateDistance() {
        const requestId = ++this.activeRoutingRequestId;

        if (this.measurePoints.length < 2) {
            this.totalDist = 0;
            this.totalArea = 0;
            this.segmentDistances = [];
            this.routedGeometry = null;
            this.routedDuration = 0;
            this.updateLine();
            this.renderBreakdown();
            return;
        }

        if (this.mode === 'area') {
            this.routedGeometry = null;
            this.routedDuration = 0;
            this.totalArea = calculateArea(this.measurePoints);
            const { segmentDistances, totalDistance } = calculatePolylineDistances(this.measurePoints, true);
            this.segmentDistances = segmentDistances;
            this.totalDist = totalDistance;
            this.updateLine();
            this.renderBreakdown();
        } else if (this.mode === 'distance') {
            this.routedGeometry = null;
            this.routedDuration = 0;
            this.totalArea = 0;
            const { segmentDistances, totalDistance } = calculatePolylineDistances(this.measurePoints, false);
            this.segmentDistances = segmentDistances;
            this.totalDist = totalDistance;
            this.updateLine();
            this.renderBreakdown();
        } else {
            // Path mode
            this.isCalculatingRoute = true;
            this.totalArea = 0;
            this.renderBreakdown(true);

            try {
                const data = await ApiService.calculateMultiPointRoute(this.measurePoints, 'driving');
                if (requestId !== this.activeRoutingRequestId) return;
                this.isCalculatingRoute = false;

                if (data && data.routes && data.routes.length > 0) {
                    const route = data.routes[0];
                    this.routedGeometry = route.geometry;
                    this.totalDist = route.distance || 0;
                    this.routedDuration = route.duration || 0;
                    this.segmentDistances = (route.legs && route.legs.length > 0)
                        ? route.legs.map(leg => leg.distance)
                        : [];
                    this.updateLine();
                    this.renderBreakdown();
                } else {
                    throw new Error("No route found");
                }
            } catch (err) {
                if (requestId !== this.activeRoutingRequestId) return;
                this.isCalculatingRoute = false;
                this.routedGeometry = null;
                this.routedDuration = 0;
                const { segmentDistances, totalDistance } = calculatePolylineDistances(this.measurePoints, false);
                this.segmentDistances = segmentDistances;
                this.totalDist = totalDistance;
                this.updateLine();
                this.renderBreakdown();
            }
        }
    },

    renderBreakdown(isLoading = false) {
        const summaryLabelEl = document.querySelector('.measure-summary-label');
        const totalValueEl = document.getElementById('measure-total-value');
        const estimatesEl = document.getElementById('measure-estimates');
        const walkEl = document.getElementById('measure-time-walk');
        const bikeEl = document.getElementById('measure-time-bike');
        const carEl = document.getElementById('measure-time-car');
        const measureOutput = document.getElementById('measure-output');
        const pointsListEl = document.getElementById('measure-points-list');
        const saveGpxBtn = document.getElementById('btn-save-gpx');
        const clearBtn = document.getElementById('btn-clear-measure');

        const totalDist = this.totalDist || 0;
        const totalArea = this.totalArea || 0;

        if (summaryLabelEl) {
            summaryLabelEl.textContent = this.mode === 'area' ? 'Total Area' : 'Total Distance';
        }

        if (totalValueEl) {
            if (isLoading) {
                totalValueEl.innerHTML = `<span class="animate-pulse text-slate-400">Calculating...</span>`;
            } else if (this.mode === 'area') {
                totalValueEl.textContent = formatArea(totalArea);
            } else {
                totalValueEl.textContent = formatDistance(totalDist);
            }
        }

        let walkStr = '—';
        let bikeStr = '—';
        let carStr = '—';

        if (totalDist > 0 && !isLoading) {
            const times = calculateTravelTimes(totalDist, this.routedDuration, this.mode === 'path');
            walkStr = times.walkStr;
            bikeStr = times.bikeStr;
            carStr = times.carStr;
        }

        if (walkEl) walkEl.textContent = walkStr;
        if (bikeEl) bikeEl.textContent = bikeStr;
        if (carEl) carEl.textContent = carStr;

        if (estimatesEl && (!walkEl || !bikeEl || !carEl)) {
            if (totalDist > 0 && !isLoading) {
                estimatesEl.innerHTML = `
                    <span class="measure-time-item"><span class="measure-time-mode">Walk:</span> <span>${walkStr}</span></span>
                    <span class="measure-time-separator">·</span>
                    <span class="measure-time-item"><span class="measure-time-mode">Bike:</span> <span>${bikeStr}</span></span>
                    <span class="measure-time-separator">·</span>
                    <span class="measure-time-item"><span class="measure-time-mode">Car:</span> <span>${carStr}</span></span>
                `;
            } else {
                estimatesEl.innerHTML = `
                    <span class="measure-time-item"><span class="measure-time-mode">Walk:</span> <span>—</span></span>
                    <span class="measure-time-separator">·</span>
                    <span class="measure-time-item"><span class="measure-time-mode">Bike:</span> <span>—</span></span>
                    <span class="measure-time-separator">·</span>
                    <span class="measure-time-item"><span class="measure-time-mode">Car:</span> <span>—</span></span>
                `;
            }
        }

        if (measureOutput) {
            const formattedDist = formatDistance(totalDist);
            if (this.mode === 'area') {
                measureOutput.innerText = `Total Area: ${formatArea(totalArea)} (Perimeter: ${formattedDist})`;
            } else if (totalDist > 0) {
                measureOutput.innerText = `Total Distance: ${formattedDist} (Walk: ${walkStr} • Bike: ${bikeStr} • Car: ${carStr})`;
            } else {
                measureOutput.innerText = `Total Distance: ${formatDistance(0)}`;
            }
        }

        if (saveGpxBtn) {
            const minPoints = this.mode === 'area' ? 3 : 2;
            if (this.measurePoints.length >= minPoints) {
                saveGpxBtn.removeAttribute('disabled');
                saveGpxBtn.disabled = false;
            } else {
                saveGpxBtn.setAttribute('disabled', '');
                saveGpxBtn.disabled = true;
            }
        }

        if (clearBtn) {
            if (this.measurePoints.length > 0) {
                clearBtn.classList.remove('hidden');
            } else {
                clearBtn.classList.add('hidden');
            }
        }

        if (pointsListEl) {
            if (this.measurePoints.length === 0) {
                pointsListEl.innerHTML = `
                    <div class="measure-empty-state">
                        <md-icon name="straighten" class="measure-empty-icon"></md-icon>
                        <p class="measure-empty-text">Click on the map to add measurement points</p>
                    </div>
                `;
            } else {
                let html = '';
                const n = this.measurePoints.length;
                this.measurePoints.forEach((pt, i) => {
                    const latStr = pt.lat.toFixed(4);
                    const lngStr = pt.lng.toFixed(4);
                    const pNum = pt.pointNumber !== undefined ? pt.pointNumber : (i + 1);

                    if (i > 0) {
                        const segDist = this.segmentDistances[i - 1] !== undefined
                            ? formatDistance(this.segmentDistances[i - 1])
                            : formatDistance(getDistance(this.measurePoints[i - 1], pt));
                        const iconName = this.mode === 'path' ? 'conversion_path' : (this.mode === 'area' ? 'square_foot' : 'straighten');

                        html += `
                            <div class="measure-segment-item">
                                <div class="measure-segment-line"></div>
                                <div class="measure-segment-info">
                                    <md-icon name="${iconName}" class="measure-segment-icon"></md-icon>
                                    <span class="measure-segment-distance">${segDist}</span>
                                </div>
                            </div>
                        `;
                    }

                    html += `
                        <div class="measure-point-item" data-point-index="${i}" title="Click to add Point ${pNum} again to path">
                            <span class="measure-point-badge">${pNum}</span>
                            <span class="measure-point-coords">${latStr}°, ${lngStr}°</span>
                            <md-icon-button class="measure-point-delete" icon="close" data-index="${i}" aria-label="Remove point ${pNum}"></md-icon-button>
                        </div>
                    `;
                });

                // In area mode, show closing segment from last point back to point 1
                if (this.mode === 'area' && n >= 3 && this.segmentDistances.length === n) {
                    const closingDist = formatDistance(this.segmentDistances[n - 1]);
                    const firstPNum = this.measurePoints[0].pointNumber || 1;

                    html += `
                        <div class="measure-segment-item">
                            <div class="measure-segment-line"></div>
                            <div class="measure-segment-info">
                                <md-icon name="square_foot" class="measure-segment-icon"></md-icon>
                                <span class="measure-segment-distance">${closingDist} (closing to Point ${firstPNum})</span>
                            </div>
                        </div>
                    `;
                }

                pointsListEl.innerHTML = html;
            }
        }
    },

    exportGPX() {
        return exportGPX(this.measurePoints, this.mode, this.routedGeometry);
    }
};

export default MeasurementController;
