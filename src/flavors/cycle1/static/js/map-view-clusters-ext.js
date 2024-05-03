(function() {
  var Shareabouts_MapView_initialize = Shareabouts.MapView.prototype.initialize;
  Shareabouts.MapView.prototype.initialize = function() {
    Shareabouts_MapView_initialize.apply(this, arguments);

    this.map.removeLayer(this.placeLayers);
    this.oldPlaceLayersGroup = this.placeLayers;
    this.placeLayers = new L.MarkerClusterGroup({
      iconCreateFunction: function(cluster) {
        return L.divIcon({ html: '<b>' + cluster.getChildCount() + ' ideas</b>' });
      }
    });
    this.map.addLayer(this.placeLayers);

    this.focusedPlaceLayers = new L.LayerGroup();
    this.map.addLayer(this.focusedPlaceLayers);
  }

  var Shareabouts_MapView_render = Shareabouts.MapView.prototype.render;
  Shareabouts.MapView.prototype.render = function() {
    Shareabouts_MapView_render.apply(this, arguments);
    this.focusedPlaceLayers.bringToFront();
  }

  var Shareabouts_MapView_addLayerView = Shareabouts.MapView.prototype.addLayerView;
  Shareabouts.MapView.prototype.addLayerView = function(model) {
    this.layerViews[model.cid] = new Shareabouts.LayerView({
      model: model,
      router: this.options.router,
      map: this.map,
      placeLayers: this.placeLayers,
      focusedPlaceLayers: this.focusedPlaceLayers,
      placeTypes: this.options.placeTypes,
      mapView: this
    });
  }

  var Shareabouts_LayerView_show = Shareabouts.LayerView.prototype.show;
  Shareabouts.LayerView.prototype.show = function() {
    var locationTypeFilter = this.getLocationTypeFilter();
    var locationType = this.model.get('location_type');
    if (!locationTypeFilter || locationTypeFilter.toUpperCase() === locationType.toUpperCase()) {
      if (this.layer) {
        if (this.isFocused) {
          this.options.focusedPlaceLayers.addLayer(this.layer);
        } else {
          this.options.placeLayers.addLayer(this.layer);
        }
      }
    } else {
      this.hide();
    }
  }

  var Shareabouts_LayerView_removeLayer = Shareabouts.LayerView.prototype.removeLayer;
  Shareabouts.LayerView.prototype.removeLayer = function() {
    if (this.layer) {
      this.options.placeLayers.removeLayer(this.layer);
      this.options.focusedPlaceLayers.removeLayer(this.layer);
    }
  }
})();