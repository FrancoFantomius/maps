// maps Translation UI - js/translation/ui.js

export function updateSettingsLanguageUI(supportedLanguages, currentPref, t) {
    const selectEl = document.getElementById('setting-language');
    if (!selectEl) return;

    const systemLabel = t('settings.language_system', {}, 'System (Auto)');
    let optionsHtml = `<option value="system" data-i18n="settings.language_system">${systemLabel}</option>`;

    for (const [code, label] of Object.entries(supportedLanguages)) {
        optionsHtml += `<option value="${code}">${label}</option>`;
    }

    selectEl.innerHTML = optionsHtml;
    selectEl.value = currentPref;
}

export function setupLanguageSelectUI(onChangeLanguage) {
    const settingLanguage = document.getElementById('setting-language');
    if (settingLanguage) {
        settingLanguage.addEventListener('change', (e) => {
            if (typeof onChangeLanguage === 'function') {
                onChangeLanguage(e.target.value);
            }
        });
    }
}

