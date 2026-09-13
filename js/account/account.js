/**
 * Maps UI - Account and Settings Controls
 */

import { getSyncSettings, saveSyncSettings, startSync, stopSync, destroyDatabase, loadAllPlaces } from '../db.js';
import { LoginController } from './login.js';

// DOM Elements cache
let elements = {};

export const AccountController = {
  async init() {
    // Initialize LoginController with a callback to update account UI on successful sign in
    LoginController.init({
      onLoginSuccess: (savedSettings) => this.updateProfileUI(savedSettings)
    });

    // Select elements
    elements = {
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
      btnDropdownPurge: document.getElementById('btn-dropdown-purge'),
      markerForm: document.getElementById('marker-form')
    };

    // Setup event listeners
    if (elements.btnSyncLogin) {
      elements.btnSyncLogin.addEventListener('click', () => LoginController.showLoginModal());
    }

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
        this.updateAccountStorageUI();
      });

      elements.accountMenu.addEventListener('manage-click', (e) => {
        const url = e.detail?.manageUrl || 'https://app.filen.io/#/settings/account';
        window.open(url, '_blank', 'noopener,noreferrer');
      });

      elements.accountMenu.addEventListener('edit-avatar', () => {
        window.open('https://app.filen.io/#/settings/account', '_blank', 'noopener,noreferrer');
      });

      elements.accountMenu.addEventListener('sign-out', () => {
        this.handleSignout();
      });
    }

    if (elements.btnDropdownSettings) {
      elements.btnDropdownSettings.addEventListener('click', (e) => {
        e.stopPropagation();
        if (elements.accountMenu) {
          elements.accountMenu.open = false;
        }
        const btnSettings = document.getElementById('btn-settings-toggle');
        if (btnSettings) {
          btnSettings.click();
        }
      });
    }

    if (elements.btnDropdownSignout) {
      elements.btnDropdownSignout.addEventListener('click', (e) => {
        e.stopPropagation();
        if (elements.accountMenu) {
          elements.accountMenu.open = false;
        }
        this.handleSignout();
      });
    }

    if (elements.btnSyncProfile) {
      elements.btnSyncProfile.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdown();
      });
    }

    if (elements.btnDropdownPurge) {
      elements.btnDropdownPurge.addEventListener('click', () => this.handlePurge());
    }

    // Click outside dropdown to close
    document.addEventListener('click', (e) => {
      if (elements.accountDropdown && elements.accountDropdown.style.display === 'flex') {
        if (!elements.accountDropdown.contains(e.target) &&
            (!elements.btnSyncProfile || !elements.btnSyncProfile.contains(e.target))) {
          elements.accountDropdown.style.display = 'none';
        }
      }
    });

    // Listen to database sync status updates (from db.js custom event)
    window.addEventListener('maps-sync-status', async (e) => {
      const status = e.detail;
      if (status === 'online') {
        const current = await getSyncSettings();
        this.updateProfileUI(current);
      }
    });

    window.addEventListener('maps-sync-settings-updated', (e) => {
      if (e.detail) {
        this.updateProfileUI(e.detail);
      }
    });

    window.addEventListener('maps-places-updated', () => {
      this.updateAccountStorageUI();
    });

    // Load initial settings and trigger sync if enabled
    try {
      const syncSettings = await getSyncSettings();
      this.updateProfileUI(syncSettings);

      if (syncSettings.enabled && (syncSettings.email || syncSettings.apiKey)) {
        startSync(syncSettings).then(() => {
          getSyncSettings().then(s => this.updateProfileUI(s));
        }).catch(err => {
          console.error("[Sync] Initial sync fail:", err);
        });
      }
    } catch (e) {
      console.error("Failed to initialize sync UI:", e);
    }
  },

  // Forwarding methods to LoginController for backward compatibility and convenience
  showLoginModal() {
    LoginController.showLoginModal();
  },

  hideLoginModal() {
    LoginController.hideLoginModal();
  },

  clearEmailError() {
    LoginController.clearEmailError();
  },

  setEmailError(msg) {
    LoginController.setEmailError(msg);
  },

  clearPasswordError() {
    LoginController.clearPasswordError();
  },

  setPasswordError(msg) {
    LoginController.setPasswordError(msg);
  },

  handleLogin() {
    return LoginController.handleLogin();
  },

  toggleDropdown() {
    if (elements.accountMenu) {
      elements.accountMenu.open = !elements.accountMenu.open;
    }
    if (elements.accountDropdown) {
      const isVisible = elements.accountDropdown.style.display === 'flex';
      elements.accountDropdown.style.display = isVisible ? 'none' : 'flex';
    }
  },

  async handleSignout() {
    if (confirm("Are you sure you want to sign out? Synchronization will be disabled, but your local places will remain.")) {
      try {
        stopSync();
        if (elements.accountMenu) {
          elements.accountMenu.open = false;
        }
        const settings = await getSyncSettings();
        settings.enabled = false;
        // Erase API keys and credentials
        delete settings.apiKey;
        delete settings.masterKeys;
        delete settings.publicKey;
        delete settings.privateKey;
        delete settings.baseFolderUUID;
        delete settings.userId;
        delete settings.authVersion;
        delete settings.password;
        await saveSyncSettings(settings);
        this.updateProfileUI(settings);
      } catch (err) {
        console.error("Error signing out:", err);
      }
    }
  },

  async handlePurge() {
    if (confirm("WARNING: This will permanently delete all local places on this browser. Your synchronized cloud database on Filen will not be affected. Do you want to purge local cache?")) {
      try {
        await destroyDatabase();
      } catch (err) {
        console.error("Error purging database:", err);
      }
    }
  },

  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  async updateAccountStorageUI(syncSettings) {
    if (!syncSettings) {
      try {
        syncSettings = await getSyncSettings();
      } catch (e) {
        syncSettings = null;
      }
    }

    const metaEl = document.getElementById('account-storage-meta');
    const barNotes = document.getElementById('account-storage-bar-notes');
    const barOther = document.getElementById('account-storage-bar-other');
    const notesText = document.getElementById('account-storage-notes-text');
    const otherText = document.getElementById('account-storage-other-text');
    const freeText = document.getElementById('account-storage-free-text');

    let placesBytes = 0;
    try {
      const places = await loadAllPlaces();
      if (Array.isArray(places)) {
        placesBytes = new Blob([JSON.stringify(places)]).size;
      }
    } catch (e) {
      placesBytes = 0;
    }

    const totalStorageBytes = (syncSettings && typeof syncSettings.storageTotal === 'number' && syncSettings.storageTotal > 0)
      ? syncSettings.storageTotal
      : 10 * 1024 * 1024 * 1024;
    
    // storageUsed from Filen SDK represents the total bytes consumed in the cloud account
    const filenUsedBytes = (syncSettings && typeof syncSettings.storageUsed === 'number')
      ? syncSettings.storageUsed
      : 0;

    // The other files size adapts to whatever Filen used minus the places size
    const otherFilesBytes = Math.max(0, filenUsedBytes - placesBytes);
    const totalUsedBytes = Math.max(filenUsedBytes, placesBytes);
    const freeBytes = Math.max(0, totalStorageBytes - totalUsedBytes);

    const placesPercent = totalStorageBytes > 0 ? Math.min(100, (placesBytes / totalStorageBytes) * 100) : 0;
    const otherPercent = totalStorageBytes > 0 ? Math.min(100 - placesPercent, (otherFilesBytes / totalStorageBytes) * 100) : 0;

    if (metaEl) {
      metaEl.textContent = `${this.formatBytes(totalUsedBytes)} of ${this.formatBytes(totalStorageBytes)} used`;
    }
    if (barNotes) {
      barNotes.style.width = `${placesPercent}%`;
    }
    if (barOther) {
      barOther.style.width = `${otherPercent}%`;
    }
    if (notesText) {
      notesText.textContent = `Places: ${this.formatBytes(placesBytes)}`;
    }
    if (otherText) {
      otherText.textContent = `Other files: ${this.formatBytes(otherFilesBytes)}`;
    }
    if (freeText) {
      freeText.textContent = `Free: ${this.formatBytes(freeBytes)}`;
    }

    if (elements.accountMenu) {
      const storageUsedFormatted = this.formatBytes(totalUsedBytes);
      const storageTotalFormatted = this.formatBytes(totalStorageBytes);
      const storageProgress = totalStorageBytes > 0 ? (totalUsedBytes / totalStorageBytes) : 0;

      elements.accountMenu.storageUsed = storageUsedFormatted;
      elements.accountMenu.storageTotal = storageTotalFormatted;
      elements.accountMenu.storageProgress = storageProgress;
      elements.accountMenu.setAttribute('storage-used', storageUsedFormatted);
      elements.accountMenu.setAttribute('storage-total', storageTotalFormatted);
      elements.accountMenu.setAttribute('storage-progress', String(storageProgress));
    }
  },

  updateProfileUI(syncSettings) {
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

        this.updateAccountStorageUI(syncSettings);
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
};

export const AccountTab = AccountController;

