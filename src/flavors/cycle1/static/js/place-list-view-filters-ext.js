(function() {
  Shareabouts.PlaceListView.prototype.ui = {
    ...Shareabouts.PlaceListView.prototype.ui,
    allIdeasFilter: '.all-ideas-filter',
    cityWideFilter: '.city-wide-filter',
    locationSpecificFilter: '.location-specific-filter',
  };

  Shareabouts.PlaceListView.prototype.events = {
    ...Shareabouts.PlaceListView.prototype.events,
    'click @ui.allIdeasFilter': 'handleAllIdeasFilter',
    'click @ui.cityWideFilter': 'handleCityWideFilter',
    'click @ui.locationSpecificFilter': 'handleLocationSpecificFilter',
  };

  Shareabouts.PlaceListView.prototype.handleAllIdeasFilter = function(evt) {
    evt.preventDefault();
    console.log('handleAllIdeasFilter');
    this.clearFilters();
    this.updateFilterLinks();
  }

  Shareabouts.PlaceListView.prototype.handleCityWideFilter = function(evt) {
    evt.preventDefault();
    console.log('handleCityWideFilter');
    this.filter({'city_wide': 'true'}, true);
    this.updateFilterLinks();
  }

  Shareabouts.PlaceListView.prototype.handleLocationSpecificFilter = function(evt) {
    evt.preventDefault();
    console.log('handleLocationSpecificFilter');
    this.filter({'city_wide': 'false'}, true);
    this.updateFilterLinks();
  }

  Shareabouts.PlaceListView.prototype.updateFilterLinks = function() {
    this.ui.allIdeasFilter.toggleClass('is-selected', !this.collectionFilters.city_wide);
    this.ui.cityWideFilter.toggleClass('is-selected', this.collectionFilters.city_wide === 'true');
    this.ui.locationSpecificFilter.toggleClass('is-selected', this.collectionFilters.city_wide === 'false');
  }
})();