# Supporting the List View on Small Screens

Currently, when on a small screen (< 60rem/960px, e.g. mobile devices), the list view option is not available. The list view provides the ability to search through ideas by substring, or within a specific neighborhood. The main reason the list view is not available on small screens is that we don't have styles for it on small screens. You can see this in `src/sa_web/static/css/default.css`, where we use a mobile-first approach.

We should add styles for the list view on small screens. The styles should be placed in a new css file under `src/flavors/cycle3/static/css/` and imported in `src/flavors/cycle3/static/css/custom.css`.

## Notes

- The list/map toggle should be available on the map view as a button similar to a leaflet control, above the locate-me control (which should be moved down), and directly to the right of the geocoder search bar. While the list view is open, the map view button should be available to the right of the search bar and search button.
- Styles for small screens should be similar to the styles for screens of size 961px, except the search area should span the full width of the screen (with some right-margin for the map view button), and the filters should come below the search.

## Implementation Plan

1. Create a new css file under `src/flavors/cycle3/static/css/` and import it in `src/flavors/cycle3/static/css/custom.css`.
2. Add styles for the list view on small screens.
3. Add styles for the list view/map view toggle button.
4. Test the list view on small screens.