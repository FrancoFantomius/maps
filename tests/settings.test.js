// tests/settings.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupSettingsUI } from '../js/settings/index.js';

describe('Settings module', () => {
  let mockMapService;

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="btn-settings-toggle">
        <span class="material-icons-outlined">keyboard_double_arrow_up</span>
      </button>
      <button id="btn-settings-close"></button>
      <div id="settings-panel" class="translate-y-full">
        <input type="checkbox" id="toggle-overlay-labels" />
        <input type="checkbox" id="toggle-overlay-bike" />
        <input type="checkbox" id="toggle-overlay-perspective" />
      </div>
      <div class="bottom-ui-element"></div>
      <div class="maplibregl-ctrl-bottom-left"></div>
    `;

    mockMapService = {
      toggleOverlay: vi.fn(),
    };
  });

  it('returns early when required elements are missing', () => {
    document.body.innerHTML = '';
    expect(() => setupSettingsUI(mockMapService)).not.toThrow();
  });

  it('toggles settings panel open and closed on toggle button click', () => {
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
    const togglePerspective = document.getElementById('toggle-overlay-perspective');

    toggleLabels.checked = true;
    toggleLabels.dispatchEvent(new Event('change'));
    expect(mockMapService.toggleOverlay).toHaveBeenCalledWith('labels', true);

    toggleBike.checked = true;
    toggleBike.dispatchEvent(new Event('change'));
    expect(mockMapService.toggleOverlay).toHaveBeenCalledWith('bike', true);

    togglePerspective.checked = false;
    togglePerspective.dispatchEvent(new Event('change'));
    expect(mockMapService.toggleOverlay).toHaveBeenCalledWith('perspective', false);
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
});

