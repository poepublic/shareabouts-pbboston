(function() {

  // After the place form renders, re-arrange the submitter name fields so that
  // first and last name are adjacent.
  const Shareabouts_PlaceFormView_render = Shareabouts.PlaceFormView.prototype.render;
  Shareabouts.PlaceFormView.prototype.render = function() {
    Shareabouts_PlaceFormView_render.apply(this, arguments);

    const firstNameFieldWrapper = this.$('.place-submitter_name_first-field');
    const lastNameFieldWrapper = this.$('.place-submitter_name_last-field');

    const firstNameInput = this.$('[name="submitter_name_first"]');
    const lastNameInput = this.$('[name="submitter_name_last"]');

    const fullNameFieldHTML = `
      <div class="field text-field place-submitter_name_first-field place-submitter_name_last-field">
        <label class="field-label text-field-label" for="place-submitter_name_first">Your Full Name</label>
        <div class="fullname-field-wrapper">
          ${firstNameInput[0].outerHTML}
          ${lastNameInput[0].outerHTML}
        </div>
      </div>
    `;

    firstNameFieldWrapper.before(fullNameFieldHTML);
    firstNameFieldWrapper.remove();
    lastNameFieldWrapper.remove();

    return this;
  }

})();