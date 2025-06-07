// Show or hide a subfield depending on the selection in some main field with a
// data-has-children attribute. E.g., if the event type is "partner", then the
// user shoud be required to select an event organization. If the event type is
// anything else, then the organization field should no longer be required and
// should be hidden from view.

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