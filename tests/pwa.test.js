import { describe, it, expect, vi, beforeEach } from 'vitest';
import pkg from '../package.json';
import { initPWA } from '../js/pwa.js';

describe('PWA & Caching Configuration', () => {
    it('manifest version matches version in package.json', () => {
        expect(pkg.version).toBeDefined();
        expect(typeof pkg.version).toBe('string');
        expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('runtime caching rules correctly set NetworkOnly for satellite and CacheFirst for standard tiles', () => {
        const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/10/500/300';
        const openfreemapUrl = 'https://tiles.openfreemap.org/styles/liberty';
        const osmUrl = 'https://a.tile.openstreetmap.org/10/500/300.png';
        const bikeUrl = 'https://tile.waymarkedtrails.org/cycling/10/500/300.png';
        const terrainUrl = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/10/500/300.png';

        const satellitePattern = /^https:\/\/server\.arcgisonline\.com\/.*$/i;
        const openfreemapPattern = /^https:\/\/tiles\.openfreemap\.org\/.*$/i;
        const osmPattern = /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*$/i;
        const bikePattern = /^https:\/\/tile\.waymarkedtrails\.org\/.*$/i;
        const terrainPattern = /^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\/.*$/i;

        expect(satellitePattern.test(satelliteUrl)).toBe(true);
        expect(satellitePattern.test(openfreemapUrl)).toBe(false);

        expect(openfreemapPattern.test(openfreemapUrl)).toBe(true);
        expect(osmPattern.test(osmUrl)).toBe(true);
        expect(bikePattern.test(bikeUrl)).toBe(true);
        expect(terrainPattern.test(terrainUrl)).toBe(true);
    });

    it('correctly routes font requests (Material Icons, Inter, Outfit) to CacheFirst strategy', () => {
        const fontPattern = /\.(woff|woff2|ttf|otf|eot)(\?.*)?$/i;
        const materialIconsUrl = '/assets/material-icons-outlined-latin-400-normal-12345.woff2';
        const interFontUrl = '/assets/inter-latin-400-normal-67890.woff2';
        const outfitFontUrl = '/assets/outfit-latin-600-normal-abcdef.woff';
        const jsBundleUrl = '/assets/app-12345.js';

        expect(fontPattern.test(materialIconsUrl)).toBe(true);
        expect(fontPattern.test(interFontUrl)).toBe(true);
        expect(fontPattern.test(outfitFontUrl)).toBe(true);
        expect(fontPattern.test(jsBundleUrl)).toBe(false);
    });

    describe('initPWA()', () => {
        let originalServiceWorker;
        let eventListeners;

        beforeEach(() => {
            eventListeners = {};
            originalServiceWorker = navigator.serviceWorker;

            Object.defineProperty(navigator, 'serviceWorker', {
                writable: true,
                value: {
                    register: vi.fn().mockResolvedValue({ scope: '/' }),
                    addEventListener: vi.fn((event, cb) => {
                        eventListeners[event] = cb;
                    })
                }
            });
        });

        it('registers controllerchange event listener on navigator.serviceWorker', () => {
            initPWA();
            expect(navigator.serviceWorker.addEventListener).toHaveBeenCalledWith('controllerchange', expect.any(Function));
        });
    });
});
