## Why

The sa_admin Vue app was developed with its own isolated vite setup (`src/sa_admin/package.json`, `src/sa_admin/vite.config.js`), separate from the rest of the project's build tooling. As additional vite-built apps are added (sa_vote, and eventually porting sa_web), each app shouldn't need its own vite config and dev server. A single `npm run dev` should build all apps, and the source/import resolution should follow the same conventions Django uses for static files.

## What Changes

- Create a custom vite plugin (`djangoStaticFiles`) that resolves JS/Vue imports using the same algorithm as Django's `AppDirectoriesFinder` — scanning `src/*/static/` directories to resolve bare imports like `import { Model } from 'sa_vote/models.js'`.
- The plugin also rewrites vite manifest keys from filesystem-relative paths to Django static paths (e.g., `sa_admin/dashboard/main.js` instead of `sa_admin/static/sa_admin/dashboard/main.js`), so `{% vite_asset %}` template tags work with clean static paths.
- Provide a `djangoStatic()` helper function for use in `rollupOptions.input` to resolve entry points using the same logic.
- Move from the current per-app vite config to a single root-level `vite.config.js` with `root: 'src'`, `base: '/static/dist/'`, and `outDir: 'src/static/dist'`.
- Update Django's `STATICFILES_DIRS` to include `src/static/` so built output is discoverable by `collectstatic`.
- Update `DJANGO_VITE` settings to point to the unified output directory and manifest.
- Update `{% vite_asset %}` template tag paths to match the new manifest keys.

## Capabilities

### New Capabilities
- `vite-staticfiles-plugin`: A vite plugin that resolves imports using Django's static file conventions, and a helper for resolving entry points in vite config. Includes manifest key rewriting for django_vite compatibility.

### Modified Capabilities
- `vue-admin-ui`: The "Vite-built assets are served by Django" requirement changes — assets are now built to a shared output directory (`src/static/dist/`) via the root-level vite config instead of a per-app config, and the manifest/template integration paths change accordingly.

## Impact

- **Build config**: `vite.config.js` at project root replaces the deleted `src/sa_admin/vite.config.js`. Entry points now reference source files via the `djangoStatic()` helper.
- **Django settings**: `STATICFILES_DIRS` gains `src/static/`. `DJANGO_VITE['default']` updates `static_url_prefix` and `manifest_path` to the new shared location.
- **Templates**: `{% vite_asset %}` paths in `sa_admin/dashboard.html` and `sa_admin/place_detail.html` may need updating depending on how manifest keys are generated.
- **Dependencies**: No new npm dependencies (the plugin is local). No new Python dependencies.
- **Future apps**: Any new Django app following the `<app>/static/<app>/...` convention automatically participates in the vite resolution — just add an input entry to `vite.config.js`.
