// maps Pin Visuals - js/markers/pin.js

export const colorPalette = {
    poi: { main: '#6366f1', fill: '#818cf8', emoji: '🎯', svg: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' },
    home: { main: '#4f46e5', fill: '#6366f1', emoji: '🏠', svg: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z' },
    food: { main: '#ef4444', fill: '#f87171', emoji: '🍕', svg: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm4-3h2v16h2V2h-4c0 2.21 1.79 4 4 4z' },
    lodging: { main: '#a855f7', fill: '#c084fc', emoji: '🏨', svg: 'M7 14c1.66 0 3-1.34 3-3S8.66 8 7 8s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z' },
    nature: { main: '#10b981', fill: '#34d399', emoji: '🌿', svg: 'M2 22h20v-2h-3l-3.23-6.46L19 12h-3l-3.32-6.64L15 4H9l2.32 4.64L8 10H5l3.23 6.46L5 18H2v4z' }
};

export function createPin(category = 'poi', colorOverride = null, content = null) {
    const config = colorPalette[category] || colorPalette.poi;
    const el = document.createElement('div');
    el.className = 'custom-map-pin-div';
    el.style.cursor = 'pointer';
    el.style.width = '34px';
    el.style.height = '42px';
    const displayColor = colorOverride || config.main;
    const isCustomContent = content !== null && content !== undefined;
    const displayContent = isCustomContent ? content : config.emoji;
    const fontStyle = isCustomContent
        ? `font-size: 13px; font-weight: 700; color: ${displayColor}; font-family: 'Inter', system-ui, sans-serif;`
        : `font-size: 14px;`;

    el.innerHTML = `<svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 0C7.61 0 0 7.61 0 17C0 26.5 17 42 17 42C17 42 34 26.5 34 17C34 7.61 26.39 0 17 0Z" fill="${displayColor}"/>
        <circle cx="17" cy="17" r="11" fill="white"/>
    </svg>
    <span style="position:absolute;top:7px;left:0;width:34px;height:22px;display:flex;align-items:center;justify-content:center;line-height:1;pointer-events:none;${fontStyle}">${displayContent}</span>`;
    return el;
}

