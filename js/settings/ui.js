// maps Settings Panel UI - js/settings/ui.js

export function setupSettingsUI(MapService) {
    const btnSettingsToggle = document.getElementById('btn-settings-toggle');
    const btnSettingsClose = document.getElementById('btn-settings-close');
    const settingsPanel = document.getElementById('settings-panel');
    const toggleOverlayLabels = document.getElementById('toggle-overlay-labels');
    const toggleOverlayBike = document.getElementById('toggle-overlay-bike');
    const toggleOverlayPerspective = document.getElementById('toggle-overlay-perspective');

    if (!settingsPanel) return;

    function removeScrim() {
        if (settingsPanel.shadowRoot) {
            const scrim = settingsPanel.shadowRoot.querySelector('.scrim');
            if (scrim) {
                scrim.style.setProperty('display', 'none', 'important');
                scrim.style.setProperty('pointer-events', 'none', 'important');
                scrim.style.setProperty('visibility', 'hidden', 'important');
                scrim.style.setProperty('opacity', '0', 'important');
            }
        }
    }
    removeScrim();

    function getPanelHeight() {
        const sheetEl = settingsPanel.shadowRoot ? settingsPanel.shadowRoot.querySelector('.sheet') : null;
        if (sheetEl) {
            const h = sheetEl.offsetHeight || sheetEl.getBoundingClientRect().height;
            if (h > 0) return h;
        }
        if (settingsPanel.offsetHeight > 0) {
            return settingsPanel.offsetHeight;
        }
        const gridEl = settingsPanel.querySelector('.settings-grid');
        if (gridEl) {
            const gridH = gridEl.offsetHeight || gridEl.getBoundingClientRect().height;
            if (gridH > 0) return gridH + 80;
        }
        return 220;
    }

    function updateControlPositions(isOpen) {
        if (isOpen) {
            removeScrim();
            const panelHeight = getPanelHeight();
            document.documentElement.style.setProperty('--settings-panel-height', panelHeight + 'px');
            document.querySelectorAll('.bottom-ui-element').forEach(el => {
                el.style.transform = `translateY(-${panelHeight}px)`;
            });
            const mapControls = document.querySelector('.maplibregl-ctrl-bottom-left');
            if (mapControls) mapControls.style.transform = `translateY(-${panelHeight}px)`;
        } else {
            document.querySelectorAll('.bottom-ui-element').forEach(el => {
                el.style.transform = '';
            });
            const mapControls = document.querySelector('.maplibregl-ctrl-bottom-left');
            if (mapControls) mapControls.style.transform = '';
            document.documentElement.style.setProperty('--settings-panel-height', '0px');
        }
    }

    function setSettingsPanelOpen(isOpen) {
        settingsPanel.classList.toggle('settings-open', isOpen);
        settingsPanel.classList.toggle('translate-y-full', !isOpen);
        if ('open' in settingsPanel) {
            settingsPanel.open = isOpen;
        }
        if (isOpen) {
            settingsPanel.setAttribute('open', '');
        } else {
            settingsPanel.removeAttribute('open');
        }

        if (btnSettingsToggle) {
            const iconSpan = btnSettingsToggle.querySelector('.material-icons-outlined');
            if (iconSpan) iconSpan.textContent = isOpen ? 'keyboard_double_arrow_down' : 'keyboard_double_arrow_up';
        }

        const btnLayers = document.getElementById('btn-layers');
        if (btnLayers) {
            btnLayers.classList.toggle('is-active', isOpen);
        }

        if (isOpen) {
            MapService.syncSettingsSquaresUI?.();
            MapService.updateSettingsPreviews?.();
            requestAnimationFrame(() => {
                updateControlPositions(true);
            });
            if (settingsPanel.updateComplete && typeof settingsPanel.updateComplete.then === 'function') {
                settingsPanel.updateComplete.then(() => updateControlPositions(true));
            }
        } else {
            updateControlPositions(false);
        }
    }

    if (btnSettingsToggle) {
        btnSettingsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = settingsPanel.classList.contains('settings-open') || settingsPanel.hasAttribute('open');
            setSettingsPanelOpen(!isOpen);
        });
    }

    const btnLayers = document.getElementById('btn-layers');
    if (btnLayers) {
        btnLayers.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = settingsPanel.classList.contains('settings-open') || settingsPanel.hasAttribute('open');
            setSettingsPanelOpen(!isOpen);
        });
    }

    if (btnSettingsClose) {
        btnSettingsClose.addEventListener('click', (e) => {
            e.stopPropagation();
            setSettingsPanelOpen(false);
        });
    }

    settingsPanel.addEventListener('open', () => {
        MapService.syncSettingsSquaresUI?.();
        MapService.updateSettingsPreviews?.();
        updateControlPositions(true);
    });
    settingsPanel.addEventListener('close', () => {
        setSettingsPanelOpen(false);
    });
    settingsPanel.addEventListener('cancel', () => {
        setSettingsPanelOpen(false);
    });
    settingsPanel.addEventListener('drag-dismiss', () => {
        setSettingsPanelOpen(false);
    });

    window.addEventListener('resize', () => {
        if (settingsPanel.classList.contains('settings-open') || settingsPanel.hasAttribute('open')) {
            updateControlPositions(true);
        }
    });

    document.addEventListener('click', (e) => {
        const path = e.composedPath ? e.composedPath() : [];
        const isInsidePanel = settingsPanel.contains(e.target) || path.includes(settingsPanel);
        const isToggleBtn = btnSettingsToggle && (btnSettingsToggle.contains(e.target) || path.includes(btnSettingsToggle));
        const btnLayersEl = document.getElementById('btn-layers');
        const isLayersBtn = btnLayersEl && (btnLayersEl.contains(e.target) || path.includes(btnLayersEl));

        if (!isInsidePanel && !isToggleBtn && !isLayersBtn) {
            if (settingsPanel.classList.contains('settings-open') || settingsPanel.hasAttribute('open')) {
                setSettingsPanelOpen(false);
            }
        }
    });

    // 5 Map Squares: Map, Satellite, Bike Paths, Transports, Topological
    const btnMapStreet = document.getElementById('btn-map-type-street');
    const btnMapSatellite = document.getElementById('btn-map-type-satellite');
    const btnMapBike = document.getElementById('btn-map-type-bike');
    const btnMapTransport = document.getElementById('btn-map-type-transport');
    const btnMapTopo = document.getElementById('btn-map-type-topo');

    if (btnMapStreet) {
        btnMapStreet.addEventListener('click', (e) => {
            e.stopPropagation();
            MapService.setBaseLayer('street');
        });
    }

    if (btnMapSatellite) {
        btnMapSatellite.addEventListener('click', (e) => {
            e.stopPropagation();
            MapService.setBaseLayer('satellite');
        });
    }

    if (btnMapBike) {
        btnMapBike.addEventListener('click', (e) => {
            e.stopPropagation();
            const nextState = !MapService.activeOverlays?.bike;
            MapService.toggleOverlay('bike', nextState);
        });
    }

    if (btnMapTransport) {
        btnMapTransport.addEventListener('click', (e) => {
            e.stopPropagation();
            const nextState = !MapService.activeOverlays?.transport;
            MapService.toggleOverlay('transport', nextState);
        });
    }

    if (btnMapTopo) {
        btnMapTopo.addEventListener('click', (e) => {
            e.stopPropagation();
            MapService.setBaseLayer('topo');
        });
    }

    MapService.syncSettingsSquaresUI?.();
    MapService.updateSettingsPreviews?.();

    // Layer Overlay Checks (fallback for switches if present)
    function handleOverlayToggle(el, layerName) {
        if (!el) return;
        el.addEventListener('change', (e) => {
            const isChecked = e.detail && typeof e.detail.selected === 'boolean'
                ? e.detail.selected
                : (typeof e.target.selected === 'boolean' ? e.target.selected : e.target.checked);
            MapService.toggleOverlay(layerName, Boolean(isChecked));
        });
    }

    handleOverlayToggle(toggleOverlayLabels, 'labels');
    handleOverlayToggle(toggleOverlayBike, 'bike');
    handleOverlayToggle(toggleOverlayPerspective, 'perspective');
}

