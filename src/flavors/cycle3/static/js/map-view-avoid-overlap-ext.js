(function() {

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

  if (Shareabouts.Config.flavor.cluster_markers !== false) return;

  var Shareabouts_MapView_initialize = Shareabouts.MapView.prototype.initialize;
  Shareabouts.MapView.prototype.initialize = function() {
    Shareabouts_MapView_initialize.apply(this, arguments);

    this.map.on('zoomend', () => {
      Object.values(this.layerViews).forEach(lv => {
        if (lv.layer && lv.layer.setLatLng) lv.initLayer();
      });
    });
  };

})();
