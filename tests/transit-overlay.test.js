// tests/transit-overlay.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    TransitOverlay,
    normalizeColor,
    escapeHtml,
    parseOverpassToGeoJSON
} from '../js/map/transit-overlay.js';

describe('TransitOverlay helper functions', () => {
    describe('normalizeColor', () => {
        it('returns null for null, undefined, or empty strings', () => {
            expect(normalizeColor(null)).toBeNull();
            expect(normalizeColor(undefined)).toBeNull();
            expect(normalizeColor('')).toBeNull();
            expect(normalizeColor('   ')).toBeNull();
        });

        it('preserves valid hex colors with leading hash', () => {
            expect(normalizeColor('#ff0000')).toBe('#ff0000');
            expect(normalizeColor('#0284c7')).toBe('#0284c7');
        });

        it('prepends hash to 6-character hex strings missing hash', () => {
            expect(normalizeColor('E30613')).toBe('#E30613');
            expect(normalizeColor('008000')).toBe('#008000');
        });

        it('prepends hash to 3-character hex strings missing hash', () => {
            expect(normalizeColor('f00')).toBe('#f00');
        });

        it('preserves named CSS colors or complex color strings', () => {
            expect(normalizeColor('blue')).toBe('blue');
            expect(normalizeColor('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)');
        });
    });

    describe('escapeHtml', () => {
        it('escapes special HTML characters', () => {
            expect(escapeHtml('<script>alert("XSS")&\'test\'</script>'))
                .toBe('&lt;script&gt;alert(&quot;XSS&quot;)&amp;&#039;test&#039;&lt;/script&gt;');
        });

        it('returns empty string for falsy values', () => {
            expect(escapeHtml(null)).toBe('');
            expect(escapeHtml(undefined)).toBe('');
        });
    });

    describe('parseOverpassToGeoJSON', () => {
        it('returns empty feature collection for invalid or empty input', () => {
            expect(parseOverpassToGeoJSON(null)).toEqual({ type: 'FeatureCollection', features: [] });
            expect(parseOverpassToGeoJSON([])).toEqual({ type: 'FeatureCollection', features: [] });
        });

        it('parses bus stop nodes into Point features', () => {
            const elements = [
                {
                    type: 'node',
                    id: 12345,
                    lat: 45.4064,
                    lon: 11.8768,
                    tags: {
                        highway: 'bus_stop',
                        name: 'Central Station',
                        ref: '101',
                        operator: 'CityBus',
                        colour: '008000'
                    }
                }
            ];

            const result = parseOverpassToGeoJSON(elements);
            expect(result.features).toHaveLength(1);
            const feat = result.features[0];
            expect(feat.geometry.type).toBe('Point');
            expect(feat.geometry.coordinates).toEqual([11.8768, 45.4064]);
            expect(feat.properties.type).toBe('stop');
            expect(feat.properties.name).toBe('Central Station');
            expect(feat.properties.ref).toBe('101');
            expect(feat.properties.routeType).toBe('bus');
            expect(feat.properties.colour).toBe('#008000');
            expect(feat.properties.operator).toBe('CityBus');
        });

        it('parses tram and train stops with correct routeType', () => {
            const elements = [
                {
                    type: 'node',
                    id: 1,
                    lat: 45.4,
                    lon: 11.8,
                    tags: { railway: 'tram_stop', name: 'Piazza Garibaldi' }
                },
                {
                    type: 'node',
                    id: 2,
                    lat: 45.41,
                    lon: 11.81,
                    tags: { railway: 'station', name: 'Main Station' }
                }
            ];

            const result = parseOverpassToGeoJSON(elements);
            expect(result.features).toHaveLength(2);
            expect(result.features[0].properties.routeType).toBe('tram');
            expect(result.features[1].properties.routeType).toBe('train');
        });

        it('parses route relations with member geometries into LineStrings', () => {
            const elements = [
                {
                    type: 'relation',
                    id: 999,
                    tags: {
                        type: 'route',
                        route: 'bus',
                        ref: '4',
                        name: 'Line 4: North to South',
                        from: 'North Terminal',
                        to: 'South Hub',
                        colour: '#ef4444',
                        operator: 'Bus Transit Co'
                    },
                    members: [
                        {
                            type: 'way',
                            ref: 1001,
                            geometry: [
                                { lat: 45.4, lon: 11.8 },
                                { lat: 45.41, lon: 11.81 }
                            ]
                        },
                        {
                            type: 'way',
                            ref: 1002,
                            geometry: [
                                { lat: 45.41, lon: 11.81 },
                                { lat: 45.42, lon: 11.82 }
                            ]
                        }
                    ]
                }
            ];

            const result = parseOverpassToGeoJSON(elements);
            expect(result.features).toHaveLength(2);
            expect(result.features[0].geometry.type).toBe('LineString');
            expect(result.features[0].geometry.coordinates).toEqual([
                [11.8, 45.4],
                [11.81, 45.41]
            ]);
            expect(result.features[0].properties.ref).toBe('4');
            expect(result.features[0].properties.colour).toBe('#ef4444');
            expect(result.features[0].properties.from).toBe('North Terminal');
            expect(result.features[0].properties.to).toBe('South Hub');
        });

        it('parses standalone transit ways', () => {
            const elements = [
                {
                    type: 'way',
                    id: 777,
                    tags: {
                        railway: 'tram',
                        ref: 'T1',
                        colour: '#ea580c'
                    },
                    geometry: [
                        { lat: 45.4, lon: 11.8 },
                        { lat: 45.42, lon: 11.82 }
                    ]
                }
            ];

            const result = parseOverpassToGeoJSON(elements);
            expect(result.features).toHaveLength(1);
            expect(result.features[0].properties.type).toBe('route');
            expect(result.features[0].properties.route).toBe('tram');
            expect(result.features[0].properties.ref).toBe('T1');
        });
    });
});

describe('TransitOverlay lifecycle and map integration', () => {
    let mockMap;
    let layers;
    let sources;
    let eventHandlers;

    beforeEach(() => {
        layers = {};
        sources = {};
        eventHandlers = {};

        mockMap = {
            getZoom: vi.fn(() => 14),
            getBounds: vi.fn(() => ({
                getSouth: () => 45.40,
                getWest: () => 11.85,
                getNorth: () => 45.45,
                getEast: () => 11.90
            })),
            getSource: vi.fn(id => sources[id]),
            addSource: vi.fn((id, src) => {
                sources[id] = { ...src, setData: vi.fn() };
            }),
            getLayer: vi.fn(id => layers[id]),
            addLayer: vi.fn(layer => {
                layers[layer.id] = layer;
            }),
            setLayoutProperty: vi.fn((layerId, prop, value) => {
                if (layers[layerId]) {
                    if (!layers[layerId].layout) layers[layerId].layout = {};
                    layers[layerId].layout[prop] = value;
                }
            }),
            on: vi.fn((event, ...args) => {
                const handler = args[args.length - 1];
                if (!eventHandlers[event]) eventHandlers[event] = [];
                eventHandlers[event].push(handler);
            }),
            getCanvas: vi.fn(() => ({ style: {} }))
        };

        // Pretend openmaptiles source exists
        sources['openmaptiles'] = { type: 'vector' };

        TransitOverlay.featureCache.clear();
        TransitOverlay.loadedBboxes = [];
        TransitOverlay.eventsBound = false;
        TransitOverlay.debounceTimer = null;
        TransitOverlay.currentAbortController = null;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('sets up base and detail layers when setup is called', () => {
        TransitOverlay.setup(mockMap, true);

        // Base layers
        expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'transit-base-rail-casing' }));
        expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'transit-base-rail' }));
        expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'transit-base-transit' }));
        expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'transit-base-stations' }));

        // Detail source & layers
        expect(mockMap.addSource).toHaveBeenCalledWith('transit-detail-source', expect.any(Object));
        expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'transit-detail-routes' }));
        expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'transit-detail-stops' }));
    });

    it('sets visibility to none when initialized with isVisible = false', () => {
        TransitOverlay.setup(mockMap, false);

        expect(layers['transit-detail-routes'].layout.visibility).toBe('none');
        expect(layers['transit-base-rail'].layout.visibility).toBe('none');
    });

    it('toggles layer visibility when setVisible is called', () => {
        TransitOverlay.setup(mockMap, false);
        TransitOverlay.setVisible(true);

        expect(mockMap.setLayoutProperty).toHaveBeenCalledWith('transit-detail-routes', 'visibility', 'visible');
        expect(mockMap.setLayoutProperty).toHaveBeenCalledWith('transit-base-rail', 'visibility', 'visible');
        expect(TransitOverlay.isVisible).toBe(true);

        TransitOverlay.setVisible(false);
        expect(mockMap.setLayoutProperty).toHaveBeenCalledWith('transit-detail-routes', 'visibility', 'none');
        expect(TransitOverlay.isVisible).toBe(false);
    });

    it('does not fetch detail transit if zoom is below minDetailZoom', () => {
        mockMap.getZoom.mockReturnValue(11);
        TransitOverlay.setup(mockMap, true);

        const fetchSpy = vi.spyOn(TransitOverlay, 'fetchViewportTransit');
        TransitOverlay.scheduleFetch();

        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });

    it('identifies covered bounds correctly', () => {
        TransitOverlay.loadedBboxes = [
            { south: 45.0, west: 11.0, north: 46.0, east: 12.0 }
        ];

        expect(TransitOverlay.isBoundsCovered(45.2, 11.2, 45.8, 11.8)).toBe(true);
        expect(TransitOverlay.isBoundsCovered(44.0, 11.0, 46.0, 12.0)).toBe(false);
    });
});

