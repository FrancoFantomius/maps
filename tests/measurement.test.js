// tests/measurement.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DefaultMeasurementController, {
  MeasurementController,
  getDistance,
  formatDistance,
  calculatePolylineDistances,
  calculateArea,
  formatArea,
  calculateTravelTimes,
  calculateWalkTime,
  calculateBikeTime,
  calculateCarTime,
  formatDuration,
  buildTrackPoints,
  generateGPXXml,
  downloadGPX,
  exportGPX
} from '../js/measurement/index.js';
import { MapService } from '../js/map/index.js';
import { HUDController } from '../js/hud/index.js';
import { RoutingController } from '../js/routing/index.js';
import { ApiService } from '../js/api/index.js';

vi.mock('../js/map/index.js', () => ({
  MapService: {
    getContainer: vi.fn(() => ({ style: { cursor: '' } })),
    updateSourceData: vi.fn(),
    setMeasureFillVisibility: vi.fn(),
    createMarker: vi.fn(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      getLngLat: vi.fn(() => ({ lat: 45.4, lng: 11.8 })),
    })),
    map: {},
    panTo: vi.fn(),
  },
}));

vi.mock('../js/hud/index.js', () => ({
  HUDController: {
    setState: vi.fn(),
    currentState: 'places',
  },
}));

vi.mock('../js/routing/index.js', () => ({
  RoutingController: {
    exit: vi.fn(),
  },
}));

vi.mock('../js/api/index.js', () => ({
  ApiService: {
    calculateMultiPointRoute: vi.fn(),
  },
}));

