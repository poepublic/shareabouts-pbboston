// Enable switching between light and dark mode

(function () {

  Shareabouts.Util.getColorScheme = function () {

    // Check if the user has a preference for dark mode
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    // Check if the user has a preference for light mode
    const prefersLightScheme = window.matchMedia("(prefers-color-scheme: light)").matches;
    
    // Check if the user has no preference
    const noPreference = window.matchMedia("(prefers-color-scheme: no-preference)").matches;
    
    // Return the user's preference
    if (prefersDarkScheme) {
      return 'dark';
    } else if (prefersLightScheme) {
      return 'light';
    } else if (noPreference) {
      return 'no-preference';
    } else {
      return 'unknown';
    }
  };

  // Override the map_view's constructMap method to add new tile panes for light and dark mode tiles.
  var Shareabouts_MapView_constructMap = Shareabouts.MapView.prototype.constructMap;
  Shareabouts.MapView.prototype.constructMap = function () {
    const map = Shareabouts_MapView_constructMap.apply(this, arguments);
    
    // Create a new pane for the light mode tiles.
    var lightPane = map.createPane('lightPane');
    lightPane.style.zIndex = 200;
    lightPane.style.pointerEvents = 'none';
    
    // Create a new pane for the dark mode tiles.
    var darkPane = map.createPane('darkPane');
    darkPane.style.zIndex = 200;
    darkPane.style.pointerEvents = 'none';

    // Listen for changes to the user's color scheme preference.
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
      const pane = e.matches ? 'darkPane' : 'lightPane';

      // The tile pane may have been display none, so we need to redraw the map.
      setTimeout(() => {
        map.invalidateSize();
        map.eachLayer(function (layer) {
          if (layer.options.pane === pane) {
            layer.redraw();
          }
        });
      }, 0);
    });

    return map;
  };  

})();