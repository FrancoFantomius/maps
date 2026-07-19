// maps API Request Service - js/ApiService.js

export const ApiService = {
    async reverseGeocode(lat, lng) {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Nominatim reverse geocode failed: ${res.statusText}`);
        return await res.json();
    },

    async searchGeocode(query, limit = null) {
        let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
        if (limit) {
            url += `&limit=${limit}&addressdetails=1`;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Nominatim search geocode failed: ${res.statusText}`);
        return await res.json();
    },

    async fetchWikipediaNearby(lat, lng, radius = 100) {
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gsradius=${radius}&gscoord=${lat}|${lng}&format=json&origin=*`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Wikipedia search failed: ${res.statusText}`);
        return await res.json();
    },

    async fetchWikipediaSummary(title) {
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Wikipedia summary failed: ${res.statusText}`);
        return await res.json();
    },

    async fetchOverpassFeatures(lat, lng) {
        const url = `https://overpass-api.de/api/interpreter?data=[out:json];(way(around:20,${lat},${lng})[highway];node(around:50,${lat},${lng})[shop];node(around:50,${lat},${lng})[amenity];);out geom;`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Overpass query failed: ${res.statusText}`);
        return await res.json();
    },

    async calculateRoute(start, end, profile = 'driving') {
        let profileSlug = 'driving';
        if (profile === 'cycling') profileSlug = 'bike';
        if (profile === 'foot') profileSlug = 'foot';

        const url = `https://router.project-osrm.org/route/v1/${profileSlug}/${start.lng},${start.lat};${end.lng},${end.lat}?geometries=geojson&overview=full&steps=true&alternatives=true`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`OSRM routing failed: ${res.statusText}`);
        return await res.json();
    },

    async fetchWikimediaImage(lat, lng, radius = 1000) {
        const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggsnamespace=6&ggsradius=${radius}&ggscoord=${lat}|${lng}&ggslimit=5&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json&origin=*`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Wikimedia Commons query failed: ${res.statusText}`);
        const data = await res.json();
        if (data.query && data.query.pages) {
            const pages = Object.values(data.query.pages);
            // Find first actual image (not SVG, not audio, etc.)
            for (const page of pages) {
                if (page.imageinfo && page.imageinfo.length > 0) {
                    const info = page.imageinfo[0];
                    if (info.mime && info.mime.startsWith('image/') && !info.mime.includes('svg')) {
                        return info.thumburl || info.url;
                    }
                }
            }
        }
        return null;
    }
};
