// tests/map.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapService, setupMapControlsUI, parseUrlCoordinates, formatUrlCoordinates, updateUrlHash } from '../js/map/index.js';

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
      expect(MapService.activeOverlays.trekking).toBe(false);
    });

    it('respects explicitly disabled overlays from localStorage', () => {
      localStorage.setItem('maps_labels_enabled', 'false');
      localStorage.setItem('maps_perspective_enabled', 'false');
      MapService.initOverlays();
      expect(MapService.activeOverlays.labels).toBe(false);
      expect(MapService.activeOverlays.perspective).toBe(false);
    });

    it('respects enabled trekking overlay from localStorage', () => {
      localStorage.setItem('maps_trekking_enabled', 'true');
      MapService.initOverlays();
      expect(MapService.activeOverlays.trekking).toBe(true);
    });
  });

  describe('getTileUrl', () => {
    it('generates tile URL for trekking overlay correctly', () => {
      const url = MapService.getTileUrl('trekking', 13, 45.4064, 11.8768);
      expect(url).toContain('https://tile.waymarkedtrails.org/hiking/');
      expect(url).toMatch(/https:\/\/tile\.waymarkedtrails\.org\/hiking\/13\/\d+\/\d+\.png/);
    });

    it('generates default tile URL for street map', () => {
      const url = MapService.getTileUrl('street', 13, 45.4064, 11.8768);
      expect(url).toContain('openstreetmap.org');
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

  describe('URL Coordinates & Hash Manager', () => {
    describe('parseUrlCoordinates', () => {
      it('returns null for empty or invalid input', () => {
        expect(parseUrlCoordinates('')).toBeNull();
        expect(parseUrlCoordinates('#')).toBeNull();
        expect(parseUrlCoordinates('#abc')).toBeNull();
        expect(parseUrlCoordinates(null)).toBeNull();
      });

      it('parses bracketed x+y+zoom format: #[lat+lng+zoom]', () => {
        const parsed = parseUrlCoordinates('#[45.4064+11.8768+13]');
        expect(parsed).toEqual({
          lat: 45.4064,
          lng: 11.8768,
          zoom: 13,
          bearing: 0,
          pitch: 0
        });
      });

      it('parses unbracketed plus format: #lat+lng+zoom', () => {
        const parsed = parseUrlCoordinates('#45.4064+11.8768+14');
        expect(parsed).toEqual({
          lat: 45.4064,
          lng: 11.8768,
          zoom: 14,
          bearing: 0,
          pitch: 0
        });
      });

      it('parses negative coordinates in bracketed format: #[-33.8688+151.2093+12]', () => {
        const parsed = parseUrlCoordinates('#[-33.8688+151.2093+12]');
        expect(parsed).toEqual({
          lat: -33.8688,
          lng: 151.2093,
          zoom: 12,
          bearing: 0,
          pitch: 0
        });
      });

      it('parses comma-separated format: #[lat,lng,zoom] and #lat,lng,zoom', () => {
        const parsed1 = parseUrlCoordinates('#[40.7128,-74.0060,11]');
        expect(parsed1).toEqual({
          lat: 40.7128,
          lng: -74.0060,
          zoom: 11,
          bearing: 0,
          pitch: 0
        });

        const parsed2 = parseUrlCoordinates('#40.7128,-74.0060,11');
        expect(parsed2).toEqual({
          lat: 40.7128,
          lng: -74.0060,
          zoom: 11,
          bearing: 0,
          pitch: 0
        });
      });

      it('parses standard MapLibre / Leaflet hash: #zoom/lat/lng', () => {
        const parsed = parseUrlCoordinates('#13.5/45.4064/11.8768');
        expect(parsed).toEqual({
          lat: 45.4064,
          lng: 11.8768,
          zoom: 13.5,
          bearing: 0,
          pitch: 0
        });
      });

      it('parses MapLibre extended hash with bearing and pitch: #zoom/lat/lng/bearing/pitch', () => {
        const parsed = parseUrlCoordinates('#13/45.4064/11.8768/45/30');
        expect(parsed).toEqual({
          lat: 45.4064,
          lng: 11.8768,
          zoom: 13,
          bearing: 45,
          pitch: 30
        });
      });

      it('parses OpenStreetMap #map=zoom/lat/lon format', () => {
        const parsed = parseUrlCoordinates('#map=15/48.8584/2.2945');
        expect(parsed).toEqual({
          lat: 48.8584,
          lng: 2.2945,
          zoom: 15,
          bearing: 0,
          pitch: 0
        });
      });

      it('parses query string parameters: ?lat=...&lng=...&zoom=...', () => {
        const parsed = parseUrlCoordinates('https://example.com/?lat=51.5074&lng=-0.1278&zoom=10');
        expect(parsed).toEqual({
          lat: 51.5074,
          lng: -0.1278,
          zoom: 10,
          bearing: 0,
          pitch: 0
        });
      });

      it('parses 2-number coordinates with default zoom level: #[lat+lng]', () => {
        const parsed = parseUrlCoordinates('#[45.4064+11.8768]');
        expect(parsed).toEqual({
          lat: 45.4064,
          lng: 11.8768,
          zoom: 13,
          bearing: 0,
          pitch: 0
        });
      });

      it('reads from window.location when no argument is supplied', () => {
        window.location.hash = '#[45.4064+11.8768+15]';
        const parsed = parseUrlCoordinates();
        expect(parsed).toEqual({
          lat: 45.4064,
          lng: 11.8768,
          zoom: 15,
          bearing: 0,
          pitch: 0
        });
        window.location.hash = '';
      });

      it('returns null when latitude or longitude is out of bounds', () => {
        expect(parseUrlCoordinates('#[95.0+11.8768+13]')).toBeNull();
        expect(parseUrlCoordinates('#[45.0+195.0+13]')).toBeNull();
      });
    });

    describe('formatUrlCoordinates', () => {
      it('formats coordinates without bearing and pitch', () => {
        const formatted = formatUrlCoordinates(45.406401, 11.876802, 13);
        expect(formatted).toBe('#13/45.4064/11.8768');
      });

      it('formats coordinates with non-zero bearing and pitch', () => {
        const formatted = formatUrlCoordinates(45.4064, 11.8768, 13.5, 45, 30);
        expect(formatted).toBe('#13.5/45.4064/11.8768/45/30');
      });
    });

    describe('updateUrlHash', () => {
      it('calls history.replaceState to update address bar URL', () => {
        const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
        updateUrlHash(45.4064, 11.8768, 13);
        expect(replaceStateSpy).toHaveBeenCalledWith(
          null,
          '',
          expect.stringContaining('#13/45.4064/11.8768')
        );
        replaceStateSpy.mockRestore();
      });
    });

    describe('MapService URL coordination', () => {
      it('provides getUrlCoordinates method', () => {
        window.location.hash = '#[45.4064+11.8768+16]';
        const coords = MapService.getUrlCoordinates();
        expect(coords).toMatchObject({
          lat: 45.4064,
          lng: 11.8768,
          zoom: 16
        });
        window.location.hash = '';
      });

      it('updates URL hash when updateUrlCoordinates is called on MapService', () => {
        MapService.map = {
          getCenter: vi.fn(() => ({ lat: 45.4064, lng: 11.8768 })),
          getZoom: vi.fn(() => 14),
          getBearing: vi.fn(() => 0),
          getPitch: vi.fn(() => 0)
        };

        const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
        MapService.updateUrlCoordinates();
        expect(replaceStateSpy).toHaveBeenCalledWith(
          null,
          '',
          expect.stringContaining('#14/45.4064/11.8768')
        );
        replaceStateSpy.mockRestore();
      });

      it('does not update URL hash when isUrlLocationEnabled is false', () => {
        MapService.map = {
          getCenter: vi.fn(() => ({ lat: 45.4064, lng: 11.8768 })),
          getZoom: vi.fn(() => 14),
          getBearing: vi.fn(() => 0),
          getPitch: vi.fn(() => 0)
        };
        MapService.isUrlLocationEnabled = false;

        const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
        MapService.updateUrlCoordinates();
        expect(replaceStateSpy).not.toHaveBeenCalled();
        replaceStateSpy.mockRestore();
        MapService.isUrlLocationEnabled = true;
      });

      it('toggles url location setting and clears URL hash when disabled', () => {
        window.location.hash = '#14/45.4064/11.8768';
        const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

        MapService.setUrlLocationEnabled(false);
        expect(MapService.isUrlLocationEnabled).toBe(false);
        expect(localStorage.getItem('maps_url_location_enabled')).toBe('false');
        expect(replaceStateSpy).toHaveBeenCalled();

        replaceStateSpy.mockClear();
        MapService.map = {
          getCenter: vi.fn(() => ({ lat: 45.4064, lng: 11.8768 })),
          getZoom: vi.fn(() => 14),
          getBearing: vi.fn(() => 0),
          getPitch: vi.fn(() => 0)
        };

        MapService.setUrlLocationEnabled(true);
        expect(MapService.isUrlLocationEnabled).toBe(true);
        expect(localStorage.getItem('maps_url_location_enabled')).toBe('true');
        expect(replaceStateSpy).toHaveBeenCalledWith(
          null,
          '',
          expect.stringContaining('#14/45.4064/11.8768')
        );

        replaceStateSpy.mockRestore();
      });
    });
  });
});
