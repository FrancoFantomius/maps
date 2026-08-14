// tests/MapService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapService } from '../js/MapService.js';

describe('MapService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Home address management', () => {
    it('returns null when no home address is saved', () => {
      expect(MapService.getHomeAddress()).toBeNull();
    });

    it('saves and retrieves home address from localStorage', () => {
      const home = { lat: 45.438, lng: 10.993, address: 'Piazza Bra 1, Verona' };
      MapService.setHomeAddress(home);

      const retrieved = MapService.getHomeAddress();
      expect(retrieved).toMatchObject({
        lat: 45.438,
        lng: 10.993,
        address: 'Piazza Bra 1, Verona',
      });
      expect(retrieved.updatedAt).toBeDefined();
    });

    it('clears home address from localStorage', () => {
      MapService.setHomeAddress({ lat: 45.4, lng: 11.8, address: 'Home' });
      MapService.clearHomeAddress();

      expect(MapService.getHomeAddress()).toBeNull();
    });

    it('dispatches maps-home-updated event on setHomeAddress and clearHomeAddress', () => {
      const listener = vi.fn();
      window.addEventListener('maps-home-updated', listener);

      MapService.setHomeAddress({ lat: 45.438, lng: 10.993, address: 'Verona' });
      expect(listener).toHaveBeenCalledTimes(1);

      MapService.clearHomeAddress();
      expect(listener).toHaveBeenCalledTimes(2);

      window.removeEventListener('maps-home-updated', listener);
    });
  });

  describe('Last position management', () => {
    it('returns null when no last position is saved', () => {
      expect(MapService.getLastPosition()).toBeNull();
    });

    it('retrieves last position saved in localStorage', () => {
      const pos = { lat: 45.4, lng: 11.8, zoom: 14 };
      localStorage.setItem('maps_last_position', JSON.stringify(pos));

      expect(MapService.getLastPosition()).toEqual(pos);
    });
  });

  describe('metersToPixels', () => {
    it('calculates pixel radius for given meters, latitude, and zoom level', () => {
      const px = MapService.metersToPixels(100, 45.0, 15);
      expect(px).toBeGreaterThan(0);
      expect(typeof px).toBe('number');
    });
  });

  describe('getCenter and getBounds', () => {
    it('returns null when map is not initialized', () => {
      MapService.map = null;
      expect(MapService.getCenter()).toBeNull();
      expect(MapService.getBounds()).toBeNull();
    });

    it('returns lat lng from map.getCenter when map is active', () => {
      MapService.map = {
        getCenter: vi.fn(() => ({ lat: 45.438, lng: 10.993 })),
        getBounds: vi.fn(() => ({
          getWest: () => 10.8,
          getNorth: () => 45.5,
          getEast: () => 11.2,
          getSouth: () => 45.3,
        })),
      };

      expect(MapService.getCenter()).toEqual({ lat: 45.438, lng: 10.993 });
      expect(MapService.getBounds().getWest()).toBe(10.8);
    });
  });
});
