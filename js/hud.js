// maps HUD Module

import { state, colorPalette } from './state.js';

export function setHUDState(hudState, data = null) {
    state.currentHUDState = hudState;

    if (hudState !== 'place-details') {
        if (state.tempMarker) {
            state.map.removeLayer(state.tempMarker);
            state.tempMarker = null;
        }
        if (state.highlightedPath) {
            state.map.removeLayer(state.highlightedPath);
            state.highlightedPath = null;
        }
    }

    const panelPlaces = document.getElementById('panel-places');
    const panelSearch = document.getElementById('panel-search');
    const panelDetails = document.getElementById('panel-details');
    const measurePanel = document.getElementById('measure-panel');
    const navPanel = document.getElementById('nav-panel');
    const drawBtn = document.getElementById('btn-draw');
    const routeBtn = document.getElementById('btn-route');

    panelPlaces.classList.add('hidden');
    panelSearch.classList.add('hidden');
    measurePanel.classList.add('hidden');
    navPanel.classList.add('hidden');
    panelDetails.classList.add('hidden');

    drawBtn.className = 'group flex items-center justify-center w-12 h-12 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-full shadow-lg hover:shadow-xl text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30 transition-all duration-300 relative';
    routeBtn.className = 'group flex items-center justify-center w-12 h-12 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-full shadow-lg hover:shadow-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all duration-300 relative';

    if (hudState === 'places') {
        panelPlaces.classList.remove('hidden');
    } else if (hudState === 'search-results') {
        panelSearch.classList.remove('hidden');
    } else if (hudState === 'measure') {
        measurePanel.classList.remove('hidden');
        drawBtn.className = 'group flex items-center justify-center w-12 h-12 bg-teal-600 text-white rounded-full shadow-lg hover:shadow-xl hover:bg-teal-500 transition-all duration-300 relative border border-teal-500';
    } else if (hudState === 'route') {
        navPanel.classList.remove('hidden');
        routeBtn.className = 'group flex items-center justify-center w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:shadow-xl hover:bg-blue-500 transition-all duration-300 relative border border-blue-500';
    } else if (hudState === 'place-details') {
        panelDetails.classList.remove('hidden');
        renderPlaceDetails(data);
    }
}

