// Set the initial view of the map to contain the entire city
// ==========================================================
//
// The size of the map and how much can be displayed at a given zoom level
// varies between mobile and desktop views. Because we know the extents of the
// city (based on the extents of all the neighborhoods), we can just set the
// initial zoom level to contain the city.

(function() {
  const Shareabouts_MapView_constructMap = Shareabouts.MapView.prototype.constructMap;
  Shareabouts.MapView.prototype.constructMap = function() {
    const map = Shareabouts_MapView_constructMap.apply(this, arguments);

    // Find the bounds of the city based on the neighborhood GeoJSON
    // FeatureCollection
    const neighborhoods = Shareabouts.bootstrapped.neighborhoods;
    const neighborhoodsLayer = L.geoJSON(neighborhoods);
    const cityBounds = neighborhoodsLayer.getBounds();

    // Set the initial view of the map to contain the entire city
    map.fitBounds(cityBounds, {
      animate: false,
      padding: [30, 30]
    });
    return map;
  };
})();