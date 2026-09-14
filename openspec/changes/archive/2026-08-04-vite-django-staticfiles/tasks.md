## 1. Create the vite plugin

- [x] 1.1 Create `src/vite-plugin-django-staticfiles.js` with the core resolution logic: scan `<root>/*/static/` directories, build a search path list, and export a `findStaticFile(specifier)` function that checks each search path for a matching file
- [x] 1.2 Export a `djangoStatic(staticPath)` function that uses `findStaticFile` to resolve a static path to an absolute filesystem path, throwing an error if not found
- [x] 1.3 Export a `djangoStaticFiles()` function that returns a vite plugin with a `resolveId` hook that calls `findStaticFile` for bare import specifiers and returns the absolute path (or null to fall through)
- [x] 1.4 Add a `generateBundle` hook to the plugin that rewrites manifest keys — for any key matching `<app>/static/<rest>`, rewrite to `<rest>`
- [x] 1.5 Update the `resolveId` hook to handle dev server paths: strip the leading `/` from paths that aren't existing absolute filesystem paths before calling `findStaticFile`, so that dev server requests (e.g., `/sa_admin/dashboard/main.js` after base stripping) resolve correctly

## 2. Update vite.config.js

- [x] 2.1 Import `djangoStaticFiles` and `djangoStatic` from `src/vite-plugin-django-staticfiles.js`
- [x] 2.2 Add the `djangoStaticFiles()` plugin alongside the existing `vue()` plugin
- [x] 2.3 Update `root` to `resolve(__dirname, 'src')`
- [x] 2.4 Update `base` to `'/static/dist/'`
- [x] 2.5 Update `build.outDir` to `resolve(__dirname, 'src/static/dist')`
- [x] 2.6 Update `rollupOptions.input` to use `djangoStatic()` for entry points: `{ 'sa_admin-dashboard': djangoStatic('sa_admin/dashboard/main.js'), 'sa_admin-detail': djangoStatic('sa_admin/detail/main.js') }`
- [x] 2.7 Keep `rollupOptions.external: ['leaflet']` and `output.globals: { leaflet: 'L' }`

## 3. Update Django settings

- [x] 3.1 Add `src/static/` to `STATICFILES_DIRS` in `src/project/settings.py`
- [x] 3.2 Update `DJANGO_VITE['default']['static_url_prefix']` to `'dist'`
- [x] 3.3 Update `DJANGO_VITE['default']['manifest_path']` to point to `src/static/dist/.vite/manifest.json`

## 4. Update Django templates

- [x] 4.1 Update `{% vite_asset %}` paths in `src/sa_admin/templates/sa_admin/dashboard.html` to use the new manifest key format (`sa_admin/dashboard/main.js`)
- [x] 4.2 Update `{% vite_asset %}` paths in `src/sa_admin/templates/sa_admin/place_detail.html` to use the new manifest key format (`sa_admin/detail/main.js`)

## 5. Cleanup and add output directory to .gitignore

- [x] 5.1 Remove the stale `src/sa_admin/node_modules/` directory
- [x] 5.2 Remove the old built output at `src/sa_admin/static/sa_admin/dist/`
- [x] 5.3 Add `src/static/dist/` to `.gitignore`

## 6. Verify

- [x] 6.1 Run `npm run build` and confirm assets are written to `src/static/dist/` with a valid manifest
- [x] 6.2 Confirm manifest keys use Django static paths (e.g., `sa_admin/dashboard/main.js`, not `sa_admin/static/sa_admin/dashboard/main.js`)
- [x] 6.3 Run the vite dev server (`npm run dev`) and confirm HMR works with Django's `runserver`
