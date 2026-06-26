To make this codebase easier to maintain and scale, apply the following structural refactoring strategies:

1. Decouple UI Rendering from Business Logic
Currently, files like hud.js, markers.js, and routing.js generate complex UI layouts by injecting large, hardcoded HTML strings into the DOM via innerHTML.

Fix: Move structural markup into <template> tags within index.html or adopt native Web Components for self-contained UI modules (e.g., <search-results>, <place-details>). This isolates Tailwind class management from logical JavaScript state flows.

2. Implement a Unified Map Service (Facade Pattern)
Multiple modules directly access and manipulate the global state.map instance to append layers, alter sources, or adjust visibility properties. If you ever switch mapping libraries or require advanced style transitions, you will have to fix breakages across every file.

Fix: Abstract all MapLibre GL interaction behind a centralized MapService layer. Individual modules should only interact via generic method contracts:

```JavaScript
// Example abstraction contract
MapService.addGeoJsonSource(id, data);
MapService.toggleLayerVisibility(id, visible);
MapService.flyToCoordinates(lng, lat, zoom);
```

3. Centralize API Network Requests
API routing paths and coordinate parsing payloads (Nominatim, Wikipedia, Overpass, and OSRM) are declared inline inside orchestration routines like loadPoiAndPathDetails in app.js and calculateRoute in routing.js.

Fix: Isolate asynchronous transactions inside a dedicated ApiService.js class. This groups endpoint definitions, network exception handling, timeouts, and payload serialization steps into a unified location.

4. Group Features into Contextual Modules
app.js functions as a catch-all orchestration file containing heavy asynchronous logic blocks and cross-cutting view states.

Fix: Transition from functional scripting modules into structured classes or feature packages. Group state definitions directly with their corresponding logic context rather than exposing them all in a singular global object within state.js. For instance, bundle measurement controls, measurement nodes, and linear calculations together into an encapsulated MeasurementController instance.

5. Remove Stale CSS Code
style.css contains leftover overrides targeting Leaflet UI nodes (e.g., .leaflet-top, .leaflet-bar, and .leaflet-popup) that are obsolete since the engine migrated to MapLibre GL JS. Drop these unused selectors to ensure the stylesheet stays clean.