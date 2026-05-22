// cluster_markers: true -> applies a per-category radial pixel offset to cluster icons
// so same-location clusters spread outward visually. Patches each cluster group's
// iconCreateFunction after the cluster groups are created in map-view-clusters-ext.js.
//
// cluster_markers: false -> randomly scatters citywide markers within a configured
// radius, and scales down all icons to reduce visual clutter.

(function() {

  // Radial offset radius (pixels); increases with zoom
  function radialOffsetRadius(zoom) {
    return zoom >= 13 ? 55 : Math.max(8, (zoom - 10) * 10);
  }

  // Deterministic pseudo-random in [0, 1) for a numeric seed.
  // Using the model ID as seed keeps each marker's offset stable across re-renders.
  function seededRandom(seed) {
    const x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x);
  }

  // Swap in cluster's offset location for the spider lifecycle so legs and
  // collapse animation both use the correct lat/lon
  if (L.MarkerCluster) {
    var _orig_spiderfy = L.MarkerCluster.prototype.spiderfy;
    L.MarkerCluster.prototype.spiderfy = function() {
      if (this._dispersionLatLng) {
        this._origLatLng = this._latlng;
        this._latlng = this._dispersionLatLng;
        var cluster = this;
        this._group.once('unspiderfied', function() {
          if (cluster._origLatLng) {
            cluster._latlng = cluster._origLatLng;
            delete cluster._origLatLng;
          }
        });
      }
      _orig_spiderfy.apply(this, arguments);
    };
  }

  // Clustered mode: patch each cluster group's iconCreateFunction to shift the
  // cluster icon by a per-category radial pixel offset via iconAnchor, and store
  // the corresponding visual latlng on the cluster for spider origin correction above.
  var Shareabouts_MapView_initialize = Shareabouts.MapView.prototype.initialize;
  Shareabouts.MapView.prototype.initialize = function() {
    Shareabouts_MapView_initialize.apply(this, arguments);

    if (Shareabouts.Config.flavor.cluster_markers === false) return;
    if (!this.placeLayers || typeof this.placeLayers !== 'object') return;

    Object.values(this.placeLayers).forEach(clusterGroup => {
      const placeTypeIndex = clusterGroup.options.placeTypeIndex;
      const placeTypeCount = clusterGroup.options.placeTypeCount;
      if (placeTypeIndex === undefined || !placeTypeCount) return;

      const orig = clusterGroup.options.iconCreateFunction;
      clusterGroup.options.iconCreateFunction = function(cluster) {
        const origIcon = orig(cluster);
        const map = cluster._group && cluster._group._map;
        const zoom = map ? map.getZoom() : 12;
        const angle = (2 * Math.PI * placeTypeIndex) / placeTypeCount;
        const r = radialOffsetRadius(zoom);
        const offsetX = Math.round(Math.cos(angle) * r);
        const offsetY = Math.round(Math.sin(angle) * r);
        if (map) {
          // Use _origLatLng as base if spiderfy has temporarily swapped _latlng,
          // to avoid accumulating offset across icon refreshes during spider.
          const baseLatlng = cluster._origLatLng || cluster._latlng;
          const point = map.project(baseLatlng, zoom);
          cluster._dispersionLatLng = map.unproject(point.add([offsetX, offsetY]), zoom);
        }
        return L.divIcon({
          html: origIcon.options.html,
          className: origIcon.options.className,
          iconSize: origIcon.options.iconSize,
          iconAnchor: [origIcon.options.iconAnchor[0] - offsetX, origIcon.options.iconAnchor[1] - offsetY]
        });
      };
    });
  };

  // Non-clustered mode: scatter citywide markers within 50m and scale icons down to reduce clutter.
  var Shareabouts_LayerView_initLayer = Shareabouts.LayerView.prototype.initLayer;
  Shareabouts.LayerView.prototype.initLayer = function() {
    Shareabouts_LayerView_initLayer.apply(this, arguments);
    if (!this.layer || !this.layer.setLatLng) return;
    if (Shareabouts.Config.flavor.cluster_markers !== false) return;

    const geometry = this.model.get('geometry');
    if (!geometry || !geometry.coordinates) return;

    let [lng, lat] = geometry.coordinates;

    if (this.model.get('city_wide') === 'true') {
      const maxOffset = (Shareabouts.Config.flavor.place || {}).city_wide_location_offset || 50;
      const seed = this.model.id || 0;
      const offsetDist = seededRandom(seed) * maxOffset;
      const offsetDir = seededRandom(seed + 1) * 360;
      const randpt = turf.transformTranslate(turf.point([lng, lat]), offsetDist, offsetDir, {units: 'meters'});
      [lng, lat] = randpt.geometry.coordinates;
      this.layer.setLatLng(L.latLng(lat, lng));
    }

    if (this.layer.setIcon && this.styleRule) {
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

})();
