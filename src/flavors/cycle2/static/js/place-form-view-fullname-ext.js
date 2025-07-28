(function() {

  const firstNameFieldName = 'private_submitter_name_first';
  const lastNameFieldName = 'private_submitter_name_last';
  const displayedNameFieldName = 'submitter_name';
  const nameDisplayStyleFieldName = 'private_submitter_name_display_style';

  Shareabouts.PlaceFormView.prototype.events = {
    ...Shareabouts.PlaceFormView.prototype.events,
    'change input[name="location_type"]': 'onLocationTypeChange',
    [`change input[name="${nameDisplayStyleFieldName}"]`]: 'onSubmitterNameDisplayStyleChange',
    [`input input[name="${firstNameFieldName}"]`]: 'onSubmitterNameFirstChange',
    [`input input[name="${lastNameFieldName}"]`]: 'onSubmitterNameLastChange',
  };

  Shareabouts.PlaceFormView.prototype.initNameDisplayValue = function() {
    const nameDisplayStyleWrapper = this.el.querySelector(`.place-${nameDisplayStyleFieldName}-field`);
    const nameDisplayStyleRadioGroup = this.el.querySelector(`.place-${nameDisplayStyleFieldName}-field .radio-group`);

    if (!nameDisplayStyleWrapper || !nameDisplayStyleRadioGroup) {
      console.warn('Could not find name display style radio group.');
      return;
    }

    const nameDisplaySampleDiv = document.createElement('div');
    nameDisplaySampleDiv.classList.add('submitter_name-display-sample');
    nameDisplayStyleWrapper.appendChild(nameDisplaySampleDiv);

    this.updateNameDisplayValue();
  }

  Shareabouts.PlaceFormView.prototype.updateNameDisplayValue = function() {
    const nameDisplayStyleInput = this.el.querySelector(`[name="${nameDisplayStyleFieldName}"]:checked`);
    if (!nameDisplayStyleInput) {
      return;
    }
    const displayStyle = nameDisplayStyleInput.value;

    const firstNameInput = this.el.querySelector(`[name="${firstNameFieldName}"]`);
    const lastNameInput = this.el.querySelector(`[name="${lastNameFieldName}"]`);
    const displayedNameInput = this.el.querySelector(`[name="${displayedNameFieldName}"]`);

    const placeTypeInput = this.el.querySelector('[name="location_type"]:checked');
    const placeType = placeTypeInput ? Shareabouts.Config.placeTypes[placeTypeInput.value] : '';
    const category = placeType ? (placeType.label || placeTypeInput.value) : '';
    const isCategorySelected = !!category;

    const firstName = firstNameInput ? firstNameInput.value.trim() : '';
    const lastName = lastNameInput ? lastNameInput.value.trim() : '';
    const isFirstEntered = !!firstName;
    const isLastEntered = !!lastName;
    const isFullEntered = (firstName && lastName);

    const needMoreInfo = (
      (displayStyle === 'full_name' && !isFullEntered) ||
      (displayStyle === 'first_name' && !isFirstEntered) ||
      !category
    )

    const nameDisplayContext = {
      displayStyle,
      firstName,
      lastName,
      anonymousName: Shareabouts.Config.place.anonymous_name,
      isFirstEntered,
      isLastEntered,
      isFullEntered,
      category,
      isCategorySelected,
      needMoreInfo,
    };

    const message = Handlebars.templates['fullname-display-message'](nameDisplayContext).trim();
    const displayedName = Handlebars.templates['fullname-display-value'](nameDisplayContext).trim();

    displayedNameInput.value = displayedName || '';

    const nameDisplaySampleDiv = this.el.querySelector('.submitter_name-display-sample');
    nameDisplaySampleDiv.innerHTML = message;
  }

  Shareabouts.PlaceFormView.prototype.onSubmitterNameDisplayStyleChange = function(evt) {
    this.updateNameDisplayValue();
  }

  Shareabouts.PlaceFormView.prototype.onLocationTypeChange = function() {
    this.updateNameDisplayValue();
  }

  Shareabouts.PlaceFormView.prototype.onSubmitterNameFirstChange = function() {
    this.updateNameDisplayValue();
  }

  Shareabouts.PlaceFormView.prototype.onSubmitterNameLastChange = function() {
    this.updateNameDisplayValue();
  }

  Shareabouts.PlaceFormView.prototype.rearrangeFullNameFields = function() {
    // Get the existing first and last name fields
    const firstNameInput = this.el.querySelector(`[name="${firstNameFieldName}"]`);
    const lastNameInput = this.el.querySelector(`[name="${lastNameFieldName}"]`);

    if (!firstNameInput || !lastNameInput) {
      console.warn('Could not find first and last name fields to rearrange.');
      return;
    }

    // Create a new wrapper for to contain the first and last name fields.
    const fullNameFieldWrapper = document.createElement('div')
    fullNameFieldWrapper.classList.add(
      'field',
      'text-field',
      `place-${firstNameFieldName}-field`,
      `place-${lastNameFieldName}-field`,
    );

    const fullNameFieldLabelHTML = Handlebars.templates['fullname-field-label']({
      name: firstNameFieldName,
    });
    fullNameFieldWrapper.innerHTML = `
      ${fullNameFieldLabelHTML}
      <div class="fullname-field-wrapper">
        ${firstNameInput.outerHTML}
        ${lastNameInput.outerHTML}
      </div>
    `;

    // Insert the new wrapper before the first name field, then remove the first
    // and last name fields.
    const firstNameFieldWrapper = this.el.querySelector(`.place-${firstNameFieldName}-field`);
    const lastNameFieldWrapper = this.el.querySelector(`.place-${lastNameFieldName}-field`);
    const fieldsParent = firstNameFieldWrapper.parentElement;
    fieldsParent.insertBefore(fullNameFieldWrapper, firstNameFieldWrapper);
    fieldsParent.removeChild(firstNameFieldWrapper);
    fieldsParent.removeChild(lastNameFieldWrapper);
  }

  const Shareabouts_PlaceFormView_render = Shareabouts.PlaceFormView.prototype.render;
  Shareabouts.PlaceFormView.prototype.render = function() {
    Shareabouts_PlaceFormView_render.apply(this, arguments);

    // After the place form renders, re-arrange the submitter name fields so that
    // first and last name are adjacent.
    this.rearrangeFullNameFields();

    // Set up an element after the name display style radio group to show the
    // user how their name will be displayed.
    this.initNameDisplayValue();

    return this;
  }

})();