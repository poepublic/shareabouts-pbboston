/**
 * Vite plugin that resolves JavaScript imports using the same directory-scanning
 * convention as Django's AppDirectoriesFinder. Also rewrites Vite manifest keys
 * so they match the paths used by django_vite's `{% vite_asset %}` template tag.
 *
 * Django's AppDirectoriesFinder looks for static files by scanning each installed
 * app's `static/` subdirectory. For example, the static path
 * `sa_admin/dashboard/main.js` resolves to the file at
 * `srcDir/sa_admin/static/sa_admin/dashboard/main.js`.
 *
 * This plugin replicates that logic on the JS/Vite side so that:
 * - Bare imports like `import X from 'sa_admin/composables/foo.js'` resolve
 *   through the same search paths.
 * - Entry points in `rollupOptions.input` can use the `djangoStatic()` helper
 *   to resolve clean static paths to absolute filesystem paths.
 * - Manifest keys are rewritten from filesystem-relative paths (e.g.,
 *   `sa_admin/static/sa_admin/dashboard/main.js`) to Django static paths (e.g.,
 *   `sa_admin/dashboard/main.js`).
 *
 * @module vite-plugin-django-staticfiles
 */

import fs from 'fs';
import path from 'path';

let cachedSearchPaths = null;
let cachedRootDir = null;

/**
 * Scan `rootDir/[app]/static/` to build a list of static file search paths,
 * mirroring Django's AppDirectoriesFinder. Results are cached per rootDir.
 *
 * For a project laid out as:
 *   src/sa_admin/static/...
 *   src/sa_web/static/...
 *
 * This returns:
 *   `['/abs/path/src/sa_admin/static', '/abs/path/src/sa_web/static']`
 *
 * @param {string} [rootDir] - The source root to scan. Defaults to `cwd/src`.
 * @returns {string[]} Absolute paths to each app's `static/` directory.
 */
export function getStaticSearchPaths(rootDir) {
  const resolvedRoot = rootDir ? path.resolve(rootDir) : path.resolve(process.cwd(), 'src');
  if (cachedSearchPaths && cachedRootDir === resolvedRoot) {
    return cachedSearchPaths;
  }

  const searchPaths = [];
  if (fs.existsSync(resolvedRoot) && fs.statSync(resolvedRoot).isDirectory()) {
    const entries = fs.readdirSync(resolvedRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const staticDir = path.join(resolvedRoot, entry.name, 'static');
        if (fs.existsSync(staticDir) && fs.statSync(staticDir).isDirectory()) {
          searchPaths.push(staticDir);
        }
      }
    }
  }

  cachedRootDir = resolvedRoot;
  cachedSearchPaths = searchPaths;
  return searchPaths;
}

/**
 * Search each app's `static/` directory for a file matching the given specifier.
 *
 * For example, `findStaticFile('sa_admin/dashboard/main.js')` checks each
 * search path for `searchPath/sa_admin/dashboard/main.js` and returns the
 * first match as an absolute path, or `null` if not found.
 *
 * @param {string} specifier - A Django-style static path (e.g., `sa_admin/dashboard/main.js`).
 * @param {string} [rootDir] - The source root to scan. Passed to `getStaticSearchPaths`.
 * @returns {string|null} Absolute filesystem path to the matched file, or `null`.
 */
