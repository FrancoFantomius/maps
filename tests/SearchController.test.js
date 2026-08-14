// tests/SearchController.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchController } from '../js/SearchController.js';
import { MapService } from '../js/MapService.js';
import { MarkerController } from '../js/MarkerController.js';
import { HUDController } from '../js/HUDController.js';

vi.mock('../js/MapService.js', () => ({
  MapService: {
    flyTo: vi.fn(),
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

  it('renders search results into the DOM', () => {
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
  });

  it('handles clicking a result item', () => {
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
});
