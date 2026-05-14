// Place marker dispersion extension
// ===================================
// This script handles the dispersion of markers in high-density areas to prevent them from overlapping and 
// enable easier interaction. It calculates a radial offset radius from the origin of each marker, then applies 
// the offset in a different direction for each marker category. This extension prevents overlapping in both clusterred and 
// non-clustered modes, and disperses clusters as well when clustering is enabled. 
// 

(function() {

  // The radial offset radius increases with zoom level
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
    const angle = (2 * Math.PI * index) / placeTypeKeys.length; // The angle of the offset is determined by the location type to ensure that dispersion effects treat clusters the same way
    const offsetX = Math.round(Math.cos(angle) * offsetRadius);
    const offsetY = Math.round(Math.sin(angle) * offsetRadius);

    const geometry = this.model.get('geometry'); 
    if (!geometry || !geometry.coordinates) return;
    const originalLatLng = L.latLng(geometry.coordinates[1], geometry.coordinates[0]);
    const point = this.map.project(originalLatLng, zoom);
    this.layer.setLatLng(this.map.unproject(point.add([offsetX, offsetY]), zoom));

    const clusteringOff = Shareabouts.Config.flavor.cluster_markers === false;
    if (clusteringOff && this.layer.setIcon && this.styleRule) {
      const scale = 0.8; // Scale down marker icons when clustering is off to help with overlapping
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
