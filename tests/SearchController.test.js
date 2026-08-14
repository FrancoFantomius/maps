// tests/SearchController.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchController } from '../js/SearchController.js';
import { MapService } from '../js/MapService.js';
import { MarkerController } from '../js/MarkerController.js';
import { HUDController } from '../js/HUDController.js';

const mockMarkerInstance = {
  setLngLat: vi.fn().mockReturnThis(),
  setPopup: vi.fn().mockReturnThis(),
  addTo: vi.fn().mockReturnThis(),
  remove: vi.fn().mockReturnThis(),
};

const mockPopupInstance = {
  setHTML: vi.fn().mockReturnThis(),
  addTo: vi.fn().mockReturnThis(),
  remove: vi.fn().mockReturnThis(),
};

vi.mock('../js/MapService.js', () => ({
  MapService: {
    map: {},
    flyTo: vi.fn(),
    fitBounds: vi.fn(),
    createMarker: vi.fn(() => mockMarkerInstance),
    createPopup: vi.fn(() => mockPopupInstance),
  },
}));

vi.mock('../js/MarkerController.js', () => ({
  MarkerController: {
    setTempMarker: vi.fn(),
  },
}));

vi.mock('../js/HUDController.js', () => ({
  HUDController: {
    setState: vi.fn(),
  },
}));

describe('SearchController', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="search-input" value="" />
      <div id="search-results" class="hidden"></div>
      <template id="template-search-result-item">
        <div class="search-result-item">
          <span class="result-name"></span>
          <span class="result-address"></span>
        </div>
      </template>
    `;
    vi.clearAllMocks();
  });

  it('renders search results into the DOM and creates map pins', () => {
    const results = [
      { display_name: 'Piazza Bra, Verona, Italy', lat: '45.438', lon: '10.993' },
      { display_name: 'Piazza San Marco, Venice, Italy', lat: '45.434', lon: '12.338' },
    ];

    SearchController.renderResults(results);

    const searchResults = document.getElementById('search-results');
    expect(searchResults.classList.contains('hidden')).toBe(false);

    const items = searchResults.querySelectorAll('.search-result-item');
    expect(items.length).toBe(2);

    expect(items[0].querySelector('.result-name').textContent).toBe('Piazza Bra');
    expect(items[0].querySelector('.result-address').textContent).toBe('Piazza Bra, Verona, Italy');

    expect(MapService.createMarker).toHaveBeenCalledTimes(2);
    expect(SearchController.searchMarkers.length).toBe(2);
    expect(MapService.fitBounds).toHaveBeenCalledWith(
      [[10.993, 45.434], [12.338, 45.438]],
      { padding: 80, maxZoom: 15 }
    );
  });

  it('handles clicking a result item in search list', () => {
    const results = [
      { display_name: 'Piazza Bra, Verona, Italy', lat: '45.438', lon: '10.993' },
    ];

    SearchController.renderResults(results);

    const item = document.querySelector('.search-result-item');
    item.click();

    expect(MapService.flyTo).toHaveBeenCalledWith([10.993, 45.438], 14);
    expect(document.getElementById('search-input').value).toBe('Piazza Bra');
    expect(MarkerController.setTempMarker).toHaveBeenCalledWith(45.438, 10.993);
    expect(HUDController.setState).toHaveBeenCalledWith('place-details', expect.objectContaining({
      name: 'Piazza Bra',
      lat: 45.438,
      lng: 10.993,
    }));
  });

  it('handles clicking a search result pin on the map', () => {
    const results = [
      { display_name: 'Colosseum, Rome, Italy', lat: '41.8902', lon: '12.4922' },
    ];

    SearchController.renderResults(results);

    // Get the pin element passed to createMarker
    const pinEl = MapService.createMarker.mock.calls[0][0];
    expect(pinEl).toBeTruthy();

    pinEl.click();

    expect(MapService.flyTo).toHaveBeenCalledWith([12.4922, 41.8902], 14);
    expect(document.getElementById('search-input').value).toBe('Colosseum');
    expect(MarkerController.setTempMarker).toHaveBeenCalledWith(41.8902, 12.4922);
    expect(HUDController.setState).toHaveBeenCalledWith('place-details', expect.objectContaining({
      name: 'Colosseum',
      lat: 41.8902,
      lng: 12.4922,
    }));
  });

  it('clears search markers from map', () => {
    const results = [
      { display_name: 'Piazza Bra, Verona, Italy', lat: '45.438', lon: '10.993' },
    ];

    SearchController.renderResults(results);
    expect(SearchController.searchMarkers.length).toBe(1);

    SearchController.clearSearchMarkers();
    expect(mockMarkerInstance.remove).toHaveBeenCalled();
    expect(SearchController.searchMarkers.length).toBe(0);
  });
});

