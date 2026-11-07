// maps Pre-Generated Vector Public Transport Overlay Module - js/map/transit-overlay.js
// Provides Option 2: Pre-Generated Vector Transit Tiles (PMTiles / Vector Tiles)

import * as maplibregl from 'maplibre-gl';
import * as pmtiles from 'pmtiles';

let pmtilesProtocolRegistered = false;

export function registerPMTilesProtocol() {
    if (pmtilesProtocolRegistered) return;
    try {
        const MapLibreClass = maplibregl.default || maplibregl;
        if (typeof MapLibreClass.addProtocol === 'function') {
            const protocol = new pmtiles.Protocol();
            MapLibreClass.addProtocol('pmtiles', protocol.tile);
            pmtilesProtocolRegistered = true;
        }
    } catch (e) {
        console.warn('Could not register PMTiles protocol:', e);
    }
}

export function normalizeColor(color) {
    if (!color || typeof color !== 'string') return null;
    const trimmed = color.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('#')) return trimmed;
    if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
    if (/^[0-9a-fA-F]{3}$/.test(trimmed)) return `#${trimmed}`;
    return trimmed;
}

export function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export const TransitOverlay = {
    map: null,
    isVisible: false,
    activePopup: null,
    eventsBound: false,
    vectorSourceUrl: 'pmtiles://https://r2-public.protomaps.com/protomaps-sample-datasets/transit.pmtiles',

    baseLayerIds: [
        'transit-base-rail-casing',
        'transit-base-rail',
        'transit-base-transit-casing',
        'transit-base-transit',
        'transit-base-stations'
    ],

    vectorLayerIds: [
        'transit-vector-routes-casing',
        'transit-vector-routes',
        'transit-vector-routes-label',
        'transit-vector-stops',
        'transit-vector-stops-label'
    ],

    setup(map, isVisible = false) {
        this.map = map;
        this.isVisible = Boolean(isVisible);

        registerPMTilesProtocol();
        this.addBaseLayers();
        this.addVectorLayers();
        this.bindEvents();
    },

    setVectorSourceUrl(url) {
        if (!url || typeof url !== 'string') return;
        this.vectorSourceUrl = url;
        if (this.map && this.map.getSource && this.map.getSource('transit-vector-source')) {
            // Remove existing vector layers and recreate source
            this.removeVectorLayers();
            this.addVectorLayers();
        }
    },

    addBaseLayers() {
        if (!this.map || !this.map.getSource || !this.map.getSource('openmaptiles')) return;

        const vis = this.isVisible ? 'visible' : 'none';

        // 1. High contrast railway track casing (Always visible across zoom levels)
        if (!this.map.getLayer('transit-base-rail-casing')) {
            this.map.addLayer({
                id: 'transit-base-rail-casing',
                type: 'line',
                source: 'openmaptiles',
                'source-layer': 'transportation',
                filter: ['all', ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false], ['==', ['get', 'class'], 'rail']],
                layout: {
                    visibility: vis,
                    'line-cap': 'butt',
                    'line-join': 'miter'
                },
                paint: {
                    'line-color': '#1e293b',
                    'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 10, 2.5, 16, 5]
                }
            });
        }

        // 2. High contrast railway inner dashed track (cross-ties effect)
        if (!this.map.getLayer('transit-base-rail')) {
            this.map.addLayer({
                id: 'transit-base-rail',
                type: 'line',
                source: 'openmaptiles',
                'source-layer': 'transportation',
                filter: ['all', ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false], ['==', ['get', 'class'], 'rail']],
                layout: {
                    visibility: vis,
                    'line-cap': 'butt',
                    'line-join': 'miter'
                },
                paint: {
                    'line-color': '#ffffff',
                    'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.75, 10, 1.5, 16, 3.5],
                    'line-dasharray': [2, 2]
                }
            });
        }

        // 3. Transit / Subway / Tram / Light Rail casing
        if (!this.map.getLayer('transit-base-transit-casing')) {
            this.map.addLayer({
                id: 'transit-base-transit-casing',
                type: 'line',
                source: 'openmaptiles',
                'source-layer': 'transportation',
                filter: ['all', ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false], ['match', ['get', 'class'], ['transit', 'tram', 'subway', 'light_rail'], true, false]],
                layout: {
                    visibility: vis,
                    'line-cap': 'round',
                    'line-join': 'round'
                },
                paint: {
                    'line-color': '#0f172a',
                    'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2, 12, 4, 16, 7],
                    'line-opacity': 0.7
                }
            });
        }

        // 4. Transit / Subway / Tram colored lines
        if (!this.map.getLayer('transit-base-transit')) {
            this.map.addLayer({
                id: 'transit-base-transit',
                type: 'line',
                source: 'openmaptiles',
                'source-layer': 'transportation',
                filter: ['all', ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false], ['match', ['get', 'class'], ['transit', 'tram', 'subway', 'light_rail'], true, false]],
                layout: {
                    visibility: vis,
                    'line-cap': 'round',
                    'line-join': 'round'
                },
                paint: {
                    'line-color': [
                        'match',
                        ['get', 'subclass'],
                        'subway', '#ef4444',
                        'tram', '#ea580c',
                        'light_rail', '#d97706',
                        '#f97316'
                    ],
                    'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.2, 12, 2.8, 16, 5],
                    'line-opacity': 0.95
                }
            });
        }

        // 5. Transit stations from POI source layer
        if (!this.map.getLayer('transit-base-stations')) {
            this.map.addLayer({
                id: 'transit-base-stations',
                type: 'symbol',
                source: 'openmaptiles',
                'source-layer': 'poi',
                minzoom: 11,
                filter: ['match', ['get', 'class'], ['rail', 'bus', 'ferry', 'transit'], true, false],
                layout: {
                    visibility: vis,
                    'icon-image': ['to-string', ['get', 'class']],
                    'icon-size': 0.9,
                    'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']],
                    'text-size': 11,
                    'text-anchor': 'top',
                    'text-offset': [0, 0.8]
                },
                paint: {
                    'text-color': '#0f172a',
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 1.5
                }
            });
        }
    },

    addVectorLayers() {
        if (!this.map || !this.map.getSource || !this.map.addSource) return;

        const vis = this.isVisible ? 'visible' : 'none';

        // Add Vector Transit Source (PMTiles / Vector Tile archive)
        if (!this.map.getSource('transit-vector-source')) {
            try {
                this.map.addSource('transit-vector-source', {
                    type: 'vector',
                    url: this.vectorSourceUrl
                });
            } catch (e) {
                console.warn('Could not add transit-vector-source:', e);
            }
        }

        const sourceId = this.map.getSource('transit-vector-source') ? 'transit-vector-source' : 'openmaptiles';
        const sourceLayer = sourceId === 'transit-vector-source' ? 'transit' : 'transportation';

        // 1. Vector routes line casing
        if (!this.map.getLayer('transit-vector-routes-casing')) {
            this.map.addLayer({
                id: 'transit-vector-routes-casing',
                type: 'line',
                source: sourceId,
                'source-layer': sourceLayer,
                layout: {
                    visibility: vis,
                    'line-cap': 'round',
                    'line-join': 'round'
                },
                paint: {
                    'line-color': '#0f172a',
                    'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2, 12, 4, 16, 7],
                    'line-opacity': 0.6
                }
            });
        }

        // 2. Vector routes line with dynamic OSM colors
        if (!this.map.getLayer('transit-vector-routes')) {
            this.map.addLayer({
                id: 'transit-vector-routes',
                type: 'line',
                source: sourceId,
                'source-layer': sourceLayer,
                layout: {
                    visibility: vis,
                    'line-cap': 'round',
                    'line-join': 'round'
                },
                paint: {
                    'line-color': [
                        'coalesce',
                        ['get', 'colour'],
                        [
                            'match',
                            ['coalesce', ['get', 'route'], ['get', 'class']],
                            'subway', '#ef4444',
                            'tram', '#ea580c',
                            'train', '#7c3aed',
                            'rail', '#7c3aed',
                            'light_rail', '#d97706',
                            'bus', '#0284c7',
                            'ferry', '#06b6d4',
                            '#2563eb'
                        ]
                    ],
                    'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 12, 3, 16, 5],
                    'line-opacity': 0.95
                }
            });
        }

        // 3. Vector routes label badges along the lines
        if (!this.map.getLayer('transit-vector-routes-label')) {
            this.map.addLayer({
                id: 'transit-vector-routes-label',
                type: 'symbol',
                source: sourceId,
                'source-layer': sourceLayer,
                minzoom: 12,
                filter: ['has', 'ref'],
                layout: {
                    visibility: vis,
                    'symbol-placement': 'line',
                    'text-field': ['get', 'ref'],
                    'text-size': 11,
                    'text-padding': 5
                },
                paint: {
                    'text-color': '#ffffff',
                    'text-halo-color': [
                        'coalesce',
                        ['get', 'colour'],
                        '#1e293b'
                    ],
                    'text-halo-width': 2.5
                }
            });
        }

        // 4. Vector transit stops / platforms
        const stopSourceLayer = sourceId === 'transit-vector-source' ? 'transit_stop' : 'poi';
        if (!this.map.getLayer('transit-vector-stops')) {
            this.map.addLayer({
                id: 'transit-vector-stops',
                type: 'circle',
                source: sourceId,
                'source-layer': stopSourceLayer,
                minzoom: 13,
                layout: {
                    visibility: vis
                },
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 3, 16, 5, 18, 7],
                    'circle-color': [
                        'coalesce',
                        ['get', 'colour'],
                        [
                            'match',
                            ['coalesce', ['get', 'routeType'], ['get', 'class']],
                            'subway', '#ef4444',
                            'tram', '#ea580c',
                            'train', '#7c3aed',
                            'rail', '#7c3aed',
                            'bus', '#0284c7',
                            '#2563eb'
                        ]
                    ],
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 1.5
                }
            });
        }

        // 5. Vector stops label
        if (!this.map.getLayer('transit-vector-stops-label')) {
            this.map.addLayer({
                id: 'transit-vector-stops-label',
                type: 'symbol',
                source: sourceId,
                'source-layer': stopSourceLayer,
                minzoom: 14,
                filter: ['has', 'name'],
                layout: {
                    visibility: vis,
                    'text-field': ['get', 'name'],
                    'text-size': 10.5,
                    'text-offset': [0, 1.2],
                    'text-anchor': 'top'
                },
                paint: {
                    'text-color': '#0f172a',
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 1.5
                }
            });
        }
    },

    removeVectorLayers() {
        if (!this.map) return;
        for (const layerId of this.vectorLayerIds) {
            if (this.map.getLayer && this.map.getLayer(layerId)) {
                this.map.removeLayer(layerId);
            }
        }
        if (this.map.getSource && this.map.getSource('transit-vector-source')) {
            this.map.removeSource('transit-vector-source');
        }
    },

    bindEvents() {
        if (!this.map || this.eventsBound) return;
        this.eventsBound = true;

        if (typeof this.map.on === 'function') {
            // Stops click & hover
            const stopLayers = ['transit-vector-stops', 'transit-base-stations'];
            for (const layerId of stopLayers) {
                this.map.on('click', layerId, (e) => this.handleStopClick(e));
                this.map.on('mouseenter', layerId, () => {
                    if (this.map.getCanvas) this.map.getCanvas().style.cursor = 'pointer';
                });
                this.map.on('mouseleave', layerId, () => {
                    if (this.map.getCanvas) this.map.getCanvas().style.cursor = '';
                });
            }

            // Routes click & hover
            const routeLayers = ['transit-vector-routes', 'transit-base-transit'];
            for (const layerId of routeLayers) {
                this.map.on('click', layerId, (e) => this.handleRouteClick(e));
                this.map.on('mouseenter', layerId, () => {
                    if (this.map.getCanvas) this.map.getCanvas().style.cursor = 'pointer';
                });
                this.map.on('mouseleave', layerId, () => {
                    if (this.map.getCanvas) this.map.getCanvas().style.cursor = '';
                });
            }
        }
    },

    setVisible(show) {
        this.isVisible = Boolean(show);
        const vis = this.isVisible ? 'visible' : 'none';

        const allLayers = [...this.baseLayerIds, ...this.vectorLayerIds];
        if (this.map && typeof this.map.setLayoutProperty === 'function') {
            for (const layerId of allLayers) {
                if (this.map.getLayer && this.map.getLayer(layerId)) {
                    this.map.setLayoutProperty(layerId, 'visibility', vis);
                }
            }
        }

        if (!this.isVisible && this.activePopup) {
            this.activePopup.remove();
            this.activePopup = null;
        }
    },

    handleStopClick(e) {
        if (!e || !e.features || !e.features.length) return;
        const feature = e.features[0];
        const props = feature.properties || {};

        const name = props.name || props.name_en || 'Public Transit Stop';
        const refBadge = props.ref ? `<span style="background:#2563eb;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:bold;margin-left:6px;">${escapeHtml(props.ref)}</span>` : '';
        const mode = (props.routeType || props.class || 'stop').toUpperCase();
        const operator = props.operator || props.network ? `<div style="font-size:12px;color:#64748b;margin-top:4px;">${escapeHtml(props.operator || props.network)}</div>` : '';

        const html = `
            <div style="font-family:sans-serif;min-width:140px;line-height:1.4;">
                <div style="display:flex;align-items:center;margin-bottom:4px;">
                    <span style="font-size:10px;text-transform:uppercase;color:#2563eb;font-weight:700;letter-spacing:0.5px;">${escapeHtml(mode)}</span>
                    ${refBadge}
                </div>
                <div style="font-size:14px;font-weight:600;color:#0f172a;">${escapeHtml(name)}</div>
                ${operator}
            </div>
        `;

        this.showPopup(e.lngLat, html);
    },

    handleRouteClick(e) {
        if (!e || !e.features || !e.features.length) return;
        const feature = e.features[0];
        const props = feature.properties || {};

        const mode = (props.route || props.class || 'transit').toUpperCase();
        const color = normalizeColor(props.colour) || '#2563eb';
        const refBadge = props.ref ? `<span style="background:${color};color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:bold;margin-left:6px;">${escapeHtml(props.ref)}</span>` : '';
        const name = props.name || props.name_en || (props.ref ? `${mode} ${props.ref}` : `${mode} Line`);
        const dest = (props.from || props.to)
            ? `<div style="font-size:12px;color:#334155;margin-top:4px;">${escapeHtml(props.from || '')} &rarr; ${escapeHtml(props.to || '')}</div>`
            : '';
        const operator = props.operator || props.network ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${escapeHtml(props.operator || props.network)}</div>` : '';

        const html = `
            <div style="font-family:sans-serif;min-width:150px;line-height:1.4;">
                <div style="display:flex;align-items:center;margin-bottom:4px;">
                    <span style="font-size:10px;text-transform:uppercase;color:${color};font-weight:700;letter-spacing:0.5px;">${escapeHtml(mode)}</span>
                    ${refBadge}
                </div>
                <div style="font-size:14px;font-weight:600;color:#0f172a;">${escapeHtml(name)}</div>
                ${dest}
                ${operator}
            </div>
        `;

        this.showPopup(e.lngLat, html);
    },

    showTransitPopup(lngLat, transitInfo) {
        if (!this.map || !transitInfo) return;
        const mode = (transitInfo.route || 'transit').toUpperCase();
        const color = transitInfo.colour || '#2563eb';
        const refBadge = transitInfo.ref ? `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;margin-left:6px;">${escapeHtml(transitInfo.ref)}</span>` : '';
        const name = transitInfo.name || (transitInfo.ref ? `${mode} ${transitInfo.ref}` : `${mode} Line`);
        const dest = (transitInfo.from || transitInfo.to)
            ? `<div style="font-size:12px;color:#334155;margin-top:4px;">${escapeHtml(transitInfo.from || '')} &rarr; ${escapeHtml(transitInfo.to || '')}</div>`
            : '';
        const operator = transitInfo.operator ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${escapeHtml(transitInfo.operator)}</div>` : '';

        const html = `
            <div style="font-family:sans-serif;min-width:160px;line-height:1.4;">
                <div style="display:flex;align-items:center;margin-bottom:4px;">
                    <span style="font-size:10px;text-transform:uppercase;color:${color};font-weight:700;letter-spacing:0.5px;">${escapeHtml(mode)}</span>
                    ${refBadge}
                </div>
                <div style="font-size:14px;font-weight:600;color:#0f172a;">${escapeHtml(name)}</div>
                ${dest}
                ${operator}
            </div>
        `;

        this.showPopup(lngLat, html);
    },

    showPopup(lngLat, html) {
        if (!this.map) return;
        if (this.activePopup) {
            this.activePopup.remove();
        }

        try {
            const PopupClass = maplibregl.Popup || (window.maplibregl && window.maplibregl.Popup);
            if (PopupClass) {
                this.activePopup = new PopupClass({ offset: 10, closeButton: true })
                    .setLngLat(lngLat)
                    .setHTML(html)
                    .addTo(this.map);
            } else if (this.map.createPopup) {
                this.activePopup = this.map.createPopup({ offset: 10, closeButton: true })
                    .setLngLat(lngLat)
                    .setHTML(html)
                    .addTo(this.map);
            }
        } catch (e) {
            console.warn('Could not display transit popup:', e);
        }
    }
};

export default TransitOverlay;
