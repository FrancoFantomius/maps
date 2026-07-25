// tests/ApiService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiService } from '../js/ApiService.js';

describe('ApiService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('reverseGeocode', () => {
    it('fetches reverse geocoding data from Nominatim', async () => {
      const mockResult = { display_name: 'Piazza Bra, Verona, Italy', address: { city: 'Verona' } };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      const res = await ApiService.reverseGeocode(45.438, 10.993);

      expect(fetch).toHaveBeenCalledWith(
        'https://nominatim.openstreetmap.org/reverse?format=json&lat=45.438&lon=10.993&zoom=18&addressdetails=1'
      );
      expect(res).toEqual(mockResult);
    });

    it('throws error when response is not ok', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      await expect(ApiService.reverseGeocode(45.438, 10.993)).rejects.toThrow(
        'Nominatim reverse geocode failed: Internal Server Error'
      );
    });
  });

  describe('searchGeocode', () => {
    it('fetches search results without limit', async () => {
      const mockResults = [{ display_name: 'Rome, Italy', lat: '41.9', lon: '12.4' }];
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResults,
      });

      const res = await ApiService.searchGeocode('Rome');

      expect(fetch).toHaveBeenCalledWith(
        'https://nominatim.openstreetmap.org/search?format=json&q=Rome'
      );
      expect(res).toEqual(mockResults);
    });

    it('fetches search results with limit', async () => {
      const mockResults = [{ display_name: 'Rome, Italy', lat: '41.9', lon: '12.4' }];
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResults,
      });

      await ApiService.searchGeocode('Rome', 5);

      expect(fetch).toHaveBeenCalledWith(
        'https://nominatim.openstreetmap.org/search?format=json&q=Rome&limit=5&addressdetails=1'
      );
    });
  });

  describe('calculateRoute', () => {
    it('calculates driving route by default', async () => {
      const mockRoute = { routes: [{ distance: 1200, duration: 300 }] };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoute,
      });

      const start = { lat: 45.4, lng: 11.8 };
      const end = { lat: 45.5, lng: 11.9 };
      const res = await ApiService.calculateRoute(start, end);

      expect(fetch).toHaveBeenCalledWith(
        'https://router.project-osrm.org/route/v1/driving/11.8,45.4;11.9,45.5?geometries=geojson&overview=full&steps=true&alternatives=true'
      );
      expect(res).toEqual(mockRoute);
    });

    it('maps cycling and foot profiles to bike and foot OSRM slugs', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ routes: [] }),
      });

      const start = { lat: 45.4, lng: 11.8 };
      const end = { lat: 45.5, lng: 11.9 };

      await ApiService.calculateRoute(start, end, 'cycling');
      expect(fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/v1/bike/')
      );

      await ApiService.calculateRoute(start, end, 'foot');
      expect(fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/v1/foot/')
      );
    });
  });

  describe('fetchWikipediaNearby & fetchWikipediaSummary', () => {
    it('fetches nearby Wikipedia articles', async () => {
      const mockWiki = { query: { geosearch: [{ title: 'Colosseum' }] } };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWiki,
      });

      const res = await ApiService.fetchWikipediaNearby(41.89, 12.49, 500);
      expect(fetch).toHaveBeenCalledWith(
        'https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gsradius=500&gscoord=41.89|12.49&format=json&origin=*'
      );
      expect(res).toEqual(mockWiki);
    });

    it('fetches Wikipedia summary by title', async () => {
      const mockSummary = { title: 'Colosseum', extract: 'The Colosseum is an oval amphitheatre...' };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummary,
      });

      const res = await ApiService.fetchWikipediaSummary('Colosseum');
      expect(fetch).toHaveBeenCalledWith(
        'https://en.wikipedia.org/api/rest_v1/page/summary/Colosseum'
      );
      expect(res).toEqual(mockSummary);
    });
  });

  describe('fetchOverpassFeatures', () => {
    it('queries overpass API for nearby highway and amenity nodes', async () => {
      const mockOverpass = { elements: [] };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOverpass,
      });

      const res = await ApiService.fetchOverpassFeatures(45.4, 11.8);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('overpass-api.de/api/interpreter')
      );
      expect(res).toEqual(mockOverpass);
    });
  });
});