export function renderPlaceDetails(data) {
    const panelDetails = document.getElementById('panel-details');
    if (!data) return;

    if (data.isLoading) {
        panelDetails.innerHTML = `
            <div class="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                <span class="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 font-display">Searching...</span>
                <button type="button" onclick="window.setHUDState('places')" class="text-xs text-slate-400 hover:text-slate-655 dark:hover:text-slate-250 font-semibold transition-colors">✕ Close</button>
            </div>
            <div class="space-y-4 flex-1 overflow-y-auto pr-1 flex flex-col justify-between h-full animate-pulse">
                <div class="space-y-3">
                    <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
                    <div class="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mt-2"></div>
                    <div class="space-y-2 mt-4">
                        <div class="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                        <div class="h-3 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
                        <div class="h-3 bg-slate-200 dark:bg-slate-800 rounded w-4/5"></div>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    if (data.isTemp) {
        let shopHtml = "";
        if (data.shopInfo) {
            shopHtml = `
                <div class="bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100/30 dark:border-indigo-900/10 rounded-xl p-3 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <div class="font-bold text-slate-700 dark:text-slate-300">🏪 Shop Details:</div>
                    ${data.shopInfo.type ? `<div><span class="font-semibold">Type:</span> ${data.shopInfo.type.replace('_', ' ')}</div>` : ''}
                    ${data.shopInfo.brand ? `<div><span class="font-semibold">Brand:</span> ${data.shopInfo.brand}</div>` : ''}
                    ${data.shopInfo.openingHours ? `<div><span class="font-semibold">Hours:</span> ${data.shopInfo.openingHours}</div>` : ''}
                    ${data.shopInfo.cuisine ? `<div><span class="font-semibold">Cuisine:</span> ${data.shopInfo.cuisine}</div>` : ''}
                    ${data.shopInfo.website ? `<div><span class="font-semibold">Web:</span> <a href="${data.shopInfo.website}" target="_blank" class="text-indigo-600 dark:text-indigo-400 hover:underline break-all">${data.shopInfo.website}</a></div>` : ''}
                    ${data.shopInfo.phone ? `<div><span class="font-semibold">Phone:</span> ${data.shopInfo.phone}</div>` : ''}
                </div>
            `;
        }

        let streetHtml = "";
        if (data.streetName) {
            streetHtml = `
                <div class="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50/50 dark:bg-indigo-950/20 px-2.5 py-1.5 rounded-lg border border-indigo-100/50 dark:border-indigo-900/20">
                    <span class="material-icons-outlined text-sm">directions_bike</span>
                    <span>Highlighting: ${data.streetName}</span>
                </div>
            `;
        }

        panelDetails.innerHTML = `
            <div class="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                <span class="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 font-display">New Location</span>
                <button type="button" onclick="window.setHUDState('places')" class="text-xs text-slate-400 hover:text-slate-655 dark:hover:text-slate-250 font-semibold transition-colors">✕ Close</button>
            </div>
            <div class="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col justify-between">
                <div class="space-y-3">
                    <h3 class="font-display font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug">${data.name || "Dropped Pin"}</h3>
                    <p class="font-mono text-[10px] text-slate-450 dark:text-slate-500 mt-1">${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}</p>
                    
                    ${streetHtml}

                    ${data.wikiSummary ? `
                        <div class="bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/10 rounded-xl p-3 text-xs text-slate-650 dark:text-slate-350 leading-relaxed italic">
                            ${data.wikiSummary}
                        </div>
                    ` : data.address ? `
                        <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">${data.address}</p>
                    ` : `
                        <div class="bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/10 rounded-xl p-3 text-xs text-slate-500 dark:text-slate-450 leading-relaxed">
                            To store this coordinate as a landmark, click the button below to assign a name, category, and description.
                        </div>
                    `}

                    ${shopHtml}
                </div>
                <button onclick="window.openMarkerModal(${data.lat}, ${data.lng})" class="w-full py-2.5 px-3 mt-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition-all">Save to Places</button>
            </div>
        `;
    } else {
        const config = colorPalette[data.category] || colorPalette.poi;
        const categoryLabels = {
            poi: '🎯 Point of Interest',
            food: '🍕 Food & Drink',
            lodging: '🏨 Lodging',
            nature: '🌿 Nature / Scenic'
        };
        panelDetails.innerHTML = `
            <div class="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                <span class="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border font-display" style="border-color:${config.main}30; background:${config.main}15; color:${config.main}">
                    ${categoryLabels[data.category] || 'Place'}
                </span>
                <button type="button" onclick="window.setHUDState('places')" class="text-xs text-slate-400 hover:text-slate-655 dark:hover:text-slate-250 font-semibold transition-colors">✕ Close</button>
            </div>
            <div class="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col justify-between h-full">
                <div class="space-y-3">
                    <h3 class="font-display font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug">${data.name}</h3>
                    <p class="font-mono text-[10px] text-slate-450 dark:text-slate-500 mt-1">${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}</p>
                    ${data.desc ? `<p class="text-xs text-slate-600 dark:text-slate-350 bg-slate-50 dark:bg-slate-950 border border-slate-200/40 dark:border-slate-800/40 rounded-xl p-3 shadow-inner italic leading-relaxed">${data.desc}</p>` : `<p class="text-xs text-slate-400 dark:text-slate-600 italic">No notes or description saved.</p>`}
                </div>
                <div class="flex items-center gap-2 pt-3 mt-4 border-t border-slate-100 dark:border-slate-800">
                    <button onclick="window.openMarkerModal(${data.lat}, ${data.lng}, '${data.id}')" class="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors border border-slate-200/50 dark:border-slate-800/50">Edit Details</button>
                    <button onclick="window.deleteSavedMarker('${data.id}')" class="flex-1 py-2 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 font-semibold text-xs transition-colors border border-red-200/50 dark:border-red-900/20">Delete Pin</button>
                </div>
            </div>
        `;
    }
}
