// Place form view category extensions
// ===================================
//
// This script extends the place form view to include category selector
// descriptions.

(function() {
  const Shareabouts_PlaceFormView_events = Shareabouts.PlaceFormView.prototype.events;
  Shareabouts.PlaceFormView.prototype.events = {
    ...Shareabouts_PlaceFormView_events,
    'change [name="location_type"]': 'onCategoryChange',
    'mouseenter .place-location_type-field .radio-group label': 'onCategoryMouseEnter',
    'mouseleave .place-location_type-field .radio-group label': 'onCategoryMouseLeave',
  };

  const Shareabouts_PlaceFormView_render = Shareabouts.PlaceFormView.prototype.render;
  Shareabouts.PlaceFormView.prototype.render = function() {
    Shareabouts_PlaceFormView_render.apply(this, arguments);

    // Create invisible descriptions for each of the category radio button options.
    const categoryInputs = this.el.querySelectorAll('.place-location_type-field .radio-group input');
    for (const input of categoryInputs) {
      const category = input.value;
      const description = `${this.options.placeTypes[category].label}: ${this.options.placeTypes[category].description}`;

      const descriptionEl = document.createElement('span');
      descriptionEl.classList.add('hidden');
      descriptionEl.id = `category-description-${category}`;
      descriptionEl.innerHTML = description;
      this.el.appendChild(descriptionEl);

      input.setAttribute('aria-describedby', `category-description-${category}`);
    }

    return this;
  };

  Shareabouts.PlaceFormView.prototype.onCategoryChange = function(evt) {
    this.selectCategoryDescription(evt.currentTarget.value);
  };

  Shareabouts.PlaceFormView.prototype.onCategoryMouseEnter = function(evt) {
    const label = evt.currentTarget;
    const input = label.querySelector('input');
    this.hoverCategoryDescription(input.value, label);
  };

  Shareabouts.PlaceFormView.prototype.onCategoryMouseLeave = function(evt) {
    this.hideHoveredCategoryDescription();
  };

  Shareabouts.PlaceFormView.prototype.selectCategoryDescription = function(category) {
    const description = `
      <span class="category-description-label">${this.options.placeTypes[category].label}</span>
      <span class="categoty-description-text">${this.options.placeTypes[category].description}</span>
    `;

    this.$('.category-description-selected')
      .html(description)
      .removeClass('hidden');

    this.$('.place-location_type-field .instructions').addClass('hidden');
  };

  Shareabouts.PlaceFormView.prototype.hoverCategoryDescription = function(category, label) {
    const description = `
    <span class="category-description-label" aria-hidden="true">${this.options.placeTypes[category].label}</span>
    <span class="categoty-description-text" aria-hidden="true">${this.options.placeTypes[category].description}</span>
    `;

    const labelRect = label.getBoundingClientRect();
    const hoverWrapperRect = this.$('.place-location_type-option-description-hover-wrapper')[0].getBoundingClientRect();
    const distTopToBottom = labelRect.bottom - hoverWrapperRect.top;
    const distBottomToTop = hoverWrapperRect.bottom - labelRect.top;

    const $description = this.$('.category-description-hovered');

    $description.html(description)
      .css('top', distTopToBottom)
      .css('bottom', '')
      .removeClass('hidden');

    const descriptionRect = $description[0].getBoundingClientRect();
    const contentRect = document.getElementById('content').getBoundingClientRect();

    if (descriptionRect.bottom > contentRect.bottom) {
      $description
        .css('top', '')
        .css('bottom', distBottomToTop);
    }
  };

  Shareabouts.PlaceFormView.prototype.hideHoveredCategoryDescription = function() {
    this.$('.category-description-hovered').addClass('hidden');
  };
})();