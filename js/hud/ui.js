// maps HUD UI & Sidebar Sheet Handlers - js/hud/ui.js

export function setupHUDUI(HUDController, SearchController, MarkerController) {
    // Toggle Saved Places (My Places) list
    const btnTogglePlaces = document.getElementById('btn-toggle-places');
    if (btnTogglePlaces) {
        btnTogglePlaces.addEventListener('click', (e) => {
            e.stopPropagation();
            if (HUDController.currentState === 'saved-places') {
                HUDController.setState('places');
            } else {
                HUDController.setState('saved-places');
            }
        });
    }


    const savedPlacesSheet = document.getElementById('saved-places-sheet');
    if (savedPlacesSheet && !savedPlacesSheet._bound) {
        savedPlacesSheet._bound = true;
        savedPlacesSheet.addEventListener('close', (e) => {
            if (e.target && e.target !== savedPlacesSheet) return;
            if (HUDController && HUDController.currentState === 'saved-places') {
                HUDController.setState('places');
            }
        });
        savedPlacesSheet.addEventListener('close-click', (e) => {
            if (e.target && e.target !== savedPlacesSheet) return;
            if (HUDController && HUDController.currentState === 'saved-places') {
                HUDController.setState('places');
            }
        });
    }

    const measureSheet = document.getElementById('measure-sheet');
    if (measureSheet && !measureSheet._bound) {
        measureSheet._bound = true;
        measureSheet.addEventListener('close', (e) => {
            if (e.target && e.target !== measureSheet) return;
            if (HUDController && HUDController.currentState === 'measure') {
                HUDController.setState('places');
            }
        });
        measureSheet.addEventListener('close-click', (e) => {
            if (e.target && e.target !== measureSheet) return;
            if (HUDController && HUDController.currentState === 'measure') {
                HUDController.setState('places');
            }
        });
    }

    const navSheet = document.getElementById('nav-sheet');
    if (navSheet && !navSheet._bound) {
        navSheet._bound = true;
        navSheet.addEventListener('close', (e) => {
            if (e.target && e.target !== navSheet) return;
            if (HUDController && HUDController.currentState === 'route') {
                HUDController.setState('places');
            }
        });
        navSheet.addEventListener('close-click', (e) => {
            if (e.target && e.target !== navSheet) return;
            if (HUDController && HUDController.currentState === 'route') {
                HUDController.setState('places');
            }
        });
    }
}