describe('Measurement Modules', () => {
  describe('measurement.js', () => {
    it('calculates geodesic distance between points accurately', () => {
      const pt1 = { lat: 45.438, lng: 10.993 };
      const pt2 = { lat: 45.440, lng: 12.315 };
      const dist = getDistance(pt1, pt2);
      expect(dist).toBeGreaterThan(100000);
      expect(dist).toBeLessThan(110000);
    });

    it('returns 0 for null, undefined or identical points', () => {
      expect(getDistance(null, { lat: 45, lng: 12 })).toBe(0);
      expect(getDistance({ lat: 45, lng: 12 }, null)).toBe(0);
      expect(getDistance({ lat: 45, lng: 12 }, { lat: 45, lng: 12 })).toBe(0);
    });

    it('calculates polyline segment distances and total distance', () => {
      const pts = [
        { lat: 45.400, lng: 11.870 },
        { lat: 45.409, lng: 11.870 },
        { lat: 45.409, lng: 11.883 }
      ];
      const openResult = calculatePolylineDistances(pts, false);
      expect(openResult.segmentDistances.length).toBe(2);
      expect(openResult.totalDistance).toBeGreaterThan(1500);

      const closedResult = calculatePolylineDistances(pts, true);
      expect(closedResult.segmentDistances.length).toBe(3);
      expect(closedResult.totalDistance).toBeGreaterThan(openResult.totalDistance);
    });

    it('formats distance values correctly in metric by default and imperial when enabled', () => {
      expect(formatDistance(0)).toBe('0.00 km');
      expect(formatDistance(-5)).toBe('0.00 km');
      expect(formatDistance(450)).toBe('450 m');
      expect(formatDistance(1500)).toBe('1.50 km');
      expect(formatDistance(12345)).toBe('12.35 km');

      // Imperial mode
      expect(formatDistance(0, true)).toBe('0.00 mi');
      expect(formatDistance(100, true)).toBe('328 ft');
      expect(formatDistance(1609.344, true)).toBe('1.00 mi');
      expect(formatDistance(5000, true)).toBe('3.11 mi');
    });
  });

  describe('area.js', () => {
    it('calculates spherical polygon area accurately', () => {
      const points = [
        { lat: 45.400, lng: 11.870 },
        { lat: 45.409, lng: 11.870 },
        { lat: 45.409, lng: 11.883 },
        { lat: 45.400, lng: 11.883 }
      ];
      const area = calculateArea(points);
      expect(area).toBeGreaterThan(800000);
      expect(area).toBeLessThan(1200000);
    });

    it('returns 0 for less than 3 points', () => {
      expect(calculateArea(null)).toBe(0);
      expect(calculateArea([])).toBe(0);
      expect(calculateArea([{ lat: 45, lng: 12 }, { lat: 46, lng: 13 }])).toBe(0);
    });

    it('formats area values correctly in metric by default and imperial when enabled', () => {
      expect(formatArea(0)).toBe('0.00 m²');
      expect(formatArea(-10)).toBe('0.00 m²');
      expect(formatArea(500)).toBe('500 m²');
      expect(formatArea(50000)).toBe('5.00 ha (0.050 km²)');
      expect(formatArea(2500000)).toBe('2.50 km²');

      // Imperial mode
      expect(formatArea(0, true)).toBe('0.00 sq ft');
      expect(formatArea(100, true)).toBe('1,076 sq ft');
      expect(formatArea(50000, true)).toBe('12.36 ac (0.019 sq mi)');
      expect(formatArea(5000000, true)).toBe('1.93 sq mi');
    });
  });

  describe('time.js', () => {
    it('calculates walk, bike, and car travel times correctly', () => {
      const dist = 4800; // 4.8 km -> 1 hour walk (3600s)
      expect(calculateWalkTime(dist)).toBeCloseTo(3600, 0);
      expect(calculateBikeTime(dist)).toBeCloseTo(4800 / (16.5 / 3.6), 0);
      expect(calculateCarTime(dist)).toBeCloseTo(4800 / (50 / 3.6), 0);
      expect(calculateCarTime(dist, 120, true)).toBe(120);
    });

    it('calculates all travel times in batch', () => {
      const result = calculateTravelTimes(4800);
      expect(result.walkSeconds).toBeGreaterThan(0);
      expect(result.bikeSeconds).toBeGreaterThan(0);
      expect(result.carSeconds).toBeGreaterThan(0);
      expect(result.walkStr).toBe('1 hr');
      expect(result.bikeStr).not.toBe('—');
      expect(result.carStr).not.toBe('—');
    });

    it('formats durations correctly', () => {
      expect(formatDuration(0)).toBe('—');
      expect(formatDuration(-10)).toBe('—');
      expect(formatDuration(25)).toBe('< 1 min');
      expect(formatDuration(180)).toBe('3 min');
      expect(formatDuration(3600)).toBe('1 hr');
      expect(formatDuration(5400)).toBe('1 hr 30 min');
    });
  });

  describe('gpx.js', () => {
    it('builds track points for distance mode', () => {
      const pts = [{ lat: 45.4, lng: 11.8 }, { lat: 45.5, lng: 11.9 }];
      const track = buildTrackPoints(pts, 'distance');
      expect(track).toEqual(pts);
    });

    it('builds track points closing loop for area mode', () => {
      const pts = [{ lat: 45.4, lng: 11.8 }, { lat: 45.5, lng: 11.9 }, { lat: 45.6, lng: 11.8 }];
      const track = buildTrackPoints(pts, 'area');
      expect(track.length).toBe(4);
      expect(track[3]).toEqual(pts[0]);
    });

    it('builds track points from routedGeometry for path mode', () => {
      const pts = [{ lat: 45.4, lng: 11.8 }, { lat: 45.5, lng: 11.9 }];
      const geom = { coordinates: [[11.8, 45.4], [11.85, 45.45], [11.9, 45.5]] };
      const track = buildTrackPoints(pts, 'path', geom);
      expect(track.length).toBe(3);
      expect(track[0]).toEqual({ lat: 45.4, lng: 11.8 });
    });

    it('generates valid GPX XML structure', () => {
      const track = [{ lat: 45.4, lng: 11.8 }, { lat: 45.5, lng: 11.9 }];
      const xml = generateGPXXml(track, { mode: 'distance', date: new Date('2026-01-01T00:00:00Z') });
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<trkpt lat="45.4" lon="11.8"></trkpt>');
      expect(xml).toContain('<trkpt lat="45.5" lon="11.9"></trkpt>');
      expect(xml).toContain('<name>Measured Path</name>');
    });

    it('downloads GPX and returns false if insufficient points', () => {
      const createObjectURLMock = vi.fn(() => 'blob:url');
      const revokeObjectURLMock = vi.fn();
      global.URL.createObjectURL = createObjectURLMock;
      global.URL.revokeObjectURL = revokeObjectURLMock;

      expect(exportGPX([{ lat: 45.4, lng: 11.8 }], 'distance')).toBe(false);
      expect(exportGPX([{ lat: 45.4, lng: 11.8 }, { lat: 45.5, lng: 11.9 }], 'area')).toBe(false);

      const success = exportGPX([{ lat: 45.4, lng: 11.8 }, { lat: 45.5, lng: 11.9 }], 'distance');
      expect(success).toBe(true);
      expect(createObjectURLMock).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalled();
    });
  });
});

