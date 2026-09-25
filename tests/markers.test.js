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
    flyTo: vi.fn(),
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
    it('handles M3 md-dialog methods if available', () => {
      const modal = document.getElementById('marker-modal');
      modal.showModal = vi.fn();
      modal.close = vi.fn();

      MarkerController.openModal(45.438, 10.993);
      expect(modal.showModal).toHaveBeenCalled();
      expect(modal.headline).toBe('Save Location');

      MarkerController.closeModal();
      expect(modal.close).toHaveBeenCalled();
    });
  });

  describe('saveFromForm', () => {
    it('saves a new marker from form fields and calls savePlace', async () => {
      document.getElementById('modal-lat').value = '45.123';
      document.getElementById('modal-lng').value = '10.456';
      document.getElementById('modal-name').value = 'Test Cafe';
      document.getElementById('modal-category').value = 'food';
      document.getElementById('modal-desc').value = 'Great espresso';

      const saved = await MarkerController.saveFromForm();

      expect(savePlace).toHaveBeenCalledWith(expect.stringContaining('place_'), expect.objectContaining({
        name: 'Test Cafe',
        category: 'food',
        desc: 'Great espresso',
        lat: 45.123,
        lng: 10.456
      }));
      expect(saved.name).toBe('Test Cafe');
    });
  });

  describe('renderAll and renderListItem', () => {
    it('handles renderAll gracefully even when markers-count or saved-markers-list are missing or present', () => {
      expect(() => MarkerController.renderAll()).not.toThrow();

      document.body.innerHTML += `
        <div id="saved-markers-list"></div>
        <span id="place-count-badge">0</span>
        <template id="template-marker-list-item">
          <div class="marker-item">
            <span class="marker-color-dot"></span>
            <span class="marker-category-emoji"></span>
            <span class="marker-name"></span>
            <span class="marker-subtext"></span>
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

    it('renders empty state when there are no saved places', () => {
      document.body.innerHTML += `
        <div id="saved-markers-list"></div>
        <span id="place-count-badge">0</span>
      `;

      MarkerController.customMarkers = [];
      MarkerController.renderAll();

      const listEl = document.getElementById('saved-markers-list');
      expect(listEl.innerHTML).toContain('markers-empty-state');
      expect(listEl.innerHTML).toContain('No saved places yet');
    });

    it('renders M3 list item with emoji, color dot, name, and subtext', () => {
      document.body.innerHTML += `
        <div id="saved-markers-list"></div>
        <template id="template-marker-list-item">
          <div class="marker-item">
            <span class="marker-color-dot"></span>
            <span class="marker-category-emoji"></span>
            <span class="marker-name"></span>
            <span class="marker-subtext"></span>
            <button class="marker-focus"></button>
            <button class="btn-delete-marker"></button>
          </div>
        </template>
      `;

      MarkerController.customMarkers = [
        { id: 'm1', name: 'Gelato Bar', category: 'food', desc: 'Best pistacchio', lat: 45.4, lng: 10.9 }
      ];

      MarkerController.renderAll();

      const listEl = document.getElementById('saved-markers-list');
      expect(listEl.querySelector('.marker-name').textContent).toBe('Gelato Bar');
      expect(listEl.querySelector('.marker-category-emoji').textContent).toBe('🍕');
      expect(listEl.querySelector('.marker-subtext').textContent).toBe('Best pistacchio');
      expect(listEl.querySelector('.marker-color-dot').style.backgroundColor).toBeTruthy();
    });

    it('deletes marker on delete button click', async () => {
      document.body.innerHTML += `
        <div id="saved-markers-list"></div>
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
        { id: 'm1', name: 'Place to Delete', category: 'poi', lat: 10, lng: 20 }
      ];
      MarkerController.renderAll();

      const deleteBtn = document.querySelector('.btn-delete-marker');
      deleteBtn.click();

      expect(deletePlaceFromDB).toHaveBeenCalledWith('m1');
    });
  });
});
