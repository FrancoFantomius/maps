/**
 * Maps - Database and Sync Module (PouchDB wrapper with Filen replication)
 */

import PouchDB from 'pouchdb';
import { FilenSDK } from "@filen/sdk";
import { Buffer } from "buffer";
import { Readable } from "stream";
import { MapService } from './MapService.js';

import PouchDBAdapterMemory from 'pouchdb-adapter-memory';

// Polyfill Readable.from in the browser stream polyfill
if (Readable) {
  Readable.from = function (iterable, options) {
    const opt = Object.assign({ objectMode: true }, options);
    const readable = new Readable({
      ...opt,
      read() { }
    });

    (async () => {
      try {
        for await (const chunk of iterable) {
          readable.push(chunk);
        }
        readable.push(null);
      } catch (err) {
        readable.destroy(err);
      }
    })();

    return readable;
  };
}

const isTest = (typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.VITEST)) || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE === 'test');
if (isTest) {
  PouchDB.plugin(PouchDBAdapterMemory);
}

// Initialize PouchDB local database
const db = new PouchDB('maps_db', isTest ? { adapter: 'memory' } : {});

// State variables for Filen Sync
let filenClient = null;
let syncPromise = Promise.resolve();
let syncInterval = null;
let currentSyncStatus = 'offline'; // 'offline', 'syncing', 'online', 'error'
let lastReportedSyncKey = '';      // (status or status:code) already logged, to avoid console spam
let syncInProgress = false;        // guards against overlapping sync runs

export const FILEN_SYNC_DIR = '/Apps/maps';
export const FILEN_SYNC_FILE = `${FILEN_SYNC_DIR}/places.json`;

/**
 * Machine-readable error codes for the Filen sync module.
 * Always log/throw with these so issues are searchable and debuggable.
 */
export const SYNC_ERROR_CODES = {
  NOT_CONFIGURED: 'SYNC_ERR_NOT_CONFIGURED',
  LOGIN_FAILED: 'SYNC_ERR_LOGIN',
  NO_SESSION: 'SYNC_ERR_NO_SESSION',
  INIT_FAILED: 'SYNC_ERR_INIT',
  DIR_NOT_FOUND: 'SYNC_ERR_DIR',
  REMOTE_READ: 'SYNC_ERR_REMOTE_READ',
  UPLOAD: 'SYNC_ERR_UPLOAD',
  DOWNLOAD: 'SYNC_ERR_DOWNLOAD',
  RECONCILE: 'SYNC_ERR_RECONCILE',
  PROFILE: 'SYNC_ERR_PROFILE',
};

/**
 * Create an Error carrying a stable sync error code.
 */
function syncError(code, message, cause) {
  const err = new Error(`${message} (${code})`);
  err.code = code;
  err.cause = cause;
  return err;
}

function formatSyncError(err) {
  if (err && err.code) return `[${err.code}] ${err.message}`;
  return err ? String(err.message || err) : 'Unknown sync error';
}

// Watch local database changes for live updates (sync, edits)
db.changes({
  since: 'now',
  live: true,
  include_docs: true
});

/**
 * Get local-only sync settings (not synchronized to remote server).
 */
export async function getSyncSettings() {
  try {
    return await db.get('_local/sync_settings');
  } catch (err) {
    if (err.status === 404) {
      return { email: '', password: '', username: '', avatarURL: '', enabled: false, homeAddress: null };
    }
    throw err;
  }
}

/**
 * Save sync settings locally.
 */
export async function saveSyncSettings(settings) {
  try {
    let existing;
    try {
      existing = await db.get('_local/sync_settings');
    } catch (e) {
      existing = null;
    }

    const doc = {
      _id: '_local/sync_settings',
      ...settings
    };
    if (existing) {
      doc._rev = existing._rev;
    }
    await db.put(doc);
  } catch (err) {
    console.error("Failed to save sync settings:", err);
    throw err;
  }
}

/**
 * Save a place in local database.
 */
