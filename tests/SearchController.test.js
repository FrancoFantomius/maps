// tests/SearchController.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchController } from '../js/SearchController.js';
import { MapService } from '../js/MapService.js';
import { MarkerController } from '../js/MarkerController.js';
import { HUDController } from '../js/HUDController.js';
import { GPSController } from '../js/GPSController.js';

let createdMarkers = [];

vi.mock('../js/MapService.js', () => ({
  MapService: {
    flyTo: vi.fn(),
    fitBounds: vi.fn(),
    getCenter: vi.fn(),
    getBounds: vi.fn(),
    getHomeAddress: vi.fn(),
    map: {},
    createMarker: vi.fn((el) => {
      const marker = {
        element: el,
        lngLat: null,
        popup: null,
        setLngLat: vi.fn().mockImplementation((coords) => {
          marker.lngLat = coords;
          return marker;
        }),
        setPopup: vi.fn().mockImplementation((pop) => {
          marker.popup = pop;
          return marker;
        }),
        addTo: vi.fn().mockImplementation(() => marker),
        remove: vi.fn(),
      };
      createdMarkers.push(marker);
      return marker;
    }),
    createPopup: vi.fn(() => ({
      setHTML: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
  },
}));

vi.mock('../js/GPSController.js', () => ({
  GPSController: {
    gpsCoords: null,
  },
}));

vi.mock('../js/MarkerController.js', () => ({
  MarkerController: {
    setTempMarker: vi.fn(),
    createPin: vi.fn((category, colorOverride, content) => {
      const div = document.createElement('div');
      div.className = 'custom-map-pin-div';
      div.dataset.content = content;
      div.dataset.color = colorOverride;
      return div;
    }),
  },
}));

vi.mock('../js/HUDController.js', () => ({
  HUDController: {
    setState: vi.fn(),
  },
}));

describe('SearchController', () => {
  beforeEach(() => {
    createdMarkers = [];
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
    SearchController.searchMarkers = [];
    SearchController.searchResults = [];
    GPSController.gpsCoords = null;
    MapService.getCenter.mockReturnValue(null);
    MapService.getBounds.mockReturnValue(null);
    MapService.getHomeAddress.mockReturnValue(null);
    MapService.map = {};
    vi.clearAllMocks();
  });

  it('renders search results into the DOM and creates map pins with index numbers', () => {
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

    expect(MarkerController.createPin).toHaveBeenCalledTimes(2);
    expect(MarkerController.createPin).toHaveBeenNthCalledWith(1, 'poi', '#ef4444', 1);
    expect(MarkerController.createPin).toHaveBeenNthCalledWith(2, 'poi', '#ef4444', 2);

    expect(MapService.createMarker).toHaveBeenCalledTimes(2);
    expect(SearchController.searchMarkers.length).toBe(2);
    expect(MapService.fitBounds).toHaveBeenCalledWith(
      [[10.993, 45.434], [12.338, 45.438]],
      80
    );
  });

  it('handles clicking a result list item', () => {
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

  it('handles clicking a search pin on the map with identical behavior to clicking result item', () => {
    const results = [
      { display_name: 'Colosseum, Rome, Italy', lat: '41.8902', lon: '12.4922' },
    ];

    SearchController.renderResults(results);

    expect(SearchController.searchMarkers.length).toBe(1);
    const pinMarker = createdMarkers[0];
    const pinEl = pinMarker.element;

    // Simulate clicking the pin element on the map
    pinEl.click();

    expect(MapService.flyTo).toHaveBeenCalledWith([12.4922, 41.8902], 14);
    expect(document.getElementById('search-input').value).toBe('Colosseum');
    expect(MarkerController.setTempMarker).toHaveBeenCalledWith(41.8902, 12.4922);
    expect(HUDController.setState).toHaveBeenCalledWith('place-details', expect.objectContaining({
      name: 'Colosseum',
      lat: 41.8902,
      lng: 12.4922,
      address: 'Colosseum, Rome, Italy',
      isTemp: true,
    }));
  });

  it('enriches search result with Overpass shop details and Wikipedia summary', async () => {
    HUDController.currentState = 'place-details';
    const results = [
      {
        display_name: 'Pizzeria da Gino, Via Roma 1, Verona, Italy',
        lat: '45.438',
        lon: '10.993',
        class: 'amenity',
        type: 'restaurant',
      },
    ];

    SearchController.renderResults(results);

    const item = document.querySelector('.search-result-item');
    item.click();

    expect(HUDController.setState).toHaveBeenCalledWith('place-details', expect.objectContaining({
      name: 'Pizzeria da Gino',
      lat: 45.438,
      lng: 10.993,
    }));
  });

  describe('getUserLocation precedence', () => {
    it('returns Current view location when MapService.getCenter is available', () => {
      MapService.getCenter.mockReturnValue({ lat: 45.438, lng: 10.993 });
      GPSController.gpsCoords = { lat: 41.902, lng: 12.496 };
      MapService.getHomeAddress.mockReturnValue({ lat: 40.851, lng: 14.268 });

      const loc = SearchController.getUserLocation();
      expect(loc).toEqual({ lat: 45.438, lng: 10.993, source: 'view' });
    });

    it('returns Current view location when MapService.map.getCenter is available', () => {
      MapService.getCenter.mockReturnValue(null);
      MapService.map = { getCenter: vi.fn(() => ({ lat: 45.438, lng: 10.993 })) };
      GPSController.gpsCoords = { lat: 41.902, lng: 12.496 };
      MapService.getHomeAddress.mockReturnValue({ lat: 40.851, lng: 14.268 });

      const loc = SearchController.getUserLocation();
      expect(loc).toEqual({ lat: 45.438, lng: 10.993, source: 'view' });
    });

    it('returns GPS location when Current view is unavailable', () => {
      MapService.getCenter.mockReturnValue(null);
      MapService.map = {};
      GPSController.gpsCoords = { lat: 41.902, lng: 12.496 };
      MapService.getHomeAddress.mockReturnValue({ lat: 40.851, lng: 14.268 });

      const loc = SearchController.getUserLocation();
      expect(loc).toEqual({ lat: 41.902, lng: 12.496, source: 'gps' });
    });

    it('returns Home address when Current view and GPS are unavailable', () => {
      MapService.getCenter.mockReturnValue(null);
      MapService.map = {};
      GPSController.gpsCoords = null;
      MapService.getHomeAddress.mockReturnValue({ lat: 40.851, lng: 14.268, address: 'Via Toledo, Naples' });

      const loc = SearchController.getUserLocation();
      expect(loc).toEqual({ lat: 40.851, lng: 14.268, source: 'home' });
    });

    it('returns null when neither Current view, GPS, nor Home address are available', () => {
      MapService.getCenter.mockReturnValue(null);
      MapService.map = {};
      GPSController.gpsCoords = null;
      MapService.getHomeAddress.mockReturnValue(null);

      const loc = SearchController.getUserLocation();
      expect(loc).toBeNull();
    });
  });

  describe('prioritizeResults by proximity', () => {
    it('prioritizes results closer to the derived user location', () => {
      // User is located in Venice (45.434, 12.338)
      MapService.getCenter.mockReturnValue({ lat: 45.434, lng: 12.338 });

      const results = [
        { display_name: 'Colosseum, Rome, Italy', lat: '41.8902', lon: '12.4922' }, // ~393 km
        { display_name: 'Piazza San Marco, Venice, Italy', lat: '45.434', lon: '12.338' }, // ~0 km (closest)
        { display_name: 'Piazza Bra, Verona, Italy', lat: '45.438', lon: '10.993' }, // ~105 km
      ];

      const prioritized = SearchController.prioritizeResults(results);

      expect(prioritized.map(r => r.display_name)).toEqual([
        'Piazza San Marco, Venice, Italy',
        'Piazza Bra, Verona, Italy',
        'Colosseum, Rome, Italy',
      ]);
    });

    it('automatically sorts results closer to the user when renderResults is called', () => {
      // User is in Verona (45.438, 10.993)
      MapService.getCenter.mockReturnValue({ lat: 45.438, lng: 10.993 });

      const results = [
        { display_name: 'Colosseum, Rome, Italy', lat: '41.8902', lon: '12.4922' },
        { display_name: 'Piazza Bra, Verona, Italy', lat: '45.438', lon: '10.993' },
      ];

      SearchController.renderResults(results);

      const searchResults = document.getElementById('search-results');
      const items = searchResults.querySelectorAll('.search-result-item');

      // Closest result (Piazza Bra, Verona) should be index 0 (Pin 1)
      expect(items[0].querySelector('.result-name').textContent).toBe('Piazza Bra');
      expect(items[1].querySelector('.result-name').textContent).toBe('Colosseum');
      expect(SearchController.searchResults[0].display_name).toBe('Piazza Bra, Verona, Italy');
    });

    it('places items with invalid coordinates at the end without throwing errors', () => {
      MapService.getCenter.mockReturnValue({ lat: 45.438, lng: 10.993 });

      const results = [
        { display_name: 'Unknown Place', lat: 'invalid', lon: 'invalid' },
        { display_name: 'Piazza Bra, Verona, Italy', lat: '45.438', lon: '10.993' },
      ];

      const prioritized = SearchController.prioritizeResults(results);

      expect(prioritized[0].display_name).toBe('Piazza Bra, Verona, Italy');
      expect(prioritized[1].display_name).toBe('Unknown Place');
    });

    it('preserves results order when user location is null', () => {
      MapService.getCenter.mockReturnValue(null);
      MapService.map = {};
      GPSController.gpsCoords = null;
      MapService.getHomeAddress.mockReturnValue(null);

      const results = [
        { display_name: 'Colosseum, Rome, Italy', lat: '41.8902', lon: '12.4922' },
        { display_name: 'Piazza Bra, Verona, Italy', lat: '45.438', lon: '10.993' },
      ];

      const prioritized = SearchController.prioritizeResults(results);
      expect(prioritized.map(r => r.display_name)).toEqual([
        'Colosseum, Rome, Italy',
        'Piazza Bra, Verona, Italy',
      ]);
    });
  });
});

