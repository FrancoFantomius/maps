/**
 * Maps - Saved Paths Database Module
 */

import { db } from './index.js';
import { getSyncSettings } from './IO.js';
import { triggerSyncReconciliation } from './sync.js';

/**
 * Save a path in the local database.
 *
 * @param {string} id
 * @param {object} pathObj
 * @returns {Promise<object>}
 */
export async function savePath(id, pathObj) {
  try {
    let existingDoc = null;
    try {
      existingDoc = await db.get(id);
    } catch (err) {
      // New path
    }

    const doc = {
      _id: id,
      type: 'path',
      name: pathObj.name || 'Untitled Path',
      gpx: pathObj.gpx || '',
      points: Array.isArray(pathObj.points) ? pathObj.points : [],
      distance: typeof pathObj.distance === 'number' ? pathObj.distance : 0,
      mode: pathObj.mode || 'path',
      createdAt: pathObj.createdAt || Date.now(),
      updatedAt: pathObj.updatedAt || Date.now()
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
    console.error("Failed to save path:", err);
    throw err;
  }
}

/**
 * Load all saved paths from the database.
 *
 * @returns {Promise<Array<object>>}
 */
export async function loadAllPaths() {
  try {
    const result = await db.allDocs({
      include_docs: true,
      startkey: 'path_',
      endkey: 'path_\ufff0'
    });

    return result.rows.map(row => {
      const doc = row.doc;
      return {
        id: doc._id,
        _rev: doc._rev,
        name: doc.name || 'Untitled Path',
        gpx: doc.gpx || '',
        points: Array.isArray(doc.points) ? doc.points : [],
        distance: typeof doc.distance === 'number' ? doc.distance : 0,
        mode: doc.mode || 'path',
        createdAt: doc.createdAt || Date.now(),
        updatedAt: doc.updatedAt || Date.now(),
        synced: doc.synced || false,
        lastSynced: doc.lastSynced
      };
    });
  } catch (err) {
    console.error("Failed to load paths:", err);
    return [];
  }
}

/**
 * Delete a path from the local database.
 *
 * @param {string} id
 */
export async function deletePathFromDB(id) {
  try {
    const doc = await db.get(id);
    const pathName = doc.name || '';
    await db.remove(doc);

    // Track deletion for Filen sync
    const settings = await getSyncSettings();
    if (settings && settings.enabled) {
      await addToDeletedPathsQueue(id, pathName);
      triggerSyncReconciliation();
    }
  } catch (err) {
    console.error("Failed to delete path from DB:", err);
    throw err;
  }
}

/**
 * Get items of deleted paths awaiting synchronization.
 *
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function getDeletedPathsQueue() {
  try {
    const doc = await db.get('_local/deleted_paths');
    return doc.items || [];
  } catch (err) {
    if (err.status === 404) {
      return [];
    }
    throw err;
  }
}

/**
 * Add path ID and filename to deleted queue.
 *
 * @param {string} id
 * @param {string} name
 */
export async function addToDeletedPathsQueue(id, name) {
  try {
    let doc;
    try {
      doc = await db.get('_local/deleted_paths');
    } catch (err) {
      if (err.status === 404) {
        doc = { _id: '_local/deleted_paths', items: [] };
      } else {
        throw err;
      }
    }
    if (!doc.items.some(item => item.id === id)) {
      doc.items.push({ id, name: name || '' });
      await db.put(doc);
    }
  } catch (err) {
    console.error("Failed to add to deleted paths queue:", err);
  }
}

/**
 * Remove path ID from deleted queue.
 *
 * @param {string} id
 */
export async function removeFromDeletedPathsQueue(id) {
  try {
    const doc = await db.get('_local/deleted_paths');
    doc.items = (doc.items || []).filter(item => item.id !== id);
    await db.put(doc);
  } catch (err) {
    if (err.status !== 404) {
      console.error("Failed to remove from deleted paths queue:", err);
    }
  }
}
