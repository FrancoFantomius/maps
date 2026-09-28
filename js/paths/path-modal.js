// maps Path Modal - js/paths/path-modal.js

let activeSaveCallback = null;

export function openPathModal(defaultName = '', infoText = '', onSave = null, title = 'Save Path', submitLabel = 'Save Path') {
    const pathModal = document.getElementById('path-modal');
    const pathModalName = document.getElementById('path-modal-name');
    const pathModalInfo = document.getElementById('path-modal-info');
    const pathModalTitle = document.getElementById('path-modal-title');
    const pathModalSubmitLabel = document.getElementById('path-modal-submit-label');

    activeSaveCallback = onSave;

    if (pathModalName) {
        pathModalName.value = defaultName || 'My Route';
    }
    if (pathModalInfo) {
        pathModalInfo.textContent = infoText || '';
    }
    if (pathModalTitle) {
        pathModalTitle.textContent = title;
    }
    if (pathModal) {
        pathModal.setAttribute('headline', title);
    }
    if (pathModalSubmitLabel) {
        pathModalSubmitLabel.textContent = submitLabel;
    }

    if (pathModal) {
        pathModal.classList.remove('hidden');
        if (typeof pathModal.showModal === 'function') {
            pathModal.showModal();
        } else if (typeof pathModal.show === 'function') {
            pathModal.show();
        } else {
            pathModal.open = true;
        }
    }
}

export function closePathModal(onClose = null) {
    const pathModal = document.getElementById('path-modal');
    if (pathModal) {
        pathModal.classList.add('hidden');
        if (typeof pathModal.close === 'function') {
            pathModal.close();
        } else {
            pathModal.open = false;
        }
    }
    activeSaveCallback = null;
    if (typeof onClose === 'function') onClose();
}

export function setupPathModalUI(PathsController) {
    const pathForm = document.getElementById('path-form');
    if (pathForm) {
        pathForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pathModalName = document.getElementById('path-modal-name');
            const name = (pathModalName ? pathModalName.value : '').trim() || 'Untitled Path';

            if (typeof activeSaveCallback === 'function') {
                const callback = activeSaveCallback;
                closePathModal();
                await callback(name);
            } else if (PathsController && typeof PathsController.handleModalSave === 'function') {
                closePathModal();
                await PathsController.handleModalSave(name);
            }
        });
    }

    const btnClosePathModal = document.getElementById('btn-close-path-modal');
    if (btnClosePathModal) {
        btnClosePathModal.addEventListener('click', () => {
            closePathModal();
        });
    }

    const btnSavePathModal = document.getElementById('btn-save-path-modal');
    if (btnSavePathModal) {
        btnSavePathModal.addEventListener('click', (e) => {
            e.preventDefault();
            const pathFormEl = document.getElementById('path-form');
            if (pathFormEl && typeof pathFormEl.requestSubmit === 'function') {
                pathFormEl.requestSubmit();
            } else if (pathFormEl) {
                pathFormEl.dispatchEvent(new Event('submit', { cancelable: true }));
            }
        });
    }

    const pathModal = document.getElementById('path-modal');
    if (pathModal && !pathModal._boundClose) {
        pathModal._boundClose = true;
        pathModal.addEventListener('close', (e) => {
            if (e.target && e.target !== pathModal) return;
            closePathModal();
        });
        pathModal.addEventListener('cancel', (e) => {
            if (e.target && e.target !== pathModal) return;
            closePathModal();
        });
    }
}
