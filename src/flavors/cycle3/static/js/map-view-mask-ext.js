// Add a mask to the map view
// ==============================
//
// This script extends the Shareabouts map view to add a semi-transparent mask over the map
// to highlight the city bounds. 

(function() {

  // Override the map view's initialize method to add the mask layer
  var Shareabouts_MapView_initialize = Shareabouts.MapView.prototype.initialize;
  Shareabouts.MapView.prototype.initialize = async function() {
    Shareabouts_MapView_initialize.apply(this, arguments);
    const map = this.map;
    const maskResponse = await fetch('/static/data/Boston_Boundary_Mask.geojson');
    const mask = await maskResponse.json();

    L.geoJSON(mask,{                                                                                      
      style: {
        color: '#cd2c67',                                                                                     
        fillColor: '#0f0309',
        fillOpacity: 0.5,
      }
    }).addTo(map);

  };
})();
