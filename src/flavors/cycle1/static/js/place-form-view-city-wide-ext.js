// Toggle between place-specific and city-wide mode
// ================================================
//
// On the place form, we have an option for toggling between a place-specific
// idea and a city-wide idea. The form field name is "city_wide" and should be
// present in the flavor configuration.
//
// When the user toggles between place-specific and city-wide, a data attribute
// is added to the body element. This attribute is used to hide/show the
// place-specific fields in the form, the prompt to move the map to set the
// idea's location, and the location pin on the map.
//
// Usage
// ~~~~~
// In the flavor config.yml file:
// - Set the place.city_wide_location_label to something like
//   "Multiple locations throughout the city"
// - Set the place.city_wide_location_center to a [lng, lat] pair
// - Set the place.city_wide_location_offset to the maximum number of meters to
//   place a city-wide idea marker from the city-wide location center
// - Set the place.unset_location_label to something like:
//   "Drag the map to set the location."
// - Add turf.js (as well as this script) to the includes block in index.html
//   <script src='https://unpkg.com/@turf/turf@6/turf.min.js'></script>
// - Include the city-wide CSS extensions in your custom CSS
//   @import url('/static/css/city-wide-ext.css');
//
// See also the accompanying styles related to "city_wide" in the custom CSS,
// and the place.city_wide_location_label config.yml option.

// Handler for the city-wide checkbox:
Shareabouts.PlaceFormView.prototype.events['change input[name="city_wide"]'] = 'onCityWideChange';
Shareabouts.PlaceFormView.prototype.onCityWideChange = function(evt) {
  if (evt.currentTarget.checked) {
    this.resetCityWide(evt.currentTarget.value);
  }
}

// Procedure to reconfigure the form based on the city-wide status:
Shareabouts.PlaceFormView.prototype.resetCityWide = function(isCityWide) {
  $('body').attr('data-city_wide', isCityWide);

  if (isCityWide == 'true') {
    this.setCityWideLatLng();
  } else {
    this.unsetLatLng();
  }
}

// Use a custom version of the form view's setLocation function when city-wide
// is set to true:
var original_PlaceFormView_setLocation = Shareabouts.PlaceFormView.prototype.setLocation;
function cityWide_PlaceFormView_setLocation() {
  const location = null;
  this.$('.location-receiver').html(this.options.placeConfig.city_wide_location_label);
}

// Save the original version of the form view's setLatLng function so that we
// can set it to no-op when city-wide is set to true:
var original_PlaceFormView_setLatLng = Shareabouts.PlaceFormView.prototype.setLatLng;

// Set a location near City Hall:
Shareabouts.PlaceFormView.prototype.setCityWideLatLng = function(latLng) {
  const pt = turf.point(this.options.placeConfig.city_wide_location_center);

  // Offset city-wide ideas some random amount within 50 meters.
  const offsetDist = Math.random() * this.options.placeConfig.city_wide_location_offset;
  const offsetDir = Math.random() * 360;
  const randpt = turf.transformTranslate(pt, offsetDist, offsetDir, {units: 'meters'});

  this.setLatLng({lng: randpt.geometry.coordinates[0], lat: randpt.geometry.coordinates[1]});

  // Make it so that any actions that would normally alter the form's latlng
  // (like moving the map) will have no effect.
  Shareabouts.PlaceFormView.prototype.setLatLng = function() {};

  // Update the reverse geocoded label too.
  Shareabouts.PlaceFormView.prototype.setLocation = cityWide_PlaceFormView_setLocation;
  this.setLocation();
}

// Return the form to the state of needing to select a location:
Shareabouts.PlaceFormView.prototype.unsetLatLng = function() {
  this.center = null;
  this.$('.drag-marker-instructions').removeClass('is-visuallyhidden');
  this.$('.approx-address, .drag-marker-warning').addClass('is-visuallyhidden');

  // Restore the original setLocation function and location label.
  Shareabouts.PlaceFormView.prototype.setLatLng = original_PlaceFormView_setLatLng;
  Shareabouts.PlaceFormView.prototype.setLocation = original_PlaceFormView_setLocation;
  this.location = null;
  this.$('.location-receiver').html(this.options.placeConfig.unset_location_label);
}

// After the user submits their idea, revert the body and the place form back
// to their original states:
var original_AppView_newPlace = Shareabouts.AppView.prototype.newPlace;
Shareabouts.AppView.prototype.newPlace = function() {
  $('body').removeAttr('data-city_wide');
  Shareabouts.PlaceFormView.prototype.setLatLng = original_PlaceFormView_setLatLng;
  Shareabouts.PlaceFormView.prototype.setLocation = original_PlaceFormView_setLocation;

  original_AppView_newPlace.call(this, ...arguments);
}