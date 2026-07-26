// tests/TranslationController.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranslationController } from '../js/TranslationController.js';

describe('TranslationController', () => {
    beforeEach(() => {
        localStorage.clear();
        TranslationController.translations = {};
        TranslationController.currentLang = 'en';
        TranslationController.languagePref = 'system';
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    describe('getBrowserLanguage', () => {
        it('returns browser primary language if supported', () => {
            const originalNav = global.navigator;
            Object.defineProperty(global, 'navigator', {
                value: { language: 'it-IT', languages: ['it-IT', 'en'] },
                writable: true,
                configurable: true
            });

            expect(TranslationController.getBrowserLanguage()).toBe('it');

            Object.defineProperty(global, 'navigator', {
                value: originalNav,
                writable: true,
                configurable: true
            });
        });

        it('defaults to en if browser language is unsupported', () => {
            const originalNav = global.navigator;
            Object.defineProperty(global, 'navigator', {
                value: { language: 'xx-XX', languages: ['xx-XX'] },
                writable: true,
                configurable: true
            });

            expect(TranslationController.getBrowserLanguage()).toBe('en');

            Object.defineProperty(global, 'navigator', {
                value: originalNav,
                writable: true,
                configurable: true
            });
        });
    });

    describe('loadLanguage & caching', () => {
        it('fetches translation file and caches in memory and localStorage', async () => {
            const mockDict = { settings: { title: 'Impostazioni' } };
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => mockDict
            });

            const result = await TranslationController.loadLanguage('it');

            expect(global.fetch).toHaveBeenCalledWith('/languages/it.json');
            expect(result).toEqual(mockDict);
            expect(TranslationController.translations['it']).toEqual(mockDict);
            expect(localStorage.getItem('translation_cache_it')).toBe(JSON.stringify(mockDict));
        });

        it('uses localStorage cache if offline / fetch fails', async () => {
            const mockDict = { settings: { title: 'Impostazioni Offline' } };
            localStorage.setItem('translation_cache_it', JSON.stringify(mockDict));

            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

            const result = await TranslationController.loadLanguage('it');

            expect(result).toEqual(mockDict);
            expect(TranslationController.translations['it']).toEqual(mockDict);
        });
    });

    describe('translation lookup (t)', () => {
        beforeEach(() => {
            TranslationController.translations = {
                en: {
                    settings: { title: 'Map Settings', subtitle: 'Configure layers' },
                    welcome: 'Hello {name}!'
                },
                it: {
                    settings: { title: 'Impostazioni Mappa' }
                }
            };
            TranslationController.currentLang = 'it';
        });

        it('returns translation for active language', () => {
            expect(TranslationController.t('settings.title')).toBe('Impostazioni Mappa');
        });

        it('falls back to English if key is missing in active language', () => {
            expect(TranslationController.t('settings.subtitle')).toBe('Configure layers');
        });

        it('replaces placeholder parameters', () => {
            TranslationController.currentLang = 'en';
            expect(TranslationController.t('welcome', { name: 'Alice' })).toBe('Hello Alice!');
        });

        it('returns fallback string or key if missing in both languages', () => {
            expect(TranslationController.t('unknown.key', {}, 'Default Value')).toBe('Default Value');
            expect(TranslationController.t('unknown.key')).toBe('unknown.key');
        });
    });

    describe('applyTranslations', () => {
        beforeEach(() => {
            TranslationController.translations = {
                en: {
                    title: 'Title En',
                    placeholder: 'Placeholder En',
                    btn_title: 'Button Title En'
                },
                it: {
                    title: 'Titolo It',
                    placeholder: 'Segnaposto It',
                    btn_title: 'Titolo Pulsante It'
                }
            };
            TranslationController.currentLang = 'it';
        });

        it('translates DOM element textContent, placeholder, title, aria-label', () => {
            document.body.innerHTML = `
                <h1 data-i18n="title">Title En</h1>
                <input id="inp" data-i18n-placeholder="placeholder" placeholder="Placeholder En">
                <button id="btn" data-i18n-title="btn_title" data-i18n-aria-label="btn_title" title="Old Title" aria-label="Old Label">Btn</button>
            `;

            TranslationController.applyTranslations();

            expect(document.querySelector('h1').textContent).toBe('Titolo It');
            expect(document.getElementById('inp').placeholder).toBe('Segnaposto It');
            expect(document.getElementById('btn').title).toBe('Titolo Pulsante It');
            expect(document.getElementById('btn').getAttribute('aria-label')).toBe('Titolo Pulsante It');
        });
    });

    describe('setLanguage & event dispatching', () => {
        it('updates preference, current language, and dispatches event', async () => {
            const mockEn = { test: 'Test En' };
            const mockIt = { test: 'Test It' };

            global.fetch = vi.fn().mockImplementation(url => {
                if (url.includes('it.json')) return Promise.resolve({ ok: true, json: async () => mockIt });
                return Promise.resolve({ ok: true, json: async () => mockEn });
            });

            const listener = vi.fn();
            window.addEventListener('languageChanged', listener);

            await TranslationController.setLanguage('it');

            expect(localStorage.getItem('language_preference')).toBe('it');
            expect(TranslationController.currentLang).toBe('it');
            expect(listener).toHaveBeenCalled();
            expect(listener.mock.calls[0][0].detail).toEqual({ lang: 'it', preference: 'it' });
        });
    });

    describe('updateSettingsUI', () => {
        it('dynamically populates select element options from supportedLanguages JSON dictionary', () => {
            document.body.innerHTML = `
                <select id="setting-language">
                    <option value="system">System</option>
                </select>
            `;

            TranslationController.updateSettingsUI();

            const selectEl = document.getElementById('setting-language');
            const options = Array.from(selectEl.options).map(o => ({ value: o.value, text: o.textContent }));

            expect(options).toContainEqual({ value: 'system', text: 'System (Auto)' });
            expect(options).toContainEqual({ value: 'en', text: 'English' });
            expect(options).toContainEqual({ value: 'it', text: 'Italiano' });
            expect(options).toContainEqual({ value: 'zh', text: '中文 (Chinese)' });
            expect(options).toContainEqual({ value: 'ar', text: 'العربية (Arabic)' });
        });
    });
});
