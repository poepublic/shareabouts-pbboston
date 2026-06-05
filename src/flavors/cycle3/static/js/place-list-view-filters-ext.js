(function() {
  Shareabouts.PlaceListView.prototype.ui = {
    ...Shareabouts.PlaceListView.prototype.ui,
    allIdeasFilter: '.all-ideas-filter',
    cityWideFilter: '.city-wide-filter',
    categoryFilter: '.category-filter',
    locationSpecificFilter: '.location-specific-filter',
    neighborhoodField: '#list-neighborhood',
  };

  Shareabouts.PlaceListView.prototype.events = {
    ...Shareabouts.PlaceListView.prototype.events,
    'click @ui.allIdeasFilter': 'handleAllIdeasFilter',
    'click @ui.cityWideFilter': 'handleCityWideFilter',
    'change @ui.categoryFilter': 'handleCategoryChange',
    'click @ui.locationSpecificFilter': 'handleLocationSpecificFilter',
    'change @ui.neighborhoodField': 'handleNeighborhoodChange',
  };

  Shareabouts.PlaceListView.prototype.removeFilter = function(filterName) {
    delete this.collectionFilters[filterName];
    this.applyFilters(this.collectionFilters, this.searchTerm);
  }

  Shareabouts.PlaceListView.prototype.handleAllIdeasFilter = function(evt) {
    evt.preventDefault();
    this.removeFilter('city_wide');
    this.removeFilter('neighborhood');

    this.updateFilterLinks();
  };

  Shareabouts.PlaceListView.prototype.handleCityWideFilter = function(evt) {
    evt.preventDefault();
    this.removeFilter('neighborhood');
    this.filter({'city_wide': 'true'});
  };

  Shareabouts.PlaceListView.prototype.handleLocationSpecificFilter = function(evt) {
    evt.preventDefault();
    this.removeFilter('neighborhood');
    this.filter({'city_wide': 'false'});
  };

  Shareabouts.PlaceListView.prototype.updateFilterLinks = function() {
    this.ui.allIdeasFilter.toggleClass('is-selected', !this.collectionFilters.city_wide && !this.collectionFilters.neighborhood);
    this.ui.cityWideFilter.toggleClass('is-selected', this.collectionFilters.city_wide === 'true');
    this.ui.locationSpecificFilter.toggleClass('is-selected', this.collectionFilters.city_wide === 'false');
    this.ui.neighborhoodField
      .val(this.collectionFilters.neighborhood ? this.collectionFilters.neighborhood : '')
      .toggleClass('is-selected', !!this.collectionFilters.neighborhood);
    this.ui.categoryFilter
      .val(this.collectionFilters.location_type ? this.collectionFilters.location_type : '')
      .toggleClass('is-selected', !!this.collectionFilters.location_type);
  };

  Shareabouts.PlaceListView.prototype.handleNeighborhoodChange = function(evt) {
    evt.preventDefault();
    var val = this.ui.neighborhoodField.val();
    this.removeFilter('city_wide');
    if (val) {
      this.filter({'neighborhood': val});
    } else {
      this.removeFilter('neighborhood');
    }
  };

  Shareabouts.PlaceListView.prototype.handleCategoryChange = function(evt) {
    var val = this.ui.categoryFilter.val();
    Backbone.history.navigate(val ? '/filter/' + val : '/filter/all', {trigger: true});
  };

  const original_filter = Shareabouts.PlaceListView.prototype.filter;
  Shareabouts.PlaceListView.prototype.filter = function(filters, replace) {
    const result = original_filter.call(this, filters, replace);
    this.updateFilterLinks();
    return result;
  };

  // Only clears location_type (neighborhood and city_wide have their own reset paths)
  Shareabouts.PlaceListView.prototype.clearFilters = function() {
    delete this.collectionFilters.location_type;
    this.applyFilters(this.collectionFilters, this.searchTerm);
    this.updateFilterLinks();
  };

  // Ensure that the neighborhood data is available to the template.
  const Shareabouts_PlaceListView_serializeData = Shareabouts.PlaceListView.prototype.serializeData;
  Shareabouts.PlaceListView.prototype.serializeData = function() {
    const data = Shareabouts_PlaceListView_serializeData.apply(this, arguments);
    data.neighborhoods = Shareabouts.bootstrapped.neighborhoods.features.sort(
      (n1, n2) => n1.properties.name.localeCompare(n2.properties.name)
    );
    data.categories = Object.entries(Shareabouts.Config.placeTypes).map(([value, config]) => ({value, label: config.label}));
    return data;
  };
})();