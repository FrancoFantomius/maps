// maps Translation Controller - js/TranslationController.js

export const TranslationController = {
    languagePref: 'system',
    currentLang: 'en',
    translations: {},
    supportedLanguages: {
        en: 'English',
        it: 'Italiano',
        es: 'Español',
        fr: 'Français',
        de: 'Deutsch',
        nl: 'Nederlands (Dutch)',
        pl: 'Polski (Polish)',
        pt: 'Português (Portuguese)',
        sv: 'Svenska (Swedish)',
        da: 'Dansk (Danish)',
        no: 'Norsk (Norwegian)',
        fi: 'Suomi (Finnish)',
        el: 'Ελληνικά (Greek)',
        cs: 'Čeština (Czech)',
        hu: 'Magyar (Hungarian)',
        ro: 'Română (Romanian)',
        uk: 'Українська (Ukrainian)',
        tr: 'Türkçe (Turkish)',
        ru: 'Русский (Russian)',
        zh: '中文 (Chinese)',
        ar: 'العربية (Arabic)',
        ja: '日本語 (Japanese)',
        id: 'Bahasa Indonesia',
        hi: 'हिन्दी (Hindi)',
        bn: 'বাংলা (Bengali)',
        vi: 'Tiếng Việt (Vietnamese)',
        ko: '한국어 (Korean)',
        th: 'ไทย (Thai)',
        ur: 'اردو (Urdu)',
        tl: 'Tagalog (Filipino)',
        fa: 'فارسی (Persian)',
        sw: 'Kiswahili (Swahili)',
        ms: 'Bahasa Melayu (Malay)',
        he: 'עברית (Hebrew)',
        mr: 'मराठी (Marathi)',
        te: 'తెలుగు (Telugu)',
        ta: 'தமிழ் (Tamil)',
        gu: 'ગુજરાતી (Gujarati)',
        pa: 'ਪੰਜਾਬੀ (Punjabi)',
        kn: 'ಕನ್ನಡ (Kannada)',
        ml: 'മലയാളം (Malayalam)',
        sk: 'Slovenčina (Slovak)',
        bg: 'Български (Bulgarian)',
        hr: 'Hrvatski (Croatian)',
        sr: 'Српски (Serbian)',
        ca: 'Català (Catalan)',
        lt: 'Lietuvių (Lithuanian)',
        lv: 'Latviešu (Latvian)',
        et: 'Eesti (Eesti)',
        sl: 'Slovenščina (Slovenian)',
        sq: 'Shqip (Albanian)',
        kk: 'Қазақ тілі (Kazakh)',
        uz: 'Oʻzbekcha (Uzbek)',
        az: 'Azərbaycan dili (Azerbaijani)',
        my: 'မြန်မာစာ (Burmese)',
        si: 'සිංහල (Sinhala)',
        km: 'ភាសាខ្មែរ (Khmer)',
        am: 'አማርኛ (Amharic)',
        ha: 'Hausa',
        yo: 'Yorùbá',
        ig: 'Asụsụ Igbo'
    },
    cacheName: 'maps-translations-v1',

    async init() {
        this.languagePref = localStorage.getItem('language_preference') || 'system';
        const resolved = this.resolveLanguage(this.languagePref);
        
        // 1. ALWAYS load and cache English ('en') version as the primary base fallback
        await this.loadLanguage('en');

        // 2. Load and cache the resolved active language version if different from English
        if (resolved !== 'en') {
            await this.loadLanguage(resolved);
        }

        this.currentLang = resolved;
        this.applyTranslations();

        // 3. Sync and dynamically populate setting select UI if element exists
        this.updateSettingsUI();

        // 4. Listen for browser language changes if preference is 'system'
        window.addEventListener('languagechange', async () => {
            if (this.languagePref === 'system') {
                const newResolved = this.resolveLanguage('system');
                if (newResolved !== this.currentLang) {
                    await this.setLanguage('system');
                }
            }
        });
    },

    getBrowserLanguage() {
        const nav = typeof navigator !== 'undefined' ? navigator : null;
        if (!nav) return 'en';
        const rawLang = (nav.languages && nav.languages.length ? nav.languages[0] : nav.language) || 'en';
        const code = rawLang.split('-')[0].toLowerCase();
        return (code in this.supportedLanguages) ? code : 'en';
    },

    resolveLanguage(pref) {
        if (!pref || pref === 'system') {
            return this.getBrowserLanguage();
        }
        return (pref in this.supportedLanguages) ? pref : 'en';
    },

    async loadLanguage(lang) {
        if (this.translations[lang]) {
            return this.translations[lang];
        }

        const url = `/languages/${lang}.json`;

        // Strategy: 1. Try CacheStorage, 2. Try network (and update CacheStorage + localStorage), 3. Fall back to localStorage
        let data = null;

        // Try CacheStorage first
        if (typeof caches !== 'undefined') {
            try {
                const cache = await caches.open(this.cacheName);
                const cachedResponse = await cache.match(url);
                if (cachedResponse) {
                    data = await cachedResponse.json();
                }
            } catch (e) {
                // Ignore CacheStorage errors
            }
        }

        // Try network fetch
        if (typeof fetch !== 'undefined') {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    const freshData = await res.json();
                    data = freshData;

                    // Cache in CacheStorage
                    if (typeof caches !== 'undefined') {
                        try {
                            const cache = await caches.open(this.cacheName);
                            cache.put(url, new Response(JSON.stringify(freshData), {
                                headers: { 'Content-Type': 'application/json' }
                            }));
                        } catch (e) {
                            // Ignore CacheStorage put error
                        }
                    }

                    // Cache in localStorage fallback
                    try {
                        localStorage.setItem(`translation_cache_${lang}`, JSON.stringify(freshData));
                    } catch (e) {
                        // Ignore localStorage errors
                    }
                }
            } catch (netErr) {
                // Network unavailable or offline
            }
        }

        // Fall back to localStorage if fetch failed and CacheStorage had no data
        if (!data) {
            try {
                const saved = localStorage.getItem(`translation_cache_${lang}`);
                if (saved) {
                    data = JSON.parse(saved);
                }
            } catch (e) {
                // Ignore localStorage parse error
            }
        }

        if (data) {
            this.translations[lang] = data;
        }

        return this.translations[lang] || {};
    },

    async setLanguage(pref) {
        this.languagePref = pref;
        localStorage.setItem('language_preference', pref);

        const resolved = this.resolveLanguage(pref);
        
        // Ensure English is always cached
        await this.loadLanguage('en');
        
        // Load target language
        await this.loadLanguage(resolved);

        this.currentLang = resolved;
        this.applyTranslations();
        this.updateSettingsUI();

        window.dispatchEvent(new CustomEvent('languageChanged', {
            detail: { lang: this.currentLang, preference: this.languagePref }
        }));
    },

    t(key, params = {}, fallback = null) {
        const val = this.getNestedValue(this.translations[this.currentLang], key)
            || this.getNestedValue(this.translations['en'], key)
            || fallback
            || key;

        if (typeof val !== 'string') return val;

        return val.replace(/\{(\w+)\}/g, (_, p) => (params[p] !== undefined ? params[p] : `{${p}}`));
    },

    getNestedValue(obj, path) {
        if (!obj || typeof obj !== 'object') return null;
        const keys = path.split('.');
        let current = obj;
        for (const k of keys) {
            if (current && typeof current === 'object' && k in current) {
                current = current[k];
            } else {
                return null;
            }
        }
        return current;
    },

    applyTranslations(root = document) {
        if (typeof document !== 'undefined' && document.documentElement) {
            document.documentElement.setAttribute('lang', this.currentLang);
            const rtlLangs = ['ar', 'fa', 'he', 'ur'];
            document.documentElement.setAttribute('dir', rtlLangs.includes(this.currentLang) ? 'rtl' : 'ltr');
        }

        if (!root || typeof root.querySelectorAll !== 'function') return;

        // textContent
        root.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                el.textContent = this.t(key, {}, el.textContent);
            }
        });

        // innerHTML (for rich text like terms/privacy)
        root.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            if (key) {
                el.innerHTML = this.t(key, {}, el.innerHTML);
            }
        });

        // placeholder
        root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) {
                el.placeholder = this.t(key, {}, el.placeholder);
            }
        });

        // title
        root.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (key) {
                el.title = this.t(key, {}, el.title);
            }
        });

        // aria-label
        root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
            const key = el.getAttribute('data-i18n-aria-label');
            if (key) {
                el.setAttribute('aria-label', this.t(key, {}, el.getAttribute('aria-label')));
            }
        });
    },

    updateSettingsUI() {
        const selectEl = document.getElementById('setting-language');
        if (!selectEl) return;

        const systemLabel = this.t('settings.language_system', {}, 'System (Auto)');
        let optionsHtml = `<option value="system" data-i18n="settings.language_system">${systemLabel}</option>`;

        for (const [code, label] of Object.entries(this.supportedLanguages)) {
            optionsHtml += `<option value="${code}">${label}</option>`;
        }

        selectEl.innerHTML = optionsHtml;
        selectEl.value = this.languagePref;
    }
};
