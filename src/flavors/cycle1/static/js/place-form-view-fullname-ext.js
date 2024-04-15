(function() {

  Shareabouts.PlaceFormView.prototype.events = {
    ...Shareabouts.PlaceFormView.prototype.events,
    'change input[name="title"]': 'onTitleChange',
    'change input[name="location_type"]': 'onLocationTypeChange',
    'change input[name="submitter_name_display_style"]': 'onSubmitterNameDisplayStyleChange',
    'input input[name="submitter_name_first"]': 'onSubmitterNameFirstChange',
    'input input[name="submitter_name_last"]': 'onSubmitterNameLastChange',
  };

  Shareabouts.PlaceFormView.prototype.initNameDisplaySample = function() {
    const nameDisplayStyleWrapper = this.el.querySelector('.place-submitter_name_display_style-field');
    const nameDisplayStyleRadioGroup = this.el.querySelector('.place-submitter_name_display_style-field .radio-group');

    const nameDisplaySampleDiv = document.createElement('div');
    nameDisplaySampleDiv.classList.add('submitter_name-display-sample');
    nameDisplayStyleWrapper.appendChild(nameDisplaySampleDiv);

    this.updateNameDisplaySample();
  }

  Shareabouts.PlaceFormView.prototype.updateNameDisplaySample = function() {
    const nameDisplayStyleInput = this.el.querySelector('[name="submitter_name_display_style"]:checked');
    if (!nameDisplayStyleInput) {
      return;
    }
    const displayStyle = nameDisplayStyleInput.value;

    const firstNameInput = this.el.querySelector('[name="submitter_name_first"]');
    const lastNameInput = this.el.querySelector('[name="submitter_name_last"]');
    const titleInput = this.el.querySelector('[name="title"]');
    const placeTypeInput = this.el.querySelector('[name="location_type"]:checked');
    const nameDisplaySampleDiv = this.el.querySelector('.submitter_name-display-sample');

    function showInstructions(instructions) {
      nameDisplaySampleDiv.innerHTML = `<div class="instructions">${instructions}</div>`;
    }

    function showIdeaDisplaySample(displayedName, category, title) {
      const sample = `${displayedName} submitted ${'aeiou'.includes(category[0].toLowerCase()) ? 'an' : 'a'} ${category} idea titled ${title}`;
      nameDisplaySampleDiv.innerHTML = `<label>Display sample:</label> <div class="sample">${sample}</div>`;
    }

    if (placeTypeInput === null || !placeTypeInput.value.trim()) {
      showInstructions('Enter a title and choose an idea category above to to see how your idea will be displayed.');
      return;
    }

    const placeType = Shareabouts.Config.placeTypes[placeTypeInput.value];
    const category = placeType ? (placeType.label || placeTypeInput.value) : '';
    const title = titleInput.value.trim();

    if (displayStyle === 'full_name') {
      if (!firstNameInput.value.trim() || !lastNameInput.value.trim()) {
        showInstructions('Enter your first and last name above to see how your idea will be displayed.');
        return;
      }

      showIdeaDisplaySample(`${firstNameInput.value} ${lastNameInput.value}`, category, title);

    } else if (displayStyle === 'first_name') {
      if (!firstNameInput.value.trim()) {
        showInstructions('Enter your first name above to see how your idea will be displayed.');
        return;
      }

      showIdeaDisplaySample(firstNameInput.value, category, title);

    } else if (displayStyle === 'no_name') {

      showIdeaDisplaySample(Shareabouts.Config.place.anonymous_name, category, title);

    }
  }

  Shareabouts.PlaceFormView.prototype.onSubmitterNameDisplayStyleChange = function(evt) {
    this.updateNameDisplaySample();
  }

  Shareabouts.PlaceFormView.prototype.onTitleChange = function() {
    this.updateNameDisplaySample();
  }

  Shareabouts.PlaceFormView.prototype.onLocationTypeChange = function() {
    this.updateNameDisplaySample();
  }

  Shareabouts.PlaceFormView.prototype.onSubmitterNameFirstChange = function() {
    this.updateNameDisplaySample();
  }

  Shareabouts.PlaceFormView.prototype.onSubmitterNameLastChange = function() {
    this.updateNameDisplaySample();
  }

  Shareabouts.PlaceFormView.prototype.rearrangeFullNameFields = function() {
    // Get the existing first and last name fields
    const firstNameInput = this.el.querySelector('[name="submitter_name_first"]');
    const lastNameInput = this.el.querySelector('[name="submitter_name_last"]');

    // Create a new wrapper for to contain the first and last name fields.
    const fullNameFieldWrapper = document.createElement('div')
    fullNameFieldWrapper.classList.add(
      'field',
      'text-field',
      'place-submitter_name_first-field',
      'place-submitter_name_last-field',
    );
    fullNameFieldWrapper.innerHTML = `
      <label class="field-label text-field-label" for="place-submitter_name_first">Your Full Name</label>
      <div class="fullname-field-wrapper">
        ${firstNameInput.outerHTML}
        ${lastNameInput.outerHTML}
      </div>
    `;

    // Insert the new wrapper before the first name field, then remove the first
    // and last name fields.
    const firstNameFieldWrapper = this.el.querySelector('.place-submitter_name_first-field');
    const lastNameFieldWrapper = this.el.querySelector('.place-submitter_name_last-field');
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
    this.initNameDisplaySample();

    return this;
  }

})();