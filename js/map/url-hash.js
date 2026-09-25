// maps URL Coordinates & Hash Manager - js/map/url-hash.js

/**
 * Parses coordinates and zoom level from a URL or hash string.
 * Supports multiple formats:
 *  - #[lat+lng+zoom] or #[lat+lng]
 *  - #lat+lng+zoom or #lat+lng
 *  - #zoom/lat/lng or #zoom/lat/lng/bearing/pitch (MapLibre / Leaflet standard)
 *  - #lat/lng/zoom
 *  - #lat,lng,zoom or #lat,lng
 *  - #map=zoom/lat/lng (OSM standard)
 *  - ?lat=...&lng=...&zoom=... (Query parameters)
 *
 * @param {string} [urlOrHash] - The URL, hash, or query string to parse (defaults to window.location)
 * @returns {{lat: number, lng: number, zoom: number, bearing: number, pitch: number}|null}
 */
export function parseUrlCoordinates(urlOrHash) {
    let input = urlOrHash;
    if (!input && typeof window !== 'undefined') {
        input = (window.location.hash || '') + (window.location.search || '');
        if (!input && window.location.href) {
            input = window.location.href;
        }
    }
    if (!input || typeof input !== 'string') return null;

    input = input.trim();

    // 1. Check query parameters if present
    if (input.includes('?')) {
        const queryPart = input.split('?')[1].split('#')[0];
        const params = new URLSearchParams(queryPart);
        const latVal = params.get('lat') || params.get('latitude');
        const lngVal = params.get('lng') || params.get('lon') || params.get('longitude');
        const zoomVal = params.get('zoom') || params.get('z');

        if (latVal !== null && lngVal !== null) {
            const lat = parseFloat(latVal);
            const lng = parseFloat(lngVal);
            const zoom = zoomVal !== null ? parseFloat(zoomVal) : 13;

            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                return {
                    lat,
                    lng,
                    zoom: !isNaN(zoom) ? Math.min(Math.max(zoom, 0), 24) : 13,
                    bearing: 0,
                    pitch: 0
                };
            }
        }
    }

    // 2. Extract hash portion
    let hash = input;
    if (hash.includes('#')) {
        hash = hash.substring(hash.indexOf('#') + 1);
    }
    if (hash.includes('?')) {
        hash = hash.split('?')[0];
    }
    hash = hash.trim();
    if (!hash) return null;

    // 3. OpenStreetMap #map=zoom/lat/lon format
    if (hash.startsWith('map=')) {
        const parts = hash.slice(4).split('/');
        if (parts.length >= 3) {
            const zoom = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            const lng = parseFloat(parts[2]);
            if (!isNaN(lat) && !isNaN(lng) && !isNaN(zoom) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                return {
                    lat,
                    lng,
                    zoom: Math.min(Math.max(zoom, 0), 24),
                    bearing: 0,
                    pitch: 0
                };
            }
        }
    }

    // 4. Strip outer brackets if present: #[...] -> ...
    let clean = hash;
    if (clean.startsWith('[') && clean.endsWith(']')) {
        clean = clean.slice(1, -1).trim();
    }

    // 5. Tokenize components
    let tokens = [];
    if (clean.includes('/')) {
        tokens = clean.split('/').map(t => t.trim()).filter(Boolean);
    } else if (clean.includes(',')) {
        tokens = clean.split(',').map(t => t.trim()).filter(Boolean);
    } else if (clean.includes('+')) {
        tokens = clean.split('+').map(t => t.trim()).filter(Boolean);
    } else if (clean.includes(';')) {
        tokens = clean.split(';').map(t => t.trim()).filter(Boolean);
    } else {
        const matches = clean.match(/[-+]?(?:\d*\.\d+|\d+)/g);
        if (matches) {
            tokens = matches;
        }
    }

    const nums = tokens.map(t => parseFloat(t.replace(/[zZ]$/, ''))).filter(n => !isNaN(n));
    if (nums.length < 2) return null;

    let lat = null;
    let lng = null;
    let zoom = 13;
    let bearing = 0;
    let pitch = 0;

    if (nums.length >= 3) {
        const hadSlash = clean.includes('/');
        const firstIsZoom = nums[0] >= 0 && nums[0] <= 24 && Math.abs(nums[1]) <= 90 && Math.abs(nums[2]) <= 180;
        const lastIsZoom = nums[2] >= 0 && nums[2] <= 24 && Math.abs(nums[0]) <= 90 && Math.abs(nums[1]) <= 180;

        if (hadSlash && firstIsZoom && !clean.includes('+')) {
            // Standard MapLibre / Leaflet hash: #zoom/lat/lng[/bearing/pitch]
            zoom = nums[0];
            lat = nums[1];
            lng = nums[2];
            if (nums.length >= 4) bearing = nums[3];
            if (nums.length >= 5) pitch = nums[4];
        } else if (lastIsZoom) {
            // #[lat+lng+zoom] or #lat,lng,zoom or #lat/lng/zoom
            lat = nums[0];
            lng = nums[1];
            zoom = nums[2];
            if (nums.length >= 4) bearing = nums[3];
            if (nums.length >= 5) pitch = nums[4];
        } else if (firstIsZoom) {
            zoom = nums[0];
            lat = nums[1];
            lng = nums[2];
            if (nums.length >= 4) bearing = nums[3];
            if (nums.length >= 5) pitch = nums[4];
        } else {
            lat = nums[0];
            lng = nums[1];
            zoom = nums[2];
        }
    } else if (nums.length === 2) {
        lat = nums[0];
        lng = nums[1];
        zoom = 13;
    }

    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

    zoom = Math.min(Math.max(isNaN(zoom) ? 13 : zoom, 0), 24);
    bearing = isNaN(bearing) ? 0 : bearing;
    pitch = Math.min(Math.max(isNaN(pitch) ? 0 : pitch, 0), 85);

    return { lat, lng, zoom, bearing, pitch };
}

/**
 * Formats coordinates into standard map hash string.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} zoom
 * @param {number} [bearing=0]
 * @param {number} [pitch=0]
 * @returns {string} e.g. "#13/45.4064/11.8768"
 */
export function formatUrlCoordinates(lat, lng, zoom, bearing = 0, pitch = 0) {
    const z = Math.round(zoom * 100) / 100;
    const la = Math.round(lat * 100000) / 100000;
    const ln = Math.round(lng * 100000) / 100000;
    const b = Math.round(bearing * 10) / 10;
    const p = Math.round(pitch);

    if (b !== 0 || p !== 0) {
        return `#${z}/${la}/${ln}/${b}/${p}`;
    }
    return `#${z}/${la}/${ln}`;
}

/**
 * Updates the browser's URL hash with the specified map coordinates without creating history clutter.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} zoom
 * @param {number} [bearing=0]
 * @param {number} [pitch=0]
 */
export function updateUrlHash(lat, lng, zoom, bearing = 0, pitch = 0) {
    if (typeof window === 'undefined') return;
    const newHash = formatUrlCoordinates(lat, lng, zoom, bearing, pitch);

    if (window.location.hash !== newHash) {
        if (window.history && window.history.replaceState) {
            const newUrl = `${window.location.pathname}${window.location.search}${newHash}`;
            window.history.replaceState(null, '', newUrl);
        } else {
            window.location.hash = newHash;
        }
    }
}
