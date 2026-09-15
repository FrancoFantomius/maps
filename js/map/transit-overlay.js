// maps Custom OSM Public Transport Overlay Module - js/map/transit-overlay.js
// Provides Option 1 (Base Vector Tier + Detail Overpass GeoJSON Tier)

import * as maplibregl from 'maplibre-gl';

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

export function parseOverpassToGeoJSON(elements) {
    const features = [];
    if (!Array.isArray(elements)) return { type: 'FeatureCollection', features };

    for (const el of elements) {
        if (!el) continue;
        const tags = el.tags || {};

        // Stops / Platforms (Nodes)
        if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
            const isStop = tags.highway === 'bus_stop' ||
                           tags.public_transport === 'platform' ||
                           tags.public_transport === 'stop_position' ||
                           tags.railway === 'tram_stop' ||
                           tags.railway === 'station' ||
                           tags.railway === 'halt';

            if (isStop) {
                const routeType = tags.railway === 'tram_stop' ? 'tram'
                    : (tags.railway === 'station' || tags.railway === 'halt' ? 'train' : 'bus');

                features.push({
                    type: 'Feature',
                    id: `node-${el.id}`,
                    geometry: {
                        type: 'Point',
                        coordinates: [el.lon, el.lat]
                    },
                    properties: {
                        type: 'stop',
                        id: el.id,
                        name: tags.name || tags.ref || '',
                        ref: tags.ref || '',
                        routeType,
                        colour: normalizeColor(tags.colour),
                        operator: tags.operator || tags.network || '',
                        wheelchair: tags.wheelchair || ''
                    }
                });
            }
        }

        // Routes (Relations with member geometries)
        if (el.type === 'relation' && tags.route && Array.isArray(el.members)) {
            const color = normalizeColor(tags.colour);
            for (let i = 0; i < el.members.length; i++) {
                const member = el.members[i];
                if (member.type === 'way' && Array.isArray(member.geometry) && member.geometry.length > 1) {
                    const coords = member.geometry.map(pt => [pt.lon, pt.lat]);
                    features.push({
                        type: 'Feature',
                        id: `rel-${el.id}-m${i}-${member.ref || i}`,
                        geometry: {
                            type: 'LineString',
                            coordinates: coords
                        },
                        properties: {
                            type: 'route',
                            relationId: el.id,
                            route: tags.route,
                            ref: tags.ref || '',
                            name: tags.name || (tags.ref ? `${tags.route.toUpperCase()} ${tags.ref}` : tags.route),
                            from: tags.from || '',
                            to: tags.to || '',
                            operator: tags.operator || tags.network || '',
                            colour: color
                        }
                    });
                }
            }
        }

        // Standalone Ways (e.g. railway=tram|subway|light_rail or highway=busway)
        if (el.type === 'way' && Array.isArray(el.geometry) && el.geometry.length > 1) {
            const coords = el.geometry.map(pt => [pt.lon, pt.lat]);
            const routeType = tags.railway || (tags.highway === 'busway' ? 'bus' : 'transit');
            features.push({
                type: 'Feature',
                id: `way-${el.id}`,
                geometry: {
                    type: 'LineString',
                    coordinates: coords
                },
                properties: {
                    type: 'route',
                    wayId: el.id,
                    route: routeType,
                    ref: tags.ref || '',
                    name: tags.name || '',
                    operator: tags.operator || tags.network || '',
                    colour: normalizeColor(tags.colour)
                }
            });
        }
    }

    return { type: 'FeatureCollection', features };
}

