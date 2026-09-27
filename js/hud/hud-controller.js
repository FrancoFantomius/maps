import { MapService } from '../map/index.js';
import { MarkerController } from '../markers/index.js';
import { SearchController } from '../search/index.js';

function showSheet(sheet) {
    if (!sheet) return;
    if (typeof sheet.show === 'function') {
        sheet.show();
    } else {
        sheet.open = true;
    }
}

function hideSheet(sheet) {
    if (!sheet) return;
    if (typeof sheet.close === 'function') {
        sheet.close();
    } else {
        sheet.open = false;
    }
}

export const HUDController = {
    currentState: 'places',
    previousState: 'places',
    isOpen: false,
    isExpanded: false,

    open(expand = false) {
        this.isOpen = true;
        this.isExpanded = expand;
        const panel = document.getElementById('hud-panel');
        if (panel) {
            panel.classList.remove('hud-closed');
        }
    },

    close() {
        this.isOpen = false;
        this.isExpanded = false;
        const panel = document.getElementById('hud-panel');
        if (panel) {
            panel.classList.add('hud-closed');
        }
        const sheets = ['saved-places-sheet', 'place-details-sheet', 'measure-sheet', 'nav-sheet'];
        sheets.forEach(id => hideSheet(document.getElementById(id)));
    },

    expand() {
        this.open(true);
    },

    collapse() {
        this.open(false);
    },

    setState(hudState, data = null) {
        if (this.currentState !== hudState) {
            this.previousState = this.currentState;
        }
        this.currentState = hudState;
        this.updateMenuIcon(hudState);

        if (hudState !== 'place-details') {
            MarkerController.removeTempMarker();
            this.clearHighlightedPath();
        }

        if (hudState !== 'place-details' && hudState !== 'search-results') {
            if (SearchController && typeof SearchController.clearSearchMarkers === 'function') {
                SearchController.clearSearchMarkers();
            }
        }

        const drawBtn = document.getElementById('btn-draw');
        const routeBtn = document.getElementById('btn-route');

        if (drawBtn) drawBtn.classList.remove('is-active');
        if (routeBtn) routeBtn.classList.remove('is-active');

        const savedPlacesSheet = document.getElementById('saved-places-sheet');
        const placeDetailsSheet = document.getElementById('place-details-sheet');
        const measureSheet = document.getElementById('measure-sheet');
        const navSheet = document.getElementById('nav-sheet');

        // Close all sheets first before opening the requested state
        hideSheet(savedPlacesSheet);
        hideSheet(placeDetailsSheet);
        hideSheet(measureSheet);
        hideSheet(navSheet);

        // Also support legacy panel-search, measure-panel, nav-panel in tests if present
        const panels = ['panel-places', 'panel-search', 'measure-panel', 'nav-panel'];
        panels.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        if (hudState === 'saved-places') {
            this.isOpen = true;
            if (SearchController && typeof SearchController.closePlaceDetails === 'function') {
                SearchController.closePlaceDetails();
            }
            showSheet(savedPlacesSheet);
        } else if (hudState === 'place-details') {
            this.isOpen = true;
            this.renderPlaceDetails(data);
        } else if (hudState === 'measure') {
            this.isOpen = true;
            if (SearchController && typeof SearchController.closePlaceDetails === 'function') {
                SearchController.closePlaceDetails();
            }
            showSheet(measureSheet);
            const measurePanel = document.getElementById('measure-panel');
            if (measurePanel) measurePanel.classList.remove('hidden');
            if (drawBtn) drawBtn.classList.add('is-active');
        } else if (hudState === 'route') {
            this.isOpen = true;
            if (SearchController && typeof SearchController.closePlaceDetails === 'function') {
                SearchController.closePlaceDetails();
            }
            showSheet(navSheet);
            const navPanel = document.getElementById('nav-panel');
            if (navPanel) navPanel.classList.remove('hidden');
            if (routeBtn) routeBtn.classList.add('is-active');
        } else if (hudState === 'search-results') {
            this.isOpen = true;
            const searchPanel = document.getElementById('panel-search');
            if (searchPanel) searchPanel.classList.remove('hidden');
        } else {
            // places state
            this.isOpen = false;
            if (SearchController && typeof SearchController.closePlaceDetails === 'function') {
                SearchController.closePlaceDetails();
            }
        }
    },

    updateMenuIcon(hudState) {
        const btnSearchMenu = document.getElementById('btn-search-menu');
        const tooltipSpan = document.querySelector('#search-menu-tooltip span') || document.querySelector('md-tooltip[for="btn-search-menu"] span');
        const isSidebarOpen = (hudState === 'saved-places' || hudState === 'place-details' || hudState === 'measure' || hudState === 'route');

        if (btnSearchMenu) {
            if (isSidebarOpen) {
                btnSearchMenu.setAttribute('icon', 'arrow_back');
                btnSearchMenu.icon = 'arrow_back';
                btnSearchMenu.setAttribute('aria-label', 'Back');
                btnSearchMenu.title = 'Back';
                if (tooltipSpan) tooltipSpan.textContent = 'Back';
            } else {
                btnSearchMenu.setAttribute('icon', 'menu');
                btnSearchMenu.icon = 'menu';
                btnSearchMenu.setAttribute('aria-label', 'Saved Places');
                btnSearchMenu.title = 'Saved Places';
                if (tooltipSpan) tooltipSpan.textContent = 'Saved Places';
            }
        }
    },

    clearHighlightedPath() {
        if (MapService.highlightedPathCoords) {
            MapService.highlightedPathCoords = null;
            MapService.updateSourceData('highlight-path-source', {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: []
                }
            });
        }
    },

    renderPlaceDetails(data) {
        if (!data) return;

        if (SearchController && typeof SearchController.openPlaceDetails === 'function') {
            SearchController.openPlaceDetails(data);
        }
    }
};

export default HUDController;

