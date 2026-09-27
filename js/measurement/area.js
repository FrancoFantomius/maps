// maps Area Measurement Functions - js/measurement/area.js

/**
 * Calculates the spherical polygon area of a closed set of coordinates on Earth.
 *
 * @param {Array<{lat: number, lng: number}>} points
 * @returns {number} Area in square meters
 */
export function calculateArea(points) {
    if (!points || points.length < 3) return 0;

    const R = 6378137; // Earth radius in meters
    let total = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % n];
        const p0 = points[(i - 1 + n) % n];

        const lambdaPrev = p0.lng * Math.PI / 180;
        const lambdaNext = p2.lng * Math.PI / 180;
        const phi = p1.lat * Math.PI / 180;

        let deltaLambda = lambdaNext - lambdaPrev;
        while (deltaLambda > Math.PI) deltaLambda -= 2 * Math.PI;
        while (deltaLambda < -Math.PI) deltaLambda += 2 * Math.PI;

        total += deltaLambda * Math.sin(phi);
    }

    const area = Math.abs(total * (R * R) / 2);
    return area; // in square meters
}

/**
 * Formats an area in square meters to a human-readable string.
 * Uses m² / ha / km² by default, or sq ft / ac / sq mi if imperial units are enabled.
 *
 * @param {number} sqMeters
 * @param {boolean} [useImperial]
 * @returns {string} Formatted area string (e.g. "150 m²", "2.50 ha (0.025 km²)", "12.34 km²", "500 sq ft", "2.50 ac (0.004 sq mi)")
 */
export function formatArea(sqMeters, useImperial) {
    const isImperial = typeof useImperial === 'boolean'
        ? useImperial
        : (typeof localStorage !== 'undefined' && localStorage.getItem('maps_imperial_units') === 'true');

    if (!sqMeters || sqMeters <= 0) {
        return isImperial ? '0.00 sq ft' : '0.00 m²';
    }

    if (isImperial) {
        const sqFeet = sqMeters * 10.76391;
        const acres = sqMeters / 4046.85642;
        const sqMiles = sqMeters / 2589988.11;

        if (sqFeet < 43560) {
            return `${Math.round(sqFeet).toLocaleString('en-US')} sq ft`;
        }
        if (acres < 640) {
            return `${acres.toFixed(2)} ac (${sqMiles.toFixed(3)} sq mi)`;
        }
        return `${sqMiles.toFixed(2)} sq mi`;
    }

    if (sqMeters < 10000) {
        return `${Math.round(sqMeters).toLocaleString('en-US')} m²`;
    }
    if (sqMeters < 1000000) {
        return `${(sqMeters / 10000).toFixed(2)} ha (${(sqMeters / 1000000).toFixed(3)} km²)`;
    }
    return `${(sqMeters / 1000000).toFixed(2)} km²`;
}
