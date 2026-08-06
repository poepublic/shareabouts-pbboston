# Collapsing the Side-bar (ticker) on Large Screens

Currently, the side-bar (ticker) is always visible. This takes up screen real estate that could be used for the map. We should add the ability to collapse/toggle the side-bar when a user is on a screen where the screen width is at least 960px. Maybe something like a clickable region on the left side of the ticker (as defined in `src/sa_web/templates/base.html`) with a "🞂" to collapse and "🞀" to expand?

Styles should be placed in a new css file under `src/flavors/cycle3/static/css/` and imported in `src/flavors/cycle3/static/css/custom.css`.

JS should be placed in a new extension file under `src/flavors/cycle3/static/js/` and loaded into `src/flavors/cycle3/templates/index.html`.

CSS and JS style should follow other CSS and JS files in the respective directories -- e.g.:
- prefer vanilla JS over jQuery when feasible.
- avoid placing markup in the JS files (use jstemplates or, if necessary, modify the index.html template)