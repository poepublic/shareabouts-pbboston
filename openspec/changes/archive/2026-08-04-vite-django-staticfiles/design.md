## Context

See proposal.md for motivation. The current state has sa_admin's Vue source files at `src/sa_admin/static/sa_admin/` following Django's `AppDirectoriesFinder` convention (`<app>/static/<app>/...`). The previous per-app vite config (`src/sa_admin/vite.config.js`) has been deleted and a root-level `vite.config.js` has been started but needs updating. The root `package.json` already has vite and vue dependencies.

Django's `AppDirectoriesFinder` resolves static paths by scanning each installed app's `static/` subdirectory. For example, `{% static 'sa_admin/dashboard/main.js' %}` finds `src/sa_admin/static/sa_admin/dashboard/main.js`. The vite plugin replicates this same logic on the JS side.

## Goals / Non-Goals

**Goals:**
- Single `npm run dev` / `npm run build` for all vite-managed apps
- Import resolution that mirrors Django's `AppDirectoriesFinder` so cross-app imports use clean static paths
- Manifest keys that work directly with `{% vite_asset %}` template tags
- Adding a new app requires only adding an `input` entry to `vite.config.js`

**Non-Goals:**
- Porting sa_web from Grunt to Vite (future work)
- Replicating `FileSystemFinder` or `STATICFILES_DIRS` in the plugin (only `AppDirectoriesFinder` logic)
- Auto-discovering entry points (they remain manually listed in `rollupOptions.input`)
- A Django management command to start vite alongside `runserver`

## Decisions

### Decision: Implement as a vite plugin with a separate helper function

The `djangoStaticFiles()` function returns a vite plugin object with a `resolveId` hook for runtime import resolution and a `generateBundle` hook for manifest key rewriting. A separate synchronous `djangoStatic()` function (not a plugin) resolves paths for use in the `input` config, since `rollupOptions.input` needs absolute paths at config time, before any plugin hooks run.

Both share the same core resolution logic: scan `<srcDir>/*/static/` directories at startup and build a lookup map.

**Alternatives considered:**
- **Static `resolve.alias` entries** — simpler but requires manually adding an alias per app, doesn't handle manifest rewriting, and doesn't compose as cleanly.
- **Django management command** that generates the vite config — adds Python/JS coupling and requires Django to be running for vite to work. Deferred as a possible future convenience.

### Decision: Resolution algorithm mirrors AppDirectoriesFinder

The resolution algorithm:
1. At startup, scan `<root>/*/static/` for directories (where `<root>` is vite's configured `root`, i.e., `src/`).
2. Build a map: for each app directory `<app>` that contains a `static/` subdirectory, register `<root>/<app>/static/` as a static files search path.
3. When resolving an import specifier (e.g., `sa_admin/composables/useBackboneModel.js`), iterate through the search paths and check if `<searchPath>/<specifier>` exists on the filesystem.
4. Return the first match as an absolute path, or `null` to fall through to vite's default resolution.

This matches Django's `AppDirectoriesFinder` behavior: it searches each app's `static/` directory in the order apps are found. The scan happens once at config time and is cached.

In the Vite dev server, `resolveId` receives module paths after the `base` prefix has been stripped. These paths have a leading `/` (e.g., `/sa_admin/dashboard/main.js`). The plugin strips the leading slash before applying the search algorithm. It only skips resolution for paths that are absolute filesystem paths pointing to existing files.

### Decision: Manifest key rewriting via generateBundle hook

Vite generates manifest keys as paths relative to `root`. With `root: 'src'`, a source file at `src/sa_admin/static/sa_admin/dashboard/main.js` gets the manifest key `sa_admin/static/sa_admin/dashboard/main.js`. This doesn't match what `{% vite_asset 'sa_admin/dashboard/main.js' %}` looks up.

The plugin uses the `generateBundle` hook to rewrite manifest keys. For any entry whose key contains a `/static/` segment from a recognized app directory, the key is rewritten to strip the `<app>/static/` prefix. So:

```
sa_admin/static/sa_admin/dashboard/main.js  →  sa_admin/dashboard/main.js
sa_vote/static/sa_vote/main.js              →  sa_vote/main.js
```

Internal references within the manifest (e.g., `imports` arrays, `css` arrays) point to output filenames which are not affected — they're already hashed asset names.

### Decision: Shared output directory at `src/static/dist/`

All vite-built assets go to `src/static/dist/`. Django discovers them via `STATICFILES_DIRS = [abspath(pathjoin(dirname(__file__), '..', 'static'))]`, making the built files available at `dist/...` in the static namespace.

`DJANGO_VITE` configuration:
```python
DJANGO_VITE = {
    'default': {
        'dev_mode': DEBUG,
        'dev_server_host': 'localhost',
        'dev_server_port': 5173,
        'static_url_prefix': 'dist',
        'manifest_path': abspath(pathjoin(
            dirname(__file__), '..', 'static', 'dist', '.vite', 'manifest.json'
        )),
    }
}
```

**Why not keep per-app output dirs?** A single manifest per vite build is simpler, avoids needing multiple `DJANGO_VITE` config keys, and naturally deduplicates shared chunks across apps.

### Decision: Plugin file location

The plugin lives at `src/vite-plugin-django-staticfiles.js` — next to `vite.config.js`'s root (`src/`) and clearly labeled as a vite plugin.

### Decision: vite.config.js settings

```
root:    resolve(__dirname, 'src')
base:    '/static/dist/'
outDir:  resolve(__dirname, 'src/static/dist')
```

- `root` is `src/` so vite's dev server and file watcher cover all app source.
- `base` is `/static/dist/` matching the URL path Django serves built assets at.
- `outDir` is `src/static/dist/` which Django discovers via `STATICFILES_DIRS`.

## Risks / Trade-offs

- **Stale directory scan**: The plugin scans `src/*/static/` once at startup. If a new app is added while the dev server is running, a restart is needed. This is acceptable since adding an app also requires adding an `input` entry.
- **sa_web static path inconsistency**: `sa_web` doesn't use the `sa_web/static/sa_web/...` nesting pattern — its files are at `sa_web/static/js/...`, `sa_web/static/css/...`. The plugin would resolve `js/models.js` from sa_web's static dir, which could collide with other apps. This is a known issue deferred to the sa_web port, which will namespace its static files.
- **External Leaflet**: The existing `rollupOptions.external: ['leaflet']` and `output.globals: { leaflet: 'L' }` remain — Leaflet is loaded via CDN in the Django templates.
