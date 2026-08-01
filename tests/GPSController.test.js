// tests/GPSController.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GPSController } from '../js/GPSController.js';
import { MapService } from '../js/MapService.js';

vi.mock('../js/MapService.js', () => ({
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
  });
});
