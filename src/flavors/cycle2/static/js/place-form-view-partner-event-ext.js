// Show or hide the submission_event_organization field depending on the
// selection in the submission_event_type field. If the event type is "partner",
// then the user shoud be required to select an event organization. If the event
// type is anything else, then the organization field should no longer be
// required and should be hidden from view.

(function() {

  Shareabouts.PlaceFormView.prototype.events = {
    ...Shareabouts.PlaceFormView.prototype.events,
    [`change [data-has-detail-children]`]: 'onDetailParentChange',
  };

  Shareabouts.PlaceFormView.prototype.updateDetailChildren = function(parentName, parentValues) {
    const detailChildren = this.el.querySelectorAll(`[data-parent-field="${parentName}"]`);

    for (const child of detailChildren) {
      const childWrapper = this.el.querySelector(`.place-${child.name}-field`);
      const targetParentValue = child.getAttribute('data-parent-value');
      const isChildValueSelected = (parentValues.includes(targetParentValue));
      childWrapper.classList.toggle('hidden', !isChildValueSelected);
      child.required = isChildValueSelected;
    }
  }

  Shareabouts.PlaceFormView.prototype.initDetailChildren = function() {
    const detailParents = this.el.querySelectorAll('[data-has-detail-children]');
    const parentNames = [...new Set(Array.from(detailParents).map((p) => p.name))];
    for (const parentName of parentNames) {
      const parentValues = Array.from(detailParents).filter((p) => p.name === parentName && p.checked).map((p) => p.value);
      this.updateDetailChildren(parentName, parentValues);
    }
  }

  Shareabouts.PlaceFormView.prototype.onDetailParentChange = function(event) {
    const parent = event.target;
    const parentName = parent.name;
    const parentValues = Array.from(this.el.querySelectorAll(`[name="${parentName}"]:checked`)).map((p) => p.value);
    this.updateDetailChildren(parentName, parentValues);
  }

  const Shareabouts_PlaceFormView_render = Shareabouts.PlaceFormView.prototype.render;
  Shareabouts.PlaceFormView.prototype.render = function() {
    Shareabouts_PlaceFormView_render.apply(this, arguments);

    this.initDetailChildren();

    return this;
  }

})();