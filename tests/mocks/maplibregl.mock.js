// tests/mocks/maplibregl.mock.js
import { vi } from 'vitest';

export class MockMap {
  constructor(options = {}) {
    this.options = options;
    this.center = options.center || [11.8768, 45.4064];
    this.zoom = options.zoom || 13;
    this.pitch = options.pitch || 0;
    this.bearing = options.bearing || 0;
    this.style = options.style || 'mock-style';
    this._events = {};
    this._sources = {};
    this._layers = {};
  }

  on(event, handler) {
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(handler);
    return this;
  }

  off(event, handler) {
    if (this._events[event]) {
      this._events[event] = this._events[event].filter(h => h !== handler);
    }
    return this;
  }

  fire(event, data = {}) {
    if (this._events[event]) {
      this._events[event].forEach(h => h({ ...data, target: this }));
    }
  }

  flyTo(options) {
    if (options.center) this.center = options.center;
    if (options.zoom) this.zoom = options.zoom;
    return this;
  }

  easeTo(options) {
    if (options.pitch !== undefined) this.pitch = options.pitch;
    if (options.bearing !== undefined) this.bearing = options.bearing;
    if (options.center) this.center = options.center;
    if (options.zoom) this.zoom = options.zoom;
    return this;
  }

  jumpTo(options) {
    if (options.center) this.center = options.center;
    if (options.zoom) this.zoom = options.zoom;
    return this;
  }

  setStyle(styleUrl) {
    this.style = styleUrl;
    setTimeout(() => this.fire('style.load'), 0);
    return this;
  }

  getStyle() {
    return { layers: Object.values(this._layers) };
  }

  setPitch(pitch) {
    this.pitch = pitch;
    return this;
  }

  getPitch() {
    return this.pitch;
  }

  setBearing(bearing) {
    this.bearing = bearing;
    return this;
  }

  getBearing() {
    return this.bearing;
  }

  getZoom() {
    return this.zoom;
  }

  getCenter() {
    return { lng: this.center[0], lat: this.center[1], toArray: () => this.center };
  }

  getSource(id) {
    return this._sources[id];
  }

  addSource(id, source) {
    this._sources[id] = {
      ...source,
      setData: vi.fn(data => {
        if (this._sources[id]) this._sources[id].data = data;
      })
    };
    return this;
  }

  removeSource(id) {
    delete this._sources[id];
    return this;
  }

  getLayer(id) {
    return this._layers[id];
  }

  addLayer(layer, beforeId) {
    this._layers[layer.id] = layer;
    return this;
  }

  removeLayer(id) {
    delete this._layers[id];
    return this;
  }

  setLayoutProperty(id, name, val) {
    if (this._layers[id]) {
      if (!this._layers[id].layout) this._layers[id].layout = {};
      this._layers[id].layout[name] = val;
    }
    return this;
  }

  fitBounds(bounds, options) {
    return this;
  }

  resize() {
    return this;
  }

  addControl(control, position) {
    return this;
  }

  remove() {
    return this;
  }
}

export class MockMarker {
  constructor(options = {}) {
    this.options = options;
    this._element = options.element || document.createElement('div');
    this._lngLat = [0, 0];
    this._popup = null;
  }

  setLngLat(lngLat) {
    this._lngLat = Array.isArray(lngLat) ? lngLat : [lngLat.lng, lngLat.lat];
    return this;
  }

  getLngLat() {
    return { lng: this._lngLat[0], lat: this._lngLat[1] };
  }

  addTo(map) {
    this._map = map;
    return this;
  }

  remove() {
    this._map = null;
    return this;
  }

  getElement() {
    return this._element;
  }

  setPopup(popup) {
    this._popup = popup;
    return this;
  }

  togglePopup() {
    return this;
  }
}

export class MockPopup {
  constructor(options = {}) {
    this.options = options;
    this._content = '';
    this._lngLat = [0, 0];
  }

  setLngLat(lngLat) {
    this._lngLat = Array.isArray(lngLat) ? lngLat : [lngLat.lng, lngLat.lat];
    return this;
  }

  setHTML(html) {
    this._content = html;
    return this;
  }

  setText(text) {
    this._content = text;
    return this;
  }

  addTo(map) {
    this._map = map;
    return this;
  }

  remove() {
    this._map = null;
    return this;
  }

  isOpen() {
    return !!this._map;
  }
}

export class MockLngLatBounds {
  constructor(sw, ne) {
    this._sw = sw;
    this._ne = ne;
  }
  extend() { return this; }
}

export class MockNavigationControl { constructor() {} }
export class MockGeolocateControl { constructor() {} }

const maplibreglMock = {
  Map: MockMap,
  Marker: MockMarker,
  Popup: MockPopup,
  LngLatBounds: MockLngLatBounds,
  NavigationControl: MockNavigationControl,
  GeolocateControl: MockGeolocateControl,
};

export default maplibreglMock;
