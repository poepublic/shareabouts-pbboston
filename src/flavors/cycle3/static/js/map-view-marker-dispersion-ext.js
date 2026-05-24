// cluster_markers

(function() {

  var Shareabouts_MapView_initialize = Shareabouts.MapView.prototype.initialize;
  Shareabouts.MapView.prototype.initialize = function() {
    Shareabouts_MapView_initialize.apply(this, arguments);

    this.map.markerdisperse.enable()
    this.map.markerdisperse.setOptions({ markerSize: [30, 30], minimumSpacing: 0, pattern: 'grid' });
  };

})();
