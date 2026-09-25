export function checkThemeButtonsOverflow() {
    const group = document.querySelector('.settings-block-action md-button-group');
    if (!group) return;

    // Temporarily measure full width without contraction
    const wasContracted = group.classList.contains('is-contracted');
    group.classList.remove('is-contracted');
    const parent = group.parentElement;
    if (!parent) return;

    if (group.scrollWidth > parent.clientWidth + 2) {
        group.classList.add('is-contracted');
    } else if (!wasContracted) {
        group.classList.remove('is-contracted');
    }
}

export function updateThemeButtonsUI(activeTheme) {
    document.querySelectorAll('[data-theme-btn]').forEach(btn => {
        const btnTheme = btn.getAttribute('data-theme-btn');
        const isSelected = btnTheme === activeTheme;
        if (isSelected) {
            btn.className = 'py-1 rounded-lg font-semibold transition-all bg-indigo-600 text-white shadow-sm is-selected';
            btn.classList.add('is-selected');
            btn.removeAttribute('icon-only');
            if ('variant' in btn || btn.hasAttribute('variant')) {
                btn.variant = 'filled';
                btn.setAttribute('variant', 'filled');
            }
        } else {
            btn.className = 'py-1 rounded-lg font-semibold transition-all text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/50';
            btn.classList.remove('is-selected');
            btn.setAttribute('icon-only', '');
            if ('variant' in btn || btn.hasAttribute('variant')) {
                btn.variant = 'outlined';
                btn.setAttribute('variant', 'outlined');
            }
        }
    });

    checkThemeButtonsOverflow();
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

    if (typeof window !== 'undefined') {
        window.addEventListener('resize', () => {
            checkThemeButtonsOverflow();
        });
        window.addEventListener('maps-open-settings', () => {
            requestAnimationFrame(() => checkThemeButtonsOverflow());
        });
    }

    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel) {
        settingsPanel.addEventListener('open', () => {
            requestAnimationFrame(() => checkThemeButtonsOverflow());
        });
    }

    const groupAction = document.querySelector('.settings-block-action');
    if (groupAction && typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => {
            checkThemeButtonsOverflow();
        });
        observer.observe(groupAction);
    }
}

