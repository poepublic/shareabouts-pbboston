// Show or hide a subfield depending on the selection in some main field with a
// data-has-children attribute. E.g., if the event type is "partner", then the
// user shoud be required to select an event organization. If the event type is
// anything else, then the organization field should no longer be required and
// should be hidden from view.
//
// In the config.yml file, set up a subfield with a data-parent-field
// attribute that matches the name of the main field, and a data-parent-value
// attribute that matches the value of the main field that should trigger the
// subfield to be shown. The subfield will be hidden by default, and will only
// be shown when the main field is set to the specified value.
//
// The parent field should also have a data-has-children attribute to indicate
// that it has subfields that depend on its value.
//
// Example:
//    - name: submission_event_type
//      type: radio
//      label: Event Type
//      options:
//        - value: partner
//          label: Partner Event
//        - value: non-partner
//          label: Non-Partner Event
//      attrs:
//        - key: required
//        - key: data-has-children  # <- this indicates that this field has children
//
//    - name: submission_event_organization
//      type: text
//      label: Event Organization
//      attrs:
//        - key: required
//        - key: data-parent-field  # <- this indicates that this field is a child of the parent field
//          value: submission_event_type
//        - key: data-parent-value  # <- this indicates the value of the parent field that should trigger this child field to be shown
//          value: partner

(function() {

  Shareabouts.PlaceFormView.prototype.events = {
    ...Shareabouts.PlaceFormView.prototype.events,
    [`change [data-has-children]`]: 'onParentChange',
  };

  Shareabouts.PlaceFormView.prototype.updateChildren = function(parentName, parentValues) {
    const children = this.el.querySelectorAll(`[data-parent-field="${parentName}"]`);

    for (const child of children) {
      if (this.isChildRequiredWhenVisible[child.name] === undefined) {
        this.isChildRequiredWhenVisible[child.name] = child.required;
      }

      const childWrapper = this.el.querySelector(`.place-${child.name}-field`);
      const targetParentValue = child.getAttribute('data-parent-value');
      const isChildValueSelected = (parentValues.includes(targetParentValue));
      childWrapper.classList.toggle('hidden', !isChildValueSelected);
      child.required = isChildValueSelected && this.isChildRequiredWhenVisible[child.name];
    }
  }

  Shareabouts.PlaceFormView.prototype.initChildren = function() {
    // Store the original required state of each child field when it is visible.
    // This allows us to restore the required state when the child field is
    // shown again after being hidden.
    this.isChildRequiredWhenVisible = {};

    const parents = this.el.querySelectorAll('[data-has-children]');
    const parentNames = [...new Set(Array.from(parents).map((p) => p.name))];
    for (const parentName of parentNames) {
      const parentValues = Array.from(parents).filter((p) => p.name === parentName && p.checked).map((p) => p.value);
      this.updateChildren(parentName, parentValues);
    }
  }

  Shareabouts.PlaceFormView.prototype.onParentChange = function(event) {
    const parent = event.target;
    const parentName = parent.name;
    const parentValues = Array.from(this.el.querySelectorAll(`[name="${parentName}"]:checked`)).map((p) => p.value);
    this.updateChildren(parentName, parentValues);
  }

  const Shareabouts_PlaceFormView_render = Shareabouts.PlaceFormView.prototype.render;
  Shareabouts.PlaceFormView.prototype.render = function() {
    Shareabouts_PlaceFormView_render.apply(this, arguments);

    this.initChildren();

    return this;
  }

})();