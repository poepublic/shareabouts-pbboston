const Shareabouts_PlaceFormView_render = Shareabouts.PlaceFormView.prototype.render;
Shareabouts.PlaceFormView.prototype.render = function() {
  Shareabouts_PlaceFormView_render.apply(this, arguments);

  // // Initialize the select2 plugin for the neighborhood dropdown.
  // this.$('#place-submitter_neighborhood').select2();

  return this;
};
