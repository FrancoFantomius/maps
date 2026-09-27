// maps Travel Time Calculation Functions - js/measurement/time.js

const WALK_SPEED_MS = 4.8 / 3.6; // 4.8 km/h in m/s
const BIKE_SPEED_MS = 16.5 / 3.6; // 16.5 km/h in m/s
const CAR_DEFAULT_SPEED_MS = 50 / 3.6; // 50 km/h in m/s

/**
 * Calculates estimated walking time in seconds for a given distance in meters.
 *
 * @param {number} distanceMeters
 * @returns {number} Time in seconds
 */
export function calculateWalkTime(distanceMeters) {
    if (!distanceMeters || distanceMeters <= 0) return 0;
    return distanceMeters / WALK_SPEED_MS;
}

/**
 * Calculates estimated biking time in seconds for a given distance in meters.
 *
 * @param {number} distanceMeters
 * @returns {number} Time in seconds
 */
export function calculateBikeTime(distanceMeters) {
    if (!distanceMeters || distanceMeters <= 0) return 0;
    return distanceMeters / BIKE_SPEED_MS;
}

/**
 * Calculates estimated driving time in seconds for a given distance in meters or routed duration.
 *
 * @param {number} distanceMeters
 * @param {number} [routedDuration=0]
 * @param {boolean} [isPathMode=false]
 * @returns {number} Time in seconds
 */
export function calculateCarTime(distanceMeters, routedDuration = 0, isPathMode = false) {
    if (isPathMode && routedDuration > 0) {
        return routedDuration;
    }
    if (!distanceMeters || distanceMeters <= 0) return 0;
    return distanceMeters / CAR_DEFAULT_SPEED_MS;
}

/**
 * Calculates travel times and formatted strings for all modes (walk, bike, car).
 *
 * @param {number} totalDist Distance in meters
 * @param {number} [routedDuration=0] Precalculated duration for route in seconds
 * @param {boolean} [isPathMode=false]
 * @returns {{ walkSeconds: number, bikeSeconds: number, carSeconds: number, walkStr: string, bikeStr: string, carStr: string }}
 */
export function calculateTravelTimes(totalDist, routedDuration = 0, isPathMode = false) {
    if (!totalDist || totalDist <= 0) {
        return {
            walkSeconds: 0,
            bikeSeconds: 0,
            carSeconds: 0,
            walkStr: '—',
            bikeStr: '—',
            carStr: '—'
        };
    }

    const walkSeconds = calculateWalkTime(totalDist);
    const bikeSeconds = calculateBikeTime(totalDist);
    const carSeconds = calculateCarTime(totalDist, routedDuration, isPathMode);

    return {
        walkSeconds,
        bikeSeconds,
        carSeconds,
        walkStr: formatDuration(walkSeconds),
        bikeStr: formatDuration(bikeSeconds),
        carStr: formatDuration(carSeconds)
    };
}

/**
 * Formats a duration in seconds into a human-readable string.
 *
 * @param {number} seconds
 * @returns {string} Formatted duration (e.g. "< 1 min", "15 min", "1 hr", "2 hr 30 min")
 */
export function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '—';
    const minutes = Math.round(seconds / 60);
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    if (remainingMins === 0) return `${hours} hr`;
    return `${hours} hr ${remainingMins} min`;
}
