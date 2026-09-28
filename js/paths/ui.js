// maps Saved Paths UI Handlers - js/paths/ui.js

import { setupPathModalUI } from './path-modal.js';

export function setupPathsUI(PathsController) {
    const btnImportGpx = document.getElementById('btn-import-gpx');
    const gpxFileInput = document.getElementById('gpx-file-input');

    if (btnImportGpx && gpxFileInput) {
        btnImportGpx.addEventListener('click', (e) => {
            e.stopPropagation();
            gpxFileInput.click();
        });

        gpxFileInput.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                const file = files[0];
                await PathsController.importGPXFile(file);
                gpxFileInput.value = '';
            }
        });
    }

    setupPathModalUI(PathsController);
}