export async function savePlace(id, placeObj) {
  try {
    let existingDoc = null;
    try {
      existingDoc = await db.get(id);
    } catch (err) {
      // New place
    }

    const doc = {
      _id: id,
      type: 'place',
      updatedAt: placeObj.updatedAt || Date.now(),
      name: placeObj.name || '',
      category: placeObj.category || 'poi',
      desc: placeObj.desc || '',
      lat: placeObj.lat,
      lng: placeObj.lng,
      createdAt: placeObj.createdAt || Date.now()
    };

    if (existingDoc) {
      doc._rev = existingDoc._rev;
      if (existingDoc.lastSynced) doc.lastSynced = existingDoc.lastSynced;
      if (existingDoc.synced) doc.synced = existingDoc.synced;
    }

    const response = await db.put(doc);
    triggerSyncReconciliation();
    return response;
  } catch (err) {
    console.error("Failed to save place:", err);
    throw err;
  }
}

/**
 * Load all places in the database.
 */
export async function loadAllPlaces() {
  try {
    const result = await db.allDocs({
      include_docs: true,
      startkey: 'place_',
      endkey: 'place_\ufff0'
    });

    return result.rows.map(row => {
      const doc = row.doc;
      return {
        id: doc._id,
        _rev: doc._rev,
        name: doc.name || '',
        category: doc.category || 'poi',
        desc: doc.desc || '',
        lat: doc.lat,
        lng: doc.lng,
        createdAt: doc.createdAt || Date.now(),
        updatedAt: doc.updatedAt || Date.now(),
        synced: doc.synced || false,
        lastSynced: doc.lastSynced
      };
    });
  } catch (err) {
    console.error("Failed to load places:", err);
    return [];
  }
}

/**
 * Delete a place from the local database.
 */
export async function deletePlaceFromDB(id) {
  try {
    const doc = await db.get(id);
    await db.remove(doc);

    // Track deletion
    const settings = await getSyncSettings();
    if (settings && settings.enabled) {
      await addToDeletedPlacesQueue(id);
      triggerSyncReconciliation();
    }
  } catch (err) {
    console.error("Failed to delete place from DB:", err);
    throw err;
  }
}

/**
 * Configure and start subscription and synchronization with Filen.
 */
export async function startSync(settings) {
  stopSync();

  if (!settings.enabled || (!settings.email && !settings.apiKey)) {
    updateSyncStatus('offline');
    return;
  }

  updateSyncStatus('syncing');
  await initFilenAndSync(settings);
}

/**
 * Stop any active synchronization.
 */
export function stopSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  filenClient = null;
  updateSyncStatus('offline');
}

/**
 * Clear all local data. Used for logging out.
 */
export async function destroyDatabase() {
  stopSync();
  await db.destroy();
  window.location.reload();
}

// --- Sync Reconciliation Logic for Filen ---

async function getDeletedPlacesQueue() {
  try {
    const doc = await db.get('_local/deleted_places');
    return doc.ids || [];
  } catch (err) {
    if (err.status === 404) {
      return [];
    }
    throw err;
  }
}

async function addToDeletedPlacesQueue(id) {
  try {
    let doc;
    try {
      doc = await db.get('_local/deleted_places');
    } catch (err) {
      if (err.status === 404) {
        doc = { _id: '_local/deleted_places', ids: [] };
      } else {
        throw err;
      }
    }
    if (!doc.ids.includes(id)) {
      doc.ids.push(id);
      await db.put(doc);
    }
  } catch (err) {
    console.error("Failed to add to deleted places queue:", err);
  }
}

async function removeFromDeletedPlacesQueue(id) {
  try {
    const doc = await db.get('_local/deleted_places');
    doc.ids = doc.ids.filter(item => item !== id);
    await db.put(doc);
  } catch (err) {
    if (err.status !== 404) {
      console.error("Failed to remove from deleted places queue:", err);
    }
  }
}

export function triggerSyncReconciliation() {
  if (!filenClient) return;
  queueSync();
}

function queueSync() {
  if (syncInProgress || !filenClient) return;
  syncInProgress = true;
  syncPromise = syncPromise.then(() => runSync()).catch(err => {
    console.error(`[Sync] Error in sync queue: ${formatSyncError(err)}`);
  }).finally(() => {
    syncInProgress = false;
  });
}

