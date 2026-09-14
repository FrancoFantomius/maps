// maps Search Controller - js/search/index.js

import { getUserLocation } from './getUserLocation.js';
import { calculateDistance } from './calculateDistance.js';
import { prioritizeResults } from './prioritizeResults.js';
import { getViewbox } from './getViewbox.js';
import { fetchDetailsForPlace } from './fetchDetailsForPlace.js';
import { selectResult } from './selectResult.js';
import {
    getRecentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches
} from './recentSearches.js';
import {
    uiState,
    clearSearchMarkers,
    createSearchPin,
    renderResults,
    renderSuggestions,
    setupSearchUI
} from './ui.js';

export const SearchController = {
    get searchMarkers() {
        return uiState.searchMarkers;
    },
    set searchMarkers(val) {
        uiState.searchMarkers = val;
    },
    get searchResults() {
        return uiState.searchResults;
    },
    set searchResults(val) {
        uiState.searchResults = val;
    },

    getUserLocation,
    calculateDistance,
    prioritizeResults,
    getViewbox,
    clearSearchMarkers,
    createSearchPin,
    fetchDetailsForPlace,
    selectResult,
    renderResults,
    getRecentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    renderSuggestions
};

export {
    getUserLocation,
    calculateDistance,
    prioritizeResults,
    getViewbox,
    fetchDetailsForPlace,
    selectResult,
    getRecentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    uiState,
    clearSearchMarkers,
    createSearchPin,
    renderResults,
    renderSuggestions,
    setupSearchUI
};

export default SearchController;

