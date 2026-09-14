// maps Settings Panel UI - js/settings/ui.js

export function setupSettingsUI(MapService) {
    const btnSettingsToggle = document.getElementById('btn-settings-toggle');
    const btnSettingsClose = document.getElementById('btn-settings-close');
    const settingsPanel = document.getElementById('settings-panel');
    const toggleOverlayLabels = document.getElementById('toggle-overlay-labels');
    const toggleOverlayBike = document.getElementById('toggle-overlay-bike');
    const toggleOverlayPerspective = document.getElementById('toggle-overlay-perspective');

    if (!settingsPanel || !btnSettingsToggle) return;

    function setSettingsPanelOpen(isOpen) {
        settingsPanel.classList.toggle('settings-open', isOpen);
        settingsPanel.classList.toggle('translate-y-full', !isOpen);
        const iconSpan = btnSettingsToggle.querySelector('.material-icons-outlined');
        if (iconSpan) iconSpan.textContent = isOpen ? 'keyboard_double_arrow_down' : 'keyboard_double_arrow_up';

        if (isOpen) {
            requestAnimationFrame(() => {
                const panelHeight = settingsPanel.offsetHeight;
                document.documentElement.style.setProperty('--settings-panel-height', panelHeight + 'px');
                document.querySelectorAll('.bottom-ui-element').forEach(el => {
                    el.style.transform = `translateY(-${panelHeight}px)`;
                });
                const mapControls = document.querySelector('.maplibregl-ctrl-bottom-left');
                if (mapControls) mapControls.style.transform = `translateY(-${panelHeight}px)`;
            });
        } else {
            document.querySelectorAll('.bottom-ui-element').forEach(el => {
                el.style.transform = '';
            });
            const mapControls = document.querySelector('.maplibregl-ctrl-bottom-left');
            if (mapControls) mapControls.style.transform = '';
        }
    }

    btnSettingsToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        setSettingsPanelOpen(!settingsPanel.classList.contains('settings-open'));
    });

    if (btnSettingsClose) {
        btnSettingsClose.addEventListener('click', (e) => {
            e.stopPropagation();
            setSettingsPanelOpen(false);
        });
    }

    document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && !btnSettingsToggle.contains(e.target)) {
            if (settingsPanel.classList.contains('settings-open')) {
                setSettingsPanelOpen(false);
            }
        }
    });

    // Layer Overlay Checks
    if (toggleOverlayLabels) {
        toggleOverlayLabels.addEventListener('change', (e) => {
            MapService.toggleOverlay('labels', e.target.checked);
        });
    }

    if (toggleOverlayBike) {
        toggleOverlayBike.addEventListener('change', (e) => {
            MapService.toggleOverlay('bike', e.target.checked);
        });
    }

    if (toggleOverlayPerspective) {
        toggleOverlayPerspective.addEventListener('change', (e) => {
            MapService.toggleOverlay('perspective', e.target.checked);
        });
    }
}

