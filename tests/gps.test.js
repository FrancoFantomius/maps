// tests/gps.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GPSController, updateMarkerAndCircle, updateUI } from '../js/gps/index.js';
import { MapService } from '../js/map/index.js';

vi.mock('../js/map/index.js', () => ({
  MapService: {
    createMarker: vi.fn(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
    updateSourceData: vi.fn(),
    metersToPixels: vi.fn().mockReturnValue(50),
    getZoom: vi.fn().mockReturnValue(13),
    flyTo: vi.fn(),
    on: vi.fn(),
    map: {},
  },
}));

describe('GPSController', () => {
  let mockGeolocation;

  beforeEach(() => {
    document.body.innerHTML = '<button id="btn-gps" class="text-slate-700"></button>';
    GPSController.gpsMarker = null;
    GPSController.gpsCoords = null;
    GPSController.gpsAccuracy = null;
    GPSController.watchId = null;
    GPSController.isFollowing = false;
    GPSController.isLocating = false;

    mockGeolocation = {
      watchPosition: vi.fn((success) => {
        success({
          coords: { latitude: 45.438, longitude: 10.993, accuracy: 15 },
        });
        return 101;
      }),
      clearWatch: vi.fn(),
    };

    Object.defineProperty(navigator, 'geolocation', {
      writable: true,
      configurable: true,
      value: mockGeolocation,
    });

    vi.clearAllMocks();
  });

  describe('locateUser', () => {
    it('sets locating state immediately when locateUser is invoked and awaiting position', () => {
      mockGeolocation.watchPosition = vi.fn(() => 101);
      GPSController.locateUser();

      const btn = document.getElementById('btn-gps');
      expect(GPSController.isLocating).toBe(true);
      expect(btn.className).toContain('is-locating');
    });

    it('starts tracking when watchId is null', () => {
      GPSController.locateUser();

      expect(mockGeolocation.watchPosition).toHaveBeenCalled();
      expect(GPSController.watchId).toBe(101);
      expect(GPSController.isFollowing).toBe(true);
      expect(GPSController.gpsCoords).toEqual({ lat: 45.438, lng: 10.993 });
    });

    it('stops tracking when already active and following', () => {
      GPSController.locateUser(); // Start
      GPSController.locateUser(); // Stop

      expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(101);
      expect(GPSController.watchId).toBeNull();
      expect(GPSController.isFollowing).toBe(false);
    });

    it('shows md-snackbar when geolocation is not supported', () => {
      Object.defineProperty(navigator, 'geolocation', {
        writable: true,
        configurable: true,
        value: undefined,
      });

      GPSController.locateUser();

      const snackbar = document.getElementById('gps-snackbar');
      expect(snackbar).not.toBeNull();
      expect(snackbar.tagName.toLowerCase()).toBe('md-snackbar');
      expect(snackbar.message).toBe('Geolocation not supported by this browser.');
      expect(snackbar.open).toBe(true);
    });
  });

  describe('updateUI', () => {
    it('shows locating state while acquiring position fix', () => {
      GPSController.isFollowing = true;
      GPSController.watchId = 101;
      GPSController.gpsCoords = null;
      GPSController.updateUI();

      const btn = document.getElementById('btn-gps');
      expect(btn.className).toContain('is-locating');
    });

    it('switches to active state when position is found', () => {
      GPSController.isFollowing = true;
      GPSController.watchId = 101;
      GPSController.gpsCoords = { lat: 45.438, lng: 10.993 };
      GPSController.updateUI();

      const btn = document.getElementById('btn-gps');
      expect(btn.className).toContain('bg-emerald-600 text-white');
      expect(btn.className).not.toContain('is-locating');

      GPSController.stopTracking();
      expect(btn.className).toContain('text-emerald-600');
      expect(btn.className).not.toContain('bg-emerald-600 text-white');
      expect(btn.className).not.toContain('is-locating');
    });

    it('works when called directly via exported function from ui.js', () => {
      GPSController.isFollowing = false;
      GPSController.watchId = null;
      updateUI(GPSController);

      const btn = document.getElementById('btn-gps');
      expect(btn.className).toContain('text-emerald-600');
    });
  });

  describe('updateMarkerAndCircle', () => {
    it('updates source data and creates a marker if none exists', () => {
      updateMarkerAndCircle(GPSController, 10.993, 45.438, 20);

      expect(MapService.updateSourceData).toHaveBeenCalledWith('gps-source', expect.objectContaining({
        type: 'FeatureCollection',
        features: expect.any(Array),
      }));
      expect(MapService.createMarker).toHaveBeenCalled();
      expect(GPSController.gpsMarker).not.toBeNull();
    });

    it('updates existing marker position if marker already exists', () => {
      const mockMarker = {
        setLngLat: vi.fn().mockReturnThis(),
      };
      GPSController.gpsMarker = mockMarker;

      updateMarkerAndCircle(GPSController, 11.0, 46.0, 10);

      expect(mockMarker.setLngLat).toHaveBeenCalledWith([11.0, 46.0]);
      expect(MapService.createMarker).not.toHaveBeenCalled();
    });
  });
});
