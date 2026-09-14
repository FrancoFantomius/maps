/**
 * Maps - Places Database Module
 */

import { db } from './index.js';
import { getSyncSettings } from './IO.js';
import { triggerSyncReconciliation } from './sync.js';

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
 * Get IDs of deleted places awaiting synchronization.
 */
export async function getDeletedPlacesQueue() {
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

/**
 * Add place ID to deleted queue.
 */
export async function addToDeletedPlacesQueue(id) {
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

/**
 * Remove place ID from deleted queue.
 */
export async function removeFromDeletedPlacesQueue(id) {
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

