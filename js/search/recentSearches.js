// maps Search - js/search/recentSearches.js

export function getRecentSearches() {
    try {
        const raw = localStorage.getItem('maps_recent_searches');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {
        console.error("Error reading recent searches", e);
    }
    return [];
}

export function addRecentSearch(query) {
    if (!query || typeof query !== 'string') return;
    const trimmed = query.trim();
    if (!trimmed) return;
    try {
        const current = getRecentSearches();
        const filtered = current.filter(item => item.toLowerCase() !== trimmed.toLowerCase());
        filtered.unshift(trimmed);
        const limited = filtered.slice(0, 10);
        localStorage.setItem('maps_recent_searches', JSON.stringify(limited));
    } catch (e) {
        console.error("Error saving recent search", e);
    }
}

export function removeRecentSearch(query) {
    if (!query) return;
    try {
        const current = getRecentSearches();
        const filtered = current.filter(item => item !== query);
        localStorage.setItem('maps_recent_searches', JSON.stringify(filtered));
    } catch (e) {
        console.error("Error removing recent search", e);
    }
}

export function clearRecentSearches() {
    try {
        localStorage.removeItem('maps_recent_searches');
    } catch (e) {
        console.error("Error clearing recent searches", e);
    }
}

