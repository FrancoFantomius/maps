// tests/HUDController.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HUDController } from '../js/HUDController.js';
import { MapService } from '../js/MapService.js';
import { MarkerController } from '../js/MarkerController.js';

vi.mock('../js/MapService.js', () => ({
  MapService: {
    highlightedPathCoords: null,
    updateSourceData: vi.fn(),
  },
}));

vi.mock('../js/MarkerController.js', () => ({
  MarkerController: {
    removeTempMarker: vi.fn(),
    openModal: vi.fn(),
    colorPalette: { poi: { main: '#6366f1' } },
  },
}));

describe('HUDController', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="hud-panel" class="hud-closed"></div>
      <div id="panel-places" class="hidden"></div>
      <div id="panel-search" class="hidden"></div>
      <div id="panel-details" class="hidden"></div>
      <div id="measure-panel" class="hidden"></div>
      <div id="nav-panel" class="hidden"></div>
      <button id="btn-draw"></button>
      <button id="btn-route"></button>
    `;
    HUDController.isOpen = false;
    HUDController.isExpanded = false;
    HUDController.currentState = 'places';
    vi.clearAllMocks();
  });

  describe('open & close', () => {
    it('opens HUD panel', () => {
      HUDController.open();

      const panel = document.getElementById('hud-panel');
      expect(HUDController.isOpen).toBe(true);
      expect(panel.classList.contains('hud-closed')).toBe(false);
    });

    it('closes HUD panel', () => {
      HUDController.open();
      HUDController.close();

      const panel = document.getElementById('hud-panel');
      expect(HUDController.isOpen).toBe(false);
      expect(panel.classList.contains('hud-closed')).toBe(true);
    });
  });

  describe('setState', () => {
    it('closes panel when state is "places"', () => {
      HUDController.setState('places');

      expect(HUDController.isOpen).toBe(false);
      expect(HUDController.currentState).toBe('places');
    });

    it('shows panel-search when state is "search-results"', () => {
      HUDController.setState('search-results');

      expect(HUDController.isOpen).toBe(true);
      expect(document.getElementById('panel-search').classList.contains('hidden')).toBe(false);
    });

    it('shows nav-panel when state is "route"', () => {
      HUDController.setState('route');

      expect(HUDController.isOpen).toBe(true);
      expect(document.getElementById('nav-panel').classList.contains('hidden')).toBe(false);
    });

    it('removes temp marker when state changes away from place-details', () => {
      HUDController.setState('measure');

      expect(MarkerController.removeTempMarker).toHaveBeenCalled();
    });
  });

  describe('clearHighlightedPath', () => {
    it('clears highlighted path from MapService source', () => {
      MapService.highlightedPathCoords = [[11.8, 45.4], [11.9, 45.5]];
      HUDController.clearHighlightedPath();

      expect(MapService.highlightedPathCoords).toBeNull();
      expect(MapService.updateSourceData).toHaveBeenCalledWith('highlight-path-source', {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [] },
      });
    });
  });
});
