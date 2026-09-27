// maps Measurement UI - js/measurement/ui.js

import { MapService } from '../map/index.js';

export function setupMeasurementUI(MeasurementController) {
    const drawBtn = document.getElementById('btn-draw');
    if (drawBtn) {
        drawBtn.addEventListener('click', () => {
            if (MeasurementController.isMeasureMode) {
                MeasurementController.exit();
            } else {
                MeasurementController.enter();
            }
        });
    }

    const btnDist = document.getElementById('measure-mode-distance');
    if (btnDist) {
        btnDist.addEventListener('click', () => {
            MeasurementController.setMode('distance');
        });
    }

    const btnPath = document.getElementById('measure-mode-path');
    if (btnPath) {
        btnPath.addEventListener('click', () => {
            MeasurementController.setMode('path');
        });
    }

    const btnArea = document.getElementById('measure-mode-area');
    if (btnArea) {
        btnArea.addEventListener('click', () => {
            MeasurementController.setMode('area');
        });
    }

    const btnSaveGpx = document.getElementById('btn-save-gpx');
    if (btnSaveGpx) {
        btnSaveGpx.addEventListener('click', () => {
            MeasurementController.exportGPX();
        });
    }

    const btnClearMeasure = document.getElementById('btn-clear-measure');
    if (btnClearMeasure) {
        btnClearMeasure.addEventListener('click', () => {
            MeasurementController.clearPoints();
        });
    }

    const pointsListEl = document.getElementById('measure-points-list');
    if (pointsListEl) {
        pointsListEl.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.measure-point-delete');
            if (deleteBtn) {
                e.stopPropagation();
                const index = parseInt(deleteBtn.getAttribute('data-index'), 10);
                if (!isNaN(index)) {
                    MeasurementController.removePoint(index);
                }
                return;
            }

            const pointItem = e.target.closest('.measure-point-item');
            if (pointItem) {
                const index = parseInt(pointItem.getAttribute('data-point-index'), 10);
                if (!isNaN(index) && MeasurementController.measurePoints[index]) {
                    const pt = MeasurementController.measurePoints[index];
                    MeasurementController.addExistingPoint(pt);
                    if (MapService && typeof MapService.panTo === 'function') {
                        MapService.panTo([pt.lng, pt.lat]);
                    }
                }
            }
        });
    }

    const btnExitMeasure = document.getElementById('btn-exit-measure');
    if (btnExitMeasure) {
        btnExitMeasure.addEventListener('click', () => {
            MeasurementController.exit();
        });
    }
}
