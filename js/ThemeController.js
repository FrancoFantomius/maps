// maps Theme Controller - js/ThemeController.js

import { MapService } from './MapService.js';

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

        document.querySelectorAll('[data-theme-btn]').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.getAttribute('data-theme-btn');
                this.apply(val);
            });
        });
    },

    apply(theme) {
        localStorage.setItem('theme_preference', theme);
        const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

        if (isDark) {
            document.documentElement.classList.add('dark');
            MapService.setStyle('https://tiles.openfreemap.org/styles/darkmatter');
        } else {
            document.documentElement.classList.remove('dark');
            MapService.setStyle('https://tiles.openfreemap.org/styles/liberty');
        }

        document.querySelectorAll('[data-theme-btn]').forEach(btn => {
            const btnTheme = btn.getAttribute('data-theme-btn');
            if (btnTheme === theme) {
                btn.className = 'py-1 rounded-lg font-semibold transition-all bg-indigo-600 text-white shadow-sm';
            } else {
                btn.className = 'py-1 rounded-lg font-semibold transition-all text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/50';
            }
        });
    }
};
