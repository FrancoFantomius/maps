// maps Routing UI - js/routing/ui.js

export function setupRoutingUI(RoutingController, MapService) {
    const routeBtn = document.getElementById('btn-route');
    if (routeBtn) {
        routeBtn.addEventListener('click', () => {
            if (RoutingController.isRouteMode) {
                RoutingController.exit();
            } else {
                RoutingController.enter();
            }
        });
    }

    const btnExitNav = document.getElementById('btn-exit-nav');
    if (btnExitNav) {
        btnExitNav.addEventListener('click', () => {
            RoutingController.exit();
        });
    }

    // Transport mode buttons
    document.querySelectorAll('.nav-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-nav-mode');
            if (mode) RoutingController.setProfile(mode);
        });
    });

    // Autocomplete for origin & destination inputs
    const originInput = document.getElementById('nav-origin-input');
    const destInput = document.getElementById('nav-dest-input');
    const originDropdown = document.getElementById('nav-origin-autocomplete');
    const destDropdown = document.getElementById('nav-dest-autocomplete');

    if (originInput && originDropdown) RoutingController.setupAutocomplete(originInput, originDropdown, 'origin');
    if (destInput && destDropdown) RoutingController.setupAutocomplete(destInput, destDropdown, 'destination');

    // Swap waypoints button
    const navSwapBtn = document.getElementById('nav-swap-btn');
    if (navSwapBtn) {
        navSwapBtn.addEventListener('click', () => {
            RoutingController.swapWaypoints();
        });
    }

    // Use my location button
    const navUseLocation = document.getElementById('nav-use-location');
    if (navUseLocation) {
        navUseLocation.addEventListener('click', () => {
            RoutingController.useMyLocation();
        });
    }

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-autocomplete') && !e.target.closest('#nav-origin-input') && !e.target.closest('#nav-dest-input')) {
            RoutingController.closeAllAutocomplete();
        }
    });

    // Handle clicks on alternative routing paths
    if (MapService && typeof MapService.on === 'function') {
        MapService.on('click', 'alternative-routes-layer', (e) => {
            if (e.features && e.features.length > 0) {
                const routeIndex = e.features[0].properties.routeIndex;
                if (RoutingController.lastRoutingData) {
                    RoutingController.promoteAlternativeRoute(RoutingController.lastRoutingData, routeIndex);
                }
            }
        });
    }
}

