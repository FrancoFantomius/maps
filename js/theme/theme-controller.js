// maps Theme Controller - js/theme/theme-controller.js

import { MapService, DarkMapStyle } from '../map/index.js';
import { updateThemeButtonsUI, setupThemeUI } from './ui.js';

export const ThemeController = {
    init() {
        const savedTheme = localStorage.getItem('theme_preference') || 'system';
        this.apply(savedTheme);

        const systemPref = window.matchMedia('(prefers-color-scheme: dark)');
        systemPref.addEventListener('change', () => {
            if (localStorage.getItem('theme_preference') === 'system') {
                this.apply('system');
            }
        });

        setupThemeUI((val) => this.apply(val));
    },

    apply(theme) {
        localStorage.setItem('theme_preference', theme);
        const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

        if (isDark) {
            document.documentElement.classList.add('dark');
            document.documentElement.setAttribute('data-theme', 'dark');
            MapService.setStyle(DarkMapStyle);
        } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.setAttribute('data-theme', 'light');
            MapService.setStyle('https://tiles.openfreemap.org/styles/liberty');
        }

        updateThemeButtonsUI(theme);
        MapService.updateSettingsPreviews?.();
        MapService.updateLayerSwitcherPreview?.();
    }
};

export default ThemeController;
