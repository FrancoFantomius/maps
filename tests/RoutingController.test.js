// tests/RoutingController.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoutingController } from '../js/RoutingController.js';
import { MapService } from '../js/MapService.js';
import { HUDController } from '../js/HUDController.js';
import { ApiService } from '../js/ApiService.js';

vi.mock('../js/MapService.js', () => ({
  MapService: {
    createMarker: vi.fn(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
    updateSourceData: vi.fn(),
    clearRouteDisplay: vi.fn(),
    drawAlternativeRoutes: vi.fn(),
    drawMainRoute: vi.fn(),
    fitRouteBounds: vi.fn(),
    renderRouteSummary: vi.fn(),
    map: { fitBounds: vi.fn() },
  },
}));

vi.mock('../js/HUDController.js', () => ({
  HUDController: {
    setState: vi.fn(),
    showToast: vi.fn(),
  },
}));

vi.mock('../js/ApiService.js', () => ({
  ApiService: {
    calculateRoute: vi.fn(),
  },
}));

describe('RoutingController', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="nav-origin-input" value="" />
      <input id="nav-dest-input" value="" />
      <div id="nav-origin-autocomplete" class="hidden"></div>
      <div id="nav-dest-autocomplete" class="hidden"></div>
      <div id="nav-steps-list"></div>
    `;
    RoutingController.routeStart = null;
    RoutingController.routeEnd = null;
    RoutingController.routeStartName = '';
    RoutingController.routeEndName = '';
    RoutingController.routingProfile = 'driving';
    vi.clearAllMocks();
  });

  describe('getManeuverIcon', () => {
    it('returns proper Material Icon string for maneuvers', () => {
      expect(RoutingController.getManeuverIcon('depart')).toBe('trip_origin');
      expect(RoutingController.getManeuverIcon('arrive')).toBe('flag');
      expect(RoutingController.getManeuverIcon('roundabout')).toBe('rotate_right');
      expect(RoutingController.getManeuverIcon('turn', 'left')).toBe('turn_left');
      expect(RoutingController.getManeuverIcon('turn', 'right')).toBe('turn_right');
      expect(RoutingController.getManeuverIcon('turn', 'slight left')).toBe('turn_slight_left');
      expect(RoutingController.getManeuverIcon('fork', 'left')).toBe('fork_left');
    });
  });

  describe('formatDuration & formatDistance', () => {
    it('formats durations cleanly', () => {
      expect(RoutingController.formatDuration(20)).toBe('< 1 min');
      expect(RoutingController.formatDuration(300)).toBe('5 min');
      expect(RoutingController.formatDuration(3600)).toBe('1 hr');
      expect(RoutingController.formatDuration(3900)).toBe('1 hr 5 min');
    });

    it('formats distances cleanly', () => {
      expect(RoutingController.formatDistance(500)).toBe('500 m');
      expect(RoutingController.formatDistance(2500)).toBe('2.5 km');
      expect(RoutingController.formatStepDistance(45)).toBe('45 m');
      expect(RoutingController.formatStepDistance(250)).toBe('250 m');
    });
  });

  describe('swapWaypoints', () => {
    it('swaps route start and route end', () => {
      RoutingController.routeStart = { lat: 45.4, lng: 11.8 };
      RoutingController.routeEnd = { lat: 45.5, lng: 11.9 };
      RoutingController.routeStartName = 'Start Point';
      RoutingController.routeEndName = 'End Point';

      RoutingController.swapWaypoints();

      expect(RoutingController.routeStart).toEqual({ lat: 45.5, lng: 11.9 });
      expect(RoutingController.routeEnd).toEqual({ lat: 45.4, lng: 11.8 });
      expect(RoutingController.routeStartName).toBe('End Point');
      expect(RoutingController.routeEndName).toBe('Start Point');
    });
  });

  describe('calculateRoute & error handling', () => {
    it('handles null/undefined response from API gracefully without crashing', async () => {
      RoutingController.routeStart = { lat: 45.4, lng: 11.8 };
      RoutingController.routeEnd = { lat: 45.5, lng: 11.9 };
      ApiService.calculateRoute.mockResolvedValueOnce(undefined);

      await RoutingController.calculateRoute();

      const stepsList = document.getElementById('nav-steps-list');
      expect(stepsList.innerHTML).toContain('Could not find a route between these points');
    });

    it('handles API error response gracefully', async () => {
      RoutingController.routeStart = { lat: 45.4, lng: 11.8 };
      RoutingController.routeEnd = { lat: 45.5, lng: 11.9 };
      ApiService.calculateRoute.mockResolvedValueOnce({ code: 'NoRoute', routes: [] });

      await RoutingController.calculateRoute();

      const stepsList = document.getElementById('nav-steps-list');
      expect(stepsList.innerHTML).toContain('Could not find a route between these points');
    });
  });

  describe('setProfile', () => {
    it('updates routingProfile and triggers calculation if start & end are set', async () => {
      RoutingController.routeStart = { lat: 45.4, lng: 11.8 };
      RoutingController.routeEnd = { lat: 45.5, lng: 11.9 };
      ApiService.calculateRoute.mockResolvedValueOnce({
        code: 'Ok',
        routes: [{ distance: 1000, duration: 600, geometry: { coordinates: [] } }],
      });

      await RoutingController.setProfile('cycling');

      expect(RoutingController.routingProfile).toBe('cycling');
      expect(ApiService.calculateRoute).toHaveBeenCalledWith(
        RoutingController.routeStart,
        RoutingController.routeEnd,
        'cycling'
      );
    });
  });
});
