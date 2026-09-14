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
import { fetchPlaceSuggestions, getPlaceIcon } from './fetchPlaceSuggestions.js';
import {
    uiState,
    clearSearchMarkers,
    createSearchPin,
    renderResults,
    renderSuggestions,
    setupSearchUI
} from './ui.js';
import {
    openPlaceDetails,
    closePlaceDetails,
    setupPlaceDetailsSheet,
    getCurrentPlaceData
} from './place-details-sheet.js';

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
    get isShowingSearchResults() {
        return uiState.isShowingSearchResults;
    },
    set isShowingSearchResults(val) {
        uiState.isShowingSearchResults = val;
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
    renderSuggestions,
    fetchPlaceSuggestions,
    getPlaceIcon,
    openPlaceDetails,
    closePlaceDetails,
    setupPlaceDetailsSheet,
    getCurrentPlaceData
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
    fetchPlaceSuggestions,
    getPlaceIcon,
    uiState,
    clearSearchMarkers,
    createSearchPin,
    renderResults,
    renderSuggestions,
    setupSearchUI,
    openPlaceDetails,
    closePlaceDetails,
    setupPlaceDetailsSheet,
    getCurrentPlaceData
};

export default SearchController;