function updateSyncStatus(status, errorInfo = null) {
  currentSyncStatus = status;

  // Intermediate 'syncing' state is never worth logging (it fires every 30s tick).
  if (status === 'syncing') {
    window.dispatchEvent(new CustomEvent('maps-sync-status', { detail: status }));
    return;
  }

  // Only log on real transitions, deduplicating repeated errors by status+code.
  const key = errorInfo ? `${status}:${errorInfo.code}` : status;
  if (key !== lastReportedSyncKey) {
    lastReportedSyncKey = key;
    if (errorInfo) {
      const cause = errorInfo.cause ? ` (${errorInfo.cause})` : '';
      console.error(`[Sync] Status: ${status} [${errorInfo.code}] ${errorInfo.message}${cause}`);
    } else {
      console.log(`[Sync] Status: ${status}`);
    }
  }

  // Dispatch custom event to notify UI
  window.dispatchEvent(new CustomEvent('maps-sync-status', { detail: status }));
}

async function initFilenAndSync(settings) {
  try {
    filenClient = new FilenSDK({
      metadataCache: true
    });

    if (settings.apiKey && settings.masterKeys) {
      filenClient.init({
        apiKey: settings.apiKey,
        masterKeys: settings.masterKeys,
        publicKey: settings.publicKey,
        privateKey: settings.privateKey,
        baseFolderUUID: settings.baseFolderUUID,
        userId: settings.userId,
        authVersion: settings.authVersion,
        metadataCache: true
      });

      // Update profile info in background
      try {
        const accountInfo = await filenClient.user().account();
        if (accountInfo) {
          const nickname = accountInfo.nickName || accountInfo.displayName;
          const avatarURL = accountInfo.avatarURL || '';
          let changed = false;
          if (nickname && nickname !== settings.username) {
            settings.username = nickname;
            changed = true;
          }
          if (avatarURL !== settings.avatarURL) {
            settings.avatarURL = avatarURL;
            changed = true;
          }
          if (changed) {
            await saveSyncSettings(settings);
          }
        }
      } catch (e) {
        console.warn(`[Sync] Failed to update profile info in background [${SYNC_ERROR_CODES.PROFILE}]:`, e);
      }
    } else if (settings.email && settings.password) {
      try {
        await filenClient.login({
          email: settings.email,
          password: settings.password,
          twoFactorCode: settings.twoFactorCode || undefined
        });
      } catch (e) {
        throw syncError(SYNC_ERROR_CODES.LOGIN_FAILED, 'Filen login failed. Check your credentials and two-factor code.', e);
      }

      let nickname = settings.email.split('@')[0];
      let avatarURL = '';
      try {
        const accountInfo = await filenClient.user().account();
        if (accountInfo) {
          if (accountInfo.nickName) nickname = accountInfo.nickName;
          else if (accountInfo.displayName) nickname = accountInfo.displayName;
          if (accountInfo.avatarURL) avatarURL = accountInfo.avatarURL;
        }
      } catch (e) {
        console.warn(`[Sync] Failed to fetch profile info during login [${SYNC_ERROR_CODES.PROFILE}]:`, e);
      }

      const sessionSettings = {
        enabled: true,
        username: nickname,
        avatarURL: avatarURL,
        email: settings.email,
        apiKey: filenClient.config.apiKey,
        masterKeys: filenClient.config.masterKeys,
        publicKey: filenClient.config.publicKey,
        privateKey: filenClient.config.privateKey,
        baseFolderUUID: filenClient.config.baseFolderUUID,
        userId: filenClient.config.userId,
        authVersion: filenClient.config.authVersion
      };

      await saveSyncSettings(sessionSettings);
    } else {
      throw syncError(SYNC_ERROR_CODES.NO_SESSION, "No credentials or active session keys available");
    }

    // Ensure remote directory structures exist
    try {
      await filenClient.fs().mkdir({ path: FILEN_SYNC_DIR });
    } catch (e) { }

    queueSync();

    syncInterval = setInterval(() => {
      queueSync();
    }, 30000);

  } catch (err) {
    // Preserve a code already attached (e.g. LOGIN_FAILED), otherwise use INIT_FAILED.
    const code = (err && err.code) ? err.code : SYNC_ERROR_CODES.INIT_FAILED;
    const message = (err && err.code) ? err.message : 'Failed to initialize Filen SDK client';
    const cause = (err && err.code) ? err.cause : err;
    const coded = err && err.code ? err : syncError(code, message, cause);
    console.error(`[Sync] ${formatSyncError(coded)}`);
    updateSyncStatus('error', { code, message, cause });
    throw coded;
  }
}

