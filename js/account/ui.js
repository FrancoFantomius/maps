// maps Account UI - js/account/ui.js

import { AccountController } from './account-controller.js';
import { LoginController } from './login-modal.js';
import { openSettingsPanel } from '../settings/index.js';

export function getAccountElements() {
  return {
    btnSyncLogin: document.getElementById('btn-sync-login'),
    appDrawer: document.getElementById('app-drawer'),
    accountMenu: document.getElementById('account-menu'),
    btnDropdownSettings: document.getElementById('btn-dropdown-settings'),
    btnSyncProfile: document.getElementById('btn-sync-profile'),
    headerProfileAvatar: document.getElementById('header-profile-avatar'),
    headerProfileLetter: document.getElementById('header-profile-letter'),
    headerProfileIcon: document.getElementById('header-profile-icon'),
    accountDropdown: document.getElementById('account-dropdown'),
    dropdownEmail: document.getElementById('account-dropdown-email'),
    dropdownAvatar: document.getElementById('dropdown-profile-avatar'),
    dropdownLetter: document.getElementById('dropdown-profile-letter'),
    dropdownIcon: document.getElementById('dropdown-profile-icon'),
    dropdownUsername: document.getElementById('dropdown-profile-username'),
    btnDropdownSignout: document.getElementById('btn-dropdown-signout'),
    markerForm: document.getElementById('marker-form')
  };
}

export function updateProfileUI(syncSettings) {
  const elements = getAccountElements();
  if (!elements.btnSyncLogin && !elements.btnSyncProfile && !elements.accountMenu) return;

  const isSyncActive = Boolean(syncSettings && syncSettings.enabled && (syncSettings.apiKey || syncSettings.email));

  if (isSyncActive) {
    if (elements.btnSyncLogin) elements.btnSyncLogin.style.display = 'none';
    if (elements.appDrawer) elements.appDrawer.style.display = 'inline-block';
    if (elements.btnSyncProfile) elements.btnSyncProfile.style.display = 'inline-flex';

    const email = syncSettings.email || '';
    const username = syncSettings.username || email.split('@')[0] || 'Connected';
    const letter = (username || email || '?').charAt(0).toUpperCase();

    if (elements.accountMenu) {
      elements.accountMenu.style.display = 'inline-block';
      elements.accountMenu.name = username;
      elements.accountMenu.email = email;
      elements.accountMenu.initials = letter;
      elements.accountMenu.avatar = syncSettings.avatarURL || '';
      elements.accountMenu.manageUrl = 'https://app.filen.io/#/settings/account';
      elements.accountMenu.manageText = 'Manage your Filen Account';
      elements.accountMenu.showTabs = false;
      elements.accountMenu.removeAttribute('show-tabs');

      updateAccountStorageUI(syncSettings);
    }

    if (elements.dropdownEmail) elements.dropdownEmail.textContent = email;
    if (elements.dropdownUsername) elements.dropdownUsername.textContent = username;

    // Update Profile Icon in Header
    if (syncSettings.avatarURL) {
      if (elements.headerProfileAvatar) {
        elements.headerProfileAvatar.src = syncSettings.avatarURL;
        elements.headerProfileAvatar.style.display = 'block';
      }
      if (elements.headerProfileLetter) elements.headerProfileLetter.style.display = 'none';
      if (elements.headerProfileIcon) elements.headerProfileIcon.style.display = 'none';

      if (elements.headerProfileAvatar) {
        elements.headerProfileAvatar.onerror = () => {
          elements.headerProfileAvatar.style.display = 'none';
          if (elements.headerProfileLetter) {
            elements.headerProfileLetter.textContent = letter;
            elements.headerProfileLetter.style.display = 'flex';
          }
        };
      }
    } else {
      if (elements.headerProfileAvatar) elements.headerProfileAvatar.style.display = 'none';
      if (elements.headerProfileLetter) {
        elements.headerProfileLetter.textContent = letter;
        elements.headerProfileLetter.style.display = 'flex';
      }
      if (elements.headerProfileIcon) elements.headerProfileIcon.style.display = 'none';
    }

    // Update Profile Icon in Dropdown
    if (syncSettings.avatarURL) {
      if (elements.dropdownAvatar) {
        elements.dropdownAvatar.src = syncSettings.avatarURL;
        elements.dropdownAvatar.style.display = 'block';
      }
      if (elements.dropdownLetter) elements.dropdownLetter.style.display = 'none';
      if (elements.dropdownIcon) elements.dropdownIcon.style.display = 'none';

      if (elements.dropdownAvatar) {
        elements.dropdownAvatar.onerror = () => {
          elements.dropdownAvatar.style.display = 'none';
          if (elements.dropdownLetter) {
            elements.dropdownLetter.textContent = letter;
            elements.dropdownLetter.style.display = 'flex';
          }
        };
      }
    } else {
      if (elements.dropdownAvatar) elements.dropdownAvatar.style.display = 'none';
      if (elements.dropdownLetter) {
        elements.dropdownLetter.textContent = letter;
        elements.dropdownLetter.style.display = 'flex';
      }
      if (elements.dropdownIcon) elements.dropdownIcon.style.display = 'none';
    }
  } else {
    if (elements.btnSyncLogin) elements.btnSyncLogin.style.display = 'inline-flex';
    if (elements.appDrawer) {
      elements.appDrawer.style.display = 'none';
      elements.appDrawer.open = false;
    }
    if (elements.accountMenu) {
      elements.accountMenu.style.display = 'none';
      elements.accountMenu.open = false;
    }
    if (elements.btnSyncProfile) elements.btnSyncProfile.style.display = 'none';
    if (elements.accountDropdown) elements.accountDropdown.style.display = 'none';
  }
}

