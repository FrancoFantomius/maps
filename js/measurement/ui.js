// maps Measurement UI - js/measurement/ui.js

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

    const btnExitMeasure = document.getElementById('btn-exit-measure');
    if (btnExitMeasure) {
        btnExitMeasure.addEventListener('click', () => {
            MeasurementController.exit();
        });
    }
}

