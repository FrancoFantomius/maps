// maps Distance Measurement Functions - js/measurement/measurement.js

/**
 * Calculates geodesic distance between two points on the WGS-84 ellipsoid using Vincenty's inverse formula.
 * Falls back to the Haversine formula if Vincenty does not converge.
 *
 * @param {{lat: number, lng: number}} pt1
 * @param {{lat: number, lng: number}} pt2
 * @returns {number} Distance in meters
 */
export function getDistance(pt1, pt2) {
    if (!pt1 || !pt2) return 0;
    if (pt1.lat === pt2.lat && pt1.lng === pt2.lng) return 0;

    const a = 6378137; // WGS-84 semi-major axis in meters
    const b = 6356752.314245; // WGS-84 semi-minor axis in meters
    const f = 1 / 298.257223563; // Flattening

    const L = (pt2.lng - pt1.lng) * Math.PI / 180;
    const U1 = Math.atan((1 - f) * Math.tan(pt1.lat * Math.PI / 180));
    const U2 = Math.atan((1 - f) * Math.tan(pt2.lat * Math.PI / 180));
    const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
    const sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);

    let lambda = L;
    let lambdaP;
    let iterLimit = 100;
    let cosSqAlpha = 0, sinSigma = 0, cos2SigmaM = 0, cosSigma = 0, sigma = 0;

    do {
        const sinLambda = Math.sin(lambda);
        const cosLambda = Math.cos(lambda);
        sinSigma = Math.sqrt((cosU2 * sinLambda) * (cosU2 * sinLambda) +
            (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) * (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda));
        if (sinSigma === 0) return 0; // Coincident points
        cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
        sigma = Math.atan2(sinSigma, cosSigma);
        const sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
        cosSqAlpha = 1 - sinAlpha * sinAlpha;
        cos2SigmaM = cosSqAlpha !== 0 ? (cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha) : 0;
        const C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
        lambdaP = lambda;
        lambda = L + (1 - C) * f * sinAlpha *
            (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
    } while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0);

    if (iterLimit === 0 || isNaN(sigma)) {
        // Fallback to Haversine if Vincenty does not converge
        const R = 6371000;
        const phi1 = pt1.lat * Math.PI / 180;
        const phi2 = pt2.lat * Math.PI / 180;
        const deltaPhi = (pt2.lat - pt1.lat) * Math.PI / 180;
        const deltaLambda = (pt2.lng - pt1.lng) * Math.PI / 180;
        const aHav = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                     Math.cos(phi1) * Math.cos(phi2) *
                     Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        return R * 2 * Math.atan2(Math.sqrt(aHav), Math.sqrt(1 - aHav));
    }

    const uSq = cosSqAlpha * (a * a - b * b) / (b * b);
    const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
    const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
    const deltaSigma = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
        B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));

    return b * A * (sigma - deltaSigma);
}

/**
 * Calculates straight line segments and total distance between a series of points.
 *
 * @param {Array<{lat: number, lng: number}>} points
 * @param {boolean} [closed=false] Whether to close the path back to the first point
 * @returns {{segmentDistances: number[], totalDistance: number}}
 */
export function calculatePolylineDistances(points, closed = false) {
    if (!points || points.length < 2) {
        return { segmentDistances: [], totalDistance: 0 };
    }

    const segmentDistances = [];
    let totalDistance = 0;
    const n = points.length;

    for (let i = 1; i < n; i++) {
        const segDist = getDistance(points[i - 1], points[i]);
        segmentDistances.push(segDist);
        totalDistance += segDist;
    }

    if (closed && n >= 3) {
        const closingDist = getDistance(points[n - 1], points[0]);
        segmentDistances.push(closingDist);
        totalDistance += closingDist;
    }

    return { segmentDistances, totalDistance };
}

/**
 * Formats a distance in meters to a human-readable string.
 * Uses km / m by default, or mi / ft if imperial units are enabled.
 *
 * @param {number} meters
 * @param {boolean} [useImperial]
 * @returns {string} Formatted distance (e.g. "500 m", "1.50 km", "500 ft", "1.50 mi")
 */
export function formatDistance(meters, useImperial) {
    const isImperial = typeof useImperial === 'boolean'
        ? useImperial
        : (typeof localStorage !== 'undefined' && localStorage.getItem('maps_imperial_units') === 'true');

    if (!meters || meters <= 0) {
        return isImperial ? '0.00 mi' : '0.00 km';
    }

    if (isImperial) {
        const feet = meters * 3.28084;
        const miles = meters / 1609.344;
        if (feet < 1000) {
            return `${Math.round(feet)} ft`;
        }
        return `${miles.toFixed(2)} mi`;
    }

    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
}
