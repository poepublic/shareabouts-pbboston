// This script extends the Shareabouts map view to cluster markers by category using Leaflet.markercluster.
// Markers for open places are pulled out of their cluster and shown in a separate focused layer.
// 

(function() {

  if (Shareabouts.Config.flavor.cluster_markers === false) return; 

  var Shareabouts_MapView_initialize = Shareabouts.MapView.prototype.initialize;
  Shareabouts.MapView.prototype.initialize = function() {
    Shareabouts_MapView_initialize.apply(this, arguments);

    const optimisticBlue = '#288be4';
    this.map.removeLayer(this.placeLayers);

    // Replace the default single layer group with one MarkerClusterGroup per category.
    this.placeLayers = {};

    const placeTypeKeys = Object.keys(this.options.placeTypes);
    placeTypeKeys.forEach((placeType, index) => {

      this.placeLayers[placeType] = L.markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        spiderLegPolylineOptions: { weight: 1.5, color: optimisticBlue, opacity: 0.75, pane: 'spiderLegPane' },
        maxClusterRadius: (zoom) => Math.max(30, zoom * zoom * 1.5),
        clusterPane: 'clusterPane',

        iconCreateFunction: (cluster) => { // Create custom cluster markers + a tooltip indicating the place type
            if (!cluster._tooltip) {
              cluster.bindTooltip(`${placeType.replace(/_/g, ' & ')}`, {direction: "top", offset: [0, -12], className: "cluster-tooltip"});
            }
            return L.divIcon({
            html: `<div class="cluster-icon" id="cluster-icon-${placeType}">` + cluster.getChildCount() + '</div>',
            className: '', // drops Leaflet's default icon styles
            iconSize: [15, 15],
            iconAnchor: [7.5, 7.5]
            });
        }

        });

        this.map.addLayer(this.placeLayers[placeType]); // Add each cluster group to the map

        // Suppress _unspiderfy during addLayer/removeLayer so the spider stays open when a marker is selected
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
          // Close any other open spider.
          Object.values(this.placeLayers).forEach(group => {
            if (group !== this.placeLayers[placeType] && group._spiderfied) {
              group._unspiderfy();
            }
          });

          // Raise marker pane so 'spiderfied' clusters sit on top of others
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

              Object.values(this.layerViews).forEach(lv => {
                if (!lv.layer) return;
                if (!lv.isFocused && this.focusedPlaceLayers.hasLayer(lv.layer)) {

                  lv.updateLayer();
                } else if (lv.isFocused && !this.focusedPlaceLayers.hasLayer(lv.layer)) { // When a marker is focused in a spiderfied cluster and the cluster unspiderfies, the marker needs to be re-rendered to move it back to the cluster layer and update its icon
                  lv.updateLayer();
                }
              });
            }
          }, 0);
        });

    });

    // After zoom, rebuild each cluster group from the current layer views
    this.map.on('zoomend', () => {
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

    // z-index hierarchy: markers (600) < clusters (620) < spider legs (622) < spidered markers (626) < focused spidered markers (670)
    const clusterPane = this.map.createPane('clusterPane');
    clusterPane.style.zIndex = 620;

    const spiderLegPane = this.map.createPane('spiderLegPane');
    spiderLegPane.style.zIndex = 622;
    spiderLegPane.style.pointerEvents = 'none';

    const focusedPane = this.map.createPane('focusedPane');
    focusedPane.style.zIndex = 670;
    focusedPane.style.pointerEvents = 'none';
  }

  // Pass cluster-specific options to each LayerView so it knows about placeLayers and focusedPlaceLayers.
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

  // When a marker in an open spider is focused, swap its icon in-place instead of calling updateLayer()
  // to avoid triggering _unspiderfy and collapsing the spider.
  var Shareabouts_LayerView_focus = Shareabouts.LayerView.prototype.focus;
  Shareabouts.LayerView.prototype.focus = function() {
    if (!this.isFocused) {
      var locationType = this.model.get('location_type');
      var clusterGroup = this.options.placeLayers && this.options.placeLayers[locationType];
      this.isFocused = true;

      if (clusterGroup && clusterGroup._spiderfied && this.layer) {
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

  // Same in-place swap for unfocus, to keep the spider open.
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

  // Route markers to the right layer group: focused markers go to focusedPlaceLayers, others to their cluster.
  // Skip entirely if the spider is open to avoid disturbing its layout.
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

  // Skip hide() while the spider is open for the same reason as show().
  var Shareabouts_LayerView_hide = Shareabouts.LayerView.prototype.hide;
  Shareabouts.LayerView.prototype.hide = function() {
    var locationType = this.model.get('location_type');
    var clusterGroup = this.options.placeLayers && this.options.placeLayers[locationType];
    if (clusterGroup && clusterGroup._spiderfied) return;
    Shareabouts_LayerView_hide.apply(this, arguments);
  }

  // Remove the marker from both layer groups so neither holds a stale reference.
  var Shareabouts_LayerView_removeLayer = Shareabouts.LayerView.prototype.removeLayer;
  Shareabouts.LayerView.prototype.removeLayer = function() {
    var locationType = this.model.get('location_type');
    if (this.layer) {
      this.options.placeLayers[locationType].removeLayer(this.layer);
      this.options.focusedPlaceLayers.removeLayer(this.layer);
    }
  }
})();
