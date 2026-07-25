// tests/MeasurementController.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MeasurementController } from '../js/MeasurementController.js';
import { MapService } from '../js/MapService.js';
import { HUDController } from '../js/HUDController.js';
import { RoutingController } from '../js/RoutingController.js';

vi.mock('../js/MapService.js', () => ({
  MapService: {
    getContainer: vi.fn(() => ({ style: { cursor: '' } })),
    updateSourceData: vi.fn(),
    createMarker: vi.fn(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
    map: {},
  },
}));

vi.mock('../js/HUDController.js', () => ({
  HUDController: {
    setState: vi.fn(),
    currentState: 'places',
  },
}));

vi.mock('../js/RoutingController.js', () => ({
  RoutingController: {
    exit: vi.fn(),
  },
}));

describe('MeasurementController', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="measure-output">Total Distance: 0.00 km</div>';
    MeasurementController.exit();
    vi.clearAllMocks();
  });

  describe('getDistance', () => {
    it('calculates geodesic distance between two points accurately', () => {
      // Verona to Venice (~100km approx)
      const pt1 = { lat: 45.438, lng: 10.993 };
      const pt2 = { lat: 45.440, lng: 12.315 };
      const dist = MeasurementController.getDistance(pt1, pt2);

      // Distance should be around 103,000 meters
      expect(dist).toBeGreaterThan(100000);
      expect(dist).toBeLessThan(110000);
    });

    it('returns 0 for identical points', () => {
      const pt = { lat: 45.438, lng: 10.993 };
      const dist = MeasurementController.getDistance(pt, pt);
      expect(dist).toBeCloseTo(0);
    });
  });

  describe('enter & exit', () => {
    it('enters measure mode and updates HUD state', () => {
      MeasurementController.enter();

      expect(RoutingController.exit).toHaveBeenCalled();
      expect(MeasurementController.isMeasureMode).toBe(true);
      expect(HUDController.setState).toHaveBeenCalledWith('measure');
    });

    it('exits measure mode and resets points/markers', () => {
      MeasurementController.enter();
      MeasurementController.handleClick({ lat: 45.4, lng: 11.8 });
      expect(MeasurementController.measurePoints.length).toBe(1);

      MeasurementController.exit();
      expect(MeasurementController.isMeasureMode).toBe(false);
      expect(MeasurementController.measurePoints.length).toBe(0);
      expect(document.getElementById('measure-output').innerText).toBe('Total Distance: 0.00 km');
    });
  });

  describe('updateDistance', () => {
    it('formats total distance and estimated walking/biking times', () => {
      MeasurementController.measurePoints = [
        { lat: 45.400, lng: 11.870 },
        { lat: 45.409, lng: 11.870 }, // ~1 km apart
      ];

      MeasurementController.updateDistance();

      const outputText = document.getElementById('measure-output').innerText;
      expect(outputText).toContain('km');
      expect(outputText).toContain('🚶');
      expect(outputText).toContain('🚴');
    });
  });
});
