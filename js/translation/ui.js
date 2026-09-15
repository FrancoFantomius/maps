// maps Translation UI - js/translation/ui.js

export function updateSettingsLanguageUI(supportedLanguages, currentPref, t) {
    const selectEl = document.getElementById('setting-language');
    if (selectEl) {
        const systemLabel = t('settings.language_system', {}, 'System (Auto)');
        let optionsHtml = `<option value="system" data-i18n="settings.language_system">${systemLabel}</option>`;

        for (const [code, label] of Object.entries(supportedLanguages)) {
            optionsHtml += `<option value="${code}">${label}</option>`;
        }

        selectEl.innerHTML = optionsHtml;
        selectEl.value = currentPref;
    }

    // Update current language label on picker button
    const currentLabelEl = document.getElementById('current-language-label');
    if (currentLabelEl) {
        if (currentPref === 'system' || !currentPref) {
            currentLabelEl.textContent = 'Auto';
        } else if (supportedLanguages && supportedLanguages[currentPref]) {
            currentLabelEl.textContent = supportedLanguages[currentPref];
        } else {
            currentLabelEl.textContent = currentPref;
        }
    }

    // Update language modal radio selection
    const radioGroup = document.getElementById('language-radio-group');
    if (radioGroup) {
        radioGroup.value = currentPref || 'system';
        radioGroup.querySelectorAll('md-radio').forEach(radio => {
            radio.checked = (radio.value === (currentPref || 'system'));
        });
    }
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

    const btnPicker = document.getElementById('btn-language-picker');
    const dialog = document.getElementById('language-dialog');
    const radioGroup = document.getElementById('language-radio-group');
    const btnConfirm = document.getElementById('btn-language-confirm');
    const btnCancel = document.getElementById('btn-language-cancel');

    if (btnPicker && dialog) {
        btnPicker.addEventListener('click', (e) => {
            e.stopPropagation();
            dialog.open = true;
        });
    }

    let pendingLanguage = null;

    if (radioGroup) {
        radioGroup.addEventListener('change', (e) => {
            const target = e.target;
            if (target && target.value) {
                pendingLanguage = target.value;
            }
        });
        radioGroup.addEventListener('group-change', (e) => {
            if (e.detail && e.detail.value) {
                pendingLanguage = e.detail.value;
            }
        });
    }

    if (btnConfirm && dialog) {
        btnConfirm.addEventListener('click', () => {
            const selected = pendingLanguage || (radioGroup ? radioGroup.value : 'system');
            if (typeof onChangeLanguage === 'function' && selected) {
                onChangeLanguage(selected);
            }
            dialog.open = false;
        });
    }

    if (btnCancel && dialog) {
        btnCancel.addEventListener('click', () => {
            pendingLanguage = null;
            dialog.open = false;
        });
    }
}


