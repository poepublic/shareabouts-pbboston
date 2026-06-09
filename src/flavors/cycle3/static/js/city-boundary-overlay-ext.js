// City boundary overlay, shown when the user selects city-wide on the place form.

(function () {
  let map = null;
  let boundaryLayer = null;

  const original_AppView_initialize = Shareabouts.AppView.prototype.initialize;
  Shareabouts.AppView.prototype.initialize = function () {
    const result = original_AppView_initialize.call(this, ...arguments);
    this.initCityBoundaryOverlay();
    return result;
  };

  Shareabouts.AppView.prototype.initCityBoundaryOverlay = function () {
    map = this.mapView.map;

    const pane = map.createPane('cityBoundaryPane');
    pane.style.zIndex = 625;
    pane.style.pointerEvents = 'none';

    const computedStyles = getComputedStyle(document.documentElement);
    const color = computedStyles.getPropertyValue('--iia-urban-pink-alt').trim();

    const svgRenderer = L.svg({ pane: 'cityBoundaryPane' });

    const geojsonUrl = Shareabouts.bootstrapped.staticUrl + 'data/City_of_Boston_Boundary_Simplified.geojson';
    fetch(geojsonUrl)
      .then(r => r.json())
      .then(data => {
        boundaryLayer = L.geoJSON(data, {
          pane: 'cityBoundaryPane',
          renderer: svgRenderer,
          style: { fillColor: color, color: color, fillOpacity: 0.4, weight: 2 },
        });
      });
  };

  const original_AppView_hidePanel = Shareabouts.AppView.prototype.hidePanel;
  Shareabouts.AppView.prototype.hidePanel = function () {
    original_AppView_hidePanel.call(this, ...arguments);
    if (boundaryLayer) boundaryLayer.remove();
  };

  const original_resetCityWide = Shareabouts.PlaceFormView.prototype.resetCityWide;
  Shareabouts.PlaceFormView.prototype.resetCityWide = function (isCityWide) {
    original_resetCityWide.call(this, isCityWide);
    if (!boundaryLayer) return;

    if (isCityWide === 'true') {
      boundaryLayer.addTo(map);
      map.flyToBounds(boundaryLayer.getBounds(), { duration: 0.8 });
    } else {
      boundaryLayer.remove();
    }
  };
})();
