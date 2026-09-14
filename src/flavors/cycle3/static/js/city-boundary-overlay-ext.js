// City boundary overlay, shown when the user selects city-wide on the place form.

(function () {
  const original_MapView_initialize = Shareabouts.MapView.prototype.initialize;
  Shareabouts.MapView.prototype.initialize = function () {
    const result = original_MapView_initialize.call(this, ...arguments);
    this.initBoundaryLayer();
    return result;
  };

  const original_AppView_hidePanel = Shareabouts.AppView.prototype.hidePanel;
  Shareabouts.AppView.prototype.hidePanel = function () {
    original_AppView_hidePanel.call(this, ...arguments);
    this.mapView.hideBoundaryLayer();
  };

  Shareabouts.MapView.prototype.initBoundaryLayer = function () {
    const map = this.map;

    const pane = map.createPane('cityBoundaryPane');
    pane.style.zIndex = 625;
    pane.style.pointerEvents = 'none';

    const computedStyles = getComputedStyle(document.documentElement);
    const color = computedStyles.getPropertyValue('--selection-bg').trim();

    const svgRenderer = L.svg({ pane: 'cityBoundaryPane' });

    const geojsonUrl = Shareabouts.bootstrapped.staticUrl + 'data/City_of_Boston_Boundary_Simplified.geojson';
    fetch(geojsonUrl)
      .then(r => r.json())
      .then(data => {
        this.boundaryLayer = L.geoJSON(data, {
          pane: 'cityBoundaryPane',
          renderer: svgRenderer,
          style: { fillColor: color, color: color, fillOpacity: 0.4, weight: 2 },
        });
      });
  };

  Shareabouts.MapView.prototype.showBoundaryLayer = function () {
    if (!this.boundaryLayer) return;
    this.boundaryLayer.addTo(this.map);
    this.map.flyToBounds(this.boundaryLayer.getBounds(), { duration: 0.8 });
  };

  Shareabouts.MapView.prototype.hideBoundaryLayer = function () {
    if (this.boundaryLayer) this.boundaryLayer.remove();
  };

  const original_resetCityWide = Shareabouts.PlaceFormView.prototype.resetCityWide;
  Shareabouts.PlaceFormView.prototype.resetCityWide = function (isCityWide) {
    original_resetCityWide.call(this, isCityWide);
    const mapView = this.options.appView.mapView;
    if (isCityWide === 'true') {
      mapView.showBoundaryLayer();
    } else {
      mapView.hideBoundaryLayer();
    }
  };
})();
