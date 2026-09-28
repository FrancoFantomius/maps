// tests/db.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { saveSyncSettings, getSyncSettings, savePlace, loadAllPlaces, deletePlaceFromDB, startSync, stopSync, FILEN_SYNC_DIR, FILEN_SYNC_FILE } from '../js/db/index.js';

describe('db module', () => {
  beforeEach(async () => {
    // Clear out settings and places if any exist
    try {
      const settings = await getSyncSettings();
      if (settings._rev) {
        await saveSyncSettings({ email: '', password: '', homeAddress: null });
      }
    } catch (e) {
      // Ignore initial error
    }
  });

  describe('Sync settings local storage', () => {
    it('retrieves default settings when not saved yet', async () => {
      const settings = await getSyncSettings();
      expect(settings).toBeDefined();
      expect(settings.email).toBeDefined();
    });

    it('saves and retrieves sync settings with storage quota', async () => {
      await saveSyncSettings({
        email: 'test@example.com',
        homeAddress: { lat: 45.438, lng: 10.993, address: 'Verona' },
        storageTotal: 50 * 1024 * 1024 * 1024,
        storageUsed: 5 * 1024 * 1024 * 1024
      });

      const updated = await getSyncSettings();
      expect(updated.email).toBe('test@example.com');
      expect(updated.homeAddress).toEqual({ lat: 45.438, lng: 10.993, address: 'Verona' });
      expect(updated.storageTotal).toBe(50 * 1024 * 1024 * 1024);
      expect(updated.storageUsed).toBe(5 * 1024 * 1024 * 1024);
    });
  });

  describe('Places storage', () => {
    it('saves a place and retrieves it in loadAllPlaces', async () => {
      const placeId = 'place_' + Date.now();
      await savePlace(placeId, {
        name: 'Arena di Verona',
        category: 'poi',
        desc: 'Roman amphitheatre',
        lat: 45.438,
        lng: 10.993,
      });

      const places = await loadAllPlaces();
      const match = places.find(p => p.id === placeId);
      expect(match).toBeDefined();
      expect(match.name).toBe('Arena di Verona');

      // Cleanup
      await deletePlaceFromDB(placeId);
    });

    it('deletes a place from the database', async () => {
      const placeId = 'place_delete_' + Date.now();
      await savePlace(placeId, {
        name: 'Temporary Place',
        lat: 45.0,
        lng: 10.0,
      });

      await deletePlaceFromDB(placeId);

      const places = await loadAllPlaces();
      const match = places.find(p => p.id === placeId);
      expect(match).toBeUndefined();
    });
  });

  describe('Sync lifecycle and status events', () => {
    it('does not dispatch duplicate sync status events when status has not changed', async () => {
      const events = [];
      const listener = (e) => events.push(e.detail);
      window.addEventListener('maps-sync-status', listener);

      stopSync();
      stopSync();
      await startSync({ enabled: false });

      // Only one offline event should be triggered if already offline or transitioning to offline
      expect(events.filter(status => status === 'offline').length).toBeLessThanOrEqual(1);

      window.removeEventListener('maps-sync-status', listener);
    });
  });

  describe('Filen cloud sync directory configuration', () => {
    it('uses Apps/maps as the Filen cloud sync directory', () => {
      expect(FILEN_SYNC_DIR).toBe('/Apps/maps');
      expect(FILEN_SYNC_FILE).toBe('/Apps/maps/places.json');
    });
  });

  describe('Paths storage', () => {
    it('saves a path and retrieves it in loadAllPaths', async () => {
      const { savePath, loadAllPaths, deletePathFromDB } = await import('../js/db/index.js');
      const pathId = 'path_' + Date.now();
      await savePath(pathId, {
        name: 'River Path',
        points: [{ lat: 45.438, lng: 10.993 }, { lat: 45.440, lng: 10.995 }],
        distance: 250,
        mode: 'path'
      });

      const paths = await loadAllPaths();
      const match = paths.find(p => p.id === pathId);
      expect(match).toBeDefined();
      expect(match.name).toBe('River Path');
      expect(match.points.length).toBe(2);
      expect(match.distance).toBe(250);

      // Cleanup
      await deletePathFromDB(pathId);
    });

    it('deletes a path from the database', async () => {
      const { savePath, loadAllPaths, deletePathFromDB } = await import('../js/db/index.js');
      const pathId = 'path_delete_' + Date.now();
      await savePath(pathId, {
        name: 'Temporary Path',
        points: [{ lat: 45.0, lng: 10.0 }, { lat: 45.1, lng: 10.1 }]
      });

      await deletePathFromDB(pathId);

      const paths = await loadAllPaths();
      const match = paths.find(p => p.id === pathId);
      expect(match).toBeUndefined();
    });
  });
});


