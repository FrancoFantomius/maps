import { describe, it, expect } from 'vitest';
import { TranslationController } from '../js/TranslationController.js';

describe('Languages Parity & Supported Languages', () => {
    const languageModules = import.meta.glob('../languages/*.json', { eager: true });
    const expectedLanguages = ['ar', 'de', 'en', 'es', 'fr', 'hi', 'it', 'ja', 'pt', 'ru', 'zh'];

    function extractLeafPaths(obj, prefix = '') {
        const paths = [];
        for (const key of Object.keys(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (obj[key] !== null && typeof obj[key] === 'object') {
                paths.push(...extractLeafPaths(obj[key], fullKey));
            } else {
                paths.push(fullKey);
            }
        }
        return paths.sort();
    }

    it('contains only the 11 main language files in languages directory', () => {
        const fileNames = Object.keys(languageModules).map(p => p.split('/').pop().replace('.json', ''));
        expect(fileNames.sort()).toEqual(expectedLanguages.sort());
    });

    it('TranslationController.supportedLanguages matches the 11 main languages exactly', () => {
        const supportedKeys = Object.keys(TranslationController.supportedLanguages).sort();
        expect(supportedKeys).toEqual(expectedLanguages.sort());
    });

    it('all language files are valid JSON and contain top-level sections matching en.json', () => {
        const enContent = languageModules['../languages/en.json'];
        const enTopKeys = Object.keys(enContent.default || enContent).sort();

        for (const lang of expectedLanguages) {
            const mod = languageModules[`../languages/${lang}.json`];
            expect(mod).toBeDefined();

            const content = mod.default || mod;
            const topKeys = Object.keys(content).sort();
            expect(topKeys).toEqual(enTopKeys);
        }
    });

    it('all language files have full deep recursive key parity with en.json', () => {
        const enContent = languageModules['../languages/en.json'];
        const enLeafKeys = extractLeafPaths(enContent.default || enContent);

        expect(enLeafKeys.length).toBeGreaterThan(0);

        for (const lang of expectedLanguages) {
            const mod = languageModules[`../languages/${lang}.json`];
            const content = mod.default || mod;
            const leafKeys = extractLeafPaths(content);

            expect(leafKeys, `Language ${lang}.json key structure differs from en.json`).toEqual(enLeafKeys);
        }
    });

    it('all translation entries are non-empty strings', () => {
        function validateNonEmpty(obj, path = '', lang = '') {
            for (const [key, value] of Object.entries(obj)) {
                const currentPath = path ? `${path}.${key}` : key;
                if (typeof value === 'object' && value !== null) {
                    validateNonEmpty(value, currentPath, lang);
                } else {
                    expect(typeof value, `Expected ${lang}:${currentPath} to be string`).toBe('string');
                    expect(value.trim().length, `Expected ${lang}:${currentPath} to be non-empty`).toBeGreaterThan(0);
                }
            }
        }

        for (const lang of expectedLanguages) {
            const mod = languageModules[`../languages/${lang}.json`];
            const content = mod.default || mod;
            validateNonEmpty(content, '', lang);
        }
    });
});
