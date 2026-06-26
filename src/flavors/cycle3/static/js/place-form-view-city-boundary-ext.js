/* This extension ensures that submissions outside of the city boundaries are
not allowed. It uses the simplified city boundaries found in the
src/pbboston/static/data/City_of_Boston_Boundary_Simplified.geojson file, and
compares the currently-selected location to those boundaries using turf.js. */

(function() {
  'use strict';

  Shareabouts.PlaceFormView.prototype.showOutOfBoundsWarning = function() {
    // Make sure that the center point has been set after the form was
    // rendered. If not, this is a good indication that the user neglected
    // to move the map to set it in the correct location.
    this.$('.drag-marker-instructions').addClass('is-visuallyhidden');
    this.$('.out-of-bounds-warning').removeClass('is-visuallyhidden');

    // Scroll to the top of the panel if desktop
    this.$el.parent('article').scrollTop(0);
    // Scroll to the top of the window, if mobile
    window.scrollTo(0, 0);
  };

  const Shareabouts_PlaceFormView_initialize = Shareabouts.PlaceFormView.prototype.initialize;
  Shareabouts.PlaceFormView.prototype.initialize = function(options) {
    Shareabouts_PlaceFormView_initialize.call(this, options);
    this.isOutOfBounds = false;
  };
      
  const Shareabouts_PlaceFormView_setLocation = Shareabouts.PlaceFormView.prototype.setLocation;
  Shareabouts.PlaceFormView.prototype.setLocation = function(location) {
    // Check whether the current center point is within the city boundaries. If
    // not, show a warning and flag the location as invalid.
    const centerPoint = [this.center.lng, this.center.lat];
    const isWithinCityBoundaries = Shareabouts.bootstrapped.cityBoundary.features.some(
      boundaryFeature => turf.booleanPointInPolygon(centerPoint, boundaryFeature.geometry)
    );

    const locationReceiver = this.el.querySelector('.location-receiver');
    locationReceiver.classList.toggle('is-invalid', !isWithinCityBoundaries);

    if (isWithinCityBoundaries) {
      this.isOutOfBounds = false;
      Shareabouts_PlaceFormView_setLocation.call(this, location);
    } else {
      this.isOutOfBounds = true;
      this.location = null;
      locationReceiver.classList.add('awaiting-location');
      locationReceiver.innerHTML = Handlebars.templates['place-form-out-of-bounds-message']();
    }
  }

  const Shareabouts_PlaceFormView_setLatLng = Shareabouts.PlaceFormView.prototype.setLatLng;
  Shareabouts.PlaceFormView.prototype.setLatLng = function(latLng) {
    Shareabouts_PlaceFormView_setLatLng.call(this, latLng);
    this.$('.out-of-bounds-warning').addClass('is-visuallyhidden');
  }

  const Shareabouts_PlaceFormView_onSubmit = Shareabouts.PlaceFormView.prototype.onSubmit;
  Shareabouts.PlaceFormView.prototype.onSubmit = function(evt) {
    if (!this.isOutOfBounds) {
      return Shareabouts_PlaceFormView_onSubmit.call(this, evt);
    } else {
      evt.preventDefault();
      this.showOutOfBoundsWarning();
      return false;
    }
  }
})();