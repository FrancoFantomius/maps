// tests/transit-overlay.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    TransitOverlay,
    normalizeColor,
    escapeHtml,
    registerPMTilesProtocol
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
});

describe('TransitOverlay lifecycle and vector integration', () => {
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
            getSource: vi.fn(id => sources[id]),
            addSource: vi.fn((id, src) => {
                sources[id] = src;
            }),
            removeSource: vi.fn(id => {
                delete sources[id];
            }),
            getLayer: vi.fn(id => layers[id]),
            addLayer: vi.fn(layer => {
                layers[layer.id] = layer;
            }),
            removeLayer: vi.fn(id => {
                delete layers[id];
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

        TransitOverlay.eventsBound = false;
        TransitOverlay.activePopup = null;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('sets up base and vector detail layers when setup is called', () => {
        TransitOverlay.setup(mockMap, true);

        // Base vector layers
        expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'transit-base-rail-casing' }));
        expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'transit-base-rail' }));
        expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'transit-base-transit' }));
        expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'transit-base-stations' }));

        // Vector transit source & layers
        expect(mockMap.addSource).toHaveBeenCalledWith('transit-vector-source', expect.any(Object));
        expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'transit-vector-routes' }));
        expect(mockMap.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 'transit-vector-stops' }));
        expect(TransitOverlay.isVisible).toBe(true);
    });

    it('sets visibility to none when initialized with isVisible = false', () => {
        TransitOverlay.setup(mockMap, false);

        expect(layers['transit-vector-routes'].layout.visibility).toBe('none');
        expect(layers['transit-base-rail'].layout.visibility).toBe('none');
        expect(TransitOverlay.isVisible).toBe(false);
    });

    it('toggles layer visibility when setVisible is called', () => {
        TransitOverlay.setup(mockMap, false);
        TransitOverlay.setVisible(true);

        expect(mockMap.setLayoutProperty).toHaveBeenCalledWith('transit-vector-routes', 'visibility', 'visible');
        expect(mockMap.setLayoutProperty).toHaveBeenCalledWith('transit-base-rail', 'visibility', 'visible');
        expect(TransitOverlay.isVisible).toBe(true);

        TransitOverlay.setVisible(false);
        expect(mockMap.setLayoutProperty).toHaveBeenCalledWith('transit-vector-routes', 'visibility', 'none');
        expect(TransitOverlay.isVisible).toBe(false);
    });

    it('updates vector source url when setVectorSourceUrl is called', () => {
        TransitOverlay.setup(mockMap, true);
        const newUrl = 'pmtiles://https://example.com/custom-transit.pmtiles';
        TransitOverlay.setVectorSourceUrl(newUrl);

        expect(TransitOverlay.vectorSourceUrl).toBe(newUrl);
    });

    it('handles stop and route click popups without errors', () => {
        TransitOverlay.setup(mockMap, true);
        const showPopupSpy = vi.spyOn(TransitOverlay, 'showPopup').mockImplementation(() => {});

        // Test stop click
        TransitOverlay.handleStopClick({
            lngLat: { lng: 11.87, lat: 45.40 },
            features: [{
                properties: {
                    name: 'Main Central Station',
                    ref: '10',
                    routeType: 'train',
                    operator: 'National Rail'
                }
            }]
        });
        expect(showPopupSpy).toHaveBeenCalledWith(
            { lng: 11.87, lat: 45.40 },
            expect.stringContaining('Main Central Station')
        );

        // Test route click
        TransitOverlay.handleRouteClick({
            lngLat: { lng: 11.87, lat: 45.40 },
            features: [{
                properties: {
                    name: 'Metro Line Red',
                    ref: 'M1',
                    route: 'subway',
                    colour: '#ef4444',
                    from: 'North',
                    to: 'South'
                }
            }]
        });
        expect(showPopupSpy).toHaveBeenCalledWith(
            { lng: 11.87, lat: 45.40 },
            expect.stringContaining('Metro Line Red')
        );

        showPopupSpy.mockRestore();
    });

    it('populates place-details sheet with transit route name, badge, and stops list', async () => {
        const { openPlaceDetails } = await import('../js/search/place-details-sheet.js');

        document.body.innerHTML = `
            <div id="place-details-sheet">
                <div id="sheet-image-container" class="hidden"><img id="sheet-image" /></div>
                <div id="sheet-coords-chip"></div>
                <div id="sheet-category-chip"></div>
                <div id="sheet-notes-section" class="hidden"><span id="sheet-notes-text"></span></div>
                <div id="sheet-address-section" class="hidden"><span id="sheet-address-text"></span></div>
                <div id="sheet-street-section" class="hidden"><span id="sheet-street-text"></span></div>
                <div id="sheet-shop-section" class="hidden"></div>
                <div id="sheet-wiki-section" class="hidden"><span id="sheet-wiki-text"></span></div>
                <div id="sheet-transit-section" class="hidden">
                    <div id="sheet-transit-mode-icon"></div>
                    <span id="sheet-transit-ref-badge"></span>
                    <span id="sheet-transit-name"></span>
                    <div id="sheet-transit-dest-row" class="hidden"><span id="sheet-transit-dest"></span></div>
                    <div id="sheet-transit-operator-row" class="hidden"><span id="sheet-transit-operator"></span></div>
                    <button id="sheet-btn-transit-overview"></button>
                    <span id="sheet-transit-stops-count"></span>
                    <div id="sheet-transit-stops-container"></div>
                </div>
            </div>
        `;

        const sampleTransitData = {
            name: 'Bus 14: Station -> Hospital',
            lat: 45.40,
            lng: 11.87,
            transitInfo: {
                id: 101,
                route: 'bus',
                ref: '14',
                name: 'Bus Line 14',
                colour: '#0284c7',
                from: 'Central Station',
                to: 'City Hospital',
                operator: 'Transit Agency',
                lineCoords: [[11.87, 45.40], [11.88, 45.41]],
                stops: [
                    { id: 1, name: 'Central Station', lat: 45.40, lon: 11.87 },
                    { id: 2, name: 'Piazza Garibaldi', lat: 45.405, lon: 11.875 },
                    { id: 3, name: 'City Hospital', lat: 45.41, lon: 11.88 }
                ]
            }
        };

        openPlaceDetails(sampleTransitData);

        const transitSec = document.getElementById('sheet-transit-section');
        expect(transitSec.classList.contains('hidden')).toBe(false);

        const badgeEl = document.getElementById('sheet-transit-ref-badge');
        expect(badgeEl.textContent).toBe('14');
        expect(badgeEl.style.backgroundColor).toBe('rgb(2, 132, 199)');

        const nameEl = document.getElementById('sheet-transit-name');
        expect(nameEl.textContent).toBe('Bus Line 14');

        const destEl = document.getElementById('sheet-transit-dest');
        expect(destEl.textContent).toBe('Central Station → City Hospital');

        const countEl = document.getElementById('sheet-transit-stops-count');
        expect(countEl.textContent).toBe('3 stops');

        const stopsContainer = document.getElementById('sheet-transit-stops-container');
        expect(stopsContainer.children.length).toBe(3);
        expect(stopsContainer.children[0].textContent).toContain('Central Station');
        expect(stopsContainer.children[1].textContent).toContain('Piazza Garibaldi');
        expect(stopsContainer.children[2].textContent).toContain('City Hospital');
    });
});
