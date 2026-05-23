// Extends the Shareabouts map view to cluster markers by category using Leaflet.markercluster.
// Markers for open places are pulled out of their cluster and shown in a separate focused layer.
// Intercepts addLayer/removeLayer calls during spiderfy to avoid collapsing the spider when a marker is focused/unfocused while the spider is open.

(function() {

  if (Shareabouts.Config.flavor.cluster_markers === false) return;

  var Shareabouts_MapView_initialize = Shareabouts.MapView.prototype.initialize;
  Shareabouts.MapView.prototype.initialize = function() {
    Shareabouts_MapView_initialize.apply(this, arguments);

    const optimisticBlue = '#288be4'; // must match --optimistic-blue in CSS
    this.map.removeLayer(this.placeLayers);

    // Replace the default single layer group with one MarkerClusterGroup per category.
    this.placeLayers = {};

    const placeTypeKeyValues = Object.entries(this.options.placeTypes); 
    placeTypeKeyValues.forEach(([placeTypeKey, placeType], placeTypeIndex) => {

      this.placeLayers[placeTypeKey] = L.markerClusterGroup({
        placeTypeIndex: placeTypeIndex,
        placeTypeCount: placeTypeKeyValues.length,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: false,
        spiderLegPolylineOptions: { weight: 1.5, color: optimisticBlue, opacity: 0.75, pane: 'spiderLegPane' },
        //maxClusterRadius: (zoom) => Math.max(30, 140 - zoom * 5), // not bad but the improvements aren't worth the added complexity over a constant
        maxClusterRadius: 50,
        clusterPane: 'clusterPane',

        // Show the marker count and a category tooltip on each cluster bubble.
        iconCreateFunction: (cluster) => {
          if (!cluster._tooltip) {
            cluster.bindTooltip(placeType.label, {direction: "top", offset: [0, -12], className: "cluster-tooltip"});
          }
          return L.divIcon({
            html: `<div class="cluster-icon" id="cluster-icon-${placeTypeKey}">` + cluster.getChildCount() + '</div>',
            className: '', // drops Leaflet's default icon styles
            iconSize: [15, 15],
            iconAnchor: [7.5, 7.5]
          });
        }
      });

      this.map.addLayer(this.placeLayers[placeTypeKey]);

      // Suppress _unspiderfy during addLayer/removeLayer so the spider stays open when a marker is selected.
      if (!this.placeLayers[placeTypeKey]._unspiderfy) {
        console.warn('markercluster: _unspiderfy not found, spider suppression may be broken');
      }
      ['addLayer', 'removeLayer'].forEach(method => {
        const original = this.placeLayers[placeTypeKey][method].bind(this.placeLayers[placeTypeKey]);
        this.placeLayers[placeTypeKey][method] = function(layer) {
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

      this.placeLayers[placeTypeKey].on('clusterclick', (e) => { // spiderfy on click regardless of zoom level
        e.layer.spiderfy();
      });

      this.placeLayers[placeTypeKey].on('spiderfied', (e) => {
        // Close any other open spider.
        Object.values(this.placeLayers).forEach(group => {
          if (group !== this.placeLayers[placeTypeKey]) {
            group.unspiderfy();
          }
        });
        // Raise marker pane so spiderfied markers appear above cluster icons.
        this.map.getPane('markerPane').style.zIndex = 626;
        e.markers.forEach(m => { if (m._icon) m._icon.classList.add('spiderfied-active'); });
        if (e.cluster && e.cluster._icon) e.cluster._icon.classList.add('spiderfied-active');
        this.map.getContainer().classList.add('map-spiderfied');
      });

      this.placeLayers[placeTypeKey].on('unspiderfied', () => {
        // Defer cleanup so Leaflet finishes collapsing the spider first.
        setTimeout(() => {
          if (!Object.values(this.placeLayers).some(g => g._spiderfied)) {
            this.map.getPane('markerPane').style.zIndex = 600;
            this.map.getContainer().classList.remove('map-spiderfied');
            this.map.getContainer().querySelectorAll('.spiderfied-active').forEach(el => el.classList.remove('spiderfied-active'));
            // Reconcile markers whose focused/unfocused state drifted while the spider was open.
            Object.values(this.layerViews).forEach(lv => {
              if (!lv.layer) return;
              if (!lv.isFocused && this.focusedPlaceLayers.hasLayer(lv.layer)) {
                // Unfocused marker still in focused layer; move it back to its cluster.
                lv.updateLayer();
              } else if (lv.isFocused && !this.focusedPlaceLayers.hasLayer(lv.layer)) {
                // Focused in-place during spiderfy; move it to the focused layer now.
                lv.updateLayer();
              }
            });
          }
        }, 0);
      });

    });

    // Focused markers render here, above everything else.
    this.focusedPlaceLayers = new L.LayerGroup();
    this.map.addLayer(this.focusedPlaceLayers);

    // Pane z-indices. The markerPane is also set here (600) and raised to 626 during spiderfy.
    // clusters (620) < spider legs (622) < spiderfied markers (626) < focused (670)
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
  Shareabouts.LayerView.prototype.removeLayer = function() {
    var locationType = this.model.get('location_type');
    if (this.layer) {
      this.options.placeLayers[locationType].removeLayer(this.layer);
      this.options.focusedPlaceLayers.removeLayer(this.layer);
    }
  }
})();
