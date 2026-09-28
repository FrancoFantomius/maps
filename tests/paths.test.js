// tests/paths.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseGPX, generatePathGPX } from '../js/paths/gpx-parser.js';
import { PathsController } from '../js/paths/paths-controller.js';
import { MapService } from '../js/map/index.js';
import { savePath, loadAllPaths, deletePathFromDB } from '../js/db/index.js';
import * as gpxModule from '../js/measurement/gpx.js';

vi.mock('../js/map/index.js', () => ({
  MapService: {
    displayPath: vi.fn(),
    clearDisplayedPath: vi.fn(),
    isImperialUnits: false,
    map: {},
  },
}));

vi.mock('../js/db/index.js', () => ({
  savePath: vi.fn().mockResolvedValue({ id: 'path_123' }),
  deletePathFromDB: vi.fn().mockResolvedValue(true),
  loadAllPaths: vi.fn().mockResolvedValue([]),
  getSyncSettings: vi.fn().mockResolvedValue({ enabled: false }),
}));

describe('Paths Feature', () => {
  describe('gpx-parser.js', () => {
    it('parses track points and metadata name from GPX XML', () => {
      const gpxSample = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Maps">
  <metadata>
    <name>Morning Run</name>
  </metadata>
  <trk>
    <name>Morning Run</name>
    <trkseg>
      <trkpt lat="45.4380" lon="10.9930"></trkpt>
      <trkpt lat="45.4400" lon="10.9950"></trkpt>
      <trkpt lat="45.4420" lon="10.9980"></trkpt>
    </trkseg>
  </trk>
</gpx>`;

      const result = parseGPX(gpxSample);
      expect(result.name).toBe('Morning Run');
      expect(result.points.length).toBe(3);
      expect(result.points[0]).toEqual({ lat: 45.438, lng: 10.993 });
      expect(result.distance).toBeGreaterThan(0);
    });

    it('parses route points (<rtept>) when trkpt is absent', () => {
      const gpxRoute = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <rte>
    <name>Bike Route</name>
    <rtept lat="45.400" lon="11.870"></rtept>
    <rtept lat="45.410" lon="11.880"></rtept>
  </rte>
</gpx>`;

      const result = parseGPX(gpxRoute);
      expect(result.name).toBe('Bike Route');
      expect(result.points.length).toBe(2);
      expect(result.points[0]).toEqual({ lat: 45.4, lng: 11.87 });
    });

    it('throws error for invalid GPX XML or fewer than 2 points', () => {
      expect(() => parseGPX('')).toThrow();
      expect(() => parseGPX('<invalid></xml')).toThrow();
      const singlePoint = `<?xml version="1.0"?><gpx><trk><trkseg><trkpt lat="45.4" lon="11.8"></trkpt></trkseg></trk></gpx>`;
      expect(() => parseGPX(singlePoint)).toThrow(/at least 2 coordinate points/);
    });

    it('generates valid GPX XML from points', () => {
      const pts = [
        { lat: 45.438, lng: 10.993 },
        { lat: 45.440, lng: 10.995 }
      ];
      const xml = generatePathGPX(pts, { name: 'Scenic <Trail> & View', mode: 'path', date: new Date('2026-05-01T00:00:00Z') });
      expect(xml).toContain('<name>Scenic &lt;Trail&gt; &amp; View</name>');
      expect(xml).toContain('<trkpt lat="45.438" lon="10.993">');
      expect(xml).toContain('<trkpt lat="45.44" lon="10.995">');
    });
  });

  describe('PathsController', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="saved-paths-list"></div>
        <span id="path-count-badge">0</span>
        <div id="saved-paths-expand-container" class="hidden">
          <button id="btn-expand-saved-paths"></button>
        </div>
        <div id="path-modal" class="hidden"></div>
        <input id="path-modal-name" />
        <span id="path-modal-title"></span>
        <p id="path-modal-info"></p>
        <button id="btn-close-path-modal"></button>
        <button id="btn-save-path-modal"></button>
        <form id="path-form"></form>
      `;
      PathsController.customPaths = [];
      PathsController.visibleLimit = 3;
      PathsController.activePathId = null;
      vi.clearAllMocks();
    });

    it('renders empty state when there are no saved paths', () => {
      PathsController.customPaths = [];
      PathsController.renderAll();

      const listEl = document.getElementById('saved-paths-list');
      const badgeEl = document.getElementById('path-count-badge');
      expect(badgeEl.innerText).toBe('0');
      expect(listEl.innerHTML).toContain('No saved paths yet');
    });

    it('renders saved paths list and updates badge', () => {
      PathsController.customPaths = [
        {
          id: 'p1',
          name: 'Lake Tour',
          points: [{ lat: 45.4, lng: 11.8 }, { lat: 45.5, lng: 11.9 }],
          distance: 15400
        },
        {
          id: 'p2',
          name: 'City Walk',
          points: [{ lat: 45.1, lng: 10.1 }, { lat: 45.2, lng: 10.2 }],
          distance: 3200
        }
      ];

      PathsController.renderAll();

      const badgeEl = document.getElementById('path-count-badge');
      const listEl = document.getElementById('saved-paths-list');
      expect(badgeEl.innerText).toBe('2');
      expect(listEl.innerHTML).toContain('Lake Tour');
      expect(listEl.innerHTML).toContain('City Walk');
    });

    it('selects path and triggers MapService.displayPath', () => {
      const path = {
        id: 'p1',
        name: 'Lake Tour',
        points: [{ lat: 45.4, lng: 11.8 }, { lat: 45.5, lng: 11.9 }],
        distance: 15400
      };

      PathsController.selectPath(path);
      expect(PathsController.activePathId).toBe('p1');
      expect(MapService.displayPath).toHaveBeenCalledWith(path.points);
    });

    it('deletes path and clears displayed path if active', async () => {
      PathsController.customPaths = [
        { id: 'p1', name: 'Lake Tour', points: [] }
      ];
      PathsController.activePathId = 'p1';

      await PathsController.delete('p1');
      expect(deletePathFromDB).toHaveBeenCalledWith('p1');
      expect(PathsController.activePathId).toBeNull();
      expect(MapService.clearDisplayedPath).toHaveBeenCalled();
    });

    it('downloads path GPX using downloadGPX', () => {
      const spy = vi.spyOn(gpxModule, 'downloadGPX').mockImplementation(() => {});
      PathsController.customPaths = [
        { id: 'p1', name: 'Lake Tour', points: [{ lat: 45.4, lng: 11.8 }, { lat: 45.5, lng: 11.9 }], gpx: '<gpx></gpx>' }
      ];

      PathsController.download('p1');
      expect(spy).toHaveBeenCalledWith('<gpx></gpx>', 'Lake Tour.gpx');
      spy.mockRestore();
    });

    it('imports GPX file and saves to DB', async () => {
      const gpxText = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk><name>Trail X</name><trkseg><trkpt lat="45.0" lon="11.0"></trkpt><trkpt lat="45.1" lon="11.1"></trkpt></trkseg></trk>
</gpx>`;
      const mockFile = new Blob([gpxText], { type: 'application/gpx+xml' });
      mockFile.name = 'trail.gpx';

      await PathsController.importGPXFile(mockFile);
      expect(savePath).toHaveBeenCalled();
      expect(MapService.displayPath).toHaveBeenCalled();
    });

    it('saves measure path to DB and reloads', async () => {
      const measurePoints = [{ lat: 45.4, lng: 11.8 }, { lat: 45.5, lng: 11.9 }];
      await PathsController.saveMeasurePath(measurePoints, 'distance', null, 5000, 'Measured Track');

      expect(savePath).toHaveBeenCalled();
      const callArgs = savePath.mock.calls[0];
      expect(callArgs[1].name).toBe('Measured Track');
      expect(callArgs[1].distance).toBe(5000);
    });

    it('renames path and updates GPX content', async () => {
      PathsController.customPaths = [
        {
          id: 'p1',
          name: 'Old Name',
          points: [{ lat: 45.4, lng: 11.8 }, { lat: 45.5, lng: 11.9 }],
          mode: 'distance',
          distance: 5000
        }
      ];

      await PathsController.renamePath('p1', 'New Renamed Name');

      expect(savePath).toHaveBeenCalled();
      const callArgs = savePath.mock.calls[0];
      expect(callArgs[0]).toBe('p1');
      expect(callArgs[1].name).toBe('New Renamed Name');
      expect(callArgs[1].gpx).toContain('<name>New Renamed Name</name>');
    });
  });
});
