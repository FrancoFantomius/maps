// maps Theme UI - js/theme/ui.js

export function updateThemeButtonsUI(activeTheme) {
    document.querySelectorAll('[data-theme-btn]').forEach(btn => {
        const btnTheme = btn.getAttribute('data-theme-btn');
        if (btnTheme === activeTheme) {
            btn.className = 'py-1 rounded-lg font-semibold transition-all bg-indigo-600 text-white shadow-sm';
        } else {
            btn.className = 'py-1 rounded-lg font-semibold transition-all text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/50';
        }
    });
}

export function setupThemeUI(onSelectTheme) {
    document.querySelectorAll('[data-theme-btn]').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.getAttribute('data-theme-btn');
            if (typeof onSelectTheme === 'function') {
                onSelectTheme(val);
            }
        });
    });
}