export function findStaticFile(specifier, rootDir) {
  const searchPaths = getStaticSearchPaths(rootDir);
  for (const searchPath of searchPaths) {
    const candidate = path.resolve(searchPath, specifier);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

/**
 * Resolve a Django static path to an absolute filesystem path, throwing if
 * not found. Intended for use in `rollupOptions.input` where entry points
 * must be absolute paths at config time (before plugin hooks run).
 *
 * @example
 * // vite.config.js
 * input: {
 *   'sa_admin-dashboard': djangoStatic('sa_admin/dashboard/main.js'),
 * }
 *
 * @param {string} staticPath - A Django-style static path.
 * @param {string} [rootDir] - The source root to scan.
 * @returns {string} Absolute filesystem path.
 * @throws {Error} If the path cannot be found in any app's `static/` directory.
 */
export function djangoStatic(staticPath, rootDir) {
  const resolved = findStaticFile(staticPath, rootDir);
  if (!resolved) {
    throw new Error(`Could not resolve Django static file "${staticPath}" in any app static directory.`);
  }
  return resolved;
}

/**
 * Rewrite manifest keys from filesystem-relative paths to Django static paths.
 *
 * Vite generates manifest keys relative to `root`. With `root: 'src'`, a file
 * at `src/sa_admin/static/sa_admin/dashboard/main.js` gets the key
 * `sa_admin/static/sa_admin/dashboard/main.js`. Django's `{% vite_asset %}`
 * expects `sa_admin/dashboard/main.js`. This function strips the
 * `app/static/` prefix from each key (and the `src` field) to bridge that
 * gap.
 *
 * @param {Object} manifest - Parsed Vite manifest JSON object.
 * @returns {Object} New manifest with rewritten keys.
 */
function rewriteManifestObject(manifest) {
  const newManifest = {};
  for (const [key, value] of Object.entries(manifest)) {
    const rewrittenKey = key.replace(/^[^/]+\/static\//, '');
    if (value && typeof value === 'object' && value.src) {
      value.src = value.src.replace(/^[^/]+\/static\//, '');
    }
    newManifest[rewrittenKey] = value;
  }
  return newManifest;
}

/**
 * Read the manifest file(s) from the build output directory on disk and
 * rewrite their keys in place. This is a fallback for cases where the
 * in-memory `generateBundle` rewrite didn't apply (e.g., Vite writes the
 * manifest after the plugin's `generateBundle` hook runs).
 *
 * @param {string} outDir - Absolute path to the build output directory.
 */
function rewriteManifestOnDisk(outDir) {
  const possiblePaths = [
    path.resolve(outDir, '.vite', 'manifest.json'),
    path.resolve(outDir, 'manifest.json'),
  ];
  for (const manifestPath of possiblePaths) {
    if (fs.existsSync(manifestPath)) {
      try {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(content);
        const rewritten = rewriteManifestObject(manifest);
        fs.writeFileSync(manifestPath, JSON.stringify(rewritten, null, 2), 'utf-8');
      } catch (err) {
        // Ignore error
      }
    }
  }
}

/**
 * Create a Vite plugin that resolves imports using Django's static file
 * conventions and rewrites manifest keys for django_vite compatibility.
 *
 * The plugin provides three hooks:
 * - `resolveId`: Resolves bare and slash-prefixed import specifiers by
 *   searching each app's `static/` directory. In the dev server, Vite strips
 *   the `base` prefix from request URLs and passes the remaining path (with
 *   a leading `/`) to this hook. The plugin strips the slash and searches
 *   the static directories. Already-resolved absolute paths that exist on
 *   disk are passed through unchanged.
 * - `generateBundle`: Rewrites manifest keys in the in-memory bundle before
 *   Vite writes them to disk.
 * - `closeBundle`: Rewrites manifest keys on disk as a fallback, since Vite
 *   may write the manifest after `generateBundle` completes.
 *
 * @param {Object} [options]
 * @param {string} [options.rootDir] - Override the source root directory.
 *   Defaults to Vite's resolved `config.root`.
 * @returns {import('vite').Plugin} A Vite plugin object.
 */
export function djangoStaticFiles(options = {}) {
  let rootDir = options.rootDir;
  let outDir = null;

  return {
    name: 'django-staticfiles',
    enforce: 'post',
    configResolved(config) {
      if (!rootDir) {
        rootDir = config.root;
      }
      outDir = config.build.outDir;
    },
    resolveId(source) {
      // Skip paths that are already resolved to existing filesystem locations
      // (e.g., by another plugin or Vite's own resolution).
      if (path.isAbsolute(source) && fs.existsSync(source)) {
        return null;
      }
      // Skip relative imports — let Vite handle those normally.
      if (source.startsWith('.')) {
        return null;
      }
      // In the dev server, Vite strips the `base` prefix from request URLs and
      // passes the rest (e.g., `/sa_admin/dashboard/main.js`) to resolveId.
      // Strip the leading slash so we can search the static directories.
      const specifier = source.startsWith('/') ? source.slice(1) : source;
      const matched = findStaticFile(specifier, rootDir);
      if (matched) {
        return matched;
      }
      return null;
    },
    generateBundle(options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (fileName.endsWith('manifest.json')) {
          const manifestAsset = bundle[fileName];
          if (manifestAsset && manifestAsset.type === 'asset' && typeof manifestAsset.source === 'string') {
            try {
              const manifest = JSON.parse(manifestAsset.source);
              manifestAsset.source = JSON.stringify(rewriteManifestObject(manifest), null, 2);
            } catch (err) {
              // Ignore JSON parse errors
            }
          }
        }
      }
    },
    closeBundle() {
      if (outDir) {
        rewriteManifestOnDisk(outDir);
      }
    }
  };
}
