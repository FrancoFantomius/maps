// maps HUD UI & Gestures - js/hud/ui.js

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

    // Close button inside Saved Places list
    const btnClosePlaces = document.getElementById('btn-close-places');
    if (btnClosePlaces) {
        btnClosePlaces.addEventListener('click', (e) => {
            e.stopPropagation();
            HUDController.setState('places');
        });
    }

    // Close button for Search results
    const btnCloseSearch = document.getElementById('btn-close-search');
    if (btnCloseSearch) {
        btnCloseSearch.addEventListener('click', () => {
            const searchBar = document.getElementById('search-bar');
            const searchInput = document.getElementById('search-input');
            const btnClearSearch = document.getElementById('btn-clear-search');

            if (searchBar) searchBar.value = '';
            if (searchInput) searchInput.value = '';
            if (btnClearSearch) btnClearSearch.classList.add('hidden');
            HUDController.setState('places');
            if (MarkerController && typeof MarkerController.removeTempMarker === 'function') {
                MarkerController.removeTempMarker();
            }
            if (SearchController && typeof SearchController.clearSearchMarkers === 'function') {
                SearchController.clearSearchMarkers();
            }
        });
    }

    // Mobile drag handle expansion/collapse/swipe closing
    const dragHandle = document.getElementById('hud-drag-handle');
    const hudPanel = document.getElementById('hud-panel');
    if (dragHandle && hudPanel) {
        let touchStartY = 0;
        let initialHudHeight = 0;
        let isDragging = false;

        // Support clicking to toggle default/expanded height
        dragHandle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isDragging) return;

            if (window.innerWidth < 768) {
                if (HUDController.isExpanded) {
                    HUDController.collapse();
                } else {
                    HUDController.expand();
                }
            }
        });

        dragHandle.addEventListener('touchstart', (e) => {
            if (window.innerWidth >= 768) return;
            touchStartY = e.touches[0].clientY;
            initialHudHeight = hudPanel.offsetHeight;
            isDragging = true;
            hudPanel.style.transition = 'none';
        }, { passive: true });

        dragHandle.addEventListener('touchmove', (e) => {
            if (!isDragging || window.innerWidth >= 768) return;
            const touchCurrentY = e.touches[0].clientY;
            const dy = touchStartY - touchCurrentY;
            const newHeight = initialHudHeight + dy;
            const constrainedHeight = Math.max(0, Math.min(newHeight, window.innerHeight * 0.88));
            hudPanel.style.height = `${constrainedHeight}px`;
        }, { passive: true });

        dragHandle.addEventListener('touchend', () => {
            if (!isDragging || window.innerWidth >= 768) return;
            isDragging = false;
            hudPanel.style.transition = '';

            const finalHeight = hudPanel.offsetHeight;
            const hScreen = window.innerHeight;

            if (finalHeight < hScreen * 0.22) {
                HUDController.setState('places');
                setTimeout(() => {
                    if (HUDController.currentState === 'places') {
                        hudPanel.style.height = '';
                    }
                }, 400);
            } else if (finalHeight < hScreen * 0.62) {
                HUDController.collapse();
                setTimeout(() => {
                    if (HUDController.currentState !== 'places' && !HUDController.isExpanded) {
                        hudPanel.style.height = '';
                    }
                }, 400);
            } else {
                HUDController.expand();
                setTimeout(() => {
                    if (HUDController.currentState !== 'places' && HUDController.isExpanded) {
                        hudPanel.style.height = '';
                    }
                }, 400);
            }
        }, { passive: true });
    }

    // Responsive resize support for HUD layout updates
    window.addEventListener('resize', () => {
        if (HUDController.isOpen) {
            HUDController.open(HUDController.isExpanded);
        }
    });
}

