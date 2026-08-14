import { describe, it, expect } from 'vitest';

describe('Language Files Completeness & Parity', () => {
    const languageModules = import.meta.glob('../languages/*.json', { eager: true });
    const translations = {};
    const langKeysMap = {};

    function flattenObject(obj, prefix = '') {
        let keys = {};
        for (let key in obj) {
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                Object.assign(keys, flattenObject(obj[key], prefix ? `${prefix}.${key}` : key));
            } else {
                keys[prefix ? `${prefix}.${key}` : key] = obj[key];
            }
        }
        return keys;
    }

    Object.entries(languageModules).forEach(([filepath, content]) => {
        const langCode = filepath.split('/').pop().replace('.json', '');
        const jsonContent = content.default || content;
        translations[langCode] = jsonContent;
        langKeysMap[langCode] = flattenObject(jsonContent);
    });

    const enKeys = new Set(Object.keys(langKeysMap['en'] || {}));

    it('contains all 11 supported languages', () => {
        const supported = ['en', 'it', 'es', 'fr', 'de', 'zh', 'ja', 'ar', 'ru', 'pt', 'hi'];
        supported.forEach(lang => {
            expect(translations).toHaveProperty(lang);
        });
    });

    it('has identical key count and structure across all language files', () => {
        const enKeyCount = Object.keys(langKeysMap['en'] || {}).length;

        Object.keys(langKeysMap).forEach(lang => {
            const currentKeys = new Set(Object.keys(langKeysMap[lang]));
            const missingInLang = Array.from(enKeys).filter(k => !currentKeys.has(k));
            const extraInLang = Array.from(currentKeys).filter(k => !enKeys.has(k));

            expect(missingInLang, `Missing keys in ${lang}.json`).toEqual([]);
            expect(extraInLang, `Extra keys in ${lang}.json`).toEqual([]);
            expect(Object.keys(langKeysMap[lang]).length).toBe(enKeyCount);
        });
    });

    it('verifies that all data-i18n keys in templates exist in en.json', () => {
        const templateModules = import.meta.glob('../templates/*.html', { eager: true, query: '?raw', import: 'default' });

        const dataI18nRegex = /data-i18n(?:-html|-placeholder|-title|-aria-label)?=["']([^"']+)["']/g;

        Object.entries(templateModules).forEach(([filepath, text]) => {
            let m;
            while ((m = dataI18nRegex.exec(text)) !== null) {
                const key = m[1];
                expect(enKeys.has(key), `Key "${key}" used in ${filepath} must exist in en.json`).toBe(true);
            }
        });
    });
});
