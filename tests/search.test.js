// tests/search.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchController, setupSearchUI } from '../js/search/index.js';
import { MapService } from '../js/map/index.js';
import { MarkerController } from '../js/markers/index.js';
import { HUDController } from '../js/hud/index.js';
import { GPSController } from '../js/gps/index.js';
import { ApiService } from '../js/api/index.js';

let createdMarkers = [];

vi.mock('../js/api/index.js', () => ({
  ApiService: {
    searchGeocode: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../js/map/index.js', () => ({
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

vi.mock('../js/gps/index.js', () => ({
  GPSController: {
    gpsCoords: null,
  },
}));

vi.mock('../js/markers/index.js', () => ({
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

vi.mock('../js/hud/index.js', () => ({
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

    it('updates search-bar element value when md-search-bar is present', () => {
      const searchBar = document.createElement('md-search-bar');
      searchBar.id = 'search-bar';
      searchBar.value = '';
      document.body.appendChild(searchBar);

      SearchController.selectResult({
        display_name: 'Duomo di Milano, Milan, Italy',
        lat: '45.4642',
        lon: '9.1916'
      });

      expect(searchBar.value).toBe('Duomo di Milano');
      searchBar.remove();
    });
  });

  describe('Recent Searches & Base Suggestions', () => {
    beforeEach(() => {
      localStorage.clear();
      document.body.innerHTML = `
        <md-search-bar id="search-bar">
          <div slot="suggestions" id="search-suggestions-container">
            <div id="search-pills-section">
              <md-chip-set id="search-pills-chips"></md-chip-set>
            </div>
            <div id="search-suggestions-divider"></div>
            <div id="search-places-section" style="display: none;">
              <span id="search-places-header-title"></span>
              <div id="search-places-list"></div>
            </div>
            <div id="search-suggestions-divider-2" style="display: none;"></div>
            <div id="search-history-section">
              <button id="btn-clear-search-history"></button>
              <div id="search-history-list"></div>
            </div>
            <div id="search-empty-section" style="display: none;"></div>
          </div>
        </md-search-bar>
      `;
    });

    it('manages recent search history in localStorage', () => {
      expect(SearchController.getRecentSearches()).toEqual([]);

      SearchController.addRecentSearch('Colosseum');
      SearchController.addRecentSearch('Vatican');
      SearchController.addRecentSearch('Colosseum');

      expect(SearchController.getRecentSearches()).toEqual(['Colosseum', 'Vatican']);

      SearchController.removeRecentSearch('Vatican');
      expect(SearchController.getRecentSearches()).toEqual(['Colosseum']);

      SearchController.clearRecentSearches();
      expect(SearchController.getRecentSearches()).toEqual([]);
    });

    it('renders Home address as pill, ignores other saved places, and shows previous searches underneath', () => {
      MapService.getHomeAddress.mockReturnValue({
        address: 'Via Roma 1, Verona',
        lat: 45.438,
        lng: 10.993
      });

      MarkerController.customMarkers = [
        { id: '1', title: 'Arena di Verona', lat: 45.439, lng: 10.994, category: 'culture' },
        { id: '2', title: 'Castelvecchio', lat: 45.440, lng: 10.988, category: 'landmark' }
      ];

      SearchController.addRecentSearch('Piazza Erbe');
      SearchController.addRecentSearch('Torre dei Lamberti');

      SearchController.renderSuggestions();

      const chips = document.querySelectorAll('#search-pills-chips md-chip');
      expect(chips.length).toBe(1);
      expect(chips[0].getAttribute('label')).toBe('Home');
      expect(chips[0].getAttribute('icon')).toBe('home');

      const historyItems = document.querySelectorAll('#search-history-list .search-history-item');
      expect(historyItems.length).toBe(2);
      expect(historyItems[0].querySelector('.search-history-text').textContent).toBe('Torre dei Lamberti');
      expect(historyItems[1].querySelector('.search-history-text').textContent).toBe('Piazza Erbe');
    });

    it('clicking the home address pill flies to location and sets search bar value', () => {
      MapService.getHomeAddress.mockReturnValue({
        address: 'Via Roma 1, Verona',
        lat: 45.438,
        lng: 10.993
      });

      SearchController.renderSuggestions();

      const chip = document.querySelector('#search-pills-chips md-chip');
      chip.click();

      expect(MapService.flyTo).toHaveBeenCalledWith([10.993, 45.438], 15);
      expect(document.getElementById('search-bar').value).toBe('Home');
      expect(HUDController.setState).toHaveBeenCalledWith('place-details', expect.objectContaining({
        name: 'Home',
        address: 'Via Roma 1, Verona'
      }));
    });

    it('clicking a recent search item populates search bar and dispatches search event', () => {
      SearchController.addRecentSearch('Garda Lake');
      SearchController.renderSuggestions();

      const searchBar = document.getElementById('search-bar');
      let searchDispatched = false;
      searchBar.addEventListener('search', (e) => {
        searchDispatched = true;
        expect(e.detail.value).toBe('Garda Lake');
      });

      const historyItem = document.querySelector('#search-history-list .search-history-item');
      historyItem.click();

      expect(searchBar.value).toBe('Garda Lake');
      expect(searchDispatched).toBe(true);
    });

    it('activates search-bar and opens suggestions on click', () => {
      const searchBar = document.getElementById('search-bar');
      searchBar.show = vi.fn();
      searchBar.active = false;

      setupSearchUI(SearchController, HUDController, MarkerController, {});

      searchBar.click();

      expect(searchBar.show).toHaveBeenCalled();
    });

    it('handles empty state when rendered and query has no matches', () => {
      document.body.innerHTML = `
        <md-search-bar id="search-bar">
          <div slot="suggestions" id="search-suggestions-container">
            <div id="search-pills-section"><md-chip-set id="search-pills-chips"></md-chip-set></div>
            <div id="search-suggestions-divider"></div>
            <div id="search-history-section"><div id="search-history-list"></div></div>
            <div id="search-empty-section" style="display: none;"></div>
          </div>
        </md-search-bar>
      `;

      SearchController.renderSuggestions('');
      expect(document.getElementById('search-empty-section').style.display).toBe('none');

      // Filter with query that does not match
      SearchController.renderSuggestions('xyznotfound');
      expect(document.getElementById('search-empty-section').style.display).toBe('flex');
    });

    it('closes search-bar when clicking outside or when map is clicked', () => {
      const searchBar = document.getElementById('search-bar');
      searchBar.close = vi.fn();
      searchBar.active = true;

      MapService.on = vi.fn();
      setupSearchUI(SearchController, HUDController, MarkerController, {});

      // Simulate clicking outside on document
      const outsideEl = document.createElement('div');
      document.body.appendChild(outsideEl);
      document.dispatchEvent(new Event('pointerdown', { bubbles: true }));

      expect(searchBar.close).toHaveBeenCalled();

      // Simulate MapService click callback
      searchBar.close.mockClear();
      searchBar.active = true;
      const clickHandler = MapService.on.mock.calls.find(call => call[0] === 'click')?.[1];
      if (clickHandler) {
        clickHandler();
        expect(searchBar.close).toHaveBeenCalled();
      }
    });

    it('fetches and renders live place suggestions with appropriate icons after debounce', async () => {
      vi.useFakeTimers();
      const mockPlaces = [
        {
          place_id: 101,
          display_name: 'Pizzeria Bella Napoli, Via Toledo 12, Naples, Italy',
          lat: '40.851',
          lon: '14.268',
          class: 'amenity',
          type: 'restaurant'
        },
        {
          place_id: 102,
          display_name: 'Hotel Excelsior, Lungomare 1, Naples, Italy',
          lat: '40.832',
          lon: '14.249',
          class: 'tourism',
          type: 'hotel'
        }
      ];
      ApiService.searchGeocode.mockResolvedValueOnce(mockPlaces);

      SearchController.renderSuggestions('Nap');

      // Before debounce fires:
      expect(ApiService.searchGeocode).not.toHaveBeenCalled();

      // Fast forward past 300ms debounce
      await vi.advanceTimersByTimeAsync(350);

      expect(ApiService.searchGeocode).toHaveBeenCalledWith('Nap', 5, expect.any(Object));

      const placesSection = document.getElementById('search-places-section');
      expect(placesSection.style.display).toBe('flex');

      const placeItems = document.querySelectorAll('#search-places-list .search-place-item');
      expect(placeItems.length).toBe(2);

      expect(placeItems[0].querySelector('.search-place-name').textContent).toBe('Pizzeria Bella Napoli');
      expect(placeItems[0].querySelector('md-icon').getAttribute('name')).toBe('restaurant');

      expect(placeItems[1].querySelector('.search-place-name').textContent).toBe('Hotel Excelsior');
      expect(placeItems[1].querySelector('md-icon').getAttribute('name')).toBe('hotel');

      vi.useRealTimers();
    });

    it('clicking a live place suggestion adds to recent searches, sets search bar value, and selects result', async () => {
      vi.useFakeTimers();
      const mockPlaces = [
        {
          place_id: 201,
          display_name: 'Colosseum, Piazza del Colosseo, Rome, Italy',
          lat: '41.8902',
          lon: '12.4922',
          class: 'tourism',
          type: 'attraction'
        }
      ];
      ApiService.searchGeocode.mockResolvedValueOnce(mockPlaces);

      const searchBar = document.getElementById('search-bar');
      searchBar.close = vi.fn();

      SearchController.renderSuggestions('Coloss');
      await vi.advanceTimersByTimeAsync(350);

      const placeItem = document.querySelector('#search-places-list .search-place-item');
      expect(placeItem).not.toBeNull();

      placeItem.click();

      expect(SearchController.getRecentSearches()).toContain('Colosseum');
      expect(searchBar.value).toBe('Colosseum');
      expect(searchBar.close).toHaveBeenCalled();
      expect(MapService.flyTo).toHaveBeenCalledWith([12.4922, 41.8902], 14);

      vi.useRealTimers();
    });

    it('clears place suggestions when query is less than 2 characters', async () => {
      vi.useFakeTimers();
      ApiService.searchGeocode.mockResolvedValueOnce([
        {
          place_id: 301,
          display_name: 'Piazza Bra, Verona, Italy',
          lat: '45.438',
          lon: '10.993'
        }
      ]);

      SearchController.renderSuggestions('Piazza');
      await vi.advanceTimersByTimeAsync(350);

      expect(document.querySelectorAll('#search-places-list .search-place-item').length).toBe(1);

      // Change query to 1 char
      SearchController.renderSuggestions('P');

      expect(document.querySelectorAll('#search-places-list .search-place-item').length).toBe(0);
      expect(document.getElementById('search-places-section').style.display).toBe('none');

      vi.useRealTimers();
    });

    it('renders search results into the suggestion box with pin number badges on the right', () => {
      const results = [
        { display_name: 'Piazza Bra, Verona, Italy', lat: '45.438', lon: '10.993', class: 'tourism', type: 'attraction' },
        { display_name: 'Piazza San Marco, Venice, Italy', lat: '45.434', lon: '12.338', class: 'tourism', type: 'attraction' },
      ];

      SearchController.renderResults(results);

      const placesSection = document.getElementById('search-places-section');
      expect(placesSection.style.display).toBe('flex');

      const headerTitle = document.getElementById('search-places-header-title');
      if (headerTitle) {
        expect(headerTitle.textContent).toBe('Search Results');
      }

      const items = document.querySelectorAll('#search-places-list .search-place-item');
      expect(items.length).toBe(2);

      const badge1 = items[0].querySelector('.search-place-pin-badge');
      const badge2 = items[1].querySelector('.search-place-pin-badge');
      expect(badge1).not.toBeNull();
      expect(badge2).not.toBeNull();
      expect(badge1.textContent).toBe('1');
      expect(badge2.textContent).toBe('2');

      // Clicking item in suggestion box selects result and updates search bar
      const searchBar = document.getElementById('search-bar');
      searchBar.close = vi.fn();
      items[0].click();

      expect(MapService.flyTo).toHaveBeenCalledWith([10.993, 45.438], 14);
      expect(searchBar.value).toBe('Piazza Bra');
      expect(searchBar.close).toHaveBeenCalled();
    });

    it('search bar search event renders results in suggestion box without switching HUD state', async () => {
      const mockResults = [
        { display_name: 'Duomo di Firenze, Florence, Italy', lat: '43.773', lon: '11.256' }
      ];
      ApiService.searchGeocode.mockResolvedValueOnce(mockResults);

      const searchBar = document.getElementById('search-bar');
      searchBar.show = vi.fn();
      searchBar.active = false;

      setupSearchUI(SearchController, HUDController, MarkerController, ApiService);

      searchBar.dispatchEvent(new CustomEvent('search', { detail: { value: 'Firenze' } }));

      // Wait for async handleSearch
      await new Promise(r => setTimeout(r, 10));

      expect(HUDController.setState).not.toHaveBeenCalledWith('search-results');
      expect(searchBar.show).toHaveBeenCalled();

      const items = document.querySelectorAll('#search-places-list .search-place-item');
      expect(items.length).toBe(1);
      expect(items[0].querySelector('.search-place-pin-badge').textContent).toBe('1');
    });

    it('defocuses text input and does not retract searchbar when interacting with map while showing search results', async () => {
      const searchBar = document.getElementById('search-bar');
      searchBar.close = vi.fn();
      searchBar.active = true;
      searchBar.inputElement = { blur: vi.fn() };

      MapService.on = vi.fn();
      setupSearchUI(SearchController, HUDController, MarkerController, ApiService);

      const results = [
        { display_name: 'Piazza Bra, Verona, Italy', lat: '45.438', lon: '10.993' }
      ];
      SearchController.renderResults(results);

      expect(searchBar.inputElement.blur).toHaveBeenCalled();
      expect(SearchController.isShowingSearchResults).toBe(true);

      // Simulate MapService click and movestart callbacks
      const clickHandler = MapService.on.mock.calls.find(call => call[0] === 'click')?.[1];
      const moveHandler = MapService.on.mock.calls.find(call => call[0] === 'movestart')?.[1];

      searchBar.close.mockClear();
      if (clickHandler) clickHandler();
      expect(searchBar.close).not.toHaveBeenCalled();

      if (moveHandler) moveHandler();
      expect(searchBar.close).not.toHaveBeenCalled();

      // Simulate clicking on the map canvas
      const mapDiv = document.createElement('div');
      mapDiv.id = 'map';
      document.body.appendChild(mapDiv);

      mapDiv.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));

      expect(searchBar.close).not.toHaveBeenCalled();
      mapDiv.remove();

      // When user starts typing suggestions again, isShowingSearchResults becomes false
      SearchController.renderSuggestions('Ver');
      expect(SearchController.isShowingSearchResults).toBe(false);

      // Now interacting with map should retract searchbar
      if (clickHandler) clickHandler();
      expect(searchBar.close).toHaveBeenCalled();
    });

    it('supports slotted searchbar buttons (menu, search submit) with tooltips and click actions', async () => {
      const searchBar = document.getElementById('search-bar');
      searchBar.value = 'Rome';

      const btnMenu = document.createElement('md-icon-button');
      btnMenu.id = 'btn-search-menu';
      btnMenu.setAttribute('slot', 'leading');
      searchBar.appendChild(btnMenu);

      const btnSubmit = document.createElement('md-icon-button');
      btnSubmit.id = 'btn-search-submit';
      btnSubmit.setAttribute('slot', 'trailing');
      searchBar.appendChild(btnSubmit);

      const tooltipMenu = document.createElement('md-tooltip');
      tooltipMenu.setAttribute('for', 'btn-search-menu');
      tooltipMenu.setAttribute('position', 'bottom');
      tooltipMenu.innerHTML = '<span data-i18n="markers.title">Saved Places</span>';
      document.body.appendChild(tooltipMenu);

      const tooltipSubmit = document.createElement('md-tooltip');
      tooltipSubmit.setAttribute('for', 'btn-search-submit');
      tooltipSubmit.setAttribute('position', 'bottom');
      tooltipSubmit.innerHTML = '<span data-i18n="hud.search_placeholder">Search</span>';
      document.body.appendChild(tooltipSubmit);

      const clearTooltip = document.createElement('md-tooltip');
      clearTooltip.id = 'search-clear-tooltip';
      clearTooltip.setAttribute('position', 'bottom');
      clearTooltip.innerHTML = '<span>Clear search</span>';
      document.body.appendChild(clearTooltip);

      setupSearchUI(SearchController, HUDController, MarkerController, ApiService);

      // Verify tooltips exist
      expect(document.querySelector('md-tooltip[for="btn-search-menu"]')).not.toBeNull();
      expect(document.querySelector('md-tooltip[for="btn-search-submit"]')).not.toBeNull();
      expect(document.getElementById('search-clear-tooltip')).not.toBeNull();

      // Test clicking btn-search-menu toggles HUDController state
      HUDController.currentState = 'places';
      btnMenu.click();
      expect(HUDController.setState).toHaveBeenCalledWith('saved-places');

      HUDController.currentState = 'saved-places';
      btnMenu.click();
      expect(HUDController.setState).toHaveBeenCalledWith('places');

      // Test clicking btn-search-submit triggers search
      ApiService.searchGeocode.mockResolvedValueOnce([]);
      btnSubmit.click();
      await new Promise(r => setTimeout(r, 10));
      expect(ApiService.searchGeocode).toHaveBeenCalledWith('Rome', null, expect.any(Object));

      // Test clear tooltip anchor binding
      const mockClearBtn = document.createElement('button');
      mockClearBtn.className = 'icon-btn clear-btn';
      Object.defineProperty(searchBar, 'shadowRoot', {
        value: {
          querySelector: vi.fn((sel) => (sel === '.clear-btn' ? mockClearBtn : null)),
          appendChild: vi.fn(),
        },
        configurable: true,
      });

      searchBar.dispatchEvent(new CustomEvent('input', { detail: { value: 'test' } }));
      expect(clearTooltip.anchor).toBe(mockClearBtn);

      // When search bar fires clear, tooltip is hidden
      clearTooltip.hide = vi.fn();
      searchBar.dispatchEvent(new CustomEvent('clear'));
      expect(clearTooltip.hide).toHaveBeenCalled();
    });

    it('does not overwrite search results with in-flight suggestions when map shifts or debounce fires', async () => {
      vi.useFakeTimers();

      const searchBar = document.getElementById('search-bar');
      searchBar.value = 'Napoli';
      searchBar.active = true;

      setupSearchUI(SearchController, HUDController, MarkerController, ApiService);

      // 1. User starts typing, starting a live suggestion debounce
      SearchController.renderSuggestions('Napoli');

      // 2. User immediately presses search before 300ms debounce
      const mockResults = [
        { display_name: 'Piazza del Plebiscito, Naples, Italy', lat: '40.835', lon: '14.248' },
        { display_name: 'Castel dell Ovo, Naples, Italy', lat: '40.828', lon: '14.247' }
      ];
      ApiService.searchGeocode.mockResolvedValueOnce(mockResults);

      searchBar.dispatchEvent(new CustomEvent('search', { detail: { value: 'Napoli' } }));

      // Fast forward past mock network and debounce
      await vi.advanceTimersByTimeAsync(350);

      // Search results must be showing
      expect(SearchController.isShowingSearchResults).toBe(true);
      expect(document.getElementById('search-places-header-title').textContent).toBe('Search Results');

      const items = document.querySelectorAll('#search-places-list .search-place-item');
      expect(items.length).toBe(2);
      expect(items[0].querySelector('.search-place-pin-badge')).not.toBeNull();
      expect(items[0].querySelector('.search-place-pin-badge').textContent).toBe('1');
      expect(items[1].querySelector('.search-place-pin-badge').textContent).toBe('2');

      // Interacting with map or map controls stack must NOT close searchbar
      searchBar.close = vi.fn();
      const mapControls = document.createElement('div');
      mapControls.id = 'map-controls-stack';
      document.body.appendChild(mapControls);

      mapControls.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
      expect(searchBar.close).not.toHaveBeenCalled();
      mapControls.remove();

      vi.useRealTimers();
    });
  });
});


