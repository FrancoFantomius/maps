// tests/ThemeController.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeController } from '../js/ThemeController.js';
import { MapService } from '../js/MapService.js';
import { DarkMapStyle } from '../js/DarkMapStyle.js';

vi.mock('../js/MapService.js', () => ({
  MapService: {
    setStyle: vi.fn(),
  },
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
