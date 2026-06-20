// maps State Management

export const DEFAULT_LAT = 45.4064;
export const DEFAULT_LNG = 11.8768;
export const DEFAULT_ZOOM = 13;
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 18;

export const colorPalette = {
    poi: { main: '#6366f1', fill: '#818cf8', svg: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' },
    food: { main: '#ef4444', fill: '#f87171', svg: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm4-3h2v16h2V2h-4c0 2.21 1.79 4 4 4z' },
    lodging: { main: '#a855f7', fill: '#c084fc', svg: 'M7 14c1.66 0 3-1.34 3-3S8.66 8 7 8s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z' },
    nature: { main: '#10b981', fill: '#34d399', svg: 'M2 22h20v-2h-3l-3.23-6.46L19 12h-3l-3.32-6.64L15 4H9l2.32 4.64L8 10H5l3.23 6.46L5 18H2v4z' }
};

export const state = {
    map: null,
    baseLayers: {},
    overlayLayers: {},
    activeLayerKey: 'street',
    activeOverlays: { labels: false, bike: false },
    customMarkers: [],
    markerInstances: [],
    tempMarker: null,
    highlightedPath: null,
    
    // Measurement State
    isMeasureMode: false,
    measureLine: null,
    measurePoints: [],
    measureMarkers: [],
    
    // Routing State
    isRouteMode: false,
    routingProfile: 'driving-car',
    routeStart: null,
    routeEnd: null,
    routeStartMarker: null,
    routeEndMarker: null,
    routeLineInstance: null,
    
    // HUD / Panel state
    currentHUDState: 'places'
};
