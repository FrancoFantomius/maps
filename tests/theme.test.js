// tests/theme.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeController } from '../js/theme/index.js';
import { MapService, DarkMapStyle } from '../js/map/index.js';

vi.mock('../js/map/index.js', () => ({
  MapService: {
    setStyle: vi.fn(),
  },
  DarkMapStyle: { version: 8, sources: {}, layers: [] },
}));

describe('ThemeController', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.body.innerHTML = `
      <button data-theme-btn="light">Light</button>
      <button data-theme-btn="dark">Dark</button>
      <button data-theme-btn="system">System</button>
    `;
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('apply', () => {
    it('applies dark theme correctly', () => {
      ThemeController.apply('dark');

      expect(localStorage.getItem('theme_preference')).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(MapService.setStyle).toHaveBeenCalledWith(DarkMapStyle);
    });

    it('applies light theme correctly', () => {
      ThemeController.apply('light');

      expect(localStorage.getItem('theme_preference')).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(MapService.setStyle).toHaveBeenCalledWith('https://tiles.openfreemap.org/styles/liberty');
    });

    it('updates active class state on buttons', () => {
      ThemeController.apply('dark');

      const darkBtn = document.querySelector('[data-theme-btn="dark"]');
      const lightBtn = document.querySelector('[data-theme-btn="light"]');

      expect(darkBtn.className).toContain('bg-indigo-600');
      expect(lightBtn.className).not.toContain('bg-indigo-600');
    });

    it('updates variant on md-button elements when present', () => {
      document.body.innerHTML = `
        <button data-theme-btn="light" variant="outlined"></button>
        <button data-theme-btn="dark" variant="outlined"></button>
      `;

      ThemeController.apply('dark');

      const darkBtn = document.querySelector('[data-theme-btn="dark"]');
      const lightBtn = document.querySelector('[data-theme-btn="light"]');

      expect(darkBtn.variant).toBe('filled');
      expect(lightBtn.variant).toBe('outlined');
    });
  });

  describe('init', () => {
    it('initializes theme from localStorage and binds click handlers', () => {
      localStorage.setItem('theme_preference', 'dark');
      ThemeController.init();

      expect(document.documentElement.classList.contains('dark')).toBe(true);

      const lightBtn = document.querySelector('[data-theme-btn="light"]');
      lightBtn.click();

      expect(localStorage.getItem('theme_preference')).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });
});