async function runSync() {
  if (!filenClient) return;
  const settings = await getSyncSettings();
  if (!settings.enabled || !filenClient.isLoggedIn()) return;

  updateSyncStatus('syncing');

  try {
    // Resolve the parent directory UUID on Filen
    const parentUUID = await filenClient.fs().pathToItemUUID({
      path: FILEN_SYNC_DIR,
      type: 'directory'
    });

    if (!parentUUID) {
      throw syncError(SYNC_ERROR_CODES.DIR_NOT_FOUND, `Could not resolve directory UUID for ${FILEN_SYNC_DIR}.`);
    }

    // Fetch list of files in /Apps/maps
    let remoteFiles = [];
    try {
      remoteFiles = await filenClient.fs().readdir({ path: FILEN_SYNC_DIR });
    } catch (err) {
      if (err.message && err.message.includes('not found')) {
        await filenClient.fs().mkdir({ path: FILEN_SYNC_DIR });
        remoteFiles = [];
      } else {
        throw err;
      }
    }

    const placesFile = remoteFiles.find(name => name === 'places.json');
    let remoteStats = null;
    let remoteContent = null;

    if (placesFile) {
      try {
        remoteStats = await filenClient.fs().stat({ path: FILEN_SYNC_FILE });
        const dataBuffer = await filenClient.fs().readFile({ path: FILEN_SYNC_FILE });
        remoteContent = JSON.parse(dataBuffer.toString('utf-8'));
      } catch (err) {
        console.error(`[Sync] Error reading remote places.json [${SYNC_ERROR_CODES.REMOTE_READ}]:`, err);
      }
    }

    // Load all local places from PouchDB
    const localPlaces = await loadAllPlaces();
    const deletedQueue = await getDeletedPlacesQueue();

    // Determine modified timestamps
    let localMaxUpdated = 0;
    localPlaces.forEach(p => {
      if (p.updatedAt > localMaxUpdated) localMaxUpdated = p.updatedAt;
    });

    const localHome = MapService.getHomeAddress();
    if (localHome && localHome.updatedAt && localHome.updatedAt > localMaxUpdated) {
      localMaxUpdated = localHome.updatedAt;
    }

    const remoteMaxUpdated = (remoteContent && typeof remoteContent.updatedAt === 'number')
      ? remoteContent.updatedAt
      : (remoteStats ? remoteStats.mtimeMs : 0);

    const uploadLocal = async () => {
      const placesPayload = {
        updatedAt: Date.now(),
        homeAddress: MapService.getHomeAddress() || null,
        places: localPlaces.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          desc: p.desc,
          lat: p.lat,
          lng: p.lng,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        }))
      };

      const jsonStr = JSON.stringify(placesPayload);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const file = new File([blob], 'places.json', {
        type: 'application/json',
        lastModified: placesPayload.updatedAt
      });

      // If remote places.json exists, remove it first to overwrite it correctly
      if (placesFile) {
        try {
          await filenClient.fs().rm({ path: FILEN_SYNC_FILE, permanent: true });
        } catch (e) {
          console.warn("[Sync] Failed to remove old places.json before upload:", e);
        }
      }

      const item = await filenClient.cloud().uploadWebFile({
        file,
        parent: parentUUID,
        name: 'places.json'
      });

      // Mark all local places as synced
      for (const p of localPlaces) {
        const doc = await db.get(p.id);
        doc.synced = true;
        doc.lastSynced = Date.now();
        await db.put(doc);
      }

      // Clear local deleted queue since we uploaded the state
      for (const delId of deletedQueue) {
        await removeFromDeletedPlacesQueue(delId);
      }
    };

    const downloadRemote = async (remoteData) => {
      const remotePlaces = remoteData ? (remoteData.places || []) : [];
      
      // Update home address from remote if present
      if (remoteData && remoteData.homeAddress !== undefined) {
        const currentHome = MapService.getHomeAddress();
        if (remoteData.homeAddress) {
          if (!currentHome || (remoteData.homeAddress.updatedAt && (!currentHome.updatedAt || remoteData.homeAddress.updatedAt >= currentHome.updatedAt))) {
            MapService.setHomeAddress(remoteData.homeAddress, true);
          }
        } else if (currentHome && remoteMaxUpdated > (currentHome.updatedAt || 0)) {
          MapService.clearHomeAddress(true);
        }
      } else if (remotePlaces.length > 0) {
        const homePlace = remotePlaces.find(rp => rp.category === 'home');
        if (homePlace) {
          MapService.setHomeAddress({
            address: homePlace.name || `${homePlace.lat.toFixed(4)}, ${homePlace.lng.toFixed(4)}`,
            lat: homePlace.lat,
            lng: homePlace.lng,
            updatedAt: homePlace.updatedAt || Date.now()
          }, true);
        }
      }

      // Update local PouchDB with remote places
      const localMap = new Map(localPlaces.map(p => [p.id, p]));

      // 1. Process deletions based on what's missing in remote but was synced locally before
      for (const localP of localPlaces) {
        const inRemote = remotePlaces.some(rp => rp.id === localP.id);
        if (!inRemote && localP.lastSynced) {
          // Place was synced to remote before but is now gone from remote. Delete locally!
          const doc = await db.get(localP.id);
          await db.remove(doc);
        }
      }

      // 2. Add/update remote places locally
      for (const rp of remotePlaces) {
        // Skip if locally deleted and synced
        if (deletedQueue.includes(rp.id)) {
          continue;
        }

        const localP = localMap.get(rp.id);
        if (!localP || rp.updatedAt > localP.updatedAt) {
          // Remote is new or newer. Save locally
          let existingDoc = null;
          try {
            existingDoc = await db.get(rp.id);
          } catch (e) { }

          const doc = {
            _id: rp.id,
            type: 'place',
            name: rp.name,
            category: rp.category,
            desc: rp.desc,
            lat: rp.lat,
            lng: rp.lng,
            createdAt: rp.createdAt,
            updatedAt: rp.updatedAt,
            synced: true,
            lastSynced: Date.now()
          };

          if (existingDoc) {
            doc._rev = existingDoc._rev;
          }

          await db.put(doc);
        }
      }

      // 3. Clear local deleted queue for IDs that are not present in remote anyway
      for (const delId of deletedQueue) {
        const inRemote = remotePlaces.some(rp => rp.id === delId);
        if (!inRemote) {
          await removeFromDeletedPlacesQueue(delId);
        }
      }

      // Dispatch custom events to notify UI and markers
      window.dispatchEvent(new CustomEvent('maps-home-updated'));
      window.dispatchEvent(new CustomEvent('maps-places-updated'));
    };

    if (deletedQueue.length > 0) {
      // Local deletions occurred, always upload to overwrite remote file
      try {
        await uploadLocal();
      } catch (err) {
        throw syncError(SYNC_ERROR_CODES.UPLOAD, 'Failed to upload local changes to Filen', err);
      }
    } else if (!placesFile) {
      // Remote file does not exist, upload local data
      if (localPlaces.length > 0 || localHome) {
        try {
          await uploadLocal();
        } catch (err) {
          throw syncError(SYNC_ERROR_CODES.UPLOAD, 'Failed to upload local changes to Filen', err);
        }
      }
    } else if (localMaxUpdated > remoteMaxUpdated) {
      // Local changes are newer, upload
      try {
        await uploadLocal();
      } catch (err) {
        throw syncError(SYNC_ERROR_CODES.UPLOAD, 'Failed to upload local changes to Filen', err);
      }
    } else if (remoteMaxUpdated > localMaxUpdated) {
      // Remote changes are newer, download
      try {
        await downloadRemote(remoteContent);
      } catch (err) {
        throw syncError(SYNC_ERROR_CODES.DOWNLOAD, 'Failed to apply remote changes locally', err);
      }
    } else {
      // Timestamps equal, ensure local markers are marked synced
      let updatedAny = false;
      for (const p of localPlaces) {
        if (!p.synced) {
          const doc = await db.get(p.id);
          doc.synced = true;
          doc.lastSynced = Date.now();
          await db.put(doc);
          updatedAny = true;
        }
      }
    }

    updateSyncStatus('online');
  } catch (err) {
    // Preserve a code already attached (e.g. UPLOAD/DOWNLOAD/DIR_NOT_FOUND), else RECONCILE.
    const code = (err && err.code) ? err.code : SYNC_ERROR_CODES.RECONCILE;
    const message = (err && err.code) ? err.message : 'Error during sync reconciliation';
    const cause = (err && err.code) ? err.cause : err;
    const coded = err && err.code ? err : syncError(code, message, cause);
    console.error(`[Sync] ${formatSyncError(coded)}`);
    updateSyncStatus('error', { code, message, cause });
  }
}

window.addEventListener('maps-home-updated', () => {
  triggerSyncReconciliation();
});