export const TransitOverlay = {
    map: null,
    isVisible: false,
    minDetailZoom: 13,
    featureCache: new Map(),
    loadedBboxes: [],
    currentAbortController: null,
    debounceTimer: null,
    activePopup: null,
    eventsBound: false,

    baseLayerIds: [
        'transit-base-rail-casing',
        'transit-base-rail',
        'transit-base-transit-casing',
        'transit-base-transit',
        'transit-base-stations'
    ],

    detailLayerIds: [
        'transit-detail-routes-casing',
        'transit-detail-routes',
        'transit-detail-routes-label',
        'transit-detail-stops',
        'transit-detail-stops-label'
    ],

    setup(map, isVisible = false) {
        this.map = map;
        this.isVisible = Boolean(isVisible);

        this.addBaseLayers();
        this.addDetailLayers();
        this.bindEvents();

        if (this.isVisible) {
            this.scheduleFetch();
        }
    },

    addBaseLayers() {
        if (!this.map || !this.map.getSource || !this.map.getSource('openmaptiles')) return;

        const vis = this.isVisible ? 'visible' : 'none';

        // 1. High contrast railway track casing
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
                    'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 12, 3, 16, 5]
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
                    'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 12, 2, 16, 3.5],
                    'line-dasharray': [2, 2]
                }
            });
        }

        // 3. Transit / Subway / Tram casing
        if (!this.map.getLayer('transit-base-transit-casing')) {
            this.map.addLayer({
                id: 'transit-base-transit-casing',
                type: 'line',
                source: 'openmaptiles',
                'source-layer': 'transportation',
                filter: ['all', ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false], ['match', ['get', 'class'], ['transit'], true, false]],
                layout: {
                    visibility: vis,
                    'line-cap': 'round',
                    'line-join': 'round'
                },
                paint: {
                    'line-color': '#0f172a',
                    'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 5, 18, 8],
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
                filter: ['all', ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false], ['match', ['get', 'class'], ['transit'], true, false]],
                layout: {
                    visibility: vis,
                    'line-cap': 'round',
                    'line-join': 'round'
                },
                paint: {
                    'line-color': '#f97316',
                    'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 3.5, 18, 5.5],
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
                minzoom: 12,
                filter: ['match', ['get', 'class'], ['rail', 'bus'], true, false],
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

    addDetailLayers() {
        if (!this.map || !this.map.getSource || !this.map.addSource) return;

        const vis = this.isVisible ? 'visible' : 'none';

        // 1. GeoJSON source for OSM PTv2 transit routes and stops
        if (!this.map.getSource('transit-detail-source')) {
            this.map.addSource('transit-detail-source', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: Array.from(this.featureCache.values())
                }
            });
        }

        // 2. Detail routes casing
        if (!this.map.getLayer('transit-detail-routes-casing')) {
            this.map.addLayer({
                id: 'transit-detail-routes-casing',
                type: 'line',
                source: 'transit-detail-source',
                filter: ['==', ['get', 'type'], 'route'],
                layout: {
                    visibility: vis,
                    'line-cap': 'round',
                    'line-join': 'round'
                },
                paint: {
                    'line-color': '#0f172a',
                    'line-width': ['interpolate', ['linear'], ['zoom'], 12, 3, 16, 6, 18, 8],
                    'line-opacity': 0.6
                }
            });
        }

        // 3. Detail routes line with authentic OSM colors
        if (!this.map.getLayer('transit-detail-routes')) {
            this.map.addLayer({
                id: 'transit-detail-routes',
                type: 'line',
                source: 'transit-detail-source',
                filter: ['==', ['get', 'type'], 'route'],
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
                            ['get', 'route'],
                            'subway', '#ef4444',
                            'tram', '#ea580c',
                            'train', '#7c3aed',
                            'light_rail', '#d97706',
                            'bus', '#0284c7',
                            'ferry', '#06b6d4',
                            '#2563eb'
                        ]
                    ],
                    'line-width': ['interpolate', ['linear'], ['zoom'], 12, 2, 16, 4, 18, 6],
                    'line-opacity': 0.95
                }
            });
        }

        // 4. Detail routes label badges along line
        if (!this.map.getLayer('transit-detail-routes-label')) {
            this.map.addLayer({
                id: 'transit-detail-routes-label',
                type: 'symbol',
                source: 'transit-detail-source',
                minzoom: 13,
                filter: ['all', ['==', ['get', 'type'], 'route'], ['has', 'ref']],
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

        // 5. Detail stops circle
        if (!this.map.getLayer('transit-detail-stops')) {
            this.map.addLayer({
                id: 'transit-detail-stops',
                type: 'circle',
                source: 'transit-detail-source',
                minzoom: 14,
                filter: ['==', ['get', 'type'], 'stop'],
                layout: {
                    visibility: vis
                },
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 3.5, 16, 5, 18, 7],
                    'circle-color': [
                        'coalesce',
                        ['get', 'colour'],
                        [
                            'match',
                            ['get', 'routeType'],
                            'subway', '#ef4444',
                            'tram', '#ea580c',
                            'train', '#7c3aed',
                            'bus', '#0284c7',
                            '#2563eb'
                        ]
                    ],
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 1.5
                }
            });
        }

        // 6. Detail stops label
        if (!this.map.getLayer('transit-detail-stops-label')) {
            this.map.addLayer({
                id: 'transit-detail-stops-label',
                type: 'symbol',
                source: 'transit-detail-source',
                minzoom: 15,
                filter: ['all', ['==', ['get', 'type'], 'stop'], ['has', 'name']],
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

    bindEvents() {
        if (!this.map || this.eventsBound) return;
        this.eventsBound = true;

        if (typeof this.map.on === 'function') {
            this.map.on('moveend', () => this.onMapMove());

            // Click interactions for stops
            this.map.on('click', 'transit-detail-stops', (e) => this.handleStopClick(e));
            this.map.on('mouseenter', 'transit-detail-stops', () => {
                if (this.map.getCanvas) this.map.getCanvas().style.cursor = 'pointer';
            });
            this.map.on('mouseleave', 'transit-detail-stops', () => {
                if (this.map.getCanvas) this.map.getCanvas().style.cursor = '';
            });

            // Click interactions for routes
            this.map.on('click', 'transit-detail-routes', (e) => this.handleRouteClick(e));
            this.map.on('mouseenter', 'transit-detail-routes', () => {
                if (this.map.getCanvas) this.map.getCanvas().style.cursor = 'pointer';
            });
            this.map.on('mouseleave', 'transit-detail-routes', () => {
                if (this.map.getCanvas) this.map.getCanvas().style.cursor = '';
            });
        }
    },

    setVisible(show) {
        this.isVisible = Boolean(show);
        const vis = this.isVisible ? 'visible' : 'none';

        const allLayers = [...this.baseLayerIds, ...this.detailLayerIds];
        if (this.map && typeof this.map.setLayoutProperty === 'function') {
            for (const layerId of allLayers) {
                if (this.map.getLayer && this.map.getLayer(layerId)) {
                    this.map.setLayoutProperty(layerId, 'visibility', vis);
                }
            }
        }

        if (this.isVisible) {
            this.scheduleFetch();
        } else {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = null;
            }
            if (this.currentAbortController) {
                this.currentAbortController.abort();
                this.currentAbortController = null;
            }
            if (this.activePopup) {
                this.activePopup.remove();
                this.activePopup = null;
            }
        }
    },

    onMapMove() {
        if (!this.isVisible) return;
        this.scheduleFetch();
    },

    scheduleFetch() {
        if (!this.map || !this.isVisible) return;
        if (typeof this.map.getZoom === 'function' && this.map.getZoom() < this.minDetailZoom) {
            return;
        }

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.fetchViewportTransit();
        }, 400);
    },

    isBoundsCovered(south, west, north, east) {
        return this.loadedBboxes.some(b =>
            south >= b.south &&
            north <= b.north &&
            west >= b.west &&
            east <= b.east
        );
    },

    async fetchViewportTransit() {
        if (!this.map || !this.isVisible) return;
        if (typeof this.map.getZoom === 'function' && this.map.getZoom() < this.minDetailZoom) {
            return;
        }

        const bounds = typeof this.map.getBounds === 'function' ? this.map.getBounds() : null;
        if (!bounds) return;

        const south = Math.max(-85, bounds.getSouth());
        const west = Math.max(-180, bounds.getWest());
        const north = Math.min(85, bounds.getNorth());
        const east = Math.min(180, bounds.getEast());

        if (this.isBoundsCovered(south, west, north, east)) {
            return;
        }

        if (this.currentAbortController) {
            this.currentAbortController.abort();
        }
        this.currentAbortController = new AbortController();
        const signal = this.currentAbortController.signal;

        const query = `[out:json][timeout:15];(
  relation["route"~"bus|tram|subway|light_rail|train"](${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)});
  way["railway"~"tram|subway|light_rail"](${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)});
  node["highway"="bus_stop"](${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)});
  node["railway"~"tram_stop|station|halt"](${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)});
  node["public_transport"~"stop_position|platform"](${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)});
);out body geom qt 250;`;

        try {
            const url = 'https://overpass-api.de/api/interpreter';
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `data=${encodeURIComponent(query)}`,
                signal
            });

            if (!res.ok) {
                console.warn(`Overpass transit request returned ${res.status}: ${res.statusText}`);
                return;
            }

            const data = await res.json();
            if (data && Array.isArray(data.elements)) {
                const geojson = parseOverpassToGeoJSON(data.elements);
                let newFeaturesCount = 0;
                for (const feature of geojson.features) {
                    if (!this.featureCache.has(feature.id)) {
                        this.featureCache.set(feature.id, feature);
                        newFeaturesCount++;
                    }
                }

                this.loadedBboxes.push({ south, west, north, east });

                if (newFeaturesCount > 0 && this.map.getSource) {
                    const src = this.map.getSource('transit-detail-source');
                    if (src && typeof src.setData === 'function') {
                        src.setData({
                            type: 'FeatureCollection',
                            features: Array.from(this.featureCache.values())
                        });
                    }
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.warn('TransitOverlay fetch error:', err);
            }
        }
    },

    handleStopClick(e) {
        if (!e || !e.features || !e.features.length) return;
        const feature = e.features[0];
        const props = feature.properties || {};

        const name = props.name || 'Public Transit Stop';
        const refBadge = props.ref ? `<span style="background:#2563eb;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:bold;margin-left:6px;">${escapeHtml(props.ref)}</span>` : '';
        const mode = (props.routeType || 'stop').toUpperCase();
        const operator = props.operator ? `<div style="font-size:12px;color:#64748b;margin-top:4px;">${escapeHtml(props.operator)}</div>` : '';

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

        const name = props.name || 'Transit Route';
        const color = props.colour || '#2563eb';
        const refBadge = props.ref ? `<span style="background:${color};color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:bold;margin-left:6px;">${escapeHtml(props.ref)}</span>` : '';
        const mode = (props.route || 'transit').toUpperCase();
        const dest = (props.from || props.to)
            ? `<div style="font-size:12px;color:#334155;margin-top:4px;">${escapeHtml(props.from || '')} &rarr; ${escapeHtml(props.to || '')}</div>`
            : '';
        const operator = props.operator ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${escapeHtml(props.operator)}</div>` : '';

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