describe('MeasurementController', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="measure-summary-label">Total Distance</div>
      <div id="measure-output">Total Distance: 0.00 km</div>
      <div id="measure-total-value">0.00 km</div>
      <div id="measure-estimates"></div>
      <div id="measure-points-list"></div>
      <button id="measure-mode-distance" variant="filled"></button>
      <button id="measure-mode-path" variant="outlined"></button>
      <button id="measure-mode-area" variant="outlined"></button>
      <button id="btn-save-gpx" disabled></button>
      <button id="btn-clear-measure" class="hidden"></button>
    `;
    MeasurementController.exit();
    MeasurementController.mode = 'distance';
    vi.clearAllMocks();
  });

  it('provides default export matching MeasurementController', () => {
    expect(DefaultMeasurementController).toBe(MeasurementController);
  });

  describe('getDistance', () => {
    it('calculates geodesic distance on WGS-84 ellipsoid accurately', () => {
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

  describe('mode switching (Distance vs Path)', () => {
    it('switches between distance and path modes and updates UI', async () => {
      MeasurementController.setMode('path');
      expect(MeasurementController.mode).toBe('path');
      expect(document.getElementById('measure-mode-distance').getAttribute('variant')).toBe('outlined');
      expect(document.getElementById('measure-mode-path').getAttribute('variant')).toBe('filled');

      MeasurementController.setMode('distance');
      expect(MeasurementController.mode).toBe('distance');
      expect(document.getElementById('measure-mode-distance').getAttribute('variant')).toBe('filled');
      expect(document.getElementById('measure-mode-path').getAttribute('variant')).toBe('outlined');

      MeasurementController.setMode('area');
      expect(MeasurementController.mode).toBe('area');
      expect(document.getElementById('measure-mode-area').getAttribute('variant')).toBe('filled');
      expect(document.getElementById('measure-mode-distance').getAttribute('variant')).toBe('outlined');
    });

    it('calculates polygon area in area mode accurately and toggles fill layer visibility', () => {
      MeasurementController.enter();
      MeasurementController.mode = 'area';
      // Define ~1km x 1km square
      MeasurementController.handleClick({ lat: 45.400, lng: 11.870 });
      MeasurementController.handleClick({ lat: 45.409, lng: 11.870 });
      expect(MapService.setMeasureFillVisibility).toHaveBeenCalledWith(false);

      MeasurementController.handleClick({ lat: 45.409, lng: 11.883 });
      expect(MapService.setMeasureFillVisibility).toHaveBeenCalledWith(true);

      MeasurementController.handleClick({ lat: 45.400, lng: 11.883 });

      expect(MeasurementController.totalArea).toBeGreaterThan(800000);
      expect(MeasurementController.totalArea).toBeLessThan(1200000);
      expect(MapService.updateSourceData).toHaveBeenCalledWith(
        'measure-source',
        expect.objectContaining({
          type: 'Feature',
          geometry: expect.objectContaining({ type: 'Polygon' })
        })
      );

      // When switching to distance mode, fill layer must be hidden
      MeasurementController.setMode('distance');
      expect(MapService.setMeasureFillVisibility).toHaveBeenLastCalledWith(false);
    });

    it('calculates straight line segments in distance mode', () => {
      MeasurementController.mode = 'distance';
      MeasurementController.handleClick({ lat: 45.400, lng: 11.870 });
      MeasurementController.handleClick({ lat: 45.409, lng: 11.870 });

      expect(MeasurementController.totalDist).toBeGreaterThan(900);
      expect(MeasurementController.segmentDistances.length).toBe(1);
      expect(MapService.updateSourceData).toHaveBeenCalledWith(
        'measure-source',
        expect.objectContaining({
          type: 'Feature',
          geometry: expect.objectContaining({ type: 'LineString' })
        })
      );
    });

    it('calculates multi-point route in path mode using ApiService', async () => {
      MeasurementController.mode = 'path';
      ApiService.calculateMultiPointRoute.mockResolvedValueOnce({
        routes: [{
          distance: 1500,
          legs: [{ distance: 1500 }],
          geometry: { type: 'LineString', coordinates: [[11.87, 45.4], [11.87, 45.41]] }
        }]
      });

      MeasurementController.handleClick({ lat: 45.400, lng: 11.870 });
      await MeasurementController.handleClick({ lat: 45.409, lng: 11.870 });

      expect(ApiService.calculateMultiPointRoute).toHaveBeenCalled();
      expect(MeasurementController.totalDist).toBe(1500);
      expect(MeasurementController.segmentDistances).toEqual([1500]);
    });
  });

  describe('remove and clear points', () => {
    it('removes a point by index and recalculates distance', () => {
      MeasurementController.mode = 'distance';
      MeasurementController.handleClick({ lat: 45.400, lng: 11.870 });
      MeasurementController.handleClick({ lat: 45.410, lng: 11.870 });
      MeasurementController.handleClick({ lat: 45.420, lng: 11.870 });
      expect(MeasurementController.measurePoints.length).toBe(3);

      MeasurementController.removePoint(1);
      expect(MeasurementController.measurePoints.length).toBe(2);
      expect(MeasurementController.segmentDistances.length).toBe(1);
    });

    it('clears all points when clearPoints is called', () => {
      MeasurementController.handleClick({ lat: 45.400, lng: 11.870 });
      MeasurementController.handleClick({ lat: 45.410, lng: 11.870 });
      MeasurementController.clearPoints();

      expect(MeasurementController.measurePoints.length).toBe(0);
      expect(MeasurementController.totalDist).toBe(0);
      expect(document.getElementById('measure-points-list').innerHTML).toContain('measure-empty-state');
    });

    it('adds an existing point again and keeps sequential numbering (e.g. 1 - 2 - 3 - 4 - 2 - 5)', () => {
      MeasurementController.handleClick({ lat: 45.401, lng: 11.871 }); // 1
      MeasurementController.handleClick({ lat: 45.402, lng: 11.872 }); // 2
      MeasurementController.handleClick({ lat: 45.403, lng: 11.873 }); // 3
      MeasurementController.handleClick({ lat: 45.404, lng: 11.874 }); // 4

      // Add point 2 again
      const pt2 = MeasurementController.measurePoints[1];
      MeasurementController.addExistingPoint(pt2);

      // Add new point 5
      MeasurementController.handleClick({ lat: 45.405, lng: 11.875 }); // 5

      const sequence = MeasurementController.measurePoints.map(p => p.pointNumber);
      expect(sequence).toEqual([1, 2, 3, 4, 2, 5]);
      expect(MeasurementController.segmentDistances.length).toBe(5);
    });

    it('updates point coordinates, line, and distance when a marker is dragged/moved', () => {
      let eventCallbacks = {};
      let mockLngLat = { lat: 45.400, lng: 11.870 };

      MapService.createMarker.mockImplementation((el, draggable) => {
        expect(draggable).toBe(true);
        return {
          setLngLat: vi.fn().mockReturnThis(),
          addTo: vi.fn().mockReturnThis(),
          on: vi.fn((event, cb) => {
            eventCallbacks[event] = cb;
            return this;
          }),
          getLngLat: vi.fn(() => mockLngLat),
          remove: vi.fn(),
        };
      });

      MeasurementController.mode = 'distance';
      MeasurementController.handleClick({ lat: 45.400, lng: 11.870 }); // Point 1
      MeasurementController.handleClick({ lat: 45.410, lng: 11.870 }); // Point 2

      const initialDist = MeasurementController.totalDist;
      expect(initialDist).toBeGreaterThan(0);

      // Simulate dragging point 2 to a further location
      mockLngLat = { lat: 45.450, lng: 11.870 };
      if (eventCallbacks['dragstart']) eventCallbacks['dragstart']();
      if (eventCallbacks['drag']) eventCallbacks['drag']();

      expect(MeasurementController.measurePoints[1].lat).toBe(45.450);
      expect(MeasurementController.measurePoints[1].lng).toBe(11.870);
      expect(MeasurementController.totalDist).toBeGreaterThan(initialDist);

      // Simulate dragend
      if (eventCallbacks['dragend']) eventCallbacks['dragend']();
      expect(MeasurementController.measurePoints[1].lat).toBe(45.450);
      expect(MapService.updateSourceData).toHaveBeenCalledWith(
        'measure-source',
        expect.objectContaining({
          type: 'Feature',
          geometry: expect.objectContaining({
            type: 'LineString',
            coordinates: [
              [11.870, 45.400],
              [11.870, 45.450]
            ]
          })
        })
      );
    });
  });

  describe('Travel time rendering', () => {
    it('formats Walk, Bike, and Car times without emojis', () => {
      MeasurementController.mode = 'distance';
      MeasurementController.handleClick({ lat: 45.400, lng: 11.870 });
      MeasurementController.handleClick({ lat: 45.409, lng: 11.870 }); // ~1 km

      const outputText = document.getElementById('measure-output').innerText;
      expect(outputText).toContain('Walk:');
      expect(outputText).toContain('Bike:');
      expect(outputText).toContain('Car:');
      expect(outputText).not.toContain('🚶');
      expect(outputText).not.toContain('🚴');
      expect(outputText).not.toContain('🚗');
    });
  });

  describe('GPX export', () => {
    it('exports GPX correctly when >= 2 points exist', () => {
      MeasurementController.handleClick({ lat: 45.400, lng: 11.870 });
      MeasurementController.handleClick({ lat: 45.410, lng: 11.870 });

      const createObjectURLMock = vi.fn(() => 'blob:url');
      const revokeObjectURLMock = vi.fn();
      global.URL.createObjectURL = createObjectURLMock;
      global.URL.revokeObjectURL = revokeObjectURLMock;

      MeasurementController.exportGPX();
      expect(createObjectURLMock).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalled();
    });
  });
});