export async function updateAccountStorageUI(syncSettings) {
  const elements = getAccountElements();
  const info = await AccountController.getStorageInfo(syncSettings);

  const metaEl = document.getElementById('account-storage-meta');
  const barNotes = document.getElementById('account-storage-bar-notes');
  const barOther = document.getElementById('account-storage-bar-other');
  const notesText = document.getElementById('account-storage-notes-text');
  const otherText = document.getElementById('account-storage-other-text');
  const freeText = document.getElementById('account-storage-free-text');

  if (metaEl) {
    metaEl.textContent = `${info.totalUsedFormatted} of ${info.totalStorageFormatted} used`;
  }
  if (barNotes) {
    barNotes.style.width = `${info.placesPercent}%`;
  }
  if (barOther) {
    barOther.style.width = `${info.otherPercent}%`;
  }
  if (notesText) {
    notesText.textContent = `Places: ${info.placesFormatted}`;
  }
  if (otherText) {
    otherText.textContent = `Other files: ${info.otherFormatted}`;
  }
  if (freeText) {
    freeText.textContent = `Free: ${info.freeFormatted}`;
  }

  if (elements.accountMenu) {
    elements.accountMenu.storageUsed = info.totalUsedFormatted;
    elements.accountMenu.storageTotal = info.totalStorageFormatted;
    elements.accountMenu.storageProgress = info.storageProgress;
    elements.accountMenu.setAttribute('storage-used', info.totalUsedFormatted);
    elements.accountMenu.setAttribute('storage-total', info.totalStorageFormatted);
    elements.accountMenu.setAttribute('storage-progress', String(info.storageProgress));
  }
}

export function toggleDropdown() {
  const elements = getAccountElements();
  if (elements.accountMenu) {
    elements.accountMenu.open = !elements.accountMenu.open;
  }
  if (elements.accountDropdown) {
    const isVisible = elements.accountDropdown.style.display === 'flex';
    elements.accountDropdown.style.display = isVisible ? 'none' : 'flex';
  }
}

export function setupAccountUI(controller = AccountController) {
  const elements = getAccountElements();

  if (elements.accountMenu) {
    elements.accountMenu.showTabs = false;
    elements.accountMenu.removeAttribute('show-tabs');

    // Remove duplicate horizontal line in account menu's shadow DOM footer
    const removeFirstFooterDivider = () => {
      try {
        if (elements.accountMenu?.shadowRoot && !elements.accountMenu.shadowRoot.querySelector('#no-footer-border-style')) {
          const style = document.createElement('style');
          style.id = 'no-footer-border-style';
          style.textContent = '.popover-footer { border-top: none !important; }';
          elements.accountMenu.shadowRoot.appendChild(style);
        }
      } catch (_) {}
    };
    removeFirstFooterDivider();
    if (elements.accountMenu.updateComplete) {
      elements.accountMenu.updateComplete.then(removeFirstFooterDivider);
    }

    elements.accountMenu.addEventListener('open', () => {
      updateAccountStorageUI();
    });

    elements.accountMenu.addEventListener('manage-click', (e) => {
      const url = e.detail?.manageUrl || 'https://app.filen.io/#/settings/account';
      window.open(url, '_blank', 'noopener,noreferrer');
    });

    elements.accountMenu.addEventListener('edit-avatar', () => {
      window.open('https://app.filen.io/#/settings/account', '_blank', 'noopener,noreferrer');
    });

    elements.accountMenu.addEventListener('sign-out', () => {
      controller.handleSignout();
    });
  }

  if (elements.btnDropdownSettings) {
    elements.btnDropdownSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      if (elements.accountMenu) {
        elements.accountMenu.open = false;
        elements.accountMenu.close?.();
      }
      if (elements.accountDropdown) {
        elements.accountDropdown.style.display = 'none';
      }
      const btnSettings = document.getElementById('btn-settings-toggle');
      if (btnSettings) {
        btnSettings.click();
      }
      openSettingsPanel(true);
    });
  }

  if (elements.btnDropdownSignout) {
    elements.btnDropdownSignout.addEventListener('click', (e) => {
      e.stopPropagation();
      if (elements.accountMenu) {
        elements.accountMenu.open = false;
      }
      controller.handleSignout();
    });
  }

  if (elements.btnSyncProfile) {
    elements.btnSyncProfile.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown();
    });
  }

  // Click outside dropdown to close
  document.addEventListener('click', (e) => {
    const el = getAccountElements();
    if (el.accountDropdown && el.accountDropdown.style.display === 'flex') {
      if (!el.accountDropdown.contains(e.target) &&
          (!el.btnSyncProfile || !el.btnSyncProfile.contains(e.target))) {
        el.accountDropdown.style.display = 'none';
      }
    }
  });

  // Listen to events for profile updates
  if (typeof window !== 'undefined') {
    window.addEventListener('maps-sync-settings-updated', (e) => {
      if (e.detail) {
        updateProfileUI(e.detail);
      }
    });

    window.addEventListener('maps-places-updated', () => {
      updateAccountStorageUI();
    });
  }

  // Initial load
  if (controller && typeof controller.init === 'function') {
    controller.init().then(settings => {
      if (settings) {
        updateProfileUI(settings);
      }
    });
  }
}

export { LoginController } from './login-modal.js';
export { AccountController } from './account-controller.js';
