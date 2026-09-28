// maps GPX Parser and Serializer - js/paths/gpx-parser.js

import { getDistance, calculatePolylineDistances } from '../measurement/measurement.js';

/**
 * Parses a GPX XML string into structured path data.
 *
 * @param {string} gpxXmlString
 * @returns {{ name: string, points: Array<{lat: number, lng: number}>, distance: number }}
 */
export function parseGPX(gpxXmlString) {
    if (!gpxXmlString || typeof gpxXmlString !== 'string') {
        throw new Error('GPX data must be a non-empty string');
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(gpxXmlString, 'application/xml');

    const parserError = doc.querySelector('parsererror');
    if (parserError) {
        throw new Error('Invalid GPX format: ' + parserError.textContent);
    }

    // Extract path name
    let name = '';
    const metaName = doc.querySelector('metadata > name');
    const trkName = doc.querySelector('trk > name');
    const rteName = doc.querySelector('rte > name');

    if (metaName && metaName.textContent.trim()) {
        name = metaName.textContent.trim();
    } else if (trkName && trkName.textContent.trim()) {
        name = trkName.textContent.trim();
    } else if (rteName && rteName.textContent.trim()) {
        name = rteName.textContent.trim();
    }

    // Extract coordinate points
    const points = [];
    const trkpts = doc.querySelectorAll('trkpt');

    if (trkpts.length > 0) {
        trkpts.forEach(pt => {
            const lat = parseFloat(pt.getAttribute('lat'));
            const lng = parseFloat(pt.getAttribute('lon'));
            if (!isNaN(lat) && !isNaN(lng)) {
                points.push({ lat, lng });
            }
        });
    } else {
        const rtepts = doc.querySelectorAll('rtept');
        if (rtepts.length > 0) {
            rtepts.forEach(pt => {
                const lat = parseFloat(pt.getAttribute('lat'));
                const lng = parseFloat(pt.getAttribute('lon'));
                if (!isNaN(lat) && !isNaN(lng)) {
                    points.push({ lat, lng });
                }
            });
        } else {
            const wpts = doc.querySelectorAll('wpt');
            wpts.forEach(pt => {
                const lat = parseFloat(pt.getAttribute('lat'));
                const lng = parseFloat(pt.getAttribute('lon'));
                if (!isNaN(lat) && !isNaN(lng)) {
                    points.push({ lat, lng });
                }
            });
        }
    }

    if (points.length < 2) {
        throw new Error('GPX file must contain at least 2 coordinate points');
    }

    const { totalDistance } = calculatePolylineDistances(points, false);

    return {
        name: name || 'Imported Path',
        points,
        distance: totalDistance
    };
}

/**
 * Generates GPX 1.1 XML string from an array of coordinate points.
 *
 * @param {Array<{lat: number, lng: number}>} points
 * @param {{ name?: string, mode?: string, date?: Date }} [options={}]
 * @returns {string}
 */
export function generatePathGPX(points, { name = 'Saved Path', mode = 'path', date = new Date() } = {}) {
    const dateIso = (date instanceof Date ? date : new Date(date)).toISOString();
    const safeName = (name || 'Saved Path').replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });

    const trkptsXml = (points || [])
        .map(p => `      <trkpt lat="${p.lat}" lon="${p.lng}"></trkpt>`)
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Maps" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${safeName}</name>
    <time>${dateIso}</time>
  </metadata>
  <trk>
    <name>${safeName}</name>
    <trkseg>
${trkptsXml}
    </trkseg>
  </trk>
</gpx>`;
}
