// maps GPX Export Functions - js/measurement/gpx.js

/**
 * Builds an array of {lat, lng} coordinate points based on measure points, mode, and routed geometry.
 *
 * @param {Array<{lat: number, lng: number}>} measurePoints
 * @param {string} mode 'distance' | 'path' | 'area'
 * @param {{coordinates?: number[][]}|null} [routedGeometry=null]
 * @returns {Array<{lat: number, lng: number}>}
 */
export function buildTrackPoints(measurePoints, mode, routedGeometry = null) {
    if (!measurePoints || measurePoints.length === 0) return [];

    if (mode === 'path' && routedGeometry && Array.isArray(routedGeometry.coordinates)) {
        return routedGeometry.coordinates.map(c => ({
            lat: c[1],
            lng: c[0]
        }));
    }

    const points = measurePoints.map(p => ({
        lat: p.lat,
        lng: p.lng
    }));

    if (mode === 'area' && points.length > 0) {
        // Close the loop for area polygon track
        points.push({
            lat: points[0].lat,
            lng: points[0].lng
        });
    }

    return points;
}

/**
 * Generates GPX 1.1 XML string from track points.
 *
 * @param {Array<{lat: number, lng: number}>} trackPoints
 * @param {{ mode?: string, date?: Date }} [options={}]
 * @returns {string} GPX XML string
 */
export function generateGPXXml(trackPoints, { mode = 'distance', date = new Date() } = {}) {
    const dateIso = (date instanceof Date ? date : new Date(date)).toISOString();
    const trkptsXml = (trackPoints || [])
        .map(p => `      <trkpt lat="${p.lat}" lon="${p.lng}"></trkpt>`)
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Maps" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Measured ${mode === 'area' ? 'Area' : 'Path'}</name>
    <time>${dateIso}</time>
  </metadata>
  <trk>
    <name>Measured ${mode === 'area' ? 'Area Boundary' : 'Track'}</name>
    <trkseg>
${trkptsXml}
    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Triggers a browser file download of a GPX string.
 *
 * @param {string} gpxXml
 * @param {string} filename
 */
export function downloadGPX(gpxXml, filename) {
    const blob = new Blob([gpxXml], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Exports measure points and route as a GPX file download.
 *
 * @param {Array<{lat: number, lng: number}>} measurePoints
 * @param {string} [mode='distance']
 * @param {{coordinates?: number[][]}|null} [routedGeometry=null]
 * @returns {boolean} Whether the export was triggered
 */
export function exportGPX(measurePoints, mode = 'distance', routedGeometry = null) {
    const minPoints = mode === 'area' ? 3 : 2;
    if (!measurePoints || measurePoints.length < minPoints) return false;

    const trackPoints = buildTrackPoints(measurePoints, mode, routedGeometry);
    const now = new Date();
    const dateIso = now.toISOString();
    const gpxXml = generateGPXXml(trackPoints, { mode, date: now });
    const filename = `measured-${mode}-${dateIso.slice(0, 10)}.gpx`;

    downloadGPX(gpxXml, filename);
    return true;
}
