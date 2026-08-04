## MODIFIED Requirements

### Requirement: Vite-built assets are served by Django
The Vite build output SHALL be placed in a shared output directory (`src/static/dist/`) that Django discovers via `FileSystemFinder` using `STATICFILES_DIRS`. A single root-level `vite.config.js` SHALL build all vite-managed apps. In development, HMR SHALL be supported via a single Vite dev server alongside Django's `runserver`.

#### Scenario: Production build
- **WHEN** `vite build` is run followed by `manage.py collectstatic`
- **THEN** the built assets for all vite-managed apps SHALL be collected from `src/static/dist/` into `STATIC_ROOT` and served by Django at the configured `STATIC_URL`

#### Scenario: Development with HMR
- **WHEN** the Vite dev server is running alongside Django's `runserver`
- **THEN** changes to Vue SFC files in any app's `static/` directory SHALL be hot-reloaded in the browser without a full page refresh

#### Scenario: Multiple apps built by a single vite invocation
- **WHEN** multiple Django apps have vite entry points configured in the root `vite.config.js`
- **THEN** a single `npm run dev` or `npm run build` SHALL build all of them, producing a single manifest file in the shared output directory
