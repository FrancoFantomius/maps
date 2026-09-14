/**
 * Maps - Database & Sync Module - js/db/index.js (PouchDB wrapper)
 */

import PouchDB from 'pouchdb';
import { stopSync } from './sync.js';

// Initialize PouchDB local database
export const db = new PouchDB('maps_db');

// Watch local database changes for live updates (sync, edits)
db.changes({
  since: 'now',
  live: true,
  include_docs: true
});

/**
 * Clear all local data. Used for logging out.
 */
export async function destroyDatabase() {
  stopSync();
  await db.destroy();
  window.location.reload();
}

export * from './IO.js';
export * from './places.js';
export * from './sync.js';

export default db;
