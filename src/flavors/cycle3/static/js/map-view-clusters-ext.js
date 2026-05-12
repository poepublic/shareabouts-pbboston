// Add clustering to the map view
// ==============================
//
// This script extends the Shareabouts map view to cluster place
// markers based on category and distance.
// It uses the Leaflet.markercluster plugin to do this.
// Markers' lat/lons are also shifted by category to reduce overlap
//
// The script also adds a new layer group for focused places, which are places
// that are currently being viewed in the detail view.

(function() {

  // Compute the pixel offset radius at a given zoom level.
  // Stays small at city-scale zooms (<13) and stabilizes around 55px at
  // neighborhood/street scale (≥13), where cross-category separation matters most.
  function radialOffsetRadius(zoom) {
    return zoom >= 13 ? 55 : Math.max(8, (zoom - 10) * 10);
  }

  var Shareabouts_LayerView_initLayer = Shareabouts.LayerView.prototype.initLayer;
  Shareabouts.LayerView.prototype.initLayer = function() {
    Shareabouts_LayerView_initLayer.apply(this, arguments);
    if (!this.layer || !this.layer.setLatLng) return;

    const locationType = this.model.get('location_type');
    const placeTypeKeys = Object.keys(this.options.placeTypes);
    const index = placeTypeKeys.indexOf(locationType);
    if (index === -1) return;

    // Shift each marker's lat/lng radially by category index so that
    // markers from different categories don't overlap. This also affects cluster
    // locations, reducing overlap at the clsuter level
    const zoom = this.map.getZoom();
    const offsetRadius = radialOffsetRadius(zoom);
    const angle = (2 * Math.PI * index) / placeTypeKeys.length;
    const offsetX = Math.round(Math.cos(angle) * offsetRadius);
    const offsetY = Math.round(Math.sin(angle) * offsetRadius);

    const geometry = this.model.get('geometry');
    if (!geometry || !geometry.coordinates) return;
    const originalLatLng = L.latLng(geometry.coordinates[1], geometry.coordinates[0]);
    const point = this.map.project(originalLatLng, zoom);
    this.layer.setLatLng(this.map.unproject(point.add([offsetX, offsetY]), zoom));

    // Markers are smaller in non-clustering mode to reduce clutter
    const clusteringOff = Shareabouts.Config.flavor.cluster_markers === false;
    if (clusteringOff && this.layer.setIcon && this.styleRule) {
      const scale = 0.8;
      const iconDef = (this.isFocused && this.styleRule.focus_icon) ? this.styleRule.focus_icon : this.styleRule.icon;
      if (iconDef && iconDef.iconSize) {
        const baseAnchor = iconDef.iconAnchor || [iconDef.iconSize[0] / 2, iconDef.iconSize[1] / 2];
        this.layer.setIcon(L.icon(Object.assign({}, iconDef, {
          iconSize: [iconDef.iconSize[0] * scale, iconDef.iconSize[1] * scale],
          iconAnchor: [baseAnchor[0] * scale, baseAnchor[1] * scale],
        })));
      }
    }
  };

  if (Shareabouts.Config.flavor.cluster_markers === false) return;

  // Override the map view's initialize method to add the clustering layer
  // and the focused place layer.
  var Shareabouts_MapView_initialize = Shareabouts.MapView.prototype.initialize;
  Shareabouts.MapView.prototype.initialize = function() {
    Shareabouts_MapView_initialize.apply(this, arguments);

    const optimisticBlue = '#288be4'; // This should match the --optimistic-blue color in the CSS
    this.map.removeLayer(this.placeLayers);

    // Create a cluster group for each idea category (placeType)
    this.placeLayers = {};

    const placeTypeKeys = Object.keys(this.options.placeTypes);
    placeTypeKeys.forEach((placeType, index) => {

      this.placeLayers[placeType] = L.markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        spiderLegPolylineOptions: { weight: 1.5, color: optimisticBlue, opacity: 0.75, pane: 'spiderLegPane' },
        maxClusterRadius: (zoom) => Math.max(30, zoom * zoom * 1.5),
        clusterPane: 'clusterPane',

        // Create custom cluster icons including the number of markers and a tooltip indicating placeType.
        iconCreateFunction: (cluster) => {
            if (!cluster._tooltip) {
              cluster.bindTooltip(`${placeType.replace(/_/g, ' & ')}`, {direction: "top", offset: [0, -12], className: "cluster-tooltip"});
            }
            return L.divIcon({
            html: `<div class="cluster-icon" id="cluster-icon-${placeType}">` + cluster.getChildCount() + '</div>',
            className: '', // this drops leaflet's default styles
            iconSize: [15, 15],
            iconAnchor: [7.5, 7.5]
            });
        }

        });

        this.map.addLayer(this.placeLayers[placeType]);

        // Patch addLayer and removeLayer to suppress _unspiderfy when a marker is selected from a spiderfied cluster
        ['addLayer', 'removeLayer'].forEach(method => {
          const original = this.placeLayers[placeType][method].bind(this.placeLayers[placeType]);
          this.placeLayers[placeType][method] = function(layer) {
            if (this._spiderfied) {
              const saved = this._unspiderfy;
              this._unspiderfy = function() {};
              const result = original(layer);
              this._unspiderfy = saved;
              return result;
            }
            return original(layer);
          };
        });

        this.placeLayers[placeType].on('spiderfied', (e) => {
          Object.values(this.placeLayers).forEach(group => {
            if (group !== this.placeLayers[placeType] && group._spiderfied) {
              group._unspiderfy();
            }
          });
          this.map.getPane('markerPane').style.zIndex = 626;
          e.markers.forEach(m => { if (m._icon) m._icon.classList.add('spiderfied-active'); });
          if (e.cluster && e.cluster._icon) e.cluster._icon.classList.add('spiderfied-active');
          this.map.getContainer().classList.add('map-spiderfied');
        });

        this.placeLayers[placeType].on('unspiderfied', () => {
          setTimeout(() => {
            if (!Object.values(this.placeLayers).some(g => g._spiderfied)) {
              this.map.getPane('markerPane').style.zIndex = 600;
              this.map.getContainer().classList.remove('map-spiderfied');
              this.map.getContainer().querySelectorAll('.spiderfied-active').forEach(el => el.classList.remove('spiderfied-active'));
            }
          }, 0);
        });

    });

    // On zoom, recompute each marker's shifted lat/lng for the new zoom level, then
    // rebuild cluster groups so they use the updated positions.
    this.map.on('zoomend', () => {
      Object.values(this.layerViews).forEach(lv => {
        if (lv.layer && lv.layer.setLatLng) lv.initLayer();
      });
      placeTypeKeys.forEach(placeType => {
        const group = this.placeLayers[placeType];
        if (!group || group._spiderfied) return;
        const layers = Object.values(this.layerViews)
          .filter(lv => lv.model.get('location_type') === placeType && lv.layer && !lv.isFocused)
          .map(lv => lv.layer);
        group.clearLayers();
        group.addLayers(layers);
      });
    });


    this.focusedPlaceLayers = new L.LayerGroup();
    this.map.addLayer(this.focusedPlaceLayers);

    // Bring clusters above regular markers
    const clusterPane = this.map.createPane('clusterPane');
    clusterPane.style.zIndex = 620;

    // Spider legs sit just above cluster icons
    const spiderLegPane = this.map.createPane('spiderLegPane');
    spiderLegPane.style.zIndex = 622;
    spiderLegPane.style.pointerEvents = 'none';


    // Bring focused markers above everything
    const focusedPane = this.map.createPane('focusedPane');
    focusedPane.style.zIndex = 670;
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

  // Override focus() and skip updateLayer() when marker is selected from a spiderfied cluster.
  // This allows the marker to change icon in-place without triggering _unspiderfy and collapsing the cluster.
  var Shareabouts_LayerView_focus = Shareabouts.LayerView.prototype.focus;
  Shareabouts.LayerView.prototype.focus = function() {
    if (!this.isFocused) { // Only update is not already focused
      var locationType = this.model.get('location_type');
      var clusterGroup = this.options.placeLayers && this.options.placeLayers[locationType];
      this.isFocused = true;

      if (clusterGroup && clusterGroup._spiderfied && this.layer) {  // Update icons in-place for markers in spiderfied clusters
        this.layer.options.bubblingMouseEvents = false;
        var focusedContext = _.extend({}, this.model.toJSON(),
          {map: {zoom: this.map.getZoom()}, layer: {focused: true}});
        var focusedRule = L.Argo.getStyleRule(focusedContext, this.placeType.rules);
        if (focusedRule && focusedRule.icon) {
          this.layer.setIcon(L.icon(focusedRule.icon));
          if (this.layer._icon) this.layer._icon.classList.add('spiderfied-active');
        }
      } else {
        this.updateLayer();
      }
    }
  };

  // Override unfocus() and skip updateLayer() when marker is unselected from a spiderfied cluster.
  // This allows the marker to change icon in-place without triggering _unspiderfy and collapsing the cluster.
  var Shareabouts_LayerView_unfocus = Shareabouts.LayerView.prototype.unfocus;
  Shareabouts.LayerView.prototype.unfocus = function() {
    if (this.isFocused) {
      var locationType = this.model.get('location_type');
      var clusterGroup = this.options.placeLayers && this.options.placeLayers[locationType];
      this.isFocused = false;

      if (clusterGroup && clusterGroup._spiderfied && this.layer) {
        var unfocusedContext = _.extend({}, this.model.toJSON(),
          {map: {zoom: this.map.getZoom()}, layer: {focused: false}});
        var unfocusedRule = L.Argo.getStyleRule(unfocusedContext, this.placeType.rules);
        if (unfocusedRule && unfocusedRule.icon) {
          this.layer.setIcon(L.icon(unfocusedRule.icon));
          if (this.layer._icon) this.layer._icon.classList.add('spiderfied-active');
        }
      } else {
        this.updateLayer();
      }
    }
  };

  // Override the layer view's show method to add the layer to the place layer
  // or the focused place layer depending on whether the layer is focused.
  var Shareabouts_LayerView_show = Shareabouts.LayerView.prototype.show;
  Shareabouts.LayerView.prototype.show = function() {
    var locationTypeFilter = this.getLocationTypeFilter();
    var locationType = this.model.get('location_type');
    if (!locationTypeFilter || locationTypeFilter.toUpperCase() === locationType.toUpperCase()) {
      if (this.layer) {
        this.layer.options.bubblingMouseEvents = false;
        var clusterGroup = this.options.placeLayers && this.options.placeLayers[locationType];
        if (clusterGroup && clusterGroup._spiderfied) return;
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

  var Shareabouts_LayerView_hide = Shareabouts.LayerView.prototype.hide;
  Shareabouts.LayerView.prototype.hide = function() {
    var locationType = this.model.get('location_type');
    var clusterGroup = this.options.placeLayers && this.options.placeLayers[locationType];
    if (clusterGroup && clusterGroup._spiderfied) return;
    Shareabouts_LayerView_hide.apply(this, arguments);
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
