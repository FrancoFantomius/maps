// tests/map.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapService, setupMapControlsUI } from '../js/map/index.js';

describe('MapService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    MapService.map = null;
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

  describe('Zoom controls', () => {
    it('calls map.zoomIn when zoomIn is invoked', () => {
      MapService.map = {
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
      };

      MapService.zoomIn();
      expect(MapService.map.zoomIn).toHaveBeenCalledTimes(1);
    });

    it('calls map.zoomOut when zoomOut is invoked', () => {
      MapService.map = {
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
      };

      MapService.zoomOut();
      expect(MapService.map.zoomOut).toHaveBeenCalledTimes(1);
    });

    it('attaches click listeners to btn-zoom-in and btn-zoom-out', () => {
      document.body.innerHTML = `
        <button id="btn-zoom-in"></button>
        <button id="btn-zoom-out"></button>
      `;

      const zoomInSpy = vi.spyOn(MapService, 'zoomIn').mockImplementation(() => {});
      const zoomOutSpy = vi.spyOn(MapService, 'zoomOut').mockImplementation(() => {});

      setupMapControlsUI(MapService);

      document.getElementById('btn-zoom-in').click();
      expect(zoomInSpy).toHaveBeenCalledTimes(1);

      document.getElementById('btn-zoom-out').click();
      expect(zoomOutSpy).toHaveBeenCalledTimes(1);

      zoomInSpy.mockRestore();
      zoomOutSpy.mockRestore();
    });
  });

  describe('Overlay defaults', () => {
    it('defaults labels and perspective to true when unconfigured in localStorage', () => {
      MapService.initOverlays();
      expect(MapService.activeOverlays.labels).toBe(true);
      expect(MapService.activeOverlays.perspective).toBe(true);
    });

    it('respects explicitly disabled overlays from localStorage', () => {
      localStorage.setItem('maps_labels_enabled', 'false');
      localStorage.setItem('maps_perspective_enabled', 'false');
      MapService.initOverlays();
      expect(MapService.activeOverlays.labels).toBe(false);
      expect(MapService.activeOverlays.perspective).toBe(false);
    });
  });

  describe('Tilt and cycleTilt controls', () => {
    it('cycles pitch between 60, 30, and 0 degrees', () => {
      MapService.easeTo = vi.fn();

      // Case 1: At 0 degrees, moves to 60
      MapService.getPitch = vi.fn(() => 0);
      let target = MapService.cycleTilt();
      expect(target).toBe(60);
      expect(MapService.easeTo).toHaveBeenCalledWith(undefined, 60, 300);

      // Case 2: At 60 degrees, moves to 30
      MapService.getPitch = vi.fn(() => 60);
      target = MapService.cycleTilt();
      expect(target).toBe(30);
      expect(MapService.easeTo).toHaveBeenCalledWith(undefined, 30, 300);

      // Case 3: At 30 degrees, moves to 0
      MapService.getPitch = vi.fn(() => 30);
      target = MapService.cycleTilt();
      expect(target).toBe(0);
      expect(MapService.easeTo).toHaveBeenCalledWith(undefined, 0, 300);
    });

    it('attaches click listener to btn-perspective calling cycleTilt and not toggling perspective overlay', () => {
      document.body.innerHTML = `
        <button id="btn-perspective"></button>
      `;

      const cycleTiltSpy = vi.spyOn(MapService, 'cycleTilt').mockImplementation(() => {});
      const toggleOverlaySpy = vi.spyOn(MapService, 'toggleOverlay');

      setupMapControlsUI(MapService);

      document.getElementById('btn-perspective').click();
      expect(cycleTiltSpy).toHaveBeenCalledTimes(1);
      expect(toggleOverlaySpy).not.toHaveBeenCalled();

      cycleTiltSpy.mockRestore();
      toggleOverlaySpy.mockRestore();
    });
  });
});
