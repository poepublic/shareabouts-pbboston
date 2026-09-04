## 1. Vite + Django Scaffolding

- [x] 1.1 Initialize the Vite project inside `src/sa_admin/`: create `package.json` with `vue`, `@vitejs/plugin-vue`, and `vite` as dependencies
- [x] 1.2 Create `src/sa_admin/vite.config.js` with multi-page entry points (`src/dashboard/main.js`, `src/detail/main.js`), build output to `static/sa_admin/dist/`, and Backbone/jQuery/Underscore marked as external globals via `build.rollupOptions.external`
- [x] 1.3 Add `django-vite` to `app-requirements.txt` and configure it in `src/project/settings.py` (`INSTALLED_APPS`, `DJANGO_VITE` settings block pointing to the manifest in `static/sa_admin/dist/`, with `static_url_prefix: 'sa_admin/dist'`)
- [x] 1.4 Create a minimal "hello world" Vue app with entry point `src/sa_admin/src/dashboard/main.js` and `DashboardApp.vue` that renders a placeholder message
- [x] 1.5 Update `src/sa_admin/templates/sa_admin/base.html` to a thin shell: load Backbone globals as `<script>` tags, inject `window.__SA_BOOTSTRAP__` with config/user/dataset/staticUrl/mapboxToken, and use `django-vite` template tags at the bottom of `<body>` to load Vite assets after global script initialization
- [x] 1.6 Update `src/sa_admin/templates/sa_admin/dashboard.html` to extend the new base and mount the Vue app into `<div id="app">`
- [x] 1.7 Verify the Vite dev server (HMR) works alongside `manage.py runserver`, and that `vite build` + `collectstatic` produces working production assets
- [x] 1.8 Add `static/sa_admin/dist/` to `.gitignore`


## 2. Backbone-to-Vue Composables

- [x] 2.1 Create `src/sa_admin/src/composables/useBackboneCollection.js`: wraps a Backbone Collection in a `shallowRef` containing `[...collection.models]`, listens for `add`, `remove`, `reset`, `change`, `sync` events and reassigns a new models array copy to trigger Vue watchers; cleans up listeners on `onUnmounted`
- [x] 2.2 Create `src/sa_admin/src/composables/useBackboneModel.js`: wraps a Backbone Model in a `shallowRef`, listens for `change`, `sync` events and calls `triggerRef`; cleans up on `onUnmounted`
- [x] 2.3 Create `src/sa_admin/src/composables/useBootstrap.js`: reads `window.__SA_BOOTSTRAP__` and provides typed access to config, currentUser, dataset, staticUrl, and mapboxToken


## 3. Field Config Port

- [x] 3.1 Create `src/sa_admin/src/config/adminFields.js`: port the field definitions from `static/sa_admin/js/admin_config.js`, referencing Vue component names (strings or imports) for `widget` and `filter` instead of the old class references


## 4. Widget Components

- [x] 4.1 Create `src/sa_admin/src/components/widgets/PlaceFieldWidget.vue`: base text input widget that emits a `change` event with `{ column, value }` and supports `syncAttrToWidget` via a prop-driven model value
- [x] 4.2 Create `PlaceFieldReadOnlyWidget.vue`: read-only text input (disabled)
- [x] 4.3 Create `PlaceFieldBooleanWidget.vue`: checkbox widget
- [x] 4.4 Create `PlaceFieldChoiceWidget.vue`: select dropdown widget, rendering options from the column config
- [x] 4.5 Create `PlaceFieldDateTimeWidget.vue`: datetime-local input with UTC↔local conversion
- [x] 4.6 Create `PlaceFieldLongTextWidget.vue`: textarea widget


## 5. Filter Components

- [x] 5.1 Create `src/sa_admin/src/components/filters/PlacesSubstringFilter.vue`: text input filter that emits a `filter` event with a substring-match predicate
- [x] 5.2 Create `PlacesBooleanFilter.vue`: true/false/any toggle filter
- [x] 5.3 Create `PlacesChoiceFilter.vue`: dropdown filter matching against column options
- [x] 5.4 Create `PlacesDateTimeFilter.vue`: date range filter with from/to datetime-local inputs


## 6. Dashboard Components

- [x] 6.1 Create `src/sa_admin/src/components/PlacesTable.vue`: renders a `<table>` with a header row (one cell per field column, each cell rendering its filter component if configured) and body rows (one per place model). Emits `place:mouseover`, `place:mouseout`, `place:click`, and `filter` events. Supports `filterRows()` to show/hide rows based on predicates and `highlightRow()`/`unhighlightRow()` for cross-highlighting
- [x] 6.2 Create `src/sa_admin/src/components/PlacesMap.vue`: renders a Leaflet map with Mapbox GL tile layer and markers for each place. Emits `place:mouseover`, `place:mouseout`, `place:click`, and `place:reveal` events. Supports `filterMarkers()` and `highlightMarker()`/`unhighlightMarker()`
- [x] 6.3 Create `DashboardApp.vue`: composes `PlacesTable` and `PlacesMap`, wires up cross-highlighting and filter synchronization between them, renders filtered/total place counts, clear-filters button, and download CSV buttons (all/filtered using `csv-stringify/browser/esm/sync`). Uses `useBackboneCollection` to observe the `PlaceCollection` and `useBootstrap` for config. Opens place detail in a new tab on click


## 7. Place Detail Components

- [x] 7.1 Create `src/sa_admin/src/components/PlaceMap.vue`: renders a Leaflet map centered on the place's geometry with a draggable marker. Emits `marker:move` with new lat/lng. Supports click-to-reposition via popup button
- [x] 7.2 Create `src/sa_admin/src/components/PlaceForm.vue`: renders the map component and a list of field widgets (resolved from the field config's `widget` key). Manages undo/redo buffers, save button state, and calls `place.save()` via Backbone. Listens for Ctrl+Z/Ctrl+Y keyboard shortcuts
- [x] 7.3 Create `PlaceDetailApp.vue`: mounts `PlaceForm` for a single place model. Uses `useBackboneModel` to observe the place. Fetches the place via `place.fetch()` on mount
- [x] 7.4 Update `src/sa_admin/templates/sa_admin/place_detail.html` to extend the new base shell and mount `PlaceDetailApp` into `<div id="app">`, passing the `place_id` via `window.__SA_BOOTSTRAP__`


## 8. Cleanup and Verification

- [x] 8.1 Remove the old JS files: `static/sa_admin/js/component.js`, `admin_config.js`, `filter_predicates.js`, `formatters.js`, `place_detail.js`, `place_field_widget.js`, `places_dashboard.js`, `places_filter.js`, `places_map.js`, `places_table.js`
- [x] 8.2 Verify dashboard: page loads, table renders with all places, column filters work, map markers render and filter, cross-highlighting between table and map, CSV download (all and filtered), clicking a place opens detail in new tab
- [x] 8.3 Verify place detail: page loads, form renders with current model values, field edits update the model, undo/redo works (buttons and keyboard shortcuts), map marker is draggable, save persists to API, save-error displays a notification
- [x] 8.4 Verify Vite production build: `npm run build` in `src/sa_admin/` produces assets in `static/sa_admin/dist/`, `collectstatic` collects them, pages load correctly from built assets


## 9. Documentation and Deployment Updates

- [x] 9.1 Update `Dockerfile` to build the Vite frontend (`npm install && npm run build` inside `src/sa_admin`) before `collectstatic`.
- [x] 9.2 Update `doc/README.md` to document running the Vite dev server (`npm run dev`) alongside Django's `runserver` for local development.

