/**
 * Maps UI - Account and Settings Controls
 */

import { getSyncSettings, saveSyncSettings, startSync, stopSync, destroyDatabase } from './db.js';

// DOM Elements cache
let elements = {};

export const AccountController = {
  async init() {
    // Select elements
    elements = {
      btnSyncLogin: document.getElementById('btn-sync-login'),
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
      loginModal: document.getElementById('login-modal'),
      btnLoginClose: document.getElementById('btn-login-close'),
      btnLoginCancel: document.getElementById('btn-login-cancel'),
      btnSaveSync: document.getElementById('btn-save-sync'),
      syncEmail: document.getElementById('sync-email'),
      syncPassword: document.getElementById('sync-password'),
      syncTwoFactor: document.getElementById('sync-twofactor'),
      syncStatusMsg: document.getElementById('sync-settings-status'),
      markerForm: document.getElementById('marker-form')
    };

    // Setup event listeners
    if (elements.btnSyncLogin) {
      elements.btnSyncLogin.addEventListener('click', () => this.showLoginModal());
    }

    if (elements.btnSyncProfile) {
      elements.btnSyncProfile.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdown();
      });
    }

    if (elements.btnLoginClose) {
      elements.btnLoginClose.addEventListener('click', () => this.hideLoginModal());
    }

    if (elements.btnLoginCancel) {
      elements.btnLoginCancel.addEventListener('click', () => this.hideLoginModal());
    }

    // Modal dismiss on click backdrop
    if (elements.loginModal) {
      elements.loginModal.addEventListener('click', (e) => {
        if (e.target === elements.loginModal) {
          this.hideLoginModal();
        }
      });
    }

    if (elements.btnSaveSync) {
      elements.btnSaveSync.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    if (elements.btnDropdownSignout) {
      elements.btnDropdownSignout.addEventListener('click', () => this.handleSignout());
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
    window.addEventListener('maps-sync-status', (e) => {
      const status = e.detail;
      // You could update visual cues or icons here, but according to specifications
      // we only use console.log (handled in db.js) and we don't display a badge.
    });

    // Load initial settings and trigger sync if enabled
    try {
      const settings = await getSyncSettings();
      this.updateProfileUI(settings);
      if (settings && settings.enabled) {
        startSync(settings).then(() => {
          // Re-fetch in case profile details (like nickname/avatar) got loaded in background
          getSyncSettings().then(s => this.updateProfileUI(s));
        }).catch(err => {
          console.error("[Sync] Initial sync fail:", err);
        });
      }
    } catch (e) {
      console.error("Failed to initialize sync UI:", e);
    }
  },

  showLoginModal() {
    if (elements.loginModal) {
      elements.loginModal.classList.remove('hidden');
    }
    if (elements.syncStatusMsg) {
      elements.syncStatusMsg.textContent = '';
      elements.syncStatusMsg.className = 'status-message text-slate-500 dark:text-slate-400 text-xs';
    }
    // Clean fields
    if (elements.syncEmail) elements.syncEmail.value = '';
    if (elements.syncPassword) elements.syncPassword.value = '';
    if (elements.syncTwoFactor) elements.syncTwoFactor.value = '';
  },

  hideLoginModal() {
    if (elements.loginModal) {
      elements.loginModal.classList.add('hidden');
    }
  },

  toggleDropdown() {
    if (!elements.accountDropdown) return;
    const isVisible = elements.accountDropdown.style.display === 'flex';
    elements.accountDropdown.style.display = isVisible ? 'none' : 'flex';
  },

  async handleLogin() {
    const email = elements.syncEmail.value.trim();
    const password = elements.syncPassword.value;
    const twoFactorCode = elements.syncTwoFactor.value.trim();

    if (!email || !password) {
      this.showStatusError("Please enter both email and password.");
      return;
    }

    this.showStatusLoading("Signing in & verifying credentials...");

    try {
      const initialSettings = {
        enabled: true,
        email,
        password,
        twoFactorCode
      };

      // startSync will perform login and automatically save session tokens in db.js
      await startSync(initialSettings);

      // Re-read settings which now contains username, avatarURL, and session keys
      const saved = await getSyncSettings();
      this.updateProfileUI(saved);
      this.hideLoginModal();
    } catch (err) {
      console.error("Login verification failed:", err);
      this.showStatusError(err.message || "Failed to log in. Please check your credentials.");
    }
  },

  async handleSignout() {
    if (confirm("Are you sure you want to sign out? Synchronization will be disabled, but your local places will remain.")) {
      try {
        stopSync();
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

  updateProfileUI(syncSettings) {
    if (!elements.btnSyncLogin || !elements.btnSyncProfile) return;

    const isSyncActive = syncSettings && syncSettings.enabled && (syncSettings.apiKey || syncSettings.email);

    if (isSyncActive) {
      elements.btnSyncLogin.style.display = 'none';
      elements.btnSyncProfile.style.display = 'inline-flex';

      const email = syncSettings.email || '';
      const username = syncSettings.username || email.split('@')[0] || 'Connected';

      if (elements.dropdownEmail) elements.dropdownEmail.textContent = email;
      if (elements.dropdownUsername) elements.dropdownUsername.textContent = username;

      const letter = (username || email || '?').charAt(0).toUpperCase();

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
      elements.btnSyncLogin.style.display = 'inline-flex';
      elements.btnSyncProfile.style.display = 'none';
      if (elements.accountDropdown) elements.accountDropdown.style.display = 'none';
    }
  },

  showStatusLoading(msg) {
    if (!elements.syncStatusMsg) return;
    elements.syncStatusMsg.textContent = msg;
    elements.syncStatusMsg.className = 'status-message text-indigo-600 dark:text-indigo-400 text-xs animate-pulse font-medium';
  },

  showStatusError(msg) {
    if (!elements.syncStatusMsg) return;
    elements.syncStatusMsg.textContent = msg;
    elements.syncStatusMsg.className = 'status-message text-red-500 dark:text-red-400 text-xs font-semibold';
  }
};
