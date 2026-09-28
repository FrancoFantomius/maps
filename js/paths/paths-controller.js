// maps Saved Paths Controller - js/paths/paths-controller.js

import { MapService } from '../map/index.js';
import { formatDistance } from '../measurement/measurement.js';
import { buildTrackPoints, downloadGPX } from '../measurement/gpx.js';
import { savePath, loadAllPaths, deletePathFromDB } from '../db/index.js';
import { parseGPX, generatePathGPX } from './gpx-parser.js';
import { openPathModal } from './path-modal.js';

export const PathsController = {
    customPaths: [],
    visibleLimit: 3,
    activePathId: null,

    async loadFromStorage() {
        try {
            this.visibleLimit = 3;
            this.customPaths = await loadAllPaths();
            this.renderAll();
        } catch (e) {
            console.error("Paths database load failed", e);
        }
    },

    renderAll() {
        const savedPathsList = document.getElementById('saved-paths-list');
        const pathCountBadge = document.getElementById('path-count-badge');
        const expandContainer = document.getElementById('saved-paths-expand-container');

        if (savedPathsList) {
            savedPathsList.innerHTML = '';
        }

        if (pathCountBadge) {
            pathCountBadge.innerText = String(this.customPaths.length);
        }

        if (this.customPaths.length === 0) {
            if (expandContainer) {
                expandContainer.classList.add('hidden');
            }
            if (savedPathsList) {
                savedPathsList.innerHTML = `
                    <div class="paths-empty-state">
                        <md-icon name="route" class="markers-empty-icon"></md-icon>
                        <h4 class="markers-empty-title">No saved paths yet</h4>
                        <p class="markers-empty-desc">Save paths from the measure tool or import GPX files to track your routes.</p>
                    </div>
                `;
            }
            return;
        }

        if (!this.visibleLimit || this.visibleLimit < 3) {
            this.visibleLimit = 3;
        }

        const visiblePaths = this.customPaths.slice(0, this.visibleLimit);
        visiblePaths.forEach((path) => {
            this.renderListItem(path, savedPathsList);
        });

        if (expandContainer) {
            if (this.customPaths.length > this.visibleLimit) {
                expandContainer.classList.remove('hidden');
            } else {
                expandContainer.classList.add('hidden');
            }
        }

        this.setupListListeners(savedPathsList);
    },

    resetPagination() {
        this.visibleLimit = 3;
        const savedPathsList = document.getElementById('saved-paths-list');
        const expandContainer = document.getElementById('saved-paths-expand-container');

        if (savedPathsList) {
            savedPathsList.innerHTML = '';
            if (this.customPaths.length === 0) {
                if (expandContainer) expandContainer.classList.add('hidden');
                savedPathsList.innerHTML = `
                    <div class="paths-empty-state">
                        <md-icon name="route" class="markers-empty-icon"></md-icon>
                        <h4 class="markers-empty-title">No saved paths yet</h4>
                        <p class="markers-empty-desc">Save paths from the measure tool or import GPX files to track your routes.</p>
                    </div>
                `;
                return;
            }

            const visiblePaths = this.customPaths.slice(0, this.visibleLimit);
            visiblePaths.forEach((path) => {
                this.renderListItem(path, savedPathsList);
            });

            if (expandContainer) {
                if (this.customPaths.length > this.visibleLimit) {
                    expandContainer.classList.remove('hidden');
                } else {
                    expandContainer.classList.add('hidden');
                }
            }
        }
    },

    loadMore() {
        if (this.visibleLimit >= this.customPaths.length) return;
        const previousLimit = this.visibleLimit;
        this.visibleLimit += 10;
        const savedPathsList = document.getElementById('saved-paths-list');
        const expandContainer = document.getElementById('saved-paths-expand-container');

        if (savedPathsList) {
            const nextBatch = this.customPaths.slice(previousLimit, this.visibleLimit);
            nextBatch.forEach(p => {
                this.renderListItem(p, savedPathsList);
            });
        }

        if (expandContainer) {
            if (this.customPaths.length > this.visibleLimit) {
                expandContainer.classList.remove('hidden');
            } else {
                expandContainer.classList.add('hidden');
            }
        }
    },

    setupListListeners(savedPathsList) {
        const expandBtn = document.getElementById('btn-expand-saved-paths');
        if (expandBtn && !expandBtn._bound) {
            expandBtn._bound = true;
            expandBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.loadMore();
            });
        }
    },

    renderListItem(path, container) {
        if (!container) return;

        const template = document.getElementById('template-path-list-item');
        let itemEl;
        let deleteBtn;
        let downloadBtn;

        const isImperial = MapService && MapService.isImperialUnits;
        const distStr = formatDistance(path.distance || 0, isImperial);
        const pointCount = (path.points && path.points.length) || 0;
        const supportingText = `${distStr} • ${pointCount} points`;

        if (template) {
            const clone = template.content.cloneNode(true);
            itemEl = clone.querySelector('.path-item') || clone.querySelector('md-list-item');
            const editBtn = clone.querySelector('.btn-edit-path');
            deleteBtn = clone.querySelector('.btn-delete-path');
            downloadBtn = clone.querySelector('.btn-download-path');

            if (itemEl) {
                itemEl.setAttribute('headline', path.name);
                itemEl.setAttribute('supporting-text', supportingText);
                itemEl.headline = path.name;
                itemEl.supportingText = supportingText;
            }

            const nameEl = clone.querySelector('.path-name');
            if (nameEl) nameEl.textContent = path.name;
            const subtextEl = clone.querySelector('.path-subtext');
            if (subtextEl) subtextEl.textContent = supportingText;

            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof editBtn.blur === 'function') editBtn.blur();
                    if (itemEl && typeof itemEl.blur === 'function') itemEl.blur();
                    this.promptRename(path);
                });
            }

            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof deleteBtn.blur === 'function') deleteBtn.blur();
                    if (itemEl && typeof itemEl.blur === 'function') itemEl.blur();
                    this.delete(path.id);
                });
            }

            if (downloadBtn) {
                downloadBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof downloadBtn.blur === 'function') downloadBtn.blur();
                    if (itemEl && typeof itemEl.blur === 'function') itemEl.blur();
                    this.download(path.id);
                });
            }

            if (itemEl) {
                itemEl.addEventListener('click', () => {
                    if (typeof itemEl.blur === 'function') itemEl.blur();
                    if (itemEl.shadowRoot && typeof itemEl.shadowRoot.querySelector === 'function') {
                        itemEl.shadowRoot.querySelector('.item')?.blur();
                    }
                    this.selectPath(path);
                });
            }

            container.appendChild(clone);
        } else {
            // Programmatic fallback
            itemEl = document.createElement('md-list-item');
            itemEl.className = 'path-item';
            itemEl.setAttribute('interactive', '');
            itemEl.setAttribute('headline', path.name);
            itemEl.setAttribute('supporting-text', supportingText);

            const iconSlot = document.createElement('div');
            iconSlot.slot = 'start';
            iconSlot.className = 'path-leading-badge';
            iconSlot.innerHTML = `<md-icon name="route" class="path-leading-icon"></md-icon>`;
            itemEl.appendChild(iconSlot);

            const editBtnEl = document.createElement('md-icon-button');
            editBtnEl.slot = 'end';
            editBtnEl.className = 'btn-edit-path';
            editBtnEl.setAttribute('icon', 'edit');
            editBtnEl.setAttribute('variant', 'standard');
            editBtnEl.setAttribute('aria-label', 'Rename path');
            editBtnEl.setAttribute('title', 'Rename path');
            editBtnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof editBtnEl.blur === 'function') editBtnEl.blur();
                if (typeof itemEl.blur === 'function') itemEl.blur();
                this.promptRename(path);
            });
            itemEl.appendChild(editBtnEl);

            const downloadBtnEl = document.createElement('md-icon-button');
            downloadBtnEl.slot = 'end';
            downloadBtnEl.className = 'btn-download-path';
            downloadBtnEl.setAttribute('icon', 'download');
            downloadBtnEl.setAttribute('variant', 'standard');
            downloadBtnEl.setAttribute('aria-label', 'Export GPX');
            downloadBtnEl.setAttribute('title', 'Export GPX');
            downloadBtnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof downloadBtnEl.blur === 'function') downloadBtnEl.blur();
                if (typeof itemEl.blur === 'function') itemEl.blur();
                this.download(path.id);
            });
            itemEl.appendChild(downloadBtnEl);

            const deleteBtnEl = document.createElement('md-icon-button');
            deleteBtnEl.slot = 'end';
            deleteBtnEl.className = 'btn-delete-path';
            deleteBtnEl.setAttribute('icon', 'delete');
            deleteBtnEl.setAttribute('variant', 'standard');
            deleteBtnEl.setAttribute('aria-label', 'Delete path');
            deleteBtnEl.setAttribute('title', 'Delete');
            deleteBtnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof deleteBtnEl.blur === 'function') deleteBtnEl.blur();
                if (typeof itemEl.blur === 'function') itemEl.blur();
                this.delete(path.id);
            });
            itemEl.appendChild(deleteBtnEl);

            itemEl.addEventListener('click', () => {
                if (typeof itemEl.blur === 'function') itemEl.blur();
                if (itemEl.shadowRoot && typeof itemEl.shadowRoot.querySelector === 'function') {
                    itemEl.shadowRoot.querySelector('.item')?.blur();
                }
                this.selectPath(path);
            });

            container.appendChild(itemEl);
        }
    },

    selectPath(path) {
        if (!path) return;
        this.activePathId = path.id;
        if (MapService && typeof MapService.displayPath === 'function') {
            MapService.displayPath(path.points);
        }
    },

    async delete(id) {
        try {
            await deletePathFromDB(id);
            this.customPaths = await loadAllPaths();
            if (this.activePathId === id) {
                this.activePathId = null;
                if (MapService && typeof MapService.clearDisplayedPath === 'function') {
                    MapService.clearDisplayedPath();
                }
            }
            this.renderAll();
        } catch (err) {
            console.error("Failed to delete path:", err);
        }
    },

    download(id) {
        const path = this.customPaths.find(p => p.id === id);
        if (!path) return;
        const gpxXml = path.gpx || generatePathGPX(path.points, { name: path.name, mode: path.mode });
        const safeName = (path.name || 'path').replace(/[^\w\s-]/gi, '_');
        downloadGPX(gpxXml, `${safeName}.gpx`);
    },

    async importGPXFile(file) {
        if (!file) return;
        try {
            const text = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (err) => reject(err);
                reader.readAsText(file);
            });

            const parsed = parseGPX(text);
            const fileNameWithoutExt = file.name.replace(/\.gpx$/i, '');
            const finalName = (parsed.name && parsed.name !== 'Imported Path') ? parsed.name : fileNameWithoutExt;

            const pathId = 'path_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            const pathObj = {
                name: finalName,
                gpx: text,
                points: parsed.points,
                distance: parsed.distance,
                mode: 'path',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            await savePath(pathId, pathObj);
            this.customPaths = await loadAllPaths();
            this.renderAll();
            this.selectPath(pathObj);
        } catch (err) {
            console.error("Failed to import GPX file:", err);
            alert("Failed to import GPX file: " + (err.message || err));
        }
    },

    promptSaveMeasurePath(measurePoints, mode, routedGeometry, totalDist) {
        const minPoints = mode === 'area' ? 3 : 2;
        if (!measurePoints || measurePoints.length < minPoints) return;

        const defaultName = `Route ${new Date().toLocaleDateString()}`;
        const isImperial = MapService && MapService.isImperialUnits;
        const distStr = formatDistance(totalDist || 0, isImperial);
        const infoText = `Total Distance: ${distStr} (${measurePoints.length} points)`;

        openPathModal(defaultName, infoText, async (name) => {
            await this.saveMeasurePath(measurePoints, mode, routedGeometry, totalDist, name);
        });
    },

    async saveMeasurePath(measurePoints, mode, routedGeometry, totalDist, name) {
        const trackPoints = buildTrackPoints(measurePoints, mode, routedGeometry);
        const gpxXml = generatePathGPX(trackPoints, { name, mode });

        const pathId = 'path_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const pathObj = {
            name: name || 'Measured Path',
            gpx: gpxXml,
            points: trackPoints,
            distance: totalDist || 0,
            mode: mode || 'path',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        await savePath(pathId, pathObj);
        this.customPaths = await loadAllPaths();
        this.renderAll();
    },

    promptRename(path) {
        if (!path) return;
        const ptCount = (path.points && path.points.length) || 0;
        const isImperial = MapService && MapService.isImperialUnits;
        const distStr = formatDistance(path.distance || 0, isImperial);
        const infoText = `${distStr} • ${ptCount} points`;

        openPathModal(path.name, infoText, async (newName) => {
            await this.renamePath(path.id, newName);
        }, 'Rename Path', 'Rename');
    },

    async renamePath(id, newName) {
        const trimmed = (newName || '').trim();
        if (!trimmed) return;
        const path = this.customPaths.find(p => p.id === id);
        if (!path) return;

        const updatedPath = {
            ...path,
            name: trimmed,
            updatedAt: Date.now()
        };

        if (updatedPath.points && updatedPath.points.length) {
            updatedPath.gpx = generatePathGPX(updatedPath.points, { name: trimmed, mode: updatedPath.mode || 'path' });
        }

        await savePath(id, updatedPath);
        this.customPaths = await loadAllPaths();
        this.renderAll();
    }
};

window.addEventListener('maps-paths-updated', async () => {
    try {
        PathsController.customPaths = await loadAllPaths();
        PathsController.renderAll();
    } catch (e) {
        console.error("[Sync UI] Error re-rendering paths:", e);
    }
});

export default PathsController;
