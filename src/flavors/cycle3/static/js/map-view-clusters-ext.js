// Add clustering to the map view
// ==============================
//
// This script extends the Shareabouts map view to use clustering for the place
// markers. Markers are clustered by category and distance. 
// It uses the Leaflet.markercluster plugin to do this.
//
// The script also adds a new layer group for focused places, which are places
// that are currently being viewed in the detail view.

(function() {

  // Override the map view's initialize method to add the clustering layer
  // and the focused place layer.
  var Shareabouts_MapView_initialize = Shareabouts.MapView.prototype.initialize;
  Shareabouts.MapView.prototype.initialize = function() {
    Shareabouts_MapView_initialize.apply(this, arguments);

    const optimisticBlue = '#288be4'; // This should match the --optimistic-blue color in the CSS
    this.map.removeLayer(this.placeLayers);
    this.oldPlaceLayersGroup = this.placeLayers;

    // Create a cluster group for each idea category (placeType) 
    this.placeLayers = {};

    Object.keys(this.options.placeTypes).forEach(placeType => {
      this.placeLayers[placeType] = L.markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        spiderLegPolylineOptions: { weight: 1.5, color: optimisticBlue, opacity: 0.75 },
        maxClusterRadius: 80,
        clusterPane: 'clusterPane',
        
        // Create custom cluster icons including the number of markers and a tooltip indicating placeType
        iconCreateFunction: (cluster) => {
            cluster.bindTooltip(`${placeType.replace(/_/g, ' & ')}`, {direction: "top", offset: [0, -10], className: "cluster-tooltip"});
            return L.divIcon({
            html: `<div class="cluster-icon" id="cluster-icon-${placeType}">` + cluster.getChildCount() + '</div>',
            className: '', // this drops leaflet's default styles
            iconSize: [15, 15], 
            iconAnchor: [7.5, 7.5]  
            });
        }

        });

        this.map.addLayer(this.placeLayers[placeType]);
        
    })
    

    this.focusedPlaceLayers = new L.LayerGroup();
    this.map.addLayer(this.focusedPlaceLayers);

    // Create a new pane on top of the default marker pane for the focused
    // place markers.
    const clusterPane = this.map.createPane('clusterPane');
    clusterPane.style.zIndex = 620;

    const focusedPane = this.map.createPane('focusedPane');
    focusedPane.style.zIndex = 610;
    focusedPane.style.pointerEvents = 'none';
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
          this.layer.options.pane = 'focusedPane';
          this.options.focusedPlaceLayers.addLayer(this.layer);
        } else {
          this.layer.options.pane = 'markerPane';
          this.options.placeLayers[locationType].addLayer(this.layer);
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
    var locationType = this.model.get('location_type');
    if (this.layer) {
      this.options.placeLayers[locationType].removeLayer(this.layer);
      this.options.focusedPlaceLayers.removeLayer(this.layer);
    }
  }
})();