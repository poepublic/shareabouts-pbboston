(function() {
  Shareabouts.PlaceListView.prototype.ui = {
    ...Shareabouts.PlaceListView.prototype.ui,
    allIdeasFilter: '.all-ideas-filter',
    cityWideFilter: '.city-wide-filter',
    locationSpecificFilter: '.location-specific-filter',
    neighborhoodField: '#list-neighborhood',
  };

  Shareabouts.PlaceListView.prototype.events = {
    ...Shareabouts.PlaceListView.prototype.events,
    'click @ui.allIdeasFilter': 'handleAllIdeasFilter',
    'click @ui.cityWideFilter': 'handleCityWideFilter',
    'click @ui.locationSpecificFilter': 'handleLocationSpecificFilter',
    'change @ui.neighborhoodField': 'handleNeighborhoodChange',
  };

  Shareabouts.PlaceListView.prototype.removeFilter = function(filterName) {
    delete this.collectionFilters[filterName];
    this.applyFilters(this.collectionFilters, this.searchTerm);
  }

  Shareabouts.PlaceListView.prototype.handleAllIdeasFilter = function(evt) {
    evt.preventDefault();
    console.log('handleAllIdeasFilter');
    this.removeFilter('city_wide');
    this.removeFilter('neighborhood');

    this.updateFilterLinks();
  };

  Shareabouts.PlaceListView.prototype.handleCityWideFilter = function(evt) {
    evt.preventDefault();
    console.log('handleCityWideFilter');
    this.removeFilter('neighborhood');
    this.filter({'city_wide': 'true'});

    this.updateFilterLinks();
  };

  Shareabouts.PlaceListView.prototype.handleLocationSpecificFilter = function(evt) {
    evt.preventDefault();
    console.log('handleLocationSpecificFilter');
    this.removeFilter('neighborhood');
    this.filter({'city_wide': 'false'});

    this.updateFilterLinks();
  };

  Shareabouts.PlaceListView.prototype.updateFilterLinks = function() {
    this.ui.allIdeasFilter.toggleClass('is-selected', !this.collectionFilters.city_wide && !this.collectionFilters.neighborhood);
    this.ui.cityWideFilter.toggleClass('is-selected', this.collectionFilters.city_wide === 'true');
    this.ui.locationSpecificFilter.toggleClass('is-selected', this.collectionFilters.city_wide === 'false');
    this.ui.neighborhoodField
      .val(this.collectionFilters.neighborhood ? this.collectionFilters.neighborhood : '')
      .toggleClass('is-selected', !!this.collectionFilters.neighborhood);
  };

  Shareabouts.PlaceListView.prototype.handleNeighborhoodChange = function(evt) {
    evt.preventDefault();
    this.removeFilter('city_wide');
    this.filter({'neighborhood': this.ui.neighborhoodField.val()});

    this.updateFilterLinks();
  };

  // Ensure that the neighborhood data is available to the template.
  const Shareabouts_PlaceListView_serializeData = Shareabouts.PlaceListView.prototype.serializeData;
  Shareabouts.PlaceListView.prototype.serializeData = function() {
    const data = Shareabouts_PlaceListView_serializeData.apply(this, arguments);
    data.neighborhoods = Shareabouts.bootstrapped.neighborhoods.features.sort(
      (n1, n2) => n1.properties.name.localeCompare(n2.properties.name)
    );
    return data;
  };
})();