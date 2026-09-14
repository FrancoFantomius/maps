/**
 * Maps UI - Account and Settings Logic
 */

import { getSyncSettings, saveSyncSettings, startSync, stopSync, destroyDatabase, loadAllPlaces } from '../db/index.js';

export const AccountController = {
  async init() {
    // Listen to database sync status updates (from db.js custom event)
    if (typeof window !== 'undefined') {
      window.addEventListener('maps-sync-status', async (e) => {
        const status = e.detail;
        if (status === 'online') {
          const current = await getSyncSettings();
          window.dispatchEvent(new CustomEvent('maps-sync-settings-updated', { detail: current }));
        }
      });
    }

    // Load initial settings and trigger sync if enabled
    try {
      const syncSettings = await getSyncSettings();

      if (syncSettings && syncSettings.enabled && (syncSettings.email || syncSettings.apiKey)) {
        startSync(syncSettings).then(async () => {
          const updated = await getSyncSettings();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('maps-sync-settings-updated', { detail: updated }));
          }
        }).catch(err => {
          console.error("[Sync] Initial sync fail:", err);
        });
      }

      return syncSettings;
    } catch (e) {
      console.error("Failed to initialize sync:", e);
      return null;
    }
  },

  async handleSignout() {
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

      // Purge local database as part of signout
      await destroyDatabase();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('maps-sync-settings-updated', { detail: settings }));
      }
      return settings;
    } catch (err) {
      console.error("Error signing out:", err);
      throw err;
    }
  },

  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  async getStorageInfo(syncSettings) {
    if (!syncSettings) {
      try {
        syncSettings = await getSyncSettings();
      } catch (e) {
        syncSettings = null;
      }
    }

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

    const filenUsedBytes = (syncSettings && typeof syncSettings.storageUsed === 'number')
      ? syncSettings.storageUsed
      : 0;

    const otherFilesBytes = Math.max(0, filenUsedBytes - placesBytes);
    const totalUsedBytes = Math.max(filenUsedBytes, placesBytes);
    const freeBytes = Math.max(0, totalStorageBytes - totalUsedBytes);

    const placesPercent = totalStorageBytes > 0 ? Math.min(100, (placesBytes / totalStorageBytes) * 100) : 0;
    const otherPercent = totalStorageBytes > 0 ? Math.min(100 - placesPercent, (otherFilesBytes / totalStorageBytes) * 100) : 0;
    const storageProgress = totalStorageBytes > 0 ? (totalUsedBytes / totalStorageBytes) : 0;

    return {
      placesBytes,
      totalStorageBytes,
      filenUsedBytes,
      otherFilesBytes,
      totalUsedBytes,
      freeBytes,
      placesPercent,
      otherPercent,
      storageProgress,
      totalUsedFormatted: this.formatBytes(totalUsedBytes),
      totalStorageFormatted: this.formatBytes(totalStorageBytes),
      freeFormatted: this.formatBytes(freeBytes),
      placesFormatted: this.formatBytes(placesBytes),
      otherFormatted: this.formatBytes(otherFilesBytes)
    };
  }
};

export const AccountTab = AccountController;
export default AccountController;
