// Add clustering to the map view
// ==============================
//
// This script extends the Shareabouts map view to use clustering for the place
// markers. It uses the Leaflet.markercluster plugin to do this.
//
// The script also adds a new layer group for focused places, which are places
// that are currently being viewed in the detail view.

(function() {

  // Override the map view's initialize method to add the clustering layer
  // and the focused place layer.
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

  // Override the map view's render method to bring the focused place layer to
  // the front.
  var Shareabouts_MapView_render = Shareabouts.MapView.prototype.render;
  Shareabouts.MapView.prototype.render = function() {
    Shareabouts_MapView_render.apply(this, arguments);
    this.focusedPlaceLayers.bringToFront();
  }

  // Override the map view's addLayerView method to include the focused place
  // layer in the layer views' options.
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

  // Override the layer view's show method to add the layer to the place layer
  // or the focused place layer depending on whether the layer is focused.
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

  // Override the layer view's removeLayer method to remove the layer from the
  // focused place layer in addition to the place layer.
  var Shareabouts_LayerView_removeLayer = Shareabouts.LayerView.prototype.removeLayer;
  Shareabouts.LayerView.prototype.removeLayer = function() {
    if (this.layer) {
      this.options.placeLayers.removeLayer(this.layer);
      this.options.focusedPlaceLayers.removeLayer(this.layer);
    }
  }
})();