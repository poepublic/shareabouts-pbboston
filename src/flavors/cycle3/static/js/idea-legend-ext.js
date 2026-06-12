// Provide a way to loop through location types in a template.
Handlebars.registerHelper('each_place_type', function () {
  const args = Array.from(arguments);
  const options = args.slice(-1)[0];
  const exclusions = args.slice(0, args.length - 1);

  let result = '';
  for (const [type, typeOptions] of Object.entries(Shareabouts.Config.placeTypes)) {
    const data = {
      type,
      ...typeOptions
    };

    // if not an exclusion
    if (!exclusions.includes(type)) {
      result += options.fn(data);
    }
  }

  return result;
});

// Provide a way to determine whether a given place type is visible (i.e. not
// filtered out).
Handlebars.registerHelper('is_place_type_shown', function (type, options) {
  const path = window.location.pathname;
  const isFiltered = path.includes('/filter/') && !path.includes('/filter/all');
  const filterType = path.split('/').pop();

  const data = { isFiltered, ...this };
  return (!isFiltered || filterType === type) ? options.fn(data) : options.inverse(data);
});

// Provide a way to count the number of places for a given location type.
Handlebars.registerHelper('count_places', function (type) {
  if (!window.app) {
    return '…';
  }

  const places = window.app.collection.models;
  if (type) {
    return places.filter(place => place.get('location_type') === type).length;
  } else {
    return places.length;
  }
});



let legendLocationType = null;

// Chain on top of the city-wide renderAction override from activity-view-filters-ext.js.
const Shareabouts_ActivityView_renderAction = Shareabouts.ActivityView.prototype.renderAction;
Shareabouts.ActivityView.prototype.renderAction = function (model, index) {
  if (legendLocationType !== null) {
    const target = model.get('target') || {};
    if (target['location_type'] !== legendLocationType) return;
  }
  Shareabouts_ActivityView_renderAction.apply(this, arguments);
};

// Update the current count of places in the legend.
Shareabouts.AppView.prototype.renderLegend = function () {
  const legendWrapper = this.el.querySelector('.legend-wrapper');
  if (!legendWrapper) {
    return;
  }
  const html = Handlebars.templates['legend']();
  legendWrapper.innerHTML = html;

  legendWrapper.querySelectorAll('.legend-item').forEach(item => {
    const type = item.dataset.placeType;
    const color = Shareabouts.Config.placeTypes[type]?.color;
    if (color) item.style.setProperty('--hover-color', color);
  });
};

Shareabouts.AppView.prototype.toggleLegend = function () {
  const legendWrapper = this.el.querySelector('.legend-wrapper');
  legendWrapper.classList.toggle('open');
}

var original_AppView_initialize = Shareabouts.AppView.prototype.initialize;
Shareabouts.AppView.prototype.initialize = function () {
  const result = original_AppView_initialize.call(this, ...arguments);

  // Prevent ticker clicks from clearing the legend/category filter.
  $(document).off('click', '.activity-item a');

  const legendWrapper = document.createElement('div');
  legendWrapper.className = 'legend-wrapper';
  document.getElementById('map-container').append(legendWrapper);

  this.renderLegend();

  // Use app.collection events to trigger a legend update.
  this.boundRenderLegend = _.debounce(this.renderLegend, 0, false).bind(this);
  this.collection.on('add remove reset', this.boundRenderLegend);

  // Handle the legend toggle button.
  this.handleLegendToggleClick = (evt) => {
    if (evt.target.closest('.legend-toggle')) {
      this.toggleLegend();
    }
  };
  this.el.addEventListener('click', this.handleLegendToggleClick);

  // Filter the activity ticker when a legend category is clicked.
  this.handleLegendItemClick = (evt) => {
    const item = evt.target.closest('.legend-item');
    if (!item) return;
    const type = item.dataset.placeType;
    if (!type) return;

    // Close open spiders before filtering
    if (this.mapView && this.mapView.placeLayers) {
      Object.values(this.mapView.placeLayers).forEach(group => {
        if (group._spiderfied) group.unspiderfy();
      });
    }
    legendLocationType = (legendLocationType === type) ? null : type;
    this.activityView.render();
  };
  this.el.addEventListener('click', this.handleLegendItemClick);

  return result;
}

// Sync legend filter state and re-render when the map filter changes.
Shareabouts.AppView.prototype.setSelectedPlaceType = function (type) {
  legendLocationType = (!type || type === 'all') ? null : type;
  this.renderLegend();
  if (this.activityView) this.activityView.render();
}

var original_App_setLocationTypeFilter = Shareabouts.App.prototype.setLocationTypeFilter;
Shareabouts.App.prototype.setLocationTypeFilter = function (type) {
  const result = original_App_setLocationTypeFilter.call(this, ...arguments);
  this.appView.setSelectedPlaceType(type);
  return result;
}

Shareabouts.AppView.prototype.onClickClosePanelBtn = function (evt) {
  evt.preventDefault();
  Shareabouts.Util.log('USER', 'panel', 'close-btn-click');
  this.options.router.navigate('/', { trigger: true });
};
