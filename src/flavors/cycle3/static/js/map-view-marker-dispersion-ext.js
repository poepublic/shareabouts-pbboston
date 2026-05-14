// Disperses markers to prevent overlapping in both clustered and non-clustered modes.
// Applies a per-category radial pixel offset so markers from the same location spread outward.
// When clustering is off, also randomizes city-wide markers within a configured radius,
// and scales down all icons to reduce visual clutter.

(function() {

  // Radial offset radius in pixels, increasing with zoom level.
  function radialOffsetRadius(zoom) {
    return zoom >= 13 ? 55 : Math.max(8, (zoom - 10) * 10);
  }

  // Deterministic pseudo-random in [0, 1) for a numeric seed.
  // Using the model ID as seed keeps each marker's offset stable across re-renders.
  function seededRandom(seed) {
    const x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x);
  }

  var Shareabouts_LayerView_initLayer = Shareabouts.LayerView.prototype.initLayer;
  Shareabouts.LayerView.prototype.initLayer = function() {
    Shareabouts_LayerView_initLayer.apply(this, arguments);
    if (!this.layer || !this.layer.setLatLng) return;

    const locationType = this.model.get('location_type');
    const placeTypeKeys = Object.keys(this.options.placeTypes);
    const index = placeTypeKeys.indexOf(locationType);
    if (index === -1) return;

    const clusteringOff = Shareabouts.Config.flavor.cluster_markers === false;
    const geometry = this.model.get('geometry');
    if (!geometry || !geometry.coordinates) return;

    let [lng, lat] = geometry.coordinates;

    // When clustering is off, scatter city-wide markers randomly within the configured radius.
    if (clusteringOff && this.model.get('city_wide') === 'true') {
      const maxOffset = (Shareabouts.Config.flavor.place || {}).city_wide_location_offset || 50;
      const seed = this.model.id || 0;
      const offsetDist = seededRandom(seed) * maxOffset;
      const offsetDir = seededRandom(seed + 1) * 360;
      const randpt = turf.transformTranslate(turf.point([lng, lat]), offsetDist, offsetDir, {units: 'meters'});
      [lng, lat] = randpt.geometry.coordinates;
    }

    // Apply the per-category radial pixel offset on top of the (possibly shifted) base position.
    const zoom = this.map.getZoom();
    const offsetRadius = radialOffsetRadius(zoom);
    const angle = (2 * Math.PI * index) / placeTypeKeys.length; // angle is deterministic per category
    const offsetX = Math.round(Math.cos(angle) * offsetRadius);
    const offsetY = Math.round(Math.sin(angle) * offsetRadius);

    const point = this.map.project(L.latLng(lat, lng), zoom);
    this.layer.setLatLng(this.map.unproject(point.add([offsetX, offsetY]), zoom));

    if (clusteringOff && this.layer.setIcon && this.styleRule) {
      const scale = 0.8; // scale down icons when clustering is off to reduce visual clutter
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
