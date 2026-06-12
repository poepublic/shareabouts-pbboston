(function () {
  Shareabouts.PlaceListView.prototype.ui = {
    ...Shareabouts.PlaceListView.prototype.ui,
    scopeFilter: '.scope-filter',
    categoryFilter: '.category-filter',
    neighborhoodField: '#list-neighborhood',
    clearScopeFilter: '.clear-scope-filter',
    clearNeighborhoodFilter: '.clear-neighborhood-filter',
    clearCategoryFilter: '.clear-category-filter',
  };

  Shareabouts.PlaceListView.prototype.events = {
    ...Shareabouts.PlaceListView.prototype.events,
    'change @ui.scopeFilter': 'handleScopeChange',
    'change @ui.categoryFilter': 'handleCategoryChange',
    'change @ui.neighborhoodField': 'handleNeighborhoodChange',
    'click @ui.clearScopeFilter': 'handleClearScope',
    'click @ui.clearNeighborhoodFilter': 'handleClearNeighborhood',
    'click @ui.clearCategoryFilter': 'handleClearCategory',
  };

  Shareabouts.PlaceListView.prototype.handleClearScope = function () {
    this.ui.scopeFilter.val('').trigger('change');
  };

  Shareabouts.PlaceListView.prototype.handleClearNeighborhood = function () {
    this.ui.neighborhoodField.val('').trigger('change');
  };

  Shareabouts.PlaceListView.prototype.handleClearCategory = function () {
    this.ui.categoryFilter.val('').trigger('change');
  };

  Shareabouts.PlaceListView.prototype.removeFilter = function (filterName) {
    delete this.collectionFilters[filterName];
    this.applyFilters(this.collectionFilters, this.searchTerm);
  }

  Shareabouts.PlaceListView.prototype.handleScopeChange = function (evt) {
    const val = evt.target.value;
    if (val === 'city_wide') {
      this.removeFilter('neighborhood');
      this.filter({ 'city_wide': 'true' });
    } else if (val === 'location_specific') {
      this.filter({ 'city_wide': 'false' });
    } else {
      this.removeFilter('city_wide');
      this.updateFilterLinks();
    }
  };

  Shareabouts.PlaceListView.prototype.updateCategoryCounts = function () {
    const places = this.collection.models;
    const cityWide = this.collectionFilters.city_wide;
    const neighborhood = this.collectionFilters.neighborhood;

    this.ui.categoryFilter.find('option[data-label]').each(function () {
      const $opt = $(this);
      const type = $opt.val();
      const label = $opt.data('label');
      const count = places.filter(p => {
        if (p.get('location_type') !== type) return false;
        if (cityWide && p.get('city_wide') !== cityWide) return false;
        if (neighborhood && p.get('neighborhood') !== neighborhood) return false;
        return true;
      }).length;
      $opt.text(`${label} (${count})`);
    });
  };

  Shareabouts.PlaceListView.prototype.updateFilterLinks = function () {
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
    this.ui.clearScopeFilter.toggle(!!this.collectionFilters.city_wide);
    this.ui.clearNeighborhoodFilter.toggle(!!this.collectionFilters.neighborhood);
    this.ui.clearCategoryFilter.toggle(!!this.collectionFilters.location_type);
    this.updateCategoryCounts();
  };

  Shareabouts.PlaceListView.prototype.handleNeighborhoodChange = function (evt) {
    evt.preventDefault();
    var val = this.ui.neighborhoodField.val();
    if (this.collectionFilters.city_wide === 'true') this.removeFilter('city_wide');
    if (val) {
      this.filter({ 'neighborhood': val });
    } else {
      this.removeFilter('neighborhood');
      this.updateFilterLinks();
    }
  };

  Shareabouts.PlaceListView.prototype.handleCategoryChange = function (evt) {
    var val = this.ui.categoryFilter.val();
    Backbone.history.navigate(val ? '/filter/' + val : '/filter/all', { trigger: true });
  };

  const original_filter = Shareabouts.PlaceListView.prototype.filter;
  Shareabouts.PlaceListView.prototype.filter = function (filters, replace) {
    const result = original_filter.call(this, filters, replace);
    this.updateFilterLinks();
    return result;
  };

  // Only clears location_type (neighborhood and city_wide have their own reset paths)
  Shareabouts.PlaceListView.prototype.clearFilters = function () {
    delete this.collectionFilters.location_type;
    this.applyFilters(this.collectionFilters, this.searchTerm);
    this.updateFilterLinks();
  };

  // Ensure that the neighborhood data is available to the template.
  const Shareabouts_PlaceListView_serializeData = Shareabouts.PlaceListView.prototype.serializeData;
  Shareabouts.PlaceListView.prototype.serializeData = function () {
    const data = Shareabouts_PlaceListView_serializeData.apply(this, arguments);
    data.neighborhoods = Shareabouts.bootstrapped.neighborhoods.features.sort(
      (n1, n2) => n1.properties.name.localeCompare(n2.properties.name)
    );
    data.categories = Object.entries(Shareabouts.Config.placeTypes).map(([value, config]) => ({ value, label: config.label }));

    // Update counts once the collection finishes loading.
    this.listenToOnce(this.collection, 'reset', this.updateCategoryCounts);

    return data;
  };
})();