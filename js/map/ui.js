// maps Map Controls & Layer Switcher UI - js/map/ui.js

export function setupMapControlsUI(MapService) {
    // Layer Switcher - Toggle button
    const layerToggleBtn = document.getElementById('layer-toggle-btn');
    if (layerToggleBtn) {
        layerToggleBtn.addEventListener('click', () => {
            const nextLayer = MapService.activeLayerKey === 'street' ? 'satellite' : 'street';
            MapService.setBaseLayer(nextLayer);
        });
    }

    // Zoom Controls (M3 Button Group)
    const btnZoomIn = document.getElementById('btn-zoom-in');
    if (btnZoomIn) {
        btnZoomIn.addEventListener('click', () => {
            MapService.zoomIn();
        });
    }

    const btnZoomOut = document.getElementById('btn-zoom-out');
    if (btnZoomOut) {
        btnZoomOut.addEventListener('click', () => {
            MapService.zoomOut();
        });
    }

    // Perspective / Tilt FAB Button (cycle tilt between 60°, 30°, 0°)
    const btnPerspective = document.getElementById('btn-perspective');
    if (btnPerspective) {
        btnPerspective.addEventListener('click', () => {
            MapService.cycleTilt();
        });
    }

    // Map Rotation Controls
    const btnCompass = document.getElementById('btn-compass');
    const btnRotateCcw = document.getElementById('btn-rotate-ccw');
    const btnRotateCw = document.getElementById('btn-rotate-cw');
    const btnRotateLeft = document.getElementById('btn-rotate-left');
    const btnRotateRight = document.getElementById('btn-rotate-right');
    const bearingSlider = document.getElementById('bearing-slider');
    const pitchSlider = document.getElementById('pitch-slider');

    if (btnCompass) {
        btnCompass.addEventListener('click', () => {
            MapService.easeTo(0, 0, 400);
        });
    }

    if (btnRotateCcw) {
        btnRotateCcw.addEventListener('click', () => {
            const current = MapService.getBearing();
            const target = (Math.round(current / 90) * 90 - 90);
            MapService.easeTo(target, undefined, 300);
        });
    }

    if (btnRotateCw) {
        btnRotateCw.addEventListener('click', () => {
            const current = MapService.getBearing();
            const target = (Math.round(current / 90) * 90 + 90);
            MapService.easeTo(target, undefined, 300);
        });
    }

    if (btnRotateLeft) {
        btnRotateLeft.addEventListener('click', () => {
            const current = MapService.getBearing();
            MapService.easeTo(current - 15, undefined, 200);
        });
    }

    if (btnRotateRight) {
        btnRotateRight.addEventListener('click', () => {
            const current = MapService.getBearing();
            MapService.easeTo(current + 15, undefined, 200);
        });
    }

    if (bearingSlider) {
        bearingSlider.addEventListener('input', (e) => {
            MapService.setBearing(parseFloat(e.target.value));
        });
    }

    if (pitchSlider) {
        pitchSlider.addEventListener('input', (e) => {
            MapService.setPitch(parseFloat(e.target.value));
        });
    }
}

