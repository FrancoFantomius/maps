// tests/settings.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupSettingsUI, openSettingsPanel } from '../js/settings/index.js';

describe('Settings module', () => {
  let mockMapService;

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="btn-settings-toggle">
        <span class="material-icons-outlined">keyboard_double_arrow_up</span>
      </button>
      <button id="btn-settings-close"></button>
      <div id="settings-panel" class="translate-y-full">
        <button id="btn-map-type-street" class="map-type-item is-selected"></button>
        <button id="btn-map-type-satellite" class="map-type-item"></button>
        <button id="btn-map-type-bike" class="map-type-item"></button>
        <button id="btn-map-type-trekking" class="map-type-item"></button>
        <button id="btn-map-type-transport" class="map-type-item"></button>
        <button id="btn-map-type-topo" class="map-type-item"></button>
        <input type="checkbox" id="toggle-overlay-labels" />
        <input type="checkbox" id="toggle-overlay-bike" />
        <input type="checkbox" id="toggle-overlay-trekking" />
        <input type="checkbox" id="toggle-overlay-perspective" />
      </div>
      <div class="bottom-ui-element"></div>
      <div class="maplibregl-ctrl-bottom-left"></div>
    `;

    mockMapService = {
      activeLayerKey: 'street',
      activeOverlays: { labels: false, bike: false, trekking: false, perspective: false, transport: false },
      setBaseLayer: vi.fn((key) => { mockMapService.activeLayerKey = key; }),
      toggleOverlay: vi.fn((key, val) => { mockMapService.activeOverlays[key] = val; }),
      syncSettingsSquaresUI: vi.fn(),
      updateSettingsPreviews: vi.fn(),
    };
  });

  it('returns early when required elements are missing', () => {
    document.body.innerHTML = '';
    expect(() => setupSettingsUI(mockMapService)).not.toThrow();
  });

  it('works when btn-settings-toggle is omitted from DOM', () => {
    const toggleBtn = document.getElementById('btn-settings-toggle');
    if (toggleBtn) toggleBtn.remove();

    const btnLayers = document.createElement('button');
    btnLayers.id = 'btn-layers';
    document.body.appendChild(btnLayers);

    expect(() => setupSettingsUI(mockMapService)).not.toThrow();

    const panel = document.getElementById('settings-panel');
    btnLayers.click();
    expect(panel.classList.contains('settings-open')).toBe(true);
  });

  it('toggles settings panel open and closed on toggle button click if present', () => {
    setupSettingsUI(mockMapService);

    const toggleBtn = document.getElementById('btn-settings-toggle');
    const panel = document.getElementById('settings-panel');
    const icon = toggleBtn.querySelector('.material-icons-outlined');

    // Click to open
    toggleBtn.click();
    expect(panel.classList.contains('settings-open')).toBe(true);
    expect(panel.classList.contains('translate-y-full')).toBe(false);
    expect(icon.textContent).toBe('keyboard_double_arrow_down');

    // Click to close
    toggleBtn.click();
    expect(panel.classList.contains('settings-open')).toBe(false);
    expect(panel.classList.contains('translate-y-full')).toBe(true);
    expect(icon.textContent).toBe('keyboard_double_arrow_up');
  });

  it('closes settings panel on close button click', () => {
    setupSettingsUI(mockMapService);

    const toggleBtn = document.getElementById('btn-settings-toggle');
    const closeBtn = document.getElementById('btn-settings-close');
    const panel = document.getElementById('settings-panel');

    // Open first
    toggleBtn.click();
    expect(panel.classList.contains('settings-open')).toBe(true);

    // Close with close button
    closeBtn.click();
    expect(panel.classList.contains('settings-open')).toBe(false);
  });

  it('closes settings panel on outside click', () => {
    setupSettingsUI(mockMapService);

    const toggleBtn = document.getElementById('btn-settings-toggle');
    const panel = document.getElementById('settings-panel');

    // Open first
    toggleBtn.click();
    expect(panel.classList.contains('settings-open')).toBe(true);

    // Outside click
    const outsideEl = document.createElement('div');
    document.body.appendChild(outsideEl);
    outsideEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(panel.classList.contains('settings-open')).toBe(false);
  });

  it('handles overlay toggle changes', () => {
    setupSettingsUI(mockMapService);

    const toggleLabels = document.getElementById('toggle-overlay-labels');
    const toggleBike = document.getElementById('toggle-overlay-bike');
    const toggleTrekking = document.getElementById('toggle-overlay-trekking');
    const togglePerspective = document.getElementById('toggle-overlay-perspective');

    toggleLabels.checked = true;
    toggleLabels.dispatchEvent(new Event('change'));
    expect(mockMapService.toggleOverlay).toHaveBeenCalledWith('labels', true);

    toggleBike.checked = true;
    toggleBike.dispatchEvent(new Event('change'));
    expect(mockMapService.toggleOverlay).toHaveBeenCalledWith('bike', true);

    toggleTrekking.checked = true;
    toggleTrekking.dispatchEvent(new Event('change'));
    expect(mockMapService.toggleOverlay).toHaveBeenCalledWith('trekking', true);

    togglePerspective.checked = false;
    togglePerspective.dispatchEvent(new Event('change'));
    expect(mockMapService.toggleOverlay).toHaveBeenCalledWith('perspective', false);
  });

  it('handles overlay toggle changes with custom elements using detail.selected', () => {
    setupSettingsUI(mockMapService);

    const toggleLabels = document.getElementById('toggle-overlay-labels');
    const togglePerspective = document.getElementById('toggle-overlay-perspective');

    toggleLabels.dispatchEvent(new CustomEvent('change', { detail: { selected: false } }));
    expect(mockMapService.toggleOverlay).toHaveBeenCalledWith('labels', false);

    togglePerspective.dispatchEvent(new CustomEvent('change', { detail: { selected: true } }));
    expect(mockMapService.toggleOverlay).toHaveBeenCalledWith('perspective', true);
  });

  it('toggles settings panel and active class when btn-layers is clicked', () => {
    const btnLayers = document.createElement('button');
    btnLayers.id = 'btn-layers';
    document.body.appendChild(btnLayers);

    setupSettingsUI(mockMapService);
    const panel = document.getElementById('settings-panel');

    btnLayers.click();
    expect(panel.classList.contains('settings-open')).toBe(true);
    expect(btnLayers.classList.contains('is-active')).toBe(true);

    btnLayers.click();
    expect(panel.classList.contains('settings-open')).toBe(false);
    expect(btnLayers.classList.contains('is-active')).toBe(false);
  });

  it('handles clicks on the 5 map type and overlay squares', () => {
    setupSettingsUI(mockMapService);

    const btnStreet = document.getElementById('btn-map-type-street');
    const btnSatellite = document.getElementById('btn-map-type-satellite');
    const btnBike = document.getElementById('btn-map-type-bike');
    const btnTrekking = document.getElementById('btn-map-type-trekking');
    const btnTransport = document.getElementById('btn-map-type-transport');
    const btnTopo = document.getElementById('btn-map-type-topo');

    // Select satellite base layer
    btnSatellite.click();
    expect(mockMapService.setBaseLayer).toHaveBeenCalledWith('satellite');

    // Select topo base layer
    btnTopo.click();
    expect(mockMapService.setBaseLayer).toHaveBeenCalledWith('topo');

    // Select street base layer
    btnStreet.click();
    expect(mockMapService.setBaseLayer).toHaveBeenCalledWith('street');

    // Toggle bike overlay
    btnBike.click();
    expect(mockMapService.toggleOverlay).toHaveBeenCalledWith('bike', true);

    // Toggle trekking overlay
    btnTrekking.click();
    expect(mockMapService.toggleOverlay).toHaveBeenCalledWith('trekking', true);

    // Toggle transport overlay
    btnTransport.click();
    expect(mockMapService.toggleOverlay).toHaveBeenCalledWith('transport', true);
  });

  it('opens and closes settings panel via openSettingsPanel()', () => {
    setupSettingsUI(mockMapService);
    const panel = document.getElementById('settings-panel');

    openSettingsPanel(true);
    expect(panel.classList.contains('settings-open')).toBe(true);
    expect(panel.classList.contains('translate-y-full')).toBe(false);

    openSettingsPanel(false);
    expect(panel.classList.contains('settings-open')).toBe(false);
    expect(panel.classList.contains('translate-y-full')).toBe(true);
  });
});


