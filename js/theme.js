// maps Theme Management Module

import { state } from './state.js';

export function initTheme() {
    const savedTheme = localStorage.getItem('theme_preference') || 'system';
    applyTheme(savedTheme);

    // Watch system color preference shifts in real time
    const systemPref = window.matchMedia('(prefers-color-scheme: dark)');
    systemPref.addEventListener('change', () => {
        if (localStorage.getItem('theme_preference') === 'system') {
            applyTheme('system');
        }
    });

    // Theme selector click triggers
    document.querySelectorAll('[data-theme-btn]').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.getAttribute('data-theme-btn');
            applyTheme(val);
        });
    });
}

export function applyTheme(theme) {
    localStorage.setItem('theme_preference', theme);
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
        document.documentElement.classList.add('dark');
        if (state.map) {
            state.map.setStyle('https://tiles.openfreemap.org/styles/darkmatter');
        }
    } else {
        document.documentElement.classList.remove('dark');
        if (state.map) {
            state.map.setStyle('https://tiles.openfreemap.org/styles/liberty');
        }
    }

    // Toggle segment select UI highlight state
    document.querySelectorAll('[data-theme-btn]').forEach(btn => {
        const btnTheme = btn.getAttribute('data-theme-btn');
        if (btnTheme === theme) {
            btn.className = 'py-1 rounded-lg font-semibold transition-all bg-indigo-600 text-white shadow-sm';
        } else {
            btn.className = 'py-1 rounded-lg font-semibold transition-all text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/50';
        }
    });
}
