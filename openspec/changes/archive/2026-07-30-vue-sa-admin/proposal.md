## Why

The `sa_admin` front-end uses a custom `Component` class with manual DOM manipulation (`innerHTML` wipe-and-rebuild, imperative event listener tracking). This approach lacks DOM diffing, loses input focus/state on re-render, requires verbose glue code for every interaction, and is harder for contributors to onboard to since it's a bespoke pattern. Switching to Vue 3 provides reactive data binding, virtual DOM diffing, a well-known component model, and a mature ecosystem — making the admin UI more robust and more collaborative to develop.

## What Changes

- **Replace the custom `Component` class hierarchy** (`Component`, `PlacesDashboard`, `PlacesTable`, `PlacesMap`, `PlaceDetail`, `PlaceForm`, `PlaceFieldWidget` variants, `PlacesFilter` variants) with Vue 3 Single-File Components.
- **Introduce Vite** as the build tool for `sa_admin`, replacing the current zero-build ESM setup. Vite output goes to `src/sa_admin/static/sa_admin/dist/` so `collectstatic` picks it up via Django's `AppDirectoriesFinder`.
- **Add `django-vite`** for dev/prod asset manifest integration, enabling HMR during development. Set `static_url_prefix: 'sa_admin/dist'` in Django settings and `server.cors: true` in Vite to align asset paths and enable cross-origin dev requests.
- **Create a Backbone-to-Vue reactivity bridge** (`useBackboneCollection`, `useBackboneModel` composables) returning `shallowRef` copies of models array (`[...collection.models]`), ensuring Vue watchers and computed properties detect reference changes when Backbone updates asynchronously.
- **Keep Django-side routing and auth unchanged**: Django continues to serve thin shell templates (one per page: dashboard, place detail), inject bootstrap data via `window.__SA_BOOTSTRAP__`, and load Backbone + dependencies as global `<script>` tags.
- **Preserve the existing Backbone models and collections** (`Shareabouts.PlaceCollection`, `Shareabouts.PlaceModel`) as the data layer. No Backbone modernization in this change.
- **Design Vue components with extension points** (slots, provide/inject, component registration) to support per-deployment customization (flavors).

## Capabilities

### New Capabilities
- `vue-admin-ui`: Vue 3 component tree for the admin interface (dashboard with table/map/filters, place detail with form/map/undo-redo), Backbone reactivity bridge composables, and Vite build integration with Django.

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **`src/sa_admin/`**: All JS files in `static/sa_admin/js/` are replaced by Vue SFC source under a new `src/` directory within the Vite project. Templates in `templates/sa_admin/` become thin shells that mount Vue apps.
- **Build tooling**: A new `vite.config.js` and `package.json` are added inside `src/sa_admin/`. The project-root `package.json` (Grunt-based, for `sa_web`) is unaffected.
- **Django config**: `django-vite` is added to `INSTALLED_APPS` and configured in settings. A new `DJANGO_VITE` settings block is needed.
- **Dependencies**: Vue 3, Vite, and `django-vite` are added. No changes to Backbone, jQuery, Leaflet, or Mapbox GL.
- **Deployment**: `vite build` must run before `collectstatic` in the deploy pipeline, which requires updating the `Dockerfile` to build the Vite app. The existing Grunt build for `sa_web` is unaffected.
- **Documentation**: `doc/README.md` must be updated to instruct developers to run the Vite dev server alongside the Django server when working on the admin UI.
- **Flavor extensibility**: Per-deployment admin customization shifts from Django template overrides to Vue component registration and slot overrides — this is a change in mechanism, not a removal of capability. Full slot/composition coverage will be layered in over time.
