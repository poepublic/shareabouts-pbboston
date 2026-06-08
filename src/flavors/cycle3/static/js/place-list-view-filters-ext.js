(function() {
  Shareabouts.PlaceListView.prototype.ui = {
    ...Shareabouts.PlaceListView.prototype.ui,
    scopeFilter: '.scope-filter',
    categoryFilter: '.category-filter',
    neighborhoodField: '#list-neighborhood',
  };

  Shareabouts.PlaceListView.prototype.events = {
    ...Shareabouts.PlaceListView.prototype.events,
    'change @ui.scopeFilter': 'handleScopeChange',
    'change @ui.categoryFilter': 'handleCategoryChange',
    'change @ui.neighborhoodField': 'handleNeighborhoodChange',
  };

  Shareabouts.PlaceListView.prototype.removeFilter = function(filterName) {
    delete this.collectionFilters[filterName];
    this.applyFilters(this.collectionFilters, this.searchTerm);
  }

  Shareabouts.PlaceListView.prototype.handleScopeChange = function(evt) {
    const val = evt.target.value;
    if (val === 'city_wide') {
      this.removeFilter('neighborhood');
      this.filter({'city_wide': 'true'});
    } else if (val === 'location_specific') {
      this.filter({'city_wide': 'false'});
    } else {
      this.removeFilter('city_wide');
    }
  };

  Shareabouts.PlaceListView.prototype.updateFilterLinks = function() {
    const scopeVal = this.collectionFilters.city_wide === 'true' ? 'city_wide'
      : this.collectionFilters.city_wide === 'false' ? 'location_specific'
      : '';
    this.ui.scopeFilter
      .val(scopeVal)
      .toggleClass('is-selected', !!this.collectionFilters.city_wide);
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