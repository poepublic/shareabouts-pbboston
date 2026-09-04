## Purpose

Defines the observable behavior of the Vue 3-based admin interface for Shareabouts, including the dashboard (places table, map, and filters), the place detail editor (form, map, undo/redo), the Backbone-to-Vue reactivity bridge, and the Vite-to-Django build integration.

## ADDED Requirements

### Requirement: Dashboard displays places in a filterable table
The admin dashboard SHALL render all places from the Backbone PlaceCollection in a table. Each row SHALL display the configured field columns. The table SHALL support per-column filtering. When filters are applied, the table SHALL show only matching rows, and the dashboard SHALL display the filtered count alongside the total count.

#### Scenario: All places shown on initial load
- **WHEN** the dashboard page loads and all place data has been fetched
- **THEN** the table SHALL display one row per place model in the collection and the count SHALL show the total number of places

#### Scenario: Filtering by a column value
- **WHEN** the user applies a filter on a column
- **THEN** only rows matching the filter predicate SHALL be visible in the table and the filtered count SHALL update to reflect the number of matching places

#### Scenario: Clearing filters
- **WHEN** the user clicks the clear filters button
- **THEN** all column filters SHALL be reset and all rows SHALL be visible again

### Requirement: Dashboard displays places on a map
The admin dashboard SHALL render place markers on a Leaflet/Mapbox GL map. Markers SHALL reflect the same filter state as the table — when filters are applied, only matching place markers SHALL be shown.

#### Scenario: Map reflects table filters
- **WHEN** the user applies a filter in the table
- **THEN** the map SHALL show markers only for places that match the filter

### Requirement: Dashboard cross-highlights between table and map
The dashboard SHALL cross-highlight between the table and the map. Hovering a row SHALL highlight the corresponding map marker and vice versa.

#### Scenario: Hover a table row
- **WHEN** the user hovers over a table row
- **THEN** the corresponding map marker SHALL be visually highlighted

#### Scenario: Hover a map marker
- **WHEN** the user hovers over a map marker
- **THEN** the corresponding table row SHALL be visually highlighted

### Requirement: Dashboard supports CSV download
The dashboard SHALL allow the user to download all places or only filtered places as a CSV file.

#### Scenario: Download all places
- **WHEN** the user clicks the download-all button
- **THEN** a CSV file SHALL be downloaded containing all places with their configured field values and coordinates

#### Scenario: Download filtered places
- **WHEN** filters are applied and the user clicks the download-filtered button
- **THEN** a CSV file SHALL be downloaded containing only the places matching the current filters

### Requirement: Place detail page displays an editable form
The place detail page SHALL display a form with one widget per configured field. Each widget type SHALL match the field's configuration (text input, boolean checkbox, select dropdown, datetime picker, long text area, or read-only display).

#### Scenario: Form renders with current model values
- **WHEN** the place detail page loads and the place model has been fetched
- **THEN** each widget SHALL display the current value of its corresponding model attribute

### Requirement: Place detail page supports undo and redo
The place detail form SHALL support undo and redo of field value changes. Undo SHALL revert to the previous value, redo SHALL reapply the reverted change.

#### Scenario: Undo a field change
- **WHEN** the user changes a field value and then clicks undo
- **THEN** the field SHALL revert to its previous value and the model attribute SHALL be updated accordingly

#### Scenario: Redo after undo
- **WHEN** the user undoes a change and then clicks redo
- **THEN** the field SHALL be restored to the value it had before the undo

### Requirement: Place detail page displays a draggable map marker
The place detail page SHALL display the place's location on a map with a draggable marker. Moving the marker SHALL update the place model's geometry.

#### Scenario: Drag marker to new position
- **WHEN** the user drags the marker to a new position
- **THEN** the place model's geometry coordinates SHALL be updated to the new position

### Requirement: Place detail page saves changes to the API
The place detail form SHALL include a save button that persists changes to the Shareabouts API via the Backbone model's save method.

#### Scenario: Save succeeds
- **WHEN** the user clicks save and the API returns success
- **THEN** the save button SHALL become disabled (indicating no unsaved changes)

#### Scenario: Save fails
- **WHEN** the user clicks save and the API returns an error
- **THEN** the user SHALL be notified of the failure and the save button SHALL remain enabled

### Requirement: Vue components reactively observe Backbone models
Vue components SHALL observe Backbone Model and Collection events (add, remove, reset, change, sync) and reactively update the rendered UI when those events fire. The Backbone model SHALL remain the single source of truth for data.

#### Scenario: Backbone collection add triggers re-render
- **WHEN** a new model is added to the Backbone collection
- **THEN** Vue components observing that collection SHALL re-render to include the new model

#### Scenario: Backbone model attribute change triggers re-render
- **WHEN** a Backbone model attribute is changed via `model.set()`
- **THEN** Vue components observing that model SHALL re-render to reflect the updated attribute

### Requirement: Vite-built assets are served by Django
The Vite build output SHALL be placed in a location that Django's `collectstatic` discovers via `AppDirectoriesFinder`. In development, HMR SHALL be supported via the Vite dev server alongside Django's `runserver`.

#### Scenario: Production build
- **WHEN** `vite build` is run followed by `manage.py collectstatic`
- **THEN** the built Vue application assets SHALL be collected into `STATIC_ROOT` and served by Django at the configured `STATIC_URL`

#### Scenario: Development with HMR
- **WHEN** the Vite dev server is running alongside Django's `runserver`
- **THEN** changes to Vue SFC files SHALL be hot-reloaded in the browser without a full page refresh

### Requirement: Django templates inject bootstrap data for Vue
Django templates SHALL inject the Shareabouts configuration and authentication context as a global JavaScript variable (`window.__SA_BOOTSTRAP__`) so that Vue components can access it without additional API calls.

#### Scenario: Bootstrap data available to Vue app
- **WHEN** a Django-rendered admin page loads
- **THEN** `window.__SA_BOOTSTRAP__` SHALL contain the Shareabouts config, current user info, dataset root URL, static URL, and Mapbox token

### Requirement: Place detail opens in a new browser tab
Clicking a place in the dashboard table or map SHALL open the place detail page in a new browser tab or window, allowing the user to have multiple detail pages open simultaneously.

#### Scenario: Open place detail from dashboard
- **WHEN** the user clicks a place row in the table or a place marker on the map
- **THEN** the place detail page SHALL open in a new browser tab
