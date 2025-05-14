// Show or hide the submission_event_organization field depending on the
// selection in the submission_event_type field. If the event type is "partner",
// then the user shoud be required to select an event organization. If the event
// type is anything else, then the organization field should no longer be
// required and should be hidden from view.

(function() {

  const eventTypeFieldName = 'submission_event_type';
  const eventOrgFieldName = 'submission_event_org';

  Shareabouts.PlaceFormView.prototype.events = {
    ...Shareabouts.PlaceFormView.prototype.events,
    [`change input[name="${eventTypeFieldName}"]`]: 'onSubmissionEventTypeChange',
  };

  Shareabouts.PlaceFormView.prototype.updateSubmissionEventFields = function() {
    const eventTypeInput = this.el.querySelector(`input[name="${eventTypeFieldName}"]:checked`);
    const eventOrgInput = this.el.querySelector(`[name="${eventOrgFieldName}"]`);
    const eventOrgFieldWrapper = this.el.querySelector(`.place-${eventOrgFieldName}-field`);

    const isPartnerEvent = (eventTypeInput?.value === 'partner');
    eventOrgFieldWrapper.classList.toggle('hidden', !isPartnerEvent);
    eventOrgInput.required = isPartnerEvent;
  }

  Shareabouts.PlaceFormView.prototype.initSubmissionEventType = function() {
    this.updateSubmissionEventFields();
  }

  Shareabouts.PlaceFormView.prototype.onSubmissionEventTypeChange = function() {
    this.updateSubmissionEventFields();
  };

  const Shareabouts_PlaceFormView_render = Shareabouts.PlaceFormView.prototype.render;
  Shareabouts.PlaceFormView.prototype.render = function() {
    Shareabouts_PlaceFormView_render.apply(this, arguments);

    this.initSubmissionEventType();

    return this;
  }

})();