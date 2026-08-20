## Purpose

Provides a vite plugin and helper that resolve JavaScript imports and build entry points using the same directory-scanning convention as Django's AppDirectoriesFinder, enabling cross-app imports with clean static paths and django_vite-compatible manifest keys.

## ADDED Requirements

### Requirement: Plugin resolves imports using Django static file conventions
The plugin SHALL resolve bare import specifiers by scanning `<srcDir>/<app>/static/` directories for each Django app found under the configured source root. When an import path like `sa_vote/models.js` is encountered, the plugin SHALL search each app's `static/` directory for a matching file and return the absolute filesystem path.

#### Scenario: Resolve an import within the same app
- **WHEN** a source file in `sa_admin/static/sa_admin/dashboard/main.js` imports from `sa_admin/composables/useBackboneModel.js`
- **THEN** the plugin SHALL resolve the import to the absolute path of `<srcDir>/sa_admin/static/sa_admin/composables/useBackboneModel.js`

#### Scenario: Resolve a cross-app import
- **WHEN** a source file in `sa_admin/static/sa_admin/dashboard/main.js` imports from `sa_vote/models.js`
- **THEN** the plugin SHALL resolve the import to the absolute path of `<srcDir>/sa_vote/static/sa_vote/models.js`

#### Scenario: Import path not found in any static directory
- **WHEN** the plugin encounters an import specifier that does not match any file under any app's `static/` directory
- **THEN** the plugin SHALL return null, allowing vite's default resolution to handle it (e.g., for `node_modules` imports like `vue`)

#### Scenario: Resolve a dev server request path with leading slash
- **WHEN** the Vite dev server strips the configured `base` from a request URL and passes a path like `/sa_admin/dashboard/main.js` to the plugin's `resolveId` hook
- **THEN** the plugin SHALL strip the leading `/` and resolve the remaining path using the same static directory scanning logic, returning the absolute path of `<srcDir>/sa_admin/static/sa_admin/dashboard/main.js`

### Requirement: Helper function resolves entry point paths
A `djangoStatic()` helper function SHALL be available for use in the vite config's `rollupOptions.input` to resolve entry point paths using the same static directory scanning logic as the plugin.

#### Scenario: Resolve an entry point path
- **WHEN** the vite config specifies `djangoStatic('sa_admin/dashboard/main.js')` as an input entry point
- **THEN** the function SHALL return the absolute filesystem path `<srcDir>/sa_admin/static/sa_admin/dashboard/main.js`

#### Scenario: Entry point path not found
- **WHEN** `djangoStatic()` is called with a path that does not match any file under any app's `static/` directory
- **THEN** the function SHALL throw an error indicating the file could not be found

### Requirement: Plugin rewrites manifest keys to Django static paths
The plugin SHALL rewrite vite manifest entry keys from filesystem-relative paths to Django-style static paths. The manifest key for a source file at `<app>/static/<staticPath>` SHALL be `<staticPath>`.

#### Scenario: Manifest key for an entry point
- **WHEN** vite builds an entry point located at `sa_admin/static/sa_admin/dashboard/main.js` (relative to root)
- **THEN** the manifest key for that entry SHALL be `sa_admin/dashboard/main.js`

#### Scenario: Manifest keys are compatible with django_vite template tags
- **WHEN** a Django template uses `{% vite_asset 'sa_admin/dashboard/main.js' %}`
- **THEN** the manifest key SHALL match, allowing django_vite to find the corresponding built asset
