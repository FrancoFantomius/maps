// tests/markers.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarkerController } from '../js/markers/index.js';
import { MapService } from '../js/map/index.js';
import { savePlace, deletePlaceFromDB, loadAllPlaces } from '../js/db/index.js';

vi.mock('../js/map/index.js', () => ({
  MapService: {
    createMarker: vi.fn(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      setPopup: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
    createPopup: vi.fn(() => ({
      setHTML: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
    getHomeAddress: vi.fn().mockReturnValue(null),
    map: {},
  },
}));

vi.mock('../js/db/index.js', () => ({
  savePlace: vi.fn().mockResolvedValue({ id: 'marker_123' }),
  deletePlaceFromDB: vi.fn().mockResolvedValue(true),
  loadAllPlaces: vi.fn().mockResolvedValue([]),
}));

describe('MarkerController', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="marker-modal" class="hidden"></div>
      <input id="modal-lat" />
      <input id="modal-lng" />
      <input id="modal-id" />
      <input id="modal-name" />
      <select id="modal-category">
        <option value="poi">POI</option>
        <option value="food">Food</option>
      </select>
      <input id="modal-desc" />
      <h3 id="modal-title"></h3>
    `;
    MarkerController.customMarkers = [];
    MarkerController.markerInstances = [];
    MarkerController.tempMarker = null;
    MarkerController.homeMarkerInstance = null;
    vi.clearAllMocks();
  });

  describe('createPin', () => {
    it('creates pin DOM element with category styling and emoji', () => {
      const pinEl = MarkerController.createPin('food');

      expect(pinEl).toBeInstanceOf(HTMLElement);
      expect(pinEl.className).toBe('custom-map-pin-div');
      expect(pinEl.innerHTML).toContain('🍕');
    });
  });

  describe('setTempMarker & removeTempMarker', () => {
    it('sets a temporary marker on the map', () => {
      MarkerController.setTempMarker(45.438, 10.993);

      expect(MapService.createMarker).toHaveBeenCalled();
      expect(MarkerController.tempMarker).not.toBeNull();
    });

    it('removes temporary marker if exists', () => {
      MarkerController.setTempMarker(45.438, 10.993);
      const markerRef = MarkerController.tempMarker;

      MarkerController.removeTempMarker();

      expect(markerRef.remove).toHaveBeenCalled();
      expect(MarkerController.tempMarker).toBeNull();
    });
  });

  describe('openModal', () => {
    it('populates modal fields for new marker creation', () => {
      MarkerController.openModal(45.438, 10.993);

      expect(document.getElementById('modal-lat').value).toBe('45.438');
      expect(document.getElementById('modal-lng').value).toBe('10.993');
      expect(document.getElementById('modal-id').value).toBe('');
      expect(document.getElementById('modal-title').innerText).toBe('Save Location');
    });

    it('populates modal fields for editing existing marker', () => {
      MarkerController.customMarkers = [
        { id: 'm1', name: 'Pizza Place', category: 'food', desc: 'Delicious pizza', lat: 45.4, lng: 10.9 },
      ];

      MarkerController.openModal(45.4, 10.9, 'm1');

      expect(document.getElementById('modal-id').value).toBe('m1');
      expect(document.getElementById('modal-name').value).toBe('Pizza Place');
      expect(document.getElementById('modal-category').value).toBe('food');
      expect(document.getElementById('modal-desc').value).toBe('Delicious pizza');
      expect(document.getElementById('modal-title').innerText).toBe('Edit Marker');
    });
  });

  describe('renderAll', () => {
    it('handles renderAll gracefully even when markers-count or saved-markers-list are missing or present', () => {
      expect(() => MarkerController.renderAll()).not.toThrow();

      document.body.innerHTML += `
        <div id="saved-markers-list"></div>
        <span id="place-count-badge">0</span>
        <template id="template-marker-list-item">
          <div class="marker-item">
            <span class="marker-color-dot"></span>
            <span class="marker-name"></span>
            <button class="marker-focus"></button>
            <button class="btn-delete-marker"></button>
          </div>
        </template>
      `;

      MarkerController.customMarkers = [
        { id: 'm1', name: 'Place 1', category: 'poi', lat: 10, lng: 20 }
      ];

      expect(() => MarkerController.renderAll()).not.toThrow();
      expect(String(document.getElementById('place-count-badge').innerText)).toBe('1');
    });
  });
});
